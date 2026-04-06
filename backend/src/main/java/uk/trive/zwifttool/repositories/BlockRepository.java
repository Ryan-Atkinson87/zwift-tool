package uk.trive.zwifttool.repositories;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import uk.trive.zwifttool.models.Block;

/**
 * Spring Data JPA repository for {@link Block} entities.
 */
public interface BlockRepository extends JpaRepository<Block, UUID> {
}
