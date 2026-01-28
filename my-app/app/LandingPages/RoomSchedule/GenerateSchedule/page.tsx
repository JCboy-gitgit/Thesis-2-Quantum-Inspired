'use client'
import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './GenerateSchedule.module.css'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import { supabase } from '@/lib/supabaseClient'
import {
  FaCalendarPlus, FaArrowLeft, FaBuilding, FaDoorOpen,
  FaUserGraduate, FaChalkboardTeacher, FaCog, FaPlay,
  FaCheckCircle, FaExclamationTriangle, FaSpinner, FaClock,
  FaSync, FaDownload, FaChartBar, FaLayerGroup, FaUsers,
  FaBolt, FaAtom, FaFileAlt, FaCalendar, FaChevronDown, FaChevronRight,
  FaEye, FaTimes, FaFilter
} from 'react-icons/fa'
import {
  University,
  FileSpreadsheet,
  GraduationCap,
  BookOpen,
  Users,
  Settings,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Building2,
  DoorOpen,
  ChevronDown,
  ChevronRight,
  Play,
  RotateCcw,
  Eye,
  X,
  Upload
} from 'lucide-react'

// ==================== Types ====================
interface CampusGroup {
  upload_group_id: number
  school_name: string
  file_name: string
  created_at: string
  room_count: number
  total_capacity: number
}

interface YearBatch {
  id: number
  year_batch: string
  academic_year: string
  is_active?: boolean
  created_at: string
}

interface Section {
  id: number
  section_name: string
  year_batch_id: number
  year_batch?: string
  year_level: number
  degree_program: string
  department?: string | null
  college?: string | null
  student_count: number
  max_capacity: number
  is_active?: boolean
  created_at: string
}

interface SectionCourse {
  id: number
  course_code: string
  course_name: string
  lec_hours: number
  lab_hours: number
  total_hours: number
  semester: string
  academic_year: string
  department: string
  college: string
  degree_program: string | null
  year_level: number
}

interface TeacherGroup {
  upload_group_id: number
  college: string
  file_name: string
  created_at: string
  teacher_count: number
}

interface CampusRoom {
  id: number
  campus: string
  building: string
  room: string
  capacity: number
  room_type: string
  floor_number: number
  has_ac: boolean
  has_projector: boolean
  is_pwd_accessible: boolean
}

interface ClassSchedule {
  id: number
  course_code: string
  course_name: string
  section: string
  year_level: number
  student_count: number
  schedule_day: string
  schedule_time: string
  lec_hours: number
  lab_hours: number
  total_hours: number
  department: string
  semester: string
  academic_year: string
  teacher_name?: string  // Assigned professor/teacher
}

interface TeacherSchedule {
  id: number
  teacher_id: string
  name: string
  schedule_day: string
  schedule_time: string
  department: string
  email: string
}

interface ScheduleConfig {
  scheduleName: string
  semester: string
  academicYear: string
  maxIterations: number
  initialTemperature: number
  coolingRate: number
  quantumTunnelingProbability: number
  maxTeacherHoursPerDay: number
  avoidConflicts: boolean
  onlineDays: string[] // Days when all classes are online
}

interface TimeSettings {
  startTime: string // "07:00"
  endTime: string   // "20:00"
  slotDuration: number // 60 minutes
  includeSaturday: boolean
  includeSunday: boolean
  // Lunch break settings
  lunchBreakEnabled: boolean
  lunchBreakStart: string  // "13:00" = 1:00 PM
  lunchBreakEnd: string    // "14:00" = 2:00 PM
  lunchBreakStrict: boolean // true = hard constraint (no classes), false = soft constraint (avoid if possible)
}

interface TimeSlot {
  id: number
  slot_name: string
  start_time: string
  end_time: string
  duration_minutes: number
}

interface RoomAllocation {
  class_id: number
  room_id: number
  course_code: string
  course_name: string
  section: string
  year_level: number
  schedule_day: string
  schedule_time: string
  campus: string
  building: string
  room: string
  capacity: number
  department: string
  lec_hours: number
  lab_hours: number
  teacher_name?: string  // BulSU QSA: Teacher/faculty name
  is_online?: boolean    // BulSU QSA: Online class flag
}

interface UnscheduledItem {
  id: number
  section_code: string
  course_code: string
  course_name: string
  teacher_name: string
  needed_slots: number
  assigned_slots: number
  reason: string
}

interface ScheduleResult {
  success: boolean
  scheduleId: number
  savedToDatabase: boolean
  message: string
  totalClasses: number
  scheduledClasses: number
  unscheduledClasses: number
  unscheduledList: UnscheduledItem[]
  conflicts: { conflict_type: string; description: string }[]
  optimizationStats: {
    initialCost: number
    finalCost: number
    iterations: number
    improvements: number
    quantumTunnels: number
    blockSwaps: number  // BulSU QSA: Block swap count
    conflictCount: number  // BulSU QSA: Hard constraint violations detected
    timeElapsedMs: number
  }
  allocations: RoomAllocation[]
  // BulSU QSA: Online class stats
  onlineDays?: string[]
  onlineClassCount?: number
  physicalClassCount?: number
}

// Days for timetable
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Utility function to generate time slots from settings
function generateTimeSlots(settings: TimeSettings): TimeSlot[] {
  const slots: TimeSlot[] = []
  const [startHour, startMin] = settings.startTime.split(':').map(Number)
  const [endHour, endMin] = settings.endTime.split(':').map(Number)

  let currentTime = startHour * 60 + startMin // Convert to minutes
  const endTimeMinutes = endHour * 60 + endMin
  let slotId = 1

  while (currentTime < endTimeMinutes) {
    const hour = Math.floor(currentTime / 60)
    const min = currentTime % 60
    const nextTime = currentTime + settings.slotDuration
    const nextHour = Math.floor(nextTime / 60)
    const nextMin = nextTime % 60

    slots.push({
      id: slotId++,
      slot_name: `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')} - ${nextHour.toString().padStart(2, '0')}:${nextMin.toString().padStart(2, '0')}`,
      start_time: `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`,
      end_time: `${nextHour.toString().padStart(2, '0')}:${nextMin.toString().padStart(2, '0')}`,
      duration_minutes: settings.slotDuration
    })

    currentTime = nextTime
  }

  return slots
}

