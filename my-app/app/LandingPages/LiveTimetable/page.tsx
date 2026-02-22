'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/app/context/ThemeContext'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
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
    MdEdit,
    MdSave,
    MdClose,
    MdFilterList,
    MdSearch,
    MdChevronLeft,
    MdChevronRight,
    MdEventBusy,
    MdEventAvailable,
    MdPending,
    MdDone,
    MdBlock,
    MdRestartAlt,
    MdInfo,
    MdNotifications,
    MdBusiness,
    MdMenuBook,
    MdGroup,
    MdTimeline,
    MdGridView,
    MdViewList,
    MdFiberManualRecord,
    MdDragIndicator,
    MdHistory,
    MdSchedule,
    MdTaskAlt,
    MdMap
} from 'react-icons/md'
import styles from './LiveTimetable.module.css'

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
    teacher_id?: string
    department?: string
    capacity?: number
    lec_hours?: number
    lab_hours?: number
    college?: string
}

interface LiveOverride {
    id: number
    schedule_id: number
    allocation_id: number
    week_start: string
    override_day?: string
    override_time?: string
    override_room?: string
    override_building?: string
    note?: string
}

interface Absence {
    id: number
    allocation_id: number
    faculty_id: string
    absence_date: string
    reason?: string
    status: string
    schedule_id?: number
    faculty_profiles?: { full_name: string; email: string }
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
    faculty_profiles?: { full_name: string; email: string }
}

interface SpecialEvent {
    id: number
    room: string
    building: string
    event_date: string
    time_start?: string
    time_end?: string
    reason?: string
    created_at: string
}

interface Schedule {
    id: number
    schedule_name: string
    semester: string
    academic_year: string
    is_locked: boolean
    is_current: boolean
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const TIME_SLOTS = Array.from({ length: 28 }, (_, i) => {
    const hour = Math.floor(i / 2) + 7
    const minute = (i % 2) * 30
    const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
    const ampm = hour >= 12 ? 'PM' : 'AM'
    return `${h12}:${minute.toString().padStart(2, '0')} ${ampm}`
})

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
    return DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]
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

function normalizeSection(section: string): string {
    if (!section) return section
    // Strip _Lab, _Lec, _G1, _G2 suffixes (case-insensitive)
    return section
        .replace(/_(Lab|Lec)$/i, '')
        .replace(/_G[12](_LAB)?$/i, '')
        .replace(/ G[12]$/i, '')
        .trim()
}

function expandDays(dayStr: string): string[] {
    if (!dayStr) return []
    const day = dayStr.trim().toUpperCase()
    if (day.includes('/')) return day.split('/').map(d => normalizeDay(d.trim()))
    if (day === 'TTH' || day === 'TH' || day === 'T/TH') return ['Tuesday', 'Thursday']
    if (day === 'MWF') return ['Monday', 'Wednesday', 'Friday']
    if (day === 'MW') return ['Monday', 'Wednesday']
    if (day === 'TF') return ['Tuesday', 'Friday']
    if (day === 'MTWTHF') return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    if (day === 'MTWTHFS') return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return [normalizeDay(day)]
}

function isClassDone(timeStr: string, dayName: string, todayDayName: string): boolean {
    const todayIdx = DAYS.indexOf(todayDayName)
    const dayIdx = DAYS.indexOf(dayName)
    if (dayIdx < 0 || todayIdx < 0) return false
    if (dayIdx < todayIdx) return true
    if (dayIdx > todayIdx) return false
    // Same day - check if class has ended
    const now = new Date()
    const nowMin = now.getHours() * 60 + now.getMinutes()
    const parts = timeStr.split('-').map(s => s.trim())
    if (parts.length !== 2) return false
    const end = parseTimeToMinutes(parts[1])
    return nowMin >= end
}

function isClassUpcoming(timeStr: string, dayName: string, todayDayName: string): boolean {
    const todayIdx = DAYS.indexOf(todayDayName)
    const dayIdx = DAYS.indexOf(dayName)
    if (dayIdx < 0 || todayIdx < 0) return false
    if (dayIdx > todayIdx) return true
    if (dayIdx < todayIdx) return false
    // Same day - check if class hasn't started
    const now = new Date()
    const nowMin = now.getHours() * 60 + now.getMinutes()
    const parts = timeStr.split('-').map(s => s.trim())
    if (parts.length !== 2) return false
    const start = parseTimeToMinutes(parts[0])
    return nowMin < start
}

