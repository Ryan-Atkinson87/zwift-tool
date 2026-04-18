import { useEffect, useState, type JSX } from 'react'
import type { ParsedInterval, SectionType, WorkoutDetail } from '../../types/workout'

interface Props {
    workout: WorkoutDetail
    selection: { sectionType: SectionType; intervalIndex: number }
    onChange: (sectionType: SectionType, index: number, next: ParsedInterval) => void
    onClose: () => void
    onDelete: (sectionType: SectionType, index: number) => void
}

/**
 * Inline editor panel rendered below the workout canvas. Shows the
 * editable fields for the currently selected interval and pushes every
 * change up through {@code onChange} so the parent can flow the edit
 * through the optimistic update + auto-save pipeline.
 *
 * <p>The form adapts to the interval's type: SteadyState shows duration,
 * power, and cadence; Ramp adds a start/end power pair; IntervalsT shows
 * its repeat and on/off pair; Free Ride is duration only. Cadence is
 * optional on every type.</p>
 */
export function IntervalEditor({
    workout,
    selection,
    onChange,
    onClose,
    onDelete,
}: Props): JSX.Element | null {
    const block = sectionBlock(workout, selection.sectionType)
    const interval = block?.intervals[selection.intervalIndex] ?? null

    // Local form state mirrors the interval so the inputs feel responsive.
    // It is reseeded whenever the selected interval changes (different
    // index, different section, or a fresh server response that updated
    // the underlying interval).
    const [draft, setDraft] = useState<ParsedInterval | null>(interval)

    useEffect(() => {
        setDraft(interval)
    }, [interval])

    if (interval === null || draft === null) {
        return null
    }

    function emit(next: ParsedInterval): void {
        setDraft(next)
        onChange(selection.sectionType, selection.intervalIndex, next)
    }

    return (
        <div
            className={`
                flex flex-col w-full gap-3
                px-4 py-3
                bg-zinc-800/60 border border-zinc-700
                rounded-lg
            `}
        >
            <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">
                    Edit {labelForType(interval.type)} block
                </p>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onDelete(selection.sectionType, selection.intervalIndex)}
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
                        onClick={onClose}
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

            <IntervalFields draft={draft} onChange={emit} />
        </div>
    )
}

export interface IntervalFieldsProps {
    draft: ParsedInterval
    onChange: (next: ParsedInterval) => void
}

/** Renders the per-type field set for the interval being edited. */
export function IntervalFields({ draft, onChange }: IntervalFieldsProps): JSX.Element {
    if (draft.type === 'IntervalsT') {
        return (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <DurationField
                    label="On duration"
                    seconds={draft.onDuration ?? 0}
                    onChange={(next) =>
                        onChange({
                            ...draft,
                            onDuration: next,
                            durationSeconds:
                                (draft.repeat ?? 0) * (next + (draft.offDuration ?? 0)),
                        })
                    }
                />
                <FtpField
                    label="On %FTP"
                    powerFraction={draft.onPower}
                    onChange={(next) => onChange({ ...draft, onPower: next })}
                />
                <DurationField
                    label="Off duration"
                    seconds={draft.offDuration ?? 0}
                    onChange={(next) =>
                        onChange({
                            ...draft,
                            offDuration: next,
                            durationSeconds:
                                (draft.repeat ?? 0) * ((draft.onDuration ?? 0) + next),
                        })
                    }
                />
                <FtpField
                    label="Off %FTP"
                    powerFraction={draft.offPower}
                    onChange={(next) => onChange({ ...draft, offPower: next })}
                />
                <NumberField
                    label="Repeat"
                    value={draft.repeat ?? 0}
                    min={1}
                    onChange={(next) =>
                        onChange({
                            ...draft,
                            repeat: next,
                            durationSeconds:
                                next * ((draft.onDuration ?? 0) + (draft.offDuration ?? 0)),
                        })
                    }
                />
                <CadenceField
                    cadence={draft.cadence}
                    onChange={(next) => onChange({ ...draft, cadence: next })}
                />
            </div>
        )
    }

    const isRamp =
        draft.type === 'Warmup' || draft.type === 'Cooldown' || draft.type === 'Ramp'

    if (isRamp) {
        return (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <DurationField
                    label="Duration"
                    seconds={draft.durationSeconds}
                    onChange={(next) => onChange({ ...draft, durationSeconds: next })}
                />
                <FtpField
                    label="Start %FTP"
                    powerFraction={draft.power}
                    onChange={(next) => onChange({ ...draft, power: next })}
                />
                <FtpField
                    label="End %FTP"
                    powerFraction={draft.powerHigh}
                    onChange={(next) => onChange({ ...draft, powerHigh: next })}
                />
                <CadenceField
                    cadence={draft.cadence}
                    onChange={(next) => onChange({ ...draft, cadence: next })}
                />
            </div>
        )
    }

    if (draft.type === 'FreeRide') {
        return (
            <div className="grid grid-cols-2 gap-3">
                <DurationField
                    label="Duration"
                    seconds={draft.durationSeconds}
                    onChange={(next) => onChange({ ...draft, durationSeconds: next })}
                />
                <CadenceField
                    cadence={draft.cadence}
                    onChange={(next) => onChange({ ...draft, cadence: next })}
                />
            </div>
        )
    }

    // SteadyState
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <DurationField
                label="Duration"
                seconds={draft.durationSeconds}
                onChange={(next) => onChange({ ...draft, durationSeconds: next })}
            />
            <FtpField
                label="%FTP"
                powerFraction={draft.power}
                onChange={(next) => onChange({ ...draft, power: next })}
            />
            <CadenceField
                cadence={draft.cadence}
                onChange={(next) => onChange({ ...draft, cadence: next })}
            />
        </div>
    )
}

