package uk.trive.zwifttool.services;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.w3c.dom.Document;
import org.w3c.dom.NodeList;

import com.fasterxml.jackson.databind.ObjectMapper;

import uk.trive.zwifttool.models.Block;
import uk.trive.zwifttool.models.SectionType;
import uk.trive.zwifttool.models.Workout;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

/**
 * Unit tests for {@link ZwoExporter}, covering the .zwo XML generation logic.
 *
 * <p>Tests parse the generated XML output and assert specific elements and
 * attribute values to verify correctness of the exported workout files.</p>
 *
 * <p>No Spring context is required: {@link ZwoExporter} is a standalone service
 * whose only dependency is a Jackson {@link ObjectMapper}.</p>
 */
class ZwoExporterTest {

    private ZwoExporter zwoExporter;

    @BeforeEach
    void setUp() {
        zwoExporter = new ZwoExporter(new ObjectMapper());
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Parses an XML string into a DOM Document for assertion.
     */
    private Document parseXml(String xml) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(false);
        DocumentBuilder builder = factory.newDocumentBuilder();
        return builder.parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
    }

    /**
     * Returns the text content of the first matching element, or null.
     */
    private String elementText(Document doc, String tagName) {
        NodeList nodes = doc.getElementsByTagName(tagName);
        if (nodes.getLength() == 0) {
            return null;
        }
        return nodes.item(0).getTextContent();
    }

    /**
     * Returns the named attribute of the first matching element, or null.
     */
    private String elementAttribute(Document doc, String tagName, String attributeName) {
        NodeList nodes = doc.getElementsByTagName(tagName);
        if (nodes.getLength() == 0) {
            return null;
        }
        return ((org.w3c.dom.Element) nodes.item(0)).getAttribute(attributeName);
    }

    /**
     * Builds a minimal {@link Block} with the given content JSON.
     */
    private Block buildBlock(SectionType sectionType, String contentJson) {
        return Block.builder()
                .id(UUID.randomUUID())
                .userId(UUID.randomUUID())
                .name(sectionType.name())
                .sectionType(sectionType)
                .content(contentJson)
                .durationSeconds(600)
                .intervalCount(1)
                .isLibraryBlock(false)
                .build();
    }

    /**
     * Builds a {@link Workout} with the given name and main-set block.
     */
    private Workout buildWorkout(String name, Block mainsetBlock) {
        return Workout.builder()
                .id(UUID.randomUUID())
                .userId(UUID.randomUUID())
                .name(name)
                .mainsetBlock(mainsetBlock)
                .isDraft(false)
                .build();
    }

    // -------------------------------------------------------------------------
    // Sweet Spot 1.2 fixture data (from the issue round-trip test)
    // -------------------------------------------------------------------------

    private static final String SWEET_SPOT_MAINSET_JSON = """
            [
              {"type":"SteadyState","durationSeconds":600,"power":0.50449997,"cadence":null},
              {"type":"SteadyState","durationSeconds":120,"power":0.65450001,"cadence":null},
              {"type":"SteadyState","durationSeconds":600,"power":0.90450001,"cadence":null}
            ]
            """;

    private static final String SWEET_SPOT_WARMUP_JSON = """
            [
              {"type":"Warmup","durationSeconds":600,"power":0.50204545,"powerHigh":0.75,"cadence":null}
            ]
            """;

    // -------------------------------------------------------------------------
    // Bug 1: <name> tag instead of <n>
    // -------------------------------------------------------------------------

    @Nested
    @DisplayName("Bug 1 - workout name tag")
    class NameTagTests {

        @Test
        @DisplayName("exports workout name using the <name> element, not <n>")
        void exportUsesNameTag() throws Exception {
            Block mainset = buildBlock(SectionType.MAINSET, SWEET_SPOT_MAINSET_JSON);
            Workout workout = buildWorkout("Sweet Spot 1.2", mainset);

            String xml = zwoExporter.buildZwoXml(workout);
            Document doc = parseXml(xml);

            // The <name> element must be present and contain the workout name
            assertThat(elementText(doc, "name"))
                    .as("exported XML must use <name> not <n>")
                    .isEqualTo("Sweet Spot 1.2");
        }

