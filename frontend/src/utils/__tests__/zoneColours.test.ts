import { describe, it, expect } from 'vitest'
import { getZoneForPower, getColourForZone } from '../zoneColours'

describe('getZoneForPower', () => {
    it('returns zone 1 for power below 60%', () => {
        expect(getZoneForPower(0)).toBe(1)
        expect(getZoneForPower(30)).toBe(1)
        expect(getZoneForPower(59)).toBe(1)
    })

    it('returns zone 2 for power between 60% and 75% inclusive', () => {
        expect(getZoneForPower(60)).toBe(2)
        expect(getZoneForPower(68)).toBe(2)
        expect(getZoneForPower(75)).toBe(2)
    })

    it('returns zone 3 for power between 76% and 90% inclusive', () => {
        expect(getZoneForPower(76)).toBe(3)
        expect(getZoneForPower(83)).toBe(3)
        expect(getZoneForPower(90)).toBe(3)
    })

    it('returns zone 4 for power between 91% and 105% inclusive', () => {
        expect(getZoneForPower(91)).toBe(4)
        expect(getZoneForPower(98)).toBe(4)
        expect(getZoneForPower(105)).toBe(4)
    })

    it('returns zone 5 for power above 105%', () => {
        expect(getZoneForPower(106)).toBe(5)
        expect(getZoneForPower(120)).toBe(5)
        expect(getZoneForPower(150)).toBe(5)
    })

    it('handles the exact boundary at 60%', () => {
        expect(getZoneForPower(59)).toBe(1)
        expect(getZoneForPower(60)).toBe(2)
    })
})

describe('getColourForZone', () => {
    it('returns the correct hex colour for zone 1 (active recovery, grey)', () => {
        expect(getColourForZone(1)).toBe('#8C8C8C')
    })

    it('returns the correct hex colour for zone 2 (endurance, blue)', () => {
        expect(getColourForZone(2)).toBe('#3B82F6')
    })

    it('returns the correct hex colour for zone 3 (tempo, green)', () => {
        expect(getColourForZone(3)).toBe('#22C55E')
    })

    it('returns the correct hex colour for zone 4 (threshold, yellow)', () => {
        expect(getColourForZone(4)).toBe('#EAB308')
    })

    it('returns the correct hex colour for zone 5 (VO2 Max, red)', () => {
        expect(getColourForZone(5)).toBe('#EF4444')
    })

    it('falls back to zone 1 colour for an out-of-range zone number', () => {
        expect(getColourForZone(0)).toBe('#8C8C8C')
        expect(getColourForZone(6)).toBe('#8C8C8C')
        expect(getColourForZone(-1)).toBe('#8C8C8C')
    })
})
