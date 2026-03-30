import { useState, type JSX } from 'react'
import { SignUpModal } from './components/auth/SignUpModal.tsx'
import { useAuth } from './hooks/useAuth.ts'

/**
 * Root application component. Renders the top-level layout and entry point
 * for the Zwift Tool UI. Currently provides auth controls while the main
 * workout editor is under development.
 */
export function App(): JSX.Element {
    const { isAuthenticated, user, signUp, signOut } = useAuth()
    const [isSignUpOpen, setIsSignUpOpen] = useState(false)

    async function handleSignUp(email: string, password: string): Promise<void> {
        await signUp({ email, password })
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-900 text-white">
            <h1 className="text-3xl font-bold mb-8">Zwift Tool</h1>

            {isAuthenticated ? (
                <div className="flex flex-col items-center gap-4">
                    <p className="text-zinc-300">
                        Signed in as <span className="text-white font-medium">{user?.email}</span>
                    </p>
                    <button
                        onClick={signOut}
                        className={`
                            px-4 py-2
                            bg-zinc-700 text-white
                            text-sm font-medium
                            rounded-md
                            hover:bg-zinc-600 transition-colors
                        `}
                    >
                        Sign out
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => setIsSignUpOpen(true)}
                    className={`
                        px-6 py-2
                        bg-indigo-600 text-white
                        text-sm font-medium
                        rounded-md
                        hover:bg-indigo-500 transition-colors
                    `}
                >
                    Sign up
                </button>
            )}

            <SignUpModal
                isOpen={isSignUpOpen}
                onClose={() => setIsSignUpOpen(false)}
                onSignUp={handleSignUp}
            />
        </div>
    )
}