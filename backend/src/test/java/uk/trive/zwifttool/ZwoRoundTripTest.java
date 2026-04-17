package uk.trive.zwifttool;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import com.fasterxml.jackson.databind.ObjectMapper;

import uk.trive.zwifttool.models.Block;
import uk.trive.zwifttool.models.SectionType;
import uk.trive.zwifttool.models.Workout;
import uk.trive.zwifttool.services.ZwoExporter;

/**
 * Round-trip test that verifies a known-good .zwo file survives an import/export
 * cycle intact.
 *
 * <p>The test loads the fixture at {@code fixtures/sweet_spot_round_trip.zwo},
 * constructs the domain objects that would result from parsing it (the frontend
 * handles XML parsing, so domain objects are built directly here), passes them
 * through {@link ZwoExporter}, and asserts the output field by field.</p>
 *
 * <p>No Spring context is required: {@link ZwoExporter} depends only on a
 * Jackson {@link ObjectMapper} and can be instantiated directly.</p>
 */
class ZwoRoundTripTest {

    private ZwoExporter zwoExporter;

    // -------------------------------------------------------------------------
    // Fixture data: mirrors the interval content from sweet_spot_round_trip.zwo
    // after the frontend's import parser splits the file into sections.
    //
    // The fixture has no Warmup element, so there is no warm-up block.
    // All SteadyState and IntervalsT elements form the main set.
    // The Cooldown element at the end forms the cool-down block.
    //
    // Duration values with sub-integer noise (60.000004, 180.00002) are truncated
    // to integer seconds by the frontend parser — this truncation is acceptable
    // and within scope for this test.
    // -------------------------------------------------------------------------

    private static final String MAINSET_CONTENT = """
            [
              {"type":"SteadyState","durationSeconds":60,"power":0.50449997,"cadence":null},
              {"type":"SteadyState","durationSeconds":90,"power":0.65450001,"cadence":null},
              {"type":"SteadyState","durationSeconds":30,"power":0.50449997,"cadence":null},
              {"type":"SteadyState","durationSeconds":90,"power":0.81449997,"cadence":null},
              {"type":"SteadyState","durationSeconds":30,"power":0.50449997,"cadence":null},
              {"type":"SteadyState","durationSeconds":90,"power":0.95449996,"cadence":null},
              {"type":"SteadyState","durationSeconds":30,"power":0.50449997,"cadence":null},
              {"type":"SteadyState","durationSeconds":60,"power":1.0944999,"cadence":null},
              {"type":"SteadyState","durationSeconds":180,"power":0.50449997,"cadence":null},
              {"type":"IntervalsT","repeat":3,"onDuration":720,"offDuration":240,"onPower":0.90450001,"offPower":0.50204545,"cadence":null,"power":null,"powerHigh":null,"durationSeconds":2880}
            ]
            """;

    private static final String COOLDOWN_CONTENT = """
            [
              {"type":"Cooldown","durationSeconds":60,"power":0.50449997,"powerHigh":0.2545,"cadence":null}
            ]
            """;

    // The <tags> block stored verbatim from the fixture file.
    private static final String TAGS_XML = "<tags>\n        <tag name=\"SST\"/>\n    </tags>";

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
     * Returns the text content of the first matching element, or null if absent.
     */
    private String elementText(Document doc, String tagName) {
        NodeList nodes = doc.getElementsByTagName(tagName);
        if (nodes.getLength() == 0) {
            return null;
        }
        return nodes.item(0).getTextContent();
    }

    /**
     * Returns the named attribute of the element at the given index, or null if absent.
     */
    private String elementAttribute(Document doc, String tagName, int index, String attributeName) {
        NodeList nodes = doc.getElementsByTagName(tagName);
        if (nodes.getLength() <= index) {
            return null;
        }
        return ((Element) nodes.item(index)).getAttribute(attributeName);
    }

    /**
     * Builds the {@link Workout} domain object representing the parsed fixture.
     * The fixture has no warm-up, a main set of nine SteadyState intervals
     * plus one IntervalsT, and a Cooldown section.
     */
    private Workout buildFixtureWorkout() {
        Block mainset = Block.builder()
                .id(UUID.randomUUID())
                .userId(UUID.randomUUID())
                .name("Main Set")
                .sectionType(SectionType.MAINSET)
                .content(MAINSET_CONTENT)
                .durationSeconds(3510)
                .intervalCount(10)
                .isLibraryBlock(false)
                .build();

        Block cooldown = Block.builder()
                .id(UUID.randomUUID())
                .userId(UUID.randomUUID())
                .name("Cool Down")
                .sectionType(SectionType.COOLDOWN)
                .content(COOLDOWN_CONTENT)
                .durationSeconds(60)
                .intervalCount(1)
                .isLibraryBlock(false)
                .build();

        return Workout.builder()
                .id(UUID.randomUUID())
                .userId(UUID.randomUUID())
                .name("Sweet Spot 1.2")
                .author("R.Atkinson (Rossy Tri)")
                .description("")
                .tags(TAGS_XML)
                .mainsetBlock(mainset)
                .cooldownBlock(cooldown)
                .isDraft(false)
                .build();
    }

