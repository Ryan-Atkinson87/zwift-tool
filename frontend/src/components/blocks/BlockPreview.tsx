import { useState, useRef, type JSX } from 'react'
import type { LibraryBlock } from '../../api/blocks'
import type { ParsedInterval } from '../../types/workout'
import type { ZonePresetView } from '../../api/zonePresets'
import { expandIntervalsToBars, type ChartBar } from '../../utils/intervalExpander'
import { getColourForZone, getZoneForPower } from '../../utils/zoneColours'
import { IntervalPalette, PaletteItemShape } from '../workout/IntervalPalette'
import { BarInlineOverlay } from '../workout/BarInlineOverlay'

interface Props {
    block: LibraryBlock
    /**
     * When provided, bars become draggable and dropping fires this callback
     * with the from/to interval indices. The parent is responsible for
     * updating the interval list.
     */
    onReorder?: (fromIndex: number, toIndex: number) => void
    /**
     * When provided, an interval palette is rendered below the preview chart.
     * Dropping a palette item onto the chart fires this callback with the
     * interval and the 0-based insert index. The parent is responsible for
     * inserting the interval into the list.
     */
    onAddInterval?: (interval: ParsedInterval, insertIndex: number) => void
    /** Effective zone presets used to populate zone palette items. */
    zonePresets?: ZonePresetView[]
    /**
     * Index of the currently selected interval. When set, the inline bar
     * overlay is rendered over the matching bar. The parent should toggle
     * the same index to null to deselect.
     */
    selectedIntervalIndex?: number | null
    /**
     * Called when the user clicks a bar (without dragging). The parent uses
     * this to update {@code selectedIntervalIndex}. Pass null to deselect.
     */
    onSelectInterval?: (index: number | null) => void
    /** Called when the user edits duration or power via the inline overlay. */
    onUpdateInterval?: (index: number, next: ParsedInterval) => void
    /** Called when the user clicks the trash icon on the inline overlay. */
    onDeleteInterval?: (index: number) => void
}

/** Height of the bar plot area in SVG units. Bars scale within this region. */
const PREVIEW_HEIGHT = 60

/** Total SVG canvas height. The extra space above PREVIEW_HEIGHT is empty air. */
const CANVAS_HEIGHT = PREVIEW_HEIGHT * 2

/** Default Y-axis upper bound. Expands if any bar exceeds it. */
const DEFAULT_Y_MAX = 140

/** Gap between bars in the same units as bar widths (seconds). */
const BAR_GAP = 4

/** Tighter gap between bars within an IntervalsT group. */
const GROUP_INNER_GAP = 1

/**
 * Horizontal padding added to both sides of the viewBox, in SVG units (seconds).
 * Equal padding on both sides keeps the chart centred while ensuring there is
 * always blank drop-target space after the last bar.
 */
const CHART_PADDING = 200

/**
 * Assumed container width in screen pixels, used to compute a horizontal
 * corner radius that compensates for preserveAspectRatio="none" scaling.
 * The value is an estimate; it only affects how circular corners appear.
 */
const ASSUMED_CONTAINER_PX = 700

/** Vertical corner radius in SVG units (≈ px since height is fixed 1:1). */
const RY_PX = 3

/** State for a bar drag that is currently in progress (pointer held down). */
interface BarDragState {
    sourceIntervalIndex: number
    /** All bars belonging to the dragged interval (IntervalsT = many bars). */
    draggedBars: ChartBar[]
    /** Index before which the drop will be inserted. */
    ghostInsertIndex: number
    /** SVG x of the snapped drop indicator line. */
    ghostX: number
    /** Current pointer position in SVG coordinates. */
    pointerSvgX: number
    pointerSvgY: number
    /** Offset from pointer to left edge of the grabbed bar at pickup. */
    grabOffsetX: number
    grabOffsetY: number
    /**
     * True once the pointer has moved beyond the drag threshold. Used to
     * distinguish a click from a drag so a bare click never triggers a reorder.
     */
    hasMoved: boolean
}

/** State for a ramp duration resize drag that is currently in progress. */
interface RampResizeDragState {
    intervalIndex: number
    /** SVG x coordinate of the pointer at drag start. */
    startSvgX: number
    /** Duration of the ramp interval at drag start, in seconds. */
    originalDurationSeconds: number
    /** Current clamped duration in seconds, updated on every pointermove. */
    liveDurationSeconds: number
}

/**
 * Renders a compact bar chart preview of a library block's intervals.
 * When {@code onReorder} is provided, bars become draggable for reordering.
 *
 * <p>Malformed block content is handled gracefully by showing a fallback
 * message rather than throwing.</p>
 */
/**
 * Displays a compact bar chart preview of a library block's intervals.
 * Handles invalid or empty content gracefully with a fallback message.
 * When {@code onReorder} is provided, delegates to {@link BlockPreviewSvg}
 * which manages its own drag state and SVG ref internally.
 */
