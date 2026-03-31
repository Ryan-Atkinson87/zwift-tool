import { useState } from 'react'
import { signIn as signInApi, signOut as signOutApi, signUp as signUpApi } from '../api/auth.ts'
import type { AuthResponse, AuthState, SignInRequest, SignUpRequest } from '../types/auth.ts'

/**
 * Manages authentication state for the current session.
 * Provides sign-up, sign-in, and sign-out actions that keep
 * the local auth state in sync with the backend.
 */
export function useAuth(): AuthState & {
    signUp: (request: SignUpRequest) => Promise<void>
    signIn: (request: SignInRequest) => Promise<void>
    signOut: () => Promise<void>
} {
    const [user, setUser] = useState<AuthResponse | null>(null)
    const [isLoading, setIsLoading] = useState(false)

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
    }
}