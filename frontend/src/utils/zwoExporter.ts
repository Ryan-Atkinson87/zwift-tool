/**
 * Client-side exporter for Zwift .zwo workout files.
 *
 * Generates XML from a WorkoutDetail object and triggers a browser download.
 * Used in guest mode where the workout has no backend record, so the backend
 * export endpoint cannot be called.
 */

import type { ParsedInterval, WorkoutDetail } from '../types/workout'

/**
 * Escapes special XML characters in a string value.
 */
function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}

/**
 * Formats a power fraction (e.g. 0.88) to a string rounded to four decimal
 * places. Zwift reads these as floats; four places preserves precision without
 * producing unnecessarily long values.
 */
function formatPower(power: number): string {
    return power.toFixed(4)
}

/**
 * Renders a single ParsedInterval as a .zwo XML element string.
 *
 * @param interval the interval to render
 * @param indent   leading whitespace for formatting
 */
function renderInterval(interval: ParsedInterval, indent: string): string {
    const { type } = interval

    if (type === 'IntervalsT') {
        const repeat = interval.repeat ?? 1
        const onDuration = interval.onDuration ?? 0
        const offDuration = interval.offDuration ?? 0
        const onPower = interval.onPower ?? 0
        const offPower = interval.offPower ?? 0
        const cadence = interval.cadence !== null ? ` Cadence="${interval.cadence}"` : ''
        return `${indent}<IntervalsT Repeat="${repeat}" OnDuration="${onDuration}" OffDuration="${offDuration}" OnPower="${formatPower(onPower)}" OffPower="${formatPower(offPower)}"${cadence}/>`
    }

    if (type === 'FreeRide') {
        const cadence = interval.cadence !== null ? ` Cadence="${interval.cadence}"` : ''
        return `${indent}<FreeRide Duration="${interval.durationSeconds}"${cadence}/>`
    }

    if (type === 'SteadyState') {
        const power = interval.power ?? 0
        const cadence = interval.cadence !== null ? ` Cadence="${interval.cadence}"` : ''
        return `${indent}<SteadyState Duration="${interval.durationSeconds}" Power="${formatPower(power)}"${cadence}/>`
    }

    // Warmup, Cooldown, and Ramp all use PowerLow / PowerHigh.
    // Zwift requires PowerLow before PowerHigh even on cooldowns, which ramp down,
    // so these are always written as PowerLow (start) and PowerHigh (end) regardless
    // of which direction the ramp moves.
    const powerLow = interval.power ?? 0
    const powerHigh = interval.powerHigh ?? interval.power ?? 0
    const cadence = interval.cadence !== null ? ` Cadence="${interval.cadence}"` : ''

    if (type === 'Warmup') {
        return `${indent}<Warmup Duration="${interval.durationSeconds}" PowerLow="${formatPower(powerLow)}" PowerHigh="${formatPower(powerHigh)}"${cadence}/>`
    }

    if (type === 'Cooldown') {
        return `${indent}<Cooldown Duration="${interval.durationSeconds}" PowerLow="${formatPower(powerLow)}" PowerHigh="${formatPower(powerHigh)}"${cadence}/>`
    }

    // Ramp
    return `${indent}<Ramp Duration="${interval.durationSeconds}" PowerLow="${formatPower(powerLow)}" PowerHigh="${formatPower(powerHigh)}"${cadence}/>`
}

/**
 * Generates the .zwo XML string for a workout. Includes all three sections
 * in order (warm-up, main set, cool-down) and any timed text events.
 *
 * @param workout the full workout detail to serialise
 * @return a well-formed .zwo XML string ready for download
 */
export function generateZwoXml(workout: WorkoutDetail): string {
    const indent = '    '
    const lines: string[] = []

    const allIntervals: ParsedInterval[] = [
        ...(workout.warmupBlock?.intervals ?? []),
        ...workout.mainsetBlock.intervals,
        ...(workout.cooldownBlock?.intervals ?? []),
    ]

    for (const interval of allIntervals) {
        lines.push(renderInterval(interval, indent))
    }

    for (const event of workout.textEvents) {
        const duration = event.durationSeconds !== undefined ? ` duration="${event.durationSeconds}"` : ''
        lines.push(`${indent}<textevent timeoffset="${event.timeOffsetSeconds}"${duration} message="${escapeXml(event.message)}"/>`)
    }

    const name = escapeXml(workout.name)
    const author = escapeXml(workout.author ?? '')
    const description = escapeXml(workout.description ?? '')

    return [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<workout_file>',
        `  <n>${name}</n>`,
        `  <author>${author}</author>`,
        `  <description>${description}</description>`,
        '  <sportType>bike</sportType>',
        '  <workout>',
        ...lines,
        '  </workout>',
        '</workout_file>',
    ].join('\n')
}

/**
 * Triggers a browser download of the generated .zwo XML for the given workout.
 * Called in guest mode where the workout is not persisted to the backend.
 *
 * @param workout the workout to export
 */
export function downloadGuestWorkout(workout: WorkoutDetail): void {
    const xml = generateZwoXml(workout)
    const blob = new Blob([xml], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)

    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${workout.name}.zwo`
    anchor.click()

    URL.revokeObjectURL(url)
}
