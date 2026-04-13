import { useState, type FormEvent, type JSX } from 'react'
import { Modal } from '../ui/Modal.tsx'

interface Props {
    isOpen: boolean
    onClose: () => void
    onSignIn: (email: string, password: string) => Promise<void>
}

/**
 * Sign-in modal with email and password fields. Displays a generic
 * server error on failed authentication without revealing which
 * field was incorrect.
 */
export function SignInModal({ isOpen, onClose, onSignIn }: Props): JSX.Element {
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
                        disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                >
                    {isSubmitting ? 'Signing in...' : 'Sign in'}
                </button>
            </form>
        </Modal>
    )
}