'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  MdCalendarToday,
  MdAccessTime,
  MdLocationOn,
  MdMenuBook,
  MdChevronRight,
  MdChevronLeft,
  MdBusiness,
  MdSchool,
  MdTrendingUp,
  MdRefresh,
  MdError,
  MdClose
} from 'react-icons/md'
import styles from './styles.module.css'
import { clearBrowserCaches } from '@/lib/clearCache'
import FacultySidebar from '@/app/components/FacultySidebar'
import FacultyMenuBar from '@/app/components/FacultyMenuBar'
import { useTheme, COLLEGE_THEME_MAP } from '@/app/context/ThemeContext'
import '@/app/styles/faculty-global.css'

interface UserProfile {
  id: string
  email: string
  full_name: string
  department_id?: number
  department?: string
  college?: string
  role: string
  is_active: boolean
  avatar_url?: string
}

interface ScheduleItem {
  id: number
  course_code: string
  course_name: string
  room: string
  building: string
  day: string
  start_time: string
  end_time: string
  section: string
}

// Philippine Holidays 2024-2026
const philippineHolidays: { [key: string]: string } = {
  // 2024
  '2024-01-01': 'New Year\'s Day',
  '2024-02-10': 'Chinese New Year',
  '2024-02-25': 'EDSA People Power Revolution',
  '2024-03-28': 'Maundy Thursday',
  '2024-03-29': 'Good Friday',
  '2024-03-30': 'Black Saturday',
  '2024-04-09': 'Araw ng Kagitingan',
  '2024-04-10': 'Eid\'l Fitr',
  '2024-05-01': 'Labor Day',
  '2024-06-12': 'Independence Day',
  '2024-06-17': 'Eid\'l Adha',
  '2024-08-21': 'Ninoy Aquino Day',
  '2024-08-26': 'National Heroes Day',
  '2024-11-01': 'All Saints\' Day',
  '2024-11-02': 'All Souls\' Day',
  '2024-11-30': 'Bonifacio Day',
  '2024-12-08': 'Feast of Immaculate Conception',
  '2024-12-24': 'Christmas Eve',
  '2024-12-25': 'Christmas Day',
  '2024-12-30': 'Rizal Day',
  '2024-12-31': 'New Year\'s Eve',
  // 2025
  '2025-01-01': 'New Year\'s Day',
  '2025-01-29': 'Chinese New Year',
  '2025-02-25': 'EDSA People Power Revolution',
  '2025-03-31': 'Eid\'l Fitr (Tentative)',
  '2025-04-09': 'Araw ng Kagitingan',
  '2025-04-17': 'Maundy Thursday',
  '2025-04-18': 'Good Friday',
  '2025-04-19': 'Black Saturday',
  '2025-05-01': 'Labor Day',
  '2025-06-06': 'Eid\'l Adha (Tentative)',
  '2025-06-12': 'Independence Day',
  '2025-08-21': 'Ninoy Aquino Day',
  '2025-08-25': 'National Heroes Day',
  '2025-11-01': 'All Saints\' Day',
  '2025-11-02': 'All Souls\' Day',
  '2025-11-30': 'Bonifacio Day',
  '2025-12-08': 'Feast of Immaculate Conception',
  '2025-12-24': 'Christmas Eve',
  '2025-12-25': 'Christmas Day',
  '2025-12-30': 'Rizal Day',
  '2025-12-31': 'New Year\'s Eve',
  // 2026
  '2026-01-01': 'New Year\'s Day',
  '2026-02-17': 'Chinese New Year',
  '2026-02-25': 'EDSA People Power Revolution',
  '2026-03-20': 'Eid\'l Fitr (Tentative)',
  '2026-04-02': 'Maundy Thursday',
  '2026-04-03': 'Good Friday',
  '2026-04-04': 'Black Saturday',
  '2026-04-09': 'Araw ng Kagitingan',
  '2026-05-01': 'Labor Day',
  '2026-05-27': 'Eid\'l Adha (Tentative)',
  '2026-06-12': 'Independence Day',
  '2026-08-21': 'Ninoy Aquino Day',
  '2026-08-31': 'National Heroes Day',
  '2026-11-01': 'All Saints\' Day',
  '2026-11-02': 'All Souls\' Day',
  '2026-11-30': 'Bonifacio Day',
  '2026-12-08': 'Feast of Immaculate Conception',
  '2026-12-24': 'Christmas Eve',
  '2026-12-25': 'Christmas Day',
  '2026-12-30': 'Rizal Day',
  '2026-12-31': 'New Year\'s Eve',
}

