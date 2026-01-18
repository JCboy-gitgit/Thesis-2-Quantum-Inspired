'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Menu, User, LogOut, Settings as SettingsIcon, UserCircle, ChevronUp, ChevronDown } from 'lucide-react'
import SettingsModal from './SettingsModal'
import './MenuBar.css'

interface MenuBarProps {
  onToggleSidebar: () => void
  showSidebarToggle?: boolean
  showAccountIcon?: boolean
  onMenuBarToggle?: (isHidden: boolean) => void
  setSidebarOpen?: (open: boolean) => void
}

export default function MenuBar({ onToggleSidebar, showSidebarToggle = false, showAccountIcon = true, onMenuBarToggle, setSidebarOpen }: MenuBarProps) {
  const router = useRouter()
  const [showAccountMenu, setShowAccountMenu] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isMenuBarHidden, setIsMenuBarHidden] = useState(false)

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

  const toggleMenuBar = () => {
    const newState = !isMenuBarHidden
    setIsMenuBarHidden(newState)
    onMenuBarToggle?.(newState)
    // Also hide sidebar when hiding menu bar
    if (newState && setSidebarOpen) {
      setSidebarOpen(false)
    }
  }

  return (
    <>
      <header className={`menu-bar ${isMenuBarHidden ? 'menu-bar-hidden' : ''}`}>
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
                <div 
                  className="account-menu-item"
                  onClick={() => {
                    setShowAccountMenu(false)
                    router.push('/LandingPages/Profile')
                  }}
                >
                  <UserCircle size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                  Profile
                </div>
                <div 
                  className="account-menu-item"
                  onClick={() => {
                    setShowAccountMenu(false)
                    setShowSettings(true)
                  }}
                >
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

        {/* Toggle Arrow Button - inside header */}
        <button 
          className="menu-bar-toggle-btn"
          onClick={toggleMenuBar}
          title={isMenuBarHidden ? 'Show Menu Bar' : 'Hide Menu Bar'}
        >
          <ChevronUp size={18} />
        </button>
      </header>

      {/* Floating toggle button when menu is hidden */}
      {isMenuBarHidden && (
        <button 
          className="menu-bar-show-btn"
          onClick={toggleMenuBar}
          title="Show Menu Bar"
        >
          <ChevronDown size={18} />
        </button>
      )}

      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
    </>
  )
}