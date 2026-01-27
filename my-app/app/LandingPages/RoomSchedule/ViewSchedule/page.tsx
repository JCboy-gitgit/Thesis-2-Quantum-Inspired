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
  Image as ImageIcon,
  Archive
} from 'lucide-react'
import ArchiveModal from '@/app/components/ArchiveModal'

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

// Fixed 30-minute time slots from 7:00 AM to 9:00 PM (28 slots)
const FIXED_TIME_SLOTS = Array.from({ length: 28 }, (_, i) => {
  const hour = Math.floor(i / 2) + 7
  const minute = (i % 2) * 30
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
})

// Helper to parse time string to minutes from midnight
const parseTimeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0
  const [hourMin, period] = timeStr.trim().split(' ')
  let [hour, minute] = hourMin.split(':').map(Number)
  if (period?.toUpperCase() === 'PM' && hour !== 12) hour += 12
  if (period?.toUpperCase() === 'AM' && hour === 12) hour = 0
  return hour * 60 + (minute || 0)
}

// Helper to check if an allocation covers a specific time slot
const allocationCoversSlot = (allocation: RoomAllocation, slotTime: string): boolean => {
  const scheduleTime = allocation.schedule_time
  if (!scheduleTime) return false
  
  // Parse schedule_time which can be "7:00-8:30" or "7:00 AM - 8:30 AM"
  const timeParts = scheduleTime.split('-').map(t => t.trim())
  if (timeParts.length !== 2) return false
  
  const startMinutes = parseTimeToMinutes(timeParts[0])
  const endMinutes = parseTimeToMinutes(timeParts[1])
  
  // Parse slot time (e.g., "07:00")
  const [slotHour, slotMinute] = slotTime.split(':').map(Number)
  const slotMinutes = slotHour * 60 + slotMinute
  
  // Check if slot falls within the allocation time range
  return slotMinutes >= startMinutes && slotMinutes < endMinutes
}

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

  // Archive modal state
  const [showArchiveModal, setShowArchiveModal] = useState(false)

  useEffect(() => {
    checkAuth()
    fetchSchedules()
  }, [])

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        router.push('/faculty/login')
        return
      }

      // Only admin can access admin pages
      if (session.user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        router.push('/faculty/home')
        return
      }
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/faculty/login')
    }
  }

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
      } else if (scheduleError) {
        // Log error but don't fallback to schedule_summary
        console.error('Error fetching generated_schedules:', scheduleError)
        setSchedules([])
      } else {
        // No schedules found in generated_schedules
        console.log('No schedules found in generated_schedules table')
        setSchedules([])
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
        // Check if any allocations are missing teacher_name
        const hasMissingTeachers = allocationData.some(a => !a.teacher_name)
        
        let enrichedAllocations = allocationData
        
        // If teacher names are missing, try to fetch from teaching_loads
        if (hasMissingTeachers) {
          const { data: teachingLoadsData } = await supabase
            .from('teaching_loads')
            .select(`
              course_id,
              section,
              faculty_profiles!inner(full_name),
              class_schedules!inner(course_code)
            `)

          if (teachingLoadsData && teachingLoadsData.length > 0) {
            // Build a map of course_code + section -> teacher_name
            const teacherMap = new Map<string, string>()
            teachingLoadsData.forEach((tl: any) => {
              const courseCode = tl.class_schedules?.course_code || ''
              const section = tl.section || ''
              const key = `${courseCode.toLowerCase()}|${section.toLowerCase()}`
              const facultyName = tl.faculty_profiles?.full_name || ''
              if (facultyName && courseCode) {
                teacherMap.set(key, facultyName)
              }
            })

            // Enrich allocations with teacher names
            enrichedAllocations = allocationData.map(a => {
              if (!a.teacher_name && a.course_code) {
                const teacherKey = `${(a.course_code || '').toLowerCase()}|${(a.section || '').toLowerCase()}`
                const teacherName = teacherMap.get(teacherKey) || ''
                return { ...a, teacher_name: teacherName }
              }
              return a
            })
          }
        }
        
        setAllocations(enrichedAllocations)

        // Extract unique buildings, rooms, sections and teachers
        const uniqueBuildings = [...new Set(enrichedAllocations.map(a => a.building).filter((b): b is string => !!b))]
        const uniqueRooms = [...new Set(enrichedAllocations.map(a => a.room).filter((r): r is string => !!r))]
        const uniqueSections = [...new Set(enrichedAllocations.map(a => a.section).filter((s): s is string => !!s))]
        const uniqueTeachers = [...new Set(enrichedAllocations.map(a => a.teacher_name).filter((t): t is string => !!t))]
        const uniqueCourses = [...new Set(enrichedAllocations.map(a => a.course_code).filter((c): c is string => !!c))]
        
        // Build building-room mapping
        const brMap = new Map<string, string[]>()
        enrichedAllocations.forEach(a => {
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
        setFilteredRooms(uniqueRooms)
        setSections(uniqueSections)
        setTeachers(uniqueTeachers)
        setCourses(uniqueCourses)
        setBuildingRoomMap(brMap)
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

      // Fetch teaching loads with faculty names to get assigned teachers
      const { data: teachingLoadsData } = await supabase
        .from('teaching_loads')
        .select(`
          course_id,
          section,
          faculty_profiles!inner(full_name),
          class_schedules!inner(course_code)
        `)

      // Build a map of course_code + section -> teacher_name
      const teacherMap = new Map<string, string>()
      if (teachingLoadsData) {
        teachingLoadsData.forEach((tl: any) => {
          const courseCode = tl.class_schedules?.course_code || ''
          const section = tl.section || ''
          const key = `${courseCode.toLowerCase()}|${section.toLowerCase()}`
          const facultyName = tl.faculty_profiles?.full_name || ''
          if (facultyName && courseCode) {
            teacherMap.set(key, facultyName)
          }
        })
      }

      if (classData && roomData) {
        // Simple allocation: assign classes to rooms round-robin
        const mockAllocations: RoomAllocation[] = classData.map((cls: any, idx: number) => {
          const room = roomData[idx % roomData.length]
          // Try to find teacher from teaching_loads using course_code
          const teacherKey = `${(cls.course_code || '').toLowerCase()}|${(cls.section || '').toLowerCase()}`
          const teacherName = teacherMap.get(teacherKey) || ''
          
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
            teacher_name: teacherName,
            department: cls.department || '',
            lec_hours: cls.lec_hr || 0,
            lab_hours: cls.lab_hr || 0
          }
        })

        setAllocations(mockAllocations)

        const uniqueBuildings = [...new Set(mockAllocations.map(a => a.building).filter((b): b is string => !!b))]
        const uniqueRooms = [...new Set(mockAllocations.map(a => a.room).filter((r): r is string => !!r))]
        const uniqueSections = [...new Set(mockAllocations.map(a => a.section).filter((s): s is string => !!s))]
        const uniqueTeachers = [...new Set(mockAllocations.map(a => a.teacher_name).filter((t): t is string => !!t))]
        const uniqueCourses = [...new Set(mockAllocations.map(a => a.course_code).filter((c): c is string => !!c))]

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

    // Extract unique days from filtered allocations
    const uniqueDays = [...new Set(filtered.map(a => {
      const day = a.schedule_day?.trim()
      if (!day) return null

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

    // Use fixed 30-minute time slots
    setTimeSlots(FIXED_TIME_SLOTS)
    // Always show Monday-Saturday (fixed columns)
    setActiveDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])

    // Build timetable map using fixed time slots
    const timetable = new Map<string, TimetableCell>()

    // For each fixed time slot and day, find matching allocations
    FIXED_TIME_SLOTS.forEach(slotTime => {
      DAYS.forEach(day => {
        const key = `${slotTime}|${day}`
        const matchingAllocations = filtered.filter(allocation => {
          const allocationDays = expandDays(allocation.schedule_day || '')
          return allocationDays.includes(day) && allocationCoversSlot(allocation, slotTime)
        })
        
        if (matchingAllocations.length > 0) {
          timetable.set(key, { allocations: matchingAllocations })
        }
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
    if (!confirm('Are you sure you want to archive this schedule? You can restore it from the Archive later.')) {
      return
    }

    try {
      // First, get the schedule data to archive
      const scheduleToArchive = schedules.find(s => s.id === id)
      if (!scheduleToArchive) {
        throw new Error('Schedule not found')
      }

      // Get the room allocations for this schedule
      const { data: allocationsData, error: fetchAllocError } = await supabase
        .from('room_allocations')
        .select('*')
        .eq('schedule_id', id)

      if (fetchAllocError) {
        console.warn('Error fetching allocations for archive:', fetchAllocError)
      }

      // Archive the schedule with its allocations
      const archiveData = {
        item_type: 'schedule',
        item_name: scheduleToArchive.schedule_name,
        item_data: {
          schedule: scheduleToArchive,
          allocations: allocationsData || []
        },
        original_table: 'generated_schedules',
        original_id: id,
        deleted_at: new Date().toISOString(),
        deleted_by: null // Could be set to current user if auth is implemented
      }

      // Insert into archived_items table
      const { error: archiveError } = await supabase
        .from('archived_items')
        .insert(archiveData)

      if (archiveError) {
        console.error('Error archiving schedule:', archiveError)
        throw new Error(`Failed to archive schedule: ${archiveError.message}`)
      }

      // Now delete room_allocations (foreign key constraint)
      const { error: allocError } = await supabase
        .from('room_allocations')
        .delete()
        .eq('schedule_id', id)

      if (allocError) {
        console.warn('Error deleting room allocations:', allocError)
        // Continue anyway - might not have allocations
      }

      // Delete from generated_schedules
      const { error } = await supabase
        .from('generated_schedules')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error deleting from generated_schedules:', error)
        throw new Error(`Failed to delete schedule: ${error.message}`)
      }

      // Update local state immediately
      setSchedules(prev => prev.filter(s => s.id !== id))
      setFilteredSchedules(prev => prev.filter(s => s.id !== id))

      // Clear selection if deleted schedule was selected
      if (selectedSchedule?.id === id) {
        setSelectedSchedule(null)
        setAllocations([])
        setViewMode('list')
      }

      alert('Schedule archived successfully! You can restore it from the Archive.')
    } catch (error: any) {
      console.error('Error archiving schedule:', error)
      alert(`Failed to archive schedule: ${error.message || 'Unknown error'}`)
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
    <div data-page="admin">
      <MenuBar
        onToggleSidebar={toggleSidebar}
        showSidebarToggle={true}
        setSidebarOpen={setSidebarOpen}
      />
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
              <div className={styles.welcomeHeader}>
                <div>
                  <h1 className={styles.pageTitle}>
                    <Clock style={{ display: 'inline', marginRight: '12px', verticalAlign: 'middle' }} />
                    Schedule Generation History
                  </h1>
                  <p className={styles.pageSubtitle}>
                    View and manage all your previously generated room allocation schedules
                  </p>
                </div>
                <button 
                  className={styles.archiveButton} 
                  onClick={() => setShowArchiveModal(true)}
                >
                  <Archive size={18} /> View Archive
                </button>
              </div>
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
                /* Timetable Grid - Using combined blocks like GenerateSchedule */
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
                      {timetableViewMode === 'course' && selectedCourse !== 'all' && `Course Timetable: ${selectedCourse}`}
                      {timetableViewMode === 'course' && selectedCourse === 'all' && 'Please select a course to view'}
                    </h3>
                    <p className={styles.timetableSubtitle}>
                      {selectedSchedule?.schedule_name} | {selectedSchedule?.school_name}
                    </p>
                  </div>
                  <div className={styles.timetableContainer}>
                    {(() => {
                      // Helper: Format time as AM/PM
                      const formatTimeAMPM = (hour: number, minute: number): string => {
                        const period = hour >= 12 ? 'PM' : 'AM';
                        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                        return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
                      };

                      // Helper: Parse time string to minutes
                      const parseToMinutes = (timeStr: string): number => {
                        const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
                        if (!match) return 0;
                        return parseInt(match[1]) * 60 + parseInt(match[2]);
                      };

                      // Pre-process allocations: Group consecutive slots into combined blocks
                      type CombinedBlock = {
                        course_code: string;
                        course_name: string;
                        section: string;
                        room: string;
                        building: string;
                        teacher_name: string;
                        day: string;
                        startMinutes: number;
                        endMinutes: number;
                      };

                      // Filter allocations based on current view
                      let viewFilteredAllocations = allocations.filter(a => {
                        if (timetableViewMode === 'room' && selectedRoom !== 'all') {
                          return a.room === selectedRoom;
                        } else if (timetableViewMode === 'section' && selectedSection !== 'all') {
                          return a.section === selectedSection;
                        } else if (timetableViewMode === 'teacher' && selectedTeacher !== 'all') {
                          return a.teacher_name === selectedTeacher;
                        } else if (timetableViewMode === 'course' && selectedCourse !== 'all') {
                          return a.course_code === selectedCourse;
                        }
                        // Apply additional filters
                        if (filterBuilding !== 'all' && a.building !== filterBuilding) return false;
                        if (filterRoom !== 'all' && a.room !== filterRoom) return false;
                        if (filterDay !== 'all' && !a.schedule_day?.toLowerCase().includes(filterDay.toLowerCase())) return false;
                        if (searchQuery) {
                          const query = searchQuery.toLowerCase();
                          if (!a.course_code?.toLowerCase().includes(query) &&
                              !a.course_name?.toLowerCase().includes(query) &&
                              !a.section?.toLowerCase().includes(query) &&
                              !a.room?.toLowerCase().includes(query) &&
                              !a.teacher_name?.toLowerCase().includes(query)) {
                            return false;
                          }
                        }
                        return true;
                      });

                      // Group by course+section+room+day+teacher to find consecutive slots
                      const groupedMap = new Map<string, typeof viewFilteredAllocations>();
                      viewFilteredAllocations.forEach(alloc => {
                        // Expand days (handle TTH, MWF, etc.)
                        const expandedDays = expandDays(alloc.schedule_day || '');
                        expandedDays.forEach(day => {
                          const key = `${alloc.course_code}|${alloc.section}|${alloc.room}|${day.toLowerCase()}|${alloc.teacher_name || ''}`;
                          if (!groupedMap.has(key)) {
                            groupedMap.set(key, []);
                          }
                          groupedMap.get(key)!.push({...alloc, schedule_day: day});
                        });
                      });

                      // For each group, combine consecutive time slots
                      const combinedBlocks: CombinedBlock[] = [];
                      groupedMap.forEach((allocs) => {
                        // Sort by start time
                        const sorted = allocs.sort((a, b) => {
                          return parseToMinutes(a.schedule_time || '') - parseToMinutes(b.schedule_time || '');
                        });

                        // Merge consecutive slots
                        let currentBlock: CombinedBlock | null = null;
                        
                        sorted.forEach(alloc => {
                          const timeStr = alloc.schedule_time || '';
                          const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
                          if (!timeMatch) return;
                          
                          const startMins = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
                          const endMins = parseInt(timeMatch[3]) * 60 + parseInt(timeMatch[4]);

                          if (currentBlock && currentBlock.endMinutes === startMins) {
                            // Extend current block
                            currentBlock.endMinutes = endMins;
                          } else {
                            // Start new block
                            if (currentBlock) {
                              combinedBlocks.push(currentBlock);
                            }
                            currentBlock = {
                              course_code: alloc.course_code || '',
                              course_name: alloc.course_name || '',
                              section: alloc.section || '',
                              room: alloc.room || '',
                              building: alloc.building || '',
                              teacher_name: alloc.teacher_name || '',
                              day: (alloc.schedule_day || '').toLowerCase(),
                              startMinutes: startMins,
                              endMinutes: endMins
                            };
                          }
                        });
                        
                        if (currentBlock) {
                          combinedBlocks.push(currentBlock);
                        }
                      });

                      const ROW_HEIGHT = 40;
                      const START_HOUR = 7;

                      // Color palette for courses - distinct, vibrant colors
                      const COURSE_COLORS = [
                        '#1976d2', // Blue
                        '#388e3c', // Green
                        '#f57c00', // Orange
                        '#7b1fa2', // Purple
                        '#00796b', // Teal
                        '#c2185b', // Pink
                        '#5d4037', // Brown
                        '#455a64', // Blue Grey
                        '#d32f2f', // Red
                        '#303f9f', // Indigo
                        '#0097a7', // Cyan
                        '#689f38', // Light Green
                        '#ffa000', // Amber
                        '#512da8', // Deep Purple
                        '#e64a19', // Deep Orange
                        '#00838f', // Cyan Dark
                      ];
                      
                      // Build a map of unique course codes to colors for consistency
                      const courseColorMap = new Map<string, string>();
                      const uniqueCourseCodes = [...new Set(combinedBlocks.map(b => b.course_code))];
                      uniqueCourseCodes.forEach((code, idx) => {
                        courseColorMap.set(code, COURSE_COLORS[idx % COURSE_COLORS.length]);
                      });

                      // Get color based on course_code (same subject = same color)
                      const getBlockColor = (block: CombinedBlock): string => {
                        return courseColorMap.get(block.course_code) || '#1976d2';
                      };

                      return (
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
                            {/* Generate 30-minute time slots from 7:00 AM to 9:00 PM */}
                            {Array.from({ length: 28 }, (_, i) => {
                              const totalMinutes = (START_HOUR * 60) + (i * 30);
                              const hour = Math.floor(totalMinutes / 60);
                              const minute = totalMinutes % 60;
                              const displayTime = formatTimeAMPM(hour, minute);
                              const isHourMark = minute === 0;
                              
                              return (
                                <tr key={i} className={isHourMark ? styles.hourRow : styles.halfHourRow}>
                                  <td className={`${styles.timeCell} ${isHourMark ? styles.hourMark : styles.halfHourMark}`}>
                                    {displayTime}
                                  </td>
                                  {activeDays.map(day => {
                                    // Find blocks that START at this exact time slot for this day
                                    const blocksStartingHere = combinedBlocks.filter(block => {
                                      const blockStartHour = Math.floor(block.startMinutes / 60);
                                      const blockStartMin = block.startMinutes % 60;
                                      return block.day === day.toLowerCase() && 
                                             blockStartHour === hour && 
                                             blockStartMin === minute;
                                    });
                                    
                                    return (
                                      <td key={`${day}-${i}`} className={styles.dataCell} style={{ position: 'relative', height: `${ROW_HEIGHT}px` }}>
                                        {blocksStartingHere.map((block, idx) => {
                                          // Calculate duration in 30-min slots
                                          const durationMinutes = block.endMinutes - block.startMinutes;
                                          const durationSlots = Math.ceil(durationMinutes / 30);
                                          const spanHeight = durationSlots * ROW_HEIGHT;
                                          
                                          // Format display time as AM/PM
                                          const startH = Math.floor(block.startMinutes / 60);
                                          const startM = block.startMinutes % 60;
                                          const endH = Math.floor(block.endMinutes / 60);
                                          const endM = block.endMinutes % 60;
                                          const displayTimeRange = `${formatTimeAMPM(startH, startM)} - ${formatTimeAMPM(endH, endM)}`;
                                          
                                          return (
                                            <div
                                              key={idx}
                                              className={styles.allocationBlock}
                                              style={{
                                                backgroundColor: getBlockColor(block),
                                                color: '#fff',
                                                position: 'absolute',
                                                top: 0,
                                                left: '2px',
                                                right: '2px',
                                                height: `${spanHeight - 2}px`,
                                                zIndex: 10,
                                                overflow: 'hidden',
                                                borderRadius: '8px',
                                                padding: '8px 10px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'flex-start',
                                                boxShadow: '0 3px 8px rgba(0,0,0,0.3)',
                                                border: '1px solid rgba(255,255,255,0.2)'
                                              }}
                                              title={`${block.course_code} - ${block.course_name}\nSection: ${block.section}\nRoom: ${block.building} - ${block.room}\nTime: ${displayTimeRange}\nTeacher: ${block.teacher_name || 'TBD'}`}
                                            >
                                              <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                                                {block.course_code || 'N/A'}
                                              </div>
                                              <div style={{ fontSize: '12px', opacity: 0.95, marginBottom: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
                                                {block.course_name || ''}
                                              </div>
                                              {/* Show different info based on view */}
                                              {timetableViewMode === 'room' && (
                                                <>
                                                  <div style={{ fontSize: '12px', opacity: 0.95, fontWeight: 500 }}>{block.section || 'N/A'}</div>
                                                  <div style={{ fontSize: '11px', opacity: 0.9, marginTop: '2px' }}>{block.teacher_name || 'TBD'}</div>
                                                </>
                                              )}
                                              {timetableViewMode === 'section' && (
                                                <>
                                                  <div style={{ fontSize: '12px', opacity: 0.95, fontWeight: 500 }}>{block.building} - {block.room}</div>
                                                  <div style={{ fontSize: '11px', opacity: 0.9, marginTop: '2px' }}>{block.teacher_name || 'TBD'}</div>
                                                </>
                                              )}
                                              {timetableViewMode === 'teacher' && (
                                                <>
                                                  <div style={{ fontSize: '12px', opacity: 0.95, fontWeight: 500 }}>{block.section}</div>
                                                  <div style={{ fontSize: '11px', opacity: 0.9, marginTop: '2px' }}>{block.building} - {block.room}</div>
                                                </>
                                              )}
                                              {timetableViewMode === 'course' && (
                                                <>
                                                  <div style={{ fontSize: '12px', opacity: 0.95, fontWeight: 500 }}>{block.section}</div>
                                                  <div style={{ fontSize: '11px', opacity: 0.9, marginTop: '2px' }}>{block.teacher_name || 'TBD'}</div>
                                                </>
                                              )}
                                              {timetableViewMode === 'all' && (
                                                <>
                                                  <div style={{ fontSize: '12px', opacity: 0.95, fontWeight: 500 }}>{block.section}</div>
                                                  <div style={{ fontSize: '11px', opacity: 0.9, marginTop: '2px' }}>{block.room}</div>
                                                </>
                                              )}
                                            </div>
                                          );
                                        })}
                                        {blocksStartingHere.length === 0 && <div className={styles.emptyCell}></div>}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      );
                    })()}
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

      {/* Archive Modal */}
      <ArchiveModal
        isOpen={showArchiveModal}
        onClose={() => setShowArchiveModal(false)}
        onRestore={() => {
          // Refresh schedules after restore
          fetchSchedules()
          setShowArchiveModal(false)
        }}
      />
    </div>
  )
}

export default function ViewSchedulePageWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ViewSchedulePage />
    </Suspense>
  )
}
