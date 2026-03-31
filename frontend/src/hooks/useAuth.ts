import { useCallback, useEffect, useState } from 'react'
import { signIn as signInApi, signOut as signOutApi, signUp as signUpApi } from '../api/auth.ts'
import { registerSessionExpiredHandler } from '../api/client.ts'
import type { AuthResponse, AuthState, SignInRequest, SignUpRequest } from '../types/auth.ts'

/**
 * Manages authentication state for the current session.
 * Provides sign-up, sign-in, and sign-out actions that keep
 * the local auth state in sync with the backend.
 *
 * Registers a session-expired handler so that when a silent token
 * refresh fails, the user state is cleared and the sign-in modal
 * can be shown without interrupting the user's workflow.
 */
export function useAuth(): AuthState & {
    signUp: (request: SignUpRequest) => Promise<void>
    signIn: (request: SignInRequest) => Promise<void>
    signOut: () => Promise<void>
    sessionExpired: boolean
    clearSessionExpired: () => void
} {
    const [user, setUser] = useState<AuthResponse | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [sessionExpired, setSessionExpired] = useState(false)

    const handleSessionExpired = useCallback((): void => {
        setUser(null)
        setSessionExpired(true)
    }, [])

    useEffect(() => {
        registerSessionExpiredHandler(handleSessionExpired)
    }, [handleSessionExpired])

    function clearSessionExpired(): void {
        setSessionExpired(false)
    }

    async function signUp(request: SignUpRequest): Promise<void> {
        setIsLoading(true)
        try {
            const response = await signUpApi(request)
            setUser(response)
        } finally {
            setIsLoading(false)
        }
    }

    async function signIn(request: SignInRequest): Promise<void> {
        setIsLoading(true)
        try {
            const response = await signInApi(request)
            setUser(response)
        } finally {
            setIsLoading(false)
        }
    }

    async function signOut(): Promise<void> {
        try {
            await signOutApi()
        } finally {
            // Clear local state regardless of whether the API call succeeded,
            // so the user is never stuck in a signed-in state
            setUser(null)
        }
    }

    return {
        isAuthenticated: user !== null,
        user,
        isLoading,
        signUp,
        signIn,
        signOut,
        sessionExpired,
        clearSessionExpired,
    }
}