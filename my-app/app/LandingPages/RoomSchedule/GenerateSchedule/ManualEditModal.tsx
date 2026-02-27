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
    collegeRoomMatchingEnabled?: boolean
    allowG1G2SplitSessions?: boolean
}

type ViewMode = 'room' | 'faculty' | 'section'

const formatTimeAMPM = (time24: string) => {
    const [h, m] = time24.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`
}

export default function ManualEditModal({
    isOpen, onClose, onSave, rooms, classes, timeSettings, initialAllocations,
    collegeRoomMatchingEnabled = true,
    allowG1G2SplitSessions = true
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
    const [resizingAllocId, setResizingAllocId] = useState<any | null>(null)
    const [splitLabClasses, setSplitLabClasses] = useState<number[]>([])
    const [hoveredCell, setHoveredCell] = useState<{ day: string, slotId: number } | null>(null);

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

            const isAutoSplitLab = allowG1G2SplitSessions && (c.student_count || 0) > maxLabCapacity && (c.lab_hours > 0);
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
    const checkConflicts = useCallback((newAlloc: any, ignoreSelfId?: any) => {
        const conflicts: string[] = []
        const { class_id, room_id } = newAlloc

        // Handle both property names for robustness
        const schedule_day = newAlloc.schedule_day || newAlloc.day;
        const schedule_time = newAlloc.schedule_time;

        const classInfo = classes.find(c => c.id === class_id)
        if (!classInfo) return []

        const room = rooms.find(r => r.id === room_id);

        // 1. Static Room Attribute Conflicts (Check every time)
        if (room) {
            // Capacity Check
            const isSplitDrop = newAlloc.section?.match(/\bG[12]\b/) || newAlloc.section?.match(/_G[12]/);
            const isAlreadySplitInClass = classInfo.section?.match(/\bG[12]\b/) || classInfo.section?.match(/_G[12]/);

            // Only split the count if it wasn't already split by the source and it's a split-drop session
            const effectiveCount = (isSplitDrop && !isAlreadySplitInClass)
                ? Math.ceil((classInfo.student_count || 0) / 2)
                : (classInfo.student_count || 0);

            if (effectiveCount > room.capacity) {
                conflicts.push(`Capacity conflict: Class size (${effectiveCount} students) exceeds Room capacity (${room.capacity})`);
            }

            // College-Room Matching conflict
            if (collegeRoomMatchingEnabled) {
                const s_col = classInfo.college?.trim().toUpperCase();
                const r_col = room.college?.trim().toUpperCase();
                if (s_col && r_col && r_col !== 'SHARED' && r_col !== s_col) {
                    conflicts.push(`College conflict: Room is ${r_col}, Class is ${s_col}`);
                }
            }
        }

        if (!schedule_day || !schedule_time) return conflicts;

        const startParts = schedule_time.split(' - ')
        const p1 = (startParts[0] || '').trim().substring(0, 5)
        const p2 = (startParts[1] || '').trim().substring(0, 5)
        const startMin = timeSlots.find(s => s.start === p1)?.startMinutes || 0
        const endMin = timeSlots.find(s => s.end.includes(p2))?.endMinutes || 0

        allocations.forEach(existing => {
            // Robust ignore logic: check by object identity OR unique ID OR class_id only if no ID exists
            const existingId = existing.id || existing.class_id;
            if (existing === newAlloc) return;
            if (ignoreSelfId && existingId === ignoreSelfId) return;

            const existing_day = existing.schedule_day || existing.day;
            const existing_time = existing.schedule_time;

            if (!existing_day || !existing_time) return;

            const exParts = existing_time.split(' - ')
            const ex1 = (exParts[0] || '').trim().substring(0, 5)
            const ex2 = (exParts[1] || '').trim().substring(0, 5)
            const eStart = timeSlots.find(s => s.start === ex1)?.startMinutes || 0
            const eEnd = timeSlots.find(s => s.end.includes(ex2))?.endMinutes || 0

            const timeOverlap = (schedule_day === existing_day) &&
                ((startMin >= eStart && startMin < eEnd) || (endMin > eStart && endMin <= eEnd) || (startMin <= eStart && endMin >= eEnd))

            if (timeOverlap) {
                const timeDesc = `${existing_day} ${existing_time}`;
                if (room_id === existing.room_id) {
                    conflicts.push(`Room conflict: ${existing.course_code} (${existing.section}) at ${timeDesc}`);
                }
                if (classInfo.teacher_name && classInfo.teacher_name === existing.teacher_name) {
                    conflicts.push(`Prof conflict: ${classInfo.teacher_name} is in Room ${existing.room || 'another room'} at ${timeDesc}`);
                }
                const getBase = (s: string) => s.replace(/ G[12]$/i, '').replace(/_G[12](_LAB)?$/i, '');
                const baseNew = getBase(newAlloc.section || '');
                const baseExisting = getBase(existing.section || '');

                if (baseNew === baseExisting) {
                    if (newAlloc.section === existing.section) {
                        conflicts.push(`Section conflict: ${newAlloc.section} is busy at ${timeDesc}`);
                    }
                    else if (!newAlloc.section?.includes(' G1') && !newAlloc.section?.includes(' G2') &&
                        !newAlloc.section?.includes('_G1') && !newAlloc.section?.includes('_G2')) {
                        conflicts.push(`Section conflict: Full section ${newAlloc.section} vs ${existing.section} at ${timeDesc}`);
                    }
                    else if (!existing.section?.includes(' G1') && !existing.section?.includes(' G2') &&
                        !existing.section?.includes('_G1') && !existing.section?.includes('_G2')) {
                        conflicts.push(`Section conflict: ${newAlloc.section} vs Full section ${existing.section} at ${timeDesc}`);
                    }
                }
            }
        })

        return conflicts
    }, [classes, allocations, timeSlots, rooms, collegeRoomMatchingEnabled])

    // NEW: Find the best available room based on requirements and availability
    const findOptimalRoom = useCallback((classInfo: any, component: string, day: string, startSlot: any, durationMins: number, ignoreAllocId?: any) => {
        if (!classInfo || !rooms.length) return null;

        const isLab = component.includes('LAB');
        const students = component.includes('G1') || component.includes('G2')
            ? Math.ceil((classInfo.student_count || 0) / 2)
            : (classInfo.student_count || 0);

        // 1. Determine required features
        const LEC_FEATURES_ALLOWLIST = ['TV_Display', 'Projector', 'Whiteboard', 'Sound_System', 'Air_Conditioning', 'Accessibility', 'Podium', 'Smart_TV'];
        let reqFeatures: string[] = [];
        if (isLab) {
            reqFeatures = (classInfo.required_lab_features?.length > 0)
                ? classInfo.required_lab_features
                : classInfo.required_features || [];
        } else {
            reqFeatures = (classInfo.required_lec_features?.length > 0)
                ? classInfo.required_lec_features
                : (classInfo.required_features || []).filter((f: string) => LEC_FEATURES_ALLOWLIST.includes(f));
        }

        const startMins = startSlot.startMinutes;
        const endMins = startSlot.startMinutes + durationMins;

        // 2. Score candidate rooms
        const candidates = rooms.map(room => {
            let score = 0;
            const rType = room.room_type?.toLowerCase() || '';
            const roomIsLab = rType.includes('lab');

            // --- HARD CONSTRAINTS ---
            // a) Room Type Compatibility
            if (isLab && !roomIsLab) return { room, score: -1000 };

            // b) Capacity Fit
            if (room.capacity < students) return { room, score: -1000 };

            // c) Availability Check
            const isBusy = allocations.some(a => {
                if (ignoreAllocId && (a.id || a.class_id) === ignoreAllocId) return false;
                if (a.room_id !== room.id || a.schedule_day !== day) return false;

                const aStartParts = (a.schedule_time.split(' - ')[0] || '').trim().substring(0, 5);
                const aEndParts = (a.schedule_time.split(' - ')[1] || '').trim().substring(0, 5);
                const aStartMins = timeSlots.find(s => s.start === aStartParts)?.startMinutes || 0;
                const aEndMins = timeSlots.find(s => s.end === aEndParts)?.endMinutes || 0;

                return (startMins < aEndMins && endMins > aStartMins);
            });
            if (isBusy) return { room, score: -1000 };

            // d) Feature Requirements
            const roomFeats = new Set(room.feature_tags || []);
            if (reqFeatures.some(f => !roomFeats.has(f))) return { room, score: -1000 };

            // e) College Matching
            if (collegeRoomMatchingEnabled) {
                const s_col = classInfo.college?.trim().toUpperCase();
                const r_col = room.college?.trim().toUpperCase();
                if (s_col && r_col && r_col !== 'SHARED' && r_col !== s_col) {
                    return { room, score: -1000 };
                }
            }

            // --- SOFT PREFERENCES ---
            if (!isLab && !roomIsLab) score += 200; // Prefer LEC in Lecture rooms
            if (!isLab && roomIsLab) score -= 100; // Penalize LEC in Lab

            const waste = room.capacity - students;
            score += Math.max(0, 100 - waste); // Prefer closer fit to avoid wasting large rooms

            return { room, score };
        });

        // Pick highest score
        const sorted = candidates
            .filter(c => c.score > -900)
            .sort((a, b) => b.score - a.score);

        return sorted.length > 0 ? sorted[0].room : null;
    }, [rooms, allocations, timeSlots])

    // 7. Actions
    const handleNavigation = (direction: 'next' | 'prev') => {
        if (direction === 'next') {
            setActiveItemIndex(prev => (prev + 1) % navigationItems.length)
        } else {
            setActiveItemIndex(prev => (prev - 1 + navigationItems.length) % navigationItems.length)
        }
    }

    const handleDrop = (day: string, slot: any, component?: string) => {
        // --- CASE 1: MOVING EXISTING ALLOCATION ---
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

            const classInfo = classes.find(c => c.id === existingAlloc.class_id);
            if (!classInfo) { setDraggedAllocId(null); return; }

            // Auto-detect best room if not in Room View
            let roomInfo = null;
            if (viewMode === 'room') {
                roomInfo = (activeItem as any);
            } else {
                roomInfo = findOptimalRoom(classInfo, existingAlloc.component, day, slot, durationMins, draggedAllocId);
                if (!roomInfo) {
                    toast.error(`No suitable/available room found for ${existingAlloc.component} at this time.`);
                    setDraggedAllocId(null);
                    return;
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
            toast.success(`Moved ${existingAlloc.course_code} to Room ${roomInfo.room}`);
            return;
        }

        // --- CASE 2: ALLOCATING NEW CARD ---
        if (!draggedClassId) return
        const classInfo = classesWithStats.find(c => c.id === draggedClassId)
        if (!classInfo) return

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

        const durationMins = Math.min(remainingHours * 60, 90) // Default to 1.5h blocks or remaining
        const endSlotIdx = timeSlots.indexOf(slot) + Math.ceil(durationMins / 30) - 1
        const endSlot = timeSlots[Math.min(endSlotIdx, timeSlots.length - 1)]

        // Auto-detect and assign best room
        let roomInfo = null;
        if (viewMode === 'room') {
            roomInfo = (activeItem as any);
        } else {
            roomInfo = findOptimalRoom(classInfo, targetComponent, day, slot, durationMins);
            if (!roomInfo) {
                toast.error(`No suitable/available room found for ${targetComponent} at this time.`);
                setDraggedClassId(null);
                setDraggingComponent(null);
                return;
            }
        }

        // Double check features if dropped manually in Room View
        if (viewMode === 'room' && roomInfo) {
            const isLabComp = saveComponent?.includes('LAB');
            const LEC_FEATURES_ALLOWLIST = ['TV_Display', 'Projector', 'Whiteboard', 'Sound_System', 'Air_Conditioning', 'Accessibility', 'Podium', 'Smart_TV'];
            let featuresToCheck = isLabComp
                ? (classInfo.required_lab_features?.length > 0 ? classInfo.required_lab_features : classInfo.required_features || [])
                : (classInfo.required_lec_features?.length > 0 ? classInfo.required_lec_features : (classInfo.required_features || []).filter((f: string) => LEC_FEATURES_ALLOWLIST.includes(f)));

            const roomFeats = new Set(roomInfo.feature_tags || []);
            const missing = (featuresToCheck as string[]).filter((f: string) => !roomFeats.has(f));
            if (missing.length > 0) {
                toast.error(`Error: Room lacks required features: ${missing.join(', ')}`);
                setDraggedClassId(null);
                setDraggingComponent(null);
                return;
            }
        }

        const newAlloc = {
            id: Date.now(),
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
        toast.success(`Allocated ${classInfo.course_code} ${targetComponent} in Room ${roomInfo.room}`)
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

    const getPotentialAlloc = useCallback((day: string, slot: any) => {
        if (!draggedClassId && !draggedAllocId) return null;

        let baseClass: any;
        let component: string = draggingComponent || 'LEC';
        let section: string = '';

        if (draggedAllocId) {
            const existing = allocations.find(a => (a.id || a.class_id) === draggedAllocId);
            if (!existing) return null;
            baseClass = classes.find(c => c.id === existing.class_id);
            component = existing.component;
            section = existing.section;
        } else {
            baseClass = classes.find(c => c.id === draggedClassId);
            if (!baseClass) return null;

            // Determine section based on component
            if (component === 'LEC') {
                section = baseClass.section || 'SEC';
            } else if (component === 'LAB') {
                section = baseClass.section ? `${baseClass.section}_LAB` : 'LAB';
            } else if (component === 'LAB G1') {
                section = baseClass.section ? `${baseClass.section}_G1_LAB` : 'G1_LAB';
                component = 'LAB';
            } else if (component === 'LAB G2') {
                section = baseClass.section ? `${baseClass.section}_G2_LAB` : 'G2_LAB';
                component = 'LAB';
            }
        }

        if (!baseClass) return null;

        // Calculate end time based on original duration or default 1hr
        let durationMins = 60;
        if (draggedAllocId) {
            const a = allocations.find(ea => (ea.id || ea.class_id) === draggedAllocId);
            if (a) {
                const parts = a.schedule_time.split(' - ');
                const s = timeSlots.find(ts => ts.start === parts[0].substring(0, 5))?.startMinutes || 0;
                const e = timeSlots.find(ts => ts.end.includes(parts[1].substring(0, 5)))?.endMinutes || 0;
                durationMins = e - s;
            }
        } else {
            durationMins = component === 'LEC' ? (baseClass.lec_hours || 1) * 60 : (baseClass.lab_hours || 1) * 60;
        }

        const endMins = slot.startMinutes + durationMins;
        const endSlot = timeSlots.find(ts => ts.endMinutes === endMins || (ts.startMinutes < endMins && ts.endMinutes >= endMins));
        const finalEndStr = endSlot ? endSlot.end : timeSlots[timeSlots.length - 1].end;

        const newAlloc: any = {
            ...baseClass,
            class_id: baseClass.id,
            schedule_day: day,
            day: day,
            schedule_time: `${slot.start} - ${finalEndStr}`,
            component,
            section
        };

        if (viewMode === 'room') {
            newAlloc.room_id = (activeItem as any)?.id;
            newAlloc.room = (activeItem as any)?.room;
        } else if (viewMode === 'faculty') {
            newAlloc.teacher_name = activeItem as string;
            // Need a room - use first available or previous
            newAlloc.room_id = rooms[0]?.id;
        } else if (viewMode === 'section') {
            newAlloc.section = activeItem as string;
            newAlloc.room_id = rooms[0]?.id;
        }

        return newAlloc;
    }, [draggedClassId, draggedAllocId, draggingComponent, allocations, classes, timeSlots, viewMode, activeItem, rooms]);

    const getDraggedDuration = useCallback(() => {
        if (!draggedClassId && !draggedAllocId) return 0;
        let baseClass: any;
        let component = draggingComponent || 'LEC';

        if (draggedAllocId) {
            const existing = allocations.find(a => (a.id || a.class_id) === draggedAllocId);
            if (!existing) return 60;
            const parts = existing.schedule_time.split(' - ');
            const s = timeSlots.find(ts => ts.start === parts[0].substring(0, 5))?.startMinutes || 0;
            const e = timeSlots.find(ts => ts.end.includes(parts[1].substring(0, 5)))?.endMinutes || 0;
            return e - s;
        } else {
            baseClass = classes.find(c => c.id === draggedClassId);
            if (!baseClass) return 60;
            return (component === 'LEC' ? (baseClass.lec_hours || 1) : (baseClass.lab_hours || 1)) * 60;
        }
    }, [draggedClassId, draggedAllocId, draggingComponent, allocations, classes, timeSlots]);

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
                            <div className={styles.vDivider} />
                            <button
                                className={styles.resetBtn}
                                onClick={() => {
                                    if (confirm('Are you sure you want to clear the entire current manual schedule? This will remove all placed classes from the editor.')) {
                                        setAllocations([]);
                                        toast.info('Timetable cleared');
                                    }
                                }}
                            >
                                <MdDelete /> Clear All
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
                                                    onDragEnd={() => { setDraggedClassId(null); setDraggingComponent(null); }}
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
                                                    onDragEnd={() => { setDraggedClassId(null); setDraggingComponent(null); }}
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
                                                    onDragEnd={() => { setDraggedClassId(null); setDraggingComponent(null); }}
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
                                                    onDragEnd={() => { setDraggedClassId(null); setDraggingComponent(null); }}
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
                                                        const getBase = (s: string) => s
                                                            .replace(/_LAB$/i, '')
                                                            .replace(/_LEC$/i, '')
                                                            .replace(/_LECTURE$/i, '')
                                                            .replace(/_LABORATORY$/i, '')
                                                            .replace(/_G[12](_LAB|_LEC|_LECTURE|_LABORATORY)?$/i, '')
                                                            .replace(/ G[12](\s+)?(LAB|LEC|LECTURE|LABORATORY)?$/i, '')
                                                            .replace(/ LAB$/i, '')
                                                            .replace(/ LEC$/i, '')
                                                            .trim();
                                                        const isMatch = a.section === activeSec || getBase(a.section) === getBase(activeSec);
                                                        return isMatch && slotInRange;
                                                    }
                                                    return false
                                                })

                                                const isStart = allocs.some(a => (a.schedule_time.split(' - ')[0] || '').trim().substring(0, 5) === slot.start)

                                                return (
                                                    <td
                                                        key={day}
                                                        className={`${styles.slotCell} ${allocs.length > 0 ? styles.occupied : ''} ${hoveredCell?.day === day && hoveredCell?.slotId === slot.id ? styles.isHovered : ''
                                                            }`}
                                                        onDragOver={e => {
                                                            e.preventDefault();
                                                            if (hoveredCell?.day !== day || hoveredCell?.slotId !== slot.id) {
                                                                setHoveredCell({ day, slotId: slot.id });
                                                            }
                                                        }}
                                                        onDragLeave={() => setHoveredCell(null)}
                                                        onDrop={() => {
                                                            setHoveredCell(null);
                                                            handleDrop(day, slot);
                                                        }}
                                                        onMouseEnter={() => {
                                                            if (resizingAllocId !== null) {
                                                                handleResize(resizingAllocId, day, slot)
                                                            }
                                                        }}
                                                    >
                                                        {(() => {
                                                            if (!(draggedClassId || draggedAllocId) || !hoveredCell || hoveredCell.day !== day) return null;

                                                            const hoverSlot = timeSlots.find(ts => ts.id === hoveredCell.slotId);
                                                            if (!hoverSlot) return null;

                                                            const duration = getDraggedDuration();
                                                            const isInShadow = slot.startMinutes >= hoverSlot.startMinutes && slot.startMinutes < hoverSlot.startMinutes + duration;

                                                            if (!isInShadow) return null;

                                                            const isStart = slot.id === hoveredCell.slotId;
                                                            const isEnd = slot.startMinutes + 30 >= hoverSlot.startMinutes + duration;
                                                            const p = getPotentialAlloc(day, hoverSlot);
                                                            const confs = p ? checkConflicts(p, draggedAllocId) : ['Invalid Slot'];
                                                            const isValid = confs.length === 0;

                                                            return (
                                                                <div
                                                                    className={`${styles.dropSilhouette} ${isValid ? styles.silValid : styles.silInvalid}`}
                                                                    style={{
                                                                        top: isStart ? '2px' : '-2px',
                                                                        height: isStart ? 'calc(100% - 4px)' : isEnd ? 'calc(100% - 2px)' : 'calc(100% + 4px)',
                                                                        borderTop: isStart ? undefined : 'none',
                                                                        borderBottom: isEnd ? undefined : 'none',
                                                                        borderRadius: isStart ? '8px 8px 0 0' : isEnd ? '0 0 8px 8px' : '0'
                                                                    }}
                                                                >
                                                                    {isStart && (
                                                                        <div className={styles.silContent}>
                                                                            {isValid ? <MdCheckCircle /> : <MdWarning />}
                                                                            <span>{isValid ? 'Available' : confs[0]}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                        {isStart && allocs.map(a => {
                                                            const confs = checkConflicts(a, a.class_id)
                                                            const actualId = a.id || a.class_id
                                                            const isLabComp = a.component === 'LAB'
                                                            return (
                                                                <div
                                                                    key={actualId}
                                                                    draggable
                                                                    onDragStart={() => setDraggedAllocId(actualId)}
                                                                    onDragEnd={() => { setDraggedAllocId(null); setHoveredCell(null); }}
                                                                    className={`${styles.placedClass} ${confs.length > 0 ? styles.hasConflict : ''} ${isLabComp ? styles.labComp : ''}`}
                                                                    style={{
                                                                        height: `calc(${((timeSlots.find(s => s.end.includes((a.schedule_time.split(' - ')[1] || '').trim().substring(0, 5)))?.endMinutes || 0) - slot.startMinutes) / 30 * 100}% - 8px)`,
                                                                        zIndex: 10
                                                                    }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                            <strong style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                                {a.course_code}
                                                                            </strong>
                                                                            <span className={styles.compLabel}>{a.component}</span>
                                                                        </div>
                                                                    </div>
                                                                    <span style={{ fontWeight: 600 }}>{a.section}</span>

                                                                    {confs.length > 0 && (
                                                                        <div
                                                                            className={styles.conflictIndicator}
                                                                            title={confs.join('\n')}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                toast.error("Constraint Violation", {
                                                                                    description: confs.map((c, i) => `${i + 1}. ${c}`).join('\n'),
                                                                                    duration: 5000
                                                                                });
                                                                            }}
                                                                        >
                                                                            <MdWarning size={24} />
                                                                            <span>Conflict</span>
                                                                        </div>
                                                                    )}
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
