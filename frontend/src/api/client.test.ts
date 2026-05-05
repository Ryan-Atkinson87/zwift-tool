import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchWithAuth, registerSessionExpiredHandler } from './client.ts'

/**
 * Unit tests for the fetchWithAuth helper in client.ts.
 *
 * These tests verify that the 401 and 403 interceptor correctly attempts a
 * silent token refresh and retries the original request, and that it invokes
 * the session-expired handler when the refresh itself fails.
 */

const mockFetch = vi.fn()

beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
    vi.restoreAllMocks()
    mockFetch.mockReset()
})

function makeResponse(status: number, body: unknown = {}): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

describe('fetchWithAuth', () => {
    describe('when the response is successful', () => {
        it('returns the response without attempting a refresh', async () => {
            mockFetch.mockResolvedValueOnce(makeResponse(200, { id: '1' }))

            const result = await fetchWithAuth('/workouts')

            expect(result.status).toBe(200)
            expect(mockFetch).toHaveBeenCalledTimes(1)
        })

        it('always passes credentials: include', async () => {
            mockFetch.mockResolvedValueOnce(makeResponse(200))

            await fetchWithAuth('/workouts', { method: 'GET' })

            expect(mockFetch).toHaveBeenCalledWith(
                '/workouts',
                expect.objectContaining({ credentials: 'include' }),
            )
        })
    })

    describe('when the response is 401', () => {
        it('attempts a refresh and retries the original request', async () => {
            // First call: the protected endpoint returns 401
            mockFetch.mockResolvedValueOnce(makeResponse(401))
            // Second call: the refresh endpoint succeeds
            mockFetch.mockResolvedValueOnce(makeResponse(200, { accessToken: 'new-token' }))
            // Third call: the retried original request succeeds
            mockFetch.mockResolvedValueOnce(makeResponse(200, { id: '1' }))

            const result = await fetchWithAuth('/workouts')

            expect(result.status).toBe(200)
            expect(mockFetch).toHaveBeenCalledTimes(3)
        })

        it('invokes the session-expired handler and returns the 401 when refresh fails', async () => {
            const sessionExpiredHandler = vi.fn()
            registerSessionExpiredHandler(sessionExpiredHandler)

            // First call: the protected endpoint returns 401
            mockFetch.mockResolvedValueOnce(makeResponse(401))
            // Second call: the refresh endpoint also fails
            mockFetch.mockResolvedValueOnce(makeResponse(403))

            const result = await fetchWithAuth('/workouts')

            expect(result.status).toBe(401)
            expect(sessionExpiredHandler).toHaveBeenCalledTimes(1)
            // No retry of the original request after a failed refresh
            expect(mockFetch).toHaveBeenCalledTimes(2)
        })
    })

    describe('when the response is 403', () => {
        it('attempts a refresh and retries the original request', async () => {
            // First call: the protected endpoint returns 403 (expired access token)
            mockFetch.mockResolvedValueOnce(makeResponse(403))
            // Second call: the refresh endpoint succeeds
            mockFetch.mockResolvedValueOnce(makeResponse(200, { accessToken: 'new-token' }))
            // Third call: the retried original request succeeds
            mockFetch.mockResolvedValueOnce(makeResponse(200, { id: '1' }))

            const result = await fetchWithAuth('/workouts', { method: 'POST' })

            expect(result.status).toBe(200)
            expect(mockFetch).toHaveBeenCalledTimes(3)
        })

        it('retries with the same method and options', async () => {
            const body = JSON.stringify({ name: 'Test Workout' })

            mockFetch.mockResolvedValueOnce(makeResponse(403))
            mockFetch.mockResolvedValueOnce(makeResponse(200, { accessToken: 'new-token' }))
            mockFetch.mockResolvedValueOnce(makeResponse(201, { id: '42' }))

            await fetchWithAuth('/workouts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
            })

            // The third call is the retry — it should use the same options
            const retryCall = mockFetch.mock.calls[2]
            expect(retryCall[0]).toBe('/workouts')
            expect(retryCall[1]).toMatchObject({
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body,
            })
        })

        it('invokes the session-expired handler and returns the 403 when refresh fails', async () => {
            const sessionExpiredHandler = vi.fn()
            registerSessionExpiredHandler(sessionExpiredHandler)

            // First call: the protected endpoint returns 403
            mockFetch.mockResolvedValueOnce(makeResponse(403))
            // Second call: the refresh endpoint also returns 403 (refresh token expired)
            mockFetch.mockResolvedValueOnce(makeResponse(403))

            const result = await fetchWithAuth('/workouts')

            expect(result.status).toBe(403)
            expect(sessionExpiredHandler).toHaveBeenCalledTimes(1)
            // No retry after a failed refresh
            expect(mockFetch).toHaveBeenCalledTimes(2)
        })

        it('does not retry more than once', async () => {
            mockFetch.mockResolvedValueOnce(makeResponse(403))
            mockFetch.mockResolvedValueOnce(makeResponse(200, { accessToken: 'new-token' }))
            // The retried request also returns 403 — should not trigger another refresh
            mockFetch.mockResolvedValueOnce(makeResponse(403))

            const result = await fetchWithAuth('/workouts')

            // Should stop after the one retry — no third refresh attempt
            expect(result.status).toBe(403)
            expect(mockFetch).toHaveBeenCalledTimes(3)
        })
    })

    describe('when the response is a non-auth error', () => {
        it('returns the response without attempting a refresh', async () => {
            mockFetch.mockResolvedValueOnce(makeResponse(404))

            const result = await fetchWithAuth('/workouts/missing')

            expect(result.status).toBe(404)
            expect(mockFetch).toHaveBeenCalledTimes(1)
        })

        it('returns 500 responses without attempting a refresh', async () => {
            mockFetch.mockResolvedValueOnce(makeResponse(500))

            const result = await fetchWithAuth('/workouts')

            expect(result.status).toBe(500)
            expect(mockFetch).toHaveBeenCalledTimes(1)
        })
    })
})
