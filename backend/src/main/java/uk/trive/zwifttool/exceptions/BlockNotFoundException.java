package uk.trive.zwifttool.exceptions;

import java.util.UUID;

/**
 * Thrown when a requested block cannot be found for the authenticated user.
 *
 * <p>This exception is also thrown when a block exists but belongs to a
 * different user. Collapsing both cases into a single 404 response avoids
 * leaking the existence of other users' blocks.</p>
 */
public class BlockNotFoundException extends RuntimeException {

    public BlockNotFoundException(UUID blockId) {
        super("No block found with ID: " + blockId);
    }
}
