package uk.trive.zwifttool.services;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import uk.trive.zwifttool.controllers.dto.SaveWorkoutRequest;
import uk.trive.zwifttool.controllers.dto.UpdateWorkoutMetadataRequest;
import uk.trive.zwifttool.controllers.dto.UpdateWorkoutSectionRequest;
import uk.trive.zwifttool.controllers.dto.WorkoutSummaryResponse;
import uk.trive.zwifttool.exceptions.BlockNotFoundException;
import uk.trive.zwifttool.exceptions.BulkReplaceException;
import uk.trive.zwifttool.exceptions.InvalidSectionTypeException;
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
    private final ZwoExporter zwoExporter;

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
                    sectionBlockName(SectionType.WARMUP),
                    SectionType.WARMUP,
                    request.getWarmupContent(),
                    request.getWarmupDurationSeconds(),
                    request.getWarmupIntervalCount(),
                    userId,
                    now
            );
        }

        Block mainsetBlock = createBlock(
                sectionBlockName(SectionType.MAINSET),
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
                    sectionBlockName(SectionType.COOLDOWN),
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
                sectionBlockName(request.getSectionType()),
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
     * Replaces a single section of an existing workout with a saved library block.
     * The current block for the section is rotated into the matching {@code prev_*}
     * column to support single-step undo, exactly as with a content edit.
     *
     * <p>The library block must belong to the authenticated user and its section
     * type must match the target section. If the section is already using the
     * requested block, the call short-circuits as a no-op.</p>
     *
     * <p>If a previous block was already in the {@code prev_*} slot, that block
     * is dropped as an orphan provided it is not itself a library block.</p>
     *
     * @param workoutId   the ID of the workout to update
     * @param userId      the authenticated user's ID
     * @param sectionType the section to replace
     * @param blockId     the ID of the library block to use as the replacement
     * @return the updated workout
     * @throws WorkoutNotFoundException    if no workout exists for this user
     * @throws BlockNotFoundException      if the block does not exist or belongs to a different user
     * @throws InvalidSectionTypeException if the block's section type does not match the target section
     */
    @Transactional
    public Workout replaceWorkoutSectionWithBlock(UUID workoutId, UUID userId,
                                                  SectionType sectionType, UUID blockId) {
        log.info("Replacing section {} on workout {} with block {} for user {}",
                sectionType, workoutId, blockId, userId);

        Workout workout = getWorkoutForUser(workoutId, userId);

        Block libraryBlock = blockRepository.findById(blockId)
                .orElseThrow(() -> new BlockNotFoundException(blockId));

        // Ownership check: a block belonging to a different user must not be linked
        if (!libraryBlock.getUserId().equals(userId)) {
            throw new BlockNotFoundException(blockId);
        }

        // Section type check: the block must match the section being replaced
        if (libraryBlock.getSectionType() != sectionType) {
            throw new InvalidSectionTypeException(
                    "Block section type " + libraryBlock.getSectionType()
                    + " does not match target section " + sectionType + ".");
        }

        Block currentBlock = currentBlockFor(workout, sectionType);

        // No-op short-circuit: if this block is already the active one, do nothing
        if (currentBlock != null && currentBlock.getId().equals(blockId)) {
            log.debug("Skipping replace on workout {} section {}: block already active", workoutId, sectionType);
            return workout;
        }

        Block displacedPrev = prevBlockFor(workout, sectionType);

        applySectionUpdate(workout, sectionType, libraryBlock, currentBlock);

        Workout saved = workoutRepository.save(workout);

        // Drop the displaced previous block as an orphan, but never touch a
        // library block since the user saved it intentionally
        if (displacedPrev != null && !displacedPrev.isLibraryBlock()) {
            blockRepository.delete(displacedPrev);
        }

        return saved;
    }

    /**
     * Updates the metadata fields (name, author, description) of an existing
     * workout. Used by the editor when the user edits these fields inline.
     *
     * <p>If every supplied field already matches the workout's current value,
     * the call short-circuits as a no-op so a blur with no real change does
     * not bump {@code updated_at}. Metadata edits do not interact with the
     * per-section undo state and never touch any block rows.</p>
     *
     * @param workoutId the ID of the workout to update
     * @param userId    the authenticated user's ID
     * @param request   the new metadata values
     * @return the updated workout
     * @throws WorkoutNotFoundException if no workout exists for this user
     */
    @Transactional
    public Workout updateWorkoutMetadata(UUID workoutId, UUID userId, UpdateWorkoutMetadataRequest request) {
        log.info("Updating metadata on workout {} for user {}", workoutId, userId);

        Workout workout = getWorkoutForUser(workoutId, userId);

        // A null textEvents in the request means "leave as-is", so compare
        // the effective next value against the current one to decide whether
        // this is a genuine no-op.
        String nextTextEvents = request.getTextEvents() != null
                ? request.getTextEvents()
                : workout.getTextEvents();

        // No-op short-circuit: a blur with unchanged values should not
        // bump updated_at or churn the database
        if (Objects.equals(workout.getName(), request.getName())
                && Objects.equals(workout.getAuthor(), request.getAuthor())
                && Objects.equals(workout.getDescription(), request.getDescription())
                && Objects.equals(workout.getTextEvents(), nextTextEvents)) {
            log.debug("Skipping metadata update on workout {}: values unchanged", workoutId);
            return workout;
        }

        workout.setName(request.getName());
        workout.setAuthor(request.getAuthor());
        workout.setDescription(request.getDescription());
        workout.setTextEvents(nextTextEvents);

        return workoutRepository.save(workout);
    }

    /**
     * Reverts the most recent change to a single workout section.
     *
     * <p>For the main set, a previous block must exist. Pressing undo a second
     * time acts as a redo, since both blocks remain referenced.</p>
     *
     * <p>For the optional warm-up and cool-down sections, undo with no previous
     * block removes the section entirely: the current block moves to the prev
     * slot so it can be restored by pressing undo again. This lets the user
     * undo the very first addition to an optional section without needing to
     * manually delete every interval.</p>
     *
     * <p>Undo never deletes any blocks; orphan cleanup only happens during a
     * real edit via {@link #updateWorkoutSection}.</p>
     *
     * @param workoutId   the ID of the workout to undo
     * @param userId      the authenticated user's ID
     * @param sectionType the section to revert
     * @return the updated workout after the swap
     * @throws WorkoutNotFoundException if no workout exists for this user
     * @throws NoPreviousStateException if the main set has no previous block
     */
    @Transactional
    public Workout undoWorkoutSection(UUID workoutId, UUID userId, SectionType sectionType) {
        log.info("Undoing section {} on workout {} for user {}", sectionType, workoutId, userId);

        Workout workout = getWorkoutForUser(workoutId, userId);
        Block prev = prevBlockFor(workout, sectionType);

        if (prev == null && sectionType == SectionType.MAINSET) {
            throw new NoPreviousStateException(sectionType);
        }

        Block current = currentBlockFor(workout, sectionType);

        if (prev == null) {
            // No previous block for an optional section: remove it and park
            // the current block in the prev slot so it can be restored.
            applySectionUpdate(workout, sectionType, null, current);
        } else {
            applySectionUpdate(workout, sectionType, prev, current);
        }

        return workoutRepository.save(workout);
    }

    /**
     * Replaces the same section across multiple workouts using a saved library
     * block, then returns a zip archive of the updated .zwo files.
     *
     * <p>All ownership checks are performed before any mutations are applied.
     * If any workout ID does not belong to the authenticated user, the entire
     * operation is rejected and no changes are written.</p>
     *
     * <p>For each workout, the current block for the target section is rotated
     * into the matching {@code prev_*} column (supporting single-step undo),
     * and the displaced previous block is deleted as an orphan unless it is a
     * library block.</p>
     *
     * @param workoutIds  IDs of the workouts to update
     * @param sectionType the section to replace on every workout
     * @param blockId     the ID of the library block to use as the replacement
     * @param userId      the authenticated user's ID
     * @return a zip archive containing the updated .zwo file for each workout
     * @throws WorkoutNotFoundException    if any workout ID does not exist for this user
     * @throws BlockNotFoundException      if the block does not exist or belongs to a different user
     * @throws InvalidSectionTypeException if the block's section type does not match the target section
     * @throws BulkReplaceException        if the zip cannot be assembled after the database updates
     */
    @Transactional
    public byte[] bulkReplaceSection(List<UUID> workoutIds, SectionType sectionType,
                                     UUID blockId, UUID userId) {
        log.info("Bulk-replacing section {} across {} workouts with block {} for user {}",
                sectionType, workoutIds.size(), blockId, userId);

        Block libraryBlock = blockRepository.findById(blockId)
                .orElseThrow(() -> new BlockNotFoundException(blockId));

        if (!libraryBlock.getUserId().equals(userId)) {
            throw new BlockNotFoundException(blockId);
        }

        if (libraryBlock.getSectionType() != sectionType) {
            throw new InvalidSectionTypeException(
                    "Block section type " + libraryBlock.getSectionType()
                    + " does not match target section " + sectionType + ".");
        }

        // Fetch and validate all workouts before making any changes.
        // A single unauthorised ID rejects the entire request.
        List<Workout> workouts = new ArrayList<>(workoutIds.size());
        for (UUID workoutId : workoutIds) {
            workouts.add(getWorkoutForUser(workoutId, userId));
        }

        // Apply the same undo rotation used by replaceWorkoutSectionWithBlock,
        // one workout at a time inside the shared transaction.
        List<Block> orphansToDelete = new ArrayList<>();
        for (Workout workout : workouts) {
            Block currentBlock = currentBlockFor(workout, sectionType);

            // Skip if this section already uses the requested block
            if (currentBlock != null && currentBlock.getId().equals(blockId)) {
                log.debug("Skipping workout {} section {}: block already active", workout.getId(), sectionType);
                continue;
            }

            Block displacedPrev = prevBlockFor(workout, sectionType);
            applySectionUpdate(workout, sectionType, libraryBlock, currentBlock);
            workoutRepository.save(workout);

            if (displacedPrev != null && !displacedPrev.isLibraryBlock()) {
                orphansToDelete.add(displacedPrev);
            }
        }

        // Delete orphaned previous blocks only after all workouts are saved
        // so a mid-loop failure does not leave blocks deleted but workouts un-updated
        for (Block orphan : orphansToDelete) {
            blockRepository.delete(orphan);
        }

        // Re-fetch updated workouts so the block relations reflect the committed state
        List<Workout> updatedWorkouts = workoutRepository.findAllById(workoutIds);

        try {
            return zwoExporter.buildZip(updatedWorkouts);
        } catch (IOException e) {
            log.error("Failed to build zip for bulk replace by user {}: {}", userId, e.getMessage(), e);
            throw new BulkReplaceException("Failed to build zip archive after updating workouts.");
        }
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
     * Returns the display name for an auto-generated section block.
     *
     * <p>Non-library blocks use the section type as their label, keeping the
     * name stable regardless of workout renames. Library blocks have
     * user-defined names set through a separate flow.</p>
     */
    private String sectionBlockName(SectionType sectionType) {
        return switch (sectionType) {
            case WARMUP -> "Warm-Up";
            case MAINSET -> "Main Set";
            case COOLDOWN -> "Cool-Down";
        };
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
