/**
 * Vitest global test setup.
 *
 * Imports jest-dom matchers so every test file can use custom DOM assertions
 * such as toBeInTheDocument, toHaveValue, and toBeDisabled without extra imports.
 */
import '@testing-library/jest-dom'

// jsdom does not implement File.prototype.text — polyfill it using FileReader
if (typeof File !== 'undefined' && File.prototype.text === undefined) {
    File.prototype.text = function (): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = () => reject(reader.error)
            reader.readAsText(this)
        })
    }
}
