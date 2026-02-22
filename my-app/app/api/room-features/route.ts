import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Cache-busting wrapper to prevent Next.js from caching Supabase requests
const fetchWithNoCache = (url: RequestInfo | URL, options: RequestInit = {}) =>
  fetch(url, { ...options, cache: 'no-store' })

let _supabase: ReturnType<typeof createClient> | null = null
const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_, prop) {
    if (!_supabase) {
      _supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { fetch: fetchWithNoCache } }
      )
    }
    return (_supabase as any)[prop]
  },
})

// Force dynamic - disable caching to always get fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

// ==================== GET - Fetch feature tags and room features ====================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'tags'
    const roomId = searchParams.get('room_id')
    const courseId = searchParams.get('course_id')

    if (action === 'tags') {
      // Get all feature tags
      const { data, error } = await supabase
        .from('feature_tags')
        .select('*')
        .order('tag_category', { ascending: true })
        .order('tag_name', { ascending: true })

      if (error) throw error
      return NextResponse.json({ success: true, data })
    }

    if (action === 'room_features' && roomId) {
      // Get features for a specific room
      const { data, error } = await supabase
        .from('room_features')
        .select(`
          id,
          room_id,
          feature_tag_id,
          quantity,
          notes,
          feature_tags (
            id,
            tag_name,
            tag_category,
            description,
            icon
          )
        `)
        .eq('room_id', parseInt(roomId))

      if (error) throw error
      return NextResponse.json({ success: true, data })
    }

    if (action === 'all_room_features') {
      // Get all room features (used by course mode to know which tags are available)
      const { data, error } = await supabase
        .from('room_features')
        .select('feature_tag_id')

      if (error) throw error
      return NextResponse.json({ success: true, data })
    }

    if (action === 'subject_requirements' && courseId) {
      // Get requirements for a specific course
      const { data, error } = await supabase
        .from('subject_room_requirements')
        .select(`
          id,
          course_id,
          feature_tag_id,
          is_mandatory,
          min_quantity,
          notes,
          feature_tags (
            id,
            tag_name,
            tag_category,
            description,
            icon
          )
        `)
        .eq('course_id', parseInt(courseId))

      if (error) throw error
      return NextResponse.json({ success: true, data })
    }

    if (action === 'room_features_summary') {
      // Get all rooms with their features summary
      const { data, error } = await supabase
        .from('room_features_summary')
        .select('*')

      if (error) throw error
      return NextResponse.json({ success: true, data })
    }

    if (action === 'subject_requirements_summary') {
      // Get all courses with their requirements summary
      const { data, error } = await supabase
        .from('subject_requirements_summary')
        .select('*')

      if (error) throw error
      return NextResponse.json({ success: true, data })
    }

    if (action === 'compatible_rooms' && courseId) {
      // Get rooms compatible with a course's requirements
      const minCapacity = parseInt(searchParams.get('min_capacity') || '1')

      const { data, error } = await supabase
        .rpc('get_compatible_rooms_for_subject', {
          p_course_id: parseInt(courseId),
          p_min_capacity: minCapacity
        })

      if (error) throw error
      return NextResponse.json({ success: true, data })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })

  } catch (error: any) {
    console.error('Room features API error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// ==================== POST - Add features to room or requirements to course ====================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === 'add_room_feature') {
      const { room_id, feature_tag_id, quantity, notes } = body

      const { data, error } = await supabase
        .from('room_features')
        .upsert({
          room_id,
          feature_tag_id,
          quantity: quantity || 1,
          notes
        }, {
          onConflict: 'room_id,feature_tag_id'
        })
        .select()

      if (error) throw error
      return NextResponse.json({ success: true, data, message: 'Feature added to room' })
    }

    if (action === 'add_subject_requirement') {
      const { course_id, feature_tag_id, is_mandatory, min_quantity, notes } = body

      // Check for existing requirement to handle merging logic (LEC + LAB = BOTH)
      const { data: existing } = await supabase
        .from('subject_room_requirements')
        .select('notes')
        .eq('course_id', course_id)
        .eq('feature_tag_id', feature_tag_id)
        .maybeSingle()

      let finalNotes = notes
      if (existing) {
        const oldNotes = (existing.notes || '').toUpperCase()
        const newNotes = (notes || '').toUpperCase()

        // Merge logic
        if ((oldNotes === 'LEC' && newNotes === 'LAB') ||
          (oldNotes === 'LAB' && newNotes === 'LEC')) {
          finalNotes = 'BOTH'
        } else if (oldNotes === 'BOTH') {
          finalNotes = 'BOTH'
        }
      }

      const { data, error } = await supabase
        .from('subject_room_requirements')
        .upsert({
          course_id,
          feature_tag_id,
          is_mandatory: is_mandatory ?? true,
          min_quantity: min_quantity || 1,
          notes: finalNotes
        }, {
          onConflict: 'course_id,feature_tag_id'
        })
        .select()

      if (error) throw error
      return NextResponse.json({ success: true, data, message: 'Requirement added to course' })
    }

    if (action === 'bulk_add_room_features') {
      const { room_id, feature_tag_ids } = body

      const features = feature_tag_ids.map((tag_id: number) => ({
        room_id,
        feature_tag_id: tag_id,
        quantity: 1
      }))

      const { data, error } = await supabase
        .from('room_features')
        .upsert(features, {
          onConflict: 'room_id,feature_tag_id'
        })
        .select()

      if (error) throw error
      return NextResponse.json({ success: true, data, message: 'Features added to room' })
    }

    if (action === 'bulk_add_subject_requirements') {
      const { course_id, feature_tag_ids, is_mandatory } = body

      const requirements = feature_tag_ids.map((tag_id: number) => ({
        course_id,
        feature_tag_id: tag_id,
        is_mandatory: is_mandatory ?? true,
        min_quantity: 1
      }))

      const { data, error } = await supabase
        .from('subject_room_requirements')
        .upsert(requirements, {
          onConflict: 'course_id,feature_tag_id'
        })
        .select()

      if (error) throw error
      return NextResponse.json({ success: true, data, message: 'Requirements added to course' })
    }

    if (action === 'create_tag') {
      const { tag_name, tag_category, description, icon } = body

      const { data, error } = await supabase
        .from('feature_tags')
        .insert({
          tag_name,
          tag_category: tag_category || 'general',
          description,
          icon
        })
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ success: true, data, message: 'Tag created' })
    }

    if (action === 'update_tag') {
      const { id, tag_name, tag_category, description, icon } = body

      if (!id) throw new Error('Tag ID is required for update')

      const { data, error } = await supabase
        .from('feature_tags')
        .update({
          tag_name,
          tag_category,
          description,
          icon
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ success: true, data, message: 'Tag updated' })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })

  } catch (error: any) {
    console.error('Room features API error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// ==================== DELETE - Remove features from room or requirements from course ====================
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const id = searchParams.get('id')
    const roomId = searchParams.get('room_id')
    const courseId = searchParams.get('course_id')
    const featureTagId = searchParams.get('feature_tag_id')

    if (action === 'remove_room_feature' && id) {
      const { error } = await supabase
        .from('room_features')
        .delete()
        .eq('id', parseInt(id))

      if (error) throw error
      return NextResponse.json({ success: true, message: 'Feature removed from room' })
    }

    if (action === 'remove_room_feature_by_tag' && roomId && featureTagId) {
      const { error } = await supabase
        .from('room_features')
        .delete()
        .eq('room_id', parseInt(roomId))
        .eq('feature_tag_id', parseInt(featureTagId))

      if (error) throw error
      return NextResponse.json({ success: true, message: 'Feature removed from room' })
    }

    if (action === 'remove_subject_requirement' && id) {
      const { error } = await supabase
        .from('subject_room_requirements')
        .delete()
        .eq('id', parseInt(id))

      if (error) throw error
      return NextResponse.json({ success: true, message: 'Requirement removed from course' })
    }

    if (action === 'remove_subject_requirement_by_tag' && courseId && featureTagId) {
      const { error } = await supabase
        .from('subject_room_requirements')
        .delete()
        .eq('course_id', parseInt(courseId))
        .eq('feature_tag_id', parseInt(featureTagId))

      if (error) throw error
      return NextResponse.json({ success: true, message: 'Requirement removed from course' })
    }

    if (action === 'clear_room_features' && roomId) {
      const { error } = await supabase
        .from('room_features')
        .delete()
        .eq('room_id', parseInt(roomId))

      if (error) throw error
      return NextResponse.json({ success: true, message: 'All features removed from room' })
    }

    if (action === 'clear_subject_requirements' && courseId) {
      const { error } = await supabase
        .from('subject_room_requirements')
        .delete()
        .eq('course_id', parseInt(courseId))

      if (error) throw error
      return NextResponse.json({ success: true, message: 'All requirements removed from course' })
    }

    if (action === 'delete_tag' && id) {
      const { error } = await supabase
        .from('feature_tags')
        .delete()
        .eq('id', parseInt(id))

      if (error) throw error
      return NextResponse.json({ success: true, message: 'Global tag deleted' })
    }

    return NextResponse.json({ success: false, error: 'Invalid action or missing parameters' }, { status: 400 })

  } catch (error: any) {
    console.error('Room features API error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
