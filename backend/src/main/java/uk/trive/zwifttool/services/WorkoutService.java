package uk.trive.zwifttool.services;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import uk.trive.zwifttool.controllers.dto.SaveWorkoutRequest;
import uk.trive.zwifttool.controllers.dto.UpdateWorkoutSectionRequest;
import uk.trive.zwifttool.controllers.dto.WorkoutSummaryResponse;
import uk.trive.zwifttool.exceptions.NoPreviousStateException;
import uk.trive.zwifttool.exceptions.WorkoutNotFoundException;
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
     * Retrieves a workout by ID, verifying it belongs to the requesting
     * user before returning it.
     *
     * <p>Both missing workouts and workouts owned by a different user
     * result in {@link WorkoutNotFoundException}. Collapsing both cases
     * to a 404 avoids leaking the existence of other users' workouts.</p>
     *
     * @param workoutId the ID of the workout to retrieve
     * @param userId    the authenticated user's ID
     * @return the matching workout with its section blocks attached
     * @throws WorkoutNotFoundException if no workout exists with the given
     *                                  ID for this user
     */
    public Workout getWorkoutForUser(UUID workoutId, UUID userId) {
        log.debug("Fetching workout {} for user {}", workoutId, userId);

        Workout workout = workoutRepository.findById(workoutId)
                .orElseThrow(() -> new WorkoutNotFoundException(workoutId));

        if (!workout.getUserId().equals(userId)) {
            throw new WorkoutNotFoundException(workoutId);
        }

        return workout;
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
     * Replaces a single section of an existing workout. The current block ID
     * for the target section is rotated into the matching {@code prev_*}
     * column to support single-step undo, and a brand new block is created
     * to hold the supplied content.
     *
     * <p>If a previous block was already in the {@code prev_*} slot, that
     * block is now displaced and is deleted as an orphan provided it is not
     * a library block. Library blocks are never deleted by this flow.</p>
     *
     * <p>If the new content is byte-identical to the current block's content,
     * the call short-circuits as a no-op so repeated identical auto-saves
     * do not waste storage or trash the undo state.</p>
     *
     * @param workoutId the ID of the workout to update
     * @param userId    the authenticated user's ID
     * @param request   the section type and new content to apply
     * @return the updated workout
     * @throws WorkoutNotFoundException if no workout exists for this user
     */
    @Transactional
    public Workout updateWorkoutSection(UUID workoutId, UUID userId, UpdateWorkoutSectionRequest request) {
        log.info("Updating section {} on workout {} for user {} ({} intervals)",
                request.getSectionType(), workoutId, userId, request.getIntervalCount());

        Workout workout = getWorkoutForUser(workoutId, userId);
        Block currentBlock = currentBlockFor(workout, request.getSectionType());

        // No-op short-circuit: identical content does not warrant a new block
        // or a rotation of the undo state. The frontend may auto-save the
        // same payload twice if the user pauses on an unchanged value.
        if (currentBlock != null && request.getContent().equals(currentBlock.getContent())) {
            log.debug("Skipping update on workout {} section {}: content unchanged",
                    workoutId, request.getSectionType());
            return workout;
        }

        Block displacedPrev = prevBlockFor(workout, request.getSectionType());

        Block newBlock = createBlock(
                sectionBlockName(workout, request.getSectionType()),
                request.getSectionType(),
                request.getContent(),
                request.getDurationSeconds(),
                request.getIntervalCount(),
                userId,
                Instant.now()
        );

        applySectionUpdate(workout, request.getSectionType(), newBlock, currentBlock);

        Workout saved = workoutRepository.save(workout);

        // Drop the displaced previous block as an orphan, but never touch
        // a library block since the user has saved it intentionally and it
        // may be referenced from elsewhere
        if (displacedPrev != null && !displacedPrev.isLibraryBlock()) {
            blockRepository.delete(displacedPrev);
        }

        return saved;
    }

    /**
     * Reverts the most recent change to a single workout section by swapping
     * the current and previous block IDs. Pressing undo a second time
     * therefore acts as a redo, since both blocks are still referenced.
     *
     * <p>Undo never deletes any blocks; orphan cleanup only happens during a
     * real edit via {@link #updateWorkoutSection}.</p>
     *
     * @param workoutId   the ID of the workout to undo
     * @param userId      the authenticated user's ID
     * @param sectionType the section to revert
     * @return the updated workout after the swap
     * @throws WorkoutNotFoundException  if no workout exists for this user
     * @throws NoPreviousStateException  if the section has no previous block
     */
    @Transactional
    public Workout undoWorkoutSection(UUID workoutId, UUID userId, SectionType sectionType) {
        log.info("Undoing section {} on workout {} for user {}", sectionType, workoutId, userId);

        Workout workout = getWorkoutForUser(workoutId, userId);
        Block prev = prevBlockFor(workout, sectionType);

        if (prev == null) {
            throw new NoPreviousStateException(sectionType);
        }

        Block current = currentBlockFor(workout, sectionType);
        applySectionUpdate(workout, sectionType, prev, current);

        return workoutRepository.save(workout);
    }

    /**
     * Returns the current block for a section, or null if the section is
     * absent (warm-up and cool-down are optional).
     */
    private Block currentBlockFor(Workout workout, SectionType sectionType) {
        return switch (sectionType) {
            case WARMUP -> workout.getWarmupBlock();
            case MAINSET -> workout.getMainsetBlock();
            case COOLDOWN -> workout.getCooldownBlock();
        };
    }

    /**
     * Returns the previous block for a section, or null if no previous
     * state has been captured for it.
     */
    private Block prevBlockFor(Workout workout, SectionType sectionType) {
        return switch (sectionType) {
            case WARMUP -> workout.getPrevWarmupBlock();
            case MAINSET -> workout.getPrevMainsetBlock();
            case COOLDOWN -> workout.getPrevCooldownBlock();
        };
    }

    /**
     * Applies a section change to the workout: sets the new current block
     * and rotates the old current into the matching prev slot.
     */
    private void applySectionUpdate(Workout workout, SectionType sectionType,
                                    Block newCurrent, Block newPrev) {
        switch (sectionType) {
            case WARMUP -> {
                workout.setWarmupBlock(newCurrent);
                workout.setPrevWarmupBlock(newPrev);
            }
            case MAINSET -> {
                workout.setMainsetBlock(newCurrent);
                workout.setPrevMainsetBlock(newPrev);
            }
            case COOLDOWN -> {
                workout.setCooldownBlock(newCurrent);
                workout.setPrevCooldownBlock(newPrev);
            }
        }
    }

    /**
     * Builds the canonical name for an auto-generated section block, used
     * to keep block listings readable in the database.
     */
    private String sectionBlockName(Workout workout, SectionType sectionType) {
        String suffix = switch (sectionType) {
            case WARMUP -> " - Warm-Up";
            case MAINSET -> " - Main Set";
            case COOLDOWN -> " - Cool-Down";
        };
        return workout.getName() + suffix;
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
