import { useEffect, useState } from 'react'
import { fetchLibraryBlocks, type LibraryBlock } from '../api/blocks'

/**
 * Manages the list of library blocks for the authenticated user.
 * Fetches on mount when authenticated, clears on sign-out, and exposes
 * a reload function to refresh the list after a block is saved.
 */
export function useBlocks(isAuthenticated: boolean): {
    blocks: LibraryBlock[]
    isLoading: boolean
    error: string | null
    reload: () => Promise<void>
} {
    const [blocks, setBlocks] = useState<LibraryBlock[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function load(): Promise<void> {
        setIsLoading(true)
        setError(null)
        try {
            const fetched = await fetchLibraryBlocks()
            setBlocks(fetched)
        } catch {
            setError('Failed to load library blocks.')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (!isAuthenticated) {
            setBlocks([])
            return
        }
        void load()
    }, [isAuthenticated])

    return { blocks, isLoading, error, reload: load }
}
