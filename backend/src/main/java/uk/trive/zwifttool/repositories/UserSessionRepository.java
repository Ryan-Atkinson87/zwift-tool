package uk.trive.zwifttool.repositories;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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
     * Deletes a session by its primary key and returns the number of rows deleted.
     *
     * <p>Used instead of JPA's {@code delete(entity)} so that a concurrent deletion
     * (where another transaction already removed the row) returns 0 rather than
     * throwing an {@code ObjectOptimisticLockingFailureException}. A return value
     * of 0 signals that the token was already rotated by a concurrent request.</p>
     *
     * @param id the session primary key
     * @return the number of rows deleted (1 on success, 0 if already gone)
     */
    @Modifying
    @Query("DELETE FROM UserSession s WHERE s.id = :id")
    int removeById(@Param("id") UUID id);

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

    /**
     * Deletes all sessions that have passed their expiry time.
     *
     * <p>Called periodically by the scheduled cleanup task to prevent unbounded
     * growth of the user_sessions table.</p>
     *
     * @param now the current time; all sessions with expiresAt before this are removed
     * @return the number of rows deleted
     */
    int deleteByExpiresAtBefore(Instant now);
}