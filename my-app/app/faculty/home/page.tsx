'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  Calendar,
  Clock,
  MapPin,
  BookOpen,
  ChevronRight,
  Building2,
  GraduationCap,
  TrendingUp,
  RefreshCw,
  AlertCircle
} from 'lucide-react'
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

export default function FacultyHomePage() {
  const router = useRouter()
  const { theme, collegeTheme, setTheme, setCollegeTheme } = useTheme()
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
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light')
  const [currentScheduleId, setCurrentScheduleId] = useState<number | null>(null)
  const [attendanceOpen, setAttendanceOpen] = useState(false)
  const [attendanceScope, setAttendanceScope] = useState<'class' | 'day' | 'week' | 'range'>('class')
  const [attendanceReason, setAttendanceReason] = useState('')
  const [attendanceDay, setAttendanceDay] = useState('')
  const [attendanceStartDate, setAttendanceStartDate] = useState('')
  const [attendanceEndDate, setAttendanceEndDate] = useState('')
  const [attendanceSubmitting, setAttendanceSubmitting] = useState(false)

  // Theme helper - use effectiveTheme which is synced from localStorage
  const isLightMode = effectiveTheme === 'light'
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
        if (type === 'shadow') return 'shadow-[0_4px_20px_rgba(248,113,113,0.3)]'
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

    // Apply theme immediately from localStorage BEFORE mounting
    const savedTheme = localStorage.getItem('faculty-base-theme')
    const savedCollegeTheme = localStorage.getItem('faculty-college-theme')

    // Determine effective theme - faculty pages only use light or dark (never green)
    let themeToApply = savedTheme || 'light'
    if (themeToApply === 'green') {
      themeToApply = 'light' // Faculty pages convert green to light
    }

    // Set the effective theme immediately for proper styling
    setEffectiveTheme(themeToApply as 'light' | 'dark')
    document.documentElement.setAttribute('data-theme', themeToApply)

    if (savedCollegeTheme) {
      document.documentElement.setAttribute('data-college-theme', savedCollegeTheme)
    }

    // Add faculty classes
    document.body.classList.add('faculty-page', 'faculty-loaded')
    
    // Force body background based on faculty theme
    const bgColor = themeToApply === 'light' ? '#ffffff' : '#0a0e27'
    const textColor = themeToApply === 'light' ? '#1e293b' : '#ffffff'
    document.documentElement.style.setProperty('background', bgColor, 'important')
    document.body.style.setProperty('background', bgColor, 'important')
    document.body.style.setProperty('color', textColor, 'important')
    
    // Reset CSS variables on root
    document.documentElement.style.setProperty('--page-bg', bgColor)
    document.documentElement.style.setProperty('--bg-primary', bgColor)
    document.documentElement.style.setProperty('--bg-secondary', themeToApply === 'light' ? '#f8fafc' : '#1a1f3a')
    document.documentElement.style.setProperty('--card-bg', themeToApply === 'light' ? 'rgba(255, 255, 255, 0.98)' : 'rgba(20, 26, 50, 0.95)')
    document.documentElement.style.setProperty('--text-primary', textColor)
    document.documentElement.style.setProperty('--text-secondary', themeToApply === 'light' ? '#64748b' : 'rgba(255, 255, 255, 0.7)')

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

  // Sync effectiveTheme when theme context changes (e.g., user toggles theme)
  useEffect(() => {
    if (mounted && theme) {
      // Faculty pages only use light or dark
      const newEffectiveTheme = theme === 'green' ? 'light' : (theme as 'light' | 'dark')
      setEffectiveTheme(newEffectiveTheme)
    }
  }, [theme, mounted])

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

      // Fetch schedules
      await fetchSchedules(session.user.id)

      setLoading(false)
    } catch (error) {
      console.error('Auth check failed:', error)
      router.push('/')
    }
  }

  const fetchSchedules = async (userId: string) => {
    try {
      const db = supabase as any
      const { data, error } = await db
        .from('faculty_schedules')
        .select(`
          id,
          course_code,
          course_name,
          room,
          building,
          day,
          start_time,
          end_time,
          section
        `)
        .eq('user_id', userId)

      if (error) {
        // Table might not exist yet - this is expected, just silently return empty
        // console.log('Note: faculty_schedules table not available:', error.message)
        setSchedules([])
        return
      }

      if (data && data.length > 0) {
        // Process schedules...
        const processedSchedules = data.map((schedule: any) => ({
          ...schedule,
          day: normalizeDay(schedule.day),
          start_time: convertTo24Hour(schedule.start_time),
          end_time: convertTo24Hour(schedule.end_time)
        }))

        setSchedules(processedSchedules)
        findCurrentAndNextClass(processedSchedules)
        const { data: currentSchedule } = await db
          .from('generated_schedules')
          .select('id')
          .eq('is_current', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        setCurrentScheduleId(currentSchedule?.id || null)
      } else {
        // No schedules found - that's okay
        setSchedules([])
      }
    } catch (error) {
      console.error('Error fetching schedules:', error)
      setSchedules([])
    }
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
      data-theme={effectiveTheme}
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
                    <Building2 size={12} />
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
                <Calendar size={20} className="sm:w-5 sm:h-5 md:w-6 md:h-6" />
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
                <BookOpen size={20} className="sm:w-5 sm:h-5 md:w-6 md:h-6" />
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
                <Clock size={20} className="sm:w-5 sm:h-5 md:w-6 md:h-6" />
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
              <BookOpen size={18} className="sm:w-5 sm:h-5" />
              Today's Classes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {/* Current Class Card */}
              <div className={`border-2 rounded-xl p-4 sm:p-5 transition-all duration-300 ${currentClass
                ? `${getCollegeColorClass('border')} ${getCollegeColorClass('shadow')}`
                : isLightMode ? 'border-slate-200' : 'border-cyan-500/20'
                } ${isLightMode ? 'bg-white/95 shadow-md' : 'bg-slate-800/80'}`}>
                <div className="flex items-center justify-between mb-3">
                  {currentClass ? (
                    <>
                      <span className={`flex items-center gap-1.5 text-xs font-bold uppercase ${getCollegeColorClass('text')}`}>
                        <span className={`w-2 h-2 rounded-full animate-pulse ${getCollegeColorClass('bg')}`}></span>
                        Ongoing
                      </span>
                      <span className={`text-xs font-semibold ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        {formatTime(currentClass.start_time)} - {formatTime(currentClass.end_time)}
                      </span>
                    </>
                  ) : (
                    <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold uppercase ${styles.collegeBadge}`}>Next Class</span>
                  )}
                </div>
                <div className="mt-3">
                  {currentClass ? (
                    <>
                      <h4 className={`text-base sm:text-lg font-bold m-0 mb-1 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>{currentClass.course_code}</h4>
                      <p className={`text-sm m-0 mb-3 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>{currentClass.course_name}</p>
                      <div className={`flex flex-col gap-1.5 text-xs sm:text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        <span className="flex items-center gap-1.5 flex-wrap"><MapPin size={14} className="flex-shrink-0" /> {currentClass.room}, {currentClass.building}</span>
                        <span className="flex items-center gap-1.5"><BookOpen size={14} className="flex-shrink-0" /> {currentClass.section}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <h4 className={`text-base sm:text-lg font-bold m-0 mb-1 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>Upcoming Class</h4>
                      <p className={`text-sm m-0 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>No class scheduled for today</p>
                    </>
                  )}
                </div>
              </div>

              {/* Next Class Card */}
              <div className={`border-2 rounded-xl p-4 sm:p-5 transition-all duration-300 ${nextClass
                ? `${getCollegeColorClass('border')} ${getCollegeColorClass('shadow')}`
                : isLightMode ? 'border-slate-200' : 'border-cyan-500/20'
                } ${isLightMode ? 'bg-white/95 shadow-md' : 'bg-slate-800/80'}`}>
                <div className="flex items-center justify-between mb-3">
                  {nextClass ? (
                    <>
                      <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold uppercase ${
                        isLightMode
                          ? isScience
                            ? 'bg-emerald-100 text-emerald-700'
                            : isArtsLetters
                            ? 'bg-orange-100 text-orange-700'
                            : isArchitecture
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                          : `${getCollegeColorClass('bg', 'light')} ${getCollegeColorClass('text')}`
                        }`}>Next Up</span>
                      <span className={`text-xs font-semibold ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        {formatTime(nextClass.start_time)}
                      </span>
                    </>
                  ) : (
                    <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold uppercase ${
                      isLightMode
                        ? isScience
                          ? 'bg-emerald-100 text-emerald-700'
                          : isArtsLetters
                          ? 'bg-orange-100 text-orange-700'
                          : isArchitecture
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'
                        : `${getCollegeColorClass('bg', 'light')} ${getCollegeColorClass('text')}`
                      }`}>Finished</span>
                  )}
                </div>
                <div className="mt-3">
                  {nextClass ? (
                    <>
                      <h4 className={`text-base sm:text-lg font-bold m-0 mb-1 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>{nextClass.course_code}</h4>
                      <p className={`text-sm m-0 mb-3 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>{nextClass.course_name}</p>
                      <div className={`flex flex-col gap-1.5 text-xs sm:text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        <span className="flex items-center gap-1.5 flex-wrap"><MapPin size={14} className="flex-shrink-0" /> {nextClass.room}, {nextClass.building}</span>
                        <span className="flex items-center gap-1.5"><BookOpen size={14} className="flex-shrink-0" /> {nextClass.section}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <h4 className={`text-base sm:text-lg font-bold m-0 mb-1 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>All Done!</h4>
                      <p className={`text-sm m-0 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>No more classes for today</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Today's Schedule */}
          <section className="mb-4 sm:mb-5 md:mb-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4 flex-wrap gap-2">
              <h3 className={`text-base sm:text-lg font-bold flex items-center gap-2 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
                <Calendar size={18} className="sm:w-5 sm:h-5" />
                Today's Schedule
              </h3>
              <button className={`w-9 h-9 sm:w-10 sm:h-10 border-none rounded-lg cursor-pointer flex items-center justify-center transition-all ${
                isLightMode
                  ? isScience
                    ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white'
                    : isArtsLetters
                    ? 'bg-orange-500/10 text-orange-600 hover:bg-orange-500 hover:text-white'
                    : isArchitecture
                    ? 'bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white'
                    : 'bg-blue-500/10 text-blue-600 hover:bg-blue-500 hover:text-white'
                  : 'bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500 hover:text-white'
              }`} onClick={checkAuthAndLoad} title="Refresh">
                <RefreshCw size={16} className="sm:w-[18px] sm:h-[18px]" />
              </button>
            </div>
            {schedules.filter(s => s.day === ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()]).length > 0 ? (
              <div className="flex flex-col gap-2 sm:gap-3">
                {schedules
                  .filter(s => s.day === ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()])
                  .map((schedule, index) => (
                    <div key={index} className={`rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 cursor-pointer transition-all hover:translate-x-1 ${
                      isLightMode
                        ? isScience
                          ? 'bg-white/90 border border-slate-200 hover:border-emerald-500'
                          : isArtsLetters
                          ? 'bg-white/90 border border-slate-200 hover:border-orange-500'
                          : isArchitecture
                          ? 'bg-white/90 border border-slate-200 hover:border-red-500'
                          : 'bg-white/90 border border-slate-200 hover:border-blue-500'
                        : 'bg-slate-800/80 border border-cyan-500/20 hover:border-cyan-500'
                    }`}>
                      <div className={`flex items-center gap-2 text-xs sm:text-sm font-semibold min-w-[130px] sm:min-w-[140px] ${getCollegeColorClass('text')}`}>
                        <Clock size={14} className="sm:w-4 sm:h-4 flex-shrink-0" />
                        <span>{formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-sm sm:text-base font-semibold m-0 mb-1 break-words ${isLightMode ? 'text-slate-800' : 'text-white'}`}>{schedule.course_code} - {schedule.course_name}</h4>
                        <p className={`text-xs sm:text-sm m-0 flex items-center gap-1.5 flex-wrap ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          <MapPin size={12} className="flex-shrink-0" /> {schedule.room}, {schedule.building}
                          <span className={`mx-1 ${isLightMode ? 'text-slate-300' : 'text-slate-600'}`}>•</span>
                          <BookOpen size={12} className="flex-shrink-0" /> {schedule.section}
                        </p>
                      </div>
                      <ChevronRight size={16} className={`hidden sm:block flex-shrink-0 ${getCollegeColorClass('text')}`} />
                    </div>
                  ))}
              </div>
            ) : (
              <div className={`rounded-xl p-6 sm:p-8 md:p-12 text-center ${isLightMode ? 'bg-white/90 border border-slate-200' : 'bg-slate-800/80 border border-cyan-500/20'}`}>
                <Calendar size={48} className="sm:w-16 sm:h-16 opacity-30 mx-auto mb-4" />
                <h3 className={`text-base sm:text-lg font-bold m-0 mb-2 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>No Schedule Today</h3>
                <p className={`text-sm m-0 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Your schedule will appear here once assigned by the admin.</p>
              </div>
            )}
          </section>

          {/* Department Announcements */}
          <section className="mb-4 sm:mb-5 md:mb-6">
            <h3 className={`text-base sm:text-lg font-bold mb-3 sm:mb-4 flex items-center gap-2 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
              <TrendingUp size={18} className="sm:w-5 sm:h-5" />
              Department Announcements
            </h3>
            <div className={`rounded-xl p-4 sm:p-5 flex items-start gap-3 sm:gap-4 ${getCollegeColorClass('bg', 'light')} border ${getCollegeColorClass('border')} ${getCollegeColorClass('text')}`}>
              <TrendingUp size={20} className="flex-shrink-0 mt-1" />
              <div>
                <h4 className="text-sm sm:text-base font-bold m-0 mb-1">Welcome to QTime Faculty Portal</h4>
                <p className="text-xs sm:text-sm m-0 opacity-90">Stay updated with your schedule, faculty directory, and department information all in one place.</p>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* Quick Action - Mark as Absence */}
      <button
        className={`fixed bottom-6 right-6 z-[1500] px-4 py-3 rounded-full shadow-lg text-sm font-semibold transition-all ${
          isLightMode
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
                className={`w-full rounded-lg px-4 py-2 font-semibold ${
                  isLightMode
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
              <AlertCircle size={36} className="sm:w-12 sm:h-12 text-red-500" />
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
