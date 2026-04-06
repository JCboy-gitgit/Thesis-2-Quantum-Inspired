'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import styles from './GenerateSchedule.module.css'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import { supabase } from '@/lib/supabaseClient'
import { useColleges } from '@/app/context/CollegesContext'
import {
  FaCalendarPlus, FaArrowLeft, FaBuilding, FaDoorOpen,
  FaUserGraduate, FaChalkboardTeacher, FaCog, FaPlay,
  FaCheckCircle, FaExclamationTriangle, FaSpinner, FaClock,
  FaSync, FaDownload, FaChartBar, FaLayerGroup, FaUsers,
  FaBolt, FaAtom, FaFileAlt, FaCalendar, FaChevronDown, FaChevronRight,
  FaEye, FaTimes, FaFilter
} from 'react-icons/fa'
import { MdSchool, MdTableChart, MdMenuBook, MdPeople, MdSettings, MdFlashOn, MdCheckCircle, MdWarning, MdAccessTime, MdDomain, MdMeetingRoom, MdKeyboardArrowDown, MdKeyboardArrowRight, MdPlayArrow, MdReplay, MdVisibility, MdClose, MdUpload, MdError, MdDescription } from 'react-icons/md'
import { toast } from 'sonner'
import { pushAdminNotification } from '@/app/components/NotificationBell'
import { createSystemAlert } from '@/lib/notificationUtils'
import ManualEditModal from './ManualEditModal'
import { useScheduling } from '@/app/context/SchedulingContext'

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
  college?: string | null
  feature_tags?: string[] // NEW: Tags like 'Computer Lab', 'Projector', etc.
}

interface ClassSchedule {
  id: number
  course_id?: number
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
  required_features?: string[] // NEW: Room features required by the course
  required_lec_features?: string[] // NEW: Room features specifically for LEC
  required_lab_features?: string[] // NEW: Room features specifically for LAB
  component?: string
  college: string // NEW: College assigned to the section/course
  is_split_group?: boolean
  split_type?: string
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
  maxConsecutiveHours: number // NEW: Max hours before required break
  avoidConflicts: boolean
  onlineDays: string[] // Days when all classes are online
  // BulSU Rules & Constraints
  lunchMode: 'auto' | 'strict' | 'flexible' | 'none' // NEW
  lunchStartHour: number // NEW
  lunchEndHour: number // NEW
  strictLabRoomMatching: boolean // NEW
  strictLectureRoomMatching: boolean // NEW
  allowSplitSessions: boolean // NEW
  collegeRoomMatchingEnabled: boolean // NEW: Enforce college-room rule
  allowG1G2SplitSessions: boolean // NEW: Toggle G1/G2 splitting
  enforceG1G2EqualHours: boolean // NEW: Ensure G1/G2 have balanced scheduled hours
  // NEW: Soft Constraint Penalties (Fine-tuning)
  softRoomTypeMismatch: number
  softRoomTypeMajorMismatch: number
  softCapacityWaste: number
  softLunchOverlap: number
  softTeacherOverload: number
  softAccessibilityBonus: number
  softMorningPreference: number
  softDayDistribution: number
  softSiblingDifferentDay: number
  softOverloadedTeacher: number
  softTeacherNoBreak: number
  softConsecutiveHoursExceeded: number
  softFacultyIdleTime: number
  softFacultyLongGap2h: number
  softFacultyLongGap3h: number
  softFacultyLongGap4h: number
  softLoadImbalance: number
  softLateClass: number
  softRoomIdleGap: number
  softUnevenSectionDist: number
  softConsecutiveDayPenalty: number
  softSectionGap: number
  softFacultyNightClass: number
  softFacultyDailySpan: number
  softVslShiftMismatch: number
  softPartTimeSaturday: number
}

interface TimeSettings {
  startTime: string // "07:00"
  endTime: string   // "20:00"
  slotDuration: number // 60 minutes
  includeSaturday: boolean
  includeSunday: boolean
  // Lunch break settings (AUTO MODE: 1hr break after 6hrs consecutive)
  // These are kept for backwards compatibility but are no longer user-configurable
  lunchBreakEnabled: boolean  // Always true in auto mode
  lunchBreakStart: string     // Not used in auto mode
  lunchBreakEnd: string       // Not used in auto mode
  lunchBreakStrict: boolean   // Not used in auto mode
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
  course_id?: number
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
  component?: string
  required_lec_features?: string[]
  required_lab_features?: string[]
  college?: string
  is_split_group?: boolean
  split_type?: string
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
  reason_code?: string  // Category: INSUFFICIENT_ROOM_CAPACITY, NO_LAB_ROOMS, TEACHER_OVERLOADED, etc.
  reason_details?: string[]  // Detailed explanations
  student_count?: number
  compatible_rooms_count?: number
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
  onlineClassCount: number
  physicalClassCount: number
  splitSessionStats?: {
    original_sections_count: number
    after_split_count: number
    hybrid_courses_split: number
    split_sections_created: number
  }
  executionSource?: 'python-backend' | 'fallback-local' | string
  backendReachable?: boolean
  backendReplied?: boolean
  backendUrl?: string | null
  backendStatus?: number
  backendResponseMs?: number
  iterationClamp?: {
    requested: number
    applied: number
    cap: number
    wasClamped: boolean
  }
  queueJobId?: string | null
  queueInitialPosition?: number
  queueWaitSeconds?: number
  queuePendingAfterStart?: number
  queueMaxWaitSeconds?: number
}

interface QueueStatusState {
  loading: boolean
  available: boolean
  active: boolean
  waitingCount: number
  activeJobId?: string | null
  maxWaitSeconds?: number
  message: string
}

interface QueueStatusSnapshot {
  available: boolean
  active: boolean
  waitingCount: number
  maxWaitSeconds?: number
  message: string
}

interface BackendProbeState {
  checking: boolean
  reachable: boolean | null
  message: string
  backendUrl?: string | null
  backendStatus?: number
  probeLatencyMs?: number
  checkedAt?: string
}

type BackendPreference = 'auto' | 'local' | 'laptop' | 'render'

const BACKEND_PREFERENCE_LABELS: Record<BackendPreference, string> = {
  auto: 'Auto',
  local: 'Localhost',
  laptop: 'Laptop Public',
  render: 'Render',
}

const CAMPUS_OPENING_MINUTES = 7 * 60
const CAMPUS_CLOSING_MINUTES = 20 * 60

// Days for timetable
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

interface TeachingLoadCandidate {
  faculty_name: string
  section: string
  faculty_college?: string | null
}

type CapacityEstimateLevel = 'good' | 'warning' | 'impossible'

interface CollegeCapacityEstimate {
  collegeKey: string
  collegeLabel: string
  sectionCount: number
  students: number
  dedicatedSeats: number
  sharedSeats: number
  availableSeats: number
  seatCoverage: number
  level: CapacityEstimateLevel
}

function normalizeCollegeKey(value?: string | null): string {
  const raw = String(value || '').trim().toUpperCase()
  if (!raw) return ''
  const abbr = raw.match(/\(([^)]+)\)\s*$/)?.[1]?.trim().toUpperCase()
  return abbr || raw
}

function isFacultyCollegeCompatible(sectionCollege?: string | null, facultyCollege?: string | null): boolean {
  const sCol = normalizeCollegeKey(sectionCollege)
  const fCol = normalizeCollegeKey(facultyCollege)
  if (!sCol || !fCol) return true
  return fCol === 'SHARED' || fCol === sCol
}

function isMeaningfulFacultyName(name?: string | null): boolean {
  const normalized = String(name || '').trim().toUpperCase()
  if (!normalized) return false
  return !new Set(['TBD', 'TBA', 'N/A', 'NA', 'NONE', 'NULL', 'UNASSIGNED', 'UNKNOWN']).has(normalized)
}

function getCapacityEstimateLevel(seats: number, students: number): CapacityEstimateLevel {
  if (students <= 0) return 'good'
  const coverage = seats / students
  if (coverage >= 1) return 'good'
  if (coverage >= 0.75) return 'warning'
  return 'impossible'
}

function buildTeachingLoadsCandidatesMap(teachingLoads: any[]): Map<string, TeachingLoadCandidate[]> {
  const map = new Map<string, TeachingLoadCandidate[]>()

  const pushCandidate = (key: string, candidate: TeachingLoadCandidate) => {
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(candidate)
  }

  teachingLoads.forEach((load: any) => {
    const section = String(load?.section || '').trim()
    const candidate: TeachingLoadCandidate = {
      faculty_name: String(load?.faculty_profiles?.full_name || load?.faculty_profiles?.name || load?.faculty_profiles?.email || '').trim(),
      section,
      faculty_college: load?.faculty_profiles?.college || null,
    }

    // Use course_code from joined class_schedules for matching
    const courseCode = String(load?.class_schedules?.course_code || '').trim().toUpperCase()
    // Also use course_id as fallback
    const courseId = load?.course_id

    // Build keys by course_code (primary) and course_id (fallback)
    if (courseCode) {
      const specificKeyByCode = `code:${courseCode}-${section}`
      const genericKeyByCode = `code:${courseCode}-`
      pushCandidate(specificKeyByCode, candidate)
      if (section) pushCandidate(genericKeyByCode, candidate)
    }

    // Keep course_id based keys for backward compatibility
    const specificKey = `${courseId}-${section}`
    const genericKey = `${courseId}-`
    pushCandidate(specificKey, candidate)
    if (section) pushCandidate(genericKey, candidate)
  })

  return map
}

function resolveTeachingLoadCandidate(
  map: Map<string, TeachingLoadCandidate[]>,
  courseId: number,
  sectionName: string,
  sectionCollege?: string | null,
  courseCode?: string
): TeachingLoadCandidate | undefined {
  const trimmedSection = String(sectionName || '').trim()
  const normalizedCourseCode = String(courseCode || '').trim().toUpperCase()

  // Try course_code based lookup first (more reliable across different class_schedules entries)
  let candidates: TeachingLoadCandidate[] = []
  if (normalizedCourseCode) {
    const specificKeyByCode = `code:${normalizedCourseCode}-${trimmedSection}`
    const genericKeyByCode = `code:${normalizedCourseCode}-`
    const specificByCode = map.get(specificKeyByCode) || []
    const genericByCode = map.get(genericKeyByCode) || []
    candidates = [...specificByCode, ...genericByCode]
  }

  // Fallback to course_id based lookup if no matches by course_code
  if (candidates.length === 0) {
    const specificKey = `${courseId}-${trimmedSection}`
    const genericKey = `${courseId}-`
    const specific = map.get(specificKey) || []
    const generic = map.get(genericKey) || []
    candidates = [...specific, ...generic]
  }

  if (candidates.length === 0) return undefined

  const ranked = [...candidates].sort((a, b) => {
    const score = (candidate: TeachingLoadCandidate) => {
      let total = 0
      if (isMeaningfulFacultyName(candidate.faculty_name)) total += 4
      if (isFacultyCollegeCompatible(sectionCollege, candidate.faculty_college)) total += 2
      if (String(candidate.section || '').trim() === trimmedSection) total += 1
      return total
    }
    return score(b) - score(a)
  })

  const best = ranked[0]
  if (!best) return undefined
  if (!isMeaningfulFacultyName(best.faculty_name)) return undefined
  // College compatibility is used for ranking but should NOT reject
  // explicitly assigned faculty — cross-college teaching is allowed
  return best
}

function formatSectionDisplayLabel(rawSection: string): string {
  const section = (rawSection || '').trim()
  if (!section) return ''

  const normalized = section
    .replace(/_LABORATORY$/i, '')
    .replace(/_LECTURE$/i, '')
    .replace(/_LAB$/i, '')
    .replace(/_LEC$/i, '')
    .replace(/\s+LAB$/i, '')
    .replace(/\s+LEC$/i, '')
    .trim()

  const gMatch = normalized.match(/^(.*?)(?:[_\s-]+)(G[12])$/i)
  if (!gMatch) {
    return normalized.replace(/_/g, ' ')
  }

  const base = gMatch[1].replace(/_/g, ' ').trim()
  const group = gMatch[2].toUpperCase()
  return `${base}-${group}`
}

function parseHHMMToMinutes(value: string): number {
  const [h, m] = String(value || '').split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return CAMPUS_OPENING_MINUTES
  return (h * 60) + m
}

