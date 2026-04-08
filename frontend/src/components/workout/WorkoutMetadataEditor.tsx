import { useState, type JSX } from 'react'
import type { WorkoutDetail } from '../../types/workout'

interface Props {
    workout: WorkoutDetail
    /**
     * Called when the user blurs a field whose value has changed. The parent
     * is responsible for calling the backend metadata endpoint and pushing
     * the refreshed workout detail back into cached state.
     */
    onSave: (next: { name: string; author: string | null; description: string | null }) => void
    /** True while a save request is in flight, used to disable inputs. */
    isSaving: boolean
}

/**
 * Inline editor for the selected workout's metadata fields: name, author,
 * and description. Each field auto-saves on blur via the {@link Props#onSave}
 * callback. Local draft state is reset whenever the parent supplies a
 * different workout, so switching between workouts shows fresh values.
 *
 * <p>The name field is required and falls back to the previous saved value
 * if the user blurs it blank.</p>
 *
 * <p>Local draft state is initialised from props on first render. The parent
 * is expected to pass {@code key={workout.id}} so that switching workouts
 * remounts the editor and picks up fresh values without an effect.</p>
 */
export function WorkoutMetadataEditor({ workout, onSave, isSaving }: Props): JSX.Element {
    const [name, setName] = useState<string>(workout.name)
    const [author, setAuthor] = useState<string>(workout.author ?? '')
    const [description, setDescription] = useState<string>(workout.description ?? '')

    function handleNameBlur(): void {
        const trimmed = name.trim()
        // Name is required by the backend; revert blank input to last saved
        if (trimmed.length === 0) {
            setName(workout.name)
            return
        }
        if (trimmed === workout.name) {
            return
        }
        onSave({
            name: trimmed,
            author: workout.author,
            description: workout.description,
        })
    }

    function handleAuthorBlur(): void {
        const next = author.trim().length === 0 ? null : author.trim()
        if (next === workout.author) {
            return
        }
        onSave({
            name: workout.name,
            author: next,
            description: workout.description,
        })
    }

    function handleDescriptionBlur(): void {
        const next = description.trim().length === 0 ? null : description.trim()
        if (next === workout.description) {
            return
        }
        onSave({
            name: workout.name,
            author: workout.author,
            description: next,
        })
    }

    return (
        <div className="flex flex-col w-full max-w-4xl gap-2">
            <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleNameBlur}
                disabled={isSaving}
                aria-label="Workout name"
                placeholder="Workout name"
                maxLength={200}
                className={`
                    w-full px-2 py-1
                    bg-transparent text-white
                    text-lg font-semibold
                    border border-transparent rounded
                    hover:border-zinc-700 focus:border-indigo-500
                    focus:outline-none transition-colors
                    disabled:opacity-60
                `}
            />

            <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                onBlur={handleAuthorBlur}
                disabled={isSaving}
                aria-label="Workout author"
                placeholder="Author"
                maxLength={200}
                className={`
                    w-full px-2 py-1
                    bg-transparent text-zinc-300
                    text-sm
                    border border-transparent rounded
                    hover:border-zinc-700 focus:border-indigo-500
                    focus:outline-none transition-colors
                    disabled:opacity-60
                `}
            />

            <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleDescriptionBlur}
                disabled={isSaving}
                aria-label="Workout description"
                placeholder="Description"
                rows={2}
                maxLength={2000}
                className={`
                    w-full px-2 py-1
                    bg-transparent text-zinc-300
                    text-sm
                    border border-transparent rounded
                    hover:border-zinc-700 focus:border-indigo-500
                    focus:outline-none transition-colors resize-y
                    disabled:opacity-60
                `}
            />
        </div>
    )
}
