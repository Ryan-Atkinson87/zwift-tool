package uk.trive.zwifttool.controllers;

import java.util.Optional;
import java.util.UUID;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import uk.trive.zwifttool.config.CookieConfig;
import uk.trive.zwifttool.config.JwtAuthenticationFilter;
import uk.trive.zwifttool.config.JwtUtil;
import uk.trive.zwifttool.controllers.dto.AuthResponse;
import uk.trive.zwifttool.controllers.dto.SignInRequest;
import uk.trive.zwifttool.controllers.dto.SignUpRequest;
import uk.trive.zwifttool.exceptions.InvalidRefreshTokenException;
import uk.trive.zwifttool.models.User;
import uk.trive.zwifttool.models.UserSession;
import uk.trive.zwifttool.services.AuthService;

/**
 * Handles authentication endpoints: sign-up, sign-in, token refresh, and sign-out.
 *
 * <p>Access and refresh tokens are issued as HttpOnly cookies via {@link CookieConfig}.
 * The response body contains only non-sensitive user information.</p>
 */
@Slf4j
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private static final String ACCESS_TOKEN_COOKIE = JwtAuthenticationFilter.ACCESS_TOKEN_COOKIE;
    private static final String REFRESH_TOKEN_COOKIE = "refresh_token";

    private final AuthService authService;
    private final JwtUtil jwtUtil;
    private final CookieConfig cookieConfig;

    /**
     * Registers a new user and issues auth tokens.
     *
     * @param request the sign-up request containing email, password, and optional display name
     * @return HTTP 201 with the user details and auth cookies set
     */
    @PostMapping("/signup")
    public ResponseEntity<AuthResponse> signUp(@RequestBody SignUpRequest request) {
        User user = authService.signUp(request.getEmail(), request.getPassword(), request.getDisplayName());
        UserSession session = authService.createSession(user.getId());

        HttpHeaders headers = buildAuthCookieHeaders(user.getId(), session.getRefreshToken());

        AuthResponse response = AuthResponse.builder()
                .userId(user.getId().toString())
                .email(user.getEmail())
                .displayName(user.getDisplayName())
                .build();

        return ResponseEntity.status(HttpStatus.CREATED).headers(headers).body(response);
    }

    /**
     * Authenticates a user and issues auth tokens.
     *
     * @param request the sign-in request containing email and password
     * @return HTTP 200 with the user details and auth cookies set
     */
    @PostMapping("/signin")
    public ResponseEntity<AuthResponse> signIn(@RequestBody SignInRequest request) {
        User user = authService.signIn(request.getEmail(), request.getPassword());
        UserSession session = authService.createSession(user.getId());

        HttpHeaders headers = buildAuthCookieHeaders(user.getId(), session.getRefreshToken());

        AuthResponse response = AuthResponse.builder()
                .userId(user.getId().toString())
                .email(user.getEmail())
                .displayName(user.getDisplayName())
                .build();

        return ResponseEntity.ok().headers(headers).body(response);
    }

    /**
     * Issues new access and refresh tokens using the current refresh token.
     *
     * <p>The user ID is extracted from the access token cookie (which may be expired
     * but is still signed). This is needed for the grace window: when a concurrent
     * request has already rotated the refresh token, the user ID allows us to find
     * the recently created session.</p>
     *
     * @param refreshToken the refresh token from the HttpOnly cookie
     * @param accessToken  the access token from the HttpOnly cookie (may be expired)
     * @return HTTP 200 with new auth cookies set, or HTTP 401 if the refresh token is invalid
     */
    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(
            @CookieValue(name = REFRESH_TOKEN_COOKIE, required = false) String refreshToken,
            @CookieValue(name = ACCESS_TOKEN_COOKIE, required = false) String accessToken
    ) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new InvalidRefreshTokenException();
        }

        // Extract user ID from the access token, even if expired.
        // The signature is still verified to prevent tampering.
        Optional<UUID> userId = Optional.empty();
        if (accessToken != null && !accessToken.isBlank()) {
            userId = jwtUtil.extractUserIdIgnoringExpiry(accessToken);
        }

        if (userId.isEmpty()) {
            throw new InvalidRefreshTokenException();
        }

        UserSession session = authService.refreshSession(refreshToken, userId.get());

        // Look up the user for the response body
        User user = authService.getUserById(session.getUserId());

        HttpHeaders headers = buildAuthCookieHeaders(session.getUserId(), session.getRefreshToken());

        AuthResponse response = AuthResponse.builder()
                .userId(user.getId().toString())
                .email(user.getEmail())
                .displayName(user.getDisplayName())
                .build();

        return ResponseEntity.ok().headers(headers).body(response);
    }

    /**
     * Signs out the authenticated user by clearing all sessions and auth cookies.
     *
     * <p>This endpoint requires a valid (non-expired) access token. If the access
     * token has expired, the frontend must call {@code /auth/refresh} first.</p>
     *
     * @param userId the authenticated user's ID from the JWT
     * @return HTTP 204 No Content with cookies cleared
     */
    @PostMapping("/signout")
    public ResponseEntity<Void> signOut(@AuthenticationPrincipal UUID userId) {
        authService.signOut(userId);

        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.SET_COOKIE, cookieConfig.clearCookie(ACCESS_TOKEN_COOKIE).toString());
        headers.add(HttpHeaders.SET_COOKIE, cookieConfig.clearCookie(REFRESH_TOKEN_COOKIE).toString());

        return ResponseEntity.noContent().headers(headers).build();
    }

    /**
     * Builds HTTP headers containing both access and refresh token cookies.
     *
     * @param userId       the user ID for the access token JWT
     * @param refreshToken the opaque refresh token string
     * @return headers with both Set-Cookie values
     */
    private HttpHeaders buildAuthCookieHeaders(UUID userId, String refreshToken) {
        String accessToken = jwtUtil.generateAccessToken(userId);

        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.SET_COOKIE,
                cookieConfig.createCookie(ACCESS_TOKEN_COOKIE, accessToken,
                        jwtUtil.getAccessTokenExpirySeconds()).toString());
        headers.add(HttpHeaders.SET_COOKIE,
                cookieConfig.createCookie(REFRESH_TOKEN_COOKIE, refreshToken,
                        authService.getRefreshTokenExpirySeconds()).toString());

        return headers;
    }
}