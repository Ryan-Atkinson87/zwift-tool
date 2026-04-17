package uk.trive.zwifttool.services;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import uk.trive.zwifttool.exceptions.WorkoutNotFoundException;
import uk.trive.zwifttool.models.Block;
import uk.trive.zwifttool.models.SectionType;
import uk.trive.zwifttool.models.Workout;
import uk.trive.zwifttool.repositories.BlockRepository;
import uk.trive.zwifttool.repositories.WorkoutRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the batch workout fetch behaviour introduced in {@link WorkoutService}.
 *
 * <p>These tests verify that {@code exportWorkouts} and {@code bulkReplaceSection}
 * fetch all requested workouts in a single repository call, rather than issuing
 * one query per workout ID. They also verify that ownership violations are correctly
 * detected when the returned list size does not match the requested ID count.</p>
 */
@ExtendWith(MockitoExtension.class)
class WorkoutServiceBatchFetchTest {

    @Mock
    private WorkoutRepository workoutRepository;

    @Mock
    private BlockRepository blockRepository;

    @Mock
    private ZwoExporter zwoExporter;

    @InjectMocks
    private WorkoutService workoutService;

    private UUID userId;
    private UUID workoutId1;
    private UUID workoutId2;
    private UUID blockId;
    private Block mainsetBlock;
    private Block libraryBlock;
    private Workout workout1;
    private Workout workout2;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        workoutId1 = UUID.randomUUID();
        workoutId2 = UUID.randomUUID();
        blockId = UUID.randomUUID();

        mainsetBlock = Block.builder()
                .id(UUID.randomUUID())
                .userId(userId)
                .name("Main Set")
                .sectionType(SectionType.MAINSET)
                .content("[{}]")
                .durationSeconds(3600)
                .intervalCount(5)
                .isLibraryBlock(false)
                .createdAt(Instant.now())
                .build();

        libraryBlock = Block.builder()
                .id(blockId)
                .userId(userId)
                .name("Library Mainset")
                .sectionType(SectionType.MAINSET)
                .content("[{\"type\":\"SteadyState\"}]")
                .durationSeconds(1800)
                .intervalCount(1)
                .isLibraryBlock(true)
                .createdAt(Instant.now())
                .build();

