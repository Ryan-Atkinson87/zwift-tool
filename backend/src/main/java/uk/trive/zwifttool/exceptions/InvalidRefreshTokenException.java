package uk.trive.zwifttool.exceptions;

/**
 * Thrown when a token refresh attempt uses an invalid, expired, or already-rotated
 * refresh token that falls outside the grace window.
 */
public class InvalidRefreshTokenException extends RuntimeException {

    public InvalidRefreshTokenException() {
        super("Invalid or expired refresh token.");
    }
}