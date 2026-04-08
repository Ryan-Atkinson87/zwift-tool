package uk.trive.zwifttool.controllers.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.Data;
import uk.trive.zwifttool.models.SectionType;

/**
 * Request body for updating a single section of an existing workout via
 * {@code PUT /workouts/{id}}. Used by the editor's auto-save loop.
 *
 * <p>Each call replaces exactly one section. The current block ID for that
 * section is rotated into the matching {@code prev_*_block_id} column to
 * support single-step undo, and the displaced previous block (if any) is
 * deleted as an orphan.</p>
 */
@Data
public class UpdateWorkoutSectionRequest {

    /** The section being replaced. */
    @NotNull(message = "Section type is required.")
    private SectionType sectionType;

    /** New interval content as a JSON string. Must not be null. */
    @NotNull(message = "Section content is required.")
    private String content;

    /** Total duration of the new section in seconds. */
    @NotNull(message = "Duration is required.")
    @PositiveOrZero(message = "Duration must be zero or positive.")
    private Integer durationSeconds;

    /** Number of intervals in the new section. */
    @NotNull(message = "Interval count is required.")
    @PositiveOrZero(message = "Interval count must be zero or positive.")
    private Integer intervalCount;
}
