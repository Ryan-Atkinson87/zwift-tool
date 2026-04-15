import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useBlocks } from '../useBlocks'
import type { LibraryBlock } from '../../api/blocks'

vi.mock('../../api/blocks', () => ({
    fetchLibraryBlocks: vi.fn(),
    deleteBlock: vi.fn(),
}))

import { fetchLibraryBlocks, deleteBlock } from '../../api/blocks'

const mockFetchLibraryBlocks = vi.mocked(fetchLibraryBlocks)
const mockDeleteBlock = vi.mocked(deleteBlock)

const MOCK_BLOCKS: LibraryBlock[] = [
    {
        id: 'block-1',
        name: 'Sweet Spot 20min',
        description: 'Classic sweetspot block',
        sectionType: 'MAINSET',
        content: '[]',
        durationSeconds: 1200,
        intervalCount: 1,
        isLibraryBlock: true,
    },
    {
        id: 'block-2',
        name: 'Easy Warm-Up',
        description: null,
        sectionType: 'WARMUP',
        content: '[]',
        durationSeconds: 600,
        intervalCount: 1,
        isLibraryBlock: true,
    },
]

beforeEach(() => {
    vi.clearAllMocks()
})

describe('useBlocks', () => {
    describe('when authenticated', () => {
        it('fetches library blocks from the API on mount', async () => {
            mockFetchLibraryBlocks.mockResolvedValue(MOCK_BLOCKS)
            const { result } = renderHook(() => useBlocks(true))

            await waitFor(() => !result.current.isLoading)
            expect(mockFetchLibraryBlocks).toHaveBeenCalledOnce()
        })

        it('populates the blocks list on successful fetch', async () => {
            mockFetchLibraryBlocks.mockResolvedValue(MOCK_BLOCKS)
            const { result } = renderHook(() => useBlocks(true))

            await waitFor(() => !result.current.isLoading)
            expect(result.current.blocks).toEqual(MOCK_BLOCKS)
            expect(result.current.error).toBeNull()
        })

        it('stores the error message when the fetch fails', async () => {
            mockFetchLibraryBlocks.mockRejectedValue(new Error('Network error'))
            const { result } = renderHook(() => useBlocks(true))

            await waitFor(() => !result.current.isLoading)
            expect(result.current.error).toBe('Failed to load library blocks.')
            expect(result.current.blocks).toEqual([])
        })
    })

    describe('when not authenticated', () => {
        it('does not call the API when isAuthenticated is false', async () => {
            const { result } = renderHook(() => useBlocks(false))
            // Give it a tick to settle
            await act(async () => {})
            expect(mockFetchLibraryBlocks).not.toHaveBeenCalled()
        })

        it('returns an empty list when not authenticated', async () => {
            const { result } = renderHook(() => useBlocks(false))
            await act(async () => {})
            expect(result.current.blocks).toEqual([])
        })
    })

    describe('deleteBlock', () => {
        it('calls the delete API with the block ID', async () => {
            mockFetchLibraryBlocks.mockResolvedValue(MOCK_BLOCKS)
            mockDeleteBlock.mockResolvedValue(undefined)
            const { result } = renderHook(() => useBlocks(true))
            await waitFor(() => !result.current.isLoading)

            await act(async () => {
                await result.current.deleteBlock('block-1')
            })

            expect(mockDeleteBlock).toHaveBeenCalledWith('block-1')
        })

        it('removes the deleted block from local state optimistically', async () => {
            mockFetchLibraryBlocks.mockResolvedValue(MOCK_BLOCKS)
            mockDeleteBlock.mockResolvedValue(undefined)
            const { result } = renderHook(() => useBlocks(true))
            await waitFor(() => !result.current.isLoading)

            await act(async () => {
                await result.current.deleteBlock('block-1')
            })

            expect(result.current.blocks).toHaveLength(1)
            expect(result.current.blocks[0].id).toBe('block-2')
        })
    })

    describe('reload', () => {
        it('re-fetches blocks from the API', async () => {
            mockFetchLibraryBlocks.mockResolvedValue(MOCK_BLOCKS)
            const { result } = renderHook(() => useBlocks(true))
            await waitFor(() => !result.current.isLoading)

            await act(async () => {
                await result.current.reload()
            })

            expect(mockFetchLibraryBlocks).toHaveBeenCalledTimes(2)
        })
    })
})
