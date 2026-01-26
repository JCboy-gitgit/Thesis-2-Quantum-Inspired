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
  RefreshCw
} from 'lucide-react'
import styles from './styles.module.css'
import FacultySidebar from '@/app/components/FacultySidebar'
import RoomViewer2D from '@/app/components/RoomViewer2D'
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

  const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL

  useEffect(() => {
    checkAuthAndLoad()
    updateGreeting()
    
    // Update greeting every minute
    const interval = setInterval(updateGreeting, 60000)
    return () => clearInterval(interval)
  }, [])

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

      setUser(userData)
      
      // Set college theme based on user's college/department
      if (userData.college) {
        const collegeLower = userData.college.toLowerCase()
        const matchedTheme = COLLEGE_THEME_MAP[collegeLower]
        if (matchedTheme) {
          setCollegeTheme(matchedTheme)
        }
      }

      // Fetch schedules for this faculty (mock data for now)
      await fetchSchedules(userData.email)

    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/faculty/login')
    } finally {
      setLoading(false)
    }
  }

  const fetchSchedules = async (email: string) => {
    try {
      // Try to fetch from schedule_assignments if available
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
      <div className={styles.loadingScreen}>
        <div className={styles.spinner}></div>
        <p>Loading your dashboard...</p>
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
      <div className={`${styles.mainLayout} ${sidebarOpen ? styles.withSidebar : styles.fullWidth}`}>
        {/* Top Header */}
        <header className={`${styles.topHeader} ${isMenuBarHidden ? styles.hidden : ''}`}>
          <div className={styles.headerLeft}>
            {/* Sidebar Toggle Button */}
            <button 
              className={styles.sidebarToggle}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
            >
              <Menu size={24} />
            </button>
            
            {/* Logo/Branding */}
            <div className={styles.logo}>
              <span className={styles.logoIcon}>Q</span>
              <span className={styles.logoText}>Qtime Faculty</span>
            </div>
          </div>
          <div className={styles.headerRight}>
            {/* Notifications */}
            <button className={styles.iconBtn} title="Notifications">
              <Bell size={20} />
            </button>

            {/* User Dropdown */}
            <div className={styles.userSection}>
              <button 
                className={styles.userIconBtn}
                onClick={() => setShowUserMenu(!showUserMenu)}
                title="Account Menu"
              >
                <User size={20} />
              </button>
              
              {showUserMenu && (
                <div className={styles.userMenu}>
                  {user?.email && (
                    <>
                      <div className={styles.userMenuEmail}>
                        <User size={16} />
                        {user.email}
                      </div>
                      <div className={styles.menuDivider} />
                    </>
                  )}
                  <button
                    className={styles.userMenuItem}
                    onClick={() => {
                      setShowUserMenu(false)
                      router.push('/faculty/profile')
                    }}
                  >
                    <User size={16} />
                    Profile
                  </button>
                  <button
                    className={styles.userMenuItem}
                    onClick={() => {
                      setShowUserMenu(false)
                      setShowSettingsModal(true)
                    }}
                  >
                    <Settings size={16} />
                    Settings
                  </button>
                  <div className={styles.menuDivider} />
                  <button
                    className={`${styles.userMenuItem} ${styles.logoutItem}`}
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
              )}
            </div>
          </div>

          {/* Toggle Arrow Button - inside header */}
          <button 
            className={styles.menuBarToggle}
            onClick={() => setIsMenuBarHidden(!isMenuBarHidden)}
            title={isMenuBarHidden ? 'Show Header' : 'Hide Header'}
          >
            <ChevronUp size={18} />
          </button>
        </header>

        {/* Floating Show Button when header is hidden */}
        {isMenuBarHidden && (
          <button 
            className={styles.menuBarShowBtn}
            onClick={() => setIsMenuBarHidden(false)}
            title="Show Header"
          >
            <ChevronDown size={18} />
          </button>
        )}

        {/* Main Content */}
        <main className={styles.mainContent}>
          {/* Welcome Banner */}
          <section className={styles.welcomeBanner}>
            <div>
              <h2>{greeting}, {user?.full_name?.split(' ')[0] || 'Faculty'}!</h2>
              <p>{getCurrentDate()}</p>
            </div>
            {user?.department && (
              <div className={styles.bannerInfo}>
                <div className={styles.infoBadge}>
                  <Building2 size={16} />
                  <span>{user.department}</span>
                </div>
              </div>
            )}
          </section>

          {/* Quick Stats */}
          <section className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <Calendar size={24} />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statValue}>{todayClassCount}</div>
                <div className={styles.statLabel}>Classes Today</div>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <BookOpen size={24} />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statValue}>{schedules.length}</div>
                <div className={styles.statLabel}>Total Classes This Week</div>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <Clock size={24} />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statValue}>{currentClass ? 'In Progress' : 'Free'}</div>
                <div className={styles.statLabel}>Current Status</div>
              </div>
            </div>
          </section>

          {/* Current & Next Class */}
          <section className={styles.classSection}>
            <h3 className={styles.sectionTitle}>My Classes</h3>
            <div className={styles.classCards}>
              <div className={`${styles.classCard} ${currentClass ? styles.active : ''}`}>
                <div className={styles.classCardHeader}>
                  {currentClass ? (
                    <>
                      <span className={styles.liveIndicator}>
                        <span className={styles.liveDot}></span>
                        NOW
                      </span>
                      <span className={styles.classTime}>
                        {formatTime(currentClass.start_time)} - {formatTime(currentClass.end_time)}
                      </span>
                    </>
                  ) : (
                    <span className={styles.statusBadge}>NO CLASS</span>
                  )}
                </div>
                <div className={styles.classBody}>
                  {currentClass ? (
                    <>
                      <h4>{currentClass.course_code}</h4>
                      <p className={styles.courseName}>{currentClass.course_name}</p>
                      <div className={styles.classDetails}>
                        <span><MapPin size={14} /> {currentClass.room}, {currentClass.building}</span>
                        <span><BookOpen size={14} /> {currentClass.section}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <h4>Free Time</h4>
                      <p className={styles.courseName}>No ongoing class at the moment</p>
                    </>
                  )}
                </div>
              </div>

              <div className={`${styles.classCard} ${nextClass ? styles.upcoming : ''}`}>
                <div className={styles.classCardHeader}>
                  {nextClass ? (
                    <>
                      <span className={styles.statusBadge}>NEXT UP</span>
                      <span className={styles.classTime}>
                        {formatTime(nextClass.start_time)}
                      </span>
                    </>
                  ) : (
                    <span className={styles.statusBadge}>FINISHED</span>
                  )}
                </div>
                <div className={styles.classBody}>
                  {nextClass ? (
                    <>
                      <h4>{nextClass.course_code}</h4>
                      <p className={styles.courseName}>{nextClass.course_name}</p>
                      <div className={styles.classDetails}>
                        <span><MapPin size={14} /> {nextClass.room}, {nextClass.building}</span>
                        <span><BookOpen size={14} /> {nextClass.section}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <h4>All Done!</h4>
                      <p className={styles.courseName}>No more classes for today</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Today's Schedule */}
          <section className={styles.scheduleSection}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>
                <Calendar size={20} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
                Today's Schedule
              </h3>
              <button className={styles.iconBtn} onClick={checkAuthAndLoad} title="Refresh">
                <RefreshCw size={18} />
              </button>
            </div>
            {schedules.filter(s => s.day === ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()]).length > 0 ? (
              <div className={styles.scheduleList}>
                {schedules
                  .filter(s => s.day === ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()])
                  .map((schedule, index) => (
                    <div key={index} className={styles.scheduleItem}>
                      <div className={styles.scheduleTime}>
                        <Clock size={16} />
                        <span>{formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}</span>
                      </div>
                      <div className={styles.scheduleInfo}>
                        <h4>{schedule.course_code} - {schedule.course_name}</h4>
                        <p>
                          <MapPin size={12} /> {schedule.room}, {schedule.building}
                          <span className={styles.separator}>•</span>
                          <BookOpen size={12} /> {schedule.section}
                        </p>
                      </div>
                      <ChevronRight size={18} className={styles.chevron} />
                    </div>
                  ))}
              </div>
            ) : (
              <div className={styles.emptySchedule}>
                <Calendar size={64} style={{ opacity: 0.3, marginBottom: '16px' }} />
                <h3>No Schedule Today</h3>
                <p>Your schedule will appear here once assigned by the admin.</p>
              </div>
            )}
          </section>

          {/* Room Viewer 2D */}
          <section className={styles.roomViewerSection}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Campus Map</h3>
              <span className={styles.viewOnlyBadge}>View Only</span>
            </div>
            <div className={styles.roomViewerContainer}>
              <RoomViewer2D />
            </div>
          </section>

          {/* Department Announcements Placeholder */}
          <section className={styles.announcementsSection}>
            <h3 className={styles.sectionTitle}>Department Announcements</h3>
            <div className={styles.announcementCard}>
              <TrendingUp size={20} />
              <div>
                <h4>Welcome to QTime Faculty Portal</h4>
                <p>Stay updated with your schedule, faculty directory, and department information all in one place.</p>
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
    </div>
  )
}
