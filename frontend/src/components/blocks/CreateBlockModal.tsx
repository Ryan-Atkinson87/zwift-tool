import { useState, type JSX } from 'react'
import { saveBlock, updateBlock, type LibraryBlock } from '../../api/blocks'
import { BlockPreview } from './BlockPreview'
import type { ParsedInterval, SectionType } from '../../types/workout'
import type { ZonePresetView } from '../../api/zonePresets'
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
    /** Effective zone presets used to populate zone palette items in the interval palette. */
    zonePresets?: ZonePresetView[]
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
 * constant for the create case) so React remounts the modal, and resets all
 * local state, when switching between blocks.</p>
 */
export function CreateBlockModal({ isOpen, onClose, onSaved, initialBlock = null, zonePresets }: Props): JSX.Element | null {
    const [sectionType, setSectionType] = useState<SectionType>(initialBlock?.sectionType ?? 'MAINSET')
    const [intervals, setIntervals] = useState<ParsedInterval[]>(
        initialBlock !== null && initialBlock.content.trim().length > 0
            ? (JSON.parse(initialBlock.content) as ParsedInterval[])
            : [],
    )
    const [name, setName] = useState(initialBlock?.name ?? '')
    const [description, setDescription] = useState(initialBlock?.description ?? '')
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
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
        setError(null)
        onClose()
    }

    /**
     * Inserts a new interval at the given index. Called by the palette drag-and-drop
     * system when the user drops a palette item onto the preview chart.
     */
    function handleAddInterval(interval: ParsedInterval, insertIndex: number): void {
        setIntervals((prev) => {
            const idx = Math.min(insertIndex, prev.length)
            return [...prev.slice(0, idx), interval, ...prev.slice(idx)]
        })
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

                    {/* Live preview with interval palette */}
                    <div className="flex flex-col gap-1">
                        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                            Preview
                        </p>
                        <BlockPreview
                            block={previewBlock}
                            onReorder={handleReorder}
                            onAddInterval={handleAddInterval}
                            zonePresets={zonePresets}
                            selectedIntervalIndex={selectedIndex}
                            onSelectInterval={(i) => setSelectedIndex(i)}
                            onUpdateInterval={handleUpdateInterval}
                            onDeleteInterval={handleDeleteInterval}
                        />
                    </div>

                    {/* Intervals */}
                    <div className="flex flex-col gap-2">
                        <p className="text-sm font-semibold text-zinc-300">Intervals</p>

                        {intervals.length === 0 ? (
                            <p className="text-xs text-zinc-500 italic">
                                No intervals yet. Drag an interval type from the palette above onto the chart to get started.
                            </p>
                        ) : (
                            <IntervalList
                                intervals={intervals}
                                selectedIndex={selectedIndex}
                                onSelect={(index) =>
                                    setSelectedIndex((prev) => (prev === index ? null : index))
                                }
                                onDelete={handleDeleteInterval}
                                onUpdate={handleUpdateInterval}
                            />
                        )}
                    </div>

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

            </div>
        </div>
    )
}

interface IntervalListProps {
    intervals: ParsedInterval[]
    selectedIndex: number | null
    onSelect: (index: number) => void
    onDelete: (index: number) => void
    onUpdate: (index: number, next: ParsedInterval) => void
}

/** Editable list of intervals for the block creator. Each row exposes inline inputs for the interval's key fields. */
function IntervalList({
    intervals,
    selectedIndex,
    onSelect,
    onDelete,
    onUpdate,
}: IntervalListProps): JSX.Element {
    return (
        <ul className="flex flex-col gap-2">
            {intervals.map((interval, index) => (
                <IntervalRow
                    key={`interval-${index}`}
                    interval={interval}
                    isSelected={selectedIndex === index}
                    onSelect={() => onSelect(index)}
                    onDelete={() => onDelete(index)}
                    onUpdate={(next) => onUpdate(index, next)}
                />
            ))}
        </ul>
    )
}

interface IntervalRowProps {
    interval: ParsedInterval
    isSelected: boolean
    onSelect: () => void
    onDelete: () => void
    onUpdate: (next: ParsedInterval) => void
}

const INPUT_CLASS = 'w-16 px-2 py-1 bg-zinc-700 text-white text-xs rounded border border-zinc-600 focus:outline-none focus:border-brand-500'
const FIELD_LABEL_CLASS = 'text-xs text-zinc-400'

/**
 * A single editable interval row. Each field holds its own local string state
 * so intermediate values (e.g. an empty box mid-edit) are allowed while typing.
 * The parsed value is committed to the parent only on blur. If the committed
 * value is invalid the field resets to the last valid value from the interval.
 */
