import { describe, it, expect } from 'vitest'
import { formatDuration, totalDurationSeconds, normalisedPowerBeta, calculateNormalisedPower, calculateIntensityFactor, expandBarsToWatts } from '../workoutStats'
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

describe('expandBarsToWatts', () => {
    it('expands a single bar into one watt value per second', () => {
        const bars = [makeBar(3, 100)]
        // 100% of 200W FTP = 200W for each of 3 seconds
        expect(expandBarsToWatts(bars, 200)).toEqual([200, 200, 200])
    })

    it('uses 0 watts for FreeRide bars', () => {
        const freeRide: ChartBar = { ...makeBar(2, 0), style: 'freeride' }
        expect(expandBarsToWatts([freeRide], 250)).toEqual([0, 0])
    })

    it('concatenates multiple bars in order', () => {
        const bars = [makeBar(2, 50), makeBar(2, 100)]
        // 50% of 200W = 100W, 100% of 200W = 200W
        expect(expandBarsToWatts(bars, 200)).toEqual([100, 100, 200, 200])
    })
})

describe('calculateNormalisedPower', () => {
    it('returns null for fewer than 30 samples', () => {
        const samples = Array(29).fill(200) as number[]
        expect(calculateNormalisedPower(samples)).toBeNull()
    })

    it('returns NP equal to the constant power for a steady effort', () => {
        // For constant power P, all rolling averages equal P, so NP = P
        const samples = Array(60).fill(250) as number[]
        expect(calculateNormalisedPower(samples)).toBe(250)
    })

    it('raises the rolling average to the 4th power before averaging', () => {
        // NP > time-weighted mean for variable power (due to 4th power amplification)
        // Two equal-length segments: 100W and 200W
        // Time-weighted mean = 150W
        // NP > 150W
        const samples = [...Array(30).fill(100), ...Array(30).fill(200)] as number[]
        const np = calculateNormalisedPower(samples)
        expect(np).not.toBeNull()
        expect(np!).toBeGreaterThan(150)
    })

    it('treats null values as 0 watts', () => {
        const samples = [...Array(30).fill(null), ...Array(30).fill(200)] as (number | null)[]
        const np = calculateNormalisedPower(samples as number[])
        expect(np).not.toBeNull()
    })

    it('returns a value rounded to one decimal place', () => {
        const samples = Array(60).fill(137.5) as number[]
        const np = calculateNormalisedPower(samples)
        expect(np).not.toBeNull()
        // For constant power, NP = that power rounded to 1dp
        expect(np).toBe(137.5)
    })
})

describe('calculateIntensityFactor', () => {
    it('returns NP divided by FTP, rounded to 2 decimal places', () => {
        // IF = 250 / 250 = 1.00
        expect(calculateIntensityFactor(250, 250)).toBe(1.0)
    })

    it('returns a value less than 1 for sub-threshold efforts', () => {
        // IF = 200 / 250 = 0.80
        expect(calculateIntensityFactor(200, 250)).toBe(0.8)
    })

    it('rounds to 2 decimal places', () => {
        // IF = 233 / 250 = 0.932 → 0.93
        expect(calculateIntensityFactor(233, 250)).toBe(0.93)
    })
})
