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

// GET - Fetch all rooms with optional equipment data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeFeatures = searchParams.get('includeFeatures') === 'true'
    const courseCode = searchParams.get('courseCode')

    // STEP 1: Fetch ALL rooms from campuses table
    const { data: roomData, error: roomError } = await supabaseAdmin
      .from('campuses')
      .select('id, room, building, campus, capacity, room_type, specific_classification, college')
      .order('building', { ascending: true })
      .order('room', { ascending: true })

    if (roomError) {
      console.error('[rooms-list] Error fetching rooms:', roomError)
      throw new Error('Failed to load rooms: ' + roomError.message)
    }

    const rooms = roomData || []
    console.log(`[rooms-list] Loaded ${rooms.length} rooms`)

    let roomFeatures: Record<string, any[]> = {}
    let courseRequirements: any[] = []

    // STEP 2: Optionally fetch room equipment/features
    if (includeFeatures) {
      try {
        const { data: featuresData, error: featuresError } = await supabaseAdmin
          .from('room_features')
          .select(`id, room_id, quantity, feature_tag_id, feature_tags ( id, tag_name, tag_category, description, icon )`)

        if (featuresError) {
          console.warn('[rooms-list] room_features error:', featuresError.message)
        } else if (featuresData) {
          featuresData.forEach((f: any) => {
            const tag = f.feature_tags
            if (!tag) return
            const roomId = String(f.room_id)
            if (!roomFeatures[roomId]) roomFeatures[roomId] = []
            roomFeatures[roomId].push({
              feature_id: tag.id,
              tag_name: tag.tag_name,
              tag_category: tag.tag_category || 'general',
              quantity: f.quantity || 1,
              description: tag.description || '',
              icon: tag.icon || ''
            })
          })
        }
      } catch (e: any) {
        console.warn('[rooms-list] features exception:', e.message)
      }

      // STEP 3: Optionally fetch course requirements
      if (courseCode) {
        try {
          const { data: csData } = await supabaseAdmin
            .from('class_schedules')
            .select('id, course_code')
            .ilike('course_code', courseCode)

          if (csData && csData.length > 0) {
            const courseIds = [...new Set(csData.map((c: any) => c.id))]

            const { data: reqData } = await supabaseAdmin
              .from('subject_room_requirements')
              .select(`id, course_id, is_mandatory, min_quantity, feature_tags ( id, tag_name, tag_category, description )`)
              .in('course_id', courseIds)

            if (reqData && reqData.length > 0) {
              const seen = new Set<number>()
              reqData.forEach((r: any) => {
                const tag = r.feature_tags
                if (!tag || seen.has(tag.id)) return
                seen.add(tag.id)
                courseRequirements.push({
                  feature_id: tag.id,
                  tag_name: tag.tag_name,
                  tag_category: tag.tag_category || 'general',
                  is_mandatory: r.is_mandatory ?? true,
                  min_quantity: r.min_quantity || 1,
                  description: tag.description || ''
                })
              })
            }
          }
        } catch (e: any) {
          console.warn('[rooms-list] course requirements exception:', e.message)
        }
      }
    }

    return NextResponse.json({
      success: true,
      rooms,
      roomFeatures,
      courseRequirements
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      }
    })
  } catch (error: any) {
    console.error('[rooms-list] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch rooms' },
      { status: 500 }
    )
  }
}
