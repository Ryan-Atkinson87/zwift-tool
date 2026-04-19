import { useEffect, useState, type JSX } from 'react'
import { AppFooter } from './components/ui/AppFooter.tsx'
import { SignInModal } from './components/auth/SignInModal.tsx'
import { SignUpModal } from './components/auth/SignUpModal.tsx'
import { FileUploader } from './components/import/FileUploader.tsx'
import { IntervalList } from './components/import/IntervalList.tsx'
import { SectionSplitter, type SectionSplit } from './components/import/SectionSplitter.tsx'
import { DuplicateNameModal } from './components/import/DuplicateNameModal.tsx'
import { useAuth } from './hooks/useAuth.ts'
import { useWorkouts } from './hooks/useWorkouts.ts'
import { useWorkout } from './hooks/useWorkout.ts'
import { WorkoutList } from './components/workout/WorkoutList.tsx'
import { WorkoutCanvas } from './components/workout/WorkoutCanvas.tsx'
import { WorkoutMetadataEditor } from './components/workout/WorkoutMetadataEditor.tsx'
import { TextEventEditor } from './components/workout/TextEventEditor.tsx'
import { WorkoutIntervalTable } from './components/workout/WorkoutIntervalTable.tsx'
import { ZonePresetSettings } from './components/workout/ZonePresetSettings.tsx'
import { BlockLibrary } from './components/blocks/BlockLibrary.tsx'
import { SaveToLibraryModal } from './components/blocks/SaveToLibraryModal.tsx'
import { ReplaceWithBlockModal } from './components/blocks/ReplaceWithBlockModal.tsx'
import { BulkReplaceModal } from './components/blocks/BulkReplaceModal.tsx'
import { CreateBlockModal } from './components/blocks/CreateBlockModal.tsx'
import { saveWorkout, deleteWorkout, undoWorkoutSection, updateWorkoutMetadata, replaceWorkoutSection, bulkReplaceSection, exportWorkout, exportWorkouts, updateWorkoutSection, type UpdateWorkoutSectionRequest } from './api/workouts'
import { saveBlock, type LibraryBlock } from './api/blocks'
import { useWorkoutAutosave } from './hooks/useWorkoutAutosave.ts'
import { useZonePresets } from './hooks/useZonePresets.ts'
import { useBlocks } from './hooks/useBlocks.ts'
import type { BlockDetail, ParsedWorkout, ParsedInterval, SectionType, TextEvent, WorkoutDetail } from './types/workout'
import { buildSectionDraft, currentSectionBlock, sumIntervalDuration as sumDuration } from './utils/editorDraft'
import { downloadGuestWorkout } from './utils/zwoExporter'

