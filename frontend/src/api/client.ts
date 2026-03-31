import { refresh } from './auth.ts'

/**
 * Callback invoked when a silent token refresh fails, meaning the
 * user's session has expired and they need to sign in again.
 */
type SessionExpiredHandler = () => void

let onSessionExpired: SessionExpiredHandler | null = null
let refreshPromise: Promise<void> | null = null

/**
 * Registers a callback to be invoked when a silent refresh attempt fails.
 * The useAuth hook calls this on mount so that session expiry triggers
 * the sign-in modal rather than an unhandled error.
 *
 * @param handler the callback to run when the session expires
 */
export function registerSessionExpiredHandler(handler: SessionExpiredHandler): void {
    onSessionExpired = handler
}

/**
 * Attempts a single silent token refresh. Deduplicates concurrent calls
 * so that only one refresh request is in flight at a time. Concurrent
 * callers share the same promise.
 *
 * @returns true if the refresh succeeded, false if it failed
 */
async function attemptRefresh(): Promise<boolean> {
    if (refreshPromise) {
        try {
            await refreshPromise
            return true
        } catch {
            return false
        }
    }

    refreshPromise = refresh().then(() => undefined)

    try {
        await refreshPromise
        return true
    } catch {
        return false
    } finally {
        refreshPromise = null
    }
}

/**
 * Authenticated fetch wrapper that silently refreshes the access token
 * on 401 responses and retries the original request once.
 *
 * All API calls to protected endpoints should use this function instead
 * of calling fetch directly. It handles:
 * - Adding credentials: 'include' for HttpOnly cookie auth
 * - Detecting 401 (expired access token) and attempting a silent refresh
 * - Retrying the original request after a successful refresh
 * - Calling the session-expired handler if the refresh fails
 *
 * @param url the request URL
 * @param options fetch options (credentials: 'include' is added automatically)
 * @returns the fetch Response
 * @throws Error if the request fails for a non-401 reason
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    const mergedOptions: RequestInit = { ...options, credentials: 'include' }

    const response = await fetch(url, mergedOptions)

    if (response.status !== 401) {
        return response
    }

    // 401 received: attempt a silent token refresh
    const refreshed = await attemptRefresh()

    if (!refreshed) {
        if (onSessionExpired) {
            onSessionExpired()
        }
        return response
    }

    // Refresh succeeded: retry the original request once
    return fetch(url, mergedOptions)
}