
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
    try {
        const { faculty_id, allocation_id, date, reason } = await req.json()

        if (!faculty_id || !allocation_id || !date) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            )
        }

        const { data, error } = await supabase
            .from('faculty_absences')
            .insert([
                { faculty_id, allocation_id, date, reason }
            ])
            .select()

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        console.error('Error creating absence:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to create absence record' },
            { status: 500 }
        )
    }
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const facultyId = searchParams.get('faculty_id')

        let query = supabase
            .from('faculty_absences')
            .select(`
        *,
        room_allocations!inner (
          id,
          course_code,
          section,
          room,
          schedule_time,
          schedule_day
        ),
        profiles:faculty_id (
          full_name,
          email
        )
      `)
            .order('date', { ascending: false })

        if (facultyId) {
            query = query.eq('faculty_id', facultyId)
        }

        const { data, error } = await query

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        console.error('Error fetching absences:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to fetch absences' },
            { status: 500 }
        )
    }
}
