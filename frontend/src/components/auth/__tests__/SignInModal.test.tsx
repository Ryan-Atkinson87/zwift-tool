import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignInModal } from '../SignInModal'

/** Renders the SignInModal in an open state with sensible default props. */
function renderSignInModal(
    props: Partial<React.ComponentProps<typeof SignInModal>> = {}
) {
    const defaults = {
        isOpen: true,
        onClose: vi.fn(),
        onSignIn: vi.fn().mockResolvedValue(undefined),
    }
    return render(<SignInModal {...defaults} {...props} />)
}

describe('SignInModal', () => {
    it('renders the email and password fields', () => {
        renderSignInModal()
        expect(screen.getByLabelText('Email')).toBeInTheDocument()
        expect(screen.getByLabelText('Password')).toBeInTheDocument()
    })

    it('renders the sign-in submit button', () => {
        renderSignInModal()
        expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    })

    it('renders nothing when isOpen is false', () => {
        const { container } = renderSignInModal({ isOpen: false })
        expect(container).toBeEmptyDOMElement()
    })

    it('shows a validation error when the user submits with empty fields', async () => {
        renderSignInModal()
        fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
        expect(await screen.findByText('Please enter your email and password.')).toBeInTheDocument()
    })

    it('does not call onSignIn when the form is submitted without credentials', async () => {
        const onSignIn = vi.fn()
        renderSignInModal({ onSignIn })
        fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
        expect(onSignIn).not.toHaveBeenCalled()
    })

    it('calls onSignIn with the entered email and password on valid submission', async () => {
        const user = userEvent.setup()
        const onSignIn = vi.fn().mockResolvedValue(undefined)
        renderSignInModal({ onSignIn })

        await user.type(screen.getByLabelText('Email'), 'test@example.com')
        await user.type(screen.getByLabelText('Password'), 'secret123')
        await user.click(screen.getByRole('button', { name: 'Sign in' }))

        await waitFor(() => {
            expect(onSignIn).toHaveBeenCalledWith('test@example.com', 'secret123')
        })
    })

    it('calls onClose after a successful sign-in', async () => {
        const user = userEvent.setup()
        const onClose = vi.fn()
        const onSignIn = vi.fn().mockResolvedValue(undefined)
        renderSignInModal({ onClose, onSignIn })

        await user.type(screen.getByLabelText('Email'), 'test@example.com')
        await user.type(screen.getByLabelText('Password'), 'secret123')
        await user.click(screen.getByRole('button', { name: 'Sign in' }))

        await waitFor(() => {
            expect(onClose).toHaveBeenCalledOnce()
        })
    })

    it('shows the server error message when onSignIn rejects', async () => {
        const user = userEvent.setup()
        const onSignIn = vi.fn().mockRejectedValue(new Error('Invalid email or password.'))
        renderSignInModal({ onSignIn })

        await user.type(screen.getByLabelText('Email'), 'bad@example.com')
        await user.type(screen.getByLabelText('Password'), 'wrongpassword')
        await user.click(screen.getByRole('button', { name: 'Sign in' }))

        expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument()
    })

    it('shows a generic error for non-Error rejections', async () => {
        const user = userEvent.setup()
        const onSignIn = vi.fn().mockRejectedValue('unexpected')
        renderSignInModal({ onSignIn })

        await user.type(screen.getByLabelText('Email'), 'a@b.com')
        await user.type(screen.getByLabelText('Password'), 'password')
        await user.click(screen.getByRole('button', { name: 'Sign in' }))

        expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument()
    })

    it('shows the guest warning banner when showGuestWarning is true', () => {
        renderSignInModal({ showGuestWarning: true })
        expect(screen.getByText(/Your guest workout will be lost/)).toBeInTheDocument()
    })

    it('does not show the guest warning banner by default', () => {
        renderSignInModal()
        expect(screen.queryByText(/Your guest workout will be lost/)).not.toBeInTheDocument()
    })

    it('disables the submit button while the sign-in request is in progress', async () => {
        const user = userEvent.setup()
        // Never resolves, so the button stays disabled
        const onSignIn = vi.fn().mockImplementation(() => new Promise(() => {}))
        renderSignInModal({ onSignIn })

        await user.type(screen.getByLabelText('Email'), 'test@example.com')
        await user.type(screen.getByLabelText('Password'), 'password')
        await user.click(screen.getByRole('button', { name: 'Sign in' }))

        expect(await screen.findByRole('button', { name: 'Signing in...' })).toBeDisabled()
    })
})
