import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useWorkout } from '../useWorkout'
import type { WorkoutDetail } from '../../types/workout'

vi.mock('../../api/workouts', () => ({
    fetchWorkoutById: vi.fn(),
}))

import { fetchWorkoutById } from '../../api/workouts'

const mockFetchWorkoutById = vi.mocked(fetchWorkoutById)

const MOCK_WORKOUT: WorkoutDetail = {
    id: 'workout-1',
    name: 'Test Workout',
    author: null,
    description: null,
    warmupBlock: null,
    mainsetBlock: {
        id: 'block-1',
        name: 'Main Set',
        description: null,
        sectionType: 'MAINSET',
        intervals: [],
        durationSeconds: 3600,
        intervalCount: 0,
        isLibraryBlock: false,
    },
    cooldownBlock: null,
    hasPrevWarmup: false,
    hasPrevMainset: false,
    hasPrevCooldown: false,
    isDraft: false,
    textEvents: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
}

beforeEach(() => {
    vi.clearAllMocks()
})

describe('useWorkout', () => {
    describe('when no workoutId is given', () => {
        it('returns null without calling the API', () => {
            const { result } = renderHook(() => useWorkout(null))
            expect(result.current.workout).toBeNull()
            expect(result.current.isLoading).toBe(false)
            expect(result.current.error).toBeNull()
            expect(mockFetchWorkoutById).not.toHaveBeenCalled()
        })
    })

    describe('when a workoutId is given', () => {
        it('fetches the workout from the API', async () => {
            mockFetchWorkoutById.mockResolvedValue(MOCK_WORKOUT)
            const { result } = renderHook(() => useWorkout('workout-1'))

            await waitFor(() => { expect(result.current.isLoading).toBe(false) })
            expect(mockFetchWorkoutById).toHaveBeenCalledWith('workout-1')
        })

        it('returns the fetched workout on success', async () => {
            mockFetchWorkoutById.mockResolvedValue(MOCK_WORKOUT)
            const { result } = renderHook(() => useWorkout('workout-1'))

            await waitFor(() => { expect(result.current.isLoading).toBe(false) })
            expect(result.current.workout).toEqual(MOCK_WORKOUT)
            expect(result.current.error).toBeNull()
        })

        it('starts in a loading state while the request is in flight', () => {
            mockFetchWorkoutById.mockResolvedValue(MOCK_WORKOUT)
            const { result } = renderHook(() => useWorkout('workout-1'))
            // Immediately after mount the workout is not yet synced
            expect(result.current.isLoading).toBe(true)
            expect(result.current.workout).toBeNull()
        })

        it('stores the error message when the fetch fails', async () => {
            mockFetchWorkoutById.mockRejectedValue(new Error('Failed to load workout: 404'))
            const { result } = renderHook(() => useWorkout('workout-1'))

            await waitFor(() => { expect(result.current.isLoading).toBe(false) })
            expect(result.current.error).toBe('Failed to load workout: 404')
            expect(result.current.workout).toBeNull()
        })

        it('uses a generic error message for non-Error rejections', async () => {
            mockFetchWorkoutById.mockRejectedValue('oops')
            const { result } = renderHook(() => useWorkout('workout-1'))

            await waitFor(() => { expect(result.current.isLoading).toBe(false) })
            expect(result.current.error).toBe('Failed to load workout.')
        })
    })

    describe('applyUpdate', () => {
        it('replaces the cached workout when the IDs match', async () => {
            mockFetchWorkoutById.mockResolvedValue(MOCK_WORKOUT)
            const { result } = renderHook(() => useWorkout('workout-1'))
            await waitFor(() => { expect(result.current.isLoading).toBe(false) })

            const updatedWorkout: WorkoutDetail = { ...MOCK_WORKOUT, name: 'Updated Name' }
            act(() => {
                result.current.applyUpdate(updatedWorkout)
            })

            expect(result.current.workout!.name).toBe('Updated Name')
        })

        it('ignores the update when the ID does not match the current workout', async () => {
            mockFetchWorkoutById.mockResolvedValue(MOCK_WORKOUT)
            const { result } = renderHook(() => useWorkout('workout-1'))
            await waitFor(() => { expect(result.current.isLoading).toBe(false) })

            const staleDifferentWorkout: WorkoutDetail = { ...MOCK_WORKOUT, id: 'workout-999', name: 'Stale' }
            act(() => {
                result.current.applyUpdate(staleDifferentWorkout)
            })

            expect(result.current.workout!.name).toBe('Test Workout')
        })
    })
})
