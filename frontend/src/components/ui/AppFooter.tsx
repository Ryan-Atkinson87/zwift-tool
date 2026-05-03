import type { JSX } from 'react'

/**
 * Application footer rendered on every page. Contains the Privacy Policy link.
 */
export function AppFooter(): JSX.Element {
    return (
        <footer className="shrink-0 flex items-center justify-center px-4 py-2 border-t border-zinc-800">
            <a
                href="/privacy"
                className="text-xs text-zinc-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-zinc-900 rounded"
            >
                Privacy Policy
            </a>
        </footer>
    )
}
