package uk.trive.zwifttool.exceptions;

/**
 * Thrown when a sign-up attempt uses an email address that is already registered.
 */
public class EmailAlreadyExistsException extends RuntimeException {

    public EmailAlreadyExistsException(String email) {
        super("An account with email " + email + " already exists.");
    }
}