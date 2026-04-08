import { fetchWithAuth } from './client'
import type {
    BlockDetail,
    ParsedInterval,
    SectionType,
    WorkoutDetail,
    WorkoutSummary,
} from '../types/workout'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

/** Request body for saving a workout from the import flow. */
export interface SaveWorkoutRequest {
    name: string
    author: string | null
    description: string | null
    warmupContent: string | null
    mainsetContent: string
    cooldownContent: string | null
    warmupDurationSeconds: number | null
    mainsetDurationSeconds: number
    cooldownDurationSeconds: number | null
    warmupIntervalCount: number | null
    mainsetIntervalCount: number
    cooldownIntervalCount: number | null
}

/** Response body from the workout save endpoint. */
export interface SaveWorkoutResponse {
    id: string
    name: string
    author: string | null
    description: string | null
    warmupBlockId: string | null
    mainsetBlockId: string
    cooldownBlockId: string | null
    isDraft: boolean
    createdAt: string
    updatedAt: string
}

/**
 * Saves a new workout from the import flow. Sends the structured workout
 * with section content to the backend.
 *
 * @param request the workout data with section splits applied
 * @returns the saved workout record
 * @throws Error if the request fails
 */
/**
 * Fetches all saved workouts for the authenticated user as a summary list,
 * ordered by most recently updated first.
 *
 * @returns the workout summary list, empty if the user has no saved workouts
 * @throws Error if the request fails
 */
export async function fetchWorkouts(): Promise<WorkoutSummary[]> {
    const response = await fetchWithAuth(`${API_BASE}/workouts`, {
        method: 'GET',
    })

    if (!response.ok) {
        throw new Error(`Failed to load workouts: ${response.status}`)
    }

    return response.json()
}

/**
 * Raw block payload as returned by the backend detail endpoint.
 * The {@code content} field is a JSON string of the interval array
 * and is parsed into a typed list before the block leaves this module.
 */
interface BlockDetailPayload {
    id: string
    name: string
    description: string | null
    sectionType: SectionType
    content: string
    durationSeconds: number
    intervalCount: number
    isLibraryBlock: boolean
}

/**
 * Raw workout detail payload as returned by GET /workouts/{id}.
 */
interface WorkoutDetailPayload {
    id: string
    name: string
    author: string | null
    description: string | null
    warmupBlock: BlockDetailPayload | null
    mainsetBlock: BlockDetailPayload
    cooldownBlock: BlockDetailPayload | null
    hasPrevWarmup: boolean
    hasPrevMainset: boolean
    hasPrevCooldown: boolean
    isDraft: boolean
    createdAt: string
    updatedAt: string
}

/** Request body for updating a single section of an existing workout. */
export interface UpdateWorkoutSectionRequest {
    sectionType: SectionType
    content: string
    durationSeconds: number
    intervalCount: number
}

/** Request body for updating the metadata fields of an existing workout. */
export interface UpdateWorkoutMetadataRequest {
    name: string
    author: string | null
    description: string | null
}

/**
 * Fetches a single workout by ID with full block content, used when
 * loading a workout into the editor canvas.
 *
 * @param workoutId the ID of the workout to fetch
 * @returns the full workout detail with typed interval lists
 * @throws Error if the workout does not exist, the user is not
 *               authorised, or the request fails
 */
export async function fetchWorkoutById(workoutId: string): Promise<WorkoutDetail> {
    const response = await fetchWithAuth(`${API_BASE}/workouts/${workoutId}`, {
        method: 'GET',
    })

    if (!response.ok) {
        throw new Error(`Failed to load workout: ${response.status}`)
    }

    const payload: WorkoutDetailPayload = await response.json()

    return mapWorkoutDetailPayload(payload)
}

/**
 * Updates a single section of an existing workout. Used by the editor's
 * auto-save loop. Returns the full updated workout detail.
 *
 * @param workoutId the ID of the workout to update
 * @param request   the section type and new content to apply
 * @throws Error if the workout does not exist, the user is not
 *               authorised, or the request fails
 */
