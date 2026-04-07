/**
 * Expands a parsed interval list into chart bars.
 *
 * <p>A chart bar is a single rectangle on the workout canvas. The mapping
 * from parsed intervals to bars is not one-to-one:</p>
 *
 * <ul>
 *   <li>Standard intervals (SteadyState, FreeRide) produce a single bar.</li>
 *   <li>Ramp intervals (Warmup, Cooldown, Ramp) produce a single bar whose
 *       power is the midpoint of the ramp start and end powers. This is a
 *       deliberate MVP simplification; gradient rendering can come later.</li>
 *   <li>IntervalsT produces {@code repeat * 2} bars, alternating on and off,
 *       and all bars in the same IntervalsT share a group ID so the renderer
 *       can draw them with tighter spacing.</li>
 * </ul>
 */

import type { ParsedInterval } from '../types/workout'

/**
 * A single bar on the workout canvas.
 *
 * Power is stored as an integer percentage of FTP (e.g. 88 for 88% FTP),
 * matching the units used by {@code zoneColours} and the Y-axis.
 */
export interface ChartBar {
    durationSeconds: number
    powerPercent: number
    /**
     * Shared identifier for bars that came from the same IntervalsT
     * interval, so the renderer can apply a smaller inter-bar gap within
     * a group. Null for bars not inside an IntervalsT group.
     */
    groupId: string | null
}

/**
 * Expands a list of parsed intervals into the flat list of bars that
 * should be rendered on the canvas.
 *
 * @param intervals the parsed intervals from a block's content
 * @param groupPrefix a prefix used to build group IDs for IntervalsT bars,
 *                    so groups in different sections do not collide
 */
export function expandIntervalsToBars(
    intervals: ParsedInterval[],
    groupPrefix: string,
): ChartBar[] {
    const bars: ChartBar[] = []

    intervals.forEach((interval, index) => {
        if (interval.type === 'IntervalsT') {
            const groupId = `${groupPrefix}-${index}`
            const repeat = interval.repeat ?? 0
            const onDuration = interval.onDuration ?? 0
            const offDuration = interval.offDuration ?? 0
            const onPower = toPercent(interval.onPower)
            const offPower = toPercent(interval.offPower)

            for (let i = 0; i < repeat; i++) {
                bars.push({ durationSeconds: onDuration, powerPercent: onPower, groupId })
                bars.push({ durationSeconds: offDuration, powerPercent: offPower, groupId })
            }
            return
        }

        // Ramp-style intervals use a midpoint power for MVP
        const isRamp =
            interval.type === 'Warmup' ||
            interval.type === 'Cooldown' ||
            interval.type === 'Ramp'

        if (isRamp && interval.power !== null && interval.powerHigh !== null) {
            const midpoint = (interval.power + interval.powerHigh) / 2
            bars.push({
                durationSeconds: interval.durationSeconds,
                powerPercent: toPercent(midpoint),
                groupId: null,
            })
            return
        }

        bars.push({
            durationSeconds: interval.durationSeconds,
            powerPercent: toPercent(interval.power),
            groupId: null,
        })
    })

    return bars
}

/**
 * Converts a power value stored as a fraction of FTP (e.g. 0.88) into
 * an integer percentage (e.g. 88). Null or missing values fall back to 0.
 */
function toPercent(power: number | null): number {
    if (power === null) return 0
    return Math.round(power * 100)
}
