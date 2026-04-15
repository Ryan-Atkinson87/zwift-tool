/**
 * Allows the user to define section boundaries on an imported workout
 * by dragging two dividers: warm-up end and cool-down start.
 *
 * Intervals are displayed as a flat list with two draggable divider
 * positions that snap to interval boundaries. The user confirms
 * the split to save the workout.
 */

import { useState, type JSX } from 'react'
import type { ParsedInterval, ParsedWorkout } from '../../types/workout'
import { getZoneForPower } from '../../utils/zoneColours'
import { getColourForZone } from '../../utils/zoneColours'

interface Props {
    workout: ParsedWorkout
    onConfirm: (split: SectionSplit) => void
    onCancel: () => void
    isSaving: boolean
}

/** The result of splitting a workout into three sections. */
export interface SectionSplit {
    workout: ParsedWorkout
    warmupIntervals: ParsedInterval[]
    mainsetIntervals: ParsedInterval[]
    cooldownIntervals: ParsedInterval[]
}

/**
 * Renders a workout's intervals as a flat list with two draggable dividers.
 * The warm-up end divider sits between intervals, as does the cool-down start
 * divider. Moving a divider to position 0 omits the warm-up; moving it to
 * the end omits the cool-down. The main set cannot be empty.
 */
export function SectionSplitter({ workout, onConfirm, onCancel, isSaving }: Props): JSX.Element {
    const intervalCount = workout.intervals.length

    // warmupEnd: number of intervals in the warm-up (0 = no warm-up)
    // cooldownStart: index where cool-down begins (intervalCount = no cool-down)
    const [warmupEnd, setWarmupEnd] = useState(0)
    const [cooldownStart, setCooldownStart] = useState(intervalCount)

    // Dragging state
    const [dragging, setDragging] = useState<'warmup' | 'cooldown' | null>(null)

    const mainsetIsEmpty = warmupEnd >= cooldownStart

    function handleConfirm(): void {
        if (mainsetIsEmpty) return

        const warmupIntervals = workout.intervals.slice(0, warmupEnd)
        const mainsetIntervals = workout.intervals.slice(warmupEnd, cooldownStart)
        const cooldownIntervals = workout.intervals.slice(cooldownStart)

        onConfirm({
            workout,
            warmupIntervals,
            mainsetIntervals,
            cooldownIntervals,
        })
    }

    function handleDividerDrop(position: number): void {
        if (dragging === 'warmup') {
            // Warm-up end cannot go past cool-down start
            setWarmupEnd(Math.min(position, cooldownStart))
        } else if (dragging === 'cooldown') {
            // Cool-down start cannot go before warm-up end
            setCooldownStart(Math.max(position, warmupEnd))
        }
        setDragging(null)
    }

    function getSectionLabel(index: number): string {
        if (index < warmupEnd) return 'Warm-Up'
        if (index < cooldownStart) return 'Main Set'
        return 'Cool-Down'
    }

    function getSectionColour(index: number): string {
        if (index < warmupEnd) return 'border-l-blue-500'
        if (index < cooldownStart) return 'border-l-brand-500'
        return 'border-l-purple-500'
    }

    return (
        <div className="flex flex-col gap-4 w-full max-w-2xl">
            <div className="flex items-center justify-between">
                <h3 className="text-white text-lg font-semibold">{workout.name}</h3>
                <p className="text-zinc-500 text-sm">{workout.fileName}</p>
            </div>

            <p className="text-zinc-400 text-sm">
                Drag the dividers to define where the warm-up ends and cool-down begins.
            </p>

            <div className="flex flex-col">
                {/* Warm-up divider at top of list when not yet placed */}
                {warmupEnd === 0 && (
                    <InlineDivider
                        label="Warm-Up End: drag down to set warm-up"
                        type="warmup"
                        onDragStart={() => setDragging('warmup')}
                        onDragEnd={() => setDragging(null)}
                        isDefault
                    />
                )}

                {workout.intervals.map((interval, index) => (
                    <div key={index}>
                        {/* Render warm-up divider at its placed position */}
                        {index === warmupEnd && warmupEnd > 0 && (
                            <InlineDivider
                                label="Warm-Up End"
                                type="warmup"
                                onDragStart={() => setDragging('warmup')}
                                onDragEnd={() => setDragging(null)}
                            />
                        )}

                        {/* Render cool-down divider at its placed position */}
                        {index === cooldownStart && cooldownStart < intervalCount && (
                            <InlineDivider
                                label="Cool-Down Start"
                                type="cooldown"
                                onDragStart={() => setDragging('cooldown')}
                                onDragEnd={() => setDragging(null)}
                            />
                        )}

                        <DividerDropZone
                            position={index}
                            onDrop={handleDividerDrop}
                            isActive={dragging !== null}
                        />

                        <IntervalRow
                            interval={interval}
                            sectionLabel={getSectionLabel(index)}
                            sectionColour={getSectionColour(index)}
                        />
                    </div>
                ))}

                {/* Drop zone after the last interval */}
                <DividerDropZone
                    position={intervalCount}
                    onDrop={handleDividerDrop}
                    isActive={dragging !== null}
                />

                {/* Cool-down divider at bottom of list when not yet placed */}
                {cooldownStart === intervalCount && (
                    <InlineDivider
                        label="Cool-Down Start: drag up to set cool-down"
                        type="cooldown"
                        onDragStart={() => setDragging('cooldown')}
                        onDragEnd={() => setDragging(null)}
                        isDefault
                    />
                )}
            </div>

            {/* Section summary */}
            <div className="flex gap-4 text-sm">
                <SectionSummary
                    label="Warm-Up"
                    intervals={workout.intervals.slice(0, warmupEnd)}
                    colour="text-blue-400"
                />
                <SectionSummary
                    label="Main Set"
                    intervals={workout.intervals.slice(warmupEnd, cooldownStart)}
                    colour="text-brand-400"
                />
                <SectionSummary
                    label="Cool-Down"
                    intervals={workout.intervals.slice(cooldownStart)}
                    colour="text-purple-400"
                />
            </div>

            {mainsetIsEmpty && (
                <p className="text-red-400 text-sm">
                    Main set cannot be empty. Adjust the dividers so at least one interval is in the main set.
                </p>
            )}

            <div className="flex gap-3">
                <button
                    onClick={handleConfirm}
                    disabled={mainsetIsEmpty || isSaving}
                    className={`
                        px-6 py-2
                        bg-brand-600 text-white
                        text-sm font-medium
                        rounded-md
                        hover:bg-brand-500 transition-colors
                        focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900
                        disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                >
                    {isSaving ? 'Saving...' : 'Confirm and save'}
                </button>
                <button
                    onClick={onCancel}
                    disabled={isSaving}
                    className={`
                        px-6 py-2
                        bg-zinc-700 text-white
                        text-sm font-medium
                        rounded-md
                        hover:bg-zinc-600 transition-colors
                    `}
                >
                    Cancel
                </button>
            </div>
        </div>
    )
}

/**
 * A draggable divider rendered inline at full width. Shows at the top/bottom
 * of the list in its default position, or between intervals when placed.
 * The isDefault prop controls muted styling for the initial unplaced state.
 */
function InlineDivider({ label, type, onDragStart, onDragEnd, isDefault }: {
    label: string
    type: 'warmup' | 'cooldown'
    onDragStart: () => void
    onDragEnd: () => void
    isDefault?: boolean
}): JSX.Element {
    const isWarmup = type === 'warmup'
    const bgColour = isWarmup ? 'bg-blue-900/40' : 'bg-purple-900/40'
    const textColour = isWarmup ? 'text-blue-300' : 'text-purple-300'
    const borderColour = isWarmup ? 'border-blue-700' : 'border-purple-700'

    return (
        <div
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            className={`
                flex items-center justify-center gap-2
                w-full px-3 py-1.5
                ${bgColour} ${textColour}
                text-sm font-medium
                border ${borderColour}
                rounded-md
                cursor-grab active:cursor-grabbing
                ${isDefault ? 'opacity-50' : ''}
            `}
        >
            <span>&#x2195;</span>
            {label}
        </div>
    )
}

/** Drop zone rendered between intervals where dividers can be placed. */
function DividerDropZone({ position, onDrop, isActive }: {
    position: number
    onDrop: (position: number) => void
    isActive: boolean
}): JSX.Element {
    const [isOver, setIsOver] = useState(false)

    if (!isActive) return <div className="h-0.5" />

    return (
        <div
            onDragOver={(e) => {
                e.preventDefault()
                setIsOver(true)
            }}
            onDragLeave={() => setIsOver(false)}
            onDrop={(e) => {
                e.preventDefault()
                setIsOver(false)
                onDrop(position)
            }}
            className={`
                h-3 transition-all
                ${isOver ? 'h-5 bg-brand-500/30 border border-dashed border-brand-500 rounded' : ''}
            `}
        />
    )
}

/** A single interval row in the section splitter. */
function IntervalRow({ interval, sectionLabel, sectionColour }: {
    interval: ParsedInterval
    sectionLabel: string
    sectionColour: string
}): JSX.Element {
    const zoneColour = getIntervalColour(interval)

    return (
        <div
            className={`
                flex items-center
                px-3 py-2
                bg-zinc-800 text-white text-sm
                border-l-4 ${sectionColour}
            `}
        >
            <span className="w-20 text-zinc-500 text-xs">{sectionLabel}</span>
            <span className="w-28 text-zinc-300">{interval.type}</span>
            <span className="w-20">{formatDuration(interval.durationSeconds)}</span>
            <span className="flex-1 text-zinc-300">{formatPower(interval)}</span>
            <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: zoneColour }}
            />
        </div>
    )
}

/** Section summary showing count and total duration. */
function SectionSummary({ label, intervals, colour }: {
    label: string
    intervals: ParsedInterval[]
    colour: string
}): JSX.Element {
    const totalSeconds = intervals.reduce((sum, i) => sum + i.durationSeconds, 0)

    return (
        <div className={colour}>
            <span className="font-medium">{label}:</span>{' '}
            {intervals.length === 0
                ? 'none'
                : `${intervals.length} interval${intervals.length !== 1 ? 's' : ''}, ${formatDuration(totalSeconds)}`
            }
        </div>
    )
}

/** Gets the zone colour for an interval based on its primary power value. */
function getIntervalColour(interval: ParsedInterval): string {
    let ftpFraction: number | null = null

    if (interval.type === 'IntervalsT') {
        ftpFraction = interval.onPower
    } else if (interval.type === 'FreeRide') {
        return '#6B7280' // Grey for free ride
    } else {
        ftpFraction = interval.power
    }

    if (ftpFraction === null) return '#6B7280'

    const zone = getZoneForPower(Math.round(ftpFraction * 100))
    return getColourForZone(zone)
}

/** Formats seconds into mm:ss or h:mm:ss. */
function formatDuration(totalSeconds: number): string {
    const seconds = Math.round(totalSeconds)
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`
}

/** Formats the power display for an interval. */
function formatPower(interval: ParsedInterval): string {
    if (interval.type === 'FreeRide') return 'Free ride'

    if (interval.type === 'IntervalsT') {
        const on = interval.onPower !== null ? `${Math.round(interval.onPower * 100)}%` : '\u2014'
        const off = interval.offPower !== null ? `${Math.round(interval.offPower * 100)}%` : '\u2014'
        return `${interval.repeat ?? 0}\u00d7 ${on} / ${off}`
    }

    if (interval.power !== null && interval.powerHigh !== null) {
        return `${Math.round(interval.power * 100)}% \u2192 ${Math.round(interval.powerHigh * 100)}%`
    }

    if (interval.power !== null) {
        return `${Math.round(interval.power * 100)}%`
    }

    return '\u2014'
}
