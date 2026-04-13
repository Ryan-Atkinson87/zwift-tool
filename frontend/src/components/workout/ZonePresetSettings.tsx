import { useEffect, useState, type JSX } from 'react'
import { Modal } from '../ui/Modal'
import { ZONE_PRESETS, type Zone } from '../../utils/zonePresets'
import { getColourForZone } from '../../utils/zoneColours'
import type { ZonePresetView } from '../../api/zonePresets'

interface Props {
    isOpen: boolean
    onClose: () => void
    presets: ZonePresetView[]
    onSave: (zone: Zone, durationSeconds: number, ftpPercent: number) => Promise<void>
    onReset: (zone: Zone) => Promise<void>
}

/**
 * Settings modal that lets the user customise the default duration and
 * %FTP for each zone preset button. Changes persist server-side via the
 * supplied {@code onSave} and {@code onReset} handlers.
 *
 * <p>%FTP is validated against the documented range for the zone before
 * the save is attempted, so the user gets instant feedback rather than a
 * backend error round-trip.</p>
 */
export function ZonePresetSettings({
    isOpen,
    onClose,
    presets,
    onSave,
    onReset,
}: Props): JSX.Element {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Zone preset defaults">
            <div className="flex flex-col gap-4">
                {ZONE_PRESETS.map((definition) => {
                    const current = presets.find((p) => p.zone === definition.zone)
                    if (current === undefined) {
                        return null
                    }
                    return (
                        <ZoneRow
                            key={definition.zone}
                            zone={definition.zone}
                            name={definition.name}
                            minFtpPercent={definition.minFtpPercent}
                            maxFtpPercent={definition.maxFtpPercent}
                            current={current}
                            onSave={onSave}
                            onReset={onReset}
                        />
                    )
                })}
            </div>
        </Modal>
    )
}

interface ZoneRowProps {
    zone: Zone
    name: string
    minFtpPercent: number
    maxFtpPercent: number | null
    current: ZonePresetView
    onSave: (zone: Zone, durationSeconds: number, ftpPercent: number) => Promise<void>
    onReset: (zone: Zone) => Promise<void>
}

/** Single editable row for one zone's default duration and %FTP. */
function ZoneRow({
    zone,
    name,
    minFtpPercent,
    maxFtpPercent,
    current,
    onSave,
    onReset,
}: ZoneRowProps): JSX.Element {
    const [durationMinutes, setDurationMinutes] = useState<number>(
        Math.round(current.durationSeconds / 60),
    )
    const [ftpPercent, setFtpPercent] = useState<number>(current.ftpPercent)
    const [error, setError] = useState<string | null>(null)
    const [isBusy, setIsBusy] = useState(false)

    // Reseed the inputs whenever the underlying preset changes (save
    // response or reset) so the row always shows the persisted value.
    useEffect(() => {
        setDurationMinutes(Math.round(current.durationSeconds / 60))
        setFtpPercent(current.ftpPercent)
    }, [current])

    const rangeLabel =
        maxFtpPercent !== null
            ? `${minFtpPercent}-${maxFtpPercent}% FTP`
            : `${minFtpPercent}%+ FTP`

    async function handleSave(): Promise<void> {
        setError(null)
        if (durationMinutes < 1) {
            setError('Duration must be at least 1 minute.')
            return
        }
        if (ftpPercent < minFtpPercent) {
            setError(`%FTP must be at least ${minFtpPercent}.`)
            return
        }
        if (maxFtpPercent !== null && ftpPercent > maxFtpPercent) {
            setError(`%FTP must not exceed ${maxFtpPercent}.`)
            return
        }
        setIsBusy(true)
        try {
            await onSave(zone, durationMinutes * 60, ftpPercent)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save preset.')
        } finally {
            setIsBusy(false)
        }
    }

    async function handleReset(): Promise<void> {
        setError(null)
        setIsBusy(true)
        try {
            await onReset(zone)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to reset preset.')
        } finally {
            setIsBusy(false)
        }
    }

    return (
        <div className="flex flex-col gap-2 p-3 bg-zinc-900/60 border border-zinc-700 rounded">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span
                        className="w-6 h-6 rounded label-tiny text-white flex items-center justify-center"
                        style={{ backgroundColor: getColourForZone(zone) }}
                    >
                        Z{zone}
                    </span>
                    <span className="text-sm font-medium text-white">{name}</span>
                    {current.isCustom && (
                        <span className="label-tiny text-brand-300">
                            Custom
                        </span>
                    )}
                </div>
                <span className="label-tiny text-zinc-500">
                    {rangeLabel}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-xs">
                    <span className="text-zinc-400">Duration (min)</span>
                    <input
                        type="number"
                        min={1}
                        value={durationMinutes}
                        onChange={(e) => {
                            const next = Number(e.target.value)
                            if (!Number.isNaN(next)) {
                                setDurationMinutes(next)
                            }
                        }}
                        className="px-2 py-1 bg-zinc-900 text-white text-sm border border-zinc-700 rounded focus:outline-none focus:border-brand-500"
                    />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                    <span className="text-zinc-400">%FTP</span>
                    <input
                        type="number"
                        min={minFtpPercent}
                        max={maxFtpPercent ?? undefined}
                        value={ftpPercent}
                        onChange={(e) => {
                            const next = Number(e.target.value)
                            if (!Number.isNaN(next)) {
                                setFtpPercent(next)
                            }
                        }}
                        className="px-2 py-1 bg-zinc-900 text-white text-sm border border-zinc-700 rounded focus:outline-none focus:border-brand-500"
                    />
                </label>
            </div>

            <div className="flex items-center justify-end gap-2">
                <button
                    type="button"
                    onClick={() => void handleReset()}
                    disabled={isBusy || !current.isCustom}
                    className="px-3 py-1 bg-zinc-700 text-zinc-100 text-xs rounded hover:bg-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    Reset
                </button>
                <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={isBusy}
                    className="px-3 py-1 bg-brand-600 text-white text-xs rounded hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    Save
                </button>
            </div>

            {error !== null && (
                <p className="text-[11px] text-red-300">{error}</p>
            )}
        </div>
    )
}
