import { useState, type JSX } from 'react'
import { Modal } from '../ui/Modal'
import type { SectionType } from '../../types/workout'

interface Props {
    isOpen: boolean
    sectionType: SectionType | null
    onClose: () => void
    /**
     * Called when the user confirms with a valid name and optional description.
     * The parent is responsible for calling the API and reloading the library.
     * Should throw on failure so the modal can display the error.
     */
    onConfirm: (name: string, description: string | null) => Promise<void>
}

const SECTION_LABELS: Record<SectionType, string> = {
    WARMUP: 'Warm-Up',
    MAINSET: 'Main Set',
    COOLDOWN: 'Cool-Down',
}

/**
 * Modal that prompts the user for a name and optional description before
 * saving the current section to their block library.
 */
export function SaveToLibraryModal({
    isOpen,
    sectionType,
    onClose,
    onConfirm,
}: Props): JSX.Element | null {
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    if (sectionType === null) {
        return null
    }

    async function handleConfirm(): Promise<void> {
        if (name.trim().length === 0) {
            setError('Name is required.')
            return
        }

        setIsSaving(true)
        setError(null)

        try {
            await onConfirm(
                name.trim(),
                description.trim().length > 0 ? description.trim() : null,
            )
            setName('')
            setDescription('')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save block.')
        } finally {
            setIsSaving(false)
        }
    }

    function handleClose(): void {
        setName('')
        setDescription('')
        setError(null)
        onClose()
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={`Save ${SECTION_LABELS[sectionType]} to Library`}
        >
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                    <label className="text-sm text-zinc-300" htmlFor="block-name">
                        Name <span className="text-red-400">*</span>
                    </label>
                    <input
                        id="block-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. 2x20 Threshold"
                        autoFocus
                        className={`
                            w-full px-3 py-2
                            bg-zinc-700 text-white
                            text-sm
                            rounded-md border border-zinc-600
                            placeholder:text-zinc-500
                            focus:outline-none focus:border-brand-500
                        `}
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-sm text-zinc-300" htmlFor="block-description">
                        Description{' '}
                        <span className="text-zinc-500">(optional)</span>
                    </label>
                    <textarea
                        id="block-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Short description of this block..."
                        rows={3}
                        className={`
                            w-full px-3 py-2
                            bg-zinc-700 text-white
                            text-sm
                            rounded-md border border-zinc-600
                            placeholder:text-zinc-500
                            focus:outline-none focus:border-brand-500
                            resize-none
                        `}
                    />
                </div>

                {error !== null && (
                    <p className="text-sm text-red-400">{error}</p>
                )}

                <div className="flex justify-end gap-3 mt-2">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isSaving}
                        className={`
                            px-4 py-2
                            bg-zinc-700 text-white
                            text-sm font-medium
                            rounded-md
                            hover:bg-zinc-600 transition-colors
                            focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-800
                            disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleConfirm()}
                        disabled={isSaving}
                        className={`
                            px-4 py-2
                            bg-brand-600 text-white
                            text-sm font-medium
                            rounded-md
                            hover:bg-brand-500 transition-colors
                            focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-800
                            disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                    >
                        {isSaving ? 'Saving...' : 'Save to library'}
                    </button>
                </div>
            </div>
        </Modal>
    )
}
