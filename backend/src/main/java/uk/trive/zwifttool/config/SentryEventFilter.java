package uk.trive.zwifttool.config;

import org.springframework.stereotype.Component;

import io.sentry.EventProcessor;
import io.sentry.Hint;
import io.sentry.SentryEvent;
import io.sentry.protocol.Mechanism;
import lombok.extern.slf4j.Slf4j;

/**
 * Filters Sentry events to prevent 4xx client errors from being captured.
 * Only 5xx server errors and unhandled exceptions are sent to Sentry,
 * keeping the free tier quota for genuine backend failures.
 */
@Slf4j
@Component
public class SentryEventFilter implements EventProcessor {

    /**
     * Inspects each Sentry event before it is sent. Drops events that
     * originate from handled exceptions (4xx responses) and only allows
     * unhandled exceptions (5xx responses) through.
     *
     * @param event the Sentry event to inspect
     * @param hint  additional context about the event
     * @return the event if it should be sent, or null to drop it
     */
    @Override
    public SentryEvent process(SentryEvent event, Hint hint) {
        if (event.getExceptions() == null || event.getExceptions().isEmpty()) {
            return event;
        }

        for (var exceptionEntry : event.getExceptions()) {
            Mechanism mechanism = exceptionEntry.getMechanism();
            if (mechanism != null && Boolean.FALSE.equals(mechanism.isHandled())) {
                // Unhandled exception, always capture
                return event;
            }
        }

        // All exceptions are handled (4xx responses caught by GlobalExceptionHandler), drop
        log.debug("Dropping handled Sentry event: {}", event.getEventId());
        return null;
    }
}