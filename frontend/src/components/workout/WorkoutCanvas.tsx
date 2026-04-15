import { useState, useRef, type JSX } from 'react'
import type { BlockDetail, ParsedInterval, SectionType, WorkoutDetail } from '../../types/workout'
import { expandIntervalsToBars, type ChartBar } from '../../utils/intervalExpander'
import { getColourForZone, getZoneForPower } from '../../utils/zoneColours'
import {
    formatDuration,
    normalisedPowerBeta,
    totalDurationSeconds,
} from '../../utils/workoutStats'
import type { ZonePresetView } from '../../api/zonePresets'
import { IntervalPalette, PaletteItemShape } from './IntervalPalette'
import { BarInlineOverlay } from './BarInlineOverlay'

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
     * Effective zone presets used to construct the palette interval defaults.
     * When omitted, the static documented defaults are shown in the palette.
     */
    zonePresets?: ZonePresetView[]
    /**
     * Called when the user drops a palette interval onto the chart at a
     * specific position. The parent appends or inserts the interval into the
     * section and queues an auto-save.
     *
     * @param sectionType  the section the interval was dropped on
     * @param interval     the interval to insert
     * @param insertIndex  0-based index before which to insert (equal to the
     *                     section's interval count to append)
     */
    onAddInterval?: (sectionType: SectionType, interval: ParsedInterval, insertIndex: number) => void
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
    /**
     * Called when the user clicks the "Replace" button for a section.
     * The parent is responsible for opening the replacement modal.
     * Only shown when a workout is loaded.
     */
    onReplaceSection?: (sectionType: SectionType) => void
    /**
     * Called when the user drags a bar within its section to reorder it.
     * Maps to the existing handleReorderIntervals in App.tsx.
     */
    onReorderInterval?: (sectionType: SectionType, fromIndex: number, toIndex: number) => void
    /**
     * Called when the user drags a bar across a section boundary. The
     * interval is removed from fromSection at fromIndex and inserted into
     * toSection before toIndex (pass the section's interval count to append).
     */
    onMoveInterval?: (
        fromSection: SectionType,
        fromIndex: number,
        toSection: SectionType,
        toIndex: number,
    ) => void
    /**
     * Called when the user saves a moved section boundary. Receives the
     * full interval arrays for all three sections after the reassignment.
     * The parent is responsible for persisting the changes.
     */
    onSaveBoundaries?: (
        warmupIntervals: ParsedInterval[],
        mainsetIntervals: ParsedInterval[],
        cooldownIntervals: ParsedInterval[],
    ) => void
    /**
     * Called when the user finishes dragging a resize handle on a SteadyState
     * bar. Receives the section, the interval index within that section, the
     * new duration in seconds, and the new power in percent FTP. The parent is
     * responsible for committing the change and queuing an auto-save.
     * When omitted, resize handles are not rendered.
     */
    onResizeInterval?: (
        sectionType: SectionType,
        intervalIndex: number,
        durationSeconds: number,
        powerPercent: number,
    ) => void
    /**
     * Called when the user edits duration or power via the inline bar overlay.
     * Receives the section, the interval index, and the fully updated interval.
     * The parent is responsible for committing the change and queuing an auto-save.
     */
    onUpdateInterval?: (sectionType: SectionType, intervalIndex: number, next: ParsedInterval) => void
    /**
     * Called when the user clicks the trash icon on the inline bar overlay.
     * The parent is responsible for removing the interval and queuing an auto-save.
     */
    onDeleteInterval?: (sectionType: SectionType, intervalIndex: number) => void
    /**
     * Called when the user drags a text event bar to a new position on the
     * timeline. Receives the event index and the new time offset in seconds.
     * The parent is responsible for persisting the updated text event list.
     */
    onMoveTextEvent?: (eventIndex: number, newOffsetSeconds: number) => void
}

/** Default Y-axis upper bound in percent FTP. Expands if any bar exceeds it. */
const DEFAULT_Y_MAX_PERCENT = 140

/** Height of the plot area in SVG units. */
const PLOT_HEIGHT = 200

/** Blank space above the bars, in SVG units (50% of PLOT_HEIGHT). */
const TOP_PADDING = Math.round(PLOT_HEIGHT * 0.5)

/** Base gap between bars, in seconds (SVG units). */
const BAR_GAP_SECONDS = 4

/** Tighter gap used between bars within a single IntervalsT group. */
const GROUP_INNER_GAP_SECONDS = 1

/** Gap in SVG units between adjacent section areas in the unified chart. */
const SECTION_GAP_SVG = 20

/** Minimum SVG width for an empty section (warm-up or cool-down with no block). */
const EMPTY_SECTION_MIN_WIDTH = 60

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

/** Layout information for one section inside the unified SVG coordinate space. */
interface SectionLayout {
    section: SectionBars
    /** X position where this section's bars begin in the unified SVG. */
    xOffset: number
    /** Total SVG width allocated to this section. */
    sectionWidth: number
}

/** State for a boundary drag that is currently in progress (pointer held down). */
interface BoundaryDragActive {
    boundary: 'WU_MS' | 'MS_CD'
    /** Current snapped interval count for the left section. */
    liveCount: number
    /**
     * Pre-computed SVG x positions for each possible snap point.
     * snapPositions[k] is the x coordinate when k intervals are in the
     * left section.
     */
    snapPositions: number[]
    /** Minimum allowed count (prevents emptying the main set). */
    minCount: number
    /** Maximum allowed count (one section must keep at least one interval). */
    maxCount: number
}

/** State for a resize drag that is currently in progress (pointer held down on a resize handle). */
interface ResizeDragState {
    sectionType: SectionType
    intervalIndex: number
    /** Which edge is being dragged. */
    handle: 'right' | 'top'
    /** SVG x coordinate of the pointer at drag start. */
    startSvgX: number
    /** SVG y coordinate of the pointer at drag start. */
    startSvgY: number
    /** Interval duration at drag start, in seconds. */
    originalDurationSeconds: number
    /** Interval power at drag start, in percent FTP. */
    originalPowerPercent: number
    /** Current clamped duration in seconds, updated on every pointermove. */
    liveDurationSeconds: number
    /** Current clamped power in percent FTP, updated on every pointermove. */
    livePowerPercent: number
}

/** State for a bar drag that is currently in progress (pointer held down). */
interface BarDragState {
    sourceSection: SectionType
    sourceIntervalIndex: number
    /** All bars that belong to the dragged interval (IntervalsT = many bars). */
    draggedBars: ChartBar[]
    /** Section where the drop target is currently located. */
    ghostSection: SectionType
    /**
     * Index to insert the interval before in the target section.
     * Equal to the section's interval count means append.
     */
    ghostInsertIndex: number
    /**
     * SVG x coordinate of the snapped drop target. Used to draw the thick
     * drop indicator line. Updated continuously during drag.
     */
    ghostX: number
    /**
     * Current pointer position in SVG coordinates. Updated on every
     * pointermove so the ghost follows the cursor in both axes.
     */
    pointerSvgX: number
    pointerSvgY: number
    /**
     * Offset from the pointer to the left edge of the grabbed bar, recorded
     * at pointerdown. Subtracted from pointerSvgX when positioning the ghost
     * so the bar stays under the exact pixel where it was clicked.
     */
    grabOffsetX: number
    /**
     * SVG Y of the pointer at pointerdown. The ghost is translated by
     * (pointerSvgY - grabOffsetY) so vertical movement is a pure delta
     * from the grab point with no jump on pickup.
     */
    grabOffsetY: number
    /**
     * True once the pointer has moved beyond the drag threshold. Used to
     * distinguish a click from a drag so a bare click never triggers a reorder.
     */
    hasMoved: boolean
}

/** State for a text event drag that is currently in progress. */
interface TextEventDragState {
    eventIndex: number
    /** Bounding rect of the chart container div, recorded at drag start. */
    containerRect: DOMRect
    /** Pointer x offset from the left edge of the event bar, in pixels. */
    grabOffsetX: number
    /** Live snapped time offset in seconds, updated on every pointermove. */
    liveOffsetSeconds: number
}

