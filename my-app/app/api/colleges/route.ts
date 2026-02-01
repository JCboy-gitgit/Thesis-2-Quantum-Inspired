import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseKey
  })
}

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null

export interface BulSUCollege {
  id: number
  code: string
  name: string
  short_name?: string
  color?: string
  is_active: boolean
  display_order: number
  created_at?: string
  updated_at?: string
}

// Default colleges for fallback
const DEFAULT_COLLEGES: BulSUCollege[] = [
  { id: 1, code: 'CAFA', name: 'College of Architecture and Fine Arts', short_name: 'Architecture & Fine Arts', display_order: 1, is_active: true },
  { id: 2, code: 'CAL', name: 'College of Arts and Letters', short_name: 'Arts & Letters', display_order: 2, is_active: true },
  { id: 3, code: 'CBEA', name: 'College of Business Education and Accountancy', short_name: 'Business Education', display_order: 3, is_active: true },
  { id: 4, code: 'CCJE', name: 'College of Criminal Justice Education', short_name: 'Criminal Justice', display_order: 4, is_active: true },
  { id: 5, code: 'CHTM', name: 'College of Hospitality and Tourism Management', short_name: 'Hospitality & Tourism', display_order: 5, is_active: true },
  { id: 6, code: 'CICT', name: 'College of Information and Communications Technology', short_name: 'Info & Comm Tech', display_order: 6, is_active: true },
  { id: 7, code: 'CIT', name: 'College of Industrial Technology', short_name: 'Industrial Technology', display_order: 7, is_active: true },
  { id: 8, code: 'CLaw', name: 'College of Law', short_name: 'Law', display_order: 8, is_active: true },
  { id: 9, code: 'CN', name: 'College of Nursing', short_name: 'Nursing', display_order: 9, is_active: true },
  { id: 10, code: 'COE', name: 'College of Engineering', short_name: 'Engineering', display_order: 10, is_active: true },
  { id: 11, code: 'COED', name: 'College of Education', short_name: 'Education', display_order: 11, is_active: true },
  { id: 12, code: 'CS', name: 'College of Science', short_name: 'Science', display_order: 12, is_active: true },
  { id: 13, code: 'CSER', name: 'College of Sports, Exercise and Recreation', short_name: 'Sports & Recreation', display_order: 13, is_active: true },
  { id: 14, code: 'CSSP', name: 'College of Social Sciences and Philosophy', short_name: 'Social Sciences', display_order: 14, is_active: true },
  { id: 15, code: 'GS', name: 'Graduate School', short_name: 'Graduate School', display_order: 15, is_active: true }
]

// GET - Fetch all colleges
export async function GET(request: NextRequest) {
  try {
    // Check if Supabase client is initialized
    if (!supabase) {
      console.warn('Supabase client not initialized - returning default colleges')
      return NextResponse.json({
        colleges: DEFAULT_COLLEGES,
        isDefault: true
      })
    }

    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') !== 'false'

    let query = supabase
      .from('bulsu_colleges')
      .select('*')
      .order('display_order', { ascending: true })

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) {
      // If table doesn't exist, return defaults
      if (error.code === '42P01') {
        console.warn('bulsu_colleges table does not exist - returning defaults')
        return NextResponse.json({
          colleges: DEFAULT_COLLEGES,
          isDefault: true,
          message: 'Using default colleges. Run the SQL migration to enable database storage.'
        })
      }
      console.error('Supabase query error:', error)
      throw error
    }

    // If no data, return defaults
    if (!data || data.length === 0) {
      return NextResponse.json({
        colleges: DEFAULT_COLLEGES,
        isDefault: true
      })
    }

    return NextResponse.json({
      colleges: data,
      isDefault: false
    })

  } catch (error: any) {
    console.error('Error fetching colleges:', error)
    // Return defaults on error
    return NextResponse.json({
      colleges: DEFAULT_COLLEGES,
      isDefault: true,
      error: error.message
    })
  }
}

// POST - Create a new college
export async function POST(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { code, name, short_name, color, is_active = true, display_order } = body

    if (!code || !name) {
      return NextResponse.json(
        { error: 'Code and name are required' },
        { status: 400 }
      )
    }

    // Get max display_order if not provided
    let order = display_order
    if (!order) {
      const { data: maxOrder } = await supabase
        .from('bulsu_colleges')
        .select('display_order')
        .order('display_order', { ascending: false })
        .limit(1)
        .single()
      order = (maxOrder?.display_order || 0) + 1
    }

    const { data, error } = await supabase
      .from('bulsu_colleges')
      .insert({
        code: code.toUpperCase(),
        name,
        short_name,
        color,
        is_active,
        display_order: order
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') { // Unique violation
        return NextResponse.json(
          { error: 'College code already exists' },
          { status: 409 }
        )
      }
      throw error
    }

    return NextResponse.json({ college: data }, { status: 201 })

  } catch (error: any) {
    console.error('Error creating college:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create college' },
      { status: 500 }
    )
  }
}

// PUT - Update a college
export async function PUT(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { id, code, name, short_name, color, is_active, display_order } = body

    if (!id) {
      return NextResponse.json(
        { error: 'College ID is required' },
        { status: 400 }
      )
    }

    const updateData: any = { updated_at: new Date().toISOString() }
    if (code !== undefined) updateData.code = code.toUpperCase()
    if (name !== undefined) updateData.name = name
    if (short_name !== undefined) updateData.short_name = short_name
    if (color !== undefined) updateData.color = color
    if (is_active !== undefined) updateData.is_active = is_active
    if (display_order !== undefined) updateData.display_order = display_order

    const { data, error } = await supabase
      .from('bulsu_colleges')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'College code already exists' },
          { status: 409 }
        )
      }
      throw error
    }

    return NextResponse.json({ college: data })

  } catch (error: any) {
    console.error('Error updating college:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update college' },
      { status: 500 }
    )
  }
}

// DELETE - Remove a college
export async function DELETE(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'College ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('bulsu_colleges')
      .delete()
      .eq('id', parseInt(id))

    if (error) throw error

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Error deleting college:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete college' },
      { status: 500 }
    )
  }
}
