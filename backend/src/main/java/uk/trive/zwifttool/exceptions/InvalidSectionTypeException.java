package uk.trive.zwifttool.exceptions;

/**
 * Thrown when a block's section type does not match the target section
 * being replaced. For example, attempting to replace a Warm-Up with a
 * Main Set block is invalid and will trigger this exception.
 */
public class InvalidSectionTypeException extends RuntimeException {

    public InvalidSectionTypeException(String message) {
        super(message);
    }
}
