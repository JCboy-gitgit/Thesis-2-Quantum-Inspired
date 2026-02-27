'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MdNotifications, MdPersonAdd, MdAccessTime, MdCheckCircle, MdBolt, MdWarning, MdInfo, MdDelete, MdArchive, MdRefresh, MdArrowBack, MdSearch, MdClose } from 'react-icons/md'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import './NotificationBell.css'

interface Notification {
  id: string
  type: 'registration' | 'approval' | 'system' | 'schedule' | 'alert'
  title: string
  message: string
  timestamp: Date
  read: boolean
  severity?: 'info' | 'success' | 'warning' | 'error'
  link?: string
}

interface ArchivedItem {
  id: string
  item_type: string
  item_name: string
  item_data: any
  deleted_at: string
  deleted_by: string | null
  original_table: string
  original_id: string | number
}

interface NotificationBellProps {
  pendingCount?: number
  onNotificationClick?: (notification: Notification) => void
}

// LocalStorage key for persisted admin notifications
const STORAGE_KEY = 'admin_notifications'

function loadPersistedNotifications(): Notification[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    return parsed.map((n: any) => ({ ...n, timestamp: new Date(n.timestamp) }))
  } catch {
    return []
  }
}

function savePersistedNotifications(notifications: Notification[]) {
  try {
    // Keep max 50 notifications  
    const trimmed = notifications.slice(0, 50)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // Ignore storage errors
  }
}

/**
 * Add a notification to the admin bell from anywhere in the app.
 * Call this after important events (schedule generation, approvals, etc.)
 */
export function pushAdminNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) {
  const stored = loadPersistedNotifications()
  const newNotif: Notification = {
    ...notification,
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date(),
    read: false,
  }
  stored.unshift(newNotif)
  savePersistedNotifications(stored)
  // Dispatch custom event so the bell component picks it up immediately
  window.dispatchEvent(new CustomEvent('admin-notification-added', { detail: newNotif }))
}

