import { useState, type FormEvent, type JSX } from 'react'
import { Modal } from '../ui/Modal.tsx'

interface Props {
    isOpen: boolean
    onClose: () => void
    onSignUp: (email: string, password: string) => Promise<void>
}

/** Regex for basic email format validation. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Sign-up modal with email and password fields. Validates inline before
 * submission: email format and password minimum length. Displays server
 * errors (e.g. duplicate email) beneath the form.
 */
export function SignUpModal({ isOpen, onClose, onSignUp }: Props): JSX.Element {
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
            <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
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
                        disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                >
                    {isSubmitting ? 'Creating account...' : 'Sign up'}
                </button>
            </form>
        </Modal>
    )
}