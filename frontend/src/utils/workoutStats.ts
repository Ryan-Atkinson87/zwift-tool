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

/**
 * Expands a list of chart bars into a flat per-second array of absolute
 * power values in watts. FreeRide bars contribute 0W because they have no
 * defined power target.
 *
 * @param bars the expanded chart bars for every section
 * @param ftpWatts the user's FTP in watts, used to convert %FTP to watts
 * @return array of watts values, one entry per second of workout duration
 */
export function expandBarsToWatts(bars: ChartBar[], ftpWatts: number): number[] {
    const samples: number[] = []
    for (const bar of bars) {
        const watts = bar.style === 'freeride' ? 0 : (bar.powerPercent / 100) * ftpWatts
        for (let s = 0; s < bar.durationSeconds; s++) {
            samples.push(watts)
        }
    }
    return samples
}

/**
 * Calculates Normalised Power (NP) in watts using the standard 30-second
 * rolling fourth-power algorithm.
 *
 * <p>Algorithm: replace nulls with 0, compute 30-second rolling averages,
 * raise each to the 4th power, take the mean, then take the 4th root.</p>
 *
 * @param powerSamplesWatts per-second power values in watts; nulls treated as 0
 * @return NP in watts rounded to 1 decimal place, or null if fewer than 30 samples
 */
export function calculateNormalisedPower(powerSamplesWatts: (number | null)[]): number | null {
    const clean = powerSamplesWatts.map((v) => v ?? 0)
    if (clean.length < 30) return null

    const rollingAverages: number[] = []
    for (let i = 0; i <= clean.length - 30; i++) {
        let windowSum = 0
        for (let j = i; j < i + 30; j++) {
            windowSum += clean[j]
        }
        rollingAverages.push(windowSum / 30)
    }

    const meanFourthPower =
        rollingAverages.reduce((sum, avg) => sum + avg ** 4, 0) / rollingAverages.length
    const np = meanFourthPower ** 0.25

    return Math.round(np * 10) / 10
}

/**
 * Calculates Intensity Factor (IF) as the ratio of Normalised Power to FTP.
 *
 * @param npWatts Normalised Power in watts
 * @param ftpWatts the user's FTP in watts
 * @return IF rounded to 2 decimal places
 */
export function calculateIntensityFactor(npWatts: number, ftpWatts: number): number {
    return Math.round((npWatts / ftpWatts) * 100) / 100
}
