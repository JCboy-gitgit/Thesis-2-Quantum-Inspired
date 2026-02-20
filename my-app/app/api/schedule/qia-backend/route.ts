import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Backend URLs - Use environment variable first, then Render, then localhost for development
const ENV_BACKEND_URL = process.env.NEXT_PUBLIC_API_URL
const RENDER_BACKEND_URL = 'https://thesis-2-quantum-inspired.onrender.com'
const LOCAL_BACKEND_URL = 'http://localhost:8000'

// Determine if we're in production (Vercel)
const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production'

// Cache-busting wrapper to prevent Next.js from caching Supabase requests
const fetchWithNoCache = (url: RequestInfo | URL, options: RequestInit = {}) =>
  fetch(url, { ...options, cache: 'no-store' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { global: { fetch: fetchWithNoCache } }
)

export const dynamic = 'force-dynamic'

interface RoomData {
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
  college?: string | null  // NEW: College assignment (e.g., "CS", "CAFA", "Shared")
}

interface ClassData {
  id: number
  course_code: string
  course_name: string
  section: string
  year_level?: number
  student_count?: number
  schedule_day: string
  schedule_time: string
  lec_hours: number
  lab_hours: number
  total_hours: number
  department: string
  semester: string
  academic_year: string
  college?: string | null  // NEW: College assignment for room separation
}

interface TeacherData {
  id: number
  teacher_id: string
  name: string
  schedule_day: string
  schedule_time: string
  department: string
  email: string
}

interface TimeSlot {
  id: number
  slot_name: string
  start_time: string
  end_time: string
  duration_minutes: number
}

interface RequestBody {
  schedule_name: string
  semester: string
  academic_year: string
  // Support both old and new field names for backward compatibility
  campus_group_id?: number
  campus_group_ids?: number[]  // Frontend sends array
  class_group_id?: number
  year_batch_id?: number       // Frontend sends this as class_group_id
  college?: string             // College filter for the schedule
  teacher_group_id: number | null
  rooms: RoomData[]
  classes: ClassData[]
  teachers: TeacherData[]
  time_slots: TimeSlot[]
  active_days: string[]
  online_days?: string[] // NEW: Days where all classes are online
  time_settings: {
    startTime: string
    endTime: string
    slotDuration: number
    includeSaturday: boolean
    includeSunday: boolean
  }
  config: {
    max_iterations: number
    initial_temperature: number
    cooling_rate: number
    quantum_tunneling_probability: number
    max_teacher_hours_per_day: number
    max_consecutive_hours: number // NEW: Max hours before required break
    avoid_conflicts: boolean
    online_days?: string[] // NEW: Days where all classes are online
    // NEW: Constraint settings
    lunch_mode?: 'auto' | 'strict' | 'flexible' | 'none' // Lunch break enforcement ('auto' = 1hr break after 6hrs consecutive)
    lunch_start_hour?: number // Only used in 'strict'/'flexible' modes
    lunch_end_hour?: number // Only used in 'strict'/'flexible' modes
    strict_lab_room_matching?: boolean // Lab classes must be in lab rooms
    strict_lecture_room_matching?: boolean // Lecture classes should not be in lab rooms
    // Split session settings
    allow_split_sessions?: boolean // Allow splitting classes into multiple sessions (e.g., 3hr class -> 1.5hr Mon + 1.5hr Thu)
  }
}

/**
 * Generate a consistent positive numeric ID from a teacher name string.
 * Uses a simple hash to map the same name to the same integer every time.
 */
function getTeacherIdFromName(name: string): number {
  if (!name || name === 'TBD' || name === 'Unknown' || name.trim() === '') return 0
  const normalized = name.trim().toLowerCase()
  let hash = 5381
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) & 0x7fffffff
  }
  return hash || 1 // Ensure never 0
}

/**
 * Convert frontend classes to backend sections format
 * lec_hours and lab_hours are actual contact hours per week
 */
function convertClassesToSections(classes: ClassData[], courseRequirements: Map<number, string[]>): any[] {
  return classes.map((cls, index) => {
    const lecHours = cls.lec_hours || 0
    const labHours = cls.lab_hours || 0
    // Total weekly contact hours = lec + lab hours
    const weeklyHours = lecHours + labHours

    // Use teacher_name from class data if available, otherwise 'TBD'
    const teacherName = (cls as any).teacher_name || 'TBD'

    // Generate a consistent numeric teacher_id from the teacher's name
    // This enables the scheduler's teacher conflict detection
    const teacherId = getTeacherIdFromName(teacherName)

    // Get required features for this course (based on course_id from class_schedules table)
    const courseId = (cls as any).course_id || cls.id

    return {
      id: typeof cls.id === 'number' ? cls.id : index + 1, // Ensure numeric ID
      section_code: cls.section || `SEC-${index + 1}`,
      course_code: cls.course_code || '',
      course_name: cls.course_name || '',
      teacher_id: teacherId, // Unique ID derived from teacher_name for conflict detection
      teacher_name: teacherName,
      year_level: cls.year_level || parseInt(cls.section?.charAt(0)) || 1,
      student_count: cls.student_count || 30, // Use actual student count from class data
      required_room_type: labHours > 0 ? 'Laboratory' : 'Lecture Room',
      weekly_hours: weeklyHours || 3, // Default 3 hours if not specified
      requires_lab: labHours > 0,
      department: cls.department || '',
      lec_hours: lecHours,
      lab_hours: labHours,
      required_features: courseRequirements.get(courseId) || [],  // NEW: Required equipment tags
      college: cls.college || (cls as any).college || null  // NEW: College assignment for room separation
    }
  })
}

