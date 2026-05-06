import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SignInModal } from './SignInModal.tsx'

/**
 * Tests for SignInModal focusing on ARIA accessibility associations
 * between inputs and their error messages (WCAG 3.3.1, 1.3.1).
 */

const noop = (): void => {}
const noopAsync = (): Promise<void> => Promise.resolve()

function renderSignInModal(onSignIn = noopAsync): void {
    render(
        <SignInModal
            isOpen={true}
            onClose={noop}
            onSignIn={onSignIn}
        />,
    )
}

describe('SignInModal', () => {
    describe('initial state — no error', () => {
        it('email input has no aria-invalid initially', () => {
            renderSignInModal()
            const emailInput = screen.getByRole('textbox', { name: /email/i })
            expect(emailInput).not.toHaveAttribute('aria-invalid')
        })

        it('password input has no aria-invalid initially', () => {
            renderSignInModal()
            // password inputs have no implicit role — query by label text
            const passwordInput = screen.getByLabelText(/password/i)
            expect(passwordInput).not.toHaveAttribute('aria-invalid')
        })

        it('email input has no aria-describedby initially', () => {
            renderSignInModal()
            const emailInput = screen.getByRole('textbox', { name: /email/i })
            expect(emailInput).not.toHaveAttribute('aria-describedby')
        })

        it('password input has no aria-describedby initially', () => {
            renderSignInModal()
            const passwordInput = screen.getByLabelText(/password/i)
            expect(passwordInput).not.toHaveAttribute('aria-describedby')
        })
    })

    describe('after submitting with empty fields', () => {
        async function submitEmptyForm(): Promise<void> {
            renderSignInModal()
            fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
            await waitFor(() => {
                expect(screen.getByRole('alert')).toBeInTheDocument()
            })
        }

        it('shows an error alert', async () => {
            await submitEmptyForm()
            expect(screen.getByRole('alert')).toHaveTextContent(/please enter your email and password/i)
        })

        it('error element has id "signin-form-error"', async () => {
            await submitEmptyForm()
            expect(document.getElementById('signin-form-error')).toBeInTheDocument()
        })

        it('email input has no aria-invalid after empty-fields error', async () => {
            await submitEmptyForm()
            const emailInput = screen.getByRole('textbox', { name: /email/i })
            expect(emailInput).not.toHaveAttribute('aria-invalid')
        })

        it('password input has no aria-invalid after empty-fields error', async () => {
            await submitEmptyForm()
            const passwordInput = screen.getByLabelText(/password/i)
            expect(passwordInput).not.toHaveAttribute('aria-invalid')
        })

        it('email input aria-describedby points to the error element', async () => {
            await submitEmptyForm()
            const emailInput = screen.getByRole('textbox', { name: /email/i })
            expect(emailInput).toHaveAttribute('aria-describedby', 'signin-form-error')
        })

        it('password input aria-describedby points to the error element', async () => {
            await submitEmptyForm()
            const passwordInput = screen.getByLabelText(/password/i)
            expect(passwordInput).toHaveAttribute('aria-describedby', 'signin-form-error')
        })
    })

    describe('after a failed sign-in attempt', () => {
        async function submitWithFailure(): Promise<void> {
            const onSignIn = (): Promise<void> => Promise.reject(new Error('Invalid credentials.'))
            renderSignInModal(onSignIn)

            fireEvent.change(screen.getByRole('textbox', { name: /email/i }), {
                target: { value: 'user@example.com' },
            })
            fireEvent.change(screen.getByLabelText(/password/i), {
                target: { value: 'password123' },
            })
            fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

            await waitFor(() => {
                expect(screen.getByRole('alert')).toBeInTheDocument()
            })
        }

        it('shows the server error in the alert', async () => {
            await submitWithFailure()
            expect(screen.getByRole('alert')).toHaveTextContent(/invalid credentials/i)
        })

        it('email input has no aria-invalid after server error', async () => {
            await submitWithFailure()
            const emailInput = screen.getByRole('textbox', { name: /email/i })
            expect(emailInput).not.toHaveAttribute('aria-invalid')
        })

        it('email input aria-describedby is set after server error', async () => {
            await submitWithFailure()
            const emailInput = screen.getByRole('textbox', { name: /email/i })
            expect(emailInput).toHaveAttribute('aria-describedby', 'signin-form-error')
        })
    })
})
