'use client'

import React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  Home,
  Users,
  Building2,
  Calendar,
  User,
  Map
} from 'lucide-react'
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

  const menuItems = [
    { icon: Home, label: 'Dashboard', path: '/faculty/home' },
    { icon: User, label: 'My Profile', path: '/faculty/profile' },
    { icon: Map, label: 'Campus Map', path: '/faculty/campus-map' },
    { icon: Users, label: 'Faculty Directory', path: '/faculty/directory' },
    { icon: Building2, label: 'Departments', path: '/faculty/departments' },
    { icon: Calendar, label: 'Room Schedules', path: '/faculty/schedules' },
  ]

  const handleNavigation = (path: string) => {
    router.push(path)
    if (onClose) onClose()
  }

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/faculty/login')
    } catch (error) {
      console.error('Logout failed:', error)
      router.push('/faculty/login')
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
