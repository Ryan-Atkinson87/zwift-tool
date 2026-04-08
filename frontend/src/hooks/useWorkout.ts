import { useCallback, useEffect, useState } from 'react'
import { fetchWorkoutById } from '../api/workouts'
import type { WorkoutDetail } from '../types/workout'

/**
 * Return shape of the {@link useWorkout} hook.
 */
export interface UseWorkoutResult {
    workout: WorkoutDetail | null
    isLoading: boolean
    error: string | null
    /**
     * Replaces the cached workout detail with a fresh copy returned by an
     * auto-save or undo response, so the canvas can re-render without a
     * full re-fetch. The replacement is ignored if its ID does not match
     * the currently loaded workout.
     */
    applyUpdate: (updated: WorkoutDetail) => void
}

/**
 * Internal state keyed to the ID that produced it, so the hook can
 * derive the correct loading flag when the requested ID changes before
 * the fetch resolves.
 */
interface FetchState {
    id: string | null
    workout: WorkoutDetail | null
    error: string | null
}

const INITIAL_STATE: FetchState = { id: null, workout: null, error: null }

/**
 * Loads the full detail for a single workout when the given ID changes.
 *
 * <p>Returns a null workout and isLoading=false when no ID is provided.
 * When the ID changes before an in-flight request resolves, the older
 * response is discarded so a stale result cannot overwrite a newer one.</p>
 *
 * @param workoutId the ID of the workout to load, or null to clear state
 */
export function useWorkout(workoutId: string | null): UseWorkoutResult {
    const [state, setState] = useState<FetchState>(INITIAL_STATE)

    useEffect(() => {
        if (workoutId === null) {
            return
        }

        // Track the active request so a faster later response cannot
        // overwrite an earlier one when the user switches workouts quickly
        let cancelled = false

        fetchWorkoutById(workoutId)
            .then((result) => {
                if (cancelled) return
                setState({ id: workoutId, workout: result, error: null })
            })
            .catch((err: unknown) => {
                if (cancelled) return
                const message = err instanceof Error ? err.message : 'Failed to load workout.'
                setState({ id: workoutId, workout: null, error: message })
            })

        return () => {
            cancelled = true
        }
    }, [workoutId])

    const applyUpdate = useCallback((updated: WorkoutDetail): void => {
        setState((prev) => {
            if (prev.id !== updated.id) {
                return prev
            }
            return { id: updated.id, workout: updated, error: null }
        })
    }, [])

    if (workoutId === null) {
        return { workout: null, isLoading: false, error: null, applyUpdate }
    }

    const isSynced = state.id === workoutId
    return {
        workout: isSynced ? state.workout : null,
        isLoading: !isSynced,
        error: isSynced ? state.error : null,
        applyUpdate,
    }
}
