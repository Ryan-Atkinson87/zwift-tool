import { useState, type FormEvent, type JSX } from 'react'
import { Modal } from '../ui/Modal.tsx'

interface Props {
    isOpen: boolean
    onClose: () => void
    onSignIn: (email: string, password: string) => Promise<void>
    /** When true, shows a warning that the active guest workout will be lost on sign-in. */
    showGuestWarning?: boolean
}

/**
 * Sign-in modal with email and password fields. Displays a generic
 * server error on failed authentication without revealing which
 * field was incorrect.
 *
 * When showGuestWarning is true, a banner is shown warning the user that
 * their guest workout will be lost and they should export it first.
 */
export function SignInModal({ isOpen, onClose, onSignIn, showGuestWarning = false }: Props): JSX.Element {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    async function handleSubmit(event: FormEvent): Promise<void> {
        event.preventDefault()
        setError(null)

        if (!email.trim() || !password) {
            setError('Please enter your email and password.')
            return
        }

        setIsSubmitting(true)
        try {
            await onSignIn(email, password)
            setEmail('')
            setPassword('')
            onClose()
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message)
            } else {
                setError('Something went wrong. Please try again.')
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    function handleClose(): void {
        setEmail('')
        setPassword('')
        setError(null)
        onClose()
    }

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Sign in">
            <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
                {showGuestWarning && (
                    <div className="flex gap-2 px-3 py-2.5 bg-amber-950 border border-amber-700 rounded-md">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 mt-0.5 text-amber-400">
                            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                        <p className="text-sm text-amber-300 leading-snug">
                            Your guest workout will be lost when you sign in. Export it first using the Export button in the toolbar.
                        </p>
                    </div>
                )}
                <div className="flex flex-col gap-1">
                    <label htmlFor="signin-email" className="text-sm text-zinc-300">
                        Email
                    </label>
                    <input
                        id="signin-email"
                        type="email"
                        value={email}
                        onChange={(e) => {
                            setEmail(e.target.value)
                            setError(null)
                        }}
                        className={`
                            w-full px-3 py-2
                            bg-zinc-900 text-white
                            text-sm
                            border rounded-md
                            outline-none focus:ring-2 focus:ring-brand-500
                            ${error ? 'border-red-500' : 'border-zinc-600'}
                        `}
                        placeholder="you@example.com"
                        autoComplete="email"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <label htmlFor="signin-password" className="text-sm text-zinc-300">
                        Password
                    </label>
                    <input
                        id="signin-password"
                        type="password"
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value)
                            setError(null)
                        }}
                        className={`
                            w-full px-3 py-2
                            bg-zinc-900 text-white
                            text-sm
                            border rounded-md
                            outline-none focus:ring-2 focus:ring-brand-500
                            ${error ? 'border-red-500' : 'border-zinc-600'}
                        `}
                        placeholder="Your password"
                        autoComplete="current-password"
                    />
                </div>

                {error && (
                    <p className="text-sm text-red-400 text-center">{error}</p>
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
                    {isSubmitting ? 'Signing in...' : 'Sign in'}
                </button>
            </form>
        </Modal>
    )
}