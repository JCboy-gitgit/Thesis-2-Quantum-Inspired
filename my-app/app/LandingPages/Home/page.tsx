'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { fetchNoCache } from '@/lib/fetchUtils'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import {
  Calendar,
  Users,
  Clock,
  Building2,
  DoorOpen,
  BookOpen,
  GraduationCap,
  Upload,
  Settings,
  FileSpreadsheet,
  Activity,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Zap,
  Eye,
  UserCheck,
  CalendarDays,
  LayoutDashboard,
  TrendingUp,
  Bell,
  Star
} from 'lucide-react'
import './styles.css'

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

interface OnlineFaculty {
  id: string
  full_name: string
  email: string
  department?: string
  college?: string
  last_login: string
  avatar_url?: string
}

interface ScheduleInfo {
  id: number
  name: string
  academic_year: string
  semester: string
  is_default: boolean
  created_at: string
  total_classes: number
}

interface DashboardStats {
  totalRooms: number
  totalFaculty: number
  totalCourses: number
  totalSections: number
  activeSchedules: number
  onlineFaculty: number
}

export default function AdminDashboard() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState<Date | null>(null) // Initialize as null to avoid hydration mismatch
  const [calendarDate, setCalendarDate] = useState<Date | null>(null)
  const [onlineFaculty, setOnlineFaculty] = useState<OnlineFaculty[]>([])
  const [currentSchedule, setCurrentSchedule] = useState<ScheduleInfo | null>(null)
  const [stats, setStats] = useState<DashboardStats>({
    totalRooms: 0,
    totalFaculty: 0,
    totalCourses: 0,
    totalSections: 0,
    activeSchedules: 0,
    onlineFaculty: 0
  })

  useEffect(() => {
    // Set initial date on client side only (avoids hydration mismatch)
    setCurrentDate(new Date())
    setCalendarDate(new Date())
    
    checkAuth()
    fetchDashboardData()
    
    // Update current time every minute
    const timer = setInterval(() => {
      setCurrentDate(new Date())
    }, 60000)
    
    // Refresh online faculty every 30 seconds
    const onlineRefresh = setInterval(() => {
      refreshOnlineFaculty()
    }, 30000)
    
    return () => {
      clearInterval(timer)
      clearInterval(onlineRefresh)
    }
  }, [])

  // Function to refresh just the online faculty list
  const refreshOnlineFaculty = async () => {
    try {
      // Consider faculty "online" if they logged in within the last 30 minutes
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
      const { data: fallbackData, error } = await supabase.from('users')
        .select('id, full_name, email, department, last_login, avatar_url')
        .eq('role', 'faculty')
        .not('last_login', 'is', null)
        .gte('last_login', thirtyMinutesAgo)
        .order('last_login', { ascending: false })
      
      if (!error && fallbackData) {
        setOnlineFaculty(fallbackData)
        setStats(prev => ({ ...prev, onlineFaculty: fallbackData.length }))
      }
    } catch (err) {
      console.error('Failed to refresh online faculty:', err)
    }
  }

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/')
        return
      }
      if (session.user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        router.push('/faculty/home')
        return
      }
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/')
    }
  }

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      // Fetch stats in parallel
      const [
        roomsResult,
        facultyResult,
        coursesResult,
        sectionsResult,
        schedulesResult,
        defaultScheduleResult
      ] = await Promise.all([
        supabase.from('campuses').select('id', { count: 'exact', head: true }),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'faculty'),
        supabase.from('section_courses').select('id', { count: 'exact', head: true }),
        supabase.from('sections').select('id', { count: 'exact', head: true }),
        supabase.from('generated_schedules').select('id', { count: 'exact', head: true }),
        supabase.from('generated_schedules')
          .select('*')
          .order('is_current', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1)
      ])

      // Fetch online faculty from presence API
      let onlineFacultyData: OnlineFaculty[] = []
      try {
        const presenceResponse = await fetch('/api/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_online_faculty' })
        })
        
        // Check if response is JSON
        const contentType = presenceResponse.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          const presenceData = await presenceResponse.json()
          if (presenceData.success && presenceData.faculty) {
            onlineFacultyData = presenceData.faculty.map((f: any) => ({
              id: f.id,
              full_name: f.full_name,
              email: f.email,
              department: f.department,
              last_login: f.last_heartbeat,
              avatar_url: f.avatar_url
            }))
          }
        }
      } catch (presenceError) {
        console.error('Failed to fetch online faculty:', presenceError)
      }
      
      // Fallback to last_login method if presence API returned no results
      if (onlineFacultyData.length === 0) {
        // Consider faculty "online" if they logged in within the last 30 minutes
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
        const { data: fallbackData, error: fallbackError } = await supabase.from('users')
          .select('id, full_name, email, department, last_login, avatar_url')
          .eq('role', 'faculty')
          .not('last_login', 'is', null)
          .gte('last_login', thirtyMinutesAgo)
          .order('last_login', { ascending: false })
        
        if (fallbackError) {
          const hasDetails = typeof fallbackError === 'object' && fallbackError !== null && Object.keys(fallbackError).length > 0
          if (hasDetails) {
            console.warn('Failed to fetch online faculty fallback:', fallbackError)
          }
          onlineFacultyData = []
        } else {
          console.log('Online faculty fallback data:', fallbackData?.length, 'faculty found')
          onlineFacultyData = fallbackData || []
        }
      }

      setStats({
        totalRooms: roomsResult.count || 0,
        totalFaculty: facultyResult.count || 0,
        totalCourses: coursesResult.count || 0,
        totalSections: sectionsResult.count || 0,
        activeSchedules: schedulesResult.count || 0,
        onlineFaculty: onlineFacultyData.length
      })

      setOnlineFaculty(onlineFacultyData)

      if (defaultScheduleResult.data && defaultScheduleResult.data.length > 0) {
        const schedule = defaultScheduleResult.data[0] as {
          id: number
          schedule_name?: string
          academic_year?: string
          semester?: string
          created_at: string
        }
        const { count } = await supabase
          .from('room_allocations')
          .select('id', { count: 'exact', head: true })
          .eq('schedule_id', schedule.id)

        setCurrentSchedule({
          id: schedule.id,
          name: schedule.schedule_name || `Schedule #${schedule.id}`,
          academic_year: schedule.academic_year || '2024-2025',
          semester: schedule.semester || '1st Semester',
          is_default: true,
          created_at: schedule.created_at,
          total_classes: count || 0
        })
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()
    
    const days: (number | null)[] = []
    for (let i = 0; i < startingDay; i++) {
      days.push(null)
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i)
    }
    return days
  }

  const getHolidayForDate = (day: number) => {
    if (!calendarDate) return undefined
    const dateStr = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return philippineHolidays[dateStr]
  }

  const isToday = (day: number) => {
    if (!calendarDate) return false
    const today = new Date()
    return day === today.getDate() && 
           calendarDate.getMonth() === today.getMonth() && 
           calendarDate.getFullYear() === today.getFullYear()
  }

  const prevMonth = () => {
    if (!calendarDate) return
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    if (!calendarDate) return
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))
  }

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  }

  // Quick navigation items - using nature-inspired theme colors
  const quickNavItems = [
    { icon: DoorOpen, label: 'Rooms Management', path: '/LandingPages/RoomsManagement', color: '#2EAF7D', desc: 'Manage rooms & buildings' },
    { icon: Users, label: 'Faculty Management', path: '/LandingPages/FacultyManagement/FacultyApproval', color: '#449342', desc: 'Approve & manage faculty' },
    { icon: BookOpen, label: 'Courses Management', path: '/LandingPages/CoursesManagement', color: '#3FD0C9', desc: 'Manage courses & sections' },
    { icon: Zap, label: 'Generate Schedule', path: '/LandingPages/RoomSchedule/GenerateSchedule', color: '#2EAF7D', desc: 'Create new schedules' },
    { icon: Eye, label: 'View Schedules', path: '/LandingPages/RoomSchedule/ViewSchedule', color: '#449342', desc: 'View generated schedules' },
    { icon: Upload, label: 'Upload CSV', path: '/LandingPages/UploadCSV', color: '#3FD0C9', desc: 'Import data from CSV' },
    { icon: GraduationCap, label: 'Faculty Colleges', path: '/LandingPages/FacultyColleges', color: '#2EAF7D', desc: 'Manage college assignments' },
    { icon: MapPin, label: 'Floor Plans', path: '/floor-plan/admin', color: '#449342', desc: 'View & edit floor plans' },
  ]

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // Get upcoming holidays
  const getUpcomingHolidays = () => {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    
    return Object.entries(philippineHolidays)
      .filter(([date]) => date >= todayStr)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 5)
      .map(([date, name]) => ({
        date: new Date(date),
        name
      }))
  }

  return (
    <div className="admin-dashboard" data-page="admin">
      <MenuBar
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        showSidebarToggle={true}
        showAccountIcon={true}
        setSidebarOpen={setSidebarOpen}
      />
      <Sidebar isOpen={sidebarOpen} />

      <main className={`dashboard-main ${sidebarOpen ? 'with-sidebar' : 'full-width'}`}>
        <div className="dashboard-container">
          
          {/* Header Section */}
          <header className="dashboard-header">
            <div className="header-content">
              <div className="header-text">
                <h1 className="dashboard-title">
                  <LayoutDashboard size={36} />
                  Admin Dashboard
                </h1>
                <p className="dashboard-subtitle">
                  Welcome back! Here's what's happening today.
                </p>
              </div>
              <div className="header-time">
                <div className="current-time">{currentDate ? currentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</div>
                <div className="current-date">{currentDate ? currentDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Loading...'}</div>
              </div>
            </div>
          </header>

          {loading ? (
            <div className="loading-state">
              <Activity className="loading-spinner" size={40} />
              <p>Loading dashboard...</p>
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              <section className="stats-section">
                <div className="stats-grid">
                  <div className="stat-card" onClick={() => router.push('/LandingPages/RoomsManagement')}>
                    <div className="stat-icon rooms">
                      <DoorOpen size={28} />
                    </div>
                    <div className="stat-info">
                      <span className="stat-value">{stats.totalRooms}</span>
                      <span className="stat-label">Total Rooms</span>
                    </div>
                  </div>
                  <div className="stat-card" onClick={() => router.push('/LandingPages/FacultyManagement/FacultyApproval')}>
                    <div className="stat-icon faculty">
                      <Users size={28} />
                    </div>
                    <div className="stat-info">
                      <span className="stat-value">{stats.totalFaculty}</span>
                      <span className="stat-label">Faculty Members</span>
                    </div>
                  </div>
                  <div className="stat-card" onClick={() => router.push('/LandingPages/CoursesManagement')}>
                    <div className="stat-icon courses">
                      <BookOpen size={28} />
                    </div>
                    <div className="stat-info">
                      <span className="stat-value">{stats.totalCourses}</span>
                      <span className="stat-label">Total Courses</span>
                    </div>
                  </div>
                  <div className="stat-card" onClick={() => router.push('/LandingPages/CoursesManagement')}>
                    <div className="stat-icon sections">
                      <GraduationCap size={28} />
                    </div>
                    <div className="stat-info">
                      <span className="stat-value">{stats.totalSections}</span>
                      <span className="stat-label">Sections</span>
                    </div>
                  </div>
                  <div className="stat-card highlight" onClick={() => router.push('/LandingPages/RoomSchedule/ViewSchedule')}>
                    <div className="stat-icon schedules">
                      <CalendarDays size={28} />
                    </div>
                    <div className="stat-info">
                      <span className="stat-value">{stats.activeSchedules}</span>
                      <span className="stat-label">Active Schedules</span>
                    </div>
                  </div>
                  <div className="stat-card online">
                    <div className="stat-icon online-indicator">
                      <Activity size={28} />
                    </div>
                    <div className="stat-info">
                      <span className="stat-value">{stats.onlineFaculty}</span>
                      <span className="stat-label">Faculty Online</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Main Content Grid */}
              <div className="dashboard-grid">
                
                {/* Left Column */}
                <div className="dashboard-column left">
                  
                  {/* Online Faculty */}
                  <section className="dashboard-card online-faculty-card">
                    <div className="card-header">
                      <h2>
                        <UserCheck size={22} />
                        Faculty Currently Online
                      </h2>
                      <span className="online-count">{onlineFaculty.length} active</span>
                    </div>
                    <div className="card-content">
                      {onlineFaculty.length === 0 ? (
                        <div className="empty-list">
                          <Users size={40} />
                          <p>No faculty currently online</p>
                        </div>
                      ) : (
                        <div className="online-list">
                          {onlineFaculty.map((faculty) => (
                            <div key={faculty.id} className="online-item">
                              <div className="faculty-avatar">
                                {faculty.avatar_url ? (
                                  <img src={faculty.avatar_url} alt={faculty.full_name} />
                                ) : (
                                  <span>{faculty.full_name?.charAt(0) || 'F'}</span>
                                )}
                                <span className="online-dot"></span>
                              </div>
                              <div className="faculty-info">
                                <span className="faculty-name">{faculty.full_name || 'Faculty Member'}</span>
                                <span className="faculty-dept">{faculty.department || 'No Department'}</span>
                              </div>
                              <div className="login-time">
                                <Clock size={14} />
                                {formatTimeAgo(faculty.last_login)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Current Schedule */}
                  <section className="dashboard-card schedule-card">
                    <div className="card-header">
                      <h2>
                        <CalendarDays size={22} />
                        Current Schedule
                      </h2>
                      {currentSchedule && <Star size={18} className="default-star" />}
                    </div>
                    <div className="card-content">
                      {currentSchedule ? (
                        <div className="schedule-info">
                          <div className="schedule-name">{currentSchedule.name}</div>
                          <div className="schedule-details">
                            <div className="detail-row">
                              <span className="detail-label">Academic Year:</span>
                              <span className="detail-value">{currentSchedule.academic_year}</span>
                            </div>
                            <div className="detail-row">
                              <span className="detail-label">Semester:</span>
                              <span className="detail-value">{currentSchedule.semester}</span>
                            </div>
                            <div className="detail-row">
                              <span className="detail-label">Total Classes:</span>
                              <span className="detail-value highlight">{currentSchedule.total_classes}</span>
                            </div>
                            <div className="detail-row">
                              <span className="detail-label">Created:</span>
                              <span className="detail-value">{new Date(currentSchedule.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <button 
                            className="view-schedule-btn"
                            onClick={() => router.push(`/LandingPages/RoomSchedule/ViewSchedule?id=${currentSchedule.id}`)}
                          >
                            <Eye size={18} />
                            View Full Schedule
                          </button>
                        </div>
                      ) : (
                        <div className="empty-list">
                          <CalendarDays size={40} />
                          <p>No schedule generated yet</p>
                          <button 
                            className="generate-btn"
                            onClick={() => router.push('/LandingPages/RoomSchedule/GenerateSchedule')}
                          >
                            <Zap size={18} />
                            Generate Schedule
                          </button>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Upcoming Holidays */}
                  <section className="dashboard-card holidays-card">
                    <div className="card-header">
                      <h2>
                        <Bell size={22} />
                        Upcoming Holidays
                      </h2>
                    </div>
                    <div className="card-content">
                      <div className="holidays-list">
                        {getUpcomingHolidays().map((holiday, idx) => (
                          <div key={idx} className="holiday-item">
                            <div className="holiday-date">
                              <span className="holiday-day">{holiday.date.getDate()}</span>
                              <span className="holiday-month">{monthNames[holiday.date.getMonth()].slice(0, 3)}</span>
                            </div>
                            <span className="holiday-name">{holiday.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                </div>

                {/* Right Column */}
                <div className="dashboard-column right">
                  
                  {/* Calendar */}
                  <section className="dashboard-card calendar-card">
                    <div className="card-header">
                      <h2>
                        <Calendar size={22} />
                        {calendarDate ? `${monthNames[calendarDate.getMonth()]} ${calendarDate.getFullYear()}` : 'Loading...'}
                      </h2>
                      <div className="calendar-nav">
                        <button onClick={prevMonth}><ChevronLeft size={20} /></button>
                        <button onClick={nextMonth}><ChevronRight size={20} /></button>
                      </div>
                    </div>
                    <div className="card-content">
                      <div className="calendar-grid">
                        <div className="calendar-header">
                          {dayNames.map(day => (
                            <div key={day} className="calendar-day-name">{day}</div>
                          ))}
                        </div>
                        <div className="calendar-days">
                          {calendarDate && getDaysInMonth(calendarDate).map((day, idx) => {
                            const holiday = day ? getHolidayForDate(day) : null
                            return (
                              <div 
                                key={idx} 
                                className={`calendar-day ${!day ? 'empty' : ''} ${day && isToday(day) ? 'today' : ''} ${holiday ? 'holiday' : ''}`}
                                title={holiday || ''}
                              >
                                {day && (
                                  <>
                                    <span className="day-number">{day}</span>
                                    {holiday && <span className="holiday-dot"></span>}
                                  </>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      <div className="calendar-legend">
                        <div className="legend-item">
                          <span className="legend-dot today"></span>
                          <span>Today</span>
                        </div>
                        <div className="legend-item">
                          <span className="legend-dot holiday"></span>
                          <span>Holiday</span>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Quick Navigation */}
                  <section className="dashboard-card quick-nav-card">
                    <div className="card-header">
                      <h2>
                        <TrendingUp size={22} />
                        Quick Navigation
                      </h2>
                    </div>
                    <div className="card-content">
                      <div className="quick-nav-grid">
                        {quickNavItems.map((item, idx) => (
                          <button 
                            key={idx} 
                            className="quick-nav-item"
                            onClick={() => router.push(item.path)}
                            style={{ '--nav-color': item.color } as React.CSSProperties}
                          >
                            <div className="nav-icon">
                              <item.icon size={24} />
                            </div>
                            <div className="nav-info">
                              <span className="nav-label">{item.label}</span>
                              <span className="nav-desc">{item.desc}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