/**
 * Root application component. Renders the top-level layout, auth flow, and
 * the workout editor. Supports both authenticated use (full persistence) and
 * guest use (client-side only, no account required).
 *
 * Guest mode is activated from the landing screen. In guest mode, all editing
 * operations update local React state directly rather than calling the backend.
 * Gated actions (save, block library, bulk replace) prompt the user to sign in.
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
    const [isSelectMode, setIsSelectMode] = useState(false)
    const [isLeftCollapsed, setIsLeftCollapsed] = useState(false)
    const [isRightCollapsed, setIsRightCollapsed] = useState(false)

    // Guest mode: true once the user has chosen to use the tool without signing in
    const [guestMode, setGuestMode] = useState(false)
    // The active workout in guest mode, held entirely in local state
    const [guestWorkout, setGuestWorkout] = useState<WorkoutDetail | null>(null)

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
    const [selectedInterval, setSelectedInterval] = useState<{
        sectionType: SectionType
        intervalIndex: number
    } | null>(null)
    const [isZonePresetSettingsOpen, setIsZonePresetSettingsOpen] = useState(false)
    const {
        presets: zonePresets,
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
    const [editingBlock, setEditingBlock] = useState<LibraryBlock | null>(null)
    const [isReplacing, setIsReplacing] = useState(false)
    const [replaceError, setReplaceError] = useState<string | null>(null)
    const [isBulkReplaceOpen, setIsBulkReplaceOpen] = useState(false)
    const [isBulkReplacing, setIsBulkReplacing] = useState(false)
    const [bulkReplaceError, setBulkReplaceError] = useState<string | null>(null)
    const [isExporting, setIsExporting] = useState(false)
    const [exportError, setExportError] = useState<string | null>(null)
    const [pendingClashes, setPendingClashes] = useState<Array<{ incoming: ParsedWorkout; existingId: string }>>([])
    const currentClash = pendingClashes[0] ?? null

    // The workout driving the editor canvas. In authenticated mode this is the
    // backend-fetched selected workout; in guest mode it is the locally-held
    // guest workout built from the section splitter or the blank-workout helper.
    const activeWorkout: WorkoutDetail | null = isAuthenticated ? selectedWorkout : guestWorkout

    // Clear the selected interval whenever the user switches workout so a
    // stale index from a previous workout cannot leak into the editor.
    useEffect(() => {
        setSelectedInterval(null)
    }, [selectedWorkoutId, guestWorkout?.id])

    // When the user signs in from guest mode, clear the guest state so the
    // three-panel layout switches to the authenticated view cleanly.
    useEffect(() => {
        if (isAuthenticated) {
            setGuestMode(false)
            setGuestWorkout(null)
            setParsedWorkouts([])
            setSplittingWorkout(null)
        }
    }, [isAuthenticated])

    // Auto-save loop. In guest mode selectedWorkout is null so this hook is
    // effectively inactive — guest edits update guestWorkout directly instead.
    const {
        queueSectionUpdate,
        status: autosaveStatus,
        error: autosaveError,
    } = useWorkoutAutosave(selectedWorkout, applySelectedWorkoutUpdate)

    // Derive whether sign-in modal should show from session expiry or explicit open
    const showSignIn = isSignInOpen || sessionExpired

    // Whether the three-panel editor layout is visible
    const showEditor = isAuthenticated || guestMode

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

    async function handleDeleteWorkout(workoutId: string): Promise<void> {
        try {
            await deleteWorkout(workoutId)
            if (selectedWorkoutId === workoutId) {
                setSelectedWorkoutId(null)
            }
            void reloadWorkouts()
        } catch (err) {
            console.error('Failed to delete workout:', err)
        }
    }

    function handleFilesParsed(workouts: ParsedWorkout[]): void {
        setSaveSuccess(null)
        setSaveError(null)

        if (!isAuthenticated) {
            // Guest mode: no saved workouts to clash with
            setParsedWorkouts(workouts)
            if (workouts.length === 1) setSplittingWorkout(workouts[0])
            return
        }

        const clashes: Array<{ incoming: ParsedWorkout; existingId: string }> = []
        const nonClashing: ParsedWorkout[] = []

        for (const workout of workouts) {
            const existing = savedWorkouts.find((w) => w.name === workout.name)
            if (existing) {
                clashes.push({ incoming: workout, existingId: existing.id })
            } else {
                nonClashing.push(workout)
            }
        }

        // Add non-clashing workouts to the import queue immediately
        setParsedWorkouts((prev) => [...prev, ...nonClashing])
        if (clashes.length === 0 && nonClashing.length === 1) {
            setSplittingWorkout(nonClashing[0])
        }

        if (clashes.length > 0) {
            setPendingClashes(clashes)
        }
    }

    function resolveClash(resolvedWorkout: ParsedWorkout | null): void {
        setPendingClashes((prev) => {
            const remaining = prev.slice(1)
            // When the last clash is resolved, auto-start split if it produced one workout
            if (remaining.length === 0 && resolvedWorkout !== null) {
                setParsedWorkouts((current) => {
                    const updated = [...current, resolvedWorkout]
                    if (updated.length === 1) setSplittingWorkout(updated[0])
                    return updated
                })
            } else if (resolvedWorkout !== null) {
                setParsedWorkouts((current) => [...current, resolvedWorkout])
            }
            return remaining
        })
    }

    function handleClashRename(newName: string): void {
        if (currentClash === null) return
        resolveClash({ ...currentClash.incoming, name: newName })
    }

    async function handleClashReplace(): Promise<void> {
        if (currentClash === null) return
        await deleteWorkout(currentClash.existingId)
        await reloadWorkouts()
        resolveClash(currentClash.incoming)
    }

    function handleClashCancel(): void {
        resolveClash(null)
    }

    function handleStartSplit(workout: ParsedWorkout): void {
        setSplittingWorkout(workout)
        setSaveSuccess(null)
        setSaveError(null)
    }

    async function handleConfirmSplit(split: SectionSplit): Promise<void> {
        setSaveError(null)

        if (!isAuthenticated) {
            // Guest mode: build a local WorkoutDetail from the split without
            // saving to the backend. All subsequent edits update guestWorkout directly.
            const now = new Date().toISOString()
            const makeBlock = (
                intervals: ParsedInterval[],
                sectionType: SectionType,
                name: string,
            ): BlockDetail => ({
                id: `guest-${sectionType.toLowerCase()}`,
                name,
                description: null,
                sectionType,
                intervals,
                durationSeconds: sumDuration(intervals),
                intervalCount: intervals.length,
                isLibraryBlock: false,
            })

            setGuestWorkout({
                id: crypto.randomUUID(),
                name: split.workout.name,
                author: split.workout.author,
                description: split.workout.description,
                warmupBlock: split.warmupIntervals.length > 0
                    ? makeBlock(split.warmupIntervals, 'WARMUP', 'Warm-Up') : null,
                mainsetBlock: makeBlock(split.mainsetIntervals, 'MAINSET', 'Main Set'),
                cooldownBlock: split.cooldownIntervals.length > 0
                    ? makeBlock(split.cooldownIntervals, 'COOLDOWN', 'Cool-Down') : null,
                hasPrevWarmup: false,
                hasPrevMainset: false,
                hasPrevCooldown: false,
                isDraft: true,
                textEvents: [],
                createdAt: now,
                updatedAt: now,
            })

            setSplittingWorkout(null)
            setParsedWorkouts((prev) =>
                prev.filter((w) => w.fileName !== split.workout.fileName)
            )
            return
        }

        setIsSaving(true)

        try {
            await saveWorkout({
                name: split.workout.name,
                author: split.workout.author,
                description: split.workout.description,
                tags: split.workout.tags,
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
     *
     * In guest mode, updates the local guest workout directly without any
     * backend call.
     */
    async function handleSaveMetadata(next: {
        name: string
        author: string | null
        description: string | null
    }): Promise<void> {
        if (!isAuthenticated && guestWorkout !== null) {
            setGuestWorkout({ ...guestWorkout, ...next, updatedAt: new Date().toISOString() })
            return
        }

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
     *
     * In guest mode, updates the local guest workout directly.
     */
    async function handleSaveTextEvents(nextEvents: TextEvent[]): Promise<void> {
        if (!isAuthenticated && guestWorkout !== null) {
            setGuestWorkout({ ...guestWorkout, textEvents: nextEvents })
            return
        }

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
     *
     * In guest mode, updates the local guest workout directly and skips the
     * auto-save queue (there is no backend record to save to).
     */
    function commitSectionIntervals(
        sectionType: SectionType,
        nextIntervals: ParsedInterval[],
    ): void {
        if (!isAuthenticated && guestWorkout !== null) {
            const draft = buildSectionDraft(guestWorkout, sectionType, nextIntervals)
            setGuestWorkout(draft.patchedWorkout)
            return
        }

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
     * Inserts a new interval into the chosen section at the given index. If
     * {@code insertIndex} is equal to the section's interval count, the
     * interval is appended. Called by the palette drag-and-drop system.
     *
     * @param sectionType  the section to insert into
     * @param interval     the fully-populated interval to add
     * @param insertIndex  0-based index before which to insert
     */
    function handleAddInterval(sectionType: SectionType, interval: ParsedInterval, insertIndex: number): void {
        if (activeWorkout === null) {
            return
        }
        const currentBlock = currentSectionBlock(activeWorkout, sectionType)
        const existing = currentBlock?.intervals ?? []
        const idx = Math.min(insertIndex, existing.length)
        const nextIntervals = [...existing.slice(0, idx), interval, ...existing.slice(idx)]
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
        if (activeWorkout === null) {
            return
        }
        const currentBlock = currentSectionBlock(activeWorkout, sectionType)
        if (currentBlock === null) {
            return
        }
        const nextIntervals = currentBlock.intervals.map((interval, i) =>
            i === index ? next : interval,
        )
        commitSectionIntervals(sectionType, nextIntervals)
    }

    /**
     * Applies a canvas resize drag result to an interval. For SteadyState intervals,
     * receives the new duration and power and updates both fields. For ramp intervals
     * (Warmup, Cooldown, Ramp), only the duration is updated; power values are left
     * unchanged to avoid rounding corruption of start/end power fractions.
     */
    function handleResizeInterval(
        sectionType: SectionType,
        index: number,
        durationSeconds: number,
        powerPercent: number,
    ): void {
        if (activeWorkout === null) {
            return
        }
        const currentBlock = currentSectionBlock(activeWorkout, sectionType)
        if (currentBlock === null) {
            return
        }
        const original = currentBlock.intervals[index]
        if (original === undefined) {
            return
        }
        const isRamp =
            original.type === 'Warmup' ||
            original.type === 'Cooldown' ||
            original.type === 'Ramp'
        // Ramps store two power values (power + powerHigh); updating only duration
        // preserves the ramp shape. Flat bars use powerPercent to set a single power.
        const next: ParsedInterval = isRamp
            ? { ...original, durationSeconds }
            : { ...original, durationSeconds, power: powerPercent / 100 }
        handleUpdateInterval(sectionType, index, next)
    }

    /**
     * Removes a single interval from a section. Deleting the last interval
     * in the main set is blocked because the main set is mandatory and the
     * editor must always have at least one interval to anchor.
     */
    function handleDeleteInterval(sectionType: SectionType, index: number): void {
        if (activeWorkout === null) {
            return
        }
        const currentBlock = currentSectionBlock(activeWorkout, sectionType)
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
        if (activeWorkout === null) {
            return
        }
        const currentBlock = currentSectionBlock(activeWorkout, sectionType)
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
     * Moves a single interval from one section to another via canvas drag.
     * Removes the interval from the source section at {@code fromIndex} and
     * inserts it into the target section before {@code toIndex}. Both
     * sections are updated via the auto-save queue.
     *
     * <p>Blocked when the move would leave the main set empty.</p>
     */
    function handleMoveInterval(
        fromSection: SectionType,
        fromIndex: number,
        toSection: SectionType,
        toIndex: number,
    ): void {
        if (activeWorkout === null) {
            return
        }
        const fromBlock = currentSectionBlock(activeWorkout, fromSection)
        if (fromBlock === null) {
            return
        }
        const interval = fromBlock.intervals[fromIndex]
        if (interval === undefined) {
            return
        }
        const newFromIntervals = fromBlock.intervals.filter((_, i) => i !== fromIndex)
        // The main set must always keep at least one interval
        if (fromSection === 'MAINSET' && newFromIntervals.length === 0) {
            return
        }
        const toBlock = currentSectionBlock(activeWorkout, toSection)
        const toIntervals = toBlock?.intervals ?? []
        const clampedIndex = Math.min(toIndex, toIntervals.length)
        const newToIntervals = [
            ...toIntervals.slice(0, clampedIndex),
            interval,
            ...toIntervals.slice(clampedIndex),
        ]
        commitSectionIntervals(fromSection, newFromIntervals)
        commitSectionIntervals(toSection, newToIntervals)
    }

    /**
     * Saves a moved section boundary by persisting the re-partitioned
     * interval arrays for all three sections. Unlike regular auto-saves,
     * this involves two sequential PUT calls (one per affected section),
     * so it calls the API directly rather than going through the auto-save
     * queue to avoid the second call overwriting the first.
     *
     * In guest mode, updates the local guest workout directly for all three
     * sections without any backend calls.
     *
     * <p>If the first call fails the second is not attempted. If the
     * second call fails after the first succeeds, an error is shown and
     * the user can retry via the undo controls.</p>
     */
    async function handleSaveBoundaries(
        warmupIntervals: ParsedInterval[],
        mainsetIntervals: ParsedInterval[],
        cooldownIntervals: ParsedInterval[],
    ): Promise<void> {
        if (activeWorkout === null) {
            return
        }

        if (!isAuthenticated && guestWorkout !== null) {
            const makeBlock = (
                intervals: ParsedInterval[],
                sectionType: SectionType,
                name: string,
            ): BlockDetail => ({
                id: `guest-${sectionType.toLowerCase()}`,
                name,
                description: null,
                sectionType,
                intervals,
                durationSeconds: sumDuration(intervals),
                intervalCount: intervals.length,
                isLibraryBlock: false,
            })

            setGuestWorkout({
                ...guestWorkout,
                warmupBlock: warmupIntervals.length > 0
                    ? makeBlock(warmupIntervals, 'WARMUP', 'Warm-Up') : null,
                mainsetBlock: makeBlock(mainsetIntervals, 'MAINSET', 'Main Set'),
                cooldownBlock: cooldownIntervals.length > 0
                    ? makeBlock(cooldownIntervals, 'COOLDOWN', 'Cool-Down') : null,
                updatedAt: new Date().toISOString(),
            })
            return
        }

        if (selectedWorkout === null || selectedWorkoutId === null) {
            return
        }

        setIsSaving(true)
        setSaveError(null)

        try {
            const warmupDraft = buildSectionDraft(selectedWorkout, 'WARMUP', warmupIntervals)
            const warmupRequest: UpdateWorkoutSectionRequest = {
                sectionType: 'WARMUP',
                content: warmupDraft.content,
                durationSeconds: warmupDraft.durationSeconds,
                intervalCount: warmupDraft.intervalCount,
            }
            const afterWarmup = await updateWorkoutSection(selectedWorkoutId, warmupRequest)
            applySelectedWorkoutUpdate(afterWarmup)

            const mainsetDraft = buildSectionDraft(afterWarmup, 'MAINSET', mainsetIntervals)
            const mainsetRequest: UpdateWorkoutSectionRequest = {
                sectionType: 'MAINSET',
                content: mainsetDraft.content,
                durationSeconds: mainsetDraft.durationSeconds,
                intervalCount: mainsetDraft.intervalCount,
            }
            const afterMainset = await updateWorkoutSection(selectedWorkoutId, mainsetRequest)
            applySelectedWorkoutUpdate(afterMainset)

            // Only send a cooldown request when the cooldown actually changed
            const currentCooldown = selectedWorkout.cooldownBlock?.intervals ?? []
            if (JSON.stringify(cooldownIntervals) !== JSON.stringify(currentCooldown)) {
                const cooldownDraft = buildSectionDraft(afterMainset, 'COOLDOWN', cooldownIntervals)
                const cooldownRequest: UpdateWorkoutSectionRequest = {
                    sectionType: 'COOLDOWN',
                    content: cooldownDraft.content,
                    durationSeconds: cooldownDraft.durationSeconds,
                    intervalCount: cooldownDraft.intervalCount,
                }
                const afterCooldown = await updateWorkoutSection(selectedWorkoutId, cooldownRequest)
                applySelectedWorkoutUpdate(afterCooldown)
            }
        } catch (error) {
            setSaveError(
                error instanceof Error ? error.message : 'Failed to save boundary change.',
            )
        } finally {
            setIsSaving(false)
        }
    }

    /**
     * Creates a new blank draft workout. In authenticated mode, saves to the
     * backend and selects the new workout. In guest mode, creates a local
     * WorkoutDetail with an empty main set block and no warm-up or cool-down.
     */
    async function handleCreateBlankWorkout(): Promise<void> {
        setSaveError(null)
        setSaveSuccess(null)

        if (!isAuthenticated) {
            const now = new Date().toISOString()
            setGuestWorkout({
                id: crypto.randomUUID(),
                name: 'New Workout',
                author: null,
                description: null,
                warmupBlock: null,
                mainsetBlock: {
                    id: 'guest-mainset',
                    name: 'Main Set',
                    description: null,
                    sectionType: 'MAINSET',
                    intervals: [],
                    durationSeconds: 0,
                    intervalCount: 0,
                    isLibraryBlock: false,
                },
                cooldownBlock: null,
                hasPrevWarmup: false,
                hasPrevMainset: false,
                hasPrevCooldown: false,
                isDraft: true,
                textEvents: [],
                createdAt: now,
                updatedAt: now,
            })
            return
        }

        setIsSaving(true)

        try {
            const created = await saveWorkout({
                name: 'New Workout',
                author: null,
                description: null,
                tags: null,
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
     *
     * Unauthenticated users are shown the sign-in modal instead.
     */
    async function handleConfirmSaveToLibrary(
        name: string,
        description: string | null,
    ): Promise<void> {
        if (activeWorkout === null || saveToLibrarySection === null) {
            return
        }

        const block = currentSectionBlock(activeWorkout, saveToLibrarySection)
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
     * Opens the replace modal for the given section. In guest mode, opens
     * the sign-in modal instead — replacing sections requires library access.
     */
    function handleReplaceSection(sectionType: SectionType): void {
        if (!isAuthenticated) {
            setIsSignInOpen(true)
            return
        }
        setReplaceSectionType(sectionType)
        setReplaceError(null)
    }

    /**
     * Opens the save-to-library modal for the given section. In guest mode,
     * opens the sign-in modal instead — saving to the library requires an account.
     */
    function handleSaveToLibrary(sectionType: SectionType): void {
        if (!isAuthenticated) {
            setIsSignInOpen(true)
            return
        }
        setSaveToLibrarySection(sectionType)
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

    /**
     * Bulk-replaces the same section across all selected workouts using the
     * chosen library block, then downloads the updated .zwo files as a zip.
     * Clears the selection and closes the modal on success.
     */
    async function handleConfirmBulkReplace(sectionType: SectionType, blockId: string, download: boolean): Promise<void> {
        setIsBulkReplacing(true)
        setBulkReplaceError(null)

        try {
            await bulkReplaceSection({
                workoutIds: selectedWorkoutIds,
                sectionType,
                blockId,
            }, download)
            setIsBulkReplaceOpen(false)
            setBulkReplaceError(null)
            setSelectedWorkoutIds([])
            void reloadWorkouts()
        } catch (err) {
            setBulkReplaceError(
                err instanceof Error ? err.message : 'Failed to bulk replace section.',
            )
        } finally {
            setIsBulkReplacing(false)
        }
    }

    /**
     * Exports the active workout as a .zwo file. In guest mode, generates
     * the XML client-side and triggers a browser download directly. In
     * authenticated mode, fetches the exported file from the backend.
     */
    async function handleExportWorkout(): Promise<void> {
        if (!isAuthenticated && guestWorkout !== null) {
            downloadGuestWorkout(guestWorkout)
            return
        }

        if (selectedWorkoutId === null || selectedWorkout === null) {
            return
        }

        setIsExporting(true)
        setExportError(null)
        try {
            await exportWorkout(selectedWorkoutId, selectedWorkout.name)
        } catch (err) {
            setExportError(err instanceof Error ? err.message : 'Failed to export workout.')
        } finally {
            setIsExporting(false)
        }
    }

    /**
     * Exports a set of workouts as a zip archive. When called from the
     * bulk actions toolbar, only the checked workouts are included. When
     * called from the "Export all" button, all saved workouts are included.
     *
     * @param workoutIds the IDs to include in the zip
     */
    async function handleExportSelected(workoutIds: string[]): Promise<void> {
        if (workoutIds.length === 0) {
            return
        }
        setIsExporting(true)
        setExportError(null)
        try {
            await exportWorkouts(workoutIds)
        } catch (err) {
            setExportError(err instanceof Error ? err.message : 'Failed to export workouts.')
        } finally {
            setIsExporting(false)
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
        <div className="flex flex-col h-screen bg-zinc-900 text-white overflow-hidden">

            {/* ── Header ── */}
            <header className="flex items-center justify-between shrink-0 px-4 py-3 border-b border-zinc-700">
                <h1 className="text-lg font-bold">Zwift Tool</h1>
                {isAuthenticated ? (
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-zinc-300">
                            Signed in as <span className="text-white font-medium">{user?.email}</span>
                        </span>
                        <button
                            onClick={() => { handleClearSelection(); void signOut() }}
                            className={`
                                px-3 py-1.5
                                bg-zinc-700 text-white
                                text-sm font-medium
                                rounded-md
                                hover:bg-zinc-600 transition-colors
                                focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900
                            `}
                        >
                            Sign out
                        </button>
                        {savedWorkouts.length > 0 && (
                            <button
                                onClick={() => void handleExportSelected(savedWorkouts.map((w) => w.id))}
                                disabled={isExporting}
                                className={`
                                    px-3 py-1.5
                                    bg-zinc-700 text-white
                                    text-sm font-medium
                                    rounded-md
                                    hover:bg-zinc-600 transition-colors
                                    focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                `}
                            >
                                {isExporting ? 'Exporting...' : 'Export all'}
                            </button>
                        )}
                        <button
                            onClick={() => setIsZonePresetSettingsOpen(true)}
                            className={`
                                px-3 py-1.5
                                bg-zinc-700 text-white
                                text-sm font-medium
                                rounded-md
                                hover:bg-zinc-600 transition-colors
                                focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900
                            `}
                        >
                            Zone presets
                        </button>
                    </div>
                ) : guestMode ? (
                    // In guest mode show compact auth controls so the user can sign
                    // in at any point without leaving the editor
                    <div className="flex gap-3">
                        <button
                            onClick={() => setIsSignInOpen(true)}
                            className={`
                                px-4 py-1.5
                                bg-brand-600 text-white
                                text-sm font-medium
                                rounded-md
                                hover:bg-brand-500 transition-colors
                                focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900
                            `}
                        >
                            Sign in
                        </button>
                        <button
                            onClick={() => setIsSignUpOpen(true)}
                            className={`
                                px-4 py-1.5
                                bg-zinc-700 text-white
                                text-sm font-medium
                                rounded-md
                                hover:bg-zinc-600 transition-colors
                                focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900
                            `}
                        >
                            Sign up
                        </button>
                    </div>
                ) : null}
            </header>

            {/* ── Three-panel body or landing ── */}
            {showEditor ? (
                <div className="flex flex-1 overflow-hidden">

                    {/* Left panel: workout list */}
                    {isLeftCollapsed ? (
                        <aside className="w-10 shrink-0 border-r border-zinc-700 flex flex-col items-center py-3">
                            <button
                                onClick={() => setIsLeftCollapsed(false)}
                                aria-label="Expand workout list"
                                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                    <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 1 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </aside>
                    ) : (
                        <aside className="w-72 shrink-0 border-r border-zinc-700 flex flex-col overflow-y-auto p-3 gap-3">
                            <div className="flex justify-end">
                                <button
                                    onClick={() => setIsLeftCollapsed(true)}
                                    aria-label="Collapse workout list"
                                    className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                        <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>

                            <button
                                onClick={() => void handleCreateBlankWorkout()}
                                disabled={isSaving}
                                className={`
                                    w-full px-4 py-2
                                    bg-brand-600 text-white
                                    text-sm font-medium
                                    rounded-md
                                    hover:bg-brand-500 transition-colors
                                    focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                `}
                            >
                                New workout
                            </button>

                            <FileUploader onFilesParsed={handleFilesParsed} />

                            {isAuthenticated && (
                                <WorkoutList
                                    workouts={savedWorkouts}
                                    isLoading={isLoadingWorkouts}
                                    error={workoutsError}
                                    selectedWorkoutId={selectedWorkoutId}
                                    selectedWorkoutIds={selectedWorkoutIds}
                                    isSelectMode={isSelectMode}
                                    isExporting={isExporting}
                                    onSelect={setSelectedWorkoutId}
                                    onToggleSelect={handleToggleWorkoutSelect}
                                    onSelectModeChange={setIsSelectMode}
                                    onClearSelection={handleClearSelection}
                                    onBulkReplace={() => {
                                        setBulkReplaceError(null)
                                        setIsBulkReplaceOpen(true)
                                    }}
                                    onExportSelected={() => void handleExportSelected(selectedWorkoutIds)}
                                    onSelectAll={setSelectedWorkoutIds}
                                    onDeleteWorkout={(id) => void handleDeleteWorkout(id)}
                                />
                            )}

                            {saveSuccess && (
                                <p className="px-3 py-2 bg-green-900/40 text-green-300 text-sm rounded-md">
                                    {saveSuccess}
                                </p>
                            )}

                            {saveError && (
                                <p className="px-3 py-2 bg-red-900/40 text-red-300 text-sm rounded-md">
                                    {saveError}
                                </p>
                            )}
                        </aside>
                    )}

                    {/* Centre panel: canvas and editors */}
                    <main className="flex-1 flex flex-col overflow-y-auto p-4 gap-4">
                        {activeWorkout !== null && (
                            <WorkoutMetadataEditor
                                key={activeWorkout.id}
                                workout={activeWorkout}
                                onSave={(next) => void handleSaveMetadata(next)}
                                isSaving={isSavingMetadata}
                                onExport={() => void handleExportWorkout()}
                                isExporting={isExporting}
                            />
                        )}

                        {exportError !== null && (
                            <p className="text-sm text-red-300">{exportError}</p>
                        )}

                        <WorkoutCanvas
                            workout={activeWorkout}
                            isLoading={isAuthenticated ? isLoadingSelectedWorkout : false}
                            error={isAuthenticated ? selectedWorkoutError : null}
                            onUndoSection={isAuthenticated
                                ? (section) => void handleUndoSection(section)
                                : undefined}
                            isUndoing={isUndoing}
                            zonePresets={zonePresets}
                            onAddInterval={handleAddInterval}
                            onSelectInterval={(section, index) =>
                                setSelectedInterval({ sectionType: section, intervalIndex: index })
                            }
                            selectedInterval={selectedInterval}
                            onSaveToLibrary={handleSaveToLibrary}
                            onReplaceSection={handleReplaceSection}
                            onReorderInterval={handleReorderIntervals}
                            onMoveInterval={handleMoveInterval}
                            onSaveBoundaries={(wu, ms, cd) =>
                                void handleSaveBoundaries(wu, ms, cd)
                            }
                            onResizeInterval={handleResizeInterval}
                            onUpdateInterval={handleUpdateInterval}
                            onDeleteInterval={(section, index) => {
                                handleDeleteInterval(section, index)
                                setSelectedInterval(null)
                            }}
                            onMoveTextEvent={(eventIndex, newOffsetSeconds) => {
                                if (activeWorkout === null) return
                                const updated = activeWorkout.textEvents.map((ev, i) =>
                                    i === eventIndex
                                        ? { ...ev, timeOffsetSeconds: newOffsetSeconds }
                                        : ev,
                                )
                                void handleSaveTextEvents(updated)
                            }}
                        />

                        {activeWorkout !== null && (
                            <TextEventEditor
                                events={activeWorkout.textEvents}
                                onChange={(next) => void handleSaveTextEvents(next)}
                                isSaving={isSavingMetadata}
                            />
                        )}

                        {activeWorkout !== null && (
                            <WorkoutIntervalTable
                                workout={activeWorkout}
                                onUpdate={handleUpdateInterval}
                                onDelete={handleDeleteInterval}
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

                        {isAuthenticated && autosaveStatus === 'error' && autosaveError && (
                            <p className="px-4 py-2 bg-red-900/40 text-red-300 text-sm rounded-md">
                                Auto-save failed: {autosaveError}
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
                    </main>

                    {/* Right panel: block library */}
                    {isRightCollapsed ? (
                        <aside className="w-10 shrink-0 border-l border-zinc-700 flex flex-col items-center py-3">
                            <button
                                onClick={() => setIsRightCollapsed(false)}
                                aria-label="Expand block library"
                                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                    <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </aside>
                    ) : (
                        <aside className="w-80 shrink-0 border-l border-zinc-700 flex flex-col overflow-y-auto p-3 gap-3">
                            <div className="flex justify-start">
                                <button
                                    onClick={() => setIsRightCollapsed(true)}
                                    aria-label="Collapse block library"
                                    className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                        <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 1 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>

                            {isAuthenticated ? (
                                <>
                                    <button
                                        onClick={() => setIsCreateBlockOpen(true)}
                                        className={`
                                            w-full px-4 py-2
                                            bg-brand-600 text-white
                                            text-sm font-medium
                                            rounded-md
                                            hover:bg-brand-500 transition-colors
                                            focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900
                                        `}
                                    >
                                        + New block
                                    </button>

                                    <BlockLibrary
                                        blocks={libraryBlocks}
                                        isLoading={isLoadingBlocks}
                                        error={blocksError}
                                        onEditBlock={(block) => setEditingBlock(block)}
                                        onDeleteBlock={deleteLibraryBlock}
                                    />
                                </>
                            ) : (
                                // Guest mode: locked block library panel
                                <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center px-4 py-8">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-zinc-600">
                                        <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
                                    </svg>
                                    <p className="text-sm text-zinc-400 leading-relaxed">
                                        Sign in to save your workouts and access the block library.
                                    </p>
                                    <button
                                        onClick={() => setIsSignInOpen(true)}
                                        className={`
                                            px-4 py-2
                                            bg-brand-600 text-white
                                            text-sm font-medium
                                            rounded-md
                                            hover:bg-brand-500 transition-colors
                                            focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900
                                        `}
                                    >
                                        Sign in
                                    </button>
                                    <button
                                        onClick={() => setIsSignUpOpen(true)}
                                        className={`
                                            px-4 py-2
                                            bg-zinc-700 text-white
                                            text-sm font-medium
                                            rounded-md
                                            hover:bg-zinc-600 transition-colors
                                            focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900
                                        `}
                                    >
                                        Create account
                                    </button>
                                </div>
                            )}
                        </aside>
                    )}
                </div>
            ) : (
                // Landing screen: shown before the user has signed in or chosen guest mode
                <div className="flex flex-1 items-center justify-center">
                    <div className="flex flex-col items-center gap-6 text-center max-w-sm px-6">
                        <div className="flex flex-col gap-1">
                            <p className="text-white text-base font-medium">Edit your Zwift workouts</p>
                            <p className="text-zinc-400 text-sm">
                                Upload, edit, and export .zwo files. Sign in to save workouts and access the block library.
                            </p>
                        </div>
                        <div className="flex flex-col gap-3 w-full">
                            <button
                                onClick={() => setIsSignInOpen(true)}
                                className={`
                                    w-full px-4 py-2.5
                                    bg-brand-600 text-white
                                    text-sm font-medium
                                    rounded-md
                                    hover:bg-brand-500 transition-colors
                                    focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900
                                `}
                            >
                                Sign in
                            </button>
                            <button
                                onClick={() => setIsSignUpOpen(true)}
                                className={`
                                    w-full px-4 py-2.5
                                    bg-zinc-700 text-white
                                    text-sm font-medium
                                    rounded-md
                                    hover:bg-zinc-600 transition-colors
                                    focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900
                                `}
                            >
                                Create account
                            </button>
                            <button
                                onClick={() => setGuestMode(true)}
                                className={`
                                    w-full px-4 py-2.5
                                    bg-transparent text-zinc-400
                                    text-sm font-medium
                                    rounded-md
                                    border border-zinc-700
                                    hover:text-white hover:border-zinc-500 transition-colors
                                    focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-zinc-900
                                `}
                            >
                                Continue without an account
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <AppFooter />

            <DuplicateNameModal
                isOpen={currentClash !== null}
                incomingName={currentClash?.incoming.name ?? ''}
                onRename={handleClashRename}
                onReplace={handleClashReplace}
                onCancel={handleClashCancel}
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
                key={editingBlock?.id ?? 'new'}
                isOpen={isCreateBlockOpen || editingBlock !== null}
                initialBlock={editingBlock}
                zonePresets={zonePresets}
                onClose={() => { setIsCreateBlockOpen(false); setEditingBlock(null) }}
                onSaved={() => { void reloadBlocks(); setIsCreateBlockOpen(false); setEditingBlock(null) }}
            />

            <BulkReplaceModal
                isOpen={isBulkReplaceOpen}
                selectedWorkoutIds={selectedWorkoutIds}
                workouts={savedWorkouts}
                blocks={libraryBlocks}
                isBulkReplacing={isBulkReplacing}
                error={bulkReplaceError}
                onClose={() => {
                    setIsBulkReplaceOpen(false)
                    setBulkReplaceError(null)
                }}
                onConfirm={(sectionType, blockId, download) => void handleConfirmBulkReplace(sectionType, blockId, download)}
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
                showGuestWarning={guestWorkout !== null}
            />
            <SignUpModal
                isOpen={isSignUpOpen}
                onClose={() => setIsSignUpOpen(false)}
                onSignUp={handleSignUp}
                showGuestWarning={guestWorkout !== null}
            />
        </div>
    )
}
