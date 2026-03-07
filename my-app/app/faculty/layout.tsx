'use client'

import { useEffect, useLayoutEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/app/context/ThemeContext'
import LoadingFallback from '@/app/components/LoadingFallback'
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
  const pathname = usePathname()
  const { theme, collegeTheme } = useTheme()

  const isAuthPage = pathname?.includes('/login') || pathname?.includes('/reset-password')
  const isLightMode = theme === 'light'

  // Heavy cleanup should only run when route context changes.
  useLayoutEffect(() => {
    purgeAdminStyles()

    document.body.classList.add('faculty-page', 'faculty-page-wrapper')

    return () => {
      document.body.classList.remove('faculty-page', 'faculty-page-wrapper')
    }
  }, [pathname])

  // Lightweight theme sync updates only when theme values actually change.
  useEffect(() => {
    applyFacultyStyles(isLightMode)

    document.documentElement.setAttribute('data-theme', theme)
    document.body.setAttribute('data-theme', theme)
    if (collegeTheme) {
      document.documentElement.setAttribute('data-college-theme', collegeTheme)
      document.body.setAttribute('data-college-theme', collegeTheme)
    }
  }, [theme, collegeTheme, isLightMode])

  // Auth pages render immediately
  if (isAuthPage) {
    return <>{children}</>
  }

  return <>{children}</>
}
