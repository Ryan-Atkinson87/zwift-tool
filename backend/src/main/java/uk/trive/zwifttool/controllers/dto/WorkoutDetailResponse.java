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
    private boolean isDraft;
    private Instant createdAt;
    private Instant updatedAt;
}
