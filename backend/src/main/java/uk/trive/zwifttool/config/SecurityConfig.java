package uk.trive.zwifttool.config;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Configures the Spring Security filter chain for the application,
 * including CORS policy and CSRF settings.
 *
 * <p>CORS and cookie behaviour are environment-aware. In production the allowed
 * origin is {@code https://zwifttool.trivedev.uk}; in local dev it is
 * {@code http://localhost:5173}. The values are set via environment variables
 * so the same code runs in both environments without profiles.</p>
 *
 * <p>This is a scaffold configuration. JWT authentication will be added
 * when the auth endpoints are implemented.</p>
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Value("${app.cors.allowed-origin}")
    private String allowedOrigin;

    /**
     * Builds the security filter chain applied to all incoming HTTP requests.
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
            // 3. Authorise requests: permit public endpoints, require auth for everything else.
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/health").permitAll()
                .anyRequest().authenticated()
            );
        return http.build();
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

        // Only allow requests from the configured frontend origin.
        // Production: https://zwifttool.trivedev.uk
        // Local dev:  http://localhost:5173
        config.setAllowedOrigins(List.of(allowedOrigin));

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