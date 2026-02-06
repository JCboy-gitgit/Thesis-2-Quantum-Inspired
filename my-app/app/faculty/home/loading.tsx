'use client'

import { useState, useEffect } from 'react'

type Theme = 'light' | 'dark'

export default function FacultyHomeLoading() {
  // Initialize with a function to read from localStorage immediately
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('faculty-base-theme')
      // Default to light for faculty pages unless explicitly dark
      return savedTheme === 'dark' ? 'dark' : 'light'
    }
    return 'light' // Default to light for faculty
  })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Read theme from localStorage to confirm
    const savedTheme = localStorage.getItem('faculty-base-theme')
    // Faculty uses light/dark only - convert green to light
    setTheme(savedTheme === 'dark' ? 'dark' : 'light')
    setMounted(true)
  }, [])

  // Prevent flash by not rendering until theme is determined
  if (!mounted) {
    return null
  }

  // Faculty pages treat 'green' as 'light' mode (already normalized above)
  const isLight = theme === 'light'

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px',
        zIndex: 9999,
        background: isLight 
          ? 'linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%)'
          : 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #0f142d 100%)',
        color: isLight ? '#1e293b' : '#ffffff',
      }}
    >
      {/* Animated spinner - green for light, cyan for dark */}
      <div 
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          border: `4px solid ${isLight ? 'rgba(16, 185, 129, 0.2)' : 'rgba(0, 212, 255, 0.3)'}`,
          borderTopColor: isLight ? '#10b981' : '#00d4ff',
          animation: 'spin 1s linear infinite',
        }}
      />
      
      {/* Loading text */}
      <p style={{
        fontSize: '14px',
        color: isLight ? '#64748b' : '#94a3b8',
        margin: 0,
      }}>
        Loading your dashboard...
      </p>

      {/* Keyframes */}
      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}
