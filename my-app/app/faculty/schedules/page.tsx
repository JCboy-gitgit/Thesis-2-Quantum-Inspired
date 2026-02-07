'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { fetchNoCache } from '@/lib/fetchUtils'
import { useTheme } from '@/app/context/ThemeContext'
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
  X,
  User,
  GraduationCap,
  AlertCircle,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  Download,
  FileImage,
  Printer,
  FileText,
  ChevronDown
} from 'lucide-react'
import styles from './styles.module.css'
import '@/app/styles/faculty-global.css'

const parseJsonSafely = async (response: Response) => {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    return null
  }
  return response.json()
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

interface UserProfile {
  id: string
  email: string
  full_name: string
  department?: string
  college?: string
}

interface AssignedSchedule {
  id: number
  schedule_id: number
  faculty_email: string
  assigned_at: string
  schedule_name?: string
}

type ViewMode = 'my-schedule' | 'rooms' | 'faculty' | 'classes' | 'timeline' | 'timetable'
type TimetableType = 'room' | 'faculty' | 'section'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const TIME_SLOTS = [
  '7:00 AM', '7:30 AM', '8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM', 
  '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM',
  '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM',
  '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM', '6:00 PM', '6:30 PM',
  '7:00 PM', '7:30 PM', '8:00 PM'
]

