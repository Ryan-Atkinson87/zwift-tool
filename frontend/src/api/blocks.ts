import { fetchWithAuth } from './client'
import type { SectionType } from '../types/workout'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

/** A single library block as returned by GET /blocks or POST /blocks. */
export interface LibraryBlock {
    id: string
    name: string
    description: string | null
    sectionType: SectionType
    content: string
    durationSeconds: number
    intervalCount: number
    isLibraryBlock: boolean
}

/** Request body for saving a section to the block library. */
export interface SaveBlockRequest {
    name: string
    description: string | null
    sectionType: SectionType
    content: string
    durationSeconds: number
    intervalCount: number
}

/**
 * Saves a workout section as a library block.
 *
 * @param request the block data including name, description, section type, and content
 * @returns the saved block record
 * @throws Error if the request fails or validation rejects the payload
 */
export async function saveBlock(request: SaveBlockRequest): Promise<LibraryBlock> {
    const response = await fetchWithAuth(`${API_BASE}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    })

    if (!response.ok) {
        const error: { message: string } = await response.json()
        throw new Error(error.message ?? `Failed to save block: ${response.status}`)
    }

    return response.json()
}

/**
 * Fetches all library blocks for the authenticated user, ordered by most
 * recently created first.
 *
 * @returns the list of library blocks, empty if the user has none
 * @throws Error if the request fails
 */
export async function fetchLibraryBlocks(): Promise<LibraryBlock[]> {
    const response = await fetchWithAuth(`${API_BASE}/blocks`, {
        method: 'GET',
    })

    if (response.status === 204) {
        return []
    }

    if (!response.ok) {
        throw new Error(`Failed to load library blocks: ${response.status}`)
    }

    return response.json()
}
