import type { AuthResponse, SignInRequest, SignUpRequest } from '../types/auth.ts'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

/**
 * Registers a new user with email and password.
 * On success, the backend sets HttpOnly auth cookies automatically.
 *
 * @param request the sign-up details
 * @returns the created user's information
 * @throws Error with the server's error message on failure (400, 409, etc.)
 */
export async function signUp(request: SignUpRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    })

    if (!response.ok) {
        const error: { message: string } = await response.json()
        throw new Error(error.message)
    }

    return response.json()
}

/**
 * Authenticates an existing user with email and password.
 * On success, the backend sets HttpOnly auth cookies automatically.
 *
 * @param request the sign-in credentials
 * @returns the authenticated user's information
 * @throws Error with a generic error message on failure (401, etc.)
 */
export async function signIn(request: SignInRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE}/auth/signin`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    })

    if (!response.ok) {
        const error: { message: string } = await response.json()
        throw new Error(error.message)
    }

    return response.json()
}