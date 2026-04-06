import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Force dynamic - disable caching to always get fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

const getSupabaseUrl = () => process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const getSupabaseAnonKey = () => process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const getSupabaseServiceRoleKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY

const requireEnv = (name: string, value: string | undefined) => {
  if (!value) throw new Error(`${name} environment variable not set`)
  return value
}

let _publicSupabase: SupabaseClient<any> | null = null
const publicSupabase = new Proxy({} as SupabaseClient<any>, {
  get(_, prop) {
    if (!_publicSupabase) {
      const supabaseUrl = requireEnv('SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)', getSupabaseUrl())
      const supabaseAnonKey = requireEnv('SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)', getSupabaseAnonKey())
      _publicSupabase = createClient<any>(supabaseUrl, supabaseAnonKey, {
        global: {
          fetch: (url, options = {}) => fetch(url, { ...options, cache: 'no-store' }),
        },
      })
    }
    return (_publicSupabase as any)[prop]
  },
})

let _adminSupabase: SupabaseClient<any> | null = null
const adminSupabase = new Proxy({} as SupabaseClient<any>, {
  get(_, prop) {
    if (!_adminSupabase) {
      const supabaseUrl = requireEnv('SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)', getSupabaseUrl())
      const supabaseServiceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY', getSupabaseServiceRoleKey())
      _adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey, {
        global: {
          fetch: (url, options = {}) => fetch(url, { ...options, cache: 'no-store' }),
        },
      })
    }
    return (_adminSupabase as any)[prop]
  },
})

/**
 * GET /api/schedule/jobs - List all schedule generation jobs
 * Query params:
 *   - status: Filter by status (pending, running, completed, failed)
 *   - limit: Number of jobs to return (default 10)
 */
