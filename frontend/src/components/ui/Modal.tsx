import { useEffect, type JSX, type ReactNode } from 'react'

interface Props {
    isOpen: boolean
    onClose: () => void
    title: string
    children: ReactNode
}

/**
 * Shared modal wrapper. Renders a centred overlay with a panel containing
 * a title, close button, and the provided children. Closes on backdrop
 * click or Escape key.
 */
export function Modal({ isOpen, onClose, title, children }: Props): JSX.Element | null {
    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent): void {
            if (event.key === 'Escape') {
                onClose()
            }
        }

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown)
        }

        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    if (!isOpen) {
        return null
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={onClose}
        >
            <div
                className={`
                    flex flex-col
                    w-full max-w-md
                    mx-4 p-6
                    bg-zinc-800 text-white
                    rounded-lg
                `}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">{title}</h2>
                    <button
                        onClick={onClose}
                        className="text-zinc-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-800 rounded"
                        aria-label="Close modal"
                    >
                        &#x2715;
                    </button>
                </div>
                {children}
            </div>
        </div>
    )
}