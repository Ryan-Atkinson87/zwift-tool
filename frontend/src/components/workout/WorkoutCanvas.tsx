import type { JSX } from 'react'
import type { BlockDetail, SectionType, WorkoutDetail } from '../../types/workout'
import { expandIntervalsToBars, type ChartBar } from '../../utils/intervalExpander'
import { getColourForZone, getZoneForPower } from '../../utils/zoneColours'
import {
    formatDuration,
    normalisedPowerBeta,
    totalDurationSeconds,
} from '../../utils/workoutStats'

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
            />

            <WorkoutFooter totalSeconds={total} normalisedPower={np} />
        </div>
    )
}

/** Builds the ordered list of sections from a workout detail. */
function buildSections(workout: WorkoutDetail): SectionBars[] {
    const sections: SectionBars[] = []

    if (workout.warmupBlock !== null) {
        sections.push({
            type: 'WARMUP',
            label: 'Warm-Up',
            bars: expandBlock(workout.warmupBlock),
            hasPrev: workout.hasPrevWarmup,
        })
    }

    sections.push({
        type: 'MAINSET',
        label: 'Main Set',
        bars: expandBlock(workout.mainsetBlock),
        hasPrev: workout.hasPrevMainset,
    })

    if (workout.cooldownBlock !== null) {
        sections.push({
            type: 'COOLDOWN',
            label: 'Cool-Down',
            bars: expandBlock(workout.cooldownBlock),
            hasPrev: workout.hasPrevCooldown,
        })
    }

    return sections
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
}: ChartAreaProps): JSX.Element {
    const totalBars = sections.reduce((sum, s) => sum + s.bars.length, 0)

    if (totalBars === 0) {
        return (
            <div className="w-full px-4 py-8 bg-zinc-800/40 border border-zinc-700 rounded-lg text-center">
                <p className="text-sm text-zinc-400">
                    This workout has no intervals yet. Add some blocks to get started.
                </p>
            </div>
        )
    }

    const sectionWidths = sections.map((section) =>
        widthForBars(section.bars, totalSeconds),
    )

    return (
        <div
            className={`
                flex flex-col w-full
                px-3 py-3
                bg-zinc-800/40 border border-zinc-700
                rounded-lg
            `}
        >
            {/* Labels and charts are laid out as two independent flex rows
                with matching flex ratios. Keeping them in separate rows
                ensures every chart shares the same baseline even when a
                narrow section would otherwise force its label to wrap. */}
            <div className="flex mb-1" style={{ gap: '8px' }}>
                {sections.map((section, i) => (
                    <div
                        key={section.type}
                        className="flex items-center justify-center gap-2 min-w-0"
                        style={{ flex: `${sectionWidths[i]} 1 0` }}
                    >
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
                    </div>
                ))}
            </div>

            <div className="flex" style={{ gap: '8px' }}>
                {sections.map((section, i) => (
                    <div
                        key={section.type}
                        style={{ flex: `${sectionWidths[i]} 1 0` }}
                    >
                        <SectionChart section={section} yMax={yMax} />
                    </div>
                ))}
            </div>

            <YAxisLegend yMax={yMax} />
        </div>
    )
}

/** Approximates a section's total width share for flex sizing. */
function widthForBars(bars: ChartBar[], totalSeconds: number): number {
    if (totalSeconds === 0) return 1
    const sum = bars.reduce((acc, bar) => acc + bar.durationSeconds, 0)
    // Clamp to a small minimum so very short sections still show their label
    return Math.max(sum / totalSeconds, 0.02)
}

interface SectionChartProps {
    section: SectionBars
    yMax: number
}

/**
 * Renders the SVG bar chart for a single section. Bars are sized using a
 * user-space viewBox where one unit on the x-axis equals one second and
 * one unit on the y-axis equals one percent of FTP. The SVG scales
 * responsively via preserveAspectRatio="none".
 */
function SectionChart({ section, yMax }: SectionChartProps): JSX.Element {
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

    const rects = buildSectionRects(section.bars, yMax)

    return (
        <div className={`${sectionBackground} rounded overflow-hidden`}>
            <svg
                viewBox={`0 0 ${viewBoxWidth} ${PLOT_HEIGHT}`}
                preserveAspectRatio="none"
                className="block w-full"
                style={{ height: `${PLOT_HEIGHT}px` }}
            >
                {rects}
            </svg>
        </div>
    )
}

/**
 * Lays out a section's bars into positioned SVG rectangles. The running
 * cursor is kept inside this helper so it does not appear as a mutated
 * closure variable inside a React component body.
 */
function buildSectionRects(bars: ChartBar[], yMax: number): JSX.Element[] {
    const rects: JSX.Element[] = []
    let cursor = 0

    for (let i = 0; i < bars.length; i++) {
        const bar = bars[i]
        if (i > 0) {
            const prev = bars[i - 1]
            const sameGroup = bar.groupId !== null && bar.groupId === prev.groupId
            cursor += sameGroup ? GROUP_INNER_GAP_SECONDS : BAR_GAP_SECONDS
        }

        const height = (bar.powerPercent / yMax) * PLOT_HEIGHT
        const y = PLOT_HEIGHT - height
        const fill = getColourForZone(getZoneForPower(bar.powerPercent))

        rects.push(
            <rect
                key={i}
                x={cursor}
                y={y}
                width={bar.durationSeconds}
                height={height}
                fill={fill}
            />,
        )

        cursor += bar.durationSeconds
    }

    return rects
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
        <div className="flex justify-between px-1 mt-2 text-xs text-zinc-500">
            <span>0% FTP</span>
            <span>{yMax}% FTP</span>
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
