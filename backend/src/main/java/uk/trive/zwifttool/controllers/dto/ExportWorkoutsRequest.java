package uk.trive.zwifttool.controllers.dto;

import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

/**
 * Request body for the bulk workout export endpoint.
 *
 * <p>Contains a non-empty list of workout IDs to include in the zip archive.
 * All IDs must belong to the authenticated user; any ownership failure causes
 * the entire request to be rejected.</p>
 */
@Data
public class ExportWorkoutsRequest {

    /** The IDs of the workouts to export. Must contain at least one entry. */
    @NotEmpty(message = "At least one workout ID is required.")
    private List<UUID> workoutIds;
}
