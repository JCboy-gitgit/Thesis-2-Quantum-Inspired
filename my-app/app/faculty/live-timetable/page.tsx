'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useTheme } from '@/app/context/ThemeContext'
import FacultySidebar from '@/app/components/FacultySidebar'
import FacultyMenuBar from '@/app/components/FacultyMenuBar'
import {
    MdLiveTv,
    MdRefresh,
    MdCalendarToday,
    MdAccessTime,
    MdPerson,
    MdMeetingRoom,
    MdSchool,
    MdWarning,
    MdCheckCircle,
    MdCancel,
    MdClose,
    MdEventBusy,
    MdEventAvailable,
    MdPending,
    MdSend,
    MdInfo,
    MdChevronLeft,
    MdChevronRight,
    MdMenuBook,
    MdGroup,
    MdFiberManualRecord,
    MdEdit,
    MdAdd,
    MdHistory,
    MdMap,
    MdGridView,
    MdViewList,
    MdDragIndicator,
    MdTaskAlt,
    MdFilterList,
    MdSearch,
    MdRestartAlt
} from 'react-icons/md'
import '@/app/styles/faculty-global.css'
import styles from './FacultyLiveTimetable.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────
interface RoomAllocation {
    id: number
    schedule_id: number
    course_code: string
    course_name: string
    section: string
    schedule_day: string
    schedule_time: string
    building: string
    room: string
    teacher_name?: string
    department?: string
}

interface Absence {
    id: number
    allocation_id: number
    faculty_id: string
    absence_date: string
    reason?: string
    status: string
}

interface MakeupRequest {
    id: number
    allocation_id: number
    faculty_id: string
    requested_date: string
    requested_time: string
    requested_room?: string
    reason?: string
    status: string
    admin_note?: string
    original_absence_date?: string
}

interface Schedule {
    id: number
    schedule_name: string
    semester: string
    academic_year: string
    is_locked: boolean
    is_current: boolean
}

interface UserProfile {
    id: string
    email: string
    full_name: string
}

interface Room {
    id: number
    room: string
    building: string
    room_type?: string
    specific_classification?: string
    has_ac?: boolean
    has_whiteboard?: boolean
    has_tv?: boolean
    has_projector?: boolean
    capacity?: number
    floor_number?: number
    status?: string
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

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

function normalizeSection(section: string): string {
    if (!section) return section
    return section.replace(/_(Lab|Lec)$/i, '').trim()
}

function expandDays(dayStr: string): string[] {
    if (!dayStr) return []
    const day = dayStr.trim().toUpperCase()
    if (day.includes('/')) return day.split('/').map(d => normalizeDay(d.trim()))
    if (day === 'TTH' || day === 'T/TH') return ['Tuesday', 'Thursday']
    if (day === 'MWF') return ['Monday', 'Wednesday', 'Friday']
    if (day === 'MW') return ['Monday', 'Wednesday']
    if (day === 'TF') return ['Tuesday', 'Friday']
    if (day === 'MTWTHF') return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    if (day === 'MTWTHFS') return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return [normalizeDay(day)]
}

function parseTimeToMinutes(t: string): number {
    if (!t) return 0
    const m = t.match(/(\d+):(\d+)\s*(AM|PM)?/i)
    if (!m) return 0
    let h = parseInt(m[1]), min = parseInt(m[2])
    const ap = m[3]?.toUpperCase()
    if (ap === 'PM' && h !== 12) h += 12
    if (ap === 'AM' && h === 12) h = 0
    return h * 60 + min
}

function getMonday(date: Date): Date {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    return d
}

function formatDate(d: Date): string {
    return d.toISOString().split('T')[0]
}

function addDays(d: Date, n: number): Date {
    const r = new Date(d)
    r.setDate(r.getDate() + n)
    return r
}

function isClassOngoing(timeStr: string): boolean {
    const now = new Date()
    const nowMin = now.getHours() * 60 + now.getMinutes()
    const parts = timeStr.split('-').map(s => s.trim())
    if (parts.length !== 2) return false
    const start = parseTimeToMinutes(parts[0])
    const end = parseTimeToMinutes(parts[1])
    return nowMin >= start && nowMin < end
}

function getTodayDayName(): string {
    const day = new Date().getDay()
    return DAYS[day === 0 ? 6 : day - 1]
}

const GRID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const FACULTY_TIME_SLOTS = Array.from({ length: 29 }, (_, i) => {
    const hour = Math.floor(i / 2) + 7
    const minute = (i % 2) * 30
    const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
    const ampm = hour >= 12 ? 'PM' : 'AM'
    return `${h12}:${minute.toString().padStart(2, '0')} ${ampm}`
})

function isClassDone(timeStr: string, dayName: string, todayDayName: string): boolean {
    const todayIdx = DAYS.indexOf(todayDayName)
    const dayIdx = DAYS.indexOf(dayName)
    if (dayIdx < 0 || todayIdx < 0) return false
    if (dayIdx < todayIdx) return true
    if (dayIdx > todayIdx) return false
    const now = new Date()
    const nowMin = now.getHours() * 60 + now.getMinutes()
    const parts = timeStr.split('-').map(s => s.trim())
    if (parts.length !== 2) return false
    const end = parseTimeToMinutes(parts[1])
    return nowMin >= end
}

export default function FacultyLiveTimetablePage() {
    const router = useRouter()
    const { theme, collegeTheme } = useTheme()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [menuBarHidden, setMenuBarHidden] = useState(false)
    const [mounted, setMounted] = useState(false)
    const [user, setUser] = useState<UserProfile | null>(null)

    // Data
    const [schedule, setSchedule] = useState<Schedule | null>(null)
    const [allAllocations, setAllAllocations] = useState<RoomAllocation[]>([])
    const [overrides, setOverrides] = useState<any[]>([])
    const [allAbsences, setAllAbsences] = useState<Absence[]>([])
    const [allMakeupRequests, setAllMakeupRequests] = useState<MakeupRequest[]>([])
    const [specialEvents, setSpecialEvents] = useState<any[]>([])
    const [myAbsences, setMyAbsences] = useState<Absence[]>([])
    const [myMakeupRequests, setMyMakeupRequests] = useState<MakeupRequest[]>([])
    const [loading, setLoading] = useState(true)

    // Week navigation
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getMonday(new Date()))

    // View
    type ViewTab = 'timetable' | 'my-absences' | 'my-requests'
    const [activeTab, setActiveTab] = useState<ViewTab>('timetable')
    const [selectedDay, setSelectedDay] = useState<string>(getTodayDayName())

    // Absence marking modal
    const [markingAbsence, setMarkingAbsence] = useState<RoomAllocation | null>(null)
    const [absenceDate, setAbsenceDate] = useState<string>(formatDate(new Date()))
    const [absenceReason, setAbsenceReason] = useState('')
    const [submittingAbsence, setSubmittingAbsence] = useState(false)