    // -------------------------------------------------------------------------
    // Round-trip test: fixture file exists and is readable
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("fixture file exists on the classpath")
    void fixtureFileExistsOnClasspath() throws Exception {
        try (InputStream stream = getClass().getClassLoader()
                .getResourceAsStream("fixtures/sweet_spot_round_trip.zwo")) {
            assertThat(stream)
                    .as("fixture file must be present at fixtures/sweet_spot_round_trip.zwo")
                    .isNotNull();
            String contents = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
            assertThat(contents)
                    .as("fixture file must contain the workout name")
                    .contains("Sweet Spot 1.2");
        }
    }

    // -------------------------------------------------------------------------
    // Round-trip test: metadata assertions
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("round-trip: exports workout name using <name> tag, not <n>")
    void roundTripUsesNameTag() throws Exception {
        String xml = zwoExporter.buildZwoXml(buildFixtureWorkout());
        Document doc = parseXml(xml);

        assertThat(elementText(doc, "name"))
                .as("exported XML must use <name>, not <n>")
                .isEqualTo("Sweet Spot 1.2");

        assertThat(elementText(doc, "n"))
                .as("exported XML must not contain the legacy <n> element")
                .isNull();
    }

    @Test
    @DisplayName("round-trip: workout name is not slugified")
    void roundTripNameIsNotSlugified() throws Exception {
        String xml = zwoExporter.buildZwoXml(buildFixtureWorkout());
        Document doc = parseXml(xml);

        assertThat(elementText(doc, "name"))
                .as("workout name must preserve spaces and dots, not be slugified")
                .isEqualTo("Sweet Spot 1.2")
                .doesNotContain("_");
    }

    @Test
    @DisplayName("round-trip: author is preserved exactly")
    void roundTripAuthorIsPreserved() throws Exception {
        String xml = zwoExporter.buildZwoXml(buildFixtureWorkout());
        Document doc = parseXml(xml);

        assertThat(elementText(doc, "author"))
                .as("author must be preserved exactly including parentheses")
                .isEqualTo("R.Atkinson (Rossy Tri)");
    }

    @Test
    @DisplayName("round-trip: <description> element is present even when empty")
    void roundTripDescriptionIsPresentWhenEmpty() throws Exception {
        String xml = zwoExporter.buildZwoXml(buildFixtureWorkout());

        assertThat(xml)
                .as("exported XML must contain a <description> element")
                .contains("<description>");
    }

    @Test
    @DisplayName("round-trip: <sportType> is bike")
    void roundTripSportTypeIsBike() throws Exception {
        String xml = zwoExporter.buildZwoXml(buildFixtureWorkout());
        Document doc = parseXml(xml);

        assertThat(elementText(doc, "sportType"))
                .as("<sportType> must be bike")
                .isEqualTo("bike");
    }

    @Test
    @DisplayName("round-trip: <tags> block is present with one <tag name=\"SST\"/> entry")
    void roundTripTagsBlockIsPreserved() throws Exception {
        String xml = zwoExporter.buildZwoXml(buildFixtureWorkout());
        Document doc = parseXml(xml);

        assertThat(doc.getElementsByTagName("tags").getLength())
                .as("exported XML must contain a <tags> element")
                .isEqualTo(1);

        NodeList tagNodes = doc.getElementsByTagName("tag");
        assertThat(tagNodes.getLength())
                .as("exported XML must contain exactly one <tag> element")
                .isEqualTo(1);

        String tagName = ((Element) tagNodes.item(0)).getAttribute("name");
        assertThat(tagName)
                .as("<tag> name attribute must be SST")
                .isEqualTo("SST");
    }

    // -------------------------------------------------------------------------
    // Round-trip test: interval structure assertions
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("round-trip: nine SteadyState elements are present in the main set")
    void roundTripNineSteadyStateElements() throws Exception {
        String xml = zwoExporter.buildZwoXml(buildFixtureWorkout());
        Document doc = parseXml(xml);

        assertThat(doc.getElementsByTagName("SteadyState").getLength())
                .as("exported XML must contain exactly 9 SteadyState elements")
                .isEqualTo(9);
    }

