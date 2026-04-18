/**
 * Displays parsed intervals from an uploaded .zwo file as a flat list.
 * Shows interval type, duration, and power for each interval.
 * Used in the import flow before section splitting.
 */

import type { JSX } from 'react'
import type { ParsedInterval, ParsedWorkout } from '../../types/workout'

interface Props {
    workouts: ParsedWorkout[]
    onSelectWorkout?: (workout: ParsedWorkout) => void
}

/**
 * Renders a list of parsed workouts, each with its metadata and a flat
 * list of intervals. Displayed after upload and before section splitting.
 * When onSelectWorkout is provided, each workout card is clickable to
 * proceed to the section split step.
 */
export function IntervalList({ workouts, onSelectWorkout }: Props): JSX.Element {
    return (
        <div className="flex flex-col gap-6 w-full max-w-2xl">
            {workouts.map((workout) => (
                <div
                    key={workout.fileName}
                    className="flex flex-col gap-3 p-4 bg-zinc-800 rounded-lg"
                >
                    <div className="flex flex-col gap-1">
                        <h3 className="text-white text-lg font-semibold">{workout.name}</h3>
                        {workout.author && (
                            <p className="text-zinc-400 text-sm">by {workout.author}</p>
                        )}
                        {workout.description && (
                            <p className="text-zinc-400 text-sm">{workout.description}</p>
                        )}
                        <p className="text-zinc-500 text-xs">{workout.fileName}</p>
                    </div>

                    <div className="flex flex-col gap-1">
                        <div className="flex px-3 py-1 text-zinc-500 text-xs font-medium uppercase tracking-wide">
                            <span className="w-32">Type</span>
                            <span className="w-24">Duration</span>
                            <span className="flex-1">Power</span>
                        </div>
                        {workout.intervals.map((interval, index) => (
                            <IntervalRow key={index} interval={interval} />
                        ))}
                    </div>

                    <div className="flex items-center justify-between">
                        <p className="text-zinc-500 text-xs">
                            {workout.intervals.length} interval{workout.intervals.length !== 1 ? 's' : ''} ·{' '}
                            {formatTotalDuration(workout.intervals)}
                        </p>
                        {onSelectWorkout && (
                            <button
                                onClick={() => onSelectWorkout(workout)}
                                className={`
                                    px-4 py-1.5
                                    bg-brand-600 text-white
                                    text-sm font-medium
                                    rounded-md
                                    hover:bg-brand-500 transition-colors
                                    focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-800
                                `}
                            >
                                Define sections
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}

/** Renders a single interval as a row in the flat list. */
function IntervalRow({ interval }: { interval: ParsedInterval }): JSX.Element {
    return (
        <div className="flex px-3 py-2 bg-zinc-700/50 text-white text-sm rounded">
            <span className="w-32 text-zinc-300">{interval.type}</span>
            <span className="w-24">{formatDuration(interval.durationSeconds)}</span>
            <span className="flex-1 text-zinc-300">{formatPower(interval)}</span>
        </div>
    )
}

/** Formats seconds into a human-readable duration string (e.g. "5:00" or "1:30:00"). */
function formatDuration(totalSeconds: number): string {
    // Zwift files occasionally have fractional durations (e.g. 60.000004)
    const seconds = Math.round(totalSeconds)
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`
}

/** Formats the power display for an interval based on its type. */
function formatPower(interval: ParsedInterval): string {
    if (interval.type === 'FreeRide') {
        return 'Free ride'
    }

    if (interval.type === 'IntervalsT') {
        const on = interval.onPower !== null ? `${Number((interval.onPower * 100).toFixed(1))}%` : '–'
        const off = interval.offPower !== null ? `${Number((interval.offPower * 100).toFixed(1))}%` : '–'
        const repeats = interval.repeat ?? 0
        return `${repeats}× ${on} / ${off}`
    }

    // Ramp, Warmup, Cooldown with PowerLow and PowerHigh
    if (interval.power !== null && interval.powerHigh !== null) {
        return `${Number((interval.power * 100).toFixed(1))}% → ${Number((interval.powerHigh * 100).toFixed(1))}%`
    }

    // SteadyState or single power value
    if (interval.power !== null) {
        return `${Number((interval.power * 100).toFixed(1))}%`
    }

    return '–'
}

/** Calculates and formats total duration across all intervals. */
function formatTotalDuration(intervals: ParsedInterval[]): string {
    const totalSeconds = intervals.reduce((sum, interval) => sum + interval.durationSeconds, 0)
    return formatDuration(totalSeconds)
}
