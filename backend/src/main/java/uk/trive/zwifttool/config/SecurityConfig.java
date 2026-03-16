package uk.trive.zwifttool.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Configures the Spring Security filter chain for the application.
 *
 * <p>This is a scaffold configuration. JWT authentication will be added
 * when the auth endpoints are implemented.</p>
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

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
            // CSRF protection is disabled. Spring Security CSRF defends against attacks where a
            // malicious site tricks the browser into making authenticated requests using the victim's
            // cookies. For this API, two controls make that attack impossible without CSRF tokens:
            //   1. SameSite=Strict cookies: the browser will not attach cookies on any cross-site
            //      request, so a malicious origin can never trigger an authenticated call.
            //   2. Strict CORS: the API rejects requests from any origin other than zwifttool.trive.uk,
            //      so even if a cross-site request were sent, the preflight would be rejected.
            // Keeping CSRF enabled would require every client request to carry a synchronisation token,
            // adding complexity with no security benefit given the above controls.
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                // Permit the health endpoint so infrastructure can check liveness without auth
                .requestMatchers("/health").permitAll()
                .anyRequest().authenticated()
            );
        return http.build();
    }
}