export default function AdminLiveTimetablePage() {
    const router = useRouter()
    const { theme, collegeTheme } = useTheme()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [menuBarHidden, setMenuBarHidden] = useState(false)
    const [mounted, setMounted] = useState(false)

    // Data
    const [schedule, setSchedule] = useState<Schedule | null>(null)
    const [allocations, setAllocations] = useState<RoomAllocation[]>([])
    const [overrides, setOverrides] = useState<LiveOverride[]>([])
    const [absences, setAbsences] = useState<Absence[]>([])
    const [makeupRequests, setMakeupRequests] = useState<MakeupRequest[]>([])
    const [specialEvents, setSpecialEvents] = useState<SpecialEvent[]>([])
    const [loading, setLoading] = useState(true)
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

    // Week navigation
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getMonday(new Date()))

    // View
    type ViewTab = 'timetable' | 'absences' | 'makeup' | 'overrides'
    const [activeTab, setActiveTab] = useState<ViewTab>('timetable')
    const [selectedDay, setSelectedDay] = useState<string>(getTodayDayName())
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [searchQuery, setSearchQuery] = useState('')
    const [filterStatus, setFilterStatus] = useState<string>('all')

    // Grouping
    type GroupByType = 'all' | 'room' | 'faculty' | 'section' | 'college'
    const [groupBy, setGroupBy] = useState<GroupByType>('all')
    const [searchFocused, setSearchFocused] = useState(false)

    // Override editing
    const [editingOverride, setEditingOverride] = useState<{ allocationId: number; day: string; time: string; room: string; building: string; note: string } | null>(null)
    const [savingOverride, setSavingOverride] = useState(false)

    // Group-by pagination (page through rooms/faculty/sections)
    const [groupPage, setGroupPage] = useState(0)
    // Drag-and-drop state
    const [draggedAllocId, setDraggedAllocId] = useState<number | null>(null)
    const [dragOverCell, setDragOverCell] = useState<string | null>(null)
    const [dragConflict, setDragConflict] = useState<boolean>(false)
    // Floor plan map (building name → floor_plan_id for "View on Map" links)
    const [floorPlanMap, setFloorPlanMap] = useState<Record<string, number>>({})

    // Realtime clock
    const [currentTime, setCurrentTime] = useState(new Date())
    const clockRef = useRef<NodeJS.Timeout | null>(null)

    // Makeup review
    const [reviewingMakeup, setReviewingMakeup] = useState<MakeupRequest | null>(null)
    const [adminNote, setAdminNote] = useState('')
    const [reviewingAbsence, setReviewingAbsence] = useState<Absence | null>(null)
    const [creatingMakeup, setCreatingMakeup] = useState<{ allocation: RoomAllocation; date: string; time: string; room: string; reason: string } | null>(null)
    const [creatingEvent, setCreatingEvent] = useState<{ room: string; date: string; reason: string; timeRangeStart?: string; timeRangeEnd?: string } | null>(null)
    const [savingEvent, setSavingEvent] = useState(false)

    useEffect(() => {
        setMounted(true)
        checkAuth()
        fetchFloorPlans()
        clockRef.current = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => { if (clockRef.current) clearInterval(clockRef.current) }
    }, [])

    useEffect(() => {
        if (mounted) fetchLiveData()
    }, [mounted, currentWeekStart])

    // Auto-refresh every 60 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            fetchLiveData()
        }, 60000)
        return () => clearInterval(interval)
    }, [currentWeekStart])

    // Reset group page when groupBy changes
    useEffect(() => { setGroupPage(0) }, [groupBy])

    // Realtime subscription
    useEffect(() => {
        if (!schedule) return

        const channel = supabase
            .channel('live_timetable_admin')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'live_timetable_absences' }, () => fetchLiveData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'live_makeup_requests' }, () => fetchLiveData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'live_timetable_overrides' }, () => fetchLiveData())
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [schedule])

    const checkAuth = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user) { router.push('/'); return }
            if (session.user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
                router.push('/faculty/home'); return
            }
        } catch {
            router.push('/')
        }
    }

    const fetchLiveData = useCallback(async () => {
        setLoading(true)
        try {
            const weekStr = formatDate(currentWeekStart)
            const res = await fetch(`/api/live-timetable?action=current-week&week_start=${weekStr}`)
            const data = await res.json()

            if (data.success) {
                setSchedule(data.schedule)
                setAllocations(data.allocations || [])
                setOverrides(data.overrides || [])
                setAbsences(data.absences || [])
                setMakeupRequests(data.makeupClasses || [])
                setSpecialEvents(data.specialEvents || [])
                setLastRefresh(new Date())
            }
        } catch (err) {
            console.error('Failed to fetch live data:', err)
        } finally {
            setLoading(false)
        }
    }, [currentWeekStart])

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

    const handleResetWeek = async () => {
        if (!schedule) return
        if (!confirm('Reset this week to the original locked schedule? All admin overrides for this week will be removed.')) return

        try {
            const res = await fetch('/api/live-timetable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reset-week', schedule_id: schedule.id, week_start: formatDate(currentWeekStart) })
            })
            if (res.ok) { await fetchLiveData() }
        } catch (err) {
            console.error('Reset failed:', err)
        }
    }

    const handleSaveOverride = async () => {
        if (!editingOverride || !schedule) return
        setSavingOverride(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const res = await fetch('/api/live-timetable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'override',
                    schedule_id: schedule.id,
                    allocation_id: editingOverride.allocationId,
                    week_start: formatDate(currentWeekStart),
                    override_day: editingOverride.day,
                    override_time: editingOverride.time,
                    override_room: editingOverride.room,
                    override_building: editingOverride.building,
                    note: editingOverride.note,
                    admin_id: session?.user?.id
                })
            })
            if (res.ok) {
                await fetchLiveData()
                setEditingOverride(null)
            }
        } catch (err) {
            console.error('Override save failed:', err)
        } finally {
            setSavingOverride(false)
        }
    }

    const handleDeleteOverride = async (id: number) => {
        if (!confirm('Remove this override?')) return
        try {
            await fetch(`/api/live-timetable?type=override&id=${id}`, { method: 'DELETE' })
            await fetchLiveData()
        } catch (err) {
            console.error('Delete override failed:', err)
        }
    }

    const handleDeleteSpecialEvent = async (id: number) => {
        if (!confirm('Are you sure you want to cancel this Special Event? All related room absences will be removed and classes will resume normally.')) return
        try {
            const res = await fetch(`/api/live-timetable?type=special-event&id=${id}`, { method: 'DELETE' })
            if (res.ok) {
                await fetchLiveData()
            } else {
                alert('Failed to cancel special event')
            }
        } catch (err) {
            console.error('Delete special event failed:', err)
        }
    }

    const handleReviewMakeup = async (status: 'approved' | 'rejected') => {
        if (!reviewingMakeup) return
        try {
            await fetch('/api/live-timetable', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'makeup', id: reviewingMakeup.id, status, admin_note: adminNote })
            })
            setReviewingMakeup(null)
            setAdminNote('')
            await fetchLiveData()
        } catch (err) {
            console.error('Review makeup failed:', err)
        }
    }

    const handleCreateEventAbsences = async () => {
        if (!creatingEvent || !creatingEvent.room || !creatingEvent.date) return

        setSavingEvent(true)
        try {
            const [year, month, day] = creatingEvent.date.split('-')
            const selectedDate = new Date(Number(year), Number(month) - 1, Number(day))
            const dayName = DAYS[selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1]

            // Find all allocations for this room on this day
            const targetAllocations = allocations.filter(a => {
                const combinedRoom = `${a.building} – ${a.room}`
                if (combinedRoom !== creatingEvent.room && a.room !== creatingEvent.room) return false
                const days = expandDays(a.schedule_day || '')
                const isSameDay = days.some(d => d.toLowerCase() === dayName.toLowerCase())
                if (!isSameDay) return false

                if (creatingEvent.timeRangeStart && creatingEvent.timeRangeEnd && creatingEvent.timeRangeStart !== 'all' && creatingEvent.timeRangeEnd !== 'all') {
                    const evtStart = parseTimeToMinutes(creatingEvent.timeRangeStart)
                    const evtEnd = parseTimeToMinutes(creatingEvent.timeRangeEnd)
                    const aParts = a.schedule_time?.split('-').map((s: string) => s.trim()) || []
                    if (aParts.length === 2) {
                        const aStart = parseTimeToMinutes(aParts[0])
                        const aEnd = parseTimeToMinutes(aParts[1])
                        if (evtStart > 0 && evtEnd > 0 && aStart > 0 && aEnd > 0) {
                            return evtStart < aEnd && evtEnd > aStart
                        }
                    }
                }
                return true
            })

            if (targetAllocations.length === 0) {
                alert('No classes found in this room on the selected date.')
                setSavingEvent(false)
                return
            }

            // Prepare absences payload
            const reasonBase = creatingEvent.reason || 'Special Event / Room Unavailable'
            const timeRangeStr = creatingEvent.timeRangeStart && creatingEvent.timeRangeEnd && creatingEvent.timeRangeStart !== 'all' && creatingEvent.timeRangeEnd !== 'all' ? `${creatingEvent.timeRangeStart} - ${creatingEvent.timeRangeEnd}` : null
            const finalReason = timeRangeStr ? `${reasonBase} (${timeRangeStr})` : reasonBase

            const newAbsences = targetAllocations.map(a => ({
                allocation_id: a.id,
                faculty_id: a.teacher_id || null,
                absence_date: creatingEvent.date,
                reason: finalReason,
                schedule_id: a.schedule_id,
                status: 'confirmed'
            }))

            if (newAbsences.length === 0) {
                alert('No valid classes found to generate absences for.')
                setSavingEvent(false)
                return
            }

            const res = await fetch('/api/live-timetable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create-event-absences',
                    absences: newAbsences,
                    eventDetails: {
                        room: creatingEvent.room.split(' – ')[1] || creatingEvent.room,
                        building: creatingEvent.room.split(' – ')[0] || '',
                        event_date: creatingEvent.date,
                        time_start: creatingEvent.timeRangeStart !== 'all' ? creatingEvent.timeRangeStart : null,
                        time_end: creatingEvent.timeRangeEnd !== 'all' ? creatingEvent.timeRangeEnd : null,
                        reason: creatingEvent.reason || 'Special Event'
                    }
                })
            })

            if (res.ok) {
                await fetchLiveData()
                setCreatingEvent(null)
            } else {
                const data = await res.json()
                alert(data.error || 'Failed to create event absences')
            }
        } catch (err) {
            console.error('Failed to create event absences:', err)
        } finally {
            setSavingEvent(false)
        }
    }

    // Check if dragging into a cell causes a conflict (same room or same teacher already occupied)
    const hasDragConflict = (targetDay: string, targetSlotMinutes: number, draggingAllocId: number): boolean => {
        const draggingAlloc = allocations.find(a => a.id === draggingAllocId)
        if (!draggingAlloc) return false
        const parts = draggingAlloc.schedule_time?.split('-').map((s: string) => s.trim()) || []
        const duration = parts.length === 2 ? parseTimeToMinutes(parts[1]) - parseTimeToMinutes(parts[0]) : 60
        const newStart = targetSlotMinutes
        const newEnd = targetSlotMinutes + duration

        return effectiveAllocations.some(a => {
            if (a.id === draggingAllocId) return false
            const aDays = expandDays(a.schedule_day || '')
            if (!aDays.some(d => d.toLowerCase() === targetDay.toLowerCase())) return false
            const aParts = a.schedule_time?.split('-').map((s: string) => s.trim()) || []
            if (aParts.length !== 2) return false
            const aStart = parseTimeToMinutes(aParts[0])
            const aEnd = parseTimeToMinutes(aParts[1])
            // Time overlap check
            const timesOverlap = newStart < aEnd && newEnd > aStart
            if (!timesOverlap) return false
            // Same room OR same teacher conflict
            const sameRoom = a.room === draggingAlloc.room && a.building === draggingAlloc.building
            const sameTeacher = a.teacher_name && draggingAlloc.teacher_name && a.teacher_name === draggingAlloc.teacher_name
            return sameRoom || !!sameTeacher
        })
    }

    // Drag-and-drop handlers
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault() }
    const handleDrop = (e: React.DragEvent, day: string, slotMinutes: number) => {
        e.preventDefault()
        if (draggedAllocId === null) return
        // Don’t allow drop on conflict
        if (hasDragConflict(day, slotMinutes, draggedAllocId)) {
            setDraggedAllocId(null)
            setDragOverCell(null)
            setDragConflict(false)
            return
        }
        const alloc = allocations.find(a => a.id === draggedAllocId)
        if (!alloc) return
        const hour = Math.floor(slotMinutes / 60)
        const min = slotMinutes % 60
        const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
        const ampm = hour >= 12 ? 'PM' : 'AM'
        const startTime = `${h12}:${min.toString().padStart(2, '0')} ${ampm}`
        const parts = alloc.schedule_time?.split('-').map((s: string) => s.trim()) || []
        let duration = 60
        if (parts.length === 2) duration = parseTimeToMinutes(parts[1]) - parseTimeToMinutes(parts[0])
        const endMin = slotMinutes + duration
        const endH = Math.floor(endMin / 60)
        const endM = endMin % 60
        const endH12 = endH > 12 ? endH - 12 : endH === 0 ? 12 : endH
        const endAmpm = endH >= 12 ? 'PM' : 'AM'
        const newTime = `${startTime} - ${endH12}:${endM.toString().padStart(2, '0')} ${endAmpm}`
        const existing = overrides.find(o => o.allocation_id === draggedAllocId)
        setEditingOverride({
            allocationId: draggedAllocId,
            day,
            time: newTime,
            room: existing?.override_room || alloc.room,
            building: existing?.override_building || alloc.building,
            note: existing?.note || ''
        })
        setDraggedAllocId(null)
        setDragOverCell(null)
        setDragConflict(false)
    }

    const handleReviewAbsence = async (status: 'confirmed' | 'disputed') => {
        if (!reviewingAbsence) return
        try {
            await fetch('/api/live-timetable', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'absence', id: reviewingAbsence.id, status, admin_note: adminNote })
            })
            setReviewingAbsence(null)
            setAdminNote('')
            await fetchLiveData()
        } catch (err) {
            console.error('Review absence failed:', err)
        }
    }

    const handleAdminMarkAbsent = async (alloc: RoomAllocation, date: string) => {
        if (!alloc.teacher_id) {
            alert('Cannot mark absent: No teacher ID associated with this class.')
            return
        }
        if (!confirm(`Mark ${alloc.course_code} as absent on ${date}?`)) return

        try {
            const res = await fetch('/api/live-timetable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create-absence-admin',
                    allocation_id: alloc.id,
                    faculty_id: alloc.teacher_id,
                    absence_date: date,
                    reason: 'Marked by Administrator'
                })
            })
            if (res.ok) await fetchLiveData()
        } catch (err) {
            console.error('Admin mark absent failed:', err)
        }
    }

    const handleAdminUnmarkAbsent = async (allocId: number, date: string) => {
        const absence = absences.find(a => a.allocation_id === allocId && a.absence_date === date)
        if (!absence) return
        if (!confirm('Remove this absence record?')) return

        try {
            const res = await fetch(`/api/live-timetable?type=absence&id=${absence.id}`, { method: 'DELETE' })
            if (res.ok) await fetchLiveData()
        } catch (err) {
            console.error('Admin unmark absent failed:', err)
        }
    }

    const handleAdminCreateMakeup = async () => {
        if (!creatingMakeup) return
        const { allocation, date, time, room, reason } = creatingMakeup

        if (!allocation.teacher_id) {
            alert('Cannot create makeup: No teacher ID associated.')
            return
        }

        try {
            const res = await fetch('/api/live-timetable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create-makeup-admin',
                    allocation_id: allocation.id,
                    faculty_id: allocation.teacher_id,
                    requested_date: date,
                    requested_time: time,
                    requested_room: room,
                    reason: reason || 'Scheduled by Admin'
                })
            })
            if (res.ok) {
                await fetchLiveData()
                setCreatingMakeup(null)
            }
        } catch (err) {
            console.error('Admin create makeup failed:', err)
        }
    }

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

    // Check if a class is absent today
    const isAbsent = (allocId: number, date: string) => {
        return absences.some(a => a.allocation_id === allocId && a.absence_date === date && a.status !== 'disputed')
    }

    // Get allocations for a specific day (properly expands multi-day patterns like TTH, MWF)
    const getDayAllocations = (day: string) => {
        return effectiveAllocations
            .filter(a => {
                const days = expandDays(a.schedule_day || '')
                return days.some(d => d.toLowerCase() === day.toLowerCase())
            })
            .sort((a, b) => parseTimeToMinutes(a.schedule_time?.split('-')[0] || '') - parseTimeToMinutes(b.schedule_time?.split('-')[0] || ''))
    }

    // Get the date string for a given day of the current week
    const getDayDate = (dayName: string): string => {
        const idx = DAYS.indexOf(dayName)
        if (idx === -1) return ''
        return formatDate(addDays(currentWeekStart, idx))
    }

    const pendingMakeup = makeupRequests.filter(m => m.status === 'pending').length
    const todayAbsences = absences.filter(a => a.absence_date === formatDate(new Date())).length

    // ── Grouping logic ──
    const effectiveAllocations = useMemo(() => {
        const base = allocations.map(getEffectiveAllocation)
        const makeups = makeupRequests
            .filter(m => m.status === 'approved')
            .map(m => {
                const original = allocations.find(a => a.id === m.allocation_id)
                if (!original) return null

                // Determine day name from requested_date
                const [year, month, day] = m.requested_date.split('-')
                const date = new Date(Number(year), Number(month) - 1, Number(day))
                const dayName = DAYS[date.getDay() === 0 ? 6 : date.getDay() - 1]

                // Create a synthetic allocation object
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
                id: -(100000 + se.id), // negative id so it doesn't collide
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
    }, [allocations, overrides, makeupRequests, specialEvents])

    const getGroupValuesForType = (type: GroupByType): string[] => {
        const set = new Set<string>()
        effectiveAllocations.forEach(a => {
            if (type === 'room') set.add(`${a.building} – ${a.room}`)
            else if (type === 'faculty') set.add(a.teacher_name || 'Unassigned')
            else if (type === 'section') set.add(normalizeSection(a.section) || 'Unknown')
            else if (type === 'college') set.add(a.college || 'N/A')
        })
        return Array.from(set).sort((a, b) => a.localeCompare(b))
    }

    const getGroupValues = (): string[] => {
        return getGroupValuesForType(groupBy)
    }

    // Reset group page when groupBy or groupValues change
    const groupValues = groupBy !== 'all' ? getGroupValues() : []
    // Paged group: current group name
    const pagedGroupValue = groupBy !== 'all' && groupValues.length > 0
        ? (groupPage < groupValues.length ? groupValues[groupPage] : groupValues[0])
        : 'all'

    const searchSuggestions = useMemo(() => {
        if (!searchQuery) return []
        const q = searchQuery.toLowerCase()
        const rooms = new Set<string>()
        const faculties = new Set<string>()
        const sections = new Set<string>()
        const colleges = new Set<string>()

        effectiveAllocations.forEach(a => {
            rooms.add(`${a.building} – ${a.room}`)
            if (a.teacher_name) faculties.add(a.teacher_name)
            if (a.section) sections.add(normalizeSection(a.section))
            if (a.college) colleges.add(a.college)
        })

        const results: { type: GroupByType, label: string, value: string }[] = []
        Array.from(rooms).sort().forEach(r => { if (r.toLowerCase().includes(q)) results.push({ type: 'room', label: r, value: r }) })
        Array.from(faculties).sort().forEach(f => { if (f.toLowerCase().includes(q)) results.push({ type: 'faculty', label: f, value: f }) })
        Array.from(sections).sort().forEach(s => { if (s.toLowerCase().includes(q)) results.push({ type: 'section', label: s, value: s }) })
        Array.from(colleges).sort().forEach(c => { if (c.toLowerCase().includes(q)) results.push({ type: 'college', label: c, value: c }) })

        return results.slice(0, 15)
    }, [searchQuery, effectiveAllocations])

    const getFilteredAllocations = (): RoomAllocation[] => {
        if (groupBy === 'all') return effectiveAllocations
        const activeGroup = pagedGroupValue === 'all' ? null : pagedGroupValue
        if (!activeGroup) return effectiveAllocations
        return effectiveAllocations.filter(a => {
            if (groupBy === 'room') return `${a.building} – ${a.room}` === activeGroup
            if (groupBy === 'faculty') return (a.teacher_name || 'Unassigned') === activeGroup
            if (groupBy === 'section') return (normalizeSection(a.section) || 'Unknown') === activeGroup
            if (groupBy === 'college') return (a.college || 'N/A') === activeGroup
            return true
        })
    }

    const filteredAllocations = getFilteredAllocations()

    // Unique allocation count (deduplicated by id)
    const uniqueAllocationCount = new Set(allocations.map(a => a.id)).size

    // Get allocations for a specific day from filtered set (properly expands multi-day patterns)
    const getFilteredDayAllocations = (day: string) => {
        return filteredAllocations
            .filter(a => {
                const days = expandDays(a.schedule_day || '')
                return days.some(d => d.toLowerCase() === day.toLowerCase())
            })
            .sort((a, b) => parseTimeToMinutes(a.schedule_time?.split('-')[0] || '') - parseTimeToMinutes(b.schedule_time?.split('-')[0] || ''))
    }

    const todayDayName = getTodayDayName()
    const isCurrentWeek = formatDate(currentWeekStart) === formatDate(getMonday(new Date()))
    const isPastWeek = formatDate(currentWeekStart) < formatDate(getMonday(new Date()))

    if (!mounted) return null

    return (
        <div className={styles.page} data-theme={theme} data-college-theme={collegeTheme}>
            <Sidebar isOpen={sidebarOpen} menuBarHidden={menuBarHidden} />
            <div className={`${styles.mainLayout} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
                <MenuBar
                    onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                    showSidebarToggle={true}
                    onMenuBarToggle={(hidden) => setMenuBarHidden(hidden)}
                    setSidebarOpen={setSidebarOpen}
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
                                    Live Timetable Monitor
                                </h1>
                                <p className={styles.subtitle}>
                                    {schedule ? `${schedule.schedule_name} · ${schedule.semester} ${schedule.academic_year}` : 'No locked schedule found'}
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
                                Refresh
                            </button>
                            {schedule && (
                                <button className={styles.actionBtnPrimary} onClick={() => setCreatingEvent({ room: '', date: '', reason: '' })} title="Mark a room unavailable">
                                    <MdEventBusy />
                                    Special Event (Room Unavailable)
                                </button>
                            )}
                            {schedule && (
                                <button className={styles.resetBtn} onClick={handleResetWeek} title="Reset week to original locked schedule">
                                    <MdRestartAlt />
                                    Reset Week
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ── Stats Row ── */}
                    <div className={styles.statsRow}>
                        <div className={styles.statCard}>
                            <div className={styles.statIconCircle}>
                                <MdGroup className={styles.statIcon} />
                            </div>
                            <div>
                                <div className={styles.statValue}>{uniqueAllocationCount}</div>
                                <div className={styles.statLabel}>Total Classes</div>
                            </div>
                        </div>
                        <div className={`${styles.statCard} ${styles.statWarning}`}>
                            <div className={`${styles.statIconCircle} ${styles.statIconCircleWarning}`}>
                                <MdEventBusy className={styles.statIcon} />
                            </div>
                            <div>
                                <div className={styles.statValue}>{todayAbsences}</div>
                                <div className={styles.statLabel}>Today's Absences</div>
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
                        <div className={`${styles.statCard} ${styles.statOverride}`}>
                            <div className={`${styles.statIconCircle} ${styles.statIconCircleInfo}`}>
                                <MdEdit className={styles.statIcon} />
                            </div>
                            <div>
                                <div className={styles.statValue}>{overrides.length}</div>
                                <div className={styles.statLabel}>Week Overrides</div>
                            </div>
                        </div>
                    </div>

                    {/* ── Week Navigator ── */}
                    <div className={styles.weekNav}>
                        <button className={styles.weekNavBtn} onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))}>
                            <MdChevronLeft /> Prev Week
                        </button>
                        <div className={styles.weekLabel}>
                            <MdCalendarToday />
                            <span>
                                Week of {currentWeekStart.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                                {' '}–{' '}
                                {addDays(currentWeekStart, 6).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </span>
                            {formatDate(currentWeekStart) === formatDate(getMonday(new Date())) && (
                                <span className={styles.currentWeekBadge}>Current Week</span>
                            )}
                        </div>
                        <button className={styles.weekNavBtn} onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}>
                            Next Week <MdChevronRight />
                        </button>
                    </div>

                    {/* ── Tabs ── */}
                    <div className={styles.tabs}>
                        {(['timetable', 'absences', 'makeup', 'overrides'] as ViewTab[]).map(tab => (
                            <button
                                key={tab}
                                className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
                                onClick={() => setActiveTab(tab)}
                            >
                                {tab === 'timetable' && <MdGridView />}
                                {tab === 'absences' && <MdEventBusy />}
                                {tab === 'makeup' && <MdEventAvailable />}
                                {tab === 'overrides' && <MdEdit />}
                                <span className={styles.tabLabel}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
                                {tab === 'absences' && absences.length > 0 && <span className={styles.tabBadge}>{absences.length}</span>}
                                {tab === 'makeup' && pendingMakeup > 0 && <span className={`${styles.tabBadge} ${styles.tabBadgePending}`}>{pendingMakeup}</span>}
                                {tab === 'overrides' && overrides.length > 0 && <span className={`${styles.tabBadge} ${styles.tabBadgeOverride}`}>{overrides.length}</span>}
                            </button>
                        ))}
                    </div>

                    {/* ── Content ── */}
                    {loading ? (
                        <div className={styles.loadingState}>
                            <div className={styles.spinner} />
                            <p>Loading live timetable data...</p>
                        </div>
                    ) : !schedule ? (
                        <div className={styles.emptyState}>
                            <MdInfo className={styles.emptyIcon} />
                            <h3>No Locked Schedule Found</h3>
                            <p>Lock a schedule from the Room Schedule View to enable the Live Timetable.</p>
                        </div>
                    ) : (
                        <>
                            {/* ── TIMETABLE TAB ── */}
                            {activeTab === 'timetable' && (
                                <div className={styles.timetableSection}>
                                    {/* View mode toggle + search */}
                                    <div className={styles.timetableToolbar}>
                                        <div className={styles.viewToggle}>
                                            <button
                                                className={`${styles.viewToggleBtn} ${viewMode === 'grid' ? styles.viewToggleActive : ''}`}
                                                onClick={() => setViewMode('grid')}
                                                title="Grid View"
                                            >
                                                <MdGridView /> Grid
                                            </button>
                                            <button
                                                className={`${styles.viewToggleBtn} ${viewMode === 'list' ? styles.viewToggleActive : ''}`}
                                                onClick={() => setViewMode('list')}
                                                title="List View"
                                            >
                                                <MdViewList /> List
                                            </button>
                                        </div>
                                        <div className={styles.searchBarContainer} style={{ position: 'relative' }}>
                                            <div className={styles.searchBar}>
                                                <MdSearch />
                                                <input
                                                    type="text"
                                                    placeholder="Search room, teacher, section..."
                                                    value={searchQuery}
                                                    onChange={e => setSearchQuery(e.target.value)}
                                                    onFocus={() => setSearchFocused(true)}
                                                    onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                                                    className={styles.searchInput}
                                                />
                                                {searchQuery && <button onClick={() => setSearchQuery('')} className={styles.clearSearch}><MdClose /></button>}
                                            </div>
                                            {searchFocused && searchSuggestions.length > 0 && (
                                                <div className={styles.searchSuggestions} style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--lt-surface)', border: '1px solid var(--lt-border)', borderRadius: '8px', zIndex: 100, marginTop: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '300px', overflowY: 'auto' }}>
                                                    {searchSuggestions.map((s, idx) => (
                                                        <div
                                                            key={idx}
                                                            className={styles.searchSuggestionItem}
                                                            style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--lt-border)' }}
                                                            onClick={() => {
                                                                setGroupBy(s.type as any)
                                                                setViewMode('grid')
                                                                setSearchQuery('')
                                                                const values = getGroupValuesForType(s.type)
                                                                const sIdx = values.indexOf(s.value)
                                                                if (sIdx !== -1) {
                                                                    setGroupPage(sIdx)
                                                                }
                                                                setSearchFocused(false)
                                                            }}
                                                        >
                                                            <span style={{ fontSize: '0.7rem', color: 'var(--lt-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.type}</span>
                                                            <span style={{ fontSize: '0.9rem', color: 'var(--lt-text)', fontWeight: 600 }}>{s.label}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* ── GRID VIEW ── */}
                                    {viewMode === 'grid' && (
                                        <>
                                            {/* Group Selector */}
                                            <div className={styles.groupSelector}>
                                                <span className={styles.groupLabel}><MdFilterList /> Group by:</span>
                                                <select
                                                    className={styles.groupSelect}
                                                    value={groupBy}
                                                    onChange={e => { setGroupBy(e.target.value as any); setGroupPage(0) }}
                                                >
                                                    <option value="all">All Classes</option>
                                                    <option value="room">Room</option>
                                                    <option value="faculty">Faculty</option>
                                                    <option value="section">Section</option>
                                                    <option value="college">College</option>
                                                </select>
                                                {groupBy !== 'all' && groupValues.length > 0 && (
                                                    <div className={styles.groupPaginator}>
                                                        <button
                                                            className={styles.groupPageBtn}
                                                            onClick={() => setGroupPage(p => Math.max(0, p - 1))}
                                                            disabled={groupPage === 0}
                                                            title="Previous"
                                                        >
                                                            <MdChevronLeft />
                                                        </button>
                                                        <span className={styles.groupPageLabel}>
                                                            <strong>{pagedGroupValue}</strong>
                                                            <span className={styles.groupPageCount}>{groupPage + 1} / {groupValues.length}</span>
                                                        </span>
                                                        <button
                                                            className={styles.groupPageBtn}
                                                            onClick={() => setGroupPage(p => Math.min(groupValues.length - 1, p + 1))}
                                                            disabled={groupPage >= groupValues.length - 1}
                                                            title="Next"
                                                        >
                                                            <MdChevronRight />
                                                        </button>
                                                    </div>
                                                )}
                                                <span className={styles.groupCount}>
                                                    {filteredAllocations.length} classes
                                                </span>
                                            </div>

                                            {/* Legend */}
                                            <div className={styles.gridLegend}>
                                                <span className={styles.legendTitle}>Legend:</span>
                                                <span className={styles.legendItem}>
                                                    <span className={`${styles.legendDot} ${styles.legendNormal}`} /> Upcoming
                                                </span>
                                                <span className={styles.legendItem}>
                                                    <span className={`${styles.legendDot} ${styles.legendOngoing}`} /> Ongoing
                                                </span>
                                                <span className={styles.legendItem}>
                                                    <span className={`${styles.legendDot} ${styles.legendDone}`} /> Done
                                                </span>
                                                <span className={styles.legendItem}>
                                                    <span className={`${styles.legendDot} ${styles.legendAbsent}`} /> Absent/Excused
                                                </span>
                                                <span className={styles.legendItem}>
                                                    <span className={`${styles.legendDot} ${styles.legendOverride}`} /> Modified
                                                </span>
                                            </div>

                                            {/* Timetable grid — Mon to Sat, full day 7am-8pm */}
                                            <div className={styles.gridWrapper}>
                                                <div className={styles.gridContainer}>
                                                    <table className={styles.gridTable}>
                                                        <thead>
                                                            <tr>
                                                                <th className={styles.gridTimeHeader}>
                                                                    <MdAccessTime /> Time
                                                                </th>
                                                                {DAYS.filter(d => d !== 'Sunday').map(day => {
                                                                    const dayDate = getDayDate(day)
                                                                    const isToday = dayDate === formatDate(new Date())
                                                                    const dayAbsences = absences.filter(a => a.absence_date === dayDate).length
                                                                    return (
                                                                        <th key={day} className={`${styles.gridDayHeader} ${isToday ? styles.gridDayToday : ''}`}>
                                                                            <span>{day.slice(0, 3)}</span>
                                                                            <span className={styles.gridDayDate}>
                                                                                {dayDate ? new Date(dayDate + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : ''}
                                                                            </span>
                                                                            {dayAbsences > 0 && <span className={styles.gridDayAbsenceBadge}>{dayAbsences}</span>}
                                                                        </th>
                                                                    )
                                                                })}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {TIME_SLOTS.map((slot, slotIdx) => {
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
                                                                        {DAYS.filter(d => d !== 'Sunday').map(day => {
                                                                            const dayDate = getDayDate(day)
                                                                            const isToday = dayDate === formatDate(new Date())
                                                                            const dayAllocs = getFilteredDayAllocations(day)
                                                                                .filter(a => {
                                                                                    if (!searchQuery) return true
                                                                                    const q = searchQuery.toLowerCase()
                                                                                    return a.course_code?.toLowerCase().includes(q) ||
                                                                                        a.course_name?.toLowerCase().includes(q) ||
                                                                                        a.room?.toLowerCase().includes(q) ||
                                                                                        a.teacher_name?.toLowerCase().includes(q) ||
                                                                                        a.section?.toLowerCase().includes(q)
                                                                                })

                                                                            // Find allocations that START in this slot
                                                                            const startingHere = dayAllocs.filter(a => {
                                                                                const parts = a.schedule_time?.split('-').map((s: string) => s.trim()) || []
                                                                                if (parts.length !== 2) return false
                                                                                const startMin = parseTimeToMinutes(parts[0])
                                                                                return startMin >= slotMinutes && startMin < slotMinutes + 30
                                                                            })

                                                                            // Check if this cell is covered by a block that started earlier
                                                                            const coveredByEarlier = dayAllocs.some(a => {
                                                                                const parts = a.schedule_time?.split('-').map((s: string) => s.trim()) || []
                                                                                if (parts.length !== 2) return false
                                                                                const startMin = parseTimeToMinutes(parts[0])
                                                                                const endMin = parseTimeToMinutes(parts[1])
                                                                                return startMin < slotMinutes && endMin > slotMinutes
                                                                            })

                                                                            if (coveredByEarlier && startingHere.length === 0) {
                                                                                return null
                                                                            }

                                                                            return (
                                                                                <td
                                                                                    key={`${day}-${slot}`}
                                                                                    className={`${styles.gridDataCell} ${isToday ? styles.gridDataCellToday : ''} ${dragOverCell === `${day}-${slotMinutes}` ? (dragConflict ? styles.gridDataCellConflict : styles.gridDataCellDragOver) : ''}`}
                                                                                    onDragOver={handleDragOver}
                                                                                    onDragEnter={() => {
                                                                                        setDragOverCell(`${day}-${slotMinutes}`)
                                                                                        if (draggedAllocId !== null) {
                                                                                            setDragConflict(hasDragConflict(day, slotMinutes, draggedAllocId))
                                                                                        }
                                                                                    }}
                                                                                    onDragLeave={() => { setDragOverCell(null); setDragConflict(false) }}
                                                                                    onDrop={(e) => handleDrop(e, day, slotMinutes)}
                                                                                >
                                                                                    <div className={styles.gridCellContent}>
                                                                                        {startingHere.map(alloc => {
                                                                                            const parts = alloc.schedule_time?.split('-').map((s: string) => s.trim()) || []
                                                                                            const startMin = parseTimeToMinutes(parts[0] || '')
                                                                                            const endMin = parseTimeToMinutes(parts[1] || '')
                                                                                            const durationSlots = Math.max(1, Math.ceil((endMin - startMin) / 30))
                                                                                            const absenceRecord = absences.find(ab => ab.allocation_id === alloc.id && ab.absence_date === dayDate && ab.status !== 'disputed')
                                                                                            const absent = !!absenceRecord
                                                                                            const isEventExcused = !!(absenceRecord && absenceRecord.faculty_id === 'e943b0c1-6f7b-40fd-867d-86df1edce7a2')
                                                                                            const ongoing = !absent && isCurrentWeek && isClassOngoing(alloc.schedule_time || '') && day === todayDayName
                                                                                            const done = !absent && !ongoing && (isPastWeek || (isCurrentWeek && isClassDone(alloc.schedule_time || '', day, todayDayName)))
                                                                                            const hasOverride = (alloc as any)._hasOverride
                                                                                            const isSpecialEvent = (alloc as any)._isSpecialEvent
                                                                                            const overrideNote = (alloc as any)._overrideNote
                                                                                            const compactHeight = durationSlots * 32 - 2

                                                                                            return (
                                                                                                <div
                                                                                                    key={alloc.id}
                                                                                                    draggable={!isSpecialEvent}
                                                                                                    onDragStart={(e) => { if (!isSpecialEvent) { e.dataTransfer.setData('allocId', String(alloc.id)); setDraggedAllocId(alloc.id) } }}
                                                                                                    onDragEnd={() => { if (!isSpecialEvent) { setDraggedAllocId(null); setDragOverCell(null) } }}
                                                                                                    className={`${styles.gridBlock} ${absent ? styles.gridBlockAbsent : ''} ${ongoing ? styles.gridBlockOngoing : ''} ${done ? styles.gridBlockDone : ''} ${hasOverride ? styles.gridBlockOverride : ''} ${(alloc as any)._isMakeup ? styles.gridBlockMakeup : ''} ${isSpecialEvent ? styles.gridBlockAbsent : ''} ${draggedAllocId === alloc.id ? styles.gridBlockDragging : ''}`}
                                                                                                    style={{ height: `${compactHeight}px` }}
                                                                                                    title={`${alloc.course_code} ${isSpecialEvent ? alloc.course_name : '· ' + normalizeSection(alloc.section)}\n${alloc.schedule_time}\n${alloc.building} ${alloc.room}${alloc.teacher_name && !isSpecialEvent ? '\n' + alloc.teacher_name : ''}${absent ? (isEventExcused ? '\n⚠ EXCUSED' : '\n⚠ ABSENT') : ''}${ongoing && !isSpecialEvent ? '\n● ONGOING' : ''}${done && !isSpecialEvent ? '\n✓ DONE' : ''}${hasOverride ? '\n✎ MODIFIED' : ''}${isSpecialEvent ? '\n\n(Click to Cancel)' : ''}`}
                                                                                                    onClick={() => {
                                                                                                        if (isSpecialEvent) {
                                                                                                            handleDeleteSpecialEvent(Math.abs(alloc.id) - 100000)
                                                                                                        } else {
                                                                                                            setEditingOverride({
                                                                                                                allocationId: alloc.id,
                                                                                                                day: day,
                                                                                                                time: alloc.schedule_time,
                                                                                                                room: alloc.room,
                                                                                                                building: alloc.building,
                                                                                                                note: overrideNote || ''
                                                                                                            })
                                                                                                        }
                                                                                                    }}
                                                                                                >
                                                                                                    <div className={styles.gridBlockHeader}>
                                                                                                        {ongoing && !isSpecialEvent && <span className={styles.gridBlockLiveDot}><MdFiberManualRecord /></span>}
                                                                                                        {(absent || isSpecialEvent) && <span className={styles.gridBlockAbsentIcon}><MdEventBusy /></span>}
                                                                                                        {done && !isSpecialEvent && <span className={styles.gridBlockDoneIcon}><MdTaskAlt /></span>}
                                                                                                        {hasOverride && !absent && !done && !isSpecialEvent && <span className={styles.gridBlockOverrideIcon}><MdEdit /></span>}
                                                                                                        {(alloc as any)._isMakeup && <span className={styles.gridBlockMakeupIcon}><MdEventAvailable /></span>}
                                                                                                        {!isSpecialEvent && <span className={styles.gridBlockDragHandle}><MdDragIndicator /></span>}
                                                                                                    </div>
                                                                                                    <span className={styles.gridBlockCode}>{alloc.course_code}</span>
                                                                                                    {durationSlots >= 2 && (
                                                                                                        <>
                                                                                                            <span className={styles.gridBlockSection}>{isSpecialEvent ? alloc.course_name : normalizeSection(alloc.section)}</span>
                                                                                                            <span className={styles.gridBlockRoom}>{alloc.room}</span>
                                                                                                        </>
                                                                                                    )}
                                                                                                    {durationSlots >= 3 && alloc.teacher_name && !isSpecialEvent && (
                                                                                                        <span className={styles.gridBlockTeacher}>{alloc.teacher_name}</span>
                                                                                                    )}
                                                                                                    {durationSlots >= 3 && (
                                                                                                        <span className={styles.gridBlockTime}>{alloc.schedule_time}</span>
                                                                                                    )}
                                                                                                    {!isSpecialEvent && (
                                                                                                        <button
                                                                                                            className={styles.gridBlockEditBtn}
                                                                                                            onClick={(ev) => { ev.stopPropagation(); setEditingOverride({ allocationId: alloc.id, day: day, time: alloc.schedule_time, room: alloc.room, building: alloc.building, note: overrideNote || '' }) }}
                                                                                                            title="Edit Slot"
                                                                                                        >
                                                                                                            <MdEdit />
                                                                                                        </button>
                                                                                                    )}
                                                                                                    {floorPlanMap[alloc.building] && (
                                                                                                        <button
                                                                                                            className={styles.gridBlockMapBtn}
                                                                                                            onClick={(ev) => { ev.stopPropagation(); router.push(`/floor-plan/view/${floorPlanMap[alloc.building]}?room=${encodeURIComponent(alloc.room)}`) }}
                                                                                                            title="View Room on Map"
                                                                                                        >
                                                                                                            <MdMap />
                                                                                                        </button>
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

                                    {/* ── LIST VIEW ── */}
                                    {viewMode === 'list' && (
                                        <>
                                            {/* Day selector */}
                                            <div className={styles.daySelector}>
                                                {DAYS.map(day => {
                                                    const dayDate = getDayDate(day)
                                                    const isToday = dayDate === formatDate(new Date())
                                                    const dayAbsences = absences.filter(a => a.absence_date === dayDate).length
                                                    return (
                                                        <button
                                                            key={day}
                                                            className={`${styles.dayBtn} ${selectedDay === day ? styles.dayBtnActive : ''} ${isToday ? styles.dayBtnToday : ''}`}
                                                            onClick={() => setSelectedDay(day)}
                                                        >
                                                            <span className={styles.dayName}>{day.slice(0, 3)}</span>
                                                            <span className={styles.dayDate}>{dayDate ? new Date(dayDate + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : ''}</span>
                                                            {dayAbsences > 0 && <span className={styles.dayAbsenceBadge}>{dayAbsences}</span>}
                                                        </button>
                                                    )
                                                })}
                                            </div>

                                            {/* Class cards for selected day */}
                                            <div className={styles.classGrid}>
                                                {getDayAllocations(selectedDay)
                                                    .filter(a => {
                                                        if (!searchQuery) return true
                                                        const q = searchQuery.toLowerCase()
                                                        return a.course_code?.toLowerCase().includes(q) ||
                                                            a.course_name?.toLowerCase().includes(q) ||
                                                            a.room?.toLowerCase().includes(q) ||
                                                            a.teacher_name?.toLowerCase().includes(q) ||
                                                            a.section?.toLowerCase().includes(q)
                                                    })
                                                    .map(alloc => {
                                                        const dayDate = getDayDate(selectedDay)
                                                        const absenceRecord = absences.find(ab => ab.allocation_id === alloc.id && ab.absence_date === dayDate && ab.status !== 'disputed')
                                                        const absent = !!absenceRecord
                                                        const isEventExcused = !!(absenceRecord && absenceRecord.faculty_id === 'e943b0c1-6f7b-40fd-867d-86df1edce7a2')
                                                        const ongoing = !absent && isCurrentWeek && selectedDay === todayDayName && isClassOngoing(alloc.schedule_time || '')
                                                        const done = !absent && !ongoing && (isPastWeek || (isCurrentWeek && isClassDone(alloc.schedule_time || '', selectedDay, todayDayName)))
                                                        const hasOverride = (alloc as any)._hasOverride
                                                        const overrideNote = (alloc as any)._overrideNote
                                                        const overrideId = (alloc as any)._overrideId

                                                        return (
                                                            <div
                                                                key={alloc.id}
                                                                className={`${styles.classCard} ${absent ? styles.classCardAbsent : ''} ${ongoing ? styles.classCardOngoing : ''} ${done ? styles.classCardDone : ''} ${hasOverride ? styles.classCardOverride : ''} ${(alloc as any)._isMakeup ? styles.classCardMakeup : ''}`}
                                                            >
                                                                {/* Status badge */}
                                                                <div className={styles.cardStatusRow}>
                                                                    {ongoing && (
                                                                        <span className={styles.ongoingBadge}>
                                                                            <MdFiberManualRecord className={styles.ongoingDot} /> ONGOING
                                                                        </span>
                                                                    )}
                                                                    {done && !absent && (
                                                                        <span className={styles.doneBadge}>
                                                                            <MdTaskAlt /> DONE
                                                                        </span>
                                                                    )}
                                                                    {absent && (
                                                                        <span className={styles.absentBadge}>
                                                                            <MdEventBusy /> {isEventExcused ? 'EXCUSED' : 'ABSENT'}
                                                                        </span>
                                                                    )}
                                                                    {hasOverride && (
                                                                        <span className={styles.overrideBadge}>
                                                                            <MdEdit /> MODIFIED
                                                                        </span>
                                                                    )}
                                                                    {(alloc as any)._isMakeup && (
                                                                        <span className={styles.makeupBadge}>
                                                                            <MdEventAvailable /> MAKEUP
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
                                                                                <button className={styles.mapLinkBtn} onClick={() => router.push(`/floor-plan/view/${floorPlanMap[alloc.building]}?room=${encodeURIComponent(alloc.room)}`)}
                                                                                    title="View Room on Map">
                                                                                    <MdMap /> Map
                                                                                </button>
                                                                            )}
                                                                        </span>
                                                                        <span><MdGroup /> {normalizeSection(alloc.section)}</span>
                                                                        {alloc.teacher_name && <span><MdPerson /> {alloc.teacher_name}</span>}
                                                                    </div>
                                                                    {overrideNote && (
                                                                        <div className={styles.overrideNote}>
                                                                            <MdInfo /> {overrideNote}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Admin actions */}
                                                                <div className={styles.cardActions}>
                                                                    <button
                                                                        className={styles.editOverrideBtn}
                                                                        onClick={() => setEditingOverride({
                                                                            allocationId: alloc.id,
                                                                            day: selectedDay,
                                                                            time: alloc.schedule_time,
                                                                            room: alloc.room,
                                                                            building: alloc.building,
                                                                            note: overrideNote || ''
                                                                        })}
                                                                        title="Edit this slot for the week"
                                                                    >
                                                                        <MdEdit /> Edit Slot
                                                                    </button>
                                                                    {hasOverride && (
                                                                        <button
                                                                            className={styles.removeOverrideBtn}
                                                                            onClick={() => handleDeleteOverride(overrideId)}
                                                                            title="Remove override"
                                                                        >
                                                                            <MdClose /> Remove Override
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                {getDayAllocations(selectedDay).length === 0 && (
                                                    <div className={styles.emptyDay}>
                                                        <MdCalendarToday />
                                                        <p>No classes scheduled for {selectedDay}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* ── ABSENCES TAB ── */}
                            {activeTab === 'absences' && (
                                <div className={styles.listSection}>
                                    <div className={styles.listHeader}>
                                        <h2 className={styles.listTitle}><MdEventBusy /> Reported Absences</h2>
                                        <div className={styles.listFilters}>
                                            <select
                                                className={styles.filterSelect}
                                                value={filterStatus}
                                                onChange={e => setFilterStatus(e.target.value)}
                                            >
                                                <option value="all">All Status</option>
                                                <option value="confirmed">Confirmed</option>
                                                <option value="disputed">Disputed</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className={styles.requestList}>
                                        {absences
                                            .filter(a => filterStatus === 'all' || a.status === filterStatus)
                                            .map(absence => {
                                                const alloc = allocations.find(al => al.id === absence.allocation_id)
                                                return (
                                                    <div key={absence.id} className={styles.requestCard}>
                                                        <div className={styles.requestCardLeft}>
                                                            <div className={styles.requestFaculty}>
                                                                <MdPerson />
                                                                <span>{absence.faculty_id !== 'e943b0c1-6f7b-40fd-867d-86df1edce7a2' && absence.faculty_profiles?.full_name ? absence.faculty_profiles.full_name : (alloc?.teacher_name || 'System / Unassigned')}</span>
                                                                {absence.faculty_profiles?.email && <span className={styles.requestEmail}>{absence.faculty_profiles.email}</span>}
                                                            </div>
                                                            <div className={styles.requestDetails}>
                                                                {alloc && (
                                                                    <>
                                                                        <span><MdMenuBook /> {alloc.course_code} – {normalizeSection(alloc.section)}</span>
                                                                        <span><MdMeetingRoom /> {alloc.building} {alloc.room}</span>
                                                                        <span><MdAccessTime /> {alloc.schedule_time}</span>
                                                                    </>
                                                                )}
                                                                <span><MdCalendarToday /> {absence.absence_date}</span>
                                                                {absence.reason && <span className={styles.requestReason}>Reason: {absence.reason}</span>}
                                                            </div>
                                                        </div>
                                                        <div className={styles.requestCardRight}>
                                                            <span className={`${styles.statusBadge} ${styles[`status_${absence.status}`]}`}>
                                                                {absence.status}
                                                            </span>
                                                            <button
                                                                className={styles.reviewBtn}
                                                                onClick={() => { setReviewingAbsence(absence); setAdminNote('') }}
                                                            >
                                                                Review
                                                            </button>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        {absences.length === 0 && (
                                            <div className={styles.emptyList}>
                                                <MdCheckCircle className={styles.emptyListIcon} />
                                                <p>No absences reported this week</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── MAKEUP TAB ── */}
                            {activeTab === 'makeup' && (
                                <div className={styles.listSection}>
                                    <div className={styles.listHeader}>
                                        <h2 className={styles.listTitle}><MdEventAvailable /> Makeup Class Requests</h2>
                                        <div className={styles.listFilters}>
                                            <select
                                                className={styles.filterSelect}
                                                value={filterStatus}
                                                onChange={e => setFilterStatus(e.target.value)}
                                            >
                                                <option value="all">All Status</option>
                                                <option value="pending">Pending</option>
                                                <option value="approved">Approved</option>
                                                <option value="rejected">Rejected</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className={styles.requestList}>
                                        {makeupRequests
                                            .filter(m => filterStatus === 'all' || m.status === filterStatus)
                                            .map(req => {
                                                const alloc = allocations.find(al => al.id === req.allocation_id)
                                                return (
                                                    <div key={req.id} className={`${styles.requestCard} ${req.status === 'pending' ? styles.requestCardPending : ''}`}>
                                                        <div className={styles.requestCardLeft}>
                                                            <div className={styles.requestFaculty}>
                                                                <MdPerson />
                                                                <span>{req.faculty_id !== 'e943b0c1-6f7b-40fd-867d-86df1edce7a2' && req.faculty_profiles?.full_name ? req.faculty_profiles.full_name : (alloc?.teacher_name || 'System / Unassigned')}</span>
                                                                {req.faculty_profiles?.email && <span className={styles.requestEmail}>{req.faculty_profiles.email}</span>}
                                                            </div>
                                                            <div className={styles.requestDetails}>
                                                                {alloc && (
                                                                    <>
                                                                        <span><MdMenuBook /> {alloc.course_code} – {normalizeSection(alloc.section)}</span>
                                                                    </>
                                                                )}
                                                                <span><MdCalendarToday /> Requested: {req.requested_date}</span>
                                                                <span><MdAccessTime /> Time: {req.requested_time}</span>
                                                                {req.requested_room && <span><MdMeetingRoom /> Room: {req.requested_room}</span>}
                                                                {req.original_absence_date && <span className={styles.absenceRef}>For absence on: {req.original_absence_date}</span>}
                                                                {req.reason && <span className={styles.requestReason}>Reason: {req.reason}</span>}
                                                                {req.admin_note && <span className={styles.adminNote}>Admin Note: {req.admin_note}</span>}
                                                            </div>
                                                        </div>
                                                        <div className={styles.requestCardRight}>
                                                            <span className={`${styles.statusBadge} ${styles[`status_${req.status}`]}`}>
                                                                {req.status}
                                                            </span>
                                                            {req.status === 'pending' && (
                                                                <button
                                                                    className={styles.reviewBtn}
                                                                    onClick={() => { setReviewingMakeup(req); setAdminNote('') }}
                                                                >
                                                                    Review
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        {makeupRequests.length === 0 && (
                                            <div className={styles.emptyList}>
                                                <MdEventAvailable className={styles.emptyListIcon} />
                                                <p>No makeup class requests this week</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── OVERRIDES TAB ── */}
                            {activeTab === 'overrides' && (
                                <div className={styles.listSection}>
                                    <div className={styles.listHeader}>
                                        <h2 className={styles.listTitle}><MdEdit /> Weekly Overrides</h2>
                                        <p className={styles.listSubtitle}>These modifications apply only to this week and reset every Sunday.</p>
                                    </div>
                                    <div className={styles.requestList}>
                                        {overrides.map(ov => {
                                            const alloc = allocations.find(al => al.id === ov.allocation_id)
                                            return (
                                                <div key={ov.id} className={styles.requestCard}>
                                                    <div className={styles.requestCardLeft}>
                                                        {alloc && (
                                                            <div className={styles.requestFaculty}>
                                                                <MdMenuBook />
                                                                <span>{alloc.course_code} – {normalizeSection(alloc.section)}</span>
                                                            </div>
                                                        )}
                                                        <div className={styles.requestDetails}>
                                                            {alloc && <span className={styles.originalSlot}>Original: {alloc.schedule_day} · {alloc.schedule_time} · {alloc.building} {alloc.room}</span>}
                                                            {ov.override_day && <span>→ Day: {ov.override_day}</span>}
                                                            {ov.override_time && <span>→ Time: {ov.override_time}</span>}
                                                            {ov.override_room && <span>→ Room: {ov.override_building} {ov.override_room}</span>}
                                                            {ov.note && <span className={styles.requestReason}>Note: {ov.note}</span>}
                                                        </div>
                                                    </div>
                                                    <div className={styles.requestCardRight}>
                                                        <button
                                                            className={styles.editOverrideBtn}
                                                            onClick={() => alloc && setEditingOverride({
                                                                allocationId: alloc.id,
                                                                day: ov.override_day || alloc.schedule_day,
                                                                time: ov.override_time || alloc.schedule_time,
                                                                room: ov.override_room || alloc.room,
                                                                building: ov.override_building || alloc.building,
                                                                note: ov.note || ''
                                                            })}
                                                        >
                                                            <MdEdit /> Edit
                                                        </button>
                                                        <button className={styles.removeOverrideBtn} onClick={() => handleDeleteOverride(ov.id)}>
                                                            <MdClose /> Remove
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {overrides.length === 0 && (
                                            <div className={styles.emptyList}>
                                                <MdCheckCircle className={styles.emptyListIcon} />
                                                <p>No overrides this week — showing original locked schedule</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </main>
            </div>

            {/* ── Override Edit Modal ── */}
            {editingOverride && (
                <div className={styles.modalOverlay} onClick={() => setEditingOverride(null)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3><MdEdit /> Edit Slot for This Week</h3>
                            <button className={styles.modalClose} onClick={() => setEditingOverride(null)}><MdClose /></button>
                        </div>
                        <div className={styles.modalBody}>
                            <p className={styles.modalNote}>
                                <MdInfo /> Changes apply only to this week. The schedule resets every Sunday.
                            </p>
                            <div className={styles.formGroup}>
                                <label>Day</label>
                                <select
                                    className={styles.formSelect}
                                    value={editingOverride.day}
                                    onChange={e => setEditingOverride({ ...editingOverride, day: e.target.value })}
                                >
                                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Time (e.g. 7:30 AM - 9:00 AM)</label>
                                <input
                                    className={styles.formInput}
                                    value={editingOverride.time}
                                    onChange={e => setEditingOverride({ ...editingOverride, time: e.target.value })}
                                    placeholder="7:30 AM - 9:00 AM"
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Building</label>
                                <input
                                    className={styles.formInput}
                                    value={editingOverride.building}
                                    onChange={e => setEditingOverride({ ...editingOverride, building: e.target.value })}
                                    placeholder="Building name"
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Room</label>
                                <input
                                    className={styles.formInput}
                                    value={editingOverride.room}
                                    onChange={e => setEditingOverride({ ...editingOverride, room: e.target.value })}
                                    placeholder="Room number/name"
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Note (optional)</label>
                                <textarea
                                    className={styles.formTextarea}
                                    value={editingOverride.note}
                                    onChange={e => setEditingOverride({ ...editingOverride, note: e.target.value })}
                                    placeholder="Reason for this change..."
                                    rows={3}
                                />
                            </div>
                        </div>
                        <div className={styles.modalQuickActions}>
                            <h4>Quick Actions</h4>
                            <div className={styles.quickActionBtns}>
                                {(() => {
                                    const date = getDayDate(editingOverride.day)
                                    const isCurrentlyAbsent = isAbsent(editingOverride.allocationId, date)
                                    const alloc = allocations.find(a => a.id === editingOverride.allocationId)

                                    return (
                                        <>
                                            {isCurrentlyAbsent ? (
                                                <button className={styles.actionBtnSecondary} onClick={() => handleAdminUnmarkAbsent(editingOverride.allocationId, date)}>
                                                    <MdCheckCircle /> Mark as Present
                                                </button>
                                            ) : (
                                                <button className={styles.actionBtnDanger} onClick={() => { if (alloc) handleAdminMarkAbsent(alloc, date) }}>
                                                    <MdEventBusy /> Mark as Absent
                                                </button>
                                            )}
                                            <button className={styles.actionBtnPrimary} onClick={() => { if (alloc) setCreatingMakeup({ allocation: alloc, date: date, time: editingOverride.time, room: editingOverride.room, reason: '' }) }}>
                                                <MdEventAvailable /> Schedule Makeup
                                            </button>
                                        </>
                                    )
                                })()}
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.cancelBtn} onClick={() => setEditingOverride(null)}>Cancel</button>
                            <button className={styles.saveBtn} onClick={handleSaveOverride} disabled={savingOverride}>
                                {savingOverride ? <span className={styles.btnSpinner} /> : <MdSave />}
                                Save Override
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Admin Create Makeup Modal ── */}
            {creatingMakeup && (
                <div className={styles.modalOverlay} onClick={() => setCreatingMakeup(null)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3><MdEventAvailable /> Schedule Makeup Class</h3>
                            <button className={styles.modalClose} onClick={() => setCreatingMakeup(null)}><MdClose /></button>
                        </div>
                        <div className={styles.modalBody}>
                            <p className={styles.modalSubtitle}>Scheduling for {creatingMakeup.allocation.course_code} ({creatingMakeup.allocation.section})</p>

                            <div className={styles.formGrid}>
                                <div className={styles.formGroup}>
                                    <label>Makeup Date</label>
                                    <input
                                        type="date"
                                        className={styles.formInput}
                                        value={creatingMakeup.date}
                                        onChange={e => setCreatingMakeup({ ...creatingMakeup, date: e.target.value })}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Time Range</label>
                                    <input
                                        className={styles.formInput}
                                        value={creatingMakeup.time}
                                        onChange={e => setCreatingMakeup({ ...creatingMakeup, time: e.target.value })}
                                        placeholder="e.g. 10:00 AM - 11:30 AM"
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Room</label>
                                    <input
                                        className={styles.formInput}
                                        value={creatingMakeup.room}
                                        onChange={e => setCreatingMakeup({ ...creatingMakeup, room: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Internal Note / Reason</label>
                                <textarea
                                    className={styles.formTextarea}
                                    rows={2}
                                    value={creatingMakeup.reason}
                                    onChange={e => setCreatingMakeup({ ...creatingMakeup, reason: e.target.value })}
                                    placeholder="e.g. Rescheduled due to holiday"
                                />
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.cancelBtn} onClick={() => setCreatingMakeup(null)}>Cancel</button>
                            <button className={styles.approveBtn} onClick={handleAdminCreateMakeup}>
                                <MdCheckCircle /> Create & Approve
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Special Event / Room Unavailable Modal ─── */}
            {creatingEvent && (
                <div className={styles.modalOverlay} onClick={() => setCreatingEvent(null)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3><MdEventBusy /> Declare Room Unavailable</h3>
                            <button className={styles.modalClose} onClick={() => setCreatingEvent(null)}><MdClose /></button>
                        </div>
                        <div className={styles.modalBody}>
                            <p className={styles.modalSubtitle}>All classes scheduled in the selected room on the given date will be informed/marked absent.</p>

                            <div className={styles.formGrid}>
                                <div className={styles.formGroup}>
                                    <label>Room</label>
                                    <select
                                        className={styles.formInput}
                                        value={creatingEvent.room}
                                        onChange={e => setCreatingEvent({ ...creatingEvent, room: e.target.value })}
                                    >
                                        <option value="">Select a Room</option>
                                        {Array.from(new Set(allocations.map(a => `${a.building} – ${a.room}`).filter(r => r && r !== 'undefined – undefined'))).sort().map(r => (
                                            <option key={r} value={r}>{r}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Date</label>
                                    <input
                                        type="date"
                                        className={styles.formInput}
                                        value={creatingEvent.date}
                                        onChange={e => setCreatingEvent({ ...creatingEvent, date: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Specific Time Range (Optional)</label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <select
                                        className={styles.formInput}
                                        value={creatingEvent.timeRangeStart || 'all'}
                                        onChange={e => setCreatingEvent({ ...creatingEvent, timeRangeStart: e.target.value })}
                                        style={{ flex: 1 }}
                                    >
                                        <option value="all">Start Time</option>
                                        {TIME_SLOTS.map(time => <option key={time} value={time}>{time}</option>)}
                                    </select>
                                    <span style={{ display: 'flex', alignItems: 'center' }}>-</span>
                                    <select
                                        className={styles.formInput}
                                        value={creatingEvent.timeRangeEnd || 'all'}
                                        onChange={e => setCreatingEvent({ ...creatingEvent, timeRangeEnd: e.target.value })}
                                        style={{ flex: 1 }}
                                    >
                                        <option value="all">End Time</option>
                                        {TIME_SLOTS.map(time => <option key={time} value={time}>{time}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Event Name / Reason</label>
                                <textarea
                                    className={styles.formTextarea}
                                    rows={2}
                                    value={creatingEvent.reason}
                                    onChange={e => setCreatingEvent({ ...creatingEvent, reason: e.target.value })}
                                    placeholder="e.g. Special Event, Board Exam, Maintenance..."
                                />
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.cancelBtn} onClick={() => setCreatingEvent(null)}>Cancel</button>
                            <button className={styles.approveBtn} onClick={handleCreateEventAbsences} disabled={savingEvent}>
                                <MdCheckCircle /> {savingEvent ? 'Saving...' : 'Apply Event'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Makeup Review Modal ── */}
            {
                reviewingMakeup && (
                    <div className={styles.modalOverlay} onClick={() => setReviewingMakeup(null)}>
                        <div className={styles.modal} onClick={e => e.stopPropagation()}>
                            <div className={styles.modalHeader}>
                                <h3><MdEventAvailable /> Review Makeup Request</h3>
                                <button className={styles.modalClose} onClick={() => setReviewingMakeup(null)}><MdClose /></button>
                            </div>
                            <div className={styles.modalBody}>
                                {(() => {
                                    const makeupAlloc = allocations.find(al => al.id === reviewingMakeup.allocation_id)
                                    return (
                                        <div className={styles.reviewInfo}>
                                            <p><strong>Faculty:</strong> {reviewingMakeup.faculty_id !== 'e943b0c1-6f7b-40fd-867d-86df1edce7a2' && reviewingMakeup.faculty_profiles?.full_name ? reviewingMakeup.faculty_profiles.full_name : (makeupAlloc?.teacher_name || 'System / Unassigned')}</p>
                                            {makeupAlloc && (
                                                <>
                                                    <p><strong>Course:</strong> {makeupAlloc.course_code} – {makeupAlloc.course_name}</p>
                                                    <p><strong>Section:</strong> {normalizeSection(makeupAlloc.section)}</p>
                                                    <p><strong>Original Schedule:</strong> {makeupAlloc.schedule_day} · {makeupAlloc.schedule_time}</p>
                                                </>
                                            )}
                                            {reviewingMakeup.original_absence_date && <p><strong>For Absence On:</strong> {reviewingMakeup.original_absence_date}</p>}
                                            <p><strong>Requested Date:</strong> {reviewingMakeup.requested_date}</p>
                                            <p><strong>Requested Time:</strong> {reviewingMakeup.requested_time}</p>
                                            {reviewingMakeup.requested_room && <p><strong>Requested Room:</strong> {reviewingMakeup.requested_room}</p>}
                                            {reviewingMakeup.reason && <p><strong>Reason:</strong> {reviewingMakeup.reason}</p>}
                                        </div>
                                    )
                                })()}
                                <div className={styles.formGroup}>
                                    <label>Admin Note (optional)</label>
                                    <textarea
                                        className={styles.formTextarea}
                                        value={adminNote}
                                        onChange={e => setAdminNote(e.target.value)}
                                        placeholder="Add a note for the faculty..."
                                        rows={3}
                                    />
                                </div>
                            </div>
                            <div className={styles.modalFooter}>
                                <button className={styles.cancelBtn} onClick={() => setReviewingMakeup(null)}>Cancel</button>
                                <button className={styles.rejectBtn} onClick={() => handleReviewMakeup('rejected')}>
                                    <MdCancel /> Reject
                                </button>
                                <button className={styles.approveBtn} onClick={() => handleReviewMakeup('approved')}>
                                    <MdCheckCircle /> Approve
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            {/* ── Absence Review Modal ── */}
            {
                reviewingAbsence && (
                    <div className={styles.modalOverlay} onClick={() => setReviewingAbsence(null)}>
                        <div className={styles.modal} onClick={e => e.stopPropagation()}>
                            <div className={styles.modalHeader}>
                                <h3><MdEventBusy /> Review Absence</h3>
                                <button className={styles.modalClose} onClick={() => setReviewingAbsence(null)}><MdClose /></button>
                            </div>
                            <div className={styles.modalBody}>
                                <div className={styles.reviewInfo}>
                                    <p><strong>Faculty:</strong> {reviewingAbsence.faculty_id !== 'e943b0c1-6f7b-40fd-867d-86df1edce7a2' && reviewingAbsence.faculty_profiles?.full_name ? reviewingAbsence.faculty_profiles.full_name : (allocations.find(al => al.id === reviewingAbsence.allocation_id)?.teacher_name || 'System / Unassigned')}</p>
                                    <p><strong>Date:</strong> {reviewingAbsence.absence_date}</p>
                                    {reviewingAbsence.reason && <p><strong>Reason:</strong> {reviewingAbsence.reason}</p>}
                                    <p><strong>Current Status:</strong> {reviewingAbsence.status}</p>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Admin Note (optional)</label>
                                    <textarea
                                        className={styles.formTextarea}
                                        value={adminNote}
                                        onChange={e => setAdminNote(e.target.value)}
                                        placeholder="Add a note..."
                                        rows={3}
                                    />
                                </div>
                            </div>
                            <div className={styles.modalFooter}>
                                <button className={styles.cancelBtn} onClick={() => setReviewingAbsence(null)}>Cancel</button>
                                <button className={styles.rejectBtn} onClick={() => handleReviewAbsence('disputed')}>
                                    <MdWarning /> Mark Disputed
                                </button>
                                <button className={styles.approveBtn} onClick={() => handleReviewAbsence('confirmed')}>
                                    <MdCheckCircle /> Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                )}
        </div>
    )
}
