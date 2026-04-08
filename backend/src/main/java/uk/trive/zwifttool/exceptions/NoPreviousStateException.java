package uk.trive.zwifttool.exceptions;

import uk.trive.zwifttool.models.SectionType;

/**
 * Thrown when an undo is requested for a workout section that has no
 * previous state to revert to.
 */
public class NoPreviousStateException extends RuntimeException {

    public NoPreviousStateException(SectionType sectionType) {
        super("No previous state to undo for section: " + sectionType);
    }
}
