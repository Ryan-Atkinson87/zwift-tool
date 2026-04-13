import { useState, type JSX } from 'react'
import {
    DndContext,
    PointerSensor,
    KeyboardSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core'
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { saveBlock, updateBlock, type LibraryBlock } from '../../api/blocks'
import { IntervalFields } from '../workout/IntervalEditor'
import { ZonePresetButtons } from '../workout/ZonePresetButtons'
import { AddBlockModal } from '../workout/AddBlockModal'
import { BlockPreview } from './BlockPreview'
import type { ParsedInterval, SectionType } from '../../types/workout'
import { getZonePreset, type Zone } from '../../utils/zonePresets'
import { sumIntervalDuration } from '../../utils/editorDraft'

interface Props {
    isOpen: boolean
    onClose: () => void
    /** Called after the block is successfully saved or updated. The parent should reload the library. */
    onSaved: () => void
    /**
     * When provided, the modal opens in edit mode pre-populated with the
     * block's existing values. The save action calls PUT instead of POST.
     */
    initialBlock?: LibraryBlock | null
}

const SECTION_OPTIONS: Array<{ value: SectionType; label: string }> = [
    { value: 'WARMUP', label: 'Warm-Up' },
    { value: 'MAINSET', label: 'Main Set' },
    { value: 'COOLDOWN', label: 'Cool-Down' },
]

/**
 * Modal for creating a new library block from scratch, or editing an existing
 * one. When {@code initialBlock} is supplied the form is pre-populated and the
 * save action calls PUT instead of POST. The title and footer button label
 * update accordingly.
 *
 * <p>The parent should pass a stable {@code key} tied to the block ID (or a
 * constant for the create case) so React remounts the modal — and resets all
 * local state — when switching between blocks.</p>
 */
export function CreateBlockModal({ isOpen, onClose, onSaved, initialBlock = null }: Props): JSX.Element | null {
    const [sectionType, setSectionType] = useState<SectionType>(initialBlock?.sectionType ?? 'MAINSET')
    const [intervals, setIntervals] = useState<ParsedInterval[]>(
        initialBlock !== null && initialBlock.content.trim().length > 0
            ? (JSON.parse(initialBlock.content) as ParsedInterval[])
            : [],
    )
    const [name, setName] = useState(initialBlock?.name ?? '')
    const [description, setDescription] = useState(initialBlock?.description ?? '')
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
    const [isAddIntervalOpen, setIsAddIntervalOpen] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    if (!isOpen) {
        return null
    }

    function handleClose(): void {
        setSectionType(initialBlock?.sectionType ?? 'MAINSET')
        setIntervals(
            initialBlock !== null && initialBlock.content.trim().length > 0
                ? (JSON.parse(initialBlock.content) as ParsedInterval[])
                : [],
        )
        setName(initialBlock?.name ?? '')
        setDescription(initialBlock?.description ?? '')
        setSelectedIndex(null)
        setIsAddIntervalOpen(false)
        setError(null)
        onClose()
    }

    function handleAddZonePreset(_sectionType: SectionType, zone: Zone): void {
        const preset = getZonePreset(zone)
        const interval: ParsedInterval = {
            type: 'SteadyState',
            durationSeconds: preset.defaultDurationSeconds,
            power: preset.defaultFtpPercent / 100,
            powerHigh: null,
            cadence: null,
            repeat: null,
            onDuration: null,
            offDuration: null,
            onPower: null,
            offPower: null,
        }
        setIntervals((prev) => [...prev, interval])
    }

    function handleAddInterval(_sectionType: SectionType, interval: ParsedInterval): void {
        setIntervals((prev) => [...prev, interval])
    }

    function handleUpdateInterval(index: number, next: ParsedInterval): void {
        setIntervals((prev) => prev.map((iv, i) => (i === index ? next : iv)))
    }

    function handleDeleteInterval(index: number): void {
        setIntervals((prev) => prev.filter((_, i) => i !== index))
        if (selectedIndex === index) {
            setSelectedIndex(null)
        } else if (selectedIndex !== null && selectedIndex > index) {
            // Keep the selection pointing at the same item after the list shifts
            setSelectedIndex(selectedIndex - 1)
        }
    }

    function handleReorder(fromIndex: number, toIndex: number): void {
        setIntervals((prev) => {
            const next = [...prev]
            const [moved] = next.splice(fromIndex, 1)
            next.splice(toIndex, 0, moved)
            return next
        })
        // Keep the selected interval tracking the moved item
        if (selectedIndex === fromIndex) {
            setSelectedIndex(toIndex)
        } else if (
            selectedIndex !== null
            && fromIndex < toIndex
            && selectedIndex > fromIndex
            && selectedIndex <= toIndex
        ) {
            setSelectedIndex(selectedIndex - 1)
        } else if (
            selectedIndex !== null
            && fromIndex > toIndex
            && selectedIndex < fromIndex
            && selectedIndex >= toIndex
        ) {
            setSelectedIndex(selectedIndex + 1)
        }
    }

    async function handleSave(): Promise<void> {
        if (name.trim().length === 0) {
            setError('Name is required.')
            return
        }
        if (intervals.length === 0) {
            setError('Add at least one interval before saving.')
            return
        }

        setIsSaving(true)
        setError(null)

        const payload = {
            name: name.trim(),
            description: description.trim().length > 0 ? description.trim() : null,
            sectionType,
            content: JSON.stringify(intervals),
            durationSeconds: sumIntervalDuration(intervals),
            intervalCount: intervals.length,
        }

        try {
            if (initialBlock !== null) {
                await updateBlock(initialBlock.id, payload)
            } else {
                await saveBlock(payload)
            }
            onSaved()
            handleClose()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save block.')
        } finally {
            setIsSaving(false)
        }
    }

    // Synthetic block for BlockPreview, uses the current state to render a live preview
    const previewBlock: LibraryBlock = {
        id: 'preview',
        name,
        description: null,
        sectionType,
        content: JSON.stringify(intervals),
        durationSeconds: sumIntervalDuration(intervals),
        intervalCount: intervals.length,
        isLibraryBlock: true,
    }

    const selectedInterval = selectedIndex !== null ? (intervals[selectedIndex] ?? null) : null

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto py-8"
            onClick={handleClose}
        >
            <div
                className="flex flex-col w-full max-w-2xl mx-4 p-6 bg-zinc-800 text-white rounded-lg"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">
                        {initialBlock !== null ? 'Edit library block' : 'Create library block'}
                    </h2>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="text-zinc-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-800 rounded"
                        aria-label="Close modal"
                    >
                        &#x2715;
                    </button>
                </div>

                <div className="flex flex-col gap-5">
                    {/* Section type */}
                    <div className="flex flex-col gap-2">
                        <p className="text-sm text-zinc-300">Section type</p>
                        <div className="flex gap-2">
                            {SECTION_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setSectionType(option.value)}
                                    className={`
                                        flex-1 px-3 py-2
                                        text-sm font-medium
                                        rounded-md transition-colors
                                        focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-800
                                        ${sectionType === option.value
                                            ? 'bg-brand-600 text-white'
                                            : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                                        }
                                    `}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Name */}
                    <div className="flex flex-col gap-1">
                        <label className="text-sm text-zinc-300" htmlFor="create-block-name">
                            Name <span className="text-red-400">*</span>
                        </label>
                        <input
                            id="create-block-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. 2x20 Threshold"
                            autoFocus
                            className={`
                                w-full px-3 py-2
                                bg-zinc-700 text-white
                                text-sm
                                rounded-md border border-zinc-600
                                placeholder:text-zinc-500
                                focus:outline-none focus:border-brand-500
                            `}
                        />
                    </div>

                    {/* Description */}
                    <div className="flex flex-col gap-1">
                        <label className="text-sm text-zinc-300" htmlFor="create-block-desc">
                            Description <span className="text-zinc-500">(optional)</span>
                        </label>
                        <textarea
                            id="create-block-desc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Short description of this block..."
                            rows={2}
                            className={`
                                w-full px-3 py-2
                                bg-zinc-700 text-white
                                text-sm
                                rounded-md border border-zinc-600
                                placeholder:text-zinc-500
                                focus:outline-none focus:border-brand-500
                                resize-none
                            `}
                        />
                    </div>

                    {/* Intervals */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-zinc-300">Intervals</p>
                            <button
                                type="button"
                                onClick={() => setIsAddIntervalOpen(true)}
                                className={`
                                    px-3 py-1
                                    bg-zinc-700 text-zinc-200
                                    text-xs font-medium
                                    rounded
                                    hover:bg-zinc-600 transition-colors
                                    focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-800
                                `}
                            >
                                + Add interval
                            </button>
                        </div>

                        {/* Zone preset buttons for quick SteadyState additions */}
                        <ZonePresetButtons
                            sectionType={sectionType}
                            onSelectPreset={handleAddZonePreset}
                        />

                        {intervals.length === 0 ? (
                            <p className="text-xs text-zinc-500 italic">
                                No intervals yet. Use the zone buttons or Add interval to get started.
                            </p>
                        ) : (
                            <SortableIntervalList
                                intervals={intervals}
                                selectedIndex={selectedIndex}
                                onSelect={(index) =>
                                    setSelectedIndex((prev) => (prev === index ? null : index))
                                }
                                onDelete={handleDeleteInterval}
                                onReorder={handleReorder}
                            />
                        )}
                    </div>

                    {/* Inline interval editor for the selected interval */}
                    {selectedInterval !== null && selectedIndex !== null && (
                        <div
                            className={`
                                flex flex-col gap-3
                                px-4 py-3
                                bg-zinc-800/60 border border-zinc-700
                                rounded-lg
                            `}
                        >
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-white">Edit interval</p>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteInterval(selectedIndex)}
                                        className={`
                                            px-3 py-1
                                            bg-red-900/60 text-red-200
                                            text-xs font-medium
                                            rounded
                                            hover:bg-red-800 transition-colors
                                            focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 focus:ring-offset-zinc-800
                                        `}
                                    >
                                        Delete
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedIndex(null)}
                                        className={`
                                            px-3 py-1
                                            bg-zinc-700 text-zinc-200
                                            text-xs font-medium
                                            rounded
                                            hover:bg-zinc-600 transition-colors
                                            focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-800
                                        `}
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                            <IntervalFields
                                draft={selectedInterval}
                                onChange={(next) => handleUpdateInterval(selectedIndex, next)}
                            />
                        </div>
                    )}

                    {/* Live preview */}
                    {intervals.length > 0 && (
                        <div className="flex flex-col gap-1">
                            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                                Preview
                            </p>
                            <BlockPreview block={previewBlock} onReorder={handleReorder} />
                        </div>
                    )}

                    {error !== null && (
                        <p className="text-sm text-red-400">{error}</p>
                    )}

                    {/* Footer */}
                    <div className="flex justify-end gap-3 mt-2">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isSaving}
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
                            onClick={() => void handleSave()}
                            disabled={isSaving}
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
                            {isSaving ? 'Saving...' : initialBlock !== null ? 'Save changes' : 'Save to library'}
                        </button>
                    </div>
                </div>

                {/* Add interval modal, nested so its backdrop stops at the panel boundary */}
                <AddBlockModal
                    isOpen={isAddIntervalOpen}
                    sectionType={sectionType}
                    onClose={() => setIsAddIntervalOpen(false)}
                    onConfirm={handleAddInterval}
                />
            </div>
        </div>
    )
}