        workout1 = Workout.builder()
                .id(workoutId1)
                .userId(userId)
                .name("Workout One")
                .mainsetBlock(mainsetBlock)
                .isDraft(false)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        workout2 = Workout.builder()
                .id(workoutId2)
                .userId(userId)
                .name("Workout Two")
                .mainsetBlock(mainsetBlock)
                .isDraft(false)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }

    // -------------------------------------------------------------------------
    // exportWorkouts — single batch query
    // -------------------------------------------------------------------------

    /**
     * Verifies that {@code exportWorkouts} calls the repository once with the
     * full list of IDs, rather than issuing one query per workout ID.
     */
    @Test
    void exportWorkouts_usesSingleBatchQuery() throws IOException {
        List<UUID> workoutIds = List.of(workoutId1, workoutId2);

        when(workoutRepository.findAllByIdInAndUserId(workoutIds, userId))
                .thenReturn(List.of(workout1, workout2));
        when(zwoExporter.buildZip(any())).thenReturn(new byte[]{});

        workoutService.exportWorkouts(workoutIds, userId);

        // Repository must be called exactly once with the full ID list
        verify(workoutRepository, times(1)).findAllByIdInAndUserId(workoutIds, userId);

        // The old per-ID method must not be invoked at all
        verify(workoutRepository, never()).findById(any(UUID.class));
    }

    /**
     * Verifies that {@code exportWorkouts} passes all fetched workouts to
     * {@link ZwoExporter#buildZip} after a single batch fetch.
     */
    @Test
    void exportWorkouts_passesAllWorkoutsToZipBuilder() throws IOException {
        List<UUID> workoutIds = List.of(workoutId1, workoutId2);

        when(workoutRepository.findAllByIdInAndUserId(workoutIds, userId))
                .thenReturn(List.of(workout1, workout2));
        when(zwoExporter.buildZip(any())).thenReturn(new byte[]{1, 2, 3});

        byte[] result = workoutService.exportWorkouts(workoutIds, userId);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Workout>> captor = ArgumentCaptor.forClass(List.class);
        verify(zwoExporter).buildZip(captor.capture());

        assertThat(captor.getValue()).containsExactlyInAnyOrder(workout1, workout2);
        assertThat(result).isEqualTo(new byte[]{1, 2, 3});
    }

    /**
     * Verifies that {@code exportWorkouts} throws {@link WorkoutNotFoundException}
     * when the repository returns fewer workouts than were requested, which
     * indicates that at least one ID was not found or belongs to another user.
     */
    @Test
    void exportWorkouts_throwsWorkoutNotFoundException_whenOwnershipViolationDetected() throws IOException {
        List<UUID> workoutIds = List.of(workoutId1, workoutId2);

        // Only one workout returned — the other belongs to a different user or does not exist
        when(workoutRepository.findAllByIdInAndUserId(workoutIds, userId))
                .thenReturn(List.of(workout1));

        assertThatThrownBy(() -> workoutService.exportWorkouts(workoutIds, userId))
                .isInstanceOf(WorkoutNotFoundException.class);

        verify(zwoExporter, never()).buildZip(any());
    }

    /**
     * Verifies that {@code exportWorkouts} throws {@link WorkoutNotFoundException}
     * when none of the requested IDs are found or owned by the user.
     */
    @Test
    void exportWorkouts_throwsWorkoutNotFoundException_whenNoWorkoutsFound() {
        List<UUID> workoutIds = List.of(workoutId1, workoutId2);

        when(workoutRepository.findAllByIdInAndUserId(workoutIds, userId))
                .thenReturn(List.of());

        assertThatThrownBy(() -> workoutService.exportWorkouts(workoutIds, userId))
                .isInstanceOf(WorkoutNotFoundException.class);
    }

    // -------------------------------------------------------------------------
    // bulkReplaceSection — single batch query
    // -------------------------------------------------------------------------

    /**
     * Verifies that {@code bulkReplaceSection} calls the repository once with the
     * full list of IDs rather than issuing one query per workout ID, both for the
     * initial ownership-validating fetch and for the post-update re-fetch.
     */
    @Test
    void bulkReplaceSection_usesSingleBatchQuery() throws IOException {
        List<UUID> workoutIds = List.of(workoutId1, workoutId2);

        when(blockRepository.findById(blockId)).thenReturn(Optional.of(libraryBlock));
        when(workoutRepository.findAllByIdInAndUserId(workoutIds, userId))
                .thenReturn(List.of(workout1, workout2));
        when(workoutRepository.save(any(Workout.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(workoutRepository.findAllById(workoutIds)).thenReturn(List.of(workout1, workout2));
        when(zwoExporter.buildZip(any())).thenReturn(new byte[]{});

        workoutService.bulkReplaceSection(workoutIds, SectionType.MAINSET, blockId, userId);

        // The batch ownership-check query must be called exactly once
        verify(workoutRepository, times(1)).findAllByIdInAndUserId(workoutIds, userId);

        // The old per-ID method must not be invoked
        verify(workoutRepository, never()).findById(any(UUID.class));
    }

    /**
     * Verifies that {@code bulkReplaceSection} throws {@link WorkoutNotFoundException}
     * before applying any mutations when the batch fetch reveals an ownership violation.
     */
    @Test
    void bulkReplaceSection_throwsWorkoutNotFoundException_whenOwnershipViolationDetected() {
        List<UUID> workoutIds = List.of(workoutId1, workoutId2);

        when(blockRepository.findById(blockId)).thenReturn(Optional.of(libraryBlock));
        // Only one workout returned — ownership violation on the second
        when(workoutRepository.findAllByIdInAndUserId(workoutIds, userId))
                .thenReturn(List.of(workout1));

        assertThatThrownBy(() -> workoutService.bulkReplaceSection(
                workoutIds, SectionType.MAINSET, blockId, userId))
                .isInstanceOf(WorkoutNotFoundException.class);

        // No mutations must have been applied
        verify(workoutRepository, never()).save(any(Workout.class));
    }

    /**
     * Verifies that {@code bulkReplaceSection} throws {@link WorkoutNotFoundException}
     * when none of the requested IDs match the user.
     */
    @Test
    void bulkReplaceSection_throwsWorkoutNotFoundException_whenNoWorkoutsFound() {
        List<UUID> workoutIds = List.of(workoutId1, workoutId2);

        when(blockRepository.findById(blockId)).thenReturn(Optional.of(libraryBlock));
        when(workoutRepository.findAllByIdInAndUserId(workoutIds, userId))
                .thenReturn(List.of());

        assertThatThrownBy(() -> workoutService.bulkReplaceSection(
                workoutIds, SectionType.MAINSET, blockId, userId))
                .isInstanceOf(WorkoutNotFoundException.class);

        verify(workoutRepository, never()).save(any(Workout.class));
    }
}
