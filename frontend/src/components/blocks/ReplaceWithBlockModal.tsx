import { useState, type JSX } from 'react'
import { Modal } from '../ui/Modal'
import type { SectionType } from '../../types/workout'
import type { LibraryBlock } from '../../api/blocks'
import { BlockCard } from './BlockCard'

interface Props {
    isOpen: boolean
    sectionType: SectionType | null
    blocks: LibraryBlock[]
    isReplacing: boolean
    error: string | null
    onClose: () => void
    /**
     * Called when the user confirms the replacement with a selected block ID.
     * The parent is responsible for calling the API and refreshing the workout.
     */
    onConfirm: (blockId: string) => void
}

const SECTION_LABELS: Record<SectionType, string> = {
    WARMUP: 'Warm-Up',
    MAINSET: 'Main Set',
    COOLDOWN: 'Cool-Down',
}

/**
 * Modal for replacing a workout section with a saved library block.
 * Lists library blocks filtered to the target section type, allows the user
 * to select one, then confirms the replacement with a warning that the
 * current section will be overwritten (undo is available).
 */
export function ReplaceWithBlockModal({
    isOpen,
    sectionType,
    blocks,
    isReplacing,
    error,
    onClose,
    onConfirm,
}: Props): JSX.Element | null {
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)

    if (sectionType === null) {
        return null
    }

    const filteredBlocks = blocks.filter((b) => b.sectionType === sectionType)

    function handleClose(): void {
        setSelectedBlockId(null)
        onClose()
    }

    function handleConfirm(): void {
        if (selectedBlockId === null) {
            return
        }
        onConfirm(selectedBlockId)
    }

    // Reset selection when the modal re-opens for a new section
    // by keying state to sectionType, handled via the key on the modal caller

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={`Replace ${SECTION_LABELS[sectionType]}`}
        >
            <div className="flex flex-col gap-4">
                {filteredBlocks.length === 0 ? (
                    <p className="text-sm text-zinc-400">
                        No {SECTION_LABELS[sectionType]} blocks saved yet. Use "Save" on the
                        section to add one to your library first.
                    </p>
                ) : (
                    <>
                        <p className="text-sm text-zinc-400">
                            Choose a block to replace the current{' '}
                            <span className="text-zinc-200">{SECTION_LABELS[sectionType]}</span>.
                            You can undo the change using the Undo button next to the section label.
                        </p>
                        <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                            {filteredBlocks.map((block) => (
                                <BlockCard
                                    key={block.id}
                                    block={block}
                                    isSelected={selectedBlockId === block.id}
                                    onClick={() => setSelectedBlockId(block.id)}
                                />
                            ))}
                        </div>
                    </>
                )}

                {error !== null && (
                    <p role="alert" className="text-sm text-red-400">{error}</p>
                )}

                <div className="flex justify-end gap-3 mt-2">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isReplacing}
                        className={`
                            px-4 py-2
                            bg-zinc-700 text-white
                            text-sm font-medium
                            rounded-md
                            hover:bg-zinc-600 transition-colors
                            focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-800
                            disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={selectedBlockId === null || isReplacing || filteredBlocks.length === 0}
                        className={`
                            px-4 py-2
                            bg-brand-600 text-white
                            text-sm font-medium
                            rounded-md
                            hover:bg-brand-500 transition-colors
                            focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-800
                            disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                    >
                        {isReplacing ? 'Replacing...' : 'Replace section'}
                    </button>
                </div>
            </div>
        </Modal>
    )
}
