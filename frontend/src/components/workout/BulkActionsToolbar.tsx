import type { JSX } from 'react'

interface Props {
    selectedCount: number
    onClearSelection: () => void
}

/**
 * Toolbar shown below the workout list when two or more workouts are
 * selected. Displays the selection count and a button to clear all
 * selections. Bulk action buttons (e.g. replace section) will be added
 * here in subsequent issues.
 */
export function BulkActionsToolbar({ selectedCount, onClearSelection }: Props): JSX.Element {
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
    )
}
