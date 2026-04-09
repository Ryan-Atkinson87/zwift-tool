import type { JSX } from 'react'
import type { SectionType } from '../../types/workout'
import { ZONE_PRESETS, type Zone } from '../../utils/zonePresets'
import { getColourForZone } from '../../utils/zoneColours'
import type { ZonePresetView } from '../../api/zonePresets'

interface Props {
    sectionType: SectionType
    /**
     * Called when the user clicks a preset button. The handler is responsible
     * for appending a new SteadyState interval to the section using the
     * preset's default duration and %FTP.
     */
    onSelectPreset: (sectionType: SectionType, zone: Zone) => void
    /** Disables every button, e.g. while a save is in flight. */
    disabled?: boolean
    /**
     * Effective presets to reflect in the tooltip. When omitted the
     * documented system defaults are shown. Supplied by callers that
     * resolve user customisations through {@code useZonePresets}.
     */
    effectivePresets?: ZonePresetView[]
}

/**
 * Renders a row of five buttons, one per Zwift training zone, that add a
 * new SteadyState interval to the given section using the documented
 * default duration and %FTP for the chosen zone.
 *
 * <p>Each button is coloured by its zone so users can scan the row at a
 * glance against the chart's bar colours.</p>
 */
export function ZonePresetButtons({
    sectionType,
    onSelectPreset,
    disabled = false,
    effectivePresets,
}: Props): JSX.Element {
    return (
        <div className="flex flex-wrap items-center justify-center gap-1">
            {ZONE_PRESETS.map((preset) => {
                const override = effectivePresets?.find((p) => p.zone === preset.zone)
                const ftp = override?.ftpPercent ?? preset.defaultFtpPercent
                const durationSeconds = override?.durationSeconds ?? preset.defaultDurationSeconds
                return (
                <button
                    key={preset.zone}
                    type="button"
                    onClick={() => onSelectPreset(sectionType, preset.zone)}
                    disabled={disabled}
                    title={`Add ${preset.name} (${ftp}% FTP, ${Math.round(durationSeconds / 60)} min)`}
                    style={{ backgroundColor: getColourForZone(preset.zone) }}
                    className={`
                        px-1.5 py-0.5
                        text-[10px] font-semibold uppercase tracking-wide text-white
                        rounded
                        hover:opacity-90 transition-opacity
                        disabled:opacity-40 disabled:cursor-not-allowed
                    `}
                >
                    Z{preset.zone}
                </button>
                )
            })}
        </div>
    )
}
