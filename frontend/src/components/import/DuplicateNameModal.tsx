import { useState, type JSX } from 'react'
import { Modal } from '../ui/Modal'

interface Props {
    isOpen: boolean
    /** The name of the incoming workout that clashes with an existing saved workout. */
    incomingName: string
    /** Called when the user chooses to rename — receives the trimmed new name. */
    onRename: (newName: string) => void
    /** Called when the user chooses to replace the existing workout. Parent is responsible for the delete API call. */
    onReplace: () => Promise<void>
    /** Called when the user chooses to skip the incoming workout. */
    onCancel: () => void
}

/**
 * Modal shown when an uploaded .zwo file's name matches an existing saved workout.
 * Offers three resolutions: rename the incoming workout, replace the existing one, or skip.
 */
export function DuplicateNameModal({
    isOpen,
    incomingName,
    onRename,
    onReplace,
    onCancel,
}: Props): JSX.Element | null {
    const [newName, setNewName] = useState('')
    const [isReplacing, setIsReplacing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    function handleClose(): void {
        setNewName('')
        setError(null)
        onCancel()
    }

    function handleRename(): void {
        const trimmed = newName.trim()
        if (trimmed.length === 0) return
        setNewName('')
        setError(null)
        onRename(trimmed)
    }

    async function handleReplace(): Promise<void> {
        setIsReplacing(true)
        setError(null)
        try {
            await onReplace()
            setNewName('')
        } catch {
            setError('Failed to replace the existing workout. Please try again.')
        } finally {
            setIsReplacing(false)
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Workout name already in use">
            <div className="flex flex-col gap-4">
                <p className="text-sm text-zinc-300">
                    A workout called{' '}
                    <span className="font-medium text-white">&ldquo;{incomingName}&rdquo;</span>{' '}
                    is already saved to your account. Choose how to continue:
                </p>

                <div className="flex flex-col gap-2">
                    <label className="text-sm text-zinc-300" htmlFor="duplicate-new-name">
                        Rename incoming workout
                    </label>
                    <div className="flex gap-2">
                        <input
                            id="duplicate-new-name"
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleRename() }}
                            placeholder="Enter a new name..."
                            autoFocus
                            className={`
                                flex-1 px-3 py-2
                                bg-zinc-700 text-white text-sm
                                rounded-md border border-zinc-600
                                placeholder:text-zinc-500
                                focus:outline-none focus:border-brand-500
                            `}
                        />
                        <button
                            type="button"
                            onClick={handleRename}
                            disabled={newName.trim().length === 0}
                            className={`
                                px-4 py-2
                                bg-brand-600 text-white text-sm font-medium
                                rounded-md
                                hover:bg-brand-500 transition-colors
                                focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-800
                                disabled:opacity-50 disabled:cursor-not-allowed
                            `}
                        >
                            Rename
                        </button>
                    </div>
                </div>

                <div className="border-t border-zinc-700 pt-4 flex flex-col gap-3">
                    <button
                        type="button"
                        onClick={() => void handleReplace()}
                        disabled={isReplacing}
                        className={`
                            w-full px-4 py-2
                            bg-zinc-700 text-white text-sm font-medium
                            rounded-md
                            hover:bg-zinc-600 transition-colors
                            focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-800
                            disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                    >
                        {isReplacing ? 'Replacing...' : 'Replace existing workout'}
                    </button>

                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isReplacing}
                        className={`
                            w-full px-4 py-2
                            bg-transparent text-zinc-400 text-sm
                            rounded-md
                            hover:text-white transition-colors
                            focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-800
                            disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                    >
                        Skip this file
                    </button>
                </div>

                {error !== null && (
                    <p className="text-sm text-red-400">{error}</p>
                )}
            </div>
        </Modal>
    )
}