export async function updateWorkoutSection(
    workoutId: string,
    request: UpdateWorkoutSectionRequest,
): Promise<WorkoutDetail> {
    const response = await fetchWithAuth(`${API_BASE}/workouts/${workoutId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    })

    if (!response.ok) {
        throw new Error(`Failed to update workout section: ${response.status}`)
    }

    const payload: WorkoutDetailPayload = await response.json()
    return mapWorkoutDetailPayload(payload)
}

/**
 * Updates the metadata fields (name, author, description) of an existing
 * workout. Used by the editor's inline metadata editor on blur.
 *
 * @param workoutId the ID of the workout to update
 * @param request   the new metadata values
 * @throws Error if the workout does not exist, the user is not
 *               authorised, or the request fails
 */
export async function updateWorkoutMetadata(
    workoutId: string,
    request: UpdateWorkoutMetadataRequest,
): Promise<WorkoutDetail> {
    const response = await fetchWithAuth(`${API_BASE}/workouts/${workoutId}/metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    })

    if (!response.ok) {
        throw new Error(`Failed to update workout metadata: ${response.status}`)
    }

    const payload: WorkoutDetailPayload = await response.json()
    return mapWorkoutDetailPayload(payload)
}

/**
 * Reverts the most recent change to a single section by swapping the
 * current and previous block IDs on the backend. Pressing undo a second
 * time acts as a redo.
 *
 * @param workoutId   the ID of the workout to undo
 * @param sectionType the section to revert
 * @throws Error if the section has no previous state, the workout does
 *               not exist, or the request fails
 */
export async function undoWorkoutSection(
    workoutId: string,
    sectionType: SectionType,
): Promise<WorkoutDetail> {
    const response = await fetchWithAuth(`${API_BASE}/workouts/${workoutId}/undo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionType }),
    })

    if (!response.ok) {
        throw new Error(`Failed to undo section: ${response.status}`)
    }

    const payload: WorkoutDetailPayload = await response.json()
    return mapWorkoutDetailPayload(payload)
}

/** Maps a raw workout detail payload into the typed {@link WorkoutDetail}. */
function mapWorkoutDetailPayload(payload: WorkoutDetailPayload): WorkoutDetail {
    return {
        id: payload.id,
        name: payload.name,
        author: payload.author,
        description: payload.description,
        warmupBlock: mapBlock(payload.warmupBlock),
        mainsetBlock: mapBlock(payload.mainsetBlock),
        cooldownBlock: mapBlock(payload.cooldownBlock),
        hasPrevWarmup: payload.hasPrevWarmup,
        hasPrevMainset: payload.hasPrevMainset,
        hasPrevCooldown: payload.hasPrevCooldown,
        isDraft: payload.isDraft,
        createdAt: payload.createdAt,
        updatedAt: payload.updatedAt,
    }
}

/**
 * Maps a raw block payload into a {@link BlockDetail}, parsing the
 * JSON-encoded content string into a typed interval list.
 */
function mapBlock(block: BlockDetailPayload): BlockDetail
function mapBlock(block: BlockDetailPayload | null): BlockDetail | null
function mapBlock(block: BlockDetailPayload | null): BlockDetail | null {
    if (block === null) {
        return null
    }

    const intervals: ParsedInterval[] = block.content.trim().length > 0
        ? (JSON.parse(block.content) as ParsedInterval[])
        : []

    return {
        id: block.id,
        name: block.name,
        description: block.description,
        sectionType: block.sectionType,
        intervals,
        durationSeconds: block.durationSeconds,
        intervalCount: block.intervalCount,
        isLibraryBlock: block.isLibraryBlock,
    }
}

export async function saveWorkout(request: SaveWorkoutRequest): Promise<SaveWorkoutResponse> {
    const response = await fetchWithAuth(`${API_BASE}/workouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    })

    if (!response.ok) {
        const error: { message: string } = await response.json()
        throw new Error(error.message)
    }

    return response.json()
}
