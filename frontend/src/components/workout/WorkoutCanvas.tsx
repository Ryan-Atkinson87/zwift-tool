import type { JSX } from 'react'
import type { BlockDetail, SectionType, WorkoutDetail } from '../../types/workout'
import { expandIntervalsToBars, type ChartBar } from '../../utils/intervalExpander'
import { getColourForZone, getZoneForPower } from '../../utils/zoneColours'
import {
    formatDuration,
    normalisedPowerBeta,
    totalDurationSeconds,
} from '../../utils/workoutStats'
import { ZonePresetButtons } from './ZonePresetButtons'
import type { Zone } from '../../utils/zonePresets'
import type { ZonePresetView } from '../../api/zonePresets'

interface Props {
    workout: WorkoutDetail | null
    isLoading: boolean
    error: string | null
    /**
     * Called when the user clicks the undo button for a section. The
     * parent is responsible for invoking the undo API and refreshing the
     * workout detail. The button is disabled when no previous state exists.
     */
    onUndoSection?: (sectionType: SectionType) => void
    /** True while an undo request is in flight, used to disable the button. */
    isUndoing?: boolean
    /**
     * Called when the user clicks a zone preset button next to a section.
     * The parent is responsible for appending a new SteadyState interval
     * to the section using the preset's default duration and %FTP, and for
     * queuing the resulting auto-save.
     */
    onAddZonePreset?: (sectionType: SectionType, zone: Zone) => void
    /** Disables every preset button while a save or undo is in flight. */
    isAddingPreset?: boolean
    /**
     * Effective zone presets for tooltip values on the preset buttons.
     * When omitted, the static documented defaults are shown.
     */
    zonePresets?: ZonePresetView[]
    /**
     * Called when the user clicks the "+ Block" button next to a section.
     * The parent opens a modal to let the user pick the block type
     * (Ramp / IntervalsT / Free Ride) and fill in its parameters.
     */
    onOpenAddBlock?: (sectionType: SectionType) => void
    /**
     * Called when the user clicks a bar on the chart. The parent uses
     * this to drive the inline interval editor. Bars produced by an
     * IntervalsT group all share a single source index so clicking any
     * sub-bar selects the IntervalsT interval as a whole.
     */
    onSelectInterval?: (sectionType: SectionType, intervalIndex: number) => void
    /**
     * The currently selected interval, if any. Used to draw a highlight
     * outline around the matching bars on the chart.
     */
    selectedInterval?: { sectionType: SectionType; intervalIndex: number } | null
    /**
     * Called when the user clicks the "Save to library" button for a section.
     * The parent is responsible for opening the save modal and calling the API.
     * Only shown for non-empty sections.
     */
    onSaveToLibrary?: (sectionType: SectionType) => void
}

/** Default Y-axis upper bound in percent FTP. Expands if any bar exceeds it. */
const DEFAULT_Y_MAX_PERCENT = 140

/** Height of the plot area in SVG units (not pixels, scaled by viewBox). */
const PLOT_HEIGHT = 200

/** Base gap between bars, in the same units as bar widths (seconds). */
const BAR_GAP_SECONDS = 4

/** Tighter gap used between bars within a single IntervalsT group. */
const GROUP_INNER_GAP_SECONDS = 1

/** Bars rendered for a single labelled section of the canvas. */
interface SectionBars {
    type: SectionType
    label: string
    bars: ChartBar[]
    hasPrev: boolean
    /**
     * True when the section has no block at all (only valid for warm-up
     * and cool-down). Used to render a placeholder strip with the preset
     * buttons so the user can create the section by clicking a preset.
     */
    isEmptySection: boolean
}

/**
 * Renders the editor canvas: the selected workout as a bar chart split
 * into Warm-Up, Main Set, and Cool-Down sections, with total duration and
 * normalised power displayed below the chart.
 *
 * <p>Displays loading, error, and empty states. When no workout is
 * selected, shows a hint prompting the user to pick one from the list.</p>
 */
