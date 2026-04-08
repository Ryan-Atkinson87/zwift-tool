import type { JSX } from 'react'
import type { WorkoutSummary } from '../../types/workout'
import { WorkoutCard } from './WorkoutCard'

interface Props {
    workouts: WorkoutSummary[]
    isLoading: boolean
    error: string | null
    selectedWorkoutId: string | null
    onSelect: (id: string) => void
}

/**
 * Renders the list of saved workouts in the left panel. Handles
 * loading, error, and empty states, and delegates the click handler
 * down to each {@link WorkoutCard}.
 */
export function WorkoutList({
    workouts,
    isLoading,
    error,
    selectedWorkoutId,
    onSelect,
}: Props): JSX.Element {
    return (
        <div className="flex flex-col w-full max-w-md gap-3">
            <h2 className="text-sm font-semibold tracking-wide text-zinc-300 uppercase">
                Saved workouts
            </h2>

            {/* Only show the loading text on the very first fetch (no
                workouts cached yet). On a background reload triggered by a
                save we keep showing the existing list so the layout does
                not collapse and the focused field stays in place. */}
            {isLoading && workouts.length === 0 && (
                <p className="text-sm text-zinc-400">Loading workouts...</p>
            )}

            {error && !isLoading && (
                <p className="px-3 py-2 bg-red-900/40 text-red-300 text-sm rounded-md">
                    {error}
                </p>
            )}

            {!isLoading && !error && workouts.length === 0 && (
                <p className="px-3 py-4 bg-zinc-800/60 text-zinc-400 text-sm rounded-md text-center">
                    No saved workouts yet. Upload a .zwo file to get started.
                </p>
            )}

            {workouts.length > 0 && (
                <ul className="flex flex-col gap-2">
                    {workouts.map((workout) => (
                        <li key={workout.id}>
                            <WorkoutCard
                                workout={workout}
                                isSelected={workout.id === selectedWorkoutId}
                                onSelect={onSelect}
                            />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
