package uk.trive.zwifttool.config;

import java.util.Arrays;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import lombok.RequiredArgsConstructor;

/**
 * Configures the Spring Security filter chain for the application,
 * including CORS policy, CSRF settings, JWT authentication, and
 * endpoint authorisation rules.
 *
 * <p>CORS and cookie behaviour are environment-aware. In production the allowed
 * origin is {@code https://zwifttool.trivedev.uk}; in local dev it is
 * {@code http://localhost:5173}. The values are set via environment variables
 * so the same code runs in both environments without profiles.</p>
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    @Value("${app.cors.allowed-origin}")
    private String allowedOrigins;

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    /**
     * Builds the security filter chain applied to all incoming HTTP requests.
     *
     * <p>The filter chain is configured in the following order:</p>
     * <ol>
     *   <li>CORS: handle preflight OPTIONS requests before any auth checks</li>
     *   <li>CSRF: disabled, protected by SameSite cookies and strict CORS instead</li>
     *   <li>Session management: stateless, no server-side sessions</li>
     *   <li>JWT filter: placed before UsernamePasswordAuthenticationFilter to
     *       extract and validate the access token from the HttpOnly cookie</li>
     *   <li>Authorisation: public endpoints permitted, all others require authentication</li>
     * </ol>
     *
     * @param http the {@link HttpSecurity} builder provided by Spring Security
     * @return the configured {@link SecurityFilterChain}
     * @throws Exception if the configuration cannot be built
     */
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // 1. Apply CORS configuration from the corsConfigurationSource bean below.
            //    This must come before any authentication checks so that preflight OPTIONS
            //    requests are handled correctly.
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))

            // 2. CSRF protection is disabled. Spring Security CSRF defends against attacks where a
            //    malicious site tricks the browser into making authenticated requests using the
            //    victim's cookies. For this API, two controls make that attack impossible without
            //    CSRF tokens:
            //      a. SameSite cookies: the browser will not attach cookies on cross-site requests,
            //         so a malicious origin can never trigger an authenticated call.
            //      b. Strict CORS: the API rejects requests from any origin other than the
            //         configured allowed origin, so cross-site requests fail at preflight.
            //    Keeping CSRF enabled would require every client request to carry a synchronisation
            //    token, adding complexity with no security benefit given the above controls.
            .csrf(csrf -> csrf.disable())

            // 3. Disable session creation. We use stateless JWT auth, not server-side sessions.
            //    Each request is authenticated independently via the access token cookie.
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )

            // 4. Apply the JWT authentication filter before Spring's default
            //    UsernamePasswordAuthenticationFilter. This ensures the access token from
            //    the HttpOnly cookie is validated and the SecurityContext is populated
            //    before any authorisation checks run.
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)

            // 5. Authorise requests: permit public endpoints, require auth for everything else.
            //    Public endpoints: health check, sign-up, sign-in, and token refresh.
            //    POST /auth/signout is deliberately not in this list because it requires
            //    a valid access token to identify which user's sessions to clear.
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/health").permitAll()
                .requestMatchers("/auth/signup").permitAll()
                .requestMatchers("/auth/signin").permitAll()
                .requestMatchers("/auth/refresh").permitAll()
                .anyRequest().authenticated()
            );

        return http.build();
    }

    /**
     * Provides the BCrypt password encoder used for hashing and verifying passwords.
     *
     * @return a {@link BCryptPasswordEncoder} instance
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Defines the CORS policy for the API.
     *
     * <p>Only the single origin specified by {@code CORS_ALLOWED_ORIGIN} is permitted.
     * Credentials are allowed so that HttpOnly auth cookies are sent cross-origin
     * from the frontend to the API. All standard methods and headers are permitted.</p>
     *
     * @return the CORS configuration source applied to all endpoints
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        // Accepts a comma-separated list so multiple origins can be permitted simultaneously,
        // e.g. localhost:5173 and a LAN IP for mobile testing.
        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
        config.setAllowedOrigins(origins);

        // Allow credentials so the browser sends HttpOnly cookies cross-origin
        config.setAllowCredentials(true);

        // Permit all standard methods used by the API
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));

        // Allow all headers the frontend may send (Content-Type, Authorization, etc.)
        config.setAllowedHeaders(List.of("*"));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}