export default function FacultyHomePage() {
  const router = useRouter()
  const [timetableModalOpen, setTimetableModalOpen] = useState(false)
  const [selectedClassForModal, setSelectedClassForModal] = useState<ScheduleItem | null>(null)
  const {
    theme,
    collegeTheme,
    setTheme: setContextTheme, // renamed to avoid conflict
    setCollegeTheme
  } = useTheme()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [currentClass, setCurrentClass] = useState<ScheduleItem | null>(null)
  const [nextClass, setNextClass] = useState<ScheduleItem | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false) // Start closed to prevent layout flash
  const [isMenuBarHidden, setIsMenuBarHidden] = useState(false)
  const [greeting, setGreeting] = useState('')
  const [todayClassCount, setTodayClassCount] = useState(0)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [sessionInvalid, setSessionInvalid] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [themeReady, setThemeReady] = useState(false)
  const [currentScheduleId, setCurrentScheduleId] = useState<number | null>(null)
  const [attendanceOpen, setAttendanceOpen] = useState(false)
  const [attendanceScope, setAttendanceScope] = useState<'class' | 'day' | 'week' | 'range'>('class')
  const [attendanceReason, setAttendanceReason] = useState('')
  const [attendanceDay, setAttendanceDay] = useState('')
  const [attendanceStartDate, setAttendanceStartDate] = useState('')
  const [attendanceEndDate, setAttendanceEndDate] = useState('')
  const [attendanceSubmitting, setAttendanceSubmitting] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date())

  // Notifications State
  const [notifications, setNotifications] = useState<any[]>([])

  // Fetch Notifications (Absences)
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const todayStr = new Date().toISOString().split('T')[0]
        const { data, error } = await supabase
          .from('faculty_absences')
          .select(`
            *,
            room_allocations!inner (
              course_code,
              room,
              schedule_time,
              schedule_day
            ),
            profiles:faculty_id (
              full_name
            )
          `)
          .gte('date', todayStr) // Only future/today absences
          .order('date', { ascending: true })
          .limit(10)

        if (!error && data) {
          setNotifications(data)
        }
      } catch (err) {
        console.error('Error fetching notifications:', err)
      }
    }

    if (user) {
      fetchNotifications()
    }
  }, [user])

  // Filter schedules based on selected date
  const filteredSchedules = schedules.filter(schedule => {
    const selectedDayName = selectedDate.toLocaleDateString('en-US', { weekday: 'long' })
    return schedule.day === selectedDayName
  })

  // Use ThemeContext directly - no more local theme state
  const isLightMode = theme === 'light'
  const isScience = collegeTheme === 'science'
  const isArtsLetters = collegeTheme === 'arts-letters'
  const isArchitecture = collegeTheme === 'architecture'

  // Get theme-aware colors based on college theme
  const getThemeColor = (lightColor: string, darkColor: string) => {
    if (isLightMode) {
      return isScience ? lightColor.replace('blue', 'emerald') : lightColor
    }
    return isScience ? darkColor.replace('cyan', 'emerald').replace('green', 'emerald') : darkColor
  }

  // Helper function to get college-specific color classes
  const getCollegeColorClass = (type: 'bg' | 'text' | 'border' | 'shadow', variant: 'light' | 'normal' | 'dark' = 'normal') => {
    if (isLightMode) {
      // Light mode colors
      if (isScience) {
        if (type === 'bg') return variant === 'light' ? 'bg-emerald-500/10' : variant === 'dark' ? 'bg-emerald-700' : 'bg-emerald-600'
        if (type === 'text') return variant === 'light' ? 'text-emerald-500' : 'text-emerald-600'
        if (type === 'border') return 'border-emerald-500'
        if (type === 'shadow') return 'shadow-[0_4px_20px_rgba(16,185,129,0.3)]'
      } else if (isArtsLetters) {
        if (type === 'bg') return variant === 'light' ? 'bg-orange-500/10' : variant === 'dark' ? 'bg-orange-600' : 'bg-orange-500'
        if (type === 'text') return variant === 'light' ? 'text-orange-500' : 'text-orange-600'
        if (type === 'border') return 'border-orange-500'
        if (type === 'shadow') return 'shadow-[0_4px_20px_rgba(249,115,22,0.3)]'
      } else if (isArchitecture) {
        if (type === 'bg') return variant === 'light' ? 'bg-red-500/10' : variant === 'dark' ? 'bg-red-600' : 'bg-red-500'
        if (type === 'text') return variant === 'light' ? 'text-red-500' : 'text-red-600'
        if (type === 'border') return 'border-red-500'
        if (type === 'shadow') return 'shadow-[0_4px_20px_rgba(239,68,68,0.3)]'
      } else {
        // Default theme
        if (type === 'bg') return variant === 'light' ? 'bg-blue-500/10' : variant === 'dark' ? 'bg-blue-700' : 'bg-blue-600'
        if (type === 'text') return variant === 'light' ? 'text-blue-500' : 'text-blue-600'
        if (type === 'border') return 'border-blue-500'
        if (type === 'shadow') return 'shadow-[0_4px_20px_rgba(59,130,246,0.3)]'
      }
    } else {
      // Dark mode colors
      if (isScience) {
        if (type === 'bg') return variant === 'light' ? 'bg-emerald-500/10' : variant === 'dark' ? 'bg-emerald-600' : 'bg-emerald-500'
        if (type === 'text') return 'text-emerald-500'
        if (type === 'border') return 'border-emerald-500'
        if (type === 'shadow') return 'shadow-[0_4px_20px_rgba(16,185,129,0.3)]'
      } else if (isArtsLetters) {
        if (type === 'bg') return variant === 'light' ? 'bg-orange-500/10' : variant === 'dark' ? 'bg-orange-600' : 'bg-orange-500'
        if (type === 'text') return 'text-orange-400'
        if (type === 'border') return 'border-orange-500'
        if (type === 'shadow') return 'shadow-[0_4px_20px_rgba(251,146,60,0.3)]'
      } else if (isArchitecture) {
        if (type === 'bg') return variant === 'light' ? 'bg-red-500/10' : variant === 'dark' ? 'bg-red-600' : 'bg-red-500'
        if (type === 'text') return 'text-red-400'
        if (type === 'border') return 'border-red-500'
        if (type === 'shadow') return 'shadow-[0_4px_20px_rgba(239,68,68,0.3)]'
      } else {
        // Default theme (cyan)
        if (type === 'bg') return variant === 'light' ? 'bg-cyan-500/10' : variant === 'dark' ? 'bg-cyan-600' : 'bg-cyan-500'
        if (type === 'text') return 'text-cyan-500'
        if (type === 'border') return 'border-cyan-500'
        if (type === 'shadow') return 'shadow-[0_4px_20px_rgba(0,212,255,0.3)]'
      }
    }
    return ''
  }
  // Determine class status based on time
  const getClassStatus = (schedule: ScheduleItem): 'done' | 'ongoing' | 'up-next' | 'future' => {
    const now = new Date()
    const currentTime = now.getHours() * 60 + now.getMinutes()

    const [startHour, startMin] = schedule.start_time.split(':').map(Number)
    const [endHour, endMin] = schedule.end_time.split(':').map(Number)
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin

    if (currentTime > endMinutes) return 'done'
    if (currentTime >= startMinutes && currentTime <= endMinutes) return 'ongoing'
    if (currentTime < startMinutes && currentTime >= startMinutes - 60) return 'up-next'
    return 'future'
  }

  const getStatusBadge = (status: 'done' | 'ongoing' | 'up-next' | 'future') => {
    switch (status) {
      case 'done':
        return (
          <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold uppercase bg-slate-100 text-slate-500`}>
            Done
          </span>
        )
      case 'ongoing':
        return (
          <span className={`flex items-center gap-1.5 text-xs font-bold uppercase ${getCollegeColorClass('text')}`}>
            <span className={`w-2 h-2 rounded-full animate-pulse ${getCollegeColorClass('bg')}`}></span>
            Ongoing
          </span>
        )
      case 'up-next':
        return (
          <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold uppercase ${isLightMode
            ? 'bg-amber-100 text-amber-700'
            : 'bg-amber-900/30 text-amber-400 border border-amber-700/50'}`}>
            Up Next
          </span>
        )
      default:
        return null
    }
  }

  const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL

  useEffect(() => {
    // CRITICAL: Aggressively purge admin styles first
    const adminClasses = ['admin-dashboard', 'admin-page', 'green', 'dark-mode', 'dark', 'admin', 'admin-layout']
    adminClasses.forEach(cls => {
      document.body.classList.remove(cls)
      document.documentElement.classList.remove(cls)
    })

    // Clear admin CSS variables
    const propsToRemove = ['--admin-bg', '--sidebar-width', '--header-height', 'background', 'backgroundColor']
    propsToRemove.forEach(prop => {
      document.documentElement.style.removeProperty(prop)
      document.body.style.removeProperty(prop)
    })

    // Add faculty classes
    document.body.classList.add('faculty-page', 'faculty-loaded')

    setMounted(true)
    // Force a style recalculation
    document.documentElement.style.setProperty('--faculty-loaded', '1')

    // Wait for CSS to be fully applied - use requestAnimationFrame for better timing
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setThemeReady(true)
      })
    })

    return () => {
      document.body.classList.remove('faculty-loaded')
    }
  }, [])

  // Force reflow after everything is ready to ensure styles are applied
  // Also open sidebar after page is fully ready (prevents layout flash on login)
  useEffect(() => {
    if (mounted && !loading && themeReady) {
      // Trigger a reflow to force CSS application
      document.body.offsetHeight

      // Open sidebar after a short delay on DESKTOP only to ensure CSS is fully applied
      // This prevents the broken layout on first login
      // On mobile, keep it closed to avoid covering the content
      const timer = setTimeout(() => {
        const isMobileView = window.innerWidth <= 768
        if (!isMobileView) {
          setSidebarOpen(true)
        }
      }, 100)

      return () => clearTimeout(timer)
    }
  }, [mounted, loading, themeReady])

  useEffect(() => {
    checkAuthAndLoad()
    updateGreeting()

    // Update greeting every minute
    const interval = setInterval(updateGreeting, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (attendanceOpen && !attendanceDay) {
      const today = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()]
      setAttendanceDay(currentClass?.day || today)
    }
  }, [attendanceOpen, attendanceDay, currentClass])

  // Heartbeat to keep user online - runs every 2 minutes
  useEffect(() => {
    if (!user) return

    const sendHeartbeat = async () => {
      try {
        // Always update last_login directly as a simple presence indicator
        const db = supabase as any
        const { error: updateError } = await db
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', user.id)

        // Also try the presence API if session token exists
        if (sessionToken) {
          const response = await fetch('/api/presence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'heartbeat',
              user_id: user.id,
              session_token: sessionToken
            })
          })

          // Check if response is JSON before parsing
          const contentType = response.headers.get('content-type')
          if (!contentType || !contentType.includes('application/json')) {
            console.warn('Presence API returned non-JSON response')
            return
          }

          const data = await response.json()

          // If session is invalid (logged in elsewhere), show warning and redirect
          if (!data.success && data.error === 'SESSION_INVALID') {
            setSessionInvalid(true)
            // Wait a moment then redirect to login
            setTimeout(async () => {
              await clearBrowserCaches()
              await supabase.auth.signOut()
              router.push('/?reason=session_expired')
            }, 3000)
          }
        }
      } catch (error) {
        console.error('Heartbeat error:', error)
        // Silently ignore heartbeat errors - don't disrupt the user experience
      }
    }

    // Send initial heartbeat
    sendHeartbeat()

    // Send heartbeat every 2 minutes
    const heartbeatInterval = setInterval(sendHeartbeat, 2 * 60 * 1000)

    return () => clearInterval(heartbeatInterval)
  }, [user, sessionToken, router])

  // Periodically refresh user data (name, avatar) every 30 seconds to stay in sync with profile changes
  useEffect(() => {
    if (!user) return

    const refreshUserData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return

        // Fetch fresh user data
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()

        // Fetch faculty_profiles for merged data
        const { data: facultyProfile } = await supabase
          .from('faculty_profiles')
          .select('full_name, department, college')
          .eq('user_id', session.user.id)
          .single()

        // Merge data, prioritizing faculty_profiles
        const mergedUser = {
          ...(userData || user),
          full_name: facultyProfile?.full_name || userData?.full_name || user.full_name,
          department: facultyProfile?.department || userData?.department || user.department,
          college: facultyProfile?.college || userData?.college || user.college,
          // Add cache bust to avatar URL if it exists
          avatar_url: userData?.avatar_url ? `${userData.avatar_url}?t=${Date.now()}` : user.avatar_url
        }

        setUser(mergedUser)
      } catch (error) {
        console.error('Failed to refresh user data:', error)
      }
    }

    // Refresh every 30 seconds
    const refreshInterval = setInterval(refreshUserData, 30 * 1000)

    return () => clearInterval(refreshInterval)
  }, [user])

  const updateGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Good Morning!')
    else if (hour < 17) setGreeting('Good Afternoon!')
    else setGreeting('Good Evening!')
  }

  const checkAuthAndLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        router.push('/')
        return
      }

      // Load session token from localStorage
      const storedToken = localStorage.getItem('faculty_session_token')
      if (storedToken) {
        setSessionToken(storedToken)
      }

      // Admin should not access faculty pages
      if (session.user.email === ADMIN_EMAIL) {
        router.push('/LandingPages/Home')
        return
      }

      // Get user profile
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single() as { data: UserProfile | null; error: any }

      if (userError || !userData || !userData.is_active) {
        await clearBrowserCaches()
        await supabase.auth.signOut()
        router.push('/')
        return
      }

      // Also fetch from faculty_profiles for more complete data
      const { data: facultyProfile } = await supabase
        .from('faculty_profiles')
        .select('full_name, department, college')
        .eq('user_id', session.user.id)
        .single()

      // Merge data, prioritizing faculty_profiles
      const mergedUser = {
        ...userData,
        full_name: facultyProfile?.full_name || userData.full_name,
        department: facultyProfile?.department || userData.department,
        college: facultyProfile?.college || userData.college
      }

      setUser(mergedUser)

      // Apply college theme if available
      if (mergedUser.college && COLLEGE_THEME_MAP[mergedUser.college]) {
        setCollegeTheme(COLLEGE_THEME_MAP[mergedUser.college])
      }

      // Fetch schedules using the user's email
      await fetchSchedules(session.user.email || '')

      setLoading(false)
    } catch (error) {
      console.error('Auth check failed:', error)
      router.push('/')
    }
  }

  const fetchSchedules = async (email: string) => {
    try {
      if (!email) {
        setSchedules([])
        return
      }

      const response = await fetch(`/api/faculty-default-schedule?action=faculty-schedule&email=${encodeURIComponent(email)}`, {
        cache: 'no-store'
      })

      if (!response.ok) {
        setSchedules([])
        return
      }

      const result = await response.json()

      if (result?.schedule) {
        setCurrentScheduleId(result.schedule.id || null)
      }

      if (result?.allocations && result.allocations.length > 0) {
        // Convert room_allocations to ScheduleItem format
        // Each allocation has schedule_day (e.g. "Monday", "M/W/F", "TTH")
        // and schedule_time (e.g. "7:00 AM - 8:30 AM")
        const expanded: ScheduleItem[] = []

        result.allocations.forEach((alloc: any) => {
          const days = expandDays(alloc.schedule_day || '')
          const timeParts = (alloc.schedule_time || '').split(/\s*-\s*/)
          const startTime = timeParts[0] ? convertTo24Hour(timeParts[0].trim()) : '00:00'
          const endTime = timeParts[1] ? convertTo24Hour(timeParts[1].trim()) : '00:00'

          days.forEach(day => {
            expanded.push({
              id: alloc.id,
              course_code: alloc.course_code || '',
              course_name: alloc.course_name || '',
              room: alloc.room || '',
              building: alloc.building || '',
              day,
              start_time: startTime,
              end_time: endTime,
              section: alloc.section || ''
            })
          })
        })

        // Sort by start time
        expanded.sort((a, b) => a.start_time.localeCompare(b.start_time))

        setSchedules(expanded)
        findCurrentAndNextClass(expanded)
      } else {
        setSchedules([])
      }
    } catch (error) {
      console.error('Error fetching schedules:', error)
      setSchedules([])
    }
  }

  // Expand compound day strings (e.g. "M/W/F", "TTH") into individual day names
  const expandDays = (dayStr: string): string[] => {
    const day = dayStr.trim().toUpperCase()
    if (day.includes('/')) {
      return day.split('/').map(d => normalizeDay(d.trim()))
    }
    if (day === 'TTH' || day === 'TH') {
      return ['Tuesday', 'Thursday']
    }
    if (day === 'MWF') {
      return ['Monday', 'Wednesday', 'Friday']
    }
    if (day === 'MW') {
      return ['Monday', 'Wednesday']
    }
    return [normalizeDay(day)]
  }

  // Helper to convert 12-hour to 24-hour time
  const convertTo24Hour = (time: string): string => {
    const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
    if (!match) return time.replace(/\s/g, '')

    let [, hourStr, minute, period] = match
    let hour = parseInt(hourStr)

    if (period) {
      if (period.toUpperCase() === 'PM' && hour !== 12) hour += 12
      if (period.toUpperCase() === 'AM' && hour === 12) hour = 0
    }

    return `${hour.toString().padStart(2, '0')}:${minute}`
  }

  // Normalize day names
  const normalizeDay = (day: string): string => {
    const dayMap: { [key: string]: string } = {
      'M': 'Monday', 'MON': 'Monday', 'MONDAY': 'Monday',
      'T': 'Tuesday', 'TUE': 'Tuesday', 'TUESDAY': 'Tuesday',
      'W': 'Wednesday', 'WED': 'Wednesday', 'WEDNESDAY': 'Wednesday',
      'TH': 'Thursday', 'THU': 'Thursday', 'THURSDAY': 'Thursday',
      'F': 'Friday', 'FRI': 'Friday', 'FRIDAY': 'Friday',
      'S': 'Saturday', 'SAT': 'Saturday', 'SATURDAY': 'Saturday',
      'SU': 'Sunday', 'SUN': 'Sunday', 'SUNDAY': 'Sunday'
    }
    return dayMap[day.toUpperCase().trim()] || day
  }

  const findCurrentAndNextClass = (scheduleList: ScheduleItem[]) => {
    const now = new Date()
    const currentDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()]
    const currentTime = now.getHours() * 60 + now.getMinutes()

    const todaySchedules = scheduleList.filter(s => s.day === currentDay)
    setTodayClassCount(todaySchedules.length)

    for (const schedule of todaySchedules) {
      const [startHour, startMin] = schedule.start_time.split(':').map(Number)
      const [endHour, endMin] = schedule.end_time.split(':').map(Number)
      const startMinutes = startHour * 60 + startMin
      const endMinutes = endHour * 60 + endMin

      if (currentTime >= startMinutes && currentTime <= endMinutes) {
        setCurrentClass(schedule)
      } else if (currentTime < startMinutes && !nextClass) {
        setNextClass(schedule)
        break
      }
    }
  }

  const handleMarkAbsent = async () => {
    if (!user || !currentScheduleId) {
      return
    }

    if (attendanceScope === 'class' && !currentClass) {
      return
    }

    setAttendanceSubmitting(true)
    try {
      const payload: any = {
        userId: user.id,
        scheduleId: currentScheduleId,
        scope: attendanceScope,
        reason: attendanceReason
      }

      if (attendanceScope === 'class' && currentClass) {
        payload.courseCode = currentClass.course_code
        payload.section = currentClass.section
        payload.dayOfWeek = currentClass.day
        payload.startTime = currentClass.start_time
        payload.endTime = currentClass.end_time
      }

      if (attendanceScope === 'day') {
        payload.dayOfWeek = attendanceDay || currentClass?.day
      }

      if (attendanceScope === 'week') {
        payload.dayOfWeek = ''
      }

      if (attendanceScope === 'range') {
        payload.startDate = attendanceStartDate
        payload.endDate = attendanceEndDate
      }

      await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      setAttendanceOpen(false)
      setAttendanceReason('')
    } catch (error) {
      console.error('Attendance update failed:', error)
    } finally {
      setAttendanceSubmitting(false)
    }
  }

  const handleLogout = async () => {
    try {
      await clearBrowserCaches()
      await supabase.auth.signOut()
      router.push('/')
    } catch (error) {
      console.error('Logout failed:', error)
      router.push('/')
    }
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  const getCurrentDate = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }



  // Determine loading theme from localStorage (before context is ready)
  const getLoadingTheme = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('faculty-base-theme') === 'light'
    }
    return false
  }

  if (loading || !mounted || !themeReady) {
    const loadingIsLight = getLoadingTheme()
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-5"
        style={{
          background: loadingIsLight
            ? '#ffffff'
            : '#0a0e27',
          color: loadingIsLight ? '#1e293b' : '#ffffff',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999
        }}
      >
        <div
          className="w-12 h-12 rounded-full animate-spin"
          style={{
            border: `4px solid ${loadingIsLight ? 'rgba(16, 185, 129, 0.2)' : 'rgba(0, 212, 255, 0.3)'}`,
            borderTopColor: loadingIsLight ? '#10b981' : '#00d4ff',
          }}
        ></div>
        <p style={{ color: loadingIsLight ? '#64748b' : '#94a3b8' }} className="text-sm">
          Loading your dashboard...
        </p>
      </div>
    )
  }

  return (
    <div
      className={`${styles.pageContainer} faculty-page-wrapper`}
      data-theme={theme}
      data-college-theme={collegeTheme}
      style={{
        backgroundColor: isLightMode ? '#ffffff' : '#0a0e27',
        minHeight: '100vh'
      }}
    >
      {/* Sidebar */}
      <FacultySidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        menuBarHidden={isMenuBarHidden}
      />

      {/* Main Layout */}
      <div
        className={`flex-1 flex flex-col min-h-screen w-full box-border transition-all duration-300 ${sidebarOpen ? 'md:pl-[250px]' : ''}`}
      >
        {/* Faculty Menu Bar */}
        <FacultyMenuBar
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          sidebarOpen={sidebarOpen}
          isHidden={isMenuBarHidden}
          onToggleHidden={setIsMenuBarHidden}
          userEmail={user?.email}
        />

        {/* Main Content */}
        <main className={`flex-1 px-3 sm:px-4 md:px-6 lg:px-8 pb-6 max-w-[1400px] mx-auto w-full box-border overflow-x-hidden transition-all duration-300 ${isMenuBarHidden ? 'pt-10 sm:pt-12' : 'pt-16 sm:pt-20 md:pt-24'}`}>
          {/* Welcome Banner - Clean responsive layout */}
          <section className={`rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 mb-4 sm:mb-5 md:mb-6 border ${isLightMode
            ? 'bg-white/95 border-slate-200 shadow-lg'
            : 'bg-slate-800/80 border-cyan-500/20'
            }`}>
            {/* Mobile: stacked center layout, Desktop: row layout */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* Left: Greeting and date */}
              <div className="text-center sm:text-left">
                <h2 className={`text-xl sm:text-xl md:text-2xl font-bold m-0 mb-1 break-words leading-tight ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
                  {greeting} {user?.full_name || 'Faculty'}
                </h2>
                <p className={`text-sm sm:text-base m-0 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {getCurrentDate()}
                </p>
              </div>

              {/* Right: Time display and department badge */}
              <div className="flex flex-col items-center sm:items-end gap-2 sm:gap-1">
                <div className={`text-3xl sm:text-3xl md:text-4xl font-bold leading-none ${styles.accentText}`}>
                  {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className={`text-xs sm:text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
                {user?.department && (
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold mt-2 sm:mt-1 transition-colors duration-300 ${styles.collegeBadge}`}>
                    <MdBusiness size={12} />
                    <span>{user.department}</span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Quick Stats - Responsive Grid */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-5 md:mb-6">
            <div className={`rounded-xl p-3 sm:p-4 md:p-5 flex items-center gap-3 sm:gap-4 border ${isLightMode
              ? 'bg-white/95 border-slate-200 shadow-md'
              : 'bg-slate-800/80 border-cyan-500/20'
              }`}>
              <div className={`w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-lg sm:rounded-xl flex items-center justify-center text-white flex-shrink-0 ${styles.accentIcon}`}>
                <MdCalendarToday size={20} className="sm:w-5 sm:h-5 md:w-6 md:h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-xl sm:text-2xl md:text-3xl font-bold leading-none mb-1 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>{todayClassCount}</div>
                <div className={`text-xs sm:text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Ongoing Class</div>
              </div>
            </div>
            <div className={`rounded-xl p-3 sm:p-4 md:p-5 flex items-center gap-3 sm:gap-4 border ${isLightMode
              ? 'bg-white/95 border-slate-200 shadow-md'
              : 'bg-slate-800/80 border-cyan-500/20'
              }`}>
              <div className={`w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-lg sm:rounded-xl flex items-center justify-center text-white flex-shrink-0 ${styles.accentIcon}`}>
                <MdMenuBook size={20} className="sm:w-5 sm:h-5 md:w-6 md:h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-xl sm:text-2xl md:text-3xl font-bold leading-none mb-1 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>{todayClassCount > schedules.length ? 0 : schedules.length - todayClassCount}</div>
                <div className={`text-xs sm:text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Classes Left This Week</div>
              </div>
            </div>
            <div className={`rounded-xl p-3 sm:p-4 md:p-5 flex items-center gap-3 sm:gap-4 sm:col-span-2 lg:col-span-1 border ${isLightMode
              ? 'bg-white/95 border-slate-200 shadow-md'
              : 'bg-slate-800/80 border-cyan-500/20'
              }`}>
              <div className={`w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-lg sm:rounded-xl flex items-center justify-center text-white flex-shrink-0 ${styles.accentIcon}`}>
                <MdAccessTime size={20} className="sm:w-5 sm:h-5 md:w-6 md:h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-lg sm:text-xl md:text-2xl font-bold leading-none mb-1 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>{currentClass ? 'In Progress' : 'Free'}</div>
                <div className={`text-xs sm:text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Current Status</div>
              </div>
            </div>
          </section>

          {/* Current & Next Class - Responsive Stack */}
          <section className="mb-4 sm:mb-5 md:mb-6">
            <h3 className={`text-base sm:text-lg font-bold mb-3 sm:mb-4 flex items-center gap-2 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
              <MdMenuBook size={18} className="sm:w-5 sm:h-5" />
              Today's Classes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {/* Current Class Card */}
              <div className={`border-2 rounded-xl p-4 sm:p-5 transition-all duration-300 ${currentClass
                ? `${getCollegeColorClass('border')} ${getCollegeColorClass('shadow')}`
                : isLightMode ? 'border-slate-200' : 'border-cyan-500/20'
                } ${isLightMode ? 'bg-white/95 shadow-md' : 'bg-slate-800/80'}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`text-sm font-bold uppercase tracking-wider ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    Current Class
                  </h3>
                  {currentClass ? (
                    <span className={`flex items-center gap-1.5 text-xs font-bold uppercase ${getCollegeColorClass('text')}`}>
                      <span className={`w-2 h-2 rounded-full animate-pulse ${getCollegeColorClass('bg')}`}></span>
                      Ongoing
                    </span>
                  ) : (
                    <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold uppercase ${isLightMode ? 'bg-slate-100 text-slate-500' : 'bg-slate-700 text-slate-400'
                      }`}>
                      Free
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  {currentClass ? (
                    <>
                      <h4 className={`text-base sm:text-lg font-bold m-0 mb-1 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>{currentClass.course_code}</h4>
                      <p className={`text-sm m-0 mb-3 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>{currentClass.course_name}</p>
                      <div className={`flex flex-col gap-1.5 text-xs sm:text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        <span className={`font-semibold ${getCollegeColorClass('text')}`}>
                          {formatTime(currentClass.start_time)} - {formatTime(currentClass.end_time)}
                        </span>
                        <span className="flex items-center gap-1.5 flex-wrap"><MdLocationOn size={14} className="flex-shrink-0" /> {currentClass.room}, {currentClass.building}</span>
                        <span className="flex items-center gap-1.5"><MdMenuBook size={14} className="flex-shrink-0" /> {currentClass.section}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-4 text-center">
                      <div className={`p-3 rounded-full mb-3 ${isLightMode ? 'bg-slate-100' : 'bg-slate-700/50'}`}>
                        <MdAccessTime size={24} className={isLightMode ? 'text-slate-400' : 'text-slate-500'} />
                      </div>
                      <h4 className={`text-base font-bold m-0 mb-1 ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>No Active Class</h4>
                      <p className={`text-xs m-0 ${isLightMode ? 'text-slate-500' : 'text-slate-500'}`}>You are currently free.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Upcoming Class Card */}
              <div className={`border-2 rounded-xl p-4 sm:p-5 transition-all duration-300 ${nextClass
                ? `${getCollegeColorClass('border', 'light')} ${isLightMode ? 'shadow-sm' : ''}`
                : isLightMode ? 'border-slate-200' : 'border-cyan-500/20'
                } ${isLightMode ? 'bg-white/95 shadow-md' : 'bg-slate-800/80'}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`text-sm font-bold uppercase tracking-wider ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    Upcoming Class
                  </h3>
                  {nextClass && (
                    <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold uppercase ${isLightMode
                      ? isScience
                        ? 'bg-emerald-100 text-emerald-700'
                        : isArtsLetters
                          ? 'bg-orange-100 text-orange-700'
                          : isArchitecture
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                      : `${getCollegeColorClass('bg', 'light')} ${getCollegeColorClass('text')}`
                      }`}>Next Up</span>
                  )}
                </div>

                <div className="mt-3">
                  {nextClass ? (
                    <>
                      <h4 className={`text-base sm:text-lg font-bold m-0 mb-1 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>{nextClass.course_code}</h4>
                      <p className={`text-sm m-0 mb-3 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>{nextClass.course_name}</p>
                      <div className={`flex flex-col gap-1.5 text-xs sm:text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        <span className={`font-semibold ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                          {formatTime(nextClass.start_time)} - {formatTime(nextClass.end_time)}
                        </span>
                        <span className="flex items-center gap-1.5 flex-wrap"><MdLocationOn size={14} className="flex-shrink-0" /> {nextClass.room}, {nextClass.building}</span>
                        <span className="flex items-center gap-1.5"><MdMenuBook size={14} className="flex-shrink-0" /> {nextClass.section}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-4 text-center">
                      <div className={`p-3 rounded-full mb-3 ${isLightMode ? 'bg-slate-100' : 'bg-slate-700/50'}`}>
                        <MdCalendarToday size={24} className={isLightMode ? 'text-slate-400' : 'text-slate-500'} />
                      </div>
                      <h4 className={`text-base font-bold m-0 mb-1 ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>No Upcoming Classes</h4>
                      <p className={`text-xs m-0 ${isLightMode ? 'text-slate-500' : 'text-slate-500'}`}>No more classes scheduled for today.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Notifications / Building Updates */}
          <section className="mb-4 sm:mb-5 md:mb-6">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <h3 className={`text-base sm:text-lg font-bold flex items-center gap-2 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
                <MdError className="sm:w-5 sm:h-5 text-amber-500" />
                Recent Announcements & Room Availability
              </h3>
            </div>

            {notifications.length === 0 ? (
              <div className={`p-4 rounded-xl border text-center ${isLightMode
                ? 'bg-white/95 border-slate-200 text-slate-500'
                : 'bg-slate-800/80 border-cyan-500/20 text-slate-400'}`}>
                <p className="text-sm">No new announcements or cancellations.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {notifications.map((note) => (
                  <div key={note.id} className={`p-4 rounded-xl border-l-4 shadow-sm transition-all hover:shadow-md ${isLightMode
                    ? 'bg-white border-slate-200 border-l-emerald-500'
                    : 'bg-slate-800 border-slate-700 border-l-emerald-500'
                    }`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-emerald-100 text-emerald-700">
                        Room Available
                      </span>
                      <span className={`text-xs ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {new Date(note.date).toLocaleDateString()}
                      </span>
                    </div>

                    <h4 className={`text-sm font-bold mb-1 ${isLightMode ? 'text-slate-800' : 'text-slate-200'}`}>
                      {note.room_allocations.room} is Free
                    </h4>

                    <div className={`text-xs space-y-1 mb-3 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      <div className="flex items-center gap-1.5">
                        <MdAccessTime size={12} />
                        {note.room_allocations.schedule_time}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MdBusiness size={12} />
                        <span>{note.profiles?.full_name} ({note.room_allocations.course_code})</span>
                      </div>
                    </div>

                    <div className={`text-xs italic pt-2 border-t ${isLightMode ? 'border-slate-100 text-slate-500' : 'border-slate-700 text-slate-500'}`}>
                      "{note.reason}"
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Today's Schedule with Day Navigation */}
          <section className="mb-4 sm:mb-5 md:mb-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4 flex-wrap gap-2">
              <h3 className={`text-base sm:text-lg font-bold flex items-center gap-2 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
                <MdCalendarToday size={18} className="sm:w-5 sm:h-5" />
                {(() => {
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  const sel = new Date(selectedDate)
                  sel.setHours(0, 0, 0, 0)
                  const diff = Math.round((sel.getTime() - today.getTime()) / 86400000)
                  if (diff === 0) return "Today's Schedule"
                  if (diff === 1) return "Tomorrow's Schedule"
                  if (diff === -1) return "Yesterday's Schedule"
                  return `${selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}'s Schedule`
                })()}
              </h3>
              <div className="flex items-center gap-2">
                {/* Previous Day */}
                <button className={`w-8 h-8 sm:w-9 sm:h-9 border-none rounded-lg cursor-pointer flex items-center justify-center transition-all ${isLightMode
                  ? isScience
                    ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white'
                    : isArtsLetters
                      ? 'bg-orange-500/10 text-orange-600 hover:bg-orange-500 hover:text-white'
                      : isArchitecture
                        ? 'bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white'
                        : 'bg-blue-500/10 text-blue-600 hover:bg-blue-500 hover:text-white'
                  : 'bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500 hover:text-white'
                  }`} onClick={() => {
                    const prev = new Date(selectedDate)
                    prev.setDate(prev.getDate() - 1)
                    setSelectedDate(prev)
                  }} title="Previous day">
                  <MdChevronLeft size={16} />
                </button>

                {/* Date label / Today button */}
                <button className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${isLightMode
                  ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`} onClick={() => setSelectedDate(new Date())} title="Go to today">
                  {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </button>

                {/* Next Day */}
                <button className={`w-8 h-8 sm:w-9 sm:h-9 border-none rounded-lg cursor-pointer flex items-center justify-center transition-all ${isLightMode
                  ? isScience
                    ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white'
                    : isArtsLetters
                      ? 'bg-orange-500/10 text-orange-600 hover:bg-orange-500 hover:text-white'
                      : isArchitecture
                        ? 'bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white'
                        : 'bg-blue-500/10 text-blue-600 hover:bg-blue-500 hover:text-white'
                  : 'bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500 hover:text-white'
                  }`} onClick={() => {
                    const next = new Date(selectedDate)
                    next.setDate(next.getDate() + 1)
                    setSelectedDate(next)
                  }} title="Next day">
                  <MdChevronRight size={16} />
                </button>

                {/* Refresh */}
                <button className={`w-8 h-8 sm:w-9 sm:h-9 border-none rounded-lg cursor-pointer flex items-center justify-center transition-all ${isLightMode
                  ? isScience
                    ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white'
                    : isArtsLetters
                      ? 'bg-orange-500/10 text-orange-600 hover:bg-orange-500 hover:text-white'
                      : isArchitecture
                        ? 'bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white'
                        : 'bg-blue-500/10 text-blue-600 hover:bg-blue-500 hover:text-white'
                  : 'bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500 hover:text-white'
                  }`} onClick={() => {
                    fetchSchedules(user?.email || '')
                  }} title="Refresh schedule">
                  <span className={loading ? "animate-spin" : ""}>↻</span>
                </button>
              </div>
            </div>

            {/* Schedule List */}
            <div className="flex flex-col gap-3">
              {filteredSchedules.length > 0 ? (
                filteredSchedules.map((schedule) => {
                  const status = getClassStatus(schedule)
                  return (
                    <div
                      key={schedule.id}
                      onClick={() => {
                        setSelectedClassForModal(schedule)
                        setTimetableModalOpen(true)
                      }}
                      className={`relative group rounded-xl sm:rounded-2xl p-4 transition-all duration-300 cursor-pointer border-l-4 ${isLightMode
                        ? 'bg-white border-y border-r border-y-slate-100 border-r-slate-100 shadow-sm hover:shadow-md'
                        : 'bg-slate-800/50 border-y border-r border-y-cyan-900/30 border-r-cyan-900/30 hover:bg-slate-800'
                        } ${status === 'ongoing'
                          ? getCollegeColorClass('border')
                          : status === 'done'
                            ? isLightMode ? 'border-l-slate-300 opacity-75' : 'border-l-slate-600 opacity-60'
                            : getCollegeColorClass('border', 'light')
                        }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                        {/* Time Column */}
                        <div className="flex flex-row sm:flex-col items-center sm:items-start gap-2 sm:gap-1 min-w-[100px] sm:w-32">
                          <div className={`p-1.5 rounded-lg ${status === 'ongoing'
                            ? isLightMode ? 'bg-red-50' : 'bg-red-900/20'
                            : isLightMode ? 'bg-slate-50' : 'bg-slate-700/30'
                            }`}>
                            <MdAccessTime size={16} className={
                              status === 'ongoing'
                                ? 'text-red-500'
                                : isLightMode ? 'text-slate-400' : 'text-slate-500'
                            } />
                          </div>
                          <div className="flex flex-col">
                            <span className={`text-sm sm:text-base font-bold whitespace-nowrap ${status === 'ongoing'
                              ? 'text-red-600'
                              : isLightMode ? 'text-slate-700' : 'text-slate-300'
                              }`}>
                              {formatTime(schedule.start_time)}
                            </span>
                            <span className={`text-xs font-medium ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                              - {formatTime(schedule.end_time)}
                            </span>
                          </div>
                        </div>

                        {/* Class Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className={`text-base sm:text-lg font-bold truncate ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
                              {schedule.course_code}
                              <span className={`ml-2 text-sm font-normal ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                - {schedule.course_name}
                              </span>
                            </h4>
                            <div className="flex-shrink-0">
                              {getStatusBadge(status)}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm">
                            <div className={`flex items-center gap-1.5 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                              <MdLocationOn size={14} className={isLightMode ? 'text-slate-400' : 'text-slate-500'} />
                              <span className="truncate">{schedule.room}, {schedule.building}</span>
                            </div>
                            <div className={`flex items-center gap-1.5 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                              <MdMenuBook size={14} className={isLightMode ? 'text-slate-400' : 'text-slate-500'} />
                              <span>{schedule.section}</span>
                            </div>
                          </div>
                        </div>

                        {/* Chevron for indication */}
                        <div className={`hidden sm:flex items-center justify-center w-8 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity`}>
                          <MdChevronRight size={20} />
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className={`flex flex-col items-center justify-center py-12 px-4 rounded-xl border border-dashed ${isLightMode ? 'border-slate-300 bg-slate-50' : 'border-slate-700 bg-slate-800/30'
                  }`}>
                  <div className={`p-4 rounded-full mb-3 ${isLightMode ? 'bg-slate-100' : 'bg-slate-700'}`}>
                    <MdCalendarToday size={32} className={isLightMode ? 'text-slate-400' : 'text-slate-500'} />
                  </div>
                  <h3 className={`text-lg font-bold mb-1 ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>No Classes Scheduled</h3>
                  <p className={`text-sm text-center max-w-xs ${isLightMode ? 'text-slate-500' : 'text-slate-500'}`}>
                    {selectedDate.toDateString() === new Date().toDateString()
                      ? "You don't have any classes scheduled for today."
                      : `You don't have any classes scheduled for ${selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}.`}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Upcoming Holidays Calendar */}
          <section className="mb-4 sm:mb-5 md:mb-6">
            <h3 className={`text-base sm:text-lg font-bold mb-3 sm:mb-4 flex items-center gap-2 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
              <MdCalendarToday size={18} className="sm:w-5 sm:h-5" />
              Upcoming Holidays
            </h3>
            <UpcomingHolidaysCard
              isLightMode={isLightMode}
              isScience={isScience}
              isArtsLetters={isArtsLetters}
              isArchitecture={isArchitecture}
              getCollegeColorClass={getCollegeColorClass}
            />
          </section>
        </main>
      </div>

      {/* Quick Action - Mark as Absence */}
      <button
        className={`fixed bottom-6 right-6 z-[1500] px-4 py-3 rounded-full shadow-lg text-sm font-semibold transition-all ${isLightMode
          ? isScience
            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
            : isArtsLetters
              ? 'bg-orange-500 text-white hover:bg-orange-600'
              : isArchitecture
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-blue-600 text-white hover:bg-blue-700'
          : 'bg-cyan-500 text-slate-900 hover:bg-cyan-400'
          }`}
        onClick={() => setAttendanceOpen(true)}
      >
        Mark as Absence
      </button>

      {attendanceOpen && (
        <div className="fixed inset-0 z-[1600] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl p-5 border ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-cyan-500/20'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-base sm:text-lg font-bold ${isLightMode ? 'text-slate-800' : 'text-white'}`}>Mark Absence</h3>
              <button
                className={`text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}
                onClick={() => setAttendanceOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="space-y-3">
              <label className={`text-xs font-semibold ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>Scope</label>
              <select
                className={`w-full rounded-lg border px-3 py-2 text-sm ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-700 text-white'}`}
                value={attendanceScope}
                onChange={(e) => setAttendanceScope(e.target.value as any)}
              >
                <option value="class">Current Class</option>
                <option value="day">Whole Day</option>
                <option value="week">Whole Week</option>
                <option value="range">Date Range</option>
              </select>

              {attendanceScope === 'day' && (
                <input
                  className={`w-full rounded-lg border px-3 py-2 text-sm ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-700 text-white'}`}
                  value={attendanceDay}
                  onChange={(e) => setAttendanceDay(e.target.value)}
                  placeholder="Day of week (e.g., Monday)"
                />
              )}

              {attendanceScope === 'range' && (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    className={`w-full rounded-lg border px-3 py-2 text-sm ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-700 text-white'}`}
                    value={attendanceStartDate}
                    onChange={(e) => setAttendanceStartDate(e.target.value)}
                  />
                  <input
                    type="date"
                    className={`w-full rounded-lg border px-3 py-2 text-sm ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-700 text-white'}`}
                    value={attendanceEndDate}
                    onChange={(e) => setAttendanceEndDate(e.target.value)}
                  />
                </div>
              )}

              <textarea
                className={`w-full rounded-lg border px-3 py-2 text-sm min-h-[90px] ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-700 text-white'}`}
                value={attendanceReason}
                onChange={(e) => setAttendanceReason(e.target.value)}
                placeholder="Reason (optional)"
              />

              <button
                className={`w-full rounded-lg px-4 py-2 font-semibold ${isLightMode
                  ? isScience
                    ? 'bg-emerald-600 text-white'
                    : isArtsLetters
                      ? 'bg-orange-500 text-white'
                      : isArchitecture
                        ? 'bg-red-500 text-white'
                        : 'bg-blue-600 text-white'
                  : 'bg-cyan-500 text-slate-900'
                  }`}
                onClick={handleMarkAbsent}
                disabled={attendanceSubmitting}
              >
                {attendanceSubmitting ? 'Submitting...' : 'Confirm Absence'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Invalid Modal - Responsive */}
      {sessionInvalid && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
          <div className="bg-slate-900 border-2 border-red-500/30 rounded-2xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
              <MdError size={36} className="sm:w-12 sm:h-12 text-red-500" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">Session Expired</h2>
            <p className="text-sm sm:text-base text-slate-400 mb-5 sm:mb-6">Your account has been logged in from another device or browser. For security reasons, you have been logged out of this session.</p>
            <button
              className="w-full py-3 px-6 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-cyan-500/30 active:scale-[0.98]"
              onClick={async () => {
                await clearBrowserCaches()
                await supabase.auth.signOut()
                router.push('/')
              }}
            >
              Return to Login
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Upcoming Holidays Card Component - Mobile Optimized
interface UpcomingHolidaysCardProps {
  isLightMode: boolean
  isScience: boolean
  isArtsLetters: boolean
  isArchitecture: boolean
  getCollegeColorClass: (type: 'bg' | 'text' | 'border' | 'shadow', variant?: 'light' | 'normal' | 'dark') => string
}

function UpcomingHolidaysCard({ isLightMode, isScience, isArtsLetters, isArchitecture, getCollegeColorClass }: UpcomingHolidaysCardProps) {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  const getUpcomingHolidays = () => {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    return Object.entries(philippineHolidays)
      .filter(([date]) => date >= todayStr)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 6)
      .map(([date, name]) => ({
        date: new Date(date),
        name
      }))
  }

  const holidays = getUpcomingHolidays()

  if (holidays.length === 0) {
    return (
      <div className={`rounded-lg p-4 sm:p-5 text-center ${isLightMode ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-300'}`}>
        <p className="text-sm sm:text-base">No upcoming holidays at this time.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2 sm:space-y-3">
      {holidays.map((holiday, idx) => (
        <div
          key={idx}
          className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg transition-all border ${getCollegeColorClass('border', 'light')} hover:${getCollegeColorClass('border')} ${isLightMode
              ? `${getCollegeColorClass('bg', 'light')} hover:shadow-sm`
              : `bg-slate-800/60`
            }`}
        >
          {/* Date Box */}
          <div className={`flex flex-col items-center justify-center rounded-lg min-w-fit py-2 px-3 sm:py-3 sm:px-4 ${getCollegeColorClass('bg', 'light')} ${getCollegeColorClass('text')}`}>
            <div className="text-lg sm:text-xl font-bold">{holiday.date.getDate()}</div>
            <div className="text-xs sm:text-sm font-semibold">{monthNames[holiday.date.getMonth()].slice(0, 3).toUpperCase()}</div>
          </div>

          {/* Holiday Info */}
          <div className="flex-1 min-w-0">
            <h4 className={`font-semibold text-sm sm:text-base m-0 ${isLightMode ? 'text-slate-800' : 'text-white'} break-words`}>
              {holiday.name}
            </h4>
            <p className={`text-xs sm:text-sm m-0 mt-0.5 ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>
              {holiday.date.toLocaleDateString('en-US', { weekday: 'long' })}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
