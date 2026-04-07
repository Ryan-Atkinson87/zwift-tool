/**
 * Summary statistics for a workout: total duration and normalised power.
 *
 * <p>TSS is intentionally not calculated in this module. The canvas displays
 * TSS as "Coming soon" while the formula and inputs are finalised.</p>
 */

import type { ChartBar } from './intervalExpander'

/**
 * Formats a duration in seconds as {@code hh:mm} or {@code h:mm}, rounding
 * down to whole minutes. Negative values are clamped to zero.
 *
 * @param seconds the duration in seconds
 */
export function formatDuration(seconds: number): string {
    const safe = Math.max(0, Math.floor(seconds))
    const hours = Math.floor(safe / 3600)
    const minutes = Math.floor((safe % 3600) / 60)
    const paddedMinutes = minutes.toString().padStart(2, '0')
    return `${hours}:${paddedMinutes}`
}

/**
 * Sums the duration of every bar in a workout.
 *
 * @param bars the expanded chart bars for every section
 */
export function totalDurationSeconds(bars: ChartBar[]): number {
    return bars.reduce((sum, bar) => sum + bar.durationSeconds, 0)
}

/**
 * Calculates a beta normalised power value as the time-weighted average
 * of the bar power values. This is an MVP approximation, not a true NP
 * calculation, which would require a 30-second rolling fourth-power average.
 *
 * @param bars the expanded chart bars for every section
 * @return normalised power as an integer percentage of FTP, or 0 if empty
 */
export function normalisedPowerBeta(bars: ChartBar[]): number {
    const total = totalDurationSeconds(bars)
    if (total === 0) return 0

    const weighted = bars.reduce(
        (sum, bar) => sum + bar.powerPercent * bar.durationSeconds,
        0,
    )
    return Math.round(weighted / total)
}
