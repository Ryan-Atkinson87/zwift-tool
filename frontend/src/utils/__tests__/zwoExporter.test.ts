import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { generateZwoXml, downloadGuestWorkout } from '../zwoExporter'
import type { ParsedInterval, WorkoutDetail } from '../../types/workout'

/** Builds a minimal BlockDetail for testing. */
function makeMainsetBlock(intervals: ParsedInterval[]) {
    return {
        id: 'block-1',
        name: 'Main Set',
        description: null,
        sectionType: 'MAINSET' as const,
        intervals,
        durationSeconds: intervals.reduce((s, i) => s + i.durationSeconds, 0),
        intervalCount: intervals.length,
        isLibraryBlock: false,
    }
}

/** Builds a minimal WorkoutDetail for testing. */
function makeWorkout(overrides: Partial<WorkoutDetail> = {}): WorkoutDetail {
    return {
        id: 'workout-1',
        name: 'Test Workout',
        author: null,
        description: null,
        warmupBlock: null,
        mainsetBlock: makeMainsetBlock([]),
        cooldownBlock: null,
        hasPrevWarmup: false,
        hasPrevMainset: false,
        hasPrevCooldown: false,
        isDraft: false,
        textEvents: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        ...overrides,
    }
}

const STEADY_INTERVAL: ParsedInterval = {
    type: 'SteadyState',
    durationSeconds: 600,
    power: 0.88,
    powerHigh: null,
    cadence: null,
    repeat: null,
    onDuration: null,
    offDuration: null,
    onPower: null,
    offPower: null,
}

const WARMUP_INTERVAL: ParsedInterval = {
    type: 'Warmup',
    durationSeconds: 300,
    power: 0.50,
    powerHigh: 0.75,
    cadence: null,
    repeat: null,
    onDuration: null,
    offDuration: null,
    onPower: null,
    offPower: null,
}

const INTERVALS_T: ParsedInterval = {
    type: 'IntervalsT',
    durationSeconds: 450,
    power: null,
    powerHigh: null,
    cadence: null,
    repeat: 5,
    onDuration: 60,
    offDuration: 30,
    onPower: 1.10,
    offPower: 0.55,
}

