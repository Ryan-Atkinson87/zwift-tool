/**
 * Zwift zone-to-colour mapping utilities.
 *
 * Zwift uses a 5-zone model based on %FTP. These utilities derive the zone
 * from a power value and return the standard Zwift colour for that zone.
 * Used by the bar chart and any zone-labelled UI elements.
 */

/**
 * Derives the Zwift training zone (1-5) from a power value expressed
 * as an integer percentage of FTP.
 *
 * Values below 60% return zone 1. Values above 120% are capped at zone 5.
 *
 * @param ftpPercent power as an integer percentage of FTP (e.g. 88 for 88%)
 * @return zone number from 1 to 5
 */
export function getZoneForPower(ftpPercent: number): number {
    if (ftpPercent < 60) return 1
    if (ftpPercent <= 75) return 2
    if (ftpPercent <= 90) return 3
    if (ftpPercent <= 105) return 4
    return 5
}

const ZONE_COLOURS: Record<number, string> = {
    1: '#8C8C8C', // Active Recovery, grey
    2: '#3B82F6', // Endurance, blue
    3: '#22C55E', // Tempo, green
    4: '#EAB308', // Threshold, yellow
    5: '#EF4444', // VO2 Max, red
}

/**
 * Returns the hex colour string for a given Zwift training zone.
 *
 * Zones outside 1-5 fall back to zone 1 colour.
 *
 * @param zone the zone number (1-5)
 * @return hex colour string (e.g. '#3B82F6')
 */
export function getColourForZone(zone: number): string {
    return ZONE_COLOURS[zone] ?? ZONE_COLOURS[1]
}
