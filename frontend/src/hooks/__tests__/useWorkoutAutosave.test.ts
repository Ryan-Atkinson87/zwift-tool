import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useWorkoutAutosave } from '../useWorkoutAutosave'
import type { WorkoutDetail } from '../../types/workout'

vi.mock('../../api/workouts', () => ({
    updateWorkoutSection: vi.fn(),
}))

import { updateWorkoutSection } from '../../api/workouts'

const mockUpdateWorkoutSection = vi.mocked(updateWorkoutSection)

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

const SECTION_UPDATE = {
    content: '[]',
    durationSeconds: 3600,
    intervalCount: 0,
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
})

afterEach(() => {
    vi.useRealTimers()
})

describe('useWorkoutAutosave', () => {
    it('starts with an idle status', () => {
        const onSaved = vi.fn()
        const { result } = renderHook(() => useWorkoutAutosave(MOCK_WORKOUT, onSaved))
        expect(result.current.status).toBe('idle')
        expect(result.current.error).toBeNull()
    })

    it('sets status to pending when a section update is queued', () => {
        const onSaved = vi.fn()
        const { result } = renderHook(() => useWorkoutAutosave(MOCK_WORKOUT, onSaved))

        act(() => {
            result.current.queueSectionUpdate('MAINSET', SECTION_UPDATE)
        })

        expect(result.current.status).toBe('pending')
    })

    it('performs the save after the debounce window elapses', async () => {
        mockUpdateWorkoutSection.mockResolvedValue(MOCK_WORKOUT)
        const onSaved = vi.fn()
        const { result } = renderHook(() => useWorkoutAutosave(MOCK_WORKOUT, onSaved))

        act(() => {
            result.current.queueSectionUpdate('MAINSET', SECTION_UPDATE)
        })

        await act(async () => {
            vi.runAllTimers()
            await Promise.resolve()
        })

        expect(mockUpdateWorkoutSection).toHaveBeenCalledWith('workout-1', {
            sectionType: 'MAINSET',
            content: '[]',
            durationSeconds: 3600,
            intervalCount: 0,
        })
    })

    it('calls onSaved with the updated workout after a successful save', async () => {
        const updatedWorkout: WorkoutDetail = { ...MOCK_WORKOUT, name: 'Updated' }
        mockUpdateWorkoutSection.mockResolvedValue(updatedWorkout)
        const onSaved = vi.fn()
        const { result } = renderHook(() => useWorkoutAutosave(MOCK_WORKOUT, onSaved))

        act(() => {
            result.current.queueSectionUpdate('MAINSET', SECTION_UPDATE)
        })

        await act(async () => {
            vi.runAllTimers()
            await Promise.resolve()
        })

        expect(onSaved).toHaveBeenCalledWith(updatedWorkout)
    })

    it('sets status to saved after a successful save', async () => {
        mockUpdateWorkoutSection.mockResolvedValue(MOCK_WORKOUT)
        const onSaved = vi.fn()
        const { result } = renderHook(() => useWorkoutAutosave(MOCK_WORKOUT, onSaved))

        act(() => {
            result.current.queueSectionUpdate('MAINSET', SECTION_UPDATE)
        })

        await act(async () => {
            vi.runAllTimers()
            await Promise.resolve()
        })

        expect(result.current.status).toBe('saved')
    })

    it('sets status to error and stores the message when the save fails', async () => {
        mockUpdateWorkoutSection.mockRejectedValue(new Error('Failed to auto-save workout: 500'))
        const onSaved = vi.fn()
        const { result } = renderHook(() => useWorkoutAutosave(MOCK_WORKOUT, onSaved))

        act(() => {
            result.current.queueSectionUpdate('MAINSET', SECTION_UPDATE)
        })

        await act(async () => {
            vi.runAllTimers()
            await Promise.resolve()
        })

        expect(result.current.status).toBe('error')
        expect(result.current.error).toBe('Failed to auto-save workout: 500')
    })

    it('does not queue an update when no workout is loaded', () => {
        const onSaved = vi.fn()
        const { result } = renderHook(() => useWorkoutAutosave(null, onSaved))

        act(() => {
            result.current.queueSectionUpdate('MAINSET', SECTION_UPDATE)
        })

        expect(result.current.status).toBe('idle')
    })

    it('flush triggers an immediate save without waiting for the debounce window', async () => {
        mockUpdateWorkoutSection.mockResolvedValue(MOCK_WORKOUT)
        const onSaved = vi.fn()
        const { result } = renderHook(() => useWorkoutAutosave(MOCK_WORKOUT, onSaved))

        act(() => {
            result.current.queueSectionUpdate('MAINSET', SECTION_UPDATE)
        })

        // Flush without advancing timers
        await act(async () => {
            await result.current.flush()
        })

        expect(mockUpdateWorkoutSection).toHaveBeenCalledOnce()
    })

    it('coalesces rapid edits into a single save by replacing the pending update', async () => {
        mockUpdateWorkoutSection.mockResolvedValue(MOCK_WORKOUT)
        const onSaved = vi.fn()
        const { result } = renderHook(() => useWorkoutAutosave(MOCK_WORKOUT, onSaved))

        act(() => {
            result.current.queueSectionUpdate('MAINSET', { content: '["first"]', durationSeconds: 60, intervalCount: 1 })
            result.current.queueSectionUpdate('MAINSET', { content: '["second"]', durationSeconds: 120, intervalCount: 1 })
        })

        await act(async () => {
            vi.runAllTimers()
            await Promise.resolve()
        })

        // Only one save should fire, with the latest update
        expect(mockUpdateWorkoutSection).toHaveBeenCalledOnce()
        expect(mockUpdateWorkoutSection).toHaveBeenCalledWith('workout-1', expect.objectContaining({
            content: '["second"]',
        }))
    })
})
