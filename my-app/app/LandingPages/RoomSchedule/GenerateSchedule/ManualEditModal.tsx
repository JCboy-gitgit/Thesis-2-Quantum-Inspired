'use client'
import React, { useState, useMemo, useEffect, useCallback } from 'react'
import {
    MdClose, MdTableChart, MdSearch, MdFilterList, MdCheckCircle,
    MdWarning, MdMeetingRoom, MdLayers, MdPerson, MdGroups, MdAccessTime, MdAdd, MdDelete, MdSave,
    MdDragIndicator, MdChevronLeft, MdChevronRight, MdRemove, MdSchool
} from 'react-icons/md'
import { FaChalkboardTeacher, FaDoorOpen, FaUsers, FaAtom } from 'react-icons/fa'
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
    const [draggingComponent, setDraggingComponent] = useState<string | null>(null)
    const [draggedAllocId, setDraggedAllocId] = useState<any | null>(null)
    const [resizingAllocId, setResizingAllocId] = useState<number | null>(null)
    const [splitLabClasses, setSplitLabClasses] = useState<number[]>([])

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

    // Moved sections down below classesWithStats

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

    // 4. Classes with Remaining Hours (Split by Lec/Lab)
    const classesWithStats = useMemo(() => {
        const labRooms = rooms.filter(r => r.room_type?.toLowerCase().includes('lab'));
        const maxLabCapacity = labRooms.length > 0 ? Math.max(...labRooms.map(r => r.capacity || 0)) : 30;

        return classes.map(c => {
            const calculateAllotted = (compStr: string, suffix?: string) => {
                return allocations
                    .filter(a => a.class_id === c.id && a.component === compStr && (!suffix || a.section.trim().endsWith(suffix)))
                    .reduce((acc, a) => {
                        const startParts = (a.schedule_time.split(' - ')[0] || '').trim().substring(0, 5);
                        const endParts = (a.schedule_time.split(' - ')[1] || '').trim().substring(0, 5);
                        const startMins = timeSlots.find(s => s.start === startParts)?.startMinutes || 0
                        const endMins = timeSlots.find(s => s.end.includes(endParts))?.endMinutes || 0
                        return acc + (endMins - startMins) / 60
                    }, 0)
            }

            const lecAllotted = calculateAllotted('LEC')

            const isAutoSplitLab = (c.student_count || 0) > maxLabCapacity && (c.lab_hours > 0);
            const isManuallySplit = splitLabClasses.includes(c.id);
            const isSplitLab = isAutoSplitLab || isManuallySplit;

            let labAllotted = 0;
            let labG1Allotted = 0;
            let labG2Allotted = 0;

            if (isSplitLab) {
                labG1Allotted = calculateAllotted('LAB', 'G1')
                labG2Allotted = calculateAllotted('LAB', 'G2')
            } else {
                labAllotted = calculateAllotted('LAB')
            }

            return {
                ...c,
                lecRemaining: Math.max(0, (c.lec_hours || 0) - lecAllotted),
                isSplitLab,
                labRemaining: isSplitLab ? 0 : Math.max(0, (c.lab_hours || 0) - labAllotted),
                labG1Remaining: isSplitLab ? Math.max(0, (c.lab_hours || 0) - labG1Allotted) : 0,
                labG2Remaining: isSplitLab ? Math.max(0, (c.lab_hours || 0) - labG2Allotted) : 0,
                totalHours: (c.lec_hours || 0) + (c.lab_hours || 0)
            }
        })
    }, [classes, allocations, timeSlots, rooms, splitLabClasses])

    const faculties = useMemo(() => {
        const unique = [...new Set(classes.map(c => c.teacher_name || 'TBD'))].sort()
        return unique
    }, [classes])

    const sections = useMemo(() => {
        const unique = new Set<string>();
        classesWithStats.forEach(c => {
            unique.add(c.section);
            if (c.isSplitLab) {
                unique.add(`${c.section} G1`);
                unique.add(`${c.section} G2`);
            }
        });
        return Array.from(unique).sort((a, b) => a.localeCompare(b));
    }, [classesWithStats])

    const navigationItems = useMemo(() => {
        if (viewMode === 'room') return rooms
        if (viewMode === 'faculty') return faculties
        if (viewMode === 'section') return sections
        return []
    }, [viewMode, rooms, faculties, sections])

    const activeItem = navigationItems[activeItemIndex]

    // 5. Equipment Filter Logic
    const filteredClasses = useMemo(() => {
        return classesWithStats.filter(c => {
            const matchesSearch = c.course_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.course_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.section.toLowerCase().includes(searchQuery.toLowerCase())
            const matchesSection = filterSection === 'all' || c.section === filterSection || `${c.section} G1` === filterSection || `${c.section} G2` === filterSection;
            return matchesSearch && matchesSection && (c.lecRemaining > 0 || c.labRemaining > 0 || c.labG1Remaining > 0 || c.labG2Remaining > 0)
        })
    }, [classesWithStats, searchQuery, filterSection, viewMode, activeItem])

    // 6. Conflict Detection
    const checkConflicts = useCallback((newAlloc: any, ignoreAllocId?: any) => {
        const conflicts: string[] = []
        const { class_id, schedule_day, schedule_time, room_id } = newAlloc
        const classInfo = classes.find(c => c.id === class_id)
        if (!classInfo) return []

        const startParts = schedule_time.split(' - ')
        const p1 = (startParts[0] || '').trim().substring(0, 5)
        const p2 = (startParts[1] || '').trim().substring(0, 5)
        const startMin = timeSlots.find(s => s.start === p1)?.startMinutes || 0
        const endMin = timeSlots.find(s => s.end.includes(p2))?.endMinutes || 0

        allocations.forEach(existing => {
            if (ignoreAllocId && (existing.id || existing.class_id) === ignoreAllocId) return

            const exParts = existing.schedule_time.split(' - ')
            const ex1 = (exParts[0] || '').trim().substring(0, 5)
            const ex2 = (exParts[1] || '').trim().substring(0, 5)
            const eStart = timeSlots.find(s => s.start === ex1)?.startMinutes || 0
            const eEnd = timeSlots.find(s => s.end.includes(ex2))?.endMinutes || 0

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

    const handleDrop = (day: string, slot: any, component?: string) => {
        if (draggedAllocId) {
            const existingAlloc = allocations.find(a => (a.id || a.class_id) === draggedAllocId);
            if (!existingAlloc) {
                setDraggedAllocId(null);
                return;
            }

            const startParts = (existingAlloc.schedule_time.split(' - ')[0] || '').trim().substring(0, 5)
            const endParts = (existingAlloc.schedule_time.split(' - ')[1] || '').trim().substring(0, 5)
            const oldStart = timeSlots.find(s => s.start === startParts)?.startMinutes || 0
            const oldEnd = timeSlots.find(s => s.end.includes(endParts) || s.end === endParts)?.endMinutes || 0
            const durationMins = oldEnd - oldStart;

            const endSlotIdx = timeSlots.indexOf(slot) + Math.ceil(durationMins / 30) - 1
            const endSlot = timeSlots[Math.min(endSlotIdx, timeSlots.length - 1)]

            let roomInfo: any = viewMode === 'room' ? (activeItem as any) : { id: existingAlloc.room_id, campus: existingAlloc.campus, building: existingAlloc.building, room: existingAlloc.room, capacity: existingAlloc.capacity };
            if (!roomInfo) roomInfo = rooms[0];

            const classInfo = classes.find(c => c.id === existingAlloc.class_id);
            if (roomInfo && classInfo) {
                if (existingAlloc.student_count > (roomInfo.capacity || 0)) {
                    toast.warning(`Warning: Students exceed room capacity.`)
                }
                const componentType = existingAlloc.component || '';
                const isLab = componentType.includes('LAB');
                const LEC_FEATURES_ALLOWLIST = ['TV_Display', 'Projector', 'Whiteboard', 'Sound_System', 'Air_Conditioning', 'Accessibility', 'Podium', 'Smart_TV'];

                let featuresToCheck = [];
                if (isLab) {
                    featuresToCheck = (classInfo.required_lab_features && classInfo.required_lab_features.length > 0)
                        ? classInfo.required_lab_features
                        : classInfo.required_features;
                } else {
                    if (classInfo.required_lec_features && classInfo.required_lec_features.length > 0) {
                        featuresToCheck = classInfo.required_lec_features;
                    } else {
                        // Heuristic: only require "lecture-safe" features if no explicit LEC notes found
                        featuresToCheck = (classInfo.required_features || []).filter((f: string) => LEC_FEATURES_ALLOWLIST.includes(f));
                    }
                }

                if (featuresToCheck && featuresToCheck.length > 0) {
                    const roomFeats = new Set(roomInfo.feature_tags || []);
                    const missing = featuresToCheck.filter((f: string) => !roomFeats.has(f));
                    if (missing.length > 0) {
                        toast.error(`Error: Room lacks required features for ${componentType || 'block'}: ${missing.join(', ')}`);
                        setDraggedAllocId(null);
                        return;
                    }
                }
            }

            const updatedAlloc = {
                ...existingAlloc,
                schedule_day: day,
                schedule_time: `${slot.start} - ${endSlot.end}`,
                room_id: roomInfo.id,
                campus: roomInfo.campus,
                building: roomInfo.building,
                room: roomInfo.room
            }

            const conflicts = checkConflicts(updatedAlloc, draggedAllocId)
            if (conflicts.length > 0) {
                conflicts.forEach(c => toast.error(c))
                setDraggedAllocId(null);
                return;
            }

            setAllocations(prev => prev.map(a => (a.id || a.class_id) === draggedAllocId ? updatedAlloc : a))
            setDraggedAllocId(null);
            toast.success(`Moved ${existingAlloc.course_code}`);
            return;
        }

        if (!draggedClassId) return
        const classInfo = classesWithStats.find(c => c.id === draggedClassId)
        if (!classInfo) return

        // If component not specified (from direct drop), pick one that has remaining hours
        const targetComponent = component || draggingComponent || (classInfo.lecRemaining > 0 ? 'LEC' : 'LAB')

        let remainingHours = 0;
        let targetSection = classInfo.section;
        let targetStudents = classInfo.student_count || 0;
        let saveComponent = targetComponent;

        if (targetComponent === 'LEC') {
            remainingHours = classInfo.lecRemaining;
        } else if (targetComponent === 'LAB') {
            remainingHours = classInfo.labRemaining;
        } else if (targetComponent === 'LAB G1') {
            remainingHours = classInfo.labG1Remaining;
            targetSection = `${classInfo.section} G1`;
            targetStudents = Math.ceil(targetStudents / 2);
            saveComponent = 'LAB';
        } else if (targetComponent === 'LAB G2') {
            remainingHours = classInfo.labG2Remaining;
            targetSection = `${classInfo.section} G2`;
            targetStudents = Math.floor(targetStudents / 2);
            saveComponent = 'LAB';
        }

        if (remainingHours <= 0) {
            toast.error(`No remaining hours for ${targetComponent}`)
            return
        }

        const durationMins = Math.min(remainingHours * 60, 90)
        const endSlotIdx = timeSlots.indexOf(slot) + Math.ceil(durationMins / 30) - 1
        const endSlot = timeSlots[Math.min(endSlotIdx, timeSlots.length - 1)]

        let roomInfo = viewMode === 'room' ? (activeItem as any) : rooms[0]

        if (roomInfo) {
            if (targetStudents > (roomInfo.capacity || 0)) {
                toast.warning(`Warning: Students (${targetStudents}) exceed capacity (${roomInfo.capacity})`)
            }
            const isLab = saveComponent?.includes('LAB');
            const LEC_FEATURES_ALLOWLIST = ['TV_Display', 'Projector', 'Whiteboard', 'Sound_System', 'Air_Conditioning', 'Accessibility', 'Podium', 'Smart_TV'];

            let featuresToCheck = [];
            if (isLab) {
                featuresToCheck = (classInfo.required_lab_features && classInfo.required_lab_features.length > 0)
                    ? classInfo.required_lab_features
                    : classInfo.required_features;
            } else {
                if (classInfo.required_lec_features && classInfo.required_lec_features.length > 0) {
                    featuresToCheck = classInfo.required_lec_features;
                } else {
                    featuresToCheck = (classInfo.required_features || []).filter((f: string) => LEC_FEATURES_ALLOWLIST.includes(f));
                }
            }

            if (featuresToCheck && featuresToCheck.length > 0) {
                const roomFeats = new Set(roomInfo.feature_tags || []);
                const missing = featuresToCheck.filter((f: string) => !roomFeats.has(f));
                if (missing.length > 0) {
                    toast.error(`Error: Room lacks required features for ${saveComponent}: ${missing.join(', ')}`);
                    setDraggedClassId(null);
                    setDraggingComponent(null);
                    return;
                }
            }
        }

        const newAlloc = {
            id: Date.now(), // Local temporary ID
            class_id: classInfo.id,
            room_id: roomInfo.id,
            course_code: classInfo.course_code,
            course_name: classInfo.course_name,
            section: targetSection,
            year_level: classInfo.year_level,
            schedule_day: day,
            schedule_time: `${slot.start} - ${endSlot.end}`,
            campus: roomInfo.campus,
            building: roomInfo.building,
            room: roomInfo.room,
            teacher_name: classInfo.teacher_name || 'TBD',
            component: saveComponent,
            status: 'scheduled'
        }

        const conflicts = checkConflicts(newAlloc)
        if (conflicts.length > 0) {
            conflicts.forEach(c => toast.error(c))
            setDraggedClassId(null);
            setDraggingComponent(null);
            return;
        }

        setAllocations(prev => [...prev, newAlloc])
        setDraggedClassId(null)
        setDraggingComponent(null)
        toast.success(`Allocated ${classInfo.course_code} ${targetComponent}`)
    }

    const handleResize = (allocId: any, day: string, newEndSlot: any) => {
        setAllocations(prev => prev.map(a => {
            if ((a.id || a.class_id) !== allocId || a.schedule_day !== day) return a

            const startParts = (a.schedule_time.split(' - ')[0] || '').trim().substring(0, 5)
            const startSlot = timeSlots.find(s => s.start === startParts)
            if (!startSlot) return a

            if (newEndSlot.endMinutes <= startSlot.startMinutes) return a

            const updatedAlloc = { ...a, schedule_time: `${startSlot.start} - ${newEndSlot.end}` }
            const conflicts = checkConflicts(updatedAlloc, allocId)
            if (conflicts.length > 0) {
                toast.error(conflicts[0]);
                return a;
            }

            return updatedAlloc
        }))
    }

    const adjustDuration = (allocId: any, amountMins: number) => {
        setAllocations(prev => prev.map(a => {
            if ((a.id || a.class_id) !== allocId) return a

            const startParts = (a.schedule_time.split(' - ')[0] || '').trim().substring(0, 5)
            const endParts = (a.schedule_time.split(' - ')[1] || '').trim().substring(0, 5)

            const startSlot = timeSlots.find(s => s.start === startParts)
            const endSlot = timeSlots.find(s => s.end.includes(endParts) || s.end === endParts)

            if (!startSlot || !endSlot) return a

            let newEndMins = endSlot.endMinutes + amountMins
            if (newEndMins <= startSlot.startMinutes) return a

            const lastSlot = timeSlots[timeSlots.length - 1]
            if (newEndMins > lastSlot.endMinutes) return a

            // Apply size checking
            if (amountMins > 0) {
                const classObj = classes.find(c => c.id === a.class_id);
                if (classObj) {
                    const maxMins = a.component.includes('LAB') ? (classObj.lab_hours || 0) * 60 : (classObj.lec_hours || 0) * 60;
                    if ((newEndMins - startSlot.startMinutes) > maxMins && maxMins > 0) {
                        toast.warning(`Maximum hours (${maxMins / 60}h) reached for component.`);
                        return a;
                    }
                }
            }

            const newEndSlot = timeSlots.find(s => s.endMinutes === newEndMins)
            if (!newEndSlot) return a

            const updatedAlloc = { ...a, schedule_time: `${startSlot.start} - ${newEndSlot.end}` }
            const conflicts = checkConflicts(updatedAlloc, allocId)
            if (conflicts.length > 0) {
                toast.error(conflicts[0]);
                return a;
            }

            return updatedAlloc
        }))
    }

    const handleRemoveAlloc = (allocId: any) => {
        setAllocations(prev => prev.filter(a => (a.id || a.class_id) !== allocId))
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
                            <div className={styles.filterRow}>
                                <div className={styles.filterBox}>
                                    <MdGroups />
                                    <select value={filterSection} onChange={e => setFilterSection(e.target.value)}>
                                        <option value="all">All Sections</option>
                                        {sections.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
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
                                    >
                                        <div className={styles.classHeader}>
                                            <strong>{c.course_code}</strong>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                {c.lecRemaining > 0 && <span className={styles.hoursBadge}>Lec {c.lecRemaining}h</span>}
                                                {(!c.isSplitLab) && c.labRemaining > 0 && <span className={styles.hoursBadge} style={{ background: '#e0f2fe', color: '#0284c7' }}>Lab {c.labRemaining}h</span>}
                                                {c.isSplitLab && c.labG1Remaining > 0 && <span className={styles.hoursBadge} style={{ background: '#e0f2fe', color: '#0284c7' }}>Lab G1 {c.labG1Remaining}h</span>}
                                                {c.isSplitLab && c.labG2Remaining > 0 && <span className={styles.hoursBadge} style={{ background: '#e0f2fe', color: '#0284c7' }}>Lab G2 {c.labG2Remaining}h</span>}
                                            </div>
                                        </div>
                                        <p>{c.course_name}</p>
                                        <div className={styles.classDetails}>
                                            <span><MdPerson /> {c.teacher_name || 'TBD'}</span>
                                            <span><MdGroups /> {c.section}</span>
                                        </div>

                                        <div className={styles.componentButtons}>
                                            {c.lecRemaining > 0 && (
                                                <div
                                                    className={styles.compBtn}
                                                    draggable
                                                    onDragStart={() => { setDraggedClassId(c.id); setDraggingComponent('LEC'); }}
                                                    title="Drag Lecture"
                                                >
                                                    <MdLayers /> LEC
                                                </div>
                                            )}
                                            {(!c.isSplitLab) && c.labRemaining > 0 && (
                                                <div
                                                    className={styles.compBtn}
                                                    style={{ borderColor: '#0ea5e9', color: '#0ea5e9' }}
                                                    draggable
                                                    onDragStart={() => { setDraggedClassId(c.id); setDraggingComponent('LAB'); }}
                                                    title="Drag Laboratory"
                                                >
                                                    <MdSchool /> LAB
                                                </div>
                                            )}
                                            {c.isSplitLab && c.labG1Remaining > 0 && (
                                                <div
                                                    className={styles.compBtn}
                                                    style={{ borderColor: '#0ea5e9', color: '#0ea5e9', fontSize: '0.8em' }}
                                                    draggable
                                                    onDragStart={() => { setDraggedClassId(c.id); setDraggingComponent('LAB G1'); }}
                                                    title="Drag Laboratory Group 1"
                                                >
                                                    <MdSchool /> LAB - Section G1 ({Math.ceil((c.student_count || 0) / 2)})
                                                </div>
                                            )}
                                            {c.isSplitLab && c.labG2Remaining > 0 && (
                                                <div
                                                    className={styles.compBtn}
                                                    style={{ borderColor: '#0ea5e9', color: '#0ea5e9', fontSize: '0.8em' }}
                                                    draggable
                                                    onDragStart={() => { setDraggedClassId(c.id); setDraggingComponent('LAB G2'); }}
                                                    title="Drag Laboratory Group 2"
                                                >
                                                    <MdSchool /> LAB - Section G2 ({Math.floor((c.student_count || 0) / 2)})
                                                </div>
                                            )}
                                            {(c.lab_hours > 0) && (
                                                <button
                                                    onClick={() => setSplitLabClasses(prev => prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id])}
                                                    className={styles.compBtn}
                                                    style={{ background: 'transparent', color: '#64748b', borderColor: '#cbd5e1', fontSize: '0.7em', padding: '2px 8px', height: 'fit-content', cursor: 'pointer', borderStyle: 'dashed' }}
                                                    title="Manually split/merge lab sections"
                                                >
                                                    {c.isSplitLab ? 'Merge Lab' : 'Split Lab'}
                                                </button>
                                            )}
                                        </div>

                                        {((c.required_features?.length > 0) || (c.required_lec_features?.length > 0) || (c.required_lab_features?.length > 0)) && (
                                            <div className={styles.featureTags} style={{ marginTop: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                {/* Show LEC tags */}
                                                {c.required_lec_features?.map((f: any) => (
                                                    <span key={`lec-${f}`} className={styles.fTag} style={{ fontSize: '0.65rem', background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: '4px', border: '1px solid #bbf7d0' }} title="LEC Requirement">
                                                        <FaAtom style={{ display: 'inline', marginRight: '3px' }} /> LEC: {f}
                                                    </span>
                                                ))}
                                                {/* Show LAB tags */}
                                                {c.required_lab_features?.map((f: any) => (
                                                    <span key={`lab-${f}`} className={styles.fTag} style={{ fontSize: '0.65rem', background: '#fef9c3', color: '#854d0e', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fef08a' }} title="LAB Requirement">
                                                        <FaAtom style={{ display: 'inline', marginRight: '3px' }} /> LAB: {f}
                                                    </span>
                                                ))}
                                                {/* Show neutral tags only if lec/lab explicit lists are empty or they are not duplicated */}
                                                {c.required_features?.filter((f: any) => !c.required_lec_features?.includes(f) && !c.required_lab_features?.includes(f)).map((f: any) => (
                                                    <span key={f} className={styles.fTag} style={{ fontSize: '0.65rem', background: '#f0fdf4', color: '#166534', padding: '2px 6px', borderRadius: '4px', border: '1px solid #bbf7d0' }}>
                                                        <FaAtom style={{ display: 'inline', marginRight: '3px' }} /> {f}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
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
                                                {(activeItem as any)?.feature_tags?.length > 0 && (
                                                    <small style={{ marginLeft: '6px', opacity: 0.9, fontSize: '0.6em', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                                                        {(activeItem as any)?.feature_tags.join(', ')}
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

                                                    const sTime = (a.schedule_time.split(' - ')[0] || '').trim().substring(0, 5)
                                                    const eTime = (a.schedule_time.split(' - ')[1] || '').trim().substring(0, 5)
                                                    const slotInRange = slot.start >= sTime && slot.start < eTime

                                                    if (viewMode === 'room') return a.room_id === (activeItem as any)?.id && slotInRange
                                                    if (viewMode === 'faculty') return a.teacher_name === (activeItem as string) && slotInRange
                                                    if (viewMode === 'section') {
                                                        const activeSec = (activeItem as string);
                                                        const isMatch = a.section === activeSec || (activeSec.endsWith(' G1') && a.section === activeSec.replace(' G1', '')) || (activeSec.endsWith(' G2') && a.section === activeSec.replace(' G2', ''));
                                                        return isMatch && slotInRange;
                                                    }
                                                    return false
                                                })

                                                const isStart = allocs.some(a => (a.schedule_time.split(' - ')[0] || '').trim().substring(0, 5) === slot.start)

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
                                                            const actualId = a.id || a.class_id
                                                            const isLabComp = a.component === 'LAB'
                                                            return (
                                                                <div
                                                                    key={actualId}
                                                                    draggable
                                                                    onDragStart={() => setDraggedAllocId(actualId)}
                                                                    className={`${styles.placedClass} ${confs.length > 0 ? styles.hasConflict : ''} ${isLabComp ? styles.labComp : ''}`}
                                                                    style={{
                                                                        height: `calc(${((timeSlots.find(s => s.end.includes((a.schedule_time.split(' - ')[1] || '').trim().substring(0, 5)))?.endMinutes || 0) - slot.startMinutes) / 30 * 100}% - 8px)`,
                                                                        zIndex: 10
                                                                    }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                            <strong style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                                {a.course_code}
                                                                                {confs.length > 0 && <span title={confs.join('\n')} style={{ color: '#ef4444', opacity: 1, cursor: 'help', display: 'flex' }}><MdWarning size={14} /></span>}
                                                                            </strong>
                                                                            <span className={styles.compLabel}>{a.component}</span>
                                                                        </div>
                                                                    </div>
                                                                    <span>{a.section}</span>
                                                                    <div className={styles.allocTools}>
                                                                        <button onClick={() => adjustDuration(actualId, 30)} title="Add 30 mins"><MdAdd /></button>
                                                                        <button onClick={() => adjustDuration(actualId, -30)} title="Reduce 30 mins"><MdRemove /></button>
                                                                        <button onClick={() => handleRemoveAlloc(actualId)} title="Remove allocation">
                                                                            <MdDelete />
                                                                        </button>
                                                                    </div>
                                                                    <div
                                                                        className={styles.resizeHandle}
                                                                        onMouseDown={() => setResizingAllocId(actualId)}
                                                                        onTouchStart={() => setResizingAllocId(actualId)}
                                                                    />
                                                                </div>
                                                            )
                                                        })}
                                                    </td>
                                                )
                                            })}
                                        </tr>
                                    ))}
                                    <tr key="endTimeMarker">
                                        <td className={styles.timeLabel} style={{ height: '30px', borderBottom: 'none' }}>
                                            {formatTimeAMPM(timeSettings.endTime || "20:00")}
                                        </td>
                                        {days.map(day => (
                                            <td key={`${day}-end`} style={{ border: 'none' }}></td>
                                        ))}
                                    </tr>
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
