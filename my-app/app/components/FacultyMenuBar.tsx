'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { clearBrowserCaches } from '@/lib/clearCache'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  MdMenu,
  MdNotifications,
  MdPerson,
  MdSettings,
  MdLogout,
  MdExpandLess,
  MdExpandMore,
  MdClose,
  MdDownload
} from 'react-icons/md'
import { supabase } from '@/lib/supabaseClient'
import { useTheme } from '@/app/context/ThemeContext'
import FacultySettingsModal from './FacultySettingsModal'
import NotificationPanel from './NotificationPanel'

interface FacultyMenuBarProps {
  onToggleSidebar: () => void
  sidebarOpen: boolean
  isHidden?: boolean
  onToggleHidden?: (hidden: boolean) => void
  userEmail?: string | null
}

// College theme color configurations
const collegeThemeColors = {
  default: {
    primary: '#00d4ff',
    primaryRgb: '0, 212, 255',
    gradient: 'from-cyan-400 via-cyan-500 to-cyan-700',
    gradientText: 'from-cyan-400 to-cyan-600',
    border: 'border-cyan-500/30',
    borderHover: 'border-cyan-500',
    text: 'text-cyan-500',
    textHover: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    bgHover: 'hover:bg-cyan-500/10',
    bgSolid: 'bg-cyan-500',
    shadow: 'hover:shadow-[0_0_15px_rgba(0,212,255,0.3)]',
  },
  science: {
    primary: '#10b981',
    primaryRgb: '16, 185, 129',
    gradient: 'from-emerald-400 via-emerald-500 to-emerald-700',
    gradientText: 'from-emerald-400 to-emerald-600',
    border: 'border-emerald-500/30',
    borderHover: 'border-emerald-500',
    text: 'text-emerald-500',
    textHover: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    bgHover: 'hover:bg-emerald-500/10',
    bgSolid: 'bg-emerald-500',
    shadow: 'hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]',
  },
  'arts-letters': {
    primary: '#f97316',
    primaryRgb: '249, 115, 22',
    gradient: 'from-orange-400 via-orange-500 to-orange-700',
    gradientText: 'from-orange-400 to-orange-600',
    border: 'border-orange-500/30',
    borderHover: 'border-orange-500',
    text: 'text-orange-500',
    textHover: 'text-orange-400',
    bg: 'bg-orange-500/10',
    bgHover: 'hover:bg-orange-500/10',
    bgSolid: 'bg-orange-500',
    shadow: 'hover:shadow-[0_0_15px_rgba(249,115,22,0.3)]',
  },
  architecture: {
    primary: '#ef4444',
    primaryRgb: '239, 68, 68',
    gradient: 'from-red-400 via-red-500 to-red-700',
    gradientText: 'from-red-400 to-red-600',
    border: 'border-red-500/30',
    borderHover: 'border-red-500',
    text: 'text-red-500',
    textHover: 'text-red-400',
    bg: 'bg-red-500/10',
    bgHover: 'hover:bg-red-500/10',
    bgSolid: 'bg-red-500',
    shadow: 'hover:shadow-[0_0_15px_rgba(239,68,68,0.3)]',
  },
}

// Light mode overrides (uses same college colors but with light background context)
const lightModeColors = {
  default: { text: 'text-blue-600', textHover: 'text-blue-700' },
  science: { text: 'text-emerald-600', textHover: 'text-emerald-700' },
  'arts-letters': { text: 'text-orange-600', textHover: 'text-orange-700' },
  architecture: { text: 'text-red-600', textHover: 'text-red-700' },
}

