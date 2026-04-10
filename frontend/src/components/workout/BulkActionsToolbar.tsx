import type { JSX } from 'react'

interface Props {
    selectedCount: number
    onClearSelection: () => void
    onBulkReplace: () => void
}

/**
 * Toolbar shown below the workout list when two or more workouts are
 * selected. Displays the selection count, a bulk replace button, and
 * a button to clear the selection.
 */
export function BulkActionsToolbar({ selectedCount, onClearSelection, onBulkReplace }: Props): JSX.Element {
    return (
        <div
            className={`
                flex items-center justify-between
                w-full max-w-md px-4 py-3
                bg-indigo-900/40 border border-indigo-700
                rounded-md
            `}
        >
            <span className="text-sm font-medium text-indigo-200">
                {selectedCount} workout{selectedCount !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={onBulkReplace}
                    className={`
                        px-3 py-1
                        bg-indigo-600 text-white
                        text-xs font-medium
                        rounded-md
                        hover:bg-indigo-500 transition-colors
                    `}
                >
                    Replace section
                </button>
                <button
                    type="button"
                    onClick={onClearSelection}
                    className={`
                        px-3 py-1
                        bg-zinc-700 text-zinc-300
                        text-xs font-medium
                        rounded-md
                        hover:bg-zinc-600 transition-colors
                    `}
                >
                    Clear selection
                </button>
            </div>
        </div>
    )
}
