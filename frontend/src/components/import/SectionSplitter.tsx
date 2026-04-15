/**
 * Allows the user to define section boundaries on an imported workout
 * by dragging two vertical handles on a bar chart. The chart mirrors the
 * style of the main workout canvas: bars are proportional to duration and
 * coloured by Zwift training zone.
 *
 * A fixed empty zone at each side (each 20% of the total SVG width) always
 * represents the warm-up and cool-down sections. When no intervals are
 * assigned to a section the zone appears as an empty placeholder, matching
 * the WorkoutCanvas empty-section style. Dragging the handles into the bars
 * area assigns intervals to warm-up or cool-down.
 */

import { useState, useRef, useMemo, type JSX } from 'react'
import type { ParsedInterval, ParsedWorkout } from '../../types/workout'
import { expandIntervalsToBars, type ChartBar } from '../../utils/intervalExpander'
import { getColourForZone, getZoneForPower } from '../../utils/zoneColours'

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

/** Height of the plot area in SVG units. */
const PLOT_HEIGHT = 200

/** Blank space above the bars in SVG units (used for the section label layer). */
const TOP_PADDING = 20

/** Base gap between bars in seconds (SVG units). */
const BAR_GAP_SECONDS = 4

/** Tighter gap between bars within a single IntervalsT group. */
const GROUP_INNER_GAP_SECONDS = 1

/** Default Y-axis upper bound in percent FTP. Expands if any bar exceeds this. */
const DEFAULT_Y_MAX_PERCENT = 140

/** Assumed container width in screen pixels for aspect-ratio corner-radius compensation. */
const ASSUMED_CONTAINER_PX = 700

/** Corner radius in screen-pixel-equivalent SVG units. */
const RY_PX = 4

/**
 * Each empty-section zone is 20% of the total SVG width, so the bars occupy
 * 60%. If barsWidth = 60% of total, then emptyWidth = barsWidth / 3.
 * Total SVG width = emptyWidth + barsWidth + emptyWidth = barsWidth * 5/3.
 */
const EMPTY_ZONE_FRACTION = 1 / 3

/** State for a boundary drag in progress (pointer held down on a handle). */
interface BoundaryDrag {
    which: 'WU' | 'CD'
    /** Minimum allowed interval count on the left of this boundary. */
    minCount: number
    /** Maximum allowed interval count on the left of this boundary. */
    maxCount: number
    /** Currently snapped count, updated live on pointermove. */
    liveCount: number
}

/**
 * Renders all intervals as a bar chart with two draggable boundary handles.
 * Fixed empty zones at each side represent the warm-up and cool-down
 * placeholders. Dragging handles into the bars area assigns intervals to
 * those sections. Confirming saves the split.
 */
