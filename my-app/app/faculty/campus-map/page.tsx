'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { clearBrowserCaches } from '@/lib/clearCache'
import {
  MdMap, MdBusiness, MdLayers,
  MdLightMode, MdDarkMode, MdAccessTime
} from 'react-icons/md'
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
  const [isCampusMapFullscreen, setIsCampusMapFullscreen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)

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
      ; (async () => {
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
    ; (async () => {
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
        isOpen={isCampusMapFullscreen ? false : sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        menuBarHidden={isMenuBarHidden || isCampusMapFullscreen}
      />

      {/* Main content area */}
      <div
        className={s.content}
        style={{ marginLeft: isCampusMapFullscreen ? 0 : (isDesktop && sidebarOpen ? 250 : 0) }}
      >
        {/* Menu bar */}
        {!isCampusMapFullscreen && (
          <FacultyMenuBar
            onToggleSidebar={() => setSidebarOpen(o => !o)}
            sidebarOpen={sidebarOpen}
            isHidden={isMenuBarHidden}
            onToggleHidden={setIsMenuBarHidden}
            userEmail={user?.email}
          />
        )}

        <main className={`${s.main} ${isMenuBarHidden ? s.mainMenuHidden : ''}`}>
          {/* ─── Compact Header Row ─── */}
          <div className={s.heroBanner}>
            <div className={s.heroLeft}>
              <div className={s.heroIconBox}>
                <MdMap size={20} />
              </div>
              <div>
                <h1 className={s.heroTitle}>Live Floor Plan</h1>
              </div>
            </div>

            <div className={s.heroCenter}>
              {/* Inline Stats */}
              <div className={s.inlineStats}>
                <div className={s.inlineStat}>
                  <MdBusiness size={14} />
                  <span className={s.inlineStatValue}>{buildingCount}</span>
                  <span className={s.inlineStatLabel}>Buildings</span>
                </div>
                <div className={s.inlineStat}>
                  <MdLayers size={14} />
                  <span className={s.inlineStatValue}>{floorCount}</span>
                  <span className={s.inlineStatLabel}>Floors</span>
                </div>
                <span className={s.statDivider} />
                <div className={s.inlineStat}>
                  <span className={`${s.legendDot} ${s.green}`} />
                  <span>Available</span>
                </div>
                <div className={s.inlineStat}>
                  <span className={`${s.legendDot} ${s.red}`} />
                  <span>Occupied</span>
                </div>
              </div>
            </div>

            <div className={s.heroRight}>
              {/* Live clock */}
              <div className={s.liveBadge}>
                <span className={s.liveDot} />
                <MdAccessTime size={12} />
                <span>{timeStr}</span>
              </div>

              {/* Theme toggle */}
              <div className={s.themeToggle}>
                <button
                  className={`${s.themeToggleBtn} ${isLightMode ? s.active : ''}`}
                  onClick={() => setTheme('light')}
                  title="Light mode"
                >
                  <MdLightMode size={13} />
                </button>
                <button
                  className={`${s.themeToggleBtn} ${!isLightMode ? s.active : ''}`}
                  onClick={() => setTheme('dark')}
                  title="Dark mode"
                >
                  <MdDarkMode size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* ─── Floor Plan Viewer ─── */}
          <div className={s.viewerCard}>
            <div className={s.viewerInner} style={{ height: isMenuBarHidden ? 'calc(100vh - 50px)' : 'calc(100vh - 100px)', minHeight: 300 }}>
              <RoomViewer2D
                collegeTheme={collegeTheme}
                sidebarWidth={isDesktop && sidebarOpen ? 250 : 0}
                menuBarHeight={isMenuBarHidden || isCampusMapFullscreen ? 0 : (isDesktop ? 70 : 56)}
                onToggleFullscreen={(nextIsFullscreen) => {
                  setIsCampusMapFullscreen(nextIsFullscreen)
                  if (nextIsFullscreen) {
                    setSidebarOpen(false)
                    setIsMenuBarHidden(true)
                  } else {
                    setIsMenuBarHidden(false)
                  }
                }}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
