/**
 * Client-side parser for Zwift .zwo workout files.
 *
 * Parses XML content into a structured ParsedWorkout object with metadata
 * and a flat interval list. Validates that the file contains well-formed
 * XML with the expected .zwo structure.
 */

import type { IntervalType, ParsedInterval, ParsedWorkout } from '../types/workout'

const INTERVAL_TAG_NAMES: Set<string> = new Set([
    'Warmup',
    'Cooldown',
    'SteadyState',
    'IntervalsT',
    'Ramp',
    'FreeRide',
])

/**
 * Parses a .zwo XML string into a ParsedWorkout.
 *
 * @param xml the raw XML content of the .zwo file
 * @param fileName the original file name, stored on the result for display
 * @return a ParsedWorkout containing metadata and a flat interval list
 * @throws Error if the XML is malformed or missing required .zwo structure
 */
export function parseZwoFile(xml: string, fileName: string): ParsedWorkout {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, 'application/xml')

    const parseError = doc.querySelector('parsererror')
    if (parseError) {
        throw new Error(`${fileName} is not valid XML.`)
    }

    const workoutFile = doc.querySelector('workout_file')
    if (!workoutFile) {
        throw new Error(`${fileName} is not a valid .zwo file: missing <workout_file> root element.`)
    }

    const workoutElement = workoutFile.querySelector('workout')
    if (!workoutElement) {
        throw new Error(`${fileName} is not a valid .zwo file: missing <workout> element.`)
    }

    // Prefer the <name> element (spec-compliant); fall back to the legacy <n>
    // element used by older Zwift exports and pre-fix versions of this tool.
    const name =
        getTextContent(workoutFile, 'name') ??
        getTextContent(workoutFile, 'n') ??
        fileName.replace(/\.zwo$/i, '')
    const author = getTextContent(workoutFile, 'author')
    const description = getTextContent(workoutFile, 'description')

    // Capture the raw <tags> XML fragment so it can be round-tripped on export
    // without parsing or modifying its content.
    const tags = extractTagsFragment(workoutFile)

    const intervals = parseIntervals(workoutElement)

    if (intervals.length === 0) {
        throw new Error(`${fileName} contains no intervals.`)
    }

    return { fileName, name, author, description, tags, intervals }
}

/**
 * Extracts the raw outer XML of the first {@code <tags>} child element from
 * the workout file element. The raw fragment is stored verbatim so it can be
 * written back to the export without modification.
 *
 * Returns null if no {@code <tags>} element is present.
 */
function extractTagsFragment(workoutFile: Element): string | null {
    const tagsElement = workoutFile.querySelector('tags')
    if (!tagsElement) {
        return null
    }
    // Serialise the <tags> element back to an XML string for storage
    const serialiser = new XMLSerializer()
    return serialiser.serializeToString(tagsElement)
}

/**
 * Extracts the text content of a direct child element by tag name.
 * Returns null if the element does not exist or is empty.
 */
function getTextContent(parent: Element, tagName: string): string | null {
    const element = parent.querySelector(tagName)
    const text = element?.textContent?.trim()
    return text && text.length > 0 ? text : null
}

/**
 * Parses all interval elements from the <workout> element into a flat list.
 * Ignores non-interval elements like <textevent>.
 */
function parseIntervals(workoutElement: Element): ParsedInterval[] {
    const intervals: ParsedInterval[] = []

    for (const child of Array.from(workoutElement.children)) {
        if (!INTERVAL_TAG_NAMES.has(child.tagName)) {
            continue
        }

        const type = child.tagName as IntervalType

        if (type === 'IntervalsT') {
            intervals.push(parseIntervalsT(child))
        } else {
            intervals.push(parseStandardInterval(child, type))
        }
    }

    return intervals
}

/**
 * Parses a standard interval element (Warmup, Cooldown, SteadyState, Ramp, FreeRide).
 */
function parseStandardInterval(element: Element, type: IntervalType): ParsedInterval {
    const duration = getNumericAttribute(element, 'Duration')
    const power = getNumericAttribute(element, 'Power')
    const powerLow = getNumericAttribute(element, 'PowerLow')
    const powerHigh = getNumericAttribute(element, 'PowerHigh')
    const cadence = getNumericAttribute(element, 'Cadence')

    return {
        type,
        durationSeconds: duration ?? 0,
        power: power ?? powerLow,
        powerHigh: powerHigh,
        cadence,
        repeat: null,
        onDuration: null,
        offDuration: null,
        onPower: null,
        offPower: null,
    }
}

/**
 * Parses an IntervalsT element, which has repeat count and on/off pairs
 * rather than a single duration and power.
 */
function parseIntervalsT(element: Element): ParsedInterval {
    return {
        type: 'IntervalsT',
        // Total duration is calculated from repeats and on/off durations
        durationSeconds: calculateIntervalsTDuration(element),
        power: null,
        powerHigh: null,
        cadence: getNumericAttribute(element, 'Cadence'),
        repeat: getNumericAttribute(element, 'Repeat'),
        onDuration: getNumericAttribute(element, 'OnDuration'),
        offDuration: getNumericAttribute(element, 'OffDuration'),
        onPower: getNumericAttribute(element, 'OnPower'),
        offPower: getNumericAttribute(element, 'OffPower'),
    }
}

/**
 * Calculates total duration for an IntervalsT element:
 * repeat * (onDuration + offDuration).
 */
function calculateIntervalsTDuration(element: Element): number {
    const repeat = getNumericAttribute(element, 'Repeat') ?? 0
    const onDuration = getNumericAttribute(element, 'OnDuration') ?? 0
    const offDuration = getNumericAttribute(element, 'OffDuration') ?? 0
    return repeat * (onDuration + offDuration)
}

/**
 * Reads a numeric attribute from an element. Returns null if the
 * attribute does not exist or is not a valid number.
 */
function getNumericAttribute(element: Element, name: string): number | null {
    const value = element.getAttribute(name)
    if (value === null) return null
    const parsed = parseFloat(value)
    return isNaN(parsed) ? null : parsed
}