function IntervalRow({ interval, isSelected, onSelect, onDelete, onUpdate }: IntervalRowProps): JSX.Element {
    const [powerStr, setPowerStr] = useState(
        interval.power !== null ? String(Math.round(interval.power * 100)) : ''
    )
    const [powerHighStr, setPowerHighStr] = useState(
        interval.powerHigh !== null ? String(Math.round(interval.powerHigh * 100)) : ''
    )
    const [durationStr, setDurationStr] = useState(String(interval.durationSeconds))
    const [repeatStr, setRepeatStr] = useState(String(interval.repeat ?? 1))
    const [onDurationStr, setOnDurationStr] = useState(String(interval.onDuration ?? 0))
    const [offDurationStr, setOffDurationStr] = useState(String(interval.offDuration ?? 0))
    const [onPowerStr, setOnPowerStr] = useState(
        interval.onPower !== null ? String(Math.round(interval.onPower * 100)) : ''
    )
    const [offPowerStr, setOffPowerStr] = useState(
        interval.offPower !== null ? String(Math.round(interval.offPower * 100)) : ''
    )

    function commitPower(): void {
        const n = parseInt(powerStr, 10)
        if (!isNaN(n) && n >= 0) {
            onUpdate({ ...interval, power: n / 100 })
        } else {
            setPowerStr(interval.power !== null ? String(Math.round(interval.power * 100)) : '')
        }
    }

    function commitPowerHigh(): void {
        const n = parseInt(powerHighStr, 10)
        if (!isNaN(n) && n >= 0) {
            onUpdate({ ...interval, powerHigh: n / 100 })
        } else {
            setPowerHighStr(interval.powerHigh !== null ? String(Math.round(interval.powerHigh * 100)) : '')
        }
    }

    function commitDuration(): void {
        const n = parseInt(durationStr, 10)
        if (!isNaN(n) && n >= 1) {
            onUpdate({ ...interval, durationSeconds: n })
        } else {
            setDurationStr(String(interval.durationSeconds))
        }
    }

    function commitRepeat(): void {
        const n = parseInt(repeatStr, 10)
        if (!isNaN(n) && n >= 1) {
            const onDur = parseInt(onDurationStr, 10)
            const offDur = parseInt(offDurationStr, 10)
            const newDuration = (!isNaN(onDur) && !isNaN(offDur)) ? n * (onDur + offDur) : interval.durationSeconds
            onUpdate({ ...interval, repeat: n, durationSeconds: newDuration })
        } else {
            setRepeatStr(String(interval.repeat ?? 1))
        }
    }

    function commitOnDuration(): void {
        const n = parseInt(onDurationStr, 10)
        if (!isNaN(n) && n >= 1) {
            const repeat = parseInt(repeatStr, 10) || (interval.repeat ?? 1)
            const offDur = parseInt(offDurationStr, 10)
            const newDuration = !isNaN(offDur) ? repeat * (n + offDur) : interval.durationSeconds
            onUpdate({ ...interval, onDuration: n, durationSeconds: newDuration })
        } else {
            setOnDurationStr(String(interval.onDuration ?? 0))
        }
    }

    function commitOffDuration(): void {
        const n = parseInt(offDurationStr, 10)
        if (!isNaN(n) && n >= 0) {
            const repeat = parseInt(repeatStr, 10) || (interval.repeat ?? 1)
            const onDur = parseInt(onDurationStr, 10)
            const newDuration = !isNaN(onDur) ? repeat * (onDur + n) : interval.durationSeconds
            onUpdate({ ...interval, offDuration: n, durationSeconds: newDuration })
        } else {
            setOffDurationStr(String(interval.offDuration ?? 0))
        }
    }

    function commitOnPower(): void {
        const n = parseInt(onPowerStr, 10)
        if (!isNaN(n) && n >= 0) {
            onUpdate({ ...interval, onPower: n / 100 })
        } else {
            setOnPowerStr(interval.onPower !== null ? String(Math.round(interval.onPower * 100)) : '')
        }
    }

    function commitOffPower(): void {
        const n = parseInt(offPowerStr, 10)
        if (!isNaN(n) && n >= 0) {
            onUpdate({ ...interval, offPower: n / 100 })
        } else {
            setOffPowerStr(interval.offPower !== null ? String(Math.round(interval.offPower * 100)) : '')
        }
    }

    const typeLabel: Record<ParsedInterval['type'], string> = {
        SteadyState: 'Steady State',
        Warmup: 'Warmup',
        Cooldown: 'Cooldown',
        Ramp: 'Ramp',
        IntervalsT: 'Intervals',
        FreeRide: 'Free Ride',
    }

    return (
        <li className={`
            flex flex-col gap-2
            px-3 py-2
            bg-zinc-800 border rounded
            ${isSelected ? 'border-brand-500' : 'border-zinc-700'}
        `}>
            <div className="flex items-center justify-between">
                <button
                    type="button"
                    onClick={onSelect}
                    className="label-tiny text-zinc-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-800 rounded"
                >
                    {typeLabel[interval.type]}
                </button>
                <button
                    type="button"
                    onClick={onDelete}
                    className="px-2 py-1 bg-red-900/50 text-red-200 label-tiny rounded hover:bg-red-800 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 focus:ring-offset-zinc-800"
                >
                    Delete
                </button>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {interval.type === 'SteadyState' && (
                    <>
                        <PowerField label="Intensity" value={powerStr} onChange={setPowerStr} onBlur={commitPower} />
                        <DurationField value={durationStr} onChange={setDurationStr} onBlur={commitDuration} />
                    </>
                )}
                {(interval.type === 'Warmup' || interval.type === 'Cooldown' || interval.type === 'Ramp') && (
                    <>
                        <PowerField label="Start" value={powerStr} onChange={setPowerStr} onBlur={commitPower} />
                        <PowerField label="End" value={powerHighStr} onChange={setPowerHighStr} onBlur={commitPowerHigh} />
                        <DurationField value={durationStr} onChange={setDurationStr} onBlur={commitDuration} />
                    </>
                )}
                {interval.type === 'IntervalsT' && (
                    <>
                        <div className="flex items-center gap-1">
                            <span className={FIELD_LABEL_CLASS}>Repeats</span>
                            <input
                                type="number"
                                min={1}
                                value={repeatStr}
                                onChange={(e) => setRepeatStr(e.target.value)}
                                onBlur={commitRepeat}
                                className={INPUT_CLASS}
                            />
                        </div>
                        <div className="flex items-center gap-1">
                            <span className={FIELD_LABEL_CLASS}>On</span>
                            <input
                                type="number"
                                min={1}
                                value={onDurationStr}
                                onChange={(e) => setOnDurationStr(e.target.value)}
                                onBlur={commitOnDuration}
                                className={INPUT_CLASS}
                            />
                            <DurationHint value={onDurationStr} />
                            <span className={FIELD_LABEL_CLASS}>@</span>
                            <input
                                type="number"
                                min={0}
                                max={150}
                                value={onPowerStr}
                                onChange={(e) => setOnPowerStr(e.target.value)}
                                onBlur={commitOnPower}
                                className={INPUT_CLASS}
                            />
                            <span className="text-xs text-zinc-400">%</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className={FIELD_LABEL_CLASS}>Off</span>
                            <input
                                type="number"
                                min={0}
                                value={offDurationStr}
                                onChange={(e) => setOffDurationStr(e.target.value)}
                                onBlur={commitOffDuration}
                                className={INPUT_CLASS}
                            />
                            <DurationHint value={offDurationStr} />
                            <span className={FIELD_LABEL_CLASS}>@</span>
                            <input
                                type="number"
                                min={0}
                                max={150}
                                value={offPowerStr}
                                onChange={(e) => setOffPowerStr(e.target.value)}
                                onBlur={commitOffPower}
                                className={INPUT_CLASS}
                            />
                            <span className="text-xs text-zinc-400">%</span>
                        </div>
                    </>
                )}
                {interval.type === 'FreeRide' && (
                    <DurationField value={durationStr} onChange={setDurationStr} onBlur={commitDuration} />
                )}
            </div>
        </li>
    )
}

