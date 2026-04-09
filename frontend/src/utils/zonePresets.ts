/**
 * Static defaults for the five Zwift training zones, used by the
 * "add interval via zone preset" buttons in the editor.
 *
 * <p>These values are the documented system defaults from the project
 * instructions. A future zone preset customisation issue will allow users
 * to override the default duration and %FTP per zone; consumers should
 * read presets through {@link getZonePreset} so that work can be plugged
 * in without touching every call site.</p>
 */

/** A Zwift training zone, indexed 1 to 5. */
export type Zone = 1 | 2 | 3 | 4 | 5

/**
 * The defaults and valid range for a single Zwift training zone.
 *
 * Power values are stored as integer percentages of FTP (e.g. 50 for
 * 50% FTP), matching the units used elsewhere in the chart code.
 */
export interface ZonePreset {
    zone: Zone
    name: string
    /** Default %FTP applied when the user clicks the preset button. */
    defaultFtpPercent: number
    /** Default duration in seconds applied when the preset is added. */
    defaultDurationSeconds: number
    /**
     * Inclusive lower bound of the valid %FTP range for this zone. Used
     * by the future preset customisation issue to hard-block edits that
     * would push a zone outside its band.
     */
    minFtpPercent: number
    /**
     * Inclusive upper bound of the valid %FTP range for this zone, or
     * null for Zone 5 which has no documented upper bound.
     */
    maxFtpPercent: number | null
}

/** All five zone presets, ordered Zone 1 through Zone 5. */
export const ZONE_PRESETS: readonly ZonePreset[] = [
    {
        zone: 1,
        name: 'Active Recovery',
        defaultFtpPercent: 50,
        defaultDurationSeconds: 10 * 60,
        minFtpPercent: 0,
        maxFtpPercent: 59,
    },
    {
        zone: 2,
        name: 'Endurance',
        defaultFtpPercent: 68,
        defaultDurationSeconds: 20 * 60,
        minFtpPercent: 60,
        maxFtpPercent: 75,
    },
    {
        zone: 3,
        name: 'Tempo',
        defaultFtpPercent: 83,
        defaultDurationSeconds: 15 * 60,
        minFtpPercent: 76,
        maxFtpPercent: 90,
    },
    {
        zone: 4,
        name: 'Threshold',
        defaultFtpPercent: 98,
        defaultDurationSeconds: 8 * 60,
        minFtpPercent: 91,
        maxFtpPercent: 105,
    },
    {
        zone: 5,
        name: 'VO2 Max',
        defaultFtpPercent: 113,
        defaultDurationSeconds: 2 * 60,
        minFtpPercent: 106,
        maxFtpPercent: 120,
    },
] as const

/**
 * Returns the preset for a given Zwift zone. Wrapped in a helper so the
 * future zone preset customisation issue can swap the lookup for one that
 * overlays user overrides from the database without touching every caller.
 *
 * @param zone the zone number, 1 to 5
 * @return the matching preset
 */
export function getZonePreset(zone: Zone): ZonePreset {
    // Index is safe because Zone is constrained to 1..5 at the type level
    return ZONE_PRESETS[zone - 1]
}
