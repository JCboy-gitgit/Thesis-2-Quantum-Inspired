'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { MdMenu as Menu, MdPerson as User, MdLogout as LogOut, MdSettings as SettingsIcon, MdAccountCircle as UserCircle, MdKeyboardArrowUp as ChevronUp, MdKeyboardArrowDown as ChevronDown, MdArchive as Archive, MdDownload as Download } from 'react-icons/md'
import { clearBrowserCaches } from '@/lib/clearCache'
import SettingsModal from './SettingsModal'
import ArchiveModal from './ArchiveModal'
import ProfileModal from './ProfileModal'
import NotificationBell from './NotificationBell'
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
  const [showArchive, setShowArchive] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isMenuBarHidden, setIsMenuBarHidden] = useState(false)
  const [pendingRegistrations, setPendingRegistrations] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstallable, setIsInstallable] = useState(false)

  const ADMIN_EMAIL = 'admin123@ms.bulsu.edu.ph'

  useEffect(() => {
    // Get current user email
    const fetchUserEmail = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email || null)
        setIsAdmin(user.email === ADMIN_EMAIL)

        // Fetch pending registrations count for admin
        if (user.email === ADMIN_EMAIL) {
          fetchPendingCount()
        }
      }
    }

    fetchUserEmail()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserEmail(session.user.email || null)
        setIsAdmin(session.user.email === ADMIN_EMAIL)

        if (session.user.email === ADMIN_EMAIL) {
          fetchPendingCount()
        }
      } else {
        setUserEmail(null)
        setIsAdmin(false)
      }
    })

    // Poll for new registrations every 30 seconds for admin
    const interval = setInterval(() => {
      if (isAdmin) {
        fetchPendingCount()
      }
    }, 30000)

    return () => {
      subscription.unsubscribe()
      clearInterval(interval)
    }
  }, [isAdmin])

  // PWA Install prompt listener
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstallable(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Check if already installed
    const mediaQuery = window.matchMedia('(display-mode: standalone)')
    if (mediaQuery.matches) {
      setIsInstallable(false)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setIsInstallable(false)
    }
    setDeferredPrompt(null)
    setShowAccountMenu(false)
  }

  // Close account menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.account-section')) {
        setShowAccountMenu(false)
      }
    }

    if (showAccountMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showAccountMenu])

  const fetchPendingCount = async () => {
    try {
      const response = await fetch('/api/faculty-registration?status=pending')
      const data = await response.json()
      setPendingRegistrations(data.registrations?.length || 0)
    } catch (error) {
      console.error('Error fetching pending count:', error)
    }
  }

  const handleLogout = async () => {
    // Sync current theme to login preference before logging out
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light'
    // Map 'green' (admin) to 'dark' for login page, otherwise match
    const loginThemePref = currentTheme === 'green' ? 'dark' : currentTheme
    localStorage.setItem('login-theme-preference', loginThemePref)

    await clearBrowserCaches()
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
          {/* Notification Bell - Only for Admin */}
          {isAdmin && showAccountIcon && (
            <NotificationBell
              pendingCount={pendingRegistrations}
              onNotificationClick={() => fetchPendingCount()}
            />
          )}

          {showAccountIcon && (
            <div className="account-section">
              <button
                className="account-button"
                onClick={() => setShowAccountMenu(!showAccountMenu)}
                title="Account Menu"
              >
                <div className="account-avatar">
                  <User size={20} />
                </div>
                <ChevronDown size={14} className={`account-chevron ${showAccountMenu ? 'rotated' : ''}`} />
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
                      setShowProfile(true)
                    }}
                  >
                    <UserCircle size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                    Profile
                  </div>
                  {isAdmin && (
                    <div
                      className="account-menu-item"
                      onClick={() => {
                        setShowAccountMenu(false)
                        setShowArchive(true)
                      }}
                    >
                      <Archive size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                      Archive
                    </div>
                  )}
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
                  {isInstallable && (
                    <div
                      className="account-menu-item"
                      onClick={handleInstallClick}
                    >
                      <Download size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                      Install App
                    </div>
                  )}
                  <div className="account-menu-divider"></div>
                  <div
                    className="account-menu-item logout-item"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowAccountMenu(false)
                      handleLogout()
                    }}
                  >
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

      <ArchiveModal
        isOpen={showArchive}
        onClose={() => setShowArchive(false)}
      />

      <ProfileModal
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
      />
    </>
  )
}