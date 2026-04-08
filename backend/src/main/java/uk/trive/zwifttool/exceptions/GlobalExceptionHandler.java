package uk.trive.zwifttool.exceptions;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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