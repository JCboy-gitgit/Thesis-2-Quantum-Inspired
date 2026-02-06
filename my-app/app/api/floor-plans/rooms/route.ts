import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Force dynamic - disable caching to always get fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (url, options = {}) => fetch(url, { ...options, cache: 'no-store' }),
  },
})

// GET - Fetch rooms from campuses table for drag and drop
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const building = searchParams.get('building')
    const floorNumber = searchParams.get('floor')
    const searchQuery = searchParams.get('search')
    const uploadGroupId = searchParams.get('uploadGroupId')

    let query = supabase
      .from('campuses')
      .select('*')
      .eq('status', 'active')
      .order('room', { ascending: true })

    // Filter by building
    if (building) {
      query = query.eq('building', building)
    }

    // Filter by floor
    if (floorNumber) {
      query = query.eq('floor_number', parseInt(floorNumber))
    }

    // Filter by upload group
    if (uploadGroupId) {
      query = query.eq('upload_group_id', parseInt(uploadGroupId))
    }

    // Search by room name
    if (searchQuery) {
      query = query.or(`room.ilike.%${searchQuery}%,building.ilike.%${searchQuery}%`)
    }

    const { data, error } = await query.limit(100)

    if (error) throw error

    // Transform data for the map editor
    const rooms = (data || []).map(room => ({
      id: room.id,
      name: room.room,
      building: room.building,
      campus: room.campus,
      capacity: room.capacity,
      floorNumber: room.floor_number,
      isFirstFloor: room.is_first_floor,
      roomType: room.room_type,
      hasAC: room.has_ac,
      hasProjector: room.has_projector,
      hasWhiteboard: room.has_whiteboard,
      isPWDAccessible: room.is_pwd_accessible,
      status: room.status,
      notes: room.notes
    }))

    // Get unique buildings for filtering
    const { data: buildings } = await supabase
      .from('campuses')
      .select('building')
      .eq('status', 'active')

    const uniqueBuildings = [...new Set((buildings || []).map(b => b.building))].filter(Boolean)

    return NextResponse.json({
      success: true,
      data: {
        rooms,
        buildings: uniqueBuildings,
        total: rooms.length
      }
    })

  } catch (error) {
    console.error('Error fetching rooms:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch rooms' },
      { status: 500 }
    )
  }
}
