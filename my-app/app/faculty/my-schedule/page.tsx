'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useTheme } from '@/app/context/ThemeContext'
import FacultySidebar from '@/app/components/FacultySidebar'
import FacultyMenuBar from '@/app/components/FacultyMenuBar'
import {
    MdEventNote,
    MdRefresh,
    MdCalendarToday,
    MdAccessTime,
    MdPerson,
    MdMeetingRoom,
    MdCheckCircle,
    MdClose,
    MdEventBusy,
    MdEventAvailable,
    MdPending,
    MdInfo,
    MdChevronLeft,
    MdChevronRight,
    MdMenuBook,
    MdGroup,
    MdFiberManualRecord,
    MdMap,
    MdExpandMore,
    MdSick,
    MdScheduleSend,
    MdContactMail,
    MdSwapHoriz,
    MdHelpOutline,
    MdLock,
    MdTaskAlt,
    MdViewList,
    MdGridView
} from 'react-icons/md'
import '@/app/styles/faculty-global.css'
import styles from './MySchedule.module.css'

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
    capacity?: number
    floor_number?: number
    status?: string
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const GRID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function normalizeSection(section: string): string {
    if (!section) return section
    return section.replace(/_(Lab|Lec)$/i, '').trim()
}

function expandDays(dayStr: string): string[] {
    if (!dayStr) return []
    const compact = dayStr.toUpperCase().replace(/\./g, '').replace(/\s+/g, '')
    const tokenMap: Record<string, string> = {
        MONDAY: 'Monday', MON: 'Monday', M: 'Monday',
        TUESDAY: 'Tuesday', TUE: 'Tuesday', TU: 'Tuesday', T: 'Tuesday',
        WEDNESDAY: 'Wednesday', WED: 'Wednesday', W: 'Wednesday',
        THURSDAY: 'Thursday', THU: 'Thursday', TH: 'Thursday', R: 'Thursday',
        FRIDAY: 'Friday', FRI: 'Friday', F: 'Friday',
        SATURDAY: 'Saturday', SAT: 'Saturday', SA: 'Saturday', S: 'Saturday',
        SUNDAY: 'Sunday', SUN: 'Sunday', SU: 'Sunday', U: 'Sunday'
    }
    const comboMap: Record<string, string[]> = {
        TTH: ['Tuesday', 'Thursday'],
        MWF: ['Monday', 'Wednesday', 'Friday'],
        MW: ['Monday', 'Wednesday'],
        TF: ['Tuesday', 'Friday'],
        MTWTHF: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        MTWTHFS: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    }
    if (compact.includes('/') || compact.includes(',')) {
        return compact.split(/[\/,]+/).map(token => tokenMap[token] || token).filter(Boolean)
    }
    if (comboMap[compact]) return comboMap[compact]
    const orderedTokens = ['THURSDAY', 'THU', 'TH', 'TUESDAY', 'TUE', 'TU', 'MONDAY', 'MON', 'WEDNESDAY', 'WED', 'FRIDAY', 'FRI', 'SATURDAY', 'SAT', 'SUNDAY', 'SUN', 'SA', 'SU', 'M', 'T', 'W', 'R', 'F', 'S', 'U']
    const expanded: string[] = []
    let i = 0
    while (i < compact.length) {
        const token = orderedTokens.find(t => compact.startsWith(t, i))
        if (!token) { i += 1; continue }
        const mapped = tokenMap[token]
        if (mapped) expanded.push(mapped)
        i += token.length
    }
    return expanded.length > 0 ? Array.from(new Set(expanded)) : []
}

function splitTimeRange(timeStr: string): [string, string] {
    if (!timeStr) return ['', '']
    const normalized = timeStr.replace(/[\u2013\u2014]/g, '-').replace(/\s+to\s+/gi, '-')
    const parts = normalized.split('-').map(s => s.trim()).filter(Boolean)
    if (parts.length < 2) return ['', '']
    return [parts[0], parts[1]]
}

function parseTimeToMinutes(t: string): number {
    if (!t) return 0
    const m = t.trim().match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i)
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
    const [startRaw, endRaw] = splitTimeRange(timeStr)
    if (!startRaw || !endRaw) return false
    const start = parseTimeToMinutes(startRaw)
    const end = parseTimeToMinutes(endRaw)
    return nowMin >= start && nowMin < end
}

