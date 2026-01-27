import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

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
  schedule_day: string
  schedule_time: string
  lec_hours: number
  lab_hours: number
  total_hours: number
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

interface ScheduleConfig {
  max_iterations: number
  initial_temperature: number
  cooling_rate: number
  quantum_tunneling_probability: number
  max_teacher_hours_per_day: number
  prioritize_accessibility: boolean
  avoid_conflicts: boolean
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
  config: ScheduleConfig
}

// Quantum-Inspired Annealing Algorithm for Room Allocation
function runQIAScheduling(
  rooms: RoomData[], 
  classes: ClassData[], 
  teachers: TeacherData[],
  config: ScheduleConfig
): { allocations: any[], stats: any } {
  const startTime = Date.now()
  
  // Initialize allocation map
  const allocations: any[] = []
  let unscheduledCount = 0
  
  // Group classes by day and time
  const classMap = new Map<string, ClassData[]>()
  classes.forEach(cls => {
    const key = `${cls.schedule_day}|${cls.schedule_time}`
    if (!classMap.has(key)) {
      classMap.set(key, [])
    }
    classMap.get(key)!.push(cls)
  })
  
  // Track room usage
  const roomUsage = new Map<string, Set<string>>() // room_id -> Set of day|time
  
  // Simulated annealing parameters
  let temperature = config.initial_temperature
  const coolingRate = config.cooling_rate
  let initialCost = 0
  let currentCost = 0
  let improvementCount = 0
  let tunnelCount = 0
  
  // Initial greedy assignment
  classes.forEach(cls => {
    // Find available rooms for this time slot
    const availableRooms = rooms.filter(room => {
      const roomKey = `${room.id}`
      const slotKey = `${cls.schedule_day}|${cls.schedule_time}`
      
      if (!roomUsage.has(roomKey)) {
        roomUsage.set(roomKey, new Set())
      }
      
      return !roomUsage.get(roomKey)!.has(slotKey)
    })
    
    if (availableRooms.length === 0) {
      unscheduledCount++
      return
    }
    
    // Sort by capacity (prefer rooms that fit but aren't too big)
    availableRooms.sort((a, b) => {
      const estimatedStudents = 30 // Default estimate
      const diffA = Math.abs(a.capacity - estimatedStudents)
      const diffB = Math.abs(b.capacity - estimatedStudents)
      return diffA - diffB
    })
    
    // Prioritize first floor for accessibility if enabled
    if (config.prioritize_accessibility) {
      availableRooms.sort((a, b) => {
        if (a.is_pwd_accessible && !b.is_pwd_accessible) return -1
        if (!a.is_pwd_accessible && b.is_pwd_accessible) return 1
        return 0
      })
    }
    
    const selectedRoom = availableRooms[0]
    
    // Mark room as used
    const roomKey = `${selectedRoom.id}`
    const slotKey = `${cls.schedule_day}|${cls.schedule_time}`
    roomUsage.get(roomKey)!.add(slotKey)
    
    allocations.push({
      class_id: cls.id,
      room_id: selectedRoom.id,
      course_code: cls.course_code,
      course_name: cls.course_name,
      section: cls.section,
      schedule_day: cls.schedule_day,
      schedule_time: cls.schedule_time,
      campus: selectedRoom.campus,
      building: selectedRoom.building,
      room: selectedRoom.room,
      capacity: selectedRoom.capacity,
      department: cls.department,
      lec_hours: cls.lec_hours,
      lab_hours: cls.lab_hours
    })
  })
  
  // Calculate initial cost
  initialCost = calculateCost(allocations, rooms, config)
  currentCost = initialCost
  
  // Run optimization iterations
  for (let i = 0; i < config.max_iterations; i++) {
    // Select random allocation to modify
    if (allocations.length === 0) break
    
    const idx = Math.floor(Math.random() * allocations.length)
    const allocation = allocations[idx]
    
    // Find alternative rooms
    const slotKey = `${allocation.schedule_day}|${allocation.schedule_time}`
    const alternativeRooms = rooms.filter(room => {
      if (room.id === allocation.room_id) return false
      
      const roomKey = `${room.id}`
      if (!roomUsage.has(roomKey)) return true
      return !roomUsage.get(roomKey)!.has(slotKey)
    })
    
    if (alternativeRooms.length === 0) continue
    
    // Select random alternative
    const newRoom = alternativeRooms[Math.floor(Math.random() * alternativeRooms.length)]
    
    // Calculate new cost
    const oldRoom = rooms.find(r => r.id === allocation.room_id)!
    const costDelta = calculateSwapCost(allocation, oldRoom, newRoom, config)
    
    // Acceptance probability
    let accept = false
    if (costDelta < 0) {
      accept = true
      improvementCount++
    } else {
      // Simulated annealing acceptance
      const acceptProb = Math.exp(-costDelta / temperature)
      if (Math.random() < acceptProb) {
        accept = true
      }
      
      // Quantum tunneling
      if (!accept && Math.random() < config.quantum_tunneling_probability) {
        accept = true
        tunnelCount++
      }
    }
    
    if (accept) {
      // Update room usage
      const oldRoomKey = `${allocation.room_id}`
      const newRoomKey = `${newRoom.id}`
      
      roomUsage.get(oldRoomKey)?.delete(slotKey)
      if (!roomUsage.has(newRoomKey)) {
        roomUsage.set(newRoomKey, new Set())
      }
      roomUsage.get(newRoomKey)!.add(slotKey)
      
      // Update allocation
      allocation.room_id = newRoom.id
      allocation.campus = newRoom.campus
      allocation.building = newRoom.building
      allocation.room = newRoom.room
      allocation.capacity = newRoom.capacity
      
      currentCost += costDelta
    }
    
    // Cool down
    temperature *= coolingRate
  }
  
  const endTime = Date.now()
  
  return {
    allocations,
    stats: {
      initial_cost: initialCost,
      final_cost: currentCost,
      iterations: config.max_iterations,
      improvements: improvementCount,
      quantum_tunnels: tunnelCount,
      time_elapsed_ms: endTime - startTime,
      scheduled_classes: allocations.length,
      unscheduled_classes: unscheduledCount
    }
  }
}

