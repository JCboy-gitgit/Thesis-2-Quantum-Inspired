'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Menu, User, LogOut, Settings as SettingsIcon, UserCircle } from 'lucide-react'
import './MenuBar.css'

interface MenuBarProps {
  onToggleSidebar: () => void
  showSidebarToggle?: boolean
  showAccountIcon?: boolean
}

export default function MenuBar({ onToggleSidebar, showSidebarToggle = false, showAccountIcon = true }: MenuBarProps) {
  const router = useRouter()
  const [showAccountMenu, setShowAccountMenu] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    // Get current user email
    const fetchUserEmail = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email || null)
      }
    }

    fetchUserEmail()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserEmail(session.user.email || null)
      } else {
        setUserEmail(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <header className="menu-bar">
      <div className="menu-bar-left">
        {showSidebarToggle && (
          <button className="menu-toggle" onClick={onToggleSidebar}>
            <Menu size={24} />
          </button>
        )}
        <div className="logo">
          <span className="logo-icon">Q</span>
          <span className="logo-text">Qtime Scheduler</span>
        </div>
      </div>

      <div className="menu-bar-right">
        {showAccountIcon && (
          <div className="account-section">
            <button 
              className="account-button"
              onClick={() => setShowAccountMenu(!showAccountMenu)}
            >
              <div className="account-avatar">
                <User size={20} />
              </div>
            </button>
            
            {showAccountMenu && (
              <div className="account-menu">
                {userEmail && (
                  <>
                    <div className="account-menu-email">
                      <UserCircle size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                      {userEmail}
                    </div>
                    <div className="account-menu-divider"></div>
                  </>
                )}
                <div className="account-menu-item">
                  <UserCircle size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                  Profile
                </div>
                <div className="account-menu-item">
                  <SettingsIcon size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                  Settings
                </div>
                <div className="account-menu-divider"></div>
                <div className="account-menu-item" onClick={handleLogout}>
                  <LogOut size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                  Logout
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}