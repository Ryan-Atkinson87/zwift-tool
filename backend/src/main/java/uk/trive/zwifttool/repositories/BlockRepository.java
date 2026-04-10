package uk.trive.zwifttool.repositories;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import uk.trive.zwifttool.models.Block;
import uk.trive.zwifttool.models.SectionType;

/**
 * Spring Data JPA repository for {@link Block} entities.
 */
public interface BlockRepository extends JpaRepository<Block, UUID> {

    /**
     * Returns all library blocks owned by the given user, ordered by most
     * recently created first.
     *
     * @param userId the user whose library blocks to fetch
     * @return list of library blocks, empty if the user has none
     */
    List<Block> findByUserIdAndIsLibraryBlockTrueOrderByCreatedAtDesc(UUID userId);

    /**
     * Returns library blocks owned by the given user filtered to a single
     * section type, ordered by most recently created first.
     *
     * @param userId      the user whose library blocks to fetch
     * @param sectionType the section type to filter by
     * @return matching library blocks, empty if the user has none for that type
     */
    List<Block> findByUserIdAndIsLibraryBlockTrueAndSectionTypeOrderByCreatedAtDesc(
            UUID userId, SectionType sectionType);

    /**
     * Returns {@code true} if the given block is referenced by at least one
     * workout in any of the six section FK columns (current or previous).
     *
     * <p>This check is used before hard-deleting a block to determine whether
     * it is safe to remove entirely or should instead be soft-deleted by
     * setting {@code is_library_block = false}.</p>
     *
     * @param blockId the block ID to check
     * @return true if the block is referenced by at least one workout
     */
    @Query("""
            SELECT COUNT(w) > 0
            FROM Workout w
            WHERE w.warmupBlock.id    = :blockId
               OR w.mainsetBlock.id   = :blockId
               OR w.cooldownBlock.id  = :blockId
               OR w.prevWarmupBlock.id  = :blockId
               OR w.prevMainsetBlock.id = :blockId
               OR w.prevCooldownBlock.id = :blockId
            """)
    boolean isReferencedByAnyWorkout(@Param("blockId") UUID blockId);
}
