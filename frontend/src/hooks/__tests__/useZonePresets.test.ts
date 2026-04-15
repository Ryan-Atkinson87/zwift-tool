import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useZonePresets } from '../useZonePresets'
import type { ZonePresetView } from '../../api/zonePresets'

vi.mock('../../api/zonePresets', () => ({
    fetchZonePresets: vi.fn(),
    updateZonePreset: vi.fn(),
    resetZonePreset: vi.fn(),
}))

import { fetchZonePresets, updateZonePreset, resetZonePreset } from '../../api/zonePresets'

const mockFetchZonePresets = vi.mocked(fetchZonePresets)
const mockUpdateZonePreset = vi.mocked(updateZonePreset)
const mockResetZonePreset = vi.mocked(resetZonePreset)

const MOCK_PRESETS: ZonePresetView[] = [
    { zone: 1, durationSeconds: 600, ftpPercent: 50, isCustom: false },
    { zone: 2, durationSeconds: 1200, ftpPercent: 68, isCustom: false },
    { zone: 3, durationSeconds: 900, ftpPercent: 83, isCustom: false },
    { zone: 4, durationSeconds: 480, ftpPercent: 98, isCustom: false },
    { zone: 5, durationSeconds: 120, ftpPercent: 113, isCustom: false },
]

beforeEach(() => {
    vi.clearAllMocks()
})

describe('useZonePresets', () => {
    describe('when disabled', () => {
        it('does not call the API', async () => {
            renderHook(() => useZonePresets(false))
            await act(async () => {})
            expect(mockFetchZonePresets).not.toHaveBeenCalled()
        })

        it('returns the hardcoded fallback presets', async () => {
            const { result } = renderHook(() => useZonePresets(false))
            await act(async () => {})
            expect(result.current.presets).toHaveLength(5)
            expect(result.current.isLoading).toBe(false)
        })
    })

    describe('when enabled', () => {
        it('fetches presets from the API on mount', async () => {
            mockFetchZonePresets.mockResolvedValue(MOCK_PRESETS)
            const { result } = renderHook(() => useZonePresets(true))

            await waitFor(() => { expect(result.current.isLoading).toBe(false) })
            expect(mockFetchZonePresets).toHaveBeenCalledOnce()
        })

        it('populates presets from the API response', async () => {
            mockFetchZonePresets.mockResolvedValue(MOCK_PRESETS)
            const { result } = renderHook(() => useZonePresets(true))

            await waitFor(() => { expect(result.current.isLoading).toBe(false) })
            expect(result.current.presets).toEqual(MOCK_PRESETS)
        })

        it('stores the error message when the fetch fails', async () => {
            mockFetchZonePresets.mockRejectedValue(new Error('Failed to load zone presets: 500'))
            const { result } = renderHook(() => useZonePresets(true))

            await waitFor(() => { expect(result.current.isLoading).toBe(false) })
            expect(result.current.error).toBe('Failed to load zone presets: 500')
        })
    })

    describe('getPreset', () => {
        it('returns the effective preset for a given zone', async () => {
            mockFetchZonePresets.mockResolvedValue(MOCK_PRESETS)
            const { result } = renderHook(() => useZonePresets(true))
            await waitFor(() => { expect(result.current.isLoading).toBe(false) })

            const preset = result.current.getPreset(3)
            expect(preset.zone).toBe(3)
            expect(preset.ftpPercent).toBe(83)
        })

        it('falls back to hardcoded defaults for a zone not in the presets list', async () => {
            mockFetchZonePresets.mockResolvedValue([])
            const { result } = renderHook(() => useZonePresets(true))
            await waitFor(() => { expect(result.current.isLoading).toBe(false) })

            // Falls back to the FALLBACK_PRESETS array
            const preset = result.current.getPreset(1)
            expect(preset.zone).toBe(1)
        })
    })

    describe('savePreset', () => {
        it('calls the update API and replaces the zone in the local preset list', async () => {
            mockFetchZonePresets.mockResolvedValue(MOCK_PRESETS)
            const updated: ZonePresetView = { zone: 2, durationSeconds: 900, ftpPercent: 70, isCustom: true }
            mockUpdateZonePreset.mockResolvedValue(updated)

            const { result } = renderHook(() => useZonePresets(true))
            await waitFor(() => { expect(result.current.isLoading).toBe(false) })

            await act(async () => {
                await result.current.savePreset(2, 900, 70)
            })

            expect(mockUpdateZonePreset).toHaveBeenCalledWith(2, { durationSeconds: 900, ftpPercent: 70 })
            const zone2 = result.current.presets.find((p) => p.zone === 2)
            expect(zone2?.isCustom).toBe(true)
            expect(zone2?.ftpPercent).toBe(70)
        })
    })

    describe('resetPreset', () => {
        it('calls the reset API and replaces the zone with the system default', async () => {
            mockFetchZonePresets.mockResolvedValue(MOCK_PRESETS)
            const systemDefault: ZonePresetView = { zone: 4, durationSeconds: 480, ftpPercent: 98, isCustom: false }
            mockResetZonePreset.mockResolvedValue(systemDefault)

            const { result } = renderHook(() => useZonePresets(true))
            await waitFor(() => { expect(result.current.isLoading).toBe(false) })

            await act(async () => {
                await result.current.resetPreset(4)
            })

            expect(mockResetZonePreset).toHaveBeenCalledWith(4)
            const zone4 = result.current.presets.find((p) => p.zone === 4)
            expect(zone4?.isCustom).toBe(false)
        })
    })

    describe('reload', () => {
        it('re-fetches presets from the API', async () => {
            mockFetchZonePresets.mockResolvedValue(MOCK_PRESETS)
            const { result } = renderHook(() => useZonePresets(true))
            await waitFor(() => { expect(result.current.isLoading).toBe(false) })

            await act(async () => {
                await result.current.reload()
            })

            expect(mockFetchZonePresets).toHaveBeenCalledTimes(2)
        })
    })
})
