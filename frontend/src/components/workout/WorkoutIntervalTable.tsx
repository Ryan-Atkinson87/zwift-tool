import { useState, type JSX } from 'react'
import type { BlockDetail, ParsedInterval, SectionType, WorkoutDetail } from '../../types/workout'

interface Props {
    workout: WorkoutDetail
    /**
     * Called when the user commits an edited interval value on blur.
     * The parent is responsible for updating the workout and triggering auto-save.
     */
    onUpdate: (sectionType: SectionType, index: number, next: ParsedInterval) => void
    /**
     * Called when the user clicks Delete on an interval row.
     * The parent enforces the rule that the main set must keep at least one interval.
     */
    onDelete: (sectionType: SectionType, index: number) => void
}

const SECTION_LABELS: Record<SectionType, string> = {
    WARMUP: 'Warm-Up',
    MAINSET: 'Main Set',
    COOLDOWN: 'Cool-Down',
}

/**
 * Editable table of all intervals in a workout, grouped by section.
 * Rendered below the text event editor in the centre panel.
 * Each row exposes inline number inputs for intensity, duration, and repeats.
 * Values are committed to the parent only on blur so partial edits are allowed
 * while typing.
 */
export function WorkoutIntervalTable({ workout, onUpdate, onDelete }: Props): JSX.Element {
    const sections: Array<{ type: SectionType; block: BlockDetail | null }> = [
        { type: 'WARMUP', block: workout.warmupBlock },
        { type: 'MAINSET', block: workout.mainsetBlock },
        { type: 'COOLDOWN', block: workout.cooldownBlock },
    ]

    const populated = sections.filter(
        (s): s is { type: SectionType; block: BlockDetail } =>
            s.block !== null && s.block.intervals.length > 0,
    )

    return (
        <div className="flex flex-col w-full gap-3">
            <p className="text-xs font-semibold tracking-wide uppercase text-zinc-300">
                Intervals
            </p>
            {populated.map(({ type, block }) => (
                <SectionGroup
                    key={type}
                    sectionType={type}
                    block={block}
                    isSingleMainset={type === 'MAINSET' && block.intervals.length <= 1}
                    onUpdate={(index, next) => onUpdate(type, index, next)}
                    onDelete={(index) => onDelete(type, index)}
                />
            ))}
        </div>
    )
}

interface SectionGroupProps {
    sectionType: SectionType
    block: BlockDetail
    /** True when this is the main set with only one interval. Prevents delete. */
    isSingleMainset: boolean
    onUpdate: (index: number, next: ParsedInterval) => void
    onDelete: (index: number) => void
}

function SectionGroup({ sectionType, block, isSingleMainset, onUpdate, onDelete }: SectionGroupProps): JSX.Element {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <div className="flex flex-col gap-1">
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className="flex items-center gap-1.5 w-full text-left focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-zinc-900 rounded"
                aria-expanded={isOpen}
            >
                <svg
                    className="w-3 h-3 text-zinc-500 flex-shrink-0 transition-transform"
                    style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                >
                    <path
                        fillRule="evenodd"
                        d="M7.293 4.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L11.586 10 7.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                    />
                </svg>
                <p className="label-tiny text-zinc-500">{SECTION_LABELS[sectionType]}</p>
                <span className="label-tiny text-zinc-600">{formatDurationMins(block.durationSeconds)}</span>
                <span className="label-tiny text-zinc-700 ml-auto">{block.intervals.length} interval{block.intervals.length !== 1 ? 's' : ''}</span>
            </button>
            {isOpen && (
                <ul className="flex flex-col gap-1">
                    {block.intervals.map((interval, index) => (
                        <IntervalRow
                            key={`${sectionType}-${index}`}
                            interval={interval}
                            deleteDisabled={isSingleMainset}
                            onUpdate={(next) => onUpdate(index, next)}
                            onDelete={() => onDelete(index)}
                        />
                    ))}
                </ul>
            )}
        </div>
    )
}

interface IntervalRowProps {
    interval: ParsedInterval
    deleteDisabled: boolean
    onUpdate: (next: ParsedInterval) => void
    onDelete: () => void
}

