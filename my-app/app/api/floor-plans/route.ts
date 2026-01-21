import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper to check if tables exist
async function checkTablesExist() {
  try {
    // Try to query buildings table
    const { error } = await supabase
      .from('buildings')
      .select('id')
      .limit(1)
    
    // If relation doesn't exist, return false
    if (error && error.code === '42P01') {
      return false
    }
    return true
  } catch {
    return false
  }
}

// GET - Fetch all buildings with their floor plans
export async function GET(request: NextRequest) {
  try {
    // Check if tables exist first
    const tablesExist = await checkTablesExist()
    if (!tablesExist) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'Floor plan tables not yet created. Please run the database schema first.'
      })
    }

    const { searchParams } = new URL(request.url)
    const buildingId = searchParams.get('buildingId')
    const floorPlanId = searchParams.get('floorPlanId')
    const includeElements = searchParams.get('includeElements') === 'true'
    const isPublished = searchParams.get('isPublished')
    const isDefault = searchParams.get('isDefault')

    // If fetching a specific floor plan
    if (floorPlanId) {
      const { data: floorPlan, error } = await supabase
        .from('floor_plans')
        .select(`
          *,
          buildings (*)
        `)
        .eq('id', floorPlanId)
        .single()

      if (error) throw error

      // Get elements if requested
      let elements = []
      if (includeElements) {
        const { data: elemData, error: elemError } = await supabase
          .from('floor_plan_elements')
          .select('*')
          .eq('floor_plan_id', floorPlanId)
          .order('z_index', { ascending: true })

        if (elemError) throw elemError
        elements = elemData || []
      }

      return NextResponse.json({
        success: true,
        data: { ...floorPlan, elements }
      })
    }

    // If fetching floor plans for a specific building
    if (buildingId) {
      let query = supabase
        .from('floor_plans')
        .select('*')
        .eq('building_id', buildingId)
        .order('floor_number', { ascending: true })

      if (isPublished) {
        query = query.eq('is_published', isPublished === 'true')
      }

      const { data, error } = await query
      if (error) throw error

      return NextResponse.json({
        success: true,
        data
      })
    }

    // Fetch all buildings with floor plan count
    let query = supabase
      .from('buildings')
      .select(`
        *,
        floor_plans (id, floor_number, floor_name, is_default_view, is_published, status)
      `)
      .order('name', { ascending: true })

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({
      success: true,
      data
    })

  } catch (error) {
    console.error('Error fetching floor plans:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch floor plans' },
      { status: 500 }
    )
  }
}

// POST - Create new building or floor plan
export async function POST(request: NextRequest) {
  try {
    // Check if tables exist first
    const tablesExist = await checkTablesExist()
    if (!tablesExist) {
      return NextResponse.json({
        success: false,
        error: 'Floor plan tables not yet created. Please run the database schema in Supabase SQL Editor first. Check database/floor_plans_schema.sql for the SQL script.',
        needsSetup: true
      }, { status: 400 })
    }

    const body = await request.json()
    const { type, data } = body

    if (type === 'building') {
      const { data: building, error } = await supabase
        .from('buildings')
        .insert([{
          name: data.name,
          code: data.code,
          campus: data.campus,
          school_name: data.school_name,
          description: data.description,
          total_floors: data.total_floors || 1,
          status: 'active'
        }])
        .select()
        .single()

      if (error) {
        console.error('Error creating building:', error)
        throw error
      }

      return NextResponse.json({
        success: true,
        data: building,
        message: 'Building created successfully'
      })
    }

    if (type === 'floor_plan') {
      // If setting as default, unset other defaults for this building
      if (data.is_default_view) {
        await supabase
          .from('floor_plans')
          .update({ is_default_view: false })
          .eq('building_id', data.building_id)
      }

      const { data: floorPlan, error } = await supabase
        .from('floor_plans')
        .insert([{
          building_id: data.building_id,
          floor_number: data.floor_number || 1,
          floor_name: data.floor_name,
          canvas_data: data.canvas_data || {},
          canvas_width: data.canvas_width || 1200,
          canvas_height: data.canvas_height || 800,
          grid_size: data.grid_size || 20,
          background_color: data.background_color || '#ffffff',
          is_default_view: data.is_default_view || false,
          is_published: data.is_published || false,
          status: data.status || 'draft'
        }])
        .select()
        .single()

      if (error) throw error

      return NextResponse.json({
        success: true,
        data: floorPlan,
        message: 'Floor plan created successfully'
      })
    }

    if (type === 'elements') {
      // Batch insert elements
      const elements = data.elements.map((elem: any) => ({
        floor_plan_id: data.floor_plan_id,
        element_type: elem.type,
        element_id: elem.id,
        x: elem.x,
        y: elem.y,
        width: elem.width,
        height: elem.height,
        rotation: elem.rotation || 0,
        z_index: elem.zIndex || 0,
        properties: elem.properties || {},
        linked_room_id: elem.linkedRoomId,
        label: elem.label,
        color: elem.color,
        border_color: elem.borderColor,
        font_size: elem.fontSize,
        is_locked: elem.isLocked || false,
        is_visible: elem.isVisible !== false
      }))

      const { data: insertedElements, error } = await supabase
        .from('floor_plan_elements')
        .insert(elements)
        .select()

      if (error) throw error

      return NextResponse.json({
        success: true,
        data: insertedElements,
        message: `${insertedElements.length} elements saved`
      })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid type specified' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Error creating floor plan:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create floor plan' },
      { status: 500 }
    )
  }
}

