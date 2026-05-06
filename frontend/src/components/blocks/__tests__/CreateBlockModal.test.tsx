import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CreateBlockModal } from '../CreateBlockModal'
import type { LibraryBlock } from '../../../api/blocks'
import type { ParsedInterval } from '../../../types/workout'

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

const STEADY_STATE: ParsedInterval = {
    type: 'SteadyState',
    durationSeconds: 300,
    power: 0.75,
    powerHigh: null,
    cadence: null,
    repeat: null,
    onDuration: null,
    offDuration: null,
    onPower: null,
    offPower: null,
}

const WARMUP_INTERVAL: ParsedInterval = {
    type: 'Warmup',
    durationSeconds: 600,
    power: 0.40,
    powerHigh: 0.75,
    cadence: null,
    repeat: null,
    onDuration: null,
    offDuration: null,
    onPower: null,
    offPower: null,
}

const INTERVALS_T_INTERVAL: ParsedInterval = {
    type: 'IntervalsT',
    durationSeconds: 600,
    power: null,
    powerHigh: null,
    cadence: null,
    repeat: 4,
    onDuration: 60,
    offDuration: 90,
    onPower: 1.10,
    offPower: 0.55,
}

function makeBlock(intervals: ParsedInterval[]): LibraryBlock {
    return {
        id: 'block-1',
        name: 'Test Block',
        description: null,
        sectionType: 'MAINSET',
        content: JSON.stringify(intervals),
        durationSeconds: intervals.reduce((s, i) => s + i.durationSeconds, 0),
        intervalCount: intervals.length,
        isLibraryBlock: true,
    }
}

