package uk.trive.zwifttool.controllers;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Provides a simple health check endpoint used by infrastructure to verify
 * the application is running and accepting requests.
 */
@RestController
public class HealthController {

    /**
     * Returns a plain-text confirmation that the application is healthy.
     *
     * @return HTTP 200 with body "OK"
     */
    @GetMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("OK");
    }

    /**
     * Throws an unhandled exception to verify Sentry integration is capturing errors.
     * Remove this endpoint once Sentry is confirmed working.
     */
    @GetMapping("/sentry-test")
    public ResponseEntity<Void> sentryTest() {
        throw new RuntimeException("Sentry test error");
    }
}