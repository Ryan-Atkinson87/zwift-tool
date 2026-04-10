package uk.trive.zwifttool.controllers.dto;

import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import uk.trive.zwifttool.models.SectionType;

/**
 * Request body for bulk-replacing a section across multiple workouts via
 * {@code POST /workouts/bulk-replace}.
 *
 * <p>All workouts must belong to the authenticated user. The replacement
 * block must also be owned by the user and its section type must match
 * the target section.</p>
 */
@Data
public class BulkReplaceRequest {

    /** IDs of the workouts to update. At least one is required. */
    @NotEmpty(message = "At least one workout ID is required.")
    private List<@NotNull UUID> workoutIds;

    /** The section to replace across all workouts. */
    @NotNull(message = "Section type is required.")
    private SectionType sectionType;

    /** The ID of the library block to use as the replacement. */
    @NotNull(message = "Block ID is required.")
    private UUID blockId;
}