        @Test
        @DisplayName("does not emit an <n> element in the exported XML")
        void exportDoesNotUseNTag() throws Exception {
            Block mainset = buildBlock(SectionType.MAINSET, SWEET_SPOT_MAINSET_JSON);
            Workout workout = buildWorkout("Sweet Spot 1.2", mainset);

            String xml = zwoExporter.buildZwoXml(workout);
            Document doc = parseXml(xml);

            assertThat(elementText(doc, "n"))
                    .as("exported XML must not contain the legacy <n> element")
                    .isNull();
        }

        @Test
        @DisplayName("writes the workout name exactly as stored, with no slugification")
        void exportNameIsNotSlugified() throws Exception {
            Block mainset = buildBlock(SectionType.MAINSET, SWEET_SPOT_MAINSET_JSON);
            Workout workout = buildWorkout("Sweet Spot 1.2", mainset);

            String xml = zwoExporter.buildZwoXml(workout);
            Document doc = parseXml(xml);

            // Spaces must be preserved, not replaced with underscores
            assertThat(elementText(doc, "name"))
                    .as("workout name must not be slugified on export")
                    .isEqualTo("Sweet Spot 1.2")
                    .doesNotContain("_");
        }
    }

    // -------------------------------------------------------------------------
    // Bug 2: <description> always present, even when empty
    // -------------------------------------------------------------------------

    @Nested
    @DisplayName("Bug 2 - description always present")
    class DescriptionTagTests {

        @Test
        @DisplayName("includes <description> element when the workout has a description")
        void exportIncludesDescriptionWhenPresent() throws Exception {
            Block mainset = buildBlock(SectionType.MAINSET, SWEET_SPOT_MAINSET_JSON);
            Workout workout = Workout.builder()
                    .id(UUID.randomUUID())
                    .userId(UUID.randomUUID())
                    .name("Sweet Spot 1.2")
                    .description("A sweet spot training block")
                    .mainsetBlock(mainset)
                    .isDraft(false)
                    .build();

            String xml = zwoExporter.buildZwoXml(workout);
            Document doc = parseXml(xml);

            assertThat(elementText(doc, "description"))
                    .as("description element must be present when the workout has one")
                    .isEqualTo("A sweet spot training block");
        }

        @Test
        @DisplayName("includes an empty <description> element when description is null")
        void exportIncludesEmptyDescriptionWhenNull() throws Exception {
            Block mainset = buildBlock(SectionType.MAINSET, SWEET_SPOT_MAINSET_JSON);
            Workout workout = buildWorkout("Sweet Spot 1.2", mainset);
            // description is null (not set in buildWorkout)

            String xml = zwoExporter.buildZwoXml(workout);

            // The element must be present even when empty
            assertThat(xml)
                    .as("exported XML must contain <description> even when description is null")
                    .contains("<description>");
        }

        @Test
        @DisplayName("includes an empty <description> element when description is empty string")
        void exportIncludesEmptyDescriptionWhenEmpty() throws Exception {
            Block mainset = buildBlock(SectionType.MAINSET, SWEET_SPOT_MAINSET_JSON);
            Workout workout = Workout.builder()
                    .id(UUID.randomUUID())
                    .userId(UUID.randomUUID())
                    .name("Sweet Spot 1.2")
                    .description("")
                    .mainsetBlock(mainset)
                    .isDraft(false)
                    .build();

            String xml = zwoExporter.buildZwoXml(workout);

            assertThat(xml)
                    .as("exported XML must contain <description> even when description is empty")
                    .contains("<description>");
        }
    }

    // -------------------------------------------------------------------------
    // Bug 3: <tags> round-tripped from import to export
    // -------------------------------------------------------------------------

    @Nested
    @DisplayName("Bug 3 - tags round-trip")
    class TagsRoundTripTests {

        @Test
        @DisplayName("writes a <tags> block when the workout has stored tags")
        void exportWritesTagsWhenPresent() throws Exception {
            Block mainset = buildBlock(SectionType.MAINSET, SWEET_SPOT_MAINSET_JSON);
            Workout workout = Workout.builder()
                    .id(UUID.randomUUID())
                    .userId(UUID.randomUUID())
                    .name("Sweet Spot 1.2")
                    .tags("<tags>\n    <tag name=\"SST\"/>\n</tags>")
                    .mainsetBlock(mainset)
                    .isDraft(false)
                    .build();

            String xml = zwoExporter.buildZwoXml(workout);
            Document doc = parseXml(xml);

            NodeList tagsNodes = doc.getElementsByTagName("tags");
            assertThat(tagsNodes.getLength())
                    .as("exported XML must contain a <tags> element when tags are stored")
                    .isGreaterThan(0);

            NodeList tagNodes = doc.getElementsByTagName("tag");
            assertThat(tagNodes.getLength())
                    .as("exported XML must contain the individual <tag> elements")
                    .isEqualTo(1);

            String tagName = ((org.w3c.dom.Element) tagNodes.item(0)).getAttribute("name");
            assertThat(tagName)
                    .as("exported <tag> name attribute must match the stored value")
                    .isEqualTo("SST");
        }

