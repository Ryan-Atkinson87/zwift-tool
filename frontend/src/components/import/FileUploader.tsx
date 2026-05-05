/**
 * File upload component for importing .zwo workout files.
 * Accepts one or more .zwo files, parses them client-side, and reports
 * results and errors back to the parent via callbacks.
 */

import { useRef, useState, type JSX, type ChangeEvent } from 'react'
import type { ParsedWorkout } from '../../types/workout'
import { parseZwoFile } from '../../utils/zwoParser'

// Auto-discovered pool of bundled example .zwo files. Adding a new file under
// src/assets/example-workouts/ is automatically picked up at build time, so
// the example pool requires no code changes to extend.
const EXAMPLE_WORKOUTS: Record<string, string> = import.meta.glob(
    '../../assets/example-workouts/*.zwo',
    { query: '?raw', import: 'default', eager: true },
)

interface Props {
    onFilesParsed: (workouts: ParsedWorkout[]) => void
}

/**
 * Renders a file picker that accepts .zwo files. Parses each selected file
 * client-side and passes successful results to onFilesParsed. Displays
 * error messages for any files that fail validation.
 */
export function FileUploader({ onFilesParsed }: Props): JSX.Element {
    const [errors, setErrors] = useState<string[]>([])
    const [isProcessing, setIsProcessing] = useState(false)
    const [loadedExampleKeys, setLoadedExampleKeys] = useState<Set<string>>(new Set())
    const fileInputRef = useRef<HTMLInputElement>(null)

    const exampleKeys = Object.keys(EXAMPLE_WORKOUTS)
    const remainingExampleKeys = exampleKeys.filter((key) => !loadedExampleKeys.has(key))
    const examplesExhausted = remainingExampleKeys.length === 0

    function handleLoadExample(): void {
        if (examplesExhausted || isProcessing) return

        // Pick one unused example at random so repeated clicks surface a different
        // workout each time until the pool for this session is exhausted.
        const randomIndex = Math.floor(Math.random() * remainingExampleKeys.length)
        const chosenKey = remainingExampleKeys[randomIndex]
        const rawXml = EXAMPLE_WORKOUTS[chosenKey]
        const fileName = chosenKey.split('/').pop() ?? 'example.zwo'

        setErrors([])

        try {
            const parsed = parseZwoFile(rawXml, fileName)
            setLoadedExampleKeys((previous) => {
                const next = new Set(previous)
                next.add(chosenKey)
                return next
            })
            onFilesParsed([parsed])
        } catch (error) {
            setErrors([
                error instanceof Error
                    ? error.message
                    : 'Failed to load example workout.',
            ])
        }
    }

    async function handleFileChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
        const files = event.target.files
        if (!files || files.length === 0) return

        setIsProcessing(true)
        setErrors([])

        const parsedWorkouts: ParsedWorkout[] = []
        const parseErrors: string[] = []

        const fileArray = Array.from(files)

        const results = await Promise.allSettled(
            fileArray.map((file) => readAndParseFile(file))
        )

        for (const result of results) {
            if (result.status === 'fulfilled') {
                parsedWorkouts.push(result.value)
            } else {
                parseErrors.push(result.reason instanceof Error
                    ? result.reason.message
                    : 'An unknown error occurred.')
            }
        }

        setErrors(parseErrors)
        setIsProcessing(false)

        if (parsedWorkouts.length > 0) {
            onFilesParsed(parsedWorkouts)
        }

        // Reset the input so the same file(s) can be re-selected
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    return (
        <div className="flex flex-col gap-2">
            <label
                className={`
                    flex items-center justify-center
                    w-full px-4 py-2
                    bg-zinc-700 text-white
                    text-sm font-medium
                    rounded-md
                    cursor-pointer
                    hover:bg-zinc-600 transition-colors
                    focus-within:outline-none focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-1 focus-within:ring-offset-zinc-900
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
                `}
            >
                {isProcessing ? 'Processing...' : 'Upload .zwo files'}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zwo"
                    multiple
                    className="hidden"
                    onChange={(e) => void handleFileChange(e)}
                    disabled={isProcessing}
                />
            </label>

            <button
                type="button"
                onClick={handleLoadExample}
                disabled={examplesExhausted || isProcessing}
                className={`
                    w-full px-4 py-2
                    bg-zinc-700 text-white
                    text-sm font-medium
                    rounded-md
                    hover:bg-zinc-600 transition-colors
                    focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900
                    disabled:opacity-50 disabled:cursor-not-allowed
                `}
            >
                Load example workout
            </button>

            {examplesExhausted && exampleKeys.length > 0 && (
                <p className="text-xs text-zinc-400">
                    No more example workouts available.
                </p>
            )}

            {errors.length > 0 && (
                <div className="flex flex-col gap-2">
                    {errors.map((error, index) => (
                        <p
                            key={index}
                            className="px-3 py-2 bg-red-900/40 text-red-200 text-sm rounded-md"
                        >
                            {error}
                        </p>
                    ))}
                </div>
            )}
        </div>
    )
}

/**
 * Reads a File as text and passes it to the .zwo parser.
 *
 * @param file the File object from the file input
 * @return the parsed workout
 * @throws Error if the file cannot be read or parsed
 */
async function readAndParseFile(file: File): Promise<ParsedWorkout> {
    const text = await file.text()
    return parseZwoFile(text, file.name)
}
