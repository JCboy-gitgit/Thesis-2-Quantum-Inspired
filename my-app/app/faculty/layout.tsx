'use client'

import { useEffect, useState, useLayoutEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/app/context/ThemeContext'
import '@/app/styles/faculty-global.css'

// Aggressive CSS reset - clears ALL admin-specific styles
function purgeAdminStyles() {
  const html = document.documentElement
  const body = document.body
  
  // Remove ALL admin-related classes from body and html
  const adminClasses = [
    'admin-dashboard', 'admin-page', 'green', 'dark-mode', 'dark',
    'admin', 'admin-layout', 'admin-theme', 'sidebar-open', 'sidebar-collapsed'
  ]
  adminClasses.forEach(cls => {
    body.classList.remove(cls)
    html.classList.remove(cls)
  })
  
  // Clear inline styles that admin might have set
  const propsToRemove = [
    '--admin-bg', '--admin-sidebar-bg', '--admin-header-bg',
    '--sidebar-width', '--header-height', '--admin-primary',
    '--bg-primary', '--bg-secondary', '--bg-tertiary',
    '--primary', '--primary-dark', '--primary-light',
    '--accent', '--accent-light', '--accent-dark',
    'background', 'backgroundColor', 'color'
  ]
  
  propsToRemove.forEach(prop => {
    html.style.removeProperty(prop)
    body.style.removeProperty(prop)
  })
  
  // Remove any dynamically injected admin stylesheets
  document.querySelectorAll('style[data-admin], link[data-admin]').forEach(el => el.remove())
  
  // Force remove any admin-specific data attributes
  html.removeAttribute('data-admin-theme')
  body.removeAttribute('data-admin-theme')
}

// Apply faculty-specific styles
function applyFacultyStyles(isLightMode: boolean) {
  const html = document.documentElement
  const body = document.body
  
  // Set faculty class
  body.classList.add('faculty-page', 'faculty-page-wrapper')
  
  // Sync data-theme on body to prevent stale ancestor selector conflicts
  const currentTheme = html.getAttribute('data-theme')
  if (currentTheme) {
    body.setAttribute('data-theme', currentTheme)
  }
  
  // Force correct background and text colors
  const bgColor = isLightMode ? '#ffffff' : '#0a0e27'
  const textColor = isLightMode ? '#1e293b' : '#ffffff'
  
  html.style.setProperty('background', bgColor, 'important')
  body.style.setProperty('background', bgColor, 'important')
  body.style.setProperty('color', textColor, 'important')
  
  // Set faculty CSS variables for proper theming
  html.style.setProperty('--page-bg', bgColor)
  html.style.setProperty('--bg-primary', bgColor)
  html.style.setProperty('--bg-secondary', isLightMode ? '#f8fafc' : '#1a1f3a')
  html.style.setProperty('--card-bg', isLightMode ? 'rgba(255, 255, 255, 0.98)' : 'rgba(20, 26, 50, 0.95)')
  html.style.setProperty('--text-primary', textColor)
  html.style.setProperty('--text-secondary', isLightMode ? '#64748b' : 'rgba(255, 255, 255, 0.7)')
  html.style.setProperty('--text-muted', isLightMode ? '#94a3b8' : 'rgba(255, 255, 255, 0.5)')
  html.style.setProperty('--border-color', isLightMode ? '#e2e8f0' : 'rgba(0, 212, 255, 0.2)')
  html.style.setProperty('--divider-color', isLightMode ? '#e2e8f0' : 'rgba(0, 212, 255, 0.2)')
}

export default function FacultyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const { theme, collegeTheme } = useTheme()

  const isAuthPage = pathname?.includes('/login') || pathname?.includes('/reset-password')
  const isLightMode = theme === 'light'

  // Use useLayoutEffect for synchronous DOM updates before paint
  useLayoutEffect(() => {
    // CRITICAL: Purge admin styles first, before anything else
    purgeAdminStyles()
    
    // Apply faculty styles using theme from context
    applyFacultyStyles(isLightMode)
    
    // Update data attributes to match theme context on BOTH html and body
    // Body must be synced because the login page sets data-theme on body,
    // and stale values cause CSS ancestor selector conflicts
    document.documentElement.setAttribute('data-theme', theme)
    document.body.setAttribute('data-theme', theme)
    if (collegeTheme) {
      document.documentElement.setAttribute('data-college-theme', collegeTheme)
      document.body.setAttribute('data-college-theme', collegeTheme)
    }
    
    setMounted(true)
    
    return () => {
      document.body.classList.remove('faculty-page', 'faculty-page-wrapper')
      document.body.removeAttribute('data-theme')
      document.body.removeAttribute('data-college-theme')
    }
  }, [theme, collegeTheme, pathname]) // Re-run when theme changes or pathname changes

  // Auth pages render immediately
  if (isAuthPage) {
    return <>{children}</>
  }

  // Loading state - use current theme from context
  if (!mounted) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: isLightMode
            ? '#ffffff'
            : '#0a0e27',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: `3px solid ${isLightMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(0, 212, 255, 0.2)'}`,
            borderTopColor: isLightMode ? '#10b981' : '#00d4ff',
            animation: 'spin 1s linear infinite',
          }}
        />
        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  return <>{children}</>
}