export function BlockPreview({
    block,
    onReorder,
    onAddInterval,
    zonePresets,
    selectedIntervalIndex,
    onSelectInterval,
    onUpdateInterval,
    onDeleteInterval,
}: Props): JSX.Element {
    const intervals = parseContent(block.content)

    if (intervals === null) {
        return (
            <div className="px-3 py-2 bg-zinc-900/40 rounded text-center">
                <p className="text-xs text-zinc-500">Preview unavailable.</p>
            </div>
        )
    }

    if (intervals.length === 0 && onAddInterval === undefined) {
        return (
            <div className="px-3 py-2 bg-zinc-900/40 rounded text-center">
                <p className="text-xs text-zinc-500">Empty section.</p>
            </div>
        )
    }

    const bars = expandIntervalsToBars(intervals, `preview-${block.id}`)
    const yMax = computeYMax(bars)
    const totalGap = computeTotalGap(bars)
    const totalDuration = bars.reduce((sum, bar) => sum + bar.durationSeconds, 0)
    // Reserve a minimum width so the chart is a usable drop target even when empty.
    // CHART_PADDING is added on both sides so there is blank drop space after the last
    // bar and the chart remains centred within the container.
    const viewBoxWidth = Math.max(totalDuration + totalGap + CHART_PADDING * 2, 120)

    return (
        <BlockPreviewSvg
            bars={bars}
            intervals={intervals}
            yMax={yMax}
            viewBoxWidth={viewBoxWidth}
            onReorder={onReorder}
            onAddInterval={onAddInterval}
            zonePresets={zonePresets}
            selectedIntervalIndex={selectedIntervalIndex}
            onSelectInterval={onSelectInterval}
            onUpdateInterval={onUpdateInterval}
            onDeleteInterval={onDeleteInterval}
        />
    )
}

/** State for a palette drag in the preview chart. */
interface PreviewPaletteDragState {
    interval: ParsedInterval
    /** Insert index within the bars list, or null if not yet computed. */
    dropInsertIndex: number | null
    /** SVG x position for the drop indicator line, or null when not over chart. */
    dropIndicatorX: number | null
    /** Current pointer position in client coordinates, used to position the ghost. */
    clientX: number
    clientY: number
}

interface BlockPreviewSvgProps {
    bars: ChartBar[]
    /** Original interval list, used to populate the inline editing overlay. */
    intervals?: ParsedInterval[]
    yMax: number
    viewBoxWidth: number
    onReorder?: (fromIndex: number, toIndex: number) => void
    onAddInterval?: (interval: ParsedInterval, insertIndex: number) => void
    zonePresets?: ZonePresetView[]
    selectedIntervalIndex?: number | null
    onSelectInterval?: (index: number | null) => void
    onUpdateInterval?: (index: number, next: ParsedInterval) => void
    onDeleteInterval?: (index: number) => void
}

/**
 * Renders the SVG bar chart for a single block preview. Extracted into its own
 * component so drag state is scoped here and not re-created on every parent render.
 *
 * <p>When {@code onReorder} is provided, bars become draggable for reordering.
 * When {@code onAddInterval} is provided, an interval palette is rendered below
 * the chart; dragging a palette item onto the chart fires the callback.</p>
 */
