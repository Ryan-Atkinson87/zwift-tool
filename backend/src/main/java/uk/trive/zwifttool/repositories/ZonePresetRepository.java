package uk.trive.zwifttool.repositories;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import uk.trive.zwifttool.models.ZonePreset;

/**
 * Spring Data JPA repository for {@link ZonePreset} entities.
 */
public interface ZonePresetRepository extends JpaRepository<ZonePreset, UUID> {

    /** Returns every preset row owned by the given user. */
    List<ZonePreset> findAllByUserId(UUID userId);

    /** Returns the preset for a given user and zone, if a custom row exists. */
    Optional<ZonePreset> findByUserIdAndZone(UUID userId, Integer zone);

    /** Deletes the preset for a given user and zone, if a custom row exists. */
    void deleteByUserIdAndZone(UUID userId, Integer zone);
}
