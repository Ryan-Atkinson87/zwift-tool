import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Modal } from '../Modal'

describe('Modal', () => {
    it('renders nothing when isOpen is false', () => {
        const { container } = render(
            <Modal isOpen={false} onClose={vi.fn()} title="Test Modal">
                <p>Content</p>
            </Modal>
        )
        expect(container).toBeEmptyDOMElement()
    })

    it('renders the title and children when isOpen is true', () => {
        render(
            <Modal isOpen onClose={vi.fn()} title="My Modal">
                <p>Modal content here</p>
            </Modal>
        )
        expect(screen.getByText('My Modal')).toBeInTheDocument()
        expect(screen.getByText('Modal content here')).toBeInTheDocument()
    })

    it('calls onClose when the close button is clicked', () => {
        const onClose = vi.fn()
        render(
            <Modal isOpen onClose={onClose} title="Test">
                <p>Content</p>
            </Modal>
        )
        fireEvent.click(screen.getByLabelText('Close modal'))
        expect(onClose).toHaveBeenCalledOnce()
    })

    it('calls onClose when the backdrop overlay is clicked', () => {
        const onClose = vi.fn()
        const { container } = render(
            <Modal isOpen onClose={onClose} title="Test">
                <p>Content</p>
            </Modal>
        )
        // The outermost fixed overlay is the backdrop
        const backdrop = container.firstChild as HTMLElement
        fireEvent.click(backdrop)
        expect(onClose).toHaveBeenCalledOnce()
    })

    it('does not call onClose when the panel itself is clicked', () => {
        const onClose = vi.fn()
        render(
            <Modal isOpen onClose={onClose} title="Panel Click Test">
                <p>Inside panel</p>
            </Modal>
        )
        fireEvent.click(screen.getByText('Inside panel'))
        expect(onClose).not.toHaveBeenCalled()
    })

    it('calls onClose when the Escape key is pressed', () => {
        const onClose = vi.fn()
        render(
            <Modal isOpen onClose={onClose} title="Test">
                <p>Content</p>
            </Modal>
        )
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(onClose).toHaveBeenCalledOnce()
    })

    it('does not call onClose for other key presses', () => {
        const onClose = vi.fn()
        render(
            <Modal isOpen onClose={onClose} title="Test">
                <p>Content</p>
            </Modal>
        )
        fireEvent.keyDown(document, { key: 'Enter' })
        expect(onClose).not.toHaveBeenCalled()
    })

    it('removes the keydown listener when the modal is closed', () => {
        const onClose = vi.fn()
        const { rerender } = render(
            <Modal isOpen onClose={onClose} title="Test">
                <p>Content</p>
            </Modal>
        )
        rerender(
            <Modal isOpen={false} onClose={onClose} title="Test">
                <p>Content</p>
            </Modal>
        )
        // Escape should no longer trigger onClose after the modal closes
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(onClose).not.toHaveBeenCalled()
    })

    describe('ARIA attributes', () => {
        it('sets role="dialog" and aria-modal="true" on the panel', () => {
            render(
                <Modal isOpen onClose={vi.fn()} title="ARIA Test">
                    <p>Content</p>
                </Modal>
            )
            const dialog = screen.getByRole('dialog')
            expect(dialog).toBeInTheDocument()
            expect(dialog).toHaveAttribute('aria-modal', 'true')
        })

        it('sets aria-labelledby on the dialog pointing to the title heading', () => {
            render(
                <Modal isOpen onClose={vi.fn()} title="My Titled Modal">
                    <p>Content</p>
                </Modal>
            )
            const dialog = screen.getByRole('dialog')
            const labelledById = dialog.getAttribute('aria-labelledby')
            expect(labelledById).toBeTruthy()
            const titleEl = document.getElementById(labelledById!)
            expect(titleEl).not.toBeNull()
            expect(titleEl?.textContent).toBe('My Titled Modal')
        })

        it('uses the provided titleId prop for aria-labelledby', () => {
            render(
                <Modal isOpen onClose={vi.fn()} title="Custom ID Modal" titleId="my-custom-title">
                    <p>Content</p>
                </Modal>
            )
            const dialog = screen.getByRole('dialog')
            expect(dialog).toHaveAttribute('aria-labelledby', 'my-custom-title')
            expect(document.getElementById('my-custom-title')?.textContent).toBe('Custom ID Modal')
        })

        it('sets aria-hidden="true" on the backdrop overlay', () => {
            const { container } = render(
                <Modal isOpen onClose={vi.fn()} title="Test">
                    <p>Content</p>
                </Modal>
            )
            // The backdrop is an absolute-positioned div inside the outer wrapper,
            // separate from (and before) the dialog panel.
            const backdrop = container.querySelector('[aria-hidden="true"]') as HTMLElement
            expect(backdrop).not.toBeNull()
            expect(backdrop).toHaveAttribute('aria-hidden', 'true')
        })
    })

    describe('focus trap', () => {
        it('wraps Tab from the last focusable element back to the first', () => {
            render(
                <Modal isOpen onClose={vi.fn()} title="Trap Test">
                    <button>First</button>
                    <button>Second</button>
                </Modal>
            )
            const buttons = screen.getAllByRole('button')
            // The close button rendered by Modal is the first focusable element;
            // "Second" is the last.
            const lastButton = buttons[buttons.length - 1]
            lastButton.focus()
            expect(document.activeElement).toBe(lastButton)

            fireEvent.keyDown(document, { key: 'Tab', shiftKey: false })
            // After wrapping, focus should be on the first focusable element
            expect(document.activeElement).toBe(buttons[0])
        })

        it('wraps Shift+Tab from the first focusable element back to the last', () => {
            render(
                <Modal isOpen onClose={vi.fn()} title="Trap Test">
                    <button>First</button>
                    <button>Second</button>
                </Modal>
            )
            const buttons = screen.getAllByRole('button')
            // Focus the first button (the close button rendered by Modal)
            buttons[0].focus()
            expect(document.activeElement).toBe(buttons[0])

            fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
            // After wrapping, focus should move to the last focusable element
            const lastButton = buttons[buttons.length - 1]
            expect(document.activeElement).toBe(lastButton)
        })
    })

    describe('focus restoration', () => {
        it('restores focus to the trigger element when the modal unmounts', () => {
            const trigger = document.createElement('button')
            document.body.appendChild(trigger)
            trigger.focus()
            expect(document.activeElement).toBe(trigger)

            const { unmount } = render(
                <Modal isOpen onClose={vi.fn()} title="Restore Test">
                    <p>Content</p>
                </Modal>
            )

            // Unmounting simulates the modal closing
            unmount()
            expect(document.activeElement).toBe(trigger)

            document.body.removeChild(trigger)
        })
    })
})
