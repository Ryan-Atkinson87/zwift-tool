package uk.trive.zwifttool.repositories;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import uk.trive.zwifttool.controllers.dto.WorkoutSummaryResponse;
import uk.trive.zwifttool.models.Workout;

/**
 * Spring Data JPA repository for {@link Workout} entities.
 */
public interface WorkoutRepository extends JpaRepository<Workout, UUID> {

    /**
     * Returns a lightweight summary of every workout belonging to the given
     * user, ordered by most recently updated first.
     *
     * <p>Uses a JPQL constructor projection with explicit left joins to each
     * section block, summing their durations in SQL. This avoids the N+1
     * select problem that would occur if the list were built from fully
     * loaded {@code Workout} entities, since every {@code @ManyToOne} block
     * relation would otherwise trigger its own query.</p>
     *
     * @param userId the authenticated user's ID
     * @return list of workout summaries for that user, newest first
     */
    @Query("""
            SELECT new uk.trive.zwifttool.controllers.dto.WorkoutSummaryResponse(
                w.id,
                w.name,
                w.author,
                w.description,
                CAST(COALESCE(wb.durationSeconds, 0)
                    + COALESCE(mb.durationSeconds, 0)
                    + COALESCE(cb.durationSeconds, 0) AS integer),
                w.isDraft,
                w.updatedAt
            )
            FROM Workout w
            LEFT JOIN w.warmupBlock wb
            LEFT JOIN w.mainsetBlock mb
            LEFT JOIN w.cooldownBlock cb
            WHERE w.userId = :userId
            ORDER BY w.updatedAt DESC
            """)
    List<WorkoutSummaryResponse> findSummariesByUserId(@Param("userId") UUID userId);
}