interface DurationFieldProps {
    label: string
    seconds: number
    onChange: (nextSeconds: number) => void
}

/** Two-input duration field with separate minutes and seconds boxes. */
function DurationField({ label, seconds, onChange }: DurationFieldProps): JSX.Element {
    const minutes = Math.floor(seconds / 60)
    const remaining = seconds % 60
    return (
        <label className="flex flex-col gap-1 text-xs">
            <span className="text-zinc-400">{label}</span>
            <div className="flex items-center gap-1">
                <input
                    type="number"
                    min={0}
                    value={minutes}
                    onChange={(e) => {
                        const next = Number(e.target.value)
                        if (!Number.isNaN(next) && next >= 0) {
                            onChange(next * 60 + remaining)
                        }
                    }}
                    className={`
                        w-full px-2 py-1
                        bg-zinc-900 text-white text-sm
                        border border-zinc-700 rounded
                        focus:outline-none focus:border-brand-500
                    `}
                />
                <span className="text-zinc-500 text-xs">m</span>
                <input
                    type="number"
                    min={0}
                    max={59}
                    value={remaining}
                    onChange={(e) => {
                        const next = Number(e.target.value)
                        if (!Number.isNaN(next) && next >= 0 && next < 60) {
                            onChange(minutes * 60 + next)
                        }
                    }}
                    className={`
                        w-full px-2 py-1
                        bg-zinc-900 text-white text-sm
                        border border-zinc-700 rounded
                        focus:outline-none focus:border-brand-500
                    `}
                />
                <span className="text-zinc-500 text-xs">s</span>
            </div>
        </label>
    )
}

interface FtpFieldProps {
    label: string
    powerFraction: number | null
    onChange: (nextFraction: number) => void
}

/** %FTP input that round-trips between decimal percent and 0..1 fraction. Preserves one decimal place of precision. */
function FtpField({ label, powerFraction, onChange }: FtpFieldProps): JSX.Element {
    const percent = powerFraction !== null ? Number((powerFraction * 100).toFixed(1)) : 0
    return (
        <NumberField
            label={label}
            value={percent}
            min={0}
            onChange={(next) => onChange(next / 100)}
        />
    )
}

interface CadenceFieldProps {
    cadence: number | null
    onChange: (next: number | null) => void
}

/** Optional cadence input. Empty string clears the value to null. */
function CadenceField({ cadence, onChange }: CadenceFieldProps): JSX.Element {
    return (
        <label className="flex flex-col gap-1 text-xs">
            <span className="text-zinc-400">Cadence (RPM)</span>
            <input
                type="number"
                min={0}
                value={cadence ?? ''}
                placeholder="optional"
                onChange={(e) => {
                    const raw = e.target.value
                    if (raw === '') {
                        onChange(null)
                        return
                    }
                    const next = Number(raw)
                    if (!Number.isNaN(next) && next >= 0) {
                        onChange(next)
                    }
                }}
                className={`
                    px-2 py-1
                    bg-zinc-900 text-white text-sm
                    border border-zinc-700 rounded
                    focus:outline-none focus:border-brand-500
                `}
            />
        </label>
    )
}

interface NumberFieldProps {
    label: string
    value: number
    onChange: (next: number) => void
    min?: number
    max?: number
}

/** Labelled numeric input shared by the field types above. */
function NumberField({ label, value, onChange, min, max }: NumberFieldProps): JSX.Element {
    return (
        <label className="flex flex-col gap-1 text-xs">
            <span className="text-zinc-400">{label}</span>
            <input
                type="number"
                value={value}
                min={min}
                max={max}
                onChange={(e) => {
                    const next = Number(e.target.value)
                    if (!Number.isNaN(next)) {
                        onChange(next)
                    }
                }}
                className={`
                    px-2 py-1
                    bg-zinc-900 text-white text-sm
                    border border-zinc-700 rounded
                    focus:outline-none focus:border-brand-500
                `}
            />
        </label>
    )
}

/** Returns the section's block detail, or null when the section is absent. */
function sectionBlock(workout: WorkoutDetail, sectionType: SectionType) {
    switch (sectionType) {
        case 'WARMUP':
            return workout.warmupBlock
        case 'MAINSET':
            return workout.mainsetBlock
        case 'COOLDOWN':
            return workout.cooldownBlock
    }
}

/** Display label for an interval type. */
function labelForType(type: ParsedInterval['type']): string {
    switch (type) {
        case 'SteadyState':
            return 'Steady State'
        case 'IntervalsT':
            return 'Intervals'
        case 'FreeRide':
            return 'Free Ride'
        case 'Warmup':
            return 'Warm-Up'
        case 'Cooldown':
            return 'Cool-Down'
        case 'Ramp':
            return 'Ramp'
    }
}
