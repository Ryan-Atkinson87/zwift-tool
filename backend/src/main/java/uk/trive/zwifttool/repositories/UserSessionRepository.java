package uk.trive.zwifttool.repositories;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import uk.trive.zwifttool.models.UserSession;

/**
 * Data access for the {@code user_sessions} table.
 */
public interface UserSessionRepository extends JpaRepository<UserSession, UUID> {

    /**
     * Finds a session by its refresh token value.
     *
     * @param refreshToken the opaque refresh token string from the HttpOnly cookie
     * @return the matching session, or empty if the token is invalid or has been rotated
     */
    Optional<UserSession> findByRefreshToken(String refreshToken);

    /**
     * Finds the most recently created session for a user that was created after a given timestamp.
     *
     * <p>Used for the rotation grace window: when a refresh request arrives with an old token,
     * this checks whether a new session was created within the grace period, indicating a
     * concurrent request already rotated the token.</p>
     *
     * @param userId    the user's ID
     * @param threshold the earliest acceptable creation time (now minus grace window)
     * @return the most recent session created after the threshold, if one exists
     */
    Optional<UserSession> findFirstByUserIdAndCreatedAtAfterOrderByCreatedAtDesc(UUID userId, Instant threshold);

    /**
     * Deletes all sessions for a user. Used during sign-out.
     *
     * @param userId the user whose sessions should be removed
     */
    void deleteByUserId(UUID userId);
}