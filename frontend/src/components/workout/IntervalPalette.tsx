import { useRef, type JSX } from 'react'
import type { ParsedInterval } from '../../types/workout'
import type { ZonePresetView } from '../../api/zonePresets'
import { getColourForZone, getZoneForPower } from '../../utils/zoneColours'
import { buildPaletteItems } from '../../utils/paletteItems'

/** Y-axis maximum used to normalise palette item shapes, matching the chart default. */
export const PALETTE_Y_MAX = 140

/** ViewBox height for palette item shapes, in SVG units. */
const PALETTE_VB_HEIGHT = 60

/** ViewBox width for palette item shapes, in SVG units. */
const PALETTE_VB_WIDTH = 50

/**
 * How long (ms) a touch must be held before drag activates.
 * Gives the browser a window to commit to a scroll gesture instead.
 */
const TOUCH_DRAG_DELAY_MS = 200

/**
 * Maximum movement (px, squared) during the hold window before the pending
 * drag is cancelled and the gesture is treated as a scroll.
 */
const TOUCH_DRAG_CANCEL_SQ = 8 * 8

interface IntervalPaletteProps {
    zonePresets?: ZonePresetView[]
    onItemPointerDown: (interval: ParsedInterval, pointerId: number, clientX: number, clientY: number) => void
    isDragging: boolean
}

/**
 * Horizontal palette of draggable interval blocks. Users drag an item onto a
 * chart to add that interval type at the drop position.
 *
 * <p>Includes one block per Zwift zone (using effective zone presets when
 * available) and separate Ramp, Intervals, and Free Ride blocks.</p>
 *
 * <p>On touch devices, a 200ms hold is required before drag activates so that
 * a quick swipe is still handled as a page scroll. Pointer capture is set on
 * the palette item div immediately in pointerdown (required by iOS Safari),
 * then transferred to the chart SVG from within a pointermove handler once
 * the hold period has elapsed.</p>
 */
