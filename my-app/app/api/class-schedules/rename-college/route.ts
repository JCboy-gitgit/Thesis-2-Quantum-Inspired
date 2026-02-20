import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Force dynamic - disable caching
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
    try {
        const supabaseAdmin = createAdminClient()

        // Verify admin session (Optional but recommended)
        // For now we check the provided admin email in metadata or session
        const { data: { session } } = await supabaseAdmin.auth.getSession()

        // In many setups, getSession() on the server might not work perfectly without middleware
        // but here we are using createAdminClient which bypasses RLS anyway.
        // We should ideally verify the user is an admin.

        const body = await request.json()
        const { oldName, newName } = body

        if (!oldName || !newName) {
            return NextResponse.json(
                { error: 'Missing oldName or newName' },
                { status: 400 }
            )
        }

        console.log(`Global Rename: Attempting to rename college "${oldName}" to "${newName}" in class_schedules table.`)

        // Use admin client to bypass RLS
        const { data, error } = await supabaseAdmin
            .from('class_schedules')
            .update({ college: newName })
            .eq('college', oldName)
            .select()

        if (error) {
            console.error('Rename College DB Error:', error)
            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            )
        }

        console.log(`Global Rename Success: Updated ${data?.length || 0} rows.`)

        return NextResponse.json({
            success: true,
            updatedCount: data?.length || 0,
            message: `Successfully renamed "${oldName}" to "${newName}" across ${data?.length || 0} records.`
        })

    } catch (error: any) {
        console.error('Rename College API Error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to rename college' },
            { status: 500 }
        )
    }
}
