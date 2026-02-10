'use client'

import { useState, useEffect } from 'react'

type Theme = 'light' | 'dark'
type CollegeTheme = 'default' | 'science' | 'arts-letters' | 'architecture'

export default function FacultyHomeLoading() {
  // Initialize with theme and college theme from localStorage
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('faculty-base-theme')
      return savedTheme === 'dark' ? 'dark' : 'light'
    }
    return 'light'
  })
  const [collegeTheme, setCollegeTheme] = useState<CollegeTheme>('default')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Read both theme and college theme from localStorage
    const savedTheme = localStorage.getItem('faculty-base-theme')
    const savedCollegeTheme = localStorage.getItem('faculty-college-theme') as CollegeTheme
    
    setTheme(savedTheme === 'dark' ? 'dark' : 'light')
    setCollegeTheme(
      savedCollegeTheme && ['science', 'arts-letters', 'architecture'].includes(savedCollegeTheme)
        ? savedCollegeTheme
        : 'default'
    )
    setMounted(true)
  }, [])

  // Prevent flash by not rendering until theme is determined
  if (!mounted) {
    return null
  }

  // Determine colors based on theme and college theme
  const isLight = theme === 'light'
  const getThemeColors = () => {
    if (isLight) {
      // Light mode colors based on college theme
      switch (collegeTheme) {
        case 'science':
          return {
            bg: '#f0f9ff',
            text: '#0c4a6e',
            secondary: '#0369a1',
            accent: '#0284c7',
          }
        case 'arts-letters':
          return {
            bg: '#faf5ff',
            text: '#581c87',
            secondary: '#7e22ce',
            accent: '#a855f7',
          }
        case 'architecture':
          return {
            bg: '#fff7ed',
            text: '#92400e',
            secondary: '#ea580c',
            accent: '#f97316',
          }
        default: // default
          return {
            bg: '#ffffff',
            text: '#1e293b',
            secondary: '#64748b',
            accent: '#10b981',
          }
      }
    } else {
      // Dark mode colors based on college theme
      switch (collegeTheme) {
        case 'science':
          return {
            bg: '#001f3f',
            text: '#e0f2fe',
            secondary: '#38bdf8',
            accent: '#0284c7',
          }
        case 'arts-letters':
          return {
            bg: '#1e1033',
            text: '#f3e8ff',
            secondary: '#d8b4fe',
            accent: '#a855f7',
          }
        case 'architecture':
          return {
            bg: '#1f1010',
            text: '#fed7aa',
            secondary: '#fb923c',
            accent: '#f97316',
          }
        default: // default for dark
          return {
            bg: '#0a0e27',
            text: '#ffffff',
            secondary: '#94a3b8',
            accent: '#00d4ff',
          }
      }
    }
  }

  const colors = getThemeColors()

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
        background: colors.bg,
        color: colors.text,
      }}
      data-theme={theme}
      data-college-theme={collegeTheme}
    >
      {/* Animated spinner with college theme accent */}
      <div 
        style={{
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          border: `4px solid ${colors.secondary}40`,
          borderTopColor: colors.accent,
          animation: 'spin 1s linear infinite',
          boxShadow: `0 0 16px ${colors.accent}40`,
        }}
      />
      
      {/* Loading text */}
      <p style={{
        fontSize: '15px',
        fontWeight: 500,
        color: colors.secondary,
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
