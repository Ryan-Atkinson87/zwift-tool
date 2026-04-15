import { useState, type JSX } from 'react'
import type { TextEvent } from '../../types/workout'

interface Props {
    events: TextEvent[]
    /**
     * Called when the user commits a change (add, delete, or blur on any input
     * field). The parent is responsible for serialising the list to JSON and
     * persisting it via the metadata update endpoint.
     */
    onChange: (next: TextEvent[]) => void
    /** Disables structural controls (add, delete) while a save is in flight. */
    isSaving?: boolean
}

/**
 * Lets the user add, edit, and remove text events shown over the workout
 * timeline. Events are rendered as a vertical list of rows; each row has
 * inputs for the time offset (mm:ss), duration, and the message body.
 *
 * <p>Keystrokes are buffered in local state and committed to the parent only
 * on blur, so that mid-word edits do not trigger API saves that would disable
 * the inputs and break typing.</p>
 */
export function TextEventEditor({
    events,
    onChange,
    isSaving = false,
}: Props): JSX.Element {
    const [localEvents, setLocalEvents] = useState<TextEvent[]>(events)

    // Sync local state when the events prop changes from outside, for example
    // after a save round-trip returns updated data or the user switches workouts.
    // Uses the update-during-render pattern to avoid calling setState inside an effect.
    const [prevEvents, setPrevEvents] = useState(events)
    if (events !== prevEvents) {
        setPrevEvents(events)
        setLocalEvents(events)
    }

    function handleAdd(): void {
        const next = [...localEvents, { timeOffsetSeconds: 0, durationSeconds: 10, message: '' }]
        setLocalEvents(next)
        onChange(next)
    }

    function handleRemove(index: number): void {
        const next = localEvents.filter((_, i) => i !== index)
        setLocalEvents(next)
        onChange(next)
    }

    function handleCommit(index: number, next: TextEvent): void {
        const nextEvents = localEvents.map((event, i) => (i === index ? next : event))
        setLocalEvents(nextEvents)
        onChange(nextEvents)
    }

    return (
        <div className="flex flex-col w-full gap-2">
            <div className="flex items-center justify-between">
                <p className="text-xs font-semibold tracking-wide uppercase text-zinc-300">
                    Text events
                </p>
                <button
                    type="button"
                    onClick={handleAdd}
                    disabled={isSaving}
                    className={`
                        px-2 py-0.5
                        bg-zinc-700 text-zinc-200
                        label-tiny
                        rounded
                        hover:bg-zinc-600 transition-colors
                        focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900
                        disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                >
                    + Event
                </button>
            </div>

            {localEvents.length === 0 ? (
                <p className="text-xs italic text-zinc-500">
                    No text events. Add one to display a message over the timeline.
                </p>
            ) : (
                <ul className="flex flex-col gap-1">
                    {localEvents.map((event, index) => (
                        <TextEventRow
                            key={index}
                            event={event}
                            disabled={isSaving}
                            onCommit={(next) => handleCommit(index, next)}
                            onDelete={() => handleRemove(index)}
                        />
                    ))}
                </ul>
            )}
        </div>
    )
}

interface RowProps {
    event: TextEvent
    disabled: boolean
    /** Called on blur of any input field with the fully validated event value. */
    onCommit: (next: TextEvent) => void
    onDelete: () => void
}

/**
 * Single editable row in the text event list. Maintains its own local string
 * state for every field so that intermediate values (empty fields, partial
 * numbers) are allowed while typing. Changes are validated and committed to
 * the parent only on blur.
 */
function TextEventRow({ event, disabled, onCommit, onDelete }: RowProps): JSX.Element {
    const [minutes, setMinutes] = useState(String(Math.floor(event.timeOffsetSeconds / 60)))
    const [seconds, setSeconds] = useState(String(event.timeOffsetSeconds % 60))
    const [duration, setDuration] = useState(String(event.durationSeconds ?? 10))
    const [message, setMessage] = useState(event.message)

    // Sync local fields when the committed event value changes from outside
    // (e.g. a save round-trip or workout switch). Uses the update-during-render
    // pattern to avoid calling setState inside an effect.
    const [prevEvent, setPrevEvent] = useState(event)
    if (event !== prevEvent) {
        setPrevEvent(event)
        setMinutes(String(Math.floor(event.timeOffsetSeconds / 60)))
        setSeconds(String(event.timeOffsetSeconds % 60))
        setDuration(String(event.durationSeconds ?? 10))
        setMessage(event.message)
    }

    function handleBlur(): void {
        const parsedMinutes = Math.max(0, parseInt(minutes, 10) || 0)
        const parsedSeconds = Math.max(0, Math.min(59, parseInt(seconds, 10) || 0))
        const parsedDuration = Math.max(1, parseInt(duration, 10) || 1)

        // Normalise displayed values to the clamped parsed result.
        setMinutes(String(parsedMinutes))
        setSeconds(String(parsedSeconds))
        setDuration(String(parsedDuration))

        onCommit({
            ...event,
            timeOffsetSeconds: parsedMinutes * 60 + parsedSeconds,
            durationSeconds: parsedDuration,
            message,
        })
    }

    return (
        <li className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded">
            <div className="flex items-center gap-1">
                <input
                    type="text"
                    inputMode="numeric"
                    disabled={disabled}
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                    onBlur={handleBlur}
                    className="w-14 px-2 py-1 bg-zinc-900 text-white text-xs border border-zinc-700 rounded focus:outline-none focus:border-brand-500"
                />
                <span className="text-zinc-500 text-xs">m</span>
                <input
                    type="text"
                    inputMode="numeric"
                    disabled={disabled}
                    value={seconds}
                    onChange={(e) => setSeconds(e.target.value)}
                    onBlur={handleBlur}
                    className="w-14 px-2 py-1 bg-zinc-900 text-white text-xs border border-zinc-700 rounded focus:outline-none focus:border-brand-500"
                />
                <span className="text-zinc-500 text-xs">s</span>
            </div>

            <div className="flex items-center gap-1">
                <input
                    type="text"
                    inputMode="numeric"
                    disabled={disabled}
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    onBlur={handleBlur}
                    className="w-14 px-2 py-1 bg-zinc-900 text-white text-xs border border-zinc-700 rounded focus:outline-none focus:border-brand-500"
                />
                <span className="text-zinc-500 text-xs">dur</span>
            </div>

            <input
                type="text"
                disabled={disabled}
                value={message}
                placeholder="Message..."
                onChange={(e) => setMessage(e.target.value)}
                onBlur={handleBlur}
                className="flex-1 px-2 py-1 bg-zinc-900 text-white text-sm border border-zinc-700 rounded focus:outline-none focus:border-brand-500"
            />

            <button
                type="button"
                onClick={onDelete}
                disabled={disabled}
                title="Delete event"
                className={`
                    px-2 py-1
                    bg-red-900/50 text-red-200
                    label-tiny
                    rounded
                    hover:bg-red-800 transition-colors
                    focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 focus:ring-offset-zinc-800
                    disabled:opacity-50 disabled:cursor-not-allowed
                `}
            >
                Delete
            </button>
        </li>
    )
}
