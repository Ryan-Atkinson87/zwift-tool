import { fetchWithAuth } from './client'
import type { WorkoutSummary } from '../types/workout'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

/** Request body for saving a workout from the import flow. */
export interface SaveWorkoutRequest {
    name: string
    author: string | null
    description: string | null
    warmupContent: string | null
    mainsetContent: string
    cooldownContent: string | null
    warmupDurationSeconds: number | null
    mainsetDurationSeconds: number
    cooldownDurationSeconds: number | null
    warmupIntervalCount: number | null
    mainsetIntervalCount: number
    cooldownIntervalCount: number | null
}

/** Response body from the workout save endpoint. */
export interface SaveWorkoutResponse {
    id: string
    name: string
    author: string | null
    description: string | null
    warmupBlockId: string | null
    mainsetBlockId: string
    cooldownBlockId: string | null
    isDraft: boolean
    createdAt: string
    updatedAt: string
}

/**
 * Saves a new workout from the import flow. Sends the structured workout
 * with section content to the backend.
 *
 * @param request the workout data with section splits applied
 * @returns the saved workout record
 * @throws Error if the request fails
 */
/**
 * Fetches all saved workouts for the authenticated user as a summary list,
 * ordered by most recently updated first.
 *
 * @returns the workout summary list, empty if the user has no saved workouts
 * @throws Error if the request fails
 */
export async function fetchWorkouts(): Promise<WorkoutSummary[]> {
    const response = await fetchWithAuth(`${API_BASE}/workouts`, {
        method: 'GET',
    })

    if (!response.ok) {
        throw new Error(`Failed to load workouts: ${response.status}`)
    }

    return response.json()
}

export async function saveWorkout(request: SaveWorkoutRequest): Promise<SaveWorkoutResponse> {
    const response = await fetchWithAuth(`${API_BASE}/workouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    })

    if (!response.ok) {
        const error: { message: string } = await response.json()
        throw new Error(error.message)
    }

    return response.json()
}
