import type { JSX } from 'react'
import type { LibraryBlock } from '../../api/blocks'
import type { ParsedInterval } from '../../types/workout'
import { expandIntervalsToBars, type ChartBar } from '../../utils/intervalExpander'
import { getColourForZone, getZoneForPower } from '../../utils/zoneColours'

interface Props {
    block: LibraryBlock
}

/** Height of the preview plot area in SVG units. */
const PREVIEW_HEIGHT = 60

/** Default Y-axis upper bound. Expands if any bar exceeds it. */
const DEFAULT_Y_MAX = 140

/** Gap between bars in the same units as bar widths (seconds). */
const BAR_GAP = 4

/** Tighter gap between bars within an IntervalsT group. */
const GROUP_INNER_GAP = 1

/**
 * Renders a compact read-only bar chart preview of a library block's
 * intervals. Uses the same bar expansion and zone colouring as the
 * main workout canvas, scaled to a smaller fixed height.
 *
 * <p>Malformed block content is handled gracefully by showing a fallback
 * message rather than throwing.</p>
 */
export function BlockPreview({ block }: Props): JSX.Element {
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

    return (
        <div className="bg-zinc-900/40 rounded overflow-hidden">
            <svg
                viewBox={`0 0 ${viewBoxWidth} ${PREVIEW_HEIGHT}`}
                preserveAspectRatio="none"
                className="block w-full"
                style={{ height: `${PREVIEW_HEIGHT}px` }}
            >
                {buildBars(bars, yMax)}
            </svg>
        </div>
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
function buildBars(bars: ChartBar[], yMax: number): JSX.Element[] {
    const shapes: JSX.Element[] = []
    let cursor = 0

    for (let i = 0; i < bars.length; i++) {
        const bar = bars[i]

        if (i > 0) {
            const prev = bars[i - 1]
            const sameGroup = bar.groupId !== null && bar.groupId === prev.groupId
            cursor += sameGroup ? GROUP_INNER_GAP : BAR_GAP
        }

        shapes.push(buildBarShape(bar, cursor, yMax, i))
        cursor += bar.durationSeconds
    }

    return shapes
}

/** Renders a single bar as an SVG shape appropriate for its style. */
function buildBarShape(bar: ChartBar, x: number, yMax: number, key: number): JSX.Element {
    if (bar.style === 'ramp' && bar.startPowerPercent !== null && bar.endPowerPercent !== null) {
        const startH = (bar.startPowerPercent / yMax) * PREVIEW_HEIGHT
        const endH = (bar.endPowerPercent / yMax) * PREVIEW_HEIGHT
        const points = [
            `${x},${PREVIEW_HEIGHT}`,
            `${x},${PREVIEW_HEIGHT - startH}`,
            `${x + bar.durationSeconds},${PREVIEW_HEIGHT - endH}`,
            `${x + bar.durationSeconds},${PREVIEW_HEIGHT}`,
        ].join(' ')
        const startColour = getColourForZone(getZoneForPower(bar.startPowerPercent))
        const endColour = getColourForZone(getZoneForPower(bar.endPowerPercent))
        const gradientId = `prev-ramp-${key}`
        return (
            <g key={key}>
                <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={startColour} />
                        <stop offset="100%" stopColor={endColour} />
                    </linearGradient>
                </defs>
                <polygon points={points} fill={`url(#${gradientId})`} />
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
        return <path key={key} d={pts.join(' ')} fill="#6B7280" />
    }

    const height = (bar.powerPercent / yMax) * PREVIEW_HEIGHT
    const y = PREVIEW_HEIGHT - height
    const fill = getColourForZone(getZoneForPower(bar.powerPercent))
    return (
        <rect
            key={key}
            x={x}
            y={y}
            width={bar.durationSeconds}
            height={height}
            fill={fill}
        />
    )
}
