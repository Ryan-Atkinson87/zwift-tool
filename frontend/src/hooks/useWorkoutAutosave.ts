import { useCallback, useEffect, useRef, useState } from 'react'
import { updateWorkoutSection, type UpdateWorkoutSectionRequest } from '../api/workouts'
import type { SectionType, WorkoutDetail } from '../types/workout'

/** Debounce window applied to every queued auto-save. */
const AUTOSAVE_DEBOUNCE_MS = 800

/** High-level state of the auto-save loop, exposed to the editor UI. */
export type AutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

/**
 * Return shape of the {@link useWorkoutAutosave} hook.
 */
export interface UseWorkoutAutosaveResult {
    /**
     * Queues a section change to be auto-saved after the debounce window.
     * If a queued change for the same workout already exists, it is
     * replaced (debouncing coalesces a burst of edits into a single save).
     */
    queueSectionUpdate: (sectionType: SectionType, request: SectionUpdate) => void
    /** Forces any pending change to be flushed immediately. */
    flush: () => Promise<void>
    /** Current state of the auto-save loop. */
    status: AutosaveStatus
    /** Last error message, if a save failed. */
    error: string | null
}

/** A pending section update before it has been wrapped with the workout ID. */
export interface SectionUpdate {
    content: string
    durationSeconds: number
    intervalCount: number
}

/**
 * Manages the debounced auto-save loop for the workout editor. Edits to a
 * section are coalesced inside an {@link AUTOSAVE_DEBOUNCE_MS} window and
 * sent as a single {@code PUT /workouts/{id}} call. Pending edits are
 * flushed immediately when the workout switches or the hook unmounts so
 * the user does not lose work.
 *
 * <p>The hook accepts the currently selected workout and an {@code onSaved}
 * callback that receives the updated detail returned by the backend. The
 * caller is responsible for swapping the new detail into local state so the
 * canvas re-renders with the rotated undo flags.</p>
 *
 * @param workout the currently loaded workout, or null when none is selected
 * @param onSaved callback fired with the latest server response after a save
 */
export function useWorkoutAutosave(
    workout: WorkoutDetail | null,
    onSaved: (workout: WorkoutDetail) => void,
): UseWorkoutAutosaveResult {
    const [status, setStatus] = useState<AutosaveStatus>('idle')
    const [error, setError] = useState<string | null>(null)

    // Pending state lives in refs so the debounce timer can read the latest
    // queued payload at fire time without re-creating the timer on every
    // edit. Storing the workout ID alongside the payload guards against
    // flushing a stale edit into a different workout after a switch.
    const pendingRef = useRef<{
        workoutId: string
        sectionType: SectionType
        update: SectionUpdate
    } | null>(null)
    const timerRef = useRef<number | null>(null)
    const onSavedRef = useRef(onSaved)

    useEffect(() => {
        onSavedRef.current = onSaved
    }, [onSaved])

    const performSave = useCallback(async (): Promise<void> => {
        const pending = pendingRef.current
        if (pending === null) {
            return
        }

        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current)
            timerRef.current = null
        }

        setStatus('saving')
        setError(null)

        try {
            const request: UpdateWorkoutSectionRequest = {
                sectionType: pending.sectionType,
                content: pending.update.content,
                durationSeconds: pending.update.durationSeconds,
                intervalCount: pending.update.intervalCount,
            }
            const updated = await updateWorkoutSection(pending.workoutId, request)
            onSavedRef.current(updated)

            // If a fresh edit arrived during the request, queueSectionUpdate
            // will have replaced pendingRef.current with a new object and
            // re-armed the timer; leave that next cycle alone. Only clear
            // the queue when the in-flight save was the latest one.
            if (pendingRef.current === pending) {
                pendingRef.current = null
                setStatus('saved')
            } else {
                setStatus('pending')
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to auto-save workout.'
            setError(message)
            setStatus('error')
        }
    }, [])

    const queueSectionUpdate = useCallback(
        (sectionType: SectionType, update: SectionUpdate): void => {
            if (workout === null) {
                return
            }

            pendingRef.current = {
                workoutId: workout.id,
                sectionType,
                update,
            }
            setStatus('pending')
            setError(null)

            if (timerRef.current !== null) {
                window.clearTimeout(timerRef.current)
            }
            timerRef.current = window.setTimeout(() => {
                void performSave()
            }, AUTOSAVE_DEBOUNCE_MS)
        },
        [workout, performSave],
    )

    const flush = useCallback(async (): Promise<void> => {
        await performSave()
    }, [performSave])

    // Flush any pending edit when the active workout changes or the hook
    // unmounts, so a quick switch never silently drops the user's work
    useEffect(() => {
        return () => {
            if (timerRef.current !== null) {
                window.clearTimeout(timerRef.current)
                timerRef.current = null
            }
            void performSave()
        }
    }, [workout?.id, performSave])

    return { queueSectionUpdate, flush, status, error }
}
