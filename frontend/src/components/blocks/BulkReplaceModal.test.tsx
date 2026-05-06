import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { BulkReplaceModal } from './BulkReplaceModal'
import type { LibraryBlock } from '../../api/blocks'
import type { WorkoutSummary } from '../../types/workout'

const WARMUP_BLOCK: LibraryBlock = {
    id: 'block-1',
    name: 'Easy Spin',
    description: null,
    sectionType: 'WARMUP',
    content: '[]',
    durationSeconds: 600,
    intervalCount: 1,
    isLibraryBlock: true,
}

const WORKOUT_SUMMARY: WorkoutSummary = {
    id: 'workout-1',
    name: 'Tuesday Ride',
    author: null,
    description: null,
    durationSeconds: 3600,
    isDraft: false,
    updatedAt: '2024-01-01T00:00:00Z',
}

const DEFAULT_PROPS = {
    isOpen: true,
    selectedWorkoutIds: ['workout-1'],
    workouts: [WORKOUT_SUMMARY],
    blocks: [WARMUP_BLOCK],
    isBulkReplacing: false,
    error: null,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
}

describe('BulkReplaceModal — aria-pressed on block selection', () => {
    it('renders the block card button with aria-pressed="false" when not selected', () => {
        render(<BulkReplaceModal {...DEFAULT_PROPS} />)

        // The WARMUP section is active by default. "Easy Spin" should be visible.
        const button = screen.getByRole('button', { name: /select block easy spin/i })
        expect(button).toHaveAttribute('aria-pressed', 'false')
    })

    it('sets aria-pressed="true" on the block card button after the user selects it', async () => {
        const user = userEvent.setup()
        render(<BulkReplaceModal {...DEFAULT_PROPS} />)

        const button = screen.getByRole('button', { name: /select block easy spin/i })

        // Before selection: not pressed
        expect(button).toHaveAttribute('aria-pressed', 'false')

        await user.click(button)

        // After selection: announced as pressed to assistive technology
        expect(button).toHaveAttribute('aria-pressed', 'true')
    })
})
