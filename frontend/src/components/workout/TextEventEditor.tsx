import { type JSX } from 'react'
import type { TextEvent } from '../../types/workout'

interface Props {
    events: TextEvent[]
    /**
     * Called whenever the list of events changes. The parent is responsible
     * for serialising the list to JSON and persisting it via the metadata
     * update endpoint.
     */
    onChange: (next: TextEvent[]) => void
    /** Disables every control while a save is in flight. */
    isSaving?: boolean
}

/**
 * Lets the user add, edit, and remove text events shown over the workout
 * timeline. Events are rendered as a vertical list of rows; each row has
 * inputs for the time offset (mm:ss) and the message body.
 */
export function TextEventEditor({
    events,
    onChange,
    isSaving = false,
}: Props): JSX.Element {
    function handleAdd(): void {
        onChange([...events, { timeOffsetSeconds: 0, message: '' }])
    }

    function handleRemove(index: number): void {
        onChange(events.filter((_, i) => i !== index))
    }

    function handleUpdate(index: number, next: TextEvent): void {
        onChange(events.map((event, i) => (i === index ? next : event)))
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

            {events.length === 0 ? (
                <p className="text-xs italic text-zinc-500">
                    No text events. Add one to display a message over the timeline.
                </p>
            ) : (
                <ul className="flex flex-col gap-1">
                    {events.map((event, index) => (
                        <TextEventRow
                            key={index}
                            event={event}
                            disabled={isSaving}
                            onChange={(next) => handleUpdate(index, next)}
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
    onChange: (next: TextEvent) => void
    onDelete: () => void
}

/** Single editable row in the text event list. */
function TextEventRow({ event, disabled, onChange, onDelete }: RowProps): JSX.Element {
    const minutes = Math.floor(event.timeOffsetSeconds / 60)
    const seconds = event.timeOffsetSeconds % 60

    return (
        <li className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded">
            <div className="flex items-center gap-1">
                <input
                    type="number"
                    min={0}
                    disabled={disabled}
                    value={minutes}
                    onChange={(e) => {
                        const next = Number(e.target.value)
                        if (!Number.isNaN(next) && next >= 0) {
                            onChange({
                                ...event,
                                timeOffsetSeconds: next * 60 + seconds,
                            })
                        }
                    }}
                    className="w-14 px-2 py-1 bg-zinc-900 text-white text-xs border border-zinc-700 rounded focus:outline-none focus:border-brand-500"
                />
                <span className="text-zinc-500 text-xs">m</span>
                <input
                    type="number"
                    min={0}
                    max={59}
                    disabled={disabled}
                    value={seconds}
                    onChange={(e) => {
                        const next = Number(e.target.value)
                        if (!Number.isNaN(next) && next >= 0 && next < 60) {
                            onChange({
                                ...event,
                                timeOffsetSeconds: minutes * 60 + next,
                            })
                        }
                    }}
                    className="w-14 px-2 py-1 bg-zinc-900 text-white text-xs border border-zinc-700 rounded focus:outline-none focus:border-brand-500"
                />
                <span className="text-zinc-500 text-xs">s</span>
            </div>

            <input
                type="text"
                disabled={disabled}
                value={event.message}
                placeholder="Message..."
                onChange={(e) => onChange({ ...event, message: e.target.value })}
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