/** State for a palette drag that is currently in progress. */
interface PaletteDragState {
    /** The interval to insert when dropped. */
    interval: ParsedInterval
    /** Section where the drop target is currently located, or null if not over chart. */
    dropSection: SectionType | null
    /** Insert index in the target section (0 = before first). */
    dropInsertIndex: number | null
    /** SVG x position for the drop indicator line, or null if not over chart. */
    dropIndicatorX: number | null
    /** Current pointer position in client (screen) coordinates for ghost positioning. */
    clientX: number
    clientY: number
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
    zonePresets,
    onAddInterval,
    onSelectInterval,
    selectedInterval = null,
    onSaveToLibrary,
    onReplaceSection,
    onReorderInterval,
    onMoveInterval,
    onSaveBoundaries,
    onResizeInterval,
    onUpdateInterval,
    onDeleteInterval,
    onMoveTextEvent,
}: Props): JSX.Element {
    if (isLoading) {
        return (
            <div className="w-full px-4 py-12 bg-zinc-800/40 border border-zinc-700 rounded-lg text-center">
                <p className="text-sm text-zinc-400">Loading workout...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="w-full px-4 py-12 bg-red-900/30 border border-red-800 rounded-lg text-center">
                <p className="text-sm text-red-300">{error}</p>
            </div>
        )
    }

    if (workout === null) {
        return (
            <div className="w-full px-4 py-12 bg-zinc-800/40 border border-zinc-700 rounded-lg text-center">
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
        <div className="flex flex-col w-full gap-3">
            {workout.isDraft && (
                <div className="flex justify-end">
                    <span className="px-2 py-0.5 bg-zinc-700 text-zinc-300 text-xs font-medium rounded">
                        Draft
                    </span>
                </div>
            )}

            <ChartArea
                workout={workout}
                sections={sections}
                yMax={yMax}
                totalSeconds={total}
                onUndoSection={onUndoSection}
                isUndoing={isUndoing}
                zonePresets={zonePresets}
                onAddInterval={onAddInterval}
                onSelectInterval={onSelectInterval}
                selectedInterval={selectedInterval}
                onSaveToLibrary={onSaveToLibrary}
                onReplaceSection={onReplaceSection}
                onReorderInterval={onReorderInterval}
                onMoveInterval={onMoveInterval}
                onSaveBoundaries={onSaveBoundaries}
                onResizeInterval={onResizeInterval}
                onUpdateInterval={onUpdateInterval}
                onDeleteInterval={onDeleteInterval}
                onMoveTextEvent={onMoveTextEvent}
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

/**
 * Returns the SVG viewBox width for a section's set of bars, accounting for
 * inter-bar gaps. Empty bar lists return a minimum placeholder width.
 */
function computeSectionSvgWidth(bars: ChartBar[], totalSeconds: number): number {
    if (bars.length === 0) {
        return Math.max(totalSeconds * 0.15, EMPTY_SECTION_MIN_WIDTH)
    }
    const totalGaps = bars.reduce((sum, bar, i) => {
        if (i === 0) return sum
        const prev = bars[i - 1]
        return sum + (bar.groupId !== null && bar.groupId === prev.groupId
            ? GROUP_INNER_GAP_SECONDS
            : BAR_GAP_SECONDS)
    }, 0)
    return Math.max(bars.reduce((sum, b) => sum + b.durationSeconds, 0) + totalGaps, 1)
}

/**
 * Computes the unified layout for all three sections. Each section receives
 * an x offset and a width within a single shared SVG coordinate space.
 * Sections are separated by {@link SECTION_GAP_SVG} units.
 */
function computeLayout(
    sections: SectionBars[],
    totalSeconds: number,
): { layouts: SectionLayout[]; totalWidth: number } {
    let cursor = 0
    const layouts = sections.map((section, i) => {
        const width = computeSectionSvgWidth(section.bars, totalSeconds)
        const layout: SectionLayout = { section, xOffset: cursor, sectionWidth: width }
        cursor += width
        if (i < sections.length - 1) {
            cursor += SECTION_GAP_SVG
        }
        return layout
    })
    return { layouts, totalWidth: cursor }
}

/**
 * Returns the SVG x position (in section-local or global coords) at the END
 * of each interval in the given bar list. The returned array has one entry
 * per interval (not per bar: IntervalsT intervals span multiple bars).
 *
 * @param bars     the bars for one section
 * @param xOffset  added to every position, use 0 for section-local coords
 */
function computeIntervalEndPositions(bars: ChartBar[], xOffset: number): number[] {
    const result: number[] = []
    let cursor = 0
    for (let i = 0; i < bars.length; i++) {
        const bar = bars[i]
        if (i > 0) {
            const prev = bars[i - 1]
            cursor += bar.groupId !== null && bar.groupId === prev.groupId
                ? GROUP_INNER_GAP_SECONDS
                : BAR_GAP_SECONDS
        }
        cursor += bar.durationSeconds
        const next = bars[i + 1]
        // Emit a snap point after the last bar of each interval.
        if (next === undefined || next.sourceIntervalIndex !== bar.sourceIntervalIndex) {
            result.push(xOffset + cursor)
        }
    }
    return result
}

/**
 * Returns the SVG x position at the START of each interval in the given bar
 * list. Used to determine where to place a ghost bar or drop indicator.
 *
 * @param bars     the bars for one section
 * @param xOffset  added to every position
 */
function computeIntervalStartPositions(bars: ChartBar[], xOffset: number): number[] {
    const result: number[] = []
    let cursor = 0
    let lastIntervalIdx: number | null = null
    for (let i = 0; i < bars.length; i++) {
        const bar = bars[i]
        if (i > 0) {
            const prev = bars[i - 1]
            cursor += bar.groupId !== null && bar.groupId === prev.groupId
                ? GROUP_INNER_GAP_SECONDS
                : BAR_GAP_SECONDS
        }
        if (bar.sourceIntervalIndex !== lastIntervalIdx) {
            result.push(xOffset + cursor)
            lastIntervalIdx = bar.sourceIntervalIndex
        }
        cursor += bar.durationSeconds
    }
    return result
}

/** Counts the distinct intervals represented by a bar list. */
function countIntervals(bars: ChartBar[]): number {
    const seen = new Set<number>()
    for (const bar of bars) {
        if (bar.sourceIntervalIndex !== null) seen.add(bar.sourceIntervalIndex)
    }
    return seen.size
}

/**
 * Returns the start time in seconds for each distinct interval across all
 * sections. Used to compute snap points for text event dragging. Gaps
 * between bars are visual-only and are excluded from time accounting.
 */
function computeIntervalStartTimesSeconds(sections: SectionBars[]): number[] {
    const times: number[] = []
    let cursor = 0
    for (const section of sections) {
        let lastIdx: number | null = null
        for (const bar of section.bars) {
            if (bar.sourceIntervalIndex !== lastIdx) {
                times.push(cursor)
                lastIdx = bar.sourceIntervalIndex
            }
            cursor += bar.durationSeconds
        }
    }
    return times
}

/**
 * Returns the nearest snap time from {@link snapTimes} if it is within
 * {@link radius} seconds of {@link seconds}, otherwise returns {@link seconds}
 * unchanged.
 */
function snapIfClose(seconds: number, snapTimes: number[], radius: number): number {
    let best = seconds
    let bestDist = radius
    for (const t of snapTimes) {
        const dist = Math.abs(seconds - t)
        if (dist < bestDist) {
            bestDist = dist
            best = t
        }
    }
    return best
}

/**
 * Clamps {@link proposedOffset} so that a text event of {@link myDuration}
 * seconds does not overlap any event in {@link otherEvents}. Finds the nearest
 * valid gap to the proposed position. Returns the proposed offset unchanged if
 * there is no overlap.
 */
function clampNoOverlap(
    proposedOffset: number,
    myDuration: number,
    otherEvents: { timeOffsetSeconds: number; durationSeconds?: number }[],
    totalSeconds: number,
): number {
    const others = [...otherEvents]
        .map((ev) => ({
            start: ev.timeOffsetSeconds,
            end: ev.timeOffsetSeconds + (ev.durationSeconds ?? 0),
        }))
        .sort((a, b) => a.start - b.start)

    const proposedEnd = proposedOffset + myDuration

    // Return early if no overlap exists. Just clamp to the timeline bounds.
    const hasOverlap = others.some(
        (o) => proposedOffset < o.end && proposedEnd > o.start,
    )
    if (!hasOverlap) {
        return Math.max(0, Math.min(totalSeconds - myDuration, proposedOffset))
    }

    // Build the list of gaps between other events (and before/after all events).
    const gaps: Array<{ start: number; end: number }> = []
    gaps.push({ start: 0, end: others[0]?.start ?? totalSeconds })
    for (let i = 0; i < others.length - 1; i++) {
        gaps.push({ start: others[i].end, end: others[i + 1].start })
    }
    if (others.length > 0) {
        gaps.push({ start: others[others.length - 1].end, end: totalSeconds })
    }

    // Only keep gaps wide enough to fit the dragged event.
    const validGaps = gaps.filter((g) => g.end - g.start >= myDuration)
    if (validGaps.length === 0) return proposedOffset

    // For each valid gap, clamp the proposed offset to fit inside it, then pick
    // the gap whose clamped position is nearest to the proposed offset.
    let bestPos = proposedOffset
    let bestDist = Infinity
    for (const gap of validGaps) {
        const maxStart = gap.end - myDuration
        const clampedInGap = Math.max(gap.start, Math.min(maxStart, proposedOffset))
        const dist = Math.abs(clampedInGap - proposedOffset)
        if (dist < bestDist) {
            bestDist = dist
            bestPos = clampedInGap
        }
    }
    return bestPos
}

/**
 * Converts client pointer coordinates into the SVG's local coordinate space
 * using the element's current transformation matrix. Returns both axes in a
 * single matrix call so callers that need Y do not pay a second inversion.
 */
function clientToSvgCoords(
    clientX: number,
    clientY: number,
    svgEl: SVGSVGElement,
): { x: number; y: number } {
    const pt = svgEl.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const t = pt.matrixTransform(svgEl.getScreenCTM()!.inverse())
    return { x: t.x, y: t.y }
}

/**
 * Computes snap x positions for the Warm-Up / Main Set boundary handle.
 * The returned array has one entry per possible split count (0 through
 * warmupCount + mainsetCount - 1). Entry k is the SVG x coordinate of the
 * boundary line when k intervals are assigned to warm-up.
 *
 * <p>For k within the current warmup section, the position is the end of
 * the kth warmup bar. For k beyond the warmup section, the position is the
 * end of the (k - warmupCount)th mainset bar in the current layout.</p>
 */
function computeWuMsSnapPositions(
    warmupBars: ChartBar[],
    mainsetBars: ChartBar[],
    mainsetXOffset: number,
    warmupIntervalCount: number,
): number[] {
    const warmupEnds = computeIntervalEndPositions(warmupBars, 0)
    const mainsetEnds = computeIntervalEndPositions(mainsetBars, mainsetXOffset)
    const total = warmupIntervalCount + mainsetEnds.length

    // Position for split 0: boundary before any warmup bar
    const positions: number[] = [0]
    for (let k = 1; k <= warmupIntervalCount; k++) {
        positions.push(warmupEnds[k - 1] ?? 0)
    }
    for (let k = warmupIntervalCount + 1; k < total; k++) {
        positions.push(mainsetEnds[k - warmupIntervalCount - 1] ?? mainsetXOffset)
    }
    return positions
}

/**
 * Computes snap x positions for the Main Set / Cool-Down boundary handle.
 * Entry k is the SVG x coordinate when k intervals are assigned to main set
 * (out of the combined mainset + cooldown pool).
 */
function computeMsCdSnapPositions(
    mainsetBars: ChartBar[],
    cooldownBars: ChartBar[],
    mainsetXOffset: number,
    cooldownXOffset: number,
    mainsetIntervalCount: number,
): number[] {
    const mainsetEnds = computeIntervalEndPositions(mainsetBars, mainsetXOffset)
    const cooldownEnds = computeIntervalEndPositions(cooldownBars, cooldownXOffset)
    const total = mainsetIntervalCount + cooldownEnds.length

    const positions: number[] = [mainsetXOffset]
    for (let k = 1; k <= mainsetIntervalCount; k++) {
        positions.push(mainsetEnds[k - 1] ?? mainsetXOffset)
    }
    for (let k = mainsetIntervalCount + 1; k < total; k++) {
        positions.push(cooldownEnds[k - mainsetIntervalCount - 1] ?? cooldownXOffset)
    }
    // Position for split = total (all cooldown absorbed into mainset, cooldown
    // empty). Mirrors the split = 0 entry on the WU_MS side. Without this the
    // max snap index is total-1 and the handle can never reach the far-right
    // position needed to remove the cool-down section.
    const lastCooldownEnd = cooldownEnds[cooldownEnds.length - 1] ?? cooldownXOffset
    positions.push(lastCooldownEnd)
    return positions
}

/** Returns the index of the snap position nearest to the given SVG x coordinate. */
function nearestSnapIndex(svgX: number, snapPositions: number[]): number {
    let best = 0
    let bestDist = Math.abs(svgX - snapPositions[0])
    for (let i = 1; i < snapPositions.length; i++) {
        const dist = Math.abs(svgX - snapPositions[i])
        if (dist < bestDist) {
            bestDist = dist
            best = i
        }
    }
    return best
}

/**
 * Returns the insert index for dropping a dragged bar at a given SVG x
 * coordinate within the target section. Returns a value from 0 (insert
 * before the first interval) to the section's interval count (append).
 */
function insertIndexAtX(
    svgX: number,
    bars: ChartBar[],
    xOffset: number,
): number {
    const intervalCount = countIntervals(bars)
    if (intervalCount === 0) return 0

    const starts = computeIntervalStartPositions(bars, xOffset)
    const ends = computeIntervalEndPositions(bars, xOffset)

    if (svgX <= starts[0]) return 0
    for (let i = 0; i < intervalCount - 1; i++) {
        // The midpoint between consecutive intervals defines the snap boundary
        const midpoint = ((ends[i] ?? 0) + (starts[i + 1] ?? 0)) / 2
        if (svgX <= midpoint) return i + 1
    }
    return intervalCount
}

interface ChartAreaProps {
    workout: WorkoutDetail
    sections: SectionBars[]
    yMax: number
    totalSeconds: number
    onUndoSection?: (sectionType: SectionType) => void
    isUndoing: boolean
    zonePresets?: ZonePresetView[]
    onAddInterval?: (sectionType: SectionType, interval: ParsedInterval, insertIndex: number) => void
    onSelectInterval?: (sectionType: SectionType, intervalIndex: number) => void
    selectedInterval: { sectionType: SectionType; intervalIndex: number } | null
    onSaveToLibrary?: (sectionType: SectionType) => void
    onReplaceSection?: (sectionType: SectionType) => void
    onReorderInterval?: (sectionType: SectionType, fromIndex: number, toIndex: number) => void
    onMoveInterval?: (
        fromSection: SectionType,
        fromIndex: number,
        toSection: SectionType,
        toIndex: number,
    ) => void
    onSaveBoundaries?: (
        warmupIntervals: ParsedInterval[],
        mainsetIntervals: ParsedInterval[],
        cooldownIntervals: ParsedInterval[],
    ) => void
    onResizeInterval?: (
        sectionType: SectionType,
        intervalIndex: number,
        durationSeconds: number,
        powerPercent: number,
    ) => void
    onUpdateInterval?: (sectionType: SectionType, intervalIndex: number, next: ParsedInterval) => void
    onDeleteInterval?: (sectionType: SectionType, intervalIndex: number) => void
    onMoveTextEvent?: (eventIndex: number, newOffsetSeconds: number) => void
}

/**
 * Renders the SVG bar chart area with section labels above each group.
 * All three sections share a single unified SVG coordinate space, which
 * enables cross-section bar drag and section boundary handles.
 */
function ChartArea({
    workout,
    sections,
    yMax,
    totalSeconds,
    onUndoSection,
    isUndoing,
    zonePresets,
    onAddInterval,
    onSelectInterval,
    selectedInterval,
    onSaveToLibrary,
    onReplaceSection,
    onReorderInterval,
    onMoveInterval,
    onSaveBoundaries,
    onResizeInterval,
    onUpdateInterval,
    onDeleteInterval,
    onMoveTextEvent,
}: ChartAreaProps): JSX.Element {
    const svgRef = useRef<SVGSVGElement | null>(null)
    const containerRef = useRef<HTMLDivElement | null>(null)
    const [boundaryDragActive, setBoundaryDragActive] = useState<BoundaryDragActive | null>(null)
    // Each boundary tracks its own pending state so both can be moved before saving.
    const [wuMsPending, setWuMsPending] = useState<{ count: number; snapPositions: number[] } | null>(null)
    const [msCdPending, setMsCdPending] = useState<{ count: number; snapPositions: number[] } | null>(null)
    const [barDragState, setBarDragState] = useState<BarDragState | null>(null)
    const [resizeDragState, setResizeDragState] = useState<ResizeDragState | null>(null)
    const [paletteDragState, setPaletteDragState] = useState<PaletteDragState | null>(null)
    const [textEventDragState, setTextEventDragState] = useState<TextEventDragState | null>(null)

    const { layouts, totalWidth } = computeLayout(sections, totalSeconds)
    const [warmupLayout, mainsetLayout, cooldownLayout] = layouts

    // Compute the selected bar's on-screen bounds for the inline overlay.
    // Derived synchronously from the selection and layout data; no extra state needed.
    const selectedBarBoundsBase = selectedInterval !== null
        ? computeSelectedBarBoundsCanvas(layouts, selectedInterval.sectionType, selectedInterval.intervalIndex, yMax, totalWidth)
        : null
    // During a right-edge duration drag, update xRightPct live so the overlay
    // tracks the bar's moving right edge.
    const selectedBarBounds = (() => {
        if (selectedBarBoundsBase === null) return null
        if (
            resizeDragState !== null
            && resizeDragState.handle === 'right'
            && selectedInterval !== null
            && resizeDragState.sectionType === selectedInterval.sectionType
            && resizeDragState.intervalIndex === selectedInterval.intervalIndex
        ) {
            return {
                ...selectedBarBoundsBase,
                xRightPct: selectedBarBoundsBase.xLeftPct + (resizeDragState.liveDurationSeconds / totalWidth) * 100,
            }
        }
        return selectedBarBoundsBase
    })()
    const selectedBarInterval = selectedInterval !== null
        ? getIntervalFromWorkout(workout, selectedInterval.sectionType, selectedInterval.intervalIndex)
        : null

    // Snap times for text event dragging: start of each interval in workout seconds.
    const textEventSnapTimes = computeIntervalStartTimesSeconds(sections)
    // Snap radius: 5% of total duration, clamped between 5 and 20 seconds.
    const textEventSnapRadius = Math.min(60, Math.max(15, totalSeconds * 0.08))

    // Boundary handle default x positions (centre of each inter-section gap)
    const wuMsDefaultX = warmupLayout.xOffset + warmupLayout.sectionWidth + SECTION_GAP_SVG / 2
    const msCdDefaultX = mainsetLayout.xOffset + mainsetLayout.sectionWidth + SECTION_GAP_SVG / 2

    function resolvedHandleX(
        boundary: 'WU_MS' | 'MS_CD',
        defaultX: number,
    ): number {
        if (boundaryDragActive?.boundary === boundary) {
            return boundaryDragActive.snapPositions[boundaryDragActive.liveCount] ?? defaultX
        }
        const pending = boundary === 'WU_MS' ? wuMsPending : msCdPending
        if (pending !== null) {
            return pending.snapPositions[pending.count] ?? defaultX
        }
        return defaultX
    }

    function handleBoundaryPointerDown(
        boundary: 'WU_MS' | 'MS_CD',
        e: React.PointerEvent,
    ): void {
        if (svgRef.current === null) return

        e.stopPropagation()
        e.preventDefault()
        svgRef.current.setPointerCapture(e.pointerId)

        const warmupIntervalCount = countIntervals(warmupLayout.section.bars)
        const mainsetIntervalCount = countIntervals(mainsetLayout.section.bars)
        const cooldownIntervalCount = countIntervals(cooldownLayout.section.bars)

        let snapPositions: number[]
        let currentCount: number
        let minCount: number
        let maxCount: number

        if (boundary === 'WU_MS') {
            snapPositions = computeWuMsSnapPositions(
                warmupLayout.section.bars,
                mainsetLayout.section.bars,
                mainsetLayout.xOffset,
                warmupIntervalCount,
            )
            currentCount = warmupIntervalCount
            // Mainset must keep at least 1 interval; warmup can reach 0
            minCount = 0
            maxCount = warmupIntervalCount + mainsetIntervalCount - 1
        } else {
            snapPositions = computeMsCdSnapPositions(
                mainsetLayout.section.bars,
                cooldownLayout.section.bars,
                mainsetLayout.xOffset,
                cooldownLayout.xOffset,
                mainsetIntervalCount,
            )
            currentCount = mainsetIntervalCount
            // Mainset must keep at least 1 interval; cooldown can reach 0
            minCount = 1
            maxCount = mainsetIntervalCount + cooldownIntervalCount
        }

        setBoundaryDragActive({ boundary, liveCount: currentCount, snapPositions, minCount, maxCount })
    }

    function handleResizeHandlePointerDown(
        sectionType: SectionType,
        intervalIndex: number,
        handle: 'right' | 'top',
        originalDurationSeconds: number,
        originalPowerPercent: number,
        e: React.PointerEvent,
    ): void {
        if (svgRef.current === null) return
        e.stopPropagation()
        e.preventDefault()
        svgRef.current.setPointerCapture(e.pointerId)
        const { x: startSvgX, y: startSvgY } = clientToSvgCoords(e.clientX, e.clientY, svgRef.current)
        setResizeDragState({
            sectionType,
            intervalIndex,
            handle,
            startSvgX,
            startSvgY,
            originalDurationSeconds,
            originalPowerPercent,
            liveDurationSeconds: originalDurationSeconds,
            livePowerPercent: originalPowerPercent,
        })
    }

    function handleBarPointerDown(
        sectionType: SectionType,
        intervalIndex: number,
        draggedBars: ChartBar[],
        e: React.PointerEvent,
    ): void {
        if (svgRef.current === null) return
        e.stopPropagation()
        e.preventDefault()
        svgRef.current.setPointerCapture(e.pointerId)

        const { x: pointerSvgX, y: pointerSvgY } = clientToSvgCoords(e.clientX, e.clientY, svgRef.current)
        const layout = layouts.find((l) => l.section.type === sectionType)
        if (layout === undefined) return

        // Record where within the bar the user clicked. barStartX is the SVG x
        // of the left edge of this interval; grabOffsetX is the distance from
        // that edge to the pointer. Subtracting it during drag keeps the bar
        // under exactly the clicked point rather than snapping to the left edge.
        const starts = computeIntervalStartPositions(layout.section.bars, layout.xOffset)
        const barStartX = starts[intervalIndex] ?? pointerSvgX
        const grabOffsetX = pointerSvgX - barStartX

        const insertCount = countIntervals(layout.section.bars)
        const ghostX = layout.xOffset + layout.sectionWidth  // default: append

        setBarDragState({
            sourceSection: sectionType,
            sourceIntervalIndex: intervalIndex,
            draggedBars,
            ghostSection: sectionType,
            ghostInsertIndex: insertCount,
            ghostX,
            pointerSvgX,
            pointerSvgY,
            grabOffsetX,
            grabOffsetY: pointerSvgY,
            hasMoved: false,
        })
    }

    /**
     * Starts a palette drag. Transfers pointer capture to the SVG so that all
     * subsequent pointermove and pointerup events fire on the SVG element,
     * allowing the drop target to be tracked even when the pointer is outside
     * the palette.
     */
    function handlePaletteItemPointerDown(interval: ParsedInterval, e: React.PointerEvent): void {
        if (svgRef.current === null) return
        e.preventDefault()
        // Transfer capture to the SVG so pointermove/up fire there during drag.
        svgRef.current.setPointerCapture(e.pointerId)
        setPaletteDragState({
            interval,
            dropSection: null,
            dropInsertIndex: null,
            dropIndicatorX: null,
            clientX: e.clientX,
            clientY: e.clientY,
        })
    }

    function handleSvgPointerMove(e: React.PointerEvent<SVGSVGElement>): void {
        if (svgRef.current === null) return
        const { x: svgX, y: svgY } = clientToSvgCoords(e.clientX, e.clientY, svgRef.current)

        if (resizeDragState !== null) {
            if (resizeDragState.handle === 'right') {
                const delta = svgX - resizeDragState.startSvgX
                const newDuration = Math.max(10, Math.round(resizeDragState.originalDurationSeconds + delta))
                setResizeDragState((prev) =>
                    prev !== null ? { ...prev, liveDurationSeconds: newDuration } : null,
                )
            } else {
                // Moving up (svgY decreases) increases power, moving down decreases it.
                const deltaSvgY = svgY - resizeDragState.startSvgY
                const deltaPercent = -(deltaSvgY / PLOT_HEIGHT) * yMax
                const newPower = Math.max(1, Math.min(200, Math.round(resizeDragState.originalPowerPercent + deltaPercent)))
                setResizeDragState((prev) =>
                    prev !== null ? { ...prev, livePowerPercent: newPower } : null,
                )
            }
            return
        }

        if (boundaryDragActive !== null) {
            const raw = nearestSnapIndex(svgX, boundaryDragActive.snapPositions)
            const clamped = Math.max(
                boundaryDragActive.minCount,
                Math.min(boundaryDragActive.maxCount, raw),
            )
            setBoundaryDragActive((prev) =>
                prev !== null ? { ...prev, liveCount: clamped } : null,
            )
            return
        }

        if (paletteDragState !== null) {
            // Find which section the pointer is over, using the same hit-area
            // logic as the existing bar drag so gaps are included.
            let paletteTargetLayout: SectionLayout | null = null
            for (const layout of layouts) {
                const end = layout.xOffset + layout.sectionWidth
                if (svgX >= layout.xOffset - SECTION_GAP_SVG / 2 && svgX <= end + SECTION_GAP_SVG / 2) {
                    paletteTargetLayout = layout
                    break
                }
            }

            if (paletteTargetLayout !== null) {
                const insertIdx = insertIndexAtX(svgX, paletteTargetLayout.section.bars, paletteTargetLayout.xOffset)
                const starts = computeIntervalStartPositions(
                    paletteTargetLayout.section.bars,
                    paletteTargetLayout.xOffset,
                )
                const dropX = starts[insertIdx] ?? paletteTargetLayout.xOffset + paletteTargetLayout.sectionWidth
                setPaletteDragState((prev) => prev !== null ? {
                    ...prev,
                    dropSection: paletteTargetLayout!.section.type,
                    dropInsertIndex: insertIdx,
                    dropIndicatorX: dropX,
                    clientX: e.clientX,
                    clientY: e.clientY,
                } : null)
            } else {
                setPaletteDragState((prev) => prev !== null ? {
                    ...prev,
                    dropSection: null,
                    dropInsertIndex: null,
                    dropIndicatorX: null,
                    clientX: e.clientX,
                    clientY: e.clientY,
                } : null)
            }
            return
        }

        if (barDragState !== null) {
            // Determine which section the pointer is over
            let targetLayout: SectionLayout | null = null
            for (const layout of layouts) {
                const end = layout.xOffset + layout.sectionWidth
                if (svgX >= layout.xOffset - SECTION_GAP_SVG / 2 && svgX <= end + SECTION_GAP_SVG / 2) {
                    targetLayout = layout
                    break
                }
            }
            if (targetLayout === null) return

            // Exclude dropping an interval back onto itself in same position
            const insertIdx = insertIndexAtX(svgX, targetLayout.section.bars, targetLayout.xOffset)
            const starts = computeIntervalStartPositions(
                targetLayout.section.bars,
                targetLayout.xOffset,
            )
            const ghostX = starts[insertIdx] ?? targetLayout.xOffset + targetLayout.sectionWidth

            setBarDragState((prev) =>
                prev !== null
                    ? {
                        ...prev,
                        ghostSection: targetLayout!.section.type,
                        ghostInsertIndex: insertIdx,
                        ghostX,
                        pointerSvgX: svgX,
                        pointerSvgY: svgY,
                        hasMoved: true,
                    }
                    : null,
            )
        }
    }

    function handleSvgPointerUp(e: React.PointerEvent<SVGSVGElement>): void {
        if (svgRef.current !== null) {
            svgRef.current.releasePointerCapture(e.pointerId)
        }

        if (paletteDragState !== null) {
            const { interval, dropSection, dropInsertIndex } = paletteDragState
            setPaletteDragState(null)
            if (dropSection !== null && dropInsertIndex !== null) {
                onAddInterval?.(dropSection, interval, dropInsertIndex)
            }
            return
        }

        if (resizeDragState !== null) {
            const { sectionType, intervalIndex, liveDurationSeconds, livePowerPercent } = resizeDragState
            setResizeDragState(null)
            onResizeInterval?.(sectionType, intervalIndex, liveDurationSeconds, livePowerPercent)
            return
        }

        if (boundaryDragActive !== null) {
            const { boundary, liveCount, snapPositions } = boundaryDragActive
            setBoundaryDragActive(null)

            // Only open a pending save if the count actually changed
            const warmupIntervalCount = countIntervals(warmupLayout.section.bars)
            const mainsetIntervalCount = countIntervals(mainsetLayout.section.bars)
            const unchanged =
                (boundary === 'WU_MS' && liveCount === warmupIntervalCount) ||
                (boundary === 'MS_CD' && liveCount === mainsetIntervalCount)
            if (!unchanged) {
                if (boundary === 'WU_MS') {
                    setWuMsPending({ count: liveCount, snapPositions })
                } else {
                    setMsCdPending({ count: liveCount, snapPositions })
                }
            }
            return
        }

        if (barDragState !== null) {
            const {
                sourceSection,
                sourceIntervalIndex,
                ghostSection,
                ghostInsertIndex,
                hasMoved,
            } = barDragState
            setBarDragState(null)

            // A click with no pointer movement selects the interval.
            // We call onSelectInterval directly here because handleBarPointerDown
            // calls e.preventDefault() on the pointerdown event, which suppresses
            // the native click event and prevents the bar's onClick from firing.
            if (!hasMoved) {
                onSelectInterval?.(sourceSection, sourceIntervalIndex)
                return
            }

            if (sourceSection === ghostSection) {
                // Within-section reorder: adjust target index for the removal of the source
                const adjustedIndex =
                    ghostInsertIndex > sourceIntervalIndex
                        ? ghostInsertIndex - 1
                        : ghostInsertIndex
                if (adjustedIndex !== sourceIntervalIndex) {
                    onReorderInterval?.(sourceSection, sourceIntervalIndex, adjustedIndex)
                }
            } else {
                // Cross-section move
                onMoveInterval?.(sourceSection, sourceIntervalIndex, ghostSection, ghostInsertIndex)
            }
        }
    }

    function handleSaveBoundary(): void {
        if (onSaveBoundaries === undefined) return
        if (wuMsPending === null && msCdPending === null) return

        const warmupIntervals = workout.warmupBlock?.intervals ?? []
        const mainsetIntervals = workout.mainsetBlock.intervals
        const cooldownIntervals = workout.cooldownBlock?.intervals ?? []

        // Apply WU_MS split first, then MS_CD on the result. Both may be
        // pending simultaneously when the user has moved both handles before
        // hitting Save.
        let newWarmup = warmupIntervals
        let newMainset = mainsetIntervals
        let newCooldown = cooldownIntervals

        if (wuMsPending !== null) {
            const combined = [...warmupIntervals, ...mainsetIntervals]
            newWarmup = combined.slice(0, wuMsPending.count)
            newMainset = combined.slice(wuMsPending.count)
        }

        if (msCdPending !== null) {
            // msCdPending.count was computed against the original mainset+cooldown
            // pool when the user dragged the handle. If WU_MS also moved, the
            // mainset pool has grown or shrunk by the number of intervals that
            // crossed the WU_MS boundary, so we must adjust the count to refer
            // to the same logical position in the new pool.
            //
            // Formula: adjustedCount = msCdPending.count + originalWarmupCount - wuCount
            // Where wuCount = wuMsPending.count if set, else originalWarmupCount (no change).
            const originalWarmupCount = warmupIntervals.length
            const wuCount = wuMsPending?.count ?? originalWarmupCount
            const adjustedCount = msCdPending.count + originalWarmupCount - wuCount
            const combined = [...newMainset, ...cooldownIntervals]
            const clampedCount = Math.max(1, Math.min(adjustedCount, combined.length))
            newMainset = combined.slice(0, clampedCount)
            newCooldown = combined.slice(clampedCount)
        }

        onSaveBoundaries(newWarmup, newMainset, newCooldown)
        setWuMsPending(null)
        setMsCdPending(null)
    }

    function handleCancelBoundary(): void {
        setWuMsPending(null)
        setMsCdPending(null)
    }

    function handleTextEventPointerDown(
        e: React.PointerEvent,
        eventIndex: number,
        currentOffsetSeconds: number,
    ): void {
        if (containerRef.current === null || onMoveTextEvent === undefined) return
        e.stopPropagation()
        e.preventDefault()
        const rect = containerRef.current.getBoundingClientRect()
        // Record how far the pointer is from the event bar's left edge so the
        // bar does not jump when first grabbed.
        const barLeftPx = (currentOffsetSeconds / totalSeconds) * rect.width
        const grabOffsetX = e.clientX - rect.left - barLeftPx
        containerRef.current.setPointerCapture(e.pointerId)
        setTextEventDragState({
            eventIndex,
            containerRect: rect,
            grabOffsetX,
            liveOffsetSeconds: currentOffsetSeconds,
        })
    }

    function handleContainerPointerMove(e: React.PointerEvent): void {
        if (textEventDragState === null) return
        const { containerRect, grabOffsetX, eventIndex } = textEventDragState
        const rawSeconds =
            ((e.clientX - grabOffsetX - containerRect.left) / containerRect.width) * totalSeconds
        const clamped = Math.max(0, Math.min(totalSeconds, rawSeconds))

        // Include the start and end of every other text event as snap targets so
        // events snap together cleanly.
        const otherEvents = workout.textEvents.filter((_, i) => i !== eventIndex)
        const otherEventSnapTimes = otherEvents.flatMap((ev) => [
            ev.timeOffsetSeconds,
            ev.timeOffsetSeconds + (ev.durationSeconds ?? 0),
        ])
        const snapped = snapIfClose(clamped, [...textEventSnapTimes, ...otherEventSnapTimes], textEventSnapRadius)

        // Enforce no overlap with other text events.
        const myDuration = workout.textEvents[eventIndex]?.durationSeconds ?? 0
        const finalOffset = clampNoOverlap(snapped, myDuration, otherEvents, totalSeconds)

        setTextEventDragState((prev) =>
            prev === null ? null : { ...prev, liveOffsetSeconds: finalOffset },
        )
    }

    function handleContainerPointerUp(e: React.PointerEvent): void {
        if (textEventDragState === null) return
        if (containerRef.current !== null) {
            containerRef.current.releasePointerCapture(e.pointerId)
        }
        onMoveTextEvent?.(textEventDragState.eventIndex, textEventDragState.liveOffsetSeconds)
        setTextEventDragState(null)
    }

    const wuMsHandleX = resolvedHandleX('WU_MS', wuMsDefaultX)
    const msCdHandleX = resolvedHandleX('MS_CD', msCdDefaultX)

    return (
        <div
            className={`
                flex flex-col w-full
                px-3 py-3
                bg-zinc-800/40 border border-zinc-700
                rounded-lg overflow-hidden
            `}
        >
            {/* Labels row: equal thirds so every name stays fully visible
                regardless of how short the section's bars are. */}
            <div className="flex gap-2 mb-1">
                {sections.map((section) => {
                    const alignment =
                        section.type === 'WARMUP' ? 'items-start' :
                        section.type === 'COOLDOWN' ? 'items-end' :
                        'items-center'
                    return (
                        <div
                            key={section.type}
                            className={`flex flex-1 flex-col ${alignment} gap-1 min-w-0`}
                        >
                            <p
                                className={`
                                    text-xs font-semibold tracking-wide uppercase
                                    text-zinc-300 truncate
                                `}
                            >
                                {section.label}
                            </p>
                            <div className="flex items-center gap-2">
                                <UndoButton
                                    sectionType={section.type}
                                    disabled={
                                        section.type === 'MAINSET'
                                            ? !section.hasPrev || isUndoing || onUndoSection === undefined
                                            : (section.isEmptySection && !section.hasPrev) || isUndoing || onUndoSection === undefined
                                    }
                                    onClick={onUndoSection}
                                />
                                {onSaveToLibrary !== undefined && !section.isEmptySection && (
                                    <button
                                        type="button"
                                        onClick={() => onSaveToLibrary(section.type)}
                                        title="Save this section to your block library"
                                        className={`
                                            px-2 py-0.5
                                            bg-zinc-700 text-zinc-200
                                            label-tiny
                                            rounded
                                            hover:bg-zinc-600 transition-colors
                                            focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900
                                        `}
                                    >
                                        Save
                                    </button>
                                )}
                                {onReplaceSection !== undefined && (
                                    <button
                                        type="button"
                                        onClick={() => onReplaceSection(section.type)}
                                        title="Replace this section with a saved library block"
                                        className={`
                                            px-2 py-0.5
                                            bg-zinc-700 text-zinc-200
                                            label-tiny
                                            rounded
                                            hover:bg-zinc-600 transition-colors
                                            focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900
                                        `}
                                    >
                                        Replace
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Chart row: unified SVG spanning all three sections */}
            <div className="flex gap-2">
                <YAxisLegend yMax={yMax} />
                <div
                    ref={containerRef}
                    className="relative flex-1 min-w-0"
                    onPointerMove={handleContainerPointerMove}
                    onPointerUp={handleContainerPointerUp}
                >
                    <UnifiedChart
                        svgRef={svgRef}
                        layouts={layouts}
                        totalWidth={totalWidth}
                        yMax={yMax}
                        onSelectInterval={
                            barDragState === null && resizeDragState === null && paletteDragState === null
                                ? onSelectInterval
                                : undefined
                        }
                        selectedInterval={selectedInterval}
                        wuMsHandleX={wuMsHandleX}
                        msCdHandleX={msCdHandleX}
                        boundaryDragActive={boundaryDragActive}
                        wuMsPending={wuMsPending}
                        msCdPending={msCdPending}
                        barDragState={barDragState}
                        paletteDropIndicatorX={paletteDragState?.dropIndicatorX ?? null}
                        onBoundaryPointerDown={handleBoundaryPointerDown}
                        onBarPointerDown={handleBarPointerDown}
                        onSvgPointerMove={handleSvgPointerMove}
                        onSvgPointerUp={handleSvgPointerUp}
                        canDrag={
                            (onReorderInterval !== undefined || onMoveInterval !== undefined)
                            && resizeDragState === null
                            && paletteDragState === null
                        }
                        canMoveBoundary={
                            onSaveBoundaries !== undefined
                            && resizeDragState === null
                            && paletteDragState === null
                        }
                        onResizeHandlePointerDown={
                            onResizeInterval !== undefined ? handleResizeHandlePointerDown : undefined
                        }
                        resizeDragState={resizeDragState}
                    />

                    {/* Text event bars: white horizontal bars in the top-padding area of
                        the chart, one per text event. Width is proportional to the event's
                        durationSeconds. Text is clipped with overflow-hidden.
                        When onMoveTextEvent is provided the bars are draggable horizontally;
                        the start position snaps to the nearest interval start. */}
                    {workout.textEvents.map((event, i) => {
                        const isDragging =
                            textEventDragState !== null && textEventDragState.eventIndex === i
                        const offsetSeconds = isDragging
                            ? textEventDragState!.liveOffsetSeconds
                            : event.timeOffsetSeconds
                        const leftPct = (offsetSeconds / totalSeconds) * 100
                        const widthPct = Math.max(0.3, ((event.durationSeconds ?? 0) / totalSeconds) * 100)
                        const canDragEvent = onMoveTextEvent !== undefined
                        return (
                            <div
                                key={i}
                                className={`
                                    absolute flex items-center overflow-hidden rounded-sm
                                    ${canDragEvent ? 'cursor-ew-resize' : 'pointer-events-none'}
                                    ${isDragging ? 'opacity-80 ring-1 ring-brand-400' : ''}
                                `}
                                style={{
                                    left: `${leftPct}%`,
                                    width: `${widthPct}%`,
                                    top: 4,
                                    height: 14,
                                    backgroundColor: 'rgba(255, 255, 255, 0.90)',
                                }}
                                onPointerDown={
                                    canDragEvent
                                        ? (e) => handleTextEventPointerDown(e, i, event.timeOffsetSeconds)
                                        : undefined
                                }
                            >
                                <span className="px-1 text-black label-tiny whitespace-nowrap select-none">
                                    {event.message}
                                </span>
                            </div>
                        )
                    })}

                    {/* Inline bar overlay: duration input above bar, power input to the right,
                        trash icon at bottom-left. Only rendered when a bar is selected and
                        the parent provides update/delete callbacks. */}
                    {selectedBarBounds !== null && selectedBarInterval !== null
                        && selectedInterval !== null
                        && (onUpdateInterval !== undefined || onDeleteInterval !== undefined) && (
                        <BarInlineOverlay
                            key={`${selectedInterval.sectionType}-${selectedInterval.intervalIndex}`}
                            interval={selectedBarInterval}
                            xLeftPct={selectedBarBounds.xLeftPct}
                            xRightPct={selectedBarBounds.xRightPct}
                            yTopPx={selectedBarBounds.yTopPx}
                            heightPx={selectedBarBounds.heightPx}
                            onChangeDuration={(seconds) => {
                                if (onUpdateInterval === undefined || selectedInterval === null) return
                                onUpdateInterval(
                                    selectedInterval.sectionType,
                                    selectedInterval.intervalIndex,
                                    { ...selectedBarInterval, durationSeconds: seconds },
                                )
                            }}
                            onChangePower={
                                selectedBarInterval.type !== 'FreeRide'
                                && selectedBarInterval.type !== 'IntervalsT'
                                && selectedBarInterval.type !== 'Warmup'
                                && selectedBarInterval.type !== 'Cooldown'
                                && selectedBarInterval.type !== 'Ramp'
                                ? (percent) => {
                                    if (onUpdateInterval === undefined || selectedInterval === null) return
                                    onUpdateInterval(
                                        selectedInterval.sectionType,
                                        selectedInterval.intervalIndex,
                                        { ...selectedBarInterval, power: percent / 100 },
                                    )
                                } : undefined}
                            onChangeStartPower={
                                (selectedBarInterval.type === 'Warmup' || selectedBarInterval.type === 'Cooldown' || selectedBarInterval.type === 'Ramp')
                                && onUpdateInterval !== undefined
                                ? (percent) => {
                                    if (onUpdateInterval === undefined || selectedInterval === null) return
                                    onUpdateInterval(
                                        selectedInterval.sectionType,
                                        selectedInterval.intervalIndex,
                                        { ...selectedBarInterval, power: percent / 100 },
                                    )
                                } : undefined}
                            onChangeEndPower={
                                (selectedBarInterval.type === 'Warmup' || selectedBarInterval.type === 'Cooldown' || selectedBarInterval.type === 'Ramp')
                                && onUpdateInterval !== undefined
                                ? (percent) => {
                                    if (onUpdateInterval === undefined || selectedInterval === null) return
                                    onUpdateInterval(
                                        selectedInterval.sectionType,
                                        selectedInterval.intervalIndex,
                                        { ...selectedBarInterval, powerHigh: percent / 100 },
                                    )
                                } : undefined}
                            yRampStartCenterPx={selectedBarBounds.yRampStartCenterPx}
                            yRampEndCenterPx={selectedBarBounds.yRampEndCenterPx}
                            onDelete={() => {
                                if (onDeleteInterval === undefined || selectedInterval === null) return
                                onDeleteInterval(
                                    selectedInterval.sectionType,
                                    selectedInterval.intervalIndex,
                                )
                            }}
                            onAddRepeat={selectedBarInterval.type === 'IntervalsT' && onUpdateInterval !== undefined ? () => {
                                if (onUpdateInterval === undefined || selectedInterval === null) return
                                const currentRepeat = selectedBarInterval.repeat ?? 1
                                const onDur = selectedBarInterval.onDuration ?? 0
                                const offDur = selectedBarInterval.offDuration ?? 0
                                const newRepeat = currentRepeat + 1
                                onUpdateInterval(
                                    selectedInterval.sectionType,
                                    selectedInterval.intervalIndex,
                                    {
                                        ...selectedBarInterval,
                                        repeat: newRepeat,
                                        durationSeconds: newRepeat * (onDur + offDur),
                                    },
                                )
                            } : undefined}
                            onRemoveRepeat={selectedBarInterval.type === 'IntervalsT' && onUpdateInterval !== undefined ? () => {
                                if (onUpdateInterval === undefined || selectedInterval === null) return
                                const currentRepeat = selectedBarInterval.repeat ?? 1
                                if (currentRepeat <= 1) return
                                const onDur = selectedBarInterval.onDuration ?? 0
                                const offDur = selectedBarInterval.offDuration ?? 0
                                const newRepeat = currentRepeat - 1
                                onUpdateInterval(
                                    selectedInterval.sectionType,
                                    selectedInterval.intervalIndex,
                                    {
                                        ...selectedBarInterval,
                                        repeat: newRepeat,
                                        durationSeconds: newRepeat * (onDur + offDur),
                                    },
                                )
                            } : undefined}
                            onChangeOnDuration={selectedBarInterval.type === 'IntervalsT' && onUpdateInterval !== undefined ? (seconds) => {
                                if (onUpdateInterval === undefined || selectedInterval === null) return
                                const offDur = selectedBarInterval.offDuration ?? 0
                                const repeat = selectedBarInterval.repeat ?? 1
                                onUpdateInterval(
                                    selectedInterval.sectionType,
                                    selectedInterval.intervalIndex,
                                    {
                                        ...selectedBarInterval,
                                        onDuration: seconds,
                                        durationSeconds: repeat * (seconds + offDur),
                                    },
                                )
                            } : undefined}
                            onChangeOnPower={selectedBarInterval.type === 'IntervalsT' && onUpdateInterval !== undefined ? (percent) => {
                                if (onUpdateInterval === undefined || selectedInterval === null) return
                                onUpdateInterval(
                                    selectedInterval.sectionType,
                                    selectedInterval.intervalIndex,
                                    { ...selectedBarInterval, onPower: percent / 100 },
                                )
                            } : undefined}
                            onChangeOffDuration={selectedBarInterval.type === 'IntervalsT' && onUpdateInterval !== undefined ? (seconds) => {
                                if (onUpdateInterval === undefined || selectedInterval === null) return
                                const onDur = selectedBarInterval.onDuration ?? 0
                                const repeat = selectedBarInterval.repeat ?? 1
                                onUpdateInterval(
                                    selectedInterval.sectionType,
                                    selectedInterval.intervalIndex,
                                    {
                                        ...selectedBarInterval,
                                        offDuration: seconds,
                                        durationSeconds: repeat * (onDur + seconds),
                                    },
                                )
                            } : undefined}
                            onChangeOffPower={selectedBarInterval.type === 'IntervalsT' && onUpdateInterval !== undefined ? (percent) => {
                                if (onUpdateInterval === undefined || selectedInterval === null) return
                                onUpdateInterval(
                                    selectedInterval.sectionType,
                                    selectedInterval.intervalIndex,
                                    { ...selectedBarInterval, offPower: percent / 100 },
                                )
                            } : undefined}
                        />
                    )}
                </div>
            </div>

            {/* Boundary pending row: shown when one or both boundaries have
                been moved but not yet saved. */}
            {(wuMsPending !== null || msCdPending !== null) && (
                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-zinc-700">
                    <p className="text-xs text-zinc-400">
                        Section {wuMsPending !== null && msCdPending !== null ? 'boundaries' : 'boundary'} moved. Save to apply.
                    </p>
                    <button
                        type="button"
                        onClick={handleSaveBoundary}
                        disabled={onSaveBoundaries === undefined}
                        className={`
                            px-3 py-1
                            bg-brand-600 text-white
                            label-tiny
                            rounded
                            hover:bg-brand-500 transition-colors
                            focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900
                            disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                    >
                        Save Boundary
                    </button>
                    <button
                        type="button"
                        onClick={handleCancelBoundary}
                        className={`
                            px-3 py-1
                            bg-zinc-700 text-zinc-200
                            label-tiny
                            rounded
                            hover:bg-zinc-600 transition-colors
                            focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900
                        `}
                    >
                        Cancel
                    </button>
                </div>
            )}

            {/* Interval palette: drag any item onto the chart to add an interval. */}
            {onAddInterval !== undefined && (
                <IntervalPalette
                    zonePresets={zonePresets}
                    onItemPointerDown={handlePaletteItemPointerDown}
                    isDragging={paletteDragState !== null}
                />
            )}

            {/* Floating ghost: follows the cursor while dragging from the palette. */}
            {paletteDragState !== null && (
                <div
                    style={{
                        position: 'fixed',
                        left: paletteDragState.clientX - 22,
                        top: paletteDragState.clientY - 68,
                        pointerEvents: 'none',
                        zIndex: 9999,
                        opacity: 0.9,
                    }}
                >
                    <div className="bg-zinc-800 border border-zinc-600 rounded p-1">
                        <PaletteItemShape interval={paletteDragState.interval} />
                    </div>
                </div>
            )}
        </div>
    )
}

interface UnifiedChartProps {
    svgRef: React.RefObject<SVGSVGElement | null>
    layouts: SectionLayout[]
    totalWidth: number
    yMax: number
    onSelectInterval?: (sectionType: SectionType, intervalIndex: number) => void
    selectedInterval: { sectionType: SectionType; intervalIndex: number } | null
    wuMsHandleX: number
    msCdHandleX: number
    boundaryDragActive: BoundaryDragActive | null
    wuMsPending: { count: number; snapPositions: number[] } | null
    msCdPending: { count: number; snapPositions: number[] } | null
    barDragState: BarDragState | null
    /** SVG x position of the palette drop indicator, or null when not dragging. */
    paletteDropIndicatorX: number | null
    onBoundaryPointerDown: (boundary: 'WU_MS' | 'MS_CD', e: React.PointerEvent) => void
    onBarPointerDown: (
        sectionType: SectionType,
        intervalIndex: number,
        draggedBars: ChartBar[],
        e: React.PointerEvent,
    ) => void
    onSvgPointerMove: (e: React.PointerEvent<SVGSVGElement>) => void
    onSvgPointerUp: (e: React.PointerEvent<SVGSVGElement>) => void
    /** Whether bar drag is enabled (parent has provided drag callbacks). */
    canDrag: boolean
    /** Whether boundary drag is enabled (parent has provided boundary callback). */
    canMoveBoundary: boolean
    /**
     * Called when the user starts dragging a resize handle on a SteadyState bar.
     * When undefined, resize handles are not rendered.
     */
    onResizeHandlePointerDown?: (
        sectionType: SectionType,
        intervalIndex: number,
        handle: 'right' | 'top',
        originalDurationSeconds: number,
        originalPowerPercent: number,
        e: React.PointerEvent,
    ) => void
    /** Active resize drag state, used to apply live values to the bar being resized. */
    resizeDragState: ResizeDragState | null
}

/**
 * Renders all three sections in a single SVG coordinate space. Section
 * backgrounds are tinted rects; bars are positioned using a global x offset
 * per section. Boundary handles and a bar-drag ghost bar are overlaid in the
 * same coordinate space, making cross-section interactions practical.
 */
function UnifiedChart({
    svgRef,
    layouts,
    totalWidth,
    yMax,
    onSelectInterval,
    selectedInterval,
    wuMsHandleX,
    msCdHandleX,
    boundaryDragActive,
    wuMsPending,
    msCdPending,
    barDragState,
    paletteDropIndicatorX,
    onBoundaryPointerDown,
    onBarPointerDown,
    onSvgPointerMove,
    onSvgPointerUp,
    canDrag,
    canMoveBoundary,
    onResizeHandlePointerDown,
    resizeDragState,
}: UnifiedChartProps): JSX.Element {
    const isDraggingBoundary = boundaryDragActive !== null
    const isDraggingBar = barDragState !== null

    return (
        <svg
            ref={svgRef}
            viewBox={`0 -${TOP_PADDING} ${totalWidth} ${PLOT_HEIGHT + TOP_PADDING}`}
            preserveAspectRatio="none"
            className="block w-full"
            style={{ height: `${PLOT_HEIGHT + TOP_PADDING}px`, userSelect: 'none' }}
            onPointerMove={onSvgPointerMove}
            onPointerUp={onSvgPointerUp}
        >
            {/* Section background rects */}
            {layouts.map((layout) => {
                const fill = layout.section.type === 'MAINSET'
                    ? 'rgba(24, 24, 27, 0.4)'   // zinc-900/40
                    : 'rgba(24, 24, 27, 0.2)'   // zinc-900/20
                return (
                    <rect
                        key={layout.section.type}
                        x={layout.xOffset}
                        y={-TOP_PADDING}
                        width={layout.sectionWidth}
                        height={PLOT_HEIGHT + TOP_PADDING}
                        fill={fill}
                    />
                )
            })}

            {/* Bars for each section */}
            {layouts.map((layout) => {
                if (layout.section.bars.length === 0) {
                    return null
                }

                return buildSectionShapes(
                    layout.section.bars,
                    yMax,
                    layout.section.type,
                    layout.xOffset,
                    totalWidth,
                    onSelectInterval,
                    selectedInterval?.sectionType === layout.section.type
                        ? selectedInterval.intervalIndex
                        : null,
                    canDrag
                        ? (section, idx, bars, e) => onBarPointerDown(section, idx, bars, e)
                        : undefined,
                    barDragState?.sourceSection === layout.section.type
                        ? barDragState.sourceIntervalIndex
                        : null,
                    onResizeHandlePointerDown,
                    resizeDragState?.sectionType === layout.section.type
                        ? resizeDragState
                        : null,
                )
            })}

            {/* Ghost bar: follows the cursor in both axes. The grab offsets
                ensure the bar stays under exactly the pixel that was clicked
                rather than jumping to a centred or left-aligned position. */}
            {barDragState !== null && (
                <g
                    pointerEvents="none"
                    transform={`translate(0, ${barDragState.pointerSvgY - barDragState.grabOffsetY})`}
                >
                    {buildGhostShapes(
                        barDragState.draggedBars,
                        yMax,
                        barDragState.pointerSvgX - barDragState.grabOffsetX,
                        totalWidth,
                    )}
                </g>
            )}

            {/* Drop indicator: thick solid line at the snapped insert position. */}
            {barDragState !== null && (
                <line
                    x1={barDragState.ghostX}
                    y1={-TOP_PADDING}
                    x2={barDragState.ghostX}
                    y2={PLOT_HEIGHT}
                    stroke="rgba(34,197,94,0.9)"
                    strokeWidth={3}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                />
            )}

            {/* Palette drop indicator: shown when the user drags from the palette
                and the cursor is over a valid drop section. */}
            {paletteDropIndicatorX !== null && (
                <line
                    x1={paletteDropIndicatorX}
                    y1={-TOP_PADDING}
                    x2={paletteDropIndicatorX}
                    y2={PLOT_HEIGHT}
                    stroke="rgba(34,197,94,0.9)"
                    strokeWidth={3}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                />
            )}

            {/* Boundary handle: WU/MS */}
            {layouts.length >= 2 && (
                <BoundaryHandle
                    x={wuMsHandleX}
                    boundary="WU_MS"
                    isActive={boundaryDragActive?.boundary === 'WU_MS'}
                    hasPending={wuMsPending !== null}
                    canMove={canMoveBoundary && !isDraggingBar}
                    onPointerDown={onBoundaryPointerDown}
                    isDraggingBoundary={isDraggingBoundary}
                />
            )}

            {/* Boundary handle: MS/CD */}
            {layouts.length >= 3 && (
                <BoundaryHandle
                    x={msCdHandleX}
                    boundary="MS_CD"
                    isActive={boundaryDragActive?.boundary === 'MS_CD'}
                    hasPending={msCdPending !== null}
                    canMove={canMoveBoundary && !isDraggingBar}
                    onPointerDown={onBoundaryPointerDown}
                    isDraggingBoundary={isDraggingBoundary}
                />
            )}
        </svg>
    )
}

interface BoundaryHandleProps {
    x: number
    boundary: 'WU_MS' | 'MS_CD'
    isActive: boolean
    hasPending: boolean
    canMove: boolean
    onPointerDown: (boundary: 'WU_MS' | 'MS_CD', e: React.PointerEvent) => void
    isDraggingBoundary: boolean
}

/**
 * A draggable vertical handle rendered between two sections. The handle is a
 * subtle line with small tick marks, styled to hint at interactivity without
 * dominating the chart.
 */
function BoundaryHandle({
    x,
    boundary,
    isActive,
    hasPending,
    canMove,
    onPointerDown,
    isDraggingBoundary,
}: BoundaryHandleProps): JSX.Element {
    const colour = isActive
        ? 'rgba(255,255,255,0.9)'
        : hasPending
        ? 'rgba(34,197,94,0.9)'    // brand green when pending
        : 'rgba(161,161,170,0.35)' // subtle zinc when idle

    const cursor = canMove && !isDraggingBoundary ? 'col-resize' : 'default'
    // A wider invisible rect behind the line gives a larger pointer target
    const hitAreaWidth = 12

    return (
        <g
            onPointerDown={canMove ? (e) => onPointerDown(boundary, e) : undefined}
            style={{ cursor }}
        >
            {/* Invisible wide hit area */}
            <rect
                x={x - hitAreaWidth / 2}
                y={-TOP_PADDING}
                width={hitAreaWidth}
                height={PLOT_HEIGHT + TOP_PADDING}
                fill="transparent"
            />
            {/* Visible line */}
            <line
                x1={x}
                y1={-TOP_PADDING}
                x2={x}
                y2={PLOT_HEIGHT}
                stroke={colour}
                strokeWidth={isActive || hasPending ? 2 : 1}
                vectorEffect="non-scaling-stroke"
            />
            {/* Grip ticks at the centre of the line */}
            {[PLOT_HEIGHT * 0.42, PLOT_HEIGHT * 0.5, PLOT_HEIGHT * 0.58].map((tickY) => (
                <line
                    key={tickY}
                    x1={x - 3}
                    y1={tickY}
                    x2={x + 3}
                    y2={tickY}
                    stroke={colour}
                    strokeWidth={isActive || hasPending ? 2 : 1}
                    vectorEffect="non-scaling-stroke"
                />
            ))}
        </g>
    )
}

/**
 * Lays out a section's bars as positioned SVG shapes using a global x offset.
 * Returns an array of JSX elements that can be rendered inside a shared SVG.
 *
 * @param bars                       the chart bars for this section
 * @param yMax                       Y-axis upper bound in percent FTP
 * @param sectionType                used to identify bars for selection and drag
 * @param xOffset                    offset added to every bar's local x position
 * @param svgTotalWidth              full SVG viewBox width in seconds, used to compute
 *                                   aspect-ratio-compensated corner radii
 * @param onSelectInterval           called when the user clicks a bar
 * @param selectedIndex              interval index that should receive a highlight stroke
 * @param onBarPointerDown           called when the user initiates a drag on a bar
 * @param draggingIndex              the interval index currently being dragged (rendered faded)
 * @param onResizeHandlePointerDown  called when the user starts dragging a resize handle;
 *                                   when undefined, resize handles are not rendered
 * @param activeResizeDrag           active resize drag for this section; used to apply
 *                                   live duration or power values while dragging
 */
function buildSectionShapes(
    bars: ChartBar[],
    yMax: number,
    sectionType: SectionType,
    xOffset: number,
    svgTotalWidth: number,
    onSelectInterval: ((sectionType: SectionType, intervalIndex: number) => void) | undefined,
    selectedIndex: number | null,
    onBarPointerDown:
        | ((sectionType: SectionType, idx: number, bars: ChartBar[], e: React.PointerEvent) => void)
        | undefined,
    draggingIndex: number | null,
    onResizeHandlePointerDown:
        | ((
            sectionType: SectionType,
            intervalIndex: number,
            handle: 'right' | 'top',
            originalDurationSeconds: number,
            originalPowerPercent: number,
            e: React.PointerEvent,
          ) => void)
        | undefined,
    activeResizeDrag: ResizeDragState | null,
): JSX.Element[] {
    const shapes: JSX.Element[] = []
    let cursor = xOffset

    for (let i = 0; i < bars.length; i++) {
        const bar = bars[i]
        if (i > 0) {
            const prev = bars[i - 1]
            const sameGroup = bar.groupId !== null && bar.groupId === prev.groupId
            cursor += sameGroup ? GROUP_INNER_GAP_SECONDS : BAR_GAP_SECONDS
        }

        const isSelected =
            bar.sourceIntervalIndex !== null
            && bar.sourceIntervalIndex === selectedIndex

        const isDragging =
            bar.sourceIntervalIndex !== null
            && bar.sourceIntervalIndex === draggingIndex

        const handleClick =
            onSelectInterval !== undefined && bar.sourceIntervalIndex !== null
                ? () => onSelectInterval(sectionType, bar.sourceIntervalIndex as number)
                : undefined

        // Collect all bars for this interval (needed for the drag ghost)
        const intervalBars =
            onBarPointerDown !== undefined && bar.sourceIntervalIndex !== null
                ? bars.filter((b) => b.sourceIntervalIndex === bar.sourceIntervalIndex)
                : []

        const handlePointerDown =
            onBarPointerDown !== undefined && bar.sourceIntervalIndex !== null
                ? (e: React.PointerEvent) =>
                    onBarPointerDown(sectionType, bar.sourceIntervalIndex as number, intervalBars, e)
                : undefined

        // Ramp bars support right-edge (duration) resize; flat bars support both edges.
        // IntervalsT sub-bars share a groupId and are excluded from all resize.
        const isResizeEligible =
            (bar.style === 'flat' || bar.style === 'ramp')
            && bar.groupId === null
            && bar.sourceIntervalIndex !== null
            && onResizeHandlePointerDown !== undefined

        const onRightEdgePointerDown = isResizeEligible
            ? (e: React.PointerEvent) =>
                onResizeHandlePointerDown!(
                    sectionType,
                    bar.sourceIntervalIndex as number,
                    'right',
                    bar.durationSeconds,
                    bar.powerPercent,
                    e,
                )
            : undefined

        // Ramps have no single power value; top-edge resize applies to flat bars only.
        const onTopEdgePointerDown = isResizeEligible && bar.style === 'flat'
            ? (e: React.PointerEvent) =>
                onResizeHandlePointerDown!(
                    sectionType,
                    bar.sourceIntervalIndex as number,
                    'top',
                    bar.durationSeconds,
                    bar.powerPercent,
                    e,
                )
            : undefined

        // Apply live values from an active resize drag for this bar.
        const isBeingResized =
            activeResizeDrag !== null
            && bar.sourceIntervalIndex === activeResizeDrag.intervalIndex
        const liveDurationSeconds =
            isBeingResized && activeResizeDrag!.handle === 'right'
                ? activeResizeDrag!.liveDurationSeconds
                : undefined
        const livePowerPercent =
            isBeingResized && activeResizeDrag!.handle === 'top'
                ? activeResizeDrag!.livePowerPercent
                : undefined

        // Use live duration for cursor accumulation so subsequent bars
        // shift position in real time during a right-edge resize drag.
        const effectiveDuration = liveDurationSeconds ?? bar.durationSeconds

        shapes.push(
            <BarShape
                key={i}
                bar={bar}
                x={cursor}
                yMax={yMax}
                svgTotalWidth={svgTotalWidth}
                isSelected={isSelected}
                isDragging={isDragging}
                onClick={handleClick}
                onPointerDown={handlePointerDown}
                onRightEdgePointerDown={onRightEdgePointerDown}
                onTopEdgePointerDown={onTopEdgePointerDown}
                liveDurationSeconds={liveDurationSeconds}
                livePowerPercent={livePowerPercent}
            />,
        )

        cursor += effectiveDuration
    }

    return shapes
}

/**
 * Builds semi-transparent ghost bar shapes for the drag preview. The bars
 * are rendered at the given x start position using the same shape logic
 * as regular bars but with reduced opacity.
 */
function buildGhostShapes(
    bars: ChartBar[],
    yMax: number,
    ghostX: number,
    svgTotalWidth: number,
): JSX.Element[] {
    const shapes: JSX.Element[] = []
    let cursor = ghostX

    for (let i = 0; i < bars.length; i++) {
        const bar = bars[i]
        if (i > 0) {
            const prev = bars[i - 1]
            cursor += bar.groupId !== null && bar.groupId === prev.groupId
                ? GROUP_INNER_GAP_SECONDS
                : BAR_GAP_SECONDS
        }

        shapes.push(
            <BarShape
                key={`ghost-${i}`}
                bar={bar}
                x={cursor}
                yMax={yMax}
                svgTotalWidth={svgTotalWidth}
                isSelected={false}
                isDragging={false}
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
    /**
     * The SVG viewBox width in seconds. Used to compute a horizontal corner
     * radius that compensates for the non-uniform x/y scaling caused by
     * preserveAspectRatio="none", so corners look circular rather than sloped.
     */
    svgTotalWidth: number
    isSelected: boolean
    /** True when this bar is the one being dragged. Renders faded. */
    isDragging: boolean
    onClick?: () => void
    onPointerDown?: (e: React.PointerEvent) => void
    /**
     * Called when the user starts dragging the right edge of a SteadyState bar.
     * Only provided for eligible bars; when absent, the handle is not rendered.
     */
    onRightEdgePointerDown?: (e: React.PointerEvent) => void
    /**
     * Called when the user starts dragging the top edge of a SteadyState bar.
     * Only provided for eligible bars; when absent, the handle is not rendered.
     */
    onTopEdgePointerDown?: (e: React.PointerEvent) => void
    /**
     * Live duration in seconds during a right-edge resize drag. When provided,
     * overrides bar.durationSeconds for rendering. Undefined outside a drag.
     */
    liveDurationSeconds?: number
    /**
     * Live power in percent FTP during a top-edge resize drag. When provided,
     * overrides bar.powerPercent for rendering. Undefined outside a drag.
     */
    livePowerPercent?: number
}

/**
 * Renders a single chart bar in the style appropriate for its source
 * interval: a flat rectangle for SteadyState and IntervalsT bars, a
 * gradient-filled polygon for ramps, and a grey wavy-top block for Free
 * Ride. Supports selection highlight, drag-source fading, and ghost preview.
 */
function BarShape({
    bar,
    x,
    yMax,
    svgTotalWidth,
    isSelected,
    isDragging,
    onClick,
    onPointerDown,
    onRightEdgePointerDown,
    onTopEdgePointerDown,
    liveDurationSeconds,
    livePowerPercent,
}: BarShapeProps): JSX.Element {
    const [hoverRight, setHoverRight] = useState(false)
    const [hoverTop, setHoverTop] = useState(false)

    const hasInteraction = onClick !== undefined || onPointerDown !== undefined
    const cursorClass = hasInteraction ? 'cursor-pointer' : ''
    const selectionStroke = isSelected ? '#FFFFFF' : 'none'
    // The in-place ghost (isDragging) stays faded so the user can see where
    // the bar came from. The floating ghost that follows the cursor renders
    // at full opacity so it looks like the real bar being carried.
    const opacity = isDragging ? 0.3 : 1

    // The SVG uses preserveAspectRatio="none" with a fixed height of PLOT_HEIGHT
    // px. This means 1 SVG y-unit = 1px exactly, but 1 SVG x-unit varies by
    // workout duration. To produce circular-looking corners, ry is fixed in
    // SVG units (= px) and rx is scaled by the viewBox aspect ratio.
    // ASSUMED_CONTAINER_PX is a reasonable estimate of the rendered container
    // width in screen pixels; the assumption only affects how circular the
    // corners appear, not correctness.
    const ASSUMED_CONTAINER_PX = 700
    const RY_PX = 4
    const ry = RY_PX   // SVG y-units ≈ screen px since height is fixed 1:1

    if (bar.style === 'ramp' && bar.startPowerPercent !== null && bar.endPowerPercent !== null) {
        const renderDuration = liveDurationSeconds ?? bar.durationSeconds
        const startHeight = (bar.startPowerPercent / yMax) * PLOT_HEIGHT
        const endHeight = (bar.endPowerPercent / yMax) * PLOT_HEIGHT
        const startY = PLOT_HEIGHT - startHeight
        const endY = PLOT_HEIGHT - endHeight
        const w = renderDuration
        // rx compensates for non-uniform SVG scaling so corners look circular.
        // Capped at 25% of bar width and 15% of each end height.
        const rx = Math.min(
            RY_PX * svgTotalWidth / ASSUMED_CONTAINER_PX,
            w * 0.25,
            startHeight * 0.15,
            endHeight * 0.15,
        )

        // Top edge direction vector (from top-left to top-right)
        const dx = w
        const dy = endY - startY
        const len = Math.sqrt(dx * dx + dy * dy)
        const ux = dx / len   // unit vector along top edge
        const uy = dy / len

        // For a sloped edge, use the smaller of rx/ry as the uniform corner
        // radius so neither dimension overshoots its allowed value.
        const r = Math.min(rx, ry)
        // Rounded-corner path for a trapezoid with only the top corners rounded.
        // The bottom two corners stay sharp so the bar sits flush with the baseline.
        //
        // Top-left corner: incoming direction is up the left edge (0, -1),
        //   outgoing direction is along the top edge (ux, uy).
        // Top-right corner: incoming direction is along the top edge (ux, uy),
        //   outgoing direction is down the right edge (0, 1).
        const rampPath = [
            // Start at bottom-left
            `M ${x},${PLOT_HEIGHT}`,
            // Up the left edge, stopping r units before the top-left corner
            `L ${x},${startY + r}`,
            // Quadratic bezier around top-left corner
            `Q ${x},${startY} ${x + ux * r},${startY + uy * r}`,
            // Along the sloped top, stopping r units before the top-right corner
            `L ${x + w - ux * r},${endY - uy * r}`,
            // Quadratic bezier around top-right corner
            `Q ${x + w},${endY} ${x + w},${endY + r}`,
            // Down the right edge to the bottom-right
            `L ${x + w},${PLOT_HEIGHT}`,
            'Z',
        ].join(' ')

        const startColour = getColourForZone(getZoneForPower(bar.startPowerPercent))
        const endColour = getColourForZone(getZoneForPower(bar.endPowerPercent))
        const gradientId = `ramp-${x}-${bar.durationSeconds}`

        const HANDLE_HIT_PX_RAMP = 8
        const hitWRamp = Math.min(HANDLE_HIT_PX_RAMP * svgTotalWidth / ASSUMED_CONTAINER_PX, w * 0.4)
        const isResizingRamp = liveDurationSeconds !== undefined
        const rampRightLineColour = hoverRight || isResizingRamp
            ? 'rgba(255,255,255,0.85)'
            : 'rgba(255,255,255,0.18)'

        return (
            <g opacity={opacity}>
                <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={startColour} />
                        <stop offset="100%" stopColor={endColour} />
                    </linearGradient>
                </defs>
                <path
                    d={rampPath}
                    fill={`url(#${gradientId})`}
                    stroke={selectionStroke}
                    strokeWidth={isSelected ? 2 : 0}
                    vectorEffect="non-scaling-stroke"
                    onClick={onClick}
                    onPointerDown={onPointerDown}
                    className={cursorClass}
                />
                {onRightEdgePointerDown !== undefined && (
                    <g
                        onPointerEnter={() => setHoverRight(true)}
                        onPointerLeave={() => setHoverRight(false)}
                    >
                        {/* Visible indicator line at the right edge of the ramp */}
                        <line
                            x1={x + w}
                            y1={endY}
                            x2={x + w}
                            y2={PLOT_HEIGHT}
                            stroke={rampRightLineColour}
                            strokeWidth={2}
                            vectorEffect="non-scaling-stroke"
                            pointerEvents="none"
                        />
                        {/* Transparent hit area along the ramp's right edge */}
                        <rect
                            x={x + w - hitWRamp}
                            y={endY}
                            width={hitWRamp}
                            height={PLOT_HEIGHT - endY}
                            fill="transparent"
                            className="cursor-ew-resize"
                            onPointerDown={(e) => { e.stopPropagation(); onRightEdgePointerDown(e) }}
                            onClick={(e) => e.stopPropagation()}
                        />
                    </g>
                )}
            </g>
        )
    }

    if (bar.style === 'freeride') {
        const baseHeight = (bar.powerPercent / yMax) * PLOT_HEIGHT
        const baseTopY = PLOT_HEIGHT - baseHeight
        const amplitude = Math.max(baseHeight * 0.06, 4)
        const segments = Math.max(8, Math.round(bar.durationSeconds / 30))
        const points: string[] = []
        for (let i = 0; i <= segments; i++) {
            const t = i / segments
            const px = x + t * bar.durationSeconds
            const py = baseTopY - Math.sin(t * Math.PI * 2) * amplitude
            points.push(`${i === 0 ? 'M' : 'L'} ${px} ${py}`)
        }
        points.push(`L ${x + bar.durationSeconds} ${PLOT_HEIGHT}`)
        points.push(`L ${x} ${PLOT_HEIGHT}`)
        points.push('Z')
        return (
            <g
                onClick={onClick}
                onPointerDown={onPointerDown}
                className={cursorClass}
                opacity={opacity}
            >
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

    // Use live values if provided (during a resize drag for this bar).
    const renderDuration = liveDurationSeconds ?? bar.durationSeconds
    const renderPower = livePowerPercent ?? bar.powerPercent

    const height = (renderPower / yMax) * PLOT_HEIGHT
    const y = PLOT_HEIGHT - height
    const w = renderDuration
    const fill = getColourForZone(getZoneForPower(renderPower))
    // rx compensates for non-uniform SVG scaling; ry is in px-equivalent units.
    // Both are capped to prevent over-rounding short or flat bars.
    const rxFlat = Math.min(RY_PX * svgTotalWidth / ASSUMED_CONTAINER_PX, w * 0.25)
    const ryFlat = Math.min(ry, height / 3)
    // Axis-aligned edges allow separate rx/ry in the path for a proper elliptical
    // corner. Only the top two corners are rounded; the bottom stays flush.
    const rectPath = [
        `M ${x + rxFlat},${y}`,
        `L ${x + w - rxFlat},${y}`,
        `Q ${x + w},${y} ${x + w},${y + ryFlat}`,
        `L ${x + w},${y + height}`,
        `L ${x},${y + height}`,
        `L ${x},${y + ryFlat}`,
        `Q ${x},${y} ${x + rxFlat},${y}`,
        'Z',
    ].join(' ')

    const hasHandles = onRightEdgePointerDown !== undefined || onTopEdgePointerDown !== undefined

    if (!hasHandles) {
        return (
            <path
                d={rectPath}
                fill={fill}
                stroke={selectionStroke}
                strokeWidth={isSelected ? 2 : 0}
                vectorEffect="non-scaling-stroke"
                onClick={onClick}
                onPointerDown={onPointerDown}
                className={cursorClass}
                opacity={opacity}
            />
        )
    }

    // Hit-area widths compensate for the non-uniform SVG x scaling so handles
    // are consistently 8px wide in screen pixels regardless of workout duration.
    // Same technique as rxFlat above. Capped at 40% of the bar dimension so
    // handles never swamp a very short or very flat bar.
    const HANDLE_HIT_PX = 8
    const hitWRight = Math.min(HANDLE_HIT_PX * svgTotalWidth / ASSUMED_CONTAINER_PX, w * 0.4)
    const hitHTop = Math.min(HANDLE_HIT_PX, height * 0.4)

    // Active drag detection for styling: live values are only passed when this
    // specific bar is being resized, so their presence implies active drag.
    const isResizingRight = liveDurationSeconds !== undefined
    const isResizingTop = livePowerPercent !== undefined

    const rightLineColour = hoverRight || isResizingRight
        ? 'rgba(255,255,255,0.85)'
        : 'rgba(255,255,255,0.18)'
    const topLineColour = hoverTop || isResizingTop
        ? 'rgba(255,255,255,0.85)'
        : 'rgba(255,255,255,0.18)'

    return (
        <g opacity={opacity}>
            <path
                d={rectPath}
                fill={fill}
                stroke={selectionStroke}
                strokeWidth={isSelected ? 2 : 0}
                vectorEffect="non-scaling-stroke"
                onClick={onClick}
                onPointerDown={onPointerDown}
                className={cursorClass}
            />

            {/* Right-edge handle: drag left/right to change interval duration. */}
            {onRightEdgePointerDown !== undefined && (
                <g
                    onPointerEnter={() => setHoverRight(true)}
                    onPointerLeave={() => setHoverRight(false)}
                >
                    {/* Visible indicator line at the right edge */}
                    <line
                        x1={x + w}
                        y1={y}
                        x2={x + w}
                        y2={y + height}
                        stroke={rightLineColour}
                        strokeWidth={2}
                        vectorEffect="non-scaling-stroke"
                        pointerEvents="none"
                    />
                    {/* Transparent hit area covering the right portion of the bar */}
                    <rect
                        x={x + w - hitWRight}
                        y={y}
                        width={hitWRight}
                        height={height}
                        fill="transparent"
                        className="cursor-ew-resize"
                        onPointerDown={(e) => { e.stopPropagation(); onRightEdgePointerDown(e) }}
                        onClick={(e) => e.stopPropagation()}
                    />
                </g>
            )}

            {/* Top-edge handle: drag up/down to change interval power. */}
            {onTopEdgePointerDown !== undefined && (
                <g
                    onPointerEnter={() => setHoverTop(true)}
                    onPointerLeave={() => setHoverTop(false)}
                >
                    {/* Visible indicator line along the top edge */}
                    <line
                        x1={x}
                        y1={y}
                        x2={x + w}
                        y2={y}
                        stroke={topLineColour}
                        strokeWidth={2}
                        vectorEffect="non-scaling-stroke"
                        pointerEvents="none"
                    />
                    {/* Transparent hit area centred on the top edge */}
                    <rect
                        x={x}
                        y={y - hitHTop / 2}
                        width={w}
                        height={hitHTop}
                        fill="transparent"
                        className="cursor-ns-resize"
                        onPointerDown={(e) => { e.stopPropagation(); onTopEdgePointerDown(e) }}
                        onClick={(e) => e.stopPropagation()}
                    />
                </g>
            )}
        </g>
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
            className="flex flex-col justify-between items-end text-tiny text-zinc-500 shrink-0"
            style={{ height: `${PLOT_HEIGHT + TOP_PADDING}px`, paddingTop: `${TOP_PADDING}px` }}
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
                label-tiny
                rounded
                hover:bg-zinc-600 transition-colors
                focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-zinc-700
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

// ---------------------------------------------------------------------------
// Helpers for inline bar overlay
// ---------------------------------------------------------------------------

/**
 * Looks up the {@link ParsedInterval} for the given section and index within
 * the workout. Returns null when the section block does not exist or the
 * index is out of range.
 */
function getIntervalFromWorkout(
    workout: WorkoutDetail,
    sectionType: SectionType,
    intervalIndex: number,
): ParsedInterval | null {
    let block: BlockDetail | null
    if (sectionType === 'WARMUP') block = workout.warmupBlock
    else if (sectionType === 'MAINSET') block = workout.mainsetBlock
    else block = workout.cooldownBlock
    return block?.intervals[intervalIndex] ?? null
}

/**
 * Computes the on-screen position bounds of a selected bar for the inline
 * overlay. Positions are expressed as percentages of the total SVG width
 * (x) and as CSS pixels (y), which map 1:1 to SVG units because the SVG
 * height is fixed.
 *
 * <p>Returns null when the interval cannot be resolved to a valid bar.</p>
 */
function computeSelectedBarBoundsCanvas(
    layouts: SectionLayout[],
    sectionType: SectionType,
    intervalIndex: number,
    yMax: number,
    totalWidth: number,
): { xLeftPct: number; xRightPct: number; yTopPx: number; heightPx: number; yRampStartCenterPx?: number; yRampEndCenterPx?: number } | null {
    const layout = layouts.find((l) => l.section.type === sectionType)
    if (layout === undefined) return null

    const starts = computeIntervalStartPositions(layout.section.bars, layout.xOffset)
    const ends = computeIntervalEndPositions(layout.section.bars, layout.xOffset)
    const xStart = starts[intervalIndex]
    const xEnd = ends[intervalIndex]
    if (xStart === undefined || xEnd === undefined) return null

    const intervalBars = layout.section.bars.filter(
        (b) => b.sourceIntervalIndex === intervalIndex,
    )
    if (intervalBars.length === 0) return null

    // Use the tallest bar in the interval so the duration input clears the
    // highest point (relevant for IntervalsT where on/off bars differ in height).
    const maxPower = intervalBars.reduce((max, b) => Math.max(max, b.powerPercent), 0)
    const heightPx = (maxPower / yMax) * PLOT_HEIGHT
    // Add TOP_PADDING because the SVG viewBox starts at -TOP_PADDING, so SVG y=0
    // maps to screen pixel TOP_PADDING inside the rendered container.
    const yTopPx = PLOT_HEIGHT - heightPx + TOP_PADDING

    // For ramp bars, compute the y centre of each edge column so the start and
    // end power inputs can be vertically centred at the correct edge height.
    const rampBar = intervalBars.find((b) => b.style === 'ramp')
    const yRampStartCenterPx = rampBar !== undefined && rampBar.startPowerPercent !== null
        ? PLOT_HEIGHT + TOP_PADDING - (rampBar.startPowerPercent / yMax) * PLOT_HEIGHT / 2
        : undefined
    const yRampEndCenterPx = rampBar !== undefined && rampBar.endPowerPercent !== null
        ? PLOT_HEIGHT + TOP_PADDING - (rampBar.endPowerPercent / yMax) * PLOT_HEIGHT / 2
        : undefined

    return {
        xLeftPct: (xStart / totalWidth) * 100,
        xRightPct: (xEnd / totalWidth) * 100,
        yTopPx,
        heightPx,
        yRampStartCenterPx,
        yRampEndCenterPx,
    }
}