interface PowerFieldProps {
    label: string
    value: string
    onChange: (value: string) => void
    onBlur: () => void
}

/** Labelled percentage input for a power field. Operates on a local string so partial edits are allowed while typing. */
function PowerField({ label, value, onChange, onBlur }: PowerFieldProps): JSX.Element {
    return (
        <div className="flex items-center gap-1">
            <span className={FIELD_LABEL_CLASS}>{label}</span>
            <input
                type="number"
                min={0}
                max={150}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                className={INPUT_CLASS}
            />
            <span className="text-xs text-zinc-400">%</span>
        </div>
    )
}

interface DurationFieldProps {
    value: string
    onChange: (value: string) => void
    onBlur: () => void
}

/** Labelled seconds input with a bracketed minutes display alongside it. Operates on a local string so partial edits are allowed while typing. */
function DurationField({ value, onChange, onBlur }: DurationFieldProps): JSX.Element {
    return (
        <div className="flex items-center gap-1">
            <span className={FIELD_LABEL_CLASS}>Duration</span>
            <input
                type="number"
                min={1}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                className={INPUT_CLASS}
            />
            <DurationHint value={value} />
        </div>
    )
}

/** Renders the bracketed minutes hint for a seconds string value. Hidden when the string cannot be parsed. */
function DurationHint({ value }: { value: string }): JSX.Element | null {
    const seconds = parseInt(value, 10)
    if (isNaN(seconds) || seconds < 0) return null
    return <span className="text-xs text-zinc-500">s ({formatDurationMins(seconds)})</span>
}

/** Formats a duration in seconds as a human-readable minutes string, e.g. "10m" or "10m 30s". */
function formatDurationMins(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return s === 0 ? `${m}m` : `${m}m ${s}s`
}