export function SectionSplitter({ workout, onConfirm, onCancel, isSaving }: Props): JSX.Element {
    const intervals = workout.intervals
    const intervalCount = intervals.length

    const [warmupEnd, setWarmupEnd] = useState(0)
    const [cooldownStart, setCooldownStart] = useState(intervalCount)
    const [boundaryDrag, setBoundaryDrag] = useState<BoundaryDrag | null>(null)
    const svgRef = useRef<SVGSVGElement | null>(null)

    const bars = useMemo(
        () => expandIntervalsToBars(intervals, 'split'),
        [intervals],
    )

    const yMax = useMemo(() => {
        const peak = bars.reduce((max, bar) => Math.max(max, bar.powerPercent), 0)
        return peak <= DEFAULT_Y_MAX_PERCENT ? DEFAULT_Y_MAX_PERCENT : Math.ceil(peak / 10) * 10
    }, [bars])

    // Compute bar x positions (section-local) and the end x of each interval.
    // These are relative to the start of the bars area; barsXOffset is added later.
    const { barsWidth, barLocalX, intervalEndX } = useMemo(() => {
        const barXArr: number[] = []
        const endX: number[] = new Array(intervalCount).fill(0)
        let cursor = 0

        for (let i = 0; i < bars.length; i++) {
            const bar = bars[i]
            if (i > 0) {
                const prev = bars[i - 1]
                const sameGroup = bar.groupId !== null && bar.groupId === prev.groupId
                cursor += sameGroup ? GROUP_INNER_GAP_SECONDS : BAR_GAP_SECONDS
            }
            barXArr.push(cursor)
            cursor += bar.durationSeconds

            // Record end x after the last sub-bar of each interval.
            const next = bars[i + 1]
            if (
                bar.sourceIntervalIndex !== null
                && (next === undefined || next.sourceIntervalIndex !== bar.sourceIntervalIndex)
            ) {
                endX[bar.sourceIntervalIndex] = cursor
            }
        }

        return { barsWidth: cursor, barLocalX: barXArr, intervalEndX: endX }
    }, [bars, intervalCount])

    // Derive the full SVG geometry. Empty zones are each EMPTY_ZONE_FRACTION of barsWidth.
    // Total SVG width = emptyZoneWidth + barsWidth + emptyZoneWidth = barsWidth * (1 + 2/3).
    const emptyZoneWidth = barsWidth * EMPTY_ZONE_FRACTION
    const barsXOffset = emptyZoneWidth
    const totalSvgWidth = emptyZoneWidth + barsWidth + emptyZoneWidth

    // allSnapPositions[k] is the SVG x when exactly k intervals are on the left of a boundary.
    // Index 0  = boundary at the LEFT edge of the bars (empty warm-up zone only, warmupEnd=0).
    // Index intervalCount = boundary at the RIGHT edge of the bars (empty cooldown zone only).
    const allSnapPositions = useMemo(() => {
        const positions = [barsXOffset]
        for (let k = 0; k < intervalCount; k++) {
            positions.push(barsXOffset + intervalEndX[k])
        }
        return positions
    }, [barsXOffset, intervalEndX, intervalCount])

    // Resolved display values: live during drag, committed otherwise.
    const displayWuEnd = boundaryDrag?.which === 'WU' ? boundaryDrag.liveCount : warmupEnd
    const displayCdStart = boundaryDrag?.which === 'CD' ? boundaryDrag.liveCount : cooldownStart
    const wuBoundaryX = allSnapPositions[displayWuEnd] ?? barsXOffset
    const cdBoundaryX = allSnapPositions[displayCdStart] ?? barsXOffset + barsWidth
    const mainsetIsEmpty = displayWuEnd >= displayCdStart

    // Label centre positions as a percentage of totalSvgWidth.
    const wuCentrePct = totalSvgWidth > 0 ? (wuBoundaryX / 2 / totalSvgWidth) * 100 : 10
    const msCentrePct = totalSvgWidth > 0 ? ((wuBoundaryX + cdBoundaryX) / 2 / totalSvgWidth) * 100 : 50
    const cdCentrePct = totalSvgWidth > 0 ? ((cdBoundaryX + totalSvgWidth) / 2 / totalSvgWidth) * 100 : 90

    function handleConfirm(): void {
        if (warmupEnd >= cooldownStart) return
        onConfirm({
            workout,
            warmupIntervals: intervals.slice(0, warmupEnd),
            mainsetIntervals: intervals.slice(warmupEnd, cooldownStart),
            cooldownIntervals: intervals.slice(cooldownStart),
        })
    }

    function clientToSvgX(clientX: number): number {
        if (svgRef.current === null) return 0
        const pt = svgRef.current.createSVGPoint()
        pt.x = clientX
        pt.y = 0
        return pt.matrixTransform(svgRef.current.getScreenCTM()!.inverse()).x
    }

    function handleBoundaryPointerDown(which: 'WU' | 'CD', e: React.PointerEvent): void {
        if (svgRef.current === null) return
        e.stopPropagation()
        e.preventDefault()
        svgRef.current.setPointerCapture(e.pointerId)

        // WU boundary ranges 0..cooldownStart-1; CD ranges warmupEnd+1..intervalCount.
        // This guarantees at least one interval always remains in the main set.
        const minCount = which === 'WU' ? 0 : warmupEnd + 1
        const maxCount = which === 'WU' ? cooldownStart - 1 : intervalCount
        const liveCount = which === 'WU' ? warmupEnd : cooldownStart

        setBoundaryDrag({ which, minCount, maxCount, liveCount })
    }

    function handleSvgPointerMove(e: React.PointerEvent<SVGSVGElement>): void {
        if (boundaryDrag === null) return
        const svgX = clientToSvgX(e.clientX)

        // Find the snap index whose x position is nearest to the pointer.
        let bestIdx = 0
        let bestDist = Math.abs(svgX - (allSnapPositions[0] ?? 0))
        for (let i = 1; i < allSnapPositions.length; i++) {
            const dist = Math.abs(svgX - (allSnapPositions[i] ?? 0))
            if (dist < bestDist) {
                bestDist = dist
                bestIdx = i
            }
        }

        const clamped = Math.max(boundaryDrag.minCount, Math.min(boundaryDrag.maxCount, bestIdx))
        setBoundaryDrag((prev) => prev !== null ? { ...prev, liveCount: clamped } : null)
    }

    function handleSvgPointerUp(e: React.PointerEvent<SVGSVGElement>): void {
        if (svgRef.current !== null) {
            svgRef.current.releasePointerCapture(e.pointerId)
        }
        if (boundaryDrag === null) return
        if (boundaryDrag.which === 'WU') {
            setWarmupEnd(boundaryDrag.liveCount)
        } else {
            setCooldownStart(boundaryDrag.liveCount)
        }
        setBoundaryDrag(null)
    }

    return (
        <div className="flex flex-col gap-4 w-full">
            <div className="flex items-center justify-between">
                <h3 className="text-white text-lg font-semibold">{workout.name}</h3>
                <p className="text-zinc-500 text-sm">{workout.fileName}</p>
            </div>

            <p className="text-zinc-400 text-sm">
                Drag the handles to define where the warm-up ends and cool-down begins.
            </p>

            <div className="flex flex-col w-full px-3 py-3 bg-zinc-800/40 border border-zinc-700 rounded-lg overflow-hidden">
                {/* Section label row: each label floats at the centre of its section. */}
                <div className="relative h-5 mb-1">
                    <span
                        className="absolute label-tiny text-blue-400 -translate-x-1/2 whitespace-nowrap"
                        style={{ left: `${wuCentrePct}%` }}
                    >
                        Warm-Up
                    </span>
                    <span
                        className="absolute label-tiny text-zinc-300 -translate-x-1/2 whitespace-nowrap"
                        style={{ left: `${msCentrePct}%` }}
                    >
                        Main Set
                    </span>
                    <span
                        className="absolute label-tiny text-purple-400 -translate-x-1/2 whitespace-nowrap"
                        style={{ left: `${cdCentrePct}%` }}
                    >
                        Cool-Down
                    </span>
                </div>

                {/* Unified bar chart */}
                <svg
                    ref={svgRef}
                    viewBox={`0 -${TOP_PADDING} ${totalSvgWidth} ${PLOT_HEIGHT + TOP_PADDING}`}
                    preserveAspectRatio="none"
                    className="block w-full"
                    style={{ height: `${PLOT_HEIGHT + TOP_PADDING}px`, userSelect: 'none' }}
                    onPointerMove={handleSvgPointerMove}
                    onPointerUp={handleSvgPointerUp}
                >
                    {/* Warm-up section background: x=0 to wuBoundaryX */}
                    <rect
                        x={0}
                        y={-TOP_PADDING}
                        width={wuBoundaryX}
                        height={PLOT_HEIGHT + TOP_PADDING}
                        fill="rgba(59, 130, 246, 0.10)"
                    />

                    {/* Main set section background: wuBoundaryX to cdBoundaryX */}
                    <rect
                        x={wuBoundaryX}
                        y={-TOP_PADDING}
                        width={Math.max(0, cdBoundaryX - wuBoundaryX)}
                        height={PLOT_HEIGHT + TOP_PADDING}
                        fill="rgba(24, 24, 27, 0.50)"
                    />

                    {/* Cool-down section background: cdBoundaryX to totalSvgWidth */}
                    <rect
                        x={cdBoundaryX}
                        y={-TOP_PADDING}
                        width={Math.max(0, totalSvgWidth - cdBoundaryX)}
                        height={PLOT_HEIGHT + TOP_PADDING}
                        fill="rgba(168, 85, 247, 0.10)"
                    />

                    {/* Empty section text for warm-up when no intervals assigned */}
                    {displayWuEnd === 0 && (
                        <text
                            x={barsXOffset / 2}
                            y={PLOT_HEIGHT / 2}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={10}
                            fill="rgba(161,161,170,0.45)"
                        >
                            Empty
                        </text>
                    )}

                    {/* Empty section text for cool-down when no intervals assigned */}
                    {displayCdStart === intervalCount && (
                        <text
                            x={barsXOffset + barsWidth + emptyZoneWidth / 2}
                            y={PLOT_HEIGHT / 2}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={10}
                            fill="rgba(161,161,170,0.45)"
                        >
                            Empty
                        </text>
                    )}

                    {/* Interval bars, offset into the centre zone */}
                    {bars.map((bar, i) => (
                        <SplitBarShape
                            key={i}
                            bar={bar}
                            x={barsXOffset + barLocalX[i]}
                            yMax={yMax}
                            svgTotalWidth={totalSvgWidth}
                        />
                    ))}

                    {/* Warm-Up / Main Set boundary handle */}
                    <BoundaryHandle
                        x={wuBoundaryX}
                        isActive={boundaryDrag !== null && boundaryDrag.which === 'WU'}
                        onPointerDown={(e) => handleBoundaryPointerDown('WU', e)}
                    />

                    {/* Main Set / Cool-Down boundary handle */}
                    <BoundaryHandle
                        x={cdBoundaryX}
                        isActive={boundaryDrag !== null && boundaryDrag.which === 'CD'}
                        onPointerDown={(e) => handleBoundaryPointerDown('CD', e)}
                    />
                </svg>
            </div>

            {/* Section summary */}
            <div className="flex gap-4 text-sm">
                <SectionSummary
                    label="Warm-Up"
                    intervals={intervals.slice(0, displayWuEnd)}
                    colour="text-blue-400"
                />
                <SectionSummary
                    label="Main Set"
                    intervals={intervals.slice(displayWuEnd, displayCdStart)}
                    colour="text-brand-400"
                />
                <SectionSummary
                    label="Cool-Down"
                    intervals={intervals.slice(displayCdStart)}
                    colour="text-purple-400"
                />
            </div>

            {mainsetIsEmpty && (
                <p className="text-red-400 text-sm">
                    Main set cannot be empty. Adjust the handles so at least one interval is in the main set.
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
                        focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900
                        disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                >
                    Cancel
                </button>
            </div>
        </div>
    )
}

// --- Sub-components ---

interface BoundaryHandleProps {
    x: number
    isActive: boolean
    onPointerDown: (e: React.PointerEvent) => void
}

/**
 * A draggable vertical boundary handle rendered as a bright green line with a
 * rounded capsule grip at the centre. The capsule uses vectorEffect so it
 * renders at a fixed screen-pixel size regardless of SVG aspect ratio.
 * A wider invisible rect provides a generous pointer target.
 */
function BoundaryHandle({ x, isActive, onPointerDown }: BoundaryHandleProps): JSX.Element {
    const idleColour = 'rgba(34, 197, 94, 0.75)'
    const activeColour = 'rgba(34, 197, 94, 1.0)'
    const colour = isActive ? activeColour : idleColour
    const lineWidth = isActive ? 2.5 : 2
    const capsuleWidth = isActive ? 12 : 10
    const hitAreaWidth = 20

    return (
        <g onPointerDown={onPointerDown} style={{ cursor: 'col-resize' }}>
            {/* Wide invisible hit area */}
            <rect
                x={x - hitAreaWidth / 2}
                y={-TOP_PADDING}
                width={hitAreaWidth}
                height={PLOT_HEIGHT + TOP_PADDING}
                fill="transparent"
            />

            {/* Full-height visible line */}
            <line
                x1={x}
                y1={-TOP_PADDING}
                x2={x}
                y2={PLOT_HEIGHT}
                stroke={colour}
                strokeWidth={lineWidth}
                vectorEffect="non-scaling-stroke"
            />

            {/* Central capsule grip: a short thick rounded line segment.
                vectorEffect keeps its width constant in screen pixels regardless
                of SVG x-axis scaling from preserveAspectRatio="none". */}
            <line
                x1={x}
                y1={PLOT_HEIGHT * 0.35}
                x2={x}
                y2={PLOT_HEIGHT * 0.65}
                stroke={colour}
                strokeWidth={capsuleWidth}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
            />

            {/* Three small grip ridges inside the capsule */}
            {[PLOT_HEIGHT * 0.44, PLOT_HEIGHT * 0.50, PLOT_HEIGHT * 0.56].map((tickY) => (
                <line
                    key={tickY}
                    x1={x}
                    y1={tickY}
                    x2={x}
                    y2={tickY}
                    stroke="rgba(0, 0, 0, 0.35)"
                    strokeWidth={4}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                />
            ))}
        </g>
    )
}

interface SplitBarShapeProps {
    bar: ChartBar
    x: number
    yMax: number
    svgTotalWidth: number
}

/**
 * Renders a single display-only bar in the section splitter chart.
 * Supports flat, ramp, and free-ride bar styles with zone colouring,
 * matching the appearance of the main workout canvas.
 */
function SplitBarShape({ bar, x, yMax, svgTotalWidth }: SplitBarShapeProps): JSX.Element {
    const ry = RY_PX

    if (bar.style === 'ramp' && bar.startPowerPercent !== null && bar.endPowerPercent !== null) {
        const startHeight = (bar.startPowerPercent / yMax) * PLOT_HEIGHT
        const endHeight = (bar.endPowerPercent / yMax) * PLOT_HEIGHT
        const startY = PLOT_HEIGHT - startHeight
        const endY = PLOT_HEIGHT - endHeight
        const w = bar.durationSeconds
        const rx = Math.min(
            RY_PX * svgTotalWidth / ASSUMED_CONTAINER_PX,
            w * 0.25,
            startHeight * 0.15,
            endHeight * 0.15,
        )
        const dx = w
        const dy = endY - startY
        const len = Math.sqrt(dx * dx + dy * dy)
        const ux = len > 0 ? dx / len : 1
        const uy = len > 0 ? dy / len : 0
        const r = Math.min(rx, ry)
        const rampPath = [
            `M ${x},${PLOT_HEIGHT}`,
            `L ${x},${startY + r}`,
            `Q ${x},${startY} ${x + ux * r},${startY + uy * r}`,
            `L ${x + w - ux * r},${endY - uy * r}`,
            `Q ${x + w},${endY} ${x + w},${endY + r}`,
            `L ${x + w},${PLOT_HEIGHT}`,
            'Z',
        ].join(' ')
        const startColour = getColourForZone(getZoneForPower(bar.startPowerPercent))
        const endColour = getColourForZone(getZoneForPower(bar.endPowerPercent))
        const gradientId = `split-ramp-${x}-${bar.durationSeconds}`
        return (
            <g>
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
        return <path d={points.join(' ')} fill="#6B7280" />
    }

    // Flat bar (SteadyState or IntervalsT sub-bar)
    const height = (bar.powerPercent / yMax) * PLOT_HEIGHT
    const y = PLOT_HEIGHT - height
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
    return <path d={rectPath} fill={fill} />
}

interface SectionSummaryProps {
    label: string
    intervals: ParsedInterval[]
    colour: string
}

/** Displays the interval count and total duration for one section. */
function SectionSummary({ label, intervals, colour }: SectionSummaryProps): JSX.Element {
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

/** Formats a total number of seconds into mm:ss or h:mm:ss. */
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
