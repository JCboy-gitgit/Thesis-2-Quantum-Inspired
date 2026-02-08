'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { clearBrowserCaches } from '@/lib/clearCache'
import {
  Map, Building2, Layers, CheckCircle2, XCircle,
  Sun, Moon, Clock
} from 'lucide-react'
import FacultySidebar from '@/app/components/FacultySidebar'
import FacultyMenuBar from '@/app/components/FacultyMenuBar'
import RoomViewer2D from '@/app/components/RoomViewer2D'
import { useTheme } from '@/app/context/ThemeContext'
import '@/app/styles/faculty-global.css'
import s from './campus-map.module.css'

/* ─── Types ─── */
interface UserProfile {
  id: string
  email: string
  full_name: string
  department_id?: number
  department?: string
  college?: string
  role: string
  is_active: boolean
  avatar_url?: string
}

interface FloorPlanRow {
  id: number
  building_id: number
  floor_number: number
  buildings?: { id: number; name: string } | null
}

/* ─── Helpers ─── */
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL

function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now
}

/* ─── Component ─── */
export default function FacultyCampusMapPage() {
  const router = useRouter()
  const { theme, collegeTheme, setTheme } = useTheme()
  const clock = useClock()

  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMenuBarHidden, setIsMenuBarHidden] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [emptyRoomMode, setEmptyRoomMode] = useState(false)

  // Stats
  const [buildingCount, setBuildingCount] = useState(0)
  const [floorCount, setFloorCount] = useState(0)

  const isLightMode = theme === 'light'

  /* ─── Responsive ─── */
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  /* ─── Auth ─── */
  useEffect(() => {
    setMounted(true)
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) { router.push('/'); return }
        if (session.user.email === ADMIN_EMAIL) { router.push('/LandingPages/Home'); return }

        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single() as { data: UserProfile | null; error: any }

        if (userError || !userData || !userData.is_active) {
          await clearBrowserCaches()
          await supabase.auth.signOut()
          router.push('/')
          return
        }
        setUser(userData)
      } catch {
        router.push('/')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  /* ─── Fetch lightweight stats ─── */
  useEffect(() => {
    ;(async () => {
      try {
        const db = supabase as any
        const { data: fps } = await db
          .from('floor_plans')
          .select('building_id, floor_number, buildings(id, name)')
          .or('is_default_view.eq.true,is_published.eq.true')

        if (fps && fps.length > 0) {
          const uniqueBuildings = new Set(fps.map((f: FloorPlanRow) => f.building_id))
          setBuildingCount(uniqueBuildings.size)
          setFloorCount(fps.length)
        }
      } catch { /* silent */ }
    })()
  }, [])

  /* ─── Formatted time strings ─── */
  const timeStr = useMemo(
    () => clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    [clock]
  )
  const dateStr = useMemo(
    () => clock.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
    [clock]
  )

  /* ─── Loading state ─── */
  if (loading || !mounted) {
    return (
      <div className={s.pageRoot} data-theme={theme} data-college-theme={collegeTheme}>
        <div className={s.loadingScreen}>
          <div className={s.spinner} />
          <span className={s.loadingText}>Loading campus map…</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`${s.pageRoot} faculty-page-wrapper`}
      data-theme={theme}
      data-college-theme={collegeTheme}
    >
      {/* Sidebar */}
      <FacultySidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        menuBarHidden={isMenuBarHidden}
      />

      {/* Main content area */}
      <div
        className={s.content}
        style={{ marginLeft: isDesktop && sidebarOpen ? 250 : 0 }}
      >
        {/* Menu bar */}
        <FacultyMenuBar
          onToggleSidebar={() => setSidebarOpen(o => !o)}
          sidebarOpen={sidebarOpen}
          isHidden={isMenuBarHidden}
          onToggleHidden={setIsMenuBarHidden}
          userEmail={user?.email}
        />

        <main className={s.main}>
          {/* ─── Hero Banner ─── */}
          <div className={s.heroBanner}>
            <div className={s.heroLeft}>
              <div className={s.heroIconBox}>
                <Map size={26} />
              </div>
              <div>
                <h1 className={s.heroTitle}>Campus Floor Plan</h1>
                <p className={s.heroSubtitle}>Interactive real-time view of campus buildings &amp; rooms</p>
              </div>
            </div>

            <div className={s.heroRight}>
              {/* Live clock */}
              <div className={s.liveBadge}>
                <span className={s.liveDot} />
                <Clock size={13} />
                <span>{timeStr}</span>
                <span style={{ opacity: 0.6 }}>·</span>
                <span>{dateStr}</span>
              </div>

              {/* Inline theme toggle */}
              <div className={s.themeToggle}>
                <button
                  className={`${s.themeToggleBtn} ${isLightMode ? s.active : ''}`}
                  onClick={() => setTheme('light')}
                  title="Light mode"
                >
                  <Sun size={14} /> Light
                </button>
                <button
                  className={`${s.themeToggleBtn} ${!isLightMode ? s.active : ''}`}
                  onClick={() => setTheme('dark')}
                  title="Dark mode"
                >
                  <Moon size={14} /> Dark
                </button>
              </div>
            </div>
          </div>

          {/* ─── Bento Stats Grid ─── */}
          <div className={s.bentoGrid}>
            {/* Buildings */}
            <div className={s.statCard}>
              <div className={`${s.statIconBox} ${s.buildings}`}>
                <Building2 size={22} />
              </div>
              <div className={s.statInfo}>
                <span className={s.statValue}>{buildingCount}</span>
                <span className={s.statLabel}>Buildings</span>
              </div>
            </div>

            {/* Floors */}
            <div className={s.statCard}>
              <div className={`${s.statIconBox} ${s.floors}`}>
                <Layers size={22} />
              </div>
              <div className={s.statInfo}>
                <span className={s.statValue}>{floorCount}</span>
                <span className={s.statLabel}>Floor Plans</span>
              </div>
            </div>

            {/* Available indicator */}
            <div className={s.statCard}>
              <div className={`${s.statIconBox} ${s.available}`}>
                <CheckCircle2 size={22} />
              </div>
              <div className={s.statInfo}>
                <span className={s.statValue} style={{ color: 'var(--cm-success)' }}>Live</span>
                <span className={s.statLabel}>Available Rooms</span>
              </div>
            </div>

            {/* Occupied indicator */}
            <div className={s.statCard}>
              <div className={`${s.statIconBox} ${s.occupied}`}>
                <XCircle size={22} />
              </div>
              <div className={s.statInfo}>
                <span className={s.statValue} style={{ color: 'var(--cm-danger)' }}>Live</span>
                <span className={s.statLabel}>Occupied Rooms</span>
              </div>
            </div>
          </div>

          {/* ─── Controls Bar ─── */}
          <div className={s.controlsBar}>
            <div className={s.controlsLeft}>
              {/* Empty room finder toggle */}
              <label className={s.emptyRoomToggle}>
                <div
                  className={`${s.toggleSwitch} ${emptyRoomMode ? s.active : ''}`}
                  onClick={() => setEmptyRoomMode(v => !v)}
                >
                  <div className={s.toggleKnob} />
                </div>
                <div>
                  <span className={s.toggleLabel}>Empty Room Finder</span>
                  <span className={s.toggleHint}>
                    {emptyRoomMode ? ' · Highlighting available rooms' : ' · Showing all rooms'}
                  </span>
                </div>
              </label>
            </div>

            <div className={s.controlsRight}>
              {/* Legend */}
              <div className={s.legend}>
                <div className={s.legendItem}>
                  <span className={`${s.legendDot} ${s.green}`} />
                  <span>Available</span>
                </div>
                <div className={s.legendItem}>
                  <span className={`${s.legendDot} ${s.red}`} />
                  <span>Occupied</span>
                </div>
                <div className={s.legendItem}>
                  <span className={`${s.legendDot} ${s.gray}`} />
                  <span>Unknown</span>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Floor Plan Viewer ─── */}
          <div className={s.viewerCard}>
            <div className={s.viewerInner} style={{ height: 'calc(100vh - 360px)', minHeight: 430 }}>
              <RoomViewer2D collegeTheme={collegeTheme} highlightEmpty={emptyRoomMode} />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
