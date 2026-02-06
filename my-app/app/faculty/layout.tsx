'use client'

import { useEffect, useState, useLayoutEffect } from 'react'
import { usePathname } from 'next/navigation'
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
  body.classList.add('faculty-page')
  
  // Force correct background and text colors
  const bgColor = isLightMode ? '#f8fafc' : '#0a0e27'
  const textColor = isLightMode ? '#1e293b' : '#ffffff'
  
  html.style.setProperty('background', bgColor, 'important')
  body.style.setProperty('background', bgColor, 'important')
  body.style.setProperty('color', textColor, 'important')
  
  // Set faculty CSS variables
  html.style.setProperty('--bg-primary', bgColor)
  html.style.setProperty('--bg-secondary', isLightMode ? '#ffffff' : '#1a1f3a')
  html.style.setProperty('--text-primary', textColor)
  html.style.setProperty('--text-secondary', isLightMode ? '#64748b' : '#a0aec0')
  html.style.setProperty('--primary', isLightMode ? '#10b981' : '#00d4ff')
}

export default function FacultyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [mounted, setMounted] = useState(false)
  const [isLightMode, setIsLightMode] = useState(true)
  const pathname = usePathname()

  const isAuthPage = pathname?.includes('/login') || pathname?.includes('/reset-password')

  // Use useLayoutEffect for synchronous DOM updates before paint
  useLayoutEffect(() => {
    // CRITICAL: Purge admin styles first, before anything else
    purgeAdminStyles()
    
    // Get saved theme
    const savedTheme = localStorage.getItem('faculty-base-theme')
    const savedCollegeTheme = localStorage.getItem('faculty-college-theme')
    
    // Faculty defaults to light mode
    const effectiveTheme = savedTheme === 'dark' ? 'dark' : 'light'
    const lightMode = effectiveTheme === 'light'
    
    setIsLightMode(lightMode)
    document.documentElement.setAttribute('data-theme', effectiveTheme)
    
    if (savedCollegeTheme) {
      document.documentElement.setAttribute('data-college-theme', savedCollegeTheme)
    }
    
    // Apply faculty styles
    applyFacultyStyles(lightMode)
    
    setMounted(true)
    
    return () => {
      document.body.classList.remove('faculty-page')
    }
  }, [pathname]) // Re-run on pathname change to catch navigation from admin

  // Auth pages render immediately
  if (isAuthPage) {
    return <>{children}</>
  }

  // Loading state
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
            ? 'linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%)'
            : 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #0f142d 100%)',
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
