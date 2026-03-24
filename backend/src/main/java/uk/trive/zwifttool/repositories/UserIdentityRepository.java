package uk.trive.zwifttool.repositories;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import uk.trive.zwifttool.models.UserIdentity;

/**
 * Data access for the {@code user_identities} table.
 */
public interface UserIdentityRepository extends JpaRepository<UserIdentity, UUID> {

    /**
     * Finds an identity by provider and provider-specific subject.
     *
     * <p>For the {@code local} provider, {@code providerSub} is the user's email address.</p>
     *
     * @param provider    the auth provider (e.g. "local")
     * @param providerSub the provider's unique identifier for this user
     * @return the matching identity, or empty if none exists
     */
    Optional<UserIdentity> findByProviderAndProviderSub(String provider, String providerSub);
}