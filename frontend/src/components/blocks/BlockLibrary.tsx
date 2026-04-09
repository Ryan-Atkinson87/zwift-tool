import type { JSX } from 'react'
import type { LibraryBlock } from '../../api/blocks'
import { BlockCard } from './BlockCard'

interface Props {
    blocks: LibraryBlock[]
    isLoading: boolean
    error: string | null
}

/**
 * Renders the user's block library as a scrollable list of BlockCard
 * components. Displays loading, error, and empty states.
 */
export function BlockLibrary({ blocks, isLoading, error }: Props): JSX.Element {
    if (isLoading) {
        return (
            <div className="w-full max-w-4xl px-4 py-4 bg-zinc-800/40 border border-zinc-700 rounded-lg">
                <p className="text-sm text-zinc-400">Loading library...</p>
            </div>
        )
    }

    if (error !== null) {
        return (
            <div className="w-full max-w-4xl px-4 py-4 bg-red-900/30 border border-red-800 rounded-lg">
                <p className="text-sm text-red-300">{error}</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col w-full max-w-4xl gap-2">
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
                Block Library
            </h2>
            {blocks.length === 0 ? (
                <div className="px-4 py-4 bg-zinc-800/40 border border-zinc-700 rounded-lg text-center">
                    <p className="text-sm text-zinc-500">
                        No saved blocks yet. Use "Save to library" on any section to add one.
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {blocks.map((block) => (
                        <BlockCard key={block.id} block={block} />
                    ))}
                </div>
            )}
        </div>
    )
}
