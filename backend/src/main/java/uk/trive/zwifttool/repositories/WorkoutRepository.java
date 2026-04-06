package uk.trive.zwifttool.repositories;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import uk.trive.zwifttool.models.Workout;

/**
 * Spring Data JPA repository for {@link Workout} entities.
 */
public interface WorkoutRepository extends JpaRepository<Workout, UUID> {
}
