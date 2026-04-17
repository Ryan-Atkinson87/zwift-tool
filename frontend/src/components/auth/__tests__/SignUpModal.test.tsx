import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignUpModal } from '../SignUpModal'

/** Renders the SignUpModal in an open state with sensible default props. */
function renderSignUpModal(
    props: Partial<React.ComponentProps<typeof SignUpModal>> = {}
) {
    const defaults = {
        isOpen: true,
        onClose: vi.fn(),
        onSignUp: vi.fn().mockResolvedValue(undefined),
    }
    return render(<SignUpModal {...defaults} {...props} />)
}

describe('SignUpModal', () => {
    it('renders the email and password fields', () => {
        renderSignUpModal()
        expect(screen.getByLabelText('Email')).toBeInTheDocument()
        expect(screen.getByLabelText('Password')).toBeInTheDocument()
    })

    it('renders the sign-up submit button', () => {
        renderSignUpModal()
        expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument()
    })

    it('renders nothing when isOpen is false', () => {
        const { container } = renderSignUpModal({ isOpen: false })
        expect(container).toBeEmptyDOMElement()
    })

    it('shows an email validation error when the email is empty on submit', async () => {
        const user = userEvent.setup()
        renderSignUpModal()

        await user.click(screen.getByRole('button', { name: 'Sign up' }))

        expect(await screen.findByText('Email is required.')).toBeInTheDocument()
    })

    it('shows an email format error when the email is not a valid address', async () => {
        const user = userEvent.setup()
        renderSignUpModal()

        await user.type(screen.getByLabelText('Email'), 'not-an-email')
        await user.click(screen.getByRole('button', { name: 'Sign up' }))

        expect(await screen.findByText('Please enter a valid email address.')).toBeInTheDocument()
    })

    it('shows a password required error when the password is empty', async () => {
        const user = userEvent.setup()
        renderSignUpModal()

        await user.type(screen.getByLabelText('Email'), 'test@example.com')
        await user.click(screen.getByRole('button', { name: 'Sign up' }))

        expect(await screen.findByText('Password is required.')).toBeInTheDocument()
    })

    it('shows a minimum length error when the password is shorter than eight characters', async () => {
        const user = userEvent.setup()
        renderSignUpModal()

        await user.type(screen.getByLabelText('Email'), 'test@example.com')
        await user.type(screen.getByLabelText('Password'), 'short')
        await user.click(screen.getByRole('button', { name: 'Sign up' }))

        expect(await screen.findByText('Password must be at least 8 characters.')).toBeInTheDocument()
    })

    it('does not call onSignUp when validation fails', async () => {
        const user = userEvent.setup()
        const onSignUp = vi.fn()
        renderSignUpModal({ onSignUp })

        await user.click(screen.getByRole('button', { name: 'Sign up' }))

        expect(onSignUp).not.toHaveBeenCalled()
    })

    it('calls onSignUp with the entered email and password on valid submission', async () => {
        const user = userEvent.setup()
        const onSignUp = vi.fn().mockResolvedValue(undefined)
        renderSignUpModal({ onSignUp })

        await user.type(screen.getByLabelText('Email'), 'new@example.com')
        await user.type(screen.getByLabelText('Password'), 'securepassword')
        await user.click(screen.getByRole('button', { name: 'Sign up' }))

        await waitFor(() => {
            expect(onSignUp).toHaveBeenCalledWith('new@example.com', 'securepassword')
        })
    })

    it('calls onClose after a successful sign-up', async () => {
        const user = userEvent.setup()
        const onClose = vi.fn()
        const onSignUp = vi.fn().mockResolvedValue(undefined)
        renderSignUpModal({ onClose, onSignUp })

        await user.type(screen.getByLabelText('Email'), 'new@example.com')
        await user.type(screen.getByLabelText('Password'), 'securepassword')
        await user.click(screen.getByRole('button', { name: 'Sign up' }))

        await waitFor(() => {
            expect(onClose).toHaveBeenCalledOnce()
        })
    })

    it('shows the server error message when onSignUp rejects', async () => {
        const user = userEvent.setup()
        const onSignUp = vi.fn().mockRejectedValue(new Error('Email already in use.'))
        renderSignUpModal({ onSignUp })

        await user.type(screen.getByLabelText('Email'), 'existing@example.com')
        await user.type(screen.getByLabelText('Password'), 'securepassword')
        await user.click(screen.getByRole('button', { name: 'Sign up' }))

        expect(await screen.findByText('Email already in use.')).toBeInTheDocument()
    })

    it('shows the guest warning banner when showGuestWarning is true', () => {
        renderSignUpModal({ showGuestWarning: true })
        expect(screen.getByText(/Your guest workout will be lost/)).toBeInTheDocument()
    })

    it('disables the submit button while the sign-up request is in progress', async () => {
        const user = userEvent.setup()
        const onSignUp = vi.fn().mockImplementation(() => new Promise(() => {}))
        renderSignUpModal({ onSignUp })

        await user.type(screen.getByLabelText('Email'), 'test@example.com')
        await user.type(screen.getByLabelText('Password'), 'securepassword')
        await user.click(screen.getByRole('button', { name: 'Sign up' }))

        expect(await screen.findByRole('button', { name: 'Creating account...' })).toBeDisabled()
    })
})
