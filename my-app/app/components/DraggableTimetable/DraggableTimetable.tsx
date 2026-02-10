'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Clock, Lock } from 'lucide-react'
import styles from './DraggableTimetable.module.css'
import {
    parseTimeToMinutes,
    parseScheduleTime,
    minutesToTimeString,
    buildTimeRange,
    checkAllConflicts,
    type AllocationSlot,
    type TimeRange,
} from '@/lib/conflictChecker'

// ======================== Types ========================

export type TimetableMode = 'admin-edit' | 'faculty-request' | 'view-only'

export interface TimetableAllocation {
    id: number
    schedule_id: number
    class_id?: number
    room_id?: number
    course_code: string
    course_name: string
    section: string
    year_level?: number
    schedule_day: string
    schedule_time: string
    campus?: string
    building: string
    room: string
    capacity?: number
    teacher_name?: string
    department?: string
    lec_hours?: number
    lab_hours?: number
}

interface CombinedBlock {
    course_code: string
    course_name: string
    section: string
    room: string
    building: string
    teacher_name: string
    day: string
    startMinutes: number
    endMinutes: number
    allocationIds: number[]
    originalAllocations: TimetableAllocation[]
}

export interface DragDropResult {
    allocationIds: number[]
    originalAllocations: TimetableAllocation[]
    fromDay: string
    fromTime: string
    toDay: string
    toTime: string
    toRoom: string
    toBuilding: string
    courseCode: string
    section: string
    teacherName: string
    hasConflict: boolean
}

interface DraggableTimetableProps {
    allocations: TimetableAllocation[]
    allAllocations: TimetableAllocation[] // All allocations (for cross-view conflict checking)
    mode: TimetableMode
    isLocked?: boolean
    facultyName?: string // Faculty filter (for faculty mode)
    onDrop?: (result: DragDropResult) => void
    onDirectEdit?: (result: DragDropResult) => void
}

// ======================== Constants ========================

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const START_HOUR = 7
const TOTAL_SLOTS = 26 // 7:00 to 20:00 (26 half-hour slots)
const ROW_HEIGHT = 40

const COURSE_COLORS = [
    '#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#00796b',
    '#c2185b', '#5d4037', '#455a64', '#d32f2f', '#303f9f',
    '#0097a7', '#689f38', '#ffa000', '#512da8', '#e64a19', '#00838f'
]

const LONG_PRESS_DELAY = 250 // ms to trigger touch-drag (reduced for faster response)

// ======================== Helpers ========================

