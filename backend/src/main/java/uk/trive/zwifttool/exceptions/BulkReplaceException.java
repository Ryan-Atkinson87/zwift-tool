package uk.trive.zwifttool.exceptions;

/**
 * Thrown when a bulk section replacement fails after the database updates
 * have been applied, typically because the zip archive cannot be assembled.
 */
public class BulkReplaceException extends RuntimeException {

    public BulkReplaceException(String message) {
        super(message);
    }
}