export function WorkoutCanvas({
    workout,
    isLoading,
    error,
    onUndoSection,
    isUndoing = false,
    onAddZonePreset,
    isAddingPreset = false,
    zonePresets,
    onOpenAddBlock,
    onSelectInterval,
    selectedInterval = null,
    onSaveToLibrary,
}: Props): JSX.Element {
    if (isLoading) {
        return (
            <div className="w-full max-w-4xl px-4 py-12 bg-zinc-800/40 border border-zinc-700 rounded-lg text-center">
                <p className="text-sm text-zinc-400">Loading workout...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="w-full max-w-4xl px-4 py-12 bg-red-900/30 border border-red-800 rounded-lg text-center">
                <p className="text-sm text-red-300">{error}</p>
            </div>
        )
    }

    if (workout === null) {
        return (
            <div className="w-full max-w-4xl px-4 py-12 bg-zinc-800/40 border border-zinc-700 rounded-lg text-center">
                <p className="text-sm text-zinc-400">
                    Select a workout from the list to load it into the editor.
                </p>
            </div>
        )
    }

    const sections = buildSections(workout)
    const allBars = sections.flatMap((s) => s.bars)
    const total = totalDurationSeconds(allBars)
    const np = normalisedPowerBeta(allBars)
    const yMax = computeYMax(allBars)

    return (
        <div className="flex flex-col w-full max-w-4xl gap-3">
            {workout.isDraft && (
                <div className="flex justify-end">
                    <span className="px-2 py-0.5 bg-zinc-700 text-zinc-300 text-xs font-medium rounded">
                        Draft
                    </span>
                </div>
            )}

            <ChartArea
                sections={sections}
                yMax={yMax}
                totalSeconds={total}
                onUndoSection={onUndoSection}
                isUndoing={isUndoing}
                onAddZonePreset={onAddZonePreset}
                isAddingPreset={isAddingPreset}
                zonePresets={zonePresets}
                onOpenAddBlock={onOpenAddBlock}
                onSelectInterval={onSelectInterval}
                selectedInterval={selectedInterval}
                onSaveToLibrary={onSaveToLibrary}
            />

            <WorkoutFooter totalSeconds={total} normalisedPower={np} />
        </div>
    )
}

/**
 * Builds the ordered list of sections from a workout detail. Warm-up and
 * cool-down placeholders are always included so the user can add a preset
 * interval to create the section, even when no block exists yet.
 */
function buildSections(workout: WorkoutDetail): SectionBars[] {
    return [
        {
            type: 'WARMUP',
            label: 'Warm-Up',
            bars: workout.warmupBlock !== null ? expandBlock(workout.warmupBlock) : [],
            hasPrev: workout.hasPrevWarmup,
            isEmptySection: workout.warmupBlock === null,
        },
        {
            type: 'MAINSET',
            label: 'Main Set',
            bars: expandBlock(workout.mainsetBlock),
            hasPrev: workout.hasPrevMainset,
            isEmptySection: false,
        },
        {
            type: 'COOLDOWN',
            label: 'Cool-Down',
            bars: workout.cooldownBlock !== null ? expandBlock(workout.cooldownBlock) : [],
            hasPrev: workout.hasPrevCooldown,
            isEmptySection: workout.cooldownBlock === null,
        },
    ]
}

/** Expands a block's intervals into chart bars with a stable group prefix. */
function expandBlock(block: BlockDetail): ChartBar[] {
    return expandIntervalsToBars(block.intervals, `${block.sectionType}-${block.id}`)
}

/**
 * Computes the Y-axis upper bound in percent FTP, expanding beyond the
 * default when any bar exceeds it. Rounds up to the next multiple of 10
 * so axis labels stay tidy.
 */
