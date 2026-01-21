'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, UserPlus, Clock, CheckCircle2, XCircle, X } from 'lucide-react'
import './NotificationBell.css'

interface Notification {
  id: string
  type: 'registration' | 'approval' | 'system'
  title: string
  message: string
  timestamp: Date
  read: boolean
  link?: string
}

interface NotificationBellProps {
  pendingCount?: number
  onNotificationClick?: (notification: Notification) => void
}

export default function NotificationBell({ pendingCount = 0, onNotificationClick }: NotificationBellProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch notifications when opening
  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
    }
  }, [isOpen])

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/faculty-registration?status=pending')
      const data = await response.json()
      
      if (data.registrations && data.registrations.length > 0) {
        const notifs: Notification[] = data.registrations.map((reg: any) => ({
          id: reg.id,
          type: 'registration' as const,
          title: 'New Faculty Registration',
          message: `${reg.email} has requested to register as faculty`,
          timestamp: new Date(reg.created_at),
          read: false,
          link: '/LandingPages/FacultyManagement/FacultyApproval'
        }))
        setNotifications(notifs)
      } else {
        setNotifications([])
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleNotificationClick = (notif: Notification) => {
    if (notif.link) {
      router.push(notif.link)
      setIsOpen(false)
    }
    onNotificationClick?.(notif)
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'registration':
        return <UserPlus size={18} />
      case 'approval':
        return <CheckCircle2 size={18} />
      default:
        return <Bell size={18} />
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
        <Bell size={20} />
        {pendingCount > 0 && (
          <span className="notification-badge">
            {pendingCount > 99 ? '99+' : pendingCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notifications</h3>
            {notifications.length > 0 && (
              <button 
                className="view-all-btn"
                onClick={() => {
                  router.push('/LandingPages/FacultyManagement/FacultyApproval')
                  setIsOpen(false)
                }}
              >
                View All
              </button>
            )}
          </div>

          <div className="notification-list">
            {loading ? (
              <div className="notification-empty">
                <div className="loading-spinner"></div>
                <p>Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="notification-empty">
                <Bell size={40} />
                <p>No new notifications</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div 
                  key={notif.id}
                  className={`notification-item ${!notif.read ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(notif)}
                >
                  <div className="notification-icon">
                    {getNotificationIcon(notif.type)}
                  </div>
                  <div className="notification-content">
                    <span className="notification-title">{notif.title}</span>
                    <span className="notification-message">{notif.message}</span>
                    <span className="notification-time">
                      <Clock size={12} /> {formatTime(notif.timestamp)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="notification-footer">
              <button 
                className="approve-all-btn"
                onClick={() => {
                  router.push('/LandingPages/FacultyManagement/FacultyApproval')
                  setIsOpen(false)
                }}
              >
                <UserPlus size={16} />
                Review {pendingCount} Pending Request{pendingCount !== 1 ? 's' : ''}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
