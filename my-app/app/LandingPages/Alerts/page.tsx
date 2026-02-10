'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { fetchNoCache } from '@/lib/fetchUtils'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import { Bell, Trash2, CheckCircle2, AlertTriangle, Info, Megaphone } from 'lucide-react'
import styles from './styles.module.css'

interface AlertItem {
  id: string
  title: string
  message: string
  audience: 'admin' | 'faculty' | 'all'
  severity: 'info' | 'success' | 'warning' | 'error'
  category: string
  created_at: string
  receipt?: {
    status: 'unread' | 'read' | 'confirmed' | 'dismissed'
  } | null
}

export default function AdminAlertsPage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [audience, setAudience] = useState<'faculty' | 'all'>('faculty')
  const [severity, setSeverity] = useState<'info' | 'success' | 'warning' | 'error'>('info')

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/')
        return
      }
      setUserId(session.user.id)
    }
    init()
  }, [router])

  useEffect(() => {
    if (userId) {
      fetchAlerts(userId)
    }
  }, [userId])

  const fetchAlerts = async (uid: string) => {
    setLoading(true)
    try {
      const response = await fetchNoCache(`/api/alerts?audience=admin&userId=${encodeURIComponent(uid)}`)
      const data = await response.json()
      setAlerts(data.alerts || [])
    } catch (error) {
      console.error('Failed to load alerts:', error)
      setAlerts([])
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAlert = async () => {
    if (!title.trim() || !message.trim()) return
    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          message,
          audience,
          severity,
          category: 'admin'
        })
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data?.error || 'Failed to create alert')
      }
      setTitle('')
      setMessage('')
      if (userId) {
        fetchAlerts(userId)
      }
    } catch (error) {
      console.error('Create alert error:', error)
    }
  }

  const updateReceipt = async (alertId: string, action: 'read' | 'dismiss') => {
    if (!userId) return
    await fetch('/api/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId, userId, action })
    })
    fetchAlerts(userId)
  }

  const deleteAlert = async (alertId: string) => {
    if (!confirm('Delete this alert?')) return
    await fetch(`/api/alerts/${alertId}`, { method: 'DELETE' })
    if (userId) {
      fetchAlerts(userId)
    }
  }

  const severityIcon = (level: string) => {
    if (level === 'success') return <CheckCircle2 size={16} />
    if (level === 'warning') return <AlertTriangle size={16} />
    if (level === 'error') return <AlertTriangle size={16} />
    return <Info size={16} />
  }

  return (
    <div className={styles.page}>
      <MenuBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} showSidebarToggle={true} setSidebarOpen={setSidebarOpen} />
      <Sidebar isOpen={sidebarOpen} />

      <main className={`${styles.main} ${!sidebarOpen ? styles.fullWidth : ''}`}>
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <div className={styles.iconBadge}><Bell size={18} /></div>
            <div>
              <h1>Admin Alerts</h1>
              <p>System updates, schedule jobs, and faculty notifications</p>
            </div>
          </div>
        </div>

        <section className={styles.composeCard}>
          <div className={styles.composeHeader}>
            <Megaphone size={18} />
            <span>Create Alert</span>
          </div>
          <div className={styles.composeGrid}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className={styles.input}
            />
            <select value={audience} onChange={(e) => setAudience(e.target.value as 'faculty' | 'all')} className={styles.select}>
              <option value="faculty">Faculty</option>
              <option value="all">All Users</option>
            </select>
            <select value={severity} onChange={(e) => setSeverity(e.target.value as any)} className={styles.select}>
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message"
            className={styles.textarea}
          />
          <button className={styles.primaryButton} onClick={handleCreateAlert}>
            Publish Alert
          </button>
        </section>

        <section className={styles.alertsSection}>
          {loading ? (
            <div className={styles.loading}>Loading alerts...</div>
          ) : alerts.length === 0 ? (
            <div className={styles.empty}>No alerts yet.</div>
          ) : (
            <div className={styles.alertsGrid}>
              {alerts.map(alert => (
                <div key={alert.id} className={styles.alertCard} data-severity={alert.severity}>
                  <div className={styles.alertHeader}>
                    <span className={styles.severityIcon}>{severityIcon(alert.severity)}</span>
                    <div>
                      <h3>{alert.title}</h3>
                      <p>{new Date(alert.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <p className={styles.message}>{alert.message}</p>
                  <div className={styles.alertActions}>
                    <button onClick={() => updateReceipt(alert.id, 'read')} className={styles.secondaryButton}>Mark Read</button>
                    <button onClick={() => updateReceipt(alert.id, 'dismiss')} className={styles.secondaryButton}>Dismiss</button>
                    <button onClick={() => deleteAlert(alert.id)} className={styles.deleteButton}><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
