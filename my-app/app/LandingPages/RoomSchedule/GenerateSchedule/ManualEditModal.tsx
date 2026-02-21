'use client'
import React, { useState, useMemo, useEffect, useCallback } from 'react'
import {
    MdClose, MdTableChart, MdSearch, MdFilterList, MdCheckCircle,
    MdWarning, MdMeetingRoom, MdLayers, MdPerson, MdGroups, MdAccessTime, MdAdd, MdDelete, MdSave,
    MdDragIndicator, MdChevronLeft, MdChevronRight, MdRemove
} from 'react-icons/md'
import { FaChalkboardTeacher, FaDoorOpen, FaUsers } from 'react-icons/fa'
import styles from './ManualEditModal.module.css'
import { toast } from 'sonner'

interface ManualEditModalProps {
    isOpen: boolean
    onClose: () => void
    onSave: (allocations: any[]) => void
    rooms: any[]
    classes: any[]
    timeSettings: any
    initialAllocations: any[]
}

type ViewMode = 'room' | 'faculty' | 'section'

const formatTimeAMPM = (time24: string) => {
    const [h, m] = time24.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`
}

export default function ManualEditModal({
    isOpen, onClose, onSave, rooms, classes, timeSettings, initialAllocations
}: ManualEditModalProps) {
    // 1. Core State
    const [allocations, setAllocations] = useState<any[]>(initialAllocations)
    const [viewMode, setViewMode] = useState<ViewMode>('room')
    const [activeItemIndex, setActiveItemIndex] = useState(0)
    const [searchQuery, setSearchQuery] = useState('')
    const [filterSection, setFilterSection] = useState('all')
    const [draggedClassId, setDraggedClassId] = useState<number | null>(null)
    const [resizingAllocId, setResizingAllocId] = useState<number | null>(null)
    const [draggingCourse, setDraggingCourse] = useState<any | null>(null)

    // Sync with props if they change
    useEffect(() => {
        setAllocations(initialAllocations)
    }, [initialAllocations])

    // Global event listeners for resizing
    useEffect(() => {
        const handleGlobalMouseUp = () => setResizingAllocId(null)
        window.addEventListener('mouseup', handleGlobalMouseUp)
        window.addEventListener('touchend', handleGlobalMouseUp)
        return () => {
            window.removeEventListener('mouseup', handleGlobalMouseUp)
            window.removeEventListener('touchend', handleGlobalMouseUp)
        }
    }, [])

    const faculties = useMemo(() => {
        const unique = [...new Set(classes.map(c => c.teacher_name || 'TBD'))].sort()
        return unique
    }, [classes])

    const sections = useMemo(() => {
        const unique = [...new Set(classes.map(c => c.section))].sort()
        return unique
    }, [classes])

    const navigationItems = useMemo(() => {
        if (viewMode === 'room') return rooms
        if (viewMode === 'faculty') return faculties
        if (viewMode === 'section') return sections
        return []
    }, [viewMode, rooms, faculties, sections])

    const activeItem = navigationItems[activeItemIndex]

    // 3. Time Slots (Force 30-min intervals for fine-grained manual control)
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const timeSlots = useMemo(() => {
        const slots = []
        const [startHour, startMin] = (timeSettings.startTime || "07:00").split(':').map(Number)
        const [endHour, endMin] = (timeSettings.endTime || "20:00").split(':').map(Number)
        let current = startHour * 60 + startMin
        const end = endHour * 60 + endMin
        const INTERVAL = 30 // 30 minutes

        while (current < end) {
            const h = Math.floor(current / 60)
            const m = current % 60
            const next = current + INTERVAL
            const nh = Math.floor(next / 60)
            const nm = next % 60
            slots.push({
                id: slots.length + 1,
                start: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
                end: `${nh.toString().padStart(2, '0')}:${nm.toString().padStart(2, '0')}`,
                startMinutes: current,
                endMinutes: next,
                label: formatTimeAMPM(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`)
            })
            current = next
        }
        return slots
    }, [timeSettings])

    // 4. Classes with Remaining Hours
    const classesWithStats = useMemo(() => {
        return classes.map(c => {
            const allottedInManual = allocations
                .filter(a => a.class_id === c.id)
                .reduce((acc, a) => {
                    const startMins = timeSlots.find(s => s.start === a.schedule_time.split(' - ')[0])?.startMinutes || 0
                    const endMins = timeSlots.find(s => s.end.split(' ')[0] === a.schedule_time.split(' - ')[1].split(' ')[0])?.endMinutes || 0
                    return acc + (endMins - startMins) / 60
                }, 0)

            const totalHours = c.lec_hours + c.lab_hours
            return {
                ...c,
                remainingHours: Math.max(0, totalHours - allottedInManual),
                totalHours
            }
        })
    }, [classes, allocations, timeSlots])

    // 5. Equipment Filter Logic
    const filteredClasses = useMemo(() => {
        return classesWithStats.filter(c => {
            // Basic search/section filters
            const matchesSearch = c.course_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.course_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.section.toLowerCase().includes(searchQuery.toLowerCase())
            const matchesSection = filterSection === 'all' || c.section === filterSection

            // Equipment filter (only if in room view and room selected)
            let equipmentMatch = true
            if (viewMode === 'room' && activeItem) {
                const room = activeItem as any
                const roomFeatures = new Set(room.feature_tags || [])
                const reqFeatures = c.required_features || []
                equipmentMatch = reqFeatures.every((f: string) => roomFeatures.has(f))
            }

            return matchesSearch && matchesSection && (c.remainingHours > 0) && equipmentMatch
        })
    }, [classesWithStats, searchQuery, filterSection, viewMode, activeItem])

    // 6. Conflict Detection
    const checkConflicts = useCallback((newAlloc: any, ignoreId?: number) => {
        const conflicts: string[] = []
        const { class_id, schedule_day, schedule_time, room_id } = newAlloc
        const classInfo = classes.find(c => c.id === class_id)
        if (!classInfo) return []

        const startParts = schedule_time.split(' - ')
        const startMin = timeSlots.find(s => s.start === startParts[0])?.startMinutes || 0
        const endMin = timeSlots.find(s => s.end === startParts[1])?.endMinutes || 0

        allocations.forEach(existing => {
            if (ignoreId && existing.class_id === ignoreId && existing.schedule_day === schedule_day) return

            const eStart = timeSlots.find(s => s.start === existing.schedule_time.split(' - ')[0])?.startMinutes || 0
            const eEnd = timeSlots.find(s => s.end === existing.schedule_time.split(' - ')[1])?.endMinutes || 0

            const timeOverlap = schedule_day === existing.schedule_day &&
                ((startMin >= eStart && startMin < eEnd) || (endMin > eStart && endMin <= eEnd) || (startMin <= eStart && endMin >= eEnd))

            if (timeOverlap) {
                if (room_id === existing.room_id) {
                    conflicts.push(`Room conflict: ${existing.course_code} (${existing.section})`)
                }
                if (classInfo.teacher_name && classInfo.teacher_name === existing.teacher_name) {
                    conflicts.push(`Prof conflict: ${classInfo.teacher_name} is in Room ${existing.room}`)
                }
                if (classInfo.section === existing.section) {
                    conflicts.push(`Section conflict: ${classInfo.section} is in Room ${existing.room}`)
                }
            }
        })

        return conflicts
    }, [classes, allocations, timeSlots])

    // 7. Actions
    const handleNavigation = (direction: 'next' | 'prev') => {
        if (direction === 'next') {
            setActiveItemIndex(prev => (prev + 1) % navigationItems.length)
        } else {
            setActiveItemIndex(prev => (prev - 1 + navigationItems.length) % navigationItems.length)
        }
    }

    const handleDrop = (day: string, slot: any) => {
        if (!draggedClassId) return
        const classInfo = classesWithStats.find(c => c.id === draggedClassId)
        if (!classInfo) return

        // Default duration based on remaining or 1.5h
        const durationMins = Math.min(classInfo.remainingHours * 60, 90)
        const endSlotIdx = timeSlots.indexOf(slot) + Math.ceil(durationMins / 30) - 1
        const endSlot = timeSlots[Math.min(endSlotIdx, timeSlots.length - 1)]

        // For room view, use active room. For others, need to select a room?
        // Let's assume room view is the primary way to allot physical space.
        let roomInfo = viewMode === 'room' ? (activeItem as any) : rooms[0]

        const newAlloc = {
            class_id: classInfo.id,
            room_id: roomInfo.id,
            course_code: classInfo.course_code,
            course_name: classInfo.course_name,
            section: classInfo.section,
            year_level: classInfo.year_level,
            schedule_day: day,
            schedule_time: `${slot.start} - ${endSlot.end}`,
            campus: roomInfo.campus,
            building: roomInfo.building,
            room: roomInfo.room,
            teacher_name: classInfo.teacher_name || 'TBD',
            status: 'scheduled'
        }

        const conflicts = checkConflicts(newAlloc)
        if (conflicts.length > 0) {
            conflicts.forEach(c => toast.error(c))
        }

        setAllocations(prev => [...prev, newAlloc])
        setDraggedClassId(null)
        toast.success(`Allocated ${classInfo.course_code}`)
    }

    const handleResize = (allocId: number, day: string, newEndSlot: any) => {
        setAllocations(prev => prev.map(a => {
            if (a.class_id !== allocId || a.schedule_day !== day) return a

            const startSlot = timeSlots.find(s => s.start === a.schedule_time.split(' - ')[0])
            if (!startSlot) return a

            if (newEndSlot.endMinutes <= startSlot.startMinutes) return a

            return {
                ...a,
                schedule_time: `${startSlot.start} - ${newEndSlot.end}`
            }
        }))
    }

    const adjustDuration = (allocId: number, amountMins: number) => {
        setAllocations(prev => prev.map(a => {
            if (a.class_id !== allocId) return a

            const startParts = a.schedule_time.split(' - ')[0]
            const endParts = a.schedule_time.split(' - ')[1]

            const startSlot = timeSlots.find(s => s.start === startParts)
            const endSlot = timeSlots.find(s => s.end.includes(endParts) || s.end === endParts)

            if (!startSlot || !endSlot) return a

            let newEndMins = endSlot.endMinutes + amountMins
            if (newEndMins <= startSlot.startMinutes) return a

            const lastSlot = timeSlots[timeSlots.length - 1]
            if (newEndMins > lastSlot.endMinutes) return a

            const newEndSlot = timeSlots.find(s => s.endMinutes === newEndMins)
            if (!newEndSlot) return a

            return { ...a, schedule_time: `${startSlot.start} - ${newEndSlot.end}` }
        }))
    }

    const handleRemoveAlloc = (classId: number) => {
        setAllocations(prev => prev.filter(a => a.class_id !== classId))
    }

    const handleSave = () => {
        onSave(allocations)
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.manualEditModal} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <div className={styles.headerLeft}>
                        <h2>
                            <MdTableChart />
                            Manual Schedule Editor
                        </h2>
                        <div className={styles.viewSelector}>
                            <button
                                className={viewMode === 'room' ? styles.active : ''}
                                onClick={() => { setViewMode('room'); setActiveItemIndex(0); }}
                            >
                                <MdMeetingRoom /> Rooms
                            </button>
                            <button
                                className={viewMode === 'faculty' ? styles.active : ''}
                                onClick={() => { setViewMode('faculty'); setActiveItemIndex(0); }}
                            >
                                <FaChalkboardTeacher /> Faculty
                            </button>
                            <button
                                className={viewMode === 'section' ? styles.active : ''}
                                onClick={() => { setViewMode('section'); setActiveItemIndex(0); }}
                            >
                                <FaUsers /> Section
                            </button>
                        </div>
                    </div>
                    <button className={styles.modalCloseBtn} onClick={onClose} aria-label="Close">
                        <MdClose size={24} />
                    </button>
                </div>

                <div className={styles.manualEditBody}>
                    <div className={styles.coursesPanel}>
                        <div className={styles.panelHeader}>
                            <h3>Available Courses</h3>
                            <div className={styles.searchBox}>
                                <MdSearch />
                                <input
                                    type="text"
                                    placeholder="Search code, name..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className={styles.classList}>
                            {filteredClasses.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                                    <MdSearch size={48} style={{ opacity: 0.2, marginBottom: '12px' }} />
                                    <p style={{ fontSize: '14px', fontWeight: 500 }}>No courses found</p>
                                </div>
                            ) : (
                                filteredClasses.map(c => (
                                    <div
                                        key={c.id}
                                        className={styles.classCard}
                                        draggable
                                        onDragStart={() => setDraggedClassId(c.id)}
                                    >
                                        <div className={styles.classHeader}>
                                            <strong>{c.course_code}</strong>
                                            <span className={styles.hoursBadge}>{c.remainingHours}h left</span>
                                        </div>
                                        <p>{c.course_name}</p>
                                        <div className={styles.classDetails}>
                                            <span><MdPerson /> {c.teacher_name || 'TBD'}</span>
                                            <span><MdGroups /> {c.section}</span>
                                            <span><MdAccessTime /> Lec {c.lec_hours || 0}h / Lab {c.lab_hours || 0}h</span>
                                        </div>
                                        {c.required_features?.length > 0 && (
                                            <div className={styles.featureTags}>
                                                {c.required_features.map((f: any) => (
                                                    <span key={f} className={styles.fTag}>{f}</span>
                                                ))}
                                            </div>
                                        )}
                                        <div style={{ position: 'absolute', right: '12px', bottom: '12px', opacity: 0.1 }}>
                                            <MdDragIndicator size={20} />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className={styles.timetablePanel}>
                        <div className={styles.panelHeader}>
                            <div className={styles.itemNavigator}>
                                <button onClick={() => handleNavigation('prev')} title="Previous">
                                    <MdChevronLeft />
                                </button>
                                <div className={styles.currentItem}>
                                    {viewMode === 'room' && (
                                        <>
                                            <FaDoorOpen />
                                            <span>
                                                <select
                                                    value={activeItemIndex}
                                                    onChange={(e) => setActiveItemIndex(Number(e.target.value))}
                                                    style={{ appearance: 'none', border: 'none', background: 'transparent', outline: 'none', cursor: 'pointer', textAlign: 'center', fontSize: '1rem', fontWeight: 600, color: 'inherit' }}
                                                >
                                                    {navigationItems.map((item: any, idx) => (
                                                        <option key={idx} value={idx}>{item.building} - {item.room}</option>
                                                    ))}
                                                </select>
                                                <small style={{ marginLeft: '10px', opacity: 0.6, fontSize: '0.6em', background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '4px' }}>
                                                    {(activeItem as any)?.capacity} seats
                                                </small>
                                                {(activeItem as any)?.floor_level && (
                                                    <small style={{ marginLeft: '6px', opacity: 0.6, fontSize: '0.6em', background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '4px' }}>
                                                        Floor {(activeItem as any)?.floor_level}
                                                    </small>
                                                )}
                                                {(activeItem as any)?.college && (
                                                    <small style={{ marginLeft: '6px', opacity: 0.9, fontSize: '0.6em', background: '#e0e7ff', color: '#4f46e5', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                                                        {(activeItem as any)?.college}
                                                    </small>
                                                )}
                                            </span>
                                        </>
                                    )}
                                    {viewMode === 'faculty' && (
                                        <>
                                            <FaChalkboardTeacher />
                                            <select
                                                value={activeItemIndex}
                                                onChange={(e) => setActiveItemIndex(Number(e.target.value))}
                                                style={{ appearance: 'none', border: 'none', background: 'transparent', outline: 'none', cursor: 'pointer', textAlign: 'center', fontSize: '1rem', fontWeight: 600, color: 'inherit' }}
                                            >
                                                {navigationItems.map((item: any, idx) => (
                                                    <option key={idx} value={idx}>{item}</option>
                                                ))}
                                            </select>
                                        </>
                                    )}
                                    {viewMode === 'section' && (
                                        <>
                                            <FaUsers />
                                            <select
                                                value={activeItemIndex}
                                                onChange={(e) => setActiveItemIndex(Number(e.target.value))}
                                                style={{ appearance: 'none', border: 'none', background: 'transparent', outline: 'none', cursor: 'pointer', textAlign: 'center', fontSize: '1rem', fontWeight: 600, color: 'inherit' }}
                                            >
                                                {navigationItems.map((item: any, idx) => (
                                                    <option key={idx} value={idx}>{item}</option>
                                                ))}
                                            </select>
                                        </>
                                    )}
                                </div>
                                <button onClick={() => handleNavigation('next')} title="Next">
                                    <MdChevronRight />
                                </button>
                            </div>
                        </div>

                        <div className={styles.timetableScrollContainer}>
                            <table className={styles.manualTimetable}>
                                <thead>
                                    <tr>
                                        <th className={styles.timeLabel}>Time</th>
                                        {days.map(d => <th key={d}>{d}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {timeSlots.map(slot => (
                                        <tr key={slot.id}>
                                            <td className={styles.timeLabel}>{slot.label}</td>
                                            {days.map(day => {
                                                const allocs = allocations.filter(a => {
                                                    const matchesDay = a.schedule_day === day
                                                    if (!matchesDay) return false

                                                    const sTime = a.schedule_time.split(' - ')[0]
                                                    const eTime = a.schedule_time.split(' - ')[1]
                                                    const slotInRange = slot.start >= sTime && slot.start < eTime

                                                    if (viewMode === 'room') return a.room_id === (activeItem as any)?.id && slotInRange
                                                    if (viewMode === 'faculty') return a.teacher_name === (activeItem as string) && slotInRange
                                                    if (viewMode === 'section') return a.section === (activeItem as string) && slotInRange
                                                    return false
                                                })

                                                const isStart = allocs.some(a => a.schedule_time.startsWith(slot.start))

                                                return (
                                                    <td
                                                        key={day}
                                                        className={`${styles.slotCell} ${allocs.length > 0 ? styles.occupied : ''}`}
                                                        onDragOver={e => e.preventDefault()}
                                                        onDrop={() => handleDrop(day, slot)}
                                                        onMouseEnter={() => {
                                                            if (resizingAllocId !== null) {
                                                                handleResize(resizingAllocId, day, slot)
                                                            }
                                                        }}
                                                    >
                                                        {isStart && allocs.map(a => {
                                                            const confs = checkConflicts(a, a.class_id)
                                                            return (
                                                                <div key={a.class_id} className={`${styles.placedClass} ${confs.length > 0 ? styles.hasConflict : ''}`} style={{
                                                                    height: `${((timeSlots.find(s => s.end === a.schedule_time.split(' - ')[1])?.endMinutes || 0) - slot.startMinutes) / 30 * 100}%`,
                                                                    zIndex: 10
                                                                }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                        <strong>{a.course_code}</strong>
                                                                        {confs.length > 0 && <span title={confs.join('\n')} style={{ color: '#fee2e2', opacity: 1, cursor: 'help' }}><MdWarning size={16} /></span>}
                                                                    </div>
                                                                    <span>{a.section}</span>
                                                                    <div className={styles.allocTools}>
                                                                        <button onClick={() => adjustDuration(a.class_id, 30)} title="Add 30 mins"><MdAdd /></button>
                                                                        <button onClick={() => adjustDuration(a.class_id, -30)} title="Reduce 30 mins"><MdRemove /></button>
                                                                        <button onClick={() => handleRemoveAlloc(a.class_id)} title="Remove allocation">
                                                                            <MdDelete />
                                                                        </button>
                                                                    </div>
                                                                    <div
                                                                        className={styles.resizeHandle}
                                                                        onMouseDown={() => setResizingAllocId(a.class_id)}
                                                                        onTouchStart={() => setResizingAllocId(a.class_id)}
                                                                    />
                                                                </div>
                                                            )
                                                        })}
                                                    </td>
                                                )
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className={styles.modalFooter}>
                    <div className={styles.footerStats}>
                        <span><strong>{allocations.length}</strong> Reserved Allocations</span>
                    </div>
                    <div className={styles.footerActions}>
                        <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
                        <button className={styles.saveBtn} onClick={handleSave}>
                            <MdSave /> Save & Applied Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
