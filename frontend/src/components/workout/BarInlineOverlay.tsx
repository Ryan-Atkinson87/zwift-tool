import { useState, type JSX } from 'react'
import type { ParsedInterval } from '../../types/workout'

interface Props {
    /** The interval to edit. Draft state re-initialises when the interval changes. */
    interval: ParsedInterval
    /** Left edge of the bar as a percentage of the SVG container's rendered width. */
    xLeftPct: number
    /** Right edge of the bar as a percentage of the SVG container's rendered width. */
    xRightPct: number
    /**
     * Top edge of the bar in screen pixels, measured from the SVG top edge.
     * Valid because the SVG uses a fixed pixel height so y scale = 1.
     */
    yTopPx: number
    /** Bar height in screen pixels. */
    heightPx: number
    /**
     * Called when the user commits a new duration value via blur or Enter.
     * Receives the new total duration in seconds.
     * Not used for IntervalsT; use onChangeOnDuration / onChangeOffDuration instead.
     */
    onChangeDuration: (seconds: number) => void
    /**
     * Called when the user commits a new power value via blur or Enter.
     * Receives the new power as an integer percent FTP.
     * Pass undefined for interval types that have no meaningful single power value (FreeRide).
     * Not used for IntervalsT; use onChangeOnPower / onChangeOffPower instead.
     */
    onChangePower?: (percent: number) => void
    /** Called when the user clicks the trash icon. */
    onDelete: () => void
    /**
     * Called when the user clicks the "+" button on an IntervalsT bar to add one repeat.
     * Only rendered when the interval type is IntervalsT.
     */
    onAddRepeat?: () => void
    /**
     * Called when the user clicks the "-" button on an IntervalsT bar to remove one repeat.
     * Only rendered when the interval type is IntervalsT. Disabled when repeat count is 1.
     */
    onRemoveRepeat?: () => void
    /**
     * IntervalsT only: called when the user commits a new on-interval duration.
     * Receives the new on-interval duration in seconds.
     */
    onChangeOnDuration?: (seconds: number) => void
    /**
     * IntervalsT only: called when the user commits a new on-interval power.
     * Receives the new on-interval power as an integer percent FTP.
     */
    onChangeOnPower?: (percent: number) => void
    /**
     * IntervalsT only: called when the user commits a new off-interval duration.
     * Receives the new off-interval duration in seconds.
     */
    onChangeOffDuration?: (seconds: number) => void
    /**
     * IntervalsT only: called when the user commits a new off-interval power.
     * Receives the new off-interval power as an integer percent FTP.
     */
    onChangeOffPower?: (percent: number) => void
    /**
     * Ramp only: called when the user commits a new start power value.
     * Receives the start power as an integer percent FTP.
     */
    onChangeStartPower?: (percent: number) => void
    /**
     * Ramp only: called when the user commits a new end power value.
     * Receives the end power as an integer percent FTP.
     */
    onChangeEndPower?: (percent: number) => void
    /**
     * Ramp only: the y coordinate in CSS pixels of the centre of the ramp's
     * left edge column, used to vertically centre the start power input.
     */
    yRampStartCenterPx?: number
    /**
     * Ramp only: the y coordinate in CSS pixels of the centre of the ramp's
     * right edge column, used to vertically centre the end power input.
     */
    yRampEndCenterPx?: number
}

/** Height of each inline input in pixels, used to position the duration input above the bar. */
const INPUT_HEIGHT = 26

/** Minimum gap in pixels between the duration input bottom and the bar top edge. */
const ABOVE_GAP = 4

/** Vertical gap between stacked inputs in the IntervalsT overlay groups. */
const STACK_GAP = 4

/** Total height of a stacked two-input group (duration + power). */
const STACK_HEIGHT = INPUT_HEIGHT * 2 + STACK_GAP

/**
 * Returns the primary power value (integer % FTP) to seed the draft state.
 * IntervalsT uses on-power; all ramp-type and steady-state intervals use the
 * start/main power field. FreeRide returns null.
 */
function getPrimaryPowerPercent(interval: ParsedInterval): number | null {
    if (interval.type === 'FreeRide') return null
    if (interval.type === 'IntervalsT') {
        return interval.onPower !== null ? Math.round(interval.onPower * 100) : null
    }
    return interval.power !== null ? Math.round(interval.power * 100) : null
}

