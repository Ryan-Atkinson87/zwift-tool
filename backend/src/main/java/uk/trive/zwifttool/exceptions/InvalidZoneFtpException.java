package uk.trive.zwifttool.exceptions;

/**
 * Thrown when a zone preset customisation request supplies an %FTP value
 * that falls outside the documented band for the target zone, or supplies
 * an invalid zone number or non-positive duration.
 */
public class InvalidZoneFtpException extends RuntimeException {

    public InvalidZoneFtpException(String message) {
        super(message);
    }
}
