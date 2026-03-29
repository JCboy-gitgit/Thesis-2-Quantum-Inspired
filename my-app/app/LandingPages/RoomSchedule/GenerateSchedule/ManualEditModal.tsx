'use client'
import React, { useState, useMemo, useEffect, useCallback } from 'react'
import {
    MdClose, MdTableChart, MdSearch,
    MdMeetingRoom, MdLayers, MdPerson, MdGroups, MdAccessTime, MdAdd, MdDelete, MdSave,
    MdChevronLeft, MdChevronRight, MdRemove, MdSchool
} from 'react-icons/md'
import { FaChalkboardTeacher, FaDoorOpen, FaUsers, FaAtom } from 'react-icons/fa'
import styles from './ManualEditModal.module.css'
import { toast } from 'sonner'
import {
    checkAllConflicts,
    parseScheduleTime,
    buildConflictReasonMessages,
    type AllocationSlot,
} from '@/lib/conflictChecker'
import ConflictStatusBadge from '@/app/components/ConflictStatusBadge/ConflictStatusBadge'

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
    unscheduledSourceClasses?: any[]
}

type ViewMode = 'room' | 'faculty' | 'section'

const formatTimeAMPM = (time24: string) => {
    const [h, m] = time24.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`
}

const UNKNOWN_COLLEGE = 'Unassigned College'

const normalizeCollegeLabel = (value?: string) => {
    const trimmed = (value || '').trim()
    return trimmed.length > 0 ? trimmed : UNKNOWN_COLLEGE
}

const parseCollegeLabels = (value?: string) => {
    const normalized = normalizeCollegeLabel(value)
    if (normalized === UNKNOWN_COLLEGE) return [UNKNOWN_COLLEGE]

    const separated = normalized
        .split(/\s*(?:\/|&|\||;|,)\s*/)
        .map(part => part.trim())
        .filter(Boolean)

    if (separated.length > 1) {
        return Array.from(new Set(separated.map(part => normalizeCollegeLabel(part))))
    }

    // Handle short abbreviation pattern like "CS and CAL" without breaking full college names.
    const andParts = normalized
        .split(/\s+and\s+/i)
        .map(part => part.trim())
        .filter(Boolean)

    const looksLikeAbbrList = andParts.length > 1 && andParts.every(part => /^[A-Z][A-Z0-9-]{1,10}$/.test(part))
    if (looksLikeAbbrList) {
        return Array.from(new Set(andParts.map(part => normalizeCollegeLabel(part))))
    }

    return [normalized]
}

const removeUnknownCollegeWhenKnownExists = (colleges: Set<string>) => {
    if (colleges.size > 1 && colleges.has(UNKNOWN_COLLEGE)) {
        colleges.delete(UNKNOWN_COLLEGE)
    }
    return colleges
}

const isUnassignedFacultyName = (value?: string) => {
    const normalized = String(value || '').trim().toUpperCase()
    if (!normalized) return true
    return new Set(['TBD', 'TBA', 'N/A', 'NA', 'NONE', 'NULL', 'UNASSIGNED', 'UNKNOWN']).has(normalized)
}

export default function ManualEditModal({
    isOpen, onClose, onSave, rooms, classes, timeSettings, initialAllocations,
    collegeRoomMatchingEnabled = true,
    allowG1G2SplitSessions = true,
    unscheduledSourceClasses,
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
    const [selectedTeacherByClass, setSelectedTeacherByClass] = useState<Record<number, string>>({})
    const [selectedCollegeByClass, setSelectedCollegeByClass] = useState<Record<number, string>>({})
    const [hoveredCell, setHoveredCell] = useState<{ day: string, slotId: number } | null>(null);

    // Sync with props if they change
    useEffect(() => {
        setAllocations(initialAllocations)
    }, [initialAllocations])

    useEffect(() => {
        const next: Record<number, string> = {}
        classes.forEach(c => {
            next[c.id] = c.teacher_name || 'TBD'
        })
        setSelectedTeacherByClass(next)
    }, [classes, isOpen])

    useEffect(() => {
        const next: Record<number, string> = {}
        classes.forEach(c => {
            next[c.id] = normalizeCollegeLabel(c.college)
        })
        setSelectedCollegeByClass(next)
    }, [classes, isOpen])

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

    const parseClockToMinutes = (clock: string): number | null => {
        const match = (clock || '').trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i)
        if (!match) return null

        let hour = parseInt(match[1], 10)
        const minute = parseInt(match[2], 10)
        const ampm = (match[3] || '').toUpperCase()

        if (ampm) {
            if (ampm === 'PM' && hour !== 12) hour += 12
            if (ampm === 'AM' && hour === 12) hour = 0
        }

        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
        return (hour * 60) + minute
    }

    const getRangeMinutes = (scheduleTime: string): { start: number, end: number } | null => {
        const normalized = (scheduleTime || '').replace(/\s+to\s+/gi, ' - ')
        const parts = normalized.includes(' - ')
            ? normalized.split(' - ')
            : normalized.split('-')

        if (parts.length < 2) return null

        const start = parseClockToMinutes(parts[0])
        const end = parseClockToMinutes(parts[1])
        if (start === null || end === null || end <= start) return null

        return { start, end }
    }

    const getAllocationRange = (allocation: any): { start: number, end: number } | null => {
        return getRangeMinutes(String(allocation?.schedule_time || ''))
    }

    const normalizeDayLabel = (day: string) => String(day || '').trim().toLowerCase()

    const findSlotByStartMinutes = (startMinutes: number) => {
        return timeSlots.find(s => s.startMinutes === startMinutes)
    }

    const findSlotByEndMinutes = (endMinutes: number) => {
        return timeSlots.find(s => s.endMinutes === endMinutes)
    }

    const getSectionGroup = (section: string): 'G1' | 'G2' | null => {
        const match = (section || '').replace(/_/g, ' ').match(/\b(G1|G2)\b/i)
        if (!match) return null
        const group = match[1].toUpperCase()
        return group === 'G1' || group === 'G2' ? group : null
    }

    const getSectionBase = (section: string) => {
        return (section || '')
            .replace(/_LAB$/i, '')
            .replace(/_LEC$/i, '')
            .replace(/_LECTURE$/i, '')
            .replace(/_LABORATORY$/i, '')
            .replace(/_G[12](_LAB|_LEC|_LECTURE|_LABORATORY)?$/i, '')
            .replace(/-G[12](?:-(?:LAB|LEC|LECTURE|LABORATORY))?$/i, '')
            .replace(/ G[12](\s+)?(LAB|LEC|LECTURE|LABORATORY)?$/i, '')
            .replace(/ LAB$/i, '')
            .replace(/ LEC$/i, '')
            .trim()
    }

    const makeSectionOptionValue = (section: string, group?: 'G1' | 'G2') => {
        const base = getSectionBase(section)
        if (!base) return ''
        return group ? `${base}-${group}` : base
    }

    const getAllocationComponent = (alloc: any): 'LEC' | 'LAB' => {
        const raw = String(alloc?.component || '').toUpperCase()
        if (raw.includes('LAB')) return 'LAB'
        if (raw.includes('LEC')) return 'LEC'

        const section = String(alloc?.section || '')
        if (/(?:^|[_\s-])LAB(?:$|[_\s-])/i.test(section)) return 'LAB'
        return 'LEC'
    }

    const getAllocationHours = (alloc: any): number => {
        const range = getRangeMinutes(String(alloc?.schedule_time || ''))
        if (!range) return 0
        return (range.end - range.start) / 60
    }

    const getAllocatedHoursForComponent = (
        allocList: any[],
        classId: number,
        component: 'LEC' | 'LAB',
        group: 'G1' | 'G2' | null = null,
        ignoreAllocId?: any
    ): number => {
        return allocList
            .filter(a => {
                if (a.class_id !== classId) return false
                if (ignoreAllocId && ((a.id || a.class_id) === ignoreAllocId)) return false
                if (getAllocationComponent(a) !== component) return false

                if (component === 'LAB') {
                    const allocGroup = getSectionGroup(String(a.section || ''))
                    if (group) return allocGroup === group
                    return allocGroup === null
                }

                return true
            })
            .reduce((total, a) => total + getAllocationHours(a), 0)
    }

    const extractCollegeKey = (value?: string) => {
        const raw = (value || '').trim().toUpperCase()
        if (!raw || raw === UNKNOWN_COLLEGE.toUpperCase()) return ''
        const abbr = raw.match(/\(([^)]+)\)\s*$/)?.[1]?.trim().toUpperCase()
        return abbr || raw
    }

    const getCollegeKeys = (value?: string) => {
        return Array.from(new Set(parseCollegeLabels(value).map(part => extractCollegeKey(part)).filter(Boolean)))
    }

    const canAssignComponentToRoom = (
        classInfo: any,
        room: any,
        component: 'LEC' | 'LAB',
        students: number
    ) => {
        if (!room) return false

        const roomType = String(room.room_type || '').toLowerCase()
        const roomIsLab = roomType.includes('lab') || roomType.includes('computer')

        if (component === 'LAB' && !roomIsLab) return false
        if ((room.capacity || 0) < students) return false

        const LEC_FEATURES_ALLOWLIST = ['TV_Display', 'Projector', 'Whiteboard', 'Sound_System', 'Air_Conditioning', 'Accessibility', 'Podium', 'Smart_TV']
        const requiredFeatures = component === 'LAB'
            ? ((classInfo.required_lab_features?.length > 0)
                ? classInfo.required_lab_features
                : (classInfo.required_features || []))
            : ((classInfo.required_lec_features?.length > 0)
                ? classInfo.required_lec_features
                : (classInfo.required_features || []).filter((f: string) => LEC_FEATURES_ALLOWLIST.includes(f)))

        const roomFeatures = new Set<string>((room.feature_tags || []) as string[])
        if ((requiredFeatures || []).some((f: string) => !roomFeatures.has(f))) return false

        if (collegeRoomMatchingEnabled) {
            const classCollegeKeys = getCollegeKeys(getEffectiveCollege(classInfo))
            const roomCollegeKey = extractCollegeKey((room.college || '').trim())
            if (classCollegeKeys.length > 0 && roomCollegeKey && roomCollegeKey !== 'SHARED') {
                if (!classCollegeKeys.includes(roomCollegeKey)) return false
            }
        }

        return true
    }

    const getTeacherWeeklyLimit = (entry: any): number | null => {
        const candidates = [
            entry?.faculty_max_hours_per_week,
            entry?.teacher_max_hours_per_week,
            entry?.max_teacher_hours_per_week,
            entry?.max_hours_per_week,
            entry?.weekly_max_hours,
            entry?.faculty_profiles?.max_hours_per_week
        ]

        for (const value of candidates) {
            const n = Number(value)
            if (Number.isFinite(n) && n > 0) return n
        }

        return null
    }

    const teacherWeeklyLimitByName = useMemo(() => {
        const map = new Map<string, number>()
        classes.forEach(c => {
            const name = String(c.teacher_name || '').trim()
            if (!name) return
            const limit = getTeacherWeeklyLimit(c)
            if (limit !== null) {
                const existing = map.get(name)
                map.set(name, existing ? Math.max(existing, limit) : limit)
            }
        })
        return map
    }, [classes])

    const teacherOptionsByClassId = useMemo(() => {
        const map = new Map<number, string[]>()
        const isMeaningfulTeacher = (value: string) => {
            const normalized = String(value || '').trim().toUpperCase()
            if (!normalized) return false
            return !new Set(['TBD', 'TBA', 'N/A', 'NA', 'NONE', 'NULL', 'UNASSIGNED', 'UNKNOWN']).has(normalized)
        }

        classes.forEach(c => {
            const options = new Set<string>()

            const explicitOptions = Array.isArray((c as any).teacher_options)
                ? (c as any).teacher_options.map((t: any) => String(t || '').trim()).filter(Boolean)
                : []
            explicitOptions.forEach((teacherName: string) => {
                if (isMeaningfulTeacher(teacherName)) options.add(teacherName)
            })

            classes.forEach(other => {
                const sameCourse =
                    (String(other.course_code || '').trim() !== '' && String(c.course_code || '').trim() !== '' && other.course_code === c.course_code) ||
                    (String(other.course_code || '').trim() === '' && String(c.course_code || '').trim() === '' && other.course_name === c.course_name)
                if (sameCourse) {
                    const t = String(other.teacher_name || '').trim()
                    if (isMeaningfulTeacher(t)) options.add(t)
                }
            })

            const current = String(c.teacher_name || '').trim()
            if (options.size === 0 && isMeaningfulTeacher(current)) {
                options.add(current)
            }

            if (options.size === 0) options.add(current || 'TBD')
            map.set(c.id, Array.from(options).sort((a, b) => a.localeCompare(b)))
        })
        return map
    }, [classes])

    const classAllocatedHoursById = useMemo(() => {
        const map = new Map<number, number>()
        allocations.forEach(a => {
            const cid = Number(a.class_id)
            const hours = getAllocationHours(a)
            map.set(cid, (map.get(cid) || 0) + hours)
        })
        return map
    }, [allocations])

    // Some legacy rows have missing lec/lab hours in class_schedules.
    // Use the initial timetable as a baseline requirement so deleted blocks return to the left panel.
    const baselineRequiredHoursByClass = useMemo(() => {
        const map = new Map<number, { lec: number, lab: number }>()

        const ensure = (classId: number) => {
            if (!map.has(classId)) map.set(classId, { lec: 0, lab: 0 })
            return map.get(classId)!
        }

        ;(initialAllocations || []).forEach((a: any) => {
            const classId = Number(a?.class_id)
            if (!Number.isFinite(classId) || classId <= 0) return

            const hours = getAllocationHours(a)
            if (hours <= 0) return

            const bucket = ensure(classId)
            const component = getAllocationComponent(a)
            if (component === 'LAB') {
                bucket.lab += hours
            } else {
                bucket.lec += hours
            }
        })

        return map
    }, [initialAllocations])

    const teacherAllocatedHoursExcludingClass = useCallback((teacherName: string, classId: number) => {
        return allocations
            .filter(a => String(a.teacher_name || '').trim() === teacherName && a.class_id !== classId)
            .reduce((sum, a) => sum + getAllocationHours(a), 0)
    }, [allocations])

    const getEffectiveTeacherName = useCallback((classInfo: any): string => {
        return selectedTeacherByClass[classInfo.id] || classInfo.teacher_name || 'TBD'
    }, [selectedTeacherByClass])

    const getEffectiveCollege = useCallback((classInfo: any): string => {
        return selectedCollegeByClass[classInfo.id] || normalizeCollegeLabel(classInfo.college)
    }, [selectedCollegeByClass])

    const handleTeacherSelection = (classId: number, teacherName: string) => {
        setSelectedTeacherByClass(prev => ({ ...prev, [classId]: teacherName }))
        setAllocations(prev => prev.map(a => a.class_id === classId ? { ...a, teacher_name: teacherName } : a))
    }

    const handleCollegeSelection = (classId: number, collegeLabel: string) => {
        const normalizedCollege = normalizeCollegeLabel(collegeLabel)
        setSelectedCollegeByClass(prev => ({ ...prev, [classId]: normalizedCollege }))
        setAllocations(prev => prev.map(a => a.class_id === classId ? { ...a, college: normalizedCollege } : a))
    }

    const availableCollegeOptions = useMemo(() => {
        const options = new Set<string>([UNKNOWN_COLLEGE])
        rooms.forEach(room => parseCollegeLabels(room.college).forEach(label => options.add(label)))
        classes.forEach(cls => parseCollegeLabels(cls.college).forEach(label => options.add(label)))

        return Array.from(options).sort((a, b) => {
            if (a === UNKNOWN_COLLEGE) return 1
            if (b === UNKNOWN_COLLEGE) return -1
            return a.localeCompare(b)
        })
    }, [rooms, classes])

    // 4. Classes with Remaining Hours (Split by Lec/Lab)
    const classesWithStats = useMemo(() => {
        const getMaxCompatibleLabCapacity = (c: any) => {
            const classCollegeKeys = getCollegeKeys(getEffectiveCollege(c));
            const requiredFeatures = new Set<string>(
                (c.required_lab_features && c.required_lab_features.length > 0)
                    ? c.required_lab_features
                    : (c.required_features || [])
            );

            const compatibleLabs = rooms.filter(r => {
                const rType = (r.room_type || '').toLowerCase();
                const isLab = rType.includes('lab') || rType.includes('computer');
                if (!isLab) return false;

                if (collegeRoomMatchingEnabled) {
                    const rCollegeRaw = (r.college || '').trim();
                    if (rCollegeRaw) {
                        const rCollege = extractCollegeKey(rCollegeRaw);
                        if (rCollege !== 'SHARED' && classCollegeKeys.length > 0 && !classCollegeKeys.includes(rCollege)) {
                            return false;
                        }
                    }
                }

                const roomFeatures = new Set<string>((r.feature_tags || []) as string[]);
                if (requiredFeatures.size > 0 && !Array.from(requiredFeatures).every(f => roomFeatures.has(f))) {
                    return false;
                }

                return true;
            });

            return compatibleLabs.length > 0
                ? Math.max(...compatibleLabs.map(r => r.capacity || 0))
                : 30;
        };

        return classes.map(c => {
            const baseline = baselineRequiredHoursByClass.get(c.id)
            const effectiveLecHours = Math.max(Number(c.lec_hours || 0), Number(baseline?.lec || 0))
            const effectiveLabHours = Math.max(Number(c.lab_hours || 0), Number(baseline?.lab || 0))

            const calculateAllotted = (compStr: string, suffix?: string) => {
                return allocations
                    .filter(a => {
                        if (a.class_id !== c.id) return false
                        if (getAllocationComponent(a) !== compStr) return false
                        if (!suffix) return true
                        return getSectionGroup(String(a.section || '')) === suffix
                    })
                    .reduce((acc, a) => acc + getAllocationHours(a), 0)
            }

            const lecAllotted = calculateAllotted('LEC')

            const maxCompatibleLabCapacity = getMaxCompatibleLabCapacity(c);
            const isAutoSplitLab = allowG1G2SplitSessions && (c.student_count || 0) > maxCompatibleLabCapacity && (c.lab_hours > 0);
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
                lec_hours: effectiveLecHours,
                lab_hours: effectiveLabHours,
                lecRemaining: Math.max(0, effectiveLecHours - lecAllotted),
                isSplitLab,
                labRemaining: isSplitLab ? 0 : Math.max(0, effectiveLabHours - labAllotted),
                labG1Remaining: isSplitLab ? Math.max(0, effectiveLabHours - labG1Allotted) : 0,
                labG2Remaining: isSplitLab ? Math.max(0, effectiveLabHours - labG2Allotted) : 0,
                totalHours: effectiveLecHours + effectiveLabHours
            }
        })
    }, [classes, allocations, timeSlots, rooms, splitLabClasses, collegeRoomMatchingEnabled, getCollegeKeys, getEffectiveCollege, extractCollegeKey, baselineRequiredHoursByClass])

    const getAllowedHoursForClassComponent = useCallback((
        classId: number,
        componentType: 'LEC' | 'LAB'
    ): number => {
        const classFromStats = classesWithStats.find(c => c.id === classId)
        if (classFromStats) {
            return componentType === 'LAB'
                ? Number(classFromStats.lab_hours || 0)
                : Number(classFromStats.lec_hours || 0)
        }

        const baseline = baselineRequiredHoursByClass.get(classId)
        return componentType === 'LAB'
            ? Number(baseline?.lab || 0)
            : Number(baseline?.lec || 0)
    }, [classesWithStats, baselineRequiredHoursByClass])

    const faculties = useMemo(() => {
        const isMeaningfulTeacher = (value?: string) => {
            const normalized = String(value || '').trim().toUpperCase()
            if (!normalized) return false
            return !new Set(['TBD', 'TBA', 'N/A', 'NA', 'NONE', 'NULL', 'UNASSIGNED', 'UNKNOWN']).has(normalized)
        }

        const all = new Set<string>()
        classes.forEach((c: any) => {
            const assigned = String(c.teacher_name || '').trim()
            if (isMeaningfulTeacher(assigned)) all.add(assigned)

            const options = Array.isArray(c.teacher_options) ? c.teacher_options : []
            options.forEach((opt: any) => {
                const teacherName = String(opt || '').trim()
                if (isMeaningfulTeacher(teacherName)) all.add(teacherName)
            })
        })

        if (all.size === 0) return ['TBD']
        return Array.from(all).sort((a, b) => a.localeCompare(b))
    }, [classes])

    const splitGroupsBySectionBase = useMemo(() => {
        const map = new Map<string, Set<'G1' | 'G2'>>()

        allocations.forEach(a => {
            if (getAllocationComponent(a) !== 'LAB') return

            const group = getSectionGroup(String(a.section || ''))
            if (!group) return

            const base = makeSectionOptionValue(String(a.section || ''))
            if (!base) return

            if (!map.has(base)) map.set(base, new Set<'G1' | 'G2'>())
            map.get(base)?.add(group)
        })

        return map
    }, [allocations])

    const sections = useMemo(() => {
        const unique = new Set<string>()
        classesWithStats.forEach(c => {
            const base = makeSectionOptionValue(String(c.section || ''))
            if (!base) return

            unique.add(base)
            const allocGroups = splitGroupsBySectionBase.get(base)
            const hasG1FromAlloc = !!allocGroups?.has('G1')
            const hasG2FromAlloc = !!allocGroups?.has('G2')

            if (c.isSplitLab || hasG1FromAlloc) {
                unique.add(makeSectionOptionValue(base, 'G1'))
            }
            if (c.isSplitLab || hasG2FromAlloc) {
                unique.add(makeSectionOptionValue(base, 'G2'))
            }
        })
        return Array.from(unique).sort((a, b) => a.localeCompare(b))
    }, [classesWithStats, splitGroupsBySectionBase])

    const facultyCollegeMap = useMemo(() => {
        const map = new Map<string, Set<string>>()
        classes.forEach((c: any) => {
            const colleges = parseCollegeLabels(getEffectiveCollege(c))

            const candidateNames = new Set<string>()
            const assigned = String(c.teacher_name || '').trim()
            if (assigned) candidateNames.add(assigned)
            if (Array.isArray(c.teacher_options)) {
                c.teacher_options.forEach((name: any) => {
                    const normalized = String(name || '').trim()
                    if (normalized) candidateNames.add(normalized)
                })
            }

            if (candidateNames.size === 0) candidateNames.add('TBD')
            candidateNames.forEach((facultyName) => {
                if (!map.has(facultyName)) map.set(facultyName, new Set<string>())
                colleges.forEach(college => map.get(facultyName)?.add(college))
            })
        })
        map.forEach(colleges => removeUnknownCollegeWhenKnownExists(colleges))
        return map
    }, [classes, getEffectiveCollege])

    const sectionCollegeMap = useMemo(() => {
        const map = new Map<string, Set<string>>()
        const addSectionCollege = (section: string, college: string) => {
            if (!map.has(section)) map.set(section, new Set<string>())
            map.get(section)?.add(college)
        }

        classesWithStats.forEach(c => {
            const colleges = parseCollegeLabels(getEffectiveCollege(c))
            const base = makeSectionOptionValue(String(c.section || ''))
            if (!base) return

            colleges.forEach(college => addSectionCollege(base, college))
            const allocGroups = splitGroupsBySectionBase.get(base)
            const hasG1FromAlloc = !!allocGroups?.has('G1')
            const hasG2FromAlloc = !!allocGroups?.has('G2')

            if (c.isSplitLab || hasG1FromAlloc) {
                colleges.forEach(college => {
                    addSectionCollege(makeSectionOptionValue(base, 'G1'), college)
                })
            }
            if (c.isSplitLab || hasG2FromAlloc) {
                colleges.forEach(college => {
                    addSectionCollege(makeSectionOptionValue(base, 'G2'), college)
                })
            }
        })
        map.forEach(colleges => removeUnknownCollegeWhenKnownExists(colleges))
        return map
    }, [classesWithStats, getEffectiveCollege, splitGroupsBySectionBase])

    const groupedSectionFilterOptions = useMemo(() => {
        const grouped = new Map<string, string[]>()

        sections.forEach(section => {
            const colleges = Array.from(sectionCollegeMap.get(section) || [])
            const targetColleges = colleges.length > 0 ? colleges : [UNKNOWN_COLLEGE]
            targetColleges.forEach(college => {
                if (!grouped.has(college)) grouped.set(college, [])
                grouped.get(college)?.push(section)
            })
        })

        const sortCollege = (a: string, b: string) => {
            if (a === UNKNOWN_COLLEGE && b !== UNKNOWN_COLLEGE) return 1
            if (b === UNKNOWN_COLLEGE && a !== UNKNOWN_COLLEGE) return -1
            return a.localeCompare(b)
        }

        return Array.from(grouped.entries())
            .sort(([a], [b]) => sortCollege(a, b))
            .map(([college, items]) => ({
                college,
                options: Array.from(new Set(items)).sort((a, b) => a.localeCompare(b))
            }))
    }, [sections, sectionCollegeMap])

    const navigationItems = useMemo(() => {
        if (viewMode === 'room') return rooms
        if (viewMode === 'faculty') return faculties
        if (viewMode === 'section') return sections
        return []
    }, [viewMode, rooms, faculties, sections])

    const activeItem = navigationItems[activeItemIndex]

    const groupedNavigationOptions = useMemo(() => {
        type GroupedOption = { index: number, label: string }
        const grouped = new Map<string, GroupedOption[]>()

        const addToGroup = (college: string, option: GroupedOption) => {
            if (!grouped.has(college)) grouped.set(college, [])
            grouped.get(college)?.push(option)
        }

        if (viewMode === 'room') {
            navigationItems.forEach((item: any, idx: number) => {
                const colleges = parseCollegeLabels(item.college)
                colleges.forEach(college => {
                    addToGroup(college, { index: idx, label: `${item.building} - ${item.room}` })
                })
            })
        } else if (viewMode === 'faculty') {
            navigationItems.forEach((item: any, idx: number) => {
                const colleges = Array.from(facultyCollegeMap.get(item as string) || [])
                const targetColleges = colleges.length > 0 ? colleges : [UNKNOWN_COLLEGE]
                targetColleges.forEach(college => {
                    addToGroup(college, { index: idx, label: item as string })
                })
            })
        } else if (viewMode === 'section') {
            navigationItems.forEach((item: any, idx: number) => {
                const colleges = Array.from(sectionCollegeMap.get(item as string) || [])
                const targetColleges = colleges.length > 0 ? colleges : [UNKNOWN_COLLEGE]
                targetColleges.forEach(college => {
                    addToGroup(college, { index: idx, label: item as string })
                })
            })
        }

        const sortCollege = (a: string, b: string) => {
            const rank = (name: string) => {
                if (name === UNKNOWN_COLLEGE) return 1
                return 0
            }
            const rankDiff = rank(a) - rank(b)
            if (rankDiff !== 0) return rankDiff
            return a.localeCompare(b)
        }

        return Array.from(grouped.entries())
            .sort(([a], [b]) => sortCollege(a, b))
            .map(([college, options]) => ({
                college,
                options: options.sort((a, b) => a.label.localeCompare(b.label))
            }))
    }, [viewMode, navigationItems, facultyCollegeMap, sectionCollegeMap])

    // 5. Equipment Filter Logic
    const filteredClasses = useMemo(() => {
        return classesWithStats.filter(c => {
            const matchesSearch = c.course_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.course_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.section.toLowerCase().includes(searchQuery.toLowerCase())

            const classBaseSection = makeSectionOptionValue(String(c.section || ''))
            const filterBaseSection = makeSectionOptionValue(filterSection)
            const filterGroup = getSectionGroup(filterSection)

            const allocGroups = splitGroupsBySectionBase.get(classBaseSection)
            const hasGroupFromAlloc = !!(filterGroup && allocGroups?.has(filterGroup))
            const matchesSection = filterSection === 'all'
                ? true
                : classBaseSection === filterBaseSection && (!filterGroup || c.lecRemaining > 0 || hasGroupFromAlloc || (c.isSplitLab && (filterGroup === 'G1' ? c.labG1Remaining > 0 : c.labG2Remaining > 0)))

            const hasRemaining = c.lecRemaining > 0 || c.labRemaining > 0 || c.labG1Remaining > 0 || c.labG2Remaining > 0
            if (!(matchesSearch && matchesSection && hasRemaining)) return false

            if (viewMode === 'faculty') {
                return getEffectiveTeacherName(c) === (activeItem as string)
            }

            if (viewMode === 'section') {
                const activeSec = String(activeItem || '')
                const activeBase = getSectionBase(activeSec)
                const activeGroup = getSectionGroup(activeSec)
                const classBase = getSectionBase(String(c.section || ''))

                if (classBase !== activeBase) return false

                if (activeGroup) {
                    const hasRelevantLab = c.isSplitLab
                        ? (activeGroup === 'G1' ? c.labG1Remaining > 0 : c.labG2Remaining > 0)
                        : false
                    return c.lecRemaining > 0 || hasRelevantLab
                }

                return true
            }

            if (viewMode === 'room') {
                const room = activeItem as any
                if (!room) return false

                const canLEC = c.lecRemaining > 0 && canAssignComponentToRoom(c, room, 'LEC', c.student_count || 0)
                const canLAB = (!c.isSplitLab)
                    ? (c.labRemaining > 0 && canAssignComponentToRoom(c, room, 'LAB', c.student_count || 0))
                    : (
                        (c.labG1Remaining > 0 && canAssignComponentToRoom(c, room, 'LAB', Math.ceil((c.student_count || 0) / 2))) ||
                        (c.labG2Remaining > 0 && canAssignComponentToRoom(c, room, 'LAB', Math.floor((c.student_count || 0) / 2)))
                    )

                return canLEC || canLAB
            }

            return true
        })
    }, [classesWithStats, searchQuery, filterSection, viewMode, activeItem, canAssignComponentToRoom, getEffectiveTeacherName, splitGroupsBySectionBase])

    const unscheduledFallbackClasses = useMemo(() => {
        return classesWithStats.filter(c => {
            const matchesSearch = c.course_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.course_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.section.toLowerCase().includes(searchQuery.toLowerCase())

            const classBaseSection = makeSectionOptionValue(String(c.section || ''))
            const filterBaseSection = makeSectionOptionValue(filterSection)
            const filterGroup = getSectionGroup(filterSection)

            const allocGroups = splitGroupsBySectionBase.get(classBaseSection)
            const hasGroupFromAlloc = !!(filterGroup && allocGroups?.has(filterGroup))
            const matchesSection = filterSection === 'all'
                ? true
                : classBaseSection === filterBaseSection && (!filterGroup || c.lecRemaining > 0 || hasGroupFromAlloc || (c.isSplitLab && (filterGroup === 'G1' ? c.labG1Remaining > 0 : c.labG2Remaining > 0)))

            const hasRemaining = c.lecRemaining > 0 || c.labRemaining > 0 || c.labG1Remaining > 0 || c.labG2Remaining > 0
            return matchesSearch && matchesSection && hasRemaining
        })
    }, [classesWithStats, searchQuery, filterSection, splitGroupsBySectionBase])

    const sourceUnscheduledFilteredClasses = useMemo(() => {
        return (unscheduledSourceClasses || []).filter((c: any) => {
            const code = String(c.course_code || '')
            const name = String(c.course_name || '')
            const section = String(c.section || '')

            const matchesSearch =
                code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                section.toLowerCase().includes(searchQuery.toLowerCase())

            if (!matchesSearch) return false
            if (filterSection === 'all') return true

            const classBaseSection = makeSectionOptionValue(section)
            const filterBaseSection = makeSectionOptionValue(filterSection)
            return classBaseSection === filterBaseSection
        })
    }, [unscheduledSourceClasses, searchQuery, filterSection])

    const remainingClassCount = useMemo(() => {
        return classesWithStats.filter(c =>
            c.lecRemaining > 0 || c.labRemaining > 0 || c.labG1Remaining > 0 || c.labG2Remaining > 0
        ).length
    }, [classesWithStats])

    const summaryTotals = useMemo(() => {
        const total = Math.max(0, classesWithStats.length)
        const unscheduled = Math.max(0, remainingClassCount)
        const scheduled = Math.max(0, total - unscheduled)

        return {
            total,
            scheduled,
            unscheduled,
            canShow: total > 0 || unscheduled > 0,
        }
    }, [classesWithStats.length, remainingClassCount])

    // 6. Conflict Detection
    const checkConflicts = useCallback((newAlloc: any, ignoreSelfId?: any) => {
        const conflicts: string[] = []
        const { class_id, room_id } = newAlloc

        // Handle both property names for robustness
        const schedule_day = newAlloc.schedule_day || newAlloc.day;
        const schedule_time = newAlloc.schedule_time;

        const classInfo = classes.find(c => c.id === class_id)
        if (!classInfo) return []
        const effectiveTeacherName = String(newAlloc.teacher_name || classInfo.teacher_name || '').trim()
        const effectiveClassCollege = normalizeCollegeLabel(newAlloc.college || getEffectiveCollege(classInfo))

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
                const s_col = effectiveClassCollege?.trim().toUpperCase();
                const r_col = room.college?.trim().toUpperCase();
                if (s_col && r_col && r_col !== 'SHARED') {
                    // Extract abbreviation from parentheses, e.g. "COLLEGE OF SCIENCE (CS)" → "CS"
                    const extractAbbr = (col: string) => {
                        const match = col.match(/\(([^)]+)\)\s*$/);
                        return match ? match[1].trim() : col;
                    };
                    const s_abbr = extractAbbr(s_col);
                    const r_abbr = extractAbbr(r_col);
                    // Match if either the full strings match OR their abbreviations match
                    const isMatch = r_col === s_col || r_abbr === s_abbr || r_col === s_abbr || r_abbr === s_col;
                    const isUnassignedClassCollege = s_col === UNKNOWN_COLLEGE.toUpperCase();
                    if (!isMatch && !isUnassignedClassCollege) {
                        conflicts.push(`College conflict: Room is ${r_col}, Class is ${s_col}`);
                    }
                }
            }
        }

        if (!schedule_day || !schedule_time) return conflicts;

        const targetRange = parseScheduleTime(schedule_time)
        if (!targetRange) return conflicts

        const normalizeId = (value: any): number | undefined => {
            const num = Number(value)
            return Number.isFinite(num) ? num : undefined
        }

        // Filter self by raw identifier first so string/UUID ids never self-conflict.
        const ignoreIdRaw = ignoreSelfId === undefined || ignoreSelfId === null
            ? null
            : String(ignoreSelfId)

        const allocationSlots: AllocationSlot[] = allocations
            .filter(existing => {
                if (ignoreIdRaw === null) return true
                const existingRaw = existing.id ?? existing.class_id
                return String(existingRaw) !== ignoreIdRaw
            })
            .map(existing => ({
                id: normalizeId(existing.id ?? existing.class_id) || 0,
                schedule_id: Number(existing.schedule_id || 0),
                room: String(existing.room || ''),
                building: String(existing.building || ''),
                section: String(existing.section || ''),
                teacher_name: String(existing.teacher_name || ''),
                schedule_day: String(existing.schedule_day || existing.day || ''),
                schedule_time: String(existing.schedule_time || ''),
                course_code: String(existing.course_code || ''),
                capacity: Number(existing.capacity || 0),
                student_count: Number(existing.student_count || 0),
                college: String(existing.college || ''),
                room_college: String(existing.room_college || ''),
                is_online: Boolean(existing.is_online || false), // Include online flag for conflict checking
            }))

        const targetRoomName = String(room?.room || newAlloc.room || '')
        const conflictBuckets = checkAllConflicts(
            allocationSlots,
            targetRoomName,
            String(schedule_day),
            targetRange,
            effectiveTeacherName,
            String(newAlloc.section || ''),
            effectiveClassCollege,
            normalizeId(ignoreSelfId)
        )

        const timeReasons = buildConflictReasonMessages(conflictBuckets, {
            section: String(newAlloc.section || ''),
        })

        conflicts.push(...timeReasons)
        return Array.from(new Set(conflicts))
    }, [classes, allocations, timeSlots, rooms, collegeRoomMatchingEnabled, getEffectiveCollege])

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
            const roomIsLab = rType.includes('lab') || rType.includes('computer');

            // --- HARD CONSTRAINTS ---
            // a) Room Type Compatibility
            if (isLab && !roomIsLab) return { room, score: -1000 };

            // b) Capacity Fit
            if (room.capacity < students) return { room, score: -1000 };

            // c) Availability Check
            const isBusy = allocations.some(a => {
                if (ignoreAllocId && (a.id || a.class_id) === ignoreAllocId) return false;
                if (a.room_id !== room.id || normalizeDayLabel(a.schedule_day) !== normalizeDayLabel(day)) return false;

                const existingRange = getRangeMinutes(a.schedule_time);
                if (!existingRange) return false;
                const aStartMins = existingRange.start;
                const aEndMins = existingRange.end;

                return (startMins < aEndMins && endMins > aStartMins);
            });
            if (isBusy) return { room, score: -1000 };

            // d) Feature Requirements
            const roomFeats = new Set(room.feature_tags || []);
            if (reqFeatures.some(f => !roomFeats.has(f))) return { room, score: -1000 };

            // e) College Matching
            if (collegeRoomMatchingEnabled) {
                const classCollegeKeys = getCollegeKeys(getEffectiveCollege(classInfo));
                const roomCollegeRaw = (room.college || '').trim();
                const roomCollegeKey = extractCollegeKey(roomCollegeRaw);

                if (classCollegeKeys.length > 0 && roomCollegeKey && roomCollegeKey !== 'SHARED') {
                    const isCollegeMatch = classCollegeKeys.includes(roomCollegeKey);
                    if (!isCollegeMatch) {
                        return { room, score: -1000 };
                    }
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
    }, [rooms, allocations, timeSlots, collegeRoomMatchingEnabled, getCollegeKeys, extractCollegeKey, getEffectiveCollege])

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

            const existingRange = getAllocationRange(existingAlloc)
            if (!existingRange) {
                setDraggedAllocId(null)
                return
            }
            const oldStart = existingRange.start
            const oldEnd = existingRange.end
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

            const moveComponent: 'LEC' | 'LAB' = getAllocationComponent(existingAlloc)
            const sourceStudents = Number(classInfo.student_count || existingAlloc.student_count || 0)
            const moveGroup = getSectionGroup(String(existingAlloc.section || ''))
            const moveStudents = moveComponent === 'LAB' && moveGroup
                ? (moveGroup === 'G1' ? Math.ceil(sourceStudents / 2) : Math.floor(sourceStudents / 2))
                : sourceStudents

            if (!canAssignComponentToRoom(classInfo, roomInfo, moveComponent, moveStudents)) {
                toast.error(`Room ${roomInfo.room} is not compatible with ${existingAlloc.course_code} requirements.`)
                setDraggedAllocId(null)
                return
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
        const selectedTeacherName = getEffectiveTeacherName(classInfo)

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
            teacher_name: selectedTeacherName || 'TBD',
            college: getEffectiveCollege(classInfo),
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

        const componentType: 'LEC' | 'LAB' = saveComponent.includes('LAB') ? 'LAB' : 'LEC'
        const targetGroup = componentType === 'LAB' ? getSectionGroup(targetSection) : null
        const allowedHours = componentType === 'LAB'
            ? (classInfo.lab_hours || 0)
            : (classInfo.lec_hours || 0)
        const projectedHours = getAllocatedHoursForComponent(allocations, classInfo.id, componentType, targetGroup) + getAllocationHours(newAlloc)

        if (allowedHours > 0 && projectedHours > allowedHours + 1e-6) {
            toast.error(`Weekly ${componentType} hours exceeded: ${projectedHours.toFixed(1)}h/${allowedHours}h`)
            setDraggedClassId(null)
            setDraggingComponent(null)
            return
        }

        setAllocations(prev => [...prev, newAlloc])
        setDraggedClassId(null)
        setDraggingComponent(null)
        toast.success(`Allocated ${classInfo.course_code} ${targetComponent} in Room ${roomInfo.room}`)
    }

    const handleResize = (allocId: any, day: string, newEndSlot: any) => {
        setAllocations(prev => prev.map(a => {
            if ((a.id || a.class_id) !== allocId || normalizeDayLabel(a.schedule_day) !== normalizeDayLabel(day)) return a

            const allocRange = getAllocationRange(a)
            if (!allocRange) return a
            const startSlot = findSlotByStartMinutes(allocRange.start)
            if (!startSlot) return a

            if (newEndSlot.endMinutes <= startSlot.startMinutes) return a

            if (a.class_id) {
                const componentType = getAllocationComponent(a)
                const group = componentType === 'LAB' ? getSectionGroup(String(a.section || '')) : null
                const allowedHours = getAllowedHoursForClassComponent(Number(a.class_id), componentType)
                const resizedHours = (newEndSlot.endMinutes - startSlot.startMinutes) / 60
                const usedOtherHours = getAllocatedHoursForComponent(prev, a.class_id, componentType, group, allocId)

                if (allowedHours > 0 && usedOtherHours + resizedHours > allowedHours + 1e-6) {
                    toast.warning(`Weekly ${componentType} limit reached (${allowedHours}h).`)
                    return a
                }
            }

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

            const allocRange = getAllocationRange(a)
            if (!allocRange) return a
            const startSlot = findSlotByStartMinutes(allocRange.start)
            const endSlot = findSlotByEndMinutes(allocRange.end)

            if (!startSlot || !endSlot) return a

            let newEndMins = endSlot.endMinutes + amountMins
            if (newEndMins <= startSlot.startMinutes) return a

            const lastSlot = timeSlots[timeSlots.length - 1]
            if (newEndMins > lastSlot.endMinutes) return a

            // Apply size checking
            if (amountMins > 0) {
                if (a.class_id) {
                    const componentType = getAllocationComponent(a)
                    const group = componentType === 'LAB' ? getSectionGroup(String(a.section || '')) : null
                    const allowedHours = getAllowedHoursForClassComponent(Number(a.class_id), componentType)
                    const newDurationHours = (newEndMins - startSlot.startMinutes) / 60
                    const usedOtherHours = getAllocatedHoursForComponent(prev, a.class_id, componentType, group, allocId)

                    if (allowedHours > 0 && usedOtherHours + newDurationHours > allowedHours + 1e-6) {
                        toast.warning(`Weekly ${componentType} limit reached (${allowedHours}h).`)
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
                const range = getAllocationRange(a)
                if (range) durationMins = range.end - range.start
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

        const selectedTeacher = viewMode === 'faculty'
            ? String(activeItem || '').trim()
            : String(newAlloc.teacher_name || baseClass.teacher_name || '').trim()

        let previewRoom: any = null
        if (viewMode === 'room') {
            previewRoom = activeItem as any
        } else {
            previewRoom = findOptimalRoom(baseClass, component, day, slot, durationMins, draggedAllocId)
        }

        if (!previewRoom) return null

        newAlloc.room_id = previewRoom.id
        newAlloc.room = previewRoom.room
        newAlloc.campus = previewRoom.campus
        newAlloc.building = previewRoom.building
        newAlloc.teacher_name = selectedTeacher

        if (viewMode === 'room') {
            // Keep section/faculty from dragged class/allocation context in room view.
        } else if (viewMode === 'faculty') {
            newAlloc.teacher_name = activeItem as string;
        } else if (viewMode === 'section') {
            newAlloc.section = activeItem as string;
        }

        return newAlloc;
    }, [draggedClassId, draggedAllocId, draggingComponent, allocations, classes, timeSlots, viewMode, activeItem, findOptimalRoom]);

    const getDraggedDuration = useCallback(() => {
        if (!draggedClassId && !draggedAllocId) return 0;
        let baseClass: any;
        let component = draggingComponent || 'LEC';

        if (draggedAllocId) {
            const existing = allocations.find(a => (a.id || a.class_id) === draggedAllocId);
            if (!existing) return 60;
            const range = getAllocationRange(existing)
            if (!range) return 60
            return range.end - range.start;
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
            <div id="view-manual-edit-modal" className={styles.manualEditModal} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader} id="view-manual-edit-header">
                    <div className={styles.headerLeft}>
                        <h2>
                            <MdTableChart />
                            <span className={styles.titleText}>Manual Schedule Editor</span>
                        </h2>
                        <div className={styles.viewSelector} id="view-manual-edit-view-modes">
                            <button
                                className={viewMode === 'room' ? styles.active : ''}
                                onClick={() => { setViewMode('room'); setActiveItemIndex(0); }}
                                title="Rooms"
                            >
                                <MdMeetingRoom />
                                <span className={styles.tabLabel}>Rooms</span>
                            </button>
                            <button
                                className={viewMode === 'faculty' ? styles.active : ''}
                                onClick={() => { setViewMode('faculty'); setActiveItemIndex(0); }}
                                title="Faculty"
                            >
                                <FaChalkboardTeacher />
                                <span className={styles.tabLabel}>Faculty</span>
                            </button>
                            <button
                                className={viewMode === 'section' ? styles.active : ''}
                                onClick={() => { setViewMode('section'); setActiveItemIndex(0); }}
                                title="Section"
                            >
                                <FaUsers />
                                <span className={styles.tabLabel}>Section</span>
                            </button>
                            <div className={styles.vDivider} />
                            <button
                                className={styles.resetBtn}
                                title="Clear all allocations"
                                onClick={() => {
                                    if (confirm('Are you sure you want to clear the entire current manual schedule? This will remove all placed classes from the editor.')) {
                                        setAllocations([]);
                                        toast.info('Timetable cleared');
                                    }
                                }}
                            >
                                <MdDelete />
                                <span className={styles.tabLabel}>Clear All</span>
                            </button>
                        </div>
                    </div>
                    <button id="view-manual-edit-close-btn" className={styles.modalCloseBtn} onClick={onClose} aria-label="Close">
                        <MdClose size={24} />
                    </button>
                </div>

                <div className={styles.manualEditBody} id="view-manual-edit-body">
                    <div className={styles.coursesPanel}>
                        <div className={styles.panelHeader}>
                            <h3>Available Courses</h3>
                            {summaryTotals.canShow && (
                                <p style={{ margin: '2px 0 10px', fontSize: '12px', opacity: 0.9 }}>
                                    Total: <strong>{summaryTotals.total}</strong> | Scheduled: <strong>{summaryTotals.scheduled}</strong> | Unscheduled: <strong>{summaryTotals.unscheduled}</strong>
                                </p>
                            )}
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
                                        <option value="all">All Sections ({sections.length})</option>
                                        {groupedSectionFilterOptions.map(group => (
                                            <optgroup key={group.college} label={group.college}>
                                                {group.options.map(section => (
                                                    <option key={`${group.college}-${section}`} value={section}>{section}</option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className={styles.classList}>
                            {filteredClasses.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                                    <MdSearch size={48} style={{ opacity: 0.2, marginBottom: '12px' }} />
                                    <p style={{ fontSize: '14px', fontWeight: 500 }}>No courses found</p>
                                    {viewMode === 'room' && remainingClassCount > 0 && (
                                        <>
                                            <p style={{ marginTop: '8px', fontSize: '12px' }}>
                                                {remainingClassCount} class(es) still have remaining hours, but none match this room.
                                            </p>
                                            <button
                                                type="button"
                                                style={{
                                                    marginTop: '10px',
                                                    border: '1px solid #bae6fd',
                                                    background: '#f0f9ff',
                                                    color: '#0369a1',
                                                    borderRadius: '8px',
                                                    padding: '6px 10px',
                                                    fontSize: '12px',
                                                    cursor: 'pointer',
                                                    fontWeight: 600,
                                                }}
                                                onClick={() => {
                                                    setViewMode('section')
                                                    setActiveItemIndex(0)
                                                }}
                                            >
                                                Switch to Section View
                                            </button>
                                        </>
                                    )}

                                    {sourceUnscheduledFilteredClasses.length > 0 && (
                                        <div style={{ marginTop: '20px', textAlign: 'left' }}>
                                            <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>
                                                Unscheduled classes from source ({sourceUnscheduledFilteredClasses.length}):
                                            </p>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {sourceUnscheduledFilteredClasses.slice(0, 50).map((c: any) => (
                                                    <div
                                                        key={`source-unscheduled-${c.id ?? `${c.course_code}-${c.section}`}`}
                                                        style={{
                                                            border: '1px solid rgba(148, 163, 184, 0.25)',
                                                            borderRadius: '8px',
                                                            padding: '8px 10px',
                                                            background: 'rgba(15, 23, 42, 0.35)',
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                                                            <strong style={{ fontSize: '12px' }}>{String(c.course_code || '')} - {makeSectionOptionValue(String(c.section || ''))}</strong>
                                                        </div>
                                                        <p style={{ margin: '4px 0 0', fontSize: '11px', opacity: 0.85 }}>{String(c.course_name || '')}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {sourceUnscheduledFilteredClasses.length === 0 && unscheduledFallbackClasses.length > 0 && (
                                        <div style={{ marginTop: '20px', textAlign: 'left' }}>
                                            <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>
                                                Unscheduled classes found ({unscheduledFallbackClasses.length}):
                                            </p>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {unscheduledFallbackClasses.slice(0, 50).map(c => (
                                                    <div
                                                        key={`fallback-${c.id}`}
                                                        style={{
                                                            border: '1px solid rgba(148, 163, 184, 0.25)',
                                                            borderRadius: '8px',
                                                            padding: '8px 10px',
                                                            background: 'rgba(15, 23, 42, 0.35)',
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                                                            <strong style={{ fontSize: '12px' }}>{c.course_code} - {makeSectionOptionValue(String(c.section || ''))}</strong>
                                                            <span style={{ fontSize: '11px', opacity: 0.9 }}>
                                                                {(c.lecRemaining || 0) + (c.labRemaining || 0) + (c.labG1Remaining || 0) + (c.labG2Remaining || 0)}h left
                                                            </span>
                                                        </div>
                                                        <p style={{ margin: '4px 0 0', fontSize: '11px', opacity: 0.85 }}>{c.course_name}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                filteredClasses.map(c => {
                                    const activeSec = viewMode === 'section' ? String(activeItem || '') : ''
                                    const activeGroup = viewMode === 'section' ? getSectionGroup(activeSec) : null
                                    const selectedTeacherName = getEffectiveTeacherName(c)
                                    const selectedCollegeName = getEffectiveCollege(c)
                                    const classRemainingPotentialHours =
                                        (c.lecRemaining || 0) +
                                        (c.labRemaining || 0) +
                                        (c.labG1Remaining || 0) +
                                        (c.labG2Remaining || 0)
                                    const currentClassAllocatedHours = classAllocatedHoursById.get(c.id) || 0
                                    const teacherOptions = teacherOptionsByClassId.get(c.id) || [selectedTeacherName]

                                    const showLecButton = c.lecRemaining > 0
                                    const showLabButton = (!c.isSplitLab) && c.labRemaining > 0 && !activeGroup
                                    const showLabG1Button = c.isSplitLab && c.labG1Remaining > 0 && (!activeGroup || activeGroup === 'G1')
                                    const showLabG2Button = c.isSplitLab && c.labG2Remaining > 0 && (!activeGroup || activeGroup === 'G2')

                                    return (
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
                                            <span>
                                                <MdPerson />
                                                <select
                                                    className={styles.teacherInlineSelect}
                                                    value={selectedTeacherName}
                                                    onChange={(e) => {
                                                        const nextTeacher = e.target.value
                                                        const maxLimit = teacherWeeklyLimitByName.get(nextTeacher)
                                                        const projectedLoad = teacherAllocatedHoursExcludingClass(nextTeacher, c.id) + currentClassAllocatedHours + classRemainingPotentialHours
                                                        if (maxLimit && projectedLoad > maxLimit + 1e-6) {
                                                            toast.error(`Teacher load exceeded: ${nextTeacher} (${projectedLoad.toFixed(1)}h/${maxLimit}h)`) 
                                                            return
                                                        }
                                                        handleTeacherSelection(c.id, nextTeacher)
                                                    }}
                                                    title="Select faculty for this subject"
                                                >
                                                    {teacherOptions.map((teacher) => {
                                                        const maxLimit = teacherWeeklyLimitByName.get(teacher)
                                                        const projectedLoad = teacherAllocatedHoursExcludingClass(teacher, c.id) + currentClassAllocatedHours + classRemainingPotentialHours
                                                        const isOver = !!maxLimit && projectedLoad > maxLimit + 1e-6
                                                        const label = maxLimit
                                                            ? `${teacher} (${projectedLoad.toFixed(1)}h/${maxLimit}h)`
                                                            : `${teacher} (${projectedLoad.toFixed(1)}h)`
                                                        return (
                                                            <option key={teacher} value={teacher} disabled={isOver}>
                                                                {label}
                                                            </option>
                                                        )
                                                    })}
                                                </select>
                                            </span>
                                            <span>
                                                <MdSchool />
                                                <select
                                                    className={styles.teacherInlineSelect}
                                                    value={selectedCollegeName}
                                                    onChange={(e) => handleCollegeSelection(c.id, e.target.value)}
                                                    title="Select college for this class"
                                                >
                                                    {availableCollegeOptions.map((collegeOption) => (
                                                        <option key={collegeOption} value={collegeOption}>
                                                            {collegeOption}
                                                        </option>
                                                    ))}
                                                </select>
                                            </span>
                                            <span><MdGroups /> {c.section}</span>
                                        </div>

                                        <div className={styles.componentButtons}>
                                            {showLecButton && (
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
                                            {showLabButton && (
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
                                            {showLabG1Button && (
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
                                            {showLabG2Button && (
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
                                            {(c.lab_hours > 0) && viewMode !== 'section' && (
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
                                    )
                                })
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
                                                    className={styles.navigatorSelect}
                                                    value={activeItemIndex}
                                                    onChange={(e) => setActiveItemIndex(Number(e.target.value))}
                                                    style={{ appearance: 'none', border: 'none', background: 'transparent', outline: 'none', cursor: 'pointer', textAlign: 'center', fontSize: '1rem', fontWeight: 600, color: 'inherit' }}
                                                >
                                                    {groupedNavigationOptions.map(group => (
                                                        <optgroup key={group.college} label={group.college}>
                                                            {group.options.map(option => (
                                                                <option key={`${group.college}-${option.index}`} value={option.index}>{option.label}</option>
                                                            ))}
                                                        </optgroup>
                                                    ))}
                                                </select>
                                                <small className={styles.currentMeta} style={{ marginLeft: '10px', opacity: 0.6, fontSize: '0.6em', background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '4px' }}>
                                                    {(activeItem as any)?.capacity} seats
                                                </small>
                                                {(activeItem as any)?.floor_level && (
                                                    <small className={styles.currentMeta} style={{ marginLeft: '6px', opacity: 0.6, fontSize: '0.6em', background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '4px' }}>
                                                        Floor {(activeItem as any)?.floor_level}
                                                    </small>
                                                )}
                                                {(activeItem as any)?.college && (
                                                    <small className={styles.currentMeta} style={{ marginLeft: '6px', opacity: 0.9, fontSize: '0.6em', background: '#e0e7ff', color: '#4f46e5', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                                                        {(activeItem as any)?.college}
                                                    </small>
                                                )}
                                                {(activeItem as any)?.feature_tags?.length > 0 && (
                                                    <small className={styles.currentMeta} style={{ marginLeft: '6px', opacity: 0.9, fontSize: '0.6em', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
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
                                                className={styles.navigatorSelect}
                                                value={activeItemIndex}
                                                onChange={(e) => setActiveItemIndex(Number(e.target.value))}
                                                style={{ appearance: 'none', border: 'none', background: 'transparent', outline: 'none', cursor: 'pointer', textAlign: 'center', fontSize: '1rem', fontWeight: 600, color: 'inherit' }}
                                            >
                                                {groupedNavigationOptions.map(group => (
                                                    <optgroup key={group.college} label={group.college}>
                                                        {group.options.map(option => (
                                                            <option key={`${group.college}-${option.index}`} value={option.index}>{option.label}</option>
                                                        ))}
                                                    </optgroup>
                                                ))}
                                            </select>
                                        </>
                                    )}
                                    {viewMode === 'section' && (
                                        <>
                                            <FaUsers />
                                            <select
                                                className={styles.navigatorSelect}
                                                value={activeItemIndex}
                                                onChange={(e) => setActiveItemIndex(Number(e.target.value))}
                                                style={{ appearance: 'none', border: 'none', background: 'transparent', outline: 'none', cursor: 'pointer', textAlign: 'center', fontSize: '1rem', fontWeight: 600, color: 'inherit' }}
                                            >
                                                {groupedNavigationOptions.map(group => (
                                                    <optgroup key={group.college} label={group.college}>
                                                        {group.options.map(option => (
                                                            <option key={`${group.college}-${option.index}`} value={option.index}>{option.label}</option>
                                                        ))}
                                                    </optgroup>
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
                                                    const matchesDay = normalizeDayLabel(a.schedule_day) === normalizeDayLabel(day)
                                                    if (!matchesDay) return false

                                                    const range = getAllocationRange(a)
                                                    if (!range) return false
                                                    const slotInRange = slot.startMinutes >= range.start && slot.startMinutes < range.end

                                                    if (viewMode === 'room') return a.room_id === (activeItem as any)?.id && slotInRange
                                                    if (viewMode === 'faculty') return a.teacher_name === (activeItem as string) && slotInRange
                                                    if (viewMode === 'section') {
                                                        const activeSec = String(activeItem || '')
                                                        const activeBase = getSectionBase(activeSec)
                                                        const activeGroup = getSectionGroup(activeSec)
                                                        const allocBase = getSectionBase(String(a.section || ''))
                                                        const allocGroup = getSectionGroup(String(a.section || ''))

                                                        if (allocBase !== activeBase) return false

                                                        // In G1/G2 view, show only that subgroup plus shared/base lectures.
                                                        if (activeGroup) {
                                                            const isSharedLecture = getAllocationComponent(a) === 'LEC' && !allocGroup
                                                            const isSameGroup = allocGroup === activeGroup
                                                            return slotInRange && (isSameGroup || isSharedLecture)
                                                        }

                                                        return slotInRange
                                                    }
                                                    return false
                                                })

                                                const isStart = allocs.some(a => {
                                                    const range = getAllocationRange(a)
                                                    return !!range && range.start === slot.startMinutes
                                                })

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
                                                                            <ConflictStatusBadge
                                                                                status={isValid ? 'available' : 'conflict'}
                                                                                reasons={confs}
                                                                                compact
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                        {isStart && allocs.map(a => {
                                                            const actualId = a.id || a.class_id
                                                            const confs = checkConflicts(a, actualId)
                                                            const hardConflicts = confs.filter(c => {
                                                                if (!/^Prof conflict:/i.test(c)) return true
                                                                return !/\b(TBD|TBA|UNASSIGNED|UNKNOWN)\b/i.test(c)
                                                            })
                                                            const hasTeacherWarning = isUnassignedFacultyName(a.teacher_name)
                                                            const isLabComp = a.component === 'LAB'
                                                            return (
                                                                <div
                                                                    key={actualId}
                                                                    draggable
                                                                    onDragStart={() => setDraggedAllocId(actualId)}
                                                                    onDragEnd={() => { setDraggedAllocId(null); setHoveredCell(null); }}
                                                                    className={`${styles.placedClass} ${hardConflicts.length > 0 ? styles.hasConflict : ''} ${hardConflicts.length === 0 && hasTeacherWarning ? styles.hasWarning : ''} ${isLabComp ? styles.labComp : ''}`}
                                                                    style={{
                                                                        height: `calc(${(((getAllocationRange(a)?.end || slot.startMinutes) - slot.startMinutes) / 30) * 100}% - 8px)`,
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
                                                                    <span className={styles.allocMetaLine}><MdMeetingRoom /> {a.room || 'TBA Room'}</span>
                                                                    <span className={styles.allocMetaLine}><MdPerson /> {a.teacher_name || 'TBD Faculty'}</span>
                                                                    <span className={styles.allocMetaLine}><MdAccessTime /> {a.schedule_time || 'Time N/A'}</span>

                                                                    {hardConflicts.length > 0 && (
                                                                        <ConflictStatusBadge
                                                                            className={styles.conflictIndicator}
                                                                            status="conflict"
                                                                            reasons={hardConflicts}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                toast.error("Constraint Violation", {
                                                                                    description: hardConflicts.map((c, i) => `${i + 1}. ${c}`).join('\n'),
                                                                                    duration: 5000
                                                                                });
                                                                            }}
                                                                        />
                                                                    )}
                                                                    {hardConflicts.length === 0 && hasTeacherWarning && (
                                                                        <ConflictStatusBadge
                                                                            className={`${styles.conflictIndicator} ${styles.warningIndicator}`}
                                                                            status="conflict"
                                                                            reasons={[`Faculty warning: ${a.course_code} (${a.section}) has no assigned teacher yet (TBD).`]}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                toast.warning('No Faculty Assigned', {
                                                                                    description: `${a.course_code} (${a.section}) is still set to TBD. Assign a faculty in the course panel before finalizing.`,
                                                                                    duration: 5000
                                                                                });
                                                                            }}
                                                                        />
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
                            <MdSave />
                            <span className={styles.saveBtnTextFull}>Save & Applied Changes</span>
                            <span className={styles.saveBtnTextShort}>Save</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
