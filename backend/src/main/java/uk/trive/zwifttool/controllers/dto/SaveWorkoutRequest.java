package uk.trive.zwifttool.controllers.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * Request body for saving a new workout from the import flow.
 * Contains workout metadata and the interval content for each section.
 * Warm-up and cool-down are optional; main set is mandatory.
 */
@Data
public class SaveWorkoutRequest {

    @NotBlank(message = "Workout name is required.")
    private String name;

    private String author;

    private String description;

    /**
     * Raw XML fragment for the {@code <tags>} block from the original .zwo file,
     * preserved verbatim so it can be round-tripped on export. Null if the
     * source file contained no {@code <tags>} element.
     */
    private String tags;

    /** Warm-up interval content as a JSON string. Null if no warm-up. */
    private String warmupContent;

    /** Main set interval content as a JSON string. Must not be null. */
    @NotNull(message = "Main set content is required.")
    private String mainsetContent;

    /** Cool-down interval content as a JSON string. Null if no cool-down. */
    private String cooldownContent;

    /** Total duration of the warm-up section in seconds. */
    private Integer warmupDurationSeconds;

    /** Total duration of the main set section in seconds. */
    private Integer mainsetDurationSeconds;

    /** Total duration of the cool-down section in seconds. */
    private Integer cooldownDurationSeconds;

    /** Number of intervals in the warm-up section. */
    private Integer warmupIntervalCount;

    /** Number of intervals in the main set section. */
    private Integer mainsetIntervalCount;

    /** Number of intervals in the cool-down section. */
    private Integer cooldownIntervalCount;
}
