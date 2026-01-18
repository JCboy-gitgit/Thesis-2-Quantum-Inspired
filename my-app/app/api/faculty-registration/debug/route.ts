import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service role to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    // Get user record
    const { data: userRecord, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single() as { data: any | null; error: any }
    
    if (userError) {
      console.error('Error fetching user:', userError)
      return NextResponse.json({ error: 'Failed to fetch user', details: userError }, { status: 500 })
    }

    // Get user profile
    const { data: profileRecord, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle() as { data: any | null; error: any }
    
    if (profileError) {
      console.error('Error fetching profile:', profileError)
      return NextResponse.json({ error: 'Failed to fetch profile', details: profileError }, { status: 500 })
    }

    // Get auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId)
    
    if (authError) {
      console.error('Error fetching auth user:', authError)
      return NextResponse.json({ error: 'Failed to fetch auth user', details: authError }, { status: 500 })
    }

    return NextResponse.json({
      userId,
      userRecord,
      profileRecord,
      authUser: authData.user,
      analysis: {
        is_active: userRecord?.is_active,
        profile_exists: !!profileRecord,
        profile_position: profileRecord?.position,
        email_confirmed: !!authData.user?.email_confirmed_at,
        determined_status: !authData.user?.email_confirmed_at ? 'unconfirmed' :
                         userRecord?.is_active === true ? 'approved' :
                         profileRecord?.position === 'REJECTED' ? 'rejected' :
                         'pending'
      }
    })
  } catch (error: any) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}
