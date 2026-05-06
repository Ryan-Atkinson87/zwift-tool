package uk.trive.zwifttool.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Unit tests for the CSV parsing logic in {@link SecurityConfig#corsConfigurationSource()}.
 *
 * <p>Each test constructs a {@link SecurityConfig} with a specific value for
 * {@code CORS_ALLOWED_ORIGIN} and asserts the resulting allowed-origins list.
 * No Spring context is started so that the tests run fast and without
 * infrastructure dependencies.</p>
 *
 * <p>The tests are designed to fail if the CSV parsing logic is reverted to
 * treating the property as a single origin rather than a delimited list.</p>
 */
class SecurityConfigTest {

    /**
     * Builds a {@link SecurityConfig} with the given raw origin string injected
     * into the {@code allowedOrigins} field via {@link ReflectionTestUtils}.
     *
     * <p>A mock {@link JwtAuthenticationFilter} is supplied because
     * {@link SecurityConfig} declares it as a required constructor argument.
     * The filter is irrelevant to CORS parsing, so a mock is sufficient.</p>
     *
     * @param rawOrigin the raw value to inject, mirroring CORS_ALLOWED_ORIGIN
     * @return the configured {@link CorsConfigurationSource}
     */
    private CorsConfigurationSource buildSourceWithOrigin(String rawOrigin) {
        JwtAuthenticationFilter mockFilter = mock(JwtAuthenticationFilter.class);
        SecurityConfig config = new SecurityConfig(mockFilter);
        ReflectionTestUtils.setField(config, "allowedOrigins", rawOrigin);
        return config.corsConfigurationSource();
    }

    /**
     * Extracts the list of allowed origins from a {@link CorsConfigurationSource}
     * by looking up the configuration registered under the wildcard path.
     *
     * @param source the source to inspect
     * @return the list of allowed origins, or an empty list if none are configured
     */
    private List<String> getAllowedOrigins(CorsConfigurationSource source) {
        UrlBasedCorsConfigurationSource urlSource = (UrlBasedCorsConfigurationSource) source;
        CorsConfiguration corsConfig = urlSource.getCorsConfigurations().get("/**");
        assertThat(corsConfig).as("CORS configuration registered under /**").isNotNull();
        List<String> origins = corsConfig.getAllowedOrigins();
        return origins != null ? origins : List.of();
    }

    /**
     * A single origin with no delimiter is returned as a one-element list.
     */
    @Test
    void singleOrigin_returnsSingleElementList() {
        CorsConfigurationSource source = buildSourceWithOrigin("https://example.com");

        List<String> origins = getAllowedOrigins(source);

        assertThat(origins).containsExactly("https://example.com");
    }

    /**
     * Two comma-separated origins are both returned, in input order.
     */
    @Test
    void twoCommaSeperatedOrigins_returnsBothOrigins() {
        CorsConfigurationSource source = buildSourceWithOrigin("https://a.com,https://b.com");

        List<String> origins = getAllowedOrigins(source);

        assertThat(origins).containsExactly("https://a.com", "https://b.com");
    }

    /**
     * Leading and trailing whitespace around each origin is stripped so that
     * an origin string with spaces still matches requests correctly.
     */
    @Test
    void originsWithWhitespace_areTrimed() {
        CorsConfigurationSource source = buildSourceWithOrigin(" https://a.com , https://b.com ");

        List<String> origins = getAllowedOrigins(source);

        assertThat(origins).containsExactly("https://a.com", "https://b.com");
    }

    /**
     * Empty tokens produced by adjacent or trailing commas are discarded,
     * so the resulting list contains only non-blank origins.
     */
    @Test
    void emptyTokensBetweenCommas_areFiltered() {
        CorsConfigurationSource source = buildSourceWithOrigin("https://a.com,,https://b.com");

        List<String> origins = getAllowedOrigins(source);

        assertThat(origins).containsExactly("https://a.com", "https://b.com");
    }
}