// PUT - Update floor plan or building
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, id, data } = body

    if (type === 'building') {
      const { data: building, error } = await supabase
        .from('buildings')
        .update({
          name: data.name,
          code: data.code,
          campus: data.campus,
          school_name: data.school_name,
          description: data.description,
          total_floors: data.total_floors
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      return NextResponse.json({
        success: true,
        data: building,
        message: 'Building updated successfully'
      })
    }

    if (type === 'floor_plan') {
      // If setting as default, unset other defaults
      if (data.is_default_view) {
        await supabase
          .from('floor_plans')
          .update({ is_default_view: false })
          .eq('building_id', data.building_id)
          .neq('id', id)
      }

      // Save version history before updating
      const { data: currentPlan } = await supabase
        .from('floor_plans')
        .select('canvas_data, version')
        .eq('id', id)
        .single()

      if (currentPlan) {
        await supabase
          .from('floor_plan_versions')
          .insert([{
            floor_plan_id: id,
            version_number: currentPlan.version || 1,
            canvas_data: currentPlan.canvas_data,
            change_description: 'Auto-saved version'
          }])
      }

      const { data: floorPlan, error } = await supabase
        .from('floor_plans')
        .update({
          floor_name: data.floor_name,
          floor_number: data.floor_number,
          canvas_data: data.canvas_data,
          canvas_width: data.canvas_width,
          canvas_height: data.canvas_height,
          grid_size: data.grid_size,
          background_color: data.background_color,
          background_image_url: data.background_image_url,
          is_default_view: data.is_default_view,
          is_published: data.is_published,
          status: data.status,
          version: (currentPlan?.version || 0) + 1
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      return NextResponse.json({
        success: true,
        data: floorPlan,
        message: 'Floor plan saved successfully'
      })
    }

    if (type === 'elements') {
      // Delete existing elements and insert new ones
      await supabase
        .from('floor_plan_elements')
        .delete()
        .eq('floor_plan_id', id)

      if (data.elements && data.elements.length > 0) {
        const elements = data.elements.map((elem: any) => ({
          floor_plan_id: id,
          element_type: elem.type,
          element_id: elem.id,
          x: elem.x,
          y: elem.y,
          width: elem.width,
          height: elem.height,
          rotation: elem.rotation || 0,
          z_index: elem.zIndex || 0,
          properties: elem.properties || {},
          linked_room_id: elem.linkedRoomId,
          label: elem.label,
          color: elem.color,
          border_color: elem.borderColor,
          font_size: elem.fontSize,
          is_locked: elem.isLocked || false,
          is_visible: elem.isVisible !== false
        }))

        const { error } = await supabase
          .from('floor_plan_elements')
          .insert(elements)

        if (error) throw error
      }

      return NextResponse.json({
        success: true,
        message: 'Elements updated successfully'
      })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid type specified' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Error updating floor plan:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update floor plan' },
      { status: 500 }
    )
  }
}

// DELETE - Delete building or floor plan
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const id = searchParams.get('id')

    if (!type || !id) {
      return NextResponse.json(
        { success: false, error: 'Type and ID are required' },
        { status: 400 }
      )
    }

    if (type === 'building') {
      const { error } = await supabase
        .from('buildings')
        .delete()
        .eq('id', id)

      if (error) throw error

      return NextResponse.json({
        success: true,
        message: 'Building deleted successfully'
      })
    }

    if (type === 'floor_plan') {
      const { error } = await supabase
        .from('floor_plans')
        .delete()
        .eq('id', id)

      if (error) throw error

      return NextResponse.json({
        success: true,
        message: 'Floor plan deleted successfully'
      })
    }

    if (type === 'element') {
      const { error } = await supabase
        .from('floor_plan_elements')
        .delete()
        .eq('id', id)

      if (error) throw error

      return NextResponse.json({
        success: true,
        message: 'Element deleted successfully'
      })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid type specified' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Error deleting:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete' },
      { status: 500 }
    )
  }
}
