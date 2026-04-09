package uk.trive.zwifttool.controllers.dto;

import java.util.UUID;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
import uk.trive.zwifttool.models.SectionType;

/**
 * Request body for replacing a single section of a workout with a saved
 * library block via {@code PUT /workouts/{id}/replace-section}.
 *
 * <p>The block must be a library block owned by the authenticated user,
 * and its section type must match the target section.</p>
 */
@Data
public class ReplaceWithBlockRequest {

    /** The section to replace. */
    @NotNull(message = "Section type is required.")
    private SectionType sectionType;

    /** The ID of the library block to use as the replacement. */
    @NotNull(message = "Block ID is required.")
    private UUID blockId;
}
