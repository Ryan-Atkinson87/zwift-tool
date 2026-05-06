import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SignUpModal } from './SignUpModal.tsx'

/**
 * Tests for SignUpModal focusing on ARIA accessibility associations
 * between inputs and their field-level error messages (WCAG 3.3.1, 1.3.1).
 */

const noop = (): void => {}
const noopAsync = (): Promise<void> => Promise.resolve()

function renderSignUpModal(onSignUp = noopAsync): void {
    render(
        <SignUpModal
            isOpen={true}
            onClose={noop}
            onSignUp={onSignUp}
        />,
    )
}

describe('SignUpModal', () => {
    describe('initial state — no errors', () => {
        it('email input is not marked invalid initially', () => {
            renderSignUpModal()
            const emailInput = screen.getByRole('textbox', { name: /email/i })
            expect(emailInput).toHaveAttribute('aria-invalid', 'false')
        })

        it('password input is not marked invalid initially', () => {
            renderSignUpModal()
            const passwordInput = screen.getByLabelText(/password/i)
            expect(passwordInput).toHaveAttribute('aria-invalid', 'false')
        })

        it('email input has no aria-describedby initially', () => {
            renderSignUpModal()
            const emailInput = screen.getByRole('textbox', { name: /email/i })
            expect(emailInput).not.toHaveAttribute('aria-describedby')
        })

        it('password input has no aria-describedby initially', () => {
            renderSignUpModal()
            const passwordInput = screen.getByLabelText(/password/i)
            expect(passwordInput).not.toHaveAttribute('aria-describedby')
        })
    })

    describe('after submitting with empty fields', () => {
        async function submitEmptyForm(): Promise<void> {
            renderSignUpModal()
            fireEvent.click(screen.getByRole('button', { name: /sign up/i }))
            await waitFor(() => {
                expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
            })
        }

        it('shows email required error', async () => {
            await submitEmptyForm()
            expect(document.getElementById('signup-email-error')).toHaveTextContent(/email is required/i)
        })

        it('shows password required error', async () => {
            await submitEmptyForm()
            expect(document.getElementById('signup-password-error')).toHaveTextContent(/password is required/i)
        })

        it('email input is aria-invalid="true" when emailError is set', async () => {
            await submitEmptyForm()
            const emailInput = screen.getByRole('textbox', { name: /email/i })
            expect(emailInput).toHaveAttribute('aria-invalid', 'true')
        })

        it('password input is aria-invalid="true" when passwordError is set', async () => {
            await submitEmptyForm()
            const passwordInput = screen.getByLabelText(/password/i)
            expect(passwordInput).toHaveAttribute('aria-invalid', 'true')
        })

        it('email input aria-describedby points to signup-email-error', async () => {
            await submitEmptyForm()
            const emailInput = screen.getByRole('textbox', { name: /email/i })
            expect(emailInput).toHaveAttribute('aria-describedby', 'signup-email-error')
        })

        it('password input aria-describedby points to signup-password-error', async () => {
            await submitEmptyForm()
            const passwordInput = screen.getByLabelText(/password/i)
            expect(passwordInput).toHaveAttribute('aria-describedby', 'signup-password-error')
        })
    })

    describe('after submitting an invalid email format', () => {
        async function submitInvalidEmail(): Promise<void> {
            renderSignUpModal()
            fireEvent.change(screen.getByRole('textbox', { name: /email/i }), {
                target: { value: 'not-an-email' },
            })
            fireEvent.change(screen.getByLabelText(/password/i), {
                target: { value: 'validpassword123' },
            })
            fireEvent.click(screen.getByRole('button', { name: /sign up/i }))
            await waitFor(() => {
                expect(document.getElementById('signup-email-error')).toBeInTheDocument()
            })
        }

        it('email error element id is signup-email-error', async () => {
            await submitInvalidEmail()
            expect(document.getElementById('signup-email-error')).toHaveTextContent(/valid email/i)
        })

        it('email input aria-invalid is true', async () => {
            await submitInvalidEmail()
            const emailInput = screen.getByRole('textbox', { name: /email/i })
            expect(emailInput).toHaveAttribute('aria-invalid', 'true')
        })

        it('email input aria-describedby is signup-email-error', async () => {
            await submitInvalidEmail()
            const emailInput = screen.getByRole('textbox', { name: /email/i })
            expect(emailInput).toHaveAttribute('aria-describedby', 'signup-email-error')
        })

        it('password input is not marked invalid when only email has an error', async () => {
            await submitInvalidEmail()
            const passwordInput = screen.getByLabelText(/password/i)
            expect(passwordInput).toHaveAttribute('aria-invalid', 'false')
        })
    })

    describe('after a failed server-side sign-up', () => {
        async function submitWithServerError(): Promise<void> {
            const onSignUp = (): Promise<void> =>
                Promise.reject(new Error('An account with that email already exists.'))
            renderSignUpModal(onSignUp)

            fireEvent.change(screen.getByRole('textbox', { name: /email/i }), {
                target: { value: 'user@example.com' },
            })
            fireEvent.change(screen.getByLabelText(/password/i), {
                target: { value: 'validpassword123' },
            })
            fireEvent.click(screen.getByRole('button', { name: /sign up/i }))
            await waitFor(() => {
                expect(document.getElementById('signup-server-error')).toBeInTheDocument()
            })
        }

        it('server error element has id "signup-server-error"', async () => {
            await submitWithServerError()
            expect(document.getElementById('signup-server-error')).toHaveTextContent(/already exists/i)
        })

        it('server error element has role="alert"', async () => {
            await submitWithServerError()
            const serverError = document.getElementById('signup-server-error')
            expect(serverError).toHaveAttribute('role', 'alert')
        })

        it('email input is not aria-invalid after a server error (field was valid)', async () => {
            await submitWithServerError()
            const emailInput = screen.getByRole('textbox', { name: /email/i })
            expect(emailInput).toHaveAttribute('aria-invalid', 'false')
        })
    })
})