/**
 * Convert frontend rooms to backend format
 */
function convertRoomsToBackend(rooms: RoomData[], roomFeatures: Map<number, string[]>): any[] {
  console.log('🔄 Converting rooms - first room sample:', JSON.stringify(rooms[0] || {}, null, 2))
  return rooms.map(room => ({
    id: room.id,
    room_code: `${room.building}-${room.room}`,
    room_name: room.room,
    building: room.building,
    campus: room.campus,
    capacity: room.capacity,
    room_type: room.room_type,
    floor: room.floor_number,
    is_accessible: room.is_pwd_accessible ?? false,  // Required by Python backend
    feature_tags: roomFeatures.get(room.id) || [],  // NEW: Equipment tags from database
    college: (room as any).college || null  // NEW: College assignment for room separation
  }))
}

/**
 * Fallback local scheduler when Python backend is unavailable
 * Uses simple round-robin allocation to at least produce a schedule
 */
async function generateFallbackSchedule(body: RequestBody, sections: any[], rooms: any[], timeSlots: any[]): Promise<any> {
  const startTime = Date.now()
  const allocations: any[] = []
  const activeDays = body.active_days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  const onlineDays = body.online_days || []

  // Track room-day-time occupancy
  const occupancy = new Map<string, boolean>()

  // Helper: parse time string "7:00 AM" → minutes since midnight
  const parseTimeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i)
    if (!match) return 0
    let hours = parseInt(match[1])
    const mins = parseInt(match[2])
    const ampm = (match[3] || '').toUpperCase()
    if (ampm === 'PM' && hours !== 12) hours += 12
    if (ampm === 'AM' && hours === 12) hours = 0
    return hours * 60 + mins
  }

  // Student group helper
  const getStudentGroup = (sectionCode: string): string => {
    let code = (sectionCode || '').trim()
    for (const suffix of ['_LAB', '_LEC', '_lab', '_lec', '_Lab', '_Lec']) {
      if (code.endsWith(suffix)) return code.slice(0, -suffix.length)
    }
    return code
  }

  // Constants
  const LUNCH_START = (body.config.lunch_start_hour || 13) * 60
  const LUNCH_END = (body.config.lunch_end_hour || 14) * 60
  const NIGHT_THRESHOLD = 17 * 60 // 5:00 PM
  const LATE_START_THRESHOLD = 8 * 60 + 30 // 8:30 AM
  const MAX_CLASSES_PER_DAY = 4

  // Track group→day→count and group→day→latest_end
  const groupDayCounts = new Map<string, Map<string, number>>()    // group → day → count
  const groupDayLatestEnd = new Map<string, Map<string, number>>() // group → day → latest end minute
  const groupDayEarliestStart = new Map<string, Map<string, number>>() // group → day → earliest start minute

  const updateGroupTracking = (group: string, day: string, slotStart: number, slotEnd: number) => {
    if (!groupDayCounts.has(group)) groupDayCounts.set(group, new Map())
    const dc = groupDayCounts.get(group)!
    dc.set(day, (dc.get(day) || 0) + 1)

    if (!groupDayLatestEnd.has(group)) groupDayLatestEnd.set(group, new Map())
    const le = groupDayLatestEnd.get(group)!
    le.set(day, Math.max(le.get(day) || 0, slotEnd))

    if (!groupDayEarliestStart.has(group)) groupDayEarliestStart.set(group, new Map())
    const es = groupDayEarliestStart.get(group)!
    es.set(day, Math.min(es.get(day) ?? 24 * 60, slotStart))
  }

  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const getDayIndex = (d: string) => dayOrder.indexOf(d)
  const getPrevDay = (d: string) => {
    const idx = getDayIndex(d)
    return idx > 0 ? dayOrder[idx - 1] : null
  }
  const getNextDay = (d: string) => {
    const idx = getDayIndex(d)
    return idx >= 0 && idx < dayOrder.length - 1 ? dayOrder[idx + 1] : null
  }

  // Track group→day→courses (for same-course-same-day constraint)
  const groupDayCourses = new Map<string, Map<string, Set<string>>>() // group → day → set of course_codes

  const updateGroupCourseTracking = (group: string, day: string, courseCode: string) => {
    if (!courseCode) return
    if (!groupDayCourses.has(group)) groupDayCourses.set(group, new Map())
    const dc = groupDayCourses.get(group)!
    if (!dc.has(day)) dc.set(day, new Set())
    dc.get(day)!.add(courseCode)
  }

  // Track which days each course has been scheduled on (for 2-day gap constraint)
  const courseDayIndices = new Map<string, Set<number>>() // "group:courseCode" → set of day indices
  const MIN_COURSE_DAY_GAP = 2

  // Sort rooms by capacity (largest first) and sections by student count (largest first)
  const sortedRooms = [...rooms].sort((a, b) => b.capacity - a.capacity)
  const sortedSections = [...sections].sort((a, b) => b.student_count - a.student_count)

  let scheduledCount = 0

  for (const section of sortedSections) {
    // Calculate required 30-min slots: hours * 2 (since each hour = 2 thirty-minute slots)
    // Example: 5 hours = 10 slots = 2 sessions of 2.5 hours (5 slots each)
    const weeklyHours = section.weekly_hours || ((section.lec_hours || 0) + (section.lab_hours || 0)) || 3
    const requiredSlots = Math.max(2, weeklyHours * 2)
    let slotsAssigned = 0
    const group = getStudentGroup(section.section_code || '')
    const courseCode = section.course_code || ''
    const courseKey = `${group}:${courseCode}`

    // Try each day
    for (const day of activeDays) {
      if (slotsAssigned >= requiredSlots) break

      const isOnline = onlineDays.includes(day)
      const thisDayIdx = getDayIndex(day)

      // === Max 5 classes per day ===
      const currentDayCount = groupDayCounts.get(group)?.get(day.toLowerCase()) || 0
      if (currentDayCount >= MAX_CLASSES_PER_DAY) continue

      // === Same course must not appear twice on the same day ===
      if (courseCode && groupDayCourses.get(group)?.get(day.toLowerCase())?.has(courseCode)) continue

      // === Same course must be at least 2 days apart ===
      if (courseCode && courseDayIndices.has(courseKey)) {
        let tooClose = false
        for (const existingIdx of courseDayIndices.get(courseKey)!) {
          if (Math.abs(thisDayIdx - existingIdx) < MIN_COURSE_DAY_GAP) {
            tooClose = true
            break
          }
        }
        if (tooClose) continue
      }

      // === Night→morning constraint ===
      const prevDay = getPrevDay(day)
      if (prevDay) {
        const prevLatest = groupDayLatestEnd.get(group)?.get(prevDay.toLowerCase()) || 0
        if (prevLatest >= NIGHT_THRESHOLD) {
          // Previous day had a night class — check if this would be too early
          const earliest = groupDayEarliestStart.get(group)?.get(day.toLowerCase())
          if (earliest === undefined || earliest >= LATE_START_THRESHOLD) {
            // No classes yet or existing classes are late enough — only allow late starts
          }
        }
      }

      // Find compatible room
      const compatibleRoom = isOnline ? null : sortedRooms.find(r => {
        // 1. Room must have capacity >= student count (with 10% tolerance)
        const hasCapacity = r.capacity >= section.student_count * 0.9

        // 2. Match room type for labs
        const typeMatch = !section.requires_lab || r.room_type?.toLowerCase().includes('lab')

        // 3. Feature matching - room must have ALL required features (equipment tags)
        const sectionFeatures: string[] = section.required_features || []
        const roomFeatures: string[] = r.feature_tags || []
        const hasAllFeatures = sectionFeatures.length === 0 ||
          sectionFeatures.every((f: string) => roomFeatures.includes(f))

        // 4. College matching - room must match section college or be "Shared"
        const sectionCollege = section.college
        const roomCollege = r.college
        const collegeMatches = !sectionCollege || !roomCollege ||
          roomCollege === 'Shared' || roomCollege === sectionCollege

        return hasCapacity && typeMatch && hasAllFeatures && collegeMatches
      })

      if (!isOnline && !compatibleRoom) continue

      // Find available time slot
      for (let i = 0; i < timeSlots.length - 1; i++) {
        const slot = timeSlots[i]
        const nextSlot = timeSlots[i + 1]
        if (!nextSlot) continue

        const roomId = compatibleRoom?.id || 0
        const key = `${roomId}-${day}-${slot.id}`
        const nextKey = `${roomId}-${day}-${nextSlot?.id}`

        if (occupancy.get(key) || occupancy.get(nextKey)) continue

        const slotStart = parseTimeToMinutes(slot.start_time)
        const slotEnd = parseTimeToMinutes(nextSlot.end_time)

        // === Skip lunch break ===
        if (slotStart < LUNCH_END && slotEnd > LUNCH_START) continue

        // === Night→morning: skip too-early slots if previous day had night class ===
        if (prevDay) {
          const prevLatest = groupDayLatestEnd.get(group)?.get(prevDay.toLowerCase()) || 0
          if (prevLatest >= NIGHT_THRESHOLD && slotStart < LATE_START_THRESHOLD) continue
        }

        // === If this slot ends late (night), check next day ===
        if (slotEnd >= NIGHT_THRESHOLD) {
          const nd = getNextDay(day)
          if (nd) {
            const nextEarliest = groupDayEarliestStart.get(group)?.get(nd.toLowerCase())
            if (nextEarliest !== undefined && nextEarliest < LATE_START_THRESHOLD) continue
          }
        }

        // Mark as occupied
        occupancy.set(key, true)
        occupancy.set(nextKey, true)

        // Update tracking
        updateGroupTracking(group, day.toLowerCase(), slotStart, slotEnd)
        updateGroupCourseTracking(group, day.toLowerCase(), courseCode)
        // Track course day indices for gap constraint
        if (courseCode) {
          if (!courseDayIndices.has(courseKey)) courseDayIndices.set(courseKey, new Set())
          courseDayIndices.get(courseKey)!.add(thisDayIdx)
        }

        allocations.push({
          class_id: section.id,
          room_id: roomId,
          course_code: section.course_code || '',
          course_name: section.course_name || '',
          section: section.section_code || '',
          year_level: section.year_level || 1,
          schedule_day: day,
          schedule_time: `${slot.start_time} - ${nextSlot.end_time}`,
          campus: compatibleRoom?.campus || 'Online',
          building: compatibleRoom?.building || 'Virtual',
          room: compatibleRoom?.room_name || 'Online Class',
          capacity: compatibleRoom?.capacity || 0,
          teacher_name: section.teacher_name || '',
          department: section.department || '',
          lec_hours: section.lec_hours || 0,
          lab_hours: section.lab_hours || 0,
          is_online: isOnline
        })

        slotsAssigned += 2
        break
      }
    }

    if (slotsAssigned > 0) scheduledCount++
  }

  // ====================================================================
  // SINGLE-CLASS-DAY CONSOLIDATION
  // Post-process: detect student groups with only 1 class on a day
  // and attempt to move them to a day where the same group already has classes.
  // ====================================================================

  // Build group->day->allocations map
  const groupDayMapPost = new Map<string, Map<string, number[]>>() // group -> day -> allocation indices
  allocations.forEach((alloc, idx) => {
    const group = getStudentGroup(alloc.section)
    if (!groupDayMapPost.has(group)) groupDayMapPost.set(group, new Map())
    const dayMap = groupDayMapPost.get(group)!
    const day = (alloc.schedule_day || '').toLowerCase()
    if (!dayMap.has(day)) dayMap.set(day, [])
    dayMap.get(day)!.push(idx)
  })

  // For each group, find single-class days and try to move them
  for (const [group, dayMap] of groupDayMapPost) {
    const singleDays: string[] = []
    const multiDays: string[] = []
    for (const [day, indices] of dayMap) {
      if (indices.length === 1) singleDays.push(day)
      else if (indices.length >= 2 && indices.length < MAX_CLASSES_PER_DAY) multiDays.push(day)
    }

    for (const singleDay of singleDays) {
      const allocIdx = dayMap.get(singleDay)![0]
      const alloc = allocations[allocIdx]
      const roomId = alloc.room_id
      const allocCourseCode = alloc.course_code || ''

      // Try to move to a day where this group already has 2+ classes
      let moved = false
      for (const targetDay of multiDays) {
        // === Same course must not appear twice on the same day ===
        if (allocCourseCode) {
          const targetIndices = dayMap.get(targetDay) || []
          const targetCourses = new Set(targetIndices.map((idx: number) => allocations[idx].course_code || ''))
          if (targetCourses.has(allocCourseCode)) continue
        }

        // === Same course must be at least 2 days apart ===
        if (allocCourseCode) {
          const targetDayIdx = getDayIndex(targetDay.charAt(0).toUpperCase() + targetDay.slice(1))
          const sameCourseKey = `${group}:${allocCourseCode}`
          const existingDays = courseDayIndices.get(sameCourseKey)
          if (existingDays) {
            let tooClose = false
            for (const edi of existingDays) {
              if (Math.abs(targetDayIdx - edi) < MIN_COURSE_DAY_GAP && edi !== getDayIndex(singleDay.charAt(0).toUpperCase() + singleDay.slice(1))) {
                tooClose = true
                break
              }
            }
            if (tooClose) continue
          }
        }

        // Find a free time slot on the target day in the same or compatible room
        for (let i = 0; i < timeSlots.length - 1; i++) {
          const slot = timeSlots[i]
          const nextSlot = timeSlots[i + 1]
          if (!nextSlot) continue

          const slotStart = parseTimeToMinutes(slot.start_time)
          const slotEnd = parseTimeToMinutes(nextSlot.end_time)

          // Skip lunch break
          if (slotStart < LUNCH_END && slotEnd > LUNCH_START) continue

          const key1 = `${roomId}-${targetDay}-${slot.id}`
          const key2 = `${roomId}-${targetDay}-${nextSlot.id}`
          if (!occupancy.get(key1) && !occupancy.get(key2)) {
            // Free slot found — move the allocation
            alloc.schedule_day = targetDay.charAt(0).toUpperCase() + targetDay.slice(1)
            alloc.schedule_time = `${slot.start_time} - ${nextSlot.end_time}`
            occupancy.set(key1, true)
            occupancy.set(key2, true)
            moved = true
            break
          }
        }
        if (moved) break
      }
    }
  }

  const elapsed = Date.now() - startTime
  const successRate = (scheduledCount / Math.max(sortedSections.length, 1)) * 100

  // Save to database
  let scheduleId = 0
  let savedToDatabase = false

  // Resolve the correct group IDs from the request
  // Frontend sends campus_group_ids (array) and year_batch_id
  const resolvedCampusGroupId = body.campus_group_id || (body.campus_group_ids?.[0]) || 1
  const resolvedClassGroupId = body.class_group_id || body.year_batch_id || 1

  try {
    // Create schedule record
    const { data: scheduleData, error: scheduleError } = await supabase
      .from('generated_schedules')
      .insert({
        schedule_name: body.schedule_name,
        semester: body.semester,
        academic_year: body.academic_year,
        campus_group_id: resolvedCampusGroupId,
        class_group_id: resolvedClassGroupId,
        total_classes: sortedSections.length,
        scheduled_classes: scheduledCount,
        unscheduled_classes: sortedSections.length - scheduledCount,
        optimization_stats: {
          initial_cost: 0,
          final_cost: 0,
          iterations: 1,
          improvements: 0,
          quantum_tunnels: 0,
          time_elapsed_ms: elapsed,
          scheduler_type: 'fallback'
        },
        status: scheduledCount === sortedSections.length ? 'completed' : 'partial'
      })
      .select('id')
      .single()

    if (!scheduleError && scheduleData) {
      scheduleId = scheduleData.id

      // Save room allocations
      const roomAllocations = allocations.map(a => ({
        schedule_id: scheduleId,
        class_id: a.class_id,
        room_id: a.room_id || null,
        course_code: a.course_code,
        course_name: a.course_name,
        section: a.section,
        year_level: a.year_level,
        schedule_day: a.schedule_day,
        schedule_time: a.schedule_time,
        campus: a.campus,
        building: a.building,
        room: a.room,
        capacity: a.capacity,
        teacher_name: a.teacher_name || '',
        department: a.department,
        lec_hours: a.lec_hours,
        lab_hours: a.lab_hours,
        status: 'scheduled'
      }))

      if (roomAllocations.length > 0) {
        const { error: allocError } = await supabase
          .from('room_allocations')
          .insert(roomAllocations)

        if (!allocError) {
          savedToDatabase = true
          console.log(`✅ Saved ${roomAllocations.length} allocations to database`)
        } else {
          console.error('Error saving allocations:', allocError)
        }
      }
    } else {
      console.error('Error creating schedule:', scheduleError)
    }
  } catch (dbError) {
    console.error('Database error:', dbError)
  }

  return {
    success: scheduledCount === sortedSections.length,
    schedule_id: scheduleId,
    saved_to_database: savedToDatabase,
    message: `Fallback scheduler: ${scheduledCount}/${sortedSections.length} scheduled (${successRate.toFixed(1)}%)`,
    total_classes: sortedSections.length,
    scheduled_classes: scheduledCount,
    unscheduled_classes: sortedSections.length - scheduledCount,
    unscheduled_list: sortedSections
      .filter(s => !allocations.some(a => a.class_id === s.id))
      .map(s => ({
        id: s.id,
        section_code: s.section_code,
        course_code: s.course_code,
        course_name: s.course_name,
        reason: 'Could not find available room/time slot'
      })),
    conflicts: [],
    success_rate: successRate,
    online_days: onlineDays,
    online_class_count: allocations.filter(a => a.is_online).length,
    physical_class_count: allocations.filter(a => !a.is_online).length,
    optimization_stats: {
      initial_cost: 0,
      final_cost: 0,
      iterations: 1,
      improvements: 0,
      quantum_tunnels: 0,
      block_swaps: 0,
      conflict_count: 0,
      time_elapsed_ms: elapsed
    },
    allocations
  }
}

