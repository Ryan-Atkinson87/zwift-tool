package uk.trive.zwifttool.exceptions;

/**
 * Thrown when a sign-in attempt fails due to incorrect email or password.
 *
 * <p>The message is deliberately generic to avoid revealing whether the
 * email exists in the system.</p>
 */
public class InvalidCredentialsException extends RuntimeException {

    public InvalidCredentialsException() {
        super("Invalid email or password.");
    }
}