export async function GET(request: NextRequest) {
  try {
    const jobsSecret = process.env.SCHEDULE_JOBS_SECRET
    if (jobsSecret) {
      const provided = request.headers.get('x-schedule-jobs-secret')
      if (!provided || provided !== jobsSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '10')
    const jobId = searchParams.get('id')

    // If specific job ID requested
    if (jobId) {
      const { data: job, error } = await adminSupabase
        .from('schedule_jobs')
        .select('*')
        .eq('id', jobId)
        .single()

      if (error) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }

      return NextResponse.json(job)
    }

    // List jobs
    let query = adminSupabase
      .from('schedule_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: jobs, error } = await query

    if (error) {
      console.error('Error fetching jobs:', error)
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
    }

    return NextResponse.json({ jobs })
  } catch (error) {
    console.error('Error in GET /api/schedule/jobs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/schedule/jobs - Create a new schedule generation job
 * This starts the job and returns immediately with the job ID
 * The actual generation runs in the background
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const jobsSecret = process.env.SCHEDULE_JOBS_SECRET
    if (jobsSecret) {
      const provided = request.headers.get('x-schedule-jobs-secret')
      if (!provided || provided !== jobsSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }
    
    // Validate required fields
    if (!body.schedule_name) {
      return NextResponse.json({ error: 'schedule_name is required' }, { status: 400 })
    }
    if (!body.classes || body.classes.length === 0) {
      return NextResponse.json({ error: 'classes are required' }, { status: 400 })
    }
    if (!body.rooms || body.rooms.length === 0) {
      return NextResponse.json({ error: 'rooms are required' }, { status: 400 })
    }

    // Create job record
    const jobData = {
      status: 'pending',
      progress: 0,
      current_iteration: 0,
      total_iterations: body.config?.max_iterations || 10000,
      stage: 'Queued for processing...',
      input_data: body,
      schedule_name: body.schedule_name,
      semester: body.semester,
      academic_year: body.academic_year,
      total_classes: body.classes.length
    }

    const { data: job, error: insertError } = await adminSupabase
      .from('schedule_jobs')
      .insert(jobData)
      .select()
      .single()

    if (insertError) {
      console.error('Error creating job:', insertError)
      return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
    }

    // Start the background processing
    // We'll trigger the actual generation asynchronously
    void startBackgroundGeneration(job.id, request.nextUrl.origin).catch((err) => {
      console.error('Failed to start background generation:', err)
    })

    return NextResponse.json({
      success: true,
      job_id: job.id,
      status: 'pending',
      message: 'Schedule generation job created. Poll /api/schedule/jobs?id=' + job.id + ' for progress.'
    })
  } catch (error) {
    console.error('Error in POST /api/schedule/jobs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/schedule/jobs - Update job status (used by background process)
 */
export async function PATCH(request: NextRequest) {
  try {
    const jobsSecret = process.env.SCHEDULE_JOBS_SECRET
    if (jobsSecret) {
      const provided = request.headers.get('x-schedule-jobs-secret')
      if (!provided || provided !== jobsSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const body = await request.json()
    const { job_id, ...updates } = body

    if (!job_id) {
      return NextResponse.json({ error: 'job_id is required' }, { status: 400 })
    }

    const { data: job, error } = await adminSupabase
      .from('schedule_jobs')
      .update(updates)
      .eq('id', job_id)
      .select()
      .single()

    if (error) {
      console.error('Error updating job:', error)
      return NextResponse.json({ error: 'Failed to update job' }, { status: 500 })
    }

    return NextResponse.json(job)
  } catch (error) {
    console.error('Error in PATCH /api/schedule/jobs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Start background generation process
 * This function triggers the actual schedule generation
 */
async function startBackgroundGeneration(jobId: string, origin: string) {
  // Update job to running status
  await adminSupabase
    .from('schedule_jobs')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
      stage: 'Starting schedule generation...'
    })
    .eq('id', jobId)

  try {
    // Get job data
    const { data: job } = await adminSupabase
      .from('schedule_jobs')
      .select('input_data')
      .eq('id', jobId)
      .single()

    if (!job) {
      throw new Error('Job not found')
    }

    // Delegate to the existing bridge route which knows how to talk to the Python backend.
    // Note: "background" execution is only reliable on long-lived Node runtimes.
    const response = await fetch(`${origin}/api/schedule/qia-backend`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        ...job.input_data,
        job_id: jobId,  // Pass job ID so backend can update progress
        callback_url: `${origin}/api/schedule/jobs`  // For progress updates (optional)
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.detail || errorData.error || 'Backend generation failed')
    }

    const result = await response.json()

    const normalizedResult = {
      ...(result || {}),
      scheduled_count:
        (result as any)?.scheduled_count ??
        (result as any)?.scheduled_classes ??
        ((result as any)?.allocations?.length ?? 0),
      unscheduled_count:
        (result as any)?.unscheduled_count ??
        (result as any)?.unscheduled_classes ??
        ((result as any)?.unscheduled_list?.length ?? 0),
    }

    // Update job with results
    await adminSupabase
      .from('schedule_jobs')
      .update({
        status: 'completed',
        progress: 100,
        stage: 'Completed successfully!',
        result_data: normalizedResult,
        completed_at: new Date().toISOString(),
        time_elapsed_ms: (normalizedResult as any).time_elapsed_ms
      })
      .eq('id', jobId)

    // If the bridge produced a schedule_id, link the job to it.
    const scheduleId = Number((normalizedResult as any)?.schedule_id)
    if (Number.isFinite(scheduleId) && scheduleId > 0) {
      await adminSupabase
        .from('schedule_jobs')
        .update({ generated_schedule_id: scheduleId })
        .eq('id', jobId)
    }

  } catch (error: any) {
    console.error('Background generation failed:', error)
    
    // Update job with error
    await adminSupabase
      .from('schedule_jobs')
      .update({
        status: 'failed',
        stage: 'Generation failed',
        error_message: error.message || 'Unknown error occurred',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId)
  }
}
