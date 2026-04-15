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
})