function isClassDone(timeStr: string, dayName: string, todayDayName: string): boolean {
    const todayIdx = DAYS.indexOf(todayDayName)
    const dayIdx = DAYS.indexOf(dayName)
    if (dayIdx < 0 || todayIdx < 0) return false
    if (dayIdx < todayIdx) return true
    if (dayIdx > todayIdx) return false
    const now = new Date()
    const nowMin = now.getHours() * 60 + now.getMinutes()
    const [, endRaw] = splitTimeRange(timeStr)
    if (!endRaw) return false
    const end = parseTimeToMinutes(endRaw)
    return nowMin >= end
}

function getTodayDayName(): string {
    const day = new Date().getDay()
    return DAYS[day === 0 ? 6 : day - 1]
}

const FACULTY_TIME_SLOTS = Array.from({ length: 29 }, (_, i) => {
    const hour = Math.floor(i / 2) + 7
    const minute = (i % 2) * 30
    const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
    const ampm = hour >= 12 ? 'PM' : 'AM'
    return `${h12}:${minute.toString().padStart(2, '0')} ${ampm}`
})

// ─── ACTION TYPES ─────────────────────────────────────────────────────────────
type ActionType =
    | 'report-absence'
    | 'schedule-makeup'
    | 'submit-leave'
    | 'request-reschedule'
    | 'room-change-request'
    | 'general-inquiry'

