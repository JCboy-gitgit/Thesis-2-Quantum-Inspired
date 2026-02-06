import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Force dynamic - disable caching to always get fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

const normalizeDay = (day: string): string => {
  const dayMap: Record<string, string> = {
    M: 'Monday',
    MON: 'Monday',
    MONDAY: 'Monday',
    T: 'Tuesday',
    TUE: 'Tuesday',
    TUESDAY: 'Tuesday',
    W: 'Wednesday',
    WED: 'Wednesday',
    WEDNESDAY: 'Wednesday',
    TH: 'Thursday',
    THU: 'Thursday',
    THURSDAY: 'Thursday',
    F: 'Friday',
    FRI: 'Friday',
    FRIDAY: 'Friday',
    S: 'Saturday',
    SAT: 'Saturday',
    SATURDAY: 'Saturday',
    SU: 'Sunday',
    SUN: 'Sunday',
    SUNDAY: 'Sunday'
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

const parseTimeTo24 = (timeStr: string): string | null => {
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
  if (!match) return null
  let hour = parseInt(match[1], 10)
  const minute = match[2]
  const period = match[3]?.toUpperCase()

  if (period === 'PM' && hour !== 12) hour += 12
  if (period === 'AM' && hour === 12) hour = 0

  return `${hour.toString().padStart(2, '0')}:${minute}:00`
}

const parseScheduleTime = (scheduleTime: string) => {
  const parts = scheduleTime.split('-').map(p => p.trim())
  if (parts.length !== 2) return { start: null, end: null }
  return {
    start: parseTimeTo24(parts[0]),
    end: parseTimeTo24(parts[1])
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient()
    const body = await request.json()
    const userId = String(body.userId || '').trim()
    const scheduleId = body.scheduleId ? Number(body.scheduleId) : null
    const scope = String(body.scope || 'class')
    const roomAllocationId = body.roomAllocationId ? Number(body.roomAllocationId) : null
    const dayOfWeek = body.dayOfWeek ? String(body.dayOfWeek) : null
    const courseCode = body.courseCode ? String(body.courseCode) : null
    const section = body.section ? String(body.section) : null
    const startTime = body.startTime ? String(body.startTime) : null
    const endTime = body.endTime ? String(body.endTime) : null
    const startDate = body.startDate ? String(body.startDate) : null
    const endDate = body.endDate ? String(body.endDate) : null
    const reason = body.reason ? String(body.reason) : null

    if (!userId || !scheduleId) {
      return NextResponse.json({ error: 'Missing userId or scheduleId' }, { status: 400 })
    }

    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email')
      .eq('id', userId)
      .single()

    const { data: profileData } = await supabaseAdmin
      .from('faculty_profiles')
      .select('full_name')
      .eq('email', userData?.email || '')
      .maybeSingle()

    const facultyName = profileData?.full_name || userData?.full_name || ''

    const { data: attendanceRow, error: attendanceError } = await supabaseAdmin
      .from('faculty_attendance')
      .insert({
        faculty_user_id: userId,
        schedule_id: scheduleId,
        room_allocation_id: roomAllocationId,
        scope,
        day_of_week: dayOfWeek,
        start_date: startDate,
        end_date: endDate,
        start_time: startTime ? parseTimeTo24(startTime) : null,
        end_time: endTime ? parseTimeTo24(endTime) : null,
        status: 'absent',
        reason
      })
      .select()
      .single()

    if (attendanceError) {
      return NextResponse.json({ error: attendanceError.message }, { status: 500 })
    }

    const { data: allocations } = await supabaseAdmin
      .from('room_allocations')
      .select('*')
      .eq('schedule_id', scheduleId)

    const affected = (allocations || []).filter((alloc: any) => {
      if (roomAllocationId && alloc.id !== roomAllocationId) return false
      if (scope === 'class') {
        if (roomAllocationId) return alloc.id === roomAllocationId
        const matchesCourse = courseCode ? alloc.course_code === courseCode : true
        const matchesSection = section ? alloc.section === section : true
        const matchesDay = dayOfWeek
          ? expandDays(alloc.schedule_day || '').includes(normalizeDay(dayOfWeek))
          : true
        const time = parseScheduleTime(alloc.schedule_time || '')
        const matchesStart = startTime ? time.start?.startsWith(startTime.substring(0, 5)) : true
        const matchesEnd = endTime ? time.end?.startsWith(endTime.substring(0, 5)) : true
        return matchesCourse && matchesSection && matchesDay && matchesStart && matchesEnd
      }
      if (scope === 'day' && dayOfWeek) {
        return expandDays(alloc.schedule_day || '').includes(normalizeDay(dayOfWeek))
      }
      if (scope === 'week' || scope === 'range') {
        return facultyName ? String(alloc.teacher_name || '').includes(facultyName) : true
      }
      return false
    })

    const availabilityRows = affected
      .map((alloc: any) => {
        const days = expandDays(alloc.schedule_day || '')
        return days.map(day => {
          const time = parseScheduleTime(alloc.schedule_time || '')
          if (!time.start || !time.end) return null
          return {
            campus: alloc.campus,
            building: alloc.building,
            room: alloc.room,
            day_of_week: day,
            start_time: time.start,
            end_time: time.end,
            is_available: true,
            booked_by: facultyName || 'Faculty',
            booking_purpose: 'Faculty absence',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        })
      })
      .flat()
      .filter(Boolean)

    if (availabilityRows.length > 0) {
      await supabaseAdmin.from('room_availability').insert(availabilityRows as any)
    }

    return NextResponse.json({ success: true, attendance: attendanceRow })
  } catch (error: any) {
    console.error('Attendance POST error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to record attendance' }, { status: 500 })
  }
}
