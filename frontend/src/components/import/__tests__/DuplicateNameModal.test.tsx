import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DuplicateNameModal } from '../DuplicateNameModal'

describe('DuplicateNameModal', () => {
    const defaultProps = {
        isOpen: true,
        incomingName: 'Morning Ride',
        onRename: vi.fn(),
        onReplace: vi.fn().mockResolvedValue(undefined),
        onCancel: vi.fn(),
    }

    it('renders the clashing workout name in the modal body', () => {
        render(<DuplicateNameModal {...defaultProps} />)
        expect(screen.getByText(/Morning Ride/)).toBeInTheDocument()
    })

    it('renders the Rename, Replace, and Skip buttons', () => {
        render(<DuplicateNameModal {...defaultProps} />)
        expect(screen.getByRole('button', { name: /rename/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /replace existing/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument()
    })

    it('calls onCancel when Skip is clicked', async () => {
        const user = userEvent.setup()
        const onCancel = vi.fn()
        render(<DuplicateNameModal {...defaultProps} onCancel={onCancel} />)

        await user.click(screen.getByRole('button', { name: /skip/i }))

        expect(onCancel).toHaveBeenCalledOnce()
    })

    it('calls onReplace when Replace existing is clicked', async () => {
        const user = userEvent.setup()
        const onReplace = vi.fn().mockResolvedValue(undefined)
        render(<DuplicateNameModal {...defaultProps} onReplace={onReplace} />)

        await user.click(screen.getByRole('button', { name: /replace existing/i }))

        await waitFor(() => {
            expect(onReplace).toHaveBeenCalledOnce()
        })
    })

    it('disables Rename when the name input is empty', () => {
        render(<DuplicateNameModal {...defaultProps} />)
        expect(screen.getByRole('button', { name: /rename/i })).toBeDisabled()
    })

    it('enables Rename once a non-empty name is typed', async () => {
        const user = userEvent.setup()
        render(<DuplicateNameModal {...defaultProps} />)

        await user.type(screen.getByRole('textbox'), 'Evening Ride')

        expect(screen.getByRole('button', { name: /rename/i })).not.toBeDisabled()
    })

    it('calls onRename with the trimmed new name when Rename is confirmed', async () => {
        const user = userEvent.setup()
        const onRename = vi.fn()
        render(<DuplicateNameModal {...defaultProps} onRename={onRename} />)

        await user.type(screen.getByRole('textbox'), '  Evening Ride  ')
        await user.click(screen.getByRole('button', { name: /rename/i }))

        expect(onRename).toHaveBeenCalledWith('Evening Ride')
    })

    it('does not render when isOpen is false', () => {
        render(<DuplicateNameModal {...defaultProps} isOpen={false} />)
        expect(screen.queryByText(/Morning Ride/)).not.toBeInTheDocument()
    })
})
