'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import styles from './ScheduleDetailsModal.module.css'
import { 
  FaTimes, 
  FaBuilding, 
  FaDoorOpen, 
  FaUsers, 
  FaWheelchair, 
  FaClock, 
  FaCalendar,
  FaChevronDown,
  FaChevronUp,
  FaBox,
  FaMapMarkerAlt,
  FaDownload,
  FaPrint,
  FaCheckCircle,
  FaTimesCircle
} from 'react-icons/fa'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface Campus {
  name: string
  buildings: Building[]
}

interface Building {
  name: string
  campus: string
  rooms: Room[]
}

interface Room {
  id: number
  room: string
  capacity: number
  building: string
  campus: string
  is_first_floor: boolean
  batches: Batch[]
  totalParticipants: number
  utilizationRate: number
}

interface Batch {
  id: number
  batch_name: string
  batch_number: number
  time_slot: string
  start_time: string
  end_time: string
  batch_date: string
  participant_count: number
  has_pwd: boolean
  campus: string
  building: string
  room: string
  is_first_floor: boolean
  participants: Participant[]
  capacity?: number
}

interface Participant {
  id: number
  participant_number: string
  name: string
  email: string
  is_pwd: boolean
  seat_no: number
  province?: string
  city?: string
}

interface ScheduleSummary {
  id: number
  event_name: string
  event_type: string
  schedule_date: string
  start_time: string
  end_time: string
  end_date: string | null
  scheduled_count: number
  unscheduled_count: number
  campus_group_id: number
  participant_group_id: number
  school_name?: string
  created_at: string
}

interface TimeSlotInfo {
  timeRange: string
  startTime: string
  endTime: string
  participantCount: number
  batchCount: number
  isActive: boolean
}

interface Stats {
  totalBuildings: number
  totalRooms: number
  totalBatches: number
  totalParticipants: number
  avgUtilization: number
  pwdCount: number
  firstFloorRooms: number
  totalDays: number
  slotsPerDay: number
  timeSlots: TimeSlotInfo[]
}

interface ScheduleDetailsModalProps {
  scheduleId: number
  isOpen: boolean
  onClose: () => void
}

// Helper function to fetch ALL rows
async function fetchAllRows(table: string, filters: any = {}, orderBy: string = 'id') {
  const PAGE_SIZE = 1000
  let allData: any[] = []
  let page = 0
  let hasMore = true

  while (hasMore) {
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from(table)
      .select('*')
      .range(from, to)
      .order(orderBy, { ascending: true })

    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value)
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

// Get room capacities from campuses table
async function getRoomCapacities(campusGroupId: number): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('campuses')
    .select('campus, building, room, capacity')
    .eq('upload_group_id', campusGroupId)

  if (error) {
    console.error('Error fetching room capacities:', error)
    return new Map()
  }

  const capacityMap = new Map<string, number>()
  data?.forEach(row => {
    const key = `${row.campus}|${row.building}|${row.room}`
    capacityMap.set(key, parseInt(row.capacity) || 0)
  })

  return capacityMap
}

