package uk.trive.zwifttool.controllers;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import uk.trive.zwifttool.controllers.dto.BlockResponse;
import uk.trive.zwifttool.controllers.dto.SaveWorkoutRequest;
import uk.trive.zwifttool.controllers.dto.UndoSectionRequest;
import uk.trive.zwifttool.controllers.dto.UpdateWorkoutSectionRequest;
import uk.trive.zwifttool.controllers.dto.WorkoutDetailResponse;
import uk.trive.zwifttool.controllers.dto.WorkoutResponse;
import uk.trive.zwifttool.controllers.dto.WorkoutSummaryResponse;
import uk.trive.zwifttool.models.Block;
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
     * Returns a single workout by ID with full block content for each
     * section, so the frontend can load it into the editor canvas.
     *
     * <p>Returns HTTP 404 both when the workout does not exist and when
     * it belongs to a different user, to avoid leaking existence.</p>
     *
     * @param workoutId the ID of the workout to fetch
     * @param userId    the authenticated user's ID, resolved from the JWT
     * @return HTTP 200 with the full workout detail
     */
    @GetMapping("/{workoutId}")
    public ResponseEntity<WorkoutDetailResponse> getWorkout(
            @PathVariable UUID workoutId,
            @AuthenticationPrincipal UUID userId
    ) {
        Workout workout = workoutService.getWorkoutForUser(workoutId, userId);
        return ResponseEntity.ok(toDetailResponse(workout));
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
     * Updates a single section of an existing workout. Used by the editor's
     * auto-save loop. The current block ID for the section is rotated into
     * the matching {@code prev_*} column to support single-step undo.
     *
     * @param workoutId the ID of the workout to update
     * @param request   the section type and new content to apply
     * @param userId    the authenticated user's ID, resolved from the JWT
     * @return HTTP 200 with the updated workout detail
     */
    @PutMapping("/{workoutId}")
    public ResponseEntity<WorkoutDetailResponse> updateWorkoutSection(
            @PathVariable UUID workoutId,
            @Valid @RequestBody UpdateWorkoutSectionRequest request,
            @AuthenticationPrincipal UUID userId
    ) {
        Workout workout = workoutService.updateWorkoutSection(workoutId, userId, request);
        return ResponseEntity.ok(toDetailResponse(workout));
    }

    /**
     * Reverts the most recent change to a single section of a workout by
     * swapping the current and previous block IDs. Pressing undo a second
     * time acts as a redo, since both blocks remain referenced.
     *
     * @param workoutId the ID of the workout to undo
     * @param request   the section to revert
     * @param userId    the authenticated user's ID, resolved from the JWT
     * @return HTTP 200 with the updated workout detail
     */
    @PostMapping("/{workoutId}/undo")
    public ResponseEntity<WorkoutDetailResponse> undoWorkoutSection(
            @PathVariable UUID workoutId,
            @Valid @RequestBody UndoSectionRequest request,
            @AuthenticationPrincipal UUID userId
    ) {
        Workout workout = workoutService.undoWorkoutSection(workoutId, userId, request.getSectionType());
        return ResponseEntity.ok(toDetailResponse(workout));
    }

    /**
     * Maps a Workout entity to the full detail response, including the
     * content of every section block.
     */
    private WorkoutDetailResponse toDetailResponse(Workout workout) {
        return WorkoutDetailResponse.builder()
                .id(workout.getId())
                .name(workout.getName())
                .author(workout.getAuthor())
                .description(workout.getDescription())
                .warmupBlock(toBlockResponse(workout.getWarmupBlock()))
                .mainsetBlock(toBlockResponse(workout.getMainsetBlock()))
                .cooldownBlock(toBlockResponse(workout.getCooldownBlock()))
                .hasPrevWarmup(workout.getPrevWarmupBlock() != null)
                .hasPrevMainset(workout.getPrevMainsetBlock() != null)
                .hasPrevCooldown(workout.getPrevCooldownBlock() != null)
                .isDraft(workout.isDraft())
                .createdAt(workout.getCreatedAt())
                .updatedAt(workout.getUpdatedAt())
                .build();
    }

    /**
     * Maps a Block entity to its API response representation, returning
     * null when the source block is null (warm-up and cool-down are optional).
     */
    private BlockResponse toBlockResponse(Block block) {
        if (block == null) {
            return null;
        }
        return BlockResponse.builder()
                .id(block.getId())
                .name(block.getName())
                .description(block.getDescription())
                .sectionType(block.getSectionType())
                .content(block.getContent())
                .durationSeconds(block.getDurationSeconds())
                .intervalCount(block.getIntervalCount())
                .isLibraryBlock(block.isLibraryBlock())
                .build();
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
