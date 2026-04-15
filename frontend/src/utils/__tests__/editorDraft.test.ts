import { describe, it, expect } from 'vitest'
import {
    currentSectionBlock,
    applyBlockToWorkout,
    sumIntervalDuration,
    buildSectionDraft,
} from '../editorDraft'
import type { BlockDetail, ParsedInterval, WorkoutDetail } from '../../types/workout'

/** Builds a minimal BlockDetail for testing. */
function makeBlock(id: string, sectionType: BlockDetail['sectionType']): BlockDetail {
    return {
        id,
        name: sectionType,
        description: null,
        sectionType,
        intervals: [],
        durationSeconds: 0,
        intervalCount: 0,
        isLibraryBlock: false,
    }
}

/** Builds a minimal WorkoutDetail with a required mainset block. */
function makeWorkout(overrides: Partial<WorkoutDetail> = {}): WorkoutDetail {
    return {
        id: 'workout-1',
        name: 'Test Workout',
        author: null,
        description: null,
        warmupBlock: null,
        mainsetBlock: makeBlock('block-mainset', 'MAINSET'),
        cooldownBlock: null,
        hasPrevWarmup: false,
        hasPrevMainset: false,
        hasPrevCooldown: false,
        isDraft: false,
        textEvents: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        ...overrides,
    }
}

/** Builds a minimal ParsedInterval. */
function makeInterval(durationSeconds: number): ParsedInterval {
    return {
        type: 'SteadyState',
        durationSeconds,
        power: 0.88,
        powerHigh: null,
        cadence: null,
        repeat: null,
        onDuration: null,
        offDuration: null,
        onPower: null,
        offPower: null,
    }
}

describe('currentSectionBlock', () => {
    it('returns the warmup block when sectionType is WARMUP', () => {
        const warmup = makeBlock('block-warmup', 'WARMUP')
        const workout = makeWorkout({ warmupBlock: warmup })
        expect(currentSectionBlock(workout, 'WARMUP')).toBe(warmup)
    })

    it('returns null for WARMUP when no warmup block exists', () => {
        const workout = makeWorkout({ warmupBlock: null })
        expect(currentSectionBlock(workout, 'WARMUP')).toBeNull()
    })

    it('returns the mainset block when sectionType is MAINSET', () => {
        const workout = makeWorkout()
        expect(currentSectionBlock(workout, 'MAINSET')).toBe(workout.mainsetBlock)
    })

    it('returns the cooldown block when sectionType is COOLDOWN', () => {
        const cooldown = makeBlock('block-cooldown', 'COOLDOWN')
        const workout = makeWorkout({ cooldownBlock: cooldown })
        expect(currentSectionBlock(workout, 'COOLDOWN')).toBe(cooldown)
    })
})

describe('applyBlockToWorkout', () => {
    it('replaces the warmup block and leaves other sections unchanged', () => {
        const workout = makeWorkout()
        const newBlock = makeBlock('new-warmup', 'WARMUP')
        const result = applyBlockToWorkout(workout, 'WARMUP', newBlock)
        expect(result.warmupBlock).toBe(newBlock)
        expect(result.mainsetBlock).toBe(workout.mainsetBlock)
        expect(result.cooldownBlock).toBe(workout.cooldownBlock)
    })

    it('replaces the mainset block and leaves other sections unchanged', () => {
        const workout = makeWorkout()
        const newBlock = makeBlock('new-mainset', 'MAINSET')
        const result = applyBlockToWorkout(workout, 'MAINSET', newBlock)
        expect(result.mainsetBlock).toBe(newBlock)
        expect(result.warmupBlock).toBe(workout.warmupBlock)
    })

    it('replaces the cooldown block and leaves other sections unchanged', () => {
        const workout = makeWorkout()
        const newBlock = makeBlock('new-cooldown', 'COOLDOWN')
        const result = applyBlockToWorkout(workout, 'COOLDOWN', newBlock)
        expect(result.cooldownBlock).toBe(newBlock)
        expect(result.mainsetBlock).toBe(workout.mainsetBlock)
    })

    it('does not mutate the original workout object', () => {
        const workout = makeWorkout()
        const original = { ...workout }
        applyBlockToWorkout(workout, 'MAINSET', makeBlock('new', 'MAINSET'))
        expect(workout.mainsetBlock).toBe(original.mainsetBlock)
    })
})

describe('sumIntervalDuration', () => {
    it('returns zero for an empty interval list', () => {
        expect(sumIntervalDuration([])).toBe(0)
    })

    it('returns the duration of a single interval', () => {
        expect(sumIntervalDuration([makeInterval(600)])).toBe(600)
    })

    it('sums the durations of multiple intervals', () => {
        expect(sumIntervalDuration([makeInterval(600), makeInterval(300), makeInterval(120)])).toBe(1020)
    })

    it('rounds fractional totals to whole seconds', () => {
        const intervals: ParsedInterval[] = [
            { ...makeInterval(0), durationSeconds: 100.5 },
            { ...makeInterval(0), durationSeconds: 100.5 },
        ]
        expect(sumIntervalDuration(intervals)).toBe(201)
    })
})

describe('buildSectionDraft', () => {
    it('returns a patched workout with the new intervals applied to an existing block', () => {
        const workout = makeWorkout()
        const nextIntervals = [makeInterval(600), makeInterval(300)]
        const draft = buildSectionDraft(workout, 'MAINSET', nextIntervals)
        expect(draft.patchedWorkout.mainsetBlock.intervals).toEqual(nextIntervals)
    })

    it('preserves the block id when updating an existing block', () => {
        const workout = makeWorkout()
        const draft = buildSectionDraft(workout, 'MAINSET', [makeInterval(600)])
        expect(draft.patchedWorkout.mainsetBlock.id).toBe('block-mainset')
    })

    it('creates an optimistic placeholder block for a missing warmup section', () => {
        const workout = makeWorkout({ warmupBlock: null })
        const draft = buildSectionDraft(workout, 'WARMUP', [makeInterval(300)])
        expect(draft.patchedWorkout.warmupBlock).not.toBeNull()
        expect(draft.patchedWorkout.warmupBlock!.id).toMatch(/^optimistic-/)
    })

    it('calculates the durationSeconds from the new intervals', () => {
        const workout = makeWorkout()
        const draft = buildSectionDraft(workout, 'MAINSET', [makeInterval(600), makeInterval(300)])
        expect(draft.durationSeconds).toBe(900)
    })

    it('calculates the intervalCount from the new intervals', () => {
        const workout = makeWorkout()
        const draft = buildSectionDraft(workout, 'MAINSET', [makeInterval(600), makeInterval(300)])
        expect(draft.intervalCount).toBe(2)
    })

    it('serialises the new intervals to a JSON string in the content field', () => {
        const workout = makeWorkout()
        const intervals = [makeInterval(600)]
        const draft = buildSectionDraft(workout, 'MAINSET', intervals)
        expect(draft.content).toBe(JSON.stringify(intervals))
    })
})
