'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  LogOut,
  Settings,
  Bell,
  BookOpen,
  ChevronRight,
  Building2,
  GraduationCap,
  RefreshCw
} from 'lucide-react'
import styles from './styles.module.css'

interface UserProfile {
  id: string
  email: string
  full_name: string
  department: string
  role: string
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
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [currentClass, setCurrentClass] = useState<ScheduleItem | null>(null)
  const [nextClass, setNextClass] = useState<ScheduleItem | null>(null)
  const [greeting, setGreeting] = useState('')

  const ADMIN_EMAIL = 'admin123@ms.bulsu.edu.ph'

  useEffect(() => {
    checkAuthAndLoad()
    updateGreeting()
    
    // Update greeting every minute
    const interval = setInterval(updateGreeting, 60000)
    return () => clearInterval(interval)
  }, [])

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

      if (userError || !userData || (userData as any).status !== 'approved') {
        await supabase.auth.signOut()
        router.push('/faculty/login')
        return
      }

      setUser(userData)

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
    await supabase.auth.signOut()
    router.push('/faculty/login')
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
    <div className={styles.pageContainer}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>Q</span>
            <span className={styles.logoText}>Qtime Faculty</span>
          </div>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.iconBtn} title="Notifications">
            <Bell size={20} />
          </button>
          <button className={styles.iconBtn} onClick={() => router.push('/faculty/profile')} title="Profile">
            <Settings size={20} />
          </button>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.mainContent}>
        {/* Welcome Section */}
        <section className={styles.welcomeSection}>
          <div className={styles.welcomeContent}>
            <div className={styles.userAvatar}>
              <User size={40} />
            </div>
            <div className={styles.welcomeText}>
              <h1>{greeting}, {user?.full_name?.split(' ')[0] || 'Faculty'}!</h1>
              <p>{getCurrentDate()}</p>
            </div>
          </div>
          <div className={styles.userInfo}>
            <div className={styles.infoBadge}>
              <Building2 size={16} />
              <span>{user?.department || 'Department'}</span>
            </div>
            <div className={styles.infoBadge}>
              <GraduationCap size={16} />
              <span>Faculty Member</span>
            </div>
          </div>
        </section>

        {/* Current/Next Class Cards */}
        <section className={styles.classCards}>
          {currentClass ? (
            <div className={`${styles.classCard} ${styles.currentClass}`}>
              <div className={styles.classCardHeader}>
                <span className={styles.liveIndicator}>
                  <span className={styles.liveDot}></span>
                  NOW
                </span>
                <span className={styles.classTime}>
                  {formatTime(currentClass.start_time)} - {formatTime(currentClass.end_time)}
                </span>
              </div>
              <h3>{currentClass.course_code}</h3>
              <p className={styles.courseName}>{currentClass.course_name}</p>
              <div className={styles.classDetails}>
                <span><MapPin size={14} /> {currentClass.room}, {currentClass.building}</span>
                <span><BookOpen size={14} /> {currentClass.section}</span>
              </div>
            </div>
          ) : (
            <div className={`${styles.classCard} ${styles.noClass}`}>
              <div className={styles.classCardHeader}>
                <span className={styles.statusBadge}>FREE TIME</span>
              </div>
              <h3>No Current Class</h3>
              <p className={styles.courseName}>Enjoy your break!</p>
            </div>
          )}

          {nextClass ? (
            <div className={`${styles.classCard} ${styles.nextClass}`}>
              <div className={styles.classCardHeader}>
                <span className={styles.statusBadge}>NEXT UP</span>
                <span className={styles.classTime}>
                  {formatTime(nextClass.start_time)}
                </span>
              </div>
              <h3>{nextClass.course_code}</h3>
              <p className={styles.courseName}>{nextClass.course_name}</p>
              <div className={styles.classDetails}>
                <span><MapPin size={14} /> {nextClass.room}, {nextClass.building}</span>
              </div>
            </div>
          ) : (
            <div className={`${styles.classCard} ${styles.noClass}`}>
              <div className={styles.classCardHeader}>
                <span className={styles.statusBadge}>TODAY</span>
              </div>
              <h3>No More Classes</h3>
              <p className={styles.courseName}>You're done for today!</p>
            </div>
          )}
        </section>

        {/* Today's Schedule */}
        <section className={styles.scheduleSection}>
          <div className={styles.sectionHeader}>
            <h2><Calendar size={22} /> Today's Schedule</h2>
            <button className={styles.refreshBtn} onClick={() => fetchSchedules(user?.email || '')}>
              <RefreshCw size={16} />
            </button>
          </div>

          {schedules.length > 0 ? (
            <div className={styles.scheduleList}>
              {schedules
                .filter(s => s.day === ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()])
                .map((schedule, index) => (
                  <div key={index} className={styles.scheduleItem}>
                    <div className={styles.scheduleTime}>
                      <Clock size={14} />
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
              <Calendar size={48} />
              <h3>No Schedule Today</h3>
              <p>Your schedule will appear here once assigned by the admin.</p>
            </div>
          )}
        </section>

        {/* Quick Actions */}
        <section className={styles.quickActions}>
          <h2>Quick Actions</h2>
          <div className={styles.actionGrid}>
            <button className={styles.actionCard} onClick={() => router.push('/faculty/profile')}>
              <User size={24} />
              <span>Edit Profile</span>
            </button>
            <button className={styles.actionCard} onClick={() => router.push('/faculty/schedule')}>
              <Calendar size={24} />
              <span>Full Schedule</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}
