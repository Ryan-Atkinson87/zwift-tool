import { useState, type JSX } from 'react'
import { Modal } from '../ui/Modal'
import { BlockCard } from './BlockCard'
import { BlockPreview } from './BlockPreview'
import type { SectionType, WorkoutSummary } from '../../types/workout'
import type { LibraryBlock } from '../../api/blocks'

interface Props {
    isOpen: boolean
    selectedWorkoutIds: string[]
    workouts: WorkoutSummary[]
    blocks: LibraryBlock[]
    isBulkReplacing: boolean
    error: string | null
    onClose: () => void
    /**
     * Called when the user confirms. The parent calls the API and, if
     * {@code download} is true, triggers a zip download on completion.
     */
    onConfirm: (sectionType: SectionType, blockId: string, download: boolean) => void
}

const SECTION_LABELS: Record<SectionType, string> = {
    WARMUP: 'Warm-Up',
    MAINSET: 'Main Set',
    COOLDOWN: 'Cool-Down',
}

const ALL_SECTION_TYPES: SectionType[] = ['WARMUP', 'MAINSET', 'COOLDOWN']

/**
 * Modal for bulk-replacing the same section across multiple selected workouts
 * using a saved library block.
 *
 * <p>The user picks a section type and a library block, then reviews a summary
 * of which workouts will be updated and confirms before the replacement is
 * applied. A zip of updated .zwo files is downloaded on completion.</p>
 */
export function BulkReplaceModal({
    isOpen,
    selectedWorkoutIds,
    workouts,
    blocks,
    isBulkReplacing,
    error,
    onClose,
    onConfirm,
}: Props): JSX.Element | null {
    const [sectionType, setSectionType] = useState<SectionType>('WARMUP')
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
    const [downloadZip, setDownloadZip] = useState(false)

    const filteredBlocks = blocks.filter((b) => b.sectionType === sectionType)
    const selectedBlock = filteredBlocks.find((b) => b.id === selectedBlockId) ?? null
    const affectedWorkouts = workouts.filter((w) => selectedWorkoutIds.includes(w.id))

    function handleSectionChange(next: SectionType): void {
        setSectionType(next)
        // Clear block selection when the section changes so a block from a
        // different section cannot remain selected
        setSelectedBlockId(null)
    }

    function handleClose(): void {
        setSectionType('WARMUP')
        setSelectedBlockId(null)
        setDownloadZip(false)
        onClose()
    }

    function handleConfirm(): void {
        if (selectedBlockId === null) {
            return
        }
        onConfirm(sectionType, selectedBlockId, downloadZip)
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={`Replace section across ${selectedWorkoutIds.length} workout${selectedWorkoutIds.length !== 1 ? 's' : ''}`}
        >
            <div className="flex flex-col gap-5">

                {/* Section type picker */}
                <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                        Section to replace
                    </p>
                    <div className="flex gap-2">
                        {ALL_SECTION_TYPES.map((type) => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => handleSectionChange(type)}
                                className={`
                                    px-3 py-1.5
                                    text-sm font-medium
                                    rounded-md border
                                    transition-colors
                                    focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-800
                                    ${sectionType === type
                                        ? 'bg-brand-600 border-brand-500 text-white'
                                        : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'}
                                `}
                            >
                                {SECTION_LABELS[type]}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Block picker */}
                <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                        Replacement block
                    </p>
                    {filteredBlocks.length === 0 ? (
                        <p className="text-sm text-zinc-400">
                            No {SECTION_LABELS[sectionType]} blocks saved yet. Save a section to
                            your library first.
                        </p>
                    ) : (
                        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                            {filteredBlocks.map((block) => (
                                <BlockCard
                                    key={block.id}
                                    block={block}
                                    isSelected={selectedBlockId === block.id}
                                    onClick={() => setSelectedBlockId(block.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Preview of the selected replacement block */}
                {selectedBlock !== null && (
                    <div className="flex flex-col gap-2">
                        <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                            Preview: {selectedBlock.name}
                        </p>
                        <BlockPreview block={selectedBlock} />
                    </div>
                )}

                {/* Affected workouts summary */}
                <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                        Workouts that will be updated
                    </p>
                    <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
                        {affectedWorkouts.map((workout) => (
                            <div
                                key={workout.id}
                                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 rounded-md"
                            >
                                <span className="text-sm text-zinc-200 truncate">{workout.name}</span>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-zinc-500">
                        The current {SECTION_LABELS[sectionType]} on each workout will be saved for
                        undo. A zip of updated .zwo files will download on completion.
                    </p>
                </div>

                {/* Optional zip download */}
                <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={downloadZip}
                        onChange={(e) => setDownloadZip(e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 accent-brand-500 cursor-pointer"
                    />
                    <span className="text-sm text-zinc-300">
                        Download updated .zwo files as a zip
                    </span>
                </label>

                {error !== null && (
                    <p role="alert" className="text-sm text-red-400">{error}</p>
                )}

                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isBulkReplacing}
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
                        disabled={selectedBlockId === null || isBulkReplacing || filteredBlocks.length === 0}
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
                        {isBulkReplacing
                            ? 'Replacing...'
                            : `Replace ${SECTION_LABELS[sectionType]} on ${selectedWorkoutIds.length} workout${selectedWorkoutIds.length !== 1 ? 's' : ''}`}
                    </button>
                </div>
            </div>
        </Modal>
    )
}
