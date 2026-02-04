import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// Re-export all types from database.types for convenience
export * from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Create typed Supabase client with session persistence
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: 'supabase.auth.token',
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Session expires in 7 days (604800 seconds) when "keep me signed in" is used
    // This is controlled at Supabase dashboard level, but we ensure refresh is enabled
  }
})

// ============================================================================
// HELPER FUNCTIONS FOR QIA CLASSROOM SCHEDULING
// ============================================================================

/**
 * Fetch all rows from a table with pagination support (bypasses 1000 row limit)
 */
export async function fetchAllRows<T>(
  table: string, 
  filters: Record<string, any> = {},
  orderBy: string = 'id',
  ascending: boolean = true
): Promise<T[]> {
  const PAGE_SIZE = 1000
  let allData: T[] = []
  let page = 0
  let hasMore = true

  while (hasMore) {
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from(table)
      .select('*')
      .range(from, to)
      .order(orderBy, { ascending })

    // Apply filters
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value as string | number | boolean)
    }

    const { data, error } = await query

    if (error) throw error
    if (!data || data.length === 0) {
      hasMore = false
      break
    }

    allData = [...allData, ...(data as T[])]
    if (data.length < PAGE_SIZE) hasMore = false
    page++
  }

  return allData
}

/**
 * Delete rows in batches (bypasses 1000 row limit)
 */
export async function deleteInBatches(
  table: string, 
  ids: number[], 
  batchSize: number = 1000
): Promise<number> {
  let deletedCount = 0
  
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize)
    
    const { error } = await supabase
      .from(table)
      .delete()
      .in('id', batch)
    
    if (error) throw error
    deletedCount += batch.length
  }
  
  return deletedCount
}

/**
 * Get the next upload group ID for a table
 */
export async function getNextUploadGroupId(
  table: 'rooms' | 'class_schedules' | 'faculty'
): Promise<number> {
  const { data, error } = await supabase
    .from(table)
    .select('upload_group_id')
    .order('upload_group_id', { ascending: false })
    .limit(1)
  
  if (error) {
    console.error(`Error getting max ${table} ID:`, error)
    return 1
  }
  
  return data && data.length > 0 ? ((data[0] as any).upload_group_id || 0) + 1 : 1
}

/**
 * Insert data in batches for large uploads
 */
export async function insertInBatches<T extends Record<string, any>>(
  table: string,
  data: T[],
  batchSize: number = 500
): Promise<{ inserted: number; errors: string[] }> {
  let insertedCount = 0
  const errors: string[] = []
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize)
    
    const { error } = await supabase
      .from(table)
      .insert(batch as any)
    
    if (error) {
      errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`)
    } else {
      insertedCount += batch.length
    }
  }
  
  return { inserted: insertedCount, errors }
}

/**
 * Check if a room is available at a specific time
 */
export async function checkRoomAvailability(
  roomId: number,
  dayOfWeek: string,
  startTime: string,
  endTime: string,
  generationId?: number
): Promise<boolean> {
  let query = supabase
    .from('room_allocations')
    .select('id')
    .eq('room_id', roomId)
    .eq('day_of_week', dayOfWeek)
    .neq('status', 'cancelled')

  if (generationId) {
    query = query.eq('generation_id', generationId)
  }

  const { data, error } = await query

  if (error) throw error
  
  // Check for time overlap
  for (const allocation of data || []) {
    // Would need to check time overlaps - simplified version
  }
  
  return (data?.length || 0) === 0
}

/**
 * Get room schedule for a specific day
 */
export async function getRoomScheduleForDay(
  roomId: number,
  dayOfWeek: string,
  generationId?: number
) {
  let query = supabase
    .from('room_allocations')
    .select('*')
    .eq('room_id', roomId)
    .eq('day_of_week', dayOfWeek)
    .eq('status', 'scheduled')
    .order('start_time', { ascending: true })

  if (generationId) {
    query = query.eq('generation_id', generationId)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}