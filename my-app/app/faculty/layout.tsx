'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import '@/app/styles/faculty-global.css'

// Helper to get initial theme from localStorage (client-side only)
function getInitialTheme(): boolean {
  if (typeof window !== 'undefined') {
    const savedTheme = localStorage.getItem('faculty-base-theme')
    // Default to light for faculty pages, unless explicitly set to dark
    return savedTheme !== 'dark'
  }
  return true // Default to light mode
}

export default function FacultyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [mounted, setMounted] = useState(false)
  // Always start with light to match SSR, update after mount
  const [isLightMode, setIsLightMode] = useState(true)
  const pathname = usePathname()

  // Login and reset-password pages handle their own loading states
  const isAuthPage = pathname?.includes('/login') || pathname?.includes('/reset-password')

  useEffect(() => {
    // Apply theme immediately from localStorage
    const savedTheme = localStorage.getItem('faculty-base-theme')
    const savedCollegeTheme = localStorage.getItem('faculty-college-theme')

    // Faculty defaults to light mode - only use dark if explicitly set
    const effectiveTheme = savedTheme === 'dark' ? 'dark' : 'light'
    setIsLightMode(effectiveTheme === 'light')
    document.documentElement.setAttribute('data-theme', effectiveTheme)

    if (savedCollegeTheme) {
      document.documentElement.setAttribute('data-college-theme', savedCollegeTheme)
    }

    setMounted(true)
  }, [])

  // Auth pages (login, reset-password) render immediately without loading spinner
  if (isAuthPage) {
    return <>{children}</>
  }

  // Don't render children until mounted to prevent flash
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
