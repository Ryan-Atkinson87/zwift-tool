import type { JSX } from 'react'
import { AppFooter } from './AppFooter.tsx'

/**
 * Standalone privacy policy page, accessible without authentication.
 * Rendered when the user navigates to /privacy.
 */
export function PrivacyPage(): JSX.Element {
    return (
        <div className="flex flex-col min-h-screen bg-zinc-900 text-white">
            <header className="shrink-0 px-4 py-3 border-b border-zinc-700">
                <a
                    href="/"
                    className="text-lg font-bold hover:text-zinc-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-zinc-900 rounded"
                >
                    Zwift Tool
                </a>
            </header>

            <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-10">
                <h1 className="text-2xl font-bold mb-2">Privacy Policy</h1>
                <p className="text-sm text-zinc-400 mb-8">
                    Effective date: 17 April 2025. Last updated: 17 April 2025.
                </p>

                <section className="mb-8">
                    <h2 className="text-base font-semibold text-zinc-200 mb-3">01 · Data Controller</h2>
                    <p className="text-sm text-zinc-300 leading-relaxed mb-3">
                        The data controller for Zwift Tool is Ryan Atkinson, operating under the Trive brand at trivedev.uk.
                    </p>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        For any data-related enquiries, contact:{' '}
                        <a
                            href="mailto:privacy@trivedev.uk"
                            className="text-indigo-400 hover:text-indigo-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-zinc-900 rounded"
                        >
                            privacy@trivedev.uk
                        </a>
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-base font-semibold text-zinc-200 mb-3">02 · What Data Is Collected</h2>
                    <p className="text-sm text-zinc-300 leading-relaxed mb-3">
                        Zwift Tool collects the minimum data required to provide the service:
                    </p>
                    <ul className="text-sm text-zinc-300 leading-relaxed list-disc list-inside space-y-1 mb-3">
                        <li>Email address, used to identify your account</li>
                        <li>Display name, if you choose to set one</li>
                        <li>Password, stored as a one-way hash (never in plain text)</li>
                        <li>Workout files and block library content you upload or create within the app</li>
                        <li>Zone preset preferences, if you change them from the defaults</li>
                        <li>Session tokens, stored in HttpOnly cookies to keep you signed in</li>
                    </ul>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        No payment information, location data, or device identifiers are collected.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-base font-semibold text-zinc-200 mb-3">03 · Lawful Basis for Processing</h2>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        Personal data is processed on the basis of contract: processing is necessary to provide the
                        service you signed up for. Without your email address, it is not possible to create or maintain
                        an account.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-base font-semibold text-zinc-200 mb-3">04 · How Data Is Used</h2>
                    <ul className="text-sm text-zinc-300 leading-relaxed list-disc list-inside space-y-1 mb-3">
                        <li>To create and authenticate your account</li>
                        <li>To store and retrieve your workouts and saved blocks</li>
                        <li>To maintain your session securely</li>
                    </ul>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        Your data is never sold, shared with third parties for marketing purposes, or used for
                        advertising.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-base font-semibold text-zinc-200 mb-3">05 · Cookies</h2>
                    <p className="text-sm text-zinc-300 leading-relaxed mb-3">
                        Zwift Tool uses two HttpOnly cookies: one for your access token and one for your refresh token.
                        These are strictly necessary for authentication and session management. They cannot be read by
                        JavaScript and are not used for tracking or analytics.
                    </p>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        No third-party tracking cookies are set.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-base font-semibold text-zinc-200 mb-3">06 · Data Retention</h2>
                    <ul className="text-sm text-zinc-300 leading-relaxed list-disc list-inside space-y-1">
                        <li>Account data is retained for as long as your account exists</li>
                        <li>Draft workouts with no activity for more than 7 days are deleted automatically</li>
                        <li>Session tokens expire after 7 days and are rotated on each use</li>
                        <li>On account deletion, all associated data is deleted immediately and permanently</li>
                    </ul>
                </section>

                <section className="mb-8">
                    <h2 className="text-base font-semibold text-zinc-200 mb-3">07 · Third-Party Services</h2>
                    <p className="text-sm text-zinc-300 leading-relaxed mb-3">
                        Zwift Tool uses the following infrastructure providers. Each acts as a data processor under a
                        Data Processing Agreement:
                    </p>
                    <ul className="text-sm text-zinc-300 leading-relaxed list-disc list-inside space-y-1 mb-3">
                        <li>Cloudflare, for hosting the frontend and DNS</li>
                        <li>Railway, for hosting the backend application</li>
                        <li>Neon, for the database</li>
                        <li>
                            Sentry, for error monitoring. Sentry may capture anonymised error context. No personally
                            identifiable information is intentionally sent to Sentry.
                        </li>
                    </ul>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        All providers are reputable infrastructure companies with their own security and compliance
                        programmes.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-base font-semibold text-zinc-200 mb-3">08 · Your Rights</h2>
                    <p className="text-sm text-zinc-300 leading-relaxed mb-3">
                        Under UK GDPR and EU GDPR, you have the right to:
                    </p>
                    <ul className="text-sm text-zinc-300 leading-relaxed list-disc list-inside space-y-1 mb-3">
                        <li>Access the personal data held about you</li>
                        <li>Correct inaccurate data</li>
                        <li>Request deletion of your data</li>
                        <li>Object to processing</li>
                        <li>Request a copy of your data in a portable format</li>
                    </ul>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        To exercise any of these rights, email{' '}
                        <a
                            href="mailto:privacy@trivedev.uk"
                            className="text-indigo-400 hover:text-indigo-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-zinc-900 rounded"
                        >
                            privacy@trivedev.uk
                        </a>
                        . Requests will be responded to within 30 days.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-base font-semibold text-zinc-200 mb-3">09 · Complaints</h2>
                    <p className="text-sm text-zinc-300 leading-relaxed mb-3">
                        If you are unhappy with how your data has been handled, you have the right to lodge a complaint
                        with the relevant supervisory authority.
                    </p>
                    <ul className="text-sm text-zinc-300 leading-relaxed list-disc list-inside space-y-1">
                        <li>
                            UK: Information Commissioner's Office (ICO) at{' '}
                            <a
                                href="https://ico.org.uk"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-400 hover:text-indigo-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-zinc-900 rounded"
                            >
                                ico.org.uk
                            </a>
                        </li>
                        <li>EU: The supervisory authority in your country of residence</li>
                    </ul>
                </section>

                <section className="mb-8">
                    <h2 className="text-base font-semibold text-zinc-200 mb-3">10 · Changes to This Policy</h2>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        If this policy changes materially, the effective date at the top of the page will be updated.
                        Continued use of Zwift Tool after a policy update constitutes acceptance of the revised terms.
                    </p>
                </section>

                <section className="mb-8">
                    <h2 className="text-base font-semibold text-zinc-200 mb-3">Contact</h2>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        Data controller enquiries and rights requests:{' '}
                        <a
                            href="mailto:privacy@trivedev.uk"
                            className="text-indigo-400 hover:text-indigo-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-zinc-900 rounded"
                        >
                            privacy@trivedev.uk
                        </a>
                    </p>
                </section>
            </main>

            <AppFooter />
        </div>
    )
}
