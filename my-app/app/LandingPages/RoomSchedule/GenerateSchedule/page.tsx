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
  X
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

interface ClassGroup {
  upload_group_id: number
  college: string
  file_name: string
  created_at: string
  class_count: number
  semester: string
  academic_year: string
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
  credit_units: number
  department: string
  semester: string
  academic_year: string
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
  prioritizeAccessibility: boolean
  avoidConflicts: boolean
}

interface TimeSettings {
  startTime: string // "07:00"
  endTime: string   // "20:00"
  slotDuration: number // 60 minutes
  includeSaturday: boolean
  includeSunday: boolean
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
    timeElapsedMs: number
  }
  allocations: RoomAllocation[]
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
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([])
  const [teacherGroups, setTeacherGroups] = useState<TeacherGroup[]>([])
  
  // Selected data
  const [selectedCampusGroup, setSelectedCampusGroup] = useState<number | null>(null)
  const [selectedClassGroup, setSelectedClassGroup] = useState<number | null>(null)
  const [selectedTeacherGroup, setSelectedTeacherGroup] = useState<number | null>(null)
  
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
    prioritizeAccessibility: true,
    avoidConflicts: true
  })
  
  // Time Configuration
  const [timeSettings, setTimeSettings] = useState<TimeSettings>({
    startTime: '07:00',
    endTime: '20:00',
    slotDuration: 90, // Fixed to 90 minutes (1.5 hours) - standard academic period
    includeSaturday: true,
    includeSunday: false
  })
  
  // UI states
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1)
  const [timer, setTimer] = useState(0)
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [showTimetable, setShowTimetable] = useState(false)
  
  // Expanded sections
  const [expandedCampus, setExpandedCampus] = useState(false)
  const [expandedClass, setExpandedClass] = useState(false)
  const [expandedTeacher, setExpandedTeacher] = useState(false)
  
  // Building and room filters
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([])
  const [selectedRooms, setSelectedRooms] = useState<number[]>([])
  const [showBuildingFilter, setShowBuildingFilter] = useState(false)
  
  // File viewer states
  const [showClassFileViewer, setShowClassFileViewer] = useState(false)
  const [showTeacherFileViewer, setShowTeacherFileViewer] = useState(false)
  const [viewerData, setViewerData] = useState<any[]>([])
  const [viewerLoading, setViewerLoading] = useState(false)

  // Load initial data
  useEffect(() => {
    fetchAllGroups()
  }, [])

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

      // Fetch class groups
      const { data: classData, error: classError } = await (supabase
        .from('class_schedules') as any)
        .select('upload_group_id, college, file_name, created_at, semester, academic_year')
        .order('created_at', { ascending: false })

      if (!classError && classData) {
        const grouped = classData.reduce((acc: ClassGroup[], curr: any) => {
          const existing = acc.find(item => item.upload_group_id === curr.upload_group_id)
          if (existing) {
            existing.class_count++
          } else {
            acc.push({
              upload_group_id: curr.upload_group_id,
              college: curr.college || 'Unnamed Batch',
              file_name: curr.file_name,
              created_at: curr.created_at,
              class_count: 1,
              semester: curr.semester || '',
              academic_year: curr.academic_year || ''
            })
          }
          return acc
        }, [])
        setClassGroups(grouped)
      }

      // Fetch teacher groups
      const { data: teacherData, error: teacherError } = await (supabase
        .from('teacher_schedules') as any)
        .select('upload_group_id, college, file_name, created_at')
        .order('created_at', { ascending: false })

      if (!teacherError && teacherData) {
        const grouped = teacherData.reduce((acc: TeacherGroup[], curr: any) => {
          const existing = acc.find(item => item.upload_group_id === curr.upload_group_id)
          if (existing) {
            existing.teacher_count++
          } else {
            acc.push({
              upload_group_id: curr.upload_group_id,
              college: curr.college || 'Unnamed',
              file_name: curr.file_name,
              created_at: curr.created_at,
              teacher_count: 1
            })
          }
          return acc
        }, [])
        setTeacherGroups(grouped)
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

  const loadClassData = async (groupId: number) => {
    const { data, error } = await (supabase
      .from('class_schedules') as any)
      .select('*')
      .eq('upload_group_id', groupId)
      .order('course_code', { ascending: true })

    if (!error && data) {
      setClasses(data.map((c: any) => ({
        id: c.id,
        course_code: c.course_code || '',
        course_name: c.course_name || '',
        section: c.section || '',
        year_level: c.year_level || parseInt(c.section?.charAt(0)) || 1, // Extract from section if not available
        student_count: c.student_count || 30, // Default 30 if not available
        schedule_day: c.schedule_day || '',
        schedule_time: c.schedule_time || '',
        lec_hours: c.lec_hr || c.lec_hours || 0,
        lab_hours: c.lab_hr || c.lab_hours || 0,
        credit_units: c.credit_unit || c.credit_units || 0,
        department: c.department || '',
        semester: c.semester || '',
        academic_year: c.academic_year || ''
      })))
      
      // Auto-fill semester and academic year from class data
      if (data.length > 0) {
        setConfig(prev => ({
          ...prev,
          semester: data[0].semester || prev.semester,
          academicYear: data[0].academic_year || prev.academicYear
        }))
      }
    }
  }

  const loadTeacherData = async (groupId: number) => {
    const { data, error } = await (supabase
      .from('teacher_schedules') as any)
      .select('*')
      .eq('upload_group_id', groupId)
      .order('name', { ascending: true })

    if (!error && data) {
      setTeachers(data.map((t: any) => ({
        id: t.id,
        teacher_id: t.teacher_id || '',
        name: t.name || t.teacher_name || '',
        schedule_day: t.schedule_day || '',
        schedule_time: t.schedule_time || '',
        department: t.department || '',
        email: t.email || ''
      })))
    }
  }

  // Handle group selection
  const handleSelectCampusGroup = (groupId: number) => {
    if (selectedCampusGroup === groupId) {
      setSelectedCampusGroup(null)
      setRooms([])
      setSelectedBuildings([])
      setSelectedRooms([])
    } else {
      setSelectedCampusGroup(groupId)
      loadCampusData(groupId)
      setSelectedBuildings([])
      setSelectedRooms([])
    }
  }

  const handleSelectClassGroup = (groupId: number) => {
    if (selectedClassGroup === groupId) {
      setSelectedClassGroup(null)
      setClasses([])
    } else {
      setSelectedClassGroup(groupId)
      loadClassData(groupId)
    }
  }

  const handleSelectTeacherGroup = (groupId: number) => {
    if (selectedTeacherGroup === groupId) {
      setSelectedTeacherGroup(null)
      setTeachers([])
    } else {
      setSelectedTeacherGroup(groupId)
      loadTeacherData(groupId)
    }
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
  
  // Select all rooms in a building
  const handleSelectAllRoomsInBuilding = (building: string) => {
    const buildingRoomIds = rooms.filter(r => r.building === building).map(r => r.id)
    setSelectedRooms(prev => {
      const allSelected = buildingRoomIds.every(id => prev.includes(id))
      if (allSelected) {
        // Deselect all
        return prev.filter(id => !buildingRoomIds.includes(id))
      } else {
        // Select all
        return [...new Set([...prev, ...buildingRoomIds])]
      }
    })
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
  
  // File viewer functions
  const handleViewClassFile = async () => {
    if (!selectedClassGroup) return
    
    setViewerLoading(true)
    setShowClassFileViewer(true)
    
    try {
      const { data, error } = await (supabase
        .from('class_schedules') as any)
        .select('*')
        .eq('upload_group_id', selectedClassGroup)
        .order('course_code', { ascending: true })
      
      if (!error && data) {
        setViewerData(data)
      }
    } catch (error) {
      console.error('Error loading class file data:', error)
    } finally {
      setViewerLoading(false)
    }
  }
  
  const handleViewTeacherFile = async () => {
    if (!selectedTeacherGroup) return
    
    setViewerLoading(true)
    setShowTeacherFileViewer(true)
    
    try {
      const { data, error } = await (supabase
        .from('teacher_schedules') as any)
        .select('*')
        .eq('upload_group_id', selectedTeacherGroup)
        .order('name', { ascending: true })
      
      if (!error && data) {
        setViewerData(data)
      }
    } catch (error) {
      console.error('Error loading teacher file data:', error)
    } finally {
      setViewerLoading(false)
    }
  }
  
  const closeFileViewer = () => {
    setShowClassFileViewer(false)
    setShowTeacherFileViewer(false)
    setViewerData([])
  }

  // Validation
  const canProceedToStep2 = selectedCampusGroup !== null && selectedClassGroup !== null
  const canProceedToStep3 = canProceedToStep2 && rooms.length > 0 && classes.length > 0
  const canGenerate = canProceedToStep3 && config.scheduleName.trim() !== ''

  // Get selected group info
  const selectedCampusInfo = campusGroups.find(g => g.upload_group_id === selectedCampusGroup)
  const selectedClassInfo = classGroups.find(g => g.upload_group_id === selectedClassGroup)
  const selectedTeacherInfo = teacherGroups.find(g => g.upload_group_id === selectedTeacherGroup)

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
        campus_group_id: selectedCampusGroup,
        class_group_id: selectedClassGroup,
        teacher_group_id: selectedTeacherGroup,
        rooms: filteredRooms, // Use filtered rooms instead of all rooms
        classes: classes,
        teachers: teachers,
        time_slots: timeSlots,
        active_days: activeDays,
        time_settings: timeSettings,
        config: {
          max_iterations: config.maxIterations,
          initial_temperature: config.initialTemperature,
          cooling_rate: config.coolingRate,
          quantum_tunneling_probability: config.quantumTunnelingProbability,
          max_teacher_hours_per_day: config.maxTeacherHoursPerDay,
          prioritize_accessibility: config.prioritizeAccessibility,
          avoid_conflicts: config.avoidConflicts
        }
      }

      console.log('[GenerateSchedule] Sending to Python backend:', {
        rooms: filteredRooms.length,
        classes: classes.length,
        teachers: teachers.length,
        timeSlots: timeSlots.length,
        activeDays
      })

      // Call the new API that connects to Python backend
      const response = await fetch('/api/schedule/qia-backend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scheduleData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate schedule')
      }

      const result = await response.json()
      console.log('[GenerateSchedule] API Response:', result)

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
          timeElapsedMs: result.optimization_stats?.time_elapsed_ms || timer
        },
        allocations: result.allocations || []
      })
      setShowResults(true)
      setShowTimetable(true)
    } catch (error: any) {
      console.error('Schedule generation failed:', error)
      alert(`Schedule generation failed: ${error.message || 'Unknown error'}`)
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
    <div className={styles.scheduleLayout}>
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
                </div>
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

              {/* Timetable Preview */}
              {showTimetable && scheduleResult.allocations && scheduleResult.allocations.length > 0 && (
                <div className={styles.timetableSection}>
                  <h3 className={styles.formSectionTitle}>
                    <FaCalendar /> Generated Schedule Timetable
                  </h3>
                  <div className={styles.timetableContainer}>
                    <div className={styles.timetableWrapper}>
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
                          {/* Generate time slots from 7:00 to 21:00 */}
                          {Array.from({ length: 14 }, (_, i) => {
                            const hour = 7 + i;
                            const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
                            return (
                              <tr key={timeSlot}>
                                <td className={styles.timeCell}>{timeSlot}</td>
                                {DAYS.map(day => {
                                  const dayAllocations = scheduleResult.allocations.filter(a => {
                                    const dayMatch = a.schedule_day?.toLowerCase() === day.toLowerCase();
                                    const timeMatch = a.schedule_time?.startsWith(timeSlot.split(':')[0]);
                                    return dayMatch && timeMatch;
                                  });
                                  return (
                                    <td key={`${day}-${timeSlot}`} className={styles.scheduleCell}>
                                      {dayAllocations.map((allocation, idx) => (
                                        <div 
                                          key={idx} 
                                          className={styles.allocationCard}
                                          style={{
                                            backgroundColor: allocation.building === 'GLE' ? '#e3f2fd' :
                                                           allocation.building === 'RGR' ? '#f3e5f5' :
                                                           allocation.building === 'RTL' ? '#e8f5e9' :
                                                           allocation.building === 'SAL' ? '#fff3e0' :
                                                           allocation.building === 'NGE' ? '#fce4ec' : '#f5f5f5'
                                          }}
                                        >
                                          <div className={styles.allocationCourse}>
                                            {allocation.course_code || 'N/A'}
                                          </div>
                                          <div className={styles.allocationRoom}>
                                            {allocation.room || `${allocation.building}-${allocation.room_id}`}
                                          </div>
                                          <div className={styles.allocationSection}>
                                            {allocation.section || 'N/A'}
                                          </div>
                                        </div>
                                      ))}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
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
                          <p>Select the room data CSV file to use for room allocation</p>
                        </div>
                      </div>
                      <div className={styles.dataSourceStatus}>
                        {selectedCampusGroup ? (
                          <span className={styles.selectedBadge}>
                            <CheckCircle2 size={16} /> Selected
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
                            {campusGroups.map(group => (
                              <div
                                key={group.upload_group_id}
                                className={`${styles.dataCard} ${selectedCampusGroup === group.upload_group_id ? styles.selected : ''}`}
                                onClick={() => handleSelectCampusGroup(group.upload_group_id)}
                              >
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
                                {selectedCampusGroup === group.upload_group_id && (
                                  <div className={styles.selectedCheck}><CheckCircle2 size={20} /></div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Class Schedules Selection */}
                  <div className={styles.dataSourceCard}>
                    <div className={styles.dataSourceHeader} onClick={() => setExpandedClass(!expandedClass)}>
                      <div className={styles.dataSourceTitle}>
                        <div className={`${styles.dataSourceIcon} ${styles.classIcon}`}>
                          <BookOpen size={24} />
                        </div>
                        <div>
                          <h3>Class Schedules</h3>
                          <p>Select the class schedule CSV file with courses and sections</p>
                        </div>
                      </div>
                      <div className={styles.dataSourceStatus}>
                        {selectedClassGroup ? (
                          <span className={styles.selectedBadge}>
                            <CheckCircle2 size={16} /> Selected
                          </span>
                        ) : (
                          <span className={styles.requiredBadge}>Required</span>
                        )}
                        {expandedClass ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      </div>
                    </div>
                    
                    {expandedClass && (
                      <div className={styles.dataSourceContent}>
                        {classGroups.length === 0 ? (
                          <div className={styles.emptyDataSource}>
                            <FileSpreadsheet size={40} />
                            <p>No class schedule data found. Upload a Class Schedule CSV first.</p>
                            <button onClick={() => router.push('/LandingPages/UploadCSV')}>
                              Upload CSV
                            </button>
                          </div>
                        ) : (
                          <div className={styles.dataSourceGrid}>
                            {classGroups.map(group => (
                              <div
                                key={group.upload_group_id}
                                className={`${styles.dataCard} ${selectedClassGroup === group.upload_group_id ? styles.selected : ''}`}
                                onClick={() => handleSelectClassGroup(group.upload_group_id)}
                              >
                                <div className={styles.dataCardHeader}>
                                  <GraduationCap size={20} />
                                  <h4>{group.college}</h4>
                                </div>
                                <div className={styles.dataCardStats}>
                                  <span><BookOpen size={14} /> {group.class_count} classes</span>
                                  {group.semester && <span>{group.semester}</span>}
                                </div>
                                <div className={styles.dataCardFile}>
                                  <FileSpreadsheet size={14} /> {group.file_name}
                                </div>
                                <div className={styles.dataCardDate}>
                                  {new Date(group.created_at).toLocaleDateString()}
                                </div>
                                {selectedClassGroup === group.upload_group_id && (
                                  <div className={styles.selectedCheck}><CheckCircle2 size={20} /></div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Teacher Schedules Selection (Optional) */}
                  <div className={styles.dataSourceCard}>
                    <div className={styles.dataSourceHeader} onClick={() => setExpandedTeacher(!expandedTeacher)}>
                      <div className={styles.dataSourceTitle}>
                        <div className={`${styles.dataSourceIcon} ${styles.teacherIcon}`}>
                          <FaChalkboardTeacher size={24} />
                        </div>
                        <div>
                          <h3>Teacher Schedules</h3>
                          <p>Optional: Select teacher availability data for conflict checking</p>
                        </div>
                      </div>
                      <div className={styles.dataSourceStatus}>
                        {selectedTeacherGroup ? (
                          <span className={styles.selectedBadge}>
                            <CheckCircle2 size={16} /> Selected
                          </span>
                        ) : (
                          <span className={styles.optionalBadge}>Optional</span>
                        )}
                        {expandedTeacher ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      </div>
                    </div>
                    
                    {expandedTeacher && (
                      <div className={styles.dataSourceContent}>
                        {teacherGroups.length === 0 ? (
                          <div className={styles.emptyDataSource}>
                            <FileSpreadsheet size={40} />
                            <p>No teacher schedule data found. This is optional.</p>
                            <button onClick={() => router.push('/LandingPages/UploadCSV')}>
                              Upload CSV
                            </button>
                          </div>
                        ) : (
                          <div className={styles.dataSourceGrid}>
                            {teacherGroups.map(group => (
                              <div
                                key={group.upload_group_id}
                                className={`${styles.dataCard} ${selectedTeacherGroup === group.upload_group_id ? styles.selected : ''}`}
                                onClick={() => handleSelectTeacherGroup(group.upload_group_id)}
                              >
                                <div className={styles.dataCardHeader}>
                                  <FaChalkboardTeacher size={20} />
                                  <h4>{group.college}</h4>
                                </div>
                                <div className={styles.dataCardStats}>
                                  <span><Users size={14} /> {group.teacher_count} teachers</span>
                                </div>
                                <div className={styles.dataCardFile}>
                                  <FileSpreadsheet size={14} /> {group.file_name}
                                </div>
                                <div className={styles.dataCardDate}>
                                  {new Date(group.created_at).toLocaleDateString()}
                                </div>
                                {selectedTeacherGroup === group.upload_group_id && (
                                  <div className={styles.selectedCheck}><CheckCircle2 size={20} /></div>
                                )}
                              </div>
                            ))}
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
                        <h4>{selectedCampusInfo?.school_name}</h4>
                        <p>{rooms.length} rooms • {totalRoomCapacity} total capacity</p>
                      </div>
                    </div>
                    <div className={styles.summaryCard}>
                      <div className={`${styles.summaryIcon} ${styles.classIcon}`}>
                        <BookOpen size={24} />
                      </div>
                      <div className={styles.summaryInfo}>
                        <h4>{selectedClassInfo?.college}</h4>
                        <p>{classes.length} classes • {uniqueDays.length} days • {uniqueTimeSlots.length} time slots</p>
                        <button 
                          className={styles.viewFileButton}
                          onClick={handleViewClassFile}
                          title="View class schedule file"
                        >
                          <FaEye size={14} /> View File
                        </button>
                      </div>
                    </div>
                    {selectedTeacherInfo && (
                      <div className={styles.summaryCard}>
                        <div className={`${styles.summaryIcon} ${styles.teacherIcon}`}>
                          <FaChalkboardTeacher size={24} />
                        </div>
                        <div className={styles.summaryInfo}>
                          <h4>{selectedTeacherInfo.college}</h4>
                          <p>{teachers.length} teachers available</p>
                          <button 
                            className={styles.viewFileButton}
                            onClick={handleViewTeacherFile}
                            title="View teacher schedule file"
                          >
                            <FaEye size={14} /> View File
                          </button>
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
                        
                        <div className={styles.buildingGrid}>
                          {uniqueBuildings.map(building => {
                            const buildingRooms = rooms.filter(r => r.building === building)
                            const buildingRoomIds = buildingRooms.map(r => r.id)
                            const allRoomsSelected = buildingRoomIds.every(id => selectedRooms.includes(id))
                            const someRoomsSelected = buildingRoomIds.some(id => selectedRooms.includes(id))
                            const buildingSelected = selectedBuildings.includes(building)
                            
                            return (
                              <div key={building} className={styles.buildingCard}>
                                <div className={styles.buildingHeader}>
                                  <label className={styles.buildingCheckbox}>
                                    <input
                                      type="checkbox"
                                      checked={buildingSelected || allRoomsSelected}
                                      onChange={() => {
                                        if (buildingSelected || allRoomsSelected) {
                                          // Deselect building and all its rooms
                                          setSelectedBuildings(prev => prev.filter(b => b !== building))
                                          setSelectedRooms(prev => prev.filter(id => !buildingRoomIds.includes(id)))
                                        } else {
                                          // Select building
                                          setSelectedBuildings(prev => [...prev, building])
                                          // Deselect individual rooms from this building
                                          setSelectedRooms(prev => prev.filter(id => !buildingRoomIds.includes(id)))
                                        }
                                      }}
                                      style={{
                                        opacity: someRoomsSelected && !allRoomsSelected ? 0.5 : 1
                                      }}
                                    />
                                    <Building2 size={18} />
                                    <strong>{building}</strong>
                                  </label>
                                  <button
                                    className={styles.selectAllRoomsBtn}
                                    onClick={() => handleSelectAllRoomsInBuilding(building)}
                                  >
                                    {allRoomsSelected ? 'Deselect All' : 'Select Specific Rooms'}
                                  </button>
                                </div>
                                
                                <div className={styles.buildingStats}>
                                  <span><DoorOpen size={14} /> {buildingRooms.length} rooms</span>
                                  <span><Users size={14} /> {buildingRooms.reduce((sum, r) => sum + r.capacity, 0)} capacity</span>
                                </div>
                                
                                {/* Show individual room checkboxes if some are selected */}
                                {(someRoomsSelected && !buildingSelected) && (
                                  <div className={styles.roomList}>
                                    {buildingRooms.map(room => (
                                      <label key={room.id} className={styles.roomCheckbox}>
                                        <input
                                          type="checkbox"
                                          checked={selectedRooms.includes(room.id)}
                                          onChange={() => handleToggleRoom(room.id)}
                                        />
                                        <span>{room.room} (Cap: {room.capacity})</span>
                                      </label>
                                    ))}
                                  </div>
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
                          checked={config.prioritizeAccessibility}
                          onChange={(e) => setConfig(prev => ({ ...prev, prioritizeAccessibility: e.target.checked }))}
                        />
                        <span>Prioritize PWD-accessible rooms (ground floor, wheelchair accessible)</span>
                      </label>
                      <label className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={config.avoidConflicts}
                          onChange={(e) => setConfig(prev => ({ ...prev, avoidConflicts: e.target.checked }))}
                        />
                        <span>Strictly avoid teacher/room conflicts</span>
                      </label>
                    </div>
                  </div>

                  {/* Time Configuration */}
                  <div className={styles.formCard}>
                    <h3 className={styles.formSectionTitle}>
                      <FaClock /> Time Configuration
                    </h3>
                    <div className={styles.timeConfigInfo}>
                      <Clock size={20} />
                      <p>Configure the daily schedule time range and slot duration. The system will generate time slots automatically.</p>
                    </div>
                    
                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Start Time</label>
                        <input
                          type="time"
                          className={styles.formInput}
                          value={timeSettings.startTime}
                          onChange={(e) => setTimeSettings(prev => ({ ...prev, startTime: e.target.value }))}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>End Time</label>
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
                        Will process {classes.length} classes across {rooms.length} rooms using {config.maxIterations.toLocaleString()} QIA iterations
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
      {(showClassFileViewer || showTeacherFileViewer) && (
        <div className={styles.modalOverlay} onClick={closeFileViewer}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>
                {showClassFileViewer ? (
                  <>
                    <BookOpen size={24} /> Class Schedule File: {selectedClassInfo?.file_name}
                  </>
                ) : (
                  <>
                    <FaChalkboardTeacher size={24} /> Teacher Schedule File: {selectedTeacherInfo?.file_name}
                  </>
                )}
              </h2>
              <button className={styles.modalCloseBtn} onClick={closeFileViewer}>
                <X size={24} />
              </button>
            </div>
            
            <div className={styles.modalBody}>
              {viewerLoading ? (
                <div className={styles.modalLoading}>
                  <FaSpinner className={styles.spinnerIcon} />
                  <p>Loading file data...</p>
                </div>
              ) : viewerData.length === 0 ? (
                <div className={styles.modalEmpty}>
                  <p>No data found in this file.</p>
                </div>
              ) : showClassFileViewer ? (
                <div className={styles.tableWrapper}>
                  <table className={styles.viewerTable}>
                    <thead>
                      <tr>
                        <th>Course Code</th>
                        <th>Course Name</th>
                        <th>Section</th>
                        <th>Day</th>
                        <th>Time</th>
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
                          <td>{item.schedule_day || 'N/A'}</td>
                          <td>{item.schedule_time || 'N/A'}</td>
                          <td>{item.lec_hr || item.lec_hours || 0}</td>
                          <td>{item.lab_hr || item.lab_hours || 0}</td>
                          <td>{item.department || 'N/A'}</td>
                          <td>{item.semester || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={styles.tableWrapper}>
                  <table className={styles.viewerTable}>
                    <thead>
                      <tr>
                        <th>Teacher ID</th>
                        <th>Name</th>
                        <th>Day</th>
                        <th>Time</th>
                        <th>Department</th>
                        <th>Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewerData.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td>{item.teacher_id || 'N/A'}</td>
                          <td>{item.name || item.teacher_name || 'N/A'}</td>
                          <td>{item.schedule_day || 'N/A'}</td>
                          <td>{item.schedule_time || 'N/A'}</td>
                          <td>{item.department || 'N/A'}</td>
                          <td>{item.email || 'N/A'}</td>
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
    </div>
  )
}
