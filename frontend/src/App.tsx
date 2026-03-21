import { type JSX } from 'react'

/**
 * Root application component. Renders the top-level layout and entry point
 * for the Zwift Tool UI.
 */
export function App(): JSX.Element {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
            <h1 className="text-3xl font-bold">Zwift Tool</h1>
        </div>
    )
}