export default function NotificationBell({ pendingCount = 0, onNotificationClick }: NotificationBellProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<'list' | 'archive'>('list')
  const [archivedItems, setArchivedItems] = useState<ArchivedItem[]>([])
  const [archiveSearch, setArchiveSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setView('list') // Reset to list when closing
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchArchivedItems = async () => {
    try {
      const { data, error } = await supabase
        .from('archived_items')
        .select('*')
        .eq('item_type', 'notification')
        .order('deleted_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setArchivedItems(data || [])
      return (data || []).map((i: any) => String(i.original_id))
    } catch (error) {
      console.error('Error fetching archive:', error)
      return []
    }
  }

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const archivedIds = await fetchArchivedItems()

      const regResponse = await fetch('/api/faculty-registration?status=pending')
      const regData = await regResponse.json()

      const registrationNotifs: Notification[] = (regData.registrations || [])
        .filter((reg: any) => !archivedIds.includes(`reg_${reg.id}`) && reg.email !== 'system_event_placeholder@qtime.local')
        .map((reg: any) => ({
          id: `reg_${reg.id}`,
          type: 'registration' as const,
          title: 'New Faculty Registration',
          message: `${reg.email} has requested to register`,
          timestamp: new Date(reg.created_at),
          read: false,
          severity: 'info' as const,
          link: '/LandingPages/FacultyManagement/FacultyApproval'
        }))

      let alertNotifs: Notification[] = []
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const alertResponse = await fetch(`/api/alerts?audience=admin&userId=${encodeURIComponent(session.user.id)}`)
          const contentType = alertResponse.headers.get('content-type')
          if (contentType?.includes('application/json')) {
            const alertData = await alertResponse.json()
            alertNotifs = (alertData.alerts || [])
              .filter((alert: any) => !archivedIds.includes(`alert_${alert.id}`))
              .map((alert: any) => ({
                id: `alert_${alert.id}`,
                type: 'alert' as const,
                title: alert.title,
                message: alert.message,
                timestamp: new Date(alert.created_at),
                read: alert.receipt?.status === 'read' || alert.receipt?.status === 'confirmed',
                severity: alert.severity || 'info',
                link: alert.category === 'schedule_request' || alert.category === 'schedule_generation'
                  ? '/LandingPages/RoomSchedule/ViewSchedule'
                  : undefined
              }))
          }
        }
      } catch {
        // Alerts API fine
      }

      const persisted = loadPersistedNotifications().filter(n => !archivedIds.includes(n.id))

      const allMap = new Map<string, Notification>()
      for (const n of [...registrationNotifs, ...alertNotifs, ...persisted]) {
        if (!allMap.has(n.id)) allMap.set(n.id, n)
      }
      const merged = Array.from(allMap.values()).sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      )

      setNotifications(merged)
      savePersistedNotifications(merged.filter(n => n.type !== 'registration'))
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Listen for pushed notifications in real-time
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as Notification
      setNotifications(prev => [detail, ...prev])
    }
    window.addEventListener('admin-notification-added', handler)
    return () => window.removeEventListener('admin-notification-added', handler)
  }, [])

  // Fetch when opening
  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
      if (view === 'archive') fetchArchivedItems()
    }
  }, [isOpen, view, fetchNotifications])

  // Load on mount + poll every 1m + Realtime
  useEffect(() => {
    const persisted = loadPersistedNotifications()
    setNotifications(persisted)
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000)

    const alertsChannel = supabase
      .channel('realtime_alerts_admin')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'system_alerts' },
        () => fetchNotifications()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alert_receipts' },
        () => fetchNotifications()
      )
      .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(alertsChannel)
    }
  }, [fetchNotifications])

  const unreadCount = notifications.filter(n => !n.read).length

  const handleNotificationClick = async (notif: Notification) => {
    // 1. Update local state
    const updated = notifications.map(n => n.id === notif.id ? { ...n, read: true } : n)
    setNotifications(updated)
    savePersistedNotifications(updated.filter(n => n.type !== 'registration'))

    // 2. Persist to DB if it's an alert
    if (notif.type === 'alert') {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const alertId = notif.id.replace('alert_', '')
          await fetch('/api/alerts', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: session.user.id,
              alertId: alertId,
              action: 'read'
            })
          })
          fetchNotifications() // Sync back
        }
      } catch (err) {
        console.error('Failed to mark as read in DB:', err)
      }
    }

    if (notif.link) {
      router.push(notif.link)
      setIsOpen(false)
    }
    onNotificationClick?.(notif)
  }

  const markAllRead = async () => {
    const updated = notifications.map(n => ({ ...n, read: true }))
    setNotifications(updated)
    savePersistedNotifications(updated.filter(n => n.type !== 'registration'))

    // Also update remote alerts
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session.user.id, action: 'read_all' })
      })
    }
  }

  const clearAllNotifications = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id

    // Archive each notification
    const toArchive = notifications.filter(n => n.type !== 'registration')

    for (const notif of toArchive) {
      await (supabase.from('archived_items') as any).insert({
        item_type: 'notification',
        item_name: notif.title,
        item_data: notif,
        deleted_by: userId,
        original_table: notif.type === 'alert' ? 'system_alerts' : 'local_persistence',
        original_id: notif.id
      })
    }

    const kept = notifications.filter(n => n.type === 'registration' && !n.read)
    setNotifications(kept)
    savePersistedNotifications([])

    // Remote cleanup
    if (userId) {
      await fetch('/api/alerts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'clear_all', audience: 'admin' })
      })
      fetchNotifications()
    }
  }

  const deleteNotification = async (id: string) => {
    const notif = notifications.find(n => n.id === id)
    if (!notif) return

    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id

    // Optimistic UI update
    setNotifications(prev => prev.filter(n => n.id !== id))
    savePersistedNotifications(notifications.filter(n => n.id !== id && n.type !== 'registration'))

    try {
      // Archive
      await (supabase.from('archived_items') as any).insert({
        item_type: 'notification',
        item_name: notif.title,
        item_data: notif,
        deleted_by: userId,
        original_table: notif.type === 'alert' ? 'system_alerts' : 'local_persistence',
        original_id: notif.id
      })

      if (userId && notif.type === 'alert') {
        const res = await fetch('/api/alerts', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alertId: notif.id.replace('alert_', ''), userId, action: 'clear_all' })
        })
        if (!res.ok) throw new Error('Failed to delete from server')
      }

      await fetchNotifications()
      toast.success('Notification archived')
    } catch (err) {
      console.error('Delete failed:', err)
      fetchNotifications()
    }
  }

  const handleRestore = async (item: ArchivedItem) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id

      const notifData = item.item_data
      // Restore logic
      if (item.original_table === 'system_alerts' && userId) {
        // Just update the status back to 'read' or 'unread' in receipts
        const alertId = String(item.original_id).replace('alert_', '')
        await fetch('/api/alerts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            alertId,
            action: 'read'
          })
        })
      } else if (item.original_table === 'local_persistence') {
        pushAdminNotification(notifData)
      }

      // Delete from archive
      await supabase.from('archived_items').delete().eq('id', item.id)

      setArchivedItems(prev => prev.filter(i => i.id !== item.id))
      fetchNotifications()
      toast.success('Notification restored')
    } catch (err) {
      console.error('Restore failed:', err)
      toast.error('Failed to restore notification')
    }
  }

  const handlePermanentDelete = async (id: string) => {
    try {
      await supabase.from('archived_items').delete().eq('id', id)
      setArchivedItems(prev => prev.filter(i => i.id !== id))
      toast.success('Removed permanently')
    } catch (err) {
      toast.error('Failed to remove')
    }
  }

  const getNotificationIcon = (notif: Notification) => {
    // Check if it's a schedule alert which should have a bolt icon
    const isScheduleAlert = notif.title.toLowerCase().includes('schedule') ||
      notif.message.toLowerCase().includes('schedule');

    switch (notif.type) {
      case 'registration':
        return <MdPersonAdd size={18} />
      case 'schedule':
        return <MdBolt size={18} />
      case 'alert':
        if (isScheduleAlert) return <MdBolt size={18} />
        if (notif.severity === 'warning' || notif.severity === 'error')
          return <MdWarning size={18} />
        if (notif.severity === 'success')
          return <MdCheckCircle size={18} />
        return <MdInfo size={18} />
      default:
        return <MdNotifications size={18} />
    }
  }

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <button
        className={`notification-bell-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications"
      >
        <MdNotifications size={20} />
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          {view === 'list' ? (
            <>
              <div className="notification-header">
                <h3>Notifications</h3>
                <div className="notification-header-actions">
                  {unreadCount > 0 && (
                    <button className="mark-all-btn" onClick={markAllRead} title="Mark all as read">
                      <MdCheckCircle size={14} />
                    </button>
                  )}
                  <button className="archive-btn" onClick={() => setView('archive')} title="View Archive">
                    <MdArchive size={14} />
                  </button>
                  {notifications.length > 0 && (
                    <button className="clear-all-btn" onClick={clearAllNotifications} title="Clear all">
                      <MdDelete size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="notification-list">
                {loading && notifications.length === 0 ? (
                  <div className="notification-empty">
                    <div className="loading-spinner"></div>
                    <p>Loading...</p>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="notification-empty">
                    <MdNotifications size={40} />
                    <p>No new notifications</p>
                  </div>
                ) : (
                  notifications.slice(0, 20).map((notif) => (
                    <div
                      key={notif.id}
                      className={`notification-item ${!notif.read ? 'unread' : ''} ${notif.severity === 'error' ? 'error' : ''} ${notif.severity === 'success' ? 'success' : ''}`}
                      onClick={() => handleNotificationClick(notif)}
                    >
                      <div className={`notification-icon ${notif.type}`}>
                        {getNotificationIcon(notif)}
                      </div>
                      <div className="notification-content">
                        <span className="notification-title">{notif.title}</span>
                        <span className="notification-message">{notif.message}</span>
                        <span className="notification-time">
                          <MdAccessTime size={12} /> {formatTime(notif.timestamp)}
                        </span>
                      </div>
                      <button
                        className="item-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteNotification(notif.id)
                        }}
                      >
                        <MdDelete size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {notifications.some(n => n.type === 'registration' && !n.read) && (
                <div className="notification-footer">
                  <button
                    className="approve-all-btn"
                    onClick={() => {
                      router.push('/LandingPages/FacultyManagement/FacultyApproval')
                      setIsOpen(false)
                    }}
                  >
                    <MdPersonAdd size={16} />
                    Review Pending Requests
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="notification-header">
                <div className="archive-view-header">
                  <button className="back-btn" onClick={() => setView('list')}><MdArrowBack /></button>
                  <h3>Archived</h3>
                </div>
                <div className="archive-search-mini">
                  <MdSearch size={14} />
                  <input
                    type="text"
                    placeholder="Search archive..."
                    value={archiveSearch}
                    onChange={e => setArchiveSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="notification-list archive-list-mini">
                {archivedItems.length === 0 ? (
                  <div className="notification-empty">
                    <MdArchive size={40} />
                    <p>Archive is empty</p>
                  </div>
                ) : (
                  archivedItems
                    .filter(i => i.item_name.toLowerCase().includes(archiveSearch.toLowerCase()))
                    .map(item => (
                      <div key={item.id} className="notification-item archived">
                        <div className="notification-icon">
                          <MdArchive size={18} />
                        </div>
                        <div className="notification-content">
                          <span className="notification-title">{item.item_name}</span>
                          <span className="notification-time">
                            Deleted {formatTime(new Date(item.deleted_at))}
                          </span>
                        </div>
                        <div className="archive-actions-mini">
                          <button className="restore-btn-mini" onClick={() => handleRestore(item)} title="Restore">
                            <MdRefresh size={14} />
                          </button>
                          <button className="delete-btn-mini" onClick={() => handlePermanentDelete(item.id)} title="Delete permanently">
                            <MdClose size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
