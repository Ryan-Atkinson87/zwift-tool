import { useCallback, useEffect, useState } from 'react'
import {
    fetchZonePresets,
    resetZonePreset,
    updateZonePreset,
    type ZonePresetView,
} from '../api/zonePresets'
import { ZONE_PRESETS, type Zone } from '../utils/zonePresets'

/** Return shape of the {@link useZonePresets} hook. */
export interface UseZonePresetsResult {
    /**
     * Effective preset for every zone, always five entries in zone order.
     * Falls back to the hard-coded documented defaults until the first
     * fetch completes so callers always have a usable list to render.
     */
    presets: ZonePresetView[]
    isLoading: boolean
    error: string | null
    /** Retrieves the effective values for a single zone by number. */
    getPreset: (zone: Zone) => ZonePresetView
    /** Persists a customisation and refreshes local state on success. */
    savePreset: (zone: Zone, durationSeconds: number, ftpPercent: number) => Promise<void>
    /** Deletes any custom row and falls back to the system default. */
    resetPreset: (zone: Zone) => Promise<void>
    /** Re-reads the effective presets from the backend. */
    reload: () => Promise<void>
}

/**
 * Hard-coded fallback used before the first fetch completes, so the
 * preset buttons and settings panel can render without flashing empty
 * state. These values mirror the documented system defaults.
 */
const FALLBACK_PRESETS: ZonePresetView[] = ZONE_PRESETS.map((preset) => ({
    zone: preset.zone,
    durationSeconds: preset.defaultDurationSeconds,
    ftpPercent: preset.defaultFtpPercent,
    isCustom: false,
}))

/**
 * Fetches, caches, and mutates the authenticated user's effective zone
 * preset defaults. Kept in a single hook so every component that needs
 * to read or write presets stays in sync after a customisation.
 *
 * @param enabled when false, skips fetching and keeps the fallback list
 */
export function useZonePresets(enabled: boolean): UseZonePresetsResult {
    const [presets, setPresets] = useState<ZonePresetView[]>(FALLBACK_PRESETS)
    const [isLoading, setIsLoading] = useState<boolean>(enabled)
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(async (): Promise<void> => {
        setIsLoading(true)
        setError(null)
        try {
            const result = await fetchZonePresets()
            setPresets(result)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load zone presets.')
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!enabled) {
            setPresets(FALLBACK_PRESETS)
            setIsLoading(false)
            return
        }
        void load()
    }, [enabled, load])

    const getPreset = useCallback(
        (zone: Zone): ZonePresetView => {
            return presets.find((p) => p.zone === zone) ?? FALLBACK_PRESETS[zone - 1]
        },
        [presets],
    )

    const savePreset = useCallback(
        async (zone: Zone, durationSeconds: number, ftpPercent: number): Promise<void> => {
            const updated = await updateZonePreset(zone, { durationSeconds, ftpPercent })
            setPresets((prev) => prev.map((p) => (p.zone === zone ? updated : p)))
        },
        [],
    )

    const resetPresetCb = useCallback(async (zone: Zone): Promise<void> => {
        const updated = await resetZonePreset(zone)
        setPresets((prev) => prev.map((p) => (p.zone === zone ? updated : p)))
    }, [])

    return {
        presets,
        isLoading,
        error,
        getPreset,
        savePreset,
        resetPreset: resetPresetCb,
        reload: load,
    }
}