    @Test
    @DisplayName("round-trip: IntervalsT has Repeat=3, OnDuration=720, OffDuration=240")
    void roundTripIntervalsTAttributes() throws Exception {
        String xml = zwoExporter.buildZwoXml(buildFixtureWorkout());
        Document doc = parseXml(xml);

        assertThat(doc.getElementsByTagName("IntervalsT").getLength())
                .as("exported XML must contain exactly one IntervalsT element")
                .isEqualTo(1);

        assertThat(elementAttribute(doc, "IntervalsT", 0, "Repeat"))
                .as("IntervalsT Repeat must be 3")
                .isEqualTo("3");

        assertThat(elementAttribute(doc, "IntervalsT", 0, "OnDuration"))
                .as("IntervalsT OnDuration must be 720")
                .isEqualTo("720");

        assertThat(elementAttribute(doc, "IntervalsT", 0, "OffDuration"))
                .as("IntervalsT OffDuration must be 240")
                .isEqualTo("240");
    }

    @Test
    @DisplayName("round-trip: Cooldown has Duration=60, PowerLow=0.5045, PowerHigh=0.2545")
    void roundTripCooldownAttributes() throws Exception {
        String xml = zwoExporter.buildZwoXml(buildFixtureWorkout());
        Document doc = parseXml(xml);

        assertThat(doc.getElementsByTagName("Cooldown").getLength())
                .as("exported XML must contain exactly one Cooldown element")
                .isEqualTo(1);

        assertThat(elementAttribute(doc, "Cooldown", 0, "Duration"))
                .as("Cooldown Duration must be 60")
                .isEqualTo("60");

        assertThat(elementAttribute(doc, "Cooldown", 0, "PowerLow"))
                .as("Cooldown PowerLow must be 0.5045 at 4dp")
                .isEqualTo("0.5045");

        assertThat(elementAttribute(doc, "Cooldown", 0, "PowerHigh"))
                .as("Cooldown PowerHigh must be 0.2545 at 4dp")
                .isEqualTo("0.2545");
    }

    // -------------------------------------------------------------------------
    // Round-trip test: power precision assertions
    // -------------------------------------------------------------------------

    @Test
    @DisplayName("round-trip: first SteadyState Power is 0.5045 at 4dp")
    void roundTripFirstSteadyStatePowerIsAtFourDp() throws Exception {
        String xml = zwoExporter.buildZwoXml(buildFixtureWorkout());
        Document doc = parseXml(xml);

        String power = elementAttribute(doc, "SteadyState", 0, "Power");
        assertThat(power)
                .as("first SteadyState Power must be 0.5045 (4dp), not 0.50")
                .isEqualTo("0.5045");
    }

    @Test
    @DisplayName("round-trip: IntervalsT OnPower is 0.9045 at 4dp")
    void roundTripIntervalsTOnPowerIsAtFourDp() throws Exception {
        String xml = zwoExporter.buildZwoXml(buildFixtureWorkout());
        Document doc = parseXml(xml);

        String onPower = elementAttribute(doc, "IntervalsT", 0, "OnPower");
        assertThat(onPower)
                .as("IntervalsT OnPower must be 0.9045 at 4dp")
                .isEqualTo("0.9045");
    }

    @Test
    @DisplayName("round-trip: IntervalsT OffPower is 0.5020 at 4dp")
    void roundTripIntervalsTOffPowerIsAtFourDp() throws Exception {
        String xml = zwoExporter.buildZwoXml(buildFixtureWorkout());
        Document doc = parseXml(xml);

        String offPower = elementAttribute(doc, "IntervalsT", 0, "OffPower");
        assertThat(offPower)
                .as("IntervalsT OffPower must be 0.5020 at 4dp, not 0.50")
                .isEqualTo("0.5020");
    }

    @Test
    @DisplayName("round-trip: all SteadyState Power values are exactly 4 decimal places")
    void roundTripAllSteadyStatePowerValuesAreAtFourDp() throws Exception {
        String xml = zwoExporter.buildZwoXml(buildFixtureWorkout());
        Document doc = parseXml(xml);

        NodeList nodes = doc.getElementsByTagName("SteadyState");
        for (int i = 0; i < nodes.getLength(); i++) {
            String power = ((Element) nodes.item(i)).getAttribute("Power");
            assertThat(power)
                    .as("SteadyState[%d] Power must have exactly 4 decimal places", i)
                    .matches("\\d+\\.\\d{4}");
        }
    }
}