function formatTimeAMPM(hour: number, minute: number): string {
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`
}

function normalizeDay(day: string): string {
    const dayMap: { [key: string]: string } = {
        'M': 'Monday', 'MON': 'Monday', 'MONDAY': 'Monday',
        'T': 'Tuesday', 'TUE': 'Tuesday', 'TUESDAY': 'Tuesday',
        'W': 'Wednesday', 'WED': 'Wednesday', 'WEDNESDAY': 'Wednesday',
        'TH': 'Thursday', 'THU': 'Thursday', 'THURSDAY': 'Thursday',
        'F': 'Friday', 'FRI': 'Friday', 'FRIDAY': 'Friday',
        'S': 'Saturday', 'SAT': 'Saturday', 'SATURDAY': 'Saturday',
        'SU': 'Sunday', 'SUN': 'Sunday', 'SUNDAY': 'Sunday'
    }
    return dayMap[day.toUpperCase()] || day
}

// ======================== Component ========================

export default function DraggableTimetable({
    allocations,
    allAllocations,
    mode,
    isLocked = false,
    facultyName,
    onDrop,
    onDirectEdit,
}: DraggableTimetableProps) {
    const [draggedBlock, setDraggedBlock] = useState<CombinedBlock | null>(null)
    const [highlightedCells, setHighlightedCells] = useState<Map<string, 'available' | 'conflict'>>(new Map())
    const tableRef = useRef<HTMLTableElement>(null)

    // Touch drag state
    const touchStateRef = useRef<{
        longPressTimer: NodeJS.Timeout | null
        isDragging: boolean
        startX: number
        startY: number
        block: CombinedBlock | null
        ghostEl: HTMLDivElement | null
        hoveredCellKey: string | null
        dropTarget: { day: string; slotIdx: number } | null
    }>({
        longPressTimer: null,
        isDragging: false,
        startX: 0,
        startY: 0,
        block: null,
        ghostEl: null,
        hoveredCellKey: null,
        dropTarget: null,
    })

    // Store latest state/props in ref to avoid stale closures in event listeners
    const stateRef = useRef({
        highlightedCells,
        mode,
        onDrop,
        onDirectEdit
    })

    useEffect(() => {
        stateRef.current = { highlightedCells, mode, onDrop, onDirectEdit }
    }, [highlightedCells, mode, onDrop, onDirectEdit])

    // Cleanup touch ghost on unmount
    useEffect(() => {
        return () => {
            const ts = touchStateRef.current
            if (ts.longPressTimer) clearTimeout(ts.longPressTimer)
            if (ts.ghostEl) {
                document.body.removeChild(ts.ghostEl)
                ts.ghostEl = null
            }
        }
    }, [])

    // Build combined blocks from allocations
    const combinedBlocks = useMemo(() => {
        const groupedMap = new Map<string, TimetableAllocation[]>()
        allocations.forEach(alloc => {
            const key = `${alloc.course_code}|${alloc.section}|${alloc.room}|${alloc.schedule_day}|${alloc.teacher_name || ''}`
            if (!groupedMap.has(key)) groupedMap.set(key, [])
            groupedMap.get(key)!.push(alloc)
        })

        const blocks: CombinedBlock[] = []
        groupedMap.forEach(allocs => {
            const sorted = allocs.sort((a, b) => {
                return parseTimeToMinutes(a.schedule_time || '') - parseTimeToMinutes(b.schedule_time || '')
            })

            let currentBlock: CombinedBlock | null = null

            sorted.forEach(alloc => {
                const timeStr = alloc.schedule_time || ''
                const timeParts = timeStr.split(/\s*-\s*/)
                if (timeParts.length !== 2) return

                const startMins = parseTimeToMinutes(timeParts[0])
                const endMins = parseTimeToMinutes(timeParts[1])
                if (startMins === 0 && endMins === 0) return

                if (currentBlock && currentBlock.endMinutes === startMins) {
                    currentBlock.endMinutes = endMins
                    currentBlock.allocationIds.push(alloc.id)
                    currentBlock.originalAllocations.push(alloc)
                } else {
                    if (currentBlock) blocks.push(currentBlock)
                    currentBlock = {
                        course_code: alloc.course_code || '',
                        course_name: alloc.course_name || '',
                        section: alloc.section || '',
                        room: alloc.room || '',
                        building: alloc.building || '',
                        teacher_name: alloc.teacher_name || '',
                        day: (alloc.schedule_day || '').toLowerCase(),
                        startMinutes: startMins,
                        endMinutes: endMins,
                        allocationIds: [alloc.id],
                        originalAllocations: [alloc],
                    }
                }
            })

            if (currentBlock) blocks.push(currentBlock)
        })

        // Cap at 4 hours
        return blocks.map(block => {
            const duration = block.endMinutes - block.startMinutes
            if (duration > 240) return { ...block, endMinutes: block.startMinutes + 240 }
            return block
        })
    }, [allocations])

    // Color map
    const courseColorMap = useMemo(() => {
        const map = new Map<string, string>()
        const uniqueCodes = [...new Set(combinedBlocks.map(b => b.course_code))]
        uniqueCodes.forEach((code, idx) => {
            map.set(code, COURSE_COLORS[idx % COURSE_COLORS.length])
        })
        return map
    }, [combinedBlocks])

    // Convert allAllocations to AllocationSlots for conflict checker
    const allocationSlots: AllocationSlot[] = useMemo(() => {
        return allAllocations.map(a => ({
            id: a.id,
            schedule_id: a.schedule_id,
            room: a.room,
            building: a.building,
            section: a.section,
            teacher_name: a.teacher_name || '',
            schedule_day: a.schedule_day,
            schedule_time: a.schedule_time,
            course_code: a.course_code,
        }))
    }, [allAllocations])

    // Admin can always drag unless in view-only mode. Faculty/others check lock.
    const canDrag = mode === 'admin-edit' || (mode !== 'view-only' && !isLocked)

    // Can this block be dragged by the current user?
    const isBlockDraggable = useCallback((block: CombinedBlock): boolean => {
        if (!canDrag) return false
        if (mode === 'admin-edit') return true
        if (mode === 'faculty-request') return true
        return false
    }, [canDrag, mode])

    // Compute highlights for a given block
    const computeHighlights = useCallback((block: CombinedBlock) => {
        const duration = block.endMinutes - block.startMinutes
        const highlights = new Map<string, 'available' | 'conflict'>()

        DAYS.forEach(day => {
            for (let slotIdx = 0; slotIdx < TOTAL_SLOTS; slotIdx++) {
                const slotMinutes = (START_HOUR + Math.floor(slotIdx / 2)) * 60 + (slotIdx % 2) * 30
                const endMinutes = slotMinutes + duration

                if (endMinutes > 20 * 60) continue

                const targetTime: TimeRange = { startMinutes: slotMinutes, endMinutes }

                const conflictsExcluding = checkAllConflicts(
                    allocationSlots.filter(a => !block.allocationIds.includes(a.id)),
                    block.room,
                    day,
                    targetTime,
                    block.teacher_name,
                    block.section,
                )

                const cellKey = `${day}-${slotIdx}`
                highlights.set(cellKey, conflictsExcluding.hasConflict ? 'conflict' : 'available')
            }
        })

        return highlights
    }, [allocationSlots])

    // Handle drag start
    const handleDragStart = useCallback((block: CombinedBlock) => {
        setDraggedBlock(block)
        setHighlightedCells(computeHighlights(block))
    }, [computeHighlights])

    const handleDragEnd = useCallback(() => {
        setDraggedBlock(null)
        setHighlightedCells(new Map())
    }, [])

    const handleDrop = useCallback((day: string, slotIdx: number) => {
        if (!draggedBlock) return

        const slotMinutes = (START_HOUR + Math.floor(slotIdx / 2)) * 60 + (slotIdx % 2) * 30
        const duration = draggedBlock.endMinutes - draggedBlock.startMinutes

        const cellKey = `${day}-${slotIdx}`
        const cellStatus = highlightedCells.get(cellKey)

        const fromTime = buildTimeRange(draggedBlock.startMinutes, draggedBlock.endMinutes)
        const newEndMinutes = slotMinutes + duration
        const toTime = buildTimeRange(slotMinutes, newEndMinutes)

        const result: DragDropResult = {
            allocationIds: draggedBlock.allocationIds,
            originalAllocations: draggedBlock.originalAllocations,
            fromDay: draggedBlock.day,
            fromTime,
            toDay: day.toLowerCase(),
            toTime,
            toRoom: draggedBlock.room,
            toBuilding: draggedBlock.building,
            courseCode: draggedBlock.course_code,
            section: draggedBlock.section,
            teacherName: draggedBlock.teacher_name,
            hasConflict: cellStatus === 'conflict',
        }

        if (mode === 'admin-edit' && onDirectEdit) {
            onDirectEdit(result)
        } else if (mode === 'faculty-request' && onDrop) {
            onDrop(result)
        }

        handleDragEnd()
    }, [draggedBlock, highlightedCells, mode, onDrop, onDirectEdit, handleDragEnd])

    // ======================== Touch Handlers ========================

    const createTouchGhost = useCallback((block: CombinedBlock, x: number, y: number) => {
        const ghost = document.createElement('div')
        ghost.className = styles.touchDragGhost
        const blockColor = courseColorMap.get(block.course_code) || '#1976d2'
        ghost.style.backgroundColor = blockColor
        ghost.innerHTML = `<strong>${block.course_code}</strong><span>${block.section}</span>`
        ghost.style.left = `${x - 50}px`
        ghost.style.top = `${y - 30}px`
        document.body.appendChild(ghost)
        return ghost
    }, [courseColorMap])

    // Global touch move handler (active only during drag)
    const handleGlobalTouchMove = useCallback((e: TouchEvent) => {
        const ts = touchStateRef.current
        if (!ts.isDragging) return

        if (e.cancelable) e.preventDefault() // Stop scrolling

        const touch = e.touches[0]
        if (ts.ghostEl) {
            ts.ghostEl.style.left = `${touch.clientX - 50}px`
            ts.ghostEl.style.top = `${touch.clientY - 30}px`
        }

        const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement
        if (elemBelow) {
            const cell = elemBelow.closest('td')
            if (cell) {
                const cellKey = cell.getAttribute('data-cell-key')
                if (cellKey && cellKey !== ts.hoveredCellKey) {
                    ts.hoveredCellKey = cellKey

                    // Parse cell key to see if it's a valid drop target
                    // Note: We need access to recent highlights or re-calculate. 
                    // Should be safe to re-calculate or trust the visual feedback?
                    // Actually, let's just parse the key. Validation happens on drop or via efficient lookup if we had the map in a ref.
                    // For now, we trust the key structure.
                    const [day, slotIdxStr] = cellKey.split('-SLOT-')
                    if (day && slotIdxStr) {
                        const slotIdx = parseInt(slotIdxStr, 10)
                        ts.dropTarget = { day, slotIdx }
                    } else {
                        ts.dropTarget = null
                    }
                }
            } else {
                ts.hoveredCellKey = null
                ts.dropTarget = null
            }
        }
    }, [])

    // Global touch end/cancel handler
    const handleGlobalTouchEnd = useCallback((e: TouchEvent) => {
        const ts = touchStateRef.current

        // Remove listeners & unlock scroll
        document.removeEventListener('touchmove', handleGlobalTouchMove)
        document.removeEventListener('touchend', handleGlobalTouchEnd)
        document.removeEventListener('touchcancel', handleGlobalTouchEnd)
        document.body.style.overflow = ''
        document.body.style.touchAction = ''

        if (!ts.isDragging || !ts.block) {
            // Should not happen if listeners are only added on drag, but safe guard
            return
        }

        // Remove ghost
        if (ts.ghostEl) {
            if (document.body.contains(ts.ghostEl)) {
                document.body.removeChild(ts.ghostEl)
            }
            ts.ghostEl = null
        }

        // Execute drop if we have a target
        if (ts.dropTarget && ts.block) {
            const { day, slotIdx } = ts.dropTarget
            const { highlightedCells, mode, onDrop, onDirectEdit } = stateRef.current

            // Check validity using FRESH state
            const cellStatus = highlightedCells.get(`${day}-${slotIdx}`)

            if (cellStatus === 'available') {
                // Perform the drop logic directly using fresh state
                const block = ts.block
                const slotMinutes = (START_HOUR + Math.floor(slotIdx / 2)) * 60 + (slotIdx % 2) * 30
                const duration = block.endMinutes - block.startMinutes
                const fromTime = buildTimeRange(block.startMinutes, block.endMinutes)
                const newEndMinutes = slotMinutes + duration
                const toTime = buildTimeRange(slotMinutes, newEndMinutes)

                const result: DragDropResult = {
                    allocationIds: block.allocationIds,
                    originalAllocations: block.originalAllocations,
                    fromDay: block.day,
                    fromTime,
                    toDay: day.toLowerCase(),
                    toTime,
                    toRoom: block.room,
                    toBuilding: block.building,
                    courseCode: block.course_code,
                    section: block.section,
                    teacherName: block.teacher_name,
                    hasConflict: false,
                }

                if (mode === 'admin-edit' && onDirectEdit) {
                    onDirectEdit(result)
                } else if (mode === 'faculty-request' && onDrop) {
                    onDrop(result)
                }
            }
        }

        ts.isDragging = false
        ts.block = null
        ts.dropTarget = null
        handleDragEnd()
    }, [handleDrop, handleDragEnd, handleGlobalTouchMove]) // Dependencies needed!

    const handleTouchStart = useCallback((e: React.TouchEvent, block: CombinedBlock) => {
        if (!isBlockDraggable(block)) return

        // Prevent context menu on long press
        e.preventDefault()
        
        const touch = e.touches[0]
        const ts = touchStateRef.current
        ts.startX = touch.clientX
        ts.startY = touch.clientY
        ts.block = block
        ts.isDragging = false // Not yet
        ts.dropTarget = null

        // Start long-press timer
        ts.longPressTimer = setTimeout(() => {
            ts.isDragging = true

            // Haptic feedback
            if (navigator.vibrate) navigator.vibrate(50)

            // Calculate highlights & state
            const highlights = computeHighlights(block)
            setDraggedBlock(block)
            setHighlightedCells(highlights)

            // Create ghost
            ts.ghostEl = createTouchGhost(block, touch.clientX, touch.clientY)

            // LOCK SCROLL & Attach Global Listeners
            document.body.style.overflow = 'hidden'
            document.body.style.touchAction = 'none' // Stronger enforcement
            document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false })
            document.addEventListener('touchend', handleGlobalTouchEnd)
            document.addEventListener('touchcancel', handleGlobalTouchEnd)

        }, LONG_PRESS_DELAY)
    }, [isBlockDraggable, computeHighlights, createTouchGhost, handleGlobalTouchMove, handleGlobalTouchEnd])

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        const ts = touchStateRef.current
        // Only responsible for canceling the timer if moved too much BEFORE drag starts
        if (!ts.isDragging && ts.longPressTimer) {
            const touch = e.touches[0]
            const dx = Math.abs(touch.clientX - ts.startX)
            const dy = Math.abs(touch.clientY - ts.startY)
            if (dx > 10 || dy > 10) {
                clearTimeout(ts.longPressTimer)
                ts.longPressTimer = null
            }
        }
    }, [])

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        const ts = touchStateRef.current
        // Only responsible for canceling the timer if lift happens BEFORE drag starts
        if (ts.longPressTimer) {
            clearTimeout(ts.longPressTimer)
            ts.longPressTimer = null
        }
    }, [])


    return (
        <div
            className={`${styles.draggableTimetableWrapper} ${draggedBlock ? styles.isDraggingActive : ''}`}
            style={{ position: 'relative' }}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {isLocked && mode !== 'admin-edit' && (
                <div className={styles.lockedOverlay}>
                    <div className={styles.lockedBadge}>
                        <Lock size={16} /> Schedule is locked
                    </div>
                </div>
            )}

            {canDrag && (
                <div className={styles.dragHint}>
                    {mode === 'faculty-request'
                        ? '💡 Long-press and drag a class to request a reschedule'
                        : '💡 Drag a class to move it to a new time slot'}
                </div>
            )}

            <table className={styles.timetable} ref={tableRef}>
                <thead>
                    <tr>
                        <th className={styles.timeHeader}>
                            <Clock size={16} /> Time
                        </th>
                        {DAYS.map(day => (
                            <th key={day} className={styles.dayHeader}>{day}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: TOTAL_SLOTS }, (_, slotIdx) => {
                        const hour = START_HOUR + Math.floor(slotIdx / 2)
                        const minute = (slotIdx % 2) * 30
                        const isHourMark = minute === 0
                        const displayTime = formatTimeAMPM(hour, minute)

                        return (
                            <tr key={slotIdx} className={isHourMark ? styles.hourRow : styles.halfHourRow}>
                                <td className={`${styles.timeCell} ${isHourMark ? styles.hourMark : styles.halfHourMark}`}>
                                    {displayTime}
                                </td>
                                {DAYS.map(day => {
                                    const blocksStartingHere = combinedBlocks.filter(block => {
                                        const blockStartHour = Math.floor(block.startMinutes / 60)
                                        const blockStartMin = block.startMinutes % 60
                                        return block.day === day.toLowerCase() &&
                                            blockStartHour === hour &&
                                            blockStartMin === minute
                                    })

                                    const isCoveredByBlock = combinedBlocks.some(block => {
                                        if (block.day !== day.toLowerCase()) return false
                                        const currentMinutes = hour * 60 + minute
                                        return block.startMinutes < currentMinutes && currentMinutes < block.endMinutes
                                    })

                                    const cellKey = `${day}-${slotIdx}`
                                    const cellHighlight = draggedBlock ? highlightedCells.get(cellKey) : null

                                    let cellClassName = styles.dataCell
                                    if (cellHighlight === 'available') cellClassName += ` ${styles.cellAvailable}`
                                    else if (cellHighlight === 'conflict') cellClassName += ` ${styles.cellConflict}`
                                    if (canDrag && draggedBlock) cellClassName += ` ${styles.droppableZone}`

                                    return (
                                        <td
                                            key={`${day}-${slotIdx}`}
                                            className={cellClassName}
                                            data-cell-key={`${day}-SLOT-${slotIdx}`}
                                            style={{
                                                position: 'relative',
                                                height: `${ROW_HEIGHT}px`,
                                                background: isCoveredByBlock ? 'transparent' : undefined,
                                            }}
                                            onDragOver={(e) => {
                                                if (canDrag && draggedBlock) {
                                                    e.preventDefault()
                                                }
                                            }}
                                            onDrop={(e) => {
                                                e.preventDefault()
                                                if (canDrag && draggedBlock && cellHighlight === 'available') {
                                                    handleDrop(day, slotIdx)
                                                }
                                            }}
                                        >
                                            {blocksStartingHere.map((block, idx) => {
                                                const durationMinutes = block.endMinutes - block.startMinutes
                                                const durationSlots = Math.ceil(durationMinutes / 30)
                                                const spanHeight = durationSlots * ROW_HEIGHT
                                                const blockColor = courseColorMap.get(block.course_code) || '#1976d2'
                                                const isDraggable = isBlockDraggable(block)
                                                const isDragging = draggedBlock?.allocationIds[0] === block.allocationIds[0]

                                                const startH = Math.floor(block.startMinutes / 60)
                                                const startM = block.startMinutes % 60
                                                const endH = Math.floor(block.endMinutes / 60)
                                                const endM = block.endMinutes % 60
                                                const timeRange = `${formatTimeAMPM(startH, startM)} - ${formatTimeAMPM(endH, endM)}`

                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`${styles.allocationBlock} ${isDraggable ? styles.draggable : ''} ${isDragging ? styles.dragging : ''}`}
                                                        style={{
                                                            backgroundColor: blockColor,
                                                            color: '#fff',
                                                            height: `${spanHeight - 2}px`,
                                                        }}
                                                        draggable={isDraggable}
                                                        onDragStart={(e) => {
                                                            if (!isDraggable) return
                                                            e.dataTransfer.effectAllowed = 'move'
                                                            e.dataTransfer.setData('text/plain', block.course_code)
                                                            handleDragStart(block)
                                                        }}
                                                        onDragEnd={handleDragEnd}
                                                        onTouchStart={(e) => handleTouchStart(e, block)}
                                                        title={`${block.course_code} - ${block.course_name}\n${block.section}\n${block.room} (${block.building})\n${block.teacher_name}\n${timeRange}`}
                                                    >
                                                        <span className={styles.blockCourse}>{block.course_code}</span>
                                                        <span className={styles.blockSection}>{block.section}</span>
                                                        {durationMinutes >= 60 && (
                                                            <>
                                                                <span className={styles.blockRoom}>{block.room}</span>
                                                                {block.teacher_name && (
                                                                    <span className={styles.blockTeacher}>{block.teacher_name}</span>
                                                                )}
                                                            </>
                                                        )}
                                                        {durationMinutes >= 90 && (
                                                            <span className={styles.blockTime}>{timeRange}</span>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </td>
                                    )
                                })}
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