/**
 * A single editable interval row. Each field holds its own local string state
 * so partial edits are allowed while typing. Values are committed to the parent
 * only on blur. Invalid values on blur reset to the last committed state.
 */
function IntervalRow({ interval, deleteDisabled, onUpdate, onDelete }: IntervalRowProps): JSX.Element {
    const [powerStr, setPowerStr] = useState(
        interval.power !== null ? String(Number((interval.power * 100).toFixed(1))) : '',
    )
    const [powerHighStr, setPowerHighStr] = useState(
        interval.powerHigh !== null ? String(Number((interval.powerHigh * 100).toFixed(1))) : '',
    )
    const [durationStr, setDurationStr] = useState(String(interval.durationSeconds))
    const [repeatStr, setRepeatStr] = useState(String(interval.repeat ?? 1))
    const [onDurationStr, setOnDurationStr] = useState(String(interval.onDuration ?? 0))
    const [offDurationStr, setOffDurationStr] = useState(String(interval.offDuration ?? 0))
    const [onPowerStr, setOnPowerStr] = useState(
        interval.onPower !== null ? String(Number((interval.onPower * 100).toFixed(1))) : '',
    )
    const [offPowerStr, setOffPowerStr] = useState(
        interval.offPower !== null ? String(Number((interval.offPower * 100).toFixed(1))) : '',
    )

    function commitPower(): void {
        const n = parseFloat(powerStr)
        if (!isNaN(n) && n >= 0) {
            onUpdate({ ...interval, power: n / 100 })
        } else {
            setPowerStr(interval.power !== null ? String(Number((interval.power * 100).toFixed(1))) : '')
        }
    }

    function commitPowerHigh(): void {
        const n = parseFloat(powerHighStr)
        if (!isNaN(n) && n >= 0) {
            onUpdate({ ...interval, powerHigh: n / 100 })
        } else {
            setPowerHighStr(interval.powerHigh !== null ? String(Number((interval.powerHigh * 100).toFixed(1))) : '')
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
        const n = parseFloat(onPowerStr)
        if (!isNaN(n) && n >= 0) {
            onUpdate({ ...interval, onPower: n / 100 })
        } else {
            setOnPowerStr(interval.onPower !== null ? String(Number((interval.onPower * 100).toFixed(1))) : '')
        }
    }

    function commitOffPower(): void {
        const n = parseFloat(offPowerStr)
        if (!isNaN(n) && n >= 0) {
            onUpdate({ ...interval, offPower: n / 100 })
        } else {
            setOffPowerStr(interval.offPower !== null ? String(Number((interval.offPower * 100).toFixed(1))) : '')
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
        <li className="flex flex-col gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded">
            <div className="flex items-center justify-between">
                <span className="label-tiny text-zinc-300">{typeLabel[interval.type]}</span>
                <button
                    type="button"
                    onClick={onDelete}
                    disabled={deleteDisabled}
                    className={`
                        px-2 py-1
                        bg-red-900/50 text-red-200
                        label-tiny
                        rounded
                        hover:bg-red-800 transition-colors
                        focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 focus:ring-offset-zinc-800
                        disabled:opacity-50 disabled:cursor-not-allowed
                    `}
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

const INPUT_CLASS = 'w-16 px-2 py-1 bg-zinc-700 text-white text-xs rounded border border-zinc-600 focus:outline-none focus:border-brand-500'
const FIELD_LABEL_CLASS = 'text-xs text-zinc-400'

interface PowerFieldProps {
    label: string
    value: string
    onChange: (value: string) => void
    onBlur: () => void
}

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

/** Renders the bracketed minutes hint. Hidden while the string cannot be parsed. */
function DurationHint({ value }: { value: string }): JSX.Element | null {
    const seconds = parseInt(value, 10)
    if (isNaN(seconds) || seconds < 0) return null
    return <span className="text-xs text-zinc-500">s ({formatDurationMins(seconds)})</span>
}

function formatDurationMins(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return s === 0 ? `${m}m` : `${m}m ${s}s`
}
