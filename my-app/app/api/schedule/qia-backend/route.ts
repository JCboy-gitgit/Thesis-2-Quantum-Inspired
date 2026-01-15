import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Backend URLs - Try local first, then fall back to Render
const LOCAL_BACKEND_URL = 'http://localhost:8000'
const RENDER_BACKEND_URL = 'https://thesis-2-quantum-inspired.onrender.com'

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
  credit_units: number
  department: string
  semester: string
  academic_year: string
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
    prioritize_accessibility: boolean
    avoid_conflicts: boolean
  }
}

/**
 * Convert frontend classes to backend sections format
 */
function convertClassesToSections(classes: ClassData[]): any[] {
  return classes.map(cls => ({
    id: cls.id,
    section_code: cls.section,
    course_code: cls.course_code,
    course_name: cls.course_name,
    teacher_id: 0, // Default - no teacher constraint (will be mapped if teachers provided)
    teacher_name: 'TBD',
    year_level: cls.year_level || parseInt(cls.section?.charAt(0)) || 1,
    student_count: cls.student_count || 30, // Use actual student count from class data
    required_room_type: cls.lab_hours > 0 ? 'Laboratory' : 'Lecture',
    weekly_hours: (cls.lec_hours + cls.lab_hours) * 60, // Convert to minutes
    requires_lab: cls.lab_hours > 0,
    department: cls.department
  }))
}

/**
 * Convert frontend rooms to backend format
 */
function convertRoomsToBackend(rooms: RoomData[]): any[] {
  return rooms.map(room => ({
    id: room.id,
    room_code: `${room.building}-${room.room}`,
    room_name: room.room,
    building: room.building,
    campus: room.campus,
    capacity: room.capacity,
    room_type: room.room_type,
    floor: room.floor_number,
    is_accessible: room.is_pwd_accessible
  }))
}

/**
 * Convert backend results back to frontend format
 */
function convertBackendResultToFrontend(backendResult: any, originalClasses: ClassData[], originalRooms: RoomData[]): any {
  const allocations = backendResult.schedule_entries?.map((entry: any) => {
    const classData = originalClasses.find(c => c.id === entry.section_id)
    const roomData = originalRooms.find(r => r.id === entry.room_id)
    
    return {
      class_id: entry.section_id,
      room_id: entry.room_id,
      course_code: classData?.course_code || 'N/A',
      course_name: classData?.course_name || 'N/A',
      section: classData?.section || 'N/A',
      year_level: classData?.year_level || parseInt(classData?.section?.charAt(0) || '1') || 1,
      schedule_day: entry.day_of_week,
      schedule_time: entry.time_slot_name || entry.start_time,
      campus: roomData?.campus || 'N/A',
      building: roomData?.building || 'N/A',
      room: roomData?.room || 'N/A',
      capacity: roomData?.capacity || 0,
      department: classData?.department || 'N/A',
      lec_hours: classData?.lec_hours || 0,
      lab_hours: classData?.lab_hours || 0
    }
  }) || []

  return {
    success: backendResult.success,
    schedule_id: backendResult.schedule_id,
    saved_to_database: true,
    message: backendResult.message,
    total_classes: backendResult.total_sections,
    scheduled_classes: backendResult.scheduled_sections,
    unscheduled_classes: backendResult.unscheduled_sections,
    unscheduled_list: backendResult.unscheduled_list || [],
    conflicts: backendResult.conflicts || [],
    optimization_stats: {
      initial_cost: backendResult.optimization_stats?.initial_cost || 0,
      final_cost: backendResult.optimization_stats?.final_cost || 0,
      iterations: backendResult.optimization_stats?.iterations || 0,
      improvements: backendResult.optimization_stats?.improvements || 0,
      quantum_tunnels: backendResult.optimization_stats?.quantum_tunnels || 0,
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

    // Convert frontend data to backend format
    const sections = convertClassesToSections(body.classes)
    const rooms = convertRoomsToBackend(body.rooms)
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

    // Prepare payload for Python backend
    const backendPayload = {
      schedule_name: body.schedule_name,
      semester: body.semester,
      academic_year: body.academic_year,
      section_ids: null, // Schedule all sections
      room_ids: null, // Use all rooms
      time_slots: timeSlots,
      active_days: body.active_days,
      sections_data: sections,
      rooms_data: rooms,
      max_iterations: body.config.max_iterations,
      initial_temperature: body.config.initial_temperature,
      cooling_rate: body.config.cooling_rate,
      max_teacher_hours_per_day: body.config.max_teacher_hours_per_day,
      prioritize_accessibility: body.config.prioritize_accessibility
    }

    console.log('📡 Trying to connect to Python backend...')
    
    // Try local backend first, then fall back to Render
    const backendUrls = [
      { url: LOCAL_BACKEND_URL, type: 'Local' },
      { url: RENDER_BACKEND_URL, type: 'Render' }
    ]
    
    let backendResponse
    let usedBackendUrl = ''
    let lastError: any = null
    
    for (const backend of backendUrls) {
      try {
        console.log(`🔄 Attempting ${backend.type} backend: ${backend.url}`)
        
        backendResponse = await fetch(`${backend.url}/api/schedules/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(backendPayload),
          signal: AbortSignal.timeout(5000) // 5 second timeout for connection attempt
        })
        
        usedBackendUrl = backend.url
        console.log(`✅ Connected to ${backend.type} backend successfully`)
        break // Success, exit the loop
        
      } catch (fetchError: any) {
        lastError = fetchError
        console.warn(`⚠️ ${backend.type} backend failed:`, fetchError.message)
        
        // Continue to next backend
        if (backend === backendUrls[backendUrls.length - 1]) {
          // This was the last backend, throw error
          console.error('❌ All backends failed')
          
          return NextResponse.json(
            { 
              success: false,
              error: `Cannot connect to any Python backend. Tried: ${backendUrls.map(b => b.url).join(', ')}`,
              details: 'Ensure at least one backend server is running.',
              local_backend: LOCAL_BACKEND_URL,
              render_backend: RENDER_BACKEND_URL
            },
            { status: 503 }
          )
        }
      }
    }
    
    if (!backendResponse) {
      throw new Error('No backend response received')
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
