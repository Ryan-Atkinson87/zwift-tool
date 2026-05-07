import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BlockCard } from '../BlockCard'
import type { LibraryBlock } from '../../../api/blocks'

const MOCK_BLOCK: LibraryBlock = {
    id: 'block-1',
    name: 'Threshold 3x8',
    description: 'Classic threshold intervals',
    sectionType: 'MAINSET',
    content: '[]',
    durationSeconds: 2880, // 48 minutes
    intervalCount: 3,
    isLibraryBlock: true,
}

/** Renders BlockCard with sensible default props. */
function renderBlockCard(overrides: Partial<React.ComponentProps<typeof BlockCard>> = {}) {
    const defaults = {
        block: MOCK_BLOCK,
        isSelected: false,
        onClick: vi.fn(),
    }
    return render(<BlockCard {...defaults} {...overrides} />)
}

describe('BlockCard', () => {
    it('renders the block name', () => {
        renderBlockCard()
        expect(screen.getByText('Threshold 3x8')).toBeInTheDocument()
    })

    it('renders the block description when present', () => {
        renderBlockCard()
        expect(screen.getByText('Classic threshold intervals')).toBeInTheDocument()
    })

    it('does not render the description element when description is null', () => {
        renderBlockCard({ block: { ...MOCK_BLOCK, description: null } })
        expect(screen.queryByText('Classic threshold intervals')).not.toBeInTheDocument()
    })

    it('renders the section type badge with the correct label', () => {
        renderBlockCard()
        expect(screen.getByText('Main Set')).toBeInTheDocument()
    })

    it('renders the correct section label for a Warm-Up block', () => {
        renderBlockCard({ block: { ...MOCK_BLOCK, sectionType: 'WARMUP' } })
        expect(screen.getByText('Warm-Up')).toBeInTheDocument()
    })

    it('renders the correct section label for a Cool-Down block', () => {
        renderBlockCard({ block: { ...MOCK_BLOCK, sectionType: 'COOLDOWN' } })
        expect(screen.getByText('Cool-Down')).toBeInTheDocument()
    })

    it('renders the interval count', () => {
        renderBlockCard()
        expect(screen.getByText(/3 intervals/)).toBeInTheDocument()
    })

    it('renders "interval" (singular) when the block has exactly one interval', () => {
        renderBlockCard({ block: { ...MOCK_BLOCK, intervalCount: 1 } })
        expect(screen.getByText(/1 interval/)).toBeInTheDocument()
        expect(screen.queryByText(/1 intervals/)).not.toBeInTheDocument()
    })

    it('calls onClick when the card primary button is clicked', async () => {
        const user = userEvent.setup()
        const onClick = vi.fn()
        renderBlockCard({ onClick })
        await user.click(screen.getByRole('button', { name: /select block threshold 3x8/i }))
        expect(onClick).toHaveBeenCalledOnce()
    })

    it('calls onClick when Enter is pressed on the primary button', async () => {
        const user = userEvent.setup()
        const onClick = vi.fn()
        renderBlockCard({ onClick })
        const primaryButton = screen.getByRole('button', { name: /select block threshold 3x8/i })
        primaryButton.focus()
        await user.keyboard('{Enter}')
        expect(onClick).toHaveBeenCalledOnce()
    })

    it('does not render the delete button when onDelete is not provided', () => {
        renderBlockCard()
        expect(screen.queryByLabelText('Delete block')).not.toBeInTheDocument()
    })

    it('renders the delete button when onDelete is provided', () => {
        renderBlockCard({ onDelete: vi.fn() })
        expect(screen.getByLabelText('Delete block')).toBeInTheDocument()
    })

    it('shows an inline delete confirmation when the delete button is clicked', async () => {
        const user = userEvent.setup()
        renderBlockCard({ onDelete: vi.fn() })
        await user.click(screen.getByLabelText('Delete block'))
        expect(screen.getByText('Delete this block?')).toBeInTheDocument()
    })

    it('calls onDelete when deletion is confirmed', async () => {
        const user = userEvent.setup()
        const onDelete = vi.fn()
        renderBlockCard({ onDelete })
        await user.click(screen.getByLabelText('Delete block'))
        await user.click(screen.getByRole('button', { name: 'Delete' }))
        expect(onDelete).toHaveBeenCalledOnce()
    })

    it('dismisses the confirmation when Cancel is clicked', async () => {
        const user = userEvent.setup()
        renderBlockCard({ onDelete: vi.fn() })
        await user.click(screen.getByLabelText('Delete block'))
        await user.click(screen.getByRole('button', { name: 'Cancel' }))
        expect(screen.queryByText('Delete this block?')).not.toBeInTheDocument()
    })

    it('does not render the edit button when onEdit is not provided', () => {
        renderBlockCard()
        expect(screen.queryByLabelText('Edit block')).not.toBeInTheDocument()
    })

    it('renders the edit button when onEdit is provided', () => {
        renderBlockCard({ onEdit: vi.fn() })
        expect(screen.getByLabelText('Edit block')).toBeInTheDocument()
    })

    it('calls onEdit when the edit button is clicked', async () => {
        const user = userEvent.setup()
        const onEdit = vi.fn()
        renderBlockCard({ onEdit })
        await user.click(screen.getByLabelText('Edit block'))
        expect(onEdit).toHaveBeenCalledOnce()
    })

    it('applies a selected border when isSelected is true', () => {
        const { container } = renderBlockCard({ isSelected: true })
        // The outer wrapper div carries the selection styling
        const card = container.firstElementChild!
        expect(card.className).toContain('border-brand-500')
    })
})