    // Makeup request modal
    const [requestingMakeup, setRequestingMakeup] = useState<{ alloc: RoomAllocation; absenceDate?: string } | null>(null)
    const [makeupDate, setMakeupDate] = useState('')
    const [makeupTime, setMakeupTime] = useState('')
    const [makeupStartSlot, setMakeupStartSlot] = useState('')   // e.g. "7:30 AM"
    const [makeupDuration, setMakeupDuration] = useState(90)     // minutes
    const [makeupRoom, setMakeupRoom] = useState('')
    const [makeupReason, setMakeupReason] = useState('')
    const [submittingMakeup, setSubmittingMakeup] = useState(false)
    const [availableRooms, setAvailableRooms] = useState<Room[]>([])
    const [loadingRooms, setLoadingRooms] = useState(false)

    // View/grid state
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
    const [groupBy, setGroupBy] = useState<'all' | 'room' | 'faculty' | 'section'>('all')
    const [groupPage, setGroupPage] = useState(0)
    const [searchQuery, setSearchQuery] = useState('')

    // Drag data (for rescheduling my own classes)
    const [draggedAllocId, setDraggedAllocId] = useState<number | null>(null)
    const [dragOverCell, setDragOverCell] = useState<string | null>(null)
    // Floor plan map (building → floor_plan_id for "View on Map" links)
    const [floorPlanMap, setFloorPlanMap] = useState<Record<string, number>>({})

