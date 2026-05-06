import type { ParsedInterval } from '../types/workout'
import type { ZonePresetView } from '../api/zonePresets'
import { ZONE_PRESETS } from './zonePresets'

export interface PaletteItemDef {
    id: string
    label: string
    /** Accessible label describing the interval type and action, used as aria-label on each palette button. */
    ariaLabel: string
    interval: ParsedInterval
}

/**
 * Builds the list of draggable palette items. Zone items use effective presets
 * when available. Ramp, Intervals, and Free Ride use fixed defaults.
 */
export function buildPaletteItems(effectivePresets?: ZonePresetView[]): PaletteItemDef[] {
    const zoneItems: PaletteItemDef[] = ZONE_PRESETS.map((preset) => {
        const override = effectivePresets?.find((p) => p.zone === preset.zone)
        const ftpPercent = override?.ftpPercent ?? preset.defaultFtpPercent
        const durationSeconds = override?.durationSeconds ?? preset.defaultDurationSeconds
        return {
            id: `zone-${preset.zone}`,
            label: `Z${preset.zone}`,
            ariaLabel: `Add Zone ${preset.zone} ${preset.name} interval`,
            interval: {
                type: 'SteadyState',
                durationSeconds,
                power: ftpPercent / 100,
                powerHigh: null,
                cadence: null,
                repeat: null,
                onDuration: null,
                offDuration: null,
                onPower: null,
                offPower: null,
            } as ParsedInterval,
        }
    })

    return [
        ...zoneItems,
        {
            id: 'ramp',
            label: 'Ramp',
            ariaLabel: 'Add Ramp interval',
            interval: {
                type: 'Ramp',
                durationSeconds: 300,
                power: 0.5,
                powerHigh: 0.75,
                cadence: null,
                repeat: null,
                onDuration: null,
                offDuration: null,
                onPower: null,
                offPower: null,
            },
        },
        {
            id: 'intervals',
            label: 'Intervals',
            ariaLabel: 'Add Intervals interval',
            interval: {
                type: 'IntervalsT',
                durationSeconds: 600,
                power: null,
                powerHigh: null,
                cadence: null,
                repeat: 5,
                onDuration: 60,
                offDuration: 60,
                onPower: 1.1,
                offPower: 0.55,
            },
        },
        {
            id: 'freeride',
            label: 'Free Ride',
            ariaLabel: 'Add Free Ride interval',
            interval: {
                type: 'FreeRide',
                durationSeconds: 600,
                power: null,
                powerHigh: null,
                cadence: null,
                repeat: null,
                onDuration: null,
                offDuration: null,
                onPower: null,
                offPower: null,
            },
        },
    ]
}
