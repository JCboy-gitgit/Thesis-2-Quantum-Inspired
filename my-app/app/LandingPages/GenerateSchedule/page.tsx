'use client'
import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './GenerateSchedule.module.css'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase (client-side) safely
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null
const getSupabase = () => {
  if (!supabase) throw new Error('Supabase client not initialized. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.')
  return supabase
}

interface CampusFile {
  upload_group_id: number
  school_name: string
  file_name: string
  row_count: number
  total_capacity: number
}

interface ParticipantFile {
  upload_group_id: number
  batch_name: string
  file_name: string
  row_count: number
  pwd_count?: number
}

interface ScheduleConfig {
  campusGroupId: number | null
  participantGroupId: number | null
  eventName: string
  eventType: 'Admission_Test' | 'Enrollment' | 'Orientation' | 'Custom'
  scheduleDate: string
  startTime: string
  endDate: string
  endTime: string
  durationPerBatch: number
  durationUnit: 'minutes' | 'hours'
  prioritizePWD: boolean
  emailNotification: boolean
  excludeLunchBreak: boolean
  lunchBreakStart: string
  lunchBreakEnd: string
}

interface ScheduleResult {
  success: boolean
  message: string
  scheduled_count: number
  unscheduled_count: number
  execution_time: number
  schedule_data: any[]
  schedule_summary_id?: number
  pwd_stats?: {
    pwd_scheduled: number
    pwd_unscheduled: number
    non_pwd_scheduled: number
    non_pwd_unscheduled: number
  }
}

// Helper to fetch ALL rows
async function fetchAllRows(table: string, filters: any = {}) {
  const PAGE_SIZE = 1000
  let allData: any[] = []
  let page = 0
  let hasMore = true

  while (hasMore) {
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = getSupabase()
      .from(table)
      .select('*')
      .range(from, to)
      .order('id', { ascending: true })

    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key as string, value as any)
    }

    const { data, error } = await query
    if (error) throw error
    if (!data || data.length === 0) {
      hasMore = false
      break
    }

    allData = [...allData, ...data]
    if (data.length < PAGE_SIZE) hasMore = false
    page++
  }

  return allData
}

