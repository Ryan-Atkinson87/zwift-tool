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
 * Stores authentication credentials for a single sign-in method.
 *
 * <p>Each user can have multiple identities (one per provider). For MVP,
 * only the {@code local} provider is supported, which uses email as the
 * {@code providerSub} and stores a BCrypt password hash.</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "user_identities")
public class UserIdentity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String provider;

    @Column(name = "provider_sub", nullable = false)
    private String providerSub;

    @Column(name = "password_hash")
    private String passwordHash;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}