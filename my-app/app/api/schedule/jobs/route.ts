import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

/**
 * GET /api/schedule/jobs - List all schedule generation jobs
 * Query params:
 *   - status: Filter by status (pending, running, completed, failed)
 *   - limit: Number of jobs to return (default 10)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '10')
    const jobId = searchParams.get('id')

    // If specific job ID requested
    if (jobId) {
      const { data: job, error } = await supabase
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
    let query = supabase
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

    const { data: job, error: insertError } = await supabase
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
    startBackgroundGeneration(job.id)

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
    const body = await request.json()
    const { job_id, ...updates } = body

    if (!job_id) {
      return NextResponse.json({ error: 'job_id is required' }, { status: 400 })
    }

    const { data: job, error } = await supabase
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
async function startBackgroundGeneration(jobId: string) {
  // Update job to running status
  await supabase
    .from('schedule_jobs')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
      stage: 'Starting schedule generation...'
    })
    .eq('id', jobId)

  try {
    // Get job data
    const { data: job } = await supabase
      .from('schedule_jobs')
      .select('input_data')
      .eq('id', jobId)
      .single()

    if (!job) {
      throw new Error('Job not found')
    }

    // Call the QIA backend with the input data
    // The backend will update progress via webhooks or direct DB updates
    const backendUrl = process.env.PYTHON_BACKEND_URL || 'https://thesis-2-quantum-inspired.onrender.com'
    
    const response = await fetch(`${backendUrl}/api/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...job.input_data,
        job_id: jobId,  // Pass job ID so backend can update progress
        callback_url: process.env.NEXT_PUBLIC_APP_URL + '/api/schedule/jobs'  // For progress updates
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.detail || errorData.error || 'Backend generation failed')
    }

    const result = await response.json()

    // Update job with results
    await supabase
      .from('schedule_jobs')
      .update({
        status: 'completed',
        progress: 100,
        stage: 'Completed successfully!',
        result_data: result,
        completed_at: new Date().toISOString(),
        time_elapsed_ms: result.time_elapsed_ms
      })
      .eq('id', jobId)

    // If result includes allocations, save to generated_schedules
    if (result.allocations && result.allocations.length > 0) {
      const scheduleData = {
        schedule_name: job.input_data.schedule_name,
        semester: job.input_data.semester,
        academic_year: job.input_data.academic_year,
        school_name: 'Bulacan State University',
        college: job.input_data.college || 'College of Science',
        total_classes: result.total_classes || job.input_data.classes?.length || 0,
        scheduled_classes: result.scheduled_count || result.allocations.length,
        unscheduled_classes: result.unscheduled_count || 0,
        schedule_data: result,
        time_elapsed_ms: result.time_elapsed_ms
      }

      const { data: savedSchedule, error: saveError } = await supabase
        .from('generated_schedules')
        .insert(scheduleData)
        .select()
        .single()

      if (!saveError && savedSchedule) {
        // Update job with link to saved schedule
        await supabase
          .from('schedule_jobs')
          .update({ generated_schedule_id: savedSchedule.id })
          .eq('id', jobId)
      }
    }

  } catch (error: any) {
    console.error('Background generation failed:', error)
    
    // Update job with error
    await supabase
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
