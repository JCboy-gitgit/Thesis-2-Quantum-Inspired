'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  MdDashboard,
  MdPeople,
  MdCalendarToday,
  MdPerson,
  MdMap,
  MdLiveTv,
  MdEventNote,
  MdLock
} from 'react-icons/md'
import { supabase } from '@/lib/supabaseClient'
import styles from './FacultySidebar.module.css'

interface FacultySidebarProps {
  isOpen: boolean
  onClose?: () => void
  menuBarHidden?: boolean
}

export default function FacultySidebar({ isOpen, onClose, menuBarHidden }: FacultySidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isScheduleLocked, setIsScheduleLocked] = useState(false)

  // Check if the current/active schedule is locked
  useEffect(() => {
    const checkLockStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('generated_schedules')
          .select('id, is_locked')
          .eq('is_current', true)
          .order('activated_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (!error && data) {
          setIsScheduleLocked(Boolean((data as any).is_locked))
        } else {
          setIsScheduleLocked(false)
        }
      } catch {
        setIsScheduleLocked(false)
      }
    }

    checkLockStatus()

    // Listen for realtime changes via postgres_changes (fallback)
    const dbChannel = supabase
      .channel('sidebar_schedule_lock')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'generated_schedules',
      }, () => {
        checkLockStatus()
      })
      .subscribe()

    // Listen for broadcast events (instant updates from admin)
    const broadcastChannel = supabase
      .channel('schedule_lock_broadcast')
      .on('broadcast', { event: 'lock_status_changed' }, (payload) => {
        if (payload.payload && typeof payload.payload.isLocked === 'boolean') {
          setIsScheduleLocked(payload.payload.isLocked)
        } else {
          checkLockStatus()
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(dbChannel)
      supabase.removeChannel(broadcastChannel)
    }
  }, [])

  const lockMessage = 'Live features are disabled until the admin locks the current schedule.'

  // Build menu items based on lock state
  const menuItems = [
    { icon: MdDashboard, label: 'Dashboard', path: '/faculty/home' },
    { icon: MdPerson, label: 'My Profile', path: '/faculty/profile' },
    isScheduleLocked
      ? { icon: MdEventNote, label: 'My Schedule', path: '/faculty/my-schedule' }
      : { icon: MdCalendarToday, label: 'My New Schedule', path: '/faculty/schedules' },
    {
      icon: MdMap,
      label: 'Live Floor Map',
      path: '/faculty/campus-map',
      disabled: !isScheduleLocked,
      disabledReason: lockMessage,
    },
    {
      icon: MdLiveTv,
      label: 'Live Schedule',
      path: '/faculty/live-timetable',
      disabled: !isScheduleLocked,
      disabledReason: lockMessage,
    },
  ]

  const handleNavigation = (path: string, disabled?: boolean, disabledReason?: string) => {
    if (disabled) {
      alert(disabledReason || lockMessage)
      return
    }
    router.push(path)
    if (onClose) onClose()
  }

  const handleLogout = async () => {
    try {
      // Sync current theme to login preference
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light'
      localStorage.setItem('login-theme-preference', currentTheme === 'dark' ? 'dark' : 'light')

      await supabase.auth.signOut()
      router.push('/')
    } catch (error) {
      console.error('Logout failed:', error)
      router.push('/')
    }
  }

  const isActive = (path: string) => {
    return pathname === path
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div className={styles.overlay} onClick={onClose}></div>
      )}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${isOpen ? styles.open : styles.closed} ${menuBarHidden ? styles.menuHidden : ''}`}>
        {/* Navigation Menu */}
        <nav className={styles.sidebarNav}>
          {menuItems.map((item, index) => {
            const Icon = item.icon
            const active = isActive(item.path)

            return (
              <button
                key={index}
                onClick={() => handleNavigation(item.path, (item as any).disabled, (item as any).disabledReason)}
                className={`${styles.menuItem} ${active ? styles.active : ''} ${(item as any).disabled ? styles.disabled : ''}`}
                title={(item as any).disabled ? (item as any).disabledReason : undefined}
                aria-disabled={(item as any).disabled ? true : false}
              >
                <Icon size={20} />
                <span>{item.label}</span>
                {(item as any).disabled && <MdLock size={14} />}
              </button>
            )
          })}
        </nav>

        {/* Bottom Actions - Removed Logout */}
        <div className={styles.sidebarFooter}>
          {/* Empty footer or can add other actions */}
        </div>
      </aside>
    </>
  )
}
