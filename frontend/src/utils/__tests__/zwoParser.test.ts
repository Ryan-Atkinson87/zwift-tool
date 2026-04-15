import { describe, it, expect } from 'vitest'
import { parseZwoFile } from '../zwoParser'

/** A minimal valid .zwo XML string with a single SteadyState interval. */
const MINIMAL_VALID_ZWO = `<?xml version="1.0" encoding="utf-8"?>
<workout_file>
  <n>Test Workout</n>
  <author>Test Author</author>
  <description>A test workout</description>
  <workout>
    <SteadyState Duration="600" Power="0.88"/>
  </workout>
</workout_file>`

/** A .zwo file with all supported interval types. */
const ALL_INTERVAL_TYPES_ZWO = `<?xml version="1.0" encoding="utf-8"?>
<workout_file>
  <n>All Types</n>
  <workout>
    <SteadyState Duration="600" Power="0.88"/>
    <Warmup Duration="300" PowerLow="0.50" PowerHigh="0.75"/>
    <Cooldown Duration="300" PowerLow="0.75" PowerHigh="0.50"/>
    <IntervalsT Repeat="5" OnDuration="60" OffDuration="30" OnPower="1.10" OffPower="0.55"/>
    <Ramp Duration="300" PowerLow="0.60" PowerHigh="0.90"/>
    <FreeRide Duration="600"/>
  </workout>
</workout_file>`

describe('parseZwoFile', () => {
    describe('valid files', () => {
        it('parses a minimal valid .zwo file', () => {
            const result = parseZwoFile(MINIMAL_VALID_ZWO, 'test.zwo')
            expect(result.name).toBe('Test Workout')
            expect(result.author).toBe('Test Author')
            expect(result.description).toBe('A test workout')
            expect(result.fileName).toBe('test.zwo')
            expect(result.intervals).toHaveLength(1)
        })

        it('parses a SteadyState interval with the correct power and duration', () => {
            const result = parseZwoFile(MINIMAL_VALID_ZWO, 'test.zwo')
            const interval = result.intervals[0]
            expect(interval.type).toBe('SteadyState')
            expect(interval.durationSeconds).toBe(600)
            expect(interval.power).toBeCloseTo(0.88)
        })

        it('parses all six supported interval types', () => {
            const result = parseZwoFile(ALL_INTERVAL_TYPES_ZWO, 'all-types.zwo')
            expect(result.intervals).toHaveLength(6)
            const types = result.intervals.map((i) => i.type)
            expect(types).toContain('SteadyState')
            expect(types).toContain('Warmup')
            expect(types).toContain('Cooldown')
            expect(types).toContain('IntervalsT')
            expect(types).toContain('Ramp')
            expect(types).toContain('FreeRide')
        })

        it('parses an IntervalsT interval with repeat, on, and off values', () => {
            const result = parseZwoFile(ALL_INTERVAL_TYPES_ZWO, 'all-types.zwo')
            const intervals = result.intervals.filter((i) => i.type === 'IntervalsT')
            expect(intervals).toHaveLength(1)
            const intervalsT = intervals[0]
            expect(intervalsT.repeat).toBe(5)
            expect(intervalsT.onDuration).toBe(60)
            expect(intervalsT.offDuration).toBe(30)
            expect(intervalsT.onPower).toBeCloseTo(1.10)
            expect(intervalsT.offPower).toBeCloseTo(0.55)
        })

        it('calculates the total duration of an IntervalsT from repeat and on/off durations', () => {
            const result = parseZwoFile(ALL_INTERVAL_TYPES_ZWO, 'all-types.zwo')
            const intervalsT = result.intervals.find((i) => i.type === 'IntervalsT')!
            // 5 repeats * (60 + 30) = 450 seconds
            expect(intervalsT.durationSeconds).toBe(450)
        })

        it('parses a Warmup interval with low and high power', () => {
            const result = parseZwoFile(ALL_INTERVAL_TYPES_ZWO, 'all-types.zwo')
            const warmup = result.intervals.find((i) => i.type === 'Warmup')!
            expect(warmup.power).toBeCloseTo(0.50)
            expect(warmup.powerHigh).toBeCloseTo(0.75)
        })

        it('uses the filename (without extension) as the name when the <n> element is absent', () => {
            const xml = `<workout_file>
  <workout>
    <SteadyState Duration="300" Power="0.70"/>
  </workout>
</workout_file>`
            const result = parseZwoFile(xml, 'my-workout.zwo')
            expect(result.name).toBe('my-workout')
        })

        it('returns null for author and description when those elements are absent', () => {
            const xml = `<workout_file>
  <n>No Meta</n>
  <workout>
    <SteadyState Duration="300" Power="0.70"/>
  </workout>
</workout_file>`
            const result = parseZwoFile(xml, 'test.zwo')
            expect(result.author).toBeNull()
            expect(result.description).toBeNull()
        })

        it('ignores non-interval child elements such as textevent', () => {
            const xml = `<workout_file>
  <n>With Events</n>
  <workout>
    <SteadyState Duration="300" Power="0.70"/>
    <textevent timeoffset="0" message="Go!"/>
  </workout>
</workout_file>`
            const result = parseZwoFile(xml, 'test.zwo')
            expect(result.intervals).toHaveLength(1)
        })
    })

    describe('invalid files', () => {
        it('throws on malformed XML', () => {
            expect(() => parseZwoFile('<unclosed', 'broken.zwo')).toThrow(
                'broken.zwo is not valid XML.'
            )
        })

        it('throws when the <workout_file> root element is missing', () => {
            expect(() =>
                parseZwoFile('<other_root><workout><SteadyState/></workout></other_root>', 'bad.zwo')
            ).toThrow('missing <workout_file> root element')
        })

        it('throws when the <workout> element is missing inside <workout_file>', () => {
            expect(() =>
                parseZwoFile('<workout_file><n>Test</n></workout_file>', 'bad.zwo')
            ).toThrow('missing <workout> element')
        })

        it('throws when the file contains no recognised interval elements', () => {
            const xml = `<workout_file>
  <n>Empty</n>
  <workout>
    <textevent timeoffset="0" message="Only text"/>
  </workout>
</workout_file>`
            expect(() => parseZwoFile(xml, 'empty.zwo')).toThrow(
                'empty.zwo contains no intervals.'
            )
        })
    })
})
