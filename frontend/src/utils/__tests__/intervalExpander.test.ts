import { describe, it, expect } from 'vitest'
import { expandIntervalsToBars } from '../intervalExpander'
import type { ParsedInterval } from '../../types/workout'

/** Builds a minimal SteadyState interval. */
function steadyState(durationSeconds: number, power: number): ParsedInterval {
    return {
        type: 'SteadyState',
        durationSeconds,
        power,
        powerHigh: null,
        cadence: null,
        repeat: null,
        onDuration: null,
        offDuration: null,
        onPower: null,
        offPower: null,
    }
}

/** Builds a minimal Warmup ramp interval. */
function warmup(durationSeconds: number, powerLow: number, powerHigh: number): ParsedInterval {
    return {
        type: 'Warmup',
        durationSeconds,
        power: powerLow,
        powerHigh,
        cadence: null,
        repeat: null,
        onDuration: null,
        offDuration: null,
        onPower: null,
        offPower: null,
    }
}

/** Builds a minimal Cooldown ramp interval. */
function cooldown(durationSeconds: number, powerHigh: number, powerLow: number): ParsedInterval {
    return {
        type: 'Cooldown',
        durationSeconds,
        power: powerHigh,
        powerHigh: powerLow,
        cadence: null,
        repeat: null,
        onDuration: null,
        offDuration: null,
        onPower: null,
        offPower: null,
    }
}

/** Builds a minimal FreeRide interval. */
function freeRide(durationSeconds: number): ParsedInterval {
    return {
        type: 'FreeRide',
        durationSeconds,
        power: null,
        powerHigh: null,
        cadence: null,
        repeat: null,
        onDuration: null,
        offDuration: null,
        onPower: null,
        offPower: null,
    }
}

/** Builds a minimal IntervalsT interval. */
function intervalsT(repeat: number, onDuration: number, offDuration: number, onPower: number, offPower: number): ParsedInterval {
    return {
        type: 'IntervalsT',
        durationSeconds: repeat * (onDuration + offDuration),
        power: null,
        powerHigh: null,
        cadence: null,
        repeat,
        onDuration,
        offDuration,
        onPower,
        offPower,
    }
}

describe('expandIntervalsToBars', () => {
    it('returns an empty list for an empty interval list', () => {
        expect(expandIntervalsToBars([], 'prefix')).toEqual([])
    })

    it('converts a SteadyState interval into a single flat bar', () => {
        const bars = expandIntervalsToBars([steadyState(600, 0.88)], 'main')
        expect(bars).toHaveLength(1)
        expect(bars[0].style).toBe('flat')
        expect(bars[0].durationSeconds).toBe(600)
        expect(bars[0].powerPercent).toBe(88)
        expect(bars[0].groupId).toBeNull()
        expect(bars[0].sourceIntervalIndex).toBe(0)
    })

    it('converts a FreeRide interval into a freeride bar with 50% placeholder power', () => {
        const bars = expandIntervalsToBars([freeRide(900)], 'main')
        expect(bars).toHaveLength(1)
        expect(bars[0].style).toBe('freeride')
        expect(bars[0].durationSeconds).toBe(900)
        expect(bars[0].powerPercent).toBe(50)
        expect(bars[0].groupId).toBeNull()
    })

    it('converts a Warmup ramp into a single ramp bar with the midpoint power', () => {
        // PowerLow 50%, PowerHigh 80% — midpoint is 65%
        const bars = expandIntervalsToBars([warmup(600, 0.5, 0.8)], 'warmup')
        expect(bars).toHaveLength(1)
        expect(bars[0].style).toBe('ramp')
        expect(bars[0].powerPercent).toBe(65)
        expect(bars[0].startPowerPercent).toBe(50)
        expect(bars[0].endPowerPercent).toBe(80)
    })

    it('converts a Cooldown ramp into a single ramp bar', () => {
        const bars = expandIntervalsToBars([cooldown(600, 0.8, 0.4)], 'cooldown')
        expect(bars).toHaveLength(1)
        expect(bars[0].style).toBe('ramp')
        expect(bars[0].startPowerPercent).toBe(80)
        expect(bars[0].endPowerPercent).toBe(40)
    })

    it('expands an IntervalsT into repeat * 2 bars', () => {
        // 3 repeats: on/on/off/on/off etc — produces 6 bars
        const bars = expandIntervalsToBars([intervalsT(3, 60, 30, 1.1, 0.55)], 'main')
        expect(bars).toHaveLength(6)
    })

    it('alternates on and off bars within an IntervalsT group', () => {
        const bars = expandIntervalsToBars([intervalsT(2, 60, 30, 1.1, 0.55)], 'main')
        expect(bars[0].powerPercent).toBe(110) // on
        expect(bars[0].durationSeconds).toBe(60)
        expect(bars[1].powerPercent).toBe(55) // off
        expect(bars[1].durationSeconds).toBe(30)
        expect(bars[2].powerPercent).toBe(110) // on
        expect(bars[3].powerPercent).toBe(55) // off
    })

    it('assigns the same groupId to all bars from a single IntervalsT', () => {
        const bars = expandIntervalsToBars([intervalsT(3, 60, 30, 1.1, 0.55)], 'main')
        const groupId = bars[0].groupId
        expect(groupId).not.toBeNull()
        for (const bar of bars) {
            expect(bar.groupId).toBe(groupId)
        }
    })

    it('uses distinct groupIds for IntervalsT intervals at different indices', () => {
        const intervals = [intervalsT(2, 60, 30, 1.1, 0.55), intervalsT(2, 45, 15, 1.2, 0.5)]
        const bars = expandIntervalsToBars(intervals, 'main')
        // First 4 bars share one groupId, next 4 share another
        expect(bars[0].groupId).not.toBe(bars[4].groupId)
    })

    it('falls back to 0% power for a SteadyState interval with null power', () => {
        const interval: ParsedInterval = {
            ...steadyState(600, 0),
            power: null,
        }
        const bars = expandIntervalsToBars([interval], 'main')
        expect(bars[0].powerPercent).toBe(0)
    })

    it('treats a SteadyState ramp without both power values as a flat bar', () => {
        // A Warmup with only power (no powerHigh) falls through to the flat path
        const interval: ParsedInterval = {
            type: 'Warmup',
            durationSeconds: 600,
            power: 0.5,
            powerHigh: null,
            cadence: null,
            repeat: null,
            onDuration: null,
            offDuration: null,
            onPower: null,
            offPower: null,
        }
        const bars = expandIntervalsToBars([interval], 'warmup')
        expect(bars[0].style).toBe('flat')
    })
})