function RoomSchedulesViewContent() {
  const router = useRouter()
  const { theme, collegeTheme } = useTheme()
  
  // User and view state
  const [user, setUser] = useState<UserProfile | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('my-schedule')
  const [hasAssignedSchedule, setHasAssignedSchedule] = useState(false)
  
  // Schedule data
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null)
  const [allocations, setAllocations] = useState<RoomAllocation[]>([])
  const [myAllocations, setMyAllocations] = useState<RoomAllocation[]>([])
  const [filteredAllocations, setFilteredAllocations] = useState<RoomAllocation[]>([])
  
  // Loading states
  const [loading, setLoading] = useState(true)
  const [loadingDetails, setLoadingDetails] = useState(false)
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterBuilding, setFilterBuilding] = useState<string>('all')
  const [filterRoom, setFilterRoom] = useState<string>('all')
  const [filterDay, setFilterDay] = useState<string>('all')
  const [filterTeacher, setFilterTeacher] = useState<string>('all')
  const [selectedAllocation, setSelectedAllocation] = useState<RoomAllocation | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  
  // Filter options
  const [buildings, setBuildings] = useState<string[]>([])
  const [rooms, setRooms] = useState<string[]>([])
  const [teachers, setTeachers] = useState<string[]>([])
  const [filteredRooms, setFilteredRooms] = useState<string[]>([])
  
  // Timetable view state
  const [timetableType, setTimetableType] = useState<TimetableType>('room')
  const [timetableItems, setTimetableItems] = useState<string[]>([])
  const [selectedTimetableItem, setSelectedTimetableItem] = useState<string>('')
  const [timetableIndex, setTimetableIndex] = useState<number>(0)
  const [timelineDayIndex, setTimelineDayIndex] = useState<number>(0)

  // Timeline derived values (must be after timelineDayIndex state)
  const timelineDay = DAYS[timelineDayIndex] || DAYS[0]
  const timelineAllocations = filteredAllocations
    .filter(a => (a.schedule_day || '').toLowerCase().includes(timelineDay.toLowerCase()))
    .sort((a, b) => (a.schedule_time || '').localeCompare(b.schedule_time || ''))

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Prevent body scroll when modal is open on mobile
  useEffect(() => {
    if (selectedAllocation && isMobile) {
      // Store current scroll position
      const scrollY = window.scrollY
      
      // Store original styles
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      
      // Prevent scrolling and layout shift
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.width = '100%'
      document.body.style.top = `-${scrollY}px`
      document.body.style.left = '0'
      document.body.style.right = '0'
      document.body.style.paddingRight = scrollbarWidth > 0 ? `${scrollbarWidth}px` : '0px'
      
      // Also lock the html element
      document.documentElement.style.overflow = 'hidden'
    } else {
      // Get the stored scroll position
      const scrollY = document.body.style.top
      
      // Restore original styles
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.paddingRight = ''
      document.documentElement.style.overflow = ''
      
      // Restore scroll position
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1)
      }
    }
    
    return () => {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.paddingRight = ''
      document.documentElement.style.overflow = ''
    }
  }, [selectedAllocation, isMobile])

  // Periodically refresh user data (name, avatar) every 30 seconds to stay in sync with profile changes
  useEffect(() => {
    const refreshUserData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return

        // Fetch fresh user data
        const { data: userData } = await supabase
          .from('users')
          .select('id, email, full_name')
          .eq('id', session.user.id)
          .single()

        // Fetch faculty_profiles for updated name
        const { data: facultyProfile } = await supabase
          .from('faculty_profiles')
          .select('full_name, department, college')
          .eq('user_id', userData?.id)
          .single()

        if (userData) {
          setUser({
            id: userData.id,
            email: userData.email,
            full_name: facultyProfile?.full_name || userData.full_name,
            department: facultyProfile?.department || user?.department,
            college: facultyProfile?.college || user?.college
          })
        }
      } catch (error) {
        console.error('Failed to refresh user data:', error)
      }
    }

    // Refresh every 30 seconds
    const refreshInterval = setInterval(refreshUserData, 30 * 1000)

    return () => clearInterval(refreshInterval)
  }, [user])

  useEffect(() => {
    const todayIndex = new Date().getDay() - 1
    if (todayIndex >= 0 && todayIndex < DAYS.length) {
      setTimelineDayIndex(todayIndex)
    }
  }, [])

  useEffect(() => {
    if (allocations.length > 0 || myAllocations.length > 0) {
      applyFilters()
    }
  }, [allocations, myAllocations, searchQuery, filterBuilding, filterRoom, filterDay, filterTeacher, viewMode])

  useEffect(() => {
    const currentAllocations = viewMode === 'my-schedule' ? myAllocations : allocations
    if (filterBuilding === 'all') {
      setFilteredRooms(rooms)
      setFilterRoom('all')
    } else {
      const roomsInBuilding = currentAllocations
        .filter(a => a.building === filterBuilding)
        .map(a => a.room)
        .filter((r, i, arr) => arr.indexOf(r) === i)
      setFilteredRooms(roomsInBuilding)
      if (!roomsInBuilding.includes(filterRoom)) {
        setFilterRoom('all')
      }
    }
  }, [filterBuilding, rooms, allocations, myAllocations, viewMode])

  // Update timetable items when timetable type or allocations change
  useEffect(() => {
    if (viewMode === 'timetable') {
      updateTimetableItems()
    }
  }, [timetableType, allocations, myAllocations, viewMode])

  // Helper function to strip LAB/LEC suffixes for section combination
  const stripSectionSuffix = (section: string | undefined): string => {
    if (!section) return ''
    return section
      .replace(/_LAB$/i, '')
      .replace(/_LEC$/i, '')
      .replace(/_LECTURE$/i, '')
      .replace(/_LABORATORY$/i, '')
      .replace(/ LAB$/i, '')
      .replace(/ LEC$/i, '')
      .trim()
  }

  const updateTimetableItems = () => {
    const currentAllocations = allocations.length > 0 ? allocations : myAllocations
    let items: string[] = []
    
    if (timetableType === 'room') {
      // Get unique room names (with building prefix)
      items = [...new Set(currentAllocations.map(a => `${a.building} - ${a.room}`))]
    } else if (timetableType === 'faculty') {
      // Get unique teacher names
      items = [...new Set(currentAllocations.map(a => a.teacher_name).filter(Boolean))] as string[]
    } else if (timetableType === 'section') {
      // Get unique sections - combine LAB and LEC into single entries
      items = [...new Set(currentAllocations.map(a => stripSectionSuffix(a.section)).filter(Boolean))] as string[]
    }
    
    setTimetableItems(items.sort())
    if (items.length > 0 && !items.includes(selectedTimetableItem)) {
      setSelectedTimetableItem(items[0])
      setTimetableIndex(0)
    }
  }

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user) {
        router.push('/')
        return
      }

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single() as { data: any; error: any }

      if (!userData || !userData.is_active) {
        router.push('/')
        return
      }

      // Also fetch from faculty_profiles for admin-assigned data
      const { data: facultyProfile } = await supabase
        .from('faculty_profiles')
        .select('full_name, department, college')
        .eq('user_id', userData.id)
        .single() as { data: { full_name?: string; department?: string; college?: string } | null; error: any }

      setUser({
        id: userData.id,
        email: userData.email,
        full_name: facultyProfile?.full_name || userData.full_name || userData.email.split('@')[0],
        department: facultyProfile?.department || userData.department,
        college: facultyProfile?.college || userData.college
      })

      // Fetch user's assigned schedule first
      await fetchMySchedule(session.user.email || '')
      
      // Then fetch all schedules for viewing
      await fetchSchedules()
      
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/')
    }
  }

  const fetchMySchedule = async (email: string) => {
    try {
      const response = await fetchNoCache(`/api/faculty-default-schedule?action=faculty-schedule&email=${encodeURIComponent(email)}`)
      
      if (response.ok) {
        const data = await parseJsonSafely(response)
        
        if (data?.schedule && data.allocations && data.allocations.length > 0) {
          setHasAssignedSchedule(true)
          setMyAllocations(data.allocations as RoomAllocation[])
          
          // Extract unique filter options from my allocations
          const uniqueBuildings = [...new Set(data.allocations.map((a: any) => a.building).filter(Boolean))] as string[]
          const uniqueRooms = [...new Set(data.allocations.map((a: any) => a.room).filter(Boolean))] as string[]
          const uniqueTeachers = [...new Set(data.allocations.map((a: any) => a.teacher_name).filter(Boolean))] as string[]
          
          setBuildings(uniqueBuildings)
          setRooms(uniqueRooms)
          setTeachers(uniqueTeachers)
          setFilteredRooms(uniqueRooms)
        }
      }
    } catch (error) {
      console.error('Error fetching my schedule:', error)
    }
  }

  const fetchSchedules = async () => {
    setLoading(true)
    try {
      const { data: scheduleData, error } = await supabase
        .from('generated_schedules')
        .select('*')
        .order('is_current', { ascending: false })
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
        
        // Only auto-select if we're not viewing my schedule
        if (viewMode !== 'my-schedule' && schedulesWithNames.length > 0) {
          const current = schedulesWithNames.find(s => (s as any).is_current) || schedulesWithNames[0]
          handleSelectSchedule(current)
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
        const uniqueTeachers = [...new Set(allocationData.map((a: any) => a.teacher_name).filter(Boolean))] as string[]
        
        setBuildings(uniqueBuildings)
        setRooms(uniqueRooms)
        setTeachers(uniqueTeachers)
        setFilteredRooms(uniqueRooms)
      }
    } catch (error) {
      console.error('Error fetching allocations:', error)
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    setSearchQuery('')
    setFilterBuilding('all')
    setFilterRoom('all')
    setFilterDay('all')
    setFilterTeacher('all')
    
    // If switching away from my-schedule and no schedule selected, select first one
    if (mode !== 'my-schedule' && !selectedSchedule && schedules.length > 0) {
      handleSelectSchedule(schedules[0])
    }
    
    // If switching to timetable view, update timetable items
    if (mode === 'timetable') {
      setTimeout(() => updateTimetableItems(), 100)
    }
  }

  const applyFilters = () => {
    // Determine which allocations to filter based on view mode
    let sourceAllocations = viewMode === 'my-schedule' ? myAllocations : allocations
    let filtered = [...sourceAllocations]

    // Apply view-mode specific filtering
    if (viewMode === 'rooms') {
      // Group by room - no additional filtering needed beyond room filter
    } else if (viewMode === 'faculty') {
      // Filter by teacher
      if (filterTeacher !== 'all') {
        filtered = filtered.filter(a => a.teacher_name === filterTeacher)
      }
    } else if (viewMode === 'classes') {
      // Show all classes - no additional view-specific filtering
    }

    // Apply common filters
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

  const groupByRoom = () => {
    const grouped: { [room: string]: RoomAllocation[] } = {}
    filteredAllocations.forEach(a => {
      const roomKey = `${a.building} - ${a.room}`
      if (!grouped[roomKey]) {
        grouped[roomKey] = []
      }
      grouped[roomKey].push(a)
    })
    return grouped
  }

  const groupByTeacher = () => {
    const grouped: { [teacher: string]: RoomAllocation[] } = {}
    filteredAllocations.forEach(a => {
      const teacherKey = a.teacher_name || 'Unassigned'
      if (!grouped[teacherKey]) {
        grouped[teacherKey] = []
      }
      grouped[teacherKey].push(a)
    })
    return grouped
  }

  // Timetable helper functions
  const getTimetableAllocations = (): RoomAllocation[] => {
    const currentAllocations = allocations.length > 0 ? allocations : myAllocations
    
    if (!selectedTimetableItem) return []
    
    if (timetableType === 'room') {
      return currentAllocations.filter(a => `${a.building} - ${a.room}` === selectedTimetableItem)
    } else if (timetableType === 'faculty') {
      return currentAllocations.filter(a => a.teacher_name === selectedTimetableItem)
    } else if (timetableType === 'section') {
      // Match both LAB and LEC variants of the section
      return currentAllocations.filter(a => {
        const baseSection = stripSectionSuffix(a.section)
        return baseSection === selectedTimetableItem
      })
    }
    return []
  }

  // Generate unique color for each course
  const getCourseColor = (courseCode: string): string => {
    if (!courseCode) return 'hsl(200, 70%, 80%)'
    
    // Create a hash from the course code
    let hash = 0
    for (let i = 0; i < courseCode.length; i++) {
      hash = courseCode.charCodeAt(i) + ((hash << 5) - hash)
    }
    
    // Generate distinct hue values
    const hue = Math.abs(hash) % 360
    return `hsl(${hue}, 65%, 75%)`
  }

  const getCourseTextColor = (courseCode: string): string => {
    if (!courseCode) return '#1e293b'
    let hash = 0
    for (let i = 0; i < courseCode.length; i++) {
      hash = courseCode.charCodeAt(i) + ((hash << 5) - hash)
    }
    const hue = Math.abs(hash) % 360
    return `hsl(${hue}, 80%, 25%)`
  }

  const parseTimeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i)
    if (!match) return 0
    
    let hours = parseInt(match[1])
    const minutes = parseInt(match[2])
    const period = match[3]?.toUpperCase()
    
    // Handle 12-hour format with AM/PM
    if (period === 'PM' && hours !== 12) hours += 12
    if (period === 'AM' && hours === 12) hours = 0
    
    // If no AM/PM, assume 24-hour format - already correct
    // But handle edge case where hours < 7 might be PM (afternoon classes)
    // Actually, 24-hour format is already correct as-is
    
    return hours * 60 + minutes
  }

  const getTimeRange = (timeStr: string): { start: number; end: number } => {
    if (!timeStr) return { start: 0, end: 0 }
    
    const parts = timeStr.split('-').map(t => t.trim())
    if (parts.length === 2) {
      return {
        start: parseTimeToMinutes(parts[0]),
        end: parseTimeToMinutes(parts[1])
      }
    }
    
    const start = parseTimeToMinutes(timeStr)
    return { start, end: start + 60 }
  }

  // Get the time slot index for positioning
  const getTimeSlotIndex = (minutes: number): number => {
    const baseMinutes = 7 * 60 // 7:00 AM
    return Math.floor((minutes - baseMinutes) / 30)
  }

  const getAllocationsStartingAt = (day: string, timeSlot: string): RoomAllocation[] => {
    const timetableAllocations = getTimetableAllocations()
    const slotMinutes = parseTimeToMinutes(timeSlot)
    
    return timetableAllocations.filter(a => {
      if (!a.schedule_day?.toLowerCase().includes(day.toLowerCase())) return false
      const { start } = getTimeRange(a.schedule_time)
      // Only return allocations that START at this time slot
      return Math.abs(start - slotMinutes) < 5 // Allow 5 min tolerance
    })
  }

  const isCellOccupied = (day: string, timeSlot: string): boolean => {
    const timetableAllocations = getTimetableAllocations()
    const slotMinutes = parseTimeToMinutes(timeSlot)
    
    return timetableAllocations.some(a => {
      if (!a.schedule_day?.toLowerCase().includes(day.toLowerCase())) return false
      const { start, end } = getTimeRange(a.schedule_time)
      // Check if this slot falls within an allocation (but not at start)
      return slotMinutes > start && slotMinutes < end
    })
  }

  const getRowSpan = (allocation: RoomAllocation): number => {
    const { start, end } = getTimeRange(allocation.schedule_time)
    const duration = end - start
    return Math.max(1, Math.ceil(duration / 30))
  }

  // Calculate card height based on duration (50px per 30 min slot)
  const getCardHeight = (allocation: RoomAllocation): number => {
    const { start, end } = getTimeRange(allocation.schedule_time)
    const duration = end - start
    const slots = Math.max(1, Math.ceil(duration / 30))
    // 50px per slot minus padding (8px total)
    return (slots * 50) - 8
  }

  const navigateTimetable = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && timetableIndex > 0) {
      setTimetableIndex(timetableIndex - 1)
      setSelectedTimetableItem(timetableItems[timetableIndex - 1])
    } else if (direction === 'next' && timetableIndex < timetableItems.length - 1) {
      setTimetableIndex(timetableIndex + 1)
      setSelectedTimetableItem(timetableItems[timetableIndex + 1])
    }
  }

  // Export functions
  const handleExportTimetable = async (exportType: 'current' | 'all' | 'print') => {
    if (exportType === 'print') {
      window.print()
      return
    }

    // For image export, we'll use html2canvas approach
    const timetableElement = document.getElementById('timetable-grid')
    if (!timetableElement) return

    try {
      // Dynamic import of html2canvas
      const html2canvas = (await import('html2canvas')).default
      
      if (exportType === 'current') {
        const canvas = await html2canvas(timetableElement, {
          scale: 2,
          backgroundColor: '#ffffff',
          logging: false
        })
        
        const link = document.createElement('a')
        link.download = `timetable-${selectedTimetableItem?.replace(/\s+/g, '-') || 'schedule'}.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
      } else if (exportType === 'all') {
        // Export all items in the current type
        for (let i = 0; i < timetableItems.length; i++) {
          setSelectedTimetableItem(timetableItems[i])
          setTimetableIndex(i)
          
          // Wait for render
          await new Promise(resolve => setTimeout(resolve, 500))
          
          const canvas = await html2canvas(timetableElement, {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false
          })
          
          const link = document.createElement('a')
          link.download = `timetable-${timetableItems[i].replace(/\s+/g, '-')}.png`
          link.href = canvas.toDataURL('image/png')
          link.click()
          
          await new Promise(resolve => setTimeout(resolve, 300))
        }
      }
    } catch (error) {
      console.error('Export error:', error)
      alert('Export requires html2canvas package. Please install it with: npm install html2canvas')
    }
  }

  // PDF Export state
  const [showPdfExportMenu, setShowPdfExportMenu] = useState(false)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest(`.${styles.exportDropdown}`)) {
        setShowPdfExportMenu(false)
      }
    }

    if (showPdfExportMenu) {
      document.addEventListener('click', handleClickOutside)
    }

    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [showPdfExportMenu])

  // Helper: Normalize day abbreviations to full names
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

  // Helper: Expand day string to array of full day names
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

  // PDF Export Function
  const handleExportPDF = async (exportType: 'current' | 'all-rooms' | 'all-sections' | 'all-teachers' = 'current') => {
    try {
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [215.9, 279.4] // Short bond paper: 8.5" x 11" in mm (portrait)
      })

      const pageWidth = 215.9
      const pageHeight = 279.4
      const margin = 8
      const usableWidth = pageWidth - (margin * 2)

      // Generate color palette for courses
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

      // Process allocations to blocks
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

      // Generate time slots (7:00 AM to 8:00 PM)
      const generateTimeSlots = () => {
        const slots = []
        for (let i = 0; i < 27; i++) {
          const hour = Math.floor(i / 2) + 7
          const minute = (i % 2) * 30
          slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`)
        }
        return slots
      }

      // Draw timetable on PDF
      const drawTimetableOnPdf = (pdfDoc: InstanceType<typeof jsPDF>, allocData: RoomAllocation[], title: string, colorMap: Map<string, {r: number, g: number, b: number}>) => {
        // QTime Logo
        const logoSize = 8
        const logoTextSize = 10
        const logoText = 'Qtime Scheduler'
        pdfDoc.setFontSize(logoTextSize)
        pdfDoc.setFont('helvetica', 'bold')
        const textWidth = pdfDoc.getTextWidth(logoText)
        const totalWidth = logoSize + 2 + textWidth
        const startX = (pageWidth - totalWidth) / 2
        const logoY = margin
        
        // Green rounded rectangle for Q
        pdfDoc.setFillColor(22, 163, 74)
        pdfDoc.roundedRect(startX, logoY, logoSize, logoSize, 1.5, 1.5, 'F')
        
        // "Q" letter in white
        pdfDoc.setTextColor(255, 255, 255)
        pdfDoc.setFontSize(6)
        pdfDoc.setFont('helvetica', 'bold')
        const qWidth = pdfDoc.getTextWidth('Q')
        pdfDoc.text('Q', startX + (logoSize - qWidth) / 2, logoY + 5.5)
        
        // "Qtime Scheduler" text
        pdfDoc.setTextColor(0, 0, 0)
        pdfDoc.setFontSize(logoTextSize)
        pdfDoc.setFont('helvetica', 'bold')
        pdfDoc.text(logoText, startX + logoSize + 2, logoY + 6)
        
        pdfDoc.setTextColor(0, 0, 0)

        // Title
        pdfDoc.setFontSize(12)
        pdfDoc.setFont('helvetica', 'bold')
        const titleWidth = pdfDoc.getTextWidth(title)
        pdfDoc.text(title, (pageWidth - titleWidth) / 2, margin + 14)
        
        // Subtitle
        pdfDoc.setFontSize(8)
        pdfDoc.setFont('helvetica', 'normal')
        const subtitle = `${selectedSchedule?.schedule_name} | ${selectedSchedule?.semester} ${selectedSchedule?.academic_year}`
        const subtitleWidth = pdfDoc.getTextWidth(subtitle)
        pdfDoc.text(subtitle, (pageWidth - subtitleWidth) / 2, margin + 19)

        const localColorMap = colorMap.size > 0 ? colorMap : generateColorPalette(allocData)
        const blocks = processAllocationsToBlocks(allocData)
        
        // Table dimensions
        const startY = margin + 22
        const timeColWidth = 18
        const dayColWidth = (usableWidth - timeColWidth) / 6
        const rowHeight = 8
        const timeSlots = generateTimeSlots()

        // Header row
        pdfDoc.setDrawColor(100, 100, 100)
        pdfDoc.setLineWidth(0.5)
        pdfDoc.setFillColor(240, 240, 240)
        pdfDoc.rect(margin, startY, usableWidth, rowHeight, 'F')
        pdfDoc.setDrawColor(150, 150, 150)
        pdfDoc.rect(margin, startY, usableWidth, rowHeight)

        // Header text
        pdfDoc.setFontSize(7)
        pdfDoc.setFont('helvetica', 'bold')
        pdfDoc.setTextColor(0, 0, 0)
        const timeHeaderWidth = pdfDoc.getTextWidth('Time')
        pdfDoc.text('Time', margin + (timeColWidth - timeHeaderWidth) / 2, startY + 5.5)
        
        const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        weekdays.forEach((day, idx) => {
          const x = margin + timeColWidth + (idx * dayColWidth)
          const dayWidth = pdfDoc.getTextWidth(day)
          pdfDoc.text(day, x + (dayColWidth - dayWidth) / 2, startY + 5.5)
          pdfDoc.setDrawColor(150, 150, 150)
          pdfDoc.setLineWidth(0.3)
          pdfDoc.line(x, startY, x, startY + rowHeight)
        })
        pdfDoc.line(margin + timeColWidth, startY, margin + timeColWidth, startY + rowHeight)

        // Time slots and blocks
        timeSlots.forEach((slot, rowIdx) => {
          const y = startY + rowHeight + (rowIdx * rowHeight)
          if (y > pageHeight - margin - 10) return

          pdfDoc.setFontSize(7)
          pdfDoc.setFont('helvetica', 'normal')
          pdfDoc.setTextColor(0, 0, 0)
          const [hour, min] = slot.split(':').map(Number)
          const period = hour >= 12 ? 'PM' : 'AM'
          const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
          pdfDoc.text(`${displayHour}:${min.toString().padStart(2, '0')} ${period}`, margin + 1, y + 3.5)

          weekdays.forEach((day, dayIdx) => {
            const x = margin + timeColWidth + (dayIdx * dayColWidth)
            const dayLower = day.toLowerCase()
            const slotMinutes = hour * 60 + min

            const isCoveredByBlock = blocks.some(b => 
              b.day === dayLower && 
              b.startMinutes <= slotMinutes && 
              b.endMinutes > slotMinutes
            )

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

              const color = localColorMap.get(block.course_code) || { r: 200, g: 200, b: 200 }
              pdfDoc.setFillColor(color.r, color.g, color.b)
              pdfDoc.rect(x + 0.3, y + 0.3, dayColWidth - 0.6, blockHeight - 0.6, 'F')

              const centerX = x + dayColWidth / 2
              pdfDoc.setTextColor(255, 255, 255)
              let textY = y + 3
              
              // Course Code
              pdfDoc.setFontSize(7)
              pdfDoc.setFont('helvetica', 'bold')
              pdfDoc.text(block.course_code || 'N/A', centerX, textY, { align: 'center' })
              textY += 2.8
              
              // Course Name
              if (blockHeight > 8) {
                pdfDoc.setFontSize(5.5)
                pdfDoc.setFont('helvetica', 'normal')
                const courseNameLines = pdfDoc.splitTextToSize((block.course_name || '').substring(0, 35), dayColWidth - 1.5)
                pdfDoc.text(courseNameLines.slice(0, 1), centerX, textY, { align: 'center' })
                textY += 2.5
              }
              
              // Time Range
              if (blockHeight > 12) {
                pdfDoc.setFontSize(5)
                pdfDoc.setFont('helvetica', 'normal')
                const startH = Math.floor(block.startMinutes / 60)
                const startM = block.startMinutes % 60
                const endH = Math.floor(block.endMinutes / 60)
                const endM = block.endMinutes % 60
                const formatTime = (h: number, m: number) => {
                  const p = h >= 12 ? 'PM' : 'AM'
                  const dH = h === 0 ? 12 : h > 12 ? h - 12 : h
                  return `${dH}:${m.toString().padStart(2, '0')} ${p}`
                }
                pdfDoc.text(`${formatTime(startH, startM)} - ${formatTime(endH, endM)}`, centerX, textY, { align: 'center' })
                textY += 2.5
              }
              
              // Section
              if (blockHeight > 16) {
                pdfDoc.setFontSize(5.5)
                pdfDoc.setFont('helvetica', 'normal')
                pdfDoc.text((block.section || 'N/A').substring(0, 20), centerX, textY, { align: 'center' })
                textY += 2.5
              }
              
              // Room
              if (blockHeight > 20) {
                pdfDoc.setFontSize(5)
                pdfDoc.setFont('helvetica', 'normal')
                const fullRoom = block.room || 'N/A'
                const roomText = fullRoom.includes('-') ? fullRoom.split('-').slice(1).join('-') : fullRoom
                pdfDoc.text(roomText.substring(0, 25), centerX, textY, { align: 'center' })
                textY += 2.5
              }
              
              // Teacher
              if (blockHeight > 24) {
                pdfDoc.setFontSize(5)
                pdfDoc.setFont('helvetica', 'normal')
                pdfDoc.text((block.teacher_name || 'TBD').substring(0, 20), centerX, textY, { align: 'center' })
              }

              pdfDoc.setDrawColor(255, 255, 255)
              pdfDoc.setLineWidth(0.5)
              pdfDoc.rect(x + 0.3, y + 0.3, dayColWidth - 0.6, blockHeight - 0.6)
            }
          })
        })
      }

      const drawTimetable = (allocData: RoomAllocation[], title: string, pageNum: number) => {
        if (pageNum > 1) pdf.addPage()
        drawTimetableOnPdf(pdf, allocData, title, generateColorPalette(allocData))
      }

      // Generate PDFs based on export type
      let pageCount = 0
      const currentAllocations = allocations.length > 0 ? allocations : myAllocations

      if (exportType === 'current') {
        const viewLabel = timetableType === 'room' ? `Room: ${selectedTimetableItem}` :
          timetableType === 'faculty' ? `Faculty: ${selectedTimetableItem}` :
          timetableType === 'section' ? `Section: ${selectedTimetableItem}` : 'Schedule'
        const currentData = getTimetableAllocations()
        drawTimetable(currentData, viewLabel, ++pageCount)
      } else if (exportType === 'all-rooms') {
        const roomItems = [...new Set(currentAllocations.map(a => `${a.building} - ${a.room}`))]
        for (const room of roomItems) {
          const roomAllocs = currentAllocations.filter(a => `${a.building} - ${a.room}` === room)
          if (roomAllocs.length > 0) {
            drawTimetable(roomAllocs, `Room: ${room}`, ++pageCount)
          }
        }
      } else if (exportType === 'all-sections') {
        const sectionItems = [...new Set(currentAllocations.map(a => stripSectionSuffix(a.section)).filter(Boolean))]
        for (const section of sectionItems) {
          const sectionAllocs = currentAllocations.filter(a => {
            const baseSection = stripSectionSuffix(a.section)
            return baseSection === section
          })
          if (sectionAllocs.length > 0) {
            drawTimetable(sectionAllocs, `Section: ${section}`, ++pageCount)
          }
        }
      } else if (exportType === 'all-teachers') {
        const teacherItems = [...new Set(currentAllocations.map(a => a.teacher_name).filter(Boolean))] as string[]
        for (const teacher of teacherItems) {
          const teacherAllocs = currentAllocations.filter(a => a.teacher_name === teacher)
          if (teacherAllocs.length > 0) {
            drawTimetable(teacherAllocs, `Faculty: ${teacher}`, ++pageCount)
          }
        }
      }

      // Save PDF
      const fileName = `timetable_${selectedSchedule?.schedule_name}_${exportType}_${new Date().toISOString().split('T')[0]}.pdf`
      pdf.save(fileName)
    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert('Failed to export PDF. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading Schedules...</p>
      </div>
    )
  }

  const groupedByDay = groupByDay()
  const groupedByRoom = groupByRoom()
  const groupedByTeacher = groupByTeacher()
  const currentAllocations = viewMode === 'my-schedule' ? myAllocations : allocations

  return (
    <div className={`${styles.pageContainer} faculty-page-wrapper`} data-theme={theme} data-college-theme={collegeTheme}>
      <div className={styles.header}>
        <button onClick={() => router.push('/faculty/home')} className={styles.backButton}>
          <ArrowLeft size={20} />
          Back to Home
        </button>
        <h1 className={styles.pageTitle}>
          <Calendar size={32} />
          Schedule Views
        </h1>
        <p className={styles.subtitle}>
          {user && `Welcome, ${user.full_name}`}
        </p>
      </div>

      {/* View Mode Tabs */}
      <div className={styles.viewTabs}>
        <button 
          className={`${styles.viewTab} ${viewMode === 'my-schedule' ? styles.activeTab : ''}`}
          onClick={() => handleViewModeChange('my-schedule')}
        >
          <User size={18} />
          My Schedule
        </button>
        <button 
          className={`${styles.viewTab} ${viewMode === 'rooms' ? styles.activeTab : ''}`}
          onClick={() => handleViewModeChange('rooms')}
        >
          <DoorOpen size={18} />
          All Rooms
        </button>
        <button 
          className={`${styles.viewTab} ${viewMode === 'faculty' ? styles.activeTab : ''}`}
          onClick={() => handleViewModeChange('faculty')}
        >
          <Users size={18} />
          All Faculty
        </button>
        <button 
          className={`${styles.viewTab} ${viewMode === 'classes' ? styles.activeTab : ''}`}
          onClick={() => handleViewModeChange('classes')}
        >
          <GraduationCap size={18} />
          All Classes
        </button>
        <button 
          className={`${styles.viewTab} ${viewMode === 'timeline' ? styles.activeTab : ''}`}
          onClick={() => handleViewModeChange('timeline')}
        >
          <Clock size={18} />
          Timeline
        </button>
        <button 
          className={`${styles.viewTab} ${viewMode === 'timetable' ? styles.activeTab : ''}`}
          onClick={() => handleViewModeChange('timetable')}
        >
          <LayoutGrid size={18} />
          Timetable Gallery
        </button>
      </div>

      {/* My Schedule View - No schedule selector */}
      {viewMode === 'my-schedule' && !hasAssignedSchedule && (
        <div className={styles.emptyState}>
          <AlertCircle size={64} />
          <h3>No Schedule Assigned</h3>
          <p>The administrator has not assigned a schedule to your account yet.</p>
          <p>Please contact your department administrator for assistance.</p>
        </div>
      )}

      {/* Schedule Selector - Only show for non-my-schedule views */}
      {viewMode !== 'my-schedule' && schedules.length > 0 && (
        <div className={styles.scheduleSelector}>
          <label>Select Schedule:</label>
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

      {/* Schedule Info Cards */}
      {(viewMode === 'my-schedule' ? hasAssignedSchedule : selectedSchedule) && viewMode !== 'timetable' && (
        <div className={styles.scheduleInfo}>
          <div className={styles.infoCard}>
            <BookOpen size={20} />
            <div>
              <div className={styles.infoValue}>
                {viewMode === 'my-schedule' ? myAllocations.length : (selectedSchedule?.total_classes || 0)}
              </div>
              <div className={styles.infoLabel}>
                {viewMode === 'my-schedule' ? 'My Classes' : 'Total Classes'}
              </div>
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
          {viewMode !== 'my-schedule' && (
            <div className={styles.infoCard}>
              <Users size={20} />
              <div>
                <div className={styles.infoValue}>{teachers.length}</div>
                <div className={styles.infoLabel}>Faculty</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading Details */}
      {loadingDetails && viewMode !== 'my-schedule' && viewMode !== 'timetable' ? (
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p>Loading schedule details...</p>
        </div>
      ) : viewMode !== 'timetable' && (currentAllocations.length > 0 || (viewMode === 'my-schedule' && hasAssignedSchedule)) ? (
        <>
          {/* Filter Section */}
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
              {viewMode === 'faculty' && (
                <select value={filterTeacher} onChange={(e) => setFilterTeacher(e.target.value)}>
                  <option value="all">All Faculty</option>
                  {teachers.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Results Info */}
          <div className={styles.resultsInfo}>
            Showing {filteredAllocations.length} of {currentAllocations.length} 
            {viewMode === 'my-schedule' ? ' assigned' : ' scheduled'} classes
          </div>

          {/* Schedule View - Based on View Mode */}
          <div className={styles.scheduleView}>
            {/* My Schedule & Classes View - Group by Day */}
            {(viewMode === 'my-schedule' || viewMode === 'classes') && (
              <>
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
              </>
            )}

            {viewMode === 'timeline' && (
              <div className={styles.timelineWrapper}>
                <div className={styles.timelineHeader}>
                  <button
                    className={styles.timelineNav}
                    onClick={() => setTimelineDayIndex(prev => (prev - 1 + DAYS.length) % DAYS.length)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className={styles.timelineDay}>{timelineDay}</span>
                  <button
                    className={styles.timelineNav}
                    onClick={() => setTimelineDayIndex(prev => (prev + 1) % DAYS.length)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
                {timelineAllocations.length === 0 ? (
                  <div className={styles.timelineEmpty}>No classes for this day.</div>
                ) : (
                  <div className={styles.timelineList}>
                    {timelineAllocations.map(allocation => (
                      <div key={allocation.id} className={styles.timelineCard}>
                        <div className={styles.timelineTime}>
                          <Clock size={14} />
                          {allocation.schedule_time}
                        </div>
                        <div className={styles.timelineInfo}>
                          <h3>{allocation.course_code}</h3>
                          <p>{allocation.course_name}</p>
                          <span>{allocation.building} • {allocation.room}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Rooms View - Group by Room */}
            {viewMode === 'rooms' && (
              <>
                {Object.entries(groupedByRoom).map(([roomKey, roomAllocations]) => (
                  <div key={roomKey} className={styles.daySection}>
                    <h2 className={styles.dayTitle}>
                      <DoorOpen size={20} />
                      {roomKey}
                    </h2>
                    <div className={styles.allocationsList}>
                      {roomAllocations.map(allocation => (
                        <div 
                          key={allocation.id} 
                          className={styles.allocationCard}
                          onClick={() => setSelectedAllocation(allocation)}
                        >
                          <div className={styles.cardHeaderRow}>
                            <div className={styles.courseCodeBadge}>
                              {allocation.course_code}
                              {(allocation.lab_hours && allocation.lab_hours > 0) && (
                                <span className={styles.labLabel}>LAB</span>
                              )}
                            </div>
                          </div>
                          <div className={styles.courseInfo}>
                            <h3 className={styles.courseName}>{allocation.course_name}</h3>
                          </div>
                          <div className={styles.enhancedInfo}>
                            <div className={styles.infoRow}>
                              <span className={styles.infoLabel}>Section:</span>
                              <span className={styles.infoValue}>{allocation.section}</span>
                            </div>
                            <div className={styles.infoRow}>
                              <span className={styles.infoLabel}>Room:</span>
                              <span className={styles.infoValue}>{allocation.room}</span>
                            </div>
                            {allocation.teacher_name && (
                              <div className={styles.infoRow}>
                                <span className={styles.infoLabel}>Faculty:</span>
                                <span className={styles.infoValue}>{allocation.teacher_name}</span>
                              </div>
                            )}
                          </div>
                          <div className={styles.timeInfo}>
                            <Calendar size={16} />
                            {allocation.schedule_day}
                            <Clock size={16} style={{ marginLeft: '8px' }} />
                            {allocation.schedule_time}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Faculty View - Group by Teacher */}
            {viewMode === 'faculty' && (
              <>
                {Object.entries(groupedByTeacher).map(([teacherName, teacherAllocations]) => (
                  <div key={teacherName} className={styles.daySection}>
                    <h2 className={styles.dayTitle}>
                      <User size={20} />
                      {teacherName}
                    </h2>
                    <div className={styles.allocationsList}>
                      {teacherAllocations.map(allocation => (
                        <div 
                          key={allocation.id} 
                          className={styles.allocationCard}
                          onClick={() => setSelectedAllocation(allocation)}
                        >
                          <div className={styles.cardHeaderRow}>
                            <div className={styles.courseCodeBadge}>
                              {allocation.course_code}
                              {(allocation.lab_hours && allocation.lab_hours > 0) && (
                                <span className={styles.labLabel}>LAB</span>
                              )}
                            </div>
                          </div>
                          <div className={styles.courseInfo}>
                            <h3 className={styles.courseName}>{allocation.course_name}</h3>
                          </div>
                          <div className={styles.enhancedInfo}>
                            <div className={styles.infoRow}>
                              <span className={styles.infoLabel}>Course & Section:</span>
                              <span className={styles.infoValue}>{allocation.section}</span>
                            </div>
                            <div className={styles.infoRow}>
                              <span className={styles.infoLabel}>Room:</span>
                              <span className={styles.infoValue}>{allocation.room}</span>
                            </div>
                            <div className={styles.infoRow}>
                              <span className={styles.infoLabel}>Building:</span>
                              <span className={styles.infoValue}>{allocation.building}</span>
                            </div>
                          </div>
                          <div className={styles.timeInfo}>
                            <Calendar size={16} />
                            {allocation.schedule_day}
                            <Clock size={16} style={{ marginLeft: '8px' }} />
                            {allocation.schedule_time}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      ) : viewMode !== 'my-schedule' && viewMode !== 'timetable' && (
        <div className={styles.emptyState}>
          <Calendar size={64} />
          <h3>No schedule data available</h3>
          <p>There are no room allocations for this schedule yet.</p>
        </div>
      )}

      {/* Timetable Gallery View */}
      {viewMode === 'timetable' && (
        <div className={styles.timetableSection}>
          {/* Timetable Type Selector */}
          <div className={styles.timetableControls}>
            <div className={styles.timetableTypeTabs}>
              <button 
                className={`${styles.typeTab} ${timetableType === 'room' ? styles.activeTypeTab : ''}`}
                onClick={() => { setTimetableType('room'); setTimetableIndex(0); }}
              >
                <DoorOpen size={16} />
                Room Timetables
              </button>
              <button 
                className={`${styles.typeTab} ${timetableType === 'faculty' ? styles.activeTypeTab : ''}`}
                onClick={() => { setTimetableType('faculty'); setTimetableIndex(0); }}
              >
                <Users size={16} />
                Faculty Timetables
              </button>
              <button 
                className={`${styles.typeTab} ${timetableType === 'section' ? styles.activeTypeTab : ''}`}
                onClick={() => { setTimetableType('section'); setTimetableIndex(0); }}
              >
                <GraduationCap size={16} />
                Section Timetables
              </button>
            </div>
            
            {/* Item Navigation - Pagination */}
            {timetableItems.length > 0 && (
              <div className={styles.timetableNavigation}>
                <button 
                  className={styles.navButton}
                  onClick={() => navigateTimetable('prev')}
                  disabled={timetableIndex === 0}
                  title="Previous schedule"
                >
                  <ChevronLeft size={20} />
                  Previous
                </button>
                <div className={styles.timetableSelector}>
                  <select 
                    value={selectedTimetableItem}
                    onChange={(e) => {
                      setSelectedTimetableItem(e.target.value)
                      setTimetableIndex(timetableItems.indexOf(e.target.value))
                    }}
                    className={styles.timetableSelect}
                  >
                    {timetableItems.map(item => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                  <span className={styles.navCounter}>
                    Page {timetableIndex + 1} of {timetableItems.length}
                  </span>
                </div>
                <button 
                  className={styles.navButton}
                  onClick={() => navigateTimetable('next')}
                  disabled={timetableIndex === timetableItems.length - 1}
                  title="Next schedule"
                >
                  Next
                  <ChevronRight size={20} />
                </button>
              </div>
            )}

            {/* Export Buttons */}
            {selectedTimetableItem && (
              <div className={styles.exportButtons}>
                {/* PDF Export Dropdown */}
                <div className={styles.exportDropdown}>
                  <button 
                    className={styles.exportBtn}
                    onClick={() => setShowPdfExportMenu(!showPdfExportMenu)}
                    title="Export as PDF"
                  >
                    <FileText size={18} />
                    Export PDF
                    <ChevronDown size={14} />
                  </button>
                  {showPdfExportMenu && (
                    <div className={styles.exportDropdownMenu}>
                      <button onClick={() => { handleExportPDF('current'); setShowPdfExportMenu(false); }}>
                        Current View
                      </button>
                      <button onClick={() => { handleExportPDF('all-rooms'); setShowPdfExportMenu(false); }}>
                        All Rooms (PDF)
                      </button>
                      <button onClick={() => { handleExportPDF('all-sections'); setShowPdfExportMenu(false); }}>
                        All Sections (PDF)
                      </button>
                      <button onClick={() => { handleExportPDF('all-teachers'); setShowPdfExportMenu(false); }}>
                        All Faculty (PDF)
                      </button>
                    </div>
                  )}
                </div>
                <button 
                  className={styles.exportBtn}
                  onClick={() => handleExportTimetable('current')}
                  title="Export current timetable as image"
                >
                  <FileImage size={18} />
                  Export Image
                </button>
                <button 
                  className={styles.exportBtn}
                  onClick={() => handleExportTimetable('print')}
                  title="Print timetable"
                >
                  <Printer size={18} />
                  Print
                </button>
              </div>
            )}
          </div>

          {/* Timetable Grid */}
          {selectedTimetableItem && (
            <div className={styles.timetableContainer} id="timetable-grid">
              <div className={styles.timetableHeader}>
                <h2 className={styles.timetableTitle}>
                  {timetableType === 'room' && <DoorOpen size={28} />}
                  {timetableType === 'faculty' && <User size={28} />}
                  {timetableType === 'section' && <GraduationCap size={28} />}
                  {selectedTimetableItem}
                </h2>
                <p className={styles.timetableSubtitle}>
                  {selectedSchedule?.schedule_name} • {selectedSchedule?.semester} {selectedSchedule?.academic_year}
                </p>
              </div>
              
              <div className={styles.timetableGridWrapper}>
                <table className={styles.timetableTable}>
                  <thead>
                    <tr>
                      <th className={styles.timeColumnHeader}>Time</th>
                      {DAYS.map(day => (
                        <th key={day} className={styles.dayColumnHeader}>{day}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TIME_SLOTS.map((timeSlot, rowIndex) => (
                      <tr key={timeSlot} className={styles.timeRow}>
                        <td className={styles.timeCellLabel}>
                          <span className={styles.timeText}>{timeSlot}</span>
                        </td>
                        {DAYS.map(day => {
                          const startingAllocations = getAllocationsStartingAt(day, timeSlot)
                          const isOccupied = isCellOccupied(day, timeSlot)
                          
                          // Skip rendering if this cell is part of a spanning allocation
                          if (isOccupied && startingAllocations.length === 0) {
                            return null
                          }
                          
                          return (
                            <td 
                              key={`${day}-${timeSlot}`} 
                              className={styles.scheduleTableCell}
                              rowSpan={startingAllocations.length > 0 ? getRowSpan(startingAllocations[0]) : 1}
                            >
                              {startingAllocations.map(allocation => (
                                <div 
                                  key={allocation.id}
                                  className={styles.timetableClassCard}
                                  style={{ 
                                    backgroundColor: getCourseColor(allocation.course_code),
                                    borderLeftColor: getCourseTextColor(allocation.course_code),
                                    height: `${getCardHeight(allocation)}px`,
                                    minHeight: `${getCardHeight(allocation)}px`
                                  }}
                                  onClick={() => setSelectedAllocation(allocation)}
                                >
                                  <div className={styles.cardHeader}>
                                    <div className={styles.classCardCode} style={{ color: getCourseTextColor(allocation.course_code) }}>
                                      {allocation.course_code}
                                    </div>
                                    {(allocation.lab_hours && allocation.lab_hours > 0) && (
                                      <span className={styles.labBadge} title="Lab Schedule">
                                        LAB
                                      </span>
                                    )}
                                  </div>
                                  <div className={styles.classCardName}>
                                    {allocation.course_name}
                                  </div>
                                  <div className={styles.classCardSection}>
                                    <GraduationCap size={12} />
                                    {allocation.section}
                                  </div>
                                  <div className={styles.classCardRoom}>
                                    <DoorOpen size={12} />
                                    {allocation.room}
                                  </div>
                                  {allocation.teacher_name && (
                                    <div className={styles.classCardTeacher}>
                                      <User size={12} />
                                      {allocation.teacher_name}
                                    </div>
                                  )}
                                  <div className={styles.classCardTime}>
                                    <Clock size={12} />
                                    {allocation.schedule_time}
                                  </div>
                                </div>
                              ))}
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

          {timetableItems.length === 0 && (
            <div className={styles.emptyState}>
              <LayoutGrid size={64} />
              <h3>No Timetable Data</h3>
              <p>Select a schedule first to view timetables.</p>
            </div>
          )}
        </div>
      )}

      {/* Mobile Modal */}
      {isMobile && selectedAllocation && (
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
                  <BookOpen size={18} />
                  <div>
                    <strong>Section</strong>
                    <span>{selectedAllocation.section}</span>
                  </div>
                </div>
                {selectedAllocation.year_level && (
                  <div className={styles.detailItem}>
                    <GraduationCap size={18} />
                    <div>
                      <strong>Year Level</strong>
                      <span>Year {selectedAllocation.year_level}</span>
                    </div>
                  </div>
                )}
                <div className={styles.detailItem}>
                  <Calendar size={18} />
                  <div>
                    <strong>Day</strong>
                    <span>{selectedAllocation.schedule_day}</span>
                  </div>
                </div>
                <div className={styles.detailItem}>
                  <Clock size={18} />
                  <div>
                    <strong>Time</strong>
                    <span>{selectedAllocation.schedule_time}</span>
                  </div>
                </div>
                <div className={styles.detailItem}>
                  <Building2 size={18} />
                  <div>
                    <strong>Building</strong>
                    <span>{selectedAllocation.building}</span>
                  </div>
                </div>
                <div className={styles.detailItem}>
                  <DoorOpen size={18} />
                  <div>
                    <strong>Room</strong>
                    <span>{selectedAllocation.room}</span>
                  </div>
                </div>
                <div className={styles.detailItem}>
                  <Users size={18} />
                  <div>
                    <strong>Capacity</strong>
                    <span>{selectedAllocation.capacity} students</span>
                  </div>
                </div>
                {selectedAllocation.teacher_name && (
                  <div className={styles.detailItem}>
                    <User size={18} />
                    <div>
                      <strong>Teacher</strong>
                      <span>{selectedAllocation.teacher_name}</span>
                    </div>
                  </div>
                )}
                {selectedAllocation.department && (
                  <div className={styles.detailItem}>
                    <Building2 size={18} />
                    <div>
                      <strong>Department</strong>
                      <span>{selectedAllocation.department}</span>
                    </div>
                  </div>
                )}
                {(selectedAllocation.lec_hours || selectedAllocation.lab_hours) && (
                  <div className={styles.detailItem}>
                    <Clock size={18} />
                    <div>
                      <strong>Hours</strong>
                      <span>
                        {selectedAllocation.lec_hours ? `${selectedAllocation.lec_hours}h Lecture` : ''}
                        {selectedAllocation.lec_hours && selectedAllocation.lab_hours ? ' + ' : ''}
                        {selectedAllocation.lab_hours ? `${selectedAllocation.lab_hours}h Lab` : ''}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Side Panel */}
      {!isMobile && (
        <div className={`${styles.sidePanel} ${selectedAllocation ? styles.sidePanelOpen : ''}`}>
          {selectedAllocation && (
            <>
              <button className={styles.closePanelButton} onClick={() => setSelectedAllocation(null)}>
                <X size={24} />
              </button>
              <div className={styles.panelHeader}>
                <div className={styles.panelTitle}>
                  <h2 className={styles.panelCourseCode}>{selectedAllocation.course_code}</h2>
                  <p className={styles.panelCourseName}>{selectedAllocation.course_name}</p>
                </div>
              </div>
              <div className={styles.panelBody}>
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <BookOpen size={18} />
                    <div>
                      <strong>Section</strong>
                      <span>{selectedAllocation.section}</span>
                    </div>
                  </div>
                  {selectedAllocation.year_level && (
                    <div className={styles.infoItem}>
                      <GraduationCap size={18} />
                      <div>
                        <strong>Year Level</strong>
                        <span>Year {selectedAllocation.year_level}</span>
                      </div>
                    </div>
                  )}
                  <div className={styles.infoItem}>
                    <Calendar size={18} />
                    <div>
                      <strong>Day</strong>
                      <span>{selectedAllocation.schedule_day}</span>
                    </div>
                  </div>
                  <div className={styles.infoItem}>
                    <Clock size={18} />
                    <div>
                      <strong>Time</strong>
                      <span>{selectedAllocation.schedule_time}</span>
                    </div>
                  </div>
                  <div className={styles.infoItem}>
                    <Building2 size={18} />
                    <div>
                      <strong>Building</strong>
                      <span>{selectedAllocation.building}</span>
                    </div>
                  </div>
                  <div className={styles.infoItem}>
                    <DoorOpen size={18} />
                    <div>
                      <strong>Room</strong>
                      <span>{selectedAllocation.room}</span>
                    </div>
                  </div>
                  <div className={styles.infoItem}>
                    <Users size={18} />
                    <div>
                      <strong>Capacity</strong>
                      <span>{selectedAllocation.capacity} students</span>
                    </div>
                  </div>
                  {selectedAllocation.teacher_name && (
                    <div className={styles.infoItem}>
                      <User size={18} />
                      <div>
                        <strong>Teacher</strong>
                        <span>{selectedAllocation.teacher_name}</span>
                      </div>
                    </div>
                  )}
                  {selectedAllocation.department && (
                    <div className={styles.infoItem}>
                      <Building2 size={18} />
                      <div>
                        <strong>Department</strong>
                        <span>{selectedAllocation.department}</span>
                      </div>
                    </div>
                  )}
                  {(selectedAllocation.lec_hours || selectedAllocation.lab_hours) && (
                    <div className={styles.infoItem}>
                      <Clock size={18} />
                      <div>
                        <strong>Hours</strong>
                        <span>
                          {selectedAllocation.lec_hours ? `${selectedAllocation.lec_hours}h Lecture` : ''}
                          {selectedAllocation.lec_hours && selectedAllocation.lab_hours ? ' + ' : ''}
                          {selectedAllocation.lab_hours ? `${selectedAllocation.lab_hours}h Lab` : ''}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
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
