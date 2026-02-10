'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, X, CheckCircle2, AlertTriangle, Info, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
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

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUserId(session.user.id)
        fetchNotifications(session.user.id)
      }
    }
    init()
  }, [])

  // Real-time subscription
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('realtime_alerts_faculty')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'system_alerts'
        },
        (payload) => {
          const alert = payload.new as any
          if (alert.audience === 'faculty' || alert.audience === 'all') {
            // If targetUserId is present, only show if it matches
            if (alert.metadata?.targetUserId && alert.metadata.targetUserId !== userId) {
              return
            }
            fetchNotifications(userId)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  const fetchNotifications = async (uid: string) => {
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
  }

  const markAsRead = async (notificationId: string) => {
    if (!userId) return

    await fetch('/api/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId: notificationId, userId, action: 'read' })
    })

    if (userId) {
      fetchNotifications(userId)
    }
  }

  const markAsConfirmed = async (notificationId: string) => {
    if (!userId) return

    await fetch('/api/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId: notificationId, userId, action: 'confirm' })
    })

    if (userId) {
      fetchNotifications(userId)
    }
  }

  const severityIcon = (level: string) => {
    switch (level) {
      case 'success':
        return <CheckCircle2 size={16} className={styles.iconSuccess} />
      case 'warning':
      case 'error':
        return <AlertTriangle size={16} className={styles.iconError} />
      default:
        return <Info size={16} className={styles.iconInfo} />
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
        <Bell size={20} />
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
              <button
                onClick={() => setOpen(false)}
                className={styles.closeBtn}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Notifications List */}
            <div className={styles.list}>
              {notifications.length === 0 ? (
                <div className={styles.empty}>
                  <Bell size={36} />
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
                      markAsRead(notification.id)
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

                    {/* Actions */}
                    {(!notification.receipt || notification.receipt.status === 'unread') && (
                      <div className={styles.itemActions}>
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className={styles.actionBtn}
                        >
                          Mark Read
                        </button>
                        {notification.severity !== 'info' && (
                          <button
                            onClick={() => markAsConfirmed(notification.id)}
                            className={`${styles.actionBtn} ${styles.confirmBtn}`}
                          >
                            Confirm
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
