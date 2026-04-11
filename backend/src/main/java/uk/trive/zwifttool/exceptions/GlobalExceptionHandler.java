package uk.trive.zwifttool.exceptions;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import io.sentry.Sentry;

import lombok.extern.slf4j.Slf4j;

/**
 * Handles application exceptions globally and maps them to appropriate
 * HTTP responses. All error responses follow the same JSON structure:
 * {@code {"message": "..."}}.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * Handles validation errors from {@code @Valid} annotated request bodies.
     * Returns the first field error message to keep the response simple and clear.
     *
     * @param ex the validation exception
     * @return HTTP 400 Bad Request with the first validation error message
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidationErrors(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(error -> error.getDefaultMessage())
                .orElse("Invalid request.");

        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("message", message));
    }

    /**
     * Handles duplicate email during sign-up.
     *
     * @param ex the exception
     * @return HTTP 409 Conflict
     */
    @ExceptionHandler(EmailAlreadyExistsException.class)
    public ResponseEntity<Map<String, String>> handleEmailAlreadyExists(EmailAlreadyExistsException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("message", ex.getMessage()));
    }

    /**
     * Handles failed sign-in attempts.
     *
     * @param ex the exception
     * @return HTTP 401 Unauthorised
     */
    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<Map<String, String>> handleInvalidCredentials(InvalidCredentialsException ex) {
        log.warn("Failed sign-in attempt: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("message", ex.getMessage()));
    }

    /**
     * Handles invalid or expired refresh tokens.
     *
     * @param ex the exception
     * @return HTTP 401 Unauthorised
     */
    @ExceptionHandler(InvalidRefreshTokenException.class)
    public ResponseEntity<Map<String, String>> handleInvalidRefreshToken(InvalidRefreshTokenException ex) {
        log.warn("Invalid refresh token: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("message", ex.getMessage()));
    }

    /**
     * Safety-net handler for optimistic locking failures on the user_sessions table.
     *
     * <p>The primary fix is in {@code AuthService.refreshSession()}, which uses a
     * count-returning DELETE to detect concurrent rotation before JPA can throw.
     * This handler catches any residual cases and returns HTTP 401, matching the
     * behaviour of a token-not-found response. A 500 would cause the frontend to
     * treat the session as broken rather than triggering a re-login prompt.</p>
     *
     * @param ex the exception
     * @return HTTP 401 Unauthorised
     */
    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<Map<String, String>> handleOptimisticLockingFailure(ObjectOptimisticLockingFailureException ex) {
        log.warn("Optimistic locking failure on session table, likely concurrent refresh: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("message", "Session conflict. Please sign in again."));
    }

    /**
     * Handles requests for a workout that does not exist, or that exists
     * but belongs to a different user. Both cases collapse to 404 to avoid
     * leaking the existence of other users' workouts.
     *
     * @param ex the exception
     * @return HTTP 404 Not Found
     */
    @ExceptionHandler(WorkoutNotFoundException.class)
    public ResponseEntity<Map<String, String>> handleWorkoutNotFound(WorkoutNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("message", ex.getMessage()));
    }

    /**
     * Handles zone preset customisation requests with an %FTP value that
     * falls outside the documented band for the zone, or with an invalid
     * zone number or non-positive duration.
     *
     * @param ex the exception
     * @return HTTP 400 Bad Request
     */
    @ExceptionHandler(InvalidZoneFtpException.class)
    public ResponseEntity<Map<String, String>> handleInvalidZoneFtp(InvalidZoneFtpException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("message", ex.getMessage()));
    }

    /**
     * Handles requests for a block that does not exist, or that exists
     * but belongs to a different user. Both cases collapse to 404 to avoid
     * leaking the existence of other users' blocks.
     *
     * @param ex the exception
     * @return HTTP 404 Not Found
     */
    @ExceptionHandler(BlockNotFoundException.class)
    public ResponseEntity<Map<String, String>> handleBlockNotFound(BlockNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("message", ex.getMessage()));
    }

    /**
     * Handles replacement requests where the library block's section type
     * does not match the target section on the workout.
     *
     * @param ex the exception
     * @return HTTP 400 Bad Request
     */
    @ExceptionHandler(InvalidSectionTypeException.class)
    public ResponseEntity<Map<String, String>> handleInvalidSectionType(InvalidSectionTypeException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("message", ex.getMessage()));
    }

    /**
     * Handles undo requests on a section that has no previous state.
     *
     * @param ex the exception
     * @return HTTP 409 Conflict
     */
    @ExceptionHandler(NoPreviousStateException.class)
    public ResponseEntity<Map<String, String>> handleNoPreviousState(NoPreviousStateException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("message", ex.getMessage()));
    }

    /**
     * Handles failures assembling the zip archive after a bulk section
     * replacement has been applied to the database.
     *
     * @param ex the exception
     * @return HTTP 500 Internal Server Error
     */
    @ExceptionHandler(BulkReplaceException.class)
    public ResponseEntity<Map<String, String>> handleBulkReplace(BulkReplaceException ex) {
        log.error("Bulk replace zip assembly failed: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("message", ex.getMessage()));
    }

    /**
     * Catches all unhandled exceptions and logs them at ERROR level with
     * full stack traces before returning a generic error response.
     *
     * @param ex the unhandled exception
     * @return HTTP 500 Internal Server Error
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleUnhandledException(Exception ex) {
        log.error("Unhandled exception", ex);
        Sentry.captureException(ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("message", "An unexpected error occurred."));
    }
}