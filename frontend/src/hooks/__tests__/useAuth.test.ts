import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAuth } from '../useAuth'
import type { AuthResponse } from '../../types/auth'

// Mock the auth API module
vi.mock('../../api/auth', () => ({
    refresh: vi.fn(),
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
}))

// Mock the client module to prevent real session expiry registration
vi.mock('../../api/client', () => ({
    registerSessionExpiredHandler: vi.fn(),
}))

import { refresh, signIn, signUp, signOut } from '../../api/auth'

const mockRefresh = vi.mocked(refresh)
const mockSignIn = vi.mocked(signIn)
const mockSignUp = vi.mocked(signUp)
const mockSignOut = vi.mocked(signOut)

const MOCK_USER: AuthResponse = {
    userId: 'user-1',
    email: 'test@example.com',
    displayName: 'Test User',
}

beforeEach(() => {
    vi.clearAllMocks()
})

describe('useAuth', () => {
    describe('initial session restore', () => {
        it('attempts to restore the session by calling the refresh endpoint on mount', async () => {
            mockRefresh.mockResolvedValue(MOCK_USER)
            const { result } = renderHook(() => useAuth())

            await waitFor(() => { expect(result.current.isLoading).toBe(false) })
            expect(mockRefresh).toHaveBeenCalledOnce()
        })

        it('marks the user as authenticated when the refresh succeeds', async () => {
            mockRefresh.mockResolvedValue(MOCK_USER)
            const { result } = renderHook(() => useAuth())

            await waitFor(() => { expect(result.current.isLoading).toBe(false) })
            expect(result.current.isAuthenticated).toBe(true)
            expect(result.current.user).toEqual(MOCK_USER)
        })

        it('remains unauthenticated when the refresh fails (no stored session)', async () => {
            mockRefresh.mockRejectedValue(new Error('No session'))
            const { result } = renderHook(() => useAuth())

            await waitFor(() => { expect(result.current.isLoading).toBe(false) })
            expect(result.current.isAuthenticated).toBe(false)
            expect(result.current.user).toBeNull()
        })

        it('starts in a loading state before the refresh resolves', async () => {
            mockRefresh.mockResolvedValue(MOCK_USER)
            const { result } = renderHook(() => useAuth())
            expect(result.current.isLoading).toBe(true)
            // Drain pending async effects to avoid act() warnings
            await waitFor(() => expect(result.current.isLoading).toBe(false))
        })
    })

    describe('signIn', () => {
        it('calls the signIn API with the provided credentials', async () => {
            mockRefresh.mockRejectedValue(new Error('No session'))
            mockSignIn.mockResolvedValue(MOCK_USER)

            const { result } = renderHook(() => useAuth())
            await waitFor(() => { expect(result.current.isLoading).toBe(false) })

            await act(async () => {
                await result.current.signIn({ email: 'test@example.com', password: 'secret123' })
            })

            expect(mockSignIn).toHaveBeenCalledWith({ email: 'test@example.com', password: 'secret123' })
        })

        it('updates the auth state to authenticated after a successful sign-in', async () => {
            mockRefresh.mockRejectedValue(new Error('No session'))
            mockSignIn.mockResolvedValue(MOCK_USER)

            const { result } = renderHook(() => useAuth())
            await waitFor(() => { expect(result.current.isLoading).toBe(false) })

            await act(async () => {
                await result.current.signIn({ email: 'test@example.com', password: 'secret123' })
            })

            expect(result.current.isAuthenticated).toBe(true)
            expect(result.current.user).toEqual(MOCK_USER)
        })

        it('propagates the error when sign-in fails', async () => {
            mockRefresh.mockRejectedValue(new Error('No session'))
            mockSignIn.mockRejectedValue(new Error('Invalid credentials'))

            const { result } = renderHook(() => useAuth())
            await waitFor(() => { expect(result.current.isLoading).toBe(false) })

            await expect(
                act(async () => {
                    await result.current.signIn({ email: 'bad@example.com', password: 'wrong' })
                })
            ).rejects.toThrow('Invalid credentials')
        })
    })

    describe('signUp', () => {
        it('calls the signUp API and updates the auth state on success', async () => {
            mockRefresh.mockRejectedValue(new Error('No session'))
            mockSignUp.mockResolvedValue(MOCK_USER)

            const { result } = renderHook(() => useAuth())
            await waitFor(() => { expect(result.current.isLoading).toBe(false) })

            await act(async () => {
                await result.current.signUp({ email: 'new@example.com', password: 'password123' })
            })

            expect(mockSignUp).toHaveBeenCalledOnce()
            expect(result.current.isAuthenticated).toBe(true)
        })
    })

    describe('signOut', () => {
        it('calls the signOut API and clears the auth state', async () => {
            mockRefresh.mockResolvedValue(MOCK_USER)
            mockSignOut.mockResolvedValue(undefined)

            const { result } = renderHook(() => useAuth())
            await waitFor(() => { expect(result.current.isLoading).toBe(false) })

            await act(async () => {
                await result.current.signOut()
            })

            expect(mockSignOut).toHaveBeenCalledOnce()
            expect(result.current.isAuthenticated).toBe(false)
            expect(result.current.user).toBeNull()
        })

        it('clears the auth state even when the sign-out API call fails', async () => {
            mockRefresh.mockResolvedValue(MOCK_USER)
            mockSignOut.mockRejectedValue(new Error('Network error'))

            const { result } = renderHook(() => useAuth())
            await waitFor(() => { expect(result.current.isLoading).toBe(false) })

            await act(async () => {
                await result.current.signOut()
            })

            expect(result.current.isAuthenticated).toBe(false)
        })
    })

    describe('sessionExpired', () => {
        it('starts with sessionExpired as false', async () => {
            mockRefresh.mockRejectedValue(new Error('No session'))
            const { result } = renderHook(() => useAuth())
            await waitFor(() => { expect(result.current.isLoading).toBe(false) })
            expect(result.current.sessionExpired).toBe(false)
        })

        it('clearSessionExpired sets sessionExpired back to false', async () => {
            mockRefresh.mockRejectedValue(new Error('No session'))
            const { result } = renderHook(() => useAuth())
            await waitFor(() => { expect(result.current.isLoading).toBe(false) })

            act(() => {
                result.current.clearSessionExpired()
            })

            expect(result.current.sessionExpired).toBe(false)
        })
    })
})
