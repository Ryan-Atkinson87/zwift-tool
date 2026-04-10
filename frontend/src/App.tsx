import { useEffect, useState, type JSX } from 'react'
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
import { WorkoutMetadataEditor } from './components/workout/WorkoutMetadataEditor.tsx'
import { AddBlockModal } from './components/workout/AddBlockModal.tsx'
import { IntervalEditor } from './components/workout/IntervalEditor.tsx'
import { IntervalListEditor } from './components/workout/IntervalListEditor.tsx'
import { TextEventEditor } from './components/workout/TextEventEditor.tsx'
import { ZonePresetSettings } from './components/workout/ZonePresetSettings.tsx'
import { BlockLibrary } from './components/blocks/BlockLibrary.tsx'
import { SaveToLibraryModal } from './components/blocks/SaveToLibraryModal.tsx'
import { ReplaceWithBlockModal } from './components/blocks/ReplaceWithBlockModal.tsx'
import { CreateBlockModal } from './components/blocks/CreateBlockModal.tsx'
import { BulkActionsToolbar } from './components/workout/BulkActionsToolbar.tsx'
import { saveWorkout, undoWorkoutSection, updateWorkoutMetadata, replaceWorkoutSection } from './api/workouts'
import { saveBlock } from './api/blocks'
import { useWorkoutAutosave } from './hooks/useWorkoutAutosave.ts'
import { useZonePresets } from './hooks/useZonePresets.ts'
import { useBlocks } from './hooks/useBlocks.ts'
import type { ParsedWorkout, ParsedInterval, SectionType, TextEvent } from './types/workout'
import { type Zone } from './utils/zonePresets'
import { buildSectionDraft, currentSectionBlock, sumIntervalDuration as sumDuration } from './utils/editorDraft'

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
    const [selectedWorkoutIds, setSelectedWorkoutIds] = useState<string[]>([])
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
    const [isSavingMetadata, setIsSavingMetadata] = useState(false)
    const [metadataError, setMetadataError] = useState<string | null>(null)
    const [addBlockSection, setAddBlockSection] = useState<SectionType | null>(null)
    const [selectedInterval, setSelectedInterval] = useState<{
        sectionType: SectionType
        intervalIndex: number
    } | null>(null)
    const [isZonePresetSettingsOpen, setIsZonePresetSettingsOpen] = useState(false)
    const {
        presets: zonePresets,
        getPreset: getEffectiveZonePreset,
        savePreset: saveEffectiveZonePreset,
        resetPreset: resetEffectiveZonePreset,
    } = useZonePresets(isAuthenticated)
    const {
        blocks: libraryBlocks,
        isLoading: isLoadingBlocks,
        error: blocksError,
        reload: reloadBlocks,
        deleteBlock: deleteLibraryBlock,
    } = useBlocks(isAuthenticated)
    const [saveToLibrarySection, setSaveToLibrarySection] = useState<SectionType | null>(null)
    const [replaceSectionType, setReplaceSectionType] = useState<SectionType | null>(null)
    const [isCreateBlockOpen, setIsCreateBlockOpen] = useState(false)
    const [isReplacing, setIsReplacing] = useState(false)
    const [replaceError, setReplaceError] = useState<string | null>(null)

    // Clear the selected interval whenever the user switches workout so a
    // stale index from a previous workout cannot leak into the editor.
    useEffect(() => {
        setSelectedInterval(null)
    }, [selectedWorkoutId])
    // Auto-save loop. The editor pushes section content into queueSectionUpdate
    // every time the user adds, edits, or removes an interval. Updates are
    // debounced inside the hook and the response is fed back into the cached
    // workout state via applySelectedWorkoutUpdate.
    const {
        queueSectionUpdate,
        status: autosaveStatus,
        error: autosaveError,
    } = useWorkoutAutosave(selectedWorkout, applySelectedWorkoutUpdate)

    // Derive whether sign-in modal should show from session expiry or explicit open
    const showSignIn = isSignInOpen || sessionExpired

    async function handleSignUp(email: string, password: string): Promise<void> {
        await signUp({ email, password })
    }

    async function handleSignIn(email: string, password: string): Promise<void> {
        await signIn({ email, password })
    }

    function handleToggleWorkoutSelect(id: string): void {
        setSelectedWorkoutIds((prev) =>
            prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id],
        )
    }

    function handleClearSelection(): void {
        setSelectedWorkoutIds([])
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

    /**
     * Persists updated metadata for the selected workout, refreshes the
     * cached workout detail, and reloads the saved workouts list so the
     * left panel reflects the new name.
     */
    async function handleSaveMetadata(next: {
        name: string
        author: string | null
        description: string | null
    }): Promise<void> {
        if (selectedWorkoutId === null) {
            return
        }

        setIsSavingMetadata(true)
        setMetadataError(null)

        try {
            const updated = await updateWorkoutMetadata(selectedWorkoutId, next)
            applySelectedWorkoutUpdate(updated)
            void reloadWorkouts()
        } catch (error) {
            setMetadataError(
                error instanceof Error ? error.message : 'Failed to save workout details.',
            )
        } finally {
            setIsSavingMetadata(false)
        }
    }

    /**
     * Persists an updated text event list for the selected workout. Text
     * events piggyback on the metadata endpoint so their current value is
     * round-tripped as part of the existing metadata save pipeline.
     */
    async function handleSaveTextEvents(nextEvents: TextEvent[]): Promise<void> {
        if (selectedWorkoutId === null || selectedWorkout === null) {
            return
        }
        setIsSavingMetadata(true)
        setMetadataError(null)
        // Optimistic patch so the row reflects the edit before the round-trip
        applySelectedWorkoutUpdate({ ...selectedWorkout, textEvents: nextEvents })
        try {
            const updated = await updateWorkoutMetadata(selectedWorkoutId, {
                name: selectedWorkout.name,
                author: selectedWorkout.author,
                description: selectedWorkout.description,
                textEvents: JSON.stringify(nextEvents),
            })
            applySelectedWorkoutUpdate(updated)
        } catch (error) {
            setMetadataError(
                error instanceof Error ? error.message : 'Failed to save text events.',
            )
        } finally {
            setIsSavingMetadata(false)
        }
    }

    /**
     * Replaces a section's interval list, optimistically patches the cached
     * workout so the canvas re-renders immediately, and queues an auto-save.
     * All editor mutations (preset add, block add, edit, reorder, delete)
     * funnel through this single helper.
     */
    function commitSectionIntervals(
        sectionType: SectionType,
        nextIntervals: ParsedInterval[],
    ): void {
        if (selectedWorkout === null) {
            return
        }

        const draft = buildSectionDraft(selectedWorkout, sectionType, nextIntervals)
        applySelectedWorkoutUpdate(draft.patchedWorkout)
        queueSectionUpdate(sectionType, {
            content: draft.content,
            durationSeconds: draft.durationSeconds,
            intervalCount: draft.intervalCount,
        })
    }

    /**
     * Appends a new SteadyState interval to the chosen section using the
     * default duration and %FTP for the supplied zone.
     */
    function handleAddZonePreset(sectionType: SectionType, zone: Zone): void {
        if (selectedWorkout === null) {
            return
        }

        const preset = getEffectiveZonePreset(zone)
        const newInterval: ParsedInterval = {
            type: 'SteadyState',
            durationSeconds: preset.durationSeconds,
            // Stored as a fraction of FTP to match the .zwo file format
            power: preset.ftpPercent / 100,
            powerHigh: null,
            cadence: null,
            repeat: null,
            onDuration: null,
            offDuration: null,
            onPower: null,
            offPower: null,
        }

        const currentBlock = currentSectionBlock(selectedWorkout, sectionType)
        const nextIntervals: ParsedInterval[] = currentBlock !== null
            ? [...currentBlock.intervals, newInterval]
            : [newInterval]

        commitSectionIntervals(sectionType, nextIntervals)
    }

    /**
     * Appends a new non-preset interval (Ramp, IntervalsT, or Free Ride) to
     * the chosen section. The caller is responsible for constructing a
     * fully-populated {@link ParsedInterval} of the desired type.
     */
    function handleAddInterval(sectionType: SectionType, interval: ParsedInterval): void {
        if (selectedWorkout === null) {
            return
        }
        const currentBlock = currentSectionBlock(selectedWorkout, sectionType)
        const nextIntervals: ParsedInterval[] = currentBlock !== null
            ? [...currentBlock.intervals, interval]
            : [interval]
        commitSectionIntervals(sectionType, nextIntervals)
    }

    /**
     * Replaces a single interval inside a section with an edited copy.
     * Used by the inline interval editor when the user changes duration,
     * power, or cadence.
     */
    function handleUpdateInterval(
        sectionType: SectionType,
        index: number,
        next: ParsedInterval,
    ): void {
        if (selectedWorkout === null) {
            return
        }
        const currentBlock = currentSectionBlock(selectedWorkout, sectionType)
        if (currentBlock === null) {
            return
        }
        const nextIntervals = currentBlock.intervals.map((interval, i) =>
            i === index ? next : interval,
        )
        commitSectionIntervals(sectionType, nextIntervals)
    }

    /**
     * Removes a single interval from a section. Deleting the last interval
     * in the main set is blocked because the main set is mandatory and the
     * editor must always have at least one interval to anchor.
     */
    function handleDeleteInterval(sectionType: SectionType, index: number): void {
        if (selectedWorkout === null) {
            return
        }
        const currentBlock = currentSectionBlock(selectedWorkout, sectionType)
        if (currentBlock === null) {
            return
        }
        if (sectionType === 'MAINSET' && currentBlock.intervals.length <= 1) {
            return
        }
        const nextIntervals = currentBlock.intervals.filter((_, i) => i !== index)
        commitSectionIntervals(sectionType, nextIntervals)
    }

    /**
     * Reorders a section's interval list by moving the interval at
     * {@code fromIndex} to {@code toIndex}. Cross-section drags are not
     * permitted; the caller must constrain drags to a single section.
     */
    function handleReorderIntervals(
        sectionType: SectionType,
        fromIndex: number,
        toIndex: number,
    ): void {
        if (selectedWorkout === null) {
            return
        }
        const currentBlock = currentSectionBlock(selectedWorkout, sectionType)
        if (currentBlock === null) {
            return
        }
        if (fromIndex === toIndex) {
            return
        }
        const nextIntervals = [...currentBlock.intervals]
        const [moved] = nextIntervals.splice(fromIndex, 1)
        nextIntervals.splice(toIndex, 0, moved)
        commitSectionIntervals(sectionType, nextIntervals)
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

    /**
     * Saves the current section to the block library using the name and
     * description provided by the user in the save modal. Reloads the
     * library panel immediately after a successful save.
     */
    async function handleConfirmSaveToLibrary(
        name: string,
        description: string | null,
    ): Promise<void> {
        if (selectedWorkout === null || saveToLibrarySection === null) {
            return
        }

        const block = currentSectionBlock(selectedWorkout, saveToLibrarySection)
        if (block === null) {
            return
        }

        await saveBlock({
            name,
            description,
            sectionType: saveToLibrarySection,
            content: JSON.stringify(block.intervals),
            durationSeconds: block.durationSeconds,
            intervalCount: block.intervalCount,
        })

        await reloadBlocks()
        setSaveToLibrarySection(null)
    }

    /**
     * Opens the replace modal for the given section.
     */
    function handleReplaceSection(sectionType: SectionType): void {
        setReplaceSectionType(sectionType)
        setReplaceError(null)
    }

    /**
     * Replaces the targeted section with the chosen library block, applies
     * the updated workout to the canvas, and closes the modal.
     */
    async function handleConfirmReplace(blockId: string): Promise<void> {
        if (selectedWorkoutId === null || replaceSectionType === null) {
            return
        }

        setIsReplacing(true)
        setReplaceError(null)

        try {
            const updated = await replaceWorkoutSection(selectedWorkoutId, {
                sectionType: replaceSectionType,
                blockId,
            })
            applySelectedWorkoutUpdate(updated)
            setReplaceSectionType(null)
        } catch (err) {
            setReplaceError(err instanceof Error ? err.message : 'Failed to replace section.')
        } finally {
            setIsReplacing(false)
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
                            onClick={() => { handleClearSelection(); void signOut() }}
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

                    <div className="flex items-center gap-3">
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
                        <button
                            onClick={() => setIsZonePresetSettingsOpen(true)}
                            className={`
                                px-4 py-2
                                bg-zinc-700 text-white
                                text-sm font-medium
                                rounded-md
                                hover:bg-zinc-600 transition-colors
                            `}
                        >
                            Zone presets
                        </button>
                    </div>

                    {selectedWorkoutIds.length > 1 && (
                        <BulkActionsToolbar
                            selectedCount={selectedWorkoutIds.length}
                            onClearSelection={handleClearSelection}
                        />
                    )}

                    <WorkoutList
                        workouts={savedWorkouts}
                        isLoading={isLoadingWorkouts}
                        error={workoutsError}
                        selectedWorkoutId={selectedWorkoutId}
                        selectedWorkoutIds={selectedWorkoutIds}
                        onSelect={setSelectedWorkoutId}
                        onToggleSelect={handleToggleWorkoutSelect}
                    />

                    {selectedWorkout !== null && (
                        <WorkoutMetadataEditor
                            key={selectedWorkout.id}
                            workout={selectedWorkout}
                            onSave={(next) => void handleSaveMetadata(next)}
                            isSaving={isSavingMetadata}
                        />
                    )}

                    <WorkoutCanvas
                        workout={selectedWorkout}
                        isLoading={isLoadingSelectedWorkout}
                        error={selectedWorkoutError}
                        onUndoSection={(section) => void handleUndoSection(section)}
                        isUndoing={isUndoing}
                        onAddZonePreset={handleAddZonePreset}
                        zonePresets={zonePresets}
                        onOpenAddBlock={(section) => setAddBlockSection(section)}
                        onSelectInterval={(section, index) =>
                            setSelectedInterval({ sectionType: section, intervalIndex: index })
                        }
                        selectedInterval={selectedInterval}
                        onSaveToLibrary={(section) => setSaveToLibrarySection(section)}
                        onReplaceSection={handleReplaceSection}
                    />

                    {selectedWorkout !== null && (
                        <IntervalListEditor
                            workout={selectedWorkout}
                            onReorder={handleReorderIntervals}
                            onDelete={(section, index) => {
                                handleDeleteInterval(section, index)
                                if (
                                    selectedInterval?.sectionType === section
                                    && selectedInterval.intervalIndex === index
                                ) {
                                    setSelectedInterval(null)
                                }
                            }}
                            onSelect={(section, index) =>
                                setSelectedInterval({ sectionType: section, intervalIndex: index })
                            }
                            selectedInterval={selectedInterval}
                        />
                    )}

                    {selectedWorkout !== null && (
                        <TextEventEditor
                            events={selectedWorkout.textEvents}
                            onChange={(next) => void handleSaveTextEvents(next)}
                            isSaving={isSavingMetadata}
                        />
                    )}

                    {selectedWorkout !== null && selectedInterval !== null && (
                        <IntervalEditor
                            workout={selectedWorkout}
                            selection={selectedInterval}
                            onChange={handleUpdateInterval}
                            onClose={() => setSelectedInterval(null)}
                            onDelete={(section, index) => {
                                handleDeleteInterval(section, index)
                                setSelectedInterval(null)
                            }}
                        />
                    )}

                    {metadataError && (
                        <p className="px-4 py-2 bg-red-900/40 text-red-300 text-sm rounded-md">
                            {metadataError}
                        </p>
                    )}

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

                    <BlockLibrary
                        blocks={libraryBlocks}
                        isLoading={isLoadingBlocks}
                        error={blocksError}
                        onCreateBlock={() => setIsCreateBlockOpen(true)}
                        onDeleteBlock={deleteLibraryBlock}
                    />

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

            <AddBlockModal
                isOpen={addBlockSection !== null}
                sectionType={addBlockSection}
                onClose={() => setAddBlockSection(null)}
                onConfirm={(section, interval) => handleAddInterval(section, interval)}
            />

            <SaveToLibraryModal
                isOpen={saveToLibrarySection !== null}
                sectionType={saveToLibrarySection}
                onClose={() => setSaveToLibrarySection(null)}
                onConfirm={(name, description) => handleConfirmSaveToLibrary(name, description)}
            />

            <ReplaceWithBlockModal
                key={replaceSectionType}
                isOpen={replaceSectionType !== null}
                sectionType={replaceSectionType}
                blocks={libraryBlocks}
                isReplacing={isReplacing}
                error={replaceError}
                onClose={() => setReplaceSectionType(null)}
                onConfirm={(blockId) => void handleConfirmReplace(blockId)}
            />

            <CreateBlockModal
                isOpen={isCreateBlockOpen}
                onClose={() => setIsCreateBlockOpen(false)}
                onSaved={() => void reloadBlocks()}
            />

            <ZonePresetSettings
                isOpen={isZonePresetSettingsOpen}
                onClose={() => setIsZonePresetSettingsOpen(false)}
                presets={zonePresets}
                onSave={saveEffectiveZonePreset}
                onReset={resetEffectiveZonePreset}
            />

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