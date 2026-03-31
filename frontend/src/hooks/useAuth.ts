import { useState } from 'react'
import { signIn as signInApi, signUp as signUpApi } from '../api/auth.ts'
import type { AuthResponse, AuthState, SignInRequest, SignUpRequest } from '../types/auth.ts'

/**
 * Manages authentication state for the current session.
 * Provides sign-up, sign-in, and sign-out actions that keep
 * the local auth state in sync with the backend.
 */
export function useAuth(): AuthState & {
    signUp: (request: SignUpRequest) => Promise<void>
    signIn: (request: SignInRequest) => Promise<void>
    signOut: () => void
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

    function signOut(): void {
        setUser(null)
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