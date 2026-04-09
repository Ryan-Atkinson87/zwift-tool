package uk.trive.zwifttool.repositories;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import uk.trive.zwifttool.models.Block;

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
}