export default function GenerateSchedulePage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [scheduling, setScheduling] = useState(false)

  // Data source states
  const [campusGroups, setCampusGroups] = useState<CampusGroup[]>([])
  const [yearBatches, setYearBatches] = useState<YearBatch[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [courses, setCourses] = useState<SectionCourse[]>([])

  // Selected data - support multiple campus groups
  const [selectedCampusGroups, setSelectedCampusGroups] = useState<number[]>([])
  const [selectedYearBatch, setSelectedYearBatch] = useState<number | null>(null)

  // Loaded detailed data
  const [rooms, setRooms] = useState<CampusRoom[]>([])
  const [classes, setClasses] = useState<ClassSchedule[]>([])
  const [teachers, setTeachers] = useState<TeacherSchedule[]>([])

  // Configuration
  const [config, setConfig] = useState<ScheduleConfig>({
    scheduleName: '',
    semester: '1st Semester',
    academicYear: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
    maxIterations: 10000, // Default to maximum
    initialTemperature: 200,
    coolingRate: 0.999,
    quantumTunnelingProbability: 0.15,
    maxTeacherHoursPerDay: 8,
    avoidConflicts: true,
    onlineDays: [] // Days where all classes are online
  })

  // Time Configuration
  const [timeSettings, setTimeSettings] = useState<TimeSettings>({
    startTime: '07:00',
    endTime: '20:00',
    slotDuration: 90, // Fixed to 90 minutes (1.5 hours) - standard academic period
    includeSaturday: true,
    includeSunday: false,
    // Lunch break settings - default 1:00 PM to 2:00 PM
    lunchBreakEnabled: true,
    lunchBreakStart: '13:00',
    lunchBreakEnd: '14:00',
    lunchBreakStrict: true // No classes during lunch (hard constraint)
  })

  // UI states
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1)
  const [timer, setTimer] = useState(0)
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [showTimetable, setShowTimetable] = useState(false)
  const [timetableView, setTimetableView] = useState<'room' | 'section' | 'teacher'>('room') // NEW: Toggle between views
  const [selectedTimetableRoom, setSelectedTimetableRoom] = useState<string>('all') // NEW: Filter by specific room
  const [selectedTimetableSection, setSelectedTimetableSection] = useState<string>('all') // NEW: Filter by specific section
  const [selectedTimetableTeacher, setSelectedTimetableTeacher] = useState<string>('all') // NEW: Filter by specific teacher

  // Expanded sections
  const [expandedCampus, setExpandedCampus] = useState(false)
  const [expandedSections, setExpandedSections] = useState(false)

  // Building and room filters
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([])
  const [selectedRooms, setSelectedRooms] = useState<number[]>([])
  const [showBuildingFilter, setShowBuildingFilter] = useState(false)
  const [roomSearchQuery, setRoomSearchQuery] = useState('') // NEW: Room search functionality
  const [roomFilterCapacity, setRoomFilterCapacity] = useState<number | null>(null) // NEW: Filter by capacity
  const [roomFilterType, setRoomFilterType] = useState<string>('') // NEW: Filter by room type

  // File viewer states
  const [showClassFileViewer, setShowClassFileViewer] = useState(false)
  const [viewerData, setViewerData] = useState<any[]>([])
  const [viewerLoading, setViewerLoading] = useState(false)

  // Auto-generate toggle state
  const [autoGenerateEnabled, setAutoGenerateEnabled] = useState(false)
  const [lastDataHash, setLastDataHash] = useState<string>('')
  const [autoGenerateCountdown, setAutoGenerateCountdown] = useState(0)

  // Unassigned courses/teacher warning states
  const [unassignedCourses, setUnassignedCourses] = useState<{
    course_code: string;
    course_name: string;
    section: string;
    semester: string;
    department: string;
  }[]>([])
  const [showUnassignedWarning, setShowUnassignedWarning] = useState(false)
  const [bypassTeacherCheck, setBypassTeacherCheck] = useState(false)

  // Load initial data
  useEffect(() => {
    checkAuth()
    fetchAllGroups()
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

  // Timer for scheduling
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (scheduling) {
      interval = setInterval(() => {
        setTimer(prev => prev + 100)
      }, 100)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [scheduling])

  // Fetch all upload groups
  const fetchAllGroups = async () => {
    setLoading(true)
    try {
      // Fetch campus groups
      const { data: campusData, error: campusError } = await (supabase
        .from('campuses') as any)
        .select('upload_group_id, school_name, file_name, created_at, capacity')
        .order('created_at', { ascending: false })

      if (!campusError && campusData) {
        const grouped = campusData.reduce((acc: CampusGroup[], curr: any) => {
          const existing = acc.find(item => item.upload_group_id === curr.upload_group_id)
          if (existing) {
            existing.room_count++
            existing.total_capacity += curr.capacity || 0
          } else {
            acc.push({
              upload_group_id: curr.upload_group_id,
              school_name: curr.school_name,
              file_name: curr.file_name,
              created_at: curr.created_at,
              room_count: 1,
              total_capacity: curr.capacity || 0
            })
          }
          return acc
        }, [])
        setCampusGroups(grouped)
      }

      // Fetch year batches from sections system
      const { data: batchesData, error: batchesError } = await (supabase
        .from('year_batches') as any)
        .select('*')
        .order('year_batch', { ascending: false })

      if (!batchesError && batchesData) {
        setYearBatches(batchesData)
      } else {
        console.error('Error fetching year batches:', batchesError)
        setYearBatches([])
      }

      // Fetch sections
      const { data: sectionsData, error: sectionsError } = await (supabase
        .from('sections') as any)
        .select('*')
        .order('section_name', { ascending: true })

      if (!sectionsError && sectionsData) {
        setSections(sectionsData)
      } else {
        console.error('Error fetching sections:', sectionsError)
        setSections([])
      }

    } catch (error) {
      console.error('Error fetching groups:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load detailed data when groups are selected
  const loadCampusData = async (groupId: number) => {
    const { data, error } = await (supabase
      .from('campuses') as any)
      .select('*')
      .eq('upload_group_id', groupId)
      .order('campus', { ascending: true })
      .order('building', { ascending: true })

    if (!error && data) {
      setRooms(data.map((r: any) => ({
        id: r.id,
        campus: r.campus || '',
        building: r.building || '',
        room: r.room || '',
        capacity: r.capacity || 30,
        room_type: r.room_type || 'Classroom',
        floor_number: r.floor_number || 1,
        has_ac: r.has_ac || false,
        has_projector: r.has_projector || false,
        is_pwd_accessible: r.is_pwd_accessible || r.is_first_floor || false
      })))
    }
  }

  const loadClassData = async (yearBatchId: number) => {
    try {
      // Get sections for this year batch
      const batchSections = sections.filter(s => s.year_batch_id === yearBatchId)

      if (batchSections.length === 0) {
        setClasses([])
        setCourses([])
        setUnassignedCourses([])
        return
      }

      // Determine semester from year batch
      const batch = yearBatches.find(b => b.id === yearBatchId)
      let targetSemester = ''
      if (batch) {
        if (batch.year_batch.toLowerCase().includes('first') || batch.year_batch.includes('1st')) {
          targetSemester = '1st Semester'
        } else if (batch.year_batch.toLowerCase().includes('second') || batch.year_batch.includes('2nd')) {
          targetSemester = '2nd Semester'
        } else if (batch.year_batch.toLowerCase().includes('summer')) {
          targetSemester = 'Summer'
        }
      }

      // Get all course assignments for these sections
      const { data: assignments, error: assignmentsError } = await (supabase
        .from('section_course_assignments') as any)
        .select('*')
        .in('section_id', batchSections.map(s => s.id))

      if (assignmentsError) {
        console.error('Error fetching assignments:', assignmentsError)
        setClasses([])
        setCourses([])
        setUnassignedCourses([])
        return
      }

      // Get all courses that are assigned
      const courseIds = assignments.map((a: any) => a.course_id)
      const { data: coursesData, error: coursesError } = await (supabase
        .from('class_schedules') as any)
        .select('*')
        .in('id', courseIds)

      if (coursesError) {
        console.error('Error fetching courses:', coursesError)
        setClasses([])
        setCourses([])
        setUnassignedCourses([])
        return
      }

      // Filter courses by semester if target semester is determined
      let filteredCourses = coursesData || []
      if (targetSemester) {
        filteredCourses = filteredCourses.filter((c: any) => {
          const courseSem = (c.semester || '').toLowerCase()
          const targetSemLower = targetSemester.toLowerCase()
          // Match various semester formats
          if (targetSemLower.includes('1st') || targetSemLower.includes('first')) {
            return courseSem.includes('1st') || courseSem.includes('first') || courseSem === '1'
          } else if (targetSemLower.includes('2nd') || targetSemLower.includes('second')) {
            return courseSem.includes('2nd') || courseSem.includes('second') || courseSem === '2'
          } else if (targetSemLower.includes('summer')) {
            return courseSem.includes('summer')
          }
          return true // Include if no specific match
        })
      }

      setCourses(filteredCourses)

      // Fetch teaching loads to check for assigned teachers
      const { data: teachingLoads, error: teachingLoadsError } = await (supabase
        .from('teaching_loads') as any)
        .select('*, faculty_profiles(*)')
        .in('course_id', filteredCourses.map((c: any) => c.id))

      const teachingLoadsMap = new Map<string, { faculty_name: string; section: string }>()
      if (!teachingLoadsError && teachingLoads) {
        teachingLoads.forEach((load: any) => {
          const key = `${load.course_id}-${load.section || ''}`
          teachingLoadsMap.set(key, {
            faculty_name: load.faculty_profiles?.full_name || load.faculty_profiles?.name || load.faculty_profiles?.email || 'Unknown',
            section: load.section || ''
          })
        })
      }

      // Build class schedules from sections and their assigned courses
      const classSchedules: ClassSchedule[] = []
      const unassigned: typeof unassignedCourses = []
      let autoId = 1 // Generate unique numeric IDs

      for (const section of batchSections) {
        const sectionAssignments = assignments.filter((a: any) => a.section_id === section.id)
        const sectionCourses = filteredCourses.filter((c: any) =>
          sectionAssignments.some((a: any) => a.course_id === c.id)
        )

        for (const course of sectionCourses) {
          // Check if this course-section has an assigned teacher
          const teacherKey = `${course.id}-${section.section_name}`
          const teacherKeyNoSection = `${course.id}-`
          const assignedTeacher = teachingLoadsMap.get(teacherKey) || teachingLoadsMap.get(teacherKeyNoSection)

          if (!assignedTeacher) {
            unassigned.push({
              course_code: course.course_code || '',
              course_name: course.course_name || '',
              section: section.section_name || '',
              semester: course.semester || targetSemester || '',
              department: course.department || section.department || ''
            })
          }

          classSchedules.push({
            id: autoId++, // Use auto-incrementing numeric ID
            course_code: course.course_code || '',
            course_name: course.course_name || '',
            section: section.section_name || '',
            year_level: section.year_level || 1,
            student_count: section.student_count || 30,
            schedule_day: '',
            schedule_time: '',
            lec_hours: course.lec_hours || 0,
            lab_hours: course.lab_hours || 0,
            total_hours: (course.lec_hours || 0) + (course.lab_hours || 0),
            department: course.department || section.department || '',
            semester: course.semester || '',
            academic_year: course.academic_year || '',
            teacher_name: assignedTeacher?.faculty_name || ''  // Include assigned teacher
          })
        }
      }

      setClasses(classSchedules)
      setUnassignedCourses(unassigned)

      // Auto-fill semester and academic year from batch
      if (batch) {
        setConfig(prev => ({
          ...prev,
          semester: batch.year_batch.includes('First') || batch.year_batch.includes('1st') ? '1st Semester' :
            batch.year_batch.includes('Second') || batch.year_batch.includes('2nd') ? '2nd Semester' :
              batch.year_batch.includes('Summer') ? 'Summer' : prev.semester,
          academicYear: batch.academic_year || prev.academicYear
        }))
      }
    } catch (error) {
      console.error('Error loading class data:', error)
      setClasses([])
      setCourses([])
      setUnassignedCourses([])
    }
  }

  const loadTeacherData = async () => {
    // Teacher schedules are deprecated; keep teachers empty
    setTeachers([])
  }

  // Handle group selection - now supports multiple campus groups
  const handleSelectCampusGroup = async (groupId: number) => {
    if (selectedCampusGroups.includes(groupId)) {
      // Deselect - remove from array
      const newSelected = selectedCampusGroups.filter(id => id !== groupId)
      setSelectedCampusGroups(newSelected)

      // Reload rooms from remaining selected groups
      if (newSelected.length > 0) {
        await loadMultipleCampusData(newSelected)
      } else {
        setRooms([])
        setSelectedBuildings([])
        setSelectedRooms([])
      }
    } else {
      // Add to selection
      const newSelected = [...selectedCampusGroups, groupId]
      setSelectedCampusGroups(newSelected)
      await loadMultipleCampusData(newSelected)
      setSelectedBuildings([])
      setSelectedRooms([])
    }
  }

  // Load rooms from multiple campus groups
  const loadMultipleCampusData = async (groupIds: number[]) => {
    const allRooms: CampusRoom[] = []

    for (const groupId of groupIds) {
      const { data, error } = await (supabase
        .from('campuses') as any)
        .select('*')
        .eq('upload_group_id', groupId)
        .order('campus', { ascending: true })
        .order('building', { ascending: true })

      if (!error && data) {
        const mappedRooms = data.map((r: any) => ({
          id: r.id,
          campus: r.campus || '',
          building: r.building || '',
          room: r.room || '',
          capacity: r.capacity || 30,
          room_type: r.room_type || 'Classroom',
          floor_number: r.floor_number || 1,
          has_ac: r.has_ac || false,
          has_projector: r.has_projector || false,
          is_pwd_accessible: r.is_pwd_accessible || r.is_first_floor || false
        }))
        allRooms.push(...mappedRooms)
      }
    }

    setRooms(allRooms)
  }

  const handleSelectClassGroup = (batchId: number) => {
    if (selectedYearBatch === batchId) {
      setSelectedYearBatch(null)
      setClasses([])
      setCourses([])
    } else {
      setSelectedYearBatch(batchId)
      loadClassData(batchId)
    }
  }

  const handleSelectTeacherGroup = (groupId: number) => {
    // Teacher schedules deprecated
    setTeachers([])
  }

  // Get unique buildings from loaded rooms
  const uniqueBuildings = [...new Set(rooms.map(r => r.building).filter(Boolean))]

  // Toggle building selection
  const handleToggleBuilding = (building: string) => {
    setSelectedBuildings(prev => {
      if (prev.includes(building)) {
        // Deselect building - also remove its rooms from selectedRooms
        const buildingRoomIds = rooms.filter(r => r.building === building).map(r => r.id)
        setSelectedRooms(prevRooms => prevRooms.filter(id => !buildingRoomIds.includes(id)))
        return prev.filter(b => b !== building)
      } else {
        return [...prev, building]
      }
    })
  }

  // Toggle room selection
  const handleToggleRoom = (roomId: number) => {
    setSelectedRooms(prev =>
      prev.includes(roomId) ? prev.filter(id => id !== roomId) : [...prev, roomId]
    )
  }

  // Select all rooms in a building OR toggle to show individual room selection
  const handleSelectAllRoomsInBuilding = (building: string) => {
    const buildingRoomIds = rooms.filter(r => r.building === building).map(r => r.id)
    const buildingSelected = selectedBuildings.includes(building)
    const allRoomsSelected = buildingRoomIds.every(id => selectedRooms.includes(id))

    if (buildingSelected) {
      // If building is selected, switch to individual room selection mode
      // Deselect the building and select all its rooms instead
      setSelectedBuildings(prev => prev.filter(b => b !== building))
      setSelectedRooms(prev => [...new Set([...prev, ...buildingRoomIds])])
    } else if (allRoomsSelected) {
      // All rooms are selected, deselect all
      setSelectedRooms(prev => prev.filter(id => !buildingRoomIds.includes(id)))
    } else {
      // Select all rooms in this building
      setSelectedRooms(prev => [...new Set([...prev, ...buildingRoomIds])])
    }
  }

  // Download CSV of unassigned courses (courses without teachers)
  const downloadUnassignedCoursesCSV = () => {
    if (unassignedCourses.length === 0) return

    const headers = ['Course Code', 'Course Name', 'Section', 'Semester', 'Department']
    const csvContent = [
      headers.join(','),
      ...unassignedCourses.map(c =>
        [
          `"${c.course_code}"`,
          `"${c.course_name}"`,
          `"${c.section}"`,
          `"${c.semester}"`,
          `"${c.department}"`
        ].join(',')
      )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `unassigned_courses_${config.semester.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Get filtered rooms based on selection
  const getFilteredRooms = () => {
    if (selectedBuildings.length === 0 && selectedRooms.length === 0) {
      return rooms // No filter applied
    }

    if (selectedRooms.length > 0) {
      // Specific rooms selected
      return rooms.filter(r => selectedRooms.includes(r.id))
    }

    if (selectedBuildings.length > 0) {
      // Buildings selected but no specific rooms
      return rooms.filter(r => selectedBuildings.includes(r.building))
    }

    return rooms
  }

  // NEW: Filter rooms by search query, capacity, and type for the room selection UI
  const getSearchFilteredRooms = (building: string) => {
    return rooms
      .filter(r => r.building === building)
      .filter(r => {
        // Search filter
        if (roomSearchQuery.trim()) {
          const query = roomSearchQuery.toLowerCase()
          return r.room.toLowerCase().includes(query) ||
            r.room_type?.toLowerCase().includes(query)
        }
        return true
      })
      .filter(r => {
        // Capacity filter
        if (roomFilterCapacity !== null) {
          return r.capacity >= roomFilterCapacity
        }
        return true
      })
      .filter(r => {
        // Room type filter
        if (roomFilterType) {
          return r.room_type === roomFilterType
        }
        return true
      })
  }

  // Get unique room types for filter dropdown
  const uniqueRoomTypes = [...new Set(rooms.map(r => r.room_type).filter(Boolean))]

  // File viewer functions - deprecated (class groups no longer used)
  const handleViewClassFile = async () => {
    // This function is deprecated - we now use year batches instead of class groups
    console.warn('handleViewClassFile is deprecated')
  }

  const closeFileViewer = () => {
    setShowClassFileViewer(false)
    setViewerData([])
  }

  // Validation - now checks for array length
  const canProceedToStep2 = selectedCampusGroups.length > 0 && selectedYearBatch !== null
  const canProceedToStep3 = canProceedToStep2 && rooms.length > 0 && classes.length > 0
  const canGenerate = canProceedToStep3 && config.scheduleName.trim() !== ''

  // Get selected group info - for multiple groups, show combined info
  const selectedCampusInfoList = campusGroups.filter(g => selectedCampusGroups.includes(g.upload_group_id))
  const selectedBatchInfo = yearBatches.find(b => b.id === selectedYearBatch)
  const selectedTeacherInfo = undefined

  // Calculate stats
  const totalRoomCapacity = rooms.reduce((sum, r) => sum + r.capacity, 0)
  const totalClasses = classes.length
  const uniqueDays = [...new Set(classes.map(c => c.schedule_day).filter(Boolean))]
  const uniqueTimeSlots = [...new Set(classes.map(c => c.schedule_time).filter(Boolean))]

  // Generate schedule
  const handleGenerateSchedule = async () => {
    if (!canGenerate) {
      alert('Please complete all required selections')
      return
    }

    // Check for unassigned courses (without teachers)
    if (unassignedCourses.length > 0 && !bypassTeacherCheck) {
      setShowUnassignedWarning(true)
      return
    }

    await executeScheduleGeneration()
  }

  // Proceed with schedule generation after bypass confirmation
  const executeScheduleGeneration = async () => {
    setShowUnassignedWarning(false)
    setScheduling(true)
    setTimer(0)
    setShowResults(false)

    try {
      // Get filtered rooms based on user selection
      const filteredRooms = getFilteredRooms()

      if (filteredRooms.length === 0) {
        alert('No rooms selected. Please select at least one building or room.')
        setScheduling(false)
        return
      }

      // Generate time slots from settings
      const timeSlots = generateTimeSlots(timeSettings)
      const activeDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
      if (timeSettings.includeSaturday) activeDays.push('Saturday')
      if (timeSettings.includeSunday) activeDays.push('Sunday')

      // Prepare data for QIA algorithm - will be sent to Python backend
      const scheduleData = {
        schedule_name: config.scheduleName,
        semester: config.semester,
        academic_year: config.academicYear,
        campus_group_ids: selectedCampusGroups, // Now supports multiple campus groups
        year_batch_id: selectedYearBatch,
        teacher_group_id: null,
        rooms: filteredRooms, // Use filtered rooms instead of all rooms
        classes: classes,
        teachers: [],
        time_slots: timeSlots,
        active_days: activeDays,
        online_days: config.onlineDays, // NEW: Days where all classes are online
        time_settings: timeSettings,
        config: {
          max_iterations: config.maxIterations,
          initial_temperature: config.initialTemperature,
          cooling_rate: config.coolingRate,
          quantum_tunneling_probability: config.quantumTunnelingProbability,
          max_teacher_hours_per_day: config.maxTeacherHoursPerDay,
          avoid_conflicts: config.avoidConflicts,
          online_days: config.onlineDays,
          // Lunch break settings
          lunch_break_enabled: timeSettings.lunchBreakEnabled,
          lunch_start_time: timeSettings.lunchBreakStart,
          lunch_end_time: timeSettings.lunchBreakEnd,
          lunch_mode: timeSettings.lunchBreakStrict ? 'strict' : 'flexible'
        }
      }

      console.log('[GenerateSchedule] Sending to Python backend:', JSON.stringify({
        rooms: filteredRooms.length,
        classes: classes.length,
        teachers: teachers.length,
        timeSlots: timeSlots.length,
        activeDays,
        onlineDays: config.onlineDays
      }, null, 2))

      // Validate data before sending
      if (classes.length === 0) {
        throw new Error('No classes to schedule. Please select a year batch with assigned courses.')
      }
      if (filteredRooms.length === 0) {
        throw new Error('No rooms available. Please select a campus group with rooms.')
      }

      // Call the new API that connects to Python backend
      const response = await fetch('/api/schedule/qia-backend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scheduleData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        // Handle error - could be string, object, or array
        let errorMsg = 'Failed to generate schedule'
        if (typeof errorData.error === 'string') {
          errorMsg = errorData.error
        } else if (errorData.error) {
          errorMsg = JSON.stringify(errorData.error)
        } else if (errorData.detail) {
          errorMsg = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail)
        } else if (errorData.message) {
          errorMsg = errorData.message
        }
        throw new Error(errorMsg)
      }

      const result = await response.json()
      console.log('[GenerateSchedule] API Response:', JSON.stringify(result, null, 2))

      setScheduleResult({
        success: result.success,
        scheduleId: result.schedule_id,
        savedToDatabase: result.saved_to_database || false,
        message: result.message,
        totalClasses: result.total_classes || classes.length,
        scheduledClasses: result.scheduled_classes || 0,
        unscheduledClasses: result.unscheduled_classes || 0,
        unscheduledList: result.unscheduled_list || [],
        conflicts: result.conflicts || [],
        optimizationStats: {
          initialCost: result.optimization_stats?.initial_cost || 0,
          finalCost: result.optimization_stats?.final_cost || 0,
          iterations: result.optimization_stats?.iterations || config.maxIterations,
          improvements: result.optimization_stats?.improvements || 0,
          quantumTunnels: result.optimization_stats?.quantum_tunnels || 0,
          blockSwaps: result.optimization_stats?.block_swaps || 0,  // BulSU QSA
          conflictCount: result.optimization_stats?.conflict_count || 0,  // BulSU QSA
          timeElapsedMs: result.optimization_stats?.time_elapsed_ms || timer
        },
        allocations: result.allocations || [],
        // BulSU QSA: Online class stats
        onlineDays: result.online_days || [],
        onlineClassCount: result.online_class_count || 0,
        physicalClassCount: result.physical_class_count || 0
      })
      setShowResults(true)
      setShowTimetable(true)
    } catch (error: any) {
      console.error('Schedule generation failed:', error)
      // Handle error properly - stringify if it's an object
      const errorMessage = typeof error === 'object'
        ? (error.message || JSON.stringify(error, null, 2))
        : String(error)
      alert(`Schedule generation failed: ${errorMessage}`)
    } finally {
      setScheduling(false)
    }
  }

  // Reset and start new schedule
  const handleNewSchedule = () => {
    setShowResults(false)
    setScheduleResult(null)
    setConfig(prev => ({ ...prev, scheduleName: '' }))
    setActiveStep(1)
  }

  // View schedule details
  const handleViewSchedule = () => {
    if (scheduleResult?.scheduleId) {
      router.push(`/LandingPages/RoomSchedule/ViewSchedule?id=${scheduleResult.scheduleId}`)
    }
  }

  return (
    <div className={styles.scheduleLayout} data-page="admin">
      <MenuBar
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        showSidebarToggle={true}
        setSidebarOpen={setSidebarOpen}
      />
      <Sidebar isOpen={sidebarOpen} />

      <main className={`${styles.scheduleMain} ${!sidebarOpen ? styles.fullWidth : ''}`}>
        <div className={styles.scheduleContainer}>
          {/* Header */}
          <header className={styles.scheduleHeader}>
            <button
              className={styles.backButton}
              onClick={() => router.push('/LandingPages/RoomSchedule/ViewSchedule')}
            >
              <FaArrowLeft className={styles.iconBack} />
              Back to Schedules
            </button>

            <div className={styles.headerTitleSection}>
              <div className={styles.headerIconWrapper}>
                <FaAtom className={styles.headerLargeIcon} />
              </div>
              <div className={styles.headerText}>
                <h1 className={styles.scheduleTitle}>
                  Quantum-Inspired Room Allocation
                </h1>
                <p className={styles.scheduleSubtitle}>
                  Advanced QIA Algorithm for Optimal Class-Room-Teacher Scheduling
                </p>
              </div>
            </div>
          </header>

          {/* Loading State */}
          {loading ? (
            <div className={styles.loadingContainer}>
              <FaSpinner className={styles.spinnerIcon} />
              <p>Loading CSV data sources...</p>
            </div>
          ) : showResults && scheduleResult ? (
            /* Results Section */
            <div className={styles.resultsSection}>
              <div className={`${styles.resultCard} ${scheduleResult.success ? styles.success : styles.warning}`}>
                <div className={styles.resultIcon}>
                  {scheduleResult.success ? (
                    <FaCheckCircle className={styles.successIcon} />
                  ) : (
                    <FaExclamationTriangle className={styles.warningIcon} />
                  )}
                </div>
                <div className={styles.resultContent}>
                  <h2>{scheduleResult.success ? 'Schedule Generated Successfully!' : 'Schedule Generated with Issues'}</h2>
                  <p>{scheduleResult.message}</p>
                </div>
              </div>

              {/* Statistics Grid */}
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}><FaLayerGroup /></div>
                  <div className={styles.statInfo}>
                    <span className={styles.statValue}>{scheduleResult.totalClasses}</span>
                    <span className={styles.statLabel}>Total Classes</span>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}><FaCheckCircle /></div>
                  <div className={styles.statInfo}>
                    <span className={styles.statValue}>{scheduleResult.scheduledClasses}</span>
                    <span className={styles.statLabel}>Scheduled</span>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}><FaExclamationTriangle /></div>
                  <div className={styles.statInfo}>
                    <span className={styles.statValue}>{scheduleResult.unscheduledClasses}</span>
                    <span className={styles.statLabel}>Unscheduled</span>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}><FaClock /></div>
                  <div className={styles.statInfo}>
                    <span className={styles.statValue}>{(scheduleResult.optimizationStats.timeElapsedMs / 1000).toFixed(2)}s</span>
                    <span className={styles.statLabel}>Processing Time</span>
                  </div>
                </div>
              </div>

              {/* Optimization Stats */}
              <div className={styles.formCard}>
                <h3 className={styles.formSectionTitle}>
                  <FaAtom /> Quantum-Inspired Optimization Statistics
                </h3>
                <div className={styles.optimizationStats}>
                  <div className={styles.optimizationStat}>
                    <span className={styles.optimizationLabel}>Iterations</span>
                    <span className={styles.optimizationValue}>{scheduleResult.optimizationStats.iterations.toLocaleString()}</span>
                  </div>
                  <div className={styles.optimizationStat}>
                    <span className={styles.optimizationLabel}>Initial Cost</span>
                    <span className={styles.optimizationValue}>{scheduleResult.optimizationStats.initialCost.toFixed(2)}</span>
                  </div>
                  <div className={styles.optimizationStat}>
                    <span className={styles.optimizationLabel}>Final Cost</span>
                    <span className={styles.optimizationValue}>{scheduleResult.optimizationStats.finalCost.toFixed(2)}</span>
                  </div>
                  <div className={styles.optimizationStat}>
                    <span className={styles.optimizationLabel}>Cost Reduction</span>
                    <span className={styles.optimizationValue}>
                      {((1 - scheduleResult.optimizationStats.finalCost / Math.max(scheduleResult.optimizationStats.initialCost, 1)) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className={styles.optimizationStat}>
                    <span className={styles.optimizationLabel}>Improvements Found</span>
                    <span className={styles.optimizationValue}>{scheduleResult.optimizationStats.improvements.toLocaleString()}</span>
                  </div>
                  <div className={styles.optimizationStat}>
                    <span className={styles.optimizationLabel}>Quantum Tunnels</span>
                    <span className={styles.optimizationValue}>{scheduleResult.optimizationStats.quantumTunnels.toLocaleString()}</span>
                  </div>
                  <div className={styles.optimizationStat}>
                    <span className={styles.optimizationLabel}>Block Swaps</span>
                    <span className={styles.optimizationValue}>{scheduleResult.optimizationStats.blockSwaps.toLocaleString()}</span>
                  </div>
                </div>

                {/* BulSU QSA: Online Class Statistics */}
                {(scheduleResult.onlineClassCount ?? 0) > 0 && (
                  <div className={styles.onlineStatsCard}>
                    <h4 className={styles.onlineStatsTitle}>
                      <Zap size={16} /> Online Class Distribution
                    </h4>
                    <div className={styles.onlineStatsGrid}>
                      <div className={styles.onlineStatItem}>
                        <span className={styles.onlineStatValue}>{scheduleResult.onlineClassCount}</span>
                        <span className={styles.onlineStatLabel}>Online Classes</span>
                      </div>
                      <div className={styles.onlineStatItem}>
                        <span className={styles.onlineStatValue}>{scheduleResult.physicalClassCount}</span>
                        <span className={styles.onlineStatLabel}>Physical Classes</span>
                      </div>
                    </div>
                    {scheduleResult.onlineDays && scheduleResult.onlineDays.length > 0 && (
                      <p className={styles.onlineDaysNote}>
                        📅 Online Days: {scheduleResult.onlineDays.join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Unscheduled Classes Section */}
              {scheduleResult.unscheduledList && scheduleResult.unscheduledList.length > 0 && (
                <div className={styles.formCard}>
                  <h3 className={styles.formSectionTitle}>
                    <FaExclamationTriangle style={{ color: '#f59e0b' }} /> Unscheduled Classes ({scheduleResult.unscheduledList.length})
                  </h3>
                  <p className={styles.formDescription}>
                    The following classes could not be scheduled. Review the reasons below.
                  </p>
                  <div className={styles.unscheduledList}>
                    {scheduleResult.unscheduledList.map((item, index) => (
                      <div key={index} className={styles.unscheduledItem}>
                        <div className={styles.unscheduledHeader}>
                          <span className={styles.unscheduledCourse}>
                            {item.course_code} - {item.section_code}
                          </span>
                          <span className={styles.unscheduledSlots}>
                            {item.assigned_slots}/{item.needed_slots} slots
                          </span>
                        </div>
                        <div className={styles.unscheduledName}>{item.course_name}</div>
                        {item.teacher_name && <div className={styles.unscheduledTeacher}>Teacher: {item.teacher_name}</div>}
                        <div className={styles.unscheduledReason}>
                          <FaExclamationTriangle /> {item.reason}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className={styles.resultActions}>
                <button className={styles.primaryButton} onClick={() => setShowTimetable(!showTimetable)}>
                  <FaChartBar /> {showTimetable ? 'Hide' : 'View'} Timetable
                </button>
                <button className={styles.secondaryButton} onClick={handleViewSchedule}>
                  <FaCalendar /> Go to View Schedule
                </button>
                <button className={styles.secondaryButton} onClick={handleNewSchedule}>
                  <FaSync /> Generate New Schedule
                </button>
                <button className={styles.secondaryButton}>
                  <FaDownload /> Export Schedule
                </button>
              </div>

              {/* Timetable Preview - 3 Views: Room, Section, Teacher */}
              {showTimetable && scheduleResult.allocations && scheduleResult.allocations.length > 0 && (
                <div className={styles.timetableSection}>
                  <h3 className={styles.formSectionTitle}>
                    <FaCalendar /> Generated Schedule Timetable
                  </h3>

                  {/* View Toggle Buttons */}
                  <div className={styles.timetableViewToggle}>
                    <button
                      className={`${styles.viewToggleBtn} ${timetableView === 'room' ? styles.active : ''}`}
                      onClick={() => setTimetableView('room')}
                    >
                      <FaBuilding /> Room Schedule
                    </button>
                    <button
                      className={`${styles.viewToggleBtn} ${timetableView === 'section' ? styles.active : ''}`}
                      onClick={() => setTimetableView('section')}
                    >
                      <FaUsers /> Section Schedule
                    </button>
                    <button
                      className={`${styles.viewToggleBtn} ${timetableView === 'teacher' ? styles.active : ''}`}
                      onClick={() => setTimetableView('teacher')}
                    >
                      <FaChalkboardTeacher /> Teacher Schedule
                    </button>
                  </div>

                  {/* Filter Selector */}
                  <div className={styles.timetableFilter}>
                    {timetableView === 'room' && (
                      <select
                        value={selectedTimetableRoom}
                        onChange={(e) => setSelectedTimetableRoom(e.target.value)}
                        className={styles.filterSelect}
                      >
                        <option value="all">All Rooms</option>
                        {[...new Set(scheduleResult.allocations.map(a => a.room).filter(Boolean))].map(room => (
                          <option key={room} value={room}>{room}</option>
                        ))}
                      </select>
                    )}
                    {timetableView === 'section' && (
                      <select
                        value={selectedTimetableSection}
                        onChange={(e) => setSelectedTimetableSection(e.target.value)}
                        className={styles.filterSelect}
                      >
                        <option value="all">All Sections</option>
                        {[...new Set(scheduleResult.allocations.map(a => a.section).filter(Boolean))].map(section => (
                          <option key={section} value={section}>{section}</option>
                        ))}
                      </select>
                    )}
                    {timetableView === 'teacher' && (
                      <select
                        value={selectedTimetableTeacher}
                        onChange={(e) => setSelectedTimetableTeacher(e.target.value)}
                        className={styles.filterSelect}
                      >
                        <option value="all">All Teachers</option>
                        {[...new Set(scheduleResult.allocations.map(a => a.teacher_name).filter(Boolean))].map(teacher => (
                          <option key={teacher} value={teacher}>{teacher}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className={styles.timetableContainer}>
                    <div className={styles.timetableWrapper}>
                      {(() => {
                        // Helper: Convert 24h to 12h AM/PM format
                        const formatTimeAMPM = (hour: number, minute: number): string => {
                          const period = hour >= 12 ? 'PM' : 'AM';
                          const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                          return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
                        };

                        // Helper: Parse time string to minutes
                        const parseTimeToMinutes = (timeStr: string): number => {
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
                          teacher_name: string;
                          day: string;
                          startMinutes: number;
                          endMinutes: number;
                          is_online: boolean;
                        };

                        const combinedBlocks: CombinedBlock[] = [];

                        // Filter allocations based on view
                        let viewFilteredAllocations = scheduleResult.allocations.filter(a => {
                          if (timetableView === 'room') {
                            if (selectedTimetableRoom !== 'all' && a.room !== selectedTimetableRoom) return false;
                          } else if (timetableView === 'section') {
                            if (selectedTimetableSection !== 'all' && a.section !== selectedTimetableSection) return false;
                          } else if (timetableView === 'teacher') {
                            if (selectedTimetableTeacher !== 'all' && a.teacher_name !== selectedTimetableTeacher) return false;
                          }
                          return true;
                        });

                        // Group by course+section+room+day+teacher to find consecutive slots
                        const groupedMap = new Map<string, typeof viewFilteredAllocations>();
                        viewFilteredAllocations.forEach(alloc => {
                          const key = `${alloc.course_code}|${alloc.section}|${alloc.room}|${alloc.schedule_day}|${alloc.teacher_name || ''}|${alloc.is_online || false}`;
                          if (!groupedMap.has(key)) {
                            groupedMap.set(key, []);
                          }
                          groupedMap.get(key)!.push(alloc);
                        });

                        // For each group, combine consecutive time slots
                        groupedMap.forEach((allocations, key) => {
                          // Sort by start time
                          const sorted = allocations.sort((a, b) => {
                            return parseTimeToMinutes(a.schedule_time || '') - parseTimeToMinutes(b.schedule_time || '');
                          });

                          // Merge consecutive slots
                          let currentBlock: CombinedBlock | null = null;

                          sorted.forEach(alloc => {
                            const timeStr = alloc.schedule_time || '';
                            const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
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
                                teacher_name: alloc.teacher_name || '',
                                day: (alloc.schedule_day || '').toLowerCase(),
                                startMinutes: startMins,
                                endMinutes: endMins,
                                is_online: alloc.is_online || false
                              };
                            }
                          });

                          if (currentBlock) {
                            combinedBlocks.push(currentBlock);
                          }
                        });

                        const ROW_HEIGHT = 40;
                        const START_HOUR = 7;

                        return (
                          <table className={styles.timetable}>
                            <thead>
                              <tr>
                                <th className={styles.timeColumn}>Time</th>
                                {DAYS.map(day => (
                                  <th key={day} className={styles.dayColumn}>{day}</th>
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
                                    {DAYS.map(day => {
                                      // Find blocks that START at this exact time slot for this day
                                      const blocksStartingHere = combinedBlocks.filter(block => {
                                        const blockStartHour = Math.floor(block.startMinutes / 60);
                                        const blockStartMin = block.startMinutes % 60;
                                        return block.day === day.toLowerCase() &&
                                          blockStartHour === hour &&
                                          blockStartMin === minute;
                                      });

                                      return (
                                        <td key={`${day}-${i}`} className={styles.scheduleCell} style={{ position: 'relative', height: `${ROW_HEIGHT}px` }}>
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

                                            // Get color based on view type
                                            const getColor = () => {
                                              if (block.is_online) return '#9c27b0';
                                              if (timetableView === 'room') {
                                                const hash = (block.section || '').split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0);
                                                const colors = ['#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#00796b', '#c2185b', '#5d4037', '#455a64'];
                                                return colors[Math.abs(hash) % colors.length];
                                              } else if (timetableView === 'section') {
                                                const hash = (block.room || '').split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0);
                                                const colors = ['#00796b', '#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#c2185b'];
                                                return colors[Math.abs(hash) % colors.length];
                                              } else {
                                                return '#1976d2';
                                              }
                                            };

                                            return (
                                              <div
                                                key={idx}
                                                className={`${styles.allocationCard} ${block.is_online ? styles.onlineClass : ''}`}
                                                style={{
                                                  backgroundColor: getColor(),
                                                  color: '#fff',
                                                  position: 'absolute',
                                                  top: 0,
                                                  left: '2px',
                                                  right: '2px',
                                                  height: `${spanHeight - 2}px`,
                                                  zIndex: 10,
                                                  overflow: 'hidden',
                                                  borderRadius: '6px',
                                                  padding: '6px 8px',
                                                  display: 'flex',
                                                  flexDirection: 'column',
                                                  justifyContent: 'flex-start',
                                                  boxShadow: '0 2px 6px rgba(0,0,0,0.25)'
                                                }}
                                                title={`${block.course_code} - ${block.course_name}\nSection: ${block.section}\nRoom: ${block.room}\nTime: ${displayTimeRange}\nTeacher: ${block.teacher_name || 'TBD'}`}
                                              >
                                                <div style={{ fontWeight: 700, fontSize: '12px', marginBottom: '3px' }}>
                                                  {block.course_code || 'N/A'}
                                                </div>
                                                <div style={{ fontSize: '10px', opacity: 0.95, marginBottom: '2px' }}>
                                                  {block.course_name || ''}
                                                </div>
                                                {/* Time display - shown for all views */}
                                                <div style={{ fontSize: '9px', opacity: 0.85, marginBottom: '3px', fontWeight: 600, backgroundColor: 'rgba(0,0,0,0.15)', padding: '1px 4px', borderRadius: '3px', display: 'inline-block', width: 'fit-content' }}>
                                                  {displayTimeRange}
                                                </div>
                                                {/* Show different info based on view */}
                                                {timetableView === 'room' && (
                                                  <>
                                                    <div style={{ fontSize: '10px', opacity: 0.9 }}>{block.section || 'N/A'}</div>
                                                    <div style={{ fontSize: '10px', opacity: 0.8 }}>{block.teacher_name || 'TBD'}</div>
                                                  </>
                                                )}
                                                {timetableView === 'section' && (
                                                  <>
                                                    <div style={{ fontSize: '10px', opacity: 0.9 }}>{block.is_online ? '🌐 Online' : block.room}</div>
                                                    <div style={{ fontSize: '10px', opacity: 0.8 }}>{block.teacher_name || 'TBD'}</div>
                                                  </>
                                                )}
                                                {timetableView === 'teacher' && (
                                                  <>
                                                    <div style={{ fontSize: '10px', opacity: 0.9 }}>{block.section || 'N/A'}</div>
                                                    <div style={{ fontSize: '10px', opacity: 0.8 }}>{block.is_online ? '🌐 Online' : block.room}</div>
                                                  </>
                                                )}
                                              </div>
                                            );
                                          })}
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

                  {/* Allocation Summary */}
                  <div className={styles.allocationSummary}>
                    <p><strong>Total Allocations:</strong> {scheduleResult.allocations.length}</p>
                    <p><strong>Database Status:</strong> {scheduleResult.savedToDatabase ?
                      <span className={styles.successText}>✓ Saved to database</span> :
                      <span className={styles.warningText}>⚠ Not saved (check console for errors)</span>}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Main Configuration Section */
            <div className={styles.formSection}>
              {/* Step Progress */}
              <div className={styles.stepProgress}>
                <div className={`${styles.step} ${activeStep >= 1 ? styles.active : ''} ${activeStep > 1 ? styles.completed : ''}`}>
                  <div className={styles.stepNumber}>1</div>
                  <span>Select Data Sources</span>
                </div>
                <div className={styles.stepLine}></div>
                <div className={`${styles.step} ${activeStep >= 2 ? styles.active : ''} ${activeStep > 2 ? styles.completed : ''}`}>
                  <div className={styles.stepNumber}>2</div>
                  <span>Review Data</span>
                </div>
                <div className={styles.stepLine}></div>
                <div className={`${styles.step} ${activeStep >= 3 ? styles.active : ''} ${activeStep > 3 ? styles.completed : ''}`}>
                  <div className={styles.stepNumber}>3</div>
                  <span>Configure & Generate</span>
                </div>
              </div>

              {/* Step 1: Select Data Sources */}
              {activeStep === 1 && (
                <div className={styles.dataSourcesSection}>
                  {/* Campus/Rooms Selection */}
                  <div className={styles.dataSourceCard}>
                    <div className={styles.dataSourceHeader} onClick={() => setExpandedCampus(!expandedCampus)}>
                      <div className={styles.dataSourceTitle}>
                        <div className={`${styles.dataSourceIcon} ${styles.campusIcon}`}>
                          <University size={24} />
                        </div>
                        <div>
                          <h3>Campus / Building / Rooms</h3>
                          <p>Select one or more room data CSV files to use for room allocation</p>
                        </div>
                      </div>
                      <div className={styles.dataSourceStatus}>
                        {selectedCampusGroups.length > 0 ? (
                          <span className={styles.selectedBadge}>
                            <CheckCircle2 size={16} /> {selectedCampusGroups.length} Selected
                          </span>
                        ) : (
                          <span className={styles.requiredBadge}>Required</span>
                        )}
                        {expandedCampus ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      </div>
                    </div>

                    {expandedCampus && (
                      <div className={styles.dataSourceContent}>
                        {campusGroups.length === 0 ? (
                          <div className={styles.emptyDataSource}>
                            <FileSpreadsheet size={40} />
                            <p>No campus data found. Upload a Campus/Building CSV first.</p>
                            <button onClick={() => router.push('/LandingPages/UploadCSV')}>
                              Upload CSV
                            </button>
                          </div>
                        ) : (
                          <div className={styles.dataSourceGrid}>
                            {campusGroups.map(group => {
                              const isSelected = selectedCampusGroups.includes(group.upload_group_id)
                              return (
                                <div
                                  key={group.upload_group_id}
                                  className={`${styles.dataCard} ${isSelected ? styles.selected : ''}`}
                                  onClick={() => handleSelectCampusGroup(group.upload_group_id)}
                                >
                                  <div className={styles.dataCardCheckbox}>
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => { }}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                  <div className={styles.dataCardHeader}>
                                    <University size={20} />
                                    <h4>{group.school_name}</h4>
                                  </div>
                                  <div className={styles.dataCardStats}>
                                    <span><DoorOpen size={14} /> {group.room_count} rooms</span>
                                    <span><Users size={14} /> {group.total_capacity} capacity</span>
                                  </div>
                                  <div className={styles.dataCardFile}>
                                    <FileSpreadsheet size={14} /> {group.file_name}
                                  </div>
                                  <div className={styles.dataCardDate}>
                                    {new Date(group.created_at).toLocaleDateString()}
                                  </div>
                                  {isSelected && (
                                    <div className={styles.selectedCheck}><CheckCircle2 size={20} /></div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Courses & Sections Selection */}
                  <div className={styles.dataSourceCard}>
                    <div className={styles.dataSourceHeader} onClick={() => setExpandedSections(!expandedSections)}>
                      <div className={styles.dataSourceTitle}>
                        <div className={`${styles.dataSourceIcon} ${styles.classIcon}`}>
                          <BookOpen size={24} />
                        </div>
                        <div>
                          <h3>Sections & Assigned Courses</h3>
                          <p>Select year batch with sections and their assigned courses from Class & Section Assigning page</p>
                        </div>
                      </div>
                      <div className={styles.dataSourceStatus}>
                        {selectedYearBatch ? (
                          <span className={styles.selectedBadge}>
                            <CheckCircle2 size={16} /> Selected
                          </span>
                        ) : (
                          <span className={styles.requiredBadge}>Required</span>
                        )}
                        {expandedSections ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      </div>
                    </div>

                    {expandedSections && (
                      <div className={styles.dataSourceContent}>
                        {yearBatches.length === 0 ? (
                          <div className={styles.emptyDataSource}>
                            <FileSpreadsheet size={40} />
                            <p>No year batches found. Please create year batches and sections first.</p>
                            <button onClick={() => router.push('/LandingPages/CoursesManagement/ClassSectionAssigning')}>
                              Go to Class & Section Assigning
                            </button>
                          </div>
                        ) : (
                          <div className={styles.dataSourceGrid}>
                            {yearBatches.map(batch => {
                              const batchSections = sections.filter(s => s.year_batch_id === batch.id)
                              const totalStudents = batchSections.reduce((sum, s) => sum + (s.student_count || 0), 0)

                              return (
                                <div
                                  key={batch.id}
                                  className={`${styles.dataCard} ${selectedYearBatch === batch.id ? styles.selected : ''}`}
                                  onClick={() => handleSelectClassGroup(batch.id)}
                                >
                                  <div className={styles.dataCardHeader}>
                                    <GraduationCap size={20} />
                                    <h4>{batch.year_batch}</h4>
                                  </div>
                                  <div className={styles.dataCardStats}>
                                    <span><Users size={14} /> {batchSections.length} sections</span>
                                    <span><FaUserGraduate size={14} /> {totalStudents} students</span>
                                  </div>
                                  <div className={styles.dataCardAcademic}>
                                    <span className={styles.academicBadge}>
                                      {batch.academic_year}
                                    </span>
                                  </div>
                                  <div className={styles.dataCardDate}>
                                    {new Date(batch.created_at).toLocaleDateString()}
                                  </div>
                                  {selectedYearBatch === batch.id && (
                                    <div className={styles.selectedCheck}><CheckCircle2 size={20} /></div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Navigation */}
                  <div className={styles.stepNavigation}>
                    <button
                      className={styles.nextButton}
                      disabled={!canProceedToStep2}
                      onClick={() => setActiveStep(2)}
                    >
                      Continue to Review Data
                      <ChevronRight size={18} />
                    </button>
                    {!canProceedToStep2 && (
                      <p className={styles.navigationHint}>
                        Please select both Campus and Class Schedule data to continue
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2: Review Data */}
              {activeStep === 2 && (
                <div className={styles.reviewSection}>
                  {/* Summary Cards */}
                  <div className={styles.summaryGrid}>
                    <div className={styles.summaryCard}>
                      <div className={`${styles.summaryIcon} ${styles.campusIcon}`}>
                        <University size={24} />
                      </div>
                      <div className={styles.summaryInfo}>
                        <h4>
                          {selectedCampusInfoList.length === 1
                            ? selectedCampusInfoList[0]?.school_name
                            : `${selectedCampusInfoList.length} Campus Files`}
                        </h4>
                        <p>{rooms.length} rooms • {totalRoomCapacity} total capacity</p>
                        {selectedCampusInfoList.length > 1 && (
                          <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '4px' }}>
                            {selectedCampusInfoList.map(c => c.school_name).join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className={styles.summaryCard}>
                      <div className={`${styles.summaryIcon} ${styles.classIcon}`}>
                        <BookOpen size={24} />
                      </div>
                      <div className={styles.summaryInfo}>
                        <h4>{selectedBatchInfo?.year_batch}</h4>
                        <p>{classes.length} classes • {sections.filter(s => s.year_batch_id === selectedYearBatch).length} sections</p>
                      </div>
                    </div>
                    {selectedTeacherInfo && teachers.length > 0 && (
                      <div className={styles.summaryCard}>
                        <div className={`${styles.summaryIcon} ${styles.teacherIcon}`}>
                          <FaChalkboardTeacher size={24} />
                        </div>
                        <div className={styles.summaryInfo}>
                          <h4>Faculty</h4>
                          <p>{teachers.length} teachers available</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Building and Room Filter */}
                  <div className={styles.filterSection}>
                    <div className={styles.filterHeader} onClick={() => setShowBuildingFilter(!showBuildingFilter)}>
                      <div className={styles.filterTitle}>
                        <FaFilter size={18} />
                        <h3>Filter Rooms by Building (Optional)</h3>
                      </div>
                      <div className={styles.filterStatus}>
                        {selectedBuildings.length > 0 || selectedRooms.length > 0 ? (
                          <span className={styles.filterActiveBadge}>
                            {selectedRooms.length > 0
                              ? `${selectedRooms.length} rooms selected`
                              : `${selectedBuildings.length} building(s) selected`}
                          </span>
                        ) : (
                          <span className={styles.filterInactiveBadge}>All rooms will be used</span>
                        )}
                        {showBuildingFilter ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      </div>
                    </div>

                    {showBuildingFilter && (
                      <div className={styles.filterContent}>
                        <p className={styles.filterDescription}>
                          Select specific buildings or rooms to use for scheduling. If no selection is made, all rooms will be used.
                        </p>

                        {/* Quick Action Buttons */}
                        <div className={styles.quickActionsBox}>
                          <div className={styles.quickActionsContent}>
                            <span className={styles.quickActionsLabel}>Quick Actions:</span>
                            <button
                              onClick={() => {
                                setSelectedBuildings(uniqueBuildings)
                                setSelectedRooms([])
                              }}
                              className={`${styles.quickActionBtn} ${styles.selectAllBuildings}`}
                            >
                              ✓ Select All Buildings
                            </button>
                            <button
                              onClick={() => {
                                setSelectedRooms(rooms.map(r => r.id))
                                setSelectedBuildings([])
                              }}
                              className={`${styles.quickActionBtn} ${styles.selectAllRooms}`}
                            >
                              ✓ Select All Rooms
                            </button>
                            <button
                              onClick={() => {
                                setSelectedBuildings([])
                                setSelectedRooms([])
                                setRoomSearchQuery('')
                                setRoomFilterCapacity(null)
                                setRoomFilterType('')
                              }}
                              className={`${styles.quickActionBtn} ${styles.clearAll}`}
                            >
                              ✕ Clear All
                            </button>
                          </div>
                        </div>

                        {/* Search and Filter Controls */}
                        <div className={styles.filterControlsBox}>
                          <div className={styles.filterControlsRow}>
                            <div className={styles.filterControlGroup}>
                              <label className={`${styles.formLabel} ${styles.filterControlLabel}`}>Search Rooms</label>
                              <input
                                type="text"
                                placeholder="Search room name or type..."
                                value={roomSearchQuery}
                                onChange={(e) => setRoomSearchQuery(e.target.value)}
                                className={styles.formInput}
                              />
                            </div>
                            <div className={styles.filterControlGroup}>
                              <label className={`${styles.formLabel} ${styles.filterControlLabel}`}>Min. Capacity</label>
                              <input
                                type="number"
                                placeholder="Minimum capacity..."
                                value={roomFilterCapacity || ''}
                                onChange={(e) => setRoomFilterCapacity(e.target.value ? parseInt(e.target.value) : null)}
                                className={styles.formInput}
                                min="0"
                              />
                            </div>
                            <div className={styles.filterControlGroup}>
                              <label className={`${styles.formLabel} ${styles.filterControlLabel}`}>Room Type</label>
                              <select
                                value={roomFilterType}
                                onChange={(e) => setRoomFilterType(e.target.value)}
                                className={styles.formSelect}
                              >
                                <option value="">All Types</option>
                                {uniqueRoomTypes.map(type => (
                                  <option key={type} value={type}>{type}</option>
                                ))}
                              </select>
                            </div>
                            {(roomSearchQuery || roomFilterCapacity !== null || roomFilterType) && (
                              <div style={{ alignSelf: 'flex-end' }}>
                                <button
                                  onClick={() => {
                                    setRoomSearchQuery('')
                                    setRoomFilterCapacity(null)
                                    setRoomFilterType('')
                                  }}
                                  className={styles.secondaryButton}
                                >
                                  Clear Filters
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className={styles.buildingGrid}>
                          {uniqueBuildings.map(building => {
                            const buildingRooms = getSearchFilteredRooms(building)
                            const buildingRoomIds = buildingRooms.map(r => r.id)
                            const allRoomsSelected = buildingRoomIds.length > 0 && buildingRoomIds.every(id => selectedRooms.includes(id))
                            const someRoomsSelected = buildingRoomIds.some(id => selectedRooms.includes(id))
                            const buildingSelected = selectedBuildings.includes(building)
                            const isActive = buildingSelected || allRoomsSelected

                            return (
                              <div key={building} className={`${styles.buildingCard} ${isActive ? styles.selected : ''}`}>
                                <div className={styles.buildingHeader} style={{ marginBottom: '8px' }}>
                                  <label className={styles.buildingCheckbox} style={{ width: '100%' }}>
                                    <input
                                      type="checkbox"
                                      checked={isActive}
                                      onChange={() => {
                                        if (isActive) {
                                          setSelectedBuildings(prev => prev.filter(b => b !== building))
                                          setSelectedRooms(prev => prev.filter(id => !buildingRoomIds.includes(id)))
                                        } else {
                                          setSelectedBuildings(prev => [...prev, building])
                                          setSelectedRooms(prev => prev.filter(id => !buildingRoomIds.includes(id)))
                                        }
                                      }}
                                      style={{
                                        opacity: someRoomsSelected && !allRoomsSelected ? 0.5 : 1,
                                        cursor: 'pointer',
                                        width: '18px',
                                        height: '18px',
                                        accentColor: '#16a34a'
                                      }}
                                    />
                                    <Building2 size={16} />
                                    <strong style={{ flex: 1 }}>{building}</strong>
                                    {isActive && (
                                      <span style={{
                                        fontSize: '11px',
                                        backgroundColor: '#16a34a',
                                        color: 'white',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        fontWeight: 600
                                      }}>
                                        ✓ Selected
                                      </span>
                                    )}
                                  </label>
                                </div>

                                <div className={styles.buildingStats} style={{ marginBottom: '0' }}>
                                  <span><DoorOpen size={14} /> {buildingRooms.length} rooms</span>
                                  <span><Users size={14} /> {buildingRooms.reduce((sum, r) => sum + r.capacity, 0)} capacity</span>
                                </div>

                                {/* Collapsible room list for individual selection */}
                                {buildingRooms.length > 0 && (
                                  <details style={{ marginTop: '10px', cursor: 'pointer' }}>
                                    <summary style={{
                                      fontWeight: '500',
                                      color: 'var(--text-medium)',
                                      fontSize: '12px',
                                      userSelect: 'none',
                                      padding: '4px 0',
                                      opacity: 0.8
                                    }}>
                                      {allRoomsSelected
                                        ? `✓ All ${buildingRooms.length} rooms`
                                        : someRoomsSelected
                                          ? `${buildingRoomIds.filter(id => selectedRooms.includes(id)).length}/${buildingRooms.length} rooms`
                                          : `View ${buildingRooms.length} rooms`}
                                    </summary>
                                    <div className={styles.roomList} style={{ marginTop: '8px', maxHeight: '150px' }}>
                                      {buildingRooms.map(room => (
                                        <label key={room.id} className={styles.roomCheckbox} style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          padding: '6px 8px',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          backgroundColor: selectedRooms.includes(room.id) ? 'rgba(22, 163, 74, 0.1)' : 'transparent',
                                          marginBottom: '4px',
                                          fontSize: '12px'
                                        }}>
                                          <input
                                            type="checkbox"
                                            checked={selectedRooms.includes(room.id)}
                                            onChange={() => handleToggleRoom(room.id)}
                                            style={{ marginRight: '6px', cursor: 'pointer', width: '14px', height: '14px' }}
                                          />
                                          <span style={{ flex: 1, color: 'var(--text-dark)' }}>
                                            {room.room}
                                          </span>
                                          <span style={{ fontSize: '11px', color: 'var(--text-light)', marginLeft: '6px' }}>
                                            {room.capacity}
                                          </span>
                                          <span style={{
                                            fontSize: '10px',
                                            color: 'var(--text-light)',
                                            marginLeft: '6px',
                                            backgroundColor: 'var(--bg-gray-100)',
                                            padding: '1px 5px',
                                            borderRadius: '3px'
                                          }}>
                                            {room.room_type}
                                          </span>
                                        </label>
                                      ))}
                                    </div>
                                  </details>
                                )}
                              </div>
                            )
                          })}
                        </div>

                        {(selectedBuildings.length > 0 || selectedRooms.length > 0) && (
                          <div className={styles.filterSummary}>
                            <p>
                              <strong>Filtered Selection:</strong> {getFilteredRooms().length} out of {rooms.length} rooms will be used for scheduling
                            </p>
                            <button
                              className={styles.clearFilterBtn}
                              onClick={() => {
                                setSelectedBuildings([])
                                setSelectedRooms([])
                                setRoomSearchQuery('')
                                setRoomFilterCapacity(null)
                                setRoomFilterType('')
                              }}
                            >
                              Clear All Filters
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Data Preview */}
                  <div className={styles.previewSection}>
                    <div className={styles.previewCard}>
                      <h3><DoorOpen size={20} /> Rooms Preview ({rooms.length})</h3>
                      <div className={styles.previewTable}>
                        <table>
                          <thead>
                            <tr>
                              <th>Room</th>
                              <th>Building</th>
                              <th>Campus</th>
                              <th>Capacity</th>
                              <th>Type</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rooms.slice(0, 5).map(room => (
                              <tr key={room.id}>
                                <td>{room.room}</td>
                                <td>{room.building}</td>
                                <td>{room.campus}</td>
                                <td>{room.capacity}</td>
                                <td>{room.room_type}</td>
                              </tr>
                            ))}
                            {rooms.length > 5 && (
                              <tr className={styles.moreRow}>
                                <td colSpan={5}>+ {rooms.length - 5} more rooms...</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className={styles.previewCard}>
                      <h3><BookOpen size={20} /> Classes Preview ({classes.length})</h3>
                      <div className={styles.previewTable}>
                        <table>
                          <thead>
                            <tr>
                              <th>Course</th>
                              <th>Section</th>
                              <th>Day</th>
                              <th>Time</th>
                              <th>Hours</th>
                            </tr>
                          </thead>
                          <tbody>
                            {classes.slice(0, 5).map(cls => (
                              <tr key={cls.id}>
                                <td>{cls.course_code}</td>
                                <td>{cls.section}</td>
                                <td>{cls.schedule_day}</td>
                                <td>{cls.schedule_time}</td>
                                <td>{cls.lec_hours + cls.lab_hours}h</td>
                              </tr>
                            ))}
                            {classes.length > 5 && (
                              <tr className={styles.moreRow}>
                                <td colSpan={5}>+ {classes.length - 5} more classes...</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Compatibility Check */}
                  <div className={styles.compatibilityCard}>
                    <h3><CheckCircle2 size={20} /> Data Compatibility Check</h3>
                    <div className={styles.compatibilityList}>
                      <div className={`${styles.compatibilityItem} ${styles.success}`}>
                        <CheckCircle2 size={18} />
                        <span>Room data loaded successfully ({rooms.length} rooms)</span>
                      </div>
                      <div className={`${styles.compatibilityItem} ${styles.success}`}>
                        <CheckCircle2 size={18} />
                        <span>Class schedule data loaded ({classes.length} classes)</span>
                      </div>
                      <div className={`${styles.compatibilityItem} ${totalRoomCapacity >= classes.length * 30 ? styles.success : styles.warning}`}>
                        {totalRoomCapacity >= classes.length * 30 ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                        <span>
                          Capacity check: {totalRoomCapacity} seats for ~{classes.length * 30} estimated students
                        </span>
                      </div>
                      {teachers.length > 0 && (
                        <div className={`${styles.compatibilityItem} ${styles.success}`}>
                          <CheckCircle2 size={18} />
                          <span>Teacher availability data included ({teachers.length} teachers)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Navigation */}
                  <div className={styles.stepNavigation}>
                    <button className={styles.backStepButton} onClick={() => setActiveStep(1)}>
                      <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
                      Back
                    </button>
                    <button
                      className={styles.nextButton}
                      disabled={!canProceedToStep3}
                      onClick={() => setActiveStep(3)}
                    >
                      Continue to Configuration
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Configure & Generate */}
              {activeStep === 3 && (
                <div className={styles.configSection}>
                  {/* Schedule Info */}
                  <div className={styles.formCard}>
                    <h3 className={styles.formSectionTitle}>
                      <FaCog /> Schedule Information
                    </h3>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Schedule Name *</label>
                      <input
                        type="text"
                        className={styles.formInput}
                        placeholder="e.g., 2025-2026 1st Semester Room Allocation"
                        value={config.scheduleName}
                        onChange={(e) => setConfig(prev => ({ ...prev, scheduleName: e.target.value }))}
                      />
                    </div>
                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Semester</label>
                        <select
                          className={styles.formSelect}
                          value={config.semester}
                          onChange={(e) => setConfig(prev => ({ ...prev, semester: e.target.value }))}
                        >
                          <option value="1st Semester">1st Semester</option>
                          <option value="2nd Semester">2nd Semester</option>
                          <option value="Summer">Summer</option>
                        </select>
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Academic Year</label>
                        <input
                          type="text"
                          className={styles.formInput}
                          placeholder="2025-2026"
                          value={config.academicYear}
                          onChange={(e) => setConfig(prev => ({ ...prev, academicYear: e.target.value }))}
                        />
                      </div>
                    </div>

                    {/* Quick Options */}
                    <div className={styles.checkboxGroup}>
                      <label className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={config.avoidConflicts}
                          onChange={(e) => setConfig(prev => ({ ...prev, avoidConflicts: e.target.checked }))}
                        />
                        <span>Automatically avoid all teacher/room/section conflicts (strict enforcement)</span>
                      </label>
                    </div>

                    {/* Unassigned Courses Warning */}
                    {unassignedCourses.length > 0 && (
                      <div style={{
                        marginTop: '16px',
                        padding: '16px',
                        background: 'linear-gradient(135deg, rgba(245, 124, 0, 0.1), rgba(255, 167, 38, 0.05))',
                        borderRadius: '10px',
                        border: '1px solid rgba(245, 124, 0, 0.3)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                          <FaExclamationTriangle style={{ color: '#f57c00', fontSize: '20px' }} />
                          <span style={{ fontWeight: 600, color: '#f57c00' }}>
                            {unassignedCourses.length} Course(s) Without Assigned Professors
                          </span>
                        </div>
                        <p style={{ fontSize: '13px', margin: '0 0 12px 0', opacity: 0.85 }}>
                          Some courses for {config.semester} do not have professors assigned yet.
                          You can assign them or bypass this check.
                        </p>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <button
                            onClick={() => setShowUnassignedWarning(true)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 14px',
                              background: 'linear-gradient(135deg, #f57c00, #ef6c00)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: 500,
                              fontSize: '13px'
                            }}
                          >
                            <FaEye /> View Unassigned Courses
                          </button>
                          <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 500
                          }}>
                            <input
                              type="checkbox"
                              checked={bypassTeacherCheck}
                              onChange={(e) => setBypassTeacherCheck(e.target.checked)}
                              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                            <span>Bypass teacher check (show "TBD" in schedule)</span>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* All courses have professors assigned */}
                    {unassignedCourses.length === 0 && classes.length > 0 && (
                      <div style={{
                        marginTop: '16px',
                        padding: '12px 16px',
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.05))',
                        borderRadius: '10px',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}>
                        <FaCheckCircle style={{ color: '#10b981', fontSize: '18px' }} />
                        <span style={{ fontWeight: 500, color: '#10b981' }}>
                          ✓ All {classes.length} courses have assigned professors
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Time Configuration */}
                  <div className={styles.formCard}>
                    <h3 className={styles.formSectionTitle}>
                      <FaClock /> Campus Schedule Times (Room/Building Operating Hours)
                    </h3>
                    <div className={styles.timeConfigInfo}>
                      <Clock size={20} />
                      <p>Set the campus operating hours for room allocation. Classes scheduled on "Online Days" will not require rooms, regardless of these times.</p>
                    </div>

                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Campus Opening Time (Classes can start from)</label>
                        <input
                          type="time"
                          className={styles.formInput}
                          value={timeSettings.startTime}
                          onChange={(e) => setTimeSettings(prev => ({ ...prev, startTime: e.target.value }))}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Campus Closing Time (Last class must end by)</label>
                        <input
                          type="time"
                          className={styles.formInput}
                          value={timeSettings.endTime}
                          onChange={(e) => setTimeSettings(prev => ({ ...prev, endTime: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className={styles.slotDurationInfo}>
                      <Clock size={18} />
                      <div>
                        <strong>Time Slot Duration:</strong> 90 minutes (1.5 hours)
                        <p className={styles.slotDurationNote}>
                          Standard academic period. Schedule generation automatically allocates multiple slots based on each class's Lec Hours + Lab Hours from the CSV file.
                        </p>
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Days of Week</label>
                      <div className={styles.checkboxGroup}>
                        <label className={styles.checkboxLabel}>
                          <input type="checkbox" checked disabled />
                          <span>Monday - Friday (Required)</span>
                        </label>
                        <label className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={timeSettings.includeSaturday}
                            onChange={(e) => setTimeSettings(prev => ({ ...prev, includeSaturday: e.target.checked }))}
                          />
                          <span>Include Saturday</span>
                        </label>
                        <label className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={timeSettings.includeSunday}
                            onChange={(e) => setTimeSettings(prev => ({ ...prev, includeSunday: e.target.checked }))}
                          />
                          <span>Include Sunday</span>
                        </label>
                      </div>
                    </div>

                    {/* Lunch Break Settings */}
                    <div className={styles.lunchBreakSection}>
                      <div className={styles.lunchBreakHeader}>
                        <label className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={timeSettings.lunchBreakEnabled}
                            onChange={(e) => setTimeSettings(prev => ({ ...prev, lunchBreakEnabled: e.target.checked }))}
                          />
                          <span style={{ fontWeight: 600, fontSize: '14px' }}>
                            🍽️ Enable Lunch Break Period
                          </span>
                        </label>
                      </div>

                      {timeSettings.lunchBreakEnabled && (
                        <div className={styles.lunchBreakSettings}>
                          <div className={styles.lunchBreakInfo}>
                            <Clock size={18} />
                            <p>No classes will be scheduled during the lunch break period to ensure faculty and students have time for meals.</p>
                          </div>

                          <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                              <label className={styles.formLabel}>Lunch Start Time</label>
                              <input
                                type="time"
                                className={styles.formInput}
                                value={timeSettings.lunchBreakStart}
                                onChange={(e) => setTimeSettings(prev => ({ ...prev, lunchBreakStart: e.target.value }))}
                              />
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.formLabel}>Lunch End Time</label>
                              <input
                                type="time"
                                className={styles.formInput}
                                value={timeSettings.lunchBreakEnd}
                                onChange={(e) => setTimeSettings(prev => ({ ...prev, lunchBreakEnd: e.target.value }))}
                              />
                            </div>
                          </div>

                          <div className={styles.checkboxGroup}>
                            <label className={styles.checkboxLabel}>
                              <input
                                type="checkbox"
                                checked={timeSettings.lunchBreakStrict}
                                onChange={(e) => setTimeSettings(prev => ({ ...prev, lunchBreakStrict: e.target.checked }))}
                              />
                              <span>
                                <strong>Strict Mode:</strong> Absolutely no classes during lunch break (hard constraint)
                              </span>
                            </label>
                          </div>

                          {!timeSettings.lunchBreakStrict && (
                            <div className={styles.lunchBreakWarning}>
                              <AlertTriangle size={16} />
                              <span>Flexible mode: Algorithm will avoid lunch break but may schedule classes if necessary due to limited room availability.</span>
                            </div>
                          )}

                          <div className={styles.lunchBreakPreview}>
                            <strong>Lunch Break:</strong> {timeSettings.lunchBreakStart} - {timeSettings.lunchBreakEnd}
                            <span className={timeSettings.lunchBreakStrict ? styles.strictBadge : styles.flexibleBadge}>
                              {timeSettings.lunchBreakStrict ? '🔒 Strict' : '⚡ Flexible'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>


                    {/* Time Slot Preview */}
                    <div className={styles.timeSlotPreview}>
                      <strong>Generated Time Slots Preview:</strong>
                      <div className={styles.timeSlotsList}>
                        {generateTimeSlots(timeSettings).slice(0, 5).map(slot => (
                          <span key={slot.id} className={styles.timeSlotChip}>
                            {slot.slot_name}
                          </span>
                        ))}
                        {generateTimeSlots(timeSettings).length > 5 && (
                          <span className={styles.timeSlotMore}>
                            +{generateTimeSlots(timeSettings).length - 5} more slots
                          </span>
                        )}
                      </div>
                      <p className={styles.timeSlotCount}>
                        Total: {generateTimeSlots(timeSettings).length} time slots per day (90 min each)
                      </p>
                      <p className={styles.slotAllocationNote}>
                        💡 Each class will be allocated the required number of slots based on its Lec Hours + Lab Hours. For example, a class with 3 Lec hours + 3 Lab hours (6 hours/week) will be assigned 4 time slots across the week.
                      </p>
                    </div>
                  </div>

                  {/* Online Days Configuration (Quantum Rule: The "Online Day" Rule) */}
                  <div className={styles.formCard}>
                    <h3 className={styles.formSectionTitle}>
                      <Zap /> Online Days Configuration (Quantum-Inspired Rule)
                    </h3>
                    <div className={styles.timeConfigInfo}>
                      <Zap size={20} />
                      <p>
                        Select days where ALL classes are conducted online/asynchronously. These days will NOT require room allocations,
                        allowing the quantum algorithm to "tunnel" through problem spaces by shifting F2F demand to available days.
                      </p>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Select Online Days (All-Day Asynchronous)</label>
                      <div className={styles.checkboxGroup}>
                        {DAYS.map(day => (
                          <label key={day} className={styles.checkboxLabel}>
                            <input
                              type="checkbox"
                              checked={config.onlineDays.includes(day)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setConfig(prev => ({
                                    ...prev,
                                    onlineDays: [...prev.onlineDays, day]
                                  }))
                                } else {
                                  setConfig(prev => ({
                                    ...prev,
                                    onlineDays: prev.onlineDays.filter(d => d !== day)
                                  }))
                                }
                              }}
                            />
                            <span>{day}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {config.onlineDays.length > 0 && (
                      <div className={styles.onlineDaysSummary}>
                        <strong>Online Days Selected:</strong> {config.onlineDays.join(', ')}
                        <p className={styles.onlineDaysNote}>
                          ⚡ Classes on these days will NOT require room allocations. The algorithm will prioritize F2F classes on remaining days.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Advanced Settings Toggle */}
                  <div className={styles.advancedToggle}>
                    <button
                      className={styles.advancedToggleButton}
                      onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                    >
                      <Settings size={18} />
                      Advanced Algorithm Settings
                      {showAdvancedSettings ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                  </div>

                  {/* Advanced Algorithm Settings */}
                  {showAdvancedSettings && (
                    <div className={styles.formCard}>
                      <h3 className={styles.formSectionTitle}>
                        <FaAtom /> Quantum-Inspired Algorithm Parameters
                      </h3>

                      <div className={styles.algorithmInfo}>
                        <Zap size={20} />
                        <p>
                          The QIA (Quantum-Inspired Annealing) algorithm uses quantum tunneling simulation
                          to escape local minima and find globally optimal room allocations. Default settings
                          are optimized for thorough optimization.
                        </p>
                      </div>

                      <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>
                            Max Iterations
                            <span className={styles.formHint}>Higher = better solution (default: max)</span>
                          </label>
                          <input
                            type="number"
                            className={styles.formInput}
                            min={1000}
                            max={50000}
                            step={1000}
                            value={config.maxIterations}
                            onChange={(e) => setConfig(prev => ({
                              ...prev,
                              maxIterations: parseInt(e.target.value) || 10000
                            }))}
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>
                            Initial Temperature
                            <span className={styles.formHint}>Starting randomness level</span>
                          </label>
                          <input
                            type="number"
                            className={styles.formInput}
                            min={50}
                            max={500}
                            step={10}
                            value={config.initialTemperature}
                            onChange={(e) => setConfig(prev => ({
                              ...prev,
                              initialTemperature: parseFloat(e.target.value) || 200
                            }))}
                          />
                        </div>
                      </div>

                      <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>
                            Cooling Rate
                            <span className={styles.formHint}>Temperature decrease rate (0.99-0.9999)</span>
                          </label>
                          <input
                            type="number"
                            className={styles.formInput}
                            min={0.99}
                            max={0.9999}
                            step={0.001}
                            value={config.coolingRate}
                            onChange={(e) => setConfig(prev => ({
                              ...prev,
                              coolingRate: parseFloat(e.target.value) || 0.999
                            }))}
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>
                            Quantum Tunneling Probability
                            <span className={styles.formHint}>Chance to escape local minima (0.05-0.30)</span>
                          </label>
                          <input
                            type="number"
                            className={styles.formInput}
                            min={0.05}
                            max={0.30}
                            step={0.01}
                            value={config.quantumTunnelingProbability}
                            onChange={(e) => setConfig(prev => ({
                              ...prev,
                              quantumTunnelingProbability: parseFloat(e.target.value) || 0.15
                            }))}
                          />
                        </div>
                      </div>

                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>
                          Max Teacher Hours/Day
                          <span className={styles.formHint}>Maximum teaching hours per day limit</span>
                        </label>
                        <input
                          type="number"
                          className={styles.formInput}
                          min={4}
                          max={12}
                          value={config.maxTeacherHoursPerDay}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            maxTeacherHoursPerDay: parseInt(e.target.value) || 8
                          }))}
                        />
                      </div>

                      {/* Presets */}
                      <div className={styles.presetSection}>
                        <span className={styles.presetLabel}>Quick Presets:</span>
                        <button
                          className={styles.presetButton}
                          onClick={() => setConfig(prev => ({
                            ...prev,
                            maxIterations: 2000,
                            initialTemperature: 100,
                            coolingRate: 0.995,
                            quantumTunnelingProbability: 0.10
                          }))}
                        >
                          Fast (2k iterations)
                        </button>
                        <button
                          className={styles.presetButton}
                          onClick={() => setConfig(prev => ({
                            ...prev,
                            maxIterations: 5000,
                            initialTemperature: 150,
                            coolingRate: 0.997,
                            quantumTunnelingProbability: 0.12
                          }))}
                        >
                          Balanced (5k iterations)
                        </button>
                        <button
                          className={`${styles.presetButton} ${styles.activePreset}`}
                          onClick={() => setConfig(prev => ({
                            ...prev,
                            maxIterations: 10000,
                            initialTemperature: 200,
                            coolingRate: 0.999,
                            quantumTunnelingProbability: 0.15
                          }))}
                        >
                          Maximum (10k iterations)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Navigation & Generate */}
                  <div className={styles.stepNavigation}>
                    <button className={styles.backStepButton} onClick={() => setActiveStep(2)}>
                      <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
                      Back
                    </button>
                  </div>

                  {/* Auto-Generate Toggle */}
                  <div className={styles.autoGenerateSection}>
                    <div className={styles.autoGenerateHeader}>
                      <div className={styles.autoGenerateInfo}>
                        <FaSync className={autoGenerateEnabled ? styles.autoSyncActive : ''} />
                        <div>
                          <h4>Auto-Generate Schedules</h4>
                          <p>Automatically regenerate schedules when data changes (30 min interval)</p>
                        </div>
                      </div>
                      <label className={styles.toggleSwitch}>
                        <input
                          type="checkbox"
                          checked={autoGenerateEnabled}
                          onChange={(e) => setAutoGenerateEnabled(e.target.checked)}
                        />
                        <span className={styles.toggleSlider}></span>
                      </label>
                    </div>
                    {autoGenerateEnabled && (
                      <div className={styles.autoGenerateStatus}>
                        <FaClock />
                        <span>Auto-generate is active. System will check for data changes every 30 minutes.</span>
                      </div>
                    )}
                  </div>

                  {/* Generate Button */}
                  <div className={styles.generateSection}>
                    <button
                      className={`${styles.generateButton} ${scheduling ? styles.generating : ''}`}
                      onClick={handleGenerateSchedule}
                      disabled={scheduling || !canGenerate}
                    >
                      {scheduling ? (
                        <>
                          <FaSpinner className={styles.spinnerIcon} />
                          Generating Schedule... {(timer / 1000).toFixed(1)}s
                        </>
                      ) : (
                        <>
                          <Play size={20} /> Generate Room Allocation Schedule
                        </>
                      )}
                    </button>
                    {!canGenerate && (
                      <p className={styles.generateHint}>
                        Please enter a schedule name to generate
                      </p>
                    )}
                    {canGenerate && !scheduling && (
                      <p className={styles.generateInfo}>
                        <Zap size={16} />
                        Will process {classes.length} courses across {rooms.length} rooms using {config.maxIterations.toLocaleString()} QIA iterations
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* File Viewer Modal */}
      {showClassFileViewer && (
        <div className={styles.modalOverlay} onClick={closeFileViewer}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>
                <BookOpen size={24} /> Sections & Assigned Courses: {selectedBatchInfo?.year_batch}
              </h2>
              <button className={styles.modalCloseBtn} onClick={closeFileViewer}>
                <X size={24} />
              </button>
            </div>

            <div className={styles.modalBody}>
              {viewerLoading ? (
                <div className={styles.modalLoading}>
                  <FaSpinner className={styles.spinnerIcon} />
                  <p>Loading data...</p>
                </div>
              ) : viewerData.length === 0 ? (
                <div className={styles.modalEmpty}>
                  <p>No data found.</p>
                </div>
              ) : (
                <div className={styles.tableWrapper}>
                  <table className={styles.viewerTable}>
                    <thead>
                      <tr>
                        <th>Course Code</th>
                        <th>Course Name</th>
                        <th>Section</th>
                        <th>Year Level</th>
                        <th>Students</th>
                        <th>Lec Hours</th>
                        <th>Lab Hours</th>
                        <th>Department</th>
                        <th>Semester</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewerData.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td>{item.course_code || 'N/A'}</td>
                          <td>{item.course_name || 'N/A'}</td>
                          <td>{item.section || 'N/A'}</td>
                          <td>{item.year_level || 'N/A'}</td>
                          <td>{item.student_count || 'N/A'}</td>
                          <td>{item.lec_hours || 0}</td>
                          <td>{item.lab_hours || 0}</td>
                          <td>{item.department || 'N/A'}</td>
                          <td>{item.semester || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className={styles.modalFooter}>
                <p><strong>Total Records:</strong> {viewerData.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unassigned Courses Warning Modal */}
      {showUnassignedWarning && (
        <div className={styles.modalOverlay}>
          <div className={styles.unassignedModal}>
            <div className={styles.warningModalHeader}>
              <h3 className={styles.warningModalTitle}>
                <FaExclamationTriangle /> Courses Without Assigned Professors
              </h3>
              <button className={styles.closeModalButton} onClick={() => setShowUnassignedWarning(false)}>
                <FaTimes />
              </button>
            </div>

            <div className={styles.warningModalBody}>
              <div className={styles.warningBox}>
                <p className={styles.warningTitle}>
                  ⚠️ {unassignedCourses.length} course(s) do not have assigned professors yet.
                </p>
                <p className={styles.warningDescription}>
                  Please assign professors to these courses in the Teaching Load Assignment page,
                  or you can bypass this check and schedule them without professors (TBD will be shown).
                </p>
              </div>

              <div className={styles.warningActions}>
                <button
                  onClick={downloadUnassignedCoursesCSV}
                  className={`${styles.warningActionBtn} ${styles.download}`}
                >
                  <FaDownload /> Download CSV of Unassigned Courses
                </button>
                <button
                  onClick={() => router.push('/LandingPages/FacultyColleges/TeachingLoadAssignment')}
                  className={`${styles.warningActionBtn} ${styles.teaching}`}
                >
                  <FaChalkboardTeacher /> Go to Teaching Load Assignment
                </button>
              </div>

              <div className={styles.tableScrollContainer}>
                <table className={styles.viewerTable}>
                  <thead>
                    <tr>
                      <th>Course Code</th>
                      <th>Course Name</th>
                      <th>Section</th>
                      <th>Department</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unassignedCourses.map((course, idx) => (
                      <tr key={idx}>
                        <td>{course.course_code}</td>
                        <td>{course.course_name}</td>
                        <td>{course.section}</td>
                        <td>{course.department}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={styles.bypassSection}>
                <label className={styles.bypassLabel}>
                  <input
                    type="checkbox"
                    checked={bypassTeacherCheck}
                    onChange={(e) => setBypassTeacherCheck(e.target.checked)}
                  />
                  <span>
                    Bypass teacher check (Professors will be shown as "TBD" in schedule)
                  </span>
                </label>
              </div>
            </div>

            <div className={styles.warningModalFooter}>
              <div className={styles.modalActions}>
                <button
                  onClick={() => setShowUnassignedWarning(false)}
                  className={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (bypassTeacherCheck) {
                      executeScheduleGeneration()
                    } else {
                      alert('Please enable the bypass option to proceed without assigned professors.')
                    }
                  }}
                  disabled={!bypassTeacherCheck}
                  className={styles.proceedBtn}
                >
                  <FaPlay /> Proceed with Scheduling
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
