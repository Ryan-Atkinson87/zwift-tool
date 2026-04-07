package uk.trive.zwifttool.services;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import uk.trive.zwifttool.controllers.dto.SaveWorkoutRequest;
import uk.trive.zwifttool.controllers.dto.WorkoutSummaryResponse;
import uk.trive.zwifttool.models.Block;
import uk.trive.zwifttool.models.SectionType;
import uk.trive.zwifttool.models.Workout;
import uk.trive.zwifttool.repositories.BlockRepository;
import uk.trive.zwifttool.repositories.WorkoutRepository;

/**
 * Handles business logic for workout management, including saving
 * imported workouts with their section blocks.
 *
 * <p>All methods assume the caller has already verified authentication.
 * The user ID is passed in from the controller.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WorkoutService {

    private final WorkoutRepository workoutRepository;
    private final BlockRepository blockRepository;

    /**
     * Returns a summary list of all workouts owned by the given user,
     * ordered by most recently updated first.
     *
     * <p>Delegates to a repository projection query so only the fields
     * needed for the list view are loaded.</p>
     *
     * @param userId the authenticated user's ID
     * @return list of workout summaries, empty if the user has none
     */
    public List<WorkoutSummaryResponse> getWorkoutsForUser(UUID userId) {
        log.debug("Fetching workout summaries for user {}", userId);
        return workoutRepository.findSummariesByUserId(userId);
    }

    /**
     * Saves a new workout from the import flow. Creates non-library blocks
     * for each section present (warm-up, main set, cool-down) and links
     * them to a new workout record.
     *
     * <p>The entire operation is transactional: if any part fails, no blocks
     * or workout rows are persisted.</p>
     *
     * @param request the structured workout data from the frontend
     * @param userId  the authenticated user's ID
     * @return the saved workout with all block references populated
     */
    @Transactional
    public Workout saveImportedWorkout(SaveWorkoutRequest request, UUID userId) {
        log.info("Saving imported workout '{}' for user {}", request.getName(), userId);

        Instant now = Instant.now();

        Block warmupBlock = null;
        if (request.getWarmupContent() != null) {
            warmupBlock = createBlock(
                    request.getName() + " - Warm-Up",
                    SectionType.WARMUP,
                    request.getWarmupContent(),
                    request.getWarmupDurationSeconds(),
                    request.getWarmupIntervalCount(),
                    userId,
                    now
            );
        }

        Block mainsetBlock = createBlock(
                request.getName() + " - Main Set",
                SectionType.MAINSET,
                request.getMainsetContent(),
                request.getMainsetDurationSeconds(),
                request.getMainsetIntervalCount(),
                userId,
                now
        );

        Block cooldownBlock = null;
        if (request.getCooldownContent() != null) {
            cooldownBlock = createBlock(
                    request.getName() + " - Cool-Down",
                    SectionType.COOLDOWN,
                    request.getCooldownContent(),
                    request.getCooldownDurationSeconds(),
                    request.getCooldownIntervalCount(),
                    userId,
                    now
            );
        }

        Workout workout = Workout.builder()
                .userId(userId)
                .name(request.getName())
                .author(request.getAuthor())
                .description(request.getDescription())
                .warmupBlock(warmupBlock)
                .mainsetBlock(mainsetBlock)
                .cooldownBlock(cooldownBlock)
                .isDraft(true)
                .createdAt(now)
                .updatedAt(now)
                .build();

        Workout saved = workoutRepository.save(workout);
        log.info("Saved workout {} with {} section(s) for user {}",
                saved.getId(),
                countSections(warmupBlock, cooldownBlock),
                userId);

        return saved;
    }

    /**
     * Creates and persists a non-library block for an imported workout section.
     */
    private Block createBlock(String name, SectionType sectionType, String content,
                              Integer durationSeconds, Integer intervalCount,
                              UUID userId, Instant createdAt) {
        Block block = Block.builder()
                .userId(userId)
                .name(name)
                .sectionType(sectionType)
                .content(content)
                .durationSeconds(durationSeconds)
                .intervalCount(intervalCount)
                .isLibraryBlock(false)
                .createdAt(createdAt)
                .build();

        return blockRepository.save(block);
    }

    /**
     * Counts the number of sections present in a workout (always at least 1 for main set).
     */
    private int countSections(Block warmupBlock, Block cooldownBlock) {
        int count = 1;
        if (warmupBlock != null) count++;
        if (cooldownBlock != null) count++;
        return count;
    }
}
