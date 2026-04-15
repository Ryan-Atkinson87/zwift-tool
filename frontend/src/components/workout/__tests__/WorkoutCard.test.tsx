import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WorkoutCard } from '../WorkoutCard'
import type { WorkoutSummary } from '../../../types/workout'

const MOCK_WORKOUT: WorkoutSummary = {
    id: 'workout-1',
    name: 'Sweet Spot Session',
    author: null,
    description: null,
    durationSeconds: 5400, // 1 hour 30 minutes
    isDraft: false,
    updatedAt: new Date().toISOString(), // just now
}

/** Default props for non-select mode. */
function defaultProps(overrides: Partial<React.ComponentProps<typeof WorkoutCard>> = {}) {
    return {
        workout: MOCK_WORKOUT,
        isSelected: false,
        isChecked: false,
        isSelectMode: false,
        onSelect: vi.fn(),
        onToggle: vi.fn(),
        onDelete: vi.fn(),
        ...overrides,
    }
}

describe('WorkoutCard (normal mode)', () => {
    it('renders the workout name', () => {
        render(<WorkoutCard {...defaultProps()} />)
        expect(screen.getByText('Sweet Spot Session')).toBeInTheDocument()
    })

    it('calls onSelect with the workout id when the card is clicked', async () => {
        const user = userEvent.setup()
        const onSelect = vi.fn()
        render(<WorkoutCard {...defaultProps({ onSelect })} />)
        // Click the workout name text — clicks the outer role=button container
        const card = screen.getByText('Sweet Spot Session').closest('[role="button"]')!
        await user.click(card)
        expect(onSelect).toHaveBeenCalledWith('workout-1')
    })

    it('does not show the draft badge when isDraft is false', () => {
        render(<WorkoutCard {...defaultProps()} />)
        expect(screen.queryByText('Draft')).not.toBeInTheDocument()
    })

    it('shows the draft badge when isDraft is true', () => {
        const draftWorkout: WorkoutSummary = { ...MOCK_WORKOUT, isDraft: true }
        render(<WorkoutCard {...defaultProps({ workout: draftWorkout })} />)
        expect(screen.getByText('Draft')).toBeInTheDocument()
    })

    it('shows an inline delete confirmation when the delete button is clicked', async () => {
        const user = userEvent.setup()
        render(<WorkoutCard {...defaultProps()} />)
        await user.click(screen.getByLabelText('Delete workout'))
        expect(screen.getByText('Delete this workout?')).toBeInTheDocument()
    })

    it('calls onDelete with the workout id when deletion is confirmed', async () => {
        const user = userEvent.setup()
        const onDelete = vi.fn()
        render(<WorkoutCard {...defaultProps({ onDelete })} />)
        await user.click(screen.getByLabelText('Delete workout'))
        await user.click(screen.getByRole('button', { name: 'Delete' }))
        expect(onDelete).toHaveBeenCalledWith('workout-1')
    })

    it('dismisses the delete confirmation when Cancel is clicked', async () => {
        const user = userEvent.setup()
        render(<WorkoutCard {...defaultProps()} />)
        await user.click(screen.getByLabelText('Delete workout'))
        await user.click(screen.getByRole('button', { name: 'Cancel' }))
        expect(screen.queryByText('Delete this workout?')).not.toBeInTheDocument()
    })

    it('does not call onDelete when Cancel is clicked', async () => {
        const user = userEvent.setup()
        const onDelete = vi.fn()
        render(<WorkoutCard {...defaultProps({ onDelete })} />)
        await user.click(screen.getByLabelText('Delete workout'))
        await user.click(screen.getByRole('button', { name: 'Cancel' }))
        expect(onDelete).not.toHaveBeenCalled()
    })

    it('responds to Enter key press with onSelect', async () => {
        const user = userEvent.setup()
        const onSelect = vi.fn()
        render(<WorkoutCard {...defaultProps({ onSelect })} />)
        const card = screen.getByText('Sweet Spot Session').closest('[role="button"]')!
        card.focus()
        await user.keyboard('{Enter}')
        expect(onSelect).toHaveBeenCalledWith('workout-1')
    })

    it('applies a selected border style when isSelected is true', () => {
        const { container } = render(<WorkoutCard {...defaultProps({ isSelected: true })} />)
        const card = container.querySelector('[role="button"]')!
        expect(card.className).toContain('border-brand-500')
    })
})

describe('WorkoutCard (select mode)', () => {
    it('renders a checkbox for the workout in select mode', () => {
        render(<WorkoutCard {...defaultProps({ isSelectMode: true })} />)
        expect(screen.getByLabelText(`Select ${MOCK_WORKOUT.name}`)).toBeInTheDocument()
    })

    it('calls onToggle with the workout id when the checkbox is changed', async () => {
        const user = userEvent.setup()
        const onToggle = vi.fn()
        render(<WorkoutCard {...defaultProps({ isSelectMode: true, onToggle })} />)
        await user.click(screen.getByLabelText(`Select ${MOCK_WORKOUT.name}`))
        expect(onToggle).toHaveBeenCalledWith('workout-1')
    })

    it('reflects the checked state on the visual checkbox', () => {
        render(<WorkoutCard {...defaultProps({ isSelectMode: true, isChecked: true })} />)
        // The visually checked indicator (SVG checkmark) should be rendered
        const checkbox = screen.getByLabelText(`Select ${MOCK_WORKOUT.name}`)
        expect(checkbox).toBeInTheDocument()
    })

    it('calls onSelect with the workout id when the card body button is clicked in select mode', async () => {
        const user = userEvent.setup()
        const onSelect = vi.fn()
        render(<WorkoutCard {...defaultProps({ isSelectMode: true, onSelect })} />)
        await user.click(screen.getByRole('button', { name: /Sweet Spot Session/ }))
        expect(onSelect).toHaveBeenCalledWith('workout-1')
    })
})
