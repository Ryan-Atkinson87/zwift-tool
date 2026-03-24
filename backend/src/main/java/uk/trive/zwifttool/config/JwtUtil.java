package uk.trive.zwifttool.config;

import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

/**
 * Utility for generating and validating JWT access tokens.
 *
 * <p>Access tokens are signed with HMAC-SHA256 using the secret from the
 * {@code JWT_SECRET} environment variable. Each token contains the user's
 * ID as the subject and expires after 15 minutes.</p>
 */
@Component
public class JwtUtil {

    private static final long ACCESS_TOKEN_EXPIRY_SECONDS = 15 * 60;

    private final SecretKey signingKey;

    /**
     * Creates a new JwtUtil with the provided signing secret.
     *
     * @param secret the HMAC-SHA256 secret key from the environment
     */
    public JwtUtil(@Value("${app.jwt.secret}") String secret) {
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes());
    }

    /**
     * Generates a signed JWT access token for the given user.
     *
     * @param userId the authenticated user's ID, set as the token subject
     * @return a signed JWT string
     */
    public String generateAccessToken(UUID userId) {
        Instant now = Instant.now();

        return Jwts.builder()
                .subject(userId.toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(ACCESS_TOKEN_EXPIRY_SECONDS)))
                .signWith(signingKey)
                .compact();
    }

    /**
     * Extracts the user ID from a valid access token.
     *
     * @param token the JWT string to parse
     * @return the user ID stored in the token subject
     * @throws JwtException if the token is invalid, expired, or tampered with
     */
    public UUID extractUserId(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        return UUID.fromString(claims.getSubject());
    }

    /**
     * Checks whether a token is valid and not expired.
     *
     * @param token the JWT string to validate
     * @return true if the token is valid, false otherwise
     */
    public boolean isValid(String token) {
        try {
            Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(token);
            return true;
        } catch (JwtException e) {
            return false;
        }
    }

    /**
     * Extracts the user ID from a token that may be expired but is still
     * correctly signed.
     *
     * <p>Used during token refresh to identify the user when the access token
     * has expired but the refresh token cookie is still valid. The signature
     * is still verified to prevent tampering.</p>
     *
     * @param token the JWT string to parse (may be expired)
     * @return the user ID, or empty if the token is invalid or tampered with
     */
    public Optional<UUID> extractUserIdIgnoringExpiry(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return Optional.of(UUID.fromString(claims.getSubject()));
        } catch (ExpiredJwtException e) {
            // Token is expired but signature was valid, so the subject is trustworthy
            return Optional.of(UUID.fromString(e.getClaims().getSubject()));
        } catch (JwtException e) {
            return Optional.empty();
        }
    }

    /**
     * Returns the access token expiry duration in seconds.
     *
     * <p>Used by the cookie configuration to set the correct max-age on the
     * access token cookie.</p>
     *
     * @return the access token lifetime in seconds (900)
     */
    public long getAccessTokenExpirySeconds() {
        return ACCESS_TOKEN_EXPIRY_SECONDS;
    }
}