package uk.trive.zwifttool.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.ResponseCookie;

/**
 * Provides environment-aware cookie configuration for auth tokens.
 *
 * <p>Cookie properties differ between production and local development:</p>
 * <ul>
 *   <li>Production: HttpOnly, Secure=true, SameSite=Strict, Domain=trivedev.uk</li>
 *   <li>Local dev: HttpOnly, Secure=false, SameSite=Lax, Domain omitted</li>
 * </ul>
 *
 * <p>The values are controlled by {@code COOKIE_SECURE} and {@code COOKIE_DOMAIN}
 * environment variables, so the same code runs in both environments without
 * Spring profiles.</p>
 */
@Configuration
public class CookieConfig {

    @Value("${app.cookie.secure}")
    private boolean cookieSecure;

    @Value("${app.cookie.domain:}")
    private String cookieDomain;

    /**
     * Builds a {@link ResponseCookie} with the correct security attributes for
     * the current environment.
     *
     * <p>All auth cookies (access token, refresh token) should be created
     * through this method to ensure consistent security settings.</p>
     *
     * @param name   the cookie name
     * @param value  the cookie value
     * @param maxAge the maximum age in seconds (use 0 to delete, -1 for session)
     * @return a fully configured {@link ResponseCookie}
     */
    public ResponseCookie createCookie(String name, String value, long maxAge) {
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(cookieSecure)
                .path("/")
                .maxAge(maxAge);

        // SameSite=Strict in production prevents the browser from sending cookies on any
        // cross-site request, blocking CSRF attacks. Lax is used in local dev because Strict
        // can interfere with dev tooling redirects over plain HTTP.
        if (cookieSecure) {
            builder.sameSite("Strict");
        } else {
            builder.sameSite("Lax");
        }

        // Domain is set in production to trivedev.uk so cookies are shared across subdomains
        // (zwifttool.trivedev.uk and api.zwifttool.trivedev.uk). In local dev, domain is
        // omitted so the cookie defaults to localhost.
        if (cookieDomain != null && !cookieDomain.isBlank()) {
            builder.domain(cookieDomain);
        }

        return builder.build();
    }

    /**
     * Builds a cookie that clears (expires) an existing cookie by name.
     *
     * <p>Used during sign-out to remove auth cookies from the browser.
     * The cookie attributes must match those used when the cookie was set,
     * otherwise the browser will not recognise it as the same cookie.</p>
     *
     * @param name the cookie name to clear
     * @return a {@link ResponseCookie} with maxAge=0 that deletes the named cookie
     */
    public ResponseCookie clearCookie(String name) {
        return createCookie(name, "", 0);
    }
}