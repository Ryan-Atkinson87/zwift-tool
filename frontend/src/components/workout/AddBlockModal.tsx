import { useState, type JSX } from 'react'
import { Modal } from '../ui/Modal'
import type { ParsedInterval, SectionType } from '../../types/workout'

/** The block types this modal can create. */
type AddableBlockType = 'Ramp' | 'IntervalsT' | 'FreeRide'

interface Props {
    isOpen: boolean
    sectionType: SectionType | null
    onClose: () => void
    /**
     * Called with a fully-populated interval when the user confirms the
     * form. The parent is responsible for appending it to the section.
     */
    onConfirm: (sectionType: SectionType, interval: ParsedInterval) => void
}

/**
 * Modal that lets the user add a Ramp, IntervalsT, or Free Ride interval
 * to the chosen section. The block type is selected first; the form below
 * adapts to show only the fields that type needs.
 */
export function AddBlockModal({
    isOpen,
    sectionType,
    onClose,
    onConfirm,
}: Props): JSX.Element | null {
    const [type, setType] = useState<AddableBlockType>('Ramp')

    // Ramp fields
    const [rampDurationSeconds, setRampDurationSeconds] = useState(300)
    const [rampStartFtp, setRampStartFtp] = useState(50)
    const [rampEndFtp, setRampEndFtp] = useState(75)

    // IntervalsT fields
    const [repeat, setRepeat] = useState(5)
    const [onDuration, setOnDuration] = useState(60)
    const [offDuration, setOffDuration] = useState(60)
    const [onFtp, setOnFtp] = useState(110)
    const [offFtp, setOffFtp] = useState(55)

    // Free Ride fields
    const [freeRideDurationSeconds, setFreeRideDurationSeconds] = useState(600)

    if (sectionType === null) {
        return null
    }

    function handleConfirm(): void {
        if (sectionType === null) {
            return
        }
        const interval = buildInterval()
        onConfirm(sectionType, interval)
        onClose()
    }

    function buildInterval(): ParsedInterval {
        if (type === 'Ramp') {
            return {
                type: 'Ramp',
                durationSeconds: rampDurationSeconds,
                power: rampStartFtp / 100,
                powerHigh: rampEndFtp / 100,
                cadence: null,
                repeat: null,
                onDuration: null,
                offDuration: null,
                onPower: null,
                offPower: null,
            }
        }
        if (type === 'IntervalsT') {
            return {
                type: 'IntervalsT',
                durationSeconds: repeat * (onDuration + offDuration),
                power: null,
                powerHigh: null,
                cadence: null,
                repeat,
                onDuration,
                offDuration,
                onPower: onFtp / 100,
                offPower: offFtp / 100,
            }
        }
        return {
            type: 'FreeRide',
            durationSeconds: freeRideDurationSeconds,
            power: null,
            powerHigh: null,
            cadence: null,
            repeat: null,
            onDuration: null,
            offDuration: null,
            onPower: null,
            offPower: null,
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add interval block">
            <div className="flex flex-col gap-4">
                <TypeSelector value={type} onChange={setType} />

                {type === 'Ramp' && (
                    <RampFields
                        durationSeconds={rampDurationSeconds}
                        startFtp={rampStartFtp}
                        endFtp={rampEndFtp}
                        onDurationSeconds={setRampDurationSeconds}
                        onStartFtp={setRampStartFtp}
                        onEndFtp={setRampEndFtp}
                    />
                )}

                {type === 'IntervalsT' && (
                    <IntervalsTFields
                        repeat={repeat}
                        onSeconds={onDuration}
                        offSeconds={offDuration}
                        onFtp={onFtp}
                        offFtp={offFtp}
                        setRepeat={setRepeat}
                        setOnSeconds={setOnDuration}
                        setOffSeconds={setOffDuration}
                        setOnFtp={setOnFtp}
                        setOffFtp={setOffFtp}
                    />
                )}

                {type === 'FreeRide' && (
                    <FreeRideFields
                        durationSeconds={freeRideDurationSeconds}
                        onChange={setFreeRideDurationSeconds}
                    />
                )}

                <div className="flex justify-end gap-2 mt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className={`
                            px-4 py-2
                            bg-zinc-700 text-white
                            text-sm font-medium
                            rounded-md
                            hover:bg-zinc-600 transition-colors
                        `}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className={`
                            px-4 py-2
                            bg-indigo-600 text-white
                            text-sm font-medium
                            rounded-md
                            hover:bg-indigo-500 transition-colors
                        `}
                    >
                        Add block
                    </button>
                </div>
            </div>
        </Modal>
    )
}

interface TypeSelectorProps {
    value: AddableBlockType
    onChange: (next: AddableBlockType) => void
}

/** Three-button selector for the block type. */
function TypeSelector({ value, onChange }: TypeSelectorProps): JSX.Element {
    const options: { value: AddableBlockType; label: string }[] = [
        { value: 'Ramp', label: 'Ramp' },
        { value: 'IntervalsT', label: 'Intervals' },
        { value: 'FreeRide', label: 'Free Ride' },
    ]
    return (
        <div className="flex gap-2">
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    onClick={() => onChange(option.value)}
                    className={`
                        flex-1 px-3 py-2
                        text-sm font-medium
                        rounded-md transition-colors
                        ${value === option.value
                            ? 'bg-indigo-600 text-white'
                            : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                        }
                    `}
                >
                    {option.label}
                </button>
            ))}
        </div>
    )
}

interface RampFieldsProps {
    durationSeconds: number
    startFtp: number
    endFtp: number
    onDurationSeconds: (n: number) => void
    onStartFtp: (n: number) => void
    onEndFtp: (n: number) => void
}

/** Form fields for a Ramp interval. */
function RampFields({
    durationSeconds,
    startFtp,
    endFtp,
    onDurationSeconds,
    onStartFtp,
    onEndFtp,
}: RampFieldsProps): JSX.Element {
    return (
        <div className="flex flex-col gap-3">
            <NumberField
                label="Duration (seconds)"
                value={durationSeconds}
                onChange={onDurationSeconds}
                min={1}
            />
            <NumberField label="Start %FTP" value={startFtp} onChange={onStartFtp} min={0} />
            <NumberField label="End %FTP" value={endFtp} onChange={onEndFtp} min={0} />
        </div>
    )
}

interface IntervalsTFieldsProps {
    repeat: number
    onSeconds: number
    offSeconds: number
    onFtp: number
    offFtp: number
    setRepeat: (n: number) => void
    setOnSeconds: (n: number) => void
    setOffSeconds: (n: number) => void
    setOnFtp: (n: number) => void
    setOffFtp: (n: number) => void
}

/** Form fields for an IntervalsT (repeating on/off) interval. */
function IntervalsTFields({
    repeat,
    onSeconds,
    offSeconds,
    onFtp,
    offFtp,
    setRepeat,
    setOnSeconds,
    setOffSeconds,
    setOnFtp,
    setOffFtp,
}: IntervalsTFieldsProps): JSX.Element {
    return (
        <div className="flex flex-col gap-3">
            <NumberField label="Repeat" value={repeat} onChange={setRepeat} min={1} />
            <NumberField
                label="On duration (seconds)"
                value={onSeconds}
                onChange={setOnSeconds}
                min={1}
            />
            <NumberField label="On %FTP" value={onFtp} onChange={setOnFtp} min={0} />
            <NumberField
                label="Off duration (seconds)"
                value={offSeconds}
                onChange={setOffSeconds}
                min={1}
            />
            <NumberField label="Off %FTP" value={offFtp} onChange={setOffFtp} min={0} />
        </div>
    )
}

interface FreeRideFieldsProps {
    durationSeconds: number
    onChange: (n: number) => void
}

/** Form fields for a Free Ride interval. */
function FreeRideFields({ durationSeconds, onChange }: FreeRideFieldsProps): JSX.Element {
    return (
        <NumberField
            label="Duration (seconds)"
            value={durationSeconds}
            onChange={onChange}
            min={1}
        />
    )
}

interface NumberFieldProps {
    label: string
    value: number
    onChange: (n: number) => void
    min?: number
    max?: number
}

/** Labelled numeric input. */
function NumberField({ label, value, onChange, min, max }: NumberFieldProps): JSX.Element {
    return (
        <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-300">{label}</span>
            <input
                type="number"
                value={value}
                min={min}
                max={max}
                onChange={(e) => {
                    const next = Number(e.target.value)
                    if (!Number.isNaN(next)) {
                        onChange(next)
                    }
                }}
                className={`
                    px-3 py-2
                    bg-zinc-900 text-white
                    text-sm
                    border border-zinc-700 rounded-md
                    focus:outline-none focus:border-indigo-500
                `}
            />
        </label>
    )
}
