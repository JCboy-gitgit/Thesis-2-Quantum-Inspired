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

// POST - Force approve a user (debug/fix endpoint)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, action } = body
    
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    if (action === 'force_approve') {
      console.log(`\n========== FORCE APPROVING USER ${userId} ==========`)
      
      // Get auth user info
      const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId)
      const userEmail = authData.user?.email
      const fullName = authData.user?.user_metadata?.full_name || 'Faculty Member'
      
      // Step 1: Check if user exists
      const { data: existing } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()
      
      console.log('Existing user:', existing)
      
      // Step 2: If exists, update. If not, insert.
      if (existing) {
        const { data: updateResult, error: updateError } = await supabaseAdmin
          .from('users')
          .update({ 
            is_active: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
          .select()
        
        console.log('Update result:', updateResult, 'Error:', updateError)
        
        if (updateError) {
          return NextResponse.json({ 
            error: 'Update failed', 
            details: updateError.message 
          }, { status: 500 })
        }
      } else {
        const { data: insertResult, error: insertError } = await supabaseAdmin
          .from('users')
          .insert({
            id: userId,
            email: userEmail,
            full_name: fullName,
            role: 'faculty',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
        
        console.log('Insert result:', insertResult, 'Error:', insertError)
        
        if (insertError) {
          return NextResponse.json({ 
            error: 'Insert failed', 
            details: insertError.message 
          }, { status: 500 })
        }
      }
      
      // Step 3: Update user_profiles
      await supabaseAdmin
        .from('user_profiles')
        .upsert({
          user_id: userId,
          position: 'APPROVED',
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
      
      // Step 4: Verify
      const { data: verified } = await supabaseAdmin
        .from('users')
        .select('id, email, is_active, full_name')
        .eq('id', userId)
        .single()
      
      console.log('Verified user after force approve:', verified)
      
      return NextResponse.json({
        success: true,
        message: 'User force approved',
        user: verified
      })
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    
  } catch (error: any) {
    console.error('Force approve error:', error)
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}