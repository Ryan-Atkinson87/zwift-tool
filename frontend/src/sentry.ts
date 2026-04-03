import * as Sentry from '@sentry/react'

/**
 * Initialises Sentry error tracking for the frontend. Only activates when
 * VITE_SENTRY_DSN is set, so local development without a DSN is silently
 * skipped.
 *
 * <p>Session replay is configured to record only on errors (not all sessions)
 * to stay within the Sentry free tier. Console messages are not captured.</p>
 */
export function initialiseSentry(): void {
    const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined

    if (!dsn) {
        return
    }

    Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        integrations: [
            Sentry.replayIntegration(),
        ],

        // Only record session replays when an error occurs, not on every session
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 1.0,

        beforeSend(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
            // Strip cookies and authorisation headers to prevent tokens leaking to Sentry
            if (event.request) {
                delete event.request.cookies
                if (event.request.headers) {
                    delete event.request.headers['Authorization']
                    delete event.request.headers['authorization']
                    delete event.request.headers['Cookie']
                    delete event.request.headers['cookie']
                }
            }
            return event
        },
    })
}