interface SortableListProps {
    intervals: ParsedInterval[]
    selectedIndex: number | null
    onSelect: (index: number) => void
    onDelete: (index: number) => void
    onReorder: (fromIndex: number, toIndex: number) => void
}

/** Sortable list of intervals for the block creator. */
function SortableIntervalList({
    intervals,
    selectedIndex,
    onSelect,
    onDelete,
    onReorder,
}: SortableListProps): JSX.Element {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )
    // Stable string IDs using index, intervals have no intrinsic ID
    const itemIds = intervals.map((_, i) => `interval-${i}`)

    function handleDragEnd(event: DragEndEvent): void {
        const { active, over } = event
        if (over === null || active.id === over.id) {
            return
        }
        const fromIndex = itemIds.indexOf(String(active.id))
        const toIndex = itemIds.indexOf(String(over.id))
        if (fromIndex === -1 || toIndex === -1) {
            return
        }
        onReorder(fromIndex, toIndex)
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                <ul className="flex flex-col gap-1">
                    {intervals.map((interval, index) => (
                        <SortableIntervalRow
                            key={`interval-${index}`}
                            id={`interval-${index}`}
                            interval={interval}
                            isSelected={selectedIndex === index}
                            onSelect={() => onSelect(index)}
                            onDelete={() => onDelete(index)}
                        />
                    ))}
                </ul>
            </SortableContext>
        </DndContext>
    )
}

