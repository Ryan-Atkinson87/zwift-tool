package uk.trive.zwifttool.exceptions;

import java.util.UUID;

/**
 * Thrown when a requested workout cannot be found for the authenticated user.
 *
 * <p>This exception is also thrown when a workout exists but belongs to a
 * different user. Collapsing both cases into a single 404 response avoids
 * leaking the existence of other users' workouts.</p>
 */
public class WorkoutNotFoundException extends RuntimeException {

    public WorkoutNotFoundException(UUID workoutId) {
        super("No workout found with ID: " + workoutId);
    }
}
