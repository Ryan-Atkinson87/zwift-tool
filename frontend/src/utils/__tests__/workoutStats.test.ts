import { describe, it, expect } from 'vitest'
import { formatDuration, totalDurationSeconds, normalisedPowerBeta } from '../workoutStats'
import type { ChartBar } from '../intervalExpander'

/** Builds a minimal ChartBar for testing stats functions. */
function makeBar(durationSeconds: number, powerPercent: number): ChartBar {
    return {
        durationSeconds,
        powerPercent,
        style: 'flat',
        startPowerPercent: null,
        endPowerPercent: null,
        groupId: null,
        sourceIntervalIndex: null,
    }
}

describe('formatDuration', () => {
    it('formats zero seconds as 0:00', () => {
        expect(formatDuration(0)).toBe('0:00')
    })

    it('clamps negative values to 0:00', () => {
        expect(formatDuration(-60)).toBe('0:00')
        expect(formatDuration(-3600)).toBe('0:00')
    })

    it('formats seconds within the first minute correctly', () => {
        expect(formatDuration(30)).toBe('0:00')
    })

    it('formats exactly one minute as 0:01', () => {
        expect(formatDuration(60)).toBe('0:01')
    })

    it('formats one hour as 1:00', () => {
        expect(formatDuration(3600)).toBe('1:00')
    })

    it('formats one hour and thirty minutes as 1:30', () => {
        expect(formatDuration(5400)).toBe('1:30')
    })

    it('pads minutes with a leading zero for values below ten', () => {
        expect(formatDuration(3660)).toBe('1:01')
    })

    it('floors sub-minute seconds when computing minutes', () => {
        // 90 seconds = 1 minute, 30 seconds — displayed as 0:01 (whole minutes only)
        expect(formatDuration(90)).toBe('0:01')
    })
})

describe('totalDurationSeconds', () => {
    it('returns zero for an empty bar list', () => {
        expect(totalDurationSeconds([])).toBe(0)
    })

    it('sums the duration of a single bar', () => {
        expect(totalDurationSeconds([makeBar(600, 88)])).toBe(600)
    })

    it('sums the durations of multiple bars', () => {
        const bars = [makeBar(600, 50), makeBar(1200, 88), makeBar(300, 65)]
        expect(totalDurationSeconds(bars)).toBe(2100)
    })
})

describe('normalisedPowerBeta', () => {
    it('returns zero for an empty bar list', () => {
        expect(normalisedPowerBeta([])).toBe(0)
    })

    it('returns the power of a single bar', () => {
        expect(normalisedPowerBeta([makeBar(600, 88)])).toBe(88)
    })

    it('returns a time-weighted average of bar powers', () => {
        // Two bars of equal duration at 50% and 100% should average to 75%
        const bars = [makeBar(600, 50), makeBar(600, 100)]
        expect(normalisedPowerBeta(bars)).toBe(75)
    })

    it('weights heavier bars more than lighter bars', () => {
        // One long bar at 50% and one short bar at 100%
        // weighted = (50 * 600 + 100 * 300) / 900 = (30000 + 30000) / 900 = 66.67 → rounds to 67
        const bars = [makeBar(600, 50), makeBar(300, 100)]
        expect(normalisedPowerBeta(bars)).toBe(67)
    })

    it('rounds the result to the nearest integer', () => {
        // Weighted average: (83 * 1 + 98 * 2) / 3 = 279/3 = 93
        const bars = [makeBar(60, 83), makeBar(120, 98)]
        expect(normalisedPowerBeta(bars)).toBe(93)
    })
})
