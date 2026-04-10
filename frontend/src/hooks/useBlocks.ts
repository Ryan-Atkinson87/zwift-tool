import { useEffect, useState } from 'react'
import { fetchLibraryBlocks, deleteBlock as deleteBlockApi, type LibraryBlock } from '../api/blocks'

/**
 * Manages the list of library blocks for the authenticated user.
 * Fetches on mount when authenticated, clears on sign-out, and exposes
 * a reload function to refresh the list after a block is saved and a
 * deleteBlock action to remove a block optimistically from local state.
 */
export function useBlocks(isAuthenticated: boolean): {
    blocks: LibraryBlock[]
    isLoading: boolean
    error: string | null
    reload: () => Promise<void>
    deleteBlock: (blockId: string) => Promise<void>
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

    async function deleteBlock(blockId: string): Promise<void> {
        await deleteBlockApi(blockId)
        // Optimistically remove the block from local state so the panel
        // updates immediately without a round-trip fetch.
        setBlocks((prev) => prev.filter((b) => b.id !== blockId))
    }

    useEffect(() => {
        if (!isAuthenticated) {
            setBlocks([])
            return
        }
        void load()
    }, [isAuthenticated])

    return { blocks, isLoading, error, reload: load, deleteBlock }
}
