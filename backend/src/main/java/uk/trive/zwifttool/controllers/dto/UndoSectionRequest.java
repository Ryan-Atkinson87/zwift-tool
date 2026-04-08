package uk.trive.zwifttool.controllers.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
import uk.trive.zwifttool.models.SectionType;

/**
 * Request body for {@code POST /workouts/{id}/undo}. Identifies which
 * section the user wants to revert to its previous state.
 */
@Data
public class UndoSectionRequest {

    @NotNull(message = "Section type is required.")
    private SectionType sectionType;
}
