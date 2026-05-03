import { useState, type JSX } from 'react'
import type { LibraryBlock } from '../../api/blocks'
import type { SectionType } from '../../types/workout'
import { BlockCard } from './BlockCard'
import { BlockPreview } from './BlockPreview'

interface Props {
    blocks: LibraryBlock[]
    isLoading: boolean
    error: string | null
    /** Called when the user clicks the edit button on a block. */
    onEditBlock: (block: LibraryBlock) => void
    /** Called when the user confirms deletion of a block. */
    onDeleteBlock: (blockId: string) => Promise<void>
}

/** Filter options for the section type tabs. 'ALL' shows every block. */
type SectionFilter = 'ALL' | SectionType

const FILTER_TABS: Array<{ value: SectionFilter; label: string }> = [
    { value: 'ALL', label: 'All' },
    { value: 'WARMUP', label: 'Warm-Up' },
    { value: 'MAINSET', label: 'Main Set' },
    { value: 'COOLDOWN', label: 'Cool-Down' },
]

/**
 * Renders the user's block library with section type filter tabs, a button
 * to create new blocks, and an inline interval preview for the selected block.
 *
 * <p>Filtering is applied client-side since all blocks are already loaded.
 * The selected block is cleared when the active filter changes.</p>
 */
export function BlockLibrary({ blocks, isLoading, error, onEditBlock, onDeleteBlock }: Props): JSX.Element {
    const [activeFilter, setActiveFilter] = useState<SectionFilter>('ALL')
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)

    if (isLoading) {
        return (
            <div className="w-full px-4 py-4 bg-zinc-800/40 border border-zinc-700 rounded-lg">
                <p className="text-sm text-zinc-400">Loading library...</p>
            </div>
        )
    }

    if (error !== null) {
        return (
            <div className="w-full px-4 py-4 bg-red-900/30 border border-red-800 rounded-lg">
                <p className="text-sm text-red-200">{error}</p>
            </div>
        )
    }

    const filteredBlocks = activeFilter === 'ALL'
        ? blocks
        : blocks.filter((b) => b.sectionType === activeFilter)

    const selectedBlock = selectedBlockId !== null
        ? blocks.find((b) => b.id === selectedBlockId) ?? null
        : null

    function handleFilterChange(filter: SectionFilter): void {
        setActiveFilter(filter)
        // Clear selection when the filter changes to avoid showing a preview
        // for a block that is no longer visible in the filtered list
        setSelectedBlockId(null)
    }

    function handleSelectBlock(id: string): void {
        // Clicking an already-selected block collapses the preview
        setSelectedBlockId((prev) => (prev === id ? null : id))
    }

    async function handleDeleteBlock(blockId: string): Promise<void> {
        await onDeleteBlock(blockId)
        // Clear selection if the deleted block was selected
        if (selectedBlockId === blockId) {
            setSelectedBlockId(null)
        }
    }

    return (
        <div className="flex flex-col w-full gap-3">
            {/* Section type filter grid: 2×2 layout matches the FileUploader button stack height */}
            <div className="grid grid-cols-2 gap-2">
                {FILTER_TABS.map((tab) => (
                    <button
                        key={tab.value}
                        type="button"
                        onClick={() => handleFilterChange(tab.value)}
                        className={`
                            w-full px-4 py-2
                            text-sm font-medium
                            rounded-md
                            transition-colors
                            focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900
                            ${activeFilter === tab.value
                                ? 'bg-brand-600 text-white'
                                : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                            }
                        `}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
                Block Library
            </h2>

            {filteredBlocks.length === 0 ? (
                <div className="px-4 py-4 bg-zinc-800/40 border border-zinc-700 rounded-lg text-center">
                    <p className="text-sm text-zinc-500">
                        {blocks.length === 0
                            ? 'No saved blocks yet. Use "Save to library" on any section to add one.'
                            : `No ${activeFilter === 'ALL' ? '' : FILTER_TABS.find((t) => t.value === activeFilter)?.label + ' '}blocks saved yet.`
                        }
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {filteredBlocks.map((block) => (
                        <div key={block.id}>
                            <BlockCard
                                block={block}
                                isSelected={selectedBlockId === block.id}
                                onClick={() => handleSelectBlock(block.id)}
                                onEdit={() => onEditBlock(block)}
                                onDelete={() => void handleDeleteBlock(block.id)}
                            />
                            {selectedBlock !== null && selectedBlock.id === block.id && (
                                <div className="mt-1 px-1">
                                    <BlockPreview block={selectedBlock} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
