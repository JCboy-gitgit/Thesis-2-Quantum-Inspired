'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
    MdHistory
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

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

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
    const [makeupRoom, setMakeupRoom] = useState('')
    const [makeupReason, setMakeupReason] = useState('')
    const [submittingMakeup, setSubmittingMakeup] = useState(false)

    // Realtime clock
    const [currentTime, setCurrentTime] = useState(new Date())
    const clockRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        setMounted(true)
        checkAuth()
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
                    reason: absenceReason,
                    schedule_id: schedule.id
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
        if (!requestingMakeup || !user || !schedule) return
        if (!makeupDate || !makeupTime) {
            alert('Please fill in the requested date and time.')
            return
        }
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
                    requested_time: makeupTime,
                    requested_room: makeupRoom || null,
                    reason: makeupReason,
                    schedule_id: schedule.id,
                    original_absence_date: requestingMakeup.absenceDate || null
                })
            })
            const data = await res.json()
            if (data.success) {
                setRequestingMakeup(null)
                setMakeupDate('')
                setMakeupTime('')
                setMakeupRoom('')
                setMakeupReason('')
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

    // Get allocations for selected day
    const getDayAllocations = (day: string) => {
        return allAllocations
            .filter(a => a.schedule_day?.toLowerCase().includes(day.toLowerCase()))
            .sort((a, b) => parseTimeToMinutes(a.schedule_time?.split('-')[0] || '') - parseTimeToMinutes(b.schedule_time?.split('-')[0] || ''))
    }

    const getDayDate = (dayName: string): string => {
        const idx = DAYS.indexOf(dayName)
        if (idx === -1) return ''
        return formatDate(addDays(currentWeekStart, idx))
    }

    const isAbsentOnDate = (allocId: number, date: string) => {
        return myAbsences.some(a => a.allocation_id === allocId && a.absence_date === date)
    }

    const pendingMakeup = myMakeupRequests.filter(m => m.status === 'pending').length

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
                            <MdCalendarToday className={styles.statIcon} />
                            <div>
                                <div className={styles.statValue}>{allAllocations.length}</div>
                                <div className={styles.statLabel}>Total Classes This Week</div>
                            </div>
                        </div>
                        <div className={`${styles.statCard} ${styles.statWarning}`}>
                            <MdEventBusy className={styles.statIcon} />
                            <div>
                                <div className={styles.statValue}>{myAbsences.length}</div>
                                <div className={styles.statLabel}>My Absences This Week</div>
                            </div>
                        </div>
                        <div className={`${styles.statCard} ${styles.statPending}`}>
                            <MdPending className={styles.statIcon} />
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
                                    {/* Day selector */}
                                    <div className={styles.daySelector}>
                                        {DAYS.map(day => {
                                            const dayDate = getDayDate(day)
                                            const isToday = dayDate === formatDate(new Date())
                                            const dayAbsences = myAbsences.filter(a => a.absence_date === dayDate).length
                                            const dayClasses = getDayAllocations(day).length
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
                                        {getDayAllocations(selectedDay).map(alloc => {
                                            const dayDate = getDayDate(selectedDay)
                                            const absent = isAbsentOnDate(alloc.id, dayDate)
                                            const ongoing = !absent && isClassOngoing(alloc.schedule_time || '')
                                            const isMyClass = !alloc.teacher_name || alloc.teacher_name === user?.full_name

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
                                                            <span><MdMeetingRoom /> {alloc.building} – {alloc.room}</span>
                                                            <span><MdGroup /> {alloc.section}</span>
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
                                                                    const absenceRec = myAbsences.find(a => a.allocation_id === alloc.id && a.absence_date === dayDate)
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
                                        {getDayAllocations(selectedDay).length === 0 && (
                                            <div className={styles.emptyDay}>
                                                <MdCalendarToday />
                                                <p>No classes scheduled for {selectedDay}</p>
                                            </div>
                                        )}
                                    </div>
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
                                                                <span>{alloc.course_code} – {alloc.section}</span>
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
                                                                <span>{alloc.course_code} – {alloc.section}</span>
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
                                <p><strong>Section:</strong> {markingAbsence.section}</p>
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
            {requestingMakeup && (
                <div className={styles.modalOverlay} onClick={() => setRequestingMakeup(null)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3><MdEventAvailable /> Request Makeup Class</h3>
                            <button className={styles.modalClose} onClick={() => setRequestingMakeup(null)}><MdClose /></button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.reviewInfo}>
                                <p><strong>Course:</strong> {requestingMakeup.alloc.course_code} – {requestingMakeup.alloc.course_name}</p>
                                <p><strong>Section:</strong> {requestingMakeup.alloc.section}</p>
                                {requestingMakeup.absenceDate && <p><strong>For Absence On:</strong> {requestingMakeup.absenceDate}</p>}
                            </div>
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
                            <div className={styles.formGroup}>
                                <label>Preferred Time * (e.g. 7:30 AM - 9:00 AM)</label>
                                <input
                                    type="text"
                                    className={styles.formInput}
                                    value={makeupTime}
                                    onChange={e => setMakeupTime(e.target.value)}
                                    placeholder="7:30 AM - 9:00 AM"
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Preferred Room (optional)</label>
                                <input
                                    type="text"
                                    className={styles.formInput}
                                    value={makeupRoom}
                                    onChange={e => setMakeupRoom(e.target.value)}
                                    placeholder="e.g. Room 301, Science Building"
                                />
                            </div>
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
                            <button className={styles.cancelBtn} onClick={() => setRequestingMakeup(null)}>Cancel</button>
                            <button className={styles.submitBtn} onClick={handleSubmitMakeup} disabled={submittingMakeup}>
                                {submittingMakeup ? <span className={styles.btnSpinner} /> : <MdSend />}
                                Submit Request
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