export default function GenerateSchedulePage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [scheduling, setScheduling] = useState(false)
  const [campusFiles, setCampusFiles] = useState<CampusFile[]>([])
  const [participantFiles, setParticipantFiles] = useState<ParticipantFile[]>([])
  const [config, setConfig] = useState<ScheduleConfig>({
    campusGroupId: null,
    participantGroupId: null,
    eventName: '',
    eventType: 'Admission_Test',
    scheduleDate: '',
    startTime: '09:00',
    endDate: '',
    endTime: '16:00',
    durationPerBatch: 3,
    durationUnit: 'hours',
    prioritizePWD: false,
    emailNotification: false,
    excludeLunchBreak: true,
    lunchBreakStart: '12:00',
    lunchBreakEnd: '13:00',
  })
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [pwdCounts, setPwdCounts] = useState<{ [key: number]: number }>({})
  const [roomData, setRoomData] = useState<{ [key: number]: any[] }>({})
  const [timer, setTimer] = useState(0)
  const [timerActive, setTimerActive] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { fetchData() }, [])
  useEffect(() => {
    if (config.scheduleDate && !config.endDate) {
      setConfig(prev => ({ ...prev, endDate: prev.scheduleDate }))
    }
  }, [config.scheduleDate])

  const fetchPwdCount = async (uploadGroupId: number) => {
    const { count, error } = await getSupabase()
      .from('participants')
      .select('*', { count: 'exact', head: false })
      .eq('upload_group_id', uploadGroupId)
      .eq('is_pwd', true)
    if (error) return 0
    return count || 0
  }

  useEffect(() => {
    if (config.participantGroupId) {
      fetchPwdCount(config.participantGroupId).then(count => {
        setPwdCounts(prev => ({
          ...prev,
          [config.participantGroupId!]: count
        }))
      })
    }
  }, [config.participantGroupId])

  const getDurationInMinutes = () => config.durationUnit === 'hours'
    ? config.durationPerBatch * 60
    : config.durationPerBatch

  const isValidDateRange = () => {
    if (!config.scheduleDate || !config.endDate) return false
    const startDate = new Date(config.scheduleDate)
    const endDate = new Date(config.endDate)
    if (startDate < endDate) return true
    if (config.scheduleDate === config.endDate) {
      const startDateTime = new Date(`${config.scheduleDate}T${config.startTime}`)
      const endDateTime = new Date(`${config.endDate}T${config.endTime}`)
      return endDateTime > startDateTime
    }
    return false
  }

  const getDateRangeError = () => {
    if (!config.scheduleDate || !config.endDate) return ''
    const startDate = new Date(config.scheduleDate)
    const endDate = new Date(config.endDate)
    if (startDate > endDate) return 'End date must be on or after start date'
    if (config.scheduleDate === config.endDate) {
      const startDateTime = new Date(`${config.scheduleDate}T${config.startTime}`)
      const endDateTime = new Date(`${config.endDate}T${config.endTime}`)
      if (endDateTime <= startDateTime) return 'End time must be after start time on the same day'
    }
    return ''
  }

  const getLunchBreakMinutes = () => {
    if (!config.excludeLunchBreak) return 0
    const [startH, startM] = config.lunchBreakStart.split(':').map(Number)
    const [endH, endM] = config.lunchBreakEnd.split(':').map(Number)
    const lunchMinutes = (endH * 60 + endM) - (startH * 60 + startM)
    return lunchMinutes > 0 ? lunchMinutes : 0
  }

  // ✅ ADD THIS NEW FUNCTION
  const getSlotsPerDay = () => {
    if (!config.startTime || !config.endTime) return 0
    
    const [startHour, startMin] = config.startTime.split(':').map(Number)
    const [endHour, endMin] = config.endTime.split(':').map(Number)
    
    let dailyMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin)
    
    // Subtract lunch break
    dailyMinutes -= getLunchBreakMinutes()
    
    const durationInMinutes = getDurationInMinutes()
    
    if (dailyMinutes <= 0 || durationInMinutes <= 0) return 0
    
    return Math.floor(dailyMinutes / durationInMinutes)
  }

  const getTotalAvailableMinutes = () => {
    if (!config.scheduleDate || !config.endDate) return 0
    const startDate = new Date(config.scheduleDate)
    const endDate = new Date(config.endDate)
    const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const [startHour, startMin] = config.startTime.split(':').map(Number)
    const [endHour, endMin] = config.endTime.split(':').map(Number)
    let dailyMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin)
    dailyMinutes -= getLunchBreakMinutes()
    const totalDays = daysDiff + 1
    return Math.max(0, dailyMinutes * totalDays)
  }

  const fetchRoomsForCampus = async (uploadGroupId: number) => {
    const rooms = await fetchAllRows('campuses', { upload_group_id: uploadGroupId })
    return rooms
  }

  useEffect(() => {
    if (config.campusGroupId) {
      fetchRoomsForCampus(config.campusGroupId).then(rooms => {
        setRoomData(prev => ({
          ...prev,
          [config.campusGroupId!]: rooms
        }))
      })
    }
  }, [config.campusGroupId])

  const getDays = () => {
    if (!config.scheduleDate || !config.endDate) return 0
    const startDate = new Date(config.scheduleDate)
    const endDate = new Date(config.endDate)
    return Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const campusData = await fetchAllRows('campuses')
      const campusGrouped = campusData.reduce((acc: any[], curr: any) => {
        const existing = acc.find(item => item.upload_group_id === curr.upload_group_id)
        if (existing) {
          existing.row_count++
          existing.total_capacity += (curr.capacity || 30)
        } else {
          acc.push({
            upload_group_id: curr.upload_group_id,
            school_name: curr.school_name,
            file_name: curr.file_name,
            row_count: 1,
            total_capacity: curr.capacity || 30
          })
        }
        return acc
      }, [])
      const participantData = await fetchAllRows('participants')
      const participantGrouped = participantData.reduce((acc: any[], curr: any) => {
        const existing = acc.find(item => item.upload_group_id === curr.upload_group_id)
        if (existing) {
          existing.row_count++
        } else {
          acc.push({
            upload_group_id: curr.upload_group_id,
            batch_name: curr.batch_name,
            file_name: curr.file_name,
            row_count: 1
          })
        }
        return acc
      }, [])
      setCampusFiles(campusGrouped || [])
      setParticipantFiles(participantGrouped || [])
      const pwdCountsMap: { [key: number]: number } = {}
      for (const group of participantGrouped) {
        const count = await fetchPwdCount(group.upload_group_id)
        pwdCountsMap[group.upload_group_id] = count
      }
      setPwdCounts(pwdCountsMap)
    } catch (error) {
      console.error('❌ Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const validateCampusData = async () => {
    if (!config.campusGroupId) return { isValid: false, error: 'No campus group selected' }
    const campusData = await fetchAllRows('campuses', { upload_group_id: config.campusGroupId })
    const invalidRows = campusData.filter((row: any) =>
      !row.campus || !row.building || !row.room || row.campus.trim() === '' || row.building.trim() === '' || row.room.trim() === ''
    )
    if (invalidRows.length > 0) {
      const errorDetails = invalidRows.map((row: any) =>
        `Row ID ${row.id}: Campus="${row.campus || 'null'}", Building="${row.building || 'null'}", Room="${row.room || 'null'}"`
      ).join('\n')
      return {
        isValid: false,
        error: `Incomplete campus data detected in your uploaded sheet. The following rows have blank/null values for campus, building, or room:\n\n${errorDetails}\n\nPlease update your Excel file and re-upload to fix these blanks before generating the schedule.`
      }
    }
    return { isValid: true, error: '' }
  }

  const handleGenerateSchedule = async () => {
    if (!config.campusGroupId || !config.participantGroupId) {
      alert('Select campus and participant groups')
      return
    }
    if (!config.scheduleDate) {
      alert('Pick a schedule date')
      return
    }

    setScheduling(true)
    setTimerActive(true)
    setTimer(0) // ✅ Reset timer

    const durationMinutes =
      config.durationUnit === 'hours' ? config.durationPerBatch * 60 : config.durationPerBatch

    const body = {
      campusGroupId: config.campusGroupId,
      participantGroupId: config.participantGroupId,
      eventName: config.eventName,
      eventType: config.eventType,
      scheduleDate: config.scheduleDate,
      startDate: config.scheduleDate,
      endDate: config.endDate || config.scheduleDate,
      startTime: config.startTime,
      endTime: config.endTime,
      durationPerBatch: durationMinutes,
      prioritizePWD: config.prioritizePWD,
      emailNotification: config.emailNotification,
      excludeLunchBreak: config.excludeLunchBreak,
      lunchBreakStart: config.lunchBreakStart,
      lunchBreakEnd: config.lunchBreakEnd,
    }

    try {
      const res = await fetch('/api/schedule/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(txt || `HTTP ${res.status}`)
      }
      const data = await res.json()
      
      // ✅ FIXED: Backend returns execution_time in seconds already
      setScheduleResult({
        success: true,
        message: 'Schedule generated successfully',
        scheduled_count: data.scheduled_count ?? 0,
        unscheduled_count: data.unscheduled_count ?? 0,
        execution_time: data.execution_time ?? 0, // Already in seconds from backend
        schedule_data: data.assignments ?? [],
        schedule_summary_id: data.schedule_summary_id,
        pwd_stats: data.pwd_stats ?? undefined
      })
      setShowResults(true)
    } catch (e: any) {
      console.error(e)
      alert(`Failed to generate schedule: ${e.message || e}`)
    } finally {
      setScheduling(false)
      setTimerActive(false)
    }
  }

  const handleReschedule = () => {
    setShowResults(false)
    setScheduleResult(null)
  }

  const handleSendEmails = async () => {
    if (!scheduleResult?.schedule_summary_id) {
      alert('No schedule ID found')
      return
    }

    try {
      const response = await fetch('/api/schedule/send-batch-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule_id: scheduleResult.schedule_summary_id })
      })
      if (!response.ok) throw new Error('Failed to send emails')
      const result = await response.json()
      alert(`✅ ${result.message}`)
    } catch (error) {
      console.error('Error sending emails:', error)
      alert('Failed to send email notifications')
    }
  }

  const getTodayDate = () => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  }

  const getScheduleDurationDisplay = () => {
    if (!config.scheduleDate || !config.endDate || !isValidDateRange()) return ''
    const start = new Date(`${config.scheduleDate}T${config.startTime}`)
    const end = new Date(`${config.endDate}T${config.endTime}`)
    const diffMs = end.getTime() - start.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    if (diffDays === 0) {
      if (diffHours === 0) return `Same day event (${diffMinutes} minutes)`
      return `Same day event (${diffHours}h ${diffMinutes}m)`
    } else if (diffDays === 1) {
      return `2-day event`
    } else {
      return `${diffDays + 1}-day event`
    }
  }

  const getCapacityEstimate = () => {
    const [firstFloorCount, upperFloorCount, _avgCapacity, firstFloorCapacity, upperFloorCapacity] =
      separateRoomsByFloor(config.campusGroupId!, roomData)

    const durationInMinutes = getDurationInMinutes()

    // Correct calculation: compute slots per day, then multiply to compute total capacity
    const slotsPerDay = getSlotsPerDay()
    const totalMinutesAllDays = getTotalAvailableMinutes()
    const days = getDays()

    const pwdCapacity = firstFloorCapacity * slotsPerDay * days
    const nonPwdCapacity = (firstFloorCapacity + upperFloorCapacity) * slotsPerDay * days
    const totalCapacity = nonPwdCapacity

    const participantGroup = participantFiles.find(p => p.upload_group_id === config.participantGroupId)
    const pwdCount = participantGroup ? (pwdCounts[participantGroup.upload_group_id] || 0) : 0
    const nonPwdCount = participantGroup ? (participantGroup.row_count - pwdCount) : 0
    const participants = participantGroup ? participantGroup.row_count : 0

    const pwdExceeded = pwdCount > pwdCapacity
    const nonPwdExceeded = nonPwdCount > nonPwdCapacity
    const canAccommodate = totalCapacity >= participants

    const roomCount = firstFloorCount + upperFloorCount

    return {
      pwdCapacity,
      nonPwdCapacity,
      totalCapacity,
      participants,
      roomCount,
      firstFloorCount,
      upperFloorCount,
      slotsPerDay,
      pwdExceeded,
      pwdCount,
      nonPwdExceeded,
      nonPwdCount,
      canAccommodate
    }
  }

  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000)
    } else {
      setTimer(0)
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [timerActive])

  return (
    <div className={styles.scheduleLayout}>
      <MenuBar
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        showSidebarToggle={true}
        showAccountIcon={true}
      />
      <Sidebar isOpen={sidebarOpen} />

      <main className={`${styles.scheduleMain} ${!sidebarOpen ? styles.fullWidth : ''}`}>
        <div className={styles.scheduleContainer}>
          <div className={styles.scheduleHeader}>
            <button className={styles.backButton}
              onClick={() => router.push('/LandingPages/QtimeHomePage')}
            >
              <span className={styles.iconBack}>←</span>
              Back to Home
            </button>
            <div className={styles.headerTitleSection}>
              <div className={styles.headerIconWrapper}>
                <svg className={styles.headerLargeIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3 10H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className={styles.headerText}>
                <h1 className={styles.scheduleTitle}>Generate Schedule</h1>
                <p className={styles.scheduleSubtitle}>Create optimized schedules with PWD priority</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner}></div>
              <p>Loading data...</p>
            </div>
          ) : scheduling ? (
            <div className={`${styles.loadingState} ${styles.entertainingLoading}`}>
              <div className={styles.spinner}></div>
              <div className={styles.loadingText}>
                Generating schedule
                <span className={styles.animatedDots}>...</span>
              </div>
              <div className={styles.timerBox}>
                <span className={styles.timerIcon}>⏳</span>
                Elapsed time:&nbsp;
                <strong>
                  {timer < 60
                    ? `${timer} seconds`
                    : `${Math.floor(timer / 60)} min ${timer % 60} sec`}
                </strong>
              </div>
              <div style={{ marginTop: 12, fontSize: 15, color: '#1565c0', fontWeight: 500 }}>
                Sit back and relax while we optimize your schedule!
              </div>
            </div>
          ) : showResults && scheduleResult ? (
            <div className={styles.resultsSection}>
              <div className={styles.statsGrid}>
                <div className={`${styles.statCard} ${styles.success}`}>
                  <div className={styles.statIcon}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                    </svg>
                  </div>
                  <div className={styles.statContent}>
                    <p className={styles.statLabel}>Scheduled</p>
                    <h3 className={styles.statValue}>{scheduleResult.scheduled_count}</h3>
                  </div>
                </div>
                <div className={`${styles.statCard} ${styles.warning}`}>
                  <div className={styles.statIcon}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                    </svg>
                  </div>
                  <div className={styles.statContent}>
                    <p className={styles.statLabel}>Unscheduled</p>
                    <h3 className={styles.statValue}>{scheduleResult.unscheduled_count}</h3>
                  </div>
                </div>
                <div className={`${styles.statCard} ${styles.info}`}>
                  <div className={styles.statIcon}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                    </svg>
                  </div>
                  <div className={styles.statContent}>
                    <p className={styles.statLabel}>Processing Time</p>
                    {/* ✅ FIXED: Format time properly - backend sends seconds */}
                    <h3 className={styles.statValue}>
                      {(() => {
                        const seconds = scheduleResult.execution_time || 0
                        if (seconds < 1) {
                          return `${(seconds * 1000).toFixed(0)}ms`
                        } else if (seconds < 60) {
                          return `${seconds.toFixed(2)}s`
                        } else {
                          const minutes = Math.floor(seconds / 60)
                          const remainingSeconds = (seconds % 60).toFixed(0)
                          return `${minutes}m ${remainingSeconds}s`
                        }
                      })()}
                    </h3>
                  </div>
                </div>
              </div>

              {/* ✅ FIXED: Also update the banner message */}
              <div className={`${styles.resultsBanner} ${scheduleResult.success ? styles.success : styles.error}`}>
                <span className={styles.resultsIcon}>
                  {scheduleResult.success ? (
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
                    </svg>
                  )}
                </span>
                <div className={styles.resultsInfo}>
                  <h2>{scheduleResult.message || 'Schedule Generated Successfully'}</h2>
                  <p>
                    Execution time: {(() => {
                      const seconds = scheduleResult.execution_time || 0
                      if (seconds < 1) {
                        return `${(seconds * 1000).toFixed(0)}ms`
                      } else if (seconds < 60) {
                        return `${seconds.toFixed(2)}s`
                      } else {
                        const minutes = Math.floor(seconds / 60)
                        const remainingSeconds = (seconds % 60).toFixed(0)
                        return `${minutes}m ${remainingSeconds}s`
                      }
                    })()}
                  </p>
                </div>
              </div>

              <div className={styles.resultsActions}>
                <button className={styles.btnSecondary} onClick={handleReschedule}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                  </svg>
                  Generate New Schedule
                </button>
                <button className={styles.btnPrimary} onClick={handleSendEmails}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                  </svg>
                  Send Email Notifications
                </button>
                <button 
                  className={styles.btnView}
                  onClick={() => router.push(`/LandingPages/GenerateSchedule/ViewSchedule?scheduleId=${scheduleResult.schedule_summary_id}`)}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8h-2v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                  </svg>
                  View Full Schedule
                </button>
              </div>

              {scheduleResult.unscheduled_count > 0 && (
                <div className={styles.warningBox}>
                  <span className={styles.warningIcon}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                    </svg>
                  </span>
                  <div className={styles.warningContent}>
                    <h4>Some participants couldn't be scheduled</h4>
                    <p>Consider adding more rooms or extending the time range.</p>
                    <button className={styles.btnLink} onClick={() => router.push('/LandingPages/BeforeQtimeHomePage')}>
                      Add More Rooms →
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.formSection}>
              <div className={styles.formCard}>
                <h2 className={styles.formSectionTitle}>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                    <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                  </svg>
                  Event Information
                </h2>
                
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Event Name *</label>
                  <input
                    type="text"
                    value={config.eventName}
                    onChange={(e) => setConfig({...config, eventName: e.target.value})}
                    placeholder="e.g., Admission Test 2024"
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Event Type *</label>
                  <select
                    value={config.eventType}
                    onChange={(e) => setConfig({...config, eventType: e.target.value as any})}
                    className={styles.formSelect}
                  >
                    <option value="Admission_Test">Admission Test</option>
                    <option value="Enrollment">Enrollment</option>
                    <option value="Orientation">Orientation</option>
                    <option value="Custom">Custom Event</option>
                  </select>
                </div>
              </div>

              <div className={styles.formCard}>
                <h2 className={styles.formSectionTitle}>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                    <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v-2H8V9h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
                  </svg>
                  Select Campus
                </h2>
                <div className={styles.selectionGrid}>
                  {campusFiles.map(file => (
                    <div 
                      key={file.upload_group_id}
                      className={`${styles.selectionCard} ${config.campusGroupId === file.upload_group_id ? styles.selected : ''}`}
                      onClick={() => setConfig({...config, campusGroupId: file.upload_group_id})}
                    >
                      <span className={styles.selectionIcon}>
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v-2H8V9h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
                        </svg>
                      </span>
                      <h3>{file.school_name}</h3>
                      <p>{file.row_count} rooms • Total capacity: {file.total_capacity}</p>
                      {config.campusGroupId === file.upload_group_id && (
                        <div className={styles.selectedBadge}>
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.formCard}>
                <h2 className={styles.formSectionTitle}>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                  </svg>
                  Select Participants
                </h2>
                <div className={styles.selectionGrid}>
                  {participantFiles.map(file => (
                    <div 
                      key={file.upload_group_id}
                      className={`${styles.selectionCard} ${config.participantGroupId === file.upload_group_id ? styles.selected : ''}`}
                      onClick={() => setConfig({...config, participantGroupId: file.upload_group_id})}
                    >
                      <span className={styles.selectionIcon}>
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                        </svg>
                      </span>
                      <h3>{file.batch_name}</h3>
                      <p>{file.row_count} participants</p>
                      {config.participantGroupId === file.upload_group_id && (
                        <div className={styles.selectedBadge}>
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.formCard}>
                <h2 className={styles.formSectionTitle}>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                    <path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 2V6M8 2V6M3 10H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Schedule Settings
                </h2>
                
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      Start Date *
                      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style={{display: 'inline', marginLeft: '6px'}}>
                        <path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z" stroke="currentColor" strokeWidth="2"/>
                        <path d="M16 2V6M8 2V6M3 10H21" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </label>
                    <input
                      type="date"
                      value={config.scheduleDate}
                      onChange={(e) => setConfig({...config, scheduleDate: e.target.value})}
                      min={getTodayDate()}
                      className={styles.formInput}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      Start Time *
                      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style={{display: 'inline', marginLeft: '6px'}}>
                        <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                      </svg>
                    </label>
                    <input
                      type="time"
                      value={config.startTime}
                      onChange={(e) => setConfig({...config, startTime: e.target.value})}
                      className={styles.formInput}
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      End Date *
                      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style={{display: 'inline', marginLeft: '6px'}}>
                        <path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z" stroke="currentColor" strokeWidth="2"/>
                        <path d="M16 2V6M8 2V6M3 10H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </label>
                    <input
                      type="date"
                      value={config.endDate}
                      onChange={(e) => setConfig({...config, endDate: e.target.value})}
                      min={config.scheduleDate || getTodayDate()}
                      className={`${styles.formInput} ${!isValidDateRange() && config.endDate ? styles.inputError : ''}`}
                    />
                    {!isValidDateRange() && config.endDate && (
                      <span className={styles.errorText}>{getDateRangeError()}</span>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      End Time *
                      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style={{display: 'inline', marginLeft: '6px'}}>

                        <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>

                      </svg>
                    </label>
                    <input
                      type="time"
                      value={config.endTime}
                      onChange={(e) => setConfig({...config, endTime: e.target.value})}
                      className={styles.formInput}
                    />
                  </div>
                </div>

                {config.scheduleDate && config.endDate && isValidDateRange() && (
                  <div className={styles.durationInfo}>
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                      <path d="M11 17c0 .55.45 1 1 1s1-.45 1-1-.45-1-1-1-1 .45-1 1zm0-14v4h2V5.08c3.39.49 6 3.39 6 6.92 0 3.87-3.13 7-7 7s-7-3.13-7-7c0-1.68.59-3.22 1.58-4.42L12 13l1.41-1.41-6.8-6.8v.02C4.42 6.45 3 9.05 3 12c0 4.97 4.02 9 9 9 4.97 0 9-4.03 9-9s-4.03-9-9-9h-1zm7 9c0-.55-.45-1-1-1s-1 .45-1 1 .45 1 1 1 1-.45 1-1zM6 12c0 .55.45 1 1 1s1-.45 1-1-.45-1-1-1-1 .45-1 1z"/>
                    </svg>
                    <span>{getScheduleDurationDisplay()}</span>
                  </div>
                )}

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Duration per Batch *</label>
                    <input
                      type="number"
                      value={config.durationPerBatch}
                      onChange={(e) => setConfig({...config, durationPerBatch: parseInt(e.target.value) || 1})}
                      min="1"
                      max={config.durationUnit === 'hours' ? "24" : "1440"}
                      step="1"
                      className={styles.formInput}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Unit</label>
                    <select
                      value={config.durationUnit}
                      onChange={(e) => setConfig({...config, durationUnit: e.target.value as 'minutes' | 'hours'})}
                      className={styles.formSelect}
                    >
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formOptions}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={config.excludeLunchBreak}
                      onChange={(e) => setConfig({...config, excludeLunchBreak: e.target.checked})}
                    />
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                      <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/>
                    </svg>
                    <span>Exclude Lunch Break from Schedule</span>
                  </label>
                  
                  {config.excludeLunchBreak && (
                    <div className={styles.formRow} style={{marginTop: '12px'}}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Lunch Break Start</label>
                        <input
                          type="time"
                          value={config.lunchBreakStart}
                          onChange={(e) => setConfig({...config, lunchBreakStart: e.target.value})}
                          className={styles.formInput}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Lunch Break End</label>
                        <input
                          type="time"
                          value={config.lunchBreakEnd}
                          onChange={(e) => setConfig({...config, lunchBreakEnd: e.target.value})}
                          className={styles.formInput}
                        />
                      </div>
                    </div>
                  )}
                  
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={config.prioritizePWD}
                      onChange={(e) => setConfig({...config, prioritizePWD: e.target.checked})}
                    />
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"          // fixed
                      strokeLinecap="round"    // fixed
                      strokeLinejoin="round"   // fixed
                      className="lucide lucide-accessibility-icon lucide-accessibility"
                    >
                      <circle cx="16" cy="4" r="1" />
                      <path d="m18 19 1-7-6 1" />
                      <path d="m5 8 3-3 5.5 3-2.36 3.5" />
                      <path d="M4.24 14.5a5 5 0 0 0 6.88 6" />
                      <path d="M13.76 17.5a5 5 0 0 0-6.88-6" />
                    </svg>
                    <span>Prioritize PWD Participants (Scheduled First)</span>
                  </label>

                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={config.emailNotification}
                      onChange={(e) => setConfig({...config, emailNotification: e.target.checked})}
                    />
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                    </svg>
                    <span>Send Email Notifications After Scheduling</span>
                  </label>
                </div>
              </div>

              <div className={styles.formActions}>
                <button 
                  className={styles.btnGenerate}
                  onClick={handleGenerateSchedule}
                  disabled={
                    scheduling ||
                    !config.campusGroupId ||
                    !config.participantGroupId ||
                    !config.eventName ||
                    !config.scheduleDate ||
                    !config.endDate ||
                    !isValidDateRange() ||
                    (() => {
                      const estimate = getCapacityEstimate();
                      return estimate && !estimate.canAccommodate;
                    })()
                  }
                >
                  {scheduling ? (
                    <>
                      <span className={styles.spinnerSmall}></span>
                      Generating Schedule...
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                      </svg>
                      Generate Schedule
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {!showResults && config.campusGroupId && config.participantGroupId && config.scheduleDate && config.endDate && isValidDateRange() && (() => {
            const estimate = getCapacityEstimate()
            if (!estimate) return null
            
            return (
              <div className={styles.formCard}>
                <h2 className={styles.formSectionTitle}>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                  </svg>
                  Capacity Analysis (Based on Scheduler Rules)
                </h2>
                
                <div className={`${styles.durationInfo} ${estimate.canAccommodate ? '' : styles.warningBox}`}>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                  </svg>
                  <span>
                    <strong>Total Capacity:</strong> {estimate.totalCapacity.toLocaleString()} participants 
                    ({estimate.participants.toLocaleString()} needed) 
                    {estimate.canAccommodate ? ' ✅' : ' ⚠️'}
                  </span>
                </div>

                <div className={styles.capacityBreakdown}>
                  <div className={styles.capacityRow}>
                    <span className={styles.capacityLabel}>🏢 Total Rooms:</span>
                    <span className={styles.capacityValue}>
                      {estimate.roomCount} rooms ({estimate.firstFloorCount} 1st floor, {estimate.upperFloorCount} upper floors)
                    </span>
                  </div>
                  <div className={styles.capacityRow}>
                    <span className={styles.capacityLabel}>🕐 Slots per Day:</span>
                    <span className={styles.capacityValue}>{estimate.slotsPerDay} slots</span>
                  </div>
                  <div className={styles.capacityRow}>
                    <span className={styles.capacityLabel}>📅 Total Days:</span>
                    <span className={styles.capacityValue}>{getDays()} days</span>
                  </div>
                  
                  <div className={`${styles.capacityRow} ${styles.capacityPhase}`}>
                    <span className={styles.capacityLabel}>♿ PHASE 1: PWD Capacity (1st Floor Only):</span>
                    <span className={`${styles.capacityValue} ${estimate.pwdExceeded ? styles.error : styles.success}`}>
                      {estimate.firstFloorCount} rooms × {estimate.slotsPerDay} slots × {getDays()} days = {estimate.pwdCapacity} capacity
                    </span>
                  </div>
                  <div className={styles.capacityRow}>
                    <span className={styles.capacityLabel}>   👤 PWD Participants:</span>
                    <span className={`${styles.capacityValue} ${estimate.pwdExceeded ? styles.error : styles.success}`}>
                      {estimate.pwdCount} {estimate.pwdExceeded ? '⚠️ EXCEEDS CAPACITY' : '✅'}
                    </span>
                  </div>
                  
                  <div className={`${styles.capacityRow} ${styles.capacityPhase}`}>
                    <span className={styles.capacityLabel}>👥 PHASE 2: Non-PWD Capacity (All Rooms):</span>
                    <span className={`${styles.capacityValue} ${estimate.nonPwdExceeded ? styles.error : styles.success}`}>
                      {estimate.roomCount} rooms × {estimate.slotsPerDay} slots × {getDays()} days = {estimate.nonPwdCapacity} capacity
                    </span>
                  </div>
                  <div className={styles.capacityRow}>
                    <span className={styles.capacityLabel}>   👤 Non-PWD Participants:</span>
                    <span className={`${styles.capacityValue} ${estimate.nonPwdExceeded ? styles.error : styles.success}`}>
                      {estimate.nonPwdCount} {estimate.nonPwdExceeded ? '⚠️ EXCEEDS CAPACITY' : '✅'}
                    </span>
                  </div>
                  
                  <div className={`${styles.capacityRow} ${styles.capacityTotal}`}>
                    <span className={styles.capacityLabel}>🎯 Total Capacity:</span>
                    <span className={`${styles.capacityValue} ${estimate.canAccommodate ? styles.success : styles.error}`}>
                      {estimate.pwdCapacity} (PWD) + {estimate.nonPwdCapacity} (Non-PWD) = {estimate.totalCapacity.toLocaleString()} participants
                    </span>
                  </div>
                  <div className={`${styles.capacityRow} ${styles.capacityTotal}`}>
                    <span className={styles.capacityLabel}>
                      {estimate.canAccommodate ? '✅ Can Schedule:' : '⚠️ Shortage:'}
                    </span>
                    <span className={`${styles.capacityValue} ${estimate.canAccommodate ? styles.success : styles.error}`}>
                      {estimate.canAccommodate 
                        ? `${(estimate.totalCapacity - estimate.participants).toLocaleString()} extra capacity`
                        : `Need ${(estimate.participants - estimate.totalCapacity).toLocaleString()} more capacity`}
                    </span>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      </main>
    </div>
  )
}

// Uses the module-scoped isFirstFloor below
function separateRoomsByFloor(campusGroupId: number, roomData: { [key: number]: any[] }): [number, number, number, number, number] {
  const rooms = roomData[campusGroupId] || []
  let firstFloorCount = 0
  let upperFloorCount = 0
  let firstFloorCapacity = 0
  let upperFloorCapacity = 0
  let totalCapacity = 0

  rooms.forEach(room => {
    const cap = Number(room.capacity) || 0
    totalCapacity += cap
    if (isFirstFloor(room.building, room.room)) {
      firstFloorCount++
      firstFloorCapacity += cap
    } else {
      upperFloorCount++
      upperFloorCapacity += cap
    }
  })

  const avgCapacity = rooms.length > 0 ? Math.round(totalCapacity / rooms.length) : 0
  return [firstFloorCount, upperFloorCount, avgCapacity, firstFloorCapacity, upperFloorCapacity]
}

function isFirstFloor(building: string, room: string): boolean {
  const roomStr = (room || '').toLowerCase().trim()
  const buildingStr = (building || '').toLowerCase().trim()
  const combined = `${buildingStr} ${roomStr}`

  const indicators = [
    '1f', '1st floor', 'first floor', 'ground floor', 'ground',
    'g floor', 'gf', 'floor 1', 'level 1', 'l1', 'first', '1st', 'one'
  ]
  for (const indicator of indicators) {
    if (combined.includes(indicator)) return true
  }

  const digits = roomStr.match(/\d+/g)?.join('') || ''
  if (digits && digits.length >= 3 && digits[0] === '1') return true
  if (roomStr.startsWith('1') && roomStr.length > 1 && !/\d/.test(roomStr[1])) return true

  return false
}

