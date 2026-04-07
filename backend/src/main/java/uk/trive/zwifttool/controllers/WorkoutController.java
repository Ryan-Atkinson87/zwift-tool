package uk.trive.zwifttool.controllers;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import uk.trive.zwifttool.controllers.dto.SaveWorkoutRequest;
import uk.trive.zwifttool.controllers.dto.WorkoutResponse;
import uk.trive.zwifttool.controllers.dto.WorkoutSummaryResponse;
import uk.trive.zwifttool.models.Workout;
import uk.trive.zwifttool.services.WorkoutService;

/**
 * Handles workout endpoints: saving, updating, deleting, and bulk operations.
 *
 * <p>All endpoints require a valid access token. The user ID is extracted
 * from the JWT by Spring Security.</p>
 */
@Slf4j
@RestController
@RequestMapping("/workouts")
@RequiredArgsConstructor
public class WorkoutController {

    private final WorkoutService workoutService;

    /**
     * Returns all workouts for the authenticated user as a lightweight
     * summary list, ordered by most recently updated first.
     *
     * <p>An empty list is returned with HTTP 200 when the user has no
     * saved workouts. The frontend handles the empty state uniformly
     * regardless of how many workouts are present.</p>
     *
     * @param userId the authenticated user's ID, resolved from the JWT
     * @return HTTP 200 with the workout summary list (possibly empty)
     */
    @GetMapping
    public ResponseEntity<List<WorkoutSummaryResponse>> getWorkouts(
            @AuthenticationPrincipal UUID userId
    ) {
        List<WorkoutSummaryResponse> workouts = workoutService.getWorkoutsForUser(userId);
        return ResponseEntity.ok(workouts);
    }

    /**
     * Saves a new workout from the import flow. Creates non-library blocks
     * for each section and links them to a new workout record.
     *
     * @param request the structured workout data with section content
     * @param userId  the authenticated user's ID, resolved from the JWT
     * @return HTTP 201 with the saved workout details
     */
    @PostMapping
    public ResponseEntity<WorkoutResponse> saveWorkout(
            @Valid @RequestBody SaveWorkoutRequest request,
            @AuthenticationPrincipal UUID userId
    ) {
        Workout workout = workoutService.saveImportedWorkout(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(workout));
    }

    /**
     * Maps a Workout entity to its API response representation.
     */
    private WorkoutResponse toResponse(Workout workout) {
        return WorkoutResponse.builder()
                .id(workout.getId())
                .name(workout.getName())
                .author(workout.getAuthor())
                .description(workout.getDescription())
                .warmupBlockId(workout.getWarmupBlock() != null ? workout.getWarmupBlock().getId() : null)
                .mainsetBlockId(workout.getMainsetBlock().getId())
                .cooldownBlockId(workout.getCooldownBlock() != null ? workout.getCooldownBlock().getId() : null)
                .isDraft(workout.isDraft())
                .createdAt(workout.getCreatedAt())
                .updatedAt(workout.getUpdatedAt())
                .build();
    }
}
