import { describe, it, expect } from 'vitest'
import { buildPaletteItems } from '../paletteItems'
import type { ZonePresetView } from '../../api/zonePresets'

describe('buildPaletteItems', () => {
    it('returns eight items: five zone presets plus Ramp, Intervals, and Free Ride', () => {
        const items = buildPaletteItems()
        expect(items).toHaveLength(8)
    })

    it('produces zone items with ids zone-1 through zone-5', () => {
        const items = buildPaletteItems()
        const zoneIds = items.slice(0, 5).map((i) => i.id)
        expect(zoneIds).toEqual(['zone-1', 'zone-2', 'zone-3', 'zone-4', 'zone-5'])
    })

    it('produces the three special item types after the zone presets', () => {
        const items = buildPaletteItems()
        expect(items[5].id).toBe('ramp')
        expect(items[6].id).toBe('intervals')
        expect(items[7].id).toBe('freeride')
    })

    it('zone items use the documented default FTP percentages when no overrides are given', () => {
        const items = buildPaletteItems()
        // Zone 1 default is 50% FTP → power = 0.50
        expect(items[0].interval.power).toBeCloseTo(0.50)
        // Zone 4 default is 98% FTP → power = 0.98
        expect(items[3].interval.power).toBeCloseTo(0.98)
    })

    it('applies effective preset overrides to zone items', () => {
        const overrides: ZonePresetView[] = [
            { zone: 1, durationSeconds: 600, ftpPercent: 55, isCustom: true },
        ]
        const items = buildPaletteItems(overrides)
        // Zone 1 override is 55% FTP → power = 0.55
        expect(items[0].interval.power).toBeCloseTo(0.55)
    })

    it('applies duration overrides from effective presets', () => {
        const overrides: ZonePresetView[] = [
            { zone: 2, durationSeconds: 900, ftpPercent: 68, isCustom: true },
        ]
        const items = buildPaletteItems(overrides)
        expect(items[1].interval.durationSeconds).toBe(900)
    })

    it('produces zone items with SteadyState type intervals', () => {
        const items = buildPaletteItems()
        for (const item of items.slice(0, 5)) {
            expect(item.interval.type).toBe('SteadyState')
        }
    })

    it('produces an IntervalsT interval for the intervals palette item', () => {
        const items = buildPaletteItems()
        expect(items[6].interval.type).toBe('IntervalsT')
        expect(items[6].interval.repeat).toBe(5)
    })

    it('produces a FreeRide interval for the freeride palette item', () => {
        const items = buildPaletteItems()
        expect(items[7].interval.type).toBe('FreeRide')
    })
})
