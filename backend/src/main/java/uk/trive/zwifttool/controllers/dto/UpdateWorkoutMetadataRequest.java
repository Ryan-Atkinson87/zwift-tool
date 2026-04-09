package uk.trive.zwifttool.controllers.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Request body for updating the metadata fields of an existing workout via
 * {@code PUT /workouts/{id}/metadata}. Used by the editor when the user
 * edits the workout name, author, or description inline.
 *
 * <p>Metadata edits live directly on the workout row and intentionally do
 * not participate in the per-section undo state machine; only interval
 * edits rotate the {@code prev_*_block_id} columns.</p>
 */
@Data
public class UpdateWorkoutMetadataRequest {

    /** New workout name. Required, must not be blank, capped at 200 chars. */
    @NotBlank(message = "Workout name is required.")
    @Size(max = 200, message = "Workout name must be 200 characters or fewer.")
    private String name;

    /** New author. Optional, capped at 200 chars. */
    @Size(max = 200, message = "Author must be 200 characters or fewer.")
    private String author;

    /** New description. Optional, capped at 2000 chars. */
    @Size(max = 2000, message = "Description must be 2000 characters or fewer.")
    private String description;

    /**
     * JSON array of text events shown over the workout timeline. Sent as a
     * raw JSON string so the backend stores it verbatim in the {@code jsonb}
     * column without re-serialising. Null leaves the existing value
     * unchanged; an empty string or {@code "[]"} clears all events.
     */
    private String textEvents;
}
