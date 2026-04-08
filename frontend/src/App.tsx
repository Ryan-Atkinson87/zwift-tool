import { useState, type JSX } from 'react'
import { SignInModal } from './components/auth/SignInModal.tsx'
import { SignUpModal } from './components/auth/SignUpModal.tsx'
import { FileUploader } from './components/import/FileUploader.tsx'
import { IntervalList } from './components/import/IntervalList.tsx'
import { SectionSplitter, type SectionSplit } from './components/import/SectionSplitter.tsx'
import { useAuth } from './hooks/useAuth.ts'
import { useWorkouts } from './hooks/useWorkouts.ts'
import { useWorkout } from './hooks/useWorkout.ts'
import { WorkoutList } from './components/workout/WorkoutList.tsx'
import { WorkoutCanvas } from './components/workout/WorkoutCanvas.tsx'
import { saveWorkout, undoWorkoutSection } from './api/workouts'
import { useWorkoutAutosave } from './hooks/useWorkoutAutosave.ts'
import type { ParsedWorkout, ParsedInterval, SectionType } from './types/workout'

/**
 * Root application component. Renders the top-level layout and entry point
 * for the Zwift Tool UI. Currently provides auth controls while the main
 * workout editor is under development.
 */
export function App(): JSX.Element {
    const { isAuthenticated, isLoading, user, signUp, signIn, signOut, sessionExpired, clearSessionExpired } = useAuth()
    const [isSignUpOpen, setIsSignUpOpen] = useState(false)
    const [isSignInOpen, setIsSignInOpen] = useState(false)
    const [parsedWorkouts, setParsedWorkouts] = useState<ParsedWorkout[]>([])
    const [splittingWorkout, setSplittingWorkout] = useState<ParsedWorkout | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
    const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null)
    const {
        workouts: savedWorkouts,
        isLoading: isLoadingWorkouts,
        error: workoutsError,
        reload: reloadWorkouts,
    } = useWorkouts(isAuthenticated)
    const {
        workout: selectedWorkout,
        isLoading: isLoadingSelectedWorkout,
        error: selectedWorkoutError,
        applyUpdate: applySelectedWorkoutUpdate,
    } = useWorkout(selectedWorkoutId)
    const [isUndoing, setIsUndoing] = useState(false)
    const [undoError, setUndoError] = useState<string | null>(null)
    // Auto-save loop. The hook is wired here so the editor UI can call
    // queueSectionUpdate as soon as the interval editor lands; for now it
    // is dormant since no edits are emitted yet.
    const { status: autosaveStatus, error: autosaveError } = useWorkoutAutosave(
        selectedWorkout,
        applySelectedWorkoutUpdate,
    )

    // Derive whether sign-in modal should show from session expiry or explicit open
    const showSignIn = isSignInOpen || sessionExpired

    async function handleSignUp(email: string, password: string): Promise<void> {
        await signUp({ email, password })
    }

    async function handleSignIn(email: string, password: string): Promise<void> {
        await signIn({ email, password })
    }

    function handleFilesParsed(workouts: ParsedWorkout[]): void {
        setParsedWorkouts(workouts)
        setSaveSuccess(null)
        setSaveError(null)
        // Auto-start splitting if only one file was uploaded
        if (workouts.length === 1) {
            setSplittingWorkout(workouts[0])
        }
    }

    function handleStartSplit(workout: ParsedWorkout): void {
        setSplittingWorkout(workout)
        setSaveSuccess(null)
        setSaveError(null)
    }

    async function handleConfirmSplit(split: SectionSplit): Promise<void> {
        setIsSaving(true)
        setSaveError(null)

        try {
            await saveWorkout({
                name: split.workout.name,
                author: split.workout.author,
                description: split.workout.description,
                warmupContent: split.warmupIntervals.length > 0
                    ? JSON.stringify(split.warmupIntervals) : null,
                mainsetContent: JSON.stringify(split.mainsetIntervals),
                cooldownContent: split.cooldownIntervals.length > 0
                    ? JSON.stringify(split.cooldownIntervals) : null,
                warmupDurationSeconds: split.warmupIntervals.length > 0
                    ? sumDuration(split.warmupIntervals) : null,
                mainsetDurationSeconds: sumDuration(split.mainsetIntervals),
                cooldownDurationSeconds: split.cooldownIntervals.length > 0
                    ? sumDuration(split.cooldownIntervals) : null,
                warmupIntervalCount: split.warmupIntervals.length > 0
                    ? split.warmupIntervals.length : null,
                mainsetIntervalCount: split.mainsetIntervals.length,
                cooldownIntervalCount: split.cooldownIntervals.length > 0
                    ? split.cooldownIntervals.length : null,
            })

            setSaveSuccess(`"${split.workout.name}" saved successfully.`)
            setSplittingWorkout(null)

            // Remove the saved workout from the parsed list
            setParsedWorkouts((prev) =>
                prev.filter((w) => w.fileName !== split.workout.fileName)
            )

            // Refresh the saved workouts list so the new workout appears
            void reloadWorkouts()
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : 'Failed to save workout.')
        } finally {
            setIsSaving(false)
        }
    }

    /**
     * Reverts the most recent change to a single section of the selected
     * workout. Calls the backend undo endpoint and pushes the refreshed
     * detail back into the cached workout state.
     */
    async function handleUndoSection(sectionType: SectionType): Promise<void> {
        if (selectedWorkoutId === null) {
            return
        }

        setIsUndoing(true)
        setUndoError(null)

        try {
            const updated = await undoWorkoutSection(selectedWorkoutId, sectionType)
            applySelectedWorkoutUpdate(updated)
        } catch (error) {
            setUndoError(error instanceof Error ? error.message : 'Failed to undo change.')
        } finally {
            setIsUndoing(false)
        }
    }

    function sumDuration(intervals: ParsedInterval[]): number {
        return Math.round(intervals.reduce((sum, i) => sum + i.durationSeconds, 0))
    }

    /**
     * Creates a new blank draft workout via the backend and refreshes the
     * saved workout list. The new workout has a single empty main set block
     * and no warm-up or cool-down, ready for the user to add blocks.
     */
    async function handleCreateBlankWorkout(): Promise<void> {
        setIsSaving(true)
        setSaveError(null)
        setSaveSuccess(null)

        try {
            const created = await saveWorkout({
                name: 'New Workout',
                author: null,
                description: null,
                warmupContent: null,
                // Empty main set: a single block with no intervals yet
                mainsetContent: '[]',
                cooldownContent: null,
                warmupDurationSeconds: null,
                mainsetDurationSeconds: 0,
                cooldownDurationSeconds: null,
                warmupIntervalCount: null,
                mainsetIntervalCount: 0,
                cooldownIntervalCount: null,
            })

            setSaveSuccess('New blank workout created.')
            await reloadWorkouts()
            setSelectedWorkoutId(created.id)
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : 'Failed to create blank workout.')
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-zinc-900 text-white">
                <p className="text-zinc-400 text-sm">Loading...</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-900 text-white">
            <h1 className="text-3xl font-bold mb-8">Zwift Tool</h1>

            {isAuthenticated ? (
                <div className="flex flex-col items-center gap-6 w-full px-4">
                    <div className="flex items-center gap-4">
                        <p className="text-zinc-300">
                            Signed in as <span className="text-white font-medium">{user?.email}</span>
                        </p>
                        <button
                            onClick={() => void signOut()}
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

                    <button
                        onClick={() => void handleCreateBlankWorkout()}
                        disabled={isSaving}
                        className={`
                            px-4 py-2
                            bg-indigo-600 text-white
                            text-sm font-medium
                            rounded-md
                            hover:bg-indigo-500 transition-colors
                            disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                    >
                        New workout
                    </button>

                    <WorkoutList
                        workouts={savedWorkouts}
                        isLoading={isLoadingWorkouts}
                        error={workoutsError}
                        selectedWorkoutId={selectedWorkoutId}
                        onSelect={setSelectedWorkoutId}
                    />

                    <WorkoutCanvas
                        workout={selectedWorkout}
                        isLoading={isLoadingSelectedWorkout}
                        error={selectedWorkoutError}
                        onUndoSection={(section) => void handleUndoSection(section)}
                        isUndoing={isUndoing}
                    />

                    {undoError && (
                        <p className="px-4 py-2 bg-red-900/40 text-red-300 text-sm rounded-md">
                            {undoError}
                        </p>
                    )}

                    {autosaveStatus === 'error' && autosaveError && (
                        <p className="px-4 py-2 bg-red-900/40 text-red-300 text-sm rounded-md">
                            Auto-save failed: {autosaveError}
                        </p>
                    )}

                    <FileUploader onFilesParsed={handleFilesParsed} />

                    {saveSuccess && (
                        <p className="px-4 py-2 bg-green-900/40 text-green-300 text-sm rounded-md">
                            {saveSuccess}
                        </p>
                    )}

                    {saveError && (
                        <p className="px-4 py-2 bg-red-900/40 text-red-300 text-sm rounded-md">
                            {saveError}
                        </p>
                    )}

                    {splittingWorkout ? (
                        <SectionSplitter
                            workout={splittingWorkout}
                            onConfirm={(split) => void handleConfirmSplit(split)}
                            onCancel={() => setSplittingWorkout(null)}
                            isSaving={isSaving}
                        />
                    ) : (
                        parsedWorkouts.length > 0 && (
                            <IntervalList
                                workouts={parsedWorkouts}
                                onSelectWorkout={handleStartSplit}
                            />
                        )
                    )}
                </div>
            ) : (
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsSignInOpen(true)}
                        className={`
                            px-6 py-2
                            bg-indigo-600 text-white
                            text-sm font-medium
                            rounded-md
                            hover:bg-indigo-500 transition-colors
                        `}
                    >
                        Sign in
                    </button>
                    <button
                        onClick={() => setIsSignUpOpen(true)}
                        className={`
                            px-6 py-2
                            bg-zinc-700 text-white
                            text-sm font-medium
                            rounded-md
                            hover:bg-zinc-600 transition-colors
                        `}
                    >
                        Sign up
                    </button>
                </div>
            )}

            <SignInModal
                isOpen={showSignIn}
                onClose={() => {
                    setIsSignInOpen(false)
                    clearSessionExpired()
                }}
                onSignIn={handleSignIn}
            />
            <SignUpModal
                isOpen={isSignUpOpen}
                onClose={() => setIsSignUpOpen(false)}
                onSignUp={handleSignUp}
            />
        </div>
    )
}