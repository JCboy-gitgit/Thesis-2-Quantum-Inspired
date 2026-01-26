'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  Building2, 
  DoorOpen, 
  Users,
  BookOpen,
  Search,
  Filter,
  X
} from 'lucide-react'
import styles from './styles.module.css'

interface RoomAllocation {
  id: number
  schedule_id: number
  class_id: number
  room_id: number
  course_code: string
  course_name: string
  section: string
  year_level?: number
  schedule_day: string
  schedule_time: string
  campus: string
  building: string
  room: string
  capacity: number
  teacher_name?: string
  department?: string
  lec_hours?: number
  lab_hours?: number
}

interface Schedule {
  id: number
  schedule_name: string
  semester: string
  academic_year: string
  total_classes: number
  scheduled_classes: number
  unscheduled_classes: number
  created_at: string
  school_name?: string
  college?: string
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function RoomSchedulesViewContent() {
  const router = useRouter()
  
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null)
  const [allocations, setAllocations] = useState<RoomAllocation[]>([])
  const [filteredAllocations, setFilteredAllocations] = useState<RoomAllocation[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingDetails, setLoadingDetails] = useState(false)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [filterBuilding, setFilterBuilding] = useState<string>('all')
  const [filterRoom, setFilterRoom] = useState<string>('all')
  const [filterDay, setFilterDay] = useState<string>('all')
  const [selectedAllocation, setSelectedAllocation] = useState<RoomAllocation | null>(null)
  
  const [buildings, setBuildings] = useState<string[]>([])
  const [rooms, setRooms] = useState<string[]>([])
  const [filteredRooms, setFilteredRooms] = useState<string[]>([])

  useEffect(() => {
    checkAuth()
    fetchSchedules()
  }, [])

  useEffect(() => {
    if (allocations.length > 0) {
      applyFilters()
    }
  }, [allocations, searchQuery, filterBuilding, filterRoom, filterDay])

