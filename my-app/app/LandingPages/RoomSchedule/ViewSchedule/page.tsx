'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import styles from './ViewSchedule.module.css'
import { 
  FaArrowLeft, 
  FaCalendar, 
  FaClock, 
  FaUsers, 
  FaExclamationTriangle,
  FaTrash,
  FaEye,
  FaInfoCircle,
  FaPlus,
  FaDoorOpen,
  FaBuilding,
  FaChalkboardTeacher,
  FaGraduationCap,
  FaMapMarkerAlt,
  FaDownload,
  FaPrint,
  FaFilter,
  FaSearch,
  FaChevronDown,
  FaChevronRight,
  FaTable,
  FaList,
  FaTh,
  FaImage
} from 'react-icons/fa'
import { 
  Calendar, 
  Clock, 
  Building2, 
  DoorOpen, 
  Users, 
  BookOpen,
  GraduationCap,
  ChevronDown,
  ChevronRight,
  Filter,
  Download,
  Printer,
  Grid3X3,
  List,
  Eye,
  Trash2,
  Plus,
  Search,
  X,
  CheckCircle2,
  Image as ImageIcon
} from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ==================== Types ====================
type TimetableViewMode = 'all' | 'room' | 'section' | 'teacher' | 'course'

interface OptimizationStats {
  initial_cost?: number
  final_cost?: number
  iterations?: number
  improvements?: number
  quantum_tunnels?: number
  time_elapsed_ms?: number
  scheduled_classes?: number
  unscheduled_classes?: number
}

interface Schedule {
  id: number
  schedule_name: string
  semester: string
  academic_year: string
  campus_group_id: number
  class_group_id: number
  teacher_group_id: number | null
  total_classes: number
  scheduled_classes: number
  unscheduled_classes: number
  optimization_stats?: OptimizationStats
  created_at: string
  school_name?: string
  college?: string
}

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

interface TimetableCell {
  allocations: RoomAllocation[]
}

