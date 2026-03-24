package uk.trive.zwifttool.repositories;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import uk.trive.zwifttool.models.User;

/**
 * Data access for the {@code users} table.
 */
public interface UserRepository extends JpaRepository<User, UUID> {

    /**
     * Finds a user by their email address (case-sensitive).
     *
     * @param email the email to search for
     * @return the matching user, or empty if no user exists with that email
     */
    Optional<User> findByEmail(String email);

    /**
     * Checks whether a user with the given email already exists.
     *
     * @param email the email to check
     * @return true if a user with this email exists
     */
    boolean existsByEmail(String email);
}