    // Realtime clock
    const [currentTime, setCurrentTime] = useState(new Date())
    const clockRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        setMounted(true)
        checkAuth()
        fetchFloorPlans()
        clockRef.current = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => { if (clockRef.current) clearInterval(clockRef.current) }
    }, [])

    useEffect(() => {
        if (user) fetchLiveData()
    }, [user, currentWeekStart])

    // Realtime subscription
    useEffect(() => {
        if (!user) return
        const channel = supabase
            .channel(`faculty_live_${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'live_timetable_absences', filter: `faculty_id=eq.${user.id}` }, () => fetchLiveData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'live_makeup_requests', filter: `faculty_id=eq.${user.id}` }, () => fetchLiveData())
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [user])

    // Fetch available rooms whenever the makeup date / time slot / duration changes
    useEffect(() => {
        if (requestingMakeup && makeupDate && makeupStartSlot) {
            fetchAvailableRooms(makeupDate, makeupStartSlot, makeupDuration)
        } else {
            setAvailableRooms([])
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [makeupDate, makeupStartSlot, makeupDuration, requestingMakeup])

    const checkAuth = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user) { router.push('/'); return }

            const { data: userData } = await supabase
                .from('users')
                .select('id, email, full_name, is_active')
                .eq('id', session.user.id)
                .single() as { data: any; error: any }

            if (!userData?.is_active) { router.push('/'); return }

            setUser({ id: userData.id, email: userData.email, full_name: userData.full_name })
        } catch {
            router.push('/')
        }
    }

    const fetchLiveData = useCallback(async () => {
        if (!user) return
        setLoading(true)
        try {
            const weekStr = formatDate(currentWeekStart)
            const res = await fetch(`/api/live-timetable?action=current-week&week_start=${weekStr}`)
            const data = await res.json()

            if (data.success) {
                setSchedule(data.schedule)
                setAllAllocations(data.allocations || [])
                setOverrides(data.overrides || [])
                setAllAbsences(data.absences || [])
                setAllMakeupRequests(data.makeupClasses || [])
                setSpecialEvents(data.specialEvents || [])

                // Filter absences and makeup requests for this faculty
                const myAbs = (data.absences || []).filter((a: Absence) => a.faculty_id === user.id)
                const myMakeup = (data.makeupClasses || []).filter((m: MakeupRequest) => m.faculty_id === user.id)
                setMyAbsences(myAbs)
                setMyMakeupRequests(myMakeup)
            }
        } catch (err) {
            console.error('Failed to fetch live data:', err)
        } finally {
            setLoading(false)
        }
    }, [user, currentWeekStart])

    const handleMarkAbsence = async () => {
        if (!markingAbsence || !user || !schedule) return
        setSubmittingAbsence(true)
        try {
            const res = await fetch('/api/live-timetable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'mark-absence',
                    allocation_id: markingAbsence.id,
                    faculty_id: user.id,
                    absence_date: absenceDate,
                    reason: absenceReason
                })
            })
            const data = await res.json()
            if (data.success) {
                setMarkingAbsence(null)
                setAbsenceReason('')
                await fetchLiveData()
                alert('Absence marked successfully. The admin has been notified.')
            } else {
                alert(data.error || 'Failed to mark absence')
            }
        } catch (err) {
            alert('Failed to mark absence')
        } finally {
            setSubmittingAbsence(false)
        }
    }

    const handleSubmitMakeup = async () => {
        if (!requestingMakeup || !user) return
        if (!makeupDate || !makeupStartSlot) {
            alert('Please select the requested date and time slot.')
            return
        }
        // Derive time string from slot + duration
        const startMin = parseTimeToMinutes(makeupStartSlot)
        const endMin = startMin + makeupDuration
        const endHr = Math.floor(endMin / 60)
        const endMn = endMin % 60
        const endH12 = endHr > 12 ? endHr - 12 : endHr === 0 ? 12 : endHr
        const endAmpm = endHr >= 12 ? 'PM' : 'AM'
        const derivedTime = `${makeupStartSlot} - ${endH12}:${endMn.toString().padStart(2, '0')} ${endAmpm}`

        setSubmittingMakeup(true)
        try {
            const res = await fetch('/api/live-timetable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'makeup-request',
                    allocation_id: requestingMakeup.alloc.id,
                    faculty_id: user.id,
                    requested_date: makeupDate,
                    requested_time: derivedTime,
                    requested_room: makeupRoom || null,
                    reason: makeupReason,
                    original_absence_date: requestingMakeup.absenceDate || null
                })
            })
            const data = await res.json()
            if (data.success) {
                setRequestingMakeup(null)
                setMakeupDate('')
                setMakeupStartSlot('')
                setMakeupDuration(90)
                setMakeupRoom('')
                setMakeupReason('')
                setAvailableRooms([])
                await fetchLiveData()
                alert('Makeup class request submitted! The admin will review it shortly.')
            } else {
                alert(data.error || 'Failed to submit makeup request')
            }
        } catch (err) {
            alert('Failed to submit makeup request')
        } finally {
            setSubmittingMakeup(false)
        }
    }

    const fetchFloorPlans = async () => {
        try {
            const { data: fps } = await (supabase as any)
                .from('floor_plans')
                .select('id, buildings:building_id(name)')
            const map: Record<string, number> = {}
            fps?.forEach((fp: any) => {
                const bname = fp.buildings?.name
                if (bname && !map[bname]) map[bname] = fp.id
            })
            setFloorPlanMap(map)
        } catch (err) {
            console.error('Failed to load floor plans:', err)
        }
    }

    // ── Room availability helpers ──────────────────────────────────────────────
    const getCourseRoomType = (alloc: RoomAllocation): string => {
        const section = (alloc.section || '').toLowerCase()
        const course = (alloc.course_name || '').toLowerCase()
        const code = (alloc.course_code || '').toLowerCase()
        if (section.includes('_lab') || course.includes('laboratory') || code.includes('lab')) return 'Laboratory'
        if (course.includes('computer') || code.startsWith('cs') || code.startsWith('it') || code.startsWith('cpe')) return 'Computer Lab'
        return 'Classroom'
    }

    const fetchAvailableRooms = async (date: string, startSlot: string, duration: number) => {
        if (!date || !startSlot) { setAvailableRooms([]); return }
        setLoadingRooms(true)
        try {
            const { data: rooms } = await (supabase as any)
                .from('rooms')
                .select('id, room, building, room_type, specific_classification, has_ac, has_whiteboard, has_tv, has_projector, capacity, floor_number, status')
                .neq('status', 'under_maintenance')
                .order('building').order('room')

            const startMin = parseTimeToMinutes(startSlot)
            const endMin = startMin + duration

            // Get the day-of-week label from the date string
            const dateParts = date.split('-')
            const dayOfWeek = dateParts.length === 3
                ? new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2])).toLocaleDateString('en-US', { weekday: 'long' })
                : ''

            // Find rooms that are occupied at this time slot
            const occupied = new Set<string>()
            allAllocations.forEach(a => {
                // Match day
                const days = expandDays(a.schedule_day || '')
                if (!days.some(d => d.toLowerCase() === dayOfWeek.toLowerCase())) return
                // Check time overlap
                const parts = (a.schedule_time || '').split('-').map((s: string) => s.trim())
                if (parts.length !== 2) return
                const aStart = parseTimeToMinutes(parts[0])
                const aEnd = parseTimeToMinutes(parts[1])
                if (startMin < aEnd && endMin > aStart) {
                    occupied.add(`${(a.building || '').toLowerCase()}||${(a.room || '').toLowerCase()}`)
                }
            })

            const filtered = (rooms || []).filter((r: Room) =>
                !occupied.has(`${(r.building || '').toLowerCase()}||${(r.room || '').toLowerCase()}`)
            )
            setAvailableRooms(filtered)
        } catch (err) {
            console.error('Failed to fetch available rooms:', err)
            setAvailableRooms([])
        } finally {
            setLoadingRooms(false)
        }
    }

    const handleFacultyDragOver = (e: React.DragEvent) => { e.preventDefault() }

    const handleFacultyDrop = (e: React.DragEvent, targetDay: string, slotMinutes: number) => {
        e.preventDefault()
        const allocId = parseInt(e.dataTransfer.getData('allocId'))
        const alloc = allAllocations.find(a => a.id === allocId)
        if (!alloc) return
        const slotHour = Math.floor(slotMinutes / 60)
        const slotMin = slotMinutes % 60
        const h12 = slotHour > 12 ? slotHour - 12 : slotHour === 0 ? 12 : slotHour
        const ampm = slotHour >= 12 ? 'PM' : 'AM'
        const origParts = (alloc.schedule_time || '').split('-').map((s: string) => s.trim())
        let durationMin = 90
        if (origParts.length === 2) {
            durationMin = Math.max(30, parseTimeToMinutes(origParts[1]) - parseTimeToMinutes(origParts[0]))
        }
        const startSlotStr = `${h12}:${slotMin.toString().padStart(2, '0')} ${ampm}`
        const targetDate = getDayDate(targetDay)
        setRequestingMakeup({ alloc })
        setMakeupDate(targetDate)
        setMakeupStartSlot(startSlotStr)
        setMakeupDuration(durationMin)
        setMakeupRoom(alloc.room)
        setMakeupReason('')
        setDraggedAllocId(null)
        setDragOverCell(null)
    }

    // ── Grid / Full Schedule Logic ──

    // Get effective allocation (with override applied)
    const getEffectiveAllocation = (alloc: RoomAllocation) => {
        const override = overrides.find(o => o.allocation_id === alloc.id)
        if (!override) return alloc
        return {
            ...alloc,
            schedule_day: override.override_day || alloc.schedule_day,
            schedule_time: override.override_time || alloc.schedule_time,
            room: override.override_room || alloc.room,
            building: override.override_building || alloc.building,
            _hasOverride: true,
            _overrideNote: override.note,
            _overrideId: override.id
        } as any
    }

    const effectiveAllocations = useMemo(() => {
        const base = allAllocations.map(getEffectiveAllocation)
        // Add approved makeups as new allocations
        const makeups = allMakeupRequests
            .filter(m => m.status === 'approved')
            .map(m => {
                const original = allAllocations.find(a => a.id === m.allocation_id)
                if (!original) return null
                const date = new Date(m.requested_date)
                const dayName = DAYS[date.getDay() === 0 ? 6 : date.getDay() - 1]
                return {
                    ...original,
                    id: -m.id,
                    schedule_day: dayName,
                    schedule_time: m.requested_time,
                    room: m.requested_room || original.room,
                    _isMakeup: true,
                    _makeupId: m.id
                } as any
            })
            .filter(Boolean) as RoomAllocation[]

        const specials = specialEvents.map(se => {
            const [year, month, day] = se.event_date.split('-')
            const date = new Date(Number(year), Number(month) - 1, Number(day))
            const dayName = DAYS[date.getDay() === 0 ? 6 : date.getDay() - 1]

            return {
                id: -(100000 + se.id),
                building: se.building,
                room: se.room,
                course_code: 'SPECIAL EVENT',
                course_name: se.reason || 'Room Unavailable',
                section: '',
                schedule_day: dayName,
                schedule_time: se.time_start && se.time_end ? `${se.time_start} - ${se.time_end}` : '07:00 AM - 09:00 PM',
                teacher_name: 'N/A',
                _isSpecialEvent: true,
                _specialEventReason: se.reason,
            } as any
        })

        return [...base, ...makeups, ...specials]
    }, [allAllocations, overrides, allMakeupRequests, specialEvents])

    // Grouping
    const getGroupValues = (): string[] => {
        const set = new Set<string>()
        effectiveAllocations.forEach(a => {
            if (groupBy === 'room') set.add(`${a.building} – ${a.room}`)
            else if (groupBy === 'faculty') set.add(a.teacher_name || 'Unassigned')
            else if (groupBy === 'section') set.add(normalizeSection(a.section) || 'Unknown')
        })
        return Array.from(set).sort((a, b) => a.localeCompare(b))
    }

    const groupValues = groupBy !== 'all' ? getGroupValues() : []
    const pagedGroupValue = groupBy !== 'all' && groupValues.length > 0
        ? (groupPage < groupValues.length ? groupValues[groupPage] : groupValues[0])
        : 'all'

    // Get allocations for Grid (All classes)
    const getFilteredGridAllocations = (day: string) => {
        let filtered = effectiveAllocations

        // Apply group filter
        if (groupBy !== 'all' && pagedGroupValue !== 'all') {
            filtered = filtered.filter(a => {
                if (groupBy === 'room') return `${a.building} – ${a.room}` === pagedGroupValue
                if (groupBy === 'faculty') return (a.teacher_name || 'Unassigned') === pagedGroupValue
                if (groupBy === 'section') return (normalizeSection(a.section) || 'Unknown') === pagedGroupValue
                return true
            })
        }

        // Apply search query
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            filtered = filtered.filter(a =>
                a.course_code?.toLowerCase().includes(q) ||
                a.course_name?.toLowerCase().includes(q) ||
                a.room?.toLowerCase().includes(q) ||
                a.teacher_name?.toLowerCase().includes(q) ||
                a.section?.toLowerCase().includes(q)
            )
        }

        return filtered
            .filter(a => {
                const days = expandDays(a.schedule_day || '')
                return days.some(d => d.toLowerCase() === day.toLowerCase())
            })
            .sort((a, b) => parseTimeToMinutes(a.schedule_time?.split('-')[0] || '') - parseTimeToMinutes(b.schedule_time?.split('-')[0] || ''))
    }

    // Get allocations for List (My classes only)
    const getMyDayAllocations = (day: string) => {
        // We use effectiveAllocations here too so my own view reflects admin overrides/makeups
        return effectiveAllocations
            .filter(a => {
                const days = expandDays(a.schedule_day || '')
                return days.some(d => d.toLowerCase() === day.toLowerCase())
            })
            .filter(a => {
                if (!user) return false
                const name = (a.teacher_name || '').toLowerCase().trim()
                const myName = (user.full_name || '').toLowerCase().trim()
                return name === myName || name.includes(myName) || myName.includes(name)
            })
            .sort((a, b) => parseTimeToMinutes(a.schedule_time?.split('-')[0] || '') - parseTimeToMinutes(b.schedule_time?.split('-')[0] || ''))
    }

    const isEffectiveAbsent = (allocId: number, date: string) => {
        return allAbsences.some(a => a.allocation_id === allocId && a.absence_date === date && a.status !== 'disputed')
    }

    // Total count of MY classes this week (across all days)
    const myTotalClasses = effectiveAllocations.filter(a => {
        if (!user) return false
        const name = (a.teacher_name || '').toLowerCase().trim()
        const myName = (user.full_name || '').toLowerCase().trim()
        return name === myName || name.includes(myName) || myName.includes(name)
    }).length

    const getDayDate = (dayName: string): string => {
        const idx = DAYS.indexOf(dayName)
        if (idx === -1) return ''
        return formatDate(addDays(currentWeekStart, idx))
    }

    const isAbsentOnDate = (allocId: number, date: string) => {
        return myAbsences.some(a => a.allocation_id === allocId && a.absence_date === date)
    }

    const pendingMakeup = myMakeupRequests.filter(m => m.status === 'pending').length

    // Derived values for grid view
    const isCurrentWeek = formatDate(currentWeekStart) === formatDate(getMonday(new Date()))
    const isPastWeek = formatDate(currentWeekStart) < formatDate(getMonday(new Date()))
    const todayDayName = getTodayDayName()

    if (!mounted) return null

    return (
        <div className={styles.page} data-theme={theme} data-college-theme={collegeTheme}>
            <FacultySidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} menuBarHidden={menuBarHidden} />
            <div className={`${styles.mainLayout} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
                <FacultyMenuBar
                    onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                    sidebarOpen={sidebarOpen}
                    isHidden={menuBarHidden}
                    onToggleHidden={setMenuBarHidden}
                    userEmail={user?.email}
                />

                <main className={`${styles.main} ${menuBarHidden ? styles.menuHidden : ''}`}>
                    {/* ── Header ── */}
                    <div className={styles.header}>
                        <div className={styles.headerLeft}>
                            <div className={styles.liveIndicator}>
                                <MdFiberManualRecord className={styles.liveDot} />
                                <span>LIVE</span>
                            </div>
                            <div>
                                <h1 className={styles.title}>
                                    <MdLiveTv className={styles.titleIcon} />
                                    Live Timetable
                                </h1>
                                <p className={styles.subtitle}>
                                    {schedule ? `${schedule.schedule_name} · ${schedule.semester} ${schedule.academic_year}` : 'Loading schedule...'}
                                </p>
                            </div>
                        </div>
                        <div className={styles.headerRight}>
                            <div className={styles.clockDisplay}>
                                <MdAccessTime />
                                <span>{currentTime.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                            </div>
                            <button className={styles.refreshBtn} onClick={fetchLiveData} disabled={loading}>
                                <MdRefresh className={loading ? styles.spinning : ''} />
                            </button>
                        </div>
                    </div>

                    {/* ── Info Banner ── */}
                    <div className={styles.infoBanner}>
                        <MdInfo />
                        <span>
                            This is the <strong>live view</strong> of the current week's timetable. You can mark absences and request makeup classes directly from here.
                            The schedule resets every Sunday to the original locked schedule.
                        </span>
                    </div>

                    {/* ── Stats ── */}
                    <div className={styles.statsRow}>
                        <div className={styles.statCard}>
                            <div className={styles.statIconCircle}>
                                <MdCalendarToday className={styles.statIcon} />
                            </div>
                            <div>
                                <div className={styles.statValue}>{myTotalClasses}</div>
                                <div className={styles.statLabel}>My Classes This Week</div>
                            </div>
                        </div>
                        <div className={`${styles.statCard} ${styles.statWarning}`}>
                            <div className={`${styles.statIconCircle} ${styles.statIconCircleWarning}`}>
                                <MdEventBusy className={styles.statIcon} />
                            </div>
                            <div>
                                <div className={styles.statValue}>{myAbsences.length}</div>
                                <div className={styles.statLabel}>My Absences This Week</div>
                            </div>
                        </div>
                        <div className={`${styles.statCard} ${styles.statPending}`}>
                            <div className={`${styles.statIconCircle} ${styles.statIconCirclePending}`}>
                                <MdPending className={styles.statIcon} />
                            </div>
                            <div>
                                <div className={styles.statValue}>{pendingMakeup}</div>
                                <div className={styles.statLabel}>Pending Makeup Requests</div>
                            </div>
                        </div>
                    </div>

                    {/* ── Week Navigator ── */}
                    <div className={styles.weekNav}>
                        <button className={styles.weekNavBtn} onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))}>
                            <MdChevronLeft /> Prev
                        </button>
                        <div className={styles.weekLabel}>
                            <MdCalendarToday />
                            <span>
                                {currentWeekStart.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                                {' – '}
                                {addDays(currentWeekStart, 6).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            {formatDate(currentWeekStart) === formatDate(getMonday(new Date())) && (
                                <span className={styles.currentWeekBadge}>This Week</span>
                            )}
                        </div>
                        <button className={styles.weekNavBtn} onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}>
                            Next <MdChevronRight />
                        </button>
                    </div>

                    {/* ── Tabs ── */}
                    <div className={styles.tabs}>
                        {(['timetable', 'my-absences', 'my-requests'] as ViewTab[]).map(tab => (
                            <button
                                key={tab}
                                className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
                                onClick={() => setActiveTab(tab)}
                            >
                                {tab === 'timetable' && <MdLiveTv />}
                                {tab === 'my-absences' && <MdEventBusy />}
                                {tab === 'my-requests' && <MdEventAvailable />}
                                <span>
                                    {tab === 'timetable' ? 'Live View' : tab === 'my-absences' ? 'My Absences' : 'Makeup Requests'}
                                </span>
                                {tab === 'my-absences' && myAbsences.length > 0 && (
                                    <span className={styles.tabBadge}>{myAbsences.length}</span>
                                )}
                                {tab === 'my-requests' && pendingMakeup > 0 && (
                                    <span className={`${styles.tabBadge} ${styles.tabBadgePending}`}>{pendingMakeup}</span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* ── Content ── */}
                    {loading ? (
                        <div className={styles.loadingState}>
                            <div className={styles.spinner} />
                            <p>Loading live timetable...</p>
                        </div>
                    ) : !schedule ? (
                        <div className={styles.emptyState}>
                            <MdInfo className={styles.emptyIcon} />
                            <h3>No Active Schedule</h3>
                            <p>The admin hasn't locked a schedule yet. Check back later.</p>
                        </div>
                    ) : (
                        <>
                            {/* ── LIVE TIMETABLE TAB ── */}
                            {activeTab === 'timetable' && (
                                <div className={styles.timetableSection}>
                                    {/* View mode toggle */}
                                    {/* View mode toggle & Toolbar */}
                                    <div className={styles.timetableToolbar}>
                                        <div className={styles.viewToggleBar}>
                                            <button
                                                className={`${styles.viewToggleBtn} ${viewMode === 'list' ? styles.viewToggleBtnActive : ''}`}
                                                onClick={() => setViewMode('list')}
                                            >
                                                <MdViewList /> Use List View (My Classes)
                                            </button>
                                            <button
                                                className={`${styles.viewToggleBtn} ${viewMode === 'grid' ? styles.viewToggleBtnActive : ''}`}
                                                onClick={() => {
                                                    setViewMode('grid')
                                                    setGroupBy('all') // Reset group when switching to grid
                                                }}
                                            >
                                                <MdGridView /> Full Schedule Grid
                                            </button>
                                        </div>

                                        {viewMode === 'grid' && (
                                            <div className={styles.gridControls}>
                                                <div className={styles.groupSelector}>
                                                    <div className={styles.groupLabel}>Group By:</div>
                                                    <select
                                                        className={styles.groupSelect}
                                                        value={groupBy}
                                                        onChange={(e) => {
                                                            setGroupBy(e.target.value as any)
                                                            setGroupPage(0)
                                                        }}
                                                    >
                                                        <option value="all">Show All</option>
                                                        <option value="room">Room</option>
                                                        <option value="faculty">Faculty</option>
                                                        <option value="section">Section</option>
                                                    </select>
                                                </div>

                                                {groupBy !== 'all' && groupValues.length > 0 && (
                                                    <div className={styles.groupPaginator}>
                                                        <button
                                                            className={styles.groupPageBtn}
                                                            onClick={() => setGroupPage(p => Math.max(0, p - 1))}
                                                            disabled={groupPage === 0}
                                                        >
                                                            <MdChevronLeft />
                                                        </button>
                                                        <div className={styles.groupPageLabel}>
                                                            <strong>{groupValues[groupPage]}</strong>
                                                            <span className={styles.groupPageCount}>{groupPage + 1} / {groupValues.length}</span>
                                                        </div>
                                                        <button
                                                            className={styles.groupPageBtn}
                                                            onClick={() => setGroupPage(p => Math.min(groupValues.length - 1, p + 1))}
                                                            disabled={groupPage === groupValues.length - 1}
                                                        >
                                                            <MdChevronRight />
                                                        </button>
                                                    </div>
                                                )}

                                                <div className={styles.searchBar}>
                                                    <MdSearch />
                                                    <input
                                                        type="text"
                                                        placeholder="Search schedule..."
                                                        value={searchQuery}
                                                        onChange={(e) => setSearchQuery(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* ── LIST VIEW ── */}
                                    {viewMode === 'list' && (
                                        <>
                                            {/* Day selector */}
                                            <div className={styles.daySelector}>
                                                {DAYS.map(day => {
                                                    const dayDate = getDayDate(day)
                                                    const isToday = dayDate === formatDate(new Date())
                                                    const dayAbsences = myAbsences.filter(a => a.absence_date === dayDate).length
                                                    const dayClasses = getMyDayAllocations(day).length
                                                    return (
                                                        <button
                                                            key={day}
                                                            className={`${styles.dayBtn} ${selectedDay === day ? styles.dayBtnActive : ''} ${isToday ? styles.dayBtnToday : ''}`}
                                                            onClick={() => setSelectedDay(day)}
                                                        >
                                                            <span className={styles.dayName}>{day.slice(0, 3)}</span>
                                                            <span className={styles.dayCount}>{dayClasses} class{dayClasses !== 1 ? 'es' : ''}</span>
                                                            {dayAbsences > 0 && <span className={styles.dayAbsenceBadge}>{dayAbsences}</span>}
                                                            {isToday && <span className={styles.todayDot} />}
                                                        </button>
                                                    )
                                                })}
                                            </div>

                                            {/* Class list for selected day */}
                                            <div className={styles.classGrid}>
                                                {getMyDayAllocations(selectedDay).length === 0 && (
                                                    <div className={styles.emptyDay}>
                                                        <MdCalendarToday />
                                                        <p>No classes assigned to you on {selectedDay}</p>
                                                    </div>
                                                )}
                                                {getMyDayAllocations(selectedDay).map(alloc => {
                                                    const dayDate = getDayDate(selectedDay)
                                                    const absent = isAbsentOnDate(alloc.id, dayDate)
                                                    const ongoing = !absent && isClassOngoing(alloc.schedule_time || '')

                                                    return (
                                                        <div
                                                            key={alloc.id}
                                                            className={`${styles.classCard} ${absent ? styles.classCardAbsent : ''} ${ongoing ? styles.classCardOngoing : ''}`}
                                                        >
                                                            {/* Status */}
                                                            <div className={styles.cardStatusRow}>
                                                                {ongoing && (
                                                                    <span className={styles.ongoingBadge}>
                                                                        <MdFiberManualRecord className={styles.ongoingDot} /> ONGOING NOW
                                                                    </span>
                                                                )}
                                                                {absent && (
                                                                    <span className={styles.absentBadge}>
                                                                        <MdEventBusy /> ABSENT
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className={styles.cardMain}>
                                                                <div className={styles.cardCourse}>
                                                                    <span className={styles.courseCode}>{alloc.course_code}</span>
                                                                    <span className={styles.courseName}>{alloc.course_name}</span>
                                                                </div>
                                                                <div className={styles.cardDetails}>
                                                                    <span><MdAccessTime /> {alloc.schedule_time}</span>
                                                                    <span>
                                                                        <MdMeetingRoom /> {alloc.building} – {alloc.room}
                                                                        {floorPlanMap[alloc.building] && (
                                                                            <button
                                                                                className={styles.mapLinkBtn}
                                                                                onClick={() => router.push(`/floor-plan/view/${floorPlanMap[alloc.building]}?room=${encodeURIComponent(alloc.room)}`)}
                                                                                title="View Room on Map"
                                                                            >
                                                                                <MdMap /> Map
                                                                            </button>
                                                                        )}
                                                                    </span>
                                                                    <span><MdGroup /> {normalizeSection(alloc.section)}</span>
                                                                    {alloc.teacher_name && <span><MdPerson /> {alloc.teacher_name}</span>}
                                                                </div>
                                                            </div>

                                                            {/* Faculty actions */}
                                                            {!absent && (
                                                                <div className={styles.cardActions}>
                                                                    <button
                                                                        className={styles.markAbsenceBtn}
                                                                        onClick={() => {
                                                                            setMarkingAbsence(alloc)
                                                                            setAbsenceDate(dayDate || formatDate(new Date()))
                                                                            setAbsenceReason('')
                                                                        }}
                                                                    >
                                                                        <MdEventBusy /> Mark Absent
                                                                    </button>
                                                                    <button
                                                                        className={styles.makeupBtn}
                                                                        onClick={() => {
                                                                            setRequestingMakeup({ alloc })
                                                                            setMakeupDate('')
                                                                            setMakeupTime('')
                                                                            setMakeupRoom('')
                                                                            setMakeupReason('')
                                                                        }}
                                                                    >
                                                                        <MdAdd /> Request Makeup
                                                                    </button>
                                                                </div>
                                                            )}
                                                            {absent && (
                                                                <div className={styles.cardActions}>
                                                                    <button
                                                                        className={styles.makeupBtn}
                                                                        onClick={() => {
                                                                            setRequestingMakeup({ alloc, absenceDate: dayDate })
                                                                            setMakeupDate('')
                                                                            setMakeupTime('')
                                                                            setMakeupRoom('')
                                                                            setMakeupReason('')
                                                                        }}
                                                                    >
                                                                        <MdEventAvailable /> Request Makeup Class
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </>
                                    )}

                                    {/* ── GRID VIEW ── */}
                                    {/* ── GRID VIEW (READ ONLY) ── */}
                                    {viewMode === 'grid' && (
                                        <>
                                            {/* Legend */}
                                            <div className={styles.gridLegend}>
                                                <span className={styles.legendTitle}>Legend:</span>
                                                <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendNormal}`} /> Scheduled</span>
                                                <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendOngoing}`} /> Ongoing</span>
                                                <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendDone}`} /> Done</span>
                                                <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendAbsent}`} /> Absent</span>
                                                <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendOverride}`} /> Modified</span>
                                                <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendMakeup}`} /> Makeup Event</span>
                                            </div>

                                            {/* Grid table: Mon–Sat, 7am–8pm */}
                                            <div className={styles.gridWrapper}>
                                                <div className={styles.gridContainer}>
                                                    <table className={styles.gridTable}>
                                                        <thead>
                                                            <tr>
                                                                <th className={styles.gridTimeHeader}>
                                                                    <MdAccessTime /> Time
                                                                </th>
                                                                {GRID_DAYS.map(day => {
                                                                    const dayDate = getDayDate(day)
                                                                    const isToday = dayDate === formatDate(new Date())
                                                                    return (
                                                                        <th key={day} className={`${styles.gridDayHeader} ${isToday ? styles.gridDayToday : ''}`}>
                                                                            <span>{day.slice(0, 3)}</span>
                                                                            <span className={styles.gridDayDate}>
                                                                                {dayDate ? new Date(dayDate + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : ''}
                                                                            </span>
                                                                        </th>
                                                                    )
                                                                })}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {FACULTY_TIME_SLOTS.map((slot, slotIdx) => {
                                                                const isHour = slotIdx % 2 === 0
                                                                const slotMinutes = (Math.floor(slotIdx / 2) + 7) * 60 + (slotIdx % 2) * 30
                                                                return (
                                                                    <tr key={slot} className={isHour ? styles.gridHourRow : styles.gridHalfRow}>
                                                                        <td className={`${styles.gridTimeCell} ${isHour ? styles.gridHourMark : styles.gridHalfMark}`}>
                                                                            {isHour ? slot : ''}
                                                                        </td>
                                                                        {GRID_DAYS.map(day => {
                                                                            const dayDate = getDayDate(day)
                                                                            // Use Full Grid Allocations Logic
                                                                            const dayAllocs = getFilteredGridAllocations(day)

                                                                            const startingHere = dayAllocs.filter(a => {
                                                                                const parts = (a.schedule_time || '').split('-').map((s: string) => s.trim())
                                                                                if (parts.length !== 2) return false
                                                                                const startMin = parseTimeToMinutes(parts[0])
                                                                                return startMin >= slotMinutes && startMin < slotMinutes + 30
                                                                            })
                                                                            const coveredByEarlier = dayAllocs.some(a => {
                                                                                const parts = (a.schedule_time || '').split('-').map((s: string) => s.trim())
                                                                                if (parts.length !== 2) return false
                                                                                const startMin = parseTimeToMinutes(parts[0])
                                                                                const endMin = parseTimeToMinutes(parts[1])
                                                                                return startMin < slotMinutes && endMin > slotMinutes
                                                                            })
                                                                            if (coveredByEarlier && startingHere.length === 0) return null
                                                                            return (
                                                                                <td
                                                                                    key={`${day}-${slot}`}
                                                                                    className={styles.gridDataCell}
                                                                                >
                                                                                    <div className={styles.gridCellContent}>
                                                                                        {startingHere.map(alloc => {
                                                                                            const parts = (alloc.schedule_time || '').split('-').map((s: string) => s.trim())
                                                                                            const startMin = parseTimeToMinutes(parts[0] || '')
                                                                                            const endMin = parseTimeToMinutes(parts[1] || '')
                                                                                            const durationSlots = Math.max(1, Math.ceil((endMin - startMin) / 30))
                                                                                            const compactHeight = durationSlots * 32 - 2
                                                                                            const absent = isEffectiveAbsent(alloc.id, dayDate)
                                                                                            const ongoing = !absent && isCurrentWeek && isClassOngoing(alloc.schedule_time || '') && day === todayDayName
                                                                                            const done = !absent && !ongoing && (isPastWeek || (isCurrentWeek && isClassDone(alloc.schedule_time || '', day, todayDayName)))
                                                                                            const hasOverride = (alloc as any)._hasOverride
                                                                                            const isMakeup = (alloc as any)._isMakeup
                                                                                            const isSpecialEvent = (alloc as any)._isSpecialEvent

                                                                                            return (
                                                                                                <div
                                                                                                    key={alloc.id}
                                                                                                    className={`${styles.gridBlock} ${absent ? styles.gridBlockAbsent : ''} ${ongoing ? styles.gridBlockOngoing : ''} ${done ? styles.gridBlockDone : ''} ${hasOverride ? styles.gridBlockOverride : ''} ${isMakeup ? styles.gridBlockMakeup : ''} ${isSpecialEvent ? styles.gridBlockAbsent : ''}`}
                                                                                                    style={{ height: `${compactHeight}px` }}
                                                                                                    title={`${alloc.course_code} ${isSpecialEvent ? alloc.course_name : '· ' + normalizeSection(alloc.section)}\n${alloc.schedule_time}\n${alloc.building} ${alloc.room}${alloc.teacher_name && !isSpecialEvent ? '\n' + alloc.teacher_name : ''}${absent ? '\n⚠ ABSENT' : ''}${ongoing && !isSpecialEvent ? '\n● ONGOING' : ''}${done && !isSpecialEvent ? '\n✓ DONE' : ''}${hasOverride ? '\n✎ MODIFIED' : ''}${isMakeup ? '\n★ MAKEUP' : ''}`}
                                                                                                >
                                                                                                    <div className={styles.gridBlockHeader}>
                                                                                                        {ongoing && !isSpecialEvent && <span className={styles.gridBlockLiveDot}><MdFiberManualRecord /></span>}
                                                                                                        {(absent || isSpecialEvent) && <span className={styles.gridBlockAbsentIcon}><MdEventBusy /></span>}
                                                                                                        {done && !isSpecialEvent && <span className={styles.gridBlockDoneIcon}><MdTaskAlt /></span>}
                                                                                                        {hasOverride && !absent && !done && !isSpecialEvent && <span className={styles.gridBlockOverrideIcon}><MdEdit /></span>}
                                                                                                        {isMakeup && <span className={styles.gridBlockMakeupIcon}><MdEventAvailable /></span>}
                                                                                                    </div>
                                                                                                    <span className={styles.gridBlockCode}>{alloc.course_code}</span>
                                                                                                    {durationSlots >= 2 && (
                                                                                                        <>
                                                                                                            <span className={styles.gridBlockSection}>{isSpecialEvent ? alloc.course_name : normalizeSection(alloc.section)}</span>
                                                                                                            <span className={styles.gridBlockRoom}>{alloc.room}</span>
                                                                                                        </>
                                                                                                    )}
                                                                                                    {durationSlots >= 3 && !isSpecialEvent && (
                                                                                                        <span className={styles.gridBlockTime}>{alloc.schedule_time}</span>
                                                                                                    )}
                                                                                                </div>
                                                                                            )
                                                                                        })}
                                                                                    </div>
                                                                                </td>
                                                                            )
                                                                        })}
                                                                    </tr>
                                                                )
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* ── MY ABSENCES TAB ── */}
                            {activeTab === 'my-absences' && (
                                <div className={styles.listSection}>
                                    <div className={styles.listHeader}>
                                        <h2 className={styles.listTitle}><MdEventBusy /> My Absences This Week</h2>
                                    </div>
                                    <div className={styles.requestList}>
                                        {myAbsences.map(absence => {
                                            const alloc = allAllocations.find(al => al.id === absence.allocation_id)
                                            return (
                                                <div key={absence.id} className={styles.requestCard}>
                                                    <div className={styles.requestCardLeft}>
                                                        {alloc && (
                                                            <div className={styles.requestTitle}>
                                                                <MdMenuBook />
                                                                <span>{alloc.course_code} – {normalizeSection(alloc.section)}</span>
                                                            </div>
                                                        )}
                                                        <div className={styles.requestDetails}>
                                                            <span><MdCalendarToday /> {absence.absence_date}</span>
                                                            {alloc && <span><MdMeetingRoom /> {alloc.building} {alloc.room}</span>}
                                                            {alloc && <span><MdAccessTime /> {alloc.schedule_time}</span>}
                                                            {absence.reason && <span className={styles.requestReason}>Reason: {absence.reason}</span>}
                                                        </div>
                                                    </div>
                                                    <div className={styles.requestCardRight}>
                                                        <span className={`${styles.statusBadge} ${styles[`status_${absence.status}`]}`}>
                                                            {absence.status}
                                                        </span>
                                                        <button
                                                            className={styles.makeupBtn}
                                                            onClick={() => {
                                                                const absAlloc = allAllocations.find(al => al.id === absence.allocation_id)
                                                                if (absAlloc) {
                                                                    setRequestingMakeup({ alloc: absAlloc, absenceDate: absence.absence_date })
                                                                    setMakeupDate('')
                                                                    setMakeupTime('')
                                                                    setMakeupRoom('')
                                                                    setMakeupReason('')
                                                                    setActiveTab('timetable')
                                                                }
                                                            }}
                                                        >
                                                            <MdEventAvailable /> Request Makeup
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {myAbsences.length === 0 && (
                                            <div className={styles.emptyList}>
                                                <MdCheckCircle className={styles.emptyListIcon} />
                                                <p>No absences recorded this week. Great attendance!</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── MY MAKEUP REQUESTS TAB ── */}
                            {activeTab === 'my-requests' && (
                                <div className={styles.listSection}>
                                    <div className={styles.listHeader}>
                                        <h2 className={styles.listTitle}><MdEventAvailable /> My Makeup Class Requests</h2>
                                    </div>
                                    <div className={styles.requestList}>
                                        {myMakeupRequests.map(req => {
                                            const alloc = allAllocations.find(al => al.id === req.allocation_id)
                                            return (
                                                <div key={req.id} className={`${styles.requestCard} ${req.status === 'pending' ? styles.requestCardPending : ''}`}>
                                                    <div className={styles.requestCardLeft}>
                                                        {alloc && (
                                                            <div className={styles.requestTitle}>
                                                                <MdMenuBook />
                                                                <span>{alloc.course_code} – {normalizeSection(alloc.section)}</span>
                                                            </div>
                                                        )}
                                                        <div className={styles.requestDetails}>
                                                            <span><MdCalendarToday /> Requested: {req.requested_date}</span>
                                                            <span><MdAccessTime /> Time: {req.requested_time}</span>
                                                            {req.requested_room && <span><MdMeetingRoom /> Room: {req.requested_room}</span>}
                                                            {req.original_absence_date && <span className={styles.absenceRef}>For absence on: {req.original_absence_date}</span>}
                                                            {req.reason && <span className={styles.requestReason}>Reason: {req.reason}</span>}
                                                            {req.admin_note && (
                                                                <span className={`${styles.adminNote} ${req.status === 'approved' ? styles.adminNoteApproved : styles.adminNoteRejected}`}>
                                                                    Admin: {req.admin_note}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className={styles.requestCardRight}>
                                                        <span className={`${styles.statusBadge} ${styles[`status_${req.status}`]}`}>
                                                            {req.status === 'pending' ? '⏳ Pending' : req.status === 'approved' ? '✅ Approved' : '❌ Rejected'}
                                                        </span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {myMakeupRequests.length === 0 && (
                                            <div className={styles.emptyList}>
                                                <MdHistory className={styles.emptyListIcon} />
                                                <p>No makeup class requests this week</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </main>
            </div>

            {/* ── Mark Absence Modal ── */}
            {markingAbsence && (
                <div className={styles.modalOverlay} onClick={() => setMarkingAbsence(null)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3><MdEventBusy /> Mark Class as Absent</h3>
                            <button className={styles.modalClose} onClick={() => setMarkingAbsence(null)}><MdClose /></button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.reviewInfo}>
                                <p><strong>Course:</strong> {markingAbsence.course_code} – {markingAbsence.course_name}</p>
                                <p><strong>Section:</strong> {normalizeSection(markingAbsence.section)}</p>
                                <p><strong>Room:</strong> {markingAbsence.building} {markingAbsence.room}</p>
                                <p><strong>Time:</strong> {markingAbsence.schedule_time}</p>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Absence Date</label>
                                <input
                                    type="date"
                                    className={styles.formInput}
                                    value={absenceDate}
                                    onChange={e => setAbsenceDate(e.target.value)}
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Reason (optional)</label>
                                <textarea
                                    className={styles.formTextarea}
                                    value={absenceReason}
                                    onChange={e => setAbsenceReason(e.target.value)}
                                    placeholder="Reason for absence..."
                                    rows={3}
                                />
                            </div>
                            <div className={styles.warningNote}>
                                <MdWarning /> The admin will be notified of this absence.
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.cancelBtn} onClick={() => setMarkingAbsence(null)}>Cancel</button>
                            <button className={styles.submitBtn} onClick={handleMarkAbsence} disabled={submittingAbsence}>
                                {submittingAbsence ? <span className={styles.btnSpinner} /> : <MdSend />}
                                Mark Absent
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Makeup Request Modal ── */}
            {requestingMakeup && (() => {
                const preferredType = getCourseRoomType(requestingMakeup.alloc)
                const closeModal = () => {
                    setRequestingMakeup(null)
                    setMakeupDate('')
                    setMakeupStartSlot('')
                    setMakeupDuration(90)
                    setMakeupRoom('')
                    setMakeupReason('')
                    setAvailableRooms([])
                }
                // Build derived time preview
                let timePreview = ''
                if (makeupStartSlot) {
                    const startMin = parseTimeToMinutes(makeupStartSlot)
                    const endMin = startMin + makeupDuration
                    const endHr = Math.floor(endMin / 60)
                    const endMn = endMin % 60
                    const endH12 = endHr > 12 ? endHr - 12 : endHr === 0 ? 12 : endHr
                    const endAmpm = endHr >= 12 ? 'PM' : 'AM'
                    timePreview = `${makeupStartSlot} – ${endH12}:${endMn.toString().padStart(2, '0')} ${endAmpm}`
                }
                return (
                    <div className={styles.modalOverlay} onClick={closeModal}>
                        <div className={`${styles.modal} ${styles.modalWide}`} onClick={e => e.stopPropagation()}>
                            <div className={styles.modalHeader}>
                                <h3><MdEventAvailable /> Request Makeup Class</h3>
                                <button className={styles.modalClose} onClick={closeModal}><MdClose /></button>
                            </div>
                            <div className={styles.modalBody}>
                                <div className={styles.reviewInfo}>
                                    <p><strong>Course:</strong> {requestingMakeup.alloc.course_code} – {requestingMakeup.alloc.course_name}</p>
                                    <p><strong>Section:</strong> {normalizeSection(requestingMakeup.alloc.section)}</p>
                                    {requestingMakeup.absenceDate && <p><strong>For Absence On:</strong> {requestingMakeup.absenceDate}</p>}
                                </div>

                                {/* Date */}
                                <div className={styles.formGroup}>
                                    <label>Preferred Makeup Date *</label>
                                    <input
                                        type="date"
                                        className={styles.formInput}
                                        value={makeupDate}
                                        onChange={e => setMakeupDate(e.target.value)}
                                        min={formatDate(new Date())}
                                    />
                                </div>

                                {/* Time Slot Picker */}
                                <div className={styles.formGroup}>
                                    <label>Preferred Start Time *</label>
                                    <div className={styles.timeSlotPicker}>
                                        {FACULTY_TIME_SLOTS.map(slot => (
                                            <button
                                                key={slot}
                                                type="button"
                                                className={`${styles.timeSlotBtn} ${makeupStartSlot === slot ? styles.timeSlotBtnActive : ''}`}
                                                onClick={() => setMakeupStartSlot(makeupStartSlot === slot ? '' : slot)}
                                            >
                                                {slot}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Duration Picker */}
                                <div className={styles.formGroup}>
                                    <label>Class Duration</label>
                                    <div className={styles.durationRow}>
                                        {[30, 60, 90, 120, 150, 180].map(d => (
                                            <button
                                                key={d}
                                                type="button"
                                                className={`${styles.durationChip} ${makeupDuration === d ? styles.durationChipActive : ''}`}
                                                onClick={() => setMakeupDuration(d)}
                                            >
                                                {d < 60 ? `${d}min` : d % 60 === 0 ? `${d / 60}hr` : `${Math.floor(d / 60)}h ${d % 60}m`}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Time Preview */}
                                {timePreview && (
                                    <div className={styles.timePreviewBadge}>
                                        <MdAccessTime /> <strong>Selected:</strong> {timePreview}
                                    </div>
                                )}

                                {/* Available Rooms */}
                                <div className={styles.formGroup}>
                                    <label>
                                        Available Rooms
                                        {preferredType && <span className={styles.roomTypeHint}> — recommended: <em>{preferredType}</em></span>}
                                    </label>
                                    {!makeupDate || !makeupStartSlot ? (
                                        <p className={styles.roomEmptyState}>Select a date and start time to see available rooms.</p>
                                    ) : loadingRooms ? (
                                        <div className={styles.roomLoadingState}><span className={styles.btnSpinner} /> Loading rooms…</div>
                                    ) : availableRooms.length === 0 ? (
                                        <p className={styles.roomEmptyState}>No rooms available for this time slot.</p>
                                    ) : (
                                        <div className={styles.roomGrid}>
                                            {availableRooms.map(r => {
                                                const isRecommended = (r.room_type || '').toLowerCase().includes(preferredType.toLowerCase()) ||
                                                    (r.specific_classification || '').toLowerCase().includes(preferredType.toLowerCase())
                                                const isSelected = makeupRoom === r.room && (makeupRoom === r.room)
                                                return (
                                                    <button
                                                        key={r.id}
                                                        type="button"
                                                        className={[
                                                            styles.roomCard,
                                                            isSelected ? styles.roomCardSelected : '',
                                                            isRecommended && !isSelected ? styles.roomCardRecommended : ''
                                                        ].filter(Boolean).join(' ')}
                                                        onClick={() => setMakeupRoom(isSelected ? '' : `${r.room}, ${r.building}`)}
                                                    >
                                                        <div className={styles.roomCardName}>{r.room}</div>
                                                        <div className={styles.roomCardBuilding}>{r.building}{r.floor_number ? ` · Floor ${r.floor_number}` : ''}</div>
                                                        <div className={styles.roomCardType}>{r.room_type || 'Room'}{r.specific_classification ? ` · ${r.specific_classification}` : ''}</div>
                                                        <div className={styles.roomCardBadges}>
                                                            {r.capacity && <span className={styles.roomEquipBadge}>👥 {r.capacity}</span>}
                                                            {r.has_ac && <span className={styles.roomEquipBadge}>❄️ AC</span>}
                                                            {r.has_projector && <span className={styles.roomEquipBadge}>📽️ Proj</span>}
                                                            {r.has_tv && <span className={styles.roomEquipBadge}>📺 TV</span>}
                                                            {r.has_whiteboard && <span className={styles.roomEquipBadge}>📋 WB</span>}
                                                            {isRecommended && <span className={`${styles.roomEquipBadge} ${styles.roomRecommendedBadge}`}>✓ Recommended</span>}
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                    {makeupRoom && (
                                        <div className={styles.selectedRoomPreview}>
                                            <MdMeetingRoom /> <strong>Selected room:</strong> {makeupRoom}
                                            <button type="button" className={styles.clearRoomBtn} onClick={() => setMakeupRoom('')}><MdClose /></button>
                                        </div>
                                    )}
                                </div>

                                {/* Reason */}
                                <div className={styles.formGroup}>
                                    <label>Reason / Notes</label>
                                    <textarea
                                        className={styles.formTextarea}
                                        value={makeupReason}
                                        onChange={e => setMakeupReason(e.target.value)}
                                        placeholder="Explain why you need a makeup class..."
                                        rows={3}
                                    />
                                </div>
                            </div>
                            <div className={styles.modalFooter}>
                                <button className={styles.cancelBtn} onClick={closeModal}>Cancel</button>
                                <button className={styles.submitBtn} onClick={handleSubmitMakeup} disabled={submittingMakeup || !makeupDate || !makeupStartSlot}>
                                    {submittingMakeup ? <span className={styles.btnSpinner} /> : <MdSend />}
                                    Submit Request
                                </button>
                            </div>
                        </div>
                    </div>
                )
            })()}
        </div>
    )
}
