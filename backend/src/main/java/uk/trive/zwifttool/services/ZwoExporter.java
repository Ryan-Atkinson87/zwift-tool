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
     * in filenames replaced by underscores. When two or more workouts produce
     * the same sanitised name, a numeric suffix is appended to each duplicate
     * (e.g. {@code My_Workout_2.zwo}, {@code My_Workout_3.zwo}) so every
     * entry in the archive has a unique filename.</p>
     *
     * @param workouts the workouts to include in the zip
     * @return the zip archive as a byte array
     * @throws IOException if the zip output stream cannot be written
     */
    public byte[] buildZip(List<Workout> workouts) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(baos)) {
            // Track how many times each base name has been used so duplicates
            // can be suffixed with an incrementing counter.
            java.util.Map<String, Integer> nameCounts = new java.util.HashMap<>();
            for (Workout workout : workouts) {
                String xml = buildZwoXml(workout);
                String baseName = sanitiseFilename(workout.getName());
                int count = nameCounts.merge(baseName, 1, Integer::sum);
                String filename = count == 1 ? baseName + ".zwo" : baseName + "_" + count + ".zwo";
                zip.putNextEntry(new ZipEntry(filename));
                zip.write(xml.getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
            }
        }
        return baos.toByteArray();
    }

    /**
     * Generates .zwo XML for a single workout. Outputs sections in the
     * canonical order: warm-up (if present), main set, cool-down (if present),
     * followed by any text events.
     *
     * @param workout the workout to serialise
     * @return the .zwo XML string
     */
    public String buildZwoXml(Workout workout) {
        StringBuilder sb = new StringBuilder();
        sb.append("<workout_file>\n");
        // Bug 1 fix: use <name> not <n>, and write the name exactly as stored with no slugification
        appendMetaTag(sb, "name", workout.getName());
        if (workout.getAuthor() != null) {
            appendMetaTag(sb, "author", workout.getAuthor());
        }
        // Bug 2 fix: always include <description>, even when null or empty
        String description = workout.getDescription() != null ? workout.getDescription() : "";
        appendMetaTag(sb, "description", description);
        sb.append("  <sportType>bike</sportType>\n");
        // Bug 3 fix: round-trip the <tags> block verbatim if one was stored on import
        if (workout.getTags() != null && !workout.getTags().isBlank()) {
            sb.append("  ").append(workout.getTags().strip()).append("\n");
        }
        sb.append("  <workout>\n");

        if (workout.getWarmupBlock() != null) {
            appendBlockIntervals(sb, workout.getWarmupBlock());
        }
        appendBlockIntervals(sb, workout.getMainsetBlock());
        if (workout.getCooldownBlock() != null) {
            appendBlockIntervals(sb, workout.getCooldownBlock());
        }
        appendTextEvents(sb, workout.getTextEvents());

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
     * Formats a power fraction value (e.g. 0.88) to four decimal places for
     * .zwo output. Four decimal places preserve zone boundary distinctions
     * (e.g. 0.6545 vs 0.6500) that are collapsed by two-decimal rounding.
     * Returns {@code "0.0000"} for absent or null values so the XML remains
     * valid even when content is incomplete.
     */
    private String formatPower(JsonNode node) {
        if (node.isNull() || node.isMissingNode()) {
            return "0.0000";
        }
        return String.format("%.4f", node.asDouble());
    }

    /**
     * Appends text event elements to the workout XML. Events are emitted in
     * the order they are stored. Missing, null, or malformed event JSON is
     * skipped silently so a bad text event cannot break the entire export.
     *
     * @param sb             the XML string builder to append to
     * @param textEventsJson JSON array of text event objects, or null
     */
    private void appendTextEvents(StringBuilder sb, String textEventsJson) {
        if (textEventsJson == null || textEventsJson.isBlank()) {
            return;
        }
        try {
            JsonNode events = objectMapper.readTree(textEventsJson);
            for (JsonNode event : events) {
                int timeOffset = event.path("timeOffsetSeconds").asInt();
                String message = event.path("message").asText("");
                sb.append("    <textevent timeoffset=\"").append(timeOffset)
                        .append("\" message=\"").append(escapeXml(message)).append("\"/>\n");
            }
        } catch (Exception e) {
            log.warn("Failed to parse text events during .zwo export: {}", e.getMessage());
        }
    }

    /**
     * Replaces characters that are unsafe in file system names with underscores.
     * Preserves alphanumeric characters, spaces, hyphens, and underscores.
     *
     * @param name the raw workout name
     * @return the sanitised name, safe for use as a filename
     */
    public String sanitiseFilename(String name) {
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
