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
  MdEventNote
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
          .eq('is_locked', true)
          .limit(1)

        if (!error && data && data.length > 0) {
          setIsScheduleLocked(true)
        } else {
          setIsScheduleLocked(false)
        }
      } catch {
        setIsScheduleLocked(false)
      }
    }

    checkLockStatus()

    // Listen for realtime changes to schedule lock status
    const channel = supabase
      .channel('sidebar_schedule_lock')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'generated_schedules',
      }, () => {
        checkLockStatus()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Build menu items based on lock state
  const menuItems = isScheduleLocked
    ? [
        { icon: MdDashboard, label: 'Dashboard', path: '/faculty/home' },
        { icon: MdPerson, label: 'My Profile', path: '/faculty/profile' },
        { icon: MdEventNote, label: 'My Schedule', path: '/faculty/my-schedule' },
        { icon: MdMap, label: 'Live Floor Map', path: '/faculty/campus-map' },
        { icon: MdLiveTv, label: 'Live Schedule', path: '/faculty/live-timetable' },
      ]
    : [
        { icon: MdDashboard, label: 'Dashboard', path: '/faculty/home' },
        { icon: MdPerson, label: 'My Profile', path: '/faculty/profile' },
        { icon: MdMap, label: 'My Schedule', path: '/faculty/schedules' },
        { icon: MdMap, label: 'Live Floor Map', path: '/faculty/campus-map' },
        { icon: MdLiveTv, label: 'Live Schedule', path: '/faculty/live-timetable' },
      ]

  const handleNavigation = (path: string) => {
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
                onClick={() => handleNavigation(item.path)}
                className={`${styles.menuItem} ${active ? styles.active : ''}`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
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