// Days of the week
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function ViewSchedulePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const scheduleIdParam = searchParams.get('id')
  
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [filteredSchedules, setFilteredSchedules] = useState<Schedule[]>([])
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null)
  const [allocations, setAllocations] = useState<RoomAllocation[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingDetails, setLoadingDetails] = useState(false)
  
  // History filters
  const [historySearch, setHistorySearch] = useState('')
  const [historySortBy, setHistorySortBy] = useState<'date' | 'name' | 'classes'>('date')
  const [historySortOrder, setHistorySortOrder] = useState<'asc' | 'desc'>('desc')
  
  // View mode
  const [viewMode, setViewMode] = useState<'list' | 'timetable'>('list')
  
  // Timetable view mode: all, room, section, teacher, course
  const [timetableViewMode, setTimetableViewMode] = useState<TimetableViewMode>('all')
  const [selectedRoom, setSelectedRoom] = useState<string>('all')
  const [selectedSection, setSelectedSection] = useState<string>('all')
  const [selectedTeacher, setSelectedTeacher] = useState<string>('all')
  const [selectedCourse, setSelectedCourse] = useState<string>('all')
  
  // Timetable ref for export
  const timetableRef = useRef<HTMLDivElement>(null)
  
  // Filters
  const [filterBuilding, setFilterBuilding] = useState<string>('all')
  const [filterRoom, setFilterRoom] = useState<string>('all')
  const [filterDay, setFilterDay] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Timetable data
  const [timeSlots, setTimeSlots] = useState<string[]>([])
  const [activeDays, setActiveDays] = useState<string[]>([])
  const [timetableData, setTimetableData] = useState<Map<string, TimetableCell>>(new Map())
  
  // Unique values for filters
  const [buildings, setBuildings] = useState<string[]>([])
  const [rooms, setRooms] = useState<string[]>([])
  const [sections, setSections] = useState<string[]>([])
  const [teachers, setTeachers] = useState<string[]>([])
  const [courses, setCourses] = useState<string[]>([])
  
  // Building-Room mapping for connected filters
  const [buildingRoomMap, setBuildingRoomMap] = useState<Map<string, string[]>>(new Map())
  const [filteredRooms, setFilteredRooms] = useState<string[]>([])

  useEffect(() => {
    fetchSchedules()
  }, [])

  // Filter and sort schedules when filters change
  useEffect(() => {
    let result = [...schedules]
    
    // Apply search filter
    if (historySearch) {
      const query = historySearch.toLowerCase()
      result = result.filter(s => 
        s.schedule_name?.toLowerCase().includes(query) ||
        s.school_name?.toLowerCase().includes(query) ||
        s.college?.toLowerCase().includes(query) ||
        s.semester?.toLowerCase().includes(query) ||
        s.academic_year?.toLowerCase().includes(query)
      )
    }
    
    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0
      switch (historySortBy) {
        case 'date':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        case 'name':
          comparison = (a.schedule_name || '').localeCompare(b.schedule_name || '')
          break
        case 'classes':
          comparison = a.total_classes - b.total_classes
          break
      }
      return historySortOrder === 'asc' ? comparison : -comparison
    })
    
    setFilteredSchedules(result)
  }, [schedules, historySearch, historySortBy, historySortOrder])

  useEffect(() => {
    if (scheduleIdParam && schedules.length > 0) {
      const schedule = schedules.find(s => s.id === parseInt(scheduleIdParam))
      if (schedule) {
        handleSelectSchedule(schedule)
      }
    }
  }, [scheduleIdParam, schedules])

  useEffect(() => {
    if (allocations.length > 0) {
      buildTimetableData()
    }
  }, [allocations, filterBuilding, filterRoom, filterDay, searchQuery, timetableViewMode, selectedRoom, selectedSection, selectedTeacher, selectedCourse])

  // Update filtered rooms when building filter changes
  useEffect(() => {
    if (filterBuilding === 'all') {
      setFilteredRooms(rooms)
      setFilterRoom('all')
    } else {
      const roomsInBuilding = buildingRoomMap.get(filterBuilding) || []
      setFilteredRooms(roomsInBuilding)
      // Reset room filter if current selection is not in the new building
      if (!roomsInBuilding.includes(filterRoom)) {
        setFilterRoom('all')
      }
    }
  }, [filterBuilding, buildingRoomMap, rooms])

  const fetchSchedules = async () => {
    setLoading(true)
    try {
      // Try to fetch from generated_schedules table first
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('generated_schedules')
        .select('*')
        .order('created_at', { ascending: false })

      if (!scheduleError && scheduleData && scheduleData.length > 0) {
        // Fetch school names and college names
        const schedulesWithNames = await Promise.all(scheduleData.map(async (schedule) => {
          const { data: campusData } = await supabase
            .from('campuses')
            .select('school_name')
            .eq('upload_group_id', schedule.campus_group_id)
            .limit(1)
            .single()

          const { data: classData } = await supabase
            .from('class_schedules')
            .select('college')
            .eq('upload_group_id', schedule.class_group_id)
            .limit(1)
            .single()

          return {
            ...schedule,
            school_name: campusData?.school_name || 'Unknown School',
            college: classData?.college || 'Unknown College'
          }
        }))

        setSchedules(schedulesWithNames)
      } else {
        // Fallback to schedule_summary table
        const { data: summaryData, error: summaryError } = await supabase
          .from('schedule_summary')
          .select('*')
          .order('created_at', { ascending: false })

        if (!summaryError && summaryData) {
          const mappedSchedules = summaryData.map((s: any) => ({
            id: s.id,
            schedule_name: s.event_name,
            semester: '',
            academic_year: '',
            campus_group_id: s.campus_group_id || 0,
            class_group_id: s.participant_group_id || 0,
            teacher_group_id: null,
            total_classes: s.scheduled_count + s.unscheduled_count,
            scheduled_classes: s.scheduled_count,
            unscheduled_classes: s.unscheduled_count,
            created_at: s.created_at,
            school_name: 'Unknown School',
            college: 'Unknown College'
          }))
          setSchedules(mappedSchedules)
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
    setViewMode('timetable')
    
    try {
      // Fetch room allocations for this schedule
      const { data: allocationData, error: allocationError } = await supabase
        .from('room_allocations')
        .select('*')
        .eq('schedule_id', schedule.id)
        .order('schedule_day', { ascending: true })
        .order('schedule_time', { ascending: true })

      if (!allocationError && allocationData && allocationData.length > 0) {
        setAllocations(allocationData)
        
        // Extract unique buildings, rooms, sections and teachers
        const uniqueBuildings = [...new Set(allocationData.map(a => a.building).filter(Boolean))]
        const uniqueRooms = [...new Set(allocationData.map(a => a.room).filter(Boolean))]
        const uniqueSections = [...new Set(allocationData.map(a => a.section).filter(Boolean))]
        const uniqueTeachers = [...new Set(allocationData.map(a => a.teacher_name).filter(Boolean))]
        setBuildings(uniqueBuildings)
        setRooms(uniqueRooms)
        setSections(uniqueSections)
        setTeachers(uniqueTeachers)
      } else {
        // Try to build allocations from class_schedules and campuses
        await buildAllocationsFromSource(schedule)
      }
    } catch (error) {
      console.error('Error fetching allocations:', error)
    } finally {
      setLoadingDetails(false)
    }
  }

  const buildAllocationsFromSource = async (schedule: Schedule) => {
    try {
      // Fetch class schedules
      const { data: classData } = await supabase
        .from('class_schedules')
        .select('*')
        .eq('upload_group_id', schedule.class_group_id)

      // Fetch rooms
      const { data: roomData } = await supabase
        .from('campuses')
        .select('*')
        .eq('upload_group_id', schedule.campus_group_id)

      if (classData && roomData) {
        // Simple allocation: assign classes to rooms round-robin
        const mockAllocations: RoomAllocation[] = classData.map((cls: any, idx: number) => {
          const room = roomData[idx % roomData.length]
          return {
            id: idx + 1,
            schedule_id: schedule.id,
            class_id: cls.id,
            room_id: room?.id || 0,
            course_code: cls.course_code || '',
            course_name: cls.course_name || '',
            section: cls.section || '',
            year_level: cls.year_level || parseInt(cls.section?.charAt(0)) || 1,
            schedule_day: cls.schedule_day || '',
            schedule_time: cls.schedule_time || '',
            campus: room?.campus || '',
            building: room?.building || '',
            room: room?.room || '',
            capacity: room?.capacity || 30,
            teacher_name: '',
            department: cls.department || '',
            lec_hours: cls.lec_hr || 0,
            lab_hours: cls.lab_hr || 0
          }
        })

        setAllocations(mockAllocations)
        
        const uniqueBuildings = [...new Set(mockAllocations.map(a => a.building).filter(Boolean))]
        const uniqueRooms = [...new Set(mockAllocations.map(a => a.room).filter(Boolean))]
        const uniqueSections = [...new Set(mockAllocations.map(a => a.section).filter(Boolean))]
        const uniqueTeachers = [...new Set(mockAllocations.map(a => a.teacher_name).filter(Boolean))]
        const uniqueCourses = [...new Set(mockAllocations.map(a => a.course_code).filter(Boolean))]
        
        // Build building-room mapping
        const brMap = new Map<string, string[]>()
        mockAllocations.forEach(a => {
          if (a.building && a.room) {
            if (!brMap.has(a.building)) {
              brMap.set(a.building, [])
            }
            if (!brMap.get(a.building)!.includes(a.room)) {
              brMap.get(a.building)!.push(a.room)
            }
          }
        })
        
        setBuildings(uniqueBuildings)
        setRooms(uniqueRooms)
        setFilteredRooms(uniqueRooms) // Initially show all rooms
        setSections(uniqueSections)
        setTeachers(uniqueTeachers)
        setCourses(uniqueCourses)
        setBuildingRoomMap(brMap)
      }
    } catch (error) {
      console.error('Error building allocations:', error)
    }
  }

  const buildTimetableData = () => {
    // Filter allocations based on view mode
    let filtered = allocations

    // Apply view mode filter first
    if (timetableViewMode === 'room' && selectedRoom !== 'all') {
      filtered = filtered.filter(a => a.room === selectedRoom)
    } else if (timetableViewMode === 'section' && selectedSection !== 'all') {
      filtered = filtered.filter(a => a.section === selectedSection)
    } else if (timetableViewMode === 'teacher' && selectedTeacher !== 'all') {
      filtered = filtered.filter(a => a.teacher_name === selectedTeacher)
    } else if (timetableViewMode === 'course' && selectedCourse !== 'all') {
      filtered = filtered.filter(a => a.course_code === selectedCourse)
    }

    // Apply additional filters
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

    // Extract unique time slots and days
    const uniqueTimes = [...new Set(filtered.map(a => a.schedule_time).filter(Boolean))].sort((a, b) => {
      // Sort by start time (first time in the range)
      const getStartHour = (time: string) => {
        const startTime = time.split('-')[0].trim()
        const [hour, minute] = startTime.split(':').map(Number)
        return hour * 60 + (minute || 0) // Convert to minutes for comparison
      }
      return getStartHour(a) - getStartHour(b)
    })
    const uniqueDays = [...new Set(filtered.map(a => {
      // Normalize day format
      const day = a.schedule_day?.trim()
      if (!day) return null
      
      // Handle multi-day formats like "M/W/F" or "TTH"
      if (day.includes('/')) {
        return day.split('/').map(d => normalizeDay(d.trim()))
      }
      if (day.toUpperCase() === 'TTH' || day.toUpperCase() === 'TH') {
        return ['Tuesday', 'Thursday']
      }
      if (day.toUpperCase() === 'MWF') {
        return ['Monday', 'Wednesday', 'Friday']
      }
      return normalizeDay(day)
    }).flat().filter(Boolean))]

    // Sort days in week order
    const sortedDays = DAYS.filter(d => uniqueDays.includes(d))
    
    setTimeSlots(uniqueTimes)
    setActiveDays(sortedDays)

    // Build timetable map
    const timetable = new Map<string, TimetableCell>()
    
    filtered.forEach(allocation => {
      const days = expandDays(allocation.schedule_day || '')
      
      days.forEach(day => {
        const key = `${allocation.schedule_time}|${day}`
        
        if (!timetable.has(key)) {
          timetable.set(key, { allocations: [] })
        }
        timetable.get(key)!.allocations.push(allocation)
      })
    })

    setTimetableData(timetable)
  }

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
    return dayMap[day.toUpperCase()] || day
  }

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

  // Format time from 24-hour to 12-hour AM/PM format
  const formatTimeToAMPM = (time24: string): string => {
    if (!time24) return time24
    
    // Handle time ranges like "10:00-11:30" or "13:00-14:30"
    if (time24.includes('-')) {
      const [start, end] = time24.split('-')
      return `${convertTo12Hour(start.trim())}-${convertTo12Hour(end.trim())}`
    }
    
    return convertTo12Hour(time24)
  }

  const convertTo12Hour = (time: string): string => {
    const [hourStr, minuteStr] = time.split(':')
    let hour = parseInt(hourStr)
    const minute = minuteStr || '00'
    
    if (isNaN(hour)) return time
    
    const period = hour >= 12 ? 'PM' : 'AM'
    hour = hour % 12 || 12 // Convert 0 to 12 for midnight, keep 12 for noon
    
    return `${hour}:${minute} ${period}`
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this schedule? This action cannot be undone.')) {
      return
    }

    try {
      // Delete from generated_schedules
      const { error } = await supabase
        .from('generated_schedules')
        .delete()
        .eq('id', id)

      if (error) throw error

      // Also delete room_allocations
      await supabase
        .from('room_allocations')
        .delete()
        .eq('schedule_id', id)

      // Refresh list
      await fetchSchedules()
      if (selectedSchedule?.id === id) {
        setSelectedSchedule(null)
        setAllocations([])
        setViewMode('list')
      }
      alert('Schedule deleted successfully')
    } catch (error: any) {
      console.error('Error deleting schedule:', error)
      alert(`Failed to delete schedule: ${error.message}`)
    }
  }

  const handleExport = () => {
    if (!selectedSchedule || allocations.length === 0) {
      alert('No data to export')
      return
    }

    try {
      const csvRows: string[] = []
      
      // Header info
      csvRows.push(`Schedule Name,${selectedSchedule.schedule_name}`)
      csvRows.push(`School,${selectedSchedule.school_name}`)
      csvRows.push(`College,${selectedSchedule.college}`)
      csvRows.push(`Semester,${selectedSchedule.semester}`)
      csvRows.push(`Academic Year,${selectedSchedule.academic_year}`)
      csvRows.push(`Total Classes,${selectedSchedule.total_classes}`)
      csvRows.push(`Scheduled,${selectedSchedule.scheduled_classes}`)
      csvRows.push(`Unscheduled,${selectedSchedule.unscheduled_classes}`)
      csvRows.push('')
      
      // Data header
      csvRows.push('Day,Time,Course Code,Course Name,Section,Building,Room,Capacity,Department')
      
      // Data rows
      allocations.forEach(allocation => {
        csvRows.push([
          allocation.schedule_day,
          allocation.schedule_time,
          allocation.course_code,
          `"${allocation.course_name}"`,
          allocation.section,
          allocation.building,
          allocation.room,
          allocation.capacity,
          allocation.department || ''
        ].join(','))
      })

      const csvContent = csvRows.join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      
      link.setAttribute('href', url)
      link.setAttribute('download', `schedule_${selectedSchedule.schedule_name}_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error exporting:', error)
      alert('Failed to export')
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleExportImage = async () => {
    if (!timetableRef.current) {
      alert('Timetable not loaded')
      return
    }

    try {
      // Dynamically import html2canvas
      const html2canvas = (await import('html2canvas')).default
      
      const canvas = await html2canvas(timetableRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false
      })
      
      const link = document.createElement('a')
      const viewLabel = timetableViewMode === 'room' ? `Room_${selectedRoom}` :
                       timetableViewMode === 'section' ? `Section_${selectedSection}` :
                       timetableViewMode === 'teacher' ? `Teacher_${selectedTeacher}` :
                       'All'
      
      link.download = `timetable_${selectedSchedule?.schedule_name || 'schedule'}_${viewLabel}_${new Date().toISOString().split('T')[0]}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (error) {
      console.error('Error exporting image:', error)
      alert('Failed to export image. Please make sure html2canvas is installed.')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev)
  }

  // Get cell color based on building or department
  const getCellColor = (allocation: RoomAllocation): string => {
    const colors = [
      'var(--primary-alpha)',
      'rgba(6, 182, 212, 0.15)',
      'rgba(245, 158, 11, 0.15)',
      'rgba(236, 72, 153, 0.15)',
      'rgba(99, 102, 241, 0.15)',
      'rgba(16, 185, 129, 0.15)'
    ]
    const index = buildings.indexOf(allocation.building) % colors.length
    return colors[index] || colors[0]
  }

  return (
    <>
      <MenuBar onToggleSidebar={toggleSidebar} />
      <Sidebar isOpen={sidebarOpen} />
      
      <main className={`${styles.qtimeMain} ${!sidebarOpen ? styles.fullWidth : ''}`}>
        <div className={styles.qtimeContainer}>
          {/* Header */}
          <div className={styles.pageHeader}>
            <button className={styles.backButton} onClick={() => {
              if (selectedSchedule) {
                setSelectedSchedule(null)
                setAllocations([])
                setViewMode('list')
              } else {
                router.back()
              }
            }}>
              <FaArrowLeft /> {selectedSchedule ? 'Back to History' : 'Back'}
            </button>
            
            {selectedSchedule && (
              <div className={styles.headerActions}>
                <button className={styles.actionButton} onClick={handleExportImage}>
                  <FaImage /> Export Image
                </button>
                <button className={styles.actionButton} onClick={handleExport}>
                  <Download size={18} /> Export CSV
                </button>
                <button className={styles.actionButton} onClick={handlePrint}>
                  <Printer size={18} /> Print
                </button>
              </div>
            )}
          </div>

          {/* Welcome Section - Only show when no schedule selected */}
          {!selectedSchedule && (
            <div className={styles.welcomeSection}>
              <h1 className={styles.pageTitle}>
                <Clock style={{ display: 'inline', marginRight: '12px', verticalAlign: 'middle' }} />
                Schedule Generation History
              </h1>
              <p className={styles.pageSubtitle}>
                View and manage all your previously generated room allocation schedules
              </p>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className={styles.loadingState}>
              <div className={styles.spinner}></div>
              <p>Loading schedule history...</p>
            </div>
          )}

          {/* Schedule List View */}
          {!loading && !selectedSchedule && schedules.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <FaDoorOpen />
              </div>
              <h2>No Schedules Found</h2>
              <p>You haven&apos;t created any room allocation schedules yet.</p>
              <button 
                className={styles.primaryButton}
                onClick={() => router.push('/LandingPages/RoomSchedule/GenerateSchedule')}
              >
                <FaPlus style={{ marginRight: '8px' }} />
                Create Schedule
              </button>
            </div>
          )}

          {/* Schedules Grid */}
          {!loading && !selectedSchedule && schedules.length > 0 && (
            <>
              {/* History Controls */}
              <div className={styles.historyControls}>
                <div className={styles.historySearchGroup}>
                  <Search size={18} className={styles.searchIcon} />
                  <input
                    type="text"
                    placeholder="Search schedules by name, school, college..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className={styles.historySearchInput}
                  />
                  {historySearch && (
                    <button 
                      className={styles.clearSearch}
                      onClick={() => setHistorySearch('')}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <div className={styles.historySortGroup}>
                  <label>Sort by:</label>
                  <select 
                    value={historySortBy} 
                    onChange={(e) => setHistorySortBy(e.target.value as 'date' | 'name' | 'classes')}
                    className={styles.sortSelect}
                  >
                    <option value="date">Date Created</option>
                    <option value="name">Name</option>
                    <option value="classes">Total Classes</option>
                  </select>
                  <button 
                    className={styles.sortOrderButton}
                    onClick={() => setHistorySortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    title={historySortOrder === 'asc' ? 'Ascending' : 'Descending'}
                  >
                    {historySortOrder === 'asc' ? '↑' : '↓'}
                  </button>
                </div>
                <div className={styles.historyStats}>
                  <span className={styles.historyCount}>
                    {filteredSchedules.length} of {schedules.length} schedules
                  </span>
                </div>
              </div>

              {filteredSchedules.length === 0 ? (
                <div className={styles.emptyState}>
                  <Search size={48} />
                  <h2>No Matching Schedules</h2>
                  <p>Try adjusting your search criteria.</p>
                </div>
              ) : (
                <div className={styles.schedulesGrid}>
                  {filteredSchedules.map((schedule) => (
                    <div key={schedule.id} className={styles.scheduleCard}>
                      <button
                        className={styles.deleteIconButton}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(schedule.id)
                        }}
                        title="Delete Schedule"
                      >
                        <Trash2 size={16} />
                      </button>

                      <div className={styles.scheduleCardHeader}>
                        <h3 className={styles.scheduleTitle}>{schedule.schedule_name}</h3>
                        <span className={styles.statusBadge}>
                          {schedule.semester} {schedule.academic_year}
                        </span>
                      </div>

                      <div className={styles.scheduleInfoGrid}>
                        <div className={styles.infoItem}>
                          <Building2 size={18} className={styles.infoIcon} />
                          <div>
                            <p className={styles.infoLabel}>School</p>
                            <p className={styles.infoValue}>{schedule.school_name}</p>
                          </div>
                        </div>
                        <div className={styles.infoItem}>
                          <GraduationCap size={18} className={styles.infoIcon} />
                          <div>
                            <p className={styles.infoLabel}>College</p>
                            <p className={styles.infoValue}>{schedule.college}</p>
                          </div>
                        </div>
                      </div>

                      {/* Optimization Stats */}
                      {schedule.optimization_stats && (
                        <div className={styles.optimizationInfo}>
                          <div className={styles.optStatItem}>
                            <span className={styles.optStatLabel}>Processing Time</span>
                            <span className={styles.optStatValue}>
                              {schedule.optimization_stats.time_elapsed_ms 
                                ? `${(schedule.optimization_stats.time_elapsed_ms / 1000).toFixed(2)}s` 
                                : 'N/A'}
                            </span>
                          </div>
                          <div className={styles.optStatItem}>
                            <span className={styles.optStatLabel}>Cost Reduction</span>
                            <span className={styles.optStatValue}>
                              {schedule.optimization_stats.initial_cost && schedule.optimization_stats.final_cost
                                ? `${((1 - schedule.optimization_stats.final_cost / Math.max(schedule.optimization_stats.initial_cost, 1)) * 100).toFixed(1)}%`
                                : 'N/A'}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className={styles.statsContainer}>
                        <div className={`${styles.statBadge} ${styles.total}`}>
                          <div className={`${styles.statIcon} ${styles.total}`}>
                            <BookOpen size={16} />
                          </div>
                          <div>
                            <p className={styles.statLabel}>Total</p>
                            <p className={styles.statValue}>{schedule.total_classes}</p>
                          </div>
                        </div>
                        <div className={`${styles.statBadge} ${styles.success}`}>
                          <div className={`${styles.statIcon} ${styles.success}`}>
                            <CheckCircle2 size={16} />
                          </div>
                          <div>
                            <p className={styles.statLabel}>Scheduled</p>
                            <p className={styles.statValue}>{schedule.scheduled_classes}</p>
                          </div>
                        </div>

                        {schedule.unscheduled_classes > 0 && (
                          <div className={`${styles.statBadge} ${styles.warning}`}>
                            <div className={`${styles.statIcon} ${styles.warning}`}>
                              <FaExclamationTriangle />
                            </div>
                            <div>
                              <p className={styles.statLabel}>Unscheduled</p>
                              <p className={styles.statValue}>{schedule.unscheduled_classes}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className={styles.scheduleActions}>
                        <button
                          className={styles.viewButton}
                          onClick={() => handleSelectSchedule(schedule)}
                        >
                          <Eye size={16} /> View Timetable
                        </button>
                      </div>

                      <div className={styles.cardDate}>
                        Created: {formatDate(schedule.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Timetable View */}
          {selectedSchedule && (
            <div className={styles.timetableSection}>
              {/* Schedule Info Header */}
              <div className={styles.scheduleInfoHeader}>
                <div className={styles.scheduleInfoMain}>
                  <h2>{selectedSchedule.schedule_name}</h2>
                  <p>{selectedSchedule.school_name} • {selectedSchedule.college}</p>
                  <p className={styles.semesterInfo}>
                    {selectedSchedule.semester} {selectedSchedule.academic_year}
                  </p>
                </div>
                <div className={styles.scheduleStats}>
                  <div className={styles.statItem}>
                    <span className={styles.statNumber}>{selectedSchedule.total_classes}</span>
                    <span className={styles.statText}>Total Classes</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={`${styles.statNumber} ${styles.success}`}>{selectedSchedule.scheduled_classes}</span>
                    <span className={styles.statText}>Scheduled</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={`${styles.statNumber} ${styles.warning}`}>{selectedSchedule.unscheduled_classes}</span>
                    <span className={styles.statText}>Unscheduled</span>
                  </div>
                </div>
              </div>

              {/* View Mode Selector */}
              <div className={styles.viewModeSection}>
                <div className={styles.viewModeLabel}>View Timetable By:</div>
                <div className={styles.viewModeButtons}>
                  <button 
                    className={`${styles.viewModeButton} ${timetableViewMode === 'all' ? styles.active : ''}`}
                    onClick={() => { setTimetableViewMode('all'); setSelectedRoom('all'); setSelectedSection('all'); setSelectedTeacher('all'); setSelectedCourse('all'); }}
                  >
                    <Grid3X3 size={16} /> All
                  </button>
                  <button 
                    className={`${styles.viewModeButton} ${timetableViewMode === 'room' ? styles.active : ''}`}
                    onClick={() => setTimetableViewMode('room')}
                  >
                    <DoorOpen size={16} /> By Room
                  </button>
                  <button 
                    className={`${styles.viewModeButton} ${timetableViewMode === 'section' ? styles.active : ''}`}
                    onClick={() => setTimetableViewMode('section')}
                  >
                    <Users size={16} /> By Section
                  </button>
                  <button 
                    className={`${styles.viewModeButton} ${timetableViewMode === 'teacher' ? styles.active : ''}`}
                    onClick={() => setTimetableViewMode('teacher')}
                  >
                    <FaChalkboardTeacher /> By Teacher
                  </button>
                  <button 
                    className={`${styles.viewModeButton} ${timetableViewMode === 'course' ? styles.active : ''}`}
                    onClick={() => setTimetableViewMode('course')}
                  >
                    <BookOpen size={16} /> By Course
                  </button>
                </div>
                
                {/* View Mode Specific Selector */}
                {timetableViewMode === 'room' && (
                  <div className={styles.viewModeSelector}>
                    <label>Select Room:</label>
                    <select 
                      value={selectedRoom} 
                      onChange={(e) => setSelectedRoom(e.target.value)}
                      className={styles.viewModeSelect}
                    >
                      <option value="all">All Rooms</option>
                      {rooms.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                )}
                {timetableViewMode === 'section' && (
                  <div className={styles.viewModeSelector}>
                    <label>Select Section:</label>
                    <select 
                      value={selectedSection} 
                      onChange={(e) => setSelectedSection(e.target.value)}
                      className={styles.viewModeSelect}
                    >
                      <option value="all">All Sections</option>
                      {sections.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                )}
                {timetableViewMode === 'teacher' && (
                  <div className={styles.viewModeSelector}>
                    <label>Select Teacher:</label>
                    <select 
                      value={selectedTeacher} 
                      onChange={(e) => setSelectedTeacher(e.target.value)}
                      className={styles.viewModeSelect}
                    >
                      <option value="all">All Teachers</option>
                      {teachers.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                )}
                {timetableViewMode === 'course' && (
                  <div className={styles.viewModeSelector}>
                    <label>Select Course:</label>
                    <select 
                      value={selectedCourse} 
                      onChange={(e) => setSelectedCourse(e.target.value)}
                      className={styles.viewModeSelect}
                    >
                      <option value="all">All Courses</option>
                      {courses.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Filters */}
              <div className={styles.filtersBar}>
                <div className={styles.filterGroup}>
                  <label>Building</label>
                  <select 
                    value={filterBuilding} 
                    onChange={(e) => setFilterBuilding(e.target.value)}
                    className={styles.filterSelect}
                  >
                    <option value="all">All Buildings</option>
                    {buildings.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.filterGroup}>
                  <label>Room</label>
                  <select 
                    value={filterRoom} 
                    onChange={(e) => setFilterRoom(e.target.value)}
                    className={styles.filterSelect}
                  >
                    <option value="all">All Rooms{filterBuilding !== 'all' ? ` in ${filterBuilding}` : ''}</option>
                    {filteredRooms.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.filterGroup}>
                  <label>Day</label>
                  <select 
                    value={filterDay} 
                    onChange={(e) => setFilterDay(e.target.value)}
                    className={styles.filterSelect}
                  >
                    <option value="all">All Days</option>
                    {DAYS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.searchGroup}>
                  <Search size={18} className={styles.searchIcon} />
                  <input
                    type="text"
                    placeholder="Search course, section, room..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={styles.searchInput}
                  />
                  {searchQuery && (
                    <button 
                      className={styles.clearSearch}
                      onClick={() => setSearchQuery('')}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Loading Details */}
              {loadingDetails ? (
                <div className={styles.loadingState}>
                  <div className={styles.spinner}></div>
                  <p>Loading timetable...</p>
                </div>
              ) : allocations.length === 0 ? (
                <div className={styles.emptyState}>
                  <BookOpen size={48} />
                  <h3>No Allocations Found</h3>
                  <p>This schedule doesn&apos;t have any room allocations yet.</p>
                </div>
              ) : (
                /* Timetable Grid */
                <div className={styles.timetableWrapper} ref={timetableRef}>
                  {/* Timetable Title for Export */}
                  <div className={styles.timetableTitle}>
                    <h3>
                      {timetableViewMode === 'all' && 'All Classes Timetable'}
                      {timetableViewMode === 'room' && selectedRoom !== 'all' && `Room Timetable: ${selectedRoom}`}
                      {timetableViewMode === 'room' && selectedRoom === 'all' && 'Please select a room to view'}
                      {timetableViewMode === 'section' && selectedSection !== 'all' && `Section Timetable: ${selectedSection}`}
                      {timetableViewMode === 'section' && selectedSection === 'all' && 'Please select a section to view'}
                      {timetableViewMode === 'teacher' && selectedTeacher !== 'all' && `Teacher Timetable: ${selectedTeacher}`}
                      {timetableViewMode === 'teacher' && selectedTeacher === 'all' && 'Please select a teacher to view'}
                    </h3>
                    <p className={styles.timetableSubtitle}>
                      {selectedSchedule?.schedule_name} | {selectedSchedule?.school_name}
                    </p>
                  </div>
                  <div className={styles.timetableContainer}>
                    <table className={styles.timetable}>
                      <thead>
                        <tr>
                          <th className={styles.timeHeader}>
                            <Clock size={16} /> Time
                          </th>
                          {activeDays.map(day => (
                            <th key={day} className={styles.dayHeader}>
                              {day}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {timeSlots.map(timeSlot => (
                          <tr key={timeSlot}>
                            <td className={styles.timeCell}>
                              {formatTimeToAMPM(timeSlot)}
                            </td>
                            {activeDays.map(day => {
                              const key = `${timeSlot}|${day}`
                              const cell = timetableData.get(key)
                              
                              return (
                                <td key={day} className={styles.dataCell}>
                                  {cell && cell.allocations.length > 0 ? (
                                    <div className={styles.cellContent}>
                                      {cell.allocations.map((allocation, idx) => (
                                        <div 
                                          key={idx} 
                                          className={styles.allocationCard}
                                          style={{ backgroundColor: getCellColor(allocation) }}
                                        >
                                          <div className={styles.courseCode}>
                                            {allocation.course_code}
                                          </div>
                                          <div className={styles.courseName}>
                                            {allocation.course_name}
                                          </div>
                                          <div className={styles.sectionInfo}>
                                            {allocation.section}
                                          </div>
                                          <div className={styles.roomInfo}>
                                            <DoorOpen size={12} />
                                            {allocation.building} - {allocation.room}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className={styles.emptyCell}>-</div>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Legend */}
              {buildings.length > 0 && (
                <div className={styles.legend}>
                  <span className={styles.legendTitle}>Buildings:</span>
                  {buildings.map((building, idx) => {
                    const colors = [
                      'var(--primary-alpha)',
                      'rgba(6, 182, 212, 0.15)',
                      'rgba(245, 158, 11, 0.15)',
                      'rgba(236, 72, 153, 0.15)',
                      'rgba(99, 102, 241, 0.15)',
                      'rgba(16, 185, 129, 0.15)'
                    ]
                    return (
                      <span 
                        key={building} 
                        className={styles.legendItem}
                        style={{ backgroundColor: colors[idx % colors.length] }}
                      >
                        {building}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  )
}

export default function ViewSchedulePageWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ViewSchedulePage />
    </Suspense>
  )
}
