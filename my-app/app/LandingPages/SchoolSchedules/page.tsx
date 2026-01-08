'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import styles from './CampusSchedules.module.css'
import { supabase } from '@/lib/supabaseClient'
import { 
  FaBuilding, 
  FaDoorOpen, 
  FaBox, 
  FaUsers, 
  FaWheelchair, 
  FaChartBar,
  FaClock,
  FaChair,
  FaCalendar,
  FaCheck
} from 'react-icons/fa'
import { Accessibility, ChevronDown, ChevronRight } from 'lucide-react'

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
  is_first_floor: boolean // ✅ NEW
  batches: Batch[]
  totalParticipants: number
  utilizationRate: number
}

interface Batch {
  id: number
  batch_name: string
  time_slot: string
  start_time: string // ✅ NEW
  end_time: string   // ✅ NEW
  batch_date: string // ✅ NEW
  participant_count: number
  has_pwd: boolean
  campus: string // ✅ NEW
  building: string // ✅ NEW
  room: string // ✅ NEW
  is_first_floor: boolean // ✅ NEW
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
}

interface ScheduleSummary {
  id: number
  event_name: string
  event_type: string
  schedule_date: string
  start_time: string
  end_time: string
  scheduled_count: number
  unscheduled_count: number
  campus_group_id: number
  participant_group_id: number
  school_name?: string
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

// ✅ NEW: Format date and time
function formatDateTime(dateString: string, timeString: string): string {
  try {
    const date = new Date(dateString)
    const dateFormatted = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
    
    const [hours, minutes] = timeString.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const hours12 = hours % 12 || 12
    const timeFormatted = `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`
    
    return `${dateFormatted}, ${timeFormatted}`
  } catch {
    return `${dateString} ${timeString}`
  }
}

// Add this helper function after formatDateTime and before SchoolSchedulesContent
async function getRoomCapacities(campusGroupId: number) {
  try {
    const campusRooms = await fetchAllRows('campuses', {
      upload_group_id: campusGroupId
    })
    
    // Create a lookup map: "campus|building|room" -> capacity
    const capacityMap = new Map<string, number>()
    campusRooms.forEach(room => {
      const key = `${room.campus}|${room.building}|${room.room}`
      capacityMap.set(key, room.capacity)
    })
    
    return capacityMap
  } catch (error) {
    console.error('Error fetching room capacities:', error)
    return new Map<string, number>()
  }
}

function SchoolSchedulesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const scheduleIdFromUrl = searchParams.get('scheduleId')

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingSchedule, setLoadingSchedule] = useState(false)
  const [loadingScheduleId, setLoadingScheduleId] = useState<number | null>(null) // ✅ NEW: Track which card is loading
  const [schedulesList, setSchedulesList] = useState<ScheduleSummary[]>([])
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null)
  const [buildings, setBuildings] = useState<Building[]>([])
  const [scheduleSummary, setScheduleSummary] = useState<ScheduleSummary | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null)
  const [viewMode, setViewMode] = useState<'selection' | 'campus' | 'room' | 'batch'>('selection')
  const [searchTerm, setSearchTerm] = useState('')
  const [stats, setStats] = useState({
    totalBuildings: 0,
    totalRooms: 0,
    totalBatches: 0,
    totalParticipants: 0,
    avgUtilization: 0,
    pwdCount: 0,
    firstFloorRooms: 0
  })

  const [expandedCampuses, setExpandedCampuses] = useState<Set<string>>(new Set())
  const [expandedBuildings, setExpandedBuildings] = useState<Set<string>>(new Set())
  const [campuses, setCampuses] = useState<Campus[]>([])

  useEffect(() => {
    fetchSchedulesList()
  }, [])

  useEffect(() => {
    if (scheduleIdFromUrl) {
      const scheduleId = parseInt(scheduleIdFromUrl)
      setSelectedScheduleId(scheduleId)
      fetchCampusSchedule(scheduleId)
    }
  }, [scheduleIdFromUrl])

  // Group buildings by campus
  useEffect(() => {
    if (buildings.length > 0) {
      const groups = new Map<string, Building[]>()
      buildings.forEach(building => {
        const campusName = building.rooms[0]?.campus || 'Unknown Campus'
        if (!groups.has(campusName)) groups.set(campusName, [])
        groups.get(campusName)!.push(building)
      })
      const campusesArray: Campus[] = Array.from(groups.entries()).map(([campusName, buildings]) => ({
        name: campusName,
        buildings
      }));
      setCampuses(campusesArray)

      // Hide all campuses by default when a schedule is selected
      const collapsedMap = new Set<string>()
      groups.forEach((_, campusName) => {
        collapsedMap.add(campusName) // false = collapsed
      })
      setExpandedCampuses(collapsedMap)
    }
  }, [buildings])

  // Helper: Get overall stats
  const getFileStats = () => {
    const totalCampuses = campuses.length
    let totalBuildings = 0
    let totalRooms = 0
    let totalCapacity = 0

    campuses.forEach((campus: Campus) => {
          totalBuildings += campus.buildings.length
          campus.buildings.forEach((building: Building) => {
            totalRooms += building.rooms.length
            totalCapacity += building.rooms.reduce((sum: number, room: Room) => sum + room.capacity, 0)
          })
    })

    const avgCapacity = totalRooms > 0 ? Math.round(totalCapacity / totalRooms) : 0

    return { totalCampuses, totalBuildings, totalRooms, totalCapacity, avgCapacity }
  }

  // Toggle individual campus expanded/collapsed
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

  const fetchSchedulesList = async () => {
    setLoading(true)
    try {
      console.log('📥 Fetching all schedules...')

      const summaries = await fetchAllRows('schedule_summary', {}, 'created_at')
      console.log(`✅ Found ${summaries.length} schedules`)

      const schedulesWithNames = await Promise.all(
        summaries.map(async (summary) => {
          try {
            const { data: campusData } = await supabase
              .from('campuses')
              .select('school_name')
              .eq('upload_group_id', summary.campus_group_id)
              .limit(1)
              .single()

            return {
              ...summary,
              school_name: campusData?.school_name || 'Unknown Campus'
            }
          } catch (error) {
            return {
              ...summary,
              school_name: 'Unknown Campus'
            }
          }
        })
      )

      schedulesWithNames.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      setSchedulesList(schedulesWithNames)
    } catch (error) {
      console.error('❌ Error fetching schedules list:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCampusSchedule = async (scheduleId: number) => {
    setLoadingSchedule(true)
    setLoadingScheduleId(scheduleId) // ✅ NEW: Set the loading schedule ID
    try {
      console.log(`📥 Fetching campus schedule for ID: ${scheduleId}`)

      // Fetch schedule summary
      const { data: summaryData, error: summaryError } = await supabase
        .from('schedule_summary')
        .select('*')
        .eq('id', scheduleId)
        .single()

      if (summaryError) throw summaryError

      const { data: campusData } = await supabase
        .from('campuses')
        .select('school_name')
        .eq('upload_group_id', summaryData.campus_group_id)
        .limit(1)
        .single()

      const summaryWithName = {
        ...summaryData,
        school_name: campusData?.school_name || 'Unknown Campus'
      }

      setScheduleSummary(summaryWithName)

      // ✅ Fetch actual room capacities from campuses table
      const roomCapacityMap = await getRoomCapacities(summaryData.campus_group_id)

      // Fetch assignments
      const assignments = await fetchAllRows('schedule_assignments', {
        schedule_summary_id: scheduleId
      })

      console.log(`✅ Fetched ${assignments.length} assignments`)

      // Fetch participants
      const participantIds = [...new Set(assignments.map(a => a.participant_id))]
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

      // Fetch batches
      const batches = await fetchAllRows('schedule_batches', {
        schedule_summary_id: scheduleId
      }, 'batch_number')

      console.log(`✅ Fetched ${batches.length} batches`)

      // Group assignments by batch
      const assignmentsByBatch = new Map()
      assignments.forEach(assignment => {
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
            seat_no: assignment.seat_no
          })
        }
      })

      // ✅ FIXED: Build structure correctly - one room can have multiple batches
      const campusMap = new Map<string, Map<string, Map<string, Room>>>()

      // Process each batch
      batches.forEach(batch => {
        const campus = batch.campus
        const building = batch.building
        const room = batch.room

        // Initialize nested structure
        if (!campusMap.has(campus)) {
          campusMap.set(campus, new Map())
        }
        if (!campusMap.get(campus)?.has(building)) {
          campusMap.get(campus)?.set(building, new Map())
        }
        
        const buildingMap = campusMap.get(campus)!.get(building)!
        
        // Get actual capacity from campuses table
        const roomKey = `${campus}|${building}|${room}`
        const actualCapacity = roomCapacityMap.get(roomKey) || 0

        // ✅ FIXED: Get or create room (rooms can have multiple batches)
        if (!buildingMap.has(room)) {
          buildingMap.set(room, {
            id: batch.id,
            room: room,
            capacity: actualCapacity,  // ✅ This is the ROOM capacity, not building
            building: building,
            campus: campus,
            is_first_floor: batch.is_first_floor,
            batches: [],
            totalParticipants: 0,
            utilizationRate: 0
          })
        }

        const roomObj = buildingMap.get(room)!

        // Add batch with participants
        const batchParticipants = assignmentsByBatch.get(batch.id) || []
        roomObj.batches.push({
          ...batch,
          participants: batchParticipants.sort((a: any, b: any) => a.seat_no - b.seat_no),
          capacity: actualCapacity  // ✅ ROOM capacity per batch
        })
      })

      // ✅ FIXED: Calculate utilization correctly
      campusMap.forEach((buildingMap) => {
        buildingMap.forEach((roomMap) => {
          roomMap.forEach((room) => {
            // Total participants across all batches in this room
            room.totalParticipants = room.batches.reduce(
              (sum, b) => sum + (b.participants?.length || 0),
              0
            )
            
            // ✅ FIXED: Max capacity = room capacity × number of batches
            const maxCapacity = room.capacity * room.batches.length
            
            room.utilizationRate = maxCapacity > 0
              ? Math.round((room.totalParticipants / maxCapacity) * 100)
              : 0
            
            console.log(
              `📊 ${room.campus} | ${room.building} | Room ${room.room}: ` +
              `${room.totalParticipants}/${maxCapacity} = ${room.utilizationRate}% ` +
              `(${room.batches.length} batches × ${room.capacity} capacity)`
            )
          })
        })
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

      console.log('📊 Final campus structure:', campusesArray)
      setCampuses(campusesArray)

      // Calculate stats
      const allRooms = campusesArray
        .flatMap((campus: Campus) => campus.buildings)
        .flatMap((building: Building) => building.rooms)

      const totalRooms = allRooms.length
      const totalBatches = batches.length
      const totalParticipants = assignments.length
      const pwdCount = assignments.filter((a: any) => a.is_pwd).length
      const firstFloorRooms = allRooms.filter((room: Room) => room.is_first_floor).length
      const avgUtilization = totalRooms > 0
        ? Math.round(allRooms.reduce((sum: number, room: Room) => sum + room.utilizationRate, 0) / totalRooms)
        : 0

      setStats({
        totalBuildings: campusesArray.reduce((sum, campus) => sum + campus.buildings.length, 0),
        totalRooms,
        totalBatches,
        totalParticipants,
        avgUtilization,
        pwdCount,
        firstFloorRooms
      })

      setViewMode('campus')
      console.log(`✅ Built campus structure with ${campusesArray.length} campuses`)

    } catch (error) {
      console.error('❌ Error fetching campus schedule:', error)
    } finally {
      setLoadingSchedule(false)
      setLoadingScheduleId(null) // ✅ NEW: Clear loading state
    }
  }

  const handleScheduleSelect = (scheduleId: number) => {
    setSelectedScheduleId(scheduleId)
    fetchCampusSchedule(scheduleId)
  }

  const handleRoomClick = (room: Room) => {
    setSelectedRoom(room)
    setViewMode('room')
  }

  const handleBatchClick = (batch: Batch) => {
    setSelectedBatch(batch)
    setViewMode('batch')
  }

  const handleBackToSelection = () => {
    setViewMode('selection')
    setSelectedScheduleId(null)
    setScheduleSummary(null)
    setBuildings([])
    setSelectedRoom(null)
    setSelectedBatch(null)
  }

  const handleBackToCampus = () => {
    setViewMode('campus')
    setSelectedRoom(null)
    setSelectedBatch(null)
  }

  const handleBackToRoom = () => {
    setViewMode('room')
    setSelectedBatch(null)
  }

  const getFilteredSchedules = () => {
    if (!searchTerm) return schedulesList
    return schedulesList.filter(schedule => 
      schedule.event_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      schedule.school_name?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }

  // Given start/end + lunch + duration, derive slot count used in utilization if needed
  function computeSlotsForDay(start: string, end: string, durationMin: number, excludeLunch: boolean, lunchStart?: string, lunchEnd?: string) {
    const toMin = (t: string) => {
      const [h,m] = t.split(':').map(Number)
      return h*60 + m
    }
    const windows: Array<[number, number]> = []
    const st = toMin(start), et = toMin(end)
    if (excludeLunch && lunchStart && lunchEnd) {
      const ls = toMin(lunchStart), le = toMin(lunchEnd)
      if (st < ls) windows.push([st, ls])
      if (le < et) windows.push([le, et])
    } else {
      windows.push([st, et])
    }
    let slots = 0
    for (const [ws, we] of windows) {
      const len = we - ws
      if (len >= durationMin) slots += Math.floor(len / durationMin)
    }
    return slots
  }

  // When computing room.utilizationRate, use the actual number of slots in the day
  // Example usage inside your processing (after you know summary start/end + duration):
  const slotCount = computeSlotsForDay(
    scheduleSummary?.start_time || '09:00',
    scheduleSummary?.end_time || '16:00',
    /* durationMin */ 180,
    /* excludeLunch */ true,
    '12:00',
    '13:00'
  )
  // total capacity per room for the day:
  // 'room' is not available in this scope; provide a helper to compute utilization for any room when you have it.
  function computeRoomUtilization(room: Room, slotCount: number) {
    const dayCapacityPerRoom = (room.capacity || 0) * slotCount
    return dayCapacityPerRoom > 0
      ? Math.round((room.totalParticipants / dayCapacityPerRoom) * 100)
      : 0
  }
  // Example usage (call this when iterating rooms):
  // room.utilizationRate = computeRoomUtilization(room, slotCount)

  if (loading) {
    return (
      <div className={styles.qtimeLayout}>
        <MenuBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} showSidebarToggle={true} showAccountIcon={true} />
        <Sidebar isOpen={sidebarOpen} />
        <main className={`${styles.qtimeMain} ${!sidebarOpen ? styles.fullWidth : ''}`}>
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p>Loading schedules...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={styles.qtimeLayout}>
      <MenuBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} showSidebarToggle={true} showAccountIcon={true} />
      <Sidebar isOpen={sidebarOpen} />
      
      <main className={`${styles.qtimeMain} ${!sidebarOpen ? styles.fullWidth : ''}`}>
        <div className={styles.campusContainer}>
          {/* Schedule Selection View */}
          {viewMode === 'selection' && (
            <>
              <div className={styles.campusHeader}>
                <div className={styles.headerLeft}>
                  <div className={styles.headerInfo}>
                    <h1 className={styles.campusTitle}>
                      <FaCalendar /> Select Schools Scheduled
                    </h1>
                    <p className={styles.campusSubtitle}>
                      Choose a scheduled school to view school layout and seating arrangements
                    </p>
                  </div>
                </div>
              </div>

              <div className={styles.searchSection}>
                <div className={styles.searchBox}>
                  <input
                    type="text"
                    placeholder="Search by event name or school..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={styles.searchInput}
                  />
                </div>
              </div>

              <div className={styles.schedulesGrid}>
                {getFilteredSchedules().map((schedule) => (
                  <div
                    key={schedule.id}
                    className={`${styles.scheduleCard} ${loadingScheduleId === schedule.id ? styles.loadingCard : ''}`}
                    onClick={() => !loadingScheduleId && handleScheduleSelect(schedule.id)}
                    style={{ 
                      cursor: loadingScheduleId ? 'wait' : 'pointer',
                      opacity: loadingScheduleId && loadingScheduleId !== schedule.id ? 0.5 : 1,
                      pointerEvents: loadingScheduleId ? 'none' : 'auto'
                    }}
                  >
                    <div className={styles.scheduleCardHeader}>
                      <h3 className={styles.scheduleEventName}>
                        <FaCalendar /> {schedule.event_name}
                      </h3>
                      <span className={styles.scheduleType}>{schedule.event_type}</span>
                    </div>
                    <div className={styles.scheduleCardBody}>
                      <div className={styles.scheduleInfo}>
                        <FaBuilding />
                        <span>{schedule.school_name}</span>
                      </div>
                      <div className={styles.scheduleInfo}>
                        <FaClock />
                        <span>{new Date(schedule.schedule_date).toLocaleDateString()}</span>
                      </div>
                      <div className={styles.scheduleInfo}>
                        <FaClock />
                        <span>{schedule.start_time} - {schedule.end_time}</span>
                      </div>
                      <div className={styles.scheduleInfo}>
                        <FaUsers />
                        <span>{schedule.scheduled_count} scheduled</span>
                      </div>
                      {schedule.unscheduled_count > 0 && (
                        <div className={`${styles.scheduleInfo} ${styles.warning}`}>
                          <FaUsers />
                          <span>{schedule.unscheduled_count} unscheduled</span>
                        </div>
                      )}
                    </div>
                    <div className={styles.scheduleCardFooter}>
                      {/* ✅ UPDATED: Button with loading state */}
                      <button 
                        className={`${styles.viewButton} ${loadingScheduleId === schedule.id ? styles.loading : ''}`}
                        disabled={!!loadingScheduleId}
                      >
                        {loadingScheduleId === schedule.id ? (
                          <>
                            <div className={styles.buttonSpinner}></div>
                            Loading...
                          </>
                        ) : (
                          <>
                            View School Layout →
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {getFilteredSchedules().length === 0 && (
                <div className={styles.emptyState}>
                  <FaCalendar size={64} />
                  <h3>No schedules found</h3>
                  <p>
                    {searchTerm 
                      ? `No schedules match "${searchTerm}"`
                      : 'No campus schedules have been created yet'
                    }
                  </p>
                </div>
              )}
            </>
          )}

          {/* Loading Schedule */}
          {loadingSchedule && viewMode !== 'selection' && (
            <div className={styles.loadingState}>
              <div className={styles.spinner}></div>
              <p>Loading school layout...</p>
            </div>
          )}

          {/* School View - Only show when not loading */}
          {!loadingSchedule && viewMode !== 'selection' && (
            <>
              {/* Header */}
              <div className={styles.campusHeader}>
                <div className={styles.headerLeft}>
                  <button className={styles.backButton} onClick={
                    viewMode === 'campus' ? handleBackToSelection :
                    viewMode === 'room' ? handleBackToCampus : handleBackToRoom
                  }>
                    ← Back
                  </button>
                  <div className={styles.headerInfo}>
                    <h1 className={styles.campusTitle}>
                      {viewMode === 'campus' && <><FaBuilding /> School Layout</>}
                      {viewMode === 'room' && (
                        <>
                          <FaDoorOpen /> 
                          {selectedRoom?.building} - Room {selectedRoom?.room}
                          {/* ✅ NEW: Show first floor indicator */}
                          {selectedRoom?.is_first_floor && <span style={{marginLeft: '10px', fontSize: '18px'}}><Accessibility /> 1st Floor</span>}
                        </>
                      )}
                      {viewMode === 'batch' && <><FaBox /> {selectedBatch?.batch_name}</>}
                    </h1>
                    {scheduleSummary && (
                      <p className={styles.campusSubtitle}>
                        {scheduleSummary.event_name} • {scheduleSummary.school_name} • {new Date(scheduleSummary.schedule_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* ✅ UPDATED: Stats with first floor count */}
              <div className={styles.statsGrid}>
                <div className={`${styles.statCard} ${styles.blue}`}>
                  <FaBuilding className={styles.statIcon} />
                  <div className={styles.statContent}>
                    <div className={styles.statLabel}>Buildings</div>
                    <div className={styles.statValue}>{stats.totalBuildings}</div>
                  </div>
                </div>
                <div className={`${styles.statCard} ${styles.green}`}>
                  <FaDoorOpen className={styles.statIcon} />
                  <div className={styles.statContent}>
                    <div className={styles.statLabel}>Rooms</div>
                    <div className={styles.statValue}>{stats.totalRooms}</div>
                  </div>
                </div>
                <div className={`${styles.statCard} ${styles.purple}`}>
                  <FaBox className={styles.statIcon} />
                  <div className={styles.statContent}>
                    <div className={styles.statLabel}>Batches</div>
                    <div className={styles.statValue}>{stats.totalBatches}</div>
                  </div>
                </div>
                <div className={`${styles.statCard} ${styles.orange}`}>
                  <FaUsers className={styles.statIcon} />
                  <div className={styles.statContent}>
                    <div className={styles.statLabel}>Participants</div>
                    <div className={styles.statValue}>{stats.totalParticipants}</div>
                  </div>
                </div>
                <div className={`${styles.statCard} ${styles.teal}`}>
                  <FaWheelchair className={styles.statIcon} />
                  <div className={styles.statContent}>
                    <div className={styles.statLabel}>PWD</div>
                    <div className={styles.statValue}>{stats.pwdCount}</div>
                  </div>
                </div>
                {/* ✅ NEW: First floor rooms stat */}
                <div className={`${styles.statCard} ${styles.green}`}>
                    <Accessibility width={50} height={40}  className={styles.statIcon} />
                    <div className={styles.statContent}>
                    <div className={styles.statLabel}>1st Floor Rooms</div>
                    <div className={styles.statValue}>{stats.firstFloorRooms}</div>
                  </div>
                </div>
                {/* Campus stat */}
                <div className={`${styles.statCard} ${styles.blue}`}>
                  <FaChartBar className={styles.statIcon} />
                  <div className={styles.statContent}>
                    <div className={styles.statLabel}>Campuses</div>
                    <div className={styles.statValue}>{getFileStats().totalCampuses}</div>
                  </div>
                </div>
                <div className={`${styles.statCard} ${styles.teal}`}>
                  <FaChartBar className={styles.statIcon} />
                  <div className={styles.statContent}>
                    <div className={styles.statLabel}>Avg Capacity</div>
                    <div className={styles.statValue}>{getFileStats().avgCapacity}</div>
                  </div>
                </div>
              </div>

              {viewMode === 'campus' && (
                <div className={styles.campusView}>
                  {campuses.map((campus, campusIdx) => (
                    <div key={campusIdx} className={styles.campusSection}>
                      <div 
                        className={styles.campusHeaderRow}
                        onClick={() => toggleCampus(campus.name)}
                      >
                        <FaBuilding /> 
                        {campus.name}
                        <button className={styles.toggleCampusBtn}>
                          {expandedCampuses.has(campus.name) ? 
                            <ChevronDown size={20} /> : 
                            <ChevronRight size={20} />
                          }
                        </button>
                      </div>
                      
                      {expandedCampuses.has(campus.name) && (
                        <>
                          {campus.buildings.map((building, buildingIdx) => {
                            const buildingKey = `${campus.name}-${building.name}`
                            return (
                              <div key={buildingIdx} className={styles.buildingCard}>
                                <div 
                                  className={styles.buildingHeaderRow}
                                  onClick={() => toggleBuilding(buildingKey)}
                                >
                                  <div className={styles.buildingName}>
                                    <FaBuilding /> {building.name}
                                  </div>
                                  <span className={styles.roomCount}>
                                    {building.rooms.length} rooms
                                  </span>
                                  <button className={styles.toggleCampusBtn}>
                                    {expandedBuildings.has(buildingKey) ? 
                                      <ChevronDown size={16} /> : 
                                      <ChevronRight size={16} />
                                    }
                                  </button>
                                </div>

                                {expandedBuildings.has(buildingKey) && (
                                  <div className={styles.roomsGrid}>
                                    {building.rooms.map((room) => (
                                      <div
                                        key={`${room.campus}-${room.building}-${room.room}`}
                                        className={styles.roomCard}
                                        onClick={() => handleRoomClick(room)}
                                      >
                                        <div className={styles.roomHeader}>
                                          <span className={styles.roomNumber}>
                                            Room {room.room}
                                            {room.is_first_floor && 
                                              <span style={{marginLeft: '8px'}}>
                                                <Accessibility />
                                              </span>
                                            }
                                          </span>
                                          <span className={`${styles.utilizationBadge} ${
                                            room.utilizationRate >= 80 ? styles.high : 
                                            room.utilizationRate >= 50 ? styles.medium : styles.low
                                          }`}>
                                            {room.utilizationRate}%
                                          </span>
                                        </div>
                                        <div className={styles.roomBody}>
                                          <div className={styles.roomStat}>
                                            <FaUsers />
                                            {/* ✅ FIXED: Show correct capacity calculation */}
                                            <span>
                                              {room.totalParticipants} / {room.capacity * room.batches.length}
                                            </span>
                                          </div>
                                          <div className={styles.roomStat}>
                                            <FaBox />
                                            <span>{room.batches.length} batch{room.batches.length !== 1 ? 'es' : ''}</span>
                                          </div>
                                          <div className={styles.roomStat}>
                                            <FaDoorOpen />
                                            <span>{room.capacity} per batch</span>
                                          </div>
                                          {room.batches.some(b => b.has_pwd) && (
                                            <div className={styles.pwdIndicator}>
                                              <FaWheelchair />
                                              <span>PWD Priority</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {viewMode === 'room' && selectedRoom && (
                <div className={styles.roomView}>
                  <div className={styles.roomInfoCard}>
                    <div className={styles.infoRow}>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Campus</span>
                        <span className={styles.infoValue} style={{fontSize: '20px'}}>{selectedRoom.campus}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Building</span>
                        <span className={styles.infoValue} style={{fontSize: '20px'}}>{selectedRoom.building}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Floor</span>
                        <span className={styles.infoValue} style={{fontSize: '20px'}}>
                          {selectedRoom.is_first_floor ? <>1st Floor <Accessibility size={20} /></> : 'Upper Floor'}
                        </span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Capacity</span>
                        <span className={styles.infoValue}>{selectedRoom.capacity}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Batches</span>
                        <span className={styles.infoValue}>{selectedRoom.batches.length}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Participants</span>
                        <span className={styles.infoValue}>{selectedRoom.totalParticipants}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Utilization</span>
                        <span className={styles.infoValue}>{selectedRoom.utilizationRate}%</span>
                      </div>
                    </div>
                  </div>

                  <h3 className={styles.sectionTitle}>
                    <FaBox /> Batches Schedule
                  </h3>
                  <div className={styles.batchesTimeline}>
                    {selectedRoom.batches.map((batch) => (
                      <div
                        key={batch.id}
                        className={styles.batchCard}
                        onClick={() => handleBatchClick(batch)} // <-- This makes the batch clickable
                      >
                        <div className={styles.batchHeader}>
                          <span className={styles.batchName}>{batch.batch_name}</span>
                          {batch.has_pwd && (
                            <span className={styles.pwdBadge}>
                              <FaWheelchair /> PWD
                            </span>
                          )}
                        </div>
                        <div className={styles.batchTime}>
                          <FaClock />
                          {batch.batch_date && batch.start_time
                            ? `${formatDateTime(batch.batch_date, batch.start_time)} - ${batch.end_time}`
                            : batch.time_slot}
                        </div>
                        <div className={styles.batchStats}>
                          <div className={styles.batchStat}>
                            <FaUsers />
                            <span>
                              {batch.participants?.length || 0} / {batch.capacity || selectedRoom.capacity || 0}
                            </span>
                          </div>
                          <div className={styles.batchUtilization}>
                            <div className={styles.progressBar}>
                              <div
                                className={styles.progressFill}
                                style={{
                                  width: `${Math.min(
                                    ((batch.participants?.length || 0) / (batch.capacity || selectedRoom.capacity || 1)) * 100, 
                                    100
                                  )}%`
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Batch View */}
{viewMode === 'batch' && selectedBatch && selectedRoom && (
  <div className={styles.batchView}>
    <div className={styles.batchInfoCard}>
      <div className={styles.infoRow}>
        {/* ✅ UPDATED: Show detailed time information */}
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Date</span>
          <span className={styles.infoValue} style={{fontSize: '18px'}}>
            {selectedBatch.batch_date ? 
              new Date(selectedBatch.batch_date).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              }) : 'N/A'
            }
          </span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Time</span>
          <span className={styles.infoValue} style={{fontSize: '18px'}}>
            {selectedBatch.start_time} - {selectedBatch.end_time}
          </span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Campus</span>
          <span className={styles.infoValue} style={{fontSize: '18px'}}>{selectedBatch.campus}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Building</span>
          <span className={styles.infoValue} style={{fontSize: '18px'}}>{selectedBatch.building}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Room Number</span>
          <span className={styles.infoValue} style={{fontSize: '18px'}}>
            {selectedBatch.room || selectedRoom.room}
          </span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Floor</span>
          <span className={styles.infoValue} style={{fontSize: '18px'}}>
            {selectedBatch.is_first_floor ? <>1st Floor <Accessibility /></> : 'Upper Floor'}
          </span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Participants</span>
          <span className={styles.infoValue}>
            {selectedBatch.participants?.length || 0} / {selectedBatch.capacity || selectedRoom.capacity || 0}
          </span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Occupancy</span>
          <span className={styles.infoValue}>
            {Math.round(
              ((selectedBatch.participants?.length || 0) / 
              (selectedBatch.capacity || selectedRoom.capacity || 1)) * 100
            )}%
          </span>
        </div>
      </div>
    </div>

                  <h3 className={styles.sectionTitle}>
                    <FaChair /> Seating Arrangement
                  </h3>
                  <div className={styles.seatingGrid}>
                    {selectedBatch.participants
                      .sort((a, b) => a.seat_no - b.seat_no)
                      .map((participant) => (
                        <div
                          key={participant.id}
                          className={`${styles.seatCard} ${participant.is_pwd ? styles.pwdSeat : ''}`}
                        >
                          <div className={styles.seatNumber}>Seat {participant.seat_no}</div>
                          <div className={styles.seatInfo}>
                            <div className={styles.participantName}>{participant.name}</div>
                            <div className={styles.participantNumber}>{participant.participant_number}</div>
                          </div>
                          {participant.is_pwd && (
                            <FaWheelchair className={styles.seatPwdBadge} />
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

// Loading fallback
function LoadingFallback() {
  return <div>Loading campus schedules...</div>
}

// Main export wrapped in Suspense
export default function CampusSchedulesPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SchoolSchedulesContent />
    </Suspense>
  )
}