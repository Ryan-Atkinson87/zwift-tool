import { useState, type JSX } from 'react'
import type { WorkoutSummary } from '../../types/workout'

interface Props {
    workout: WorkoutSummary
    isSelected: boolean
    isChecked: boolean
    isSelectMode: boolean
    onSelect: (id: string) => void
    onToggle: (id: string) => void
    onDelete: (id: string) => void
}

/**
 * Displays a single saved workout as a clickable card in the workout
 * list panel. Shows the workout name, the formatted last-updated date,
 * total duration, and a draft indicator if the workout is still a draft.
 *
 * <p>In normal mode the entire card is the select target. A trash icon
 * appears on hover and opens an inline confirmation before deleting.
 * In select mode a custom checkbox column appears for multi-select
 * bulk operations.</p>
 */
export function WorkoutCard({ workout, isSelected, isChecked, isSelectMode, onSelect, onToggle, onDelete }: Props): JSX.Element {
    const [isPendingDelete, setIsPendingDelete] = useState(false)

    function handleDeleteClick(e: React.MouseEvent): void {
        e.stopPropagation()
        setIsPendingDelete(true)
    }

    function handleCancelDelete(e: React.MouseEvent): void {
        e.stopPropagation()
        setIsPendingDelete(false)
    }

    function handleConfirmDelete(e: React.MouseEvent): void {
        e.stopPropagation()
        onDelete(workout.id)
    }

    function handleKeyDown(e: React.KeyboardEvent): void {
        if (isPendingDelete) return
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelect(workout.id)
        }
    }

    if (!isSelectMode) {
        return (
            <div
                role="button"
                tabIndex={0}
                onClick={isPendingDelete ? undefined : () => onSelect(workout.id)}
                onKeyDown={handleKeyDown}
                className={`
                    relative flex flex-col items-start w-full
                    px-3 py-3
                    text-left rounded-md border transition-colors
                    cursor-pointer
                    focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900
                    ${isSelected
                        ? 'bg-zinc-700 border-brand-500'
                        : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 hover:border-zinc-600'}
                `}
            >
                <CardContent workout={workout} />

                {!isPendingDelete && (
                    <button
                        type="button"
                        onClick={handleDeleteClick}
                        aria-label="Delete workout"
                        className={`
                            absolute top-2 right-2
                            p-0.5 rounded
                            text-zinc-500 hover:text-red-400
                            transition-colors
                            focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-800
                        `}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                            <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5A.75.75 0 0 1 9.95 6Z" clipRule="evenodd" />
                        </svg>
                    </button>
                )}

                {isPendingDelete && (
                    <div
                        className="flex items-center justify-between gap-2 w-full mt-2 pt-2 border-t border-zinc-600"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <p className="text-xs text-zinc-300">Delete this workout?</p>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={handleCancelDelete}
                                className={`
                                    px-2 py-0.5
                                    bg-zinc-600 text-zinc-300
                                    text-xs font-medium rounded
                                    hover:bg-zinc-500 transition-colors
                                    focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-800
                                `}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDelete}
                                className={`
                                    px-2 py-0.5
                                    bg-red-700 text-white
                                    text-xs font-medium rounded
                                    hover:bg-red-600 transition-colors
                                    focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 focus:ring-offset-zinc-800
                                `}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div
            className={`
                flex items-stretch w-full
                rounded-md border transition-colors
                ${isSelected
                    ? 'bg-zinc-700 border-brand-500'
                    : 'bg-zinc-800 border-zinc-700'}
            `}
        >
            {/* Checkbox: independent click target, does not open the workout */}
            <label className="flex items-center px-3 cursor-pointer shrink-0">
                <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggle(workout.id)}
                    aria-label={`Select ${workout.name}`}
                    className="sr-only"
                />
                <span
                    className={`
                        flex items-center justify-center
                        w-4 h-4 rounded border transition-colors shrink-0
                        ${isChecked
                            ? 'bg-brand-600 border-brand-500'
                            : 'border-zinc-500 hover:border-zinc-300'}
                    `}
                >
                    {isChecked && (
                        <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 text-white" fill="none">
                            <path
                                d="M1.5 5l2.5 2.5 4.5-4"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    )}
                </span>
            </label>

            {/* Card body: opens the workout */}
            <button
                type="button"
                onClick={() => onSelect(workout.id)}
                className={`
                    flex flex-col items-start flex-1 min-w-0
                    px-3 py-3
                    text-left
                    hover:bg-zinc-700 transition-colors rounded-r-md
                    focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-800
                `}
            >
                <CardContent workout={workout} />
            </button>
        </div>
    )
}

/** Shared card content rendered in both select and non-select layouts. */
function CardContent({ workout }: { workout: WorkoutSummary }): JSX.Element {
    return (
        <>
            <div className="flex items-center justify-between w-full gap-2 pr-5">
                <span className="text-sm font-medium text-white truncate">
                    {workout.name}
                </span>
                {workout.isDraft && (
                    <span className="px-2 py-0.5 bg-amber-900/50 text-amber-300 text-xs rounded shrink-0">
                        Draft
                    </span>
                )}
            </div>
            <div className="flex items-center justify-between w-full mt-1 text-xs text-zinc-400">
                <span>Updated {formatRelativeDate(workout.updatedAt)}</span>
                <span>{formatDuration(workout.durationSeconds)}</span>
            </div>
        </>
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
