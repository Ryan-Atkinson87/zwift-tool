import type { JSX } from 'react'

interface Props {
    selectedCount: number
    isExporting: boolean
    onClearSelection: () => void
    onBulkReplace: () => void
    onExportSelected: () => void
}

/**
 * Toolbar shown in the left panel whenever select mode is active.
 * Displays action buttons on the first row and the selection count
 * beneath them. All buttons share equal width via flex-1.
 *
 * <p>Replace requires at least two workouts selected. Export requires
 * at least one. Clear is always available to deselect all checked items.</p>
 */
export function BulkActionsToolbar({
    selectedCount,
    isExporting,
    onClearSelection,
    onBulkReplace,
    onExportSelected,
}: Props): JSX.Element {
    return (
        <div
            className={`
                flex flex-col gap-2
                w-full px-3 py-2
                bg-brand-900/40 border border-brand-700
                rounded-md
            `}
        >
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={onBulkReplace}
                    disabled={selectedCount < 1}
                    className={`
                        flex-1 px-2 py-1.5
                        bg-brand-600 text-white
                        text-xs font-medium
                        rounded-md
                        hover:bg-brand-500 transition-colors
                        focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900
                        disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                >
                    Replace
                </button>
                <button
                    type="button"
                    onClick={onExportSelected}
                    disabled={isExporting || selectedCount < 1}
                    className={`
                        flex-1 px-2 py-1.5
                        bg-zinc-600 text-zinc-100
                        text-xs font-medium
                        rounded-md
                        hover:bg-zinc-500 transition-colors
                        focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900
                        disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                >
                    {isExporting ? 'Exporting...' : 'Export .zip'}
                </button>
                <button
                    type="button"
                    onClick={onClearSelection}
                    className={`
                        flex-1 px-2 py-1.5
                        bg-zinc-700 text-zinc-300
                        text-xs font-medium
                        rounded-md
                        hover:bg-zinc-600 transition-colors
                        focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900
                    `}
                >
                    Clear
                </button>
            </div>
            <p className="text-xs text-brand-300">
                {selectedCount} {selectedCount === 1 ? 'workout' : 'workouts'} selected
            </p>
        </div>
    )
}
