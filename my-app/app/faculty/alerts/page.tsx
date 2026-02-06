'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import FacultySidebar from '@/app/components/FacultySidebar'
import FacultyMenuBar from '@/app/components/FacultyMenuBar'
import { CheckCircle2, Bell, AlertTriangle, Info } from 'lucide-react'
import { useTheme } from '@/app/context/ThemeContext'
import styles from './styles.module.css'
import '@/app/styles/faculty-global.css'

interface AlertItem {
  id: string
  title: string
  message: string
  severity: 'info' | 'success' | 'warning' | 'error'
  created_at: string
  receipt?: {
    status: 'unread' | 'read' | 'confirmed' | 'dismissed'
  } | null
}

export default function FacultyAlertsPage() {
  const router = useRouter()
  const { theme, collegeTheme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMenuBarHidden, setIsMenuBarHidden] = useState(false)
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [userId, setUserId] = useState<string | null>(null)

  const isLightMode = theme === 'light'

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/faculty/login')
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
      const response = await fetch(`/api/alerts?audience=faculty&userId=${encodeURIComponent(uid)}`)
      const data = await response.json()
      setAlerts(data.alerts || [])
    } catch (error) {
      console.error('Failed to load alerts:', error)
      setAlerts([])
    } finally {
      setLoading(false)
    }
  }

  const markReceipt = async (alertId: string, action: 'read' | 'confirm') => {
    if (!userId) return
    await fetch('/api/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId, userId, action })
    })
    fetchAlerts(userId)
  }

  const severityIcon = (level: string) => {
    if (level === 'success') return <CheckCircle2 size={16} />
    if (level === 'warning' || level === 'error') return <AlertTriangle size={16} />
    return <Info size={16} />
  }

  return (
    <div className={`min-h-screen faculty-page-wrapper ${isLightMode ? 'bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50' : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'}`} data-theme={theme} data-college-theme={collegeTheme}>
      <FacultySidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} menuBarHidden={isMenuBarHidden} />
      <div className="flex-1 flex flex-col min-h-screen transition-all duration-300" style={{ marginLeft: sidebarOpen ? '250px' : '0' }}>
        <FacultyMenuBar
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          sidebarOpen={sidebarOpen}
          isHidden={isMenuBarHidden}
          onToggleHidden={setIsMenuBarHidden}
        />

        <main className="flex-1 px-4 sm:px-6 md:px-8 pt-24 pb-10 max-w-[1400px] mx-auto w-full box-border">
          <div className={styles.header}>
            <div className={styles.titleWrap}>
              <div className={styles.iconBadge}><Bell size={18} /></div>
              <div>
                <h1 className={isLightMode ? styles.lightTitle : styles.darkTitle}>Alert Feed</h1>
                <p className={isLightMode ? styles.lightSubtitle : styles.darkSubtitle}>Schedule updates, room changes, and system notices.</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className={styles.loading}>Loading alerts...</div>
          ) : alerts.length === 0 ? (
            <div className={styles.empty}>No alerts right now.</div>
          ) : (
            <div className={styles.list}>
              {alerts.map(alert => (
                <div key={alert.id} className={styles.card} data-severity={alert.severity}>
                  <div className={styles.cardHeader}>
                    <div className={styles.severityIcon}>{severityIcon(alert.severity)}</div>
                    <div>
                      <h3>{alert.title}</h3>
                      <p>{new Date(alert.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <p className={styles.message}>{alert.message}</p>
                  <div className={styles.actions}>
                    <button className={styles.secondaryButton} onClick={() => markReceipt(alert.id, 'read')}>Mark Read</button>
                    <button className={styles.primaryButton} onClick={() => markReceipt(alert.id, 'confirm')}>Confirm Receipt</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
