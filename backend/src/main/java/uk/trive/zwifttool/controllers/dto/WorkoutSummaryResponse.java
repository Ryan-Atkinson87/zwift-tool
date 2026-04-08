package uk.trive.zwifttool.controllers.dto;

import java.time.Instant;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * Lightweight response body representing a single workout in the
 * saved workouts list view.
 *
 * <p>Duration is the sum of the durations of all section blocks on
 * the workout (warm-up, main set, cool-down). Populated directly by a
 * JPQL constructor projection to avoid loading full Workout and Block
 * entities when rendering the list.</p>
 */
@Data
@AllArgsConstructor
public class WorkoutSummaryResponse {

    private UUID id;
    private String name;
    private String author;
    private String description;
    private Integer durationSeconds;
    private boolean isDraft;
    private Instant updatedAt;
}
