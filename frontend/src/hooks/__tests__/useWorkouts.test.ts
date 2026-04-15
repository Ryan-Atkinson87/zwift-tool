import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useWorkouts } from '../useWorkouts'
import type { WorkoutSummary } from '../../types/workout'

vi.mock('../../api/workouts', () => ({
    fetchWorkouts: vi.fn(),
}))

import { fetchWorkouts } from '../../api/workouts'

const mockFetchWorkouts = vi.mocked(fetchWorkouts)

const MOCK_WORKOUTS: WorkoutSummary[] = [
    {
        id: 'w-1',
        name: 'Endurance Ride',
        author: null,
        description: null,
        durationSeconds: 3600,
        isDraft: false,
        updatedAt: '2024-01-01T00:00:00Z',
    },
    {
        id: 'w-2',
        name: 'Threshold Intervals',
        author: 'Coach Smith',
        description: 'Hard session',
        durationSeconds: 5400,
        isDraft: true,
        updatedAt: '2024-01-02T00:00:00Z',
    },
]

beforeEach(() => {
    vi.clearAllMocks()
})

describe('useWorkouts', () => {
    describe('when enabled', () => {
        it('fetches workouts from the API on mount', async () => {
            mockFetchWorkouts.mockResolvedValue(MOCK_WORKOUTS)
            const { result } = renderHook(() => useWorkouts(true))

            await waitFor(() => { expect(result.current.isLoading).toBe(false) })
            expect(mockFetchWorkouts).toHaveBeenCalledOnce()
        })

        it('populates the workouts list on successful fetch', async () => {
            mockFetchWorkouts.mockResolvedValue(MOCK_WORKOUTS)
            const { result } = renderHook(() => useWorkouts(true))

            await waitFor(() => { expect(result.current.isLoading).toBe(false) })
            expect(result.current.workouts).toEqual(MOCK_WORKOUTS)
            expect(result.current.error).toBeNull()
        })

        it('starts in a loading state', async () => {
            mockFetchWorkouts.mockResolvedValue(MOCK_WORKOUTS)
            const { result } = renderHook(() => useWorkouts(true))
            expect(result.current.isLoading).toBe(true)
            // Drain pending async effects to avoid act() warnings
            await waitFor(() => expect(result.current.isLoading).toBe(false))
        })

        it('stores the error message when the fetch fails', async () => {
            mockFetchWorkouts.mockRejectedValue(new Error('Failed to load workouts: 500'))
            const { result } = renderHook(() => useWorkouts(true))

            await waitFor(() => { expect(result.current.isLoading).toBe(false) })
            expect(result.current.error).toBe('Failed to load workouts: 500')
            expect(result.current.workouts).toEqual([])
        })

        it('uses a generic error message when the error is not an Error instance', async () => {
            mockFetchWorkouts.mockRejectedValue('unknown error')
            const { result } = renderHook(() => useWorkouts(true))

            await waitFor(() => { expect(result.current.isLoading).toBe(false) })
            expect(result.current.error).toBe('Failed to load workouts.')
        })
    })

    describe('when disabled', () => {
        it('does not call the API when enabled is false', async () => {
            const { result } = renderHook(() => useWorkouts(false))
            await waitFor(() => { expect(result.current.isLoading).toBe(false) })
            expect(mockFetchWorkouts).not.toHaveBeenCalled()
        })

        it('returns an empty list and no error when disabled', async () => {
            const { result } = renderHook(() => useWorkouts(false))
            await waitFor(() => { expect(result.current.isLoading).toBe(false) })
            expect(result.current.workouts).toEqual([])
            expect(result.current.error).toBeNull()
        })
    })

    describe('reload', () => {
        it('re-fetches from the API when reload is called', async () => {
            mockFetchWorkouts.mockResolvedValue(MOCK_WORKOUTS)
            const { result } = renderHook(() => useWorkouts(true))
            await waitFor(() => { expect(result.current.isLoading).toBe(false) })

            mockFetchWorkouts.mockResolvedValue([MOCK_WORKOUTS[0]])
            await act(async () => {
                await result.current.reload()
            })

            expect(mockFetchWorkouts).toHaveBeenCalledTimes(2)
            expect(result.current.workouts).toEqual([MOCK_WORKOUTS[0]])
        })

        it('clears a previous error on reload', async () => {
            mockFetchWorkouts.mockRejectedValue(new Error('Network error'))
            const { result } = renderHook(() => useWorkouts(true))
            await waitFor(() => { expect(result.current.isLoading).toBe(false) })
            expect(result.current.error).not.toBeNull()

            mockFetchWorkouts.mockResolvedValue([])
            await act(async () => {
                await result.current.reload()
            })

            expect(result.current.error).toBeNull()
        })
    })
})