const BLOCK_WITH_STEADY_STATE = makeBlock([STEADY_STATE])

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

        it('shows a validation error when there are no intervals and Save is clicked', async () => {
            renderModal()
            fireEvent.change(screen.getByPlaceholderText('e.g. 2x20 Threshold'), { target: { value: 'My Block' } })
            fireEvent.click(screen.getByRole('button', { name: /save to library/i }))
            expect(await screen.findByRole('alert')).toHaveTextContent('Add at least one interval before saving.')
        })
    })

    describe('interval list', () => {
        it('renders the type label when initialBlock contains intervals', () => {
            renderModal({ initialBlock: BLOCK_WITH_STEADY_STATE })
            expect(screen.getByText('Steady State')).toBeInTheDocument()
        })

        it('shows the duration hint in minutes', () => {
            renderModal({ initialBlock: BLOCK_WITH_STEADY_STATE })
            expect(screen.getByText(/5m/)).toBeInTheDocument()
        })

        it('removes the interval when the Delete button is clicked', () => {
            renderModal({ initialBlock: BLOCK_WITH_STEADY_STATE })
            expect(screen.getByText('Steady State')).toBeInTheDocument()
            fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
            expect(screen.queryByText('Steady State')).not.toBeInTheDocument()
        })

        it('shows the empty-state placeholder when there are no intervals', () => {
            renderModal({ initialBlock: makeBlock([]) })
            expect(screen.getByText(/No intervals yet/)).toBeInTheDocument()
        })
    })

    describe('SteadyState field editing', () => {
        it('commits a valid power value on blur', () => {
            renderModal({ initialBlock: BLOCK_WITH_STEADY_STATE })
            const input = screen.getByDisplayValue('75') as HTMLInputElement
            fireEvent.change(input, { target: { value: '85' } })
            fireEvent.blur(input)
            expect(screen.getByDisplayValue('85')).toBeInTheDocument()
        })

        it('resets power to its previous value on blur with an invalid input', () => {
            renderModal({ initialBlock: BLOCK_WITH_STEADY_STATE })
            const input = screen.getByDisplayValue('75') as HTMLInputElement
            fireEvent.change(input, { target: { value: '' } })
            fireEvent.blur(input)
            expect(screen.getByDisplayValue('75')).toBeInTheDocument()
        })

        it('commits a valid duration on blur', () => {
            renderModal({ initialBlock: BLOCK_WITH_STEADY_STATE })
            const input = screen.getByDisplayValue('300') as HTMLInputElement
            fireEvent.change(input, { target: { value: '600' } })
            fireEvent.blur(input)
            expect(screen.getByDisplayValue('600')).toBeInTheDocument()
        })

        it('resets duration to its previous value on blur with an invalid input', () => {
            renderModal({ initialBlock: BLOCK_WITH_STEADY_STATE })
            const input = screen.getByDisplayValue('300') as HTMLInputElement
            fireEvent.change(input, { target: { value: '0' } })
            fireEvent.blur(input)
            expect(screen.getByDisplayValue('300')).toBeInTheDocument()
        })
    })

    describe('Warmup field editing', () => {
        it('renders start and end power fields', () => {
            renderModal({ initialBlock: makeBlock([WARMUP_INTERVAL]) })
            expect(screen.getByDisplayValue('40')).toBeInTheDocument()
            expect(screen.getByDisplayValue('75')).toBeInTheDocument()
        })

        it('commits a valid end-power value on blur', () => {
            renderModal({ initialBlock: makeBlock([WARMUP_INTERVAL]) })
            const input = screen.getByDisplayValue('75') as HTMLInputElement
            fireEvent.change(input, { target: { value: '80' } })
            fireEvent.blur(input)
            expect(screen.getByDisplayValue('80')).toBeInTheDocument()
        })

        it('resets end-power to its previous value on blur with an invalid input', () => {
            renderModal({ initialBlock: makeBlock([WARMUP_INTERVAL]) })
            const input = screen.getByDisplayValue('75') as HTMLInputElement
            fireEvent.change(input, { target: { value: '' } })
            fireEvent.blur(input)
            expect(screen.getByDisplayValue('75')).toBeInTheDocument()
        })
    })

    describe('IntervalsT field editing', () => {
        it('renders repeat, on/off duration, and on/off power fields', () => {
            renderModal({ initialBlock: makeBlock([INTERVALS_T_INTERVAL]) })
            expect(screen.getByDisplayValue('4')).toBeInTheDocument()
            expect(screen.getByDisplayValue('60')).toBeInTheDocument()
            expect(screen.getByDisplayValue('90')).toBeInTheDocument()
            expect(screen.getByDisplayValue('110')).toBeInTheDocument()
            expect(screen.getByDisplayValue('55')).toBeInTheDocument()
        })

        it('commits a valid repeat count on blur', () => {
            renderModal({ initialBlock: makeBlock([INTERVALS_T_INTERVAL]) })
            const input = screen.getByDisplayValue('4') as HTMLInputElement
            fireEvent.change(input, { target: { value: '6' } })
            fireEvent.blur(input)
            expect(screen.getByDisplayValue('6')).toBeInTheDocument()
        })

        it('resets repeat to its previous value on blur with an invalid input', () => {
            renderModal({ initialBlock: makeBlock([INTERVALS_T_INTERVAL]) })
            const input = screen.getByDisplayValue('4') as HTMLInputElement
            fireEvent.change(input, { target: { value: '0' } })
            fireEvent.blur(input)
            expect(screen.getByDisplayValue('4')).toBeInTheDocument()
        })

        it('commits a valid on-duration on blur', () => {
            renderModal({ initialBlock: makeBlock([INTERVALS_T_INTERVAL]) })
            const input = screen.getByDisplayValue('60') as HTMLInputElement
            fireEvent.change(input, { target: { value: '70' } })
            fireEvent.blur(input)
            expect(screen.getByDisplayValue('70')).toBeInTheDocument()
        })

        it('resets on-duration to its previous value on blur with an invalid input', () => {
            renderModal({ initialBlock: makeBlock([INTERVALS_T_INTERVAL]) })
            const input = screen.getByDisplayValue('60') as HTMLInputElement
            fireEvent.change(input, { target: { value: '0' } })
            fireEvent.blur(input)
            expect(screen.getByDisplayValue('60')).toBeInTheDocument()
        })

        it('commits a valid off-duration on blur', () => {
            renderModal({ initialBlock: makeBlock([INTERVALS_T_INTERVAL]) })
            const input = screen.getByDisplayValue('90') as HTMLInputElement
            fireEvent.change(input, { target: { value: '100' } })
            fireEvent.blur(input)
            expect(screen.getByDisplayValue('100')).toBeInTheDocument()
        })

        it('commits a valid on-power on blur', () => {
            renderModal({ initialBlock: makeBlock([INTERVALS_T_INTERVAL]) })
            const input = screen.getByDisplayValue('110') as HTMLInputElement
            fireEvent.change(input, { target: { value: '120' } })
            fireEvent.blur(input)
            expect(screen.getByDisplayValue('120')).toBeInTheDocument()
        })

        it('commits a valid off-power on blur', () => {
            renderModal({ initialBlock: makeBlock([INTERVALS_T_INTERVAL]) })
            const input = screen.getByDisplayValue('55') as HTMLInputElement
            fireEvent.change(input, { target: { value: '65' } })
            fireEvent.blur(input)
            expect(screen.getByDisplayValue('65')).toBeInTheDocument()
        })
    })

    describe('successful save', () => {
        it('calls onSaved after a successful edit', async () => {
            const onSaved = vi.fn()
            renderModal({ initialBlock: BLOCK_WITH_STEADY_STATE, onSaved })
            fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
            await waitFor(() => expect(onSaved).toHaveBeenCalled())
        })
    })
})
