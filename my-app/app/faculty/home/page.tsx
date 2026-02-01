'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Bell,
  BookOpen,
  ChevronRight,
  Building2,
  GraduationCap,
  Sun,
  Moon,
  Palette,
  Menu,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Settings,
  LogOut,
  RefreshCw,
  AlertCircle,
  X
} from 'lucide-react'
import styles from './styles.module.css'
import FacultySidebar from '@/app/components/FacultySidebar'
import FacultySettingsModal from '@/app/components/FacultySettingsModal'
import { useTheme, COLLEGE_THEME_MAP } from '@/app/context/ThemeContext'

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
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMenuBarHidden, setIsMenuBarHidden] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [greeting, setGreeting] = useState('')
  const [todayClassCount, setTodayClassCount] = useState(0)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [sessionInvalid, setSessionInvalid] = useState(false)

  const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL

  useEffect(() => {
    checkAuthAndLoad()
    updateGreeting()

    // Update greeting every minute
    const interval = setInterval(updateGreeting, 60000)
    return () => clearInterval(interval)
  }, [])

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
              await supabase.auth.signOut()
              localStorage.removeItem('faculty_session_token')
              localStorage.removeItem('faculty_keep_signed_in')
              router.push('/faculty/login?reason=session_expired')
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

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest(`.${styles.userSection}`)) {
        setShowUserMenu(false)
      }
    }

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showUserMenu])

  const updateGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Good Morning')
    else if (hour < 17) setGreeting('Good Afternoon')
    else setGreeting('Good Evening')
  }

  const checkAuthAndLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        router.push('/faculty/login')
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
        await supabase.auth.signOut()
        router.push('/faculty/login')
        return
      }

      // Also fetch from faculty_profiles for more complete data
      const { data: facultyProfile } = await supabase
        .from('faculty_profiles')
        .select('full_name, department, college')
        .eq('email', session.user.email || '')
        .single() as { data: { full_name?: string; department?: string; college?: string } | null }

      // Merge the data - faculty_profiles takes priority
      const mergedUser: UserProfile = {
        ...userData,
        full_name: facultyProfile?.full_name || userData.full_name || '',
        department: facultyProfile?.department || userData.department || '',
        college: facultyProfile?.college || userData.college || ''
      }

      setUser(mergedUser)

      // Set college theme based on user's college/department
      if (mergedUser.college) {
        const collegeLower = mergedUser.college.toLowerCase()
        const matchedTheme = COLLEGE_THEME_MAP[collegeLower]
        if (matchedTheme) {
          setCollegeTheme(matchedTheme)
        }
      }

      // Fetch schedules for this faculty
      await fetchSchedules(userData.email, mergedUser.full_name)

    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/faculty/login')
    } finally {
      setLoading(false)
    }
  }

  const fetchSchedules = async (email: string, facultyName?: string) => {
    try {
      // First, try to fetch the default schedule assigned by admin
      const response = await fetch(`/api/faculty-default-schedule?action=faculty-schedule&email=${encodeURIComponent(email)}`)
      const data = await response.json()

      if (data.success && data.defaultSchedule && data.allocations && data.allocations.length > 0) {
        // The API now filters by teacher_name, so we get only this faculty's classes
        // Transform room allocations to schedule items
        const transformedSchedules: ScheduleItem[] = data.allocations.map((alloc: any) => {
          // Parse schedule_time like "8:00-9:30" or "08:00 - 09:30"
          let startTime = '08:00'
          let endTime = '09:00'
          if (alloc.schedule_time) {
            const timeParts = alloc.schedule_time.split('-').map((t: string) => t.trim())
            if (timeParts.length === 2) {
              // Convert to 24-hour format if needed
              startTime = convertTo24Hour(timeParts[0])
              endTime = convertTo24Hour(timeParts[1])
            }
          }

          // Normalize day
          const normalizedDay = normalizeDay(alloc.schedule_day || '')

          return {
            id: alloc.id,
            course_code: alloc.course_code || 'N/A',
            course_name: alloc.course_name || '',
            room: alloc.room || 'TBA',
            building: alloc.building || '',
            day: normalizedDay,
            start_time: startTime,
            end_time: endTime,
            section: alloc.section || ''
          }
        })

        setSchedules(transformedSchedules)
        findCurrentAndNextClass(transformedSchedules)
        return
      }

      // Fallback: Try to fetch from schedule_assignments (old method)
      const { data: scheduleData, error } = await supabase
        .from('schedule_assignments')
        .select('*')
        .eq('professor_email', email)
        .order('day', { ascending: true })
        .order('start_time', { ascending: true })

      if (scheduleData && scheduleData.length > 0) {
        setSchedules(scheduleData)
        findCurrentAndNextClass(scheduleData)
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

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/faculty/login')
    } catch (error) {
      console.error('Logout failed:', error)
      router.push('/faculty/login')
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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white gap-5">
        <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
        <p className="text-sm text-slate-400">Loading your dashboard...</p>
      </div>
    )
  }

  return (
    <div className={styles.pageContainer} data-college-theme={collegeTheme}>
      {/* Sidebar */}
      <FacultySidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        menuBarHidden={isMenuBarHidden}
      />

      {/* Main Layout */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${sidebarOpen ? 'md:ml-[250px]' : 'ml-0'}`}>
        {/* Top Header */}
        <header className={`fixed top-0 left-0 right-0 h-14 sm:h-16 md:h-[70px] flex items-center justify-between px-3 sm:px-4 md:px-8 bg-slate-900/95 backdrop-blur-md border-b-2 border-cyan-500/20 z-[90] transition-transform duration-300 shadow-lg ${isMenuBarHidden ? '-translate-y-full' : ''}`}>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Sidebar Toggle Button */}
            <button
              className="flex w-10 h-10 sm:w-11 sm:h-11 bg-transparent border-2 border-cyan-500/30 rounded-lg text-cyan-500 cursor-pointer items-center justify-center transition-all hover:bg-cyan-500/10 hover:border-cyan-500 hover:shadow-[0_0_15px_rgba(0,212,255,0.3)]"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
            >
              <Menu size={20} className="sm:w-6 sm:h-6" />
            </button>

            {/* Logo/Branding */}
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 bg-gradient-to-br from-cyan-400 via-cyan-500 to-cyan-700 rounded-lg sm:rounded-xl flex items-center justify-center font-extrabold text-lg sm:text-xl text-white shadow-lg">Q</span>
              <span className="hidden sm:block text-base sm:text-lg md:text-xl font-bold bg-gradient-to-r from-cyan-400 to-cyan-600 bg-clip-text text-transparent">Qtime Faculty</span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notifications */}
            <button className="w-9 h-9 sm:w-10 sm:h-10 bg-cyan-500/10 border-none rounded-lg text-cyan-500 cursor-pointer flex items-center justify-center transition-all hover:bg-cyan-500 hover:text-white" title="Notifications">
              <Bell size={18} className="sm:w-5 sm:h-5" />
            </button>

            {/* User Dropdown */}
            <div className="relative">
              <button
                className="w-10 h-10 sm:w-11 sm:h-11 bg-transparent border-2 border-cyan-500/30 rounded-full text-cyan-500 cursor-pointer flex items-center justify-center transition-all hover:bg-cyan-500/10 hover:border-cyan-500 hover:shadow-[0_0_15px_rgba(0,212,255,0.3)]"
                onClick={() => setShowUserMenu(!showUserMenu)}
                title="Account Menu"
              >
                <User size={18} className="sm:w-5 sm:h-5" />
              </button>

              {showUserMenu && (
                <>
                  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] md:hidden" onClick={() => setShowUserMenu(false)} />
                  <div className="fixed md:absolute inset-x-4 bottom-4 md:inset-auto md:top-[calc(100%+10px)] md:right-0 bg-slate-900/98 backdrop-blur-xl border-2 border-cyan-500/30 rounded-2xl shadow-2xl min-w-[280px] z-[1000] p-2 animate-in slide-in-from-bottom-5 md:slide-in-from-top-2 duration-200">
                    {/* Mobile Close Button */}
                    <button 
                      className="md:hidden absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <X size={18} />
                    </button>
                    {user?.email && (
                      <>
                        <div className="flex items-center gap-2.5 px-4 py-3 text-cyan-500 text-sm font-semibold break-all pr-10 md:pr-4">
                          <User size={16} />
                          {user.email}
                        </div>
                        <div className="h-px bg-cyan-500/20 my-1" />
                    </>
                  )}
                  <button
                    className="w-full p-3 bg-transparent border-none rounded-xl text-white/90 cursor-pointer flex items-center gap-3 text-sm font-medium transition-all hover:bg-cyan-500/15 hover:text-cyan-500 hover:translate-x-1 text-left"
                    onClick={() => {
                      setShowUserMenu(false)
                      router.push('/faculty/profile')
                    }}
                  >
                    <User size={16} />
                    Profile
                  </button>
                  <button
                    className="w-full p-3 bg-transparent border-none rounded-xl text-white/90 cursor-pointer flex items-center gap-3 text-sm font-medium transition-all hover:bg-cyan-500/15 hover:text-cyan-500 hover:translate-x-1 text-left"
                    onClick={() => {
                      setShowUserMenu(false)
                      setShowSettingsModal(true)
                    }}
                  >
                    <Settings size={16} />
                    Settings
                  </button>
                  <div className="h-px bg-cyan-500/20 my-1" />
                  <button
                    className="w-full p-3 bg-transparent border-none rounded-xl text-red-500 cursor-pointer flex items-center gap-3 text-sm font-medium transition-all hover:bg-red-500/15 text-left"
                    onClick={async () => {
                      setShowUserMenu(false)
                      await supabase.auth.signOut()
                      router.push('/faculty/login')
                    }}
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Toggle Arrow Button - inside header */}
          <button
            className="absolute -bottom-5 left-1/2 -translate-x-1/2 w-12 h-6 bg-slate-900/95 border-2 border-t-0 border-cyan-500/20 rounded-b-xl cursor-pointer flex items-center justify-center text-cyan-500 transition-all z-[91] shadow-lg hover:bg-cyan-500/10 hover:border-cyan-500 hover:shadow-[0_0_20px_rgba(0,212,255,0.3)]"
            onClick={() => setIsMenuBarHidden(!isMenuBarHidden)}
            title={isMenuBarHidden ? 'Show Header' : 'Hide Header'}
          >
            <ChevronUp size={18} />
          </button>
        </header>

        {/* Floating Show Button when header is hidden */}
        {isMenuBarHidden && (
          <button
            className="fixed top-0 left-1/2 -translate-x-1/2 w-14 h-8 bg-slate-900/95 border-2 border-t-0 border-cyan-500/20 rounded-b-2xl cursor-pointer flex items-center justify-center text-cyan-500 transition-all z-[1001] shadow-lg hover:bg-cyan-500/10 hover:border-cyan-500 hover:shadow-[0_0_20px_rgba(0,212,255,0.3)] hover:translate-y-1 animate-in slide-in-from-top duration-300"
            onClick={() => setIsMenuBarHidden(false)}
            title="Show Header"
          >
            <ChevronDown size={18} />
          </button>
        )}

        {/* Main Content */}
        <main className="flex-1 px-3 sm:px-4 md:px-6 lg:px-8 pt-20 sm:pt-24 md:pt-28 pb-6 max-w-[1400px] mx-auto w-full box-border overflow-x-hidden">
          {/* Welcome Banner - Left aligned like Admin Dashboard */}
          <section className="bg-slate-800/80 border border-cyan-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 mb-4 sm:mb-5 md:mb-6 mt-2 sm:mt-4 md:mt-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div className="text-left">
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold m-0 mb-1 text-white break-words leading-tight">{greeting}, {user?.full_name?.split(' ')[0] || 'Faculty'}!</h2>
                <p className="text-slate-400 text-sm sm:text-base m-0">{getCurrentDate()}</p>
                {user?.department && (
                  <div className="flex gap-2 flex-wrap mt-3">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/20 rounded-full text-xs sm:text-sm text-cyan-500 font-semibold">
                      <Building2 size={14} className="sm:w-4 sm:h-4" />
                      <span>{user.department}</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="text-left sm:text-right flex-shrink-0">
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-cyan-500 leading-none">
                  {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="text-xs sm:text-sm text-slate-400 mt-1">
                  {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
              </div>
            </div>
          </section>

          {/* Quick Stats - Responsive Grid */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-5 md:mb-6">
            <div className="bg-slate-800/80 border border-cyan-500/20 rounded-xl p-3 sm:p-4 md:p-5 flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 bg-gradient-to-br from-cyan-400 via-cyan-500 to-cyan-700 rounded-lg sm:rounded-xl flex items-center justify-center text-white flex-shrink-0">
                <Calendar size={20} className="sm:w-5 sm:h-5 md:w-6 md:h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xl sm:text-2xl md:text-3xl font-bold text-white leading-none mb-1">{todayClassCount}</div>
                <div className="text-xs sm:text-sm text-slate-400">Classes Today</div>
              </div>
            </div>
            <div className="bg-slate-800/80 border border-cyan-500/20 rounded-xl p-3 sm:p-4 md:p-5 flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 bg-gradient-to-br from-cyan-400 via-cyan-500 to-cyan-700 rounded-lg sm:rounded-xl flex items-center justify-center text-white flex-shrink-0">
                <BookOpen size={20} className="sm:w-5 sm:h-5 md:w-6 md:h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xl sm:text-2xl md:text-3xl font-bold text-white leading-none mb-1">{schedules.length}</div>
                <div className="text-xs sm:text-sm text-slate-400">Total Classes This Week</div>
              </div>
            </div>
            <div className="bg-slate-800/80 border border-cyan-500/20 rounded-xl p-3 sm:p-4 md:p-5 flex items-center gap-3 sm:gap-4 sm:col-span-2 lg:col-span-1">
              <div className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 bg-gradient-to-br from-cyan-400 via-cyan-500 to-cyan-700 rounded-lg sm:rounded-xl flex items-center justify-center text-white flex-shrink-0">
                <Clock size={20} className="sm:w-5 sm:h-5 md:w-6 md:h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-lg sm:text-xl md:text-2xl font-bold text-white leading-none mb-1">{currentClass ? 'In Progress' : 'Free'}</div>
                <div className="text-xs sm:text-sm text-slate-400">Current Status</div>
              </div>
            </div>
          </section>

          {/* Current & Next Class - Responsive Stack */}
          <section className="mb-4 sm:mb-5 md:mb-6">
            <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 text-white">My Classes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {/* Current Class Card */}
              <div className={`bg-slate-800/80 border-2 rounded-xl p-4 sm:p-5 transition-all duration-300 ${currentClass ? 'border-green-500 shadow-[0_4px_20px_rgba(34,197,94,0.3)]' : 'border-cyan-500/20'}`}>
                <div className="flex items-center justify-between mb-3">
                  {currentClass ? (
                    <>
                      <span className="flex items-center gap-1.5 text-green-500 text-xs font-bold">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        NOW
                      </span>
                      <span className="text-xs text-slate-400 font-semibold">
                        {formatTime(currentClass.start_time)} - {formatTime(currentClass.end_time)}
                      </span>
                    </>
                  ) : (
                    <span className="px-2.5 py-1 bg-cyan-500/20 text-cyan-500 rounded-xl text-[11px] font-bold">NO CLASS</span>
                  )}
                </div>
                <div className="mt-3">
                  {currentClass ? (
                    <>
                      <h4 className="text-base sm:text-lg font-bold m-0 mb-1 text-white">{currentClass.course_code}</h4>
                      <p className="text-sm text-slate-400 m-0 mb-3">{currentClass.course_name}</p>
                      <div className="flex flex-col gap-1.5 text-xs sm:text-sm text-slate-400">
                        <span className="flex items-center gap-1.5 flex-wrap"><MapPin size={14} /> {currentClass.room}, {currentClass.building}</span>
                        <span className="flex items-center gap-1.5"><BookOpen size={14} /> {currentClass.section}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <h4 className="text-base sm:text-lg font-bold m-0 mb-1 text-white">Free Time</h4>
                      <p className="text-sm text-slate-400 m-0">No ongoing class at the moment</p>
                    </>
                  )}
                </div>
              </div>

              {/* Next Class Card */}
              <div className={`bg-slate-800/80 border-2 rounded-xl p-4 sm:p-5 transition-all duration-300 ${nextClass ? 'border-cyan-500 shadow-[0_4px_20px_rgba(0,212,255,0.3)]' : 'border-cyan-500/20'}`}>
                <div className="flex items-center justify-between mb-3">
                  {nextClass ? (
                    <>
                      <span className="px-2.5 py-1 bg-cyan-500/20 text-cyan-500 rounded-xl text-[11px] font-bold">NEXT UP</span>
                      <span className="text-xs text-slate-400 font-semibold">
                        {formatTime(nextClass.start_time)}
                      </span>
                    </>
                  ) : (
                    <span className="px-2.5 py-1 bg-cyan-500/20 text-cyan-500 rounded-xl text-[11px] font-bold">FINISHED</span>
                  )}
                </div>
                <div className="mt-3">
                  {nextClass ? (
                    <>
                      <h4 className="text-base sm:text-lg font-bold m-0 mb-1 text-white">{nextClass.course_code}</h4>
                      <p className="text-sm text-slate-400 m-0 mb-3">{nextClass.course_name}</p>
                      <div className="flex flex-col gap-1.5 text-xs sm:text-sm text-slate-400">
                        <span className="flex items-center gap-1.5 flex-wrap"><MapPin size={14} /> {nextClass.room}, {nextClass.building}</span>
                        <span className="flex items-center gap-1.5"><BookOpen size={14} /> {nextClass.section}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <h4 className="text-base sm:text-lg font-bold m-0 mb-1 text-white">All Done!</h4>
                      <p className="text-sm text-slate-400 m-0">No more classes for today</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Today's Schedule */}
          <section className="mb-4 sm:mb-5 md:mb-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4 flex-wrap gap-2">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Calendar size={18} className="sm:w-5 sm:h-5 inline-block" />
                Today's Schedule
              </h3>
              <button className="w-9 h-9 sm:w-10 sm:h-10 bg-cyan-500/10 border-none rounded-lg text-cyan-500 cursor-pointer flex items-center justify-center transition-all hover:bg-cyan-500 hover:text-white" onClick={checkAuthAndLoad} title="Refresh">
                <RefreshCw size={16} className="sm:w-[18px] sm:h-[18px]" />
              </button>
            </div>
            {schedules.filter(s => s.day === ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()]).length > 0 ? (
              <div className="flex flex-col gap-2 sm:gap-3">
                {schedules
                  .filter(s => s.day === ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()])
                  .map((schedule, index) => (
                    <div key={index} className="bg-slate-800/80 border border-cyan-500/20 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 cursor-pointer transition-all hover:border-cyan-500 hover:translate-x-1">
                      <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-cyan-500 min-w-[130px] sm:min-w-[140px]">
                        <Clock size={14} className="sm:w-4 sm:h-4" />
                        <span>{formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm sm:text-base font-semibold m-0 mb-1 text-white break-words">{schedule.course_code} - {schedule.course_name}</h4>
                        <p className="text-xs sm:text-sm text-slate-400 m-0 flex items-center gap-1.5 flex-wrap">
                          <MapPin size={12} /> {schedule.room}, {schedule.building}
                          <span className="mx-1 text-slate-600">•</span>
                          <BookOpen size={12} /> {schedule.section}
                        </p>
                      </div>
                      <ChevronRight size={16} className="hidden sm:block text-cyan-500 flex-shrink-0" />
                    </div>
                  ))}
              </div>
            ) : (
              <div className="bg-slate-800/80 border border-cyan-500/20 rounded-xl p-6 sm:p-8 md:p-12 text-center">
                <Calendar size={48} className="sm:w-16 sm:h-16 opacity-30 mx-auto mb-4" />
                <h3 className="text-base sm:text-lg font-bold text-white m-0 mb-2">No Schedule Today</h3>
                <p className="text-sm text-slate-400 m-0">Your schedule will appear here once assigned by the admin.</p>
              </div>
            )}
          </section>

          {/* Department Announcements */}
          <section className="mb-4 sm:mb-5 md:mb-6">
            <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 text-white">Department Announcements</h3>
            <div className="bg-cyan-500/10 border border-cyan-500 rounded-xl p-4 sm:p-5 flex gap-3 sm:gap-4 text-cyan-500">
              <TrendingUp size={20} className="flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm sm:text-base font-bold m-0 mb-1">Welcome to QTime Faculty Portal</h4>
                <p className="text-xs sm:text-sm m-0 opacity-90">Stay updated with your schedule, faculty directory, and department information all in one place.</p>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* Settings Modal */}
      <FacultySettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />

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
                localStorage.removeItem('faculty_session_token')
                localStorage.removeItem('faculty_keep_signed_in')
                await supabase.auth.signOut()
                router.push('/faculty/login')
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
