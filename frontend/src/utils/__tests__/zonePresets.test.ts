import { describe, it, expect } from 'vitest'
import { ZONE_PRESETS, getZonePreset } from '../zonePresets'

describe('ZONE_PRESETS', () => {
    it('contains exactly five presets', () => {
        expect(ZONE_PRESETS).toHaveLength(5)
    })

    it('has presets for zones 1 through 5 in order', () => {
        const zones = ZONE_PRESETS.map((p) => p.zone)
        expect(zones).toEqual([1, 2, 3, 4, 5])
    })

    it('gives zone 1 an Active Recovery name with 50% FTP default', () => {
        const zone1 = ZONE_PRESETS[0]
        expect(zone1.name).toBe('Active Recovery')
        expect(zone1.defaultFtpPercent).toBe(50)
        expect(zone1.minFtpPercent).toBe(0)
        expect(zone1.maxFtpPercent).toBe(59)
    })

    it('gives zone 5 a null maxFtpPercent as it has no upper bound', () => {
        const zone5 = ZONE_PRESETS[4]
        expect(zone5.name).toBe('VO2 Max')
        expect(zone5.maxFtpPercent).toBeNull()
    })

    it('gives each zone a positive default duration', () => {
        for (const preset of ZONE_PRESETS) {
            expect(preset.defaultDurationSeconds).toBeGreaterThan(0)
        }
    })
})

describe('getZonePreset', () => {
    it('returns the preset for zone 1', () => {
        const preset = getZonePreset(1)
        expect(preset.zone).toBe(1)
        expect(preset.name).toBe('Active Recovery')
    })

    it('returns the preset for zone 3', () => {
        const preset = getZonePreset(3)
        expect(preset.zone).toBe(3)
        expect(preset.name).toBe('Tempo')
    })

    it('returns the preset for zone 5', () => {
        const preset = getZonePreset(5)
        expect(preset.zone).toBe(5)
        expect(preset.name).toBe('VO2 Max')
    })

    it('returns the same object as found in ZONE_PRESETS', () => {
        expect(getZonePreset(2)).toBe(ZONE_PRESETS[1])
    })
})
