/**
 * Type definitions for workouts, intervals, and blocks.
 * Used throughout the editor, import flow, and visualisation.
 */

/** The three sections that every workout is divided into. */
export type SectionType = 'WARMUP' | 'MAINSET' | 'COOLDOWN'

/** The interval types supported in Zwift .zwo files. */
export type IntervalType =
    | 'Warmup'
    | 'Cooldown'
    | 'SteadyState'
    | 'IntervalsT'
    | 'Ramp'
    | 'FreeRide'

/**
 * A single interval parsed from a .zwo file. Represents one block
 * in the flat interval list before section splitting.
 *
 * Power values are stored as decimal fractions of FTP (e.g. 0.88 = 88%).
 * Duration is in seconds.
 */
export interface ParsedInterval {
    type: IntervalType
    durationSeconds: number
    /** Steady-state power or ramp start power, as a fraction of FTP. */
    power: number | null
    /** Ramp end power, as a fraction of FTP. Only set for Warmup, Cooldown, and Ramp types. */
    powerHigh: number | null
    /** Cadence in RPM, if specified. */
    cadence: number | null
    /** IntervalsT only: number of repeats. */
    repeat: number | null
    /** IntervalsT only: duration of each on interval in seconds. */
    onDuration: number | null
    /** IntervalsT only: duration of each off interval in seconds. */
    offDuration: number | null
    /** IntervalsT only: on power as a fraction of FTP. */
    onPower: number | null
    /** IntervalsT only: off power as a fraction of FTP. */
    offPower: number | null
}

/**
 * A workout parsed from a .zwo file. Contains metadata and a flat
 * list of intervals before section splitting has been applied.
 */
export interface ParsedWorkout {
    fileName: string
    name: string
    author: string | null
    description: string | null
    intervals: ParsedInterval[]
}

/**
 * Lightweight summary of a saved workout, as returned by GET /workouts.
 * Used to render the workout list panel without loading full block content.
 */
export interface WorkoutSummary {
    id: string
    name: string
    author: string | null
    description: string | null
    durationSeconds: number
    isDraft: boolean
    updatedAt: string
}

/**
 * A single block with its full interval content, as returned by
 * GET /workouts/{id}. Content is parsed from the raw JSON string
 * on the API response into a typed {@link ParsedInterval} list.
 */
export interface BlockDetail {
    id: string
    name: string
    description: string | null
    sectionType: SectionType
    intervals: ParsedInterval[]
    durationSeconds: number
    intervalCount: number
    isLibraryBlock: boolean
}

/**
 * Full workout detail including every section block's intervals,
 * as returned by GET /workouts/{id}. Used when loading a workout
 * into the editor canvas.
 */
export interface WorkoutDetail {
    id: string
    name: string
    author: string | null
    description: string | null
    warmupBlock: BlockDetail | null
    mainsetBlock: BlockDetail
    cooldownBlock: BlockDetail | null
    /** True when the warm-up section has a previous block to undo to. */
    hasPrevWarmup: boolean
    /** True when the main set section has a previous block to undo to. */
    hasPrevMainset: boolean
    /** True when the cool-down section has a previous block to undo to. */
    hasPrevCooldown: boolean
    isDraft: boolean
    /**
     * Text events shown over the workout timeline. Parsed from the raw
     * JSON string returned by the backend; an empty array represents
     * "no events".
     */
    textEvents: TextEvent[]
    createdAt: string
    updatedAt: string
}

/**
 * A single timed text event shown over the workout timeline, such as
 * a coaching cue or instruction. The offset is measured in seconds from
 * the start of the workout (warm-up t=0).
 */
export interface TextEvent {
    /** Seconds from the start of the workout at which the message appears. */
    timeOffsetSeconds: number
    /** Message body shown on the timeline. */
    message: string
}