export default function MySchedulePage() {
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
    const [myAbsences, setMyAbsences] = useState<Absence[]>([])
    const [myMakeupRequests, setMyMakeupRequests] = useState<MakeupRequest[]>([])
    const [loading, setLoading] = useState(true)

    // Week navigation
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getMonday(new Date()))

    // View
    type ViewTab = 'my-schedule' | 'my-absences' | 'my-requests'
    const [activeTab, setActiveTab] = useState<ViewTab>('my-schedule')
    const [selectedDay, setSelectedDay] = useState<string>(getTodayDayName())
    const [scheduleViewMode, setScheduleViewMode] = useState<'list' | 'grid'>('list')

    // Actions dropdown (per card)
    const [openActionCardId, setOpenActionCardId] = useState<number | null>(null)

    // Absence marking modal
    const [markingAbsence, setMarkingAbsence] = useState<RoomAllocation | null>(null)
    const [absenceDate, setAbsenceDate] = useState<string>(formatDate(new Date()))
    const [absenceReason, setAbsenceReason] = useState('')
    const [submittingAbsence, setSubmittingAbsence] = useState(false)

    // Makeup request modal
    const [requestingMakeup, setRequestingMakeup] = useState<{ alloc: RoomAllocation; absenceDate?: string } | null>(null)
    const [makeupDate, setMakeupDate] = useState('')
    const [makeupStartSlot, setMakeupStartSlot] = useState('')
    const [makeupDuration, setMakeupDuration] = useState(90)
    const [makeupRoom, setMakeupRoom] = useState('')
    const [makeupReason, setMakeupReason] = useState('')
    const [submittingMakeup, setSubmittingMakeup] = useState(false)
    const [availableRooms, setAvailableRooms] = useState<Room[]>([])
    const [loadingRooms, setLoadingRooms] = useState(false)

    // Leave request modal
    const [requestingLeave, setRequestingLeave] = useState<RoomAllocation | null>(null)
    const [leaveStartDate, setLeaveStartDate] = useState('')
    const [leaveEndDate, setLeaveEndDate] = useState('')
    const [leaveReason, setLeaveReason] = useState('')
    const [submittingLeave, setSubmittingLeave] = useState(false)

    // Floor plan map
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
            .channel(`my_schedule_${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'live_timetable_absences', filter: `faculty_id=eq.${user.id}` }, () => fetchLiveData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'live_makeup_requests', filter: `faculty_id=eq.${user.id}` }, () => fetchLiveData())
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [user])

    // Fetch available rooms for makeup
    useEffect(() => {
        if (requestingMakeup && makeupDate && makeupStartSlot) {
            fetchAvailableRooms(makeupDate, makeupStartSlot, makeupDuration)
        } else {
            setAvailableRooms([])
        }
    }, [makeupDate, makeupStartSlot, makeupDuration, requestingMakeup])

    // Close dropdown on outside click
    useEffect(() => {
        if (openActionCardId !== null) {
            const handler = () => setOpenActionCardId(null)
            const timeout = setTimeout(() => document.addEventListener('click', handler), 0)
            return () => { clearTimeout(timeout); document.removeEventListener('click', handler) }
        }
    }, [openActionCardId])

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

    const fetchAvailableRooms = async (date: string, startSlot: string, duration: number) => {
        if (!date || !startSlot) { setAvailableRooms([]); return }
        setLoadingRooms(true)
        try {
            const { data: rooms } = await (supabase as any)
                .from('rooms')
                .select('id, room, building, room_type, capacity, floor_number, status')
                .neq('status', 'under_maintenance')
                .order('building').order('room')

            const startMin = parseTimeToMinutes(startSlot)
            const endMin = startMin + duration

            const dateParts = date.split('-')
            const dayOfWeek = dateParts.length === 3
                ? new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2])).toLocaleDateString('en-US', { weekday: 'long' })
                : ''

            const occupied = new Set<string>()
            allAllocations.forEach(a => {
                const days = expandDays(a.schedule_day || '')
                if (!days.some(d => d.toLowerCase() === dayOfWeek.toLowerCase())) return
                const [sRaw, eRaw] = splitTimeRange(a.schedule_time || '')
                if (!sRaw || !eRaw) return
                const aStart = parseTimeToMinutes(sRaw)
                const aEnd = parseTimeToMinutes(eRaw)
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

    // ── Get effective allocations (with overrides) ──
    const getEffectiveAllocation = (alloc: RoomAllocation) => {
        const override = overrides.find(o => o.allocation_id === alloc.id)
        if (!override) return alloc
        return {
            ...alloc,
            schedule_day: override.override_day || alloc.schedule_day,
            schedule_time: override.override_time || alloc.schedule_time,
            room: override.override_room || alloc.room,
            building: override.override_building || alloc.building,
        }
    }

    // Get MY classes for a day
    const getMyDayAllocations = (day: string) => {
        return allAllocations
            .map(getEffectiveAllocation)
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
            .sort((a, b) => parseTimeToMinutes(splitTimeRange(a.schedule_time || '')[0]) - parseTimeToMinutes(splitTimeRange(b.schedule_time || '')[0]))
    }

    const getDayDate = (dayName: string): string => {
        const idx = DAYS.indexOf(dayName)
        if (idx === -1) return ''
        return formatDate(addDays(currentWeekStart, idx))
    }

    const isAbsentOnDate = (allocId: number, date: string) => {
        return myAbsences.some(a => a.allocation_id === allocId && a.absence_date === date)
    }

    const myTotalClasses = allAllocations.map(getEffectiveAllocation).filter(a => {
        if (!user) return false
        const name = (a.teacher_name || '').toLowerCase().trim()
        const myName = (user.full_name || '').toLowerCase().trim()
        return name === myName || name.includes(myName) || myName.includes(name)
    }).length

    const pendingMakeup = myMakeupRequests.filter(m => m.status === 'pending').length

    const isCurrentWeek = formatDate(currentWeekStart) === formatDate(getMonday(new Date()))
    const todayDayName = getTodayDayName()

    // ── Action handlers ──
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
        } catch {
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
                alert('Makeup class request submitted. The admin will review it shortly.')
            } else {
                alert(data.error || 'Failed to submit makeup request')
            }
        } catch {
            alert('Failed to submit makeup request')
        } finally {
            setSubmittingMakeup(false)
        }
    }

    const handleSubmitLeave = async () => {
        if (!requestingLeave || !user || !schedule) return
        if (!leaveStartDate || !leaveEndDate) {
            alert('Please select start and end dates for your leave.')
            return
        }
        if (!leaveReason.trim()) {
            alert('Please provide a reason for the leave request.')
            return
        }
        setSubmittingLeave(true)
        try {
            // Mark absence for each day in the leave range that has a class
            const start = new Date(leaveStartDate)
            const end = new Date(leaveEndDate)
            let marked = 0
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dayName = DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1]
                const dayAllocs = getMyDayAllocations(dayName)
                const dateStr = formatDate(d)
                for (const alloc of dayAllocs) {
                    const alreadyAbsent = myAbsences.some(a => a.allocation_id === alloc.id && a.absence_date === dateStr)
                    if (!alreadyAbsent) {
                        await fetch('/api/live-timetable', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                action: 'mark-absence',
                                allocation_id: alloc.id,
                                faculty_id: user.id,
                                absence_date: dateStr,
                                reason: `Leave of Absence: ${leaveReason}`
                            })
                        })
                        marked++
                    }
                }
            }
            setRequestingLeave(null)
            setLeaveStartDate('')
            setLeaveEndDate('')
            setLeaveReason('')
            await fetchLiveData()
            alert(`Leave request submitted. ${marked} class absence(s) have been recorded.`)
        } catch {
            alert('Failed to submit leave request')
        } finally {
            setSubmittingLeave(false)
        }
    }

    const handleAction = (action: ActionType, alloc: RoomAllocation) => {
        setOpenActionCardId(null)
        const dayDate = getDayDate(selectedDay)

        switch (action) {
            case 'report-absence':
                setMarkingAbsence(alloc)
                setAbsenceDate(dayDate || formatDate(new Date()))
                setAbsenceReason('')
                break
            case 'schedule-makeup':
                setRequestingMakeup({ alloc })
                setMakeupDate('')
                setMakeupStartSlot('')
                setMakeupDuration(90)
                setMakeupRoom('')
                setMakeupReason('')
                break
            case 'submit-leave':
                setRequestingLeave(alloc)
                setLeaveStartDate('')
                setLeaveEndDate('')
                setLeaveReason('')
                break
            case 'request-reschedule':
                setRequestingMakeup({ alloc })
                setMakeupDate('')
                setMakeupStartSlot('')
                setMakeupDuration(90)
                setMakeupRoom('')
                setMakeupReason('Reschedule Request: ')
                break
            case 'room-change-request':
                setRequestingMakeup({ alloc })
                setMakeupDate(dayDate || '')
                const [startSlot] = splitTimeRange(alloc.schedule_time || '')
                setMakeupStartSlot(startSlot)
                setMakeupDuration(90)
                setMakeupRoom('')
                setMakeupReason('Room Change Request: ')
                break
            case 'general-inquiry':
                alert('For general administrative inquiries, please contact your department coordinator or the scheduling office directly.')
                break
        }
    }

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
                    {/* Header */}
                    <div className={styles.header}>
                        <div className={styles.headerLeft}>
                            <div className={styles.liveIndicator}>
                                <MdFiberManualRecord className={styles.liveDot} />
                                <span>LIVE</span>
                            </div>
                            <div>
                                <h1 className={styles.title}>
                                    <MdEventNote className={styles.titleIcon} />
                                    My Schedule
                                </h1>
                                <p className={styles.subtitle}>
                                    {schedule ? `${schedule.schedule_name} \u00B7 ${schedule.semester} ${schedule.academic_year}` : 'Loading schedule...'}
                                </p>
                            </div>
                        </div>
                        <div className={styles.headerRight}>
                            {schedule?.is_locked && (
                                <span className={styles.lockedBadge}>
                                    <MdLock /> LOCKED
                                </span>
                            )}
                            <div className={styles.clockDisplay}>
                                <MdAccessTime />
                                <span>{currentTime.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                            </div>
                            <button className={styles.refreshBtn} onClick={fetchLiveData} disabled={loading}>
                                <MdRefresh className={loading ? styles.spinning : ''} />
                            </button>
                        </div>
                    </div>

                    {/* Info Banner */}
                    <div className={styles.infoBanner}>
                        <MdInfo />
                        <span>
                            This is your <strong>personal live schedule</strong>. You can report absences, request makeup sessions, and submit leave requests using the <strong>Actions</strong> menu on each class card.
                        </span>
                    </div>

                    {/* Stats */}
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
                                <div className={styles.statLabel}>Pending Requests</div>
                            </div>
                        </div>
                    </div>

                    {/* Week Navigator */}
                    <div className={styles.weekNav}>
                        <button className={styles.weekNavBtn} onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))}>
                            <MdChevronLeft /> Prev
                        </button>
                        <div className={styles.weekLabel}>
                            <MdCalendarToday />
                            <span>
                                {currentWeekStart.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                                {' \u2013 '}
                                {addDays(currentWeekStart, 6).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            {isCurrentWeek && (
                                <span className={styles.currentWeekBadge}>This Week</span>
                            )}
                        </div>
                        <button className={styles.weekNavBtn} onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}>
                            Next <MdChevronRight />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className={styles.tabs}>
                        {([
                            { key: 'my-schedule' as ViewTab, label: 'My Schedule', icon: <MdEventNote /> },
                            { key: 'my-absences' as ViewTab, label: 'My Absences', icon: <MdEventBusy /> },
                            { key: 'my-requests' as ViewTab, label: 'Makeup Requests', icon: <MdEventAvailable /> },
                        ]).map(tab => (
                            <button
                                key={tab.key}
                                className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
                                onClick={() => setActiveTab(tab.key)}
                            >
                                {tab.icon}
                                <span>{tab.label}</span>
                                {tab.key === 'my-absences' && myAbsences.length > 0 && (
                                    <span className={styles.tabBadge}>{myAbsences.length}</span>
                                )}
                                {tab.key === 'my-requests' && pendingMakeup > 0 && (
                                    <span className={`${styles.tabBadge} ${styles.tabBadgePending}`}>{pendingMakeup}</span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    {loading ? (
                        <div className={styles.loadingState}>
                            <div className={styles.spinner} />
                            <p>Loading your schedule...</p>
                        </div>
                    ) : !schedule ? (
                        <div className={styles.emptyState}>
                            <MdInfo className={styles.emptyIcon} />
                            <h3>No Active Schedule</h3>
                            <p>No schedule has been locked yet. Check back later.</p>
                        </div>
                    ) : (
                        <>
                            {/* ── MY SCHEDULE TAB ── */}
                            {activeTab === 'my-schedule' && (
                                <>
                                    {/* View toggle */}
                                    <div className={styles.viewToggleBar}>
                                        <button
                                            className={`${styles.viewToggleBtn} ${scheduleViewMode === 'list' ? styles.viewToggleBtnActive : ''}`}
                                            onClick={() => setScheduleViewMode('list')}
                                        >
                                            <MdViewList /> List View
                                        </button>
                                        <button
                                            className={`${styles.viewToggleBtn} ${scheduleViewMode === 'grid' ? styles.viewToggleBtnActive : ''}`}
                                            onClick={() => setScheduleViewMode('grid')}
                                        >
                                            <MdGridView /> Timetable Grid
                                        </button>
                                    </div>

                                    {/* ── LIST VIEW ── */}
                                    {scheduleViewMode === 'list' && (
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

                                            {/* Class cards */}
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
                                                    const ongoing = !absent && isCurrentWeek && selectedDay === todayDayName && isClassOngoing(alloc.schedule_time || '')
                                                    const done = !absent && !ongoing && isCurrentWeek && isClassDone(alloc.schedule_time || '', selectedDay, todayDayName)

                                                    return (
                                                        <div
                                                            key={alloc.id}
                                                            className={`${styles.classCard} ${absent ? styles.classCardAbsent : ''} ${ongoing ? styles.classCardOngoing : ''} ${done ? styles.classCardDone : ''}`}
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
                                                                {done && (
                                                                    <span className={styles.doneBadge}>
                                                                        <MdTaskAlt /> DONE
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
                                                                        <MdMeetingRoom /> {alloc.building} &ndash; {alloc.room}
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
                                                                </div>
                                                            </div>

                                                            {/* Actions Dropdown */}
                                                            <div className={styles.cardActions}>
                                                                {!absent && (
                                                                    <button
                                                                        className={styles.markAbsenceBtn}
                                                                        onClick={() => handleAction('report-absence', alloc)}
                                                                    >
                                                                        <MdEventBusy /> Report Absence
                                                                    </button>
                                                                )}
                                                                {absent && (
                                                                    <button
                                                                        className={styles.makeupBtn}
                                                                        onClick={() => {
                                                                            setRequestingMakeup({ alloc, absenceDate: dayDate })
                                                                            setMakeupDate('')
                                                                            setMakeupStartSlot('')
                                                                            setMakeupDuration(90)
                                                                            setMakeupRoom('')
                                                                            setMakeupReason('')
                                                                        }}
                                                                    >
                                                                        <MdEventAvailable /> Request Makeup Class
                                                                    </button>
                                                                )}
                                                                <div className={styles.actionsWrapper}>
                                                                    <button
                                                                        className={styles.actionsDropdownBtn}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            setOpenActionCardId(openActionCardId === alloc.id ? null : alloc.id)
                                                                        }}
                                                                    >
                                                                        <MdExpandMore /> Actions
                                                                    </button>
                                                                    {openActionCardId === alloc.id && (
                                                                        <div className={styles.actionsDropdown} onClick={(e) => e.stopPropagation()}>
                                                                            <div className={styles.dropdownHeader}>Schedule Actions</div>

                                                                            {!absent && (
                                                                                <button className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`} onClick={() => handleAction('report-absence', alloc)}>
                                                                                    <MdSick /> Report Immediate Absence
                                                                                </button>
                                                                            )}

                                                                            <button className={`${styles.dropdownItem} ${styles.dropdownItemSuccess}`} onClick={() => handleAction('schedule-makeup', alloc)}>
                                                                                <MdScheduleSend /> Schedule Makeup Session
                                                                            </button>

                                                                            <button className={`${styles.dropdownItem} ${styles.dropdownItemWarning}`} onClick={() => handleAction('submit-leave', alloc)}>
                                                                                <MdEventBusy /> Submit Leave of Absence
                                                                            </button>

                                                                            <div className={styles.dropdownDivider} />

                                                                            <button className={`${styles.dropdownItem} ${styles.dropdownItemInfo}`} onClick={() => handleAction('request-reschedule', alloc)}>
                                                                                <MdSwapHoriz /> Request Class Reschedule
                                                                            </button>

                                                                            <button className={`${styles.dropdownItem} ${styles.dropdownItemInfo}`} onClick={() => handleAction('room-change-request', alloc)}>
                                                                                <MdMeetingRoom /> Request Room Change
                                                                            </button>

                                                                            <div className={styles.dropdownDivider} />

                                                                            <button className={styles.dropdownItem} onClick={() => handleAction('general-inquiry', alloc)}>
                                                                                <MdContactMail /> Administrative Inquiry
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </>
                                    )}

                                    {/* ── GRID VIEW ── */}
                                    {scheduleViewMode === 'grid' && (
                                        <>
                                            {/* Legend */}
                                            <div className={styles.gridLegend}>
                                                <span className={styles.legendTitle}>Legend:</span>
                                                <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendNormal}`} /> Scheduled</span>
                                                <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendOngoing}`} /> Ongoing</span>
                                                <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendDone}`} /> Done</span>
                                                <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.legendAbsent}`} /> Absent</span>
                                            </div>

                                            {/* Grid table */}
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
                                                                const nowMins = currentTime.getHours() * 60 + currentTime.getMinutes()
                                                                const isNowSlot = isCurrentWeek && nowMins >= slotMinutes && nowMins < slotMinutes + 30
                                                                return (
                                                                    <tr key={slot} className={`${isHour ? styles.gridHourRow : styles.gridHalfRow} ${isNowSlot ? styles.gridNowRow : ''}`}>
                                                                        <td className={`${styles.gridTimeCell} ${isHour ? styles.gridHourMark : styles.gridHalfMark} ${isNowSlot ? styles.gridNowTimeCell : ''}`}>
                                                                            {isHour ? slot : ''}
                                                                            {isNowSlot && (
                                                                                <div className={styles.gridNowIndicatorWrapper}>
                                                                                    <span className={styles.gridNowIndicatorLabel}>NOW</span>
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                        {GRID_DAYS.map(day => {
                                                                            const dayDate = getDayDate(day)
                                                                            const dayAllocs = getMyDayAllocations(day)

                                                                            const startingHere = dayAllocs.filter(a => {
                                                                                const [startRaw, endRaw] = splitTimeRange(a.schedule_time || '')
                                                                                if (!startRaw || !endRaw) return false
                                                                                const startMin = parseTimeToMinutes(startRaw)
                                                                                return startMin >= slotMinutes && startMin < slotMinutes + 30
                                                                            })
                                                                            const coveredByEarlier = dayAllocs.some(a => {
                                                                                const [startRaw, endRaw] = splitTimeRange(a.schedule_time || '')
                                                                                if (!startRaw || !endRaw) return false
                                                                                const startMin = parseTimeToMinutes(startRaw)
                                                                                const endMin = parseTimeToMinutes(endRaw)
                                                                                return startMin < slotMinutes && endMin > slotMinutes
                                                                            })
                                                                            if (coveredByEarlier && startingHere.length === 0) {
                                                                                return (
                                                                                    <td key={`${day}-${slot}`}
                                                                                        className={`${styles.gridDataCell} ${isNowSlot ? styles.gridNowDataCell : ''}`}>
                                                                                        <div className={styles.gridCellContent} />
                                                                                    </td>
                                                                                )
                                                                            }
                                                                            return (
                                                                                <td key={`${day}-${slot}`}
                                                                                    className={`${styles.gridDataCell} ${isNowSlot ? styles.gridNowDataCell : ''}`}>
                                                                                    <div className={styles.gridCellContent}>
                                                                                        {startingHere.map(alloc => {
                                                                                            const [startRaw, endRaw] = splitTimeRange(alloc.schedule_time || '')
                                                                                            const startMin = parseTimeToMinutes(startRaw)
                                                                                            const endMin = parseTimeToMinutes(endRaw)
                                                                                            const durationSlots = Math.max(1, Math.ceil((endMin - startMin) / 30))
                                                                                            const compactHeight = durationSlots * 32 - 2
                                                                                            const absent = isAbsentOnDate(alloc.id, dayDate)
                                                                                            const ongoing = !absent && isCurrentWeek && isClassOngoing(alloc.schedule_time || '') && day === todayDayName
                                                                                            const done = !absent && !ongoing && isCurrentWeek && isClassDone(alloc.schedule_time || '', day, todayDayName)

                                                                                            return (
                                                                                                <div key={alloc.id}
                                                                                                    className={`${styles.gridBlock} ${absent ? styles.gridBlockAbsent : ''} ${ongoing ? styles.gridBlockOngoing : ''} ${done ? styles.gridBlockDone : ''}`}
                                                                                                    style={{ height: `${compactHeight}px` }}
                                                                                                    title={`${alloc.course_code} — ${normalizeSection(alloc.section)} — ${alloc.building} ${alloc.room} — ${alloc.schedule_time}`}>
                                                                                                    <div className={styles.gridBlockHeader}>
                                                                                                        {ongoing && <span className={styles.gridBlockLiveDot}><MdFiberManualRecord /></span>}
                                                                                                        {absent && <span className={styles.gridBlockAbsentIcon}><MdEventBusy /></span>}
                                                                                                        {done && <span className={styles.gridBlockDoneIcon}><MdTaskAlt /></span>}
                                                                                                    </div>
                                                                                                    <span className={styles.gridBlockCode}>{alloc.course_code}</span>
                                                                                                    {durationSlots >= 2 && (
                                                                                                        <>
                                                                                                            <span className={styles.gridBlockSection}>{normalizeSection(alloc.section)}</span>
                                                                                                            <span className={styles.gridBlockRoom}>{alloc.room}</span>
                                                                                                        </>
                                                                                                    )}
                                                                                                    {durationSlots >= 3 && (
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
                                </>
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
                                                                <span>{alloc.course_code} &ndash; {normalizeSection(alloc.section)}</span>
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
                                                                    setMakeupStartSlot('')
                                                                    setMakeupDuration(90)
                                                                    setMakeupRoom('')
                                                                    setMakeupReason('')
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
                                                <p>No absences recorded this week.</p>
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
                                                                <span>{alloc.course_code} &ndash; {normalizeSection(alloc.section)}</span>
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
                                                            {req.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {myMakeupRequests.length === 0 && (
                                            <div className={styles.emptyList}>
                                                <MdCheckCircle className={styles.emptyListIcon} />
                                                <p>No makeup requests submitted yet.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* ═══════ MODALS ═══════ */}

                    {/* Absence Modal */}
                    {markingAbsence && (
                        <div className={styles.modalOverlay} onClick={() => setMarkingAbsence(null)}>
                            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                                <h2 className={styles.modalTitle}>
                                    <MdSick /> Report Absence
                                </h2>
                                <p className={styles.modalSubtitle}>
                                    {markingAbsence.course_code} &ndash; {normalizeSection(markingAbsence.section)}
                                </p>

                                <div className={styles.formGroup}>
                                    <label>Absence Date</label>
                                    <input
                                        type="date"
                                        value={absenceDate}
                                        onChange={(e) => setAbsenceDate(e.target.value)}
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Reason (Optional)</label>
                                    <textarea
                                        value={absenceReason}
                                        onChange={(e) => setAbsenceReason(e.target.value)}
                                        placeholder="e.g., Medical appointment, personal emergency..."
                                    />
                                </div>

                                <div className={styles.modalActions}>
                                    <button className={styles.btnSecondary} onClick={() => setMarkingAbsence(null)}>
                                        Cancel
                                    </button>
                                    <button className={styles.btnDanger} onClick={handleMarkAbsence} disabled={submittingAbsence}>
                                        {submittingAbsence ? 'Submitting...' : 'Confirm Absence'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Makeup Request Modal */}
                    {requestingMakeup && (
                        <div className={styles.modalOverlay} onClick={() => setRequestingMakeup(null)}>
                            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                                <h2 className={styles.modalTitle}>
                                    <MdScheduleSend /> Schedule Makeup Session
                                </h2>
                                <p className={styles.modalSubtitle}>
                                    {requestingMakeup.alloc.course_code} &ndash; {normalizeSection(requestingMakeup.alloc.section)}
                                    {requestingMakeup.absenceDate && ` (absent on ${requestingMakeup.absenceDate})`}
                                </p>

                                <div className={styles.formGroup}>
                                    <label>Requested Date</label>
                                    <input
                                        type="date"
                                        value={makeupDate}
                                        onChange={(e) => setMakeupDate(e.target.value)}
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Start Time</label>
                                    <select value={makeupStartSlot} onChange={(e) => setMakeupStartSlot(e.target.value)}>
                                        <option value="">Select time slot...</option>
                                        {FACULTY_TIME_SLOTS.map(slot => (
                                            <option key={slot} value={slot}>{slot}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Duration (minutes)</label>
                                    <select value={makeupDuration} onChange={(e) => setMakeupDuration(Number(e.target.value))}>
                                        <option value={60}>60 min</option>
                                        <option value={90}>90 min</option>
                                        <option value={120}>120 min</option>
                                        <option value={150}>150 min</option>
                                        <option value={180}>180 min</option>
                                    </select>
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Preferred Room {loadingRooms && '(loading...)'}</label>
                                    {availableRooms.length > 0 ? (
                                        <div className={styles.roomList}>
                                            {availableRooms.map(r => (
                                                <div
                                                    key={r.id}
                                                    className={`${styles.roomItem} ${makeupRoom === r.room ? styles.roomItemSelected : ''}`}
                                                    onClick={() => setMakeupRoom(r.room)}
                                                >
                                                    <span>{r.building} &ndash; {r.room}</span>
                                                    <span className={styles.roomItemInfo}>
                                                        {r.room_type && <span>{r.room_type}</span>}
                                                        {r.capacity && <span>Cap: {r.capacity}</span>}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <input
                                            type="text"
                                            value={makeupRoom}
                                            onChange={(e) => setMakeupRoom(e.target.value)}
                                            placeholder={makeupDate && makeupStartSlot ? 'No available rooms found, type manually' : 'Select date and time first'}
                                        />
                                    )}
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Reason</label>
                                    <textarea
                                        value={makeupReason}
                                        onChange={(e) => setMakeupReason(e.target.value)}
                                        placeholder="Explain the reason for this request..."
                                    />
                                </div>

                                <div className={styles.modalActions}>
                                    <button className={styles.btnSecondary} onClick={() => setRequestingMakeup(null)}>
                                        Cancel
                                    </button>
                                    <button className={styles.btnPrimary} onClick={handleSubmitMakeup} disabled={submittingMakeup}>
                                        {submittingMakeup ? 'Submitting...' : 'Submit Request'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Leave of Absence Modal */}
                    {requestingLeave && (
                        <div className={styles.modalOverlay} onClick={() => setRequestingLeave(null)}>
                            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                                <h2 className={styles.modalTitle}>
                                    <MdEventBusy /> Submit Leave of Absence
                                </h2>
                                <p className={styles.modalSubtitle}>
                                    All classes within the date range will be automatically marked as absent.
                                </p>

                                <div className={styles.formGroup}>
                                    <label>Start Date</label>
                                    <input
                                        type="date"
                                        value={leaveStartDate}
                                        onChange={(e) => setLeaveStartDate(e.target.value)}
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>End Date</label>
                                    <input
                                        type="date"
                                        value={leaveEndDate}
                                        onChange={(e) => setLeaveEndDate(e.target.value)}
                                        min={leaveStartDate}
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Reason</label>
                                    <textarea
                                        value={leaveReason}
                                        onChange={(e) => setLeaveReason(e.target.value)}
                                        placeholder="e.g., Medical leave, family emergency, conference attendance..."
                                    />
                                </div>

                                <div className={styles.modalActions}>
                                    <button className={styles.btnSecondary} onClick={() => setRequestingLeave(null)}>
                                        Cancel
                                    </button>
                                    <button className={styles.btnDanger} onClick={handleSubmitLeave} disabled={submittingLeave}>
                                        {submittingLeave ? 'Submitting...' : 'Submit Leave Request'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    )
}
