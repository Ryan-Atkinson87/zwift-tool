import { useState, type JSX } from 'react'
import type { LibraryBlock } from '../../api/blocks'
import type { SectionType } from '../../types/workout'
import { formatDuration } from '../../utils/workoutStats'

interface Props {
    block: LibraryBlock
    isSelected: boolean
    onClick: () => void
    /** When omitted, the edit button is not rendered. */
    onEdit?: () => void
    /** When omitted, the delete button is not rendered. */
    onDelete?: () => void
}

const SECTION_LABELS: Record<SectionType, string> = {
    WARMUP: 'Warm-Up',
    MAINSET: 'Main Set',
    COOLDOWN: 'Cool-Down',
}

/**
 * Displays a single library block as a clickable card showing the section
 * type badge, block name, optional description, duration, and interval count.
 * Highlights when selected. Includes a delete button with an inline
 * confirmation step to prevent accidental deletion.
 *
 * The card uses a relative-positioned wrapper with an absolutely-positioned
 * primary action button covering the full card surface. Edit and delete buttons
 * sit above the primary button via z-index, so they do not nest inside it,
 * which would be invalid HTML.
 */
export function BlockCard({ block, isSelected, onClick, onEdit = undefined, onDelete = undefined }: Props): JSX.Element {
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
        onDelete?.()
    }

    return (
        // Relative positioning allows the primary action button to fill the card
        // with absolute inset-0, while action buttons sit above it via z-10.
        <div
            className={`
                relative flex flex-col gap-1
                w-full px-3 py-2
                border rounded-lg
                transition-colors
                ${isSelected
                    ? 'bg-zinc-700 border-brand-500'
                    : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 hover:border-zinc-600'}
            `}
        >
            {/* Primary action button covers the entire card surface */}
            <button
                type="button"
                aria-label={`Select block ${block.name}`}
                onClick={onClick}
                className="absolute inset-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900"
            />

            {/* Header row: section badge, stats, and action buttons — above the primary button via z-10 */}
            <div className="relative z-10 flex items-center justify-between gap-2">
                <span
                    className={`
                        px-1.5 py-0.5
                        bg-zinc-600 text-zinc-300
                        label-tiny
                        rounded shrink-0
                    `}
                >
                    {SECTION_LABELS[block.sectionType]}
                </span>
                <div className="flex items-center gap-2 ml-auto">
                    <span className="text-xs text-zinc-400 shrink-0">
                        {formatDuration(block.durationSeconds)} &middot; {block.intervalCount}{' '}
                        {block.intervalCount === 1 ? 'interval' : 'intervals'}
                    </span>
                    {onEdit !== undefined && !isPendingDelete && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onEdit() }}
                            aria-label="Edit block"
                            className={`
                                shrink-0 min-w-11 min-h-11 flex items-center justify-center
                                text-zinc-500
                                hover:text-white transition-colors
                                focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-800 rounded
                            `}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                                <path d="M13.488 2.513a1.75 1.75 0 0 0-2.474 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.263-4.262a1.75 1.75 0 0 0 0-2.474Z" />
                                <path d="M3.25 14.25a.75.75 0 0 0 0 1.5H13a.75.75 0 0 0 0-1.5H3.25Z" />
                            </svg>
                        </button>
                    )}
                    {onDelete !== undefined && !isPendingDelete && (
                        <button
                            type="button"
                            onClick={handleDeleteClick}
                            aria-label="Delete block"
                            className={`
                                shrink-0 min-w-11 min-h-11 flex items-center justify-center
                                text-zinc-500
                                hover:text-red-400 transition-colors
                                focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-800 rounded
                            `}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 16 16"
                                fill="currentColor"
                                className="w-3.5 h-3.5"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5A.75.75 0 0 1 9.95 6Z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Block name and description — above the primary button via z-10 */}
            <p className="relative z-10 text-sm font-medium text-white truncate">{block.name}</p>
            {block.description !== null && block.description.length > 0 && (
                <p className="relative z-10 text-xs text-zinc-400 line-clamp-2">{block.description}</p>
            )}

            {/* Inline delete confirmation — above the primary button via z-10 */}
            {onDelete !== undefined && isPendingDelete && (
                <div className="relative z-10 flex items-center justify-between gap-2 mt-1 pt-1 border-t border-zinc-600">
                    <p className="text-xs text-zinc-300">Delete this block?</p>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handleCancelDelete}
                            className={`
                                px-2 py-0.5
                                bg-zinc-600 text-zinc-300
                                text-xs font-medium
                                rounded
                                hover:bg-zinc-500 transition-colors
                                focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-700
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
                                text-xs font-medium
                                rounded
                                hover:bg-red-600 transition-colors
                                focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 focus:ring-offset-zinc-700
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
