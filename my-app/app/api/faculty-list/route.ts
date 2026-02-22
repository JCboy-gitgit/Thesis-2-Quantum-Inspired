import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const fetchWithNoCache = (url: RequestInfo | URL, options: RequestInit = {}) =>
  fetch(url, { ...options, cache: 'no-store' })

let _supabaseAdmin: ReturnType<typeof createClient> | null = null
const supabaseAdmin = new Proxy({} as ReturnType<typeof createClient>, {
  get(_, prop) {
    if (!_supabaseAdmin) {
      _supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { fetch: fetchWithNoCache } }
      )
    }
    return (_supabaseAdmin as any)[prop]
  },
})

// GET - Fetch all faculty profiles with teaching load data (mirrors TeachingLoadAssignment page)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const courseCode = searchParams.get('courseCode')
    const classId = searchParams.get('classId')

    // STEP 1: Fetch ALL active faculty profiles (same as TeachingLoadAssignment)
    const { data: allFacultyData, error: fError } = await supabaseAdmin
      .from('faculty_profiles')
      .select('*')
      .eq('is_active', true)
      .order('full_name', { ascending: true })

    if (fError) {
      console.error('[faculty-list] Error fetching faculty:', fError)
      throw new Error('Failed to load faculty: ' + fError.message)
    }

    // STEP 2: Fetch ALL teaching loads with joined class_schedules (same as TeachingLoadAssignment)
    const { data: teachingLoadsData, error: tlError } = await supabaseAdmin
      .from('teaching_loads')
      .select(`
        *,
        class_schedules:course_id (
          id,
          course_code,
          course_name,
          section,
          lec_hours,
          lab_hours,
          semester,
          academic_year,
          department,
          college,
          degree_program,
          year_level
        )
      `)
      .order('created_at', { ascending: false })

    if (tlError) {
      console.warn('[faculty-list] teaching_loads error:', tlError.message)
    }

    // STEP 3: Find eligible faculty for this specific course
    let eligibleIds: string[] = []

    if (courseCode && teachingLoadsData) {
      // Match teaching loads where the joined class_schedule's course_code matches
      const matchingLoads = teachingLoadsData.filter((tl: any) => {
        const cs = tl.class_schedules
        return cs && cs.course_code && cs.course_code.toLowerCase() === courseCode.trim().toLowerCase()
      })

      if (matchingLoads.length > 0) {
        eligibleIds = [...new Set(matchingLoads.map((tl: any) => tl.faculty_id))]
        console.log(`[faculty-list] Found ${eligibleIds.length} eligible faculty for "${courseCode}" via teaching_loads`)
      } else {
        console.log(`[faculty-list] No teaching_loads match course "${courseCode}"`)
      }

      // Fallback: try class_id directly
      if (eligibleIds.length === 0 && classId) {
        const directLoads = (teachingLoadsData || []).filter((tl: any) => tl.course_id === parseInt(classId))
        if (directLoads.length > 0) {
          eligibleIds = [...new Set(directLoads.map((tl: any) => tl.faculty_id))]
          console.log(`[faculty-list] Found ${eligibleIds.length} faculty via class_id fallback`)
        }
      }
    }

    // STEP 4: Build per-faculty teaching load summary
    const facultyLoadMap = new Map<string, any[]>()
    if (teachingLoadsData) {
      teachingLoadsData.forEach((tl: any) => {
        if (!facultyLoadMap.has(tl.faculty_id)) {
          facultyLoadMap.set(tl.faculty_id, [])
        }
        facultyLoadMap.get(tl.faculty_id)!.push({
          course_code: tl.class_schedules?.course_code || '',
          course_name: tl.class_schedules?.course_name || '',
          section: tl.section || tl.class_schedules?.section || '',
          semester: tl.semester || tl.class_schedules?.semester || '',
          academic_year: tl.academic_year || tl.class_schedules?.academic_year || '',
          lec_hours: tl.class_schedules?.lec_hours || 0,
          lab_hours: tl.class_schedules?.lab_hours || 0,
        })
      })
    }

    const faculty = (allFacultyData || []).map((f: any) => ({
      id: f.id,
      full_name: f.full_name,
      email: f.email,
      department: f.department,
      college: f.college,
      specialization: f.specialization,
      position: f.position,
      employment_type: f.employment_type,
      isEligible: eligibleIds.includes(f.id),
      teachingLoadCount: facultyLoadMap.get(f.id)?.length || 0,
      teachingLoads: facultyLoadMap.get(f.id) || []
    }))

    console.log(`[faculty-list] Loaded ${faculty.length} faculty profiles, ${eligibleIds.length} eligible for "${courseCode}"`)

    return NextResponse.json({
      success: true,
      faculty,
      eligibleIds
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      }
    })
  } catch (error: any) {
    console.error('[faculty-list] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch faculty' },
      { status: 500 }
    )
  }
}
