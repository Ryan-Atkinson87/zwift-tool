import { type JSX } from 'react'
import {
    DndContext,
    PointerSensor,
    KeyboardSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core'
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type {
    BlockDetail,
    ParsedInterval,
    SectionType,
    WorkoutDetail,
} from '../../types/workout'

interface Props {
    workout: WorkoutDetail
    /**
     * Called when the user drops an interval at a new index within its
     * section. The parent applies the move to its workout state and
     * queues an auto-save.
     */
    onReorder: (sectionType: SectionType, fromIndex: number, toIndex: number) => void
    /** Called when the user clicks the delete button on an interval row. */
    onDelete: (sectionType: SectionType, intervalIndex: number) => void
    /** Called when the user clicks an interval row to edit it. */
    onSelect: (sectionType: SectionType, intervalIndex: number) => void
    /** Currently selected interval, used to highlight the matching row. */
    selectedInterval: { sectionType: SectionType; intervalIndex: number } | null
}

/**
 * Renders three sortable lists, one per section, showing every interval
 * in the loaded workout. Users can drag intervals to reorder them within
 * their section, click an interval to open the inline editor, and click
 * the delete button to remove an interval. Cross-section drags are not
 * supported because section boundaries are fixed.
 */
export function IntervalListEditor({
    workout,
    onReorder,
    onDelete,
    onSelect,
    selectedInterval,
}: Props): JSX.Element {
    return (
        <div className="flex flex-col w-full max-w-4xl gap-4">
            <SortableSection
                sectionType="WARMUP"
                label="Warm-Up"
                block={workout.warmupBlock}
                onReorder={onReorder}
                onDelete={onDelete}
                onSelect={onSelect}
                selectedInterval={selectedInterval}
                canDeleteLastItem
            />
            <SortableSection
                sectionType="MAINSET"
                label="Main Set"
                block={workout.mainsetBlock}
                onReorder={onReorder}
                onDelete={onDelete}
                onSelect={onSelect}
                selectedInterval={selectedInterval}
                canDeleteLastItem={false}
            />
            <SortableSection
                sectionType="COOLDOWN"
                label="Cool-Down"
                block={workout.cooldownBlock}
                onReorder={onReorder}
                onDelete={onDelete}
                onSelect={onSelect}
                selectedInterval={selectedInterval}
                canDeleteLastItem
            />
        </div>
    )
}

interface SortableSectionProps {
    sectionType: SectionType
    label: string
    block: BlockDetail | null
    onReorder: (sectionType: SectionType, fromIndex: number, toIndex: number) => void
    onDelete: (sectionType: SectionType, intervalIndex: number) => void
    onSelect: (sectionType: SectionType, intervalIndex: number) => void
    selectedInterval: { sectionType: SectionType; intervalIndex: number } | null
    /**
     * When false, the delete button on the last remaining interval is
     * disabled. The main set must always retain at least one interval.
     */
    canDeleteLastItem: boolean
}

/** A single section's sortable list. */
function SortableSection({
    sectionType,
    label,
    block,
    onReorder,
    onDelete,
    onSelect,
    selectedInterval,
    canDeleteLastItem,
}: SortableSectionProps): JSX.Element {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )
    const intervals = block?.intervals ?? []
    // dnd-kit needs stable string IDs per item; we use the index since
    // intervals have no intrinsic ID and the order is what we are moving.
    const itemIds = intervals.map((_, i) => `${sectionType}-${i}`)

    function handleDragEnd(event: DragEndEvent): void {
        const { active, over } = event
        if (over === null || active.id === over.id) {
            return
        }
        const fromIndex = itemIds.indexOf(String(active.id))
        const toIndex = itemIds.indexOf(String(over.id))
        if (fromIndex === -1 || toIndex === -1) {
            return
        }
        // Use arrayMove just to validate the indices line up; the parent
        // does the actual mutation against its workout state
        arrayMove(intervals, fromIndex, toIndex)
        onReorder(sectionType, fromIndex, toIndex)
    }

    return (
        <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold tracking-wide uppercase text-zinc-300">
                {label}
            </p>
            {intervals.length === 0 ? (
                <p className="text-xs text-zinc-500 italic">No intervals</p>
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                        <ul className="flex flex-col gap-1">
                            {intervals.map((interval, index) => (
                                <SortableRow
                                    key={`${sectionType}-${index}`}
                                    id={`${sectionType}-${index}`}
                                    interval={interval}
                                    isSelected={
                                        selectedInterval?.sectionType === sectionType
                                        && selectedInterval.intervalIndex === index
                                    }
                                    onSelect={() => onSelect(sectionType, index)}
                                    onDelete={() => onDelete(sectionType, index)}
                                    canDelete={canDeleteLastItem || intervals.length > 1}
                                />
                            ))}
                        </ul>
                    </SortableContext>
                </DndContext>
            )}
        </div>
    )
}

interface SortableRowProps {
    id: string
    interval: ParsedInterval
    isSelected: boolean
    onSelect: () => void
    onDelete: () => void
    canDelete: boolean
}

/** A draggable row for a single interval. */
function SortableRow({
    id,
    interval,
    isSelected,
    onSelect,
    onDelete,
    canDelete,
}: SortableRowProps): JSX.Element {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
    }

    return (
        <li
            ref={setNodeRef}
            style={style}
            className={`
                flex items-center justify-between gap-3
                px-3 py-2
                bg-zinc-800 border rounded
                ${isSelected ? 'border-indigo-500' : 'border-zinc-700'}
            `}
        >
            <button
                type="button"
                {...attributes}
                {...listeners}
                aria-label="Drag to reorder"
                className="text-zinc-500 hover:text-zinc-300 cursor-grab"
            >
                {/* Three-line drag handle glyph */}
                ⋮⋮
            </button>
            <button
                type="button"
                onClick={onSelect}
                className="flex-1 text-left text-sm text-white truncate"
            >
                {summariseInterval(interval)}
            </button>
            <button
                type="button"
                onClick={onDelete}
                disabled={!canDelete}
                title={canDelete ? 'Delete interval' : 'Main set must keep at least one interval'}
                className={`
                    px-2 py-1
                    bg-red-900/50 text-red-200
                    text-[10px] font-semibold uppercase tracking-wide
                    rounded
                    hover:bg-red-800 transition-colors
                    disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-red-900/50
                `}
            >
                Delete
            </button>
        </li>
    )
}

/** Builds a short human-readable summary of an interval for the row text. */
function summariseInterval(interval: ParsedInterval): string {
    const minutes = Math.floor(interval.durationSeconds / 60)
    const seconds = interval.durationSeconds % 60
    const duration = seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`

    switch (interval.type) {
        case 'SteadyState':
            return `Steady ${duration} @ ${formatPercent(interval.power)} FTP`
        case 'Warmup':
        case 'Cooldown':
        case 'Ramp':
            return `${interval.type} ${duration} ${formatPercent(interval.power)} → ${formatPercent(interval.powerHigh)} FTP`
        case 'IntervalsT':
            return `Intervals ${interval.repeat ?? 0} × (${interval.onDuration ?? 0}s @ ${formatPercent(interval.onPower)} / ${interval.offDuration ?? 0}s @ ${formatPercent(interval.offPower)})`
        case 'FreeRide':
            return `Free Ride ${duration}`
    }
}

function formatPercent(power: number | null): string {
    if (power === null) return '–'
    return `${Math.round(power * 100)}%`
}
