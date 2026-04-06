/**
 * File upload component for importing .zwo workout files.
 * Accepts one or more .zwo files, parses them client-side, and reports
 * results and errors back to the parent via callbacks.
 */

import { useRef, useState, type JSX, type ChangeEvent } from 'react'
import type { ParsedWorkout } from '../../types/workout'
import { parseZwoFile } from '../../utils/zwoParser'

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
    const fileInputRef = useRef<HTMLInputElement>(null)

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
        <div className="flex flex-col items-center gap-4">
            <label
                className={`
                    flex items-center justify-center
                    px-6 py-3
                    bg-indigo-600 text-white
                    text-sm font-medium
                    rounded-md
                    cursor-pointer
                    hover:bg-indigo-500 transition-colors
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

            {errors.length > 0 && (
                <div className="flex flex-col gap-2 w-full max-w-md">
                    {errors.map((error, index) => (
                        <p
                            key={index}
                            className="px-4 py-2 bg-red-900/40 text-red-300 text-sm rounded-md"
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