/**
 * Absolutely-positioned overlay rendered over a selected chart bar. Provides
 * a duration input above the bar centre, an optional intensity input to the
 * right of the bar, and a trash icon at the bottom-left corner.
 *
 * <p>All elements use {@code position: absolute} and must be placed inside a
 * {@code position: relative} container matching the SVG element's width and
 * height. Percentage-based x values track the SVG's non-uniform horizontal
 * scaling from {@code preserveAspectRatio="none"}. Y values are in CSS pixels,
 * which map 1:1 to SVG units because the SVG height is fixed in pixels.</p>
 */
export function BarInlineOverlay({
    interval,
    xLeftPct,
    xRightPct,
    yTopPx,
    heightPx,
    onChangeDuration,
    onChangePower,
    onDelete,
    onAddRepeat,
    onRemoveRepeat,
    onChangeOnDuration,
    onChangeOnPower,
    onChangeOffDuration,
    onChangeOffPower,
    onChangeStartPower,
    onChangeEndPower,
    yRampStartCenterPx,
    yRampEndCenterPx,
}: Props): JSX.Element {
    const [draftDuration, setDraftDuration] = useState<string>(String(interval.durationSeconds))
    const [draftPower, setDraftPower] = useState<string>(
        String(getPrimaryPowerPercent(interval) ?? ''),
    )

    // IntervalsT-specific draft state for on/off sub-intervals.
    const [draftOnDuration, setDraftOnDuration] = useState<string>(
        String(interval.onDuration ?? 0),
    )
    const [draftOnPower, setDraftOnPower] = useState<string>(
        String(interval.onPower !== null ? Math.round(interval.onPower * 100) : ''),
    )
    const [draftOffDuration, setDraftOffDuration] = useState<string>(
        String(interval.offDuration ?? 0),
    )
    const [draftOffPower, setDraftOffPower] = useState<string>(
        String(interval.offPower !== null ? Math.round(interval.offPower * 100) : ''),
    )
    const [draftStartPower, setDraftStartPower] = useState<string>(
        String(interval.power !== null ? Math.round(interval.power * 100) : ''),
    )
    const [draftEndPower, setDraftEndPower] = useState<string>(
        String(interval.powerHigh !== null ? Math.round(interval.powerHigh * 100) : ''),
    )

    // Sync draft values when the interval is updated externally (e.g. a
    // concurrent drag-resize on the same bar). Uses the update-during-render
    // pattern to avoid calling setState inside an effect.
    const [prevInterval, setPrevInterval] = useState(interval)
    if (interval !== prevInterval) {
        setPrevInterval(interval)
        if (interval.durationSeconds !== prevInterval.durationSeconds) {
            setDraftDuration(String(interval.durationSeconds))
        }
        if (interval.power !== prevInterval.power || interval.onPower !== prevInterval.onPower) {
            const p = getPrimaryPowerPercent(interval)
            setDraftPower(String(p ?? ''))
        }
        if (interval.onDuration !== prevInterval.onDuration) {
            setDraftOnDuration(String(interval.onDuration ?? 0))
        }
        if (interval.onPower !== prevInterval.onPower) {
            setDraftOnPower(String(interval.onPower !== null ? Math.round(interval.onPower * 100) : ''))
        }
        if (interval.offDuration !== prevInterval.offDuration) {
            setDraftOffDuration(String(interval.offDuration ?? 0))
        }
        if (interval.offPower !== prevInterval.offPower) {
            setDraftOffPower(String(interval.offPower !== null ? Math.round(interval.offPower * 100) : ''))
        }
        if (interval.power !== prevInterval.power) {
            setDraftStartPower(String(interval.power !== null ? Math.round(interval.power * 100) : ''))
        }
        if (interval.powerHigh !== prevInterval.powerHigh) {
            setDraftEndPower(String(interval.powerHigh !== null ? Math.round(interval.powerHigh * 100) : ''))
        }
    }

    const midXPct = xLeftPct + (xRightPct - xLeftPct) / 2

    // Duration input: position its bottom edge just above the bar top.
    // Clamped to 2px minimum so it stays within the SVG area for very tall bars.
    const durationTopPx = Math.max(2, yTopPx - INPUT_HEIGHT - ABOVE_GAP)

    // Power input: vertically centred on the bar, left edge at the bar's right edge.
    const powerTopPx = yTopPx + heightPx / 2 - INPUT_HEIGHT / 2

    // IntervalsT stacked groups: bottom of the stack sits just above the bar top.
    const stackTopPx = Math.max(2, yTopPx - STACK_HEIGHT - ABOVE_GAP)

    // Trash icon: near the bottom-left corner of the bar, clamped so it stays
    // inside the bar even when the bar is very short.
    const trashIconSize = 20
    const trashTopPx = yTopPx + Math.max(2, heightPx - trashIconSize - 2)

    function commitDuration(): void {
        const v = Number(draftDuration)
        if (!Number.isNaN(v) && v >= 1) {
            onChangeDuration(Math.round(v))
        } else {
            setDraftDuration(String(interval.durationSeconds))
        }
    }

    function commitPower(): void {
        if (onChangePower === undefined) return
        const v = Number(draftPower)
        if (!Number.isNaN(v) && v >= 1 && v <= 200) {
            onChangePower(Math.round(v))
        } else {
            const p = getPrimaryPowerPercent(interval)
            setDraftPower(String(p ?? ''))
        }
    }

    function commitOnDuration(): void {
        if (onChangeOnDuration === undefined) return
        const v = Number(draftOnDuration)
        if (!Number.isNaN(v) && v >= 1) {
            onChangeOnDuration(Math.round(v))
        } else {
            setDraftOnDuration(String(interval.onDuration ?? 0))
        }
    }

    function commitOnPower(): void {
        if (onChangeOnPower === undefined) return
        const v = Number(draftOnPower)
        if (!Number.isNaN(v) && v >= 1 && v <= 200) {
            onChangeOnPower(Math.round(v))
        } else {
            setDraftOnPower(String(interval.onPower !== null ? Math.round(interval.onPower * 100) : ''))
        }
    }

    function commitOffDuration(): void {
        if (onChangeOffDuration === undefined) return
        const v = Number(draftOffDuration)
        if (!Number.isNaN(v) && v >= 1) {
            onChangeOffDuration(Math.round(v))
        } else {
            setDraftOffDuration(String(interval.offDuration ?? 0))
        }
    }

    function commitOffPower(): void {
        if (onChangeOffPower === undefined) return
        const v = Number(draftOffPower)
        if (!Number.isNaN(v) && v >= 1 && v <= 200) {
            onChangeOffPower(Math.round(v))
        } else {
            setDraftOffPower(String(interval.offPower !== null ? Math.round(interval.offPower * 100) : ''))
        }
    }

    function commitStartPower(): void {
        if (onChangeStartPower === undefined) return
        const v = Number(draftStartPower)
        if (!Number.isNaN(v) && v >= 1 && v <= 200) {
            onChangeStartPower(Math.round(v))
        } else {
            setDraftStartPower(String(interval.power !== null ? Math.round(interval.power * 100) : ''))
        }
    }

    function commitEndPower(): void {
        if (onChangeEndPower === undefined) return
        const v = Number(draftEndPower)
        if (!Number.isNaN(v) && v >= 1 && v <= 200) {
            onChangeEndPower(Math.round(v))
        } else {
            setDraftEndPower(String(interval.powerHigh !== null ? Math.round(interval.powerHigh * 100) : ''))
        }
    }

    const inputClass = `
        w-12 px-1 py-0.5
        bg-zinc-900 text-white text-xs
        border border-zinc-600 rounded
        focus:outline-none focus:border-brand-500
        text-center
    `

    // IntervalsT uses a different overlay layout: two stacked input groups above
    // the bar, one aligned to the left (on-interval) and one to the right (off-interval).
    if (interval.type === 'IntervalsT') {
        return (
            <>
                {/* On-interval: duration + power stacked above, right edge flush with
                    the left edge of the first on-bar so the group sits just to its left. */}
                <div
                    style={{
                        position: 'absolute',
                        top: `${stackTopPx}px`,
                        left: `${xLeftPct}%`,
                        transform: 'translateX(-100%)',
                        zIndex: 20,
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-0.5">
                            <input
                                type="number"
                                min={1}
                                value={draftOnDuration}
                                onChange={(e) => setDraftOnDuration(e.target.value)}
                                onBlur={commitOnDuration}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        commitOnDuration();
                                        (e.target as HTMLInputElement).blur()
                                    }
                                }}
                                className={inputClass}
                                title="On interval duration (seconds)"
                            />
                            <span className="text-zinc-400 text-tiny w-3 shrink-0 text-center">s</span>
                        </div>
                        <div className="flex items-center gap-0.5">
                            <input
                                type="number"
                                min={1}
                                max={200}
                                value={draftOnPower}
                                onChange={(e) => setDraftOnPower(e.target.value)}
                                onBlur={commitOnPower}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        commitOnPower();
                                        (e.target as HTMLInputElement).blur()
                                    }
                                }}
                                className={inputClass}
                                title="On interval intensity (% FTP)"
                            />
                            <span className="text-zinc-400 text-tiny w-3 shrink-0 text-center">%</span>
                        </div>
                    </div>
                </div>

                {/* Off-interval: duration + power stacked above, left edge flush with
                    the right edge of the last bar so the group sits just to its right. */}
                <div
                    style={{
                        position: 'absolute',
                        top: `${stackTopPx}px`,
                        left: `${xRightPct}%`,
                        zIndex: 20,
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <div className="flex flex-col gap-1 items-end">
                        <div className="flex items-center gap-0.5">
                            <input
                                type="number"
                                min={1}
                                value={draftOffDuration}
                                onChange={(e) => setDraftOffDuration(e.target.value)}
                                onBlur={commitOffDuration}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        commitOffDuration();
                                        (e.target as HTMLInputElement).blur()
                                    }
                                }}
                                className={inputClass}
                                title="Off interval duration (seconds)"
                            />
                            <span className="text-zinc-400 text-tiny w-3 shrink-0 text-center">s</span>
                        </div>
                        <div className="flex items-center gap-0.5">
                            <input
                                type="number"
                                min={1}
                                max={200}
                                value={draftOffPower}
                                onChange={(e) => setDraftOffPower(e.target.value)}
                                onBlur={commitOffPower}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        commitOffPower();
                                        (e.target as HTMLInputElement).blur()
                                    }
                                }}
                                className={inputClass}
                                title="Off interval intensity (% FTP)"
                            />
                            <span className="text-zinc-400 text-tiny w-3 shrink-0 text-center">%</span>
                        </div>
                    </div>
                </div>

                {/* Repeat controls: "-" at top-left, "+" at top-right, inside the bars */}
                {onRemoveRepeat !== undefined && (
                    <button
                        type="button"
                        aria-label="Remove one repeat"
                        onClick={(e) => { e.stopPropagation(); onRemoveRepeat() }}
                        onPointerDown={(e) => e.stopPropagation()}
                        disabled={(interval.repeat ?? 1) <= 1}
                        style={{ position: 'absolute', top: `${yTopPx + 2}px`, left: `${xLeftPct}%`, marginLeft: '3px', zIndex: 20 }}
                        className="w-5 h-5 flex items-center justify-center text-xs font-bold bg-zinc-700 text-zinc-200 rounded hover:bg-zinc-600 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        −
                    </button>
                )}
                {onAddRepeat !== undefined && (
                    <button
                        type="button"
                        aria-label="Add one repeat"
                        onClick={(e) => { e.stopPropagation(); onAddRepeat() }}
                        onPointerDown={(e) => e.stopPropagation()}
                        style={{ position: 'absolute', top: `${yTopPx + 2}px`, left: `${xRightPct}%`, transform: 'translateX(-100%)', marginLeft: '-3px', zIndex: 20 }}
                        className="w-5 h-5 flex items-center justify-center text-xs font-bold bg-zinc-700 text-zinc-200 rounded hover:bg-zinc-600 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900"
                    >
                        +
                    </button>
                )}

                {/* Trash icon: bottom-left corner of the bar */}
                <button
                    type="button"
                    aria-label="Delete interval"
                    onClick={(e) => { e.stopPropagation(); onDelete() }}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{ position: 'absolute', top: `${trashTopPx}px`, left: `${xLeftPct}%`, marginLeft: '3px', zIndex: 20 }}
                    className="p-0.5 text-zinc-400 hover:text-red-400 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 focus:ring-offset-zinc-900 rounded"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                    </svg>
                </button>
            </>
        )
    }

    // Ramp intervals show two power inputs: start (right-aligned to the bar's left edge,
    // centred at the left edge column height) and end (left-aligned from the bar's right
    // edge, centred at the right edge column height).
    if (onChangeStartPower !== undefined || onChangeEndPower !== undefined) {
        const startInputTopPx = yRampStartCenterPx !== undefined
            ? yRampStartCenterPx - INPUT_HEIGHT / 2
            : powerTopPx
        const endInputTopPx = yRampEndCenterPx !== undefined
            ? yRampEndCenterPx - INPUT_HEIGHT / 2
            : powerTopPx
        return (
            <>
                {/* Duration input: above the centre of the bar */}
                <div
                    style={{ position: 'absolute', top: `${durationTopPx}px`, left: `${midXPct}%`, transform: 'translateX(-50%)', zIndex: 20 }}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center gap-0.5">
                        <input
                            type="number"
                            min={1}
                            value={draftDuration}
                            onChange={(e) => setDraftDuration(e.target.value)}
                            onBlur={commitDuration}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    commitDuration();
                                    (e.target as HTMLInputElement).blur()
                                }
                            }}
                            className={inputClass}
                            title="Duration (seconds)"
                        />
                        <span className="text-zinc-400 text-tiny">s</span>
                    </div>
                </div>

                {/* Start intensity: right edge aligned to the ramp's left edge */}
                {onChangeStartPower !== undefined && (
                    <div
                        style={{ position: 'absolute', top: `${startInputTopPx}px`, left: `${xLeftPct}%`, transform: 'translateX(-100%)', zIndex: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-0.5">
                            <input
                                type="number"
                                min={1}
                                max={200}
                                value={draftStartPower}
                                onChange={(e) => setDraftStartPower(e.target.value)}
                                onBlur={commitStartPower}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        commitStartPower();
                                        (e.target as HTMLInputElement).blur()
                                    }
                                }}
                                className={inputClass}
                                title="Start intensity (% FTP)"
                            />
                            <span className="text-zinc-400 text-tiny">%</span>
                        </div>
                    </div>
                )}

                {/* End intensity: left edge aligned to the bar's right edge */}
                {onChangeEndPower !== undefined && (
                    <div
                        className="ml-1"
                        style={{ position: 'absolute', top: `${endInputTopPx}px`, left: `${xRightPct}%`, zIndex: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-0.5">
                            <input
                                type="number"
                                min={1}
                                max={200}
                                value={draftEndPower}
                                onChange={(e) => setDraftEndPower(e.target.value)}
                                onBlur={commitEndPower}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        commitEndPower();
                                        (e.target as HTMLInputElement).blur()
                                    }
                                }}
                                className={inputClass}
                                title="End intensity (% FTP)"
                            />
                            <span className="text-zinc-400 text-tiny">%</span>
                        </div>
                    </div>
                )}

                {/* Trash icon: bottom-left corner of the bar */}
                <button
                    type="button"
                    aria-label="Delete interval"
                    onClick={(e) => { e.stopPropagation(); onDelete() }}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{ position: 'absolute', top: `${trashTopPx}px`, left: `${xLeftPct}%`, marginLeft: '3px', zIndex: 20 }}
                    className="p-0.5 text-zinc-400 hover:text-red-400 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 focus:ring-offset-zinc-900 rounded"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                    </svg>
                </button>
            </>
        )
    }

    return (
        <>
            {/* Duration input: above the centre of the bar */}
            <div
                style={{ position: 'absolute', top: `${durationTopPx}px`, left: `${midXPct}%`, transform: 'translateX(-50%)', zIndex: 20 }}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-0.5">
                    <input
                        type="number"
                        min={1}
                        value={draftDuration}
                        onChange={(e) => setDraftDuration(e.target.value)}
                        onBlur={commitDuration}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                commitDuration();
                                (e.target as HTMLInputElement).blur()
                            }
                        }}
                        className={inputClass}
                        title="Duration (seconds)"
                    />
                    <span className="text-zinc-400 text-tiny">s</span>
                </div>
            </div>

            {/* Intensity input: to the right of the bar */}
            {onChangePower !== undefined && (
                <div
                    style={{ position: 'absolute', top: `${powerTopPx}px`, left: `${xRightPct}%`, marginLeft: '4px', zIndex: 20 }}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center gap-0.5">
                        <input
                            type="number"
                            min={1}
                            max={200}
                            value={draftPower}
                            onChange={(e) => setDraftPower(e.target.value)}
                            onBlur={commitPower}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    commitPower();
                                    (e.target as HTMLInputElement).blur()
                                }
                            }}
                            className={inputClass}
                            title="Intensity (% FTP)"
                        />
                        <span className="text-zinc-400 text-tiny">%</span>
                    </div>
                </div>
            )}

            {/* Trash icon: bottom-left corner of the bar */}
            <button
                type="button"
                aria-label="Delete interval"
                onClick={(e) => { e.stopPropagation(); onDelete() }}
                onPointerDown={(e) => e.stopPropagation()}
                style={{ position: 'absolute', top: `${trashTopPx}px`, left: `${xLeftPct}%`, marginLeft: '3px', zIndex: 20 }}
                className="p-0.5 text-zinc-400 hover:text-red-400 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 focus:ring-offset-zinc-900 rounded"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                </svg>
            </button>
        </>
    )
}
