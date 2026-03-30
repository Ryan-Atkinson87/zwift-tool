/** Request body for the sign-up endpoint. */
export interface SignUpRequest {
    email: string
    password: string
    displayName?: string
}

/** Response body returned by auth endpoints (signup, signin, refresh). */
export interface AuthResponse {
    userId: string
    email: string
    displayName: string | null
}

/** Client-side auth state, tracked by the useAuth hook. */
export interface AuthState {
    isAuthenticated: boolean
    user: AuthResponse | null
    isLoading: boolean
}