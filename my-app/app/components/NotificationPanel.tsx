import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MdNotifications, MdClose, MdCheckCircle, MdWarning, MdInfo, MdArchive, MdDelete, MdArrowBack, MdSearch, MdRefresh } from 'react-icons/md'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import styles from './NotificationPanel.module.css'

interface Notification {
  id: string
  title: string
  message: string
  severity: 'info' | 'success' | 'warning' | 'error'
  created_at: string
  category?: string
  receipt?: {
    status: 'unread' | 'read' | 'confirmed' | 'dismissed'
  } | null
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

interface NotificationPanelProps {
  userRole?: 'admin' | 'faculty'
  userEmail?: string | null
}

export default function NotificationPanel({ userRole = 'faculty', userEmail }: NotificationPanelProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'archive'>('list')
  const [archivedItems, setArchivedItems] = useState<ArchivedItem[]>([])
  const [archiveSearch, setArchiveSearch] = useState('')

  const fetchArchivedItems = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('archived_items')
        .select('*')
        .eq('item_type', 'notification')
        .order('deleted_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setArchivedItems(data || [])
    } catch (error) {
      console.error('Error fetching archive:', error)
    }
  }, [])

  const fetchNotifications = useCallback(async (uid: string) => {
    try {
      const audience = userRole === 'admin' ? 'admin' : 'faculty'
      const response = await fetch(`/api/alerts?audience=${audience}&userId=${encodeURIComponent(uid)}`)
      const data = await response.json()
      setNotifications((data.alerts || []).map((a: any) => ({ ...a, category: a.category })))

      const unread = (data.alerts || []).filter(
        (n: any) => !n.receipt || n.receipt.status === 'unread'
      ).length
      setUnreadCount(unread)
    } catch (error) {
      console.error('Failed to load notifications:', error)
    }
  }, [userRole])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUserId(session.user.id)
        fetchNotifications(session.user.id)
        fetchArchivedItems()
      }
    }
    init()
  }, [fetchNotifications, fetchArchivedItems])

  // Real-time subscription
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('realtime_alerts_faculty')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_alerts'
        },
        () => {
          fetchNotifications(userId)
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'alert_receipts',
          filter: `user_id=eq.${userId}`
        },
        () => {
          fetchNotifications(userId)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, fetchNotifications])

  const markAsRead = async (notificationId: string) => {
    if (!userId) return

    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, receipt: { status: 'read' } } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))

    await fetch('/api/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId: notificationId, userId, action: 'read' })
    })
  }

  const markAllAsRead = async () => {
    if (!userId) return

    setNotifications(prev => prev.map(n => ({ ...n, receipt: { status: 'read' } })))
    setUnreadCount(0)

    await fetch('/api/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action: 'read_all', audience: userRole })
    })
  }

  const clearAllNotifications = async () => {
    if (!userId) return

    // Archive all current visible notifications first
    for (const notif of notifications) {
      await supabase.from('archived_items').insert({
        item_type: 'notification',
        item_name: notif.title,
        item_data: notif,
        deleted_by: userId,
        original_table: 'system_alerts',
        original_id: notif.id
      })
    }

    setNotifications([])
    setUnreadCount(0)

    await fetch('/api/alerts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action: 'clear_all', audience: userRole })
    })

    await fetchArchivedItems()
    toast.success('All notifications archived')
  }

  const deleteNotification = async (notif: Notification) => {
    if (!userId) return

    // Optimistic UI update
    setNotifications(prev => prev.filter(n => n.id !== notif.id))
    if (!notif.receipt || notif.receipt.status === 'unread') {
      setUnreadCount(prev => Math.max(0, prev - 1))
    }

    try {
      // Archive
      await supabase.from('archived_items').insert({
        item_type: 'notification',
        item_name: notif.title,
        item_data: notif,
        deleted_by: userId,
        original_table: 'system_alerts',
        original_id: notif.id
      })

      await fetch('/api/alerts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'clear_all', alertId: notif.id })
      })

      await fetchArchivedItems()
      toast.success('Notification archived')
    } catch (err) {
      console.error('Delete failed:', err)
      fetchNotifications(userId)
    }
  }

  const handleRestore = async (item: ArchivedItem) => {
    if (!userId) return
    try {
      // Re-create the alert receipt so it reappears
      const alertId = String(item.original_id)
      await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, alertId, action: 'read' })
      })

      // Delete from archive
      await supabase.from('archived_items').delete().eq('id', item.id)

      setArchivedItems(prev => prev.filter(i => i.id !== item.id))
      fetchNotifications(userId)
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

  const markAsConfirmed = async (notificationId: string) => {
    if (!userId) return

    await fetch('/api/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId: notificationId, userId, action: 'confirm' })
    })
    fetchNotifications(userId)
  }

  const severityIcon = (level: string) => {
    switch (level) {
      case 'success':
        return <MdCheckCircle size={16} className={styles.iconSuccess} />
      case 'warning':
      case 'error':
        return <MdWarning size={16} className={styles.iconError} />
      default:
        return <MdInfo size={16} className={styles.iconInfo} />
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString()
  }

  return (
    <div className={styles.container}>
      {/* Bell Icon Button */}
      <button
        onClick={() => setOpen(!open)}
        className={styles.bellBtn}
        title="Notifications"
      >
        <MdNotifications size={20} />
        {unreadCount > 0 && (
          <span className={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {/* Notification Panel Modal */}
      {open && (
        <>
          {/* Backdrop */}
          <div className={styles.backdrop} onClick={() => { setOpen(false); setView('list') }} />

          {/* Panel */}
          <div className={styles.panel}>
            {view === 'list' ? (
              <>
                {/* Header */}
                <div className={styles.header}>
                  <h3 className={styles.title}>Notifications</h3>
                  <div className={styles.headerActions}>
                    {notifications.length > 0 && (
                      <>
                        <button className={styles.headerActionBtn} onClick={markAllAsRead} title="Mark all as read">
                          <MdCheckCircle size={18} />
                        </button>
                        <button className={styles.headerActionBtn} onClick={() => { setView('archive'); fetchArchivedItems() }} title="View Archive">
                          <MdArchive size={18} />
                        </button>
                        <button className={`${styles.headerActionBtn} ${styles.clearAllBtn}`} onClick={clearAllNotifications} title="Clear all">
                          <MdDelete size={18} />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => { setOpen(false); setView('list') }}
                      className={styles.closeBtn}
                      aria-label="Close"
                    >
                      <MdClose size={20} />
                    </button>
                  </div>
                </div>

                {/* Notifications List */}
                <div className={styles.list}>
                  {notifications.length === 0 ? (
                    <div className={styles.empty}>
                      <MdNotifications size={36} />
                      <p>No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map(notification => (
                      <div
                        key={notification.id}
                        className={`${styles.item} ${!notification.receipt || notification.receipt.status === 'unread'
                          ? styles.unread
                          : ''
                          }`}
                        onClick={() => {
                          if (!notification.receipt || notification.receipt.status === 'unread') {
                            markAsRead(notification.id)
                          }
                          if (notification.category === 'schedule_request' || notification.category === 'schedule_published') {
                            router.push('/faculty/schedules')
                            setOpen(false)
                          }
                        }}
                        style={{ cursor: (notification.category === 'schedule_request' || notification.category === 'schedule_published') ? 'pointer' : 'default' }}
                      >
                        <div className={styles.itemContent}>
                          <div className={styles.itemHeader}>
                            {severityIcon(notification.severity)}
                            <h4 className={styles.itemTitle}>{notification.title}</h4>
                          </div>
                          <p className={styles.itemMessage}>{notification.message}</p>
                          <span className={styles.itemTime}>
                            {formatTime(notification.created_at)}
                          </span>
                        </div>

                        <div className={styles.itemActions}>
                          <button
                            className={styles.itemDeleteBtn}
                            onClick={(e) => { e.stopPropagation(); deleteNotification(notification) }}
                            title="Delete"
                          >
                            <MdDelete size={14} />
                          </button>
                          {(!notification.receipt || notification.receipt.status === 'unread') && notification.severity !== 'info' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); markAsConfirmed(notification.id) }}
                              className={`${styles.actionBtn} ${styles.confirmBtn}`}
                            >
                              Confirm
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Archive View Header */}
                <div className={styles.header}>
                  <div className={styles.archiveViewHeader}>
                    <button className={styles.backBtn} onClick={() => setView('list')}>
                      <MdArrowBack size={18} />
                    </button>
                    <h3 className={styles.title}>Archived</h3>
                  </div>
                  <div className={styles.archiveSearchMini}>
                    <MdSearch size={14} />
                    <input
                      type="text"
                      placeholder="Search archive..."
                      value={archiveSearch}
                      onChange={e => setArchiveSearch(e.target.value)}
                    />
                  </div>
                </div>

                {/* Archive List */}
                <div className={`${styles.list} ${styles.archiveListMini}`}>
                  {archivedItems.length === 0 ? (
                    <div className={styles.empty}>
                      <MdArchive size={36} />
                      <p>Archive is empty</p>
                    </div>
                  ) : (
                    archivedItems
                      .filter(i => i.item_name.toLowerCase().includes(archiveSearch.toLowerCase()))
                      .map(item => (
                        <div key={item.id} className={`${styles.item} ${styles.archivedItem}`}>
                          <div className={styles.archiveIcon}>
                            <MdArchive size={18} />
                          </div>
                          <div className={styles.itemContent}>
                            <h4 className={styles.itemTitle}>{item.item_name}</h4>
                            <span className={styles.itemTime}>
                              Deleted {formatTime(item.deleted_at)}
                            </span>
                          </div>
                          <div className={styles.archiveActionsMini}>
                            <button className={styles.restoreBtnMini} onClick={() => handleRestore(item)} title="Restore">
                              <MdRefresh size={14} />
                            </button>
                            <button className={styles.deleteBtnMini} onClick={() => handlePermanentDelete(item.id)} title="Delete permanently">
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
        </>
      )}
    </div>
  )
}
