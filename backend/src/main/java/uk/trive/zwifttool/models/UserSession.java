package uk.trive.zwifttool.models;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Represents an active refresh token session for a user.
 *
 * <p>The {@code refreshToken} is a cryptographically random opaque string
 * (256-bit hex via {@code SecureRandom}), stored in an HttpOnly cookie.
 * The internal {@code id} is never exposed to the client.</p>
 *
 * <p>On each token refresh, the old session record is replaced with a new one
 * (refresh token rotation). A 10-second grace window on {@code createdAt}
 * handles concurrent requests that arrive with the previous token.</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "user_sessions")
public class UserSession {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "refresh_token", nullable = false, unique = true)
    private String refreshToken;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}