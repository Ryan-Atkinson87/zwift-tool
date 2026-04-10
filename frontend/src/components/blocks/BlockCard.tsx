import { useState, type JSX } from 'react'
import type { LibraryBlock } from '../../api/blocks'
import type { SectionType } from '../../types/workout'
import { formatDuration } from '../../utils/workoutStats'

interface Props {
    block: LibraryBlock
    isSelected: boolean
    onClick: () => void
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
 */
export function BlockCard({ block, isSelected, onClick, onDelete = undefined }: Props): JSX.Element {
    const [isPendingDelete, setIsPendingDelete] = useState(false)

    function handleDeleteClick(e: React.MouseEvent): void {
        // Prevent the click from also selecting/deselecting the card
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
        <div
            className={`
                flex flex-col gap-1 text-left
                w-full px-3 py-2
                border rounded-lg
                transition-colors
                ${isSelected
                    ? 'bg-zinc-700 border-indigo-500'
                    : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-750 hover:border-zinc-600'
                }
            `}
        >
            {/* Header row: section badge, stats, and delete button */}
            <div className="flex items-center justify-between gap-2">
                <span
                    className={`
                        px-1.5 py-0.5
                        bg-zinc-600 text-zinc-300
                        text-[10px] font-semibold uppercase tracking-wide
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
                    {onDelete !== undefined && !isPendingDelete && (
                        <button
                            type="button"
                            onClick={handleDeleteClick}
                            aria-label="Delete block"
                            className={`
                                shrink-0 p-0.5
                                text-zinc-500
                                hover:text-red-400 transition-colors
                            `}
                        >
                            {/* Trash icon */}
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

            {/* Block name and description — clicking this area selects/deselects the card */}
            <button
                type="button"
                onClick={onClick}
                className="flex flex-col gap-1 text-left w-full"
            >
                <p className="text-sm font-medium text-white truncate">{block.name}</p>
                {block.description !== null && block.description.length > 0 && (
                    <p className="text-xs text-zinc-400 line-clamp-2">{block.description}</p>
                )}
            </button>

            {/* Inline delete confirmation */}
            {onDelete !== undefined && isPendingDelete && (
                <div className="flex items-center justify-between gap-2 mt-1 pt-1 border-t border-zinc-600">
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