        @Test
        @DisplayName("omits the <tags> block when the workout has no tags stored")
        void exportOmitsTagsWhenNull() throws Exception {
            Block mainset = buildBlock(SectionType.MAINSET, SWEET_SPOT_MAINSET_JSON);
            Workout workout = buildWorkout("Sweet Spot 1.2", mainset);
            // tags is null (not set)

            String xml = zwoExporter.buildZwoXml(workout);
            Document doc = parseXml(xml);

            NodeList tagsNodes = doc.getElementsByTagName("tags");
            assertThat(tagsNodes.getLength())
                    .as("exported XML must not contain a <tags> element when no tags are stored")
                    .isEqualTo(0);
        }
    }

    // -------------------------------------------------------------------------
    // Bug 4: Power values rounded to 4 decimal places
    // -------------------------------------------------------------------------

    @Nested
    @DisplayName("Bug 4 - power values at 4dp precision")
    class PowerPrecisionTests {

        @Test
        @DisplayName("formats SteadyState power to 4 decimal places")
        void steadyStatePowerIsFourDecimalPlaces() throws Exception {
            String contentJson = """
                    [{"type":"SteadyState","durationSeconds":600,"power":0.50449997,"cadence":null}]
                    """;
            Block mainset = buildBlock(SectionType.MAINSET, contentJson);
            Workout workout = buildWorkout("Test", mainset);

            String xml = zwoExporter.buildZwoXml(workout);
            Document doc = parseXml(xml);

            String power = elementAttribute(doc, "SteadyState", "Power");
            assertThat(power)
                    .as("SteadyState Power must be rounded to 4dp")
                    .isEqualTo("0.5045");
        }

        @Test
        @DisplayName("formats SteadyState power 0.65450001 to 4dp as 0.6545")
        void steadyStatePowerUpperZoneIsFourDecimalPlaces() throws Exception {
            String contentJson = """
                    [{"type":"SteadyState","durationSeconds":120,"power":0.65450001,"cadence":null}]
                    """;
            Block mainset = buildBlock(SectionType.MAINSET, contentJson);
            Workout workout = buildWorkout("Test", mainset);

            String xml = zwoExporter.buildZwoXml(workout);
            Document doc = parseXml(xml);

            String power = elementAttribute(doc, "SteadyState", "Power");
            assertThat(power)
                    .as("SteadyState Power 0.65450001 must round to 0.6545 at 4dp")
                    .isEqualTo("0.6545");
        }

        @Test
        @DisplayName("formats SteadyState power 0.90450001 to 4dp as 0.9045")
        void steadyStatePowerHighZoneIsFourDecimalPlaces() throws Exception {
            String contentJson = """
                    [{"type":"SteadyState","durationSeconds":600,"power":0.90450001,"cadence":null}]
                    """;
            Block mainset = buildBlock(SectionType.MAINSET, contentJson);
            Workout workout = buildWorkout("Test", mainset);

            String xml = zwoExporter.buildZwoXml(workout);
            Document doc = parseXml(xml);

            String power = elementAttribute(doc, "SteadyState", "Power");
            assertThat(power)
                    .as("SteadyState Power 0.90450001 must round to 0.9045 at 4dp")
                    .isEqualTo("0.9045");
        }

