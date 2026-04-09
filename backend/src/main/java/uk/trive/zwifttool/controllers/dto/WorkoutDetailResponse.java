package uk.trive.zwifttool.controllers.dto;

import java.time.Instant;
import java.util.UUID;

import lombok.Builder;
import lombok.Data;

/**
 * Response body representing a saved workout with full section block
 * content embedded.
 *
 * <p>Returned by {@code GET /workouts/{id}}, which is used when the
 * frontend loads a workout into the editor canvas and needs every
 * interval to render the bar chart.</p>
 */
@Data
@Builder
public class WorkoutDetailResponse {

    private UUID id;
    private String name;
    private String author;
    private String description;
    private BlockResponse warmupBlock;
    private BlockResponse mainsetBlock;
    private BlockResponse cooldownBlock;
    /** True when the warm-up section has a previous block to undo to. */
    private boolean hasPrevWarmup;
    /** True when the main set section has a previous block to undo to. */
    private boolean hasPrevMainset;
    /** True when the cool-down section has a previous block to undo to. */
    private boolean hasPrevCooldown;
    private boolean isDraft;
    /**
     * JSON array of text events shown over the workout timeline. Stored as
     * the raw JSON string as persisted in the database; the frontend parses
     * it on load. Null or empty means "no text events".
     */
    private String textEvents;
    private Instant createdAt;
    private Instant updatedAt;
}
