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
