import { useState, useRef, type JSX } from 'react'
import type { LibraryBlock } from '../../api/blocks'
import type { ParsedInterval } from '../../types/workout'
import { expandIntervalsToBars, type ChartBar } from '../../utils/intervalExpander'
import { getColourForZone, getZoneForPower } from '../../utils/zoneColours'

interface Props {
    block: LibraryBlock
    /**
     * When provided, bars become draggable and dropping fires this callback
     * with the from/to interval indices. The parent is responsible for
     * updating the interval list.
     */
    onReorder?: (fromIndex: number, toIndex: number) => void
}

/** Height of the preview plot area in SVG units (= px, since height is fixed). */
const PREVIEW_HEIGHT = 60

/** Default Y-axis upper bound. Expands if any bar exceeds it. */
const DEFAULT_Y_MAX = 140

/** Gap between bars in the same units as bar widths (seconds). */
const BAR_GAP = 4

/** Tighter gap between bars within an IntervalsT group. */
const GROUP_INNER_GAP = 1

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
}

/**
 * Renders a compact bar chart preview of a library block's intervals.
 * When {@code onReorder} is provided, bars become draggable for reordering.
 *
 * <p>Malformed block content is handled gracefully by showing a fallback
 * message rather than throwing.</p>
 */
export function BlockPreview({ block, onReorder }: Props): JSX.Element {
    const svgRef = useRef<SVGSVGElement | null>(null)
    const [barDragState, setBarDragState] = useState<BarDragState | null>(null)

    const intervals = parseContent(block.content)

    if (intervals === null) {
        return (
            <div className="px-3 py-2 bg-zinc-900/40 rounded text-center">
                <p className="text-xs text-zinc-500">Preview unavailable.</p>
            </div>
        )
    }

    if (intervals.length === 0) {
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
    const viewBoxWidth = Math.max(totalDuration + totalGap, 1)

    function handleBarPointerDown(
        intervalIndex: number,
        draggedBars: ChartBar[],
        e: React.PointerEvent,
    ): void {
        if (svgRef.current === null) return
        e.stopPropagation()
        svgRef.current.setPointerCapture(e.pointerId)

        const { x: pointerSvgX, y: pointerSvgY } = clientToSvgCoords(
            e.clientX,
            e.clientY,
            svgRef.current,
        )
        const starts = computeIntervalStartPositions(bars, 0)
        const barStartX = starts[intervalIndex] ?? pointerSvgX
        const grabOffsetX = pointerSvgX - barStartX
        const insertCount = countIntervals(bars)

        setBarDragState({
            sourceIntervalIndex: intervalIndex,
            draggedBars,
            ghostInsertIndex: insertCount,
            ghostX: viewBoxWidth,
            pointerSvgX,
            pointerSvgY,
            grabOffsetX,
            grabOffsetY: pointerSvgY,
        })
    }

    function handleSvgPointerMove(e: React.PointerEvent<SVGSVGElement>): void {
        if (barDragState === null || svgRef.current === null) return
        const { x: svgX, y: svgY } = clientToSvgCoords(e.clientX, e.clientY, svgRef.current)
        const insertIdx = insertIndexAtX(svgX, bars, 0)
        const starts = computeIntervalStartPositions(bars, 0)
        const ghostX = starts[insertIdx] ?? viewBoxWidth

        setBarDragState((prev) =>
            prev !== null
                ? { ...prev, ghostInsertIndex: insertIdx, ghostX, pointerSvgX: svgX, pointerSvgY: svgY }
                : null,
        )
    }

    function handleSvgPointerUp(e: React.PointerEvent<SVGSVGElement>): void {
        if (svgRef.current !== null) {
            svgRef.current.releasePointerCapture(e.pointerId)
        }
        if (barDragState === null) return

        const { sourceIntervalIndex, ghostInsertIndex } = barDragState
        setBarDragState(null)

        const adjusted =
            ghostInsertIndex > sourceIntervalIndex
                ? ghostInsertIndex - 1
                : ghostInsertIndex
        if (adjusted !== sourceIntervalIndex) {
            onReorder?.(sourceIntervalIndex, adjusted)
        }
    }

    return (
        <div className="bg-zinc-900/40 rounded overflow-hidden">
            <svg
                ref={svgRef}
                viewBox={`0 0 ${viewBoxWidth} ${PREVIEW_HEIGHT}`}
                preserveAspectRatio="none"
                className="block w-full"
                style={{ height: `${PREVIEW_HEIGHT}px` }}
                onPointerMove={onReorder !== undefined ? handleSvgPointerMove : undefined}
                onPointerUp={onReorder !== undefined ? handleSvgPointerUp : undefined}
            >
                {buildBars(
                    bars,
                    yMax,
                    viewBoxWidth,
                    onReorder !== undefined
                        ? (idx, dragBars, e) => handleBarPointerDown(idx, dragBars, e)
                        : undefined,
                    barDragState?.sourceIntervalIndex ?? null,
                )}

                {/* Ghost bar follows the cursor during drag */}
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

                {/* Drop indicator line */}
                {barDragState !== null && (
                    <line
                        x1={barDragState.ghostX}
                        y1={0}
                        x2={barDragState.ghostX}
                        y2={PREVIEW_HEIGHT}
                        stroke="rgba(255,255,255,0.9)"
                        strokeWidth={3}
                        vectorEffect="non-scaling-stroke"
                        pointerEvents="none"
                    />
                )}
            </svg>
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
): JSX.Element[] {
    const shapes: JSX.Element[] = []
    let cursor = 0

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

        shapes.push(buildBarShape(bar, cursor, yMax, svgTotalWidth, i, isDragging, handlePointerDown))
        cursor += bar.durationSeconds
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
 * scaling from preserveAspectRatio="none".
 */
function buildBarShape(
    bar: ChartBar,
    x: number,
    yMax: number,
    svgTotalWidth: number,
    key: number,
    isDragging: boolean,
    onPointerDown: ((e: React.PointerEvent) => void) | undefined,
): JSX.Element {
    const ry = RY_PX
    const opacity = isDragging ? 0.3 : 1
    const canDrag = onPointerDown !== undefined

    if (bar.style === 'ramp' && bar.startPowerPercent !== null && bar.endPowerPercent !== null) {
        const startH = (bar.startPowerPercent / yMax) * PREVIEW_HEIGHT
        const endH = (bar.endPowerPercent / yMax) * PREVIEW_HEIGHT
        const startY = PREVIEW_HEIGHT - startH
        const endY = PREVIEW_HEIGHT - endH
        const w = bar.durationSeconds
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
            `M ${x},${PREVIEW_HEIGHT}`,
            `L ${x},${startY + r}`,
            `Q ${x},${startY} ${x + ux * r},${startY + uy * r}`,
            `L ${x + w - ux * r},${endY - uy * r}`,
            `Q ${x + w},${endY} ${x + w},${endY + r}`,
            `L ${x + w},${PREVIEW_HEIGHT}`,
            'Z',
        ].join(' ')
        const startColour = getColourForZone(getZoneForPower(bar.startPowerPercent))
        const endColour = getColourForZone(getZoneForPower(bar.endPowerPercent))
        const gradientId = `prev-ramp-${key}`
        return (
            <g
                key={key}
                opacity={opacity}
                onPointerDown={onPointerDown}
                className={canDrag ? 'cursor-grab' : ''}
            >
                <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={startColour} />
                        <stop offset="100%" stopColor={endColour} />
                    </linearGradient>
                </defs>
                <path d={rampPath} fill={`url(#${gradientId})`} />
            </g>
        )
    }

    if (bar.style === 'freeride') {
        const baseH = (bar.powerPercent / yMax) * PREVIEW_HEIGHT
        const baseTopY = PREVIEW_HEIGHT - baseH
        const amplitude = Math.max(baseH * 0.06, 2)
        const segments = Math.max(6, Math.round(bar.durationSeconds / 30))
        const pts: string[] = []
        for (let i = 0; i <= segments; i++) {
            const t = i / segments
            const px = x + t * bar.durationSeconds
            const py = baseTopY - Math.sin(t * Math.PI * 2) * amplitude
            pts.push(`${i === 0 ? 'M' : 'L'} ${px} ${py}`)
        }
        pts.push(`L ${x + bar.durationSeconds} ${PREVIEW_HEIGHT}`)
        pts.push(`L ${x} ${PREVIEW_HEIGHT}`)
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
    const y = PREVIEW_HEIGHT - height
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
