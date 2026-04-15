import { useState, type FormEvent, type JSX } from 'react'
import { Modal } from '../ui/Modal.tsx'

interface Props {
    isOpen: boolean
    onClose: () => void
    onSignUp: (email: string, password: string) => Promise<void>
    /** When true, shows a warning that the active guest workout will be lost on sign-up. */
    showGuestWarning?: boolean
}

/** Regex for basic email format validation. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Sign-up modal with email and password fields. Validates inline before
 * submission: email format and password minimum length. Displays server
 * errors (e.g. duplicate email) beneath the form.
 *
 * When showGuestWarning is true, a banner is shown warning the user that
 * their guest workout will be lost and they should export it first.
 */
export function SignUpModal({ isOpen, onClose, onSignUp, showGuestWarning = false }: Props): JSX.Element {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [emailError, setEmailError] = useState<string | null>(null)
    const [passwordError, setPasswordError] = useState<string | null>(null)
    const [serverError, setServerError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    function validateEmail(value: string): string | null {
        if (!value.trim()) {
            return 'Email is required.'
        }
        if (!EMAIL_PATTERN.test(value)) {
            return 'Please enter a valid email address.'
        }
        return null
    }

    function validatePassword(value: string): string | null {
        if (!value) {
            return 'Password is required.'
        }
        if (value.length < 8) {
            return 'Password must be at least 8 characters.'
        }
        return null
    }

    async function handleSubmit(event: FormEvent): Promise<void> {
        event.preventDefault()
        setServerError(null)

        const emailErr = validateEmail(email)
        const passwordErr = validatePassword(password)
        setEmailError(emailErr)
        setPasswordError(passwordErr)

        if (emailErr || passwordErr) {
            return
        }

        setIsSubmitting(true)
        try {
            await onSignUp(email, password)
            setEmail('')
            setPassword('')
            onClose()
        } catch (error) {
            if (error instanceof Error) {
                setServerError(error.message)
            } else {
                setServerError('Something went wrong. Please try again.')
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    function handleClose(): void {
        setEmail('')
        setPassword('')
        setEmailError(null)
        setPasswordError(null)
        setServerError(null)
        onClose()
    }

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Create account">
            <form onSubmit={(e) => void handleSubmit(e)} noValidate className="flex flex-col gap-4">
                {showGuestWarning && (
                    <div className="flex gap-2 px-3 py-2.5 bg-amber-950 border border-amber-700 rounded-md">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 mt-0.5 text-amber-400">
                            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                        <p className="text-sm text-amber-300 leading-snug">
                            Your guest workout will be lost when you create an account. Export it first using the Export button in the toolbar.
                        </p>
                    </div>
                )}
                <div className="flex flex-col gap-1">
                    <label htmlFor="signup-email" className="text-sm text-zinc-300">
                        Email
                    </label>
                    <input
                        id="signup-email"
                        type="email"
                        value={email}
                        onChange={(e) => {
                            setEmail(e.target.value)
                            setEmailError(null)
                            setServerError(null)
                        }}
                        className={`
                            w-full px-3 py-2
                            bg-zinc-900 text-white
                            text-sm
                            border rounded-md
                            outline-none focus:ring-2 focus:ring-brand-500
                            ${emailError ? 'border-red-500' : 'border-zinc-600'}
                        `}
                        placeholder="you@example.com"
                        autoComplete="email"
                    />
                    {emailError && (
                        <p className="text-sm text-red-400">{emailError}</p>
                    )}
                </div>

                <div className="flex flex-col gap-1">
                    <label htmlFor="signup-password" className="text-sm text-zinc-300">
                        Password
                    </label>
                    <input
                        id="signup-password"
                        type="password"
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value)
                            setPasswordError(null)
                            setServerError(null)
                        }}
                        className={`
                            w-full px-3 py-2
                            bg-zinc-900 text-white
                            text-sm
                            border rounded-md
                            outline-none focus:ring-2 focus:ring-brand-500
                            ${passwordError ? 'border-red-500' : 'border-zinc-600'}
                        `}
                        placeholder="Minimum 8 characters"
                        autoComplete="new-password"
                    />
                    {passwordError && (
                        <p className="text-sm text-red-400">{passwordError}</p>
                    )}
                </div>

                {serverError && (
                    <p className="text-sm text-red-400 text-center">{serverError}</p>
                )}

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`
                        w-full py-2 mt-2
                        bg-brand-600 text-white
                        text-sm font-medium
                        rounded-md
                        hover:bg-brand-500 transition-colors
                        focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900
                        disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                >
                    {isSubmitting ? 'Creating account...' : 'Sign up'}
                </button>
            </form>
        </Modal>
    )
}