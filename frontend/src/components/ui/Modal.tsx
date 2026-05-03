import { useEffect, useRef, type JSX, type ReactNode } from 'react'

/** Selector for all natively focusable elements inside a container. */
const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ')

interface Props {
    isOpen: boolean
    onClose: () => void
    title: string
    children: ReactNode
    /**
     * Optional id to use for the modal title element. When provided, the modal
     * container sets aria-labelledby to this value so assistive technologies
     * can announce the dialog name. If omitted, the id is derived automatically
     * from the title string.
     */
    titleId?: string
}

/**
 * Shared modal wrapper. Renders a centred overlay with a panel containing
 * a title, close button, and the provided children. Closes on backdrop
 * click or Escape key.
 *
 * Accessibility features:
 * - role="dialog" and aria-modal="true" on the panel container
 * - aria-labelledby pointing to the title heading
 * - aria-hidden="true" on the backdrop element
 * - Focus trap: Tab and Shift+Tab cycle only within the open modal
 * - Focus on open: moves focus to the first focusable element inside the panel
 * - Focus restoration on close: returns focus to the element that opened the modal
 */
export function Modal({ isOpen, onClose, title, children, titleId }: Props): JSX.Element | null {
    const panelRef = useRef<HTMLDivElement>(null)

    // Derive a stable title id from the titleId prop or the title string.
    // The title is lowercased and non-alphanumeric characters replaced with
    // hyphens so that the resulting id is always a valid HTML attribute value.
    const resolvedTitleId = titleId ?? `modal-title-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

    // Capture the element that triggered the modal so focus can be restored
    // when the modal closes. The ref is populated when isOpen becomes true.
    const triggerElementRef = useRef<Element | null>(null)

    useEffect(() => {
        if (isOpen) {
            // Record the active element before the modal steals focus so we
            // can return to it on close.
            triggerElementRef.current = document.activeElement
        }
    }, [isOpen])

    // Restore focus to the trigger element on unmount (i.e. when the modal
    // closes and this component is removed from the tree).
    useEffect(() => {
        return () => {
            const trigger = triggerElementRef.current
            if (trigger instanceof HTMLElement) {
                trigger.focus({ preventScroll: true })
            }
        }
    }, [])

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent): void {
            if (event.key === 'Escape') {
                onClose()
                return
            }

            if (event.key !== 'Tab') {
                return
            }

            const panel = panelRef.current
            if (panel === null) {
                return
            }

            const focusable = Array.from(
                panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
            )

            if (focusable.length === 0) {
                event.preventDefault()
                return
            }

            const first = focusable[0]
            const last = focusable[focusable.length - 1]

            if (event.shiftKey) {
                // Shift+Tab: if focus is on the first element, wrap to last
                if (document.activeElement === first) {
                    event.preventDefault()
                    last.focus()
                }
            } else {
                // Tab: if focus is on the last element, wrap to first
                if (document.activeElement === last) {
                    event.preventDefault()
                    first.focus()
                }
            }
        }

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown)
        }

        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    // Move focus into the modal when it opens. The panel itself receives focus
    // if no focusable child is found (tabIndex={-1} makes it programmatically
    // focusable without adding it to the natural tab order).
    useEffect(() => {
        if (!isOpen) {
            return
        }

        const panel = panelRef.current
        if (panel === null) {
            return
        }

        const firstFocusable = panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
        if (firstFocusable !== null) {
            firstFocusable.focus()
        } else {
            panel.focus()
        }
    }, [isOpen])

    if (!isOpen) {
        return null
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={onClose}
        >
            {/* Purely visual backdrop — hidden from the accessibility tree */}
            <div aria-hidden="true" className="absolute inset-0 bg-black/60" />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={resolvedTitleId}
                tabIndex={-1}
                className={`
                    relative flex flex-col
                    w-full max-w-md max-h-[90vh]
                    mx-4
                    bg-zinc-800 text-white
                    rounded-lg
                    focus:outline-none
                `}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
                    <h2 id={resolvedTitleId} className="text-xl font-semibold">{title}</h2>
                    <button
                        onClick={onClose}
                        className="min-w-11 min-h-11 flex items-center justify-center text-zinc-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-800 rounded"
                        aria-label="Close modal"
                    >
                        &#x2715;
                    </button>
                </div>
                <div className="overflow-y-auto px-6 pb-6">
                    {children}
                </div>
            </div>
        </div>
    )
}