        @Test
        @DisplayName("formats Warmup PowerLow 0.50204545 to 4dp as 0.5020")
        void warmupPowerLowIsFourDecimalPlaces() throws Exception {
            Block warmup = buildBlock(SectionType.WARMUP, SWEET_SPOT_WARMUP_JSON);
            Block mainset = buildBlock(SectionType.MAINSET, SWEET_SPOT_MAINSET_JSON);
            Workout workout = Workout.builder()
                    .id(UUID.randomUUID())
                    .userId(UUID.randomUUID())
                    .name("Sweet Spot 1.2")
                    .warmupBlock(warmup)
                    .mainsetBlock(mainset)
                    .isDraft(false)
                    .build();

            String xml = zwoExporter.buildZwoXml(workout);
            Document doc = parseXml(xml);

            String powerLow = elementAttribute(doc, "Warmup", "PowerLow");
            assertThat(powerLow)
                    .as("Warmup PowerLow 0.50204545 must round to 0.5020 at 4dp")
                    .isEqualTo("0.5020");
        }

        @Test
        @DisplayName("formats IntervalsT OnPower and OffPower to 4 decimal places")
        void intervalsTOnOffPowerIsFourDecimalPlaces() throws Exception {
            String contentJson = """
                    [{"type":"IntervalsT","durationSeconds":600,"repeat":4,"onDuration":60,
                      "offDuration":90,"onPower":0.95003001,"offPower":0.50449997,"cadence":null,
                      "power":null,"powerHigh":null}]
                    """;
            Block mainset = buildBlock(SectionType.MAINSET, contentJson);
            Workout workout = buildWorkout("Intervals", mainset);

            String xml = zwoExporter.buildZwoXml(workout);
            Document doc = parseXml(xml);

            String onPower = elementAttribute(doc, "IntervalsT", "OnPower");
            String offPower = elementAttribute(doc, "IntervalsT", "OffPower");

            assertThat(onPower)
                    .as("IntervalsT OnPower must be at 4dp")
                    .isEqualTo("0.9500");
            assertThat(offPower)
                    .as("IntervalsT OffPower must be at 4dp")
                    .isEqualTo("0.5045");
        }
    }

    // -------------------------------------------------------------------------
    // Round-trip structural test
    // -------------------------------------------------------------------------

    @Nested
    @DisplayName("Round-trip structural test")
    class RoundTripTests {

        @Test
        @DisplayName("generates structurally valid XML for a workout with all three sections")
        void fullWorkoutExportIsStructurallyValid() throws Exception {
            Block warmup = buildBlock(SectionType.WARMUP, SWEET_SPOT_WARMUP_JSON);
            Block mainset = buildBlock(SectionType.MAINSET, SWEET_SPOT_MAINSET_JSON);
            Block cooldown = buildBlock(SectionType.COOLDOWN,
                    "[{\"type\":\"Cooldown\",\"durationSeconds\":300," +
                    "\"power\":0.45,\"powerHigh\":0.65,\"cadence\":null}]");
            Workout workout = Workout.builder()
                    .id(UUID.randomUUID())
                    .userId(UUID.randomUUID())
                    .name("Sweet Spot 1.2")
                    .author("Zwift")
                    .description("")
                    .tags("<tags>\n    <tag name=\"SST\"/>\n</tags>")
                    .warmupBlock(warmup)
                    .mainsetBlock(mainset)
                    .cooldownBlock(cooldown)
                    .isDraft(false)
                    .build();

            String xml = zwoExporter.buildZwoXml(workout);
            Document doc = parseXml(xml);

            // Root element
            assertThat(doc.getElementsByTagName("workout_file").getLength())
                    .as("must have a <workout_file> root element")
                    .isEqualTo(1);

            // Correct name tag
            assertThat(elementText(doc, "name"))
                    .as("must use <name> element")
                    .isEqualTo("Sweet Spot 1.2");

            // Description always present
            assertThat(xml).contains("<description>");

            // Author
            assertThat(elementText(doc, "author"))
                    .as("must include the author element")
                    .isEqualTo("Zwift");

            // Tags present
            assertThat(doc.getElementsByTagName("tags").getLength())
                    .as("must include the <tags> block")
                    .isEqualTo(1);

            // Workout intervals
            assertThat(doc.getElementsByTagName("Warmup").getLength()).isEqualTo(1);
            assertThat(doc.getElementsByTagName("SteadyState").getLength()).isEqualTo(3);
            assertThat(doc.getElementsByTagName("Cooldown").getLength()).isEqualTo(1);

            // Power precision: spot check one value
            String warmupPowerLow = elementAttribute(doc, "Warmup", "PowerLow");
            assertThat(warmupPowerLow)
                    .as("Warmup PowerLow must have 4dp precision in the round-trip")
                    .isEqualTo("0.5020");
        }
    }
}
