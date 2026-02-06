'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'

type SubscriptionEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

interface UseRealtimeOptions<T> {
  table: string
  event?: SubscriptionEvent
  filter?: string // e.g., 'upload_group_id=eq.5'
  onInsert?: (record: T) => void
  onUpdate?: (record: T) => void
  onDelete?: (record: { id: number | string }) => void
  enabled?: boolean
}

/**
 * 🔄 Real-time subscription hook for Supabase tables
 * 
 * Automatically subscribes to table changes and calls the appropriate callback
 * when INSERT, UPDATE, or DELETE events occur.
 * 
 * @example
 * ```tsx
 * useRealtime({
 *   table: 'campuses',
 *   filter: `upload_group_id=eq.${selectedFile?.upload_group_id}`,
 *   onInsert: (room) => setRooms(prev => [...prev, room]),
 *   onUpdate: (room) => setRooms(prev => prev.map(r => r.id === room.id ? room : r)),
 *   onDelete: ({ id }) => setRooms(prev => prev.filter(r => r.id !== id)),
 *   enabled: !!selectedFile
 * })
 * ```
 */
export function useRealtime<T extends { id: number | string }>({
  table,
  event = '*',
  filter,
  onInsert,
  onUpdate,
  onDelete,
  enabled = true
}: UseRealtimeOptions<T>) {
  const supabase = createClient()
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!enabled) {
      // Cleanup if disabled
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      return
    }

    // Create unique channel name
    const channelName = `realtime-${table}-${filter || 'all'}-${Date.now()}`
    
    // Build the subscription config
    const subscriptionConfig: any = {
      event,
      schema: 'public',
      table
    }
    
    if (filter) {
      subscriptionConfig.filter = filter
    }

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', subscriptionConfig, (payload) => {
        console.log(`[Realtime] ${table} ${payload.eventType}:`, payload)
        
        switch (payload.eventType) {
          case 'INSERT':
            if (onInsert && payload.new) {
              onInsert(payload.new as T)
            }
            break
          case 'UPDATE':
            if (onUpdate && payload.new) {
              onUpdate(payload.new as T)
            }
            break
          case 'DELETE':
            if (onDelete && payload.old) {
              onDelete({ id: (payload.old as any).id })
            }
            break
        }
      })
      .subscribe((status) => {
        console.log(`[Realtime] ${table} subscription status:`, status)
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [table, filter, enabled, event])
}

/**
 * 🔄 Simple refetch trigger hook
 * 
 * Returns a function that can be called to trigger a data refetch.
 * Components can subscribe to the refetchKey to know when to refetch.
 * 
 * @example
 * ```tsx
 * const { refetchKey, triggerRefetch } = useRefetch()
 * 
 * useEffect(() => {
 *   fetchData()
 * }, [refetchKey])
 * 
 * const handleDelete = async () => {
 *   await supabase.from('table').delete()...
 *   triggerRefetch() // Forces refetch
 * }
 * ```
 */
export function useRefetch() {
  const [refetchKey, setRefetchKey] = useState(0)
  
  const triggerRefetch = useCallback(() => {
    setRefetchKey(prev => prev + 1)
  }, [])
  
  return { refetchKey, triggerRefetch }
}

/**
 * 🔄 CRUD helper that ensures UI stays in sync
 * 
 * Wraps common CRUD operations with automatic state management
 */
export function useCRUD<T extends { id: number | string }>(
  table: string,
  initialData: T[] = []
) {
  const supabase = createClient()
  const [data, setData] = useState<T[]>(initialData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync with initialData changes
  useEffect(() => {
    setData(initialData)
  }, [initialData])

  const refetch = useCallback(async (filters?: Record<string, any>) => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase.from(table).select('*')
      
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          query = query.eq(key, value)
        })
      }
      
      const { data: fetchedData, error: fetchError } = await query
      
      if (fetchError) throw fetchError
      setData(fetchedData as T[] || [])
      return fetchedData as T[]
    } catch (err: any) {
      setError(err.message)
      console.error(`Error fetching ${table}:`, err)
      return null
    } finally {
      setLoading(false)
    }
  }, [table])

  const insert = useCallback(async (record: Partial<T>) => {
    setLoading(true)
    setError(null)
    try {
      const { data: inserted, error: insertError } = await supabase
        .from(table)
        .insert(record as any)
        .select()
        .single()
      
      if (insertError) throw insertError
      if (!inserted) throw new Error('Insert returned no data - check RLS policies')
      
      setData(prev => [...prev, inserted as T])
      return inserted as T
    } catch (err: any) {
      setError(err.message)
      console.error(`Error inserting into ${table}:`, err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [table])

  const update = useCallback(async (id: number | string, updates: Partial<T>) => {
    setLoading(true)
    setError(null)
    try {
      const { data: updated, error: updateError } = await supabase
        .from(table)
        .update(updates as any)
        .eq('id', id)
        .select()
        .single()
      
      if (updateError) throw updateError
      if (!updated) throw new Error('Update returned no data - check RLS policies')
      
      setData(prev => prev.map(item => item.id === id ? updated as T : item))
      return updated as T
    } catch (err: any) {
      setError(err.message)
      console.error(`Error updating ${table}:`, err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [table])

  const remove = useCallback(async (id: number | string) => {
    setLoading(true)
    setError(null)
    try {
      const { data: deleted, error: deleteError } = await supabase
        .from(table)
        .delete()
        .eq('id', id)
        .select()
      
      if (deleteError) throw deleteError
      if (!deleted || deleted.length === 0) {
        throw new Error('Delete returned no data - check RLS policies')
      }
      
      setData(prev => prev.filter(item => item.id !== id))
      return true
    } catch (err: any) {
      setError(err.message)
      console.error(`Error deleting from ${table}:`, err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [table])

  return {
    data,
    setData,
    loading,
    error,
    refetch,
    insert,
    update,
    remove
  }
}
