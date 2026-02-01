import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Backend URLs - Use environment variable first, then Render, then localhost for development
const ENV_BACKEND_URL = process.env.NEXT_PUBLIC_API_URL
const RENDER_BACKEND_URL = 'https://thesis-2-quantum-inspired.onrender.com'
const LOCAL_BACKEND_URL = 'http://localhost:8000'

// Determine if we're in production (Vercel)
const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
  campus_group_id: number
  class_group_id: number
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
    avoid_conflicts: boolean
    online_days?: string[] // NEW: Days where all classes are online
    // NEW: Constraint settings
    lunch_mode?: 'strict' | 'flexible' | 'none' // Lunch break enforcement
    lunch_start_hour?: number // Default 12
    lunch_end_hour?: number // Default 13
    strict_lab_room_matching?: boolean // Lab classes must be in lab rooms
    strict_lecture_room_matching?: boolean // Lecture classes should not be in lab rooms
    // Split session settings
    allow_split_sessions?: boolean // Allow splitting classes into multiple sessions (e.g., 3hr class -> 1.5hr Mon + 1.5hr Thu)
  }
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
    
    // Get required features for this course (based on course_id from class_schedules table)
    const courseId = (cls as any).course_id || cls.id
    
    return {
      id: typeof cls.id === 'number' ? cls.id : index + 1, // Ensure numeric ID
      section_code: cls.section || `SEC-${index + 1}`,
      course_code: cls.course_code || '',
      course_name: cls.course_name || '',
      teacher_id: 0, // Default - no teacher constraint (will be mapped if teachers provided)
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
  
  // Sort rooms by capacity (largest first) and sections by student count (largest first)
  const sortedRooms = [...rooms].sort((a, b) => b.capacity - a.capacity)
  const sortedSections = [...sections].sort((a, b) => b.student_count - a.student_count)
  
  let scheduledCount = 0
  
  for (const section of sortedSections) {
    // Calculate required slots (minimum 2 = 1 hour)
    const requiredSlots = Math.max(2, Math.ceil((section.weekly_hours || 180) / 30))
    let slotsAssigned = 0
    
    // Try each day
    for (const day of activeDays) {
      if (slotsAssigned >= requiredSlots) break
      
      const isOnline = onlineDays.includes(day)
      
      // Find compatible room
      const compatibleRoom = isOnline ? null : sortedRooms.find(r => {
        // Room must have capacity >= student count (with 10% tolerance)
        const hasCapacity = r.capacity >= section.student_count * 0.9
        // Match room type for labs
        const typeMatch = !section.requires_lab || r.room_type?.toLowerCase().includes('lab')
        return hasCapacity && typeMatch
      })
      
      if (!isOnline && !compatibleRoom) continue
      
      // Find available time slot
      for (let i = 0; i < timeSlots.length - 1; i++) {
        const slot = timeSlots[i]
        const roomId = compatibleRoom?.id || 0
        const key = `${roomId}-${day}-${slot.id}`
        
        if (!occupancy.get(key)) {
          // Allocate 2 consecutive slots (1 hour)
          const nextSlot = timeSlots[i + 1]
          const nextKey = `${roomId}-${day}-${nextSlot?.id}`
          
          if (!nextSlot || occupancy.get(nextKey)) continue
          
          // Mark as occupied
          occupancy.set(key, true)
          occupancy.set(nextKey, true)
          
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
    }
    
    if (slotsAssigned > 0) scheduledCount++
  }
  
  const elapsed = Date.now() - startTime
  const successRate = (scheduledCount / Math.max(sortedSections.length, 1)) * 100
  
  // Save to database
  let scheduleId = 0
  let savedToDatabase = false
  
  try {
    // Create schedule record
    const { data: scheduleData, error: scheduleError } = await supabase
      .from('generated_schedules')
      .insert({
        schedule_name: body.schedule_name,
        semester: body.semester,
        academic_year: body.academic_year,
        campus_group_id: body.campus_group_id || 1,
        class_group_id: body.class_group_id || 1,
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
    const parseLunchHour = (timeStr: string | undefined, defaultHour: number): number => {
      if (!timeStr) return defaultHour
      const parts = timeStr.split(':')
      return parseInt(parts[0], 10) || defaultHour
    }
    
    const lunchStartHour = parseLunchHour(body.config.lunch_start_time, 13) // Default 1:00 PM
    const lunchEndHour = parseLunchHour(body.config.lunch_end_time, 14) // Default 2:00 PM
    
    const backendPayload = {
      schedule_name: body.schedule_name,
      semester: body.semester,
      academic_year: body.academic_year,
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
      avoid_conflicts: body.config.avoid_conflicts,
      // NEW: Constraint settings for BulSU rules
      // Use lunch_break_enabled to determine mode, and parse time strings to hours
      lunch_mode: body.config.lunch_break_enabled === false ? 'none' : (body.config.lunch_mode || 'strict'),
      lunch_start_hour: lunchStartHour,
      lunch_end_hour: lunchEndHour,
      strict_lab_room_matching: body.config.strict_lab_room_matching ?? true, // Lab classes MUST be in lab rooms
      strict_lecture_room_matching: body.config.strict_lecture_room_matching ?? true, // Lectures should NOT be in lab rooms
      // Split session settings - allow classes to be divided into multiple sessions
      allow_split_sessions: body.config.allow_split_sessions ?? true // Default: enabled
    }

    console.log('📡 Trying to connect to Python backend...')
    console.log('🌐 Online Days:', body.online_days?.join(', ') || 'None')
    console.log('🍽️ Lunch Mode:', backendPayload.lunch_mode)
    console.log('🍽️ Lunch Time:', `${backendPayload.lunch_start_hour}:00 - ${backendPayload.lunch_end_hour}:00`)
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
