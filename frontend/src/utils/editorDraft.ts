/**
 * Helpers for the editor's optimistic-update flow. The editor mutates a
 * section's interval list locally, patches the cached workout detail so
 * the canvas re-renders immediately, and queues an auto-save with the
 * resulting content. Reading the next edit's starting state from the
 * patched workout is what allows rapid bursts of edits to accumulate
 * correctly across the auto-save debounce window.
 */

import type {
    BlockDetail,
    ParsedInterval,
    SectionType,
    WorkoutDetail,
} from '../types/workout'

/** Returns the current block for a section, or null when absent. */
export function currentSectionBlock(
    workout: WorkoutDetail,
    sectionType: SectionType,
): BlockDetail | null {
    switch (sectionType) {
        case 'WARMUP':
            return workout.warmupBlock
        case 'MAINSET':
            return workout.mainsetBlock
        case 'COOLDOWN':
            return workout.cooldownBlock
    }
}

/** Returns a copy of the workout with the given block swapped into the section slot. */
export function applyBlockToWorkout(
    workout: WorkoutDetail,
    sectionType: SectionType,
    block: BlockDetail,
): WorkoutDetail {
    switch (sectionType) {
        case 'WARMUP':
            return { ...workout, warmupBlock: block }
        case 'MAINSET':
            return { ...workout, mainsetBlock: block }
        case 'COOLDOWN':
            return { ...workout, cooldownBlock: block }
    }
}

/** Total duration in whole seconds for a list of intervals. */
export function sumIntervalDuration(intervals: ParsedInterval[]): number {
    return Math.round(intervals.reduce((acc, i) => acc + i.durationSeconds, 0))
}

/**
 * Result of applying a new interval list to a section. Carries both the
 * patched workout (for the optimistic UI update) and the autosave payload
 * (for {@code queueSectionUpdate}).
 */
export interface SectionDraft {
    patchedWorkout: WorkoutDetail
    content: string
    durationSeconds: number
    intervalCount: number
}

/**
 * Builds a {@link SectionDraft} from a workout, target section, and the
 * new interval list to apply. When the section has no block yet (warm-up
 * or cool-down), an optimistic placeholder block is synthesised; the
 * backend assigns the real ID on the next save and the response replaces
 * the placeholder.
 *
 * @param workout      the currently loaded workout
 * @param sectionType  the section to apply the new intervals to
 * @param nextIntervals the full new interval list for the section
 */
export function buildSectionDraft(
    workout: WorkoutDetail,
    sectionType: SectionType,
    nextIntervals: ParsedInterval[],
): SectionDraft {
    const currentBlock = currentSectionBlock(workout, sectionType)
    const durationSeconds = sumIntervalDuration(nextIntervals)
    const intervalCount = nextIntervals.length

    const patchedBlock: BlockDetail = currentBlock !== null
        ? {
            ...currentBlock,
            intervals: nextIntervals,
            durationSeconds,
            intervalCount,
        }
        : {
            id: `optimistic-${sectionType.toLowerCase()}`,
            name: sectionType,
            description: null,
            sectionType,
            intervals: nextIntervals,
            durationSeconds,
            intervalCount,
            isLibraryBlock: false,
        }

    return {
        patchedWorkout: applyBlockToWorkout(workout, sectionType, patchedBlock),
        content: JSON.stringify(nextIntervals),
        durationSeconds,
        intervalCount,
    }
}