function minutesToHHMM(value: number): string {
  const h = Math.floor(value / 60)
  const m = value % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

function normalizeCampusTimeSettings(settings: TimeSettings): TimeSettings {
  const rawStart = parseHHMMToMinutes(settings.startTime)
  const rawEnd = parseHHMMToMinutes(settings.endTime)

  const start = Math.max(CAMPUS_OPENING_MINUTES, Math.min(rawStart, CAMPUS_CLOSING_MINUTES - 30))
  const end = Math.max(start + 30, Math.min(rawEnd, CAMPUS_CLOSING_MINUTES))

  return {
    ...settings,
    startTime: minutesToHHMM(start),
    endTime: minutesToHHMM(end),
  }
}

// Utility function to generate time slots from settings
function generateTimeSlots(settings: TimeSettings): TimeSlot[] {
  const normalized = normalizeCampusTimeSettings(settings)
  const slots: TimeSlot[] = []
  const [startHour, startMin] = normalized.startTime.split(':').map(Number)
  const [endHour, endMin] = normalized.endTime.split(':').map(Number)

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

function normalizeSectionForCount(section: string): string {
  return String(section || '')
    .replace(/_LAB$/i, '')
    .replace(/_LEC$/i, '')
    .replace(/_LECTURE$/i, '')
    .replace(/_LABORATORY$/i, '')
    .replace(/_G[12](_LAB|_LEC|_LECTURE|_LABORATORY)?$/i, '')
    .replace(/ G[12](\s+)?(LAB|LEC|LECTURE|LABORATORY)?$/i, '')
    .replace(/, LAB$/i, '')
    .replace(/, LEC$/i, '')
    .replace(/, LECTURE$/i, '')
    .replace(/, LABORATORY$/i, '')
    .replace(/ LAB$/i, '')
    .replace(/ LEC$/i, '')
    .replace(/-LAB$/i, '')
    .replace(/-LEC$/i, '')
    .replace(/_/g, ' ')
    .trim()
}

function buildCourseSectionCountKey(courseCode?: string, section?: string): string {
  const code = String(courseCode || '').trim().toLowerCase()
  const normalizedSection = normalizeSectionForCount(String(section || '')).toLowerCase()
  return `${code}|${normalizedSection}`
}

function countUniqueCourseSections(rows: Array<{ course_code?: string; section?: string }>): number {
  return new Set(
    (rows || [])
      .map((row) => buildCourseSectionCountKey(row.course_code, row.section))
      .filter((key) => key !== '|')
  ).size
}

function formatAcademicYear(startYear: number): string {
  return `${startYear}-${startYear + 1}`
}

function getDefaultAcademicYear(): string {
  const now = new Date()
  return formatAcademicYear(now.getFullYear())
}

function getAcademicYearStart(value: string): number | null {
  const normalized = String(value || '').trim()
  const match = normalized.match(/^(\d{4})\s*-\s*(\d{4})$/)
  if (!match) {
    return null
  }

  const start = Number(match[1])
  const end = Number(match[2])
  if (!Number.isFinite(start) || !Number.isFinite(end) || end !== start + 1) {
    return null
  }

  return start
}

export default function GenerateSchedulePage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { activeColleges: bulsuColleges } = useColleges()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const { isScheduling, timer, result: scheduleResult, startScheduling, setResult: setScheduleResult, resetScheduling } = useScheduling()

  // Data source states
  const [campusGroups, setCampusGroups] = useState<CampusGroup[]>([])
  const [yearBatches, setYearBatches] = useState<YearBatch[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [courses, setCourses] = useState<SectionCourse[]>([])

  // Selected data - support multiple campus groups and year batches
  const [selectedCampusGroups, setSelectedCampusGroups] = useState<number[]>([])
  const [selectedYearBatches, setSelectedYearBatches] = useState<number[]>([])
  const [selectedCollege, setSelectedCollege] = useState<string>('all') // College filter for scheduling

  // Multi-select sections & courses
  const [selectedSectionIds, setSelectedSectionIds] = useState<number[]>([]) // Selected section IDs (empty = all)
  const [excludedCourseKeys, setExcludedCourseKeys] = useState<Set<string>>(new Set()) // "sectionId-courseId" keys to exclude

  // Loaded detailed data
  const [rooms, setRooms] = useState<CampusRoom[]>([])
  const [allLoadedClasses, setAllLoadedClasses] = useState<ClassSchedule[]>([]) // All classes before section/course filtering
  const [classes, setClasses] = useState<ClassSchedule[]>([])
  const [teachers, setTeachers] = useState<TeacherSchedule[]>([])

  // Configuration
  const [config, setConfig] = useState<ScheduleConfig>({
    scheduleName: '',
    semester: 'First Semester',
    academicYear: getDefaultAcademicYear(),
    maxIterations: 10000, // Default to maximum
    initialTemperature: 200,
    coolingRate: 0.999,
    quantumTunnelingProbability: 0.15,
    maxTeacherHoursPerDay: 8,
    maxConsecutiveHours: 4, // Default 4 hours
    avoidConflicts: true,
    onlineDays: [], // Days where all classes are online
    // BulSU Rules Default
    lunchMode: 'auto',
    lunchStartHour: 13, // 1:00 PM
    lunchEndHour: 14,   // 2:00 PM
    strictLabRoomMatching: true,
    strictLectureRoomMatching: true,
    allowSplitSessions: true,
    collegeRoomMatchingEnabled: true,
    allowG1G2SplitSessions: true,
    enforceG1G2EqualHours: true,
    // Soft Penalties Defaults
    softRoomTypeMismatch: 50,
    softRoomTypeMajorMismatch: 500,
    softCapacityWaste: 15,
    softLunchOverlap: 500,
    softTeacherOverload: 80,
    softAccessibilityBonus: -10,
    softMorningPreference: 40,
    softDayDistribution: 20,
    softSiblingDifferentDay: 100,
    softOverloadedTeacher: 200,
    softTeacherNoBreak: 1000,
    softConsecutiveHoursExceeded: 500,
    softFacultyIdleTime: 600,
    softFacultyLongGap2h: 400,
    softFacultyLongGap3h: 1200,
    softFacultyLongGap4h: 3000,
    softLoadImbalance: 300,
    softLateClass: 250,
    softRoomIdleGap: 200,
    softUnevenSectionDist: 250,
    softConsecutiveDayPenalty: 0,
    softSectionGap: 50,
    softFacultyNightClass: 200,
    softFacultyDailySpan: 500,
    softVslShiftMismatch: 500,
    softPartTimeSaturday: 2000,
  })

  // Time Configuration
  const [timeSettings, setTimeSettings] = useState<TimeSettings>({
    startTime: '07:00',
    endTime: '20:00',
    slotDuration: 30, // 30 minutes for better granularity and alignment with manual editor
    includeSaturday: true,
    includeSunday: false,
    // Lunch break settings - AUTO MODE (1hr break after 6hrs consecutive)
    lunchBreakEnabled: true,     // Always enabled in auto mode
    lunchBreakStart: '12:00',    // Not user-configurable
    lunchBreakEnd: '13:00',      // Not user-configurable  
    lunchBreakStrict: true       // Not user-configurable
  })

  // UI states
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [showConstraintSettings, setShowConstraintSettings] = useState(false)
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1)
  const [showResults, setShowResults] = useState(false)
  const [showTimetable, setShowTimetable] = useState(false)
  const [timetableView, setTimetableView] = useState<'room' | 'section' | 'teacher'>('room') // NEW: Toggle between views
  const [selectedTimetableRoom, setSelectedTimetableRoom] = useState<string>('all') // NEW: Filter by specific room
  const [selectedTimetableSection, setSelectedTimetableSection] = useState<string>('all') // NEW: Filter by specific section
  const [selectedTimetableTeacher, setSelectedTimetableTeacher] = useState<string>('all') // NEW: Filter by specific teacher
  const [manualAllocations, setManualAllocations] = useState<RoomAllocation[]>([]) // NEW: Manual edits
  const [showManualModal, setShowManualModal] = useState(false) // NEW: Modal toggle
  const [showGenerateReview, setShowGenerateReview] = useState(false) // NEW: Pre-generate confirmation modal

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

  // View All modal states
  const [showAllRooms, setShowAllRooms] = useState(false)
  const [showAllClasses, setShowAllClasses] = useState(false)
  const [previewSearchQuery, setPreviewSearchQuery] = useState('')
  const [unscheduledSearchQuery, setUnscheduledSearchQuery] = useState('')
  const [unscheduledReasonFilter, setUnscheduledReasonFilter] = useState<'all' | string>('all')
  const [backendProbe, setBackendProbe] = useState<BackendProbeState>({
    checking: false,
    reachable: null,
    message: 'Backend status not checked yet.'
  })
  const [queueStatus, setQueueStatus] = useState<QueueStatusState>({
    loading: false,
    available: false,
    active: false,
    waitingCount: 0,
    activeJobId: null,
    maxWaitSeconds: undefined,
    message: 'Queue status unavailable until generation starts.',
  })
  const [backendPreference, setBackendPreference] = useState<BackendPreference>('auto')
  const [highlightQueueHeader, setHighlightQueueHeader] = useState(false)
  const [generationPhase, setGenerationPhase] = useState<'idle' | 'queued' | 'generating'>('idle')
  const [estimatedQueuePosition, setEstimatedQueuePosition] = useState<number | null>(null)
  const [isSubmittingGeneration, setIsSubmittingGeneration] = useState(false)

  const academicYearOptions = useMemo(() => {
    const options = new Set<string>()
    const currentYear = new Date().getFullYear()

    // Rolling window keeps the dropdown future-proof without hardcoding specific years.
    for (let year = currentYear - 2; year <= currentYear + 8; year += 1) {
      options.add(formatAcademicYear(year))
    }

    yearBatches.forEach((batch) => {
      const batchAcademicYear = String(batch.academic_year || '').trim()
      if (batchAcademicYear) {
        options.add(batchAcademicYear)
      }
    })

    const selectedAcademicYear = String(config.academicYear || '').trim()
    if (selectedAcademicYear) {
      options.add(selectedAcademicYear)
    }

    return Array.from(options).sort((a, b) => {
      const aStart = getAcademicYearStart(a)
      const bStart = getAcademicYearStart(b)

      if (aStart !== null && bStart !== null) {
        return bStart - aStart
      }

      if (aStart !== null) {
        return -1
      }

      if (bStart !== null) {
        return 1
      }

      return b.localeCompare(a)
    })
  }, [config.academicYear, yearBatches])

  const probeBackendConnection = async () => {
    const selectedBackendLabel = BACKEND_PREFERENCE_LABELS[backendPreference]
    setBackendProbe(prev => ({
      ...prev,
      checking: true,
      message: `Checking Python backend (${selectedBackendLabel})...`
    }))

    try {
      const response = await fetch(`/api/schedule/qia-backend?backendPreference=${encodeURIComponent(backendPreference)}`, {
        method: 'GET',
        cache: 'no-store'
      })
      const probe = await response.json()

      if (response.ok && probe?.backend_reachable) {
        setBackendProbe({
          checking: false,
          reachable: true,
          message: `Connected. ${selectedBackendLabel} backend is reachable and ready to schedule.`,
          backendUrl: probe.backend_url || null,
          backendStatus: probe.backend_status,
          probeLatencyMs: Number(probe.probe_latency_ms || 0) || undefined,
          checkedAt: probe.checked_at,
        })
        return
      }

      setBackendProbe({
        checking: false,
        reachable: false,
          message: probe?.error || `${selectedBackendLabel} backend is not reachable right now.`,
        backendUrl: null,
        probeLatencyMs: Number(probe?.probe_latency_ms || 0) || undefined,
        checkedAt: probe?.checked_at,
      })
    } catch (error: any) {
      setBackendProbe({
        checking: false,
        reachable: false,
        message: error?.message || 'Failed to check backend connection.',
      })
    }
  }

  const pollQueueStatus = async (silent = false): Promise<QueueStatusSnapshot> => {
    if (!silent) {
      setQueueStatus(prev => ({ ...prev, loading: true }))
    }

    try {
      const response = await fetch(
        `/api/schedule/qia-backend?action=queue-status&backendPreference=${encodeURIComponent(backendPreference)}`,
        { method: 'GET', cache: 'no-store' }
      )
      const payload = await response.json()

      if (response.ok && payload?.queue_status) {
        const queue = payload.queue_status
        const snapshot: QueueStatusSnapshot = {
          available: true,
          active: Boolean(queue.active),
          waitingCount: Number(queue.waiting_count || 0) || 0,
          maxWaitSeconds: Number(queue.max_wait_seconds || 0) || undefined,
          message: queue.active
            ? `Queue active: ${Number(queue.waiting_count || 0)} request(s) waiting.`
            : 'Queue is idle. Your request can start immediately.',
        }
        setQueueStatus({
          loading: false,
          available: snapshot.available,
          active: snapshot.active,
          waitingCount: snapshot.waitingCount,
          activeJobId: queue.active_job_id || null,
          maxWaitSeconds: snapshot.maxWaitSeconds,
          message: snapshot.message,
        })
        return snapshot
      } else {
        const snapshot: QueueStatusSnapshot = {
          available: false,
          active: false,
          waitingCount: 0,
          maxWaitSeconds: undefined,
          message: payload?.error || 'Queue status is temporarily unavailable.',
        }
        setQueueStatus({
          loading: false,
          available: snapshot.available,
          active: snapshot.active,
          waitingCount: snapshot.waitingCount,
          activeJobId: null,
          maxWaitSeconds: snapshot.maxWaitSeconds,
          message: snapshot.message,
        })
        return snapshot
      }
    } catch (error: any) {
      const snapshot: QueueStatusSnapshot = {
        available: false,
        active: false,
        waitingCount: 0,
        maxWaitSeconds: undefined,
        message: error?.message || 'Queue status check failed.',
      }
      setQueueStatus({
        loading: false,
        available: snapshot.available,
        active: snapshot.active,
        waitingCount: snapshot.waitingCount,
        activeJobId: null,
        maxWaitSeconds: snapshot.maxWaitSeconds,
        message: snapshot.message,
      })
      return snapshot
    }
  }

  useEffect(() => {
    if (!isScheduling) {
      setGenerationPhase('idle')
      setEstimatedQueuePosition(null)
      return
    }

    // When queue drains, transition the UI message from queued -> generating.
    if (generationPhase === 'queued' && queueStatus.available) {
      if (!queueStatus.active || queueStatus.waitingCount === 0) {
        setGenerationPhase('generating')
      }
    }
  }, [isScheduling, generationPhase, queueStatus.available, queueStatus.active, queueStatus.waitingCount])

  useEffect(() => {
    let disposed = false
    let timeoutId: number | null = null

    const tick = async () => {
      await pollQueueStatus(true)
      if (disposed) return

      const intervalMs = isScheduling ? 5000 : 20000
      timeoutId = window.setTimeout(tick, intervalMs)
    }

    tick()

    return () => {
      disposed = true
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [isScheduling, backendPreference])

  useEffect(() => {
    const shouldFocusQueue = searchParams.get('focusQueue') === '1'
    if (!shouldFocusQueue) return

    pollQueueStatus(true)

    const target = document.getElementById('queue-pressure-badge')
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightQueueHeader(true)
      window.setTimeout(() => setHighlightQueueHeader(false), 2000)
    }

    // Keep URL clean after handling one-time focus behavior.
    const params = new URLSearchParams(searchParams.toString())
    params.delete('focusQueue')
    const cleanedQuery = params.toString()
    const cleanedUrl = cleanedQuery ? `${pathname}?${cleanedQuery}` : pathname
    router.replace(cleanedUrl, { scroll: false })
  }, [searchParams])

  const unscheduledReasonLabels: Record<string, { label: string; icon: string; color: string }> = {
    INSUFFICIENT_ROOM_CAPACITY: { label: 'Room Capacity', icon: '🏢', color: '#ef4444' },
    NO_LAB_ROOMS: { label: 'No Lab Rooms', icon: '🔬', color: '#8b5cf6' },
    TEACHER_OVERLOADED: { label: 'Teacher Overloaded', icon: '👨‍🏫', color: '#f59e0b' },
    SCHEDULE_FULL: { label: 'Schedule Full', icon: '📅', color: '#ec4899' },
    TIME_CONFLICT: { label: 'Time Conflicts', icon: '⏰', color: '#3b82f6' },
    PARTIAL_SCHEDULE: { label: 'Partially Scheduled', icon: '📊', color: '#10b981' },
    ROOM_TYPE_MISMATCH: { label: 'Room Type Mismatch', icon: '🚪', color: '#6366f1' },
    UNKNOWN: { label: 'Other', icon: '❓', color: '#6b7280' }
  }

  const unscheduledReasonCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    const list = scheduleResult?.unscheduledList || []
    list.forEach((item: UnscheduledItem) => {
      const code = item.reason_code || 'UNKNOWN'
      counts[code] = (counts[code] || 0) + 1
    })
    return counts
  }, [scheduleResult?.unscheduledList])

  const filteredUnscheduledList = useMemo(() => {
    const list = scheduleResult?.unscheduledList || []
    const query = unscheduledSearchQuery.trim().toLowerCase()

    return list.filter((item: UnscheduledItem) => {
      const reasonCode = item.reason_code || 'UNKNOWN'
      if (unscheduledReasonFilter !== 'all' && reasonCode !== unscheduledReasonFilter) {
        return false
      }

      if (!query) return true

      const text = [
        item.course_code,
        item.course_name,
        item.section_code,
        item.teacher_name,
        item.reason,
        reasonCode,
        ...(item.reason_details || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return text.includes(query)
    })
  }, [scheduleResult?.unscheduledList, unscheduledSearchQuery, unscheduledReasonFilter])

  // Helper function to send browser notification
  const sendBrowserNotification = (title: string, body: string, icon: 'success' | 'error' = 'success') => {
    // Check if browser supports notifications
    if (!('Notification' in window)) {
      console.log('Browser does not support notifications')
      return
    }

    // Request permission if not granted
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: icon === 'success' ? '/icons/check-circle.png' : '/icons/alert-circle.png',
        badge: '/icons/icon-192x192.png',
        tag: 'schedule-notification',
        requireInteraction: true
      })
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(title, {
            body,
            icon: icon === 'success' ? '/icons/check-circle.png' : '/icons/alert-circle.png',
            badge: '/icons/icon-192x192.png',
            tag: 'schedule-notification',
            requireInteraction: true
          })
        }
      })
    }
  }

  // Helper function to change step and scroll to top
  const goToStep = (step: 1 | 2 | 3 | 4) => {
    setActiveStep(step)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Effect to show results when they come in from context
  useEffect(() => {
    if (scheduleResult && !showResults) {
      setShowResults(true)
      setShowTimetable(true)
    }
  }, [scheduleResult, showResults])

  // Filter classes based on selected sections and excluded courses
  useEffect(() => {
    if (allLoadedClasses.length === 0) {
      setClasses([])
      return
    }
    let filtered = allLoadedClasses
    // Filter by selected sections (if any are selected)
    if (selectedSectionIds.length > 0) {
      const selectedSectionNames = sections
        .filter(s => selectedSectionIds.includes(s.id))
        .map(s => s.section_name)
      filtered = filtered.filter(cls => {
        // Strip G1/G2 suffix to match against original section names
        const baseSectionName = cls.section.replace(/ G[12]$/, '')
        return selectedSectionNames.includes(baseSectionName) || selectedSectionNames.includes(cls.section)
      })
    }
    // Exclude specific course-section combos
    if (excludedCourseKeys.size > 0) {
      filtered = filtered.filter(cls => {
        // Strip G1/G2 suffix to find the correct base section ID
        const baseSectionName = cls.section.replace(/ G[12]$/, '')
        const sec = sections.find(s => s.section_name === baseSectionName || s.section_name === cls.section)
        if (!sec) return true
        const key = `${sec.id}-${cls.course_code}`
        return !excludedCourseKeys.has(key)
      })
    }
    setClasses(filtered)
  }, [allLoadedClasses, selectedSectionIds, excludedCourseKeys, sections])

  // Load initial data
  useEffect(() => {
    checkAuth()
    fetchAllGroups()
    probeBackendConnection()

    // Request notification permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        router.push('/')
        return
      }

      // Only admin can access admin pages
      if (session.user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        router.push('/faculty/home')
        return
      }
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/')
    }
  }

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
  const loadCampusData = async (groupId: number, collegeFilter?: string) => {
    const { data, error } = await (supabase
      .from('campuses') as any)
      .select('*')
      .eq('upload_group_id', groupId)
      .order('campus', { ascending: true })
      .order('building', { ascending: true })

    if (!error && data) {
      // Filter by college if specified
      let filteredData = data
      if (collegeFilter && collegeFilter !== 'all') {
        filteredData = data.filter((r: any) =>
          r.college === collegeFilter ||
          r.college === 'Shared' ||
          !r.college // Include rooms without college (legacy data)
        )
      }
      // Exclude unusable rooms
      filteredData = filteredData.filter((r: any) => {
        const status = (r.status || '').toLowerCase()
        return status !== 'not_usable' && status !== 'unavailable' && status !== 'inactive'
      })

      // Fetch room features (tags) for these rooms
      const roomIds = filteredData.map((r: any) => r.id)
      const { data: featureData } = await supabase
        .from('room_features')
        .select('room_id, feature_tags(tag_name)')
        .in('room_id', roomIds)

      const featureMap = new Map<number, string[]>()
      if (featureData) {
        featureData.forEach((f: any) => {
          if (!featureMap.has(f.room_id)) featureMap.set(f.room_id, [])
          if (f.feature_tags?.tag_name) featureMap.get(f.room_id)!.push(f.feature_tags.tag_name)
        })
      }

      setRooms(filteredData.map((r: any) => ({
        id: r.id,
        campus: r.campus || '',
        building: r.building || '',
        room: r.room || '',
        capacity: r.capacity || 30,
        room_type: r.room_type || 'Classroom',
        floor_number: r.floor_number || 1,
        has_ac: r.has_ac || false,
        has_projector: r.has_projector || false,
        is_pwd_accessible: r.is_pwd_accessible || r.is_first_floor || false,
        college: r.college || null,
        feature_tags: featureMap.get(r.id) || []
      })))
    }
  }

  const loadClassData = async (yearBatchId: number, collegeFilter?: string) => {
    try {
      // Get sections for this year batch
      let batchSections = sections.filter(s => s.year_batch_id === yearBatchId)

      // Filter sections by college if specified
      if (collegeFilter && collegeFilter !== 'all') {
        batchSections = batchSections.filter(s => s.college === collegeFilter || !s.college)
      }

      if (batchSections.length === 0) {
        setAllLoadedClasses([])
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
      // Query teaching loads and join with class_schedules to get course_code for matching
      const courseCodes = [...new Set(filteredCourses.map((c: any) => c.course_code).filter(Boolean))]
      const { data: teachingLoads, error: teachingLoadsError } = await (supabase
        .from('teaching_loads') as any)
        .select('*, faculty_profiles(*), class_schedules:course_id(course_code)')

      // Filter teaching loads to only those matching our course codes
      const filteredTeachingLoads = (!teachingLoadsError && teachingLoads)
        ? teachingLoads.filter((load: any) => {
            const loadCourseCode = String(load?.class_schedules?.course_code || '').trim().toUpperCase()
            return courseCodes.some(code => String(code || '').trim().toUpperCase() === loadCourseCode)
          })
        : []

      const teachingLoadsMap = buildTeachingLoadsCandidatesMap(filteredTeachingLoads)

      // Build class schedules from sections and their assigned courses
      const classSchedules: ClassSchedule[] = []
      const unassigned: typeof unassignedCourses = []
      let autoId = 1 // Generate unique numeric IDs

      // Helper to split hybrid classes into G1/G2 if lab capacity is exceeded
      const splitClasses = (classList: ClassSchedule[]): ClassSchedule[] => {
        if (!config.allowG1G2SplitSessions) return classList

        const extractCollegeKey = (value?: string) => {
          const raw = (value || '').trim().toUpperCase()
          if (!raw) return ''
          const abbr = raw.match(/\(([^)]+)\)\s*$/)?.[1]?.trim().toUpperCase()
          return abbr || raw
        }

        const result: ClassSchedule[] = []
        classList.forEach(c => {
          const cCollege = extractCollegeKey(c.college || '')
          const compatibleLabRooms = rooms.filter(r => {
            const rType = (r.room_type || '').toLowerCase()
            const isLabRoom = rType.includes('lab') || rType.includes('computer')
            if (!isLabRoom) return false

            if (!config.collegeRoomMatchingEnabled) return true
            const rCollegeRaw = (r.college || '').trim()
            if (!rCollegeRaw) return true
            const rCollegeKey = extractCollegeKey(rCollegeRaw)
            return rCollegeKey === 'SHARED' || !cCollege || rCollegeKey === cCollege
          })

          const maxLabCap = compatibleLabRooms.length > 0
            ? Math.max(...compatibleLabRooms.map(r => r.capacity || 0))
            : 30

          const needsSplit = (c.lab_hours > 0) && (c.student_count > maxLabCap)

          if (needsSplit) {
            if (c.lec_hours > 0) {
              result.push({ ...c, id: autoId++, lab_hours: 0, total_hours: c.lec_hours, component: 'LEC' })
            }
            const g1Count = Math.ceil(c.student_count / 2)
            const g2Count = Math.floor(c.student_count / 2)
            result.push({ ...c, id: autoId++, section: `${c.section} G1`, student_count: g1Count, lec_hours: 0, total_hours: c.lab_hours, component: 'LAB' })
            result.push({ ...c, id: autoId++, section: `${c.section} G2`, student_count: g2Count, lec_hours: 0, total_hours: c.lab_hours, component: 'LAB' })
          } else {
            result.push(c)
          }
        })
        return result
      }

      for (const section of batchSections) {
        const sectionAssignments = assignments.filter((a: any) => a.section_id === section.id)
        const sectionCourses = filteredCourses.filter((c: any) =>
          sectionAssignments.some((a: any) => a.course_id === c.id)
        )

        const currentSectionClasses: ClassSchedule[] = []
        for (const course of sectionCourses) {
          const assignedTeacher = resolveTeachingLoadCandidate(
            teachingLoadsMap,
            Number(course.id),
            section.section_name || '',
            section.college || course.college,
            course.course_code
          )

          if (!assignedTeacher) {
            unassigned.push({
              course_code: course.course_code || '',
              course_name: course.course_name || '',
              section: section.section_name || '',
              semester: course.semester || targetSemester || '',
              department: course.department || section.department || ''
            })
          }

          currentSectionClasses.push({
            id: autoId++,
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
            teacher_name: assignedTeacher?.faculty_name || '',
            college: (section.college && section.college !== 'Unassigned College' ? section.college : (course.college && course.college !== 'Unassigned College' ? course.college : ''))
          })
        }
        classSchedules.push(...splitClasses(currentSectionClasses))
      }

      setAllLoadedClasses(classSchedules)
      setUnassignedCourses(unassigned)

      // Select all sections by default
      setSelectedSectionIds(batchSections.map(s => s.id))
      setExcludedCourseKeys(new Set())

      // Auto-fill semester and academic year from batch
      if (batch) {
        setConfig(prev => ({
          ...prev,
          semester: batch.year_batch.includes('First') || batch.year_batch.includes('1st') ? 'First Semester' :
            batch.year_batch.includes('Second') || batch.year_batch.includes('2nd') ? 'Second Semester' :
              batch.year_batch.includes('Summer') ? 'Summer' : prev.semester,
          academicYear: batch.academic_year || prev.academicYear
        }))
      }
    } catch (error) {
      console.error('Error loading class data:', error)
      setAllLoadedClasses([])
      setCourses([])
      setUnassignedCourses([])
    }
  }

  // Load class data with explicit semester filter (called when user changes semester in Step 3)
  const loadClassDataWithSemester = async (yearBatchId: number, selectedSemester: string, collegeFilter?: string) => {
    try {
      let batchSections = sections.filter(s => s.year_batch_id === yearBatchId)

      // Filter by college if specified
      if (collegeFilter && collegeFilter !== 'all') {
        batchSections = batchSections.filter(s => s.college === collegeFilter || !s.college)
      }

      if (batchSections.length === 0) {
        setAllLoadedClasses([])
        setCourses([])
        setUnassignedCourses([])
        return
      }

      // Get all course assignments for these sections
      const { data: assignments, error: assignmentsError } = await (supabase
        .from('section_course_assignments') as any)
        .select('*')
        .in('section_id', batchSections.map(s => s.id))

      if (assignmentsError) {
        console.error('Error fetching assignments:', assignmentsError)
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
        return
      }

      // Filter courses by the selected semester
      const filteredCourses = (coursesData || []).filter((c: any) => {
        const courseSem = (c.semester || '').toLowerCase()
        const targetSemLower = selectedSemester.toLowerCase()

        // Match various semester formats
        if (targetSemLower.includes('first') || targetSemLower.includes('1st')) {
          return courseSem.includes('1st') || courseSem.includes('first') || courseSem === '1'
        } else if (targetSemLower.includes('second') || targetSemLower.includes('2nd')) {
          return courseSem.includes('2nd') || courseSem.includes('second') || courseSem === '2'
        } else if (targetSemLower.includes('summer')) {
          return courseSem.includes('summer')
        }
        return true
      })

      setCourses(filteredCourses)

      // Fetch teaching loads
      const courseCodes = [...new Set(filteredCourses.map((c: any) => c.course_code).filter(Boolean))]
      const { data: teachingLoads } = await (supabase
        .from('teaching_loads') as any)
        .select('*, faculty_profiles(*), class_schedules:course_id(course_code)')

      // Filter teaching loads to only those matching our course codes
      const filteredTeachingLoads = teachingLoads
        ? teachingLoads.filter((load: any) => {
            const loadCourseCode = String(load?.class_schedules?.course_code || '').trim().toUpperCase()
            return courseCodes.some(code => String(code || '').trim().toUpperCase() === loadCourseCode)
          })
        : []

      const teachingLoadsMap = buildTeachingLoadsCandidatesMap(filteredTeachingLoads)

      // Build class schedules
      const classSchedules: ClassSchedule[] = []
      const unassigned: typeof unassignedCourses = []
      let autoId = 1

      for (const section of batchSections) {
        const sectionAssignments = assignments.filter((a: any) => a.section_id === section.id)
        const sectionCourses = filteredCourses.filter((c: any) =>
          sectionAssignments.some((a: any) => a.course_id === c.id)
        )

        for (const course of sectionCourses) {
          const assignedTeacher = resolveTeachingLoadCandidate(
            teachingLoadsMap,
            Number(course.id),
            section.section_name || '',
            section.college || course.college,
            course.course_code
          )

          if (!assignedTeacher) {
            unassigned.push({
              course_code: course.course_code || '',
              course_name: course.course_name || '',
              section: section.section_name || '',
              semester: course.semester || selectedSemester,
              department: course.department || section.department || ''
            })
          }

          classSchedules.push({
            id: autoId++,
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
            teacher_name: assignedTeacher?.faculty_name || '',
            college: (section.college && section.college !== 'Unassigned College' ? section.college : (course.college && course.college !== 'Unassigned College' ? course.college : ''))
          })
        }
      }

      setAllLoadedClasses(classSchedules)
      setUnassignedCourses(unassigned)
    } catch (error) {
      console.error('Error loading class data with semester:', error)
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
        await loadMultipleCampusData(newSelected, selectedCollege)
      } else {
        setRooms([])
        setSelectedBuildings([])
        setSelectedRooms([])
      }
    } else {
      // Add to selection
      const newSelected = [...selectedCampusGroups, groupId]
      setSelectedCampusGroups(newSelected)
      await loadMultipleCampusData(newSelected, selectedCollege)
      setSelectedBuildings([])
      setSelectedRooms([])
    }
  }

  // Load rooms from multiple campus groups
  const loadMultipleCampusData = async (groupIds: number[], collegeFilter?: string) => {
    const allRooms: CampusRoom[] = []

    for (const groupId of groupIds) {
      const { data, error } = await (supabase
        .from('campuses') as any)
        .select('*')
        .eq('upload_group_id', groupId)
        .order('campus', { ascending: true })
        .order('building', { ascending: true })

      if (!error && data) {
        // Filter by college if specified
        let filteredData = data
        if (collegeFilter && collegeFilter !== 'all') {
          filteredData = data.filter((r: any) =>
            r.college === collegeFilter ||
            r.college === 'Shared' ||
            !r.college // Include rooms without college (legacy data)
          )
        }
        // Exclude unusable rooms
        filteredData = filteredData.filter((r: any) => {
          const status = (r.status || '').toLowerCase()
          return status !== 'not_usable' && status !== 'unavailable' && status !== 'inactive'
        })

        const mappedRooms = filteredData.map((r: any) => ({
          id: r.id,
          campus: r.campus || '',
          building: r.building || '',
          room: r.room || '',
          capacity: r.capacity || 30,
          room_type: r.room_type || 'Classroom',
          floor_number: r.floor_number || 1,
          has_ac: r.has_ac || false,
          has_projector: r.has_projector || false,
          is_pwd_accessible: r.is_pwd_accessible || r.is_first_floor || false,
          college: r.college || null
        }))

        // Fetch feature tags for these rooms
        if (mappedRooms.length > 0) {
          const roomIds = mappedRooms.map((r: any) => r.id)
          const { data: featureData } = await supabase
            .from('room_features')
            .select('room_id, feature_tags(tag_name)')
            .in('room_id', roomIds)

          const featureMap = new Map<number, string[]>()
          if (featureData) {
            featureData.forEach((f: any) => {
              if (!featureMap.has(f.room_id)) featureMap.set(f.room_id, [])
              if (f.feature_tags?.tag_name) featureMap.get(f.room_id)!.push(f.feature_tags.tag_name)
            })
          }

          mappedRooms.forEach((r: any) => {
            r.feature_tags = featureMap.get(r.id) || []
          })
        }

        allRooms.push(...mappedRooms)
      }
    }

    setRooms(allRooms)
  }

  const handleSelectClassGroup = async (batchId: number) => {
    if (selectedYearBatches.includes(batchId)) {
      // Deselect - remove from array
      const newSelected = selectedYearBatches.filter(id => id !== batchId)
      setSelectedYearBatches(newSelected)
      setSelectedSectionIds([])
      setExcludedCourseKeys(new Set())

      if (newSelected.length > 0) {
        await loadMultipleClassData(newSelected, selectedCollege)
      } else {
        setAllLoadedClasses([])
        setCourses([])
        setUnassignedCourses([])
      }
    } else {
      // Add to selection
      const newSelected = [...selectedYearBatches, batchId]
      setSelectedYearBatches(newSelected)
      setSelectedSectionIds([])
      setExcludedCourseKeys(new Set())
      await loadMultipleClassData(newSelected, selectedCollege)
    }
  }

  // Load class data from multiple year batches
  const loadMultipleClassData = async (yearBatchIds: number[], collegeFilter?: string) => {
    try {
      const allClassSchedules: ClassSchedule[] = []
      const allCoursesList: SectionCourse[] = []
      const allUnassigned: typeof unassignedCourses = []
      let autoId = 1

      for (const yearBatchId of yearBatchIds) {
        let batchSections = sections.filter(s => s.year_batch_id === yearBatchId)
        if (collegeFilter && collegeFilter !== 'all') {
          batchSections = batchSections.filter(s => s.college === collegeFilter || !s.college)
        }
        if (batchSections.length === 0) continue

        const batch = yearBatches.find(b => b.id === yearBatchId)
        let targetSemester = ''
        if (batch) {
          if (batch.year_batch.toLowerCase().includes('first') || batch.year_batch.includes('1st')) targetSemester = '1st Semester'
          else if (batch.year_batch.toLowerCase().includes('second') || batch.year_batch.includes('2nd')) targetSemester = '2nd Semester'
          else if (batch.year_batch.toLowerCase().includes('summer')) targetSemester = 'Summer'
        }

        const { data: assignments, error: assignmentsError } = await (supabase
          .from('section_course_assignments') as any)
          .select('*')
          .in('section_id', batchSections.map(s => s.id))
        if (assignmentsError) continue

        const courseIds = assignments.map((a: any) => a.course_id)
        if (courseIds.length === 0) continue
        const { data: coursesData, error: coursesError } = await (supabase
          .from('class_schedules') as any)
          .select('*')
          .in('id', courseIds)
        if (coursesError) continue

        let filteredCourses = coursesData || []
        if (targetSemester) {
          filteredCourses = filteredCourses.filter((c: any) => {
            const courseSem = (c.semester || '').toLowerCase()
            const targetSemLower = targetSemester.toLowerCase()
            if (targetSemLower.includes('1st') || targetSemLower.includes('first')) {
              return courseSem.includes('1st') || courseSem.includes('first') || courseSem === '1'
            } else if (targetSemLower.includes('2nd') || targetSemLower.includes('second')) {
              return courseSem.includes('2nd') || courseSem.includes('second') || courseSem === '2'
            } else if (targetSemLower.includes('summer')) {
              return courseSem.includes('summer')
            }
            return true
          })
        }
        allCoursesList.push(...filteredCourses)

        const courseCodes = [...new Set(filteredCourses.map((c: any) => c.course_code).filter(Boolean))]
        const { data: teachingLoads } = await (supabase
          .from('teaching_loads') as any)
          .select('*, faculty_profiles(*), class_schedules:course_id(course_code)')
        const filteredTeachingLoads = teachingLoads
          ? teachingLoads.filter((load: any) => {
              const loadCourseCode = String(load?.class_schedules?.course_code || '').trim().toUpperCase()
              return courseCodes.some(code => String(code || '').trim().toUpperCase() === loadCourseCode)
            })
          : []
        const teachingLoadsMap = buildTeachingLoadsCandidatesMap(filteredTeachingLoads)

        // Fetch course requirements
        const { data: reqData } = await supabase
          .from('subject_room_requirements')
          .select('course_id, notes, feature_tags(tag_name)')
          .in('course_id', filteredCourses.map((c: any) => c.id))

        const reqMap = new Map<number, { all: string[], lec: string[], lab: string[] }>()
        if (reqData) {
          reqData.forEach((r: any) => {
            if (!reqMap.has(r.course_id)) reqMap.set(r.course_id, { all: [], lec: [], lab: [] })
            if (r.feature_tags?.tag_name) {
              const tag = r.feature_tags.tag_name
              const note = (r.notes || '').toUpperCase()
              const mapEntry = reqMap.get(r.course_id)!
              mapEntry.all.push(tag)
              if (note === 'LEC') mapEntry.lec.push(tag)
              else if (note === 'LAB') mapEntry.lab.push(tag)
              // Neutral requirements are only added to 'all', not explicitly to lec/lab
            }
          })
        }

        // Helper to split hybrid classes into G1/G2 if room capacity is exceeded
        const splitClasses = (classList: ClassSchedule[]): ClassSchedule[] => {
          if (!config.allowG1G2SplitSessions) return classList

          const extractCollegeKey = (value?: string) => {
            const raw = (value || '').trim().toUpperCase()
            if (!raw) return ''
            const abbr = raw.match(/\(([^)]+)\)\s*$/)?.[1]?.trim().toUpperCase()
            return abbr || raw
          }

          const result: ClassSchedule[] = []
          classList.forEach(c => {
            // Determine appropriate max capacity for this specific class type
            const isLabComponent = c.lab_hours > 0 || c.component === 'LAB'
            const targetRoomType = isLabComponent ? 'lab' : 'lecture'

            const requiredFeatures = new Set<string>(
              isLabComponent
                ? ((c.required_lab_features && c.required_lab_features.length > 0)
                  ? c.required_lab_features
                  : (c.required_features || []))
                : ((c.required_lec_features && c.required_lec_features.length > 0)
                  ? c.required_lec_features
                  : (c.required_features || []))
            )
            const cCollege = extractCollegeKey(c.college || '')

            // Find rooms compatible with this class's college and required type
            const compatibleRooms = rooms.filter(r => {
              const rType = (r.room_type || '').toLowerCase()
              const rCollege = extractCollegeKey(r.college || '')

              const typeMatch = rType.includes(targetRoomType) || (targetRoomType === 'lab' && rType.includes('computer'))
              const collegeMatch = !config.collegeRoomMatchingEnabled || !rCollege || rCollege === 'SHARED' || !cCollege || rCollege === cCollege

              const roomFeatures = new Set<string>((r.feature_tags || []) as string[])
              const featureMatch = requiredFeatures.size === 0 || Array.from(requiredFeatures).every(f => roomFeatures.has(f))

              return typeMatch && collegeMatch && featureMatch
            })

            // Determine threshold: use actual max compatible room capacity, but capped at reasonable defaults 
            // to ensure pedagogical quality (e.g. don't put 60 students in one lab even if room fits)
            const maxCap = compatibleRooms.length > 0
              ? Math.max(...compatibleRooms.map(r => r.capacity || 0))
              : (isLabComponent ? 30 : 50)

            // Make splitting MORE STRICT: 
            // 1. If Lab and > 40 students, split (standard pedagogical limit)
            // 2. If Class size > max available room capacity of that type
            const needsSplit = (isLabComponent && (c.student_count > 40 || c.student_count > maxCap)) ||
              (!isLabComponent && c.student_count > maxCap)

            if (needsSplit) {
              console.log(`👥 Strictly splitting section ${c.section} (${c.course_code}) because student count ${c.student_count} > max capacity ${maxCap}`)
              // Split into shared LEC and G1/G2 LABs
              if (c.lec_hours > 0) {
                result.push({
                  ...c,
                  id: autoId++,
                  lab_hours: 0,
                  total_hours: c.lec_hours,
                  component: 'LEC'
                })
              }

              const g1Count = Math.ceil(c.student_count / 2)
              const g2Count = Math.floor(c.student_count / 2)

              result.push({
                ...c,
                id: autoId++,
                section: `${c.section} G1`,
                lec_hours: 0,
                student_count: g1Count,
                total_hours: c.lab_hours,
                component: 'LAB',
                is_split_group: true,
                split_type: 'G1'
              })

              result.push({
                ...c,
                id: autoId++,
                section: `${c.section} G2`,
                lec_hours: 0,
                student_count: g2Count,
                total_hours: c.lab_hours,
                component: 'LAB',
                is_split_group: true,
                split_type: 'G2'
              })
            } else {
              result.push(c)
            }
          })
          return result
        }

        for (const section of batchSections) {
          const sectionAssignments = assignments.filter((a: any) => a.section_id === section.id)
          const sectionCourses = filteredCourses.filter((c: any) => sectionAssignments.some((a: any) => a.course_id === c.id))

          const currentSectionClasses: ClassSchedule[] = []
          for (const course of sectionCourses) {
            const courseId = course.id
            const assignedTeacher = resolveTeachingLoadCandidate(
              teachingLoadsMap,
              Number(course.id),
              section.section_name || '',
              section.college || course.college,
              course.course_code
            )
            if (!assignedTeacher) {
              allUnassigned.push({
                course_code: course.course_code || '',
                course_name: course.course_name || '',
                section: section.section_name || '',
                semester: course.semester || targetSemester || '',
                department: course.department || section.department || ''
              })
            }
            currentSectionClasses.push({
              id: autoId++,
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
              teacher_name: assignedTeacher?.faculty_name || '',
              course_id: course.id,
              required_features: reqMap.get(courseId)?.all || [],
              required_lec_features: reqMap.get(courseId)?.lec || [],
              required_lab_features: reqMap.get(courseId)?.lab || [],
              component: (course.lec_hours > 0 && course.lab_hours > 0) ? 'COMBINED' :
                (course.lab_hours > 0) ? 'LAB' : 'LEC',
              college: (section.college && section.college !== 'Unassigned College' ? section.college : (course.college && course.college !== 'Unassigned College' ? course.college : ''))
            })
          }
          allClassSchedules.push(...splitClasses(currentSectionClasses))
        }
      }

      // Deduplicate courses
      const uniqueCourses = allCoursesList.filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i)
      setCourses(uniqueCourses)
      setAllLoadedClasses(allClassSchedules)
      setUnassignedCourses(allUnassigned)

      // Select all sections from all batches by default
      const allBatchSections = sections.filter(s => yearBatchIds.includes(s.year_batch_id))
      setSelectedSectionIds(allBatchSections.map(s => s.id))
      setExcludedCourseKeys(new Set())

      // Auto-fill semester and academic year from first batch
      const firstBatch = yearBatches.find(b => b.id === yearBatchIds[0])
      if (firstBatch) {
        setConfig(prev => ({
          ...prev,
          semester: firstBatch.year_batch.includes('First') || firstBatch.year_batch.includes('1st') ? 'First Semester' :
            firstBatch.year_batch.includes('Second') || firstBatch.year_batch.includes('2nd') ? 'Second Semester' :
              firstBatch.year_batch.includes('Summer') ? 'Summer' : prev.semester,
          academicYear: firstBatch.academic_year || prev.academicYear
        }))
      }
    } catch (error) {
      console.error('Error loading multiple class data:', error)
    }
  }


  // Load class data from multiple year batches with explicit semester filter
  const loadMultipleClassDataWithSemester = async (yearBatchIds: number[], selectedSemester: string, collegeFilter?: string) => {
    try {
      const allClassSchedules: ClassSchedule[] = []
      const allCoursesList: SectionCourse[] = []
      const allUnassigned: typeof unassignedCourses = []
      let autoId = 1

      for (const yearBatchId of yearBatchIds) {
        let batchSections = sections.filter(s => s.year_batch_id === yearBatchId)
        if (collegeFilter && collegeFilter !== 'all') {
          batchSections = batchSections.filter(s => s.college === collegeFilter || !s.college)
        }
        if (batchSections.length === 0) continue

        const { data: assignments, error: assignmentsError } = await (supabase
          .from('section_course_assignments') as any)
          .select('*')
          .in('section_id', batchSections.map(s => s.id))
        if (assignmentsError) continue

        const courseIds = assignments.map((a: any) => a.course_id)
        if (courseIds.length === 0) continue
        const { data: coursesData, error: coursesError } = await (supabase
          .from('class_schedules') as any)
          .select('*')
          .in('id', courseIds)
        if (coursesError) continue

        const filteredCourses = (coursesData || []).filter((c: any) => {
          const courseSem = (c.semester || '').toLowerCase()
          const targetSemLower = selectedSemester.toLowerCase()
          if (targetSemLower.includes('first') || targetSemLower.includes('1st')) {
            return courseSem.includes('1st') || courseSem.includes('first') || courseSem === '1'
          } else if (targetSemLower.includes('second') || targetSemLower.includes('2nd')) {
            return courseSem.includes('2nd') || courseSem.includes('second') || courseSem === '2'
          } else if (targetSemLower.includes('summer')) {
            return courseSem.includes('summer')
          }
          return true
        })
        allCoursesList.push(...filteredCourses)

        const courseCodes = [...new Set(filteredCourses.map((c: any) => c.course_code).filter(Boolean))]
        const { data: teachingLoads } = await (supabase
          .from('teaching_loads') as any)
          .select('*, faculty_profiles(*), class_schedules:course_id(course_code)')
        const filteredTeachingLoads = teachingLoads
          ? teachingLoads.filter((load: any) => {
              const loadCourseCode = String(load?.class_schedules?.course_code || '').trim().toUpperCase()
              return courseCodes.some(code => String(code || '').trim().toUpperCase() === loadCourseCode)
            })
          : []
        const teachingLoadsMap = buildTeachingLoadsCandidatesMap(filteredTeachingLoads)

        // Fetch course requirements
        const { data: reqData } = await supabase
          .from('subject_room_requirements')
          .select('course_id, notes, feature_tags(tag_name)')
          .in('course_id', filteredCourses.map((c: any) => c.id))

        const reqMap = new Map<number, { all: string[], lec: string[], lab: string[] }>()
        if (reqData) {
          reqData.forEach((r: any) => {
            if (!reqMap.has(r.course_id)) reqMap.set(r.course_id, { all: [], lec: [], lab: [] })
            if (r.feature_tags?.tag_name) {
              const tag = r.feature_tags.tag_name
              const note = (r.notes || '').toUpperCase()
              const mapEntry = reqMap.get(r.course_id)!
              mapEntry.all.push(tag)
              if (note === 'LEC') mapEntry.lec.push(tag)
              else if (note === 'LAB') mapEntry.lab.push(tag)
              // Neutral requirements are only added to 'all', not explicitly to lec/lab
            }
          })
        }

        // Helper to split hybrid classes into G1/G2 if lab capacity is exceeded
        const splitClasses = (classList: ClassSchedule[]): ClassSchedule[] => {
          if (!config.allowG1G2SplitSessions) return classList

          const extractCollegeKey = (value?: string) => {
            const raw = (value || '').trim().toUpperCase()
            if (!raw) return ''
            const abbr = raw.match(/\(([^)]+)\)\s*$/)?.[1]?.trim().toUpperCase()
            return abbr || raw
          }

          const result: ClassSchedule[] = []
          classList.forEach(c => {
            // Determine appropriate max capacity for this specific class type
            const isLabComponent = c.lab_hours > 0 || c.component === 'LAB'
            const targetRoomType = isLabComponent ? 'lab' : 'lecture'

            const requiredFeatures = new Set<string>(
              isLabComponent
                ? ((c.required_lab_features && c.required_lab_features.length > 0)
                  ? c.required_lab_features
                  : (c.required_features || []))
                : ((c.required_lec_features && c.required_lec_features.length > 0)
                  ? c.required_lec_features
                  : (c.required_features || []))
            )
            const cCollege = extractCollegeKey(c.college || '')

            // Find rooms compatible with this class's college and required type
            const compatibleRooms = rooms.filter(r => {
              const rType = (r.room_type || '').toLowerCase()
              const rCollege = extractCollegeKey(r.college || '')

              const typeMatch = rType.includes(targetRoomType) || (targetRoomType === 'lab' && rType.includes('computer'))
              const collegeMatch = !config.collegeRoomMatchingEnabled || !rCollege || rCollege === 'SHARED' || !cCollege || rCollege === cCollege

              const roomFeatures = new Set<string>((r.feature_tags || []) as string[])
              const featureMatch = requiredFeatures.size === 0 || Array.from(requiredFeatures).every(f => roomFeatures.has(f))

              return typeMatch && collegeMatch && featureMatch
            })

            // Determine threshold: use actual max compatible room capacity, but capped at reasonable defaults 
            // to ensure pedagogical quality (e.g. don't put 60 students in one lab even if room fits)
            const maxCap = compatibleRooms.length > 0
              ? Math.max(...compatibleRooms.map(r => r.capacity || 0))
              : (isLabComponent ? 30 : 50)

            // Make splitting MORE STRICT: 
            // 1. If Lab and > 40 students, split (standard pedagogical limit)
            // 2. If Class size > max available room capacity of that type
            const needsSplit = (isLabComponent && (c.student_count > 40 || c.student_count > maxCap)) ||
              (!isLabComponent && c.student_count > maxCap)

            if (needsSplit) {
              console.log(`👥 Strictly splitting section ${c.section} (${c.course_code}) because student count ${c.student_count} > max capacity ${maxCap}`)
              // Split into shared LEC and G1/G2 LABs
              if (c.lec_hours > 0) {
                result.push({
                  ...c,
                  id: autoId++,
                  lab_hours: 0,
                  total_hours: c.lec_hours,
                  component: 'LEC'
                })
              }

              const g1Count = Math.ceil(c.student_count / 2)
              const g2Count = Math.floor(c.student_count / 2)

              result.push({
                ...c,
                id: autoId++,
                section: `${c.section} G1`,
                lec_hours: 0,
                student_count: g1Count,
                total_hours: c.lab_hours,
                component: 'LAB',
                is_split_group: true,
                split_type: 'G1'
              })

              result.push({
                ...c,
                id: autoId++,
                section: `${c.section} G2`,
                lec_hours: 0,
                student_count: g2Count,
                total_hours: c.lab_hours,
                component: 'LAB',
                is_split_group: true,
                split_type: 'G2'
              })
            } else {
              result.push(c)
            }
          })
          return result
        }

        for (const section of batchSections) {
          const sectionAssignments = assignments.filter((a: any) => a.section_id === section.id)
          const sectionCourses = filteredCourses.filter((c: any) => sectionAssignments.some((a: any) => a.course_id === c.id))

          const currentSectionClasses: ClassSchedule[] = []
          for (const course of sectionCourses) {
            const courseId = course.id
            const assignedTeacher = resolveTeachingLoadCandidate(
              teachingLoadsMap,
              Number(course.id),
              section.section_name || '',
              section.college || course.college,
              course.course_code
            )
            if (!assignedTeacher) {
              allUnassigned.push({
                course_code: course.course_code || '',
                course_name: course.course_name || '',
                section: section.section_name || '',
                semester: course.semester || selectedSemester,
                department: course.department || section.department || ''
              })
            }
            currentSectionClasses.push({
              id: autoId++,
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
              teacher_name: assignedTeacher?.faculty_name || '',
              course_id: course.id,
              required_features: reqMap.get(courseId)?.all || [],
              required_lec_features: reqMap.get(courseId)?.lec || [],
              required_lab_features: reqMap.get(courseId)?.lab || [],
              component: (course.lec_hours > 0 && course.lab_hours > 0) ? 'COMBINED' :
                (course.lab_hours > 0) ? 'LAB' : 'LEC',
              college: (section.college && section.college !== 'Unassigned College' ? section.college : (course.college && course.college !== 'Unassigned College' ? course.college : ''))
            })
          }
          allClassSchedules.push(...splitClasses(currentSectionClasses))
        }
      }

      const uniqueCourses = allCoursesList.filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i)
      setCourses(uniqueCourses)
      setAllLoadedClasses(allClassSchedules)
      setUnassignedCourses(allUnassigned)

      const allBatchSections = sections.filter(s => yearBatchIds.includes(s.year_batch_id))
      setSelectedSectionIds(allBatchSections.map(s => s.id))
      setExcludedCourseKeys(new Set())
    } catch (error) {
      console.error('Error loading multiple class data with semester:', error)
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
  const canProceedToStep2 = selectedCampusGroups.length > 0 && selectedYearBatches.length > 0
  const canProceedToStep3 = canProceedToStep2 && rooms.length > 0 && classes.length > 0
  const canGenerate = canProceedToStep3 && config.scheduleName.trim() !== ''

  // Get selected group info - for multiple groups, show combined info
  const selectedCampusInfoList = campusGroups.filter(g => selectedCampusGroups.includes(g.upload_group_id))
  const selectedBatchInfoList = yearBatches.filter(b => selectedYearBatches.includes(b.id))
  const selectedBatchInfo = selectedBatchInfoList.length > 0 ? selectedBatchInfoList[0] : undefined
  const selectedTeacherInfo = undefined
  const selectedCampusFileNames = selectedCampusInfoList
    .map(group => group.file_name)
    .filter((name): name is string => Boolean(name && name.trim()))

  // Calculate stats
  const filteredRoomsPreview = getFilteredRooms()
  const totalRoomCapacity = rooms.reduce((sum, r) => sum + r.capacity, 0)
  const totalFilteredRoomCapacity = filteredRoomsPreview.reduce((sum, r) => sum + (r.capacity || 0), 0)
  const totalClasses = classes.length
  const selectedSectionsForEstimate = useMemo(() => {
    if (selectedYearBatches.length === 0) return [] as Section[]

    let scopedSections = sections.filter(s => selectedYearBatches.includes(s.year_batch_id))

    if (selectedCollege !== 'all') {
      scopedSections = scopedSections.filter(s => (s.college || '') === selectedCollege || !s.college)
    }

    if (selectedSectionIds.length > 0) {
      scopedSections = scopedSections.filter(s => selectedSectionIds.includes(s.id))
    }

    return scopedSections
  }, [sections, selectedYearBatches, selectedCollege, selectedSectionIds])

  const collegeCapacityEstimates = useMemo(() => {
    const normalizeCapacityCollegeKey = (value?: string | null) => {
      const normalized = normalizeCollegeKey(value)
      if (!normalized) return 'UNASSIGNED'
      return normalized
    }

    const sectionStats = new Map<string, { label: string; sections: number; students: number }>()
    selectedSectionsForEstimate.forEach(section => {
      const key = normalizeCapacityCollegeKey(section.college)
      const current = sectionStats.get(key) || {
        label: (section.college || '').trim() || (key === 'UNASSIGNED' ? 'Unassigned College' : key),
        sections: 0,
        students: 0,
      }
      current.sections += 1
      current.students += Number(section.student_count || 0)
      if (!current.label || current.label === key) {
        current.label = (section.college || '').trim() || current.label
      }
      sectionStats.set(key, current)
    })

    const dedicatedSeatsByCollege = new Map<string, number>()
    let sharedSeatsPool = 0

    filteredRoomsPreview.forEach(room => {
      const seats = Number(room.capacity || 0)
      const roomCollegeKey = normalizeCapacityCollegeKey(room.college)
      const isSharedRoom = roomCollegeKey === 'SHARED' || roomCollegeKey === 'UNASSIGNED'
      if (isSharedRoom) {
        sharedSeatsPool += seats
      } else {
        dedicatedSeatsByCollege.set(
          roomCollegeKey,
          (dedicatedSeatsByCollege.get(roomCollegeKey) || 0) + seats
        )
      }
    })

    const estimates: CollegeCapacityEstimate[] = Array.from(sectionStats.entries()).map(([collegeKey, stat]) => {
      const dedicatedSeats = dedicatedSeatsByCollege.get(collegeKey) || 0
      const availableSeats = dedicatedSeats + sharedSeatsPool
      const seatCoverage = stat.students > 0 ? (availableSeats / stat.students) * 100 : 100
      const level = getCapacityEstimateLevel(availableSeats, stat.students)

      return {
        collegeKey,
        collegeLabel: stat.label,
        sectionCount: stat.sections,
        students: stat.students,
        dedicatedSeats,
        sharedSeats: sharedSeatsPool,
        availableSeats,
        seatCoverage,
        level,
      }
    })

    const severityRank: Record<CapacityEstimateLevel, number> = {
      impossible: 0,
      warning: 1,
      good: 2,
    }

    return estimates.sort((a, b) => {
      if (severityRank[a.level] !== severityRank[b.level]) return severityRank[a.level] - severityRank[b.level]
      return a.collegeLabel.localeCompare(b.collegeLabel)
    })
  }, [selectedSectionsForEstimate, filteredRoomsPreview])

  const totalEstimatedStudents = selectedSectionsForEstimate.reduce(
    (sum, section) => sum + Number(section.student_count || 0),
    0
  )

  const overallCapacityLevel = getCapacityEstimateLevel(totalFilteredRoomCapacity, totalEstimatedStudents)
  const uniqueSectionsCount = new Set(classes.map(c => c.section).filter(Boolean)).size
  const scheduledColleges = [...new Set(classes.map(c => c.college).filter(Boolean))].sort()
  const scheduledCollegesLabel = scheduledColleges.length > 0
    ? scheduledColleges.join(', ')
    : (selectedCollege === 'all' ? 'All Colleges (No explicit college tags in class data)' : selectedCollege)
  const assignedTeacherCount = new Set(classes.map(c => c.teacher_name).filter(Boolean)).size
  const activeDaysPreview = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  if (timeSettings.includeSaturday) activeDaysPreview.push('Saturday')
  if (timeSettings.includeSunday) activeDaysPreview.push('Sunday')
  const uniqueDays = [...new Set(classes.map(c => c.schedule_day).filter(Boolean))]
  const uniqueTimeSlots = [...new Set(classes.map(c => c.schedule_time).filter(Boolean))]

  // Generate schedule
  const handleGenerateSchedule = async () => {
    if (isScheduling || isSubmittingGeneration) {
      return
    }

    if (!canGenerate) {
      toast.warning('Incomplete Selection', {
        description: 'Please complete all required selections before generating.',
      })
      return
    }

    // Check for unassigned courses (without teachers)
    if (unassignedCourses.length > 0 && !bypassTeacherCheck) {
      setShowUnassignedWarning(true)
      return
    }

    await executeScheduleGeneration()
  }

  const openGenerateReviewModal = () => {
    if (isScheduling || isSubmittingGeneration) {
      return
    }

    if (!canGenerate) {
      toast.warning('Incomplete Selection', {
        description: 'Please complete all required selections before generating.',
      })
      return
    }

    setShowGenerateReview(true)
  }

  const confirmAndGenerateSchedule = async () => {
    setShowGenerateReview(false)
    await handleGenerateSchedule()
  }

  // Proceed with schedule generation after bypass confirmation
  const executeScheduleGeneration = async () => {
    if (isScheduling || isSubmittingGeneration) {
      return
    }

    setIsSubmittingGeneration(true)
    setShowUnassignedWarning(false)
    setShowResults(false)

    try {
      // Get filtered rooms based on user selection
      const filteredRooms = getFilteredRooms()

      if (filteredRooms.length === 0) {
        toast.error('No Rooms Selected', {
          description: 'Please select at least one building or room.',
        })
        resetScheduling()
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
        year_batch_id: selectedYearBatches[0] || null,
        year_batch_ids: selectedYearBatches,
        teacher_group_id: null,
        college: selectedCollege, // College filter for scheduling
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
          max_consecutive_hours: config.maxConsecutiveHours,
          avoid_conflicts: config.avoidConflicts,
          online_days: config.onlineDays,
          college: selectedCollege, // College constraint for backend
          lunch_mode: config.lunchMode,
          lunch_start_hour: config.lunchStartHour,
          lunch_end_hour: config.lunchEndHour,
          strict_lab_room_matching: config.strictLabRoomMatching,
          strict_lecture_room_matching: config.strictLectureRoomMatching,
          allow_split_sessions: config.allowSplitSessions,
          college_room_matching_enabled: config.collegeRoomMatchingEnabled,
          allow_g1_g2_split_sessions: config.allowG1G2SplitSessions,
          enforce_g1_g2_equal_hours: config.enforceG1G2EqualHours,
          // Soft Penalties
          SOFT_ROOM_TYPE_MISMATCH: config.softRoomTypeMismatch,
          SOFT_ROOM_TYPE_MAJOR_MISMATCH: config.softRoomTypeMajorMismatch,
          SOFT_CAPACITY_WASTE: config.softCapacityWaste,
          SOFT_LUNCH_OVERLAP: config.softLunchOverlap,
          SOFT_TEACHER_OVERLOAD: config.softTeacherOverload,
          SOFT_ACCESSIBILITY_BONUS: config.softAccessibilityBonus,
          SOFT_MORNING_PREFERENCE: config.softMorningPreference,
          SOFT_DAY_DISTRIBUTION: config.softDayDistribution,
          SOFT_SIBLING_DIFFERENT_DAY: config.softSiblingDifferentDay,
          SOFT_OVERLOADED_TEACHER: config.softOverloadedTeacher,
          SOFT_TEACHER_NO_BREAK: config.softTeacherNoBreak,
          SOFT_CONSECUTIVE_HOURS_EXCEEDED: config.softConsecutiveHoursExceeded,
          SOFT_FACULTY_IDLE_TIME: config.softFacultyIdleTime,
          SOFT_FACULTY_LONG_GAP_2H: config.softFacultyLongGap2h,
          SOFT_FACULTY_LONG_GAP_3H: config.softFacultyLongGap3h,
          SOFT_FACULTY_LONG_GAP_4H: config.softFacultyLongGap4h,
          SOFT_LOAD_IMBALANCE: config.softLoadImbalance,
          SOFT_LATE_CLASS: config.softLateClass,
          SOFT_ROOM_IDLE_GAP: config.softRoomIdleGap,
          SOFT_UNEVEN_SECTION_DIST: config.softUnevenSectionDist,
          SOFT_CONSECUTIVE_DAY_PENALTY: config.softConsecutiveDayPenalty,
          SOFT_SECTION_GAP: config.softSectionGap,
          SOFT_FACULTY_NIGHT_CLASS: config.softFacultyNightClass,
          SOFT_FACULTY_DAILY_SPAN: config.softFacultyDailySpan,
          SOFT_VSL_SHIFT_MISMATCH: config.softVslShiftMismatch,
          SOFT_PART_TIME_SATURDAY: config.softPartTimeSaturday,
        },
        backend_preference: backendPreference,
        manual_allocations: manualAllocations // NEW: Manual edits to prioritize
      }

      console.log('[GenerateSchedule] Sending to Python backend:', JSON.stringify({
        rooms: filteredRooms.length,
        classes: classes.length,
        teachers: [],
        timeSlots: timeSlots.length,
        activeDays,
        onlineDays: config.onlineDays
      }, null, 2))

      const queueSnapshot = await pollQueueStatus(true)

      const likelyQueued = Boolean(queueSnapshot.available && queueSnapshot.active)
      if (likelyQueued) {
        setGenerationPhase('queued')
        setEstimatedQueuePosition(Math.max(1, queueSnapshot.waitingCount + 1))
      } else {
        setGenerationPhase('generating')
        setEstimatedQueuePosition(null)
      }

      startScheduling(scheduleData)

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
        // First get the response as text, then try to parse as JSON
        const responseText = await response.text()
        let errorMsg = 'Failed to generate schedule'
        let backendStatus: number | undefined = response.status
        let backendResponseMs: number | undefined

        try {
          const errorData = JSON.parse(responseText)
          // Handle error - could be string, object, or array
          if (typeof errorData.error === 'string') {
            errorMsg = errorData.error
          } else if (errorData.error) {
            errorMsg = JSON.stringify(errorData.error)
          } else if (errorData.detail) {
            errorMsg = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail)
          } else if (errorData.message) {
            errorMsg = errorData.message
          }
          backendStatus = Number(errorData.backend_status || response.status)
          backendResponseMs = Number(errorData.backend_response_ms || 0) || undefined
        } catch (parseError) {
          // Response is not JSON (likely HTML error page from backend)
          console.error('Backend returned non-JSON response:', responseText.substring(0, 200))
          if (response.status === 503) {
            errorMsg = 'Python backend is unavailable. Please ensure the Render service is running.'
          } else if (response.status === 502 || response.status === 504) {
            errorMsg = 'Backend gateway error. The schedule generation timed out or the server is overloaded.'
          } else {
            errorMsg = `Server error (${response.status}): The backend returned an invalid response. Please try again.`
          }
        }

        setBackendProbe({
          checking: false,
          reachable: false,
          message: `Backend request failed: ${errorMsg}`,
          backendStatus,
          probeLatencyMs: backendResponseMs,
        })

        throw new Error(errorMsg)
      }

      // Parse successful response - also protect against invalid JSON
      let result
      try {
        const responseText = await response.text()
        result = JSON.parse(responseText)
      } catch (parseError) {
        console.error('Failed to parse successful response as JSON')
        throw new Error('The backend returned an invalid response format. Please try again.')
      }

      console.log('[GenerateSchedule] API Response:', JSON.stringify(result, null, 2))

      const executionSource = result.execution_source || 'python-backend'
      const backendReachable = result.backend_reachable !== false
      setBackendProbe({
        checking: false,
        reachable: backendReachable,
        message: executionSource === 'python-backend'
          ? 'Python backend replied and handled scheduling.'
          : 'Python backend unavailable. Fallback scheduler handled this run.',
        backendUrl: result.backend_url || null,
        backendStatus: Number(result.backend_status || 200),
        probeLatencyMs: Number(result.backend_response_ms || 0) || undefined,
        checkedAt: new Date().toISOString(),
      })

      const sourceTotalClasses = countUniqueCourseSections(classes)
      const scheduledClasses = countUniqueCourseSections(result.allocations || [])
      const totalClasses = sourceTotalClasses > 0
        ? sourceTotalClasses
        : Number(result.total_classes || classes.length || 0)
      const unscheduledClasses = Math.max(0, totalClasses - scheduledClasses)

      if (Number(result.schedule_id) > 0) {
        const { error: summarySyncError } = await (supabase
          .from('generated_schedules') as any)
          .update({
            total_classes: totalClasses,
            scheduled_classes: scheduledClasses,
            unscheduled_classes: unscheduledClasses,
          })
          .eq('id', Number(result.schedule_id))

        if (summarySyncError) {
          console.warn('Failed to sync generated schedule counts:', summarySyncError)
        }
      }

      setScheduleResult({
        success: result.success,
        scheduleId: result.schedule_id,
        savedToDatabase: result.saved_to_database || false,
        message: result.message,
        totalClasses,
        scheduledClasses,
        unscheduledClasses,
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
        physicalClassCount: result.physical_class_count || 0,
        splitSessionStats: result.split_session_stats,
        executionSource: result.execution_source,
        backendReachable: result.backend_reachable,
        backendReplied: result.backend_replied,
        backendUrl: result.backend_url,
        backendStatus: result.backend_status,
        backendResponseMs: Number(result.backend_response_ms || 0) || undefined,
        iterationClamp: result.iteration_clamp
          ? {
              requested: Number(result.iteration_clamp.requested || 0),
              applied: Number(result.iteration_clamp.applied || 0),
              cap: Number(result.iteration_clamp.cap || 0),
              wasClamped: Boolean(result.iteration_clamp.was_clamped),
            }
          : undefined,
        queueJobId: result.queue_job_id || null,
        queueInitialPosition: Number(result.queue_initial_position || 0) || 0,
        queueWaitSeconds: Number(result.queue_wait_seconds || 0) || 0,
        queuePendingAfterStart: Number(result.queue_pending_after_start || 0) || 0,
        queueMaxWaitSeconds: Number(result.queue_max_wait_seconds || 0) || 0,
      })
      setGenerationPhase('idle')
      setEstimatedQueuePosition(null)
      setShowResults(true)
      setShowTimetable(true)

      // Show success notification with details
      const scheduledCount = scheduledClasses
      const unscheduledCount = unscheduledClasses
      const hardConflictCount = Number(result.optimization_stats?.conflict_count || 0)

      if (result.success && hardConflictCount === 0 && unscheduledCount === 0) {
        // Perfect schedule - no conflicts
        toast.success('Schedule Generated Successfully!', {
          description: `${scheduledCount} classes scheduled with zero conflicts.`,
          duration: 8000,
        })
        sendBrowserNotification(
          'Schedule Complete!',
          `${scheduledCount} classes scheduled successfully with no conflicts.`,
          'success'
        )

        // Persist to database
        createSystemAlert({
          title: 'Schedule Generated Successfully',
          message: `${scheduledCount} classes successfully scheduled with zero conflicts for ${config.scheduleName}.`,
          audience: 'admin',
          severity: 'success',
          category: 'schedule_generation',
          metadata: { scheduleName: config.scheduleName, scheduledCount }
        })
      } else if (hardConflictCount > 0 || unscheduledCount > 0) {
        // Schedule has conflicts or unscheduled classes
        toast.warning('Schedule Generated with Issues', {
          description: `${scheduledCount} scheduled, ${unscheduledCount} unscheduled, ${hardConflictCount} hard conflicts detected.`,
          duration: 10000,
        })
        sendBrowserNotification(
          'Schedule Has Conflicts',
          `${scheduledCount} scheduled, ${unscheduledCount} unscheduled, ${hardConflictCount} hard conflicts. Review needed.`,
          'error'
        )

        // Persist to database
        createSystemAlert({
          title: 'Schedule Generated with Issues',
          message: `${scheduledCount} scheduled, ${unscheduledCount} unscheduled, ${hardConflictCount} hard conflicts for ${config.scheduleName}. Review needed.`,
          audience: 'admin',
          severity: 'warning',
          category: 'schedule_generation',
          metadata: { scheduleName: config.scheduleName, scheduledCount, hardConflictCount, unscheduledCount }
        })
      } else {
        toast.success('Schedule Generated', {
          description: result.message || `${scheduledCount} classes scheduled.`,
          duration: 6000,
        })
        sendBrowserNotification('Schedule Generated', `${scheduledCount} classes scheduled.`, 'success')

        createSystemAlert({
          title: 'Schedule Generated',
          message: result.message || `${scheduledCount} classes scheduled for ${config.scheduleName}.`,
          audience: 'admin',
          severity: 'success',
          category: 'schedule_generation',
          metadata: { scheduleName: config.scheduleName, scheduledCount }
        })
      }
    } catch (error: any) {
      console.error('Schedule generation failed:', error)
      const errorMessage = typeof error === 'object'
        ? (error.message || JSON.stringify(error, null, 2))
        : String(error)

      toast.error('Schedule Generation Failed', {
        description: errorMessage,
        duration: 10000,
      })
      sendBrowserNotification('Schedule Generation Failed', errorMessage, 'error')

      createSystemAlert({
        title: 'Schedule Generation Failed',
        message: errorMessage.slice(0, 200),
        audience: 'admin',
        severity: 'error',
        category: 'schedule_error'
      })
      setGenerationPhase('idle')
      setEstimatedQueuePosition(null)
      resetScheduling()
    } finally {
      setIsSubmittingGeneration(false)
      // isScheduling is handled by setScheduleResult on success
      // If we reach here after an error, we should probably reset or at least stop the spinner
      if (!isScheduling) return // Already handled
    }
  }

  // Reset and start new schedule
  const handleNewSchedule = () => {
    setShowResults(false)
    setScheduleResult(null)
    setManualAllocations([])
    setConfig(prev => ({ ...prev, scheduleName: '' }))
    goToStep(1)
  }

  // Reset penalties to default values
  const resetPenalties = () => {
    setConfig(prev => ({
      ...prev,
      softRoomTypeMismatch: 50,
      softRoomTypeMajorMismatch: 500,
      softCapacityWaste: 15,
      softLunchOverlap: 500,
      softTeacherOverload: 80,
      softAccessibilityBonus: -10,
      softMorningPreference: 40,
      softDayDistribution: 20,
      softSiblingDifferentDay: 100,
      softOverloadedTeacher: 200,
      softTeacherNoBreak: 1000,
      softConsecutiveHoursExceeded: 500,
      softFacultyIdleTime: 200,
      softLoadImbalance: 300,
      softLateClass: 250,
      softRoomIdleGap: 200,
      softUnevenSectionDist: 250,
      softConsecutiveDayPenalty: 0,
      softSectionGap: 50,
      softFacultyNightClass: 200,
      softFacultyDailySpan: 500,
      softVslShiftMismatch: 500,
      softPartTimeSaturday: 2000,
    }))
    toast.info('Penalty settings reset to default values', {
      icon: <FaSync className={styles.spinnerIcon} style={{ animation: 'none' }} />
    })
  }

  // Export schedule to PDF
  const handleExportPDF = async (exportType: 'current' | 'all-rooms' | 'all-sections' | 'all-teachers' | 'all-courses' = 'current') => {
    if (!scheduleResult?.allocations || scheduleResult.allocations.length === 0) {
      toast.warning('No Data', {
        description: 'No schedule data available to export.',
      })
      return
    }

    try {
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const pageWidth = 210
      const pageHeight = 297
      const margin = 8
      const usableWidth = pageWidth - (margin * 2)

      // Get unique values for export all
      const rooms = [...new Set(scheduleResult.allocations.map((a: RoomAllocation) => a.room))].filter(Boolean).sort() as string[]
      // Helper to get base section (strip LAB/LEC suffixes including comma-separated variants)
      // Helper to get base section (strips LEC/LAB but keeps G1/G2)
      const getViewingSectionName = (s: string) => {
        if (!s) return ''
        return s
          .replace(/_LAB$/i, '')
          .replace(/_LEC$/i, '')
          .replace(/_LECTURE$/i, '')
          .replace(/_LABORATORY$/i, '')
          .replace(/, LAB$/i, '')
          .replace(/, LEC$/i, '')
          .replace(/, LECTURE$/i, '')
          .replace(/, LABORATORY$/i, '')
          .replace(/-LAB$/i, '')
          .replace(/-LEC$/i, '')
          .replace(/ LAB$/i, '')
          .replace(/ LEC$/i, '')
          .replace(/_/g, ' ')
          .trim()
      }

      const getBaseSection = (s: string) => {
        if (!s) return ''
        return s
          .replace(/_LAB$/i, '')
          .replace(/_LEC$/i, '')
          .replace(/_LECTURE$/i, '')
          .replace(/_LABORATORY$/i, '')
          .replace(/_G[12](_LAB|_LEC|_LECTURE|_LABORATORY)?$/i, '')
          .replace(/ G[12](\s+)?(LAB|LEC|LECTURE|LABORATORY)?$/i, '')
          .replace(/, LAB$/i, '')
          .replace(/, LEC$/i, '')
          .replace(/, LECTURE$/i, '')
          .replace(/, LABORATORY$/i, '')
          .replace(/ LAB$/i, '')
          .replace(/ LEC$/i, '')
          .replace(/-LAB$/i, '')
          .replace(/-LEC$/i, '')
          .replace(/_/g, ' ')
          .trim()
      }
      // Get unique base sections (combining LAB and LEC into one)
      const sections = [...new Set(scheduleResult.allocations.map((a: RoomAllocation) => getBaseSection(a.section)))].filter(Boolean).sort() as string[]
      const teachers = [...new Set(scheduleResult.allocations.map((a: RoomAllocation) => a.teacher_name))].filter(Boolean).sort() as string[]
      const courses = [...new Set(scheduleResult.allocations.map((a: RoomAllocation) => a.course_code))].filter(Boolean).sort() as string[]

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

      // Helper: Expand day abbreviations
      const expandDays = (dayStr: string): string[] => {
        if (!dayStr) return []

        const dayMap: { [key: string]: string } = {
          'M': 'monday', 'T': 'tuesday', 'W': 'wednesday',
          'TH': 'thursday', 'F': 'friday', 'S': 'saturday', 'SU': 'sunday',
          'MONDAY': 'monday', 'TUESDAY': 'tuesday', 'WEDNESDAY': 'wednesday',
          'THURSDAY': 'thursday', 'FRIDAY': 'friday', 'SATURDAY': 'saturday', 'SUNDAY': 'sunday'
        }

        if (dayStr.includes('/')) {
          return dayStr.split('/').map(d => dayMap[d.trim().toUpperCase()] || d.trim().toLowerCase())
        }

        const patterns = [
          { pattern: 'TTH', days: ['tuesday', 'thursday'] },
          { pattern: 'MWF', days: ['monday', 'wednesday', 'friday'] },
          { pattern: 'MW', days: ['monday', 'wednesday'] },
        ]

        for (const { pattern, days } of patterns) {
          if (dayStr.toUpperCase() === pattern) return days
        }

        return [dayMap[dayStr.toUpperCase()] || dayStr.toLowerCase()]
      }

      // Helper: Parse time to minutes
      const parseTimeToMinutes = (timeStr: string): number => {
        if (!timeStr) return 0
        const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
        if (!match) {
          const hourMatch = timeStr.match(/(\d{1,2}):(\d{2})/)
          if (hourMatch) {
            return parseInt(hourMatch[1]) * 60 + parseInt(hourMatch[2])
          }
          return 0
        }
        let hours = parseInt(match[1])
        const minutes = parseInt(match[2])
        const period = match[3]?.toUpperCase()
        if (period === 'PM' && hours !== 12) hours += 12
        if (period === 'AM' && hours === 12) hours = 0
        return hours * 60 + minutes
      }

      // Helper: Process allocations into blocks
      const processAllocationsToBlocks = (allocs: RoomAllocation[]) => {
        const blocks: any[] = []
        const groupedMap = new Map()

        // Maximum block duration in minutes (4 hours = 240 minutes)
        // This prevents merging allocations into impossibly long blocks
        const MAX_BLOCK_DURATION_MINUTES = 240

        allocs.forEach(alloc => {
          const days = expandDays(alloc.schedule_day || '')
          days.forEach(day => {
            const key = `${alloc.course_code}|${alloc.section}|${alloc.room}|${day}|${alloc.teacher_name || ''}`
            if (!groupedMap.has(key)) groupedMap.set(key, [])
            groupedMap.get(key).push({ ...alloc, schedule_day: day })
          })
        })

        groupedMap.forEach(allocGroup => {
          const sorted = allocGroup.sort((a: any, b: any) => {
            const aTime = a.start_time || a.schedule_time?.split('-')[0] || ''
            const bTime = b.start_time || b.schedule_time?.split('-')[0] || ''
            return parseTimeToMinutes(aTime) - parseTimeToMinutes(bTime)
          })

          let currentBlock: any = null
          sorted.forEach((alloc: any) => {
            const startTime = alloc.start_time || alloc.schedule_time?.split('-')[0]?.trim() || ''
            const endTime = alloc.end_time || alloc.schedule_time?.split('-')[1]?.trim() || ''

            const startMins = parseTimeToMinutes(startTime)
            const endMins = parseTimeToMinutes(endTime)
            if (startMins === 0 && endMins === 0) return

            // Check if we should merge with current block
            // Only merge if: consecutive AND merged duration wouldn't exceed max
            const shouldMerge = currentBlock &&
              currentBlock.endMinutes === startMins &&
              (endMins - currentBlock.startMinutes) <= MAX_BLOCK_DURATION_MINUTES

            if (shouldMerge) {
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

      // Helper: Generate time slots (7:00 AM to 9:00 PM)
      const generateTimeSlots = () => {
        const slots = []
        for (let i = 0; i < 29; i++) {
          const hour = Math.floor(i / 2) + 7
          const minute = (i % 2) * 30
          slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`)
        }
        return slots
      }

      // Helper: Draw timetable for specific view
      const drawTimetable = (allocData: RoomAllocation[], title: string, pageNum: number) => {
        if (pageNum > 1) pdf.addPage()

        // QTime Logo - Green Q box with "Qtime Scheduler" text
        const logoSize = 8
        const logoTextSize = 10
        const logoText = 'Qtime Scheduler'
        pdf.setFontSize(logoTextSize)
        pdf.setFont('helvetica', 'bold')
        const textWidth = pdf.getTextWidth(logoText)
        const totalWidth = logoSize + 2 + textWidth
        const startX = (pageWidth - totalWidth) / 2
        const logoY = margin

        // Green rounded rectangle for Q
        pdf.setFillColor(22, 163, 74)
        pdf.roundedRect(startX, logoY, logoSize, logoSize, 1.5, 1.5, 'F')

        // "Q" letter in white
        pdf.setTextColor(255, 255, 255)
        pdf.setFontSize(6)
        pdf.setFont('helvetica', 'bold')
        const qWidth = pdf.getTextWidth('Q')
        pdf.text('Q', startX + (logoSize - qWidth) / 2, logoY + 5.5)

        // "Qtime Scheduler" text in black
        pdf.setTextColor(0, 0, 0)
        pdf.setFontSize(logoTextSize)
        pdf.setFont('helvetica', 'bold')
        pdf.text(logoText, startX + logoSize + 2, logoY + 6)

        // Reset text color
        pdf.setTextColor(0, 0, 0)

        // Title - centered (below logo)
        pdf.setFontSize(12)
        pdf.setFont('helvetica', 'bold')
        const titleWidth = pdf.getTextWidth(title)
        pdf.text(title, (pageWidth - titleWidth) / 2, margin + 14)

        // Subtitle - centered
        pdf.setFontSize(8)
        pdf.setFont('helvetica', 'normal')
        const subtitle = `${config.scheduleName} | ${config.semester} ${config.academicYear}`
        const subtitleWidth = pdf.getTextWidth(subtitle)
        pdf.text(subtitle, (pageWidth - subtitleWidth) / 2, margin + 19)

        // Get color map for all unique courses
        const colorMap = generateColorPalette(allocData)

        // Process allocations into blocks
        const blocks = processAllocationsToBlocks(allocData)

        // Table dimensions
        const startY = margin + 22
        const timeColWidth = 18
        const dayColWidth = (usableWidth - timeColWidth) / 6 // 6 days (Mon-Sat)
        const rowHeight = 8
        const timeSlots = generateTimeSlots()

        // Draw header grid and labels
        pdf.setDrawColor(100, 100, 100)
        pdf.setLineWidth(0.5)

        // Header row background
        pdf.setFillColor(240, 240, 240)
        pdf.rect(margin, startY, usableWidth, rowHeight, 'F')

        // Draw header border
        pdf.setDrawColor(150, 150, 150)
        pdf.rect(margin, startY, usableWidth, rowHeight)

        // Header text
        pdf.setFontSize(7)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(0, 0, 0)
        const timeHeaderWidth = pdf.getTextWidth('Time')
        pdf.text('Time', margin + (timeColWidth - timeHeaderWidth) / 2, startY + 5.5)

        const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        weekdays.forEach((day, idx) => {
          const x = margin + timeColWidth + (idx * dayColWidth)
          const dayWidth = pdf.getTextWidth(day)
          pdf.text(day, x + (dayColWidth - dayWidth) / 2, startY + 5.5)
          pdf.setDrawColor(150, 150, 150)
          pdf.setLineWidth(0.3)
          pdf.line(x, startY, x, startY + rowHeight)
        })
        pdf.line(margin + timeColWidth, startY, margin + timeColWidth, startY + rowHeight)

        // Draw time slots and blocks
        timeSlots.forEach((slot, rowIdx) => {
          const y = startY + rowHeight + (rowIdx * rowHeight)
          if (y > pageHeight - margin - 10) return

          // Time label
          pdf.setFontSize(7)
          pdf.setFont('helvetica', 'normal')
          pdf.setTextColor(0, 0, 0)
          const [hour, min] = slot.split(':').map(Number)
          const period = hour >= 12 ? 'PM' : 'AM'
          const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
          pdf.text(`${displayHour}:${min.toString().padStart(2, '0')} ${period}`, margin + 1, y + 3.5)

          // Draw day cells
          weekdays.forEach((day, dayIdx) => {
            const x = margin + timeColWidth + (dayIdx * dayColWidth)
            const dayLower = day.toLowerCase()
            const slotMinutes = hour * 60 + min

            // Check if covered by block
            const isCoveredByBlock = blocks.some(b =>
              b.day === dayLower &&
              b.startMinutes <= slotMinutes &&
              b.endMinutes > slotMinutes
            )

            // Only draw horizontal line if NOT covered by a block
            if (!isCoveredByBlock) {
              pdf.setDrawColor(230, 230, 230)
              pdf.setLineWidth(0.15)
              pdf.line(x, y + rowHeight, x + dayColWidth, y + rowHeight)
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

              // Color background
              const color = colorMap.get(block.course_code) || { r: 200, g: 200, b: 200 }
              pdf.setFillColor(color.r, color.g, color.b)
              pdf.rect(x + 0.3, y + 0.3, dayColWidth - 0.6, blockHeight - 0.6, 'F')

              const centerX = x + dayColWidth / 2
              pdf.setTextColor(255, 255, 255)
              let textY = y + 3

              // Course Code - centered
              pdf.setFontSize(7)
              pdf.setFont('helvetica', 'bold')
              pdf.text(block.course_code || 'N/A', centerX, textY, { align: 'center' })
              textY += 2.8

              // Course Name - centered
              if (blockHeight > 8) {
                pdf.setFontSize(5.5)
                pdf.setFont('helvetica', 'normal')
                const courseNameLines = pdf.splitTextToSize((block.course_name || '').substring(0, 35), dayColWidth - 1.5)
                pdf.text(courseNameLines.slice(0, 1), centerX, textY, { align: 'center' })
                textY += 2.5
              }

              // Time Range - centered
              if (blockHeight > 12) {
                pdf.setFontSize(5)
                const startH = Math.floor(block.startMinutes / 60)
                const startM = block.startMinutes % 60
                const endH = Math.floor(block.endMinutes / 60)
                const endM = block.endMinutes % 60
                const formatTime = (h: number, m: number) => {
                  const p = h >= 12 ? 'PM' : 'AM'
                  const dH = h === 0 ? 12 : h > 12 ? h - 12 : h
                  return `${dH}:${m.toString().padStart(2, '0')} ${p}`
                }
                pdf.text(`${formatTime(startH, startM)} - ${formatTime(endH, endM)}`, centerX, textY, { align: 'center' })
                textY += 2.5
              }

              // Section - centered
              if (blockHeight > 16) {
                pdf.setFontSize(5.5)
                pdf.text((block.section || 'N/A').substring(0, 20), centerX, textY, { align: 'center' })
                textY += 2.5
              }

              // Room - centered
              if (blockHeight > 20) {
                pdf.setFontSize(5)
                const fullRoom = block.room || 'N/A'
                const roomText = fullRoom.includes('-') ? fullRoom.split('-').slice(1).join('-') : fullRoom
                pdf.text(roomText.substring(0, 25), centerX, textY, { align: 'center' })
                textY += 2.5
              }

              // Teacher Name - centered
              if (blockHeight > 24) {
                pdf.setFontSize(5)
                pdf.text((block.teacher_name || 'TBD').substring(0, 20), centerX, textY, { align: 'center' })
              }

              // Border around block
              pdf.setDrawColor(255, 255, 255)
              pdf.setLineWidth(0.5)
              pdf.rect(x + 0.3, y + 0.3, dayColWidth - 0.6, blockHeight - 0.6)
            }
          })
        })
      }

      // Generate PDFs based on export type
      let pageCount = 0

      if (exportType === 'current') {
        drawTimetable(scheduleResult.allocations, 'All Classes', ++pageCount)
      } else if (exportType === 'all-rooms') {
        for (const room of rooms) {
          const roomAllocs = scheduleResult.allocations.filter((a: RoomAllocation) => a.room === room)
          if (roomAllocs.length > 0) {
            drawTimetable(roomAllocs, `Room: ${room}`, ++pageCount)
          }
        }
      } else if (exportType === 'all-sections') {
        const uniqueSections = [...new Set(scheduleResult.allocations.map((a: RoomAllocation) => a.section))].filter(Boolean).sort() as string[]
        for (const sectionName of uniqueSections) {
          const isSubGroup = sectionName.match(/_G[12]$/i) || sectionName.match(/ G[12]$/i);
          let sectionAllocs;

          if (isSubGroup) {
            // Find base section (e.g., strip G1/G2)
            const baseOfSelected = sectionName.replace(/_G[12]$/i, '').replace(/ G[12]$/i, '');
            // Include both the group sessions and the base section sessions (shared lectures)
            sectionAllocs = scheduleResult.allocations.filter((a: RoomAllocation) =>
              a.section === sectionName || a.section === baseOfSelected
            );
          } else {
            // Check if this is a "leaf" base section that has sub-groups
            // If it is, and we're showing it separately, we only show its specific sessions
            // Note: In some systems, BSM CS 1A might only have the shared lecture, 
            // while BSM CS 1A G1 and BSM CS 1A G2 have the labs.
            sectionAllocs = scheduleResult.allocations.filter((a: RoomAllocation) => a.section === sectionName);
          }

          if (sectionAllocs.length > 0) {
            drawTimetable(sectionAllocs, `Section: ${sectionName}`, ++pageCount)
          }
        }
      } else if (exportType === 'all-teachers') {
        for (const teacher of teachers) {
          const teacherAllocs = scheduleResult.allocations.filter((a: RoomAllocation) => a.teacher_name === teacher)
          if (teacherAllocs.length > 0) {
            drawTimetable(teacherAllocs, `Teacher: ${teacher}`, ++pageCount)
          }
        }
      } else if (exportType === 'all-courses') {
        for (const course of courses) {
          const courseAllocs = scheduleResult.allocations.filter((a: RoomAllocation) => a.course_code === course)
          if (courseAllocs.length > 0) {
            drawTimetable(courseAllocs, `Course: ${course}`, ++pageCount)
          }
        }
      }

      // Save PDF
      const fileName = `${config.scheduleName.replace(/\s+/g, '_')}_${exportType}_Schedule.pdf`
      pdf.save(fileName)
      toast.success('PDF Exported', {
        description: `Schedule exported as ${fileName}`,
      })
    } catch (error) {
      console.error('Error exporting PDF:', error)
      toast.error('Export Failed', {
        description: 'Failed to export schedule as PDF. Please try again.',
      })
    }
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
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className={`${styles.scheduleMain} ${!sidebarOpen ? styles.fullWidth : ''}`}>
        <div className={styles.scheduleContainer}>
          {/* Header */}
          <header className={styles.scheduleHeader}>
            <div className={styles.headerTitleSection}>
              <div className={styles.headerIconWrapper}>
                <FaAtom className={styles.headerLargeIcon} />
              </div>
              <div className={styles.headerText}>
                <h1 className={styles.scheduleTitle}>
                  Generate Schedule
                </h1>
                <p className={styles.scheduleSubtitle} id="gen-steps-indicator">
                  Advanced Algorithm for Optimal Class-Room-Teacher Scheduling
                </p>
                <div className={styles.backendStatusRow}>
                  <div
                    className={`${styles.backendStatusBadge} ${
                      backendProbe.checking
                        ? styles.backendStatusChecking
                        : backendProbe.reachable === true
                          ? styles.backendStatusOnline
                          : backendProbe.reachable === false
                            ? styles.backendStatusOffline
                            : ''
                    }`}
                  >
                    {backendProbe.checking ? (
                      <FaSpinner className={styles.backendStatusSpinner} />
                    ) : backendProbe.reachable ? (
                      <FaCheckCircle />
                    ) : (
                      <FaExclamationTriangle />
                    )}
                    <span>{backendProbe.message}</span>
                  </div>
                  <div
                    id="queue-pressure-badge"
                    className={`${styles.queueHeaderBadge} ${
                      highlightQueueHeader ? styles.queueHeaderPulse : ''
                    } ${
                      queueStatus.loading
                        ? styles.queueHeaderChecking
                        : queueStatus.available
                          ? queueStatus.active
                            ? styles.queueHeaderBusy
                            : styles.queueHeaderIdle
                          : styles.queueHeaderOffline
                    }`}
                    title={queueStatus.message}
                  >
                    {queueStatus.loading ? (
                      <FaSpinner className={styles.queueHeaderSpinner} />
                    ) : (
                      <FaLayerGroup />
                    )}
                    <span>
                      {queueStatus.available
                        ? queueStatus.active
                          ? `Queue: ${queueStatus.waitingCount} waiting`
                          : 'Queue: Idle'
                        : 'Queue: Unavailable'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.backendCheckButton}
                    onClick={probeBackendConnection}
                    disabled={backendProbe.checking || isScheduling}
                  >
                    {backendProbe.checking ? 'Checking...' : 'Check Backend'}
                  </button>
                  <div className={styles.backendPreferenceControl}>
                    <label htmlFor="backendPreference" className={styles.backendPreferenceLabel}>Backend</label>
                    <select
                      id="backendPreference"
                      className={styles.backendPreferenceSelect}
                      value={backendPreference}
                      onChange={(event) => setBackendPreference(event.target.value as BackendPreference)}
                      disabled={backendProbe.checking || isScheduling}
                    >
                      <option value="auto">Auto</option>
                      <option value="laptop">Laptop Public</option>
                      <option value="render">Render</option>
                      <option value="local">Localhost</option>
                    </select>
                  </div>
                </div>
                {backendProbe.backendUrl && (
                  <p className={styles.backendStatusMeta}>
                    Active backend: {backendProbe.backendUrl} ({BACKEND_PREFERENCE_LABELS[backendPreference]})
                    {backendProbe.probeLatencyMs ? (
                      <span className={styles.backendLatencyMeta}> | Latency: {backendProbe.probeLatencyMs} ms</span>
                    ) : null}
                    {queueStatus.available && queueStatus.maxWaitSeconds ? (
                      <span className={styles.backendLatencyMeta}>
                        {' '}| Queue max wait: {Math.max(1, Math.round(queueStatus.maxWaitSeconds / 60))} min
                      </span>
                    ) : null}
                  </p>
                )}
              </div>
            </div>
          </header>

          {/* Loading State */}
          {loading ? (
            <div className={styles.loadingContainer}>
              <FaSpinner className={styles.spinnerIcon} />
              <p>Loading CSV data sources...</p>
            </div>
          ) : (showResults && scheduleResult) ? (
            <div className={styles.resultsSection} id="gen-results-container">
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
                  <p className={styles.resultBackendInfo}>
                    {scheduleResult.executionSource === 'python-backend'
                      ? 'Backend confirmation: Python backend replied and processed this schedule.'
                      : scheduleResult.executionSource === 'fallback-local'
                        ? 'Backend confirmation: Python backend did not reply. Fallback scheduler was used.'
                        : 'Backend confirmation: execution source not reported.'}
                    {scheduleResult.backendUrl ? ` (${scheduleResult.backendUrl})` : ''}
                    {scheduleResult.backendResponseMs ? ` | Backend response: ${scheduleResult.backendResponseMs} ms` : ''}
                    {scheduleResult.iterationClamp
                      ? ` | Iterations requested/applied: ${scheduleResult.iterationClamp.requested.toLocaleString()}/${scheduleResult.iterationClamp.applied.toLocaleString()}`
                      : ''}
                  </p>
                  {scheduleResult.iterationClamp?.wasClamped && (
                    <p className={styles.resultClampInfo}>
                      Iteration cap applied at {scheduleResult.iterationClamp.cap.toLocaleString()} for this run.
                    </p>
                  )}
                </div>
              </div>

              {/* Statistics Grid */}
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}><FaLayerGroup /></div>
                  <div className={styles.statInfo}>
                    <span className={styles.statValue}>{scheduleResult.totalClasses}</span>
                    <span className={styles.statLabel}>
                      Total Allocations
                      <span title="Count formula: Total = unique course-section pairs from Course Management for this generated scope; Scheduled = unique course-section pairs with at least one schedule; Unscheduled = Total - Scheduled." style={{ marginLeft: 6, cursor: 'help', opacity: 0.8 }}>(?)</span>
                    </span>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}><FaCheckCircle /></div>
                  <div className={styles.statInfo}>
                    <span className={styles.statValue}>{scheduleResult.scheduledClasses}</span>
                    <span className={styles.statLabel}>
                      Scheduled Allocations
                      <span title="Count formula: Total = unique course-section pairs from Course Management for this generated scope; Scheduled = unique course-section pairs with at least one schedule; Unscheduled = Total - Scheduled." style={{ marginLeft: 6, cursor: 'help', opacity: 0.8 }}>(?)</span>
                    </span>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}><FaExclamationTriangle /></div>
                  <div className={styles.statInfo}>
                    <span className={styles.statValue}>{scheduleResult.unscheduledClasses}</span>
                    <span className={styles.statLabel}>
                      Unscheduled Allocations
                      <span title="Count formula: Total = unique course-section pairs from Course Management for this generated scope; Scheduled = unique course-section pairs with at least one schedule; Unscheduled = Total - Scheduled." style={{ marginLeft: 6, cursor: 'help', opacity: 0.8 }}>(?)</span>
                    </span>
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
                    {scheduleResult.iterationClamp && (
                      <span className={styles.optimizationMeta}>
                        req: {scheduleResult.iterationClamp.requested.toLocaleString()} | applied: {scheduleResult.iterationClamp.applied.toLocaleString()}
                      </span>
                    )}
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
                      <MdFlashOn size={16} /> Online Class Distribution
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

                {/* BulSU QSA: Split Session Statistics */}
                {scheduleResult.splitSessionStats && scheduleResult.splitSessionStats.hybrid_courses_split > 0 && (
                  <div className={styles.onlineStatsCard} style={{ marginTop: '16px', background: 'rgba(56, 142, 60, 0.05)', border: '1px solid rgba(56, 142, 60, 0.1)' }}>
                    <h4 className={styles.onlineStatsTitle} style={{ color: '#2e7d32' }}>
                      <FaLayerGroup size={16} /> G1/G2 Split Session Metrics
                    </h4>
                    <div className={styles.onlineStatsGrid}>
                      <div className={styles.onlineStatItem}>
                        <span className={styles.onlineStatValue}>{scheduleResult.splitSessionStats.hybrid_courses_split}</span>
                        <span className={styles.onlineStatLabel}>Hybrid Courses Split</span>
                      </div>
                      <div className={styles.onlineStatItem}>
                        <span className={styles.onlineStatValue}>{scheduleResult.splitSessionStats.split_sections_created}</span>
                        <span className={styles.onlineStatLabel}>G1/G2 Lab Sessions Created</span>
                      </div>
                    </div>
                    {config.enforceG1G2EqualHours && (
                      <p className={styles.onlineDaysNote} style={{ color: '#166534', borderTopColor: 'rgba(56, 142, 60, 0.1)' }}>
                        ⚖️ Hour Balancing Enforced: Scheduler penalized imbalances between G1/G2 pairs.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Unscheduled Classes Section */}
              {scheduleResult.unscheduledList && scheduleResult.unscheduledList.length > 0 && (
                <div className={styles.formCard}>
                  <h3 className={styles.formSectionTitle}>
                    <FaExclamationTriangle style={{ color: '#f59e0b' }} /> Unscheduled Classes ({filteredUnscheduledList.length}/{scheduleResult.unscheduledList.length})
                  </h3>
                  <p className={styles.formDescription}>
                    The following classes could not be scheduled. Review the detailed reasons below to resolve issues.
                  </p>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(220px, 1fr) minmax(200px, 280px) auto',
                    gap: '10px',
                    marginBottom: '14px'
                  }}>
                    <input
                      type="text"
                      value={unscheduledSearchQuery}
                      onChange={(e) => setUnscheduledSearchQuery(e.target.value)}
                      placeholder="Search course, section, teacher, reason..."
                      className={styles.formInput}
                    />
                    <select
                      value={unscheduledReasonFilter}
                      onChange={(e) => setUnscheduledReasonFilter(e.target.value)}
                      className={styles.formSelect}
                    >
                      <option value="all">All Reason Types</option>
                      {Object.keys(unscheduledReasonCounts)
                        .sort((a, b) => (unscheduledReasonCounts[b] || 0) - (unscheduledReasonCounts[a] || 0))
                        .map((code) => {
                          const info = unscheduledReasonLabels[code] || unscheduledReasonLabels.UNKNOWN
                          return (
                            <option key={code} value={code}>
                              {`${info.icon} ${info.label} (${unscheduledReasonCounts[code] || 0})`}
                            </option>
                          )
                        })}
                    </select>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => {
                        setUnscheduledSearchQuery('')
                        setUnscheduledReasonFilter('all')
                      }}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      Clear Filters
                    </button>
                  </div>

                  {/* Summary by reason type */}
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    {Object.entries(unscheduledReasonCounts).map(([code, count]) => {
                      const info = unscheduledReasonLabels[code] || unscheduledReasonLabels.UNKNOWN
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => setUnscheduledReasonFilter((prev) => prev === code ? 'all' : code)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            backgroundColor: `${info.color}15`,
                            border: unscheduledReasonFilter === code ? `2px solid ${info.color}` : `1px solid ${info.color}40`,
                            fontSize: '13px',
                            fontWeight: 500,
                            cursor: 'pointer'
                          }}
                          title={unscheduledReasonFilter === code ? 'Click to show all reasons' : `Filter by ${info.label}`}
                        >
                          <span>{info.icon}</span>
                          <span style={{ color: info.color }}>{count}</span>
                          <span style={{ color: '#666' }}>{info.label}</span>
                        </button>
                      )
                    })}
                  </div>

                  <div className={styles.unscheduledList}>
                    {filteredUnscheduledList.length === 0 && (
                      <div className={styles.unscheduledItem}>
                        <div className={styles.unscheduledHeader}>
                          <span className={styles.unscheduledCourse}>No unscheduled entries match the current filters</span>
                        </div>
                        <div className={styles.unscheduledName}>Try clearing the search or reason filter.</div>
                      </div>
                    )}
                    {filteredUnscheduledList.map((item: UnscheduledItem, index: number) => {
                      const reasonIcons: Record<string, string> = {
                        'INSUFFICIENT_ROOM_CAPACITY': '🏢',
                        'NO_LAB_ROOMS': '🔬',
                        'TEACHER_OVERLOADED': '👨‍🏫',
                        'SCHEDULE_FULL': '📅',
                        'TIME_CONFLICT': '⏰',
                        'PARTIAL_SCHEDULE': '📊',
                        'ROOM_TYPE_MISMATCH': '🚪',
                        'UNKNOWN': '❓'
                      }
                      const icon = reasonIcons[item.reason_code || 'UNKNOWN'] || '❓'

                      return (
                        <div key={index} className={styles.unscheduledItem}>
                          <div className={styles.unscheduledHeader}>
                            <span className={styles.unscheduledCourse}>
                              {item.course_code} - {formatSectionDisplayLabel(item.section_code)}
                            </span>
                            <span className={styles.unscheduledSlots}>
                              {item.assigned_slots}/{item.needed_slots} slots
                            </span>
                          </div>
                          <div className={styles.unscheduledName}>{item.course_name}</div>
                          {item.teacher_name && <div className={styles.unscheduledTeacher}>Teacher: {item.teacher_name}</div>}
                          {item.student_count && <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>Students: {item.student_count}</div>}
                          <div className={styles.unscheduledReason} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '8px' }}>
                            <span style={{ fontSize: '18px' }}>{icon}</span>
                            <div>
                              <div style={{ fontWeight: 600, color: '#dc2626' }}>{item.reason}</div>
                              {item.reason_details && item.reason_details.length > 0 && (
                                <ul style={{ margin: '6px 0 0 0', padding: '0 0 0 16px', fontSize: '12px', color: '#666' }}>
                                  {item.reason_details.map((detail: string, i: number) => (
                                    <li key={i} style={{ marginBottom: '2px' }}>{detail}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
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
                <div className={styles.exportDropdown}>
                  <button className={styles.secondaryButton} onClick={() => handleExportPDF('current')}>
                    <FaDownload /> Export PDF
                  </button>
                  <div className={styles.exportDropdownContent}>
                    <button onClick={() => handleExportPDF('current')}>Current View</button>
                    <button onClick={() => handleExportPDF('all-rooms')}>All Rooms</button>
                    <button onClick={() => handleExportPDF('all-sections')}>All Sections</button>
                    <button onClick={() => handleExportPDF('all-teachers')}>All Teachers</button>
                    <button onClick={() => handleExportPDF('all-courses')}>All Courses</button>
                  </div>
                </div>
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
                        {([...new Set(scheduleResult.allocations.map((a: RoomAllocation) => a.room).filter(Boolean))] as string[]).map((room: string) => (
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
                        {([...new Set(scheduleResult.allocations.map((a: RoomAllocation) => {
                          const name = a.section || '';
                          // Strip LEC/LAB but preserve G1/G2
                          return name.replace(/_LAB$/i, '').replace(/_LEC$/i, '').replace(/_LECTURE$/i, '').replace(/_LABORATORY$/i, '').replace(/ LAB$/i, '').replace(/ LEC$/i, '').replace(/_/g, ' ').trim();
                        }).filter(Boolean))] as string[]).sort().map((section: string) => (
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
                        {([...new Set(scheduleResult.allocations.map((a: RoomAllocation) => a.teacher_name).filter(Boolean))] as string[]).map((teacher: string) => (
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

                        // Helper: Parse time string to minutes (supports both 24h "HH:MM" and 12h "H:MM AM/PM" formats)
                        const parseTimeToMinutes = (timeStr: string): number => {
                          if (!timeStr) return 0;
                          const cleanTime = timeStr.trim();
                          // Check for AM/PM format
                          const ampmMatch = cleanTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i);
                          if (ampmMatch) {
                            let hour = parseInt(ampmMatch[1]);
                            const minute = parseInt(ampmMatch[2]);
                            const period = ampmMatch[3].toUpperCase();
                            if (period === 'PM' && hour !== 12) hour += 12;
                            if (period === 'AM' && hour === 12) hour = 0;
                            return hour * 60 + minute;
                          }
                          // Fallback to 24h format
                          const match = cleanTime.match(/^(\d{1,2}):(\d{2})/);
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
                          component: string;
                        };

                        const combinedBlocks: CombinedBlock[] = [];

                        // Filter allocations based on view
                        let viewFilteredAllocations = scheduleResult.allocations.filter((a: RoomAllocation) => {
                          if (timetableView === 'room') {
                            if (selectedTimetableRoom !== 'all' && a.room !== selectedTimetableRoom) return false;
                          } else if (timetableView === 'section') {
                            if (selectedTimetableSection !== 'all') {
                              const currentSectionName = a.section || '';
                              // Strip LEC/LAB for matching but preserve G1/G2
                              const currentViewingName = currentSectionName.replace(/_LAB$/i, '').replace(/_LEC$/i, '').replace(/_LECTURE$/i, '').replace(/_LABORATORY$/i, '').replace(/ LAB$/i, '').replace(/ LEC$/i, '').replace(/_/g, ' ').trim();

                              if (currentViewingName === selectedTimetableSection) return true;

                              // Handle shared sessions (e.g. BSM CS 1A LEC matches BSM CS 1A G1 view)
                              const isSubGroupOfSelected = selectedTimetableSection.match(/ G[12]$/i);
                              if (isSubGroupOfSelected) {
                                const parentName = selectedTimetableSection.replace(/ G[12]$/i, '');
                                if (currentViewingName === parentName) return true;
                              }

                              return false;
                            }
                          } else if (timetableView === 'teacher') {
                            if (selectedTimetableTeacher !== 'all' && a.teacher_name !== selectedTimetableTeacher) return false;
                          }
                          return true;
                        });

                        // Group by course+section+room+day+teacher to find consecutive slots
                        const groupedMap = new Map<string, RoomAllocation[]>();
                        viewFilteredAllocations.forEach((alloc: RoomAllocation) => {
                          const key = `${alloc.course_code}|${alloc.section}|${alloc.room}|${alloc.schedule_day}|${alloc.teacher_name || ''}|${alloc.is_online || false}`;
                          if (!groupedMap.has(key)) {
                            groupedMap.set(key, []);
                          }
                          groupedMap.get(key)!.push(alloc);
                        });

                        // For each group, combine consecutive time slots
                        groupedMap.forEach((allocations, key) => {
                          // Sort by start time
                          const sorted = allocations.sort((a: RoomAllocation, b: RoomAllocation) => {
                            return parseTimeToMinutes(a.schedule_time || '') - parseTimeToMinutes(b.schedule_time || '');
                          });

                          // Merge consecutive slots
                          let currentBlock: CombinedBlock | null = null;

                          sorted.forEach((alloc: RoomAllocation) => {
                            const timeStr = alloc.schedule_time || '';
                            // Parse schedule_time in format "H:MM AM - H:MM PM" or "HH:MM - HH:MM"
                            const timeParts = timeStr.split(/\s*-\s*/);
                            if (timeParts.length !== 2) return;

                            const startMins = parseTimeToMinutes(timeParts[0]);
                            const endMins = parseTimeToMinutes(timeParts[1]);
                            if (startMins === 0 && endMins === 0) return;

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
                                is_online: alloc.is_online || false,
                                component: alloc.component || ''
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
                              {/* Generate 30-minute time slots from 7:00 AM to 8:00 PM */}
                              {Array.from({ length: 26 }, (_, i) => {
                                const totalMinutes = (START_HOUR * 60) + (i * 30);
                                const hour = Math.floor(totalMinutes / 60);
                                const minute = totalMinutes % 60;
                                const displayTime = formatTimeAMPM(hour, minute);
                                const isHourMark = minute === 0;

                                return (
                                  <tr key={i} className={isHourMark ? styles.hourRow : styles.halfHourRow}>
                                    <td className={`${styles.timeCell} ${isHourMark ? styles.hourMark : styles.halfHourMark}`}>
                                      <div>{displayTime}</div>
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

                                            // Get color based on course/subject
                                            const getColor = () => {
                                              if (block.is_online) return '#9c27b0';

                                              // Generate color based on course code for consistent coloring across all views
                                              const courseKey = block.course_code || block.course_name || 'default';
                                              const hash = courseKey.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0);

                                              // Expanded color palette with distinct, vibrant colors
                                              const colors = [
                                                '#1976d2', // Blue
                                                '#388e3c', // Green
                                                '#f57c00', // Orange
                                                '#7b1fa2', // Purple
                                                '#00796b', // Teal
                                                '#c2185b', // Pink
                                                '#5d4037', // Brown
                                                '#455a64', // Blue Grey
                                                '#e64a19', // Deep Orange
                                                '#0097a7', // Cyan
                                                '#303f9f', // Indigo
                                                '#689f38', // Light Green
                                                '#fbc02d', // Yellow
                                                '#c62828', // Red
                                                '#6a1b9a', // Deep Purple
                                                '#00695c', // Dark Teal
                                                '#ef6c00', // Amber
                                                '#d81b60', // Magenta
                                                '#4e342e', // Dark Brown
                                                '#01579b'  // Dark Blue
                                              ];

                                              return colors[Math.abs(hash) % colors.length];
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
                                                title={`${block.course_code} - ${block.course_name}\nSection: ${block.section}\nRoom: ${block.room}\nTime: ${displayTimeRange}\nTeacher: ${block.teacher_name || 'TBD'}\nType: ${block.component || 'N/A'}`}
                                              >
                                                {block.component && (
                                                  <div className={styles.componentBadge}>
                                                    {block.component}
                                                  </div>
                                                )}
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
            <div className={styles.formSection}>
              {/* Step Progress */}
              <div className={styles.stepProgress}>
                <div
                  className={`${styles.step} ${activeStep >= 1 ? styles.active : ''} ${activeStep > 1 ? styles.completed : ''}`}
                  onClick={() => goToStep(1)}
                  style={{ cursor: 'pointer' }}
                  title="Go to Step 1: Select Data Sources"
                >
                  <div className={styles.stepNumber}>1</div>
                  <span>Select Data Sources</span>
                </div>
                <div className={styles.stepLine}></div>
                <div
                  className={`${styles.step} ${activeStep >= 2 ? styles.active : ''} ${activeStep > 2 ? styles.completed : ''}`}
                  onClick={() => { if (canProceedToStep2) goToStep(2) }}
                  style={{ cursor: canProceedToStep2 ? 'pointer' : 'not-allowed', opacity: canProceedToStep2 ? 1 : 0.7 }}
                  title={canProceedToStep2 ? "Go to Step 2: Review Data" : "Complete Step 1 first"}
                >
                  <div className={styles.stepNumber}>2</div>
                  <span>Review Data</span>
                </div>
                <div className={styles.stepLine}></div>
                <div
                  className={`${styles.step} ${activeStep >= 3 ? styles.active : ''} ${activeStep > 3 ? styles.completed : ''}`}
                  onClick={() => { if (canProceedToStep3) goToStep(3) }}
                  style={{ cursor: canProceedToStep3 ? 'pointer' : 'not-allowed', opacity: canProceedToStep3 ? 1 : 0.7 }}
                  title={canProceedToStep3 ? "Go to Step 3: Configure & Generate" : "Complete Steps 1 & 2 first"}
                >
                  <div className={styles.stepNumber}>3</div>
                  <span>Configure & Generate</span>
                </div>
              </div>

              {/* Step 1: Select Data Sources */}
              {activeStep === 1 && (
                <div className={styles.dataSourcesSection} id="gen-step1-container">
                  {/* College Filter - Filter rooms and sections by college */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
                    borderRadius: '16px',
                    padding: '20px 24px',
                    marginBottom: '24px',
                    border: '2px solid rgba(99, 102, 241, 0.2)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1' }}>
                        <MdSchool size={24} style={{ color: '#6366f1' }} />
                        <div>
                          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-dark)' }}>College Filter</h3>
                          <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                            Filter rooms & sections by college to prevent inter-college scheduling conflicts
                          </p>
                        </div>
                      </div>
                      <select
                        value={selectedCollege}
                        onChange={(e) => {
                          setSelectedCollege(e.target.value)
                          // Reload data with college filter when campus groups are selected
                          if (selectedCampusGroups.length > 0) {
                            selectedCampusGroups.forEach(groupId => loadCampusData(groupId, e.target.value))
                          }
                          if (selectedYearBatches.length > 0) {
                            loadMultipleClassData(selectedYearBatches, e.target.value)
                          }
                        }}
                        style={{
                          padding: '12px 20px',
                          borderRadius: '10px',
                          border: '2px solid rgba(99, 102, 241, 0.3)',
                          background: 'var(--bg-white, #fff)',
                          fontSize: '14px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          minWidth: '250px',
                          color: 'var(--text-dark)'
                        }}
                      >
                        <option value="all">All Colleges (No Filter)</option>
                        {bulsuColleges.map(c => (
                          <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                        ))}
                      </select>
                    </div>
                    {selectedCollege !== 'all' && (
                      <div style={{
                        marginTop: '12px',
                        padding: '10px 14px',
                        background: 'rgba(34, 197, 94, 0.1)',
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: '#16a34a',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <MdCheckCircle size={16} />
                        <span>Scheduling filtered for <strong>{selectedCollege}</strong> - Only {selectedCollege} rooms and sections will be used</span>
                      </div>
                    )}
                  </div>

                  {/* Campus/Rooms Selection */}
                  <div className={styles.dataSourceCard} id="gen-campus-selection">
                    <div className={styles.dataSourceHeader} onClick={() => setExpandedCampus(!expandedCampus)}>
                      <div className={styles.dataSourceTitle}>
                        <div className={`${styles.dataSourceIcon} ${styles.campusIcon}`}>
                          <MdSchool size={24} />
                        </div>
                        <div>
                          <h3>Campus / Building / Rooms</h3>
                          <p>Select one or more room data CSV files to use for room allocation</p>
                        </div>
                      </div>
                      <div className={styles.dataSourceStatus}>
                        {selectedCampusGroups.length > 0 ? (
                          <span className={styles.selectedBadge}>
                            <MdCheckCircle size={16} /> {selectedCampusGroups.length} Selected
                          </span>
                        ) : (
                          <span className={styles.requiredBadge}>Required</span>
                        )}
                        {expandedCampus ? <MdKeyboardArrowDown size={20} /> : <MdKeyboardArrowRight size={20} />}
                      </div>
                    </div>

                    {expandedCampus && (
                      <div className={styles.dataSourceContent}>
                        {campusGroups.length === 0 ? (
                          <div className={styles.emptyDataSource}>
                            <MdDescription size={40} />
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
                                    <MdSchool size={20} />
                                    <h4>{group.school_name}</h4>
                                  </div>
                                  <div className={styles.dataCardStats}>
                                    <span><MdMeetingRoom size={14} /> {group.room_count} rooms</span>
                                    <span><MdPeople size={14} /> {group.total_capacity} capacity</span>
                                  </div>
                                  <div className={styles.dataCardFile}>
                                    <MdDescription size={14} /> {group.file_name}
                                  </div>
                                  <div className={styles.dataCardDate}>
                                    {new Date(group.created_at).toLocaleDateString()}
                                  </div>
                                  {isSelected && (
                                    <div className={styles.selectedCheck}><MdCheckCircle size={20} /></div>
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
                  <div className={styles.dataSourceCard} id="gen-course-selection">
                    <div className={styles.dataSourceHeader} onClick={() => setExpandedSections(!expandedSections)}>
                      <div className={styles.dataSourceTitle}>
                        <div className={`${styles.dataSourceIcon} ${styles.classIcon}`}>
                          <MdMenuBook size={24} />
                        </div>
                        <div>
                          <h3>Sections & Assigned Courses</h3>
                          <p>Select year batch with sections and their assigned courses from Class & Section Assigning page</p>
                        </div>
                      </div>
                      <div className={styles.dataSourceStatus}>
                        {selectedYearBatches.length > 0 ? (
                          <span className={styles.selectedBadge}>
                            <MdCheckCircle size={16} /> {selectedYearBatches.length} Selected
                          </span>
                        ) : (
                          <span className={styles.requiredBadge}>Required</span>
                        )}
                        {expandedSections ? <MdKeyboardArrowDown size={20} /> : <MdKeyboardArrowRight size={20} />}
                      </div>
                    </div>

                    {expandedSections && (
                      <div className={styles.dataSourceContent}>
                        {yearBatches.length === 0 ? (
                          <div className={styles.emptyDataSource}>
                            <MdDescription size={40} />
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
                              const isSelected = selectedYearBatches.includes(batch.id)

                              return (
                                <div
                                  key={batch.id}
                                  className={`${styles.dataCard} ${isSelected ? styles.selected : ''}`}
                                  onClick={() => handleSelectClassGroup(batch.id)}
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
                                    <MdSchool size={20} />
                                    <h4>{batch.year_batch}</h4>
                                  </div>
                                  <div className={styles.dataCardStats}>
                                    <span><MdPeople size={14} /> {batchSections.length} sections</span>
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
                                  {isSelected && (
                                    <div className={styles.selectedCheck}><MdCheckCircle size={20} /></div>
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
                      onClick={() => goToStep(2)}
                    >
                      Continue to Review Data
                      <MdKeyboardArrowRight size={18} />
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
                <div className={styles.reviewSection} id="gen-step2-container">
                  {/* Summary Cards */}
                  <div className={styles.summaryGrid}>
                    <div className={styles.summaryCard}>
                      <div className={`${styles.summaryIcon} ${styles.campusIcon}`}>
                        <MdSchool size={24} />
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
                        <MdMenuBook size={24} />
                      </div>
                      <div className={styles.summaryInfo}>
                        <h4>
                          {selectedBatchInfoList.length === 1
                            ? selectedBatchInfoList[0]?.year_batch
                            : `${selectedBatchInfoList.length} Year Batches`}
                        </h4>
                        <p>{classes.length} classes • {sections.filter(s => selectedYearBatches.includes(s.year_batch_id)).length} sections</p>
                        {selectedBatchInfoList.length > 1 && (
                          <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '4px' }}>
                            {selectedBatchInfoList.map(b => b.year_batch).join(', ')}
                          </div>
                        )}
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

                  {/* Section & Course Multi-Select Filter */}
                  {selectedYearBatches.length > 0 && (
                    <div className={styles.filterSection} id="gen-section-filter">
                      <div className={styles.filterHeader} onClick={() => { }}>
                        <div className={styles.filterTitle}>
                          <MdPeople size={18} />
                          <h3>Select Sections & Courses</h3>
                        </div>
                        <div className={styles.filterStatus}>
                          {(() => {
                            const batchSections = sections.filter(s => selectedYearBatches.includes(s.year_batch_id))
                            const allSelected = selectedSectionIds.length === batchSections.length || selectedSectionIds.length === 0
                            return allSelected && excludedCourseKeys.size === 0 ? (
                              <span className={styles.filterInactiveBadge}>All sections & courses included</span>
                            ) : (
                              <span className={styles.filterActiveBadge}>
                                {selectedSectionIds.length} section(s) • {excludedCourseKeys.size > 0 ? `${excludedCourseKeys.size} course(s) excluded` : 'all courses'}
                              </span>
                            )
                          })()}
                        </div>
                      </div>

                      <div className={styles.filterContent}>
                        <p className={styles.filterDescription}>
                          Select which sections to include in the schedule and optionally exclude specific courses.
                        </p>

                        {/* Quick Actions */}
                        <div className={styles.quickActionsBox}>
                          <div className={styles.quickActionsContent}>
                            <span className={styles.quickActionsLabel}>Quick Actions:</span>
                            <button
                              onClick={() => {
                                const batchSections = sections.filter(s => selectedYearBatches.includes(s.year_batch_id))
                                setSelectedSectionIds(batchSections.map(s => s.id))
                                setExcludedCourseKeys(new Set())
                              }}
                              className={`${styles.quickActionBtn} ${styles.selectAllBuildings}`}
                            >
                              ✓ Select All
                            </button>
                            <button
                              onClick={() => {
                                setSelectedSectionIds([])
                                setExcludedCourseKeys(new Set())
                              }}
                              className={`${styles.quickActionBtn} ${styles.clearAll}`}
                            >
                              ✕ Deselect All
                            </button>
                          </div>
                        </div>

                        {/* Sections List */}
                        <div className={styles.buildingGrid}>
                          {sections
                            .filter(s => selectedYearBatches.includes(s.year_batch_id))
                            .map(section => {
                              const isSelected = selectedSectionIds.includes(section.id)
                              const sectionCourses = allLoadedClasses.filter(cls => cls.section === section.section_name)
                              const excludedCount = sectionCourses.filter(cls => excludedCourseKeys.has(`${section.id}-${cls.course_code}`)).length

                              return (
                                <div key={section.id} className={`${styles.buildingCard} ${isSelected ? styles.selected : ''}`}>
                                  <div className={styles.buildingHeader} style={{ marginBottom: '8px' }}>
                                    <label className={styles.buildingCheckbox} style={{ width: '100%' }}>
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => {
                                          setSelectedSectionIds(prev =>
                                            prev.includes(section.id)
                                              ? prev.filter(id => id !== section.id)
                                              : [...prev, section.id]
                                          )
                                        }}
                                        style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: '#16a34a' }}
                                      />
                                      <MdSchool size={16} />
                                      <strong style={{ flex: 1 }}>{section.section_name}</strong>
                                      {isSelected && (
                                        <span style={{
                                          fontSize: '11px',
                                          backgroundColor: '#16a34a',
                                          color: 'white',
                                          padding: '2px 8px',
                                          borderRadius: '4px',
                                          fontWeight: 600
                                        }}>
                                          ✓
                                        </span>
                                      )}
                                    </label>
                                  </div>

                                  <div className={styles.buildingStats} style={{ marginBottom: '0' }}>
                                    <span><MdMenuBook size={14} /> {sectionCourses.length - excludedCount}/{sectionCourses.length} courses</span>
                                    <span><MdPeople size={14} /> {section.student_count} students</span>
                                    {section.college && <span style={{ fontSize: '11px', color: '#6366f1' }}>{section.college}</span>}
                                  </div>

                                  {/* Collapsible course list */}
                                  {isSelected && sectionCourses.length > 0 && (
                                    <details style={{ marginTop: '10px', cursor: 'pointer' }}>
                                      <summary style={{
                                        fontWeight: '500',
                                        color: 'var(--text-medium)',
                                        fontSize: '12px',
                                        userSelect: 'none',
                                        padding: '4px 0',
                                        opacity: 0.8
                                      }}>
                                        {excludedCount > 0
                                          ? `${sectionCourses.length - excludedCount}/${sectionCourses.length} courses included`
                                          : `View ${sectionCourses.length} assigned courses`}
                                      </summary>
                                      <div style={{ marginTop: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                                        {sectionCourses.map((cls, idx) => {
                                          const courseKey = `${section.id}-${cls.course_code}`
                                          const isExcluded = excludedCourseKeys.has(courseKey)
                                          return (
                                            <label key={idx} style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              padding: '6px 8px',
                                              borderRadius: '4px',
                                              cursor: 'pointer',
                                              backgroundColor: isExcluded ? 'rgba(239, 68, 68, 0.08)' : 'rgba(22, 163, 74, 0.05)',
                                              marginBottom: '4px',
                                              fontSize: '12px',
                                              gap: '6px'
                                            }}>
                                              <input
                                                type="checkbox"
                                                checked={!isExcluded}
                                                onChange={() => {
                                                  setExcludedCourseKeys(prev => {
                                                    const next = new Set(prev)
                                                    if (next.has(courseKey)) {
                                                      next.delete(courseKey)
                                                    } else {
                                                      next.add(courseKey)
                                                    }
                                                    return next
                                                  })
                                                }}
                                                style={{ cursor: 'pointer', width: '14px', height: '14px', accentColor: '#16a34a' }}
                                              />
                                              <span style={{ flex: 1, color: isExcluded ? '#9ca3af' : 'var(--text-dark)', textDecoration: isExcluded ? 'line-through' : 'none' }}>
                                                {cls.course_code} — {cls.course_name}
                                              </span>
                                              <span style={{
                                                fontSize: '10px',
                                                color: 'var(--text-light)',
                                                backgroundColor: 'var(--bg-gray-100)',
                                                padding: '1px 5px',
                                                borderRadius: '3px'
                                              }}>
                                                {cls.lec_hours + cls.lab_hours}h
                                              </span>
                                            </label>
                                          )
                                        })}
                                      </div>
                                    </details>
                                  )}
                                </div>
                              )
                            })}
                        </div>

                        {/* Summary */}
                        <div className={styles.filterSummary} style={{ marginTop: '12px' }}>
                          <p>
                            <strong>Selection:</strong> {classes.length} classes from {selectedSectionIds.length} section(s) will be scheduled
                            {excludedCourseKeys.size > 0 && ` (${excludedCourseKeys.size} course assignment(s) excluded)`}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Building and Room Filter */}
                  <div className={styles.filterSection} id="gen-room-filter">
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
                        {showBuildingFilter ? <MdKeyboardArrowDown size={20} /> : <MdKeyboardArrowRight size={20} />}
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
                                    <MdDomain size={16} />
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
                                  <span><MdMeetingRoom size={14} /> {buildingRooms.length} rooms</span>
                                  <span><MdPeople size={14} /> {buildingRooms.reduce((sum, r) => sum + r.capacity, 0)} capacity</span>
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
                      <h3><MdMeetingRoom size={20} /> Rooms Preview ({getFilteredRooms().length})</h3>
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
                            {getFilteredRooms().slice(0, 5).map(room => (
                              <tr key={room.id}>
                                <td>{room.room}</td>
                                <td>{room.building}</td>
                                <td>{room.campus}</td>
                                <td>{room.capacity}</td>
                                <td>{room.room_type}</td>
                              </tr>
                            ))}
                            {getFilteredRooms().length > 5 && (
                              <tr className={styles.moreRow} onClick={() => { setPreviewSearchQuery(''); setShowAllRooms(true); }}>
                                <td colSpan={5}>
                                  <span className={styles.viewMoreLink}>+ {getFilteredRooms().length - 5} more rooms... Click to view all</span>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      {getFilteredRooms().length > 0 && (
                        <button
                          className={styles.viewAllButton}
                          onClick={() => { setPreviewSearchQuery(''); setShowAllRooms(true); }}
                        >
                          View All Rooms
                        </button>
                      )}
                    </div>

                    <div className={styles.previewCard}>
                      <h3><MdMenuBook size={20} /> Classes Preview ({classes.length})</h3>
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
                              <tr className={styles.moreRow} onClick={() => { setPreviewSearchQuery(''); setShowAllClasses(true); }}>
                                <td colSpan={5}>
                                  <span className={styles.viewMoreLink}>+ {classes.length - 5} more classes... Click to view all</span>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      {classes.length > 0 && (
                        <button
                          className={styles.viewAllButton}
                          onClick={() => { setPreviewSearchQuery(''); setShowAllClasses(true); }}
                        >
                          View All Classes
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Compatibility Check */}
                  <div className={styles.compatibilityCard}>
                    <h3><MdCheckCircle size={20} /> Data Compatibility Check</h3>
                    <div className={styles.compatibilityList}>
                      <div className={`${styles.compatibilityItem} ${styles.success}`}>
                        <MdCheckCircle size={18} />
                        <span>Room data loaded successfully ({rooms.length} rooms)</span>
                      </div>
                      <div className={`${styles.compatibilityItem} ${styles.success}`}>
                        <MdCheckCircle size={18} />
                        <span>Class schedule data loaded ({classes.length} classes)</span>
                      </div>
                      <div
                        className={`${styles.compatibilityItem} ${
                          overallCapacityLevel === 'good'
                            ? styles.success
                            : overallCapacityLevel === 'warning'
                              ? styles.warning
                              : styles.danger
                        }`}
                      >
                        {overallCapacityLevel === 'good' ? (
                          <MdCheckCircle size={18} />
                        ) : overallCapacityLevel === 'warning' ? (
                          <MdWarning size={18} />
                        ) : (
                          <MdError size={18} />
                        )}
                        <span>
                          Overall seat check (rough): {totalFilteredRoomCapacity} seats for {totalEstimatedStudents} students
                          {selectedRooms.length > 0 || selectedBuildings.length > 0
                            ? ` (${filteredRoomsPreview.length} filtered rooms)`
                            : ` (${rooms.length} loaded rooms)`}
                        </span>
                      </div>
                      <div className={`${styles.compatibilityItem} ${styles.success}`}>
                        <MdCheckCircle size={18} />
                        <span>
                          Source: section student counts from Class Section Assigning + room capacities from Rooms Management
                        </span>
                      </div>
                      {collegeCapacityEstimates.length > 0 && collegeCapacityEstimates.map(estimate => {
                        const itemClass =
                          estimate.level === 'good'
                            ? styles.success
                            : estimate.level === 'warning'
                              ? styles.warning
                              : styles.danger

                        return (
                          <div key={`college-estimate-${estimate.collegeKey}`} className={`${styles.compatibilityItem} ${itemClass}`}>
                            {estimate.level === 'good' ? (
                              <MdCheckCircle size={18} />
                            ) : estimate.level === 'warning' ? (
                              <MdWarning size={18} />
                            ) : (
                              <MdError size={18} />
                            )}
                            <span>
                              {estimate.collegeLabel}: {estimate.availableSeats} seats ({estimate.dedicatedSeats} dedicated + {estimate.sharedSeats} shared)
                              {' '}for {estimate.students} students across {estimate.sectionCount} sections ({estimate.seatCoverage.toFixed(0)}% coverage)
                            </span>
                          </div>
                        )
                      })}
                      {teachers.length > 0 && (
                        <div className={`${styles.compatibilityItem} ${styles.success}`}>
                          <MdCheckCircle size={18} />
                          <span>Teacher availability data included ({teachers.length} teachers)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Navigation */}
                  <div className={styles.stepNavigation}>
                    <button className={styles.backStepButton} onClick={() => goToStep(1)}>
                      <MdKeyboardArrowRight size={18} style={{ transform: 'rotate(180deg)' }} />
                      Back
                    </button>
                    <button
                      className={styles.nextButton}
                      disabled={!canProceedToStep3}
                      onClick={() => goToStep(3)}
                    >
                      Continue to Configuration
                      <MdKeyboardArrowRight size={18} />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Configure & Generate */}
              {activeStep === 3 && (
                <div className={styles.configSection} id="gen-step3-container">
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
                        <label className={styles.formLabel}>Semester (filters courses to schedule)</label>
                        <select
                          className={styles.formSelect}
                          value={config.semester}
                          onChange={(e) => {
                            setConfig(prev => ({ ...prev, semester: e.target.value }))
                            // Re-filter classes based on selected semester
                            if (selectedYearBatches.length > 0) {
                              loadMultipleClassDataWithSemester(selectedYearBatches, e.target.value)
                            }
                          }}
                        >
                          <option value="First Semester">First Semester</option>
                          <option value="Second Semester">Second Semester</option>
                          <option value="Summer">Summer</option>
                        </select>
                        <p style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '4px' }}>
                          Only courses assigned to this semester will be scheduled
                        </p>
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Academic Year</label>
                        <select
                          className={styles.formSelect}
                          value={config.academicYear}
                          onChange={(e) => setConfig(prev => ({ ...prev, academicYear: e.target.value }))}
                        >
                          {academicYearOptions.map((academicYear) => (
                            <option key={academicYear} value={academicYear}>
                              {academicYear}
                            </option>
                          ))}
                        </select>
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
                            <span>Bypass teacher check (show &quot;TBD&quot; in schedule)</span>
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
                  <div className={styles.formCard} id="gen-time-config">
                    <h3 className={styles.formSectionTitle}>
                      <FaClock /> Campus Schedule Times (Room/Building Operating Hours)
                    </h3>
                    <div className={styles.timeConfigInfo}>
                      <MdAccessTime size={20} />
                      <p>Set the campus operating hours for room allocation. Classes scheduled on &quot;Online Days&quot; will not require rooms, regardless of these times.</p>
                    </div>

                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Campus Opening Time (Classes can start from)</label>
                        <input
                          type="time"
                          className={styles.formInput}
                          value={timeSettings.startTime}
                          min="07:00"
                          max="19:30"
                          onChange={(e) => setTimeSettings(prev => normalizeCampusTimeSettings({ ...prev, startTime: e.target.value }))}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Campus Closing Time (Last class must end by)</label>
                        <input
                          type="time"
                          className={styles.formInput}
                          value={timeSettings.endTime}
                          min="07:30"
                          max="20:00"
                          onChange={(e) => setTimeSettings(prev => normalizeCampusTimeSettings({ ...prev, endTime: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className={styles.slotDurationInfo}>
                      <MdAccessTime size={18} />
                      <div>
                        <strong>Time Slot Duration:</strong> 90 minutes (1.5 hours)
                        <p className={styles.slotDurationNote}>
                          Standard academic period. Schedule generation automatically allocates multiple slots based on each class&apos;s Lec Hours + Lab Hours from the CSV file.
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

                    {/* Automatic Lunch Break Info (Auto Mode) */}
                    <div className={styles.lunchBreakSection}>
                      <div className={styles.lunchBreakHeader}>
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>
                          🍽️ Automatic Recovery Break
                        </span>
                      </div>
                      <div className={styles.lunchBreakSettings}>
                        <div className={styles.lunchBreakInfo}>
                          <MdAccessTime size={18} />
                          <p>
                            <strong>Mandatory 1-hour break</strong> is automatically inserted after
                            <strong> 6 consecutive hours</strong> of class. This applies to both
                            professors and student groups. No manual configuration needed.
                          </p>
                        </div>
                        <div className={styles.lunchBreakPreview}>
                          <strong>Rule:</strong> 6hrs straight class → 1hr mandatory break
                          <span className={styles.strictBadge}>
                            🔒 Auto-Enforced
                          </span>
                        </div>
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

                  {/* Online Days Configuration (Quantum Rule: The "Online Day" Rule) */}
                  <div className={styles.formCard} id="gen-online-config">
                    <h3 className={styles.formSectionTitle}>
                      <MdFlashOn /> Online Days Configuration
                    </h3>
                    <div className={styles.timeConfigInfo}>
                      <MdFlashOn size={20} />
                      <p>
                        Select days where ALL classes are conducted online/asynchronously. These days will NOT require room allocations,
                        allowing the quantum algorithm to &quot;tunnel&quot; through problem spaces by shifting F2F demand to available days.
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

                  {/* Configuration Constraints Toggle */}
                  <div className={styles.advancedToggle}>
                    <button
                      className={styles.advancedToggleButton}
                      onClick={() => setShowConstraintSettings(!showConstraintSettings)}
                    >
                      <FaFilter size={18} />
                      Scheduling Constraints & Rules
                      {showConstraintSettings ? <MdKeyboardArrowDown size={18} /> : <MdKeyboardArrowRight size={18} />}
                    </button>
                  </div>

                  {showConstraintSettings && (
                    <div className={styles.combinedConstraintsContainer}>
                      {/* Detailed Scheduling Constraints & Rules (New Section) */}
                      <div className={styles.formCard}>
                        <h3 className={styles.formSectionTitle}>
                          <FaFilter /> Scheduling Constraints & Rules
                        </h3>
                        <div className={styles.timeConfigInfo}>
                          <FaCog size={20} />
                          <p>
                            Configure how the algorithm handles specific BulSU scheduling rules. These constraints directly influence the cost matrix of the quantum simulation.
                          </p>
                        </div>

                        <div className={styles.constraintsWrapper}>
                          {/* Lunch Mode Selection */}
                          <div className={styles.constraintItem}>
                            <div className={styles.constraintLabelGroup}>
                              <label className={styles.formLabel}>Lunch Break Mode</label>
                              <span className={styles.formHint}>How the mandatory lunch break should be enforced</span>
                            </div>
                            <div className={styles.constraintInputGroup}>
                              <select
                                className={styles.formSelect}
                                value={config.lunchMode}
                                onChange={(e) => setConfig(prev => ({ ...prev, lunchMode: e.target.value as any }))}
                              >
                                <option value="auto">Auto (1hr break after 6hrs consecutive)</option>
                                <option value="strict">Strict (Fixed 1hr gap for everyone)</option>
                                <option value="flexible">Flexible (Prefer gap, but override if tight)</option>
                                <option value="none">Disabled (No lunch enforcement)</option>
                              </select>
                            </div>
                          </div>

                          {config.lunchMode !== 'auto' && config.lunchMode !== 'none' && (
                            <div className={styles.formRow} style={{ marginTop: '12px', padding: '12px', background: 'rgba(0,0,0,0.03)', borderRadius: '8px' }}>
                              <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Lunch Start Hour</label>
                                <select
                                  className={styles.formSelect}
                                  value={config.lunchStartHour}
                                  onChange={(e) => setConfig(prev => ({ ...prev, lunchStartHour: parseInt(e.target.value) }))}
                                >
                                  {[11, 12, 13, 14].map(h => (
                                    <option key={h} value={h}>{h === 12 ? '12:00 PM' : h > 12 ? `${h - 12}:00 PM` : `${h}:00 AM`}</option>
                                  ))}
                                </select>
                              </div>
                              <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Lunch End Hour</label>
                                <select
                                  className={styles.formSelect}
                                  value={config.lunchEndHour}
                                  onChange={(e) => setConfig(prev => ({ ...prev, lunchEndHour: parseInt(e.target.value) }))}
                                >
                                  {[12, 13, 14, 15].map(h => (
                                    <option key={h} value={h}>{h === 12 ? '12:00 PM' : h > 12 ? `${h - 12}:00 PM` : `${h}:00 AM`}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          )}

                          <div className={styles.divider} />

                          {/* Rule Toggles */}
                          <div className={styles.ruleToggles}>
                            <div className={styles.ruleItem}>
                              <div className={styles.ruleInfo}>
                                <span className={styles.ruleTitle}>Strict Lab Room Matching</span>
                                <span className={styles.ruleDesc}>Lab classes MUST ONLY be placed in Laboratory/Computer Lab rooms</span>
                              </div>
                              <label className={styles.toggleSwitch}>
                                <input
                                  type="checkbox"
                                  checked={config.strictLabRoomMatching}
                                  onChange={(e) => setConfig(prev => ({ ...prev, strictLabRoomMatching: e.target.checked }))}
                                />
                                <span className={styles.toggleSlider}></span>
                              </label>
                            </div>

                            <div className={styles.ruleItem}>
                              <div className={styles.ruleInfo}>
                                <span className={styles.ruleTitle}>Strict Lecture Room Matching</span>
                                <span className={styles.ruleDesc}>Lecture classes should avoid specialized laboratory rooms</span>
                              </div>
                              <label className={styles.toggleSwitch}>
                                <input
                                  type="checkbox"
                                  checked={config.strictLectureRoomMatching}
                                  onChange={(e) => setConfig(prev => ({ ...prev, strictLectureRoomMatching: e.target.checked }))}
                                />
                                <span className={styles.toggleSlider}></span>
                              </label>
                            </div>

                            <div className={styles.ruleItem}>
                              <div className={styles.ruleInfo}>
                                <span className={styles.ruleTitle}>Allow Split Sessions</span>
                                <span className={styles.ruleDesc}>Split long classes (3hr+) into multiple sessions (e.g. 1.5hr Mon + 1.5hr Thu)</span>
                              </div>
                              <label className={styles.toggleSwitch}>
                                <input
                                  type="checkbox"
                                  checked={config.allowSplitSessions}
                                  onChange={(e) => setConfig(prev => ({ ...prev, allowSplitSessions: e.target.checked }))}
                                />
                                <span className={styles.toggleSlider}></span>
                              </label>
                            </div>

                            <div className={styles.ruleItem}>
                              <div className={styles.ruleInfo}>
                                <span className={styles.ruleTitle}>College-Room Matching</span>
                                <span className={styles.ruleDesc}>Courses MUST be scheduled in rooms belonging to their respective college (or "Shared" rooms)</span>
                              </div>
                              <label className={styles.toggleSwitch}>
                                <input
                                  type="checkbox"
                                  checked={config.collegeRoomMatchingEnabled}
                                  onChange={(e) => setConfig(prev => ({ ...prev, collegeRoomMatchingEnabled: e.target.checked }))}
                                />
                                <span className={styles.toggleSlider}></span>
                              </label>
                            </div>

                            <div className={styles.ruleItem}>
                              <div className={styles.ruleInfo}>
                                <span className={styles.ruleTitle}>G1/G2 Lab Splitting</span>
                                <span className={styles.ruleDesc}>Automatically split large laboratory sections into G1 and G2 groups</span>
                              </div>
                              <label className={styles.toggleSwitch}>
                                <input
                                  type="checkbox"
                                  checked={config.allowG1G2SplitSessions}
                                  onChange={(e) => setConfig(prev => ({ ...prev, allowG1G2SplitSessions: e.target.checked }))}
                                />
                                <span className={styles.toggleSlider}></span>
                              </label>
                            </div>

                            {config.allowG1G2SplitSessions && (
                              <div className={styles.ruleItem}>
                                <div className={styles.ruleInfo}>
                                  <span className={styles.ruleTitle}>G1/G2 Hour Balancing</span>
                                  <span className={styles.ruleDesc}>Ensure both G1 and G2 groups get equal scheduled hours</span>
                                </div>
                                <label className={styles.toggleSwitch}>
                                  <input
                                    type="checkbox"
                                    checked={config.enforceG1G2EqualHours}
                                    onChange={(e) => setConfig(prev => ({ ...prev, enforceG1G2EqualHours: e.target.checked }))}
                                  />
                                  <span className={styles.toggleSlider}></span>
                                </label>
                              </div>
                            )}

                            <div className={styles.ruleItem}>
                              <div className={styles.ruleInfo}>
                                <span className={styles.ruleTitle}>Avoid Conflicts (Strict)</span>
                                <span className={styles.ruleDesc}>Zero-tolerance for room/teacher/student overlaps</span>
                              </div>
                              <label className={styles.toggleSwitch}>
                                <input
                                  type="checkbox"
                                  checked={config.avoidConflicts}
                                  onChange={(e) => setConfig(prev => ({ ...prev, avoidConflicts: e.target.checked }))}
                                />
                                <span className={styles.toggleSlider}></span>
                              </label>
                            </div>
                          </div>

                          <div className={styles.divider} />

                        </div>
                      </div>

                      {/* Soft Constraint Penalties */}
                      <div className={styles.formCard}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                          <h3 className={styles.formSectionTitle} style={{ margin: 0 }}>
                            <FaBolt /> Soft Constraint Penalties (Fine-Tuning)
                          </h3>
                          <button
                            className={styles.backButton}
                            style={{ margin: 0, padding: '8px 16px', fontSize: '13px' }}
                            onClick={resetPenalties}
                          >
                            <FaSync /> Reset to Defaults
                          </button>
                        </div>
                        <div className={styles.timeConfigInfo}>
                          <FaBolt size={20} />
                          <p>Adjust these values to change how the algorithm prioritizes different soft constraints. Higher values mean the algorithm will try harder to avoid that specific issue. Use 0 to ignore a constraint.</p>
                        </div>

                        <div className={styles.penaltyGrid} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginTop: '20px' }}>
                          {/* Room & Capacity Penalties */}
                          <div className={styles.penaltyGroup}>
                            <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <FaBuilding /> Room & Capacity
                            </h4>
                            <div className={styles.formGroup}>
                              <label className={styles.formLabel}>Room Type Mismatch <span className={styles.formHint}>Lecture in Lab or vice versa</span></label>
                              <input type="number" className={styles.formInput} value={config.softRoomTypeMismatch} onChange={e => setConfig(p => ({ ...p, softRoomTypeMismatch: parseInt(e.target.value) }))} />
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.formLabel}>Major Type Mismatch <span className={styles.formHint}>Specialized room mismatch</span></label>
                              <input type="number" className={styles.formInput} value={config.softRoomTypeMajorMismatch} onChange={e => setConfig(p => ({ ...p, softRoomTypeMajorMismatch: parseInt(e.target.value) }))} />
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.formLabel}>Capacity Waste <span className={styles.formHint}>Penalty per wasted seat</span></label>
                              <input type="number" className={styles.formInput} value={config.softCapacityWaste} onChange={e => setConfig(p => ({ ...p, softCapacityWaste: parseInt(e.target.value) }))} />
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.formLabel}>Accessibility Bonus <span className={styles.formHint}>Lower is better (negative value)</span></label>
                              <input type="number" className={styles.formInput} value={config.softAccessibilityBonus} onChange={e => setConfig(p => ({ ...p, softAccessibilityBonus: parseInt(e.target.value) }))} />
                            </div>
                          </div>

                          {/* Faculty Welfare Penalties */}
                          <div className={styles.penaltyGroup}>
                            <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <FaChalkboardTeacher /> Faculty Welfare
                            </h4>
                            <div className={styles.formGroup}>
                              <label className={styles.formLabel}>Consecutive Hours <span className={styles.formHint}>Exceeding max hours without break</span></label>
                              <input type="number" className={styles.formInput} value={config.softConsecutiveHoursExceeded} onChange={e => setConfig(p => ({ ...p, softConsecutiveHoursExceeded: parseInt(e.target.value) }))} />
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.formLabel}>No Break Penalty <span className={styles.formHint}>Missing required lunch break</span></label>
                              <input type="number" className={styles.formInput} value={config.softTeacherNoBreak} onChange={e => setConfig(p => ({ ...p, softTeacherNoBreak: parseInt(e.target.value) }))} />
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.formLabel}>Faculty Daily Span <span className={styles.formHint}>Penalty for {'>'}10hr daily span</span></label>
                              <input type="number" className={styles.formInput} value={config.softFacultyDailySpan} onChange={e => setConfig(p => ({ ...p, softFacultyDailySpan: parseInt(e.target.value) }))} />
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.formLabel}>Night Class Penalty <span className={styles.formHint}>FT faculty night class without preference</span></label>
                              <input type="number" className={styles.formInput} value={config.softFacultyNightClass} onChange={e => setConfig(p => ({ ...p, softFacultyNightClass: parseInt(e.target.value) }))} />
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.formLabel}>Idle Time Penalty <span className={styles.formHint}>Long gaps between classes</span></label>
                              <input type="number" className={styles.formInput} value={config.softFacultyIdleTime} onChange={e => setConfig(p => ({ ...p, softFacultyIdleTime: parseInt(e.target.value) }))} />
                            </div>
                          </div>

                          {/* Schedule Quality Penalties */}
                          <div className={styles.penaltyGroup}>
                            <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <MdTableChart /> Schedule Quality
                            </h4>
                            <div className={styles.formGroup}>
                              <label className={styles.formLabel}>Lunch Overlap <span className={styles.formHint}>Classes during lunch hours</span></label>
                              <input type="number" className={styles.formInput} value={config.softLunchOverlap} onChange={e => setConfig(p => ({ ...p, softLunchOverlap: parseInt(e.target.value) }))} />
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.formLabel}>Day Distribution <span className={styles.formHint}>Poor spreading across days</span></label>
                              <input type="number" className={styles.formInput} value={config.softDayDistribution} onChange={e => setConfig(p => ({ ...p, softDayDistribution: parseInt(e.target.value) }))} />
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.formLabel}>Uneven Section Dist <span className={styles.formHint}>Sections of same course on same day</span></label>
                              <input type="number" className={styles.formInput} value={config.softUnevenSectionDist} onChange={e => setConfig(p => ({ ...p, softUnevenSectionDist: parseInt(e.target.value) }))} />
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.formLabel}>Section Gap <span className={styles.formHint}>Long gaps between subject sessions</span></label>
                              <input type="number" className={styles.formInput} value={config.softSectionGap} onChange={e => setConfig(p => ({ ...p, softSectionGap: parseInt(e.target.value) }))} />
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.formLabel}>Late Class <span className={styles.formHint}>Penalty for classes after 6PM</span></label>
                              <input type="number" className={styles.formInput} value={config.softLateClass} onChange={e => setConfig(p => ({ ...p, softLateClass: parseInt(e.target.value) }))} />
                            </div>
                          </div>

                          {/* Professional Constraints */}
                          <div className={styles.penaltyGroup}>
                            <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <FaUserGraduate /> Specific Rules
                            </h4>
                            <div className={styles.formGroup}>
                              <label className={styles.formLabel}>VSL Shift Mismatch <span className={styles.formHint}>VSL faculty outside shift pref</span></label>
                              <input type="number" className={styles.formInput} value={config.softVslShiftMismatch} onChange={e => setConfig(p => ({ ...p, softVslShiftMismatch: parseInt(e.target.value) }))} />
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.formLabel}>Part-Time Sat <span className={styles.formHint}>Part-timers on Saturdays</span></label>
                              <input type="number" className={styles.formInput} value={config.softPartTimeSaturday} onChange={e => setConfig(p => ({ ...p, softPartTimeSaturday: parseInt(e.target.value) }))} />
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.formLabel}>Morning Preference <span className={styles.formHint}>Bonus for morning sessions</span></label>
                              <input type="number" className={styles.formInput} value={config.softMorningPreference} onChange={e => setConfig(p => ({ ...p, softMorningPreference: parseInt(e.target.value) }))} />
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* Advanced Settings Toggle */}
                  <div className={styles.advancedToggle}>
                    <button
                      className={styles.advancedToggleButton}
                      onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                    >
                      <MdSettings size={18} />
                      Advanced Settings
                      {showAdvancedSettings ? <MdKeyboardArrowDown size={18} /> : <MdKeyboardArrowRight size={18} />}
                    </button>
                  </div>

                  {/* Advanced Algorithm Settings */}
                  {showAdvancedSettings && (
                    <div className={styles.formCard}>
                      <h3 className={styles.formSectionTitle}>
                        <FaAtom /> Quantum-Inspired Algorithm Settings
                      </h3>

                      <div className={styles.algorithmInfo}>
                        <MdFlashOn size={20} />
                        <p>
                          A smart optimization method that mimics quantum behavior to avoid getting stuck in “good but not best” solutions, helping it find the best possible way to assign rooms.
                        </p>
                      </div>

                      <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>
                            Number of Attempts
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
                            Starting Shuffle
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
                            Slowdown Rate
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
                            Escape Chance
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
                    <button className={styles.backStepButton} onClick={() => goToStep(2)}>
                      <MdKeyboardArrowRight size={18} style={{ transform: 'rotate(180deg)' }} />
                      Back
                    </button>
                  </div>

                  {/* Generate Button */}
                  <div className={styles.generateSection} id="gen-generate-action">
                    <div className={styles.generateButtonGroup}>
                      <button
                        className={`${styles.manualEditButton}`}
                        onClick={() => setShowManualModal(true)}
                        disabled={isScheduling || isSubmittingGeneration || !canGenerate}
                      >
                        <MdTableChart size={20} /> Manual Edit First
                      </button>
                      <button
                        className={`${styles.generateButton} ${isScheduling ? styles.generating : ''}`}
                        onClick={openGenerateReviewModal}
                        disabled={isScheduling || isSubmittingGeneration || !canGenerate}
                      >
                        {isScheduling ? (
                          <>
                            <FaSpinner className={styles.spinnerIcon} />
                            {generationPhase === 'queued'
                              ? `Queued for Generation... ${(timer / 1000).toFixed(1)}s`
                              : `Generating Schedule... ${(timer / 1000).toFixed(1)}s`}
                          </>
                        ) : isSubmittingGeneration ? (
                          <>
                            <FaSpinner className={styles.spinnerIcon} />
                            Submitting Request...
                          </>
                        ) : (
                          <>
                            <MdPlayArrow size={20} /> Generate Room Allocation Schedule
                          </>
                        )}
                      </button>
                    </div>
                    {!canGenerate && (
                      <p className={styles.generateHint}>
                        Please enter a schedule name to generate
                      </p>
                    )}
                    {canGenerate && !isScheduling && (
                      <p className={styles.generateInfo}>
                        <MdFlashOn size={16} />
                        Will process {classes.length} courses across {rooms.length} rooms using {config.maxIterations.toLocaleString()} QIA iterations
                      </p>
                    )}

                    {isScheduling && (
                      <div className={styles.queueStatusCard}>
                        <div className={styles.queueStatusHeader}>
                          <FaClock />
                          <span>{generationPhase === 'queued' ? 'Queued Request' : 'Generation Queue'}</span>
                          {queueStatus.loading && <FaSpinner className={styles.queueSpinner} />}
                        </div>
                        <p className={styles.queueStatusMessage}>
                          {generationPhase === 'queued'
                            ? `Your request is in queue${estimatedQueuePosition ? ` (estimated position #${estimatedQueuePosition})` : ''}. Waiting for an active generation slot.`
                            : generationPhase === 'generating'
                              ? 'Your request is now actively generating a schedule.'
                              : queueStatus.message}
                        </p>
                        {queueStatus.available && (
                          <div className={styles.queueStatusGrid}>
                            <div className={styles.queueStatusItem}>
                              <span className={styles.queueStatusLabel}>Active</span>
                              <strong>{queueStatus.active ? 'Yes' : 'No'}</strong>
                            </div>
                            <div className={styles.queueStatusItem}>
                              <span className={styles.queueStatusLabel}>Waiting</span>
                              <strong>{queueStatus.waitingCount}</strong>
                            </div>
                            {queueStatus.maxWaitSeconds ? (
                              <div className={styles.queueStatusItem}>
                                <span className={styles.queueStatusLabel}>Max Wait</span>
                                <strong>{Math.round(queueStatus.maxWaitSeconds / 60)} min</strong>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    )}

                    {!isScheduling && scheduleResult?.queueJobId && (
                      <div className={styles.queueSummaryPill}>
                        <FaClock />
                        Queue wait: {(scheduleResult.queueWaitSeconds || 0).toFixed(1)}s
                        {scheduleResult.queueInitialPosition ? ` (started at position #${scheduleResult.queueInitialPosition})` : ''}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
          }
        </div >


      </main >

      {/* File Viewer Modal */}
      {
        showClassFileViewer && (
          <div className={styles.modalOverlay} onClick={closeFileViewer}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h2>
                  <MdMenuBook size={24} /> Sections & Assigned Courses: {selectedBatchInfoList.length === 1
                    ? selectedBatchInfoList[0]?.year_batch
                    : `${selectedBatchInfoList.length} Year Batches`}
                </h2>
                <button className={styles.modalCloseBtn} onClick={closeFileViewer}>
                  <MdClose size={24} />
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
        )
      }

      {/* Unassigned Courses Warning Modal */}
      {
        showUnassignedWarning && (
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
                      Bypass teacher check (Professors will be shown as &quot;TBD&quot; in schedule)
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
                        toast.warning('Bypass Required', {
                          description: 'Please enable the bypass option to proceed without assigned professors.',
                        })
                      }
                    }}
                    disabled={!bypassTeacherCheck || isScheduling || isSubmittingGeneration}
                    className={styles.proceedBtn}
                  >
                    <FaPlay /> Proceed with Scheduling
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Review Before Generate Modal */}
      {
        showGenerateReview && (
          <div className={styles.modalOverlay} onClick={() => setShowGenerateReview(false)}>
            <div className={styles.generateReviewModal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.reviewModalHeader}>
                <h3 className={styles.reviewModalTitle}>
                  <FaFileAlt /> Review Before Scheduling
                </h3>
                <button className={styles.closeModalButton} onClick={() => setShowGenerateReview(false)}>
                  <FaTimes />
                </button>
              </div>

              <div className={styles.reviewModalBody}>
                <p className={styles.reviewLeadText}>
                  Confirm these details before starting the schedule generation for <strong>{config.scheduleName}</strong>.
                </p>

                <div className={styles.reviewSummaryGrid}>
                  <div className={styles.reviewSummaryItem}>
                    <span className={styles.reviewSummaryLabel}>Rooms to Use</span>
                    <span className={styles.reviewSummaryValue}>{filteredRoomsPreview.length}</span>
                  </div>
                  <div className={styles.reviewSummaryItem}>
                    <span className={styles.reviewSummaryLabel}>Classes to Schedule</span>
                    <span className={styles.reviewSummaryValue}>{classes.length}</span>
                  </div>
                  <div className={styles.reviewSummaryItem}>
                    <span className={styles.reviewSummaryLabel}>Sections</span>
                    <span className={styles.reviewSummaryValue}>{uniqueSectionsCount}</span>
                  </div>
                  <div className={styles.reviewSummaryItem}>
                    <span className={styles.reviewSummaryLabel}>Manual Priorities</span>
                    <span className={styles.reviewSummaryValue}>{manualAllocations.length}</span>
                  </div>
                </div>

                <div className={styles.reviewSectionCard}>
                  <h4 className={styles.reviewSectionTitle}>Selected Source Files</h4>
                  {selectedCampusFileNames.length > 0 ? (
                    <ul className={styles.reviewList}>
                      {selectedCampusFileNames.map((fileName) => (
                        <li key={fileName}>{fileName}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.reviewMutedText}>No campus file names detected from selected room uploads.</p>
                  )}
                </div>

                <div className={styles.reviewSectionCard}>
                  <h4 className={styles.reviewSectionTitle}>Scheduling Scope</h4>
                  <div className={styles.reviewScopeGrid}>
                    <p><strong>Colleges Scheduled:</strong> {scheduledCollegesLabel}</p>
                    <p><strong>Year Batches:</strong> {selectedBatchInfoList.length}</p>
                    <p><strong>Teachers Assigned:</strong> {assignedTeacherCount}</p>
                    <p><strong>Iterations:</strong> {config.maxIterations.toLocaleString()}</p>
                    <p><strong>Online Days:</strong> {config.onlineDays.length > 0 ? config.onlineDays.join(', ') : 'None'}</p>
                    <p><strong>Active Days:</strong> {activeDaysPreview.join(', ')}</p>
                  </div>
                </div>

                {(unassignedCourses.length > 0 || selectedRooms.length > 0 || selectedBuildings.length > 0) && (
                  <div className={styles.reviewWarningBox}>
                    {unassignedCourses.length > 0 && (
                      <p>
                        <FaExclamationTriangle /> {unassignedCourses.length} class(es) have no assigned professor. A second confirmation will appear.
                      </p>
                    )}
                    {(selectedRooms.length > 0 || selectedBuildings.length > 0) && (
                      <p>
                        <FaFilter /> Room scope is limited by your current building/room filter ({filteredRoomsPreview.length} rooms included).
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className={styles.reviewModalFooter}>
                <div className={styles.modalActions}>
                  <button onClick={() => setShowGenerateReview(false)} className={styles.cancelBtn}>
                    Cancel
                  </button>
                  <button
                    onClick={confirmAndGenerateSchedule}
                    disabled={isScheduling || isSubmittingGeneration}
                    className={styles.proceedBtn}
                  >
                    <FaPlay /> Yes, Generate Schedule
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* View All Rooms Modal */}
      {
        showAllRooms && (
          <div className={styles.modalOverlay} onClick={() => setShowAllRooms(false)}>
            <div className={styles.viewAllModal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.viewAllModalHeader}>
                <h3 className={styles.viewAllModalTitle}>
                  <MdMeetingRoom size={24} /> All Rooms ({getFilteredRooms().length})
                </h3>
                <button className={styles.closeModalButton} onClick={() => setShowAllRooms(false)}>
                  <FaTimes />
                </button>
              </div>

              <div className={styles.viewAllModalSearch}>
                <input
                  type="text"
                  placeholder="Search rooms..."
                  value={previewSearchQuery}
                  onChange={(e) => setPreviewSearchQuery(e.target.value)}
                  className={styles.viewAllSearchInput}
                />
              </div>

              <div className={styles.viewAllModalBody}>
                <table className={styles.viewAllTable}>
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
                    {getFilteredRooms()
                      .filter(room =>
                        previewSearchQuery === '' ||
                        room.room.toLowerCase().includes(previewSearchQuery.toLowerCase()) ||
                        room.building.toLowerCase().includes(previewSearchQuery.toLowerCase()) ||
                        room.campus.toLowerCase().includes(previewSearchQuery.toLowerCase()) ||
                        room.room_type.toLowerCase().includes(previewSearchQuery.toLowerCase())
                      )
                      .map(room => (
                        <tr key={room.id}>
                          <td>{room.room}</td>
                          <td>{room.building}</td>
                          <td>{room.campus}</td>
                          <td>{room.capacity}</td>
                          <td>{room.room_type}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <div className={styles.viewAllModalFooter}>
                <button className={styles.closeBtn} onClick={() => setShowAllRooms(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* View All Classes Modal */}
      {
        showAllClasses && (
          <div className={styles.modalOverlay} onClick={() => setShowAllClasses(false)}>
            <div className={styles.viewAllModal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.viewAllModalHeader}>
                <h3 className={styles.viewAllModalTitle}>
                  <MdMenuBook size={24} /> All Classes ({classes.length})
                </h3>
                <button className={styles.closeModalButton} onClick={() => setShowAllClasses(false)}>
                  <FaTimes />
                </button>
              </div>

              <div className={styles.viewAllModalSearch}>
                <input
                  type="text"
                  placeholder="Search classes..."
                  value={previewSearchQuery}
                  onChange={(e) => setPreviewSearchQuery(e.target.value)}
                  className={styles.viewAllSearchInput}
                />
              </div>

              <div className={styles.viewAllModalBody}>
                <table className={styles.viewAllTable}>
                  <thead>
                    <tr>
                      <th>Course Code</th>
                      <th>Course Name</th>
                      <th>Section</th>
                      <th>Day</th>
                      <th>Time</th>
                      <th>Lec Hours</th>
                      <th>Lab Hours</th>
                      <th>Professor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classes
                      .filter(cls =>
                        previewSearchQuery === '' ||
                        cls.course_code.toLowerCase().includes(previewSearchQuery.toLowerCase()) ||
                        cls.course_name.toLowerCase().includes(previewSearchQuery.toLowerCase()) ||
                        cls.section.toLowerCase().includes(previewSearchQuery.toLowerCase()) ||
                        (cls.schedule_day && cls.schedule_day.toLowerCase().includes(previewSearchQuery.toLowerCase()))
                      )
                      .map(cls => (
                        <tr key={cls.id}>
                          <td>{cls.course_code}</td>
                          <td>{cls.course_name}</td>
                          <td>{cls.section}</td>
                          <td>{cls.schedule_day || 'TBD'}</td>
                          <td>{cls.schedule_time || 'TBD'}</td>
                          <td>{cls.lec_hours}h</td>
                          <td>{cls.lab_hours}h</td>
                          <td>{cls.teacher_name || 'TBD'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <div className={styles.viewAllModalFooter}>
                <button className={styles.closeBtn} onClick={() => setShowAllClasses(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Manual Edit Modal */}
      <ManualEditModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        onSave={(newManualAllocations) => {
          setManualAllocations(newManualAllocations)
          toast.success('Manual preferences saved', {
            description: `${newManualAllocations.length} classes will be prioritized during generation.`
          })

          if (newManualAllocations.length > 0) {
            createSystemAlert({
              title: 'Manual Preferences Updated',
              message: `${newManualAllocations.length} manual allocations have been set for the next schedule generation.`,
              audience: 'admin',
              severity: 'info',
              category: 'manual_edit'
            })
          }
        }}
        rooms={getFilteredRooms()}
        classes={classes}
        timeSettings={timeSettings}
        initialAllocations={manualAllocations}
        collegeRoomMatchingEnabled={config.collegeRoomMatchingEnabled}
        allowG1G2SplitSessions={config.allowG1G2SplitSessions}
      />
    </div >
  )
}