export default function ScheduleDetailsModal({ scheduleId, isOpen, onClose }: ScheduleDetailsModalProps) {
  const [loading, setLoading] = useState(false)
  const [scheduleSummary, setScheduleSummary] = useState<ScheduleSummary | null>(null)
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [stats, setStats] = useState<Stats>({
    totalBuildings: 0,
    totalRooms: 0,
    totalBatches: 0,
    totalParticipants: 0,
    avgUtilization: 0,
    pwdCount: 0,
    firstFloorRooms: 0,
    totalDays: 0,
    slotsPerDay: 0,
    timeSlots: []
  })

  // UI state
  const [expandedCampuses, setExpandedCampuses] = useState<Set<string>>(new Set())
  const [expandedBuildings, setExpandedBuildings] = useState<Set<string>>(new Set())
  const [expandedRooms, setExpandedRooms] = useState<Set<number>>(new Set())
  const [expandedBatches, setExpandedBatches] = useState<Set<number>>(new Set())
  const [activeTab, setActiveTab] = useState<'overview' | 'details'>('overview')

  useEffect(() => {
    if (isOpen && scheduleId) {
      fetchScheduleDetails()
    }
  }, [isOpen, scheduleId])

  const fetchScheduleDetails = async () => {
    setLoading(true)
    try {
      console.log(`📥 Fetching schedule details for ID: ${scheduleId}`)

      // Fetch schedule summary
      const { data: summaryData, error: summaryError } = await supabase
        .from('schedule_summary')
        .select('*')
        .eq('id', scheduleId)
        .single()

      if (summaryError) throw summaryError

      // Fetch school name
      const { data: campusData } = await supabase
        .from('campuses')
        .select('school_name')
        .eq('upload_group_id', summaryData.campus_group_id)
        .limit(1)
        .single()

      const summaryWithName = {
        ...summaryData,
        school_name: campusData?.school_name || 'Unknown School'
      }

      setScheduleSummary(summaryWithName)

      // Fetch room capacities
      const roomCapacityMap = await getRoomCapacities(summaryData.campus_group_id)

      // Fetch batches FIRST to get actual time slots
      const batches = await fetchAllRows('schedule_batches', {
        schedule_summary_id: scheduleId
      }, 'batch_number')

      console.log(`✅ Fetched ${batches.length} batches`)

      // ✅ CORRECT: Calculate time slot statistics from actual batch data
      const timeSlotMap = new Map<string, TimeSlotInfo>()
      
      batches.forEach((batch: any) => {
        const timeKey = `${batch.start_time}-${batch.end_time}`
        
        if (!timeSlotMap.has(timeKey)) {
          timeSlotMap.set(timeKey, {
            timeRange: formatTimeRange(batch.start_time, batch.end_time),
            startTime: batch.start_time,
            endTime: batch.end_time,
            participantCount: 0,
            batchCount: 0,
            isActive: true
          })
        }
        
        const slotInfo = timeSlotMap.get(timeKey)!
        slotInfo.batchCount++
        slotInfo.participantCount += batch.participant_count || 0
      })

      // Sort time slots by start time
      const sortedTimeSlots = Array.from(timeSlotMap.values()).sort((a, b) => 
        a.startTime.localeCompare(b.startTime)
      )

      console.log(`📊 Found ${sortedTimeSlots.length} unique time slots:`)
      sortedTimeSlots.forEach((slot, idx) => {
        console.log(`   Slot ${idx + 1}: ${slot.timeRange} - ${slot.participantCount} participants in ${slot.batchCount} batches`)
      })

      // Fetch assignments
      const assignments = await fetchAllRows('schedule_assignments', {
        schedule_summary_id: scheduleId
      })

      console.log(`✅ Fetched ${assignments.length} assignments`)

      // Fetch participants
      const participantIds = [...new Set(assignments.map((a: any) => a.participant_id))]
      const CHUNK_SIZE = 1000
      let allParticipants: any[] = []

      for (let i = 0; i < participantIds.length; i += CHUNK_SIZE) {
        const chunk = participantIds.slice(i, i + CHUNK_SIZE)
        const { data } = await supabase
          .from('participants')
          .select('*')
          .in('id', chunk)

        if (data) allParticipants = [...allParticipants, ...data]
      }

      const participantMap = new Map(allParticipants.map(p => [p.id, p]))

      // Group assignments by batch
      const assignmentsByBatch = new Map()
      assignments.forEach((assignment: any) => {
        if (!assignmentsByBatch.has(assignment.schedule_batch_id)) {
          assignmentsByBatch.set(assignment.schedule_batch_id, [])
        }
        const participant = participantMap.get(assignment.participant_id)
        if (participant) {
          assignmentsByBatch.get(assignment.schedule_batch_id).push({
            id: participant.id,
            participant_number: participant.participant_number,
            name: participant.name,
            email: participant.email,
            is_pwd: assignment.is_pwd,
            seat_no: assignment.seat_no,
            province: participant.province,
            city: participant.city
          })
        }
      })

      // Build campus structure
      const campusMap = new Map<string, Map<string, Map<string, Room>>>()

      batches.forEach((batch: any) => {
        const campus = batch.campus
        const building = batch.building
        const room = batch.room

        if (!campusMap.has(campus)) {
          campusMap.set(campus, new Map())
        }
        if (!campusMap.get(campus)?.has(building)) {
          campusMap.get(campus)?.set(building, new Map())
        }

        const buildingMap = campusMap.get(campus)!.get(building)!
        const roomKey = `${campus}|${building}|${room}`
        const actualCapacity = roomCapacityMap.get(roomKey) || 0

        if (!buildingMap.has(room)) {
          buildingMap.set(room, {
            id: batch.id,
            room: room,
            capacity: actualCapacity,
            building: building,
            campus: campus,
            is_first_floor: batch.is_first_floor,
            batches: [],
            totalParticipants: 0,
            utilizationRate: 0
          })
        }

        const roomObj = buildingMap.get(room)!
        const batchParticipants = assignmentsByBatch.get(batch.id) || []
        
        roomObj.batches.push({
          ...batch,
          participants: batchParticipants.sort((a: any, b: any) => a.seat_no - b.seat_no),
          capacity: actualCapacity
        })

        roomObj.totalParticipants = roomObj.batches.reduce(
          (sum, b) => sum + (b.participants?.length || 0),
          0
        )

        const maxCapacity = actualCapacity * roomObj.batches.length
        roomObj.utilizationRate = maxCapacity > 0
          ? Math.round((roomObj.totalParticipants / maxCapacity) * 100)
          : 0
      })

      // Convert to array structure
      const campusesArray = Array.from(campusMap.entries()).map(([campusName, buildingMap]) => ({
        name: campusName,
        buildings: Array.from(buildingMap.entries()).map(([buildingName, roomMap]) => ({
          name: buildingName,
          campus: campusName,
          rooms: Array.from(roomMap.values())
        }))
      }))

      setCampuses(campusesArray)

      // Calculate stats
      const allRooms = campusesArray
        .flatMap((campus: Campus) => campus.buildings)
        .flatMap((building: Building) => building.rooms)

      const uniqueDates = new Set(batches.map((b: any) => b.batch_date))
      const uniqueSlots = new Set(batches.map((b: any) => b.time_slot))

      setStats({
        totalBuildings: campusesArray.reduce((sum, c) => sum + c.buildings.length, 0),
        totalRooms: allRooms.length,
        totalBatches: batches.length,
        totalParticipants: assignments.length,
        avgUtilization: allRooms.length > 0
          ? Math.round(allRooms.reduce((sum: number, r: Room) => sum + r.utilizationRate, 0) / allRooms.length)
          : 0,
        pwdCount: assignments.filter((a: any) => a.is_pwd).length,
        firstFloorRooms: allRooms.filter((r: Room) => r.is_first_floor).length,
        totalDays: uniqueDates.size,
        slotsPerDay: Math.round(uniqueSlots.size / uniqueDates.size),
        timeSlots: sortedTimeSlots  // ✅ Use actual time slots from batches
      })

      console.log('✅ Schedule details loaded successfully')

    } catch (error) {
      console.error('❌ Error fetching schedule details:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleCampus = (campusName: string) => {
    setExpandedCampuses(prev => {
      const next = new Set(prev)
      if (next.has(campusName)) {
        next.delete(campusName)
      } else {
        next.add(campusName)
      }
      return next
    })
  }

  const toggleBuilding = (buildingKey: string) => {
    setExpandedBuildings(prev => {
      const next = new Set(prev)
      if (next.has(buildingKey)) {
        next.delete(buildingKey)
      } else {
        next.add(buildingKey)
      }
      return next
    })
  }

  const toggleRoom = (roomId: number) => {
    setExpandedRooms(prev => {
      const next = new Set(prev)
      if (next.has(roomId)) {
        next.delete(roomId)
      } else {
        next.add(roomId)
      }
      return next
    })
  }

  const toggleBatch = (batchId: number) => {
    setExpandedBatches(prev => {
      const next = new Set(prev)
      if (next.has(batchId)) {
        next.delete(batchId)
      } else {
        next.add(batchId)
      }
      return next
    })
  }

  const handleExport = () => {
    if (!scheduleSummary || campuses.length === 0) {
      alert('No data to export')
      return
    }

    try {
      const csvRows: string[] = []
      
      csvRows.push(`Event Name,${scheduleSummary.event_name}`)
      csvRows.push(`Event Type,${scheduleSummary.event_type.replace(/_/g, ' ')}`)
      csvRows.push(`School,${scheduleSummary.school_name}`)
      csvRows.push(`Date Range,${formatDateRange(scheduleSummary.schedule_date, scheduleSummary.end_date)}`)
      csvRows.push(`Time,${formatTimeRange(scheduleSummary.start_time, scheduleSummary.end_time)}`)
      csvRows.push(`Total Scheduled,${scheduleSummary.scheduled_count}`)
      csvRows.push(`Total Unscheduled,${scheduleSummary.unscheduled_count}`)
      csvRows.push('') // Empty row

      // ✅ Add actual time slots summary
      csvRows.push('Time Slots with Participants:')
      csvRows.push('Time Range,Participants,Batches')
      stats.timeSlots.forEach(slot => {
        csvRows.push(`${slot.timeRange},${slot.participantCount},${slot.batchCount}`)
      })
      csvRows.push('') // Empty row

      csvRows.push('Campus,Building,Room,Capacity,First Floor,Batch Name,Date,Time,Participants,Seat No,Participant ID,Name,Email,City,Province,Is PWD')

      campuses.forEach(campus => {
        campus.buildings.forEach(building => {
          building.rooms.forEach(room => {
            room.batches.forEach(batch => {
              batch.participants.forEach(participant => {
                const row = [
                  campus.name,
                  building.name,
                  room.room,
                  room.capacity,
                  room.is_first_floor ? 'Yes' : 'No',
                  batch.batch_name,
                  formatDate(batch.batch_date),
                  formatTimeRange(batch.start_time, batch.end_time),
                  batch.participant_count,
                  participant.seat_no,
                  participant.participant_number,
                  `"${participant.name}"`,
                  participant.email,
                  participant.city || 'N/A',
                  participant.province || 'N/A',
                  participant.is_pwd ? 'Yes' : 'No'
                ].join(',')
                
                csvRows.push(row)
              })
            })
          })
        })
      })

      const csvContent = csvRows.join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      
      link.setAttribute('href', url)
      link.setAttribute('download', `schedule_${scheduleSummary.event_name}_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      console.log('✅ CSV exported successfully')
    } catch (error) {
      console.error('❌ Error exporting CSV:', error)
      alert('Failed to export CSV. Please try again.')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatDateRange = (startDate: string, endDate: string | null) => {
    const start = formatDate(startDate)
    if (!endDate || endDate === startDate) return start
    const end = formatDate(endDate)
    return `${start} - ${end}`
  }

  const formatTimeRange = (startTime: string, endTime: string) => {
    return `${startTime} - ${endTime}`
  }

  const handlePrint = () => {
    window.print()
  }

  if (!isOpen) return null

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContainer} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>
              {scheduleSummary?.event_name || 'Schedule Details'}
            </h2>
            <p className={styles.modalSubtitle}>
              {scheduleSummary?.school_name} • {scheduleSummary?.event_type.replace(/_/g, ' ')}
            </p>
          </div>
          <div className={styles.headerActions}>
            <button 
              className={styles.iconButton} 
              onClick={handleExport} 
              title="Export to CSV"
              disabled={!scheduleSummary || campuses.length === 0}
            >
              <FaDownload />
            </button>
            <button className={styles.iconButton} onClick={handlePrint} title="Print">
              <FaPrint />
            </button>
            <button className={styles.closeButton} onClick={onClose}>
              <FaTimes />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'overview' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'details' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('details')}
          >
            Detailed View
          </button>
        </div>

        {/* Content */}
        <div className={styles.modalContent}>
          {loading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner}></div>
              <p>Loading schedule details...</p>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <div className={styles.overviewTab}>
                  {/* Quick Stats */}
                  <div className={styles.statsGrid}>
                    <div className={styles.statCard}>
                      <FaCalendar className={styles.statIcon} />
                      <div>
                        <p className={styles.statLabel}>Date Range</p>
                        <p className={styles.statValue}>
                          {scheduleSummary && formatDateRange(scheduleSummary.schedule_date, scheduleSummary.end_date)}
                        </p>
                        <p className={styles.statMeta}>{stats.totalDays} day{stats.totalDays !== 1 ? 's' : ''}</p>
                      </div>
                    </div>

                    <div className={styles.statCard}>
                      <FaClock className={styles.statIcon} />
                      <div>
                        <p className={styles.statLabel}>Time</p>
                        <p className={styles.statValue}>
                          {scheduleSummary && formatTimeRange(scheduleSummary.start_time, scheduleSummary.end_time)}
                        </p>
                        <p className={styles.statMeta}>{stats.slotsPerDay} slot{stats.slotsPerDay !== 1 ? 's' : ''}/day</p>
                      </div>
                    </div>

                    <div className={styles.statCard}>
                      <FaBuilding className={styles.statIcon} />
                      <div>
                        <p className={styles.statLabel}>Facilities</p>
                        <p className={styles.statValue}>{stats.totalBuildings} Buildings</p>
                        <p className={styles.statMeta}>{stats.totalRooms} rooms total</p>
                      </div>
                    </div>

                    <div className={styles.statCard}>
                      <FaBox className={styles.statIcon} />
                      <div>
                        <p className={styles.statLabel}>Batches</p>
                        <p className={styles.statValue}>{stats.totalBatches}</p>
                        <p className={styles.statMeta}>Avg {stats.avgUtilization}% utilized</p>
                      </div>
                    </div>

                    <div className={`${styles.statCard} ${styles.success}`}>
                      <FaUsers className={styles.statIcon} />
                      <div>
                        <p className={styles.statLabel}>Participants</p>
                        <p className={styles.statValue}>{stats.totalParticipants}</p>
                        <p className={styles.statMeta}>
                          {scheduleSummary?.scheduled_count} scheduled
                        </p>
                      </div>
                    </div>

                    <div className={`${styles.statCard} ${styles.pwd}`}>
                      <FaWheelchair className={styles.statIcon} />
                      <div>
                        <p className={styles.statLabel}>PWD Priority</p>
                        <p className={styles.statValue}>{stats.pwdCount}</p>
                        <p className={styles.statMeta}>
                          {stats.firstFloorRooms} 1st floor rooms
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ✅ Time Slots Section - Only shows actual scheduled slots */}
                  {stats.timeSlots.length > 0 && (
                    <div className={styles.timeSlotsSection}>
                      <div className={styles.timeSlotsSectionHeader}>
                        <h3>
                          <FaClock /> Expected Participant Times
                        </h3>
                        <p className={styles.timeSlotsDescription}>
                          Time slots with scheduled participants ({stats.timeSlots.length} active slot{stats.timeSlots.length !== 1 ? 's' : ''})
                        </p>
                      </div>
                      <div className={styles.timeSlotsGrid}>
                        {stats.timeSlots.map((slot, index) => (
                          <div 
                            key={index} 
                            className={`${styles.timeSlotCard} ${styles.activeSlot}`}
                          >
                            <div className={styles.timeSlotHeader}>
                              <div className={styles.timeSlotIcon}>
                                <FaCheckCircle className={styles.activeIcon} />
                              </div>
                              <div className={styles.timeSlotTime}>
                                <span className={styles.timeSlotLabel}>Time Slot {index + 1}</span>
                                <span className={styles.timeSlotRange}>{slot.timeRange}</span>
                              </div>
                            </div>
                            <div className={styles.timeSlotStats}>
                              <div className={styles.timeSlotStat}>
                                <FaUsers />
                                <span>{slot.participantCount} participants</span>
                              </div>
                              <div className={styles.timeSlotStat}>
                                <FaBox />
                                <span>{slot.batchCount} batches</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Summary Info */}
                  <div className={styles.summarySection}>
                    <h3>Schedule Summary</h3>
                    <div className={styles.summaryGrid}>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Event Name:</span>
                        <span className={styles.summaryValue}>{scheduleSummary?.event_name}</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Event Type:</span>
                        <span className={styles.summaryValue}>
                          {scheduleSummary?.event_type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>School:</span>
                        <span className={styles.summaryValue}>{scheduleSummary?.school_name}</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Created:</span>
                        <span className={styles.summaryValue}>
                          {scheduleSummary && formatDate(scheduleSummary.created_at)}
                        </span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Scheduled:</span>
                        <span className={`${styles.summaryValue} ${styles.success}`}>
                          {scheduleSummary?.scheduled_count}
                        </span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Unscheduled:</span>
                        <span className={`${styles.summaryValue} ${scheduleSummary?.unscheduled_count ? styles.warning : ''}`}>
                          {scheduleSummary?.unscheduled_count || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'details' && (
                <div className={styles.detailsTab}>
                  {campuses.map(campus => (
                    <div key={campus.name} className={styles.campusSection}>
                      {/* Campus Header */}
                      <div
                        className={styles.campusHeader}
                        onClick={() => toggleCampus(campus.name)}
                      >
                        <div className={styles.campusTitle}>
                          <FaMapMarkerAlt />
                          <h3>{campus.name}</h3>
                          <span className={styles.badge}>
                            {campus.buildings.length} building{campus.buildings.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {expandedCampuses.has(campus.name) ? <FaChevronUp /> : <FaChevronDown />}
                      </div>

                      {/* Buildings */}
                      {expandedCampuses.has(campus.name) && (
                        <div className={styles.buildingsContainer}>
                          {campus.buildings.map(building => {
                            const buildingKey = `${campus.name}-${building.name}`
                            return (
                              <div key={buildingKey} className={styles.buildingSection}>
                                {/* Building Header */}
                                <div
                                  className={styles.buildingHeader}
                                  onClick={() => toggleBuilding(buildingKey)}
                                >
                                  <div className={styles.buildingTitle}>
                                    <FaBuilding />
                                    <h4>{building.name}</h4>
                                    <span className={styles.badge}>
                                      {building.rooms.length} room{building.rooms.length !== 1 ? 's' : ''}
                                    </span>
                                  </div>
                                  {expandedBuildings.has(buildingKey) ? <FaChevronUp /> : <FaChevronDown />}
                                </div>

                                {/* Rooms */}
                                {expandedBuildings.has(buildingKey) && (
                                  <div className={styles.roomsContainer}>
                                    {building.rooms.map(room => (
                                      <div key={room.id} className={styles.roomSection}>
                                        {/* Room Header */}
                                        <div
                                          className={styles.roomHeader}
                                          onClick={() => toggleRoom(room.id)}
                                        >
                                          <div className={styles.roomTitle}>
                                            <FaDoorOpen />
                                            <h5>Room {room.room}</h5>
                                            {room.is_first_floor && (
                                              <span className={styles.pwdBadge}>
                                                <FaWheelchair /> 1st Floor
                                              </span>
                                            )}
                                            <span className={styles.badge}>
                                              {room.batches.length} batch{room.batches.length !== 1 ? 'es' : ''}
                                            </span>
                                          </div>
                                          <div className={styles.roomStats}>
                                            <span className={styles.roomStat}>
                                              Capacity: {room.capacity}
                                            </span>
                                            <span className={styles.roomStat}>
                                              Participants: {room.totalParticipants}
                                            </span>
                                            <span className={`${styles.utilizationBadge} ${
                                              room.utilizationRate >= 80 ? styles.high :
                                              room.utilizationRate >= 50 ? styles.medium : styles.low
                                            }`}>
                                              {room.utilizationRate}%
                                            </span>
                                            {expandedRooms.has(room.id) ? <FaChevronUp /> : <FaChevronDown />}
                                          </div>
                                        </div>

                                        {/* Batches */}
                                        {expandedRooms.has(room.id) && (
                                          <div className={styles.batchesContainer}>
                                            {room.batches.map(batch => (
                                              <div key={batch.id} className={styles.batchSection}>
                                                {/* Batch Header */}
                                                <div
                                                  className={styles.batchHeader}
                                                  onClick={() => toggleBatch(batch.id)}
                                                >
                                                  <div className={styles.batchTitle}>
                                                    <FaBox />
                                                    <h6>{batch.batch_name}</h6>
                                                    {batch.has_pwd && (
                                                      <span className={styles.pwdBadge}>
                                                        <FaWheelchair /> PWD
                                                      </span>
                                                    )}
                                                  </div>
                                                  <div className={styles.batchInfo}>
                                                    <span className={styles.batchStat}>
                                                      <FaCalendar /> {formatDate(batch.batch_date)}
                                                    </span>
                                                    <span className={styles.batchStat}>
                                                      <FaClock /> {batch.start_time} - {batch.end_time}
                                                    </span>
                                                    <span className={styles.batchStat}>
                                                      <FaUsers /> {batch.participant_count}/{batch.capacity}
                                                    </span>
                                                    {expandedBatches.has(batch.id) ? <FaChevronUp /> : <FaChevronDown />}
                                                  </div>
                                                </div>

                                                {/* Participants Table */}
                                                {expandedBatches.has(batch.id) && (
                                                  <div className={styles.participantsTable}>
                                                    <table>
                                                      <thead>
                                                        <tr>
                                                          <th>Seat</th>
                                                          <th>ID</th>
                                                          <th>Name</th>
                                                          <th>Email</th>
                                                          <th>Location</th>
                                                          <th>PWD</th>
                                                        </tr>
                                                      </thead>
                                                      <tbody>
                                                        {batch.participants.map(participant => (
                                                          <tr key={participant.id}>
                                                            <td className={styles.seatNo}>{participant.seat_no}</td>
                                                            <td>{participant.participant_number}</td>
                                                            <td className={styles.nameCell}>{participant.name}</td>
                                                            <td className={styles.emailCell}>{participant.email}</td>
                                                            <td>{participant.city || participant.province || 'N/A'}</td>
                                                            <td>
                                                              {participant.is_pwd ? (
                                                                <span className={styles.pwdIcon}>
                                                                  <FaWheelchair />
                                                                </span>
                                                              ) : (
                                                                '-'
                                                              )}
                                                            </td>
                                                          </tr>
                                                        ))}
                                                      </tbody>
                                                    </table>
                                                  </div>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}