function calculateCost(allocations: any[], rooms: RoomData[], config: ScheduleConfig): number {
  let cost = 0
  
  allocations.forEach(allocation => {
    const room = rooms.find(r => r.id === allocation.room_id)
    if (!room) return
    
    // Capacity mismatch penalty
    const estimatedStudents = 30
    cost += Math.abs(room.capacity - estimatedStudents) * 0.5
    
    // Accessibility penalty
    if (config.prioritize_accessibility && !room.is_pwd_accessible) {
      cost += 10
    }
  })
  
  return cost
}

function calculateSwapCost(allocation: any, oldRoom: RoomData, newRoom: RoomData, config: ScheduleConfig): number {
  let delta = 0
  const estimatedStudents = 30
  
  // Capacity improvement
  const oldCapDiff = Math.abs(oldRoom.capacity - estimatedStudents)
  const newCapDiff = Math.abs(newRoom.capacity - estimatedStudents)
  delta += (newCapDiff - oldCapDiff) * 0.5
  
  // Accessibility improvement
  if (config.prioritize_accessibility) {
    if (!oldRoom.is_pwd_accessible && newRoom.is_pwd_accessible) {
      delta -= 10
    } else if (oldRoom.is_pwd_accessible && !newRoom.is_pwd_accessible) {
      delta += 10
    }
  }
  
  return delta
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json()
    console.log('[QIA Schedule] Request received:', body.schedule_name)
    console.log('[QIA Schedule] Rooms:', body.rooms?.length, 'Classes:', body.classes?.length)

    // Validate request
    if (!body.schedule_name || !body.rooms || !body.classes) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (body.rooms.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No rooms provided for scheduling' },
        { status: 400 }
      )
    }

    if (body.classes.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No classes provided for scheduling' },
        { status: 400 }
      )
    }

    // Run the QIA scheduling algorithm
    const result = runQIAScheduling(
      body.rooms,
      body.classes,
      body.teachers || [],
      body.config
    )

    console.log('[QIA Schedule] Optimization complete:', result.stats)
    console.log('[QIA Schedule] Allocations generated:', result.allocations.length)

    // Try to save to database
    let scheduleId: number | null = null
    let savedToDatabase = false

    try {
      // First check if tables exist by trying a simple query
      const { error: checkError } = await supabase
        .from('generated_schedules')
        .select('id')
        .limit(1)

      if (checkError) {
        console.log('[QIA Schedule] generated_schedules table may not exist:', checkError.message)
      } else {
        // Insert generated schedule record
        const { data: scheduleData, error: scheduleError } = await supabase
          .from('generated_schedules')
          .insert({
            schedule_name: body.schedule_name,
            semester: body.semester,
            academic_year: body.academic_year,
            campus_group_id: body.campus_group_id,
            class_group_id: body.class_group_id,
            teacher_group_id: body.teacher_group_id,
            total_classes: body.classes.length,
            scheduled_classes: result.stats.scheduled_classes,
            unscheduled_classes: result.stats.unscheduled_classes,
            optimization_stats: result.stats
          })
          .select()
          .single()

        if (scheduleError) {
          console.error('[QIA Schedule] Error saving schedule:', scheduleError)
        } else if (scheduleData) {
          scheduleId = scheduleData.id
          savedToDatabase = true
          console.log('[QIA Schedule] Schedule saved with ID:', scheduleId)

          // Insert room allocations
          if (result.allocations.length > 0) {
            const allocationsToInsert = result.allocations.map(a => ({
              schedule_id: scheduleId,
              class_id: a.class_id,
              room_id: a.room_id,
              course_code: a.course_code,
              course_name: a.course_name,
              section: a.section,
              schedule_day: a.schedule_day,
              schedule_time: a.schedule_time,
              campus: a.campus,
              building: a.building,
              room: a.room,
              capacity: a.capacity,
              department: a.department,
              lec_hours: a.lec_hours,
              lab_hours: a.lab_hours
            }))

            const { error: allocError } = await supabase
              .from('room_allocations')
              .insert(allocationsToInsert)

            if (allocError) {
              console.error('[QIA Schedule] Error saving allocations:', allocError)
            } else {
              console.log('[QIA Schedule] Allocations saved:', allocationsToInsert.length)
            }
          }
        }
      }
    } catch (dbError) {
      console.error('[QIA Schedule] Database error:', dbError)
    }

    // Always return success with allocations data
    return NextResponse.json({
      success: true,
      schedule_id: scheduleId || Date.now(),
      saved_to_database: savedToDatabase,
      message: savedToDatabase 
        ? 'Schedule generated and saved successfully using QIA Algorithm'
        : 'Schedule generated successfully (not saved to database - run SQL schema first)',
      total_classes: body.classes.length,
      scheduled_classes: result.stats.scheduled_classes,
      unscheduled_classes: result.stats.unscheduled_classes,
      conflicts: [],
      optimization_stats: result.stats,
      allocations: result.allocations // Always include allocations for display
    })

  } catch (error: any) {
    console.error('[QIA Schedule] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
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
