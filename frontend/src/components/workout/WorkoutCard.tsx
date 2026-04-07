import type { JSX } from 'react'
import type { WorkoutSummary } from '../../types/workout'

interface Props {
    workout: WorkoutSummary
    isSelected: boolean
    onSelect: (id: string) => void
}

/**
 * Displays a single saved workout as a clickable card in the workout
 * list panel. Shows the workout name, the formatted last-updated date,
 * total duration, and a draft indicator if the workout is still a draft.
 * Calls {@code onSelect} with the workout ID on click.
 */
export function WorkoutCard({ workout, isSelected, onSelect }: Props): JSX.Element {
    return (
        <button
            type="button"
            onClick={() => onSelect(workout.id)}
            className={`
                flex flex-col items-start
                w-full px-4 py-3
                text-left
                rounded-md border transition-colors
                ${isSelected
                    ? 'bg-zinc-700 border-indigo-500'
                    : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700'}
            `}
        >
            <div className="flex items-center justify-between w-full gap-2">
                <span className="text-sm font-medium text-white truncate">
                    {workout.name}
                </span>
                {workout.isDraft && (
                    <span className="px-2 py-0.5 bg-amber-900/50 text-amber-300 text-xs rounded">
                        Draft
                    </span>
                )}
            </div>
            <div className="flex items-center justify-between w-full mt-1 text-xs text-zinc-400">
                <span>Updated {formatRelativeDate(workout.updatedAt)}</span>
                <span>{formatDuration(workout.durationSeconds)}</span>
            </div>
        </button>
    )
}

/**
 * Formats a duration in seconds as h:mm or m:ss.
 */
function formatDuration(seconds: number): string {
    if (seconds <= 0) {
        return '0:00'
    }
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
}

/**
 * Formats an ISO timestamp as a short relative date for the list view.
 * Falls back to a locale date string for anything older than a week.
 */
function formatRelativeDate(iso: string): string {
    const then = new Date(iso).getTime()
    if (Number.isNaN(then)) {
        return 'unknown'
    }
    const diffMs = Date.now() - then
    const minute = 60 * 1000
    const hour = 60 * minute
    const day = 24 * hour

    if (diffMs < minute) {
        return 'just now'
    }
    if (diffMs < hour) {
        return `${Math.floor(diffMs / minute)} min ago`
    }
    if (diffMs < day) {
        return `${Math.floor(diffMs / hour)}h ago`
    }
    if (diffMs < 7 * day) {
        return `${Math.floor(diffMs / day)}d ago`
    }
    return new Date(iso).toLocaleDateString('en-GB')
}
