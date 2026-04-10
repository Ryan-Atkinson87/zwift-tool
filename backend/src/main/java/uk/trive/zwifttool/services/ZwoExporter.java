package uk.trive.zwifttool.services;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import uk.trive.zwifttool.models.Block;
import uk.trive.zwifttool.models.Workout;

/**
 * Generates Zwift .zwo XML files from saved workout entities and assembles
 * them into zip archives for download.
 *
 * <p>Interval content is stored in blocks as a JSON array matching the
 * {@code ParsedInterval} shape used by the frontend. This service parses
 * that JSON and serialises each interval to the corresponding .zwo XML
 * element according to the format described in the project instructions.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ZwoExporter {

    private final ObjectMapper objectMapper;

    /**
     * Builds a zip archive containing one .zwo file per workout.
     *
     * <p>Each file is named after the workout with characters that are unsafe
     * in filenames replaced by underscores. Duplicate names within the same
     * zip are possible if two workouts share a sanitised name; Zwift will
     * accept both files if placed in the correct folder.</p>
     *
     * @param workouts the workouts to include in the zip
     * @return the zip archive as a byte array
     * @throws IOException if the zip output stream cannot be written
     */
    public byte[] buildZip(List<Workout> workouts) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(baos)) {
            for (Workout workout : workouts) {
                String xml = buildZwoXml(workout);
                String filename = sanitiseFilename(workout.getName()) + ".zwo";
                zip.putNextEntry(new ZipEntry(filename));
                zip.write(xml.getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
            }
        }
        return baos.toByteArray();
    }

    /**
     * Generates .zwo XML for a single workout. Outputs sections in the
     * canonical order: warm-up (if present), main set, cool-down (if present).
     *
     * @param workout the workout to serialise
     * @return the .zwo XML string
     */
    public String buildZwoXml(Workout workout) {
        StringBuilder sb = new StringBuilder();
        sb.append("<?xml version=\"1.0\" encoding=\"utf-8\"?>\n");
        sb.append("<workout_file>\n");
        appendMetaTag(sb, "n", workout.getName());
        if (workout.getAuthor() != null) {
            appendMetaTag(sb, "author", workout.getAuthor());
        }
        if (workout.getDescription() != null) {
            appendMetaTag(sb, "description", workout.getDescription());
        }
        sb.append("  <sportType>bike</sportType>\n");
        sb.append("  <workout>\n");

        if (workout.getWarmupBlock() != null) {
            appendBlockIntervals(sb, workout.getWarmupBlock());
        }
        appendBlockIntervals(sb, workout.getMainsetBlock());
        if (workout.getCooldownBlock() != null) {
            appendBlockIntervals(sb, workout.getCooldownBlock());
        }

        sb.append("  </workout>\n");
        sb.append("</workout_file>\n");
        return sb.toString();
    }

    /**
     * Appends a simple XML metadata element with escaped text content.
     */
    private void appendMetaTag(StringBuilder sb, String tag, String value) {
        sb.append("  <").append(tag).append(">")
                .append(escapeXml(value))
                .append("</").append(tag).append(">\n");
    }

    /**
     * Parses the JSON content of a block and appends each interval as an
     * XML element. Malformed block content is skipped with a warning rather
     * than failing the entire export.
     */
    private void appendBlockIntervals(StringBuilder sb, Block block) {
        if (block.getContent() == null || block.getContent().isBlank()) {
            return;
        }
        try {
            JsonNode intervals = objectMapper.readTree(block.getContent());
            for (JsonNode interval : intervals) {
                String type = interval.path("type").asText();
                String element = buildIntervalElement(type, interval);
                if (!element.isEmpty()) {
                    sb.append("    ").append(element).append("\n");
                }
            }
        } catch (Exception e) {
            log.warn("Failed to parse interval content for block {}: {}", block.getId(), e.getMessage());
        }
    }

    /**
     * Dispatches to the correct element builder based on the interval type.
     */
    private String buildIntervalElement(String type, JsonNode interval) {
        return switch (type) {
            case "SteadyState" -> buildSteadyState(interval);
            case "Warmup" -> buildRampTag("Warmup", interval);
            case "Cooldown" -> buildRampTag("Cooldown", interval);
            case "Ramp" -> buildRampTag("Ramp", interval);
            case "FreeRide" -> buildFreeRide(interval);
            case "IntervalsT" -> buildIntervalsT(interval);
            default -> {
                log.warn("Unknown interval type '{}' encountered during .zwo export", type);
                yield "";
            }
        };
    }

    /**
     * Builds a SteadyState element: single power value, constant duration.
     */
    private String buildSteadyState(JsonNode interval) {
        StringBuilder el = new StringBuilder("<SteadyState");
        el.append(" Duration=\"").append(interval.path("durationSeconds").asInt()).append("\"");
        el.append(" Power=\"").append(formatPower(interval.path("power"))).append("\"");
        appendCadence(el, interval);
        el.append("/>");
        return el.toString();
    }

    /**
     * Builds a ramp-style element (Warmup, Cooldown, or Ramp) using
     * PowerLow and PowerHigh attributes. The {@code power} field maps
     * to PowerLow and {@code powerHigh} maps to PowerHigh.
     *
     * <p>Zwift uses PowerLow and PowerHigh for ramp intervals regardless of
     * whether power is going up or down, so warm-ups and cool-downs both use
     * this format with the values ordered accordingly by the frontend.</p>
     */
    private String buildRampTag(String tag, JsonNode interval) {
        StringBuilder el = new StringBuilder("<").append(tag);
        el.append(" Duration=\"").append(interval.path("durationSeconds").asInt()).append("\"");
        el.append(" PowerLow=\"").append(formatPower(interval.path("power"))).append("\"");
        el.append(" PowerHigh=\"").append(formatPower(interval.path("powerHigh"))).append("\"");
        appendCadence(el, interval);
        el.append("/>");
        return el.toString();
    }

    /**
     * Builds a FreeRide element: duration only, no power target.
     */
    private String buildFreeRide(JsonNode interval) {
        StringBuilder el = new StringBuilder("<FreeRide");
        el.append(" Duration=\"").append(interval.path("durationSeconds").asInt()).append("\"");
        appendCadence(el, interval);
        el.append("/>");
        return el.toString();
    }

    /**
     * Builds an IntervalsT element: repeat count with on/off duration and
     * power pairs.
     */
    private String buildIntervalsT(JsonNode interval) {
        StringBuilder el = new StringBuilder("<IntervalsT");
        el.append(" Repeat=\"").append(interval.path("repeat").asInt()).append("\"");
        el.append(" OnDuration=\"").append(interval.path("onDuration").asInt()).append("\"");
        el.append(" OffDuration=\"").append(interval.path("offDuration").asInt()).append("\"");
        el.append(" OnPower=\"").append(formatPower(interval.path("onPower"))).append("\"");
        el.append(" OffPower=\"").append(formatPower(interval.path("offPower"))).append("\"");
        appendCadence(el, interval);
        el.append("/>");
        return el.toString();
    }

    /**
     * Appends a Cadence attribute to the element if the interval has one.
     * Cadence is optional across all interval types.
     */
    private void appendCadence(StringBuilder el, JsonNode interval) {
        JsonNode cadence = interval.path("cadence");
        if (!cadence.isNull() && !cadence.isMissingNode()) {
            el.append(" Cadence=\"").append(cadence.asInt()).append("\"");
        }
    }

    /**
     * Formats a power fraction value (e.g. 0.88) to two decimal places for
     * .zwo output. Returns {@code "0.00"} for absent or null values so the
     * XML remains valid even when content is incomplete.
     */
    private String formatPower(JsonNode node) {
        if (node.isNull() || node.isMissingNode()) {
            return "0.00";
        }
        return String.format("%.2f", node.asDouble());
    }

    /**
     * Replaces characters that are unsafe in file system names with underscores.
     * Preserves alphanumeric characters, spaces, hyphens, and underscores.
     */
    private String sanitiseFilename(String name) {
        return name.replaceAll("[^a-zA-Z0-9 _-]", "_").trim();
    }

    /**
     * Escapes XML special characters in a text value.
     */
    private String escapeXml(String value) {
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }
}