/**
 * Convert backend results back to frontend format
 */
function convertBackendResultToFrontend(backendResult: any, originalClasses: ClassData[], originalRooms: RoomData[]): any {
  // Handle validation errors from backend
  if (backendResult.validation_errors && backendResult.validation_errors.length > 0) {
    return {
      success: false,
      error: 'Data validation failed',
      validation_errors: backendResult.validation_errors,
      message: 'Data validation failed. Please fix the errors and try again.',
      total_classes: backendResult.total_sections || originalClasses.length,
      scheduled_classes: 0,
      unscheduled_classes: originalClasses.length,
      allocations: [],
      optimization_stats: {
        initial_cost: 0,
        final_cost: 0,
        iterations: 0,
        improvements: 0,
        quantum_tunnels: 0,
        block_swaps: 0,
        conflict_count: 0,
        time_elapsed_ms: 0
      }
    }
  }

  const allocations = backendResult.schedule_entries?.map((entry: any) => {
    const classData = originalClasses.find(c => c.id === entry.section_id)
    const roomData = originalRooms.find(r => r.id === entry.room_id)

    return {
      class_id: entry.section_id,
      room_id: entry.room_id,
      course_code: entry.course_code || classData?.course_code || 'N/A',
      course_name: entry.course_name || classData?.course_name || 'N/A',
      section: entry.section_code || classData?.section || 'N/A',
      year_level: entry.year_level || classData?.year_level || parseInt(classData?.section?.charAt(0) || '1') || 1,
      schedule_day: entry.day_of_week,
      schedule_time: `${entry.start_time || ''} - ${entry.end_time || ''}`,
      campus: entry.campus || roomData?.campus || 'N/A',
      building: entry.building || roomData?.building || 'N/A',
      room: entry.room_code || entry.room_name || roomData?.room || 'N/A',
      capacity: entry.capacity || roomData?.capacity || 0,
      teacher_name: entry.teacher_name || (classData as any)?.teacher_name || '',
      department: entry.department || classData?.department || 'N/A',
      lec_hours: entry.lec_hours || classData?.lec_hours || 0,
      lab_hours: entry.lab_hours || classData?.lab_hours || 0,
      is_online: entry.is_online || false  // BulSU QSA: Online class flag
    }
  }) || []

  // Calculate success rate
  const successRate = backendResult.total_sections > 0
    ? (backendResult.scheduled_sections / backendResult.total_sections * 100)
    : 0

  return {
    success: backendResult.success || (successRate >= 50), // Consider success if at least 50% scheduled
    schedule_id: backendResult.schedule_id,
    saved_to_database: true,
    message: backendResult.message || `QIA completed: ${backendResult.scheduled_sections}/${backendResult.total_sections} sections scheduled (${successRate.toFixed(1)}% success rate)`,
    total_classes: backendResult.total_sections,
    scheduled_classes: backendResult.scheduled_sections,
    unscheduled_classes: backendResult.unscheduled_sections,
    unscheduled_list: backendResult.unscheduled_list || [],
    conflicts: backendResult.conflicts || [],
    success_rate: successRate,
    // BulSU QSA: Online class stats
    online_days: backendResult.online_days || [],
    online_class_count: backendResult.online_class_count || 0,
    physical_class_count: backendResult.physical_class_count || 0,
    optimization_stats: {
      initial_cost: backendResult.optimization_stats?.initial_cost || 0,
      final_cost: backendResult.optimization_stats?.final_cost || 0,
      iterations: backendResult.optimization_stats?.iterations || 0,
      improvements: backendResult.optimization_stats?.improvements || 0,
      quantum_tunnels: backendResult.optimization_stats?.quantum_tunnels || 0,
      block_swaps: backendResult.optimization_stats?.block_swaps || 0,  // BulSU QSA
      conflict_count: backendResult.optimization_stats?.conflict_count || 0,  // BulSU QSA
      time_elapsed_ms: backendResult.optimization_stats?.time_elapsed_ms || 0
    },
    allocations
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json()
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🚀 [QIA Backend Bridge] Request received')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📋 Schedule Name:', body.schedule_name)
    console.log('🏢 Rooms:', body.rooms?.length)
    console.log('📚 Classes:', body.classes?.length)
    console.log('👨‍🏫 Teachers:', body.teachers?.length)
    console.log('⏰ Time Slots:', body.time_slots?.length)
    console.log('📅 Active Days:', body.active_days?.join(', '))
    console.log('🎛️ Config:', JSON.stringify(body.config, null, 2))

    // Validate request
    if (!body.schedule_name || !body.rooms || !body.classes) {
      console.error('❌ Validation failed: Missing required fields')
      return NextResponse.json(
        { success: false, error: 'Missing required fields: schedule_name, rooms, classes' },
        { status: 400 }
      )
    }

    if (body.rooms.length === 0) {
      console.error('❌ Validation failed: No rooms')
      return NextResponse.json(
        { success: false, error: 'No rooms provided for scheduling' },
        { status: 400 }
      )
    }

    if (body.classes.length === 0) {
      console.error('❌ Validation failed: No classes')
      return NextResponse.json(
        { success: false, error: 'No classes provided for scheduling' },
        { status: 400 }
      )
    }

    // ==================== Fetch Feature Tags from Database ====================
    console.log('🏷️ Fetching room features and course requirements...')

    // Fetch room features (room_id -> list of feature tag names)
    const roomIds = body.rooms.map(r => r.id)
    let roomFeatures = new Map<number, string[]>()

    try {
      const { data: roomFeaturesData, error: roomFeaturesError } = await supabase
        .from('room_features')
        .select(`
          room_id,
          feature_tags (tag_name)
        `)
        .in('room_id', roomIds)

      if (!roomFeaturesError && roomFeaturesData) {
        // Group by room_id
        roomFeaturesData.forEach((rf: any) => {
          const roomId = rf.room_id
          const tagName = rf.feature_tags?.tag_name
          if (tagName) {
            if (!roomFeatures.has(roomId)) {
              roomFeatures.set(roomId, [])
            }
            roomFeatures.get(roomId)!.push(tagName)
          }
        })
        console.log(`   ✅ Found features for ${roomFeatures.size} rooms`)
      }
    } catch (e) {
      console.warn('   ⚠️ Could not fetch room features (table may not exist yet)')
    }

    // Fetch course requirements (course_id -> list of required feature tag names)
    // Using the teaching_loads course_id (which links to class_schedules.id)
    const courseIds = body.classes.map(c => (c as any).course_id || c.id)
    let courseRequirements = new Map<number, string[]>()

    try {
      const { data: courseReqData, error: courseReqError } = await supabase
        .from('subject_room_requirements')
        .select(`
          course_id,
          is_mandatory,
          feature_tags (tag_name)
        `)
        .in('course_id', courseIds)
        .eq('is_mandatory', true)  // Only get mandatory requirements

      if (!courseReqError && courseReqData) {
        // Group by course_id
        courseReqData.forEach((cr: any) => {
          const courseId = cr.course_id
          const tagName = cr.feature_tags?.tag_name
          if (tagName) {
            if (!courseRequirements.has(courseId)) {
              courseRequirements.set(courseId, [])
            }
            courseRequirements.get(courseId)!.push(tagName)
          }
        })
        console.log(`   ✅ Found requirements for ${courseRequirements.size} courses`)
      }
    } catch (e) {
      console.warn('   ⚠️ Could not fetch course requirements (table may not exist yet)')
    }
    // ===========================================================================

    // Convert frontend data to backend format (with feature tags)
    const sections = convertClassesToSections(body.classes, courseRequirements)
    const rooms = convertRoomsToBackend(body.rooms, roomFeatures)
    const timeSlots = body.time_slots.map(slot => ({
      id: slot.id,
      slot_name: slot.slot_name,
      start_time: slot.start_time,
      end_time: slot.end_time,
      duration_minutes: slot.duration_minutes
    }))

    console.log('🔄 Data converted for Python backend')
    console.log('   Sections:', sections.length)
    console.log('   Rooms:', rooms.length)
    console.log('   Time Slots:', timeSlots.length)
    console.log('   First room converted:', JSON.stringify(rooms[0], null, 2))

    // Prepare payload for Python backend
    // Parse lunch times from "HH:MM" format to hours
    const parseLunchHour = (timeStr: string | number | undefined, defaultHour: number): number => {
      if (timeStr === undefined) return defaultHour
      if (typeof timeStr === 'number') return timeStr
      const parts = timeStr.split(':')
      return parseInt(parts[0], 10) || defaultHour
    }

    const lunchStartHour = parseLunchHour(body.config.lunch_start_hour, 13) // Default 1:00 PM
    const lunchEndHour = parseLunchHour(body.config.lunch_end_hour, 14) // Default 2:00 PM

    // Resolve the correct group IDs for Python backend
    const campusGroupId = body.campus_group_id || (body.campus_group_ids?.[0]) || 1
    const classGroupId = body.class_group_id || body.year_batch_id || 1

    const backendPayload = {
      schedule_name: body.schedule_name,
      semester: body.semester,
      academic_year: body.academic_year,
      campus_group_id: campusGroupId,  // Pass to Python for database storage
      class_group_id: classGroupId,     // Pass to Python for database storage
      section_ids: null, // Schedule all sections
      room_ids: null, // Use all rooms
      time_slots: timeSlots,
      active_days: body.active_days,
      online_days: body.online_days || [], // NEW: Pass online days to backend
      sections_data: sections,
      rooms_data: rooms,
      max_iterations: body.config.max_iterations,
      initial_temperature: body.config.initial_temperature,
      cooling_rate: body.config.cooling_rate,
      quantum_tunneling_probability: body.config.quantum_tunneling_probability,
      max_teacher_hours_per_day: body.config.max_teacher_hours_per_day,
      max_consecutive_hours: body.config.max_consecutive_hours, // NEW: Max hours before required break
      avoid_conflicts: body.config.avoid_conflicts,
      // NEW: Constraint settings for BulSU rules
      lunch_mode: body.config.lunch_mode || 'auto', // Default to auto mode
      lunch_start_hour: lunchStartHour,  // Only used if lunch_mode is 'strict'/'flexible'
      lunch_end_hour: lunchEndHour,      // Only used if lunch_mode is 'strict'/'flexible'
      strict_lab_room_matching: body.config.strict_lab_room_matching ?? true, // Lab classes MUST be in lab rooms
      strict_lecture_room_matching: body.config.strict_lecture_room_matching ?? true, // Lectures should NOT be in lab rooms
      // Split session settings - allow classes to be divided into multiple sessions
      allow_split_sessions: body.config.allow_split_sessions ?? true // Default: enabled
    }

    console.log('📡 Trying to connect to Python backend...')
    console.log('🌐 Online Days:', body.online_days?.join(', ') || 'None')
    console.log('🍽️ Lunch Mode:', backendPayload.lunch_mode)
    if (backendPayload.lunch_mode !== 'auto') {
      console.log('🍽️ Lunch Time:', `${backendPayload.lunch_start_hour}:00 - ${backendPayload.lunch_end_hour}:00`)
    } else {
      console.log('🍽️ Auto: 1hr mandatory break after 6hrs consecutive')
    }
    console.log('🔬 Strict Lab Matching:', backendPayload.strict_lab_room_matching)
    console.log('✂️ Allow Split Sessions:', backendPayload.allow_split_sessions)
    console.log('🌍 Environment:', isProduction ? 'Production' : 'Development')

    // In production (Vercel): Try Render first, then env URL
    // In development: Try local first, then Render
    const backendUrls = isProduction
      ? [
        // Production: Render first (most reliable for production)
        { url: ENV_BACKEND_URL || RENDER_BACKEND_URL, type: 'Primary (ENV/Render)', timeout: 300000 },
        { url: RENDER_BACKEND_URL, type: 'Render Fallback', timeout: 300000 }
      ]
      : [
        // Development: Local first, then Render
        { url: LOCAL_BACKEND_URL, type: 'Local', timeout: 180000 },
        { url: RENDER_BACKEND_URL, type: 'Render', timeout: 300000 }
      ]

    // Remove duplicate URLs
    const uniqueBackendUrls = backendUrls.filter((backend, index, arr) =>
      arr.findIndex(b => b.url === backend.url) === index
    )

    let backendResponse
    let usedBackendUrl = ''
    let lastError: any = null

    for (const backend of uniqueBackendUrls) {
      try {
        console.log(`🔄 Attempting ${backend.type} backend: ${backend.url}`)

        backendResponse = await fetch(`${backend.url}/api/schedules/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(backendPayload),
          signal: AbortSignal.timeout(backend.timeout)
        })

        usedBackendUrl = backend.url
        console.log(`✅ Connected to ${backend.type} backend successfully`)
        break // Success, exit the loop

      } catch (fetchError: any) {
        lastError = fetchError
        console.warn(`⚠️ ${backend.type} backend failed:`, fetchError.message)

        // Continue to next backend
        if (backend === uniqueBackendUrls[uniqueBackendUrls.length - 1]) {
          // This was the last backend, throw error
          console.error('❌ All backends failed')

          return NextResponse.json(
            {
              success: false,
              error: `Cannot connect to any Python backend. Tried: ${uniqueBackendUrls.map(b => b.url).join(', ')}`,
              details: 'Ensure at least one backend server is running. Using fallback scheduler...',
              local_backend: LOCAL_BACKEND_URL,
              render_backend: RENDER_BACKEND_URL
            },
            { status: 503 }
          )
        }
      }
    }

    if (!backendResponse) {
      // Fallback: Generate schedule locally using simple round-robin
      console.log('⚠️ No backend available, using fallback local scheduler')
      const fallbackResult = await generateFallbackSchedule(body, sections, rooms, timeSlots)
      return NextResponse.json(fallbackResult)
    }

    console.log('📨 Backend response status:', backendResponse.status)
    console.log('🎯 Using backend:', usedBackendUrl)

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text()
      console.error('❌ Backend error response:', errorText)

      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { error: errorText }
      }

      return NextResponse.json(
        {
          success: false,
          error: errorData.detail || errorData.error || 'Backend processing failed',
          backend_status: backendResponse.status
        },
        { status: backendResponse.status }
      )
    }

    const backendResult = await backendResponse.json()
    console.log('✅ Backend processing successful!')
    console.log('   Schedule ID:', backendResult.schedule_id)
    console.log('   Scheduled:', backendResult.scheduled_sections, '/', backendResult.total_sections)
    console.log('   Unscheduled:', backendResult.unscheduled_sections)

    // Convert backend response to frontend format
    const frontendResult = convertBackendResultToFrontend(
      backendResult,
      body.classes,
      body.rooms
    )

    console.log('🎉 Request completed successfully')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    return NextResponse.json(frontendResult)

  } catch (error: any) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.error('❌ [QIA Backend Bridge] Fatal error:', error)
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