export default function FacultyMenuBar({
  onToggleSidebar,
  sidebarOpen,
  isHidden = false,
  onToggleHidden,
  userEmail
}: FacultyMenuBarProps) {
  const router = useRouter()
  const { theme, collegeTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [lastMetadata, setLastMetadata] = useState<number>(0)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstallable, setIsInstallable] = useState(false)

  // Faculty pages treat 'green' as 'light' mode (green is only for admin pages)
  const isLightMode = theme === 'light' || theme === 'green'

  // Get current college theme colors
  const colors = useMemo(() => {
    const base = collegeThemeColors[collegeTheme] || collegeThemeColors.default
    const lightOverrides = lightModeColors[collegeTheme] || lightModeColors.default
    return {
      ...base,
      text: isLightMode ? lightOverrides.text : base.text,
      textHover: isLightMode ? lightOverrides.textHover : base.textHover,
    }
  }, [collegeTheme, isLightMode])

  useEffect(() => {
    setMounted(true)
  }, [])

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
    setShowUserMenu(false)
  }

  // Function to fetch user avatar
  const fetchUserAvatar = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { data: userData } = await supabase
        .from('users')
        .select('avatar_url')
        .eq('id', session.user.id)
        .single()

      if (userData?.avatar_url) {
        // Add cache bust parameter to force refresh
        const avatarWithCacheBust = `${userData.avatar_url}?t=${Date.now()}`
        setUserAvatar(avatarWithCacheBust)
        setLastMetadata(Date.now())
      }
    } catch (error) {
      console.error('Failed to fetch user avatar:', error)
    }
  }

  // Fetch user avatar on mount and periodically (every 30 seconds) and when menu opens
  useEffect(() => {
    if (!mounted) return

    // Fetch immediately
    fetchUserAvatar()

    // Set up periodic refresh every 30 seconds
    const interval = setInterval(fetchUserAvatar, 30000)

    return () => clearInterval(interval)
  }, [mounted])

  // Also fetch when menu opens to get latest image
  useEffect(() => {
    if (showUserMenu && mounted) {
      fetchUserAvatar()
    }
  }, [showUserMenu, mounted])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowUserMenu(false)
      setShowNotifications(false)
    }

    if (showUserMenu || showNotifications) {
      // Small delay to prevent immediate close on the same click
      const timeout = setTimeout(() => {
        document.addEventListener('click', handleClickOutside)
      }, 0)
      return () => {
        clearTimeout(timeout)
        document.removeEventListener('click', handleClickOutside)
      }
    }
  }, [showUserMenu, showNotifications])

  const handleLogout = async () => {
    try {
      // Sync current theme to login preference before logging out
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light'
      localStorage.setItem('login-theme-preference', currentTheme === 'dark' ? 'dark' : 'light')

      await clearBrowserCaches()
      await supabase.auth.signOut()
      router.push('/')
    } catch (error) {
      console.error('Logout error:', error)
      router.push('/')
    }
  }

  const toggleHidden = () => {
    if (onToggleHidden) {
      onToggleHidden(!isHidden)
    }
  }

  return (
    <>
      {/* Main Header - Theme & College Theme Aware */}
      <header
        className={`fixed top-0 left-0 right-0 h-14 sm:h-16 md:h-[70px] flex items-center justify-between px-3 sm:px-4 md:px-8 backdrop-blur-md border-b-2 z-[90] transition-all duration-300 shadow-lg ${isHidden ? '-translate-y-full' : ''} ${isLightMode
          ? `bg-white/95 ${colors.border}`
          : `bg-slate-900/95 ${colors.border}`
          }`}
        style={{ ['--menu-accent' as string]: colors.primary, ['--menu-accent-rgb' as string]: colors.primaryRgb }}
      >
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Sidebar Toggle Button */}
          <button
            className={`flex w-10 h-10 sm:w-11 sm:h-11 bg-transparent border-2 rounded-lg cursor-pointer items-center justify-center transition-all faculty-menu-btn ${colors.border} ${colors.text}`}
            style={{ ['--btn-hover-border' as string]: colors.primary, ['--btn-hover-bg' as string]: `rgba(${colors.primaryRgb}, 0.1)` }}
            onClick={onToggleSidebar}
            title={sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
          >
            <MdMenu size={20} className="sm:w-6 sm:h-6" />
          </button>

          {/* Logo/Branding - Uses College Theme Colors */}
          <div className="flex items-center gap-2 sm:gap-3">
            <span className={`w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-lg sm:rounded-xl flex items-center justify-center font-extrabold text-lg sm:text-xl text-white shadow-lg bg-gradient-to-br ${colors.gradient}`}>
              Q
            </span>
            <span className={`hidden sm:block text-base sm:text-lg md:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${colors.gradientText}`}>
              Qtime Faculty
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Notifications */}
          <NotificationPanel userRole="faculty" userEmail={userEmail} />

          {/* User Dropdown Button */}
          <button
            className={`w-10 h-10 sm:w-11 sm:h-11 bg-transparent border-2 rounded-full cursor-pointer flex items-center justify-center transition-all faculty-menu-btn ${colors.border} ${colors.text}`}
            style={{ ['--btn-hover-border' as string]: colors.primary, ['--btn-hover-bg' as string]: `rgba(${colors.primaryRgb}, 0.1)` }}
            onClick={(e) => {
              e.stopPropagation()
              setShowUserMenu(!showUserMenu)
              setShowNotifications(false)
            }}
            title="Account Menu"
          >
            {userAvatar ? (
              <img
                src={userAvatar}
                alt="Profile"
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <MdPerson size={18} className="sm:w-5 sm:h-5" />
            )}
          </button>
        </div>

        {/* Toggle Arrow Button - inside header */}
        <button
          className={`absolute -bottom-5 left-1/2 -translate-x-1/2 w-12 h-6 border-2 border-t-0 rounded-b-xl cursor-pointer flex items-center justify-center transition-all z-[91] shadow-lg faculty-menu-btn ${isLightMode
            ? `bg-white/95 ${colors.border} ${colors.text}`
            : `bg-slate-900/95 ${colors.border} ${colors.text}`
            }`}
          style={{ ['--btn-hover-border' as string]: colors.primary, ['--btn-hover-bg' as string]: `rgba(${colors.primaryRgb}, 0.1)` }}
          onClick={toggleHidden}
          title={isHidden ? 'Show Header' : 'Hide Header'}
        >
          <MdExpandLess size={18} />
        </button>
      </header>

      {/* Floating Show Button when header is hidden */}
      {isHidden && (
        <button
          className={`fixed top-0 left-1/2 -translate-x-1/2 w-14 h-8 border-2 border-t-0 rounded-b-2xl cursor-pointer flex items-center justify-center transition-all z-[1001] shadow-lg hover:translate-y-1 faculty-menu-btn ${isLightMode
            ? `bg-white/95 ${colors.border} ${colors.text}`
            : `bg-slate-900/95 ${colors.border} ${colors.text}`
            }`}
          style={{ ['--btn-hover-border' as string]: colors.primary, ['--btn-hover-bg' as string]: `rgba(${colors.primaryRgb}, 0.1)` }}
          onClick={toggleHidden}
          title="Show Header"
        >
          <MdExpandMore size={18} />
        </button>
      )}

      {/* Notifications Dropdown - Portal */}
      {mounted && showNotifications && createPortal(
        <div
          className="fixed inset-0 z-[99998]"
          style={{ pointerEvents: 'none' }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ pointerEvents: 'auto' }}
            onClick={() => setShowNotifications(false)}
          />
          {/* Dropdown Content */}
          <div
            className={`absolute right-4 sm:right-6 md:right-8 top-[70px] sm:top-[72px] w-[320px] max-w-[calc(100vw-32px)] border-2 rounded-2xl shadow-2xl p-3 ${isLightMode
              ? `bg-white ${colors.border}`
              : `bg-slate-900 ${colors.border}`
              }`}
            style={{ pointerEvents: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              className={`absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isLightMode
                ? 'bg-gray-100 text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              onClick={() => setShowNotifications(false)}
              type="button"
            >
              <MdClose size={18} />
            </button>

            <div className="flex items-center justify-between mb-3 pr-10">
              <h3 className={`font-semibold text-sm ${colors.text}`}>Notifications</h3>
            </div>

            <div className={`text-center py-6 text-sm ${isLightMode ? 'text-gray-500' : 'text-slate-400'}`}>
              <MdNotifications size={32} className="mx-auto mb-2 opacity-50" />
              <p>No new notifications</p>
              <p className={`text-xs mt-1 ${isLightMode ? 'text-gray-400' : 'text-slate-500'}`}>You&apos;re all caught up!</p>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* User Menu Dropdown - Portal */}
      {mounted && showUserMenu && createPortal(
        <div
          className="fixed inset-0 z-[99999]"
          style={{ pointerEvents: 'none' }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ pointerEvents: 'auto' }}
            onClick={() => setShowUserMenu(false)}
          />
          {/* Menu Content */}
          <div
            className={`absolute right-4 sm:right-6 md:right-8 top-[70px] sm:top-[72px] w-[280px] max-w-[calc(100vw-32px)] border-2 rounded-2xl shadow-2xl p-2 ${isLightMode
              ? `bg-white ${colors.border}`
              : `bg-slate-900 ${colors.border}`
              }`}
            style={{ pointerEvents: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              className={`absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isLightMode
                ? 'bg-gray-100 text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              onClick={() => setShowUserMenu(false)}
              type="button"
            >
              <MdClose size={18} />
            </button>

            {/* User Email */}
            {userEmail && (
              <>
                <div className={`flex items-center gap-2.5 px-4 py-3 text-sm font-semibold break-all pr-10 ${colors.text}`}>
                  <MdPerson size={16} />
                  {userEmail}
                </div>
                <div className={`h-px my-1 ${isLightMode ? `bg-current opacity-20` : `bg-current opacity-20`}`} style={{ color: colors.primary }} />
              </>
            )}

            {/* Profile Button */}
            <button
              className={`w-full p-3 bg-transparent border-none rounded-xl cursor-pointer flex items-center gap-3 text-sm font-medium transition-all text-left faculty-menu-item ${isLightMode
                ? `text-gray-700`
                : `text-white/90`
                }`}
              style={{ ['--tw-bg-opacity' as string]: '0.1', ['--item-hover-color' as string]: colors.primary }}
              onClick={() => {
                setShowUserMenu(false)
                router.push('/faculty/profile')
              }}
              type="button"
            >
              <MdPerson size={16} />
              Profile
            </button>

            {/* Settings Button */}
            <button
              className={`w-full p-3 bg-transparent border-none rounded-xl cursor-pointer flex items-center gap-3 text-sm font-medium transition-all text-left faculty-menu-item ${isLightMode
                ? `text-gray-700`
                : `text-white/90`
                }`}
              style={{ ['--item-hover-color' as string]: colors.primary }}
              onClick={() => {
                setShowUserMenu(false)
                setShowSettingsModal(true)
              }}
              type="button"
            >
              <MdSettings size={16} />
              Settings
            </button>

            {/* Install App Button (PWA) */}
            {isInstallable && (
              <button
                className={`w-full p-3 bg-transparent border-none rounded-xl cursor-pointer flex items-center gap-3 text-sm font-medium transition-all text-left faculty-menu-item ${isLightMode
                  ? `text-gray-700`
                  : `text-white/90`
                  }`}
                style={{ ['--item-hover-color' as string]: colors.primary }}
                onClick={handleInstallClick}
                type="button"
              >
                <MdDownload size={16} />
                Install App
              </button>
            )}

            <div className={`h-px my-1`} style={{ backgroundColor: `rgba(${colors.primaryRgb}, 0.2)` }} />

            {/* Logout Button */}
            <button
              className="w-full p-3 bg-transparent border-none rounded-xl text-red-500 cursor-pointer flex items-center gap-3 text-sm font-medium transition-all hover:bg-red-500/15 text-left"
              onClick={() => {
                setShowUserMenu(false)
                handleLogout()
              }}
              type="button"
            >
              <MdLogout size={16} />
              Logout
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Settings Modal */}
      <FacultySettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </>
  )
}