export function IntervalPalette({
    zonePresets,
    onItemPointerDown,
    isDragging,
}: IntervalPaletteProps): JSX.Element {
    const items = buildPaletteItems(zonePresets)

    const pendingRef = useRef<{
        timerId: ReturnType<typeof setTimeout>
        interval: ParsedInterval
        pointerId: number
        startX: number
        startY: number
        /** Set to true by the timer. The next pointermove will transfer capture to the SVG. */
        dragActivated: boolean
    } | null>(null)

    function cancelPending(): void {
        if (pendingRef.current !== null) {
            clearTimeout(pendingRef.current.timerId)
            pendingRef.current = null
        }
    }

    function handlePointerDown(interval: ParsedInterval, e: React.PointerEvent): void {
        if (e.pointerType !== 'touch') {
            // Mouse/pen: start drag immediately (existing behaviour)
            e.preventDefault()
            onItemPointerDown(interval, e.pointerId, e.clientX, e.clientY)
            return
        }

        cancelPending()

        // Capture to this element immediately — iOS Safari requires setPointerCapture
        // to be called from within a pointer event handler. Capturing here ensures
        // pointermove continues firing on this element even after the finger moves away,
        // which is needed both to detect scroll intent and to transfer capture to the SVG.
        ;(e.currentTarget as Element).setPointerCapture(e.pointerId)

        const { pointerId, clientX, clientY } = e
        pendingRef.current = {
            timerId: setTimeout(() => {
                if (pendingRef.current !== null) {
                    pendingRef.current.dragActivated = true
                }
            }, TOUCH_DRAG_DELAY_MS),
            interval,
            pointerId,
            startX: clientX,
            startY: clientY,
            dragActivated: false,
        }
    }

    function handlePointerMove(e: React.PointerEvent): void {
        if (pendingRef.current === null) return

        if (pendingRef.current.dragActivated) {
            // Hold period elapsed — suppress the browser's scroll gesture before
            // transferring capture to the SVG. Without this, the page scrolls
            // when the user drags upward from the palette onto the chart.
            e.preventDefault()
            const { interval, pointerId } = pendingRef.current
            pendingRef.current = null
            onItemPointerDown(interval, pointerId, e.clientX, e.clientY)
            return
        }

        // Cancel if the finger moved significantly before the hold completed.
        const dx = e.clientX - pendingRef.current.startX
        const dy = e.clientY - pendingRef.current.startY
        if (dx * dx + dy * dy > TOUCH_DRAG_CANCEL_SQ) {
            clearTimeout(pendingRef.current.timerId)
            // Release capture so the browser can resume its scroll handling.
            ;(e.currentTarget as Element).releasePointerCapture(pendingRef.current.pointerId)
            pendingRef.current = null
        }
    }

    return (
        <div className="flex flex-wrap justify-center gap-2 mt-2 pt-2 border-t border-zinc-700">
            <span className="w-full text-center label-tiny text-zinc-500 pb-1">
                Drag an interval onto the chart to add it
            </span>
            {items.map((item) => (
                <div
                    key={item.id}
                    onPointerDown={(e) => handlePointerDown(item.interval, e)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={cancelPending}
                    onPointerCancel={cancelPending}
                    style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                    title={`Drag to add a ${item.label} interval`}
                    className={`
                        flex flex-col items-center gap-1
                        px-2 py-1.5
                        bg-zinc-700/60 rounded
                        hover:bg-zinc-700 transition-colors
                        select-none touch-none
                    `}
                >
                    <PaletteItemShape interval={item.interval} />
                    <span className="label-tiny text-zinc-300">{item.label}</span>
                </div>
            ))}
        </div>
    )
}

interface PaletteItemShapeProps {
    interval: ParsedInterval
}

/**
 * Small SVG that represents the power profile of a palette item. All items
 * share the same viewBox so they appear uniform-sized in the palette, with
 * the bar shape reflecting the interval type and power level.
 */
export function PaletteItemShape({ interval }: PaletteItemShapeProps): JSX.Element {
    const vbW = PALETTE_VB_WIDTH
    const vbH = PALETTE_VB_HEIGHT
    const bottom = vbH

    const svgProps = {
        width: 44 as number,
        height: 48 as number,
        viewBox: `0 0 ${vbW} ${vbH}`,
        preserveAspectRatio: 'xMidYMax meet',
        style: { display: 'block' as const },
    }

    if (interval.type === 'Ramp' && interval.power !== null && interval.powerHigh !== null) {
        const startPct = Math.round(interval.power * 100)
        const endPct = Math.round(interval.powerHigh * 100)
        const startH = (startPct / PALETTE_Y_MAX) * vbH
        const endH = (endPct / PALETTE_Y_MAX) * vbH
        const startY = bottom - startH
        const endY = bottom - endH
        const startColour = getColourForZone(getZoneForPower(startPct))
        const endColour = getColourForZone(getZoneForPower(endPct))
        const gradId = 'palette-ramp'
        return (
            <svg {...svgProps}>
                <defs>
                    <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={startColour} />
                        <stop offset="100%" stopColor={endColour} />
                    </linearGradient>
                </defs>
                <polygon
                    points={`2,${startY} ${vbW - 2},${endY} ${vbW - 2},${bottom} 2,${bottom}`}
                    fill={`url(#${gradId})`}
                />
            </svg>
        )
    }

    if (interval.type === 'IntervalsT') {
        const onFtp = Math.round((interval.onPower ?? 1.1) * 100)
        const offFtp = Math.round((interval.offPower ?? 0.55) * 100)
        const onH = (onFtp / PALETTE_Y_MAX) * vbH
        const offH = (offFtp / PALETTE_Y_MAX) * vbH
        const onColour = getColourForZone(getZoneForPower(onFtp))
        const offColour = getColourForZone(getZoneForPower(offFtp))
        // Show 3 on + 3 off bars, fitting within the viewBox width.
        const barW = 7
        const gap = 1
        const bars: JSX.Element[] = []
        for (let i = 0; i < 3; i++) {
            const xOn = 2 + i * (barW * 2 + gap * 2)
            const xOff = xOn + barW + gap
            bars.push(
                <rect key={`on-${i}`} x={xOn} y={bottom - onH} width={barW} height={onH} fill={onColour} rx={1} />,
                <rect key={`off-${i}`} x={xOff} y={bottom - offH} width={barW} height={offH} fill={offColour} rx={1} />,
            )
        }
        return <svg {...svgProps}>{bars}</svg>
    }

    if (interval.type === 'FreeRide') {
        const h = (50 / PALETTE_Y_MAX) * vbH
        const topY = bottom - h
        const amplitude = h * 0.08
        const steps = 10
        const pts: string[] = []
        for (let i = 0; i <= steps; i++) {
            const t = i / steps
            const px = 2 + t * (vbW - 4)
            const py = topY - Math.sin(t * Math.PI * 4) * amplitude
            pts.push(`${i === 0 ? 'M' : 'L'} ${px} ${py}`)
        }
        pts.push(`L ${vbW - 2} ${bottom}`)
        pts.push(`L 2 ${bottom}`)
        pts.push('Z')
        return (
            <svg {...svgProps}>
                <path d={pts.join(' ')} fill="#6B7280" />
            </svg>
        )
    }

    // SteadyState (includes zone presets)
    const ftpPct = Math.round((interval.power ?? 0.5) * 100)
    const h = (ftpPct / PALETTE_Y_MAX) * vbH
    const topY = bottom - h
    const colour = getColourForZone(getZoneForPower(ftpPct))
    return (
        <svg {...svgProps}>
            <rect x={2} y={topY} width={vbW - 4} height={h} fill={colour} rx={2} />
        </svg>
    )
}
