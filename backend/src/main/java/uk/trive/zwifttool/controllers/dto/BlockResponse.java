package uk.trive.zwifttool.controllers.dto;

import java.util.UUID;

import lombok.Builder;
import lombok.Data;
import uk.trive.zwifttool.models.SectionType;

/**
 * Response body representing a single block with its full interval content.
 *
 * <p>Used by the workout detail endpoint so the frontend has enough
 * information to render the block in the editor canvas. The
 * {@code content} field is the raw JSONB payload stored on the block,
 * a JSON array of interval objects.</p>
 */
@Data
@Builder
public class BlockResponse {

    private UUID id;
    private String name;
    private String description;
    private SectionType sectionType;
    private String content;
    private Integer durationSeconds;
    private Integer intervalCount;
    private boolean isLibraryBlock;
}
