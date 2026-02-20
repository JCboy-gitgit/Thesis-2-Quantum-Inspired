import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MdNotifications, MdClose, MdCheckCircle, MdWarning, MdInfo, MdArchive, MdDelete } from 'react-icons/md'
import { supabase } from '@/lib/supabaseClient'
import styles from './NotificationPanel.module.css'
import ArchiveModal from './ArchiveModal'

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
  const [isArchiveOpen, setIsArchiveOpen] = useState(false)

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
      }
    }
    init()
  }, [fetchNotifications])

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
  }

  const deleteNotification = async (notif: Notification) => {
    if (!userId) return

    // Archive
    await supabase.from('archived_items').insert({
      item_type: 'notification',
      item_name: notif.title,
      item_data: notif,
      deleted_by: userId,
      original_table: 'system_alerts',
      original_id: notif.id
    })

    setNotifications(prev => prev.filter(n => n.id !== notif.id))
    if (!notif.receipt || notif.receipt.status === 'unread') {
      setUnreadCount(prev => Math.max(0, prev - 1))
    }

    await fetch('/api/alerts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action: 'clear_all', alertId: notif.id })
    })
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
          <div className={styles.backdrop} onClick={() => setOpen(false)} />

          {/* Panel */}
          <div className={styles.panel}>
            {/* Header */}
            <div className={styles.header}>
              <h3 className={styles.title}>Notifications</h3>
              <div className={styles.headerActions}>
                {notifications.length > 0 && (
                  <>
                    <button className={styles.headerActionBtn} onClick={markAllAsRead} title="Mark all as read">
                      <MdCheckCircle size={18} />
                    </button>
                    <button className={styles.headerActionBtn} onClick={() => setIsArchiveOpen(true)} title="View Archive">
                      <MdArchive size={18} />
                    </button>
                    <button className={`${styles.headerActionBtn} ${styles.clearAllBtn}`} onClick={clearAllNotifications} title="Clear all">
                      <MdDelete size={18} />
                    </button>
                  </>
                )}
                <button
                  onClick={() => setOpen(false)}
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
                      if (notification.category === 'schedule_request') {
                        router.push('/faculty/schedules')
                        setOpen(false)
                      }
                    }}
                    style={{ cursor: notification.category === 'schedule_request' ? 'pointer' : 'default' }}
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
          </div>
        </>
      )}

      <ArchiveModal
        isOpen={isArchiveOpen}
        onClose={() => setIsArchiveOpen(false)}
        onRestore={() => userId && fetchNotifications(userId)}
        forcedType="notification"
      />
    </div>
  )
}