  useEffect(() => {
    if (filterBuilding === 'all') {
      setFilteredRooms(rooms)
      setFilterRoom('all')
    } else {
      const roomsInBuilding = allocations
        .filter(a => a.building === filterBuilding)
        .map(a => a.room)
        .filter((r, i, arr) => arr.indexOf(r) === i)
      setFilteredRooms(roomsInBuilding)
      if (!roomsInBuilding.includes(filterRoom)) {
        setFilterRoom('all')
      }
    }
  }, [filterBuilding, rooms, allocations])

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user) {
        router.push('/faculty/login')
        return
      }

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single() as { data: any; error: any }

      if (!userData || !userData.is_active) {
        router.push('/faculty/login')
        return
      }
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/faculty/login')
    }
  }

  const fetchSchedules = async () => {
    setLoading(true)
    try {
      const { data: scheduleData, error } = await supabase
        .from('generated_schedules')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10) as { data: any[] | null; error: any }

      if (!error && scheduleData && scheduleData.length > 0) {
        const schedulesWithNames = await Promise.all(scheduleData.map(async (schedule: any) => {
          const { data: campusData } = await supabase
            .from('campuses')
            .select('school_name')
            .eq('upload_group_id', schedule.campus_group_id)
            .limit(1)
            .single() as { data: any; error: any }

          const { data: classData } = await supabase
            .from('class_schedules')
            .select('college')
            .eq('upload_group_id', schedule.class_group_id)
            .limit(1)
            .single() as { data: any; error: any }

          return {
            ...schedule,
            school_name: campusData?.school_name || 'Unknown School',
            college: classData?.college || 'Unknown College'
          } as Schedule
        }))

        setSchedules(schedulesWithNames)
        
        if (schedulesWithNames.length > 0) {
          handleSelectSchedule(schedulesWithNames[0])
        }
      }
    } catch (error) {
      console.error('Error fetching schedules:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectSchedule = async (schedule: Schedule) => {
    setSelectedSchedule(schedule)
    setLoadingDetails(true)
    
    try {
      const { data: allocationData, error } = await supabase
        .from('room_allocations')
        .select('*')
        .eq('schedule_id', schedule.id)
        .order('schedule_day', { ascending: true })
        .order('schedule_time', { ascending: true }) as { data: any[] | null; error: any }

      if (!error && allocationData && allocationData.length > 0) {
        setAllocations(allocationData as RoomAllocation[])
        
        const uniqueBuildings = [...new Set(allocationData.map((a: any) => a.building).filter(Boolean))] as string[]
        const uniqueRooms = [...new Set(allocationData.map((a: any) => a.room).filter(Boolean))] as string[]
        
        setBuildings(uniqueBuildings)
        setRooms(uniqueRooms)
        setFilteredRooms(uniqueRooms)
      }
    } catch (error) {
      console.error('Error fetching allocations:', error)
    } finally {
      setLoadingDetails(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...allocations]

    if (filterBuilding !== 'all') {
      filtered = filtered.filter(a => a.building === filterBuilding)
    }
    if (filterRoom !== 'all') {
      filtered = filtered.filter(a => a.room === filterRoom)
    }
    if (filterDay !== 'all') {
      filtered = filtered.filter(a => a.schedule_day?.toLowerCase().includes(filterDay.toLowerCase()))
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(a => 
        a.course_code?.toLowerCase().includes(query) ||
        a.course_name?.toLowerCase().includes(query) ||
        a.section?.toLowerCase().includes(query) ||
        a.room?.toLowerCase().includes(query) ||
        a.teacher_name?.toLowerCase().includes(query)
      )
    }

    setFilteredAllocations(filtered)
  }

  const groupByDay = () => {
    const grouped: { [day: string]: RoomAllocation[] } = {}
    DAYS.forEach(day => {
      grouped[day] = filteredAllocations.filter(a => 
        a.schedule_day?.toLowerCase().includes(day.toLowerCase())
      )
    })
    return grouped
  }

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading Room Schedules...</p>
      </div>
    )
  }

  const groupedByDay = groupByDay()

  return (
    <div className={styles.pageContainer}>
      <div className={styles.header}>
        <button onClick={() => router.push('/faculty/home')} className={styles.backButton}>
          <ArrowLeft size={20} />
          Back to Home
        </button>
        <h1 className={styles.pageTitle}>
          <Calendar size={32} />
          Room Schedules
        </h1>
        <p className={styles.subtitle}>View master schedule and room availability</p>
      </div>

      {schedules.length > 0 && (
        <div className={styles.scheduleSelector}>
          <label>Current Schedule:</label>
          <select 
            value={selectedSchedule?.id || ''} 
            onChange={(e) => {
              const schedule = schedules.find(s => s.id === parseInt(e.target.value))
              if (schedule) handleSelectSchedule(schedule)
            }}
            className={styles.select}
          >
            {schedules.map(s => (
              <option key={s.id} value={s.id}>
                {s.schedule_name} - {s.semester} {s.academic_year}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedSchedule && (
        <div className={styles.scheduleInfo}>
          <div className={styles.infoCard}>
            <BookOpen size={20} />
            <div>
              <div className={styles.infoValue}>{selectedSchedule.total_classes}</div>
              <div className={styles.infoLabel}>Total Classes</div>
            </div>
          </div>
          <div className={styles.infoCard}>
            <Users size={20} />
            <div>
              <div className={styles.infoValue}>{selectedSchedule.scheduled_classes}</div>
              <div className={styles.infoLabel}>Scheduled</div>
            </div>
          </div>
          <div className={styles.infoCard}>
            <Building2 size={20} />
            <div>
              <div className={styles.infoValue}>{buildings.length}</div>
              <div className={styles.infoLabel}>Buildings</div>
            </div>
          </div>
          <div className={styles.infoCard}>
            <DoorOpen size={20} />
            <div>
              <div className={styles.infoValue}>{rooms.length}</div>
              <div className={styles.infoLabel}>Rooms</div>
            </div>
          </div>
        </div>
      )}

      {loadingDetails ? (
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p>Loading schedule details...</p>
        </div>
      ) : allocations.length > 0 ? (
        <>
          <div className={styles.filterSection}>
            <div className={styles.searchBar}>
              <Search size={20} />
              <input
                type="text"
                placeholder="Search by course, section, room, or teacher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className={styles.filters}>
              <select value={filterBuilding} onChange={(e) => setFilterBuilding(e.target.value)}>
                <option value="all">All Buildings</option>
                {buildings.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <select value={filterRoom} onChange={(e) => setFilterRoom(e.target.value)}>
                <option value="all">All Rooms</option>
                {filteredRooms.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <select value={filterDay} onChange={(e) => setFilterDay(e.target.value)}>
                <option value="all">All Days</option>
                {DAYS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.resultsInfo}>
            Showing {filteredAllocations.length} of {allocations.length} scheduled classes
          </div>

          <div className={styles.scheduleView}>
            {DAYS.map(day => {
              const dayAllocations = groupedByDay[day]
              if (dayAllocations.length === 0) return null
              
              return (
                <div key={day} className={styles.daySection}>
                  <h2 className={styles.dayTitle}>
                    <Calendar size={20} />
                    {day}
                  </h2>
                  <div className={styles.allocationsList}>
                    {dayAllocations.map(allocation => (
                      <div 
                        key={allocation.id} 
                        className={styles.allocationCard}
                        onClick={() => setSelectedAllocation(allocation)}
                      >
                        <div className={styles.timeSlot}>
                          <Clock size={16} />
                          {allocation.schedule_time}
                        </div>
                        <div className={styles.courseInfo}>
                          <h3 className={styles.courseCode}>{allocation.course_code}</h3>
                          <p className={styles.courseName}>{allocation.course_name}</p>
                          <p className={styles.section}>Section: {allocation.section}</p>
                        </div>
                        <div className={styles.locationInfo}>
                          <div className={styles.location}>
                            <Building2 size={14} />
                            {allocation.building}
                          </div>
                          <div className={styles.room}>
                            <DoorOpen size={14} />
                            {allocation.room}
                          </div>
                        </div>
                        {allocation.teacher_name && (
                          <div className={styles.teacherInfo}>
                            <Users size={14} />
                            {allocation.teacher_name}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <div className={styles.emptyState}>
          <Calendar size={64} />
          <h3>No schedule data available</h3>
          <p>There are no room allocations for this schedule yet.</p>
        </div>
      )}

      {selectedAllocation && (
        <div className={styles.modalOverlay} onClick={() => setSelectedAllocation(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeButton} onClick={() => setSelectedAllocation(null)}>
              <X size={24} />
            </button>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{selectedAllocation.course_code}</h2>
              <p className={styles.modalSubtitle}>{selectedAllocation.course_name}</p>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.detailsGrid}>
                <div className={styles.detailItem}>
                  <strong>Section:</strong>
                  <span>{selectedAllocation.section}</span>
                </div>
                {selectedAllocation.year_level && (
                  <div className={styles.detailItem}>
                    <strong>Year Level:</strong>
                    <span>Year {selectedAllocation.year_level}</span>
                  </div>
                )}
                <div className={styles.detailItem}>
                  <Calendar size={16} />
                  <strong>Day:</strong>
                  <span>{selectedAllocation.schedule_day}</span>
                </div>
                <div className={styles.detailItem}>
                  <Clock size={16} />
                  <strong>Time:</strong>
                  <span>{selectedAllocation.schedule_time}</span>
                </div>
                <div className={styles.detailItem}>
                  <Building2 size={16} />
                  <strong>Building:</strong>
                  <span>{selectedAllocation.building}</span>
                </div>
                <div className={styles.detailItem}>
                  <DoorOpen size={16} />
                  <strong>Room:</strong>
                  <span>{selectedAllocation.room}</span>
                </div>
                <div className={styles.detailItem}>
                  <Users size={16} />
                  <strong>Capacity:</strong>
                  <span>{selectedAllocation.capacity} students</span>
                </div>
                {selectedAllocation.teacher_name && (
                  <div className={styles.detailItem}>
                    <Users size={16} />
                    <strong>Teacher:</strong>
                    <span>{selectedAllocation.teacher_name}</span>
                  </div>
                )}
                {selectedAllocation.department && (
                  <div className={styles.detailItem}>
                    <Building2 size={16} />
                    <strong>Department:</strong>
                    <span>{selectedAllocation.department}</span>
                  </div>
                )}
                {(selectedAllocation.lec_hours || selectedAllocation.lab_hours) && (
                  <div className={styles.detailItem}>
                    <Clock size={16} />
                    <strong>Hours:</strong>
                    <span>
                      {selectedAllocation.lec_hours ? `${selectedAllocation.lec_hours}h Lecture` : ''}
                      {selectedAllocation.lec_hours && selectedAllocation.lab_hours ? ' + ' : ''}
                      {selectedAllocation.lab_hours ? `${selectedAllocation.lab_hours}h Lab` : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function FacultyRoomSchedulesPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RoomSchedulesViewContent />
    </Suspense>
  )
}
