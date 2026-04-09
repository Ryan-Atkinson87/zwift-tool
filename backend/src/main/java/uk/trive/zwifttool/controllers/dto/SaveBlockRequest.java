package uk.trive.zwifttool.controllers.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import uk.trive.zwifttool.models.SectionType;

/**
 * Request body for saving a workout section as a library block.
 *
 * <p>The content field is the JSON-encoded interval array from the section
 * being saved. Duration and interval count are pre-computed by the frontend
 * and stored for use in the library preview without re-parsing the content.</p>
 */
@Data
public class SaveBlockRequest {

    @NotBlank(message = "Block name is required.")
    private String name;

    private String description;

    @NotNull(message = "Section type is required.")
    private SectionType sectionType;

    @NotBlank(message = "Block content is required.")
    private String content;

    @NotNull(message = "Duration is required.")
    private Integer durationSeconds;

    @NotNull(message = "Interval count is required.")
    private Integer intervalCount;
}
