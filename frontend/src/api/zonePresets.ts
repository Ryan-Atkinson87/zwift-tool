import { fetchWithAuth } from './client'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

/**
 * A single effective zone preset as returned by the backend, with either
 * the system default or a user-overridden value. {@code isCustom} is true
 * when the row came from a user override, which lets the settings panel
 * expose a per-zone reset control.
 */
export interface ZonePresetView {
    zone: number
    durationSeconds: number
    ftpPercent: number
    isCustom: boolean
}

/** Request body for upserting a single zone's preset. */
export interface ZonePresetUpdate {
    durationSeconds: number
    ftpPercent: number
}

/**
 * Fetches the effective preset defaults for every zone for the current
 * user, overlaying any custom rows on the system defaults.
 *
 * @returns a list of five presets in zone order
 * @throws Error if the request fails
 */
export async function fetchZonePresets(): Promise<ZonePresetView[]> {
    const response = await fetchWithAuth(`${API_BASE}/zone-presets`, { method: 'GET' })
    if (!response.ok) {
        throw new Error(`Failed to load zone presets: ${response.status}`)
    }
    return response.json()
}

/**
 * Upserts the preset for a single zone. Returns the effective preset
 * after the write so the caller can update local state in place.
 *
 * @param zone   the zone number, 1 to 5
 * @param update the new duration and %FTP values
 * @throws Error if the backend rejects the request (e.g. out-of-range %FTP)
 */
export async function updateZonePreset(
    zone: number,
    update: ZonePresetUpdate,
): Promise<ZonePresetView> {
    const response = await fetchWithAuth(`${API_BASE}/zone-presets/${zone}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
    })
    if (!response.ok) {
        const error: { message?: string } = await response.json().catch(() => ({}))
        throw new Error(error.message ?? `Failed to update zone preset: ${response.status}`)
    }
    return response.json()
}

/**
 * Resets a single zone's preset to the system default by deleting any
 * custom row. Idempotent: resetting an already-default zone is a no-op.
 *
 * @param zone the zone number, 1 to 5
 * @returns the system default preset for the zone
 * @throws Error if the request fails
 */
export async function resetZonePreset(zone: number): Promise<ZonePresetView> {
    const response = await fetchWithAuth(`${API_BASE}/zone-presets/${zone}`, {
        method: 'DELETE',
    })
    if (!response.ok) {
        throw new Error(`Failed to reset zone preset: ${response.status}`)
    }
    return response.json()
}
