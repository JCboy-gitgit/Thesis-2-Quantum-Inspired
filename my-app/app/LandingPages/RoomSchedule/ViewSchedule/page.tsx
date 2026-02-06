'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { fetchNoCache } from '@/lib/fetchUtils'
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
  Archive,
  UserPlus,
  Check,
  Loader2
} from 'lucide-react'
import ArchiveModal from '@/app/components/ArchiveModal'

// Untyped supabase helper for tables not in generated types
const db = supabase as any

// Interface for approved faculty
interface ApprovedFaculty {
  id: string
  email: string
  full_name: string
  department_id?: number
  is_active: boolean
}

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
  is_current?: boolean
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

  // Search states for view mode selectors
  const [roomSearchFilter, setRoomSearchFilter] = useState('')
  const [sectionSearchFilter, setSectionSearchFilter] = useState('')
  const [teacherSearchFilter, setTeacherSearchFilter] = useState('')
  const [courseSearchFilter, setCourseSearchFilter] = useState('')

  // Timetable ref for export
  const timetableRef = useRef<HTMLDivElement>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)

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

  // Pagination for timetable views
  const [currentTimetableIndex, setCurrentTimetableIndex] = useState(0)

  // Archive modal state
  const [showArchiveModal, setShowArchiveModal] = useState(false)

  // Faculty assignment modal state
  const [showFacultyAssignModal, setShowFacultyAssignModal] = useState(false)
  const [approvedFaculty, setApprovedFaculty] = useState<ApprovedFaculty[]>([])
  const [selectedFacultyIds, setSelectedFacultyIds] = useState<string[]>([])
  const [loadingFaculty, setLoadingFaculty] = useState(false)
  const [assigningSchedule, setAssigningSchedule] = useState(false)
  const [facultySearchQuery, setFacultySearchQuery] = useState('')
  const [assignmentMessage, setAssignmentMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Auth state to prevent rendering before auth check completes
  const [authChecked, setAuthChecked] = useState(false)
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    let isMounted = true
    
    const initPage = async () => {
      const authorized = await checkAuth()
      if (isMounted && authorized) {
        setIsAuthorized(true)
        setAuthChecked(true)
        await fetchSchedules()
      } else if (isMounted) {
        setAuthChecked(true)
      }
    }
    
    initPage()
    
    return () => {
      isMounted = false
    }
  }, [])

  // Reset timetable index when view mode or selections change
  useEffect(() => {
    setCurrentTimetableIndex(0)
  }, [timetableViewMode, selectedRoom, selectedSection, selectedTeacher, selectedCourse, filterBuilding, filterRoom, filterDay, searchQuery])

  const checkAuth = async (): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        router.push('/')
        return false
      }

      // Only admin can access admin pages
      if (session.user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        router.push('/faculty/home')
        return false
      }
      
      return true
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/')
      return false
    }
  }

  // Fetch approved faculty for assignment modal
  const fetchApprovedFaculty = async () => {
    setLoadingFaculty(true)
    try {
      const response = await fetchNoCache('/api/faculty-default-schedule?action=approved-faculty')
      const data = await response.json()
      
      if (data.success && data.approvedFaculty) {
        setApprovedFaculty(data.approvedFaculty)
      } else {
        console.error('Error fetching approved faculty:', data.error)
      }
    } catch (error) {
      console.error('Error fetching approved faculty:', error)
    } finally {
      setLoadingFaculty(false)
    }
  }

  // Open faculty assignment modal
  const handleOpenFacultyAssignModal = () => {
    setShowFacultyAssignModal(true)
    setSelectedFacultyIds([])
    setFacultySearchQuery('')
    setAssignmentMessage(null)
    fetchApprovedFaculty()
  }

  // Toggle faculty selection
  const toggleFacultySelection = (facultyId: string) => {
    setSelectedFacultyIds(prev => 
      prev.includes(facultyId)
        ? prev.filter(id => id !== facultyId)
        : [...prev, facultyId]
    )
  }

  // Assign schedule to selected faculty
  const handleAssignScheduleToFaculty = async () => {
    if (!selectedSchedule || selectedFacultyIds.length === 0) {
      setAssignmentMessage({ type: 'error', text: 'Please select at least one faculty member' })
      return
    }

    setAssigningSchedule(true)
    try {
      const response = await fetch('/api/faculty-default-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facultyUserIds: selectedFacultyIds,
          scheduleId: selectedSchedule.id
        })
      })

      const data = await response.json()

      if (data.success) {
        setAssignmentMessage({ 
          type: 'success', 
          text: `✅ ${data.message}` 
        })
        setTimeout(() => {
          setShowFacultyAssignModal(false)
          setAssignmentMessage(null)
        }, 2000)
      } else {
        setAssignmentMessage({ type: 'error', text: data.error || 'Failed to assign schedule' })
      }
    } catch (error: any) {
      setAssignmentMessage({ type: 'error', text: error.message || 'Failed to assign schedule' })
    } finally {
      setAssigningSchedule(false)
    }
  }

  // Filter faculty by search query
  const filteredApprovedFaculty = approvedFaculty.filter(f => {
    if (!facultySearchQuery) return true
    const query = facultySearchQuery.toLowerCase()
    return f.full_name?.toLowerCase().includes(query) || 
           f.email?.toLowerCase().includes(query)
  })

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
      const { data: scheduleData, error: scheduleError } = await db
        .from('generated_schedules')
        .select('*')
        .order('created_at', { ascending: false })

      if (!scheduleError && scheduleData && scheduleData.length > 0) {
        // Fetch school names and college names
        const schedulesWithNames = await Promise.all(scheduleData.map(async (schedule: any) => {
          const { data: campusData } = await db
            .from('campuses')
            .select('school_name')
            .eq('upload_group_id', schedule.campus_group_id)
            .limit(1)
            .single()

          const { data: classData } = await db
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
      const { data: allocationData, error: allocationError } = await db
        .from('room_allocations')
        .select('*')
        .eq('schedule_id', schedule.id)
        .order('schedule_day', { ascending: true })
        .order('schedule_time', { ascending: true })

      if (!allocationError && allocationData && allocationData.length > 0) {
        // Check if any allocations are missing teacher_name
        const hasMissingTeachers = allocationData.some((a: any) => !a.teacher_name)
        
        let enrichedAllocations: any[] = allocationData
        
        // If teacher names are missing, try to fetch from teaching_loads
        if (hasMissingTeachers) {
          const { data: teachingLoadsData } = await db
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
            enrichedAllocations = allocationData.map((a: any) => {
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
        
        // Debug: Log all allocations
        console.log('=== ViewSchedule Data Debug ===');
        console.log('Total allocations fetched:', enrichedAllocations.length);
        console.log('Sample allocation:', enrichedAllocations[0]);
        enrichedAllocations.forEach((a: any, i: number) => {
          console.log(`Alloc ${i + 1}: ${a.course_code} | ${a.section} | ${a.room} | ${a.schedule_day} | ${a.schedule_time}`);
        });

        // Extract unique buildings, rooms, sections and teachers
        const uniqueBuildings: string[] = [...new Set(enrichedAllocations.map((a: any) => a.building).filter((b: any): b is string => !!b))]
        const uniqueRooms: string[] = [...new Set(enrichedAllocations.map((a: any) => a.room).filter((r: any): r is string => !!r))]
        // Combine LAB and LEC sections into single entries by stripping all variants of suffixes
        const uniqueSections: string[] = [...new Set(enrichedAllocations.map((a: any) => 
          a.section?.replace(/_LAB$/i, '').replace(/_LEC$/i, '').replace(/_LECTURE$/i, '').replace(/_LABORATORY$/i, '').replace(/ LAB$/i, '').replace(/ LEC$/i, '')
        ).filter((s: any): s is string => !!s))]
        const uniqueTeachers: string[] = [...new Set(enrichedAllocations.map((a: any) => a.teacher_name).filter((t: any): t is string => !!t))]
        const uniqueCourses: string[] = [...new Set(enrichedAllocations.map((a: any) => a.course_code).filter((c: any): c is string => !!c))]
        
        // Build building-room mapping
        const brMap = new Map<string, string[]>()
        enrichedAllocations.forEach((a: any) => {
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
      const { data: classData } = await db
        .from('class_schedules')
        .select('*')
        .eq('upload_group_id', schedule.class_group_id)

      // Fetch rooms
      const { data: roomData } = await db
        .from('campuses')
        .select('*')
        .eq('upload_group_id', schedule.campus_group_id)

      // Fetch teaching loads with faculty names to get assigned teachers
      const { data: teachingLoadsData } = await db
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
        // Combine LAB and LEC sections into single entries by stripping all variants of suffixes
        const uniqueSections = [...new Set(mockAllocations.map(a => 
          a.section?.replace(/_LAB$/i, '').replace(/_LEC$/i, '').replace(/_LECTURE$/i, '').replace(/_LABORATORY$/i, '').replace(/ LAB$/i, '').replace(/ LEC$/i, '')
        ).filter((s): s is string => !!s))]
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
      // Match both LAB and LEC variants of the section
      filtered = filtered.filter(a => {
        const baseSection = a.section?.replace(/_LAB$/i, '').replace(/_LEC$/i, '').replace(/_LECTURE$/i, '').replace(/_LABORATORY$/i, '').replace(/ LAB$/i, '').replace(/ LEC$/i, '')
        return baseSection === selectedSection
      })
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
      const { data: allocationsData, error: fetchAllocError } = await db
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
      const { error: archiveError } = await db
        .from('archived_items')
        .insert(archiveData)

      if (archiveError) {
        console.error('Error archiving schedule:', archiveError)
        throw new Error(`Failed to archive schedule: ${archiveError.message}`)
      }

      // Now delete room_allocations (foreign key constraint)
      const { error: allocError } = await db
        .from('room_allocations')
        .delete()
        .eq('schedule_id', id)

      if (allocError) {
        console.warn('Error deleting room allocations:', allocError)
        // Continue anyway - might not have allocations
      }

      // Delete from generated_schedules
      const { data, error } = await db
        .from('generated_schedules')
        .delete()
        .eq('id', id)
        .select()

      if (error) {
        console.error('Error deleting from generated_schedules:', error)
        throw new Error(`Failed to delete schedule: ${error.message}`)
      }
      
      // Check if any rows were actually deleted (RLS may block silently)
      if (!data || data.length === 0) {
        throw new Error('Delete failed - no rows affected. Please run database/QUICK_FIX_RLS.sql in Supabase to fix permissions.')
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
      router.refresh() // Force refresh cached data
    } catch (error: any) {
      console.error('Error archiving schedule:', error)
      alert(`Failed to archive schedule: ${error.message || 'Unknown error'}`)
    }
  }

  const handleSetCurrentSchedule = async (scheduleId: number) => {
    try {
      const { error: resetError } = await db
        .from('generated_schedules')
        .update({ is_current: false, activated_at: null, activated_by: null })
        .neq('id', scheduleId)

      if (resetError) {
        console.warn('Failed to reset current schedule flags:', resetError)
      }

      const { data: setData, error: setError } = await db
        .from('generated_schedules')
        .update({ is_current: true, activated_at: new Date().toISOString() })
        .eq('id', scheduleId)
        .select()

      if (setError) {
        throw setError
      }
      
      // Check if any rows were actually updated (RLS may block silently)
      if (!setData || setData.length === 0) {
        throw new Error('Update failed - no rows affected. Please run database/QUICK_FIX_RLS.sql in Supabase to fix permissions.')
      }

      // Notify faculty about the newly activated schedule
      await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'New schedule activated',
          message: 'A new current schedule is now active. Please refresh your faculty view.',
          audience: 'faculty',
          severity: 'info',
          category: 'schedule',
          scheduleId
        })
      })

      setSchedules(prev => prev.map(s => ({ ...s, is_current: s.id === scheduleId })))
      router.refresh() // Force refresh cached data
    } catch (error: any) {
      console.error('Failed to set current schedule:', error)
      alert(error?.message || 'Failed to set current schedule')
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

  const handleExportPDF = async (exportType: 'current' | 'all-rooms' | 'all-sections' | 'all-teachers' | 'all-courses' = 'current') => {
    try {
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [215.9, 279.4] // Short bond paper: 8.5" x 11" in mm (portrait)
      })

      const pageWidth = 215.9 // portrait width
      const pageHeight = 279.4 // portrait height
      const margin = 8
      const usableWidth = pageWidth - (margin * 2)

      // Generate comprehensive color palette for all unique courses
      const generateColorPalette = (allocs: RoomAllocation[]) => {
        const uniqueCourses = new Set(allocs.map(a => a.course_code))
        const colorMap = new Map<string, { r: number; g: number; b: number }>()
        
        const colors = [
          { r: 25, g: 118, b: 210 },   // Blue
          { r: 56, g: 142, b: 60 },    // Green
          { r: 245, g: 124, b: 0 },    // Orange
          { r: 123, g: 31, b: 162 },   // Purple
          { r: 0, g: 121, b: 107 },    // Teal
          { r: 194, g: 24, b: 91 },    // Pink
          { r: 93, g: 64, b: 55 },     // Brown
          { r: 69, g: 90, b: 100 },    // Blue-grey
          { r: 230, g: 74, b: 25 },    // Deep Orange
          { r: 0, g: 151, b: 167 },    // Cyan
          { r: 48, g: 63, b: 159 },    // Indigo
          { r: 104, g: 159, b: 56 },   // Light Green
          { r: 251, g: 192, b: 45 },   // Amber
          { r: 198, g: 40, b: 40 },    // Red
          { r: 106, g: 27, b: 154 },   // Deep Purple
          { r: 0, g: 105, b: 92 },     // Dark Teal
          { r: 239, g: 108, b: 0 },    // Amber Dark
          { r: 216, g: 27, b: 96 },    // Magenta
          { r: 78, g: 52, b: 46 },     // Dark Brown
          { r: 1, g: 87, b: 155 }      // Dark Blue
        ]
        
        let colorIdx = 0
        uniqueCourses.forEach(course => {
          colorMap.set(course, colors[colorIdx % colors.length])
          colorIdx++
        })
        
        return colorMap
      }

      // Helper: Draw timetable for specific view (works with any PDF instance)
      const drawTimetableOnPdf = (pdfDoc: InstanceType<typeof jsPDF>, allocData: RoomAllocation[], title: string, colorMap: Map<string, {r: number, g: number, b: number}>) => {
        // QTime Logo - Green Q box with "Qtime Scheduler" text
        const logoSize = 8
        const logoTextSize = 10
        const logoText = 'Qtime Scheduler'
        pdfDoc.setFontSize(logoTextSize)
        pdfDoc.setFont('helvetica', 'bold')
        const textWidth = pdfDoc.getTextWidth(logoText)
        const totalWidth = logoSize + 2 + textWidth  // logo + spacing + text
        const startX = (pageWidth - totalWidth) / 2
        const logoY = margin
        
        // Green rounded rectangle for Q
        pdfDoc.setFillColor(22, 163, 74) // Green (#16a34a)
        pdfDoc.roundedRect(startX, logoY, logoSize, logoSize, 1.5, 1.5, 'F')
        
        // "Q" letter in white
        pdfDoc.setTextColor(255, 255, 255)
        pdfDoc.setFontSize(6)
        pdfDoc.setFont('helvetica', 'bold')
        const qWidth = pdfDoc.getTextWidth('Q')
        pdfDoc.text('Q', startX + (logoSize - qWidth) / 2, logoY + 5.5)
        
        // "Qtime Scheduler" text in black
        pdfDoc.setTextColor(0, 0, 0)
        pdfDoc.setFontSize(logoTextSize)
        pdfDoc.setFont('helvetica', 'bold')
        pdfDoc.text(logoText, startX + logoSize + 2, logoY + 6)
        
        // Reset text color
        pdfDoc.setTextColor(0, 0, 0)

        // Title - centered (below logo)
        pdfDoc.setFontSize(12)
        pdfDoc.setFont('helvetica', 'bold')
        const titleWidth = pdfDoc.getTextWidth(title)
        pdfDoc.text(title, (pageWidth - titleWidth) / 2, margin + 14)
        
        // Subtitle - centered
        pdfDoc.setFontSize(8)
        pdfDoc.setFont('helvetica', 'normal')
        const subtitle = `${selectedSchedule?.schedule_name} | ${selectedSchedule?.school_name}`
        const subtitleWidth = pdfDoc.getTextWidth(subtitle)
        pdfDoc.text(subtitle, (pageWidth - subtitleWidth) / 2, margin + 19)

        // Get color map for this allocation if not provided
        const localColorMap = colorMap.size > 0 ? colorMap : generateColorPalette(allocData)

        // Process allocations into blocks
        const blocks = processAllocationsToBlocks(allocData)
        
        // Table dimensions - portrait (adjusted for logo space)
        const startY = margin + 22
        const timeColWidth = 18
        const dayColWidth = (usableWidth - timeColWidth) / 6 // 6 days for portrait (Mon-Sat)
        const rowHeight = 8
        const timeSlots = generateTimeSlots()

        // Draw header grid and labels
        pdfDoc.setDrawColor(100, 100, 100)
        pdfDoc.setLineWidth(0.5)
        
        // Header row background
        pdfDoc.setFillColor(240, 240, 240)
        pdfDoc.rect(margin, startY, usableWidth, rowHeight, 'F')
        
        // Draw header border
        pdfDoc.setDrawColor(150, 150, 150)
        pdfDoc.rect(margin, startY, usableWidth, rowHeight)

        // Header text
        pdfDoc.setFontSize(7)
        pdfDoc.setFont('helvetica', 'bold')
        pdfDoc.setTextColor(0, 0, 0)
        // Center "Time" header
        const timeHeaderWidth = pdfDoc.getTextWidth('Time')
        pdfDoc.text('Time', margin + (timeColWidth - timeHeaderWidth) / 2, startY + 5.5)
        
        const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        weekdays.forEach((day, idx) => {
          const x = margin + timeColWidth + (idx * dayColWidth)
          // Center full day name in column
          const dayWidth = pdfDoc.getTextWidth(day)
          pdfDoc.text(day, x + (dayColWidth - dayWidth) / 2, startY + 5.5)
          // Draw column separator in header only
          pdfDoc.setDrawColor(150, 150, 150)
          pdfDoc.setLineWidth(0.3)
          pdfDoc.line(x, startY, x, startY + rowHeight)
        })
        // Draw time column separator
        pdfDoc.line(margin + timeColWidth, startY, margin + timeColWidth, startY + rowHeight)

        // Draw time slots and blocks
        timeSlots.forEach((slot, rowIdx) => {
          const y = startY + rowHeight + (rowIdx * rowHeight)
          if (y > pageHeight - margin - 10) return

          // Time label + Section
          pdfDoc.setFontSize(7)
          pdfDoc.setFont('helvetica', 'normal')
          pdfDoc.setTextColor(0, 0, 0)
          const [hour, min] = slot.split(':').map(Number)
          const period = hour >= 12 ? 'PM' : 'AM'
          const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
          pdfDoc.text(`${displayHour}:${min.toString().padStart(2, '0')} ${period}`, margin + 1, y + 3.5)

          // Draw day cells - blocks on top of lines
          weekdays.forEach((day, dayIdx) => {
            const x = margin + timeColWidth + (dayIdx * dayColWidth)
            
            // Find blocks for this day/time
            const dayLower = day.toLowerCase()
            const slotMinutes = hour * 60 + min

            // Check if this slot is covered by any block (to skip drawing line)
            const isCoveredByBlock = blocks.some(b => 
              b.day === dayLower && 
              b.startMinutes <= slotMinutes && 
              b.endMinutes > slotMinutes
            )

            // Only draw horizontal line if NOT covered by a block
            if (!isCoveredByBlock) {
              pdfDoc.setDrawColor(230, 230, 230)
              pdfDoc.setLineWidth(0.15)
              pdfDoc.line(x, y + rowHeight, x + dayColWidth, y + rowHeight)
            }

            const relevantBlocks = blocks.filter(b => 
              b.day === dayLower && 
              b.startMinutes <= slotMinutes && 
              b.endMinutes > slotMinutes
            )

            if (relevantBlocks.length > 0 && slotMinutes === relevantBlocks[0].startMinutes) {
              const block = relevantBlocks[0]
              const durationSlots = Math.ceil((block.endMinutes - block.startMinutes) / 30)
              const blockHeight = durationSlots * rowHeight

              // Color background - solid fill, no lines
              const color = localColorMap.get(block.course_code) || { r: 200, g: 200, b: 200 }
              pdfDoc.setFillColor(color.r, color.g, color.b)
              pdfDoc.rect(x + 0.3, y + 0.3, dayColWidth - 0.6, blockHeight - 0.6, 'F')

              // Calculate center X position for all text
              const centerX = x + dayColWidth / 2

              // Text on top of colored background - CENTERED
              pdfDoc.setTextColor(255, 255, 255)
              let textY = y + 3
              
              // 1. Course Code (bold, larger) - centered
              pdfDoc.setFontSize(7)
              pdfDoc.setFont('helvetica', 'bold')
              const courseText = block.course_code || 'N/A'
              pdfDoc.text(courseText, centerX, textY, { align: 'center' })
              textY += 2.8
              
              // 2. Course Name - centered
              if (blockHeight > 8) {
                pdfDoc.setFontSize(5.5)
                pdfDoc.setFont('helvetica', 'normal')
                const courseNameText = block.course_name || ''
                const courseNameLines = pdfDoc.splitTextToSize(courseNameText.substring(0, 35), dayColWidth - 1.5)
                pdfDoc.text(courseNameLines.slice(0, 1), centerX, textY, { align: 'center' })
                textY += 2.5
              }
              
              // 3. Time Range - centered
              if (blockHeight > 12) {
                pdfDoc.setFontSize(5)
                pdfDoc.setFont('helvetica', 'normal')
                const startH = Math.floor(block.startMinutes / 60)
                const startM = block.startMinutes % 60
                const endH = Math.floor(block.endMinutes / 60)
                const endM = block.endMinutes % 60
                const formatTime = (h: number, m: number) => {
                  const period = h >= 12 ? 'PM' : 'AM'
                  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h
                  return `${displayH}:${m.toString().padStart(2, '0')} ${period}`
                }
                const timeText = `${formatTime(startH, startM)} - ${formatTime(endH, endM)}`
                pdfDoc.text(timeText, centerX, textY, { align: 'center' })
                textY += 2.5
              }
              
              // 4. Section - centered
              if (blockHeight > 16) {
                pdfDoc.setFontSize(5.5)
                pdfDoc.setFont('helvetica', 'normal')
                const sectionText = block.section || 'N/A'
                pdfDoc.text(sectionText.substring(0, 20), centerX, textY, { align: 'center' })
                textY += 2.5
              }
              
              // 5. Room (just room code, strip building name if present) - centered
              if (blockHeight > 20) {
                pdfDoc.setFontSize(5)
                pdfDoc.setFont('helvetica', 'normal')
                const fullRoom = block.room || 'N/A'
                // Extract room code after hyphen (e.g., "Federizo Hall-FH 302" -> "FH 302")
                const roomText = fullRoom.includes('-') ? fullRoom.split('-').slice(1).join('-') : fullRoom
                pdfDoc.text(roomText.substring(0, 25), centerX, textY, { align: 'center' })
                textY += 2.5
              }
              
              // 6. Teacher Name - centered
              if (blockHeight > 24) {
                pdfDoc.setFontSize(5)
                pdfDoc.setFont('helvetica', 'normal')
                const facultyText = block.teacher_name || 'TBD'
                pdfDoc.text(facultyText.substring(0, 20), centerX, textY, { align: 'center' })
              }

              // Draw subtle border around block (no grid lines on top)
              pdfDoc.setDrawColor(255, 255, 255)
              pdfDoc.setLineWidth(0.5)
              pdfDoc.rect(x + 0.3, y + 0.3, dayColWidth - 0.6, blockHeight - 0.6)
            }
          })
          // Lines are already drawn as background before blocks - no need to draw again
        })
      }
      
      // Legacy wrapper for backward compatibility with pageNum
      const drawTimetable = (allocData: RoomAllocation[], title: string, pageNum: number) => {
        if (pageNum > 1) pdf.addPage()
        drawTimetableOnPdf(pdf, allocData, title, generateColorPalette(allocData))
      }

      // Helper: Process allocations to blocks
      const processAllocationsToBlocks = (allocs: RoomAllocation[]) => {
        const blocks: any[] = []
        const groupedMap = new Map()

        allocs.forEach(alloc => {
          const days = expandDays(alloc.schedule_day || '')
          days.forEach(day => {
            const key = `${alloc.course_code}|${alloc.section}|${alloc.room}|${day.toLowerCase()}|${alloc.teacher_name || ''}`
            if (!groupedMap.has(key)) groupedMap.set(key, [])
            groupedMap.get(key).push({ ...alloc, schedule_day: day })
          })
        })

        groupedMap.forEach(allocGroup => {
          const sorted = allocGroup.sort((a: any, b: any) => {
            return parseTimeToMinutes(a.schedule_time || '') - parseTimeToMinutes(b.schedule_time || '')
          })

          let currentBlock: any = null
          sorted.forEach((alloc: any) => {
            const timeParts = (alloc.schedule_time || '').split(/\s*-\s*/)
            if (timeParts.length !== 2) return

            const startMins = parseTimeToMinutes(timeParts[0])
            const endMins = parseTimeToMinutes(timeParts[1])
            if (startMins === 0 && endMins === 0) return

            if (currentBlock && currentBlock.endMinutes === startMins) {
              currentBlock.endMinutes = endMins
            } else {
              if (currentBlock) blocks.push(currentBlock)
              currentBlock = {
                course_code: alloc.course_code,
                course_name: alloc.course_name,
                section: alloc.section,
                room: alloc.room,
                building: alloc.building,
                teacher_name: alloc.teacher_name,
                day: (alloc.schedule_day || '').toLowerCase(),
                startMinutes: startMins,
                endMinutes: endMins
              }
            }
          })
          if (currentBlock) blocks.push(currentBlock)
        })

        return blocks
      }

      // Helper: Generate time slots (7:00 AM to 8:00 PM)
      const generateTimeSlots = () => {
        const slots = []
        for (let i = 0; i < 27; i++) {  // 27 slots = 7:00 AM to 8:00 PM (last row is 8:00 PM)
          const hour = Math.floor(i / 2) + 7
          const minute = (i % 2) * 30
          slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`)
        }
        return slots
      }

      // Generate PDFs based on export type
      let pageCount = 0

      if (exportType === 'current') {
        const viewLabel = timetableViewMode === 'room' ? `Room: ${selectedRoom}` :
          timetableViewMode === 'section' ? `Section: ${selectedSection}` :
            timetableViewMode === 'teacher' ? `Teacher: ${selectedTeacher}` :
              timetableViewMode === 'course' ? `Course: ${selectedCourse}` : 'All Classes'
        drawTimetable(allocations, viewLabel, ++pageCount)
      } else if (exportType === 'all-rooms') {
        // Export all rooms as pages in one PDF
        for (const room of rooms) {
          const roomAllocs = allocations.filter(a => a.room === room)
          if (roomAllocs.length > 0) {
            drawTimetable(roomAllocs, `Room: ${room}`, ++pageCount)
          }
        }
      } else if (exportType === 'all-sections') {
        // Export all sections as pages in one PDF
        for (const section of sections) {
          const sectionAllocs = allocations.filter(a => a.section === section)
          if (sectionAllocs.length > 0) {
            drawTimetable(sectionAllocs, `Section: ${section}`, ++pageCount)
          }
        }
      } else if (exportType === 'all-teachers') {
        // Export all teachers as pages in one PDF
        for (const teacher of teachers) {
          const teacherAllocs = allocations.filter(a => a.teacher_name === teacher)
          if (teacherAllocs.length > 0) {
            drawTimetable(teacherAllocs, `Teacher: ${teacher}`, ++pageCount)
          }
        }
      } else if (exportType === 'all-courses') {
        // Export all courses as pages in one PDF
        for (const course of courses) {
          const courseAllocs = allocations.filter(a => a.course_code === course)
          if (courseAllocs.length > 0) {
            drawTimetable(courseAllocs, `Course: ${course}`, ++pageCount)
          }
        }
      }

      // Save single PDF with all pages
      const fileName = `timetable_${selectedSchedule?.schedule_name}_${exportType}_${new Date().toISOString().split('T')[0]}.pdf`
      pdf.save(fileName)
    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert('Failed to export PDF. Please make sure jsPDF is installed.')
    }
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

  // Get cell color based on building or department - Using solid colors instead of transparency
  const getCellColor = (allocation: RoomAllocation): string => {
    // Light pastel colors that are easier to read and don't use transparency
    const colors = [
      '#E8F5E9',  // Light green
      '#E0F2F1',  // Light teal
      '#FFF3E0',  // Light orange
      '#FCE4EC',  // Light pink
      '#F3E5F5',  // Light purple
      '#E3F2FD'   // Light blue
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
                <div className={styles.exportDropdown}>
                  <button className={styles.actionButton} onClick={() => setShowExportMenu(!showExportMenu)}>
                    <Download size={18} /> Export PDF <ChevronDown size={14} />
                  </button>
                  {showExportMenu && (
                    <div className={styles.exportMenu}>
                      <button onClick={() => { handleExportPDF('current'); setShowExportMenu(false); }}>
                        <Eye size={14} /> Current View
                      </button>
                      <button onClick={() => { handleExportPDF('all-rooms'); setShowExportMenu(false); }}>
                        <DoorOpen size={14} /> All Rooms
                      </button>
                      <button onClick={() => { handleExportPDF('all-sections'); setShowExportMenu(false); }}>
                        <Users size={14} /> All Sections
                      </button>
                      <button onClick={() => { handleExportPDF('all-teachers'); setShowExportMenu(false); }}>
                        <FaChalkboardTeacher /> All Teachers
                      </button>
                      <button onClick={() => { handleExportPDF('all-courses'); setShowExportMenu(false); }}>
                        <BookOpen size={14} /> All Courses
                      </button>
                    </div>
                  )}
                </div>
                <button className={styles.actionButton} onClick={handleExport}>
                  <Download size={18} /> Export CSV
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
              </div>
            </div>
          )}

          {/* Loading State - Show during auth check or data fetch */}
          {(!authChecked || loading) && (
            <div className={styles.loadingState}>
              <div className={styles.spinner}></div>
              <p>{!authChecked ? 'Verifying access...' : 'Loading schedule history...'}</p>
            </div>
          )}

          {/* Schedule List View */}
          {authChecked && isAuthorized && !loading && !selectedSchedule && schedules.length === 0 && (
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
          {authChecked && isAuthorized && !loading && !selectedSchedule && schedules.length > 0 && (
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
                      {schedule.is_current && (
                        <div className={styles.currentBadge}>Current Schedule</div>
                      )}

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
                        <button
                          className={styles.primaryButton}
                          onClick={() => handleSetCurrentSchedule(schedule.id)}
                        >
                          <Check size={16} /> Set Current
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
                  <button
                    className={styles.assignFacultyBtn}
                    onClick={handleOpenFacultyAssignModal}
                    title="Assign this schedule as default for faculty members"
                  >
                    <UserPlus size={18} /> Assign to Faculty
                  </button>
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

                {/* View Mode Specific Selector with Search */}
                {timetableViewMode === 'room' && (
                  <div className={styles.viewModeSelector}>
                    <label>Select Room:</label>
                    <div className={styles.searchableSelect}>
                      <div className={styles.searchInputWrapper}>
                        <Search size={14} />
                        <input
                          type="text"
                          placeholder="Search rooms..."
                          value={roomSearchFilter}
                          onChange={(e) => setRoomSearchFilter(e.target.value)}
                          className={styles.selectSearchInput}
                        />
                        {roomSearchFilter && (
                          <button onClick={() => setRoomSearchFilter('')} className={styles.clearSelectSearch}>
                            <X size={12} />
                          </button>
                        )}
                      </div>
                      <select
                        value={selectedRoom}
                        onChange={(e) => setSelectedRoom(e.target.value)}
                        className={styles.viewModeSelect}
                      >
                        <option value="all">All Rooms ({rooms.length})</option>
                        {rooms
                          .filter(r => r.toLowerCase().includes(roomSearchFilter.toLowerCase()))
                          .map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                      </select>
                    </div>
                  </div>
                )}
                {timetableViewMode === 'section' && (
                  <div className={styles.viewModeSelector}>
                    <label>Select Section:</label>
                    <div className={styles.searchableSelect}>
                      <div className={styles.searchInputWrapper}>
                        <Search size={14} />
                        <input
                          type="text"
                          placeholder="Search sections..."
                          value={sectionSearchFilter}
                          onChange={(e) => setSectionSearchFilter(e.target.value)}
                          className={styles.selectSearchInput}
                        />
                        {sectionSearchFilter && (
                          <button onClick={() => setSectionSearchFilter('')} className={styles.clearSelectSearch}>
                            <X size={12} />
                          </button>
                        )}
                      </div>
                      <select
                        value={selectedSection}
                        onChange={(e) => setSelectedSection(e.target.value)}
                        className={styles.viewModeSelect}
                      >
                        <option value="all">All Sections ({sections.length})</option>
                        {sections
                          .filter(s => s.toLowerCase().includes(sectionSearchFilter.toLowerCase()))
                          .map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                      </select>
                    </div>
                  </div>
                )}
                {timetableViewMode === 'teacher' && (
                  <div className={styles.viewModeSelector}>
                    <label>Select Teacher:</label>
                    <div className={styles.searchableSelect}>
                      <div className={styles.searchInputWrapper}>
                        <Search size={14} />
                        <input
                          type="text"
                          placeholder="Search teachers..."
                          value={teacherSearchFilter}
                          onChange={(e) => setTeacherSearchFilter(e.target.value)}
                          className={styles.selectSearchInput}
                        />
                        {teacherSearchFilter && (
                          <button onClick={() => setTeacherSearchFilter('')} className={styles.clearSelectSearch}>
                            <X size={12} />
                          </button>
                        )}
                      </div>
                      <select
                        value={selectedTeacher}
                        onChange={(e) => setSelectedTeacher(e.target.value)}
                        className={styles.viewModeSelect}
                      >
                        <option value="all">All Teachers ({teachers.length})</option>
                        {teachers
                          .filter(t => t.toLowerCase().includes(teacherSearchFilter.toLowerCase()))
                          .map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                      </select>
                    </div>
                  </div>
                )}
                {timetableViewMode === 'course' && (
                  <div className={styles.viewModeSelector}>
                    <label>Select Course:</label>
                    <div className={styles.searchableSelect}>
                      <div className={styles.searchInputWrapper}>
                        <Search size={14} />
                        <input
                          type="text"
                          placeholder="Search courses..."
                          value={courseSearchFilter}
                          onChange={(e) => setCourseSearchFilter(e.target.value)}
                          className={styles.selectSearchInput}
                        />
                        {courseSearchFilter && (
                          <button onClick={() => setCourseSearchFilter('')} className={styles.clearSelectSearch}>
                            <X size={12} />
                          </button>
                        )}
                      </div>
                      <select
                        value={selectedCourse}
                        onChange={(e) => setSelectedCourse(e.target.value)}
                        className={styles.viewModeSelect}
                      >
                        <option value="all">All Courses ({courses.length})</option>
                        {courses
                          .filter(c => c.toLowerCase().includes(courseSearchFilter.toLowerCase()))
                          .map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                      </select>
                    </div>
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
                /* Timetable Grid - Simplified to match GenerateSchedule */
                <div className={styles.timetableWrapper} ref={timetableRef}>
                  {/* Timetable Title with Navigation */}
                  <div className={styles.timetableTitle}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <div>
                        <h3>
                          {timetableViewMode === 'all' && 'All Classes Timetable'}
                          {timetableViewMode === 'room' && selectedRoom !== 'all' && `Room Timetable: ${selectedRoom}`}
                          {timetableViewMode === 'room' && selectedRoom === 'all' && 'All Rooms Timetable'}
                          {timetableViewMode === 'section' && selectedSection !== 'all' && `Section Timetable: ${selectedSection}`}
                          {timetableViewMode === 'section' && selectedSection === 'all' && 'All Sections Timetable'}
                          {timetableViewMode === 'teacher' && selectedTeacher !== 'all' && `Teacher Timetable: ${selectedTeacher}`}
                          {timetableViewMode === 'teacher' && selectedTeacher === 'all' && 'All Teachers Timetable'}
                          {timetableViewMode === 'course' && selectedCourse !== 'all' && `Course Timetable: ${selectedCourse}`}
                          {timetableViewMode === 'course' && selectedCourse === 'all' && 'All Courses Timetable'}
                        </h3>
                        <p className={styles.timetableSubtitle}>
                          {selectedSchedule?.schedule_name} | {selectedSchedule?.school_name} | Total: {allocations.length} allocations
                        </p>
                      </div>
                    </div>
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
                        if (!timeStr) return 0;
                        const cleanTime = timeStr.trim();
                        const ampmMatch = cleanTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i);
                        if (ampmMatch) {
                          let hour = parseInt(ampmMatch[1]);
                          const minute = parseInt(ampmMatch[2]);
                          const period = ampmMatch[3].toUpperCase();
                          if (period === 'PM' && hour !== 12) hour += 12;
                          if (period === 'AM' && hour === 12) hour = 0;
                          return hour * 60 + minute;
                        }
                        const match = cleanTime.match(/^(\d{1,2}):(\d{2})/);
                        if (!match) return 0;
                        return parseInt(match[1]) * 60 + parseInt(match[2]);
                      };

                      // Type for combined blocks
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

                      // STEP 1: Filter allocations based on current view mode
                      let viewFilteredAllocations = allocations.filter(a => {
                        if (timetableViewMode === 'room' && selectedRoom !== 'all') {
                          if (a.room !== selectedRoom) return false;
                        } else if (timetableViewMode === 'section' && selectedSection !== 'all') {
                          const baseSection = a.section?.replace(/_LAB$/i, '').replace(/_LEC$/i, '').replace(/_LECTURE$/i, '').replace(/_LABORATORY$/i, '').replace(/ LAB$/i, '').replace(/ LEC$/i, '');
                          if (baseSection !== selectedSection) return false;
                        } else if (timetableViewMode === 'teacher' && selectedTeacher !== 'all') {
                          if (a.teacher_name !== selectedTeacher) return false;
                        } else if (timetableViewMode === 'course' && selectedCourse !== 'all') {
                          if (a.course_code !== selectedCourse) return false;
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

                      console.log('ViewSchedule - Filtered allocations:', viewFilteredAllocations.length);

                      // STEP 2: Group by course+section+room+day+teacher to find consecutive slots
                      // Use same approach as GenerateSchedule (NO day expansion - use schedule_day directly)
                      const groupedMap = new Map<string, RoomAllocation[]>();
                      viewFilteredAllocations.forEach(alloc => {
                        const key = `${alloc.course_code}|${alloc.section}|${alloc.room}|${alloc.schedule_day}|${alloc.teacher_name || ''}`;
                        if (!groupedMap.has(key)) {
                          groupedMap.set(key, []);
                        }
                        groupedMap.get(key)!.push(alloc);
                      });

                      // STEP 3: Combine consecutive time slots into blocks
                      const combinedBlocks: CombinedBlock[] = [];
                      groupedMap.forEach((allocs) => {
                        const sorted = allocs.sort((a, b) => {
                          return parseToMinutes(a.schedule_time || '') - parseToMinutes(b.schedule_time || '');
                        });

                        let currentBlock: CombinedBlock | null = null;

                        sorted.forEach(alloc => {
                          const timeStr = alloc.schedule_time || '';
                          const timeParts = timeStr.split(/\s*-\s*/);
                          if (timeParts.length !== 2) return;
                          
                          const startMins = parseToMinutes(timeParts[0]);
                          const endMins = parseToMinutes(timeParts[1]);
                          if (startMins === 0 && endMins === 0) return;

                          if (currentBlock && currentBlock.endMinutes === startMins) {
                            currentBlock.endMinutes = endMins;
                          } else {
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

                      console.log('ViewSchedule - Combined blocks:', combinedBlocks.length);
                      combinedBlocks.forEach((b, i) => {
                        console.log(`  Block ${i}: ${b.course_code} | ${b.day} | ${b.startMinutes}-${b.endMinutes} mins`);
                      });

                      // STEP 4: Limit block duration (max 4 hours)
                      const MAX_BLOCK_DURATION = 240;
                      const finalBlocks = combinedBlocks.map(block => {
                        const duration = block.endMinutes - block.startMinutes;
                        if (duration > MAX_BLOCK_DURATION) {
                          return { ...block, endMinutes: block.startMinutes + MAX_BLOCK_DURATION };
                        }
                        return block;
                      });

                      // STEP 5: Render settings
                      const ROW_HEIGHT = 40;
                      const START_HOUR = 7;
                      const activeDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

                      // Color palette for courses
                      const COURSE_COLORS = [
                        '#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#00796b',
                        '#c2185b', '#5d4037', '#455a64', '#d32f2f', '#303f9f',
                        '#0097a7', '#689f38', '#ffa000', '#512da8', '#e64a19', '#00838f'
                      ];
                      
                      const courseColorMap = new Map<string, string>();
                      const uniqueCourseCodes = [...new Set(finalBlocks.map(b => b.course_code))];
                      uniqueCourseCodes.forEach((code, idx) => {
                        courseColorMap.set(code, COURSE_COLORS[idx % COURSE_COLORS.length]);
                      });

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
                                <th key={day} className={styles.dayHeader}>{day}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from({ length: 26 }, (_, i) => {
                              const hour = START_HOUR + Math.floor(i / 2);
                              const minute = (i % 2) * 30;
                              const isHourMark = minute === 0;
                              const displayTime = formatTimeAMPM(hour, minute);
                              
                              return (
                                <tr key={i} className={isHourMark ? styles.hourRow : styles.halfHourRow}>
                                  <td className={`${styles.timeCell} ${isHourMark ? styles.hourMark : styles.halfHourMark}`}>
                                    {displayTime}
                                  </td>
                                  {activeDays.map(day => {
                                    const blocksStartingHere = finalBlocks.filter(block => {
                                      const blockStartHour = Math.floor(block.startMinutes / 60);
                                      const blockStartMin = block.startMinutes % 60;
                                      return block.day === day.toLowerCase() && 
                                             blockStartHour === hour && 
                                             blockStartMin === minute;
                                    });
                                    
                                    const isCoveredByBlock = finalBlocks.some(block => {
                                      if (block.day !== day.toLowerCase()) return false;
                                      const currentMinutes = hour * 60 + minute;
                                      return block.startMinutes < currentMinutes && currentMinutes < block.endMinutes;
                                    });
                                    
                                    const cellStyle = isCoveredByBlock 
                                      ? { position: 'relative' as const, height: `${ROW_HEIGHT}px`, background: 'transparent' }
                                      : { position: 'relative' as const, height: `${ROW_HEIGHT}px` };
                                    
                                    return (
                                      <td key={`${day}-${i}`} className={styles.dataCell} style={cellStyle}>
                                        {blocksStartingHere.map((block, idx) => {
                                          const durationMinutes = block.endMinutes - block.startMinutes;
                                          const durationSlots = Math.ceil(durationMinutes / 30);
                                          const spanHeight = durationSlots * ROW_HEIGHT;
                                          
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
                                              <div style={{ fontSize: '12px', opacity: 0.95, marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
                                                {block.course_name || ''}
                                              </div>
                                              <div style={{ fontSize: '10px', opacity: 0.85, marginBottom: '4px', fontWeight: 600, backgroundColor: 'rgba(0,0,0,0.15)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', width: 'fit-content' }}>
                                                {displayTimeRange}
                                              </div>
                                              <div style={{ fontSize: '12px', opacity: 0.95, fontWeight: 500 }}>{block.section}</div>
                                              <div style={{ fontSize: '11px', opacity: 0.9, marginTop: '2px' }}>{block.room}</div>
                                              {block.teacher_name && (
                                                <div style={{ fontSize: '10px', opacity: 0.85, marginTop: '2px' }}>{block.teacher_name}</div>
                                              )}
                                            </div>
                                          );
                                        })}
                                        {blocksStartingHere.length === 0 && !isCoveredByBlock && <div className={styles.emptyCell}></div>}
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
                      '#E8F5E9',  // Light green
                      '#E0F2F1',  // Light teal
                      '#FFF3E0',  // Light orange
                      '#FCE4EC',  // Light pink
                      '#F3E5F5',  // Light purple
                      '#E3F2FD'   // Light blue
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

      {/* Faculty Assignment Modal */}
      {showFacultyAssignModal && (
        <div className={styles.modalOverlay} onClick={() => setShowFacultyAssignModal(false)}>
          <div className={styles.facultyAssignModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>
                <UserPlus size={24} style={{ marginRight: '10px', verticalAlign: 'middle' }} />
                Assign Schedule to Faculty
              </h3>
              <button 
                className={styles.modalCloseBtn}
                onClick={() => setShowFacultyAssignModal(false)}
              >
                <X size={24} />
              </button>
            </div>

            <div className={styles.modalBody}>
              {assignmentMessage && (
                <div className={`${styles.assignmentMessage} ${styles[assignmentMessage.type]}`}>
                  {assignmentMessage.type === 'success' ? <CheckCircle2 size={18} /> : <X size={18} />}
                  {assignmentMessage.text}
                </div>
              )}

              <p className={styles.modalDescription}>
                Select approved faculty members to assign <strong>&quot;{selectedSchedule?.schedule_name}&quot;</strong> as their default schedule. 
                Faculty will see this schedule on their home page.
              </p>

              {/* Search */}
              <div className={styles.facultySearchBox}>
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Search faculty by name or email..."
                  value={facultySearchQuery}
                  onChange={(e) => setFacultySearchQuery(e.target.value)}
                />
              </div>

              {/* Faculty List */}
              <div className={styles.facultyList}>
                {loadingFaculty ? (
                  <div className={styles.loadingFaculty}>
                    <Loader2 size={32} className={styles.spinning} />
                    <p>Loading approved faculty...</p>
                  </div>
                ) : filteredApprovedFaculty.length === 0 ? (
                  <div className={styles.noFaculty}>
                    <Users size={48} />
                    <p>{facultySearchQuery ? 'No faculty found matching your search.' : 'No approved faculty found. Approve faculty registrations first.'}</p>
                  </div>
                ) : (
                  filteredApprovedFaculty.map(faculty => (
                    <div 
                      key={faculty.id}
                      className={`${styles.facultyItem} ${selectedFacultyIds.includes(faculty.id) ? styles.selected : ''}`}
                      onClick={() => toggleFacultySelection(faculty.id)}
                    >
                      <div className={styles.facultyCheckbox}>
                        {selectedFacultyIds.includes(faculty.id) ? (
                          <Check size={18} />
                        ) : (
                          <div className={styles.emptyCheckbox}></div>
                        )}
                      </div>
                      <div className={styles.facultyInfo}>
                        <span className={styles.facultyName}>{faculty.full_name}</span>
                        <span className={styles.facultyEmail}>{faculty.email}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Selection Summary */}
              {selectedFacultyIds.length > 0 && (
                <div className={styles.selectionSummary}>
                  <CheckCircle2 size={16} />
                  <span>{selectedFacultyIds.length} faculty member{selectedFacultyIds.length > 1 ? 's' : ''} selected</span>
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button 
                className={styles.cancelBtn}
                onClick={() => setShowFacultyAssignModal(false)}
              >
                Cancel
              </button>
              <button 
                className={styles.assignBtn}
                onClick={handleAssignScheduleToFaculty}
                disabled={selectedFacultyIds.length === 0 || assigningSchedule}
              >
                {assigningSchedule ? (
                  <>
                    <Loader2 size={18} className={styles.spinning} />
                    Assigning...
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    Assign Schedule
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
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
