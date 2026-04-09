import type { JSX } from 'react'
import type { LibraryBlock } from '../../api/blocks'
import type { SectionType } from '../../types/workout'
import { formatDuration } from '../../utils/workoutStats'

interface Props {
    block: LibraryBlock
    isSelected: boolean
    onClick: () => void
}

const SECTION_LABELS: Record<SectionType, string> = {
    WARMUP: 'Warm-Up',
    MAINSET: 'Main Set',
    COOLDOWN: 'Cool-Down',
}

/**
 * Displays a single library block as a clickable card showing the section
 * type badge, block name, optional description, duration, and interval count.
 * Highlights when selected.
 */
export function BlockCard({ block, isSelected, onClick }: Props): JSX.Element {
    return (
        <button
            type="button"
            onClick={onClick}
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
                <span className="text-xs text-zinc-400 shrink-0">
                    {formatDuration(block.durationSeconds)} &middot; {block.intervalCount}{' '}
                    {block.intervalCount === 1 ? 'interval' : 'intervals'}
                </span>
            </div>
            <p className="text-sm font-medium text-white truncate">{block.name}</p>
            {block.description !== null && block.description.length > 0 && (
                <p className="text-xs text-zinc-400 line-clamp-2">{block.description}</p>
            )}
        </button>
    )
}