interface SortableRowProps {
    id: string
    interval: ParsedInterval
    isSelected: boolean
    onSelect: () => void
    onDelete: () => void
}

/** A single draggable interval row in the block creator list. */
function SortableIntervalRow({
    id,
    interval,
    isSelected,
    onSelect,
    onDelete,
}: SortableRowProps): JSX.Element {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
    }

    return (
        <li
            ref={setNodeRef}
            style={style}
            className={`
                flex items-center justify-between gap-3
                px-3 py-2
                bg-zinc-800 border rounded
                ${isSelected ? 'border-brand-500' : 'border-zinc-700'}
            `}
        >
            <button
                type="button"
                {...attributes}
                {...listeners}
                aria-label="Drag to reorder"
                className="text-zinc-500 hover:text-zinc-300 cursor-grab focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-800 rounded"
            >
                ⋮⋮
            </button>
            <button
                type="button"
                onClick={onSelect}
                className="flex-1 text-left text-sm text-white truncate focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-800 rounded"
            >
                {summariseInterval(interval)}
            </button>
            <button
                type="button"
                onClick={onDelete}
                className={`
                    px-2 py-1
                    bg-red-900/50 text-red-200
                    label-tiny
                    rounded
                    hover:bg-red-800 transition-colors
                    focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 focus:ring-offset-zinc-800
                `}
            >
                Delete
            </button>
        </li>
    )
}

/** Short human-readable summary of an interval for the list row. */
function summariseInterval(interval: ParsedInterval): string {
    const minutes = Math.floor(interval.durationSeconds / 60)
    const seconds = interval.durationSeconds % 60
    const duration = seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`

    switch (interval.type) {
        case 'SteadyState':
            return `Steady ${duration} @ ${formatPercent(interval.power)} FTP`
        case 'Warmup':
        case 'Cooldown':
        case 'Ramp':
            return `${interval.type} ${duration} ${formatPercent(interval.power)} → ${formatPercent(interval.powerHigh)} FTP`
        case 'IntervalsT':
            return `Intervals ${interval.repeat ?? 0} × (${interval.onDuration ?? 0}s @ ${formatPercent(interval.onPower)} / ${interval.offDuration ?? 0}s @ ${formatPercent(interval.offPower)})`
        case 'FreeRide':
            return `Free Ride ${duration}`
    }
}

function formatPercent(power: number | null): string {
    if (power === null) return '–'
    return `${Math.round(power * 100)}%`
}
