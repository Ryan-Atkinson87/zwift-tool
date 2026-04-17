package uk.trive.zwifttool.services;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import org.mockito.Mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;

import uk.trive.zwifttool.exceptions.WorkoutNotFoundException;
import uk.trive.zwifttool.models.Block;
import uk.trive.zwifttool.models.SectionType;
import uk.trive.zwifttool.models.Workout;
import uk.trive.zwifttool.repositories.BlockRepository;
import uk.trive.zwifttool.repositories.WorkoutRepository;

/**
 * Unit tests for {@link WorkoutService#deleteWorkout(UUID, UUID)}.
 *
 * <p>All repository interactions are mocked with Mockito. No Spring context
 * is loaded. Tests cover all optional-section combinations as well as
 * the library-block exclusion rule and ownership enforcement.</p>
 *
 * <p>{@link ZwoExporter} is not used by {@code deleteWorkout} and is passed
 * as null to the service constructor to avoid mocking a class with
 * complex JVM dependencies.</p>
 */
@ExtendWith(MockitoExtension.class)
class WorkoutServiceDeleteTest {

    @Mock
    private WorkoutRepository workoutRepository;

    @Mock
    private BlockRepository blockRepository;

    private WorkoutService workoutService;

    private UUID userId;
    private UUID workoutId;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        workoutId = UUID.randomUUID();
        // ZwoExporter is not invoked by deleteWorkout; pass null to avoid mocking
        // a class that has JVM-level constraints with inline mocking on Java 21+
        workoutService = new WorkoutService(workoutRepository, blockRepository, null);
    }

    // -----------------------------------------------------------------------
    // Helper builders
    // -----------------------------------------------------------------------

    private Block nonLibraryBlock(SectionType sectionType) {
        return Block.builder()
                .id(UUID.randomUUID())
                .userId(userId)
                .name(sectionType.name())
                .sectionType(sectionType)
                .content("[]")
                .durationSeconds(600)
                .intervalCount(1)
                .isLibraryBlock(false)
                .createdAt(Instant.now())
                .build();
    }

    private Block libraryBlock(SectionType sectionType) {
        return Block.builder()
                .id(UUID.randomUUID())
                .userId(userId)
                .name("Saved " + sectionType.name())
                .sectionType(sectionType)
                .content("[]")
                .durationSeconds(600)
                .intervalCount(1)
                .isLibraryBlock(true)
                .createdAt(Instant.now())
                .build();
    }

    private Workout workoutWith(Block warmup, Block mainset, Block cooldown) {
        return Workout.builder()
                .id(workoutId)
                .userId(userId)
                .name("Test Workout")
                .warmupBlock(warmup)
                .mainsetBlock(mainset)
                .cooldownBlock(cooldown)
                .isDraft(false)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }

    // -----------------------------------------------------------------------
    // Acceptance criteria tests
    // -----------------------------------------------------------------------

    /**
     * Deleting a workout that has no warm-up block must not throw.
     * The main set and cool-down non-library blocks are deleted.
     */
    @Test
    void deleteWorkout_withNoWarmupBlock_deletesSuccessfully() {
        Block mainset = nonLibraryBlock(SectionType.MAINSET);
        Block cooldown = nonLibraryBlock(SectionType.COOLDOWN);
        Workout workout = workoutWith(null, mainset, cooldown);

        when(workoutRepository.findById(workoutId)).thenReturn(Optional.of(workout));

        assertThatCode(() -> workoutService.deleteWorkout(workoutId, userId))
                .doesNotThrowAnyException();

        verify(workoutRepository).delete(workout);
        verify(blockRepository).deleteAll(argThat(blocks -> {
            List<Block> blockList = (List<Block>) blocks;
            return blockList.size() == 2
                    && blockList.contains(mainset)
                    && blockList.contains(cooldown);
        }));
    }

    /**
     * Deleting a workout that has no cool-down block must not throw.
     * The warm-up and main set non-library blocks are deleted.
     */
    @Test
    void deleteWorkout_withNoCooldownBlock_deletesSuccessfully() {
        Block warmup = nonLibraryBlock(SectionType.WARMUP);
        Block mainset = nonLibraryBlock(SectionType.MAINSET);
        Workout workout = workoutWith(warmup, mainset, null);

        when(workoutRepository.findById(workoutId)).thenReturn(Optional.of(workout));

        assertThatCode(() -> workoutService.deleteWorkout(workoutId, userId))
                .doesNotThrowAnyException();

        verify(workoutRepository).delete(workout);
        verify(blockRepository).deleteAll(argThat(blocks -> {
            List<Block> blockList = (List<Block>) blocks;
            return blockList.size() == 2
                    && blockList.contains(warmup)
                    && blockList.contains(mainset);
        }));
    }

    /**
     * Deleting a workout that has only a main set (neither warm-up nor cool-down)
     * must not throw. Only the main set non-library block is deleted.
     */
    @Test
    void deleteWorkout_withNeitherWarmupNorCooldown_deletesSuccessfully() {
        Block mainset = nonLibraryBlock(SectionType.MAINSET);
        Workout workout = workoutWith(null, mainset, null);

        when(workoutRepository.findById(workoutId)).thenReturn(Optional.of(workout));

        assertThatCode(() -> workoutService.deleteWorkout(workoutId, userId))
                .doesNotThrowAnyException();

        verify(workoutRepository).delete(workout);
        verify(blockRepository).deleteAll(argThat(blocks -> {
            List<Block> blockList = (List<Block>) blocks;
            return blockList.size() == 1 && blockList.contains(mainset);
        }));
    }

    /**
     * Deleting a workout with all three sections present must still succeed.
     * All three non-library blocks are deleted.
     */
    @Test
    void deleteWorkout_withAllThreeSections_deletesSuccessfully() {
        Block warmup = nonLibraryBlock(SectionType.WARMUP);
        Block mainset = nonLibraryBlock(SectionType.MAINSET);
        Block cooldown = nonLibraryBlock(SectionType.COOLDOWN);
        Workout workout = workoutWith(warmup, mainset, cooldown);

        when(workoutRepository.findById(workoutId)).thenReturn(Optional.of(workout));

        assertThatCode(() -> workoutService.deleteWorkout(workoutId, userId))
                .doesNotThrowAnyException();

        verify(workoutRepository).delete(workout);
        verify(blockRepository).deleteAll(argThat(blocks -> {
            List<Block> blockList = (List<Block>) blocks;
            return blockList.size() == 3
                    && blockList.contains(warmup)
                    && blockList.contains(mainset)
                    && blockList.contains(cooldown);
        }));
    }

    /**
     * Library blocks must never be deleted when a workout is removed.
     * They belong to the user independently and may be shared across workouts.
     */
    @Test
    void deleteWorkout_withLibraryBlock_doesNotDeleteLibraryBlock() {
        Block warmup = libraryBlock(SectionType.WARMUP);
        Block mainset = nonLibraryBlock(SectionType.MAINSET);
        Block cooldown = nonLibraryBlock(SectionType.COOLDOWN);
        Workout workout = workoutWith(warmup, mainset, cooldown);

        when(workoutRepository.findById(workoutId)).thenReturn(Optional.of(workout));

        workoutService.deleteWorkout(workoutId, userId);

        verify(blockRepository).deleteAll(argThat(blocks -> {
            List<Block> blockList = (List<Block>) blocks;
            // warmup is a library block and must be excluded
            return blockList.size() == 2
                    && !blockList.contains(warmup)
                    && blockList.contains(mainset)
                    && blockList.contains(cooldown);
        }));
    }

    /**
     * Prev blocks that are not library blocks must also be deleted
     * to avoid leaving orphaned rows after the workout is removed.
     */
    @Test
    void deleteWorkout_withNonLibraryPrevBlocks_deletesOrphanedPrevBlocks() {
        Block mainset = nonLibraryBlock(SectionType.MAINSET);
        Block prevMainset = nonLibraryBlock(SectionType.MAINSET);
        Workout workout = workoutWith(null, mainset, null);
        workout.setPrevMainsetBlock(prevMainset);

        when(workoutRepository.findById(workoutId)).thenReturn(Optional.of(workout));

        workoutService.deleteWorkout(workoutId, userId);

        verify(blockRepository).deleteAll(argThat(blocks -> {
            List<Block> blockList = (List<Block>) blocks;
            return blockList.size() == 2
                    && blockList.contains(mainset)
                    && blockList.contains(prevMainset);
        }));
    }

    /**
     * Attempting to delete a workout that does not exist must throw
     * {@link WorkoutNotFoundException}.
     */
    @Test
    void deleteWorkout_withUnknownWorkoutId_throwsWorkoutNotFoundException() {
        when(workoutRepository.findById(workoutId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> workoutService.deleteWorkout(workoutId, userId))
                .isInstanceOf(WorkoutNotFoundException.class);

        verify(workoutRepository, never()).delete(any());
        verify(blockRepository, never()).deleteAll(any(Iterable.class));
    }

    /**
     * Attempting to delete a workout owned by a different user must throw
     * {@link WorkoutNotFoundException}. Ownership violations collapse to 404
     * to avoid leaking the existence of other users' workouts.
     */
    @Test
    void deleteWorkout_withDifferentUserId_throwsWorkoutNotFoundException() {
        UUID otherUserId = UUID.randomUUID();
        Block mainset = nonLibraryBlock(SectionType.MAINSET);
        Workout workout = workoutWith(null, mainset, null);

        when(workoutRepository.findById(workoutId)).thenReturn(Optional.of(workout));

        assertThatThrownBy(() -> workoutService.deleteWorkout(workoutId, otherUserId))
                .isInstanceOf(WorkoutNotFoundException.class);

        verify(workoutRepository, never()).delete(any());
        verify(blockRepository, never()).deleteAll(any(Iterable.class));
    }
}
