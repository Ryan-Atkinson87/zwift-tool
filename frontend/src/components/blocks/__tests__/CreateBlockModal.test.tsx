import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CreateBlockModal } from '../CreateBlockModal'

// BlockPreview renders a complex canvas with drag-and-drop — mock it to keep
// these tests focused on the modal shell (a11y, focus trap, Escape).
vi.mock('../BlockPreview', () => ({
    BlockPreview: () => <div data-testid="block-preview" />,
}))

// API calls are async side-effects not under test here.
vi.mock('../../../api/blocks', () => ({
    saveBlock: vi.fn(),
    updateBlock: vi.fn(),
}))

/** Renders CreateBlockModal with sensible defaults. */
function renderModal(overrides: Partial<React.ComponentProps<typeof CreateBlockModal>> = {}) {
    const defaults = {
        isOpen: true,
        onClose: vi.fn(),
        onSaved: vi.fn(),
    }
    return render(<CreateBlockModal {...defaults} {...overrides} />)
}

describe('CreateBlockModal', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders nothing when isOpen is false', () => {
        const { container } = renderModal({ isOpen: false })
        expect(container).toBeEmptyDOMElement()
    })

    it('renders the create title when no initialBlock is supplied', () => {
        renderModal()
        expect(screen.getByText('Create library block')).toBeInTheDocument()
    })

    it('renders the edit title when initialBlock is supplied', () => {
        renderModal({
            initialBlock: {
                id: 'block-1',
                name: 'Test Block',
                description: null,
                sectionType: 'MAINSET',
                content: '[]',
                durationSeconds: 0,
                intervalCount: 0,
                isLibraryBlock: true,
            },
        })
        expect(screen.getByText('Edit library block')).toBeInTheDocument()
    })

    describe('ARIA attributes (inherited from shared Modal)', () => {
        it('sets role="dialog" on the panel', () => {
            renderModal()
            expect(screen.getByRole('dialog')).toBeInTheDocument()
        })

        it('sets aria-modal="true" on the panel', () => {
            renderModal()
            expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
        })

        it('sets aria-labelledby pointing to the title heading', () => {
            renderModal()
            const dialog = screen.getByRole('dialog')
            const labelledById = dialog.getAttribute('aria-labelledby')
            expect(labelledById).toBeTruthy()
            const titleEl = document.getElementById(labelledById!)
            expect(titleEl).not.toBeNull()
            expect(titleEl?.textContent).toBe('Create library block')
        })

        it('sets aria-hidden="true" on the backdrop', () => {
            const { container } = renderModal()
            const backdrop = container.querySelector('[aria-hidden="true"]')
            expect(backdrop).not.toBeNull()
        })
    })

    describe('Escape key', () => {
        it('calls onClose when Escape is pressed', () => {
            const onClose = vi.fn()
            renderModal({ onClose })
            fireEvent.keyDown(document, { key: 'Escape' })
            expect(onClose).toHaveBeenCalledOnce()
        })
    })

    describe('close button', () => {
        it('calls onClose when the close button is clicked', () => {
            const onClose = vi.fn()
            renderModal({ onClose })
            fireEvent.click(screen.getByLabelText('Close modal'))
            expect(onClose).toHaveBeenCalledOnce()
        })
    })

    describe('focus trap', () => {
        it('wraps Tab from the last focusable element back to the first', () => {
            renderModal()
            const focusable = Array.from(
                screen.getByRole('dialog').querySelectorAll<HTMLElement>(
                    'button:not([disabled]), input:not([disabled]), textarea:not([disabled])',
                ),
            )
            expect(focusable.length).toBeGreaterThan(1)

            const lastEl = focusable[focusable.length - 1]
            lastEl.focus()
            expect(document.activeElement).toBe(lastEl)

            fireEvent.keyDown(document, { key: 'Tab', shiftKey: false })
            // Focus should wrap to the first focusable element (the Modal close button)
            expect(document.activeElement).toBe(focusable[0])
        })

        it('wraps Shift+Tab from the first focusable element back to the last', () => {
            renderModal()
            const focusable = Array.from(
                screen.getByRole('dialog').querySelectorAll<HTMLElement>(
                    'button:not([disabled]), input:not([disabled]), textarea:not([disabled])',
                ),
            )
            expect(focusable.length).toBeGreaterThan(1)

            focusable[0].focus()
            expect(document.activeElement).toBe(focusable[0])

            fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
            const lastEl = focusable[focusable.length - 1]
            expect(document.activeElement).toBe(lastEl)
        })
    })

    describe('form validation', () => {
        it('shows a validation error when the name is empty and Save is clicked', async () => {
            renderModal()
            fireEvent.click(screen.getByRole('button', { name: /save to library/i }))
            expect(await screen.findByRole('alert')).toHaveTextContent('Name is required.')
        })
    })
})