function computeYMax(bars: ChartBar[]): number {
    const peak = bars.reduce((max, bar) => Math.max(max, bar.powerPercent), 0)
    if (peak <= DEFAULT_Y_MAX_PERCENT) {
        return DEFAULT_Y_MAX_PERCENT
    }
    return Math.ceil(peak / 10) * 10
}

interface ChartAreaProps {
    sections: SectionBars[]
    yMax: number
    totalSeconds: number
    onUndoSection?: (sectionType: SectionType) => void
    isUndoing: boolean
    onAddZonePreset?: (sectionType: SectionType, zone: Zone) => void
    isAddingPreset: boolean
    zonePresets?: ZonePresetView[]
    onOpenAddBlock?: (sectionType: SectionType) => void
    onSelectInterval?: (sectionType: SectionType, intervalIndex: number) => void
    selectedInterval: { sectionType: SectionType; intervalIndex: number } | null
    onSaveToLibrary?: (sectionType: SectionType) => void
}

/**
 * Renders the SVG bar chart area with section labels above each group.
 * Warm-Up and Cool-Down sections are given a subtle background tint to
 * distinguish them from the Main Set.
 */
function ChartArea({
    sections,
    yMax,
    totalSeconds,
    onUndoSection,
    isUndoing,
    onAddZonePreset,
    isAddingPreset,
    zonePresets,
    onOpenAddBlock,
    onSelectInterval,
    selectedInterval,
    onSaveToLibrary,
}: ChartAreaProps): JSX.Element {
    const sectionWidths = sections.map((section) =>
        widthForBars(section.bars, totalSeconds),
    )

    return (
        <div
            className={`
                flex flex-col w-full
                px-3 py-3
                bg-zinc-800/40 border border-zinc-700
                rounded-lg overflow-hidden
            `}
        >
            {/* Labels row uses equal thirds so every section name is always
                fully visible, regardless of how short that section's bars are.
                The chart row below uses duration-based ratios independently. */}
            <div className="flex mb-1" style={{ gap: '8px' }}>
                {sections.map((section) => {
                    const alignment =
                        section.type === 'WARMUP' ? 'items-start' :
                        section.type === 'COOLDOWN' ? 'items-end' :
                        'items-center'
                    return (
                    <div
                        key={section.type}
                        className={`flex flex-col ${alignment} gap-1 min-w-0`}
                        style={{ flex: '1 1 0' }}
                    >
                        <div className="flex items-center gap-2">
                            <p
                                className={`
                                    text-xs font-semibold tracking-wide uppercase
                                    text-zinc-300 truncate
                                `}
                            >
                                {section.label}
                            </p>
                            <UndoButton
                                sectionType={section.type}
                                disabled={!section.hasPrev || isUndoing || onUndoSection === undefined}
                                onClick={onUndoSection}
                            />
                            {onOpenAddBlock !== undefined && (
                                <button
                                    type="button"
                                    onClick={() => onOpenAddBlock(section.type)}
                                    title="Add a Ramp, Intervals, or Free Ride block"
                                    className={`
                                        px-2 py-0.5
                                        bg-zinc-700 text-zinc-200
                                        text-[10px] font-semibold uppercase tracking-wide
                                        rounded
                                        hover:bg-zinc-600 transition-colors
                                    `}
                                >
                                    + Block
                                </button>
                            )}
                            {onSaveToLibrary !== undefined && !section.isEmptySection && (
                                <button
                                    type="button"
                                    onClick={() => onSaveToLibrary(section.type)}
                                    title="Save this section to your block library"
                                    className={`
                                        px-2 py-0.5
                                        bg-zinc-700 text-zinc-200
                                        text-[10px] font-semibold uppercase tracking-wide
                                        rounded
                                        hover:bg-zinc-600 transition-colors
                                    `}
                                >
                                    Save
                                </button>
                            )}
                        </div>
                        {onAddZonePreset !== undefined && (
                            <ZonePresetButtons
                                sectionType={section.type}
                                onSelectPreset={onAddZonePreset}
                                disabled={isAddingPreset}
                                effectivePresets={zonePresets}
                            />
                        )}
                    </div>
                    )
                })}
            </div>

            <div className="flex" style={{ gap: '8px' }}>
                <YAxisLegend yMax={yMax} />
                <div className="flex flex-1 min-w-0" style={{ gap: '8px' }}>
                    {sections.map((section, i) => (
                        <div
                            key={section.type}
                            style={{ flex: `${sectionWidths[i]} 1 0` }}
                        >
                            <SectionChart
                                section={section}
                                yMax={yMax}
                                onSelectInterval={onSelectInterval}
                                selectedIntervalIndex={
                                    selectedInterval?.sectionType === section.type
                                        ? selectedInterval.intervalIndex
                                        : null
                                }
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

/** Approximates a section's total width share for flex sizing. */
function widthForBars(bars: ChartBar[], totalSeconds: number): number {
    // Empty sections (typically a missing warm-up or cool-down) need a
    // larger minimum so the preset buttons row stays comfortably readable
    if (bars.length === 0) {
        return totalSeconds === 0 ? 1 : 0.15
    }
    const sum = bars.reduce((acc, bar) => acc + bar.durationSeconds, 0)
    // Clamp to a small minimum so very short sections still show their label
    return Math.max(sum / totalSeconds, 0.02)
}

interface SectionChartProps {
    section: SectionBars
    yMax: number
    onSelectInterval?: (sectionType: SectionType, intervalIndex: number) => void
    selectedIntervalIndex: number | null
}

/**
 * Renders the SVG bar chart for a single section. Bars are sized using a
 * user-space viewBox where one unit on the x-axis equals one second and
 * one unit on the y-axis equals one percent of FTP. The SVG scales
 * responsively via preserveAspectRatio="none".
 */
function SectionChart({
    section,
    yMax,
    onSelectInterval,
    selectedIntervalIndex,
}: SectionChartProps): JSX.Element {
    const sectionDuration = section.bars.reduce((sum, bar) => sum + bar.durationSeconds, 0)

    // Total gap space scales with bar count; use a constant-ish fraction of
    // section duration so gaps remain visible regardless of total length
    const totalGapSeconds = section.bars.reduce((sum, bar, i) => {
        if (i === 0) return sum
        const prev = section.bars[i - 1]
        const sameGroup = bar.groupId !== null && bar.groupId === prev.groupId
        return sum + (sameGroup ? GROUP_INNER_GAP_SECONDS : BAR_GAP_SECONDS)
    }, 0)

    const viewBoxWidth = Math.max(sectionDuration + totalGapSeconds, 1)
    const sectionBackground =
        section.type === 'MAINSET' ? 'bg-zinc-900/40' : 'bg-zinc-900/20'

    if (section.bars.length === 0) {
        return (
            <div
                className={`flex items-center justify-center ${sectionBackground} rounded`}
                style={{ height: `${PLOT_HEIGHT}px` }}
            >
                <p className="text-xs text-zinc-500">Empty</p>
            </div>
        )
    }

    const shapes = buildSectionShapes(
        section.bars,
        yMax,
        section.type,
        onSelectInterval,
        selectedIntervalIndex,
    )

    return (
        <div className={`${sectionBackground} rounded overflow-hidden`}>
            <svg
                viewBox={`0 0 ${viewBoxWidth} ${PLOT_HEIGHT}`}
                preserveAspectRatio="none"
                className="block w-full"
                style={{ height: `${PLOT_HEIGHT}px` }}
            >
                {shapes}
            </svg>
        </div>
    )
}

/**
 * Lays out a section's bars into positioned SVG shapes. The running
 * cursor is kept inside this helper so it does not appear as a mutated
 * closure variable inside a React component body.
 */
function buildSectionShapes(
    bars: ChartBar[],
    yMax: number,
    sectionType: SectionType,
    onSelectInterval: ((sectionType: SectionType, intervalIndex: number) => void) | undefined,
    selectedIntervalIndex: number | null,
): JSX.Element[] {
    const shapes: JSX.Element[] = []
    let cursor = 0

    for (let i = 0; i < bars.length; i++) {
        const bar = bars[i]
        if (i > 0) {
            const prev = bars[i - 1]
            const sameGroup = bar.groupId !== null && bar.groupId === prev.groupId
            cursor += sameGroup ? GROUP_INNER_GAP_SECONDS : BAR_GAP_SECONDS
        }

        const isSelected =
            bar.sourceIntervalIndex !== null
            && bar.sourceIntervalIndex === selectedIntervalIndex

        const handleClick = onSelectInterval !== undefined && bar.sourceIntervalIndex !== null
            ? () => onSelectInterval(sectionType, bar.sourceIntervalIndex as number)
            : undefined

        shapes.push(
            <BarShape
                key={i}
                bar={bar}
                x={cursor}
                yMax={yMax}
                isSelected={isSelected}
                onClick={handleClick}
            />,
        )

        cursor += bar.durationSeconds
    }

    return shapes
}

interface BarShapeProps {
    bar: ChartBar
    x: number
    yMax: number
    isSelected: boolean
    onClick?: () => void
}

/**
 * Renders a single chart bar in the style appropriate for its source
 * interval: a flat rectangle for SteadyState and IntervalsT bars, a
 * gradient-filled polygon for ramps, and a grey wavy-top block for Free
 * Ride. The bar is rendered as a button-like target so the inline editor
 * can react to clicks.
 */
function BarShape({ bar, x, yMax, isSelected, onClick }: BarShapeProps): JSX.Element {
    const cursorClass = onClick !== undefined ? 'cursor-pointer' : ''
    const selectionStroke = isSelected ? '#FFFFFF' : 'none'

    if (bar.style === 'ramp' && bar.startPowerPercent !== null && bar.endPowerPercent !== null) {
        const startHeight = (bar.startPowerPercent / yMax) * PLOT_HEIGHT
        const endHeight = (bar.endPowerPercent / yMax) * PLOT_HEIGHT
        const startY = PLOT_HEIGHT - startHeight
        const endY = PLOT_HEIGHT - endHeight
        // Polygon from bottom-left, up the start edge, across the top
        // following the ramp slope, down the end edge, and back along the
        // baseline. SVG y-axis increases downward.
        const points = [
            `${x},${PLOT_HEIGHT}`,
            `${x},${startY}`,
            `${x + bar.durationSeconds},${endY}`,
            `${x + bar.durationSeconds},${PLOT_HEIGHT}`,
        ].join(' ')
        const startColour = getColourForZone(getZoneForPower(bar.startPowerPercent))
        const endColour = getColourForZone(getZoneForPower(bar.endPowerPercent))
        const gradientId = `ramp-${x}-${bar.durationSeconds}`
        return (
            <g onClick={onClick} className={cursorClass}>
                <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={startColour} />
                        <stop offset="100%" stopColor={endColour} />
                    </linearGradient>
                </defs>
                <polygon
                    points={points}
                    fill={`url(#${gradientId})`}
                    stroke={selectionStroke}
                    strokeWidth={isSelected ? 2 : 0}
                    vectorEffect="non-scaling-stroke"
                />
            </g>
        )
    }

    if (bar.style === 'freeride') {
        const baseHeight = (bar.powerPercent / yMax) * PLOT_HEIGHT
        const baseTopY = PLOT_HEIGHT - baseHeight
        // Build a path with a sine-wave top edge that mimics Zwift's
        // Free Ride visualisation. The wave amplitude scales with the
        // section duration so it stays visible at any zoom level.
        const amplitude = Math.max(baseHeight * 0.06, 4)
        const segments = Math.max(8, Math.round(bar.durationSeconds / 30))
        const points: string[] = []
        for (let i = 0; i <= segments; i++) {
            const t = i / segments
            const px = x + t * bar.durationSeconds
            const py = baseTopY - Math.sin(t * Math.PI * 2) * amplitude
            points.push(`${i === 0 ? 'M' : 'L'} ${px} ${py}`)
        }
        // Close the path back along the baseline
        points.push(`L ${x + bar.durationSeconds} ${PLOT_HEIGHT}`)
        points.push(`L ${x} ${PLOT_HEIGHT}`)
        points.push('Z')
        return (
            <g onClick={onClick} className={cursorClass}>
                <path
                    d={points.join(' ')}
                    fill="#6B7280"
                    stroke={selectionStroke}
                    strokeWidth={isSelected ? 2 : 0}
                    vectorEffect="non-scaling-stroke"
                />
            </g>
        )
    }

    const height = (bar.powerPercent / yMax) * PLOT_HEIGHT
    const y = PLOT_HEIGHT - height
    const fill = getColourForZone(getZoneForPower(bar.powerPercent))
    return (
        <rect
            x={x}
            y={y}
            width={bar.durationSeconds}
            height={height}
            fill={fill}
            stroke={selectionStroke}
            strokeWidth={isSelected ? 2 : 0}
            vectorEffect="non-scaling-stroke"
            onClick={onClick}
            className={cursorClass}
        />
    )
}

interface YAxisLegendProps {
    yMax: number
}

/**
 * Renders a simple numeric legend showing the Y-axis range. A full tick
 * axis is out of scope for MVP; this gives users enough reference to read
 * the chart while keeping the markup light.
 */
function YAxisLegend({ yMax }: YAxisLegendProps): JSX.Element {
    return (
        <div
            className="flex flex-col justify-between items-end text-[10px] text-zinc-500 shrink-0"
            style={{ height: `${PLOT_HEIGHT}px` }}
        >
            <span>{yMax}%</span>
            <span>0%</span>
        </div>
    )
}

interface UndoButtonProps {
    sectionType: SectionType
    disabled: boolean
    onClick?: (sectionType: SectionType) => void
}

/**
 * Small inline undo control rendered next to each section label. Disabled
 * when there is no previous state to revert to, when an undo is already in
 * flight, or when the parent does not provide an undo handler.
 */
function UndoButton({ sectionType, disabled, onClick }: UndoButtonProps): JSX.Element {
    return (
        <button
            type="button"
            onClick={() => onClick?.(sectionType)}
            disabled={disabled}
            title="Undo last change to this section"
            className={`
                px-2 py-0.5
                bg-zinc-700 text-zinc-200
                text-[10px] font-semibold uppercase tracking-wide
                rounded
                hover:bg-zinc-600 transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-zinc-700
            `}
        >
            Undo
        </button>
    )
}

interface WorkoutFooterProps {
    totalSeconds: number
    normalisedPower: number
}

/**
 * Renders the stats footer beneath the chart: total duration, normalised
 * power (beta), and a TSS placeholder labelled "Coming soon".
 */
function WorkoutFooter({ totalSeconds, normalisedPower }: WorkoutFooterProps): JSX.Element {
    return (
        <div className="flex flex-wrap items-center gap-6 px-1 text-sm">
            <div className="flex items-baseline gap-2">
                <span className="text-zinc-400">Duration</span>
                <span className="text-white font-medium">{formatDuration(totalSeconds)}</span>
            </div>

            <div className="flex items-baseline gap-2">
                <span className="text-zinc-400">NP (beta)</span>
                <span className="text-white font-medium">{normalisedPower}% FTP</span>
            </div>

            <div className="flex items-baseline gap-2">
                <span className="text-zinc-400">TSS</span>
                <span className="text-zinc-500 italic">Coming soon</span>
            </div>
        </div>
    )
}
