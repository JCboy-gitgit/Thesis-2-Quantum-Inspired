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

// GET - Fetch all departments
export async function GET(request: NextRequest) {
  try {
    // Check if Supabase client is initialized
    if (!supabase) {
      console.error('Supabase client not initialized - missing environment variables')
      return NextResponse.json(
        {
          error: 'Database configuration error',
          departments: [],
          groupedByCollege: {}
        },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') !== 'false'

    let query = supabase
      .from('departments')
      .select('*')
      .order('college', { ascending: true })
      .order('department_name', { ascending: true })

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) {
      console.error('Supabase query error:', error)
      throw error
    }

    // Group by college for easier frontend rendering
    const groupedByCollege = data?.reduce((acc: any, dept: any) => {
      const college = dept.college || 'Other'
      if (!acc[college]) {
        acc[college] = []
      }
      acc[college].push(dept)
      return acc
    }, {})

    return NextResponse.json({
      departments: data || [],
      groupedByCollege
    })

  } catch (error: any) {
    console.error('Error fetching departments:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch departments' },
      { status: 500 }
    )
  }
}
