import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
    try {
        // 1. Verify Authentication & Admin Status
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Identify admin by email as per project convention
        const ADMIN_EMAIL = 'admin123@ms.bulsu.edu.ph'
        const isAdmin = user.email === ADMIN_EMAIL

        if (!isAdmin) {
            return NextResponse.json({ error: 'Forbidden: Admin priority required' }, { status: 403 })
        }

        // 2. Parse Multipart Form Data
        const formData = await request.formData()
        const file = formData.get('file') as File
        const filePath = formData.get('filePath') as string
        const bucketName = (formData.get('bucket') as string) || 'profile-images'

        if (!file || !filePath) {
            return NextResponse.json({ error: 'File and filePath are required' }, { status: 400 })
        }

        // 3. Perform Upload using Admin Client (Bypasses RLS)
        const supabaseAdmin = createAdminClient()
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        const { error: uploadError } = await supabaseAdmin.storage
            .from(bucketName)
            .upload(filePath, buffer, {
                contentType: file.type,
                upsert: true
            })

        if (uploadError) {
            console.error('Supabase Admin Storage Error:', uploadError)
            return NextResponse.json({ error: uploadError.message }, { status: 500 })
        }

        // 4. Get Public URL
        const { data: publicUrlData } = supabaseAdmin.storage
            .from(bucketName)
            .getPublicUrl(filePath)

        return NextResponse.json({
            success: true,
            publicUrl: publicUrlData.publicUrl
        })

    } catch (error: any) {
        console.error('Upload API Route Error:', error)
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
