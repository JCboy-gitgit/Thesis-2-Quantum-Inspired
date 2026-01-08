import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types (update these based on your actual schema)
export interface Schedule {
  id?: number
  event_name: string
  event_type: string
  schedule_date: string
  start_time: string
  end_time: string
  campus_group_id: number
  participant_group_id: number
  created_at?: string
  scheduled_count: number
  unscheduled_count: number
  execution_time: number
}

export interface ScheduleDetail {
  id?: number
  schedule_id: number
  batch_name: string
  room: string
  time_slot: string
  participant_count: number
  has_pwd: boolean
}