function BlockPreviewSvg({
    bars,
    intervals,
    yMax,
    viewBoxWidth,
    onReorder,
    onAddInterval,
    zonePresets,
    selectedIntervalIndex,
    onSelectInterval,
    onUpdateInterval,
    onDeleteInterval,
}: BlockPreviewSvgProps): JSX.Element {
    const [barDragState, setBarDragState] = useState<BarDragState | null>(null)
    const [paletteDragState, setPaletteDragState] = useState<PreviewPaletteDragState | null>(null)
    const [rampResizeDragState, setRampResizeDragState] = useState<RampResizeDragState | null>(null)
    // svgRef is used specifically for pointer capture when a palette drag starts
    // outside the SVG. Bar drag handlers use e.target.ownerSVGElement instead.
    const svgRef = useRef<SVGSVGElement | null>(null)

    /**
     * Starts a ramp right-edge resize drag. Captures the pointer on the SVG
     * so all subsequent pointermove/up events fire there.
     */
    function handleRampRightEdgePointerDown(
        intervalIndex: number,
        originalDurationSeconds: number,
        e: React.PointerEvent,
    ): void {
        const svgEl = (e.target as SVGElement).ownerSVGElement
        if (svgEl === null) return
        e.stopPropagation()
        svgEl.setPointerCapture(e.pointerId)
        const { x: startSvgX } = clientToSvgCoords(e.clientX, e.clientY, svgEl)
        setRampResizeDragState({ intervalIndex, startSvgX, originalDurationSeconds, liveDurationSeconds: originalDurationSeconds })
    }

    // Use e.target.ownerSVGElement instead of a React ref so bar-drag pointer
    // event handlers access the SVG at call time (during events, not during render).
    function handleBarPointerDown(
        intervalIndex: number,
        draggedBars: ChartBar[],
        e: React.PointerEvent,
    ): void {
        const svgEl = (e.target as SVGElement).ownerSVGElement
        if (svgEl === null) return
        e.stopPropagation()
        svgEl.setPointerCapture(e.pointerId)

        const { x: pointerSvgX, y: pointerSvgY } = clientToSvgCoords(e.clientX, e.clientY, svgEl)
        const starts = computeIntervalStartPositions(bars, CHART_PADDING)
        const barStartX = starts[intervalIndex] ?? pointerSvgX
        const grabOffsetX = pointerSvgX - barStartX
        const insertCount = countIntervals(bars)

        setBarDragState({
            sourceIntervalIndex: intervalIndex,
            draggedBars,
            ghostInsertIndex: insertCount,
            ghostX: viewBoxWidth - CHART_PADDING,
            pointerSvgX,
            pointerSvgY,
            grabOffsetX,
            grabOffsetY: pointerSvgY,
            hasMoved: false,
        })
    }

    /**
     * Starts a palette drag. Transfers pointer capture to the SVG so all
     * subsequent pointermove and pointerup events fire there, allowing the
     * drop target to be tracked while the pointer is outside the palette.
     */
    function handlePaletteItemPointerDown(interval: ParsedInterval, e: React.PointerEvent): void {
        if (svgRef.current === null) return
        e.preventDefault()
        svgRef.current.setPointerCapture(e.pointerId)
        setPaletteDragState({
            interval,
            dropInsertIndex: null,
            dropIndicatorX: null,
            clientX: e.clientX,
            clientY: e.clientY,
        })
    }

    // e.currentTarget is the <svg> element because these handlers are attached
    // directly to it, so no ref is needed for move/up.
    function handleSvgPointerMove(e: React.PointerEvent<SVGSVGElement>): void {
        if (barDragState === null && paletteDragState === null && rampResizeDragState === null) return
        const { x: svgX, y: svgY } = clientToSvgCoords(e.clientX, e.clientY, e.currentTarget)

        if (rampResizeDragState !== null) {
            const delta = svgX - rampResizeDragState.startSvgX
            const newDuration = Math.max(10, Math.round(rampResizeDragState.originalDurationSeconds + delta))
            setRampResizeDragState((prev) => prev !== null ? { ...prev, liveDurationSeconds: newDuration } : null)
            return
        }

        if (paletteDragState !== null) {
            const insertIdx = insertIndexAtX(svgX, bars, CHART_PADDING)
            const starts = computeIntervalStartPositions(bars, CHART_PADDING)
            const dropX = starts[insertIdx] ?? (viewBoxWidth - CHART_PADDING)
            setPaletteDragState((prev) =>
                prev !== null
                    ? { ...prev, dropInsertIndex: insertIdx, dropIndicatorX: dropX, clientX: e.clientX, clientY: e.clientY }
                    : null,
            )
            return
        }

        const insertIdx = insertIndexAtX(svgX, bars, CHART_PADDING)
        const starts = computeIntervalStartPositions(bars, CHART_PADDING)
        const ghostX = starts[insertIdx] ?? (viewBoxWidth - CHART_PADDING)

        setBarDragState((prev) =>
            prev !== null
                ? { ...prev, ghostInsertIndex: insertIdx, ghostX, pointerSvgX: svgX, pointerSvgY: svgY, hasMoved: true }
                : null,
        )
    }

    function handleSvgPointerUp(e: React.PointerEvent<SVGSVGElement>): void {
        e.currentTarget.releasePointerCapture(e.pointerId)

        if (rampResizeDragState !== null) {
            const { intervalIndex, liveDurationSeconds } = rampResizeDragState
            setRampResizeDragState(null)
            if (onUpdateInterval !== undefined && intervals !== undefined) {
                const original = intervals[intervalIndex]
                if (original !== undefined) {
                    onUpdateInterval(intervalIndex, { ...original, durationSeconds: liveDurationSeconds })
                }
            }
            return
        }

        if (paletteDragState !== null) {
            const { interval, dropInsertIndex } = paletteDragState
            setPaletteDragState(null)
            if (dropInsertIndex !== null) {
                onAddInterval?.(interval, dropInsertIndex)
            }
            return
        }

        if (barDragState === null) return

        const { sourceIntervalIndex, ghostInsertIndex, hasMoved } = barDragState
        setBarDragState(null)

        if (!hasMoved) {
            // Click without drag: toggle selection on the bar.
            if (onSelectInterval !== undefined) {
                onSelectInterval(selectedIntervalIndex === sourceIntervalIndex ? null : sourceIntervalIndex)
            }
            return
        }

        // Drag completed: reorder if callback is provided.
        if (onReorder !== undefined) {
            const adjusted =
                ghostInsertIndex > sourceIntervalIndex
                    ? ghostInsertIndex - 1
                    : ghostInsertIndex
            if (adjusted !== sourceIntervalIndex) {
                onReorder(sourceIntervalIndex, adjusted)
            }
        }
    }

    // Bars become interactive when any bar-level callback is provided.
    const hasBarInteraction = onReorder !== undefined || onSelectInterval !== undefined
    // Ramp resize is enabled when onUpdateInterval is provided.
    const hasRampResize = onUpdateInterval !== undefined
    const hasInteraction = hasBarInteraction || onAddInterval !== undefined || hasRampResize

    // Compute selected bar bounds for the inline overlay.
    const selectedBarBase = selectedIntervalIndex !== null && selectedIntervalIndex !== undefined
        ? computeSelectedBarBoundsPreview(bars, selectedIntervalIndex, yMax, viewBoxWidth)
        : null
    // During a ramp duration drag, update xRightPct live so the overlay
    // tracks the bar's moving right edge.
    const selectedBar = (() => {
        if (selectedBarBase === null) return null
        if (
            rampResizeDragState !== null
            && rampResizeDragState.intervalIndex === selectedIntervalIndex
        ) {
            return {
                ...selectedBarBase,
                xRightPct: selectedBarBase.xLeftPct + (rampResizeDragState.liveDurationSeconds / viewBoxWidth) * 100,
            }
        }
        return selectedBarBase
    })()
    const selectedBarInterval = selectedIntervalIndex !== null && selectedIntervalIndex !== undefined && intervals !== undefined
        ? (intervals[selectedIntervalIndex] ?? null)
        : null


    return (
        <div>
            <div className="bg-zinc-900/40 rounded relative">
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${viewBoxWidth} ${CANVAS_HEIGHT}`}
                    preserveAspectRatio="none"
                    className="block w-full"
                    style={{ height: `${CANVAS_HEIGHT}px` }}
                    onPointerMove={hasInteraction ? handleSvgPointerMove : undefined}
                    onPointerUp={hasInteraction ? handleSvgPointerUp : undefined}
                >
                    {bars.length === 0 && (
                        <text
                            x={viewBoxWidth / 2}
                            y={CANVAS_HEIGHT / 2}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={10}
                            fill="rgba(161,161,170,0.5)"
                        >
                            Drop an interval here
                        </text>
                    )}

                    {buildBars(
                        bars,
                        yMax,
                        viewBoxWidth,
                        hasBarInteraction
                            ? (idx, dragBars, e) => handleBarPointerDown(idx, dragBars, e)
                            : undefined,
                        barDragState?.sourceIntervalIndex ?? null,
                        hasRampResize
                            ? (idx, dur, e) => handleRampRightEdgePointerDown(idx, dur, e)
                            : undefined,
                        rampResizeDragState,
                        CHART_PADDING,
                    )}

                    {/* Ghost bar follows the cursor during bar drag */}
                    {barDragState !== null && (
                        <g
                            pointerEvents="none"
                            transform={`translate(0, ${barDragState.pointerSvgY - barDragState.grabOffsetY})`}
                        >
                            {buildGhostShapes(
                                barDragState.draggedBars,
                                yMax,
                                barDragState.pointerSvgX - barDragState.grabOffsetX,
                                viewBoxWidth,
                            )}
                        </g>
                    )}

                    {/* Bar reorder drop indicator */}
                    {barDragState !== null && (
                        <line
                            x1={barDragState.ghostX}
                            y1={0}
                            x2={barDragState.ghostX}
                            y2={CANVAS_HEIGHT}
                            stroke="rgba(34,197,94,0.9)"
                            strokeWidth={3}
                            vectorEffect="non-scaling-stroke"
                            pointerEvents="none"
                        />
                    )}

                    {/* Palette drop indicator */}
                    {paletteDragState?.dropIndicatorX !== null && paletteDragState?.dropIndicatorX !== undefined && (
                        <line
                            x1={paletteDragState.dropIndicatorX}
                            y1={0}
                            x2={paletteDragState.dropIndicatorX}
                            y2={CANVAS_HEIGHT}
                            stroke="rgba(34,197,94,0.9)"
                            strokeWidth={3}
                            vectorEffect="non-scaling-stroke"
                            pointerEvents="none"
                        />
                    )}
                </svg>

                {/* Inline bar overlay: duration above, power to the right, trash at bottom-left */}
                {selectedBar !== null && selectedBarInterval !== null
                    && selectedIntervalIndex !== null && selectedIntervalIndex !== undefined
                    && (onUpdateInterval !== undefined || onDeleteInterval !== undefined) && (
                    <BarInlineOverlay
                        key={selectedIntervalIndex}
                        interval={selectedBarInterval}
                        xLeftPct={selectedBar.xLeftPct}
                        xRightPct={selectedBar.xRightPct}
                        yTopPx={selectedBar.yTopPx}
                        heightPx={selectedBar.heightPx}
                        onChangeDuration={(seconds) => {
                            if (onUpdateInterval === undefined) return
                            onUpdateInterval(selectedIntervalIndex, { ...selectedBarInterval, durationSeconds: seconds })
                        }}
                        onChangePower={
                            selectedBarInterval.type !== 'FreeRide'
                            && selectedBarInterval.type !== 'IntervalsT'
                            && selectedBarInterval.type !== 'Warmup'
                            && selectedBarInterval.type !== 'Cooldown'
                            && selectedBarInterval.type !== 'Ramp'
                            ? (percent) => {
                                if (onUpdateInterval === undefined) return
                                onUpdateInterval(selectedIntervalIndex, { ...selectedBarInterval, power: percent / 100 })
                            } : undefined}
                        onChangeStartPower={
                            (selectedBarInterval.type === 'Warmup' || selectedBarInterval.type === 'Cooldown' || selectedBarInterval.type === 'Ramp')
                            && onUpdateInterval !== undefined
                            ? (percent) => {
                                if (onUpdateInterval === undefined) return
                                onUpdateInterval(selectedIntervalIndex, { ...selectedBarInterval, power: percent / 100 })
                            } : undefined}
                        onChangeEndPower={
                            (selectedBarInterval.type === 'Warmup' || selectedBarInterval.type === 'Cooldown' || selectedBarInterval.type === 'Ramp')
                            && onUpdateInterval !== undefined
                            ? (percent) => {
                                if (onUpdateInterval === undefined) return
                                onUpdateInterval(selectedIntervalIndex, { ...selectedBarInterval, powerHigh: percent / 100 })
                            } : undefined}
                        yRampStartCenterPx={selectedBar.yRampStartCenterPx}
                        yRampEndCenterPx={selectedBar.yRampEndCenterPx}
                        onDelete={() => {
                            if (onDeleteInterval === undefined) return
                            onDeleteInterval(selectedIntervalIndex)
                        }}
                        onAddRepeat={selectedBarInterval.type === 'IntervalsT' && onUpdateInterval !== undefined ? () => {
                            if (onUpdateInterval === undefined) return
                            const currentRepeat = selectedBarInterval.repeat ?? 1
                            const onDur = selectedBarInterval.onDuration ?? 0
                            const offDur = selectedBarInterval.offDuration ?? 0
                            const newRepeat = currentRepeat + 1
                            onUpdateInterval(selectedIntervalIndex, {
                                ...selectedBarInterval,
                                repeat: newRepeat,
                                durationSeconds: newRepeat * (onDur + offDur),
                            })
                        } : undefined}
                        onRemoveRepeat={selectedBarInterval.type === 'IntervalsT' && onUpdateInterval !== undefined ? () => {
                            if (onUpdateInterval === undefined) return
                            const currentRepeat = selectedBarInterval.repeat ?? 1
                            if (currentRepeat <= 1) return
                            const onDur = selectedBarInterval.onDuration ?? 0
                            const offDur = selectedBarInterval.offDuration ?? 0
                            const newRepeat = currentRepeat - 1
                            onUpdateInterval(selectedIntervalIndex, {
                                ...selectedBarInterval,
                                repeat: newRepeat,
                                durationSeconds: newRepeat * (onDur + offDur),
                            })
                        } : undefined}
                        onChangeOnDuration={selectedBarInterval.type === 'IntervalsT' && onUpdateInterval !== undefined ? (seconds) => {
                            if (onUpdateInterval === undefined) return
                            const offDur = selectedBarInterval.offDuration ?? 0
                            const repeat = selectedBarInterval.repeat ?? 1
                            onUpdateInterval(selectedIntervalIndex, {
                                ...selectedBarInterval,
                                onDuration: seconds,
                                durationSeconds: repeat * (seconds + offDur),
                            })
                        } : undefined}
                        onChangeOnPower={selectedBarInterval.type === 'IntervalsT' && onUpdateInterval !== undefined ? (percent) => {
                            if (onUpdateInterval === undefined) return
                            onUpdateInterval(selectedIntervalIndex, { ...selectedBarInterval, onPower: percent / 100 })
                        } : undefined}
                        onChangeOffDuration={selectedBarInterval.type === 'IntervalsT' && onUpdateInterval !== undefined ? (seconds) => {
                            if (onUpdateInterval === undefined) return
                            const onDur = selectedBarInterval.onDuration ?? 0
                            const repeat = selectedBarInterval.repeat ?? 1
                            onUpdateInterval(selectedIntervalIndex, {
                                ...selectedBarInterval,
                                offDuration: seconds,
                                durationSeconds: repeat * (onDur + seconds),
                            })
                        } : undefined}
                        onChangeOffPower={selectedBarInterval.type === 'IntervalsT' && onUpdateInterval !== undefined ? (percent) => {
                            if (onUpdateInterval === undefined) return
                            onUpdateInterval(selectedIntervalIndex, { ...selectedBarInterval, offPower: percent / 100 })
                        } : undefined}
                    />
                )}
            </div>

            {/* Interval palette rendered below the chart */}
            {onAddInterval !== undefined && (
                <IntervalPalette
                    zonePresets={zonePresets}
                    onItemPointerDown={handlePaletteItemPointerDown}
                    isDragging={paletteDragState !== null}
                />
            )}

            {/* Floating ghost follows the cursor while dragging from the palette */}
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

// ---------------------------------------------------------------------------
// Pure helpers (subset of WorkoutCanvas logic, single-section only)
// ---------------------------------------------------------------------------

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

function computeIntervalEndPositions(bars: ChartBar[], xOffset: number): number[] {
    const result: number[] = []
    let cursor = 0
    for (let i = 0; i < bars.length; i++) {
        const bar = bars[i]
        if (i > 0) {
            const prev = bars[i - 1]
            cursor += bar.groupId !== null && bar.groupId === prev.groupId
                ? GROUP_INNER_GAP
                : BAR_GAP
        }
        cursor += bar.durationSeconds
        const next = bars[i + 1]
        if (next === undefined || next.sourceIntervalIndex !== bar.sourceIntervalIndex) {
            result.push(xOffset + cursor)
        }
    }
    return result
}

function computeIntervalStartPositions(bars: ChartBar[], xOffset: number): number[] {
    const result: number[] = []
    let cursor = 0
    let lastIntervalIdx: number | null = null
    for (let i = 0; i < bars.length; i++) {
        const bar = bars[i]
        if (i > 0) {
            const prev = bars[i - 1]
            cursor += bar.groupId !== null && bar.groupId === prev.groupId
                ? GROUP_INNER_GAP
                : BAR_GAP
        }
        if (bar.sourceIntervalIndex !== lastIntervalIdx) {
            result.push(xOffset + cursor)
            lastIntervalIdx = bar.sourceIntervalIndex
        }
        cursor += bar.durationSeconds
    }
    return result
}

function countIntervals(bars: ChartBar[]): number {
    const seen = new Set<number>()
    for (const bar of bars) {
        if (bar.sourceIntervalIndex !== null) seen.add(bar.sourceIntervalIndex)
    }
    return seen.size
}

function insertIndexAtX(svgX: number, bars: ChartBar[], xOffset: number): number {
    const intervalCount = countIntervals(bars)
    if (intervalCount === 0) return 0
    const starts = computeIntervalStartPositions(bars, xOffset)
    const ends = computeIntervalEndPositions(bars, xOffset)
    if (svgX <= starts[0]) return 0
    for (let i = 0; i < intervalCount - 1; i++) {
        const midpoint = ((ends[i] ?? 0) + (starts[i + 1] ?? 0)) / 2
        if (svgX <= midpoint) return i + 1
    }
    return intervalCount
}

// ---------------------------------------------------------------------------
// Bar rendering
// ---------------------------------------------------------------------------

/** Computes the Y-axis upper bound, expanding beyond the default if needed. */
function computeYMax(bars: ChartBar[]): number {
    const peak = bars.reduce((max, bar) => Math.max(max, bar.powerPercent), 0)
    return peak <= DEFAULT_Y_MAX ? DEFAULT_Y_MAX : Math.ceil(peak / 10) * 10
}

/** Computes total gap space across all bars. */
function computeTotalGap(bars: ChartBar[]): number {
    return bars.reduce((sum, bar, i) => {
        if (i === 0) return sum
        const prev = bars[i - 1]
        const sameGroup = bar.groupId !== null && bar.groupId === prev.groupId
        return sum + (sameGroup ? GROUP_INNER_GAP : BAR_GAP)
    }, 0)
}

/** Lays out bars into SVG shapes, advancing a cursor for each bar. */
function buildBars(
    bars: ChartBar[],
    yMax: number,
    svgTotalWidth: number,
    onBarPointerDown:
        | ((intervalIndex: number, draggedBars: ChartBar[], e: React.PointerEvent) => void)
        | undefined,
    draggingIndex: number | null,
    onRampRightEdgePointerDown:
        | ((intervalIndex: number, durationSeconds: number, e: React.PointerEvent) => void)
        | undefined,
    rampResizeDragState: RampResizeDragState | null,
    xOffset: number = 0,
): JSX.Element[] {
    const shapes: JSX.Element[] = []
    let cursor = xOffset

    for (let i = 0; i < bars.length; i++) {
        const bar = bars[i]

        if (i > 0) {
            const prev = bars[i - 1]
            const sameGroup = bar.groupId !== null && bar.groupId === prev.groupId
            cursor += sameGroup ? GROUP_INNER_GAP : BAR_GAP
        }

        const isDragging =
            bar.sourceIntervalIndex !== null && bar.sourceIntervalIndex === draggingIndex

        const intervalBars =
            onBarPointerDown !== undefined && bar.sourceIntervalIndex !== null
                ? bars.filter((b) => b.sourceIntervalIndex === bar.sourceIntervalIndex)
                : []

        const handlePointerDown =
            onBarPointerDown !== undefined && bar.sourceIntervalIndex !== null
                ? (e: React.PointerEvent) =>
                    onBarPointerDown(bar.sourceIntervalIndex as number, intervalBars, e)
                : undefined

        const handleRampRightEdge =
            onRampRightEdgePointerDown !== undefined
            && bar.style === 'ramp'
            && bar.sourceIntervalIndex !== null
            ? (e: React.PointerEvent) =>
                onRampRightEdgePointerDown(bar.sourceIntervalIndex as number, bar.durationSeconds, e)
            : undefined

        const isBeingResized =
            rampResizeDragState !== null && bar.sourceIntervalIndex === rampResizeDragState.intervalIndex
        const liveDurationSeconds = isBeingResized ? rampResizeDragState!.liveDurationSeconds : undefined

        shapes.push(buildBarShape(bar, cursor, yMax, svgTotalWidth, i, isDragging, handlePointerDown, handleRampRightEdge, liveDurationSeconds))
        // Use live duration for cursor accumulation so subsequent bars shift during drag.
        cursor += liveDurationSeconds ?? bar.durationSeconds
    }

    return shapes
}

/** Builds ghost (floating drag preview) shapes for the dragged bars. */
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
                ? GROUP_INNER_GAP
                : BAR_GAP
        }
        shapes.push(buildBarShape(bar, cursor, yMax, svgTotalWidth, i, false, undefined))
        cursor += bar.durationSeconds
    }
    return shapes
}

/**
 * Renders a single bar as an SVG shape appropriate for its style, with
 * rounded top corners. Uses separate rx/ry to compensate for non-uniform
 * scaling from preserveAspectRatio="none". When {@code onRightEdgePointerDown}
 * is provided for a ramp bar, a right-edge resize handle is rendered.
 */
function buildBarShape(
    bar: ChartBar,
    x: number,
    yMax: number,
    svgTotalWidth: number,
    key: number,
    isDragging: boolean,
    onPointerDown: ((e: React.PointerEvent) => void) | undefined,
    onRightEdgePointerDown?: ((e: React.PointerEvent) => void) | undefined,
    liveDurationSeconds?: number,
): JSX.Element {
    const ry = RY_PX
    const opacity = isDragging ? 0.3 : 1
    const canDrag = onPointerDown !== undefined

    if (bar.style === 'ramp' && bar.startPowerPercent !== null && bar.endPowerPercent !== null) {
        const renderDuration = liveDurationSeconds ?? bar.durationSeconds
        const startH = (bar.startPowerPercent / yMax) * PREVIEW_HEIGHT
        const endH = (bar.endPowerPercent / yMax) * PREVIEW_HEIGHT
        const startY = CANVAS_HEIGHT - startH
        const endY = CANVAS_HEIGHT - endH
        const w = renderDuration
        const rx = Math.min(
            RY_PX * svgTotalWidth / ASSUMED_CONTAINER_PX,
            w * 0.25,
            startH * 0.15,
            endH * 0.15,
        )
        const r = Math.min(rx, ry)
        const dx = w
        const dy = endY - startY
        const len = Math.sqrt(dx * dx + dy * dy)
        const ux = dx / len
        const uy = dy / len
        const rampPath = [
            `M ${x},${CANVAS_HEIGHT}`,
            `L ${x},${startY + r}`,
            `Q ${x},${startY} ${x + ux * r},${startY + uy * r}`,
            `L ${x + w - ux * r},${endY - uy * r}`,
            `Q ${x + w},${endY} ${x + w},${endY + r}`,
            `L ${x + w},${CANVAS_HEIGHT}`,
            'Z',
        ].join(' ')
        const startColour = getColourForZone(getZoneForPower(bar.startPowerPercent))
        const endColour = getColourForZone(getZoneForPower(bar.endPowerPercent))
        const gradientId = `prev-ramp-${key}`

        const HANDLE_HIT_PX_RAMP = 8
        const hitWRamp = Math.min(HANDLE_HIT_PX_RAMP * svgTotalWidth / ASSUMED_CONTAINER_PX, w * 0.4)

        return (
            <g
                key={key}
                opacity={opacity}
            >
                <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={startColour} />
                        <stop offset="100%" stopColor={endColour} />
                    </linearGradient>
                </defs>
                <path
                    d={rampPath}
                    fill={`url(#${gradientId})`}
                    onPointerDown={onPointerDown}
                    className={canDrag ? 'cursor-grab' : ''}
                />
                {onRightEdgePointerDown !== undefined && (
                    <g>
                        {/* Visible indicator line at the right edge of the ramp */}
                        <line
                            x1={x + w}
                            y1={endY}
                            x2={x + w}
                            y2={CANVAS_HEIGHT}
                            stroke="rgba(255,255,255,0.18)"
                            strokeWidth={2}
                            vectorEffect="non-scaling-stroke"
                            pointerEvents="none"
                        />
                        {/* Transparent hit area along the ramp's right edge */}
                        <rect
                            x={x + w - hitWRamp}
                            y={endY}
                            width={hitWRamp}
                            height={CANVAS_HEIGHT - endY}
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
        const baseH = (bar.powerPercent / yMax) * PREVIEW_HEIGHT
        const baseTopY = CANVAS_HEIGHT - baseH
        const amplitude = Math.max(baseH * 0.06, 2)
        const segments = Math.max(6, Math.round(bar.durationSeconds / 30))
        const pts: string[] = []
        for (let i = 0; i <= segments; i++) {
            const t = i / segments
            const px = x + t * bar.durationSeconds
            const py = baseTopY - Math.sin(t * Math.PI * 2) * amplitude
            pts.push(`${i === 0 ? 'M' : 'L'} ${px} ${py}`)
        }
        pts.push(`L ${x + bar.durationSeconds} ${CANVAS_HEIGHT}`)
        pts.push(`L ${x} ${CANVAS_HEIGHT}`)
        pts.push('Z')
        return (
            <path
                key={key}
                d={pts.join(' ')}
                fill="#6B7280"
                opacity={opacity}
                onPointerDown={onPointerDown}
                className={canDrag ? 'cursor-grab' : ''}
            />
        )
    }

    const height = (bar.powerPercent / yMax) * PREVIEW_HEIGHT
    const y = CANVAS_HEIGHT - height
    const w = bar.durationSeconds
    const fill = getColourForZone(getZoneForPower(bar.powerPercent))
    const rxFlat = Math.min(RY_PX * svgTotalWidth / ASSUMED_CONTAINER_PX, w * 0.25)
    const ryFlat = Math.min(ry, height / 3)
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
    return (
        <path
            key={key}
            d={rectPath}
            fill={fill}
            opacity={opacity}
            onPointerDown={onPointerDown}
            className={canDrag ? 'cursor-grab' : ''}
        />
    )
}

/**
 * Safely parses the block's JSON content string into a typed interval list.
 * Returns null if the content is malformed or not an array.
 */
function parseContent(content: string): ParsedInterval[] | null {
    try {
        const parsed = JSON.parse(content) as unknown
        if (Array.isArray(parsed)) {
            return parsed as ParsedInterval[]
        }
        return null
    } catch {
        return null
    }
}

/**
 * Computes the on-screen position bounds of a selected bar for the inline
 * overlay in the block preview chart. Returns null when the interval cannot
 * be resolved to a valid bar.
 */
function computeSelectedBarBoundsPreview(
    bars: ChartBar[],
    intervalIndex: number,
    yMax: number,
    viewBoxWidth: number,
): { xLeftPct: number; xRightPct: number; yTopPx: number; heightPx: number; yRampStartCenterPx?: number; yRampEndCenterPx?: number } | null {
    const starts = computeIntervalStartPositions(bars, CHART_PADDING)
    const ends = computeIntervalEndPositions(bars, CHART_PADDING)
    const xStart = starts[intervalIndex]
    const xEnd = ends[intervalIndex]
    if (xStart === undefined || xEnd === undefined) return null

    const intervalBars = bars.filter((b) => b.sourceIntervalIndex === intervalIndex)
    if (intervalBars.length === 0) return null

    const maxPower = intervalBars.reduce((max, b) => Math.max(max, b.powerPercent), 0)
    const heightPx = (maxPower / yMax) * PREVIEW_HEIGHT
    const yTopPx = CANVAS_HEIGHT - heightPx

    // For ramp bars, compute the y centre of each edge column so the start and
    // end power inputs can be vertically centred at the correct edge height.
    const rampBar = intervalBars.find((b) => b.style === 'ramp')
    const yRampStartCenterPx = rampBar !== undefined && rampBar.startPowerPercent !== null
        ? CANVAS_HEIGHT - (rampBar.startPowerPercent / yMax) * PREVIEW_HEIGHT / 2
        : undefined
    const yRampEndCenterPx = rampBar !== undefined && rampBar.endPowerPercent !== null
        ? CANVAS_HEIGHT - (rampBar.endPowerPercent / yMax) * PREVIEW_HEIGHT / 2
        : undefined

    return {
        xLeftPct: (xStart / viewBoxWidth) * 100,
        xRightPct: (xEnd / viewBoxWidth) * 100,
        yTopPx,
        heightPx,
        yRampStartCenterPx,
        yRampEndCenterPx,
    }
}