describe('generateZwoXml', () => {
    it('produces a document starting with the XML declaration', () => {
        const xml = generateZwoXml(makeWorkout())
        expect(xml).toMatch(/^<\?xml version="1\.0"/)
    })

    it('wraps everything in a <workout_file> root element', () => {
        const xml = generateZwoXml(makeWorkout())
        expect(xml).toContain('<workout_file>')
        expect(xml).toContain('</workout_file>')
    })

    it('includes the workout name in an <n> element', () => {
        const xml = generateZwoXml(makeWorkout({ name: 'My Workout' }))
        expect(xml).toContain('<n>My Workout</n>')
    })

    it('escapes XML special characters in the workout name', () => {
        const xml = generateZwoXml(makeWorkout({ name: 'Hill & Valley <Sprint>' }))
        expect(xml).toContain('<n>Hill &amp; Valley &lt;Sprint&gt;</n>')
    })

    it('escapes quotes and apostrophes in the workout description', () => {
        const workout = makeWorkout({ description: 'It\'s "hard"' })
        const xml = generateZwoXml(workout)
        expect(xml).toContain("It&apos;s &quot;hard&quot;")
    })

    it('renders a SteadyState interval with Duration and Power attributes', () => {
        const workout = makeWorkout({ mainsetBlock: makeMainsetBlock([STEADY_INTERVAL]) })
        const xml = generateZwoXml(workout)
        expect(xml).toContain('<SteadyState Duration="600" Power="0.8800"/>')
    })

    it('renders an IntervalsT interval with all required attributes', () => {
        const workout = makeWorkout({ mainsetBlock: makeMainsetBlock([INTERVALS_T]) })
        const xml = generateZwoXml(workout)
        expect(xml).toContain('Repeat="5"')
        expect(xml).toContain('OnDuration="60"')
        expect(xml).toContain('OffDuration="30"')
        expect(xml).toContain('OnPower="1.1000"')
        expect(xml).toContain('OffPower="0.5500"')
    })

    it('renders a Warmup interval using PowerLow and PowerHigh attributes', () => {
        const workout = makeWorkout({
            warmupBlock: {
                ...makeMainsetBlock([WARMUP_INTERVAL]),
                sectionType: 'WARMUP',
                name: 'Warm-Up',
            },
        })
        const xml = generateZwoXml(workout)
        expect(xml).toContain('<Warmup')
        expect(xml).toContain('PowerLow="0.5000"')
        expect(xml).toContain('PowerHigh="0.7500"')
    })

    it('renders a FreeRide interval without a Power attribute', () => {
        const freeRide: ParsedInterval = {
            type: 'FreeRide',
            durationSeconds: 600,
            power: null,
            powerHigh: null,
            cadence: null,
            repeat: null,
            onDuration: null,
            offDuration: null,
            onPower: null,
            offPower: null,
        }
        const workout = makeWorkout({ mainsetBlock: makeMainsetBlock([freeRide]) })
        const xml = generateZwoXml(workout)
        expect(xml).toContain('<FreeRide Duration="600"/>')
    })

    it('includes text events as textevent elements', () => {
        const workout = makeWorkout({
            textEvents: [{ timeOffsetSeconds: 60, message: 'Keep going!', durationSeconds: 10 }],
        })
        const xml = generateZwoXml(workout)
        expect(xml).toContain('timeoffset="60"')
        expect(xml).toContain('message="Keep going!"')
        expect(xml).toContain('duration="10"')
    })

    it('omits the duration attribute from text events that have no durationSeconds', () => {
        const workout = makeWorkout({
            textEvents: [{ timeOffsetSeconds: 30, message: 'Go!' }],
        })
        const xml = generateZwoXml(workout)
        expect(xml).toContain('message="Go!"')
        expect(xml).not.toMatch(/duration="\d+"/)
    })

    it('includes intervals from all three sections in order', () => {
        const warmupInterval: ParsedInterval = { ...WARMUP_INTERVAL }
        const cooldownInterval: ParsedInterval = {
            type: 'Cooldown',
            durationSeconds: 300,
            power: 0.75,
            powerHigh: 0.40,
            cadence: null,
            repeat: null,
            onDuration: null,
            offDuration: null,
            onPower: null,
            offPower: null,
        }
        const workout = makeWorkout({
            warmupBlock: { ...makeMainsetBlock([warmupInterval]), sectionType: 'WARMUP', name: 'Warm-Up' },
            mainsetBlock: makeMainsetBlock([STEADY_INTERVAL]),
            cooldownBlock: { ...makeMainsetBlock([cooldownInterval]), sectionType: 'COOLDOWN', name: 'Cool-Down' },
        })
        const xml = generateZwoXml(workout)
        const warmupPos = xml.indexOf('<Warmup')
        const steadyPos = xml.indexOf('<SteadyState')
        const cooldownPos = xml.indexOf('<Cooldown')
        expect(warmupPos).toBeLessThan(steadyPos)
        expect(steadyPos).toBeLessThan(cooldownPos)
    })

    it('includes a Cadence attribute when the interval has a cadence value', () => {
        const withCadence: ParsedInterval = { ...STEADY_INTERVAL, cadence: 90 }
        const workout = makeWorkout({ mainsetBlock: makeMainsetBlock([withCadence]) })
        const xml = generateZwoXml(workout)
        expect(xml).toContain('Cadence="90"')
    })
})

describe('downloadGuestWorkout', () => {
    let createObjectURL: ReturnType<typeof vi.fn>
    let revokeObjectURL: ReturnType<typeof vi.fn>
    let clickSpy: ReturnType<typeof vi.fn>

    beforeEach(() => {
        createObjectURL = vi.fn().mockReturnValue('blob:test')
        revokeObjectURL = vi.fn()
        clickSpy = vi.fn()

        window.URL.createObjectURL = createObjectURL
        window.URL.revokeObjectURL = revokeObjectURL
        vi.spyOn(document, 'createElement').mockImplementation((tag) => {
            if (tag === 'a') {
                return { href: '', download: '', click: clickSpy } as unknown as HTMLAnchorElement
            }
            // Fall through to real implementation for all other tags
            return Object.getPrototypeOf(document).createElement.call(document, tag) as HTMLElement
        })
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('calls URL.createObjectURL and triggers a click', () => {
        const workout = makeWorkout({ name: 'My Workout' })
        downloadGuestWorkout(workout)
        expect(createObjectURL).toHaveBeenCalledOnce()
        expect(clickSpy).toHaveBeenCalledOnce()
    })

    it('calls URL.revokeObjectURL to clean up the blob URL', () => {
        downloadGuestWorkout(makeWorkout())
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:test')
    })

    it('sets the download filename to the workout name with a .zwo extension', () => {
        const anchorElement = { href: '', download: '', click: clickSpy } as unknown as HTMLAnchorElement
        vi.spyOn(document, 'createElement').mockImplementation((tag) => {
            if (tag === 'a') return anchorElement
            return Object.getPrototypeOf(document).createElement.call(document, tag) as HTMLElement
        })

        downloadGuestWorkout(makeWorkout({ name: 'My Session' }))
        expect(anchorElement.download).toBe('My Session.zwo')
    })
})
