import { useCallback, useEffect, useState } from 'react'
import { fetchWorkouts } from '../api/workouts'
import type { WorkoutSummary } from '../types/workout'

/**
 * Return shape of the {@link useWorkouts} hook.
 */
export interface UseWorkoutsResult {
    workouts: WorkoutSummary[]
    isLoading: boolean
    error: string | null
    reload: () => Promise<void>
}

/**
 * Manages the list of saved workouts for the authenticated user.
 *
 * <p>Fetches on mount and exposes a {@code reload} action that other
 * parts of the UI (for example the import save flow) can call to refresh
 * the list after a mutation.</p>
 *
 * @param enabled when false, skips fetching and keeps the list empty.
 *                Pass the authenticated flag so the hook does not fire
 *                a request before the user is signed in.
 */
export function useWorkouts(enabled: boolean): UseWorkoutsResult {
    const [workouts, setWorkouts] = useState<WorkoutSummary[]>([])
    const [isLoading, setIsLoading] = useState<boolean>(enabled)
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(async (): Promise<void> => {
        setIsLoading(true)
        setError(null)
        try {
            const result = await fetchWorkouts()
            setWorkouts(result)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load workouts.')
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!enabled) {
            setWorkouts([])
            setIsLoading(false)
            return
        }
        void load()
    }, [enabled, load])

    return { workouts, isLoading, error, reload: load }
}
