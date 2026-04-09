package uk.trive.zwifttool.services;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import uk.trive.zwifttool.exceptions.EmailAlreadyExistsException;
import uk.trive.zwifttool.exceptions.InvalidCredentialsException;
import uk.trive.zwifttool.exceptions.InvalidRefreshTokenException;
import uk.trive.zwifttool.models.User;
import uk.trive.zwifttool.models.UserIdentity;
import uk.trive.zwifttool.models.UserSession;
import uk.trive.zwifttool.repositories.UserIdentityRepository;
import uk.trive.zwifttool.repositories.UserRepository;
import uk.trive.zwifttool.repositories.UserSessionRepository;

/**
 * Handles all authentication business logic including sign-up, sign-in,
 * token refresh with rotation, and sign-out.
 *
 * <p>Refresh tokens are cryptographically random opaque strings (256-bit hex
 * via {@link SecureRandom}). On every refresh, the old session record is
 * replaced with a new one containing a fresh token. A 10-second grace window
 * handles concurrent requests that arrive with the previous token.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private static final long REFRESH_TOKEN_EXPIRY_DAYS = 7;
    private static final long GRACE_WINDOW_SECONDS = 10;
    private static final String LOCAL_PROVIDER = "local";

    private final UserRepository userRepository;
    private final UserIdentityRepository userIdentityRepository;
    private final UserSessionRepository userSessionRepository;
    private final PasswordEncoder passwordEncoder;
    private final SecureRandom secureRandom = new SecureRandom();

    /**
     * Registers a new user with email and password.
     *
     * <p>Creates a {@code users} row and a {@code user_identities} row with
     * provider {@code local}. The password is hashed with BCrypt before storage.</p>
     *
     * @param email       the user's email address
     * @param password    the plaintext password (minimum 8 characters)
     * @param displayName optional display name
     * @return the created user
     * @throws EmailAlreadyExistsException if the email is already registered
     */
    @Transactional
    public User signUp(String email, String password, String displayName) {
        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyExistsException(email);
        }

        Instant now = Instant.now();

        User user = User.builder()
                .email(email)
                .displayName(displayName)
                .createdAt(now)
                .updatedAt(now)
                .build();
        user = userRepository.save(user);

        UserIdentity identity = UserIdentity.builder()
                .userId(user.getId())
                .provider(LOCAL_PROVIDER)
                .providerSub(email)
                .passwordHash(passwordEncoder.encode(password))
                .createdAt(now)
                .build();
        userIdentityRepository.save(identity);

        log.info("New user registered: {}", user.getId());
        return user;
    }

    /**
     * Authenticates a user by email and password.
     *
     * @param email    the user's email address
     * @param password the plaintext password to verify
     * @return the authenticated user
     * @throws InvalidCredentialsException if the email does not exist or the password is wrong
     */
    public User signIn(String email, String password) {
        UserIdentity identity = userIdentityRepository
                .findByProviderAndProviderSub(LOCAL_PROVIDER, email)
                .orElseThrow(InvalidCredentialsException::new);

        if (!passwordEncoder.matches(password, identity.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }

        User user = userRepository.findById(identity.getUserId())
                .orElseThrow(InvalidCredentialsException::new);

        log.info("User signed in: {}", user.getId());
        return user;
    }

    /**
     * Creates a new refresh token session for the given user.
     *
     * <p>Generates a 256-bit hex token via {@link SecureRandom} and stores it
     * in {@code user_sessions} with a 7-day expiry.</p>
     *
     * @param userId the authenticated user's ID
     * @return the created session containing the refresh token
     */
    @Transactional
    public UserSession createSession(UUID userId) {
        String refreshToken = generateRefreshToken();
        Instant now = Instant.now();

        UserSession session = UserSession.builder()
                .userId(userId)
                .refreshToken(refreshToken)
                .expiresAt(now.plus(REFRESH_TOKEN_EXPIRY_DAYS, ChronoUnit.DAYS))
                .createdAt(now)
                .build();

        return userSessionRepository.save(session);
    }

    /**
     * Refreshes an existing session, issuing a new refresh token.
     *
     * <p>The old session record is deleted and replaced with a new one (rotation).
     * The user ID is resolved directly from the refresh token row so the endpoint
     * works even when the access token cookie has expired and been removed by the
     * browser. If the incoming token is not found (already rotated), a 10-second
     * grace window checks whether a new session was created recently for the user
     * identified by the optional access token, covering concurrent requests that
     * arrived with the old token.</p>
     *
     * @param oldRefreshToken the refresh token from the HttpOnly cookie
     * @param accessTokenUserId the user ID extracted from the access token if present,
     *                          used only as a fallback for the grace window lookup
     * @return the new session containing a fresh refresh token
     * @throws InvalidRefreshTokenException if the token is invalid, expired, or
     *         outside the grace window
     */
    @Transactional
    public UserSession refreshSession(String oldRefreshToken, Optional<UUID> accessTokenUserId) {
        Optional<UserSession> existingSession = userSessionRepository.findByRefreshToken(oldRefreshToken);

        if (existingSession.isPresent()) {
            UserSession session = existingSession.get();

            if (session.getExpiresAt().isBefore(Instant.now())) {
                userSessionRepository.delete(session);
                throw new InvalidRefreshTokenException();
            }

            UUID userId = session.getUserId();
            userSessionRepository.delete(session);

            log.info("Refresh token rotated for user {}", userId);
            return createSession(userId);
        }

        // Token not found: it may have been rotated by a concurrent request.
        // The grace window needs a user ID to query recent sessions; fall back to
        // the access token subject if available, otherwise reject the request.
        UUID graceUserId = accessTokenUserId.orElseThrow(InvalidRefreshTokenException::new);
        return handleGraceWindow(graceUserId);
    }

    /**
     * Signs out a user by deleting all their active sessions.
     *
     * @param userId the authenticated user's ID
     */
    @Transactional
    public void signOut(UUID userId) {
        userSessionRepository.deleteByUserId(userId);
        log.info("User signed out, all sessions cleared: {}", userId);
    }

    /**
     * Retrieves a user by ID.
     *
     * @param userId the user's ID
     * @return the user
     * @throws InvalidCredentialsException if the user does not exist
     */
    public User getUserById(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(InvalidCredentialsException::new);
    }

    /**
     * Returns the refresh token expiry duration in seconds, for setting the
     * cookie max-age.
     *
     * @return the refresh token lifetime in seconds
     */
    public long getRefreshTokenExpirySeconds() {
        return REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60;
    }

    /**
     * Handles the rotation grace window when a refresh token is not found.
     *
     * <p>This covers the case where two concurrent requests arrive with the same
     * refresh token. The first request rotates the token successfully. The second
     * request finds the old token gone, but a new session was created within the
     * last 10 seconds for the same user, so it returns that session instead of
     * rejecting the request. This is the same approach used by Auth0 and Firebase.</p>
     *
     * @param userId the user ID from the access token
     * @return the recently created session within the grace window
     * @throws InvalidRefreshTokenException if no recent session exists
     */
    private UserSession handleGraceWindow(UUID userId) {
        Instant threshold = Instant.now().minusSeconds(GRACE_WINDOW_SECONDS);

        Optional<UserSession> recentSession = userSessionRepository
                .findFirstByUserIdAndCreatedAtAfterOrderByCreatedAtDesc(userId, threshold);

        if (recentSession.isPresent()) {
            log.info("Grace window: returning recently rotated session for user {}", userId);
            return recentSession.get();
        }

        log.debug("Refresh token not found and no session within grace window for user {}", userId);
        throw new InvalidRefreshTokenException();
    }

    /**
     * Generates a cryptographically random 256-bit hex string for use as a
     * refresh token.
     *
     * @return a 64-character hex string
     */
    private String generateRefreshToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        StringBuilder hex = new StringBuilder(64);
        for (byte b : bytes) {
            hex.append(String.format("%02x", b));
        }
        return hex.toString();
    }
}