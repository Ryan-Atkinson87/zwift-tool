import type { JSX } from 'react'
import type { WorkoutSummary } from '../../types/workout'
import { BulkActionsToolbar } from './BulkActionsToolbar'
import { WorkoutCard } from './WorkoutCard'

interface Props {
    workouts: WorkoutSummary[]
    isLoading: boolean
    error: string | null
    selectedWorkoutId: string | null
    selectedWorkoutIds: string[]
    isSelectMode: boolean
    isExporting: boolean
    onSelect: (id: string) => void
    onToggleSelect: (id: string) => void
    /** Called when the Select / Done toggle is pressed. */
    onSelectModeChange: (active: boolean) => void
    /** Called when select mode is toggled off, so the parent can clear checked state. */
    onClearSelection: () => void
    onBulkReplace: () => void
    onExportSelected: () => void
    /** Called with all workout IDs to select all, or an empty array to deselect all. */
    onSelectAll: (ids: string[]) => void
    onDeleteWorkout: (id: string) => void
}

/**
 * Renders the list of saved workouts in the left panel. Handles loading,
 * error, and empty states. Exposes a Select / Done toggle in the heading
 * row that drives the {@link isSelectMode} prop, which shows the bulk
 * actions toolbar and custom checkboxes on each card.
 *
 * <p>The bulk actions toolbar is rendered directly below the heading row
 * so the heading position is stable whether select mode is on or off.</p>
 */
export function WorkoutList({
    workouts,
    isLoading,
    error,
    selectedWorkoutId,
    selectedWorkoutIds,
    isSelectMode,
    isExporting,
    onSelect,
    onToggleSelect,
    onSelectModeChange,
    onClearSelection,
    onBulkReplace,
    onExportSelected,
    onSelectAll,
    onDeleteWorkout,
}: Props): JSX.Element {
    const allSelected = workouts.length > 0 && selectedWorkoutIds.length === workouts.length
    function handleToggleSelectMode(): void {
        if (isSelectMode) {
            onClearSelection()
        }
        onSelectModeChange(!isSelectMode)
    }

    return (
        <div className="flex flex-col w-full gap-3">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-wide text-zinc-300 uppercase">
                    Saved workouts
                </h2>
                {workouts.length > 0 && (
                    <button
                        type="button"
                        onClick={handleToggleSelectMode}
                        className={`
                            px-2 py-0.5
                            label-tiny
                            rounded transition-colors
                            focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900
                            ${isSelectMode
                                ? 'bg-brand-600 text-white hover:bg-brand-500'
                                : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}
                        `}
                    >
                        {isSelectMode ? 'Done' : 'Select'}
                    </button>
                )}
            </div>

            {isSelectMode && (
                <>
                    <BulkActionsToolbar
                        selectedCount={selectedWorkoutIds.length}
                        isExporting={isExporting}
                        onClearSelection={onClearSelection}
                        onBulkReplace={onBulkReplace}
                        onExportSelected={onExportSelected}
                    />
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={() => onSelectAll(allSelected ? [] : workouts.map((w) => w.id))}
                            aria-label="Select all workouts"
                            // Prevent the browser scrolling the hidden input into view when it
                            // receives focus via the label click. The visual span and onChange
                            // handler cover all interaction needs.
                            tabIndex={-1}
                            className="sr-only"
                        />
                        <span
                            className={`
                                flex items-center justify-center
                                w-4 h-4 rounded border transition-colors shrink-0
                                ${allSelected
                                    ? 'bg-brand-600 border-brand-500'
                                    : 'border-zinc-500 hover:border-zinc-300'}
                            `}
                        >
                            {allSelected && (
                                <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 text-white" fill="none">
                                    <path
                                        d="M1.5 5l2.5 2.5 4.5-4"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            )}
                        </span>
                        <span className="text-xs text-zinc-300">Select all</span>
                    </label>
                </>
            )}

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
                                isChecked={selectedWorkoutIds.includes(workout.id)}
                                isSelectMode={isSelectMode}
                                onSelect={onSelect}
                                onToggle={onToggleSelect}
                                onDelete={onDeleteWorkout}
                            />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
