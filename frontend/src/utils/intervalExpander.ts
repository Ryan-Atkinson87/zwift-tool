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

/** Visual style of a chart bar, used by the renderer to pick its shape. */
export type ChartBarStyle = 'flat' | 'ramp' | 'freeride'

/**
 * A single bar on the workout canvas.
 *
 * Power is stored as an integer percentage of FTP (e.g. 88 for 88% FTP),
 * matching the units used by {@code zoneColours} and the Y-axis. For ramp
 * bars {@code powerPercent} is the midpoint (used for zone colouring) and
 * {@code startPowerPercent}/{@code endPowerPercent} carry the gradient
 * endpoints. For Free Ride bars the power values are placeholders and the
 * renderer draws a fixed grey wavy block instead.
 */
export interface ChartBar {
    durationSeconds: number
    powerPercent: number
    style: ChartBarStyle
    /** Ramp start power as %FTP. Only set when style is 'ramp'. */
    startPowerPercent: number | null
    /** Ramp end power as %FTP. Only set when style is 'ramp'. */
    endPowerPercent: number | null
    /**
     * Shared identifier for bars that came from the same IntervalsT
     * interval, so the renderer can apply a smaller inter-bar gap within
     * a group. Null for bars not inside an IntervalsT group.
     */
    groupId: string | null
    /**
     * Index of the source interval inside its block, or null when the bar
     * does not map back to a single editable interval (e.g. an IntervalsT
     * group expands into many bars but is still one interval to edit).
     */
    sourceIntervalIndex: number | null
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
                bars.push({
                    durationSeconds: onDuration,
                    powerPercent: onPower,
                    style: 'flat',
                    startPowerPercent: null,
                    endPowerPercent: null,
                    groupId,
                    sourceIntervalIndex: index,
                })
                bars.push({
                    durationSeconds: offDuration,
                    powerPercent: offPower,
                    style: 'flat',
                    startPowerPercent: null,
                    endPowerPercent: null,
                    groupId,
                    sourceIntervalIndex: index,
                })
            }
            return
        }

        if (interval.type === 'FreeRide') {
            bars.push({
                durationSeconds: interval.durationSeconds,
                // FreeRide has no specific power; use a mid-zone value so
                // the bar still has visible height under the wavy fill
                powerPercent: 50,
                style: 'freeride',
                startPowerPercent: null,
                endPowerPercent: null,
                groupId: null,
                sourceIntervalIndex: index,
            })
            return
        }

        const isRamp =
            interval.type === 'Warmup' ||
            interval.type === 'Cooldown' ||
            interval.type === 'Ramp'

        if (isRamp && interval.power !== null && interval.powerHigh !== null) {
            const startPercent = toPercent(interval.power)
            const endPercent = toPercent(interval.powerHigh)
            // Midpoint is used for zone colouring; the renderer reads the
            // start/end percentages to draw the gradient and the bar shape
            const midpoint = Math.round((startPercent + endPercent) / 2)
            bars.push({
                durationSeconds: interval.durationSeconds,
                powerPercent: midpoint,
                style: 'ramp',
                startPowerPercent: startPercent,
                endPowerPercent: endPercent,
                groupId: null,
                sourceIntervalIndex: index,
            })
            return
        }

        bars.push({
            durationSeconds: interval.durationSeconds,
            powerPercent: toPercent(interval.power),
            style: 'flat',
            startPowerPercent: null,
            endPowerPercent: null,
            groupId: null,
            sourceIntervalIndex: index,
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
