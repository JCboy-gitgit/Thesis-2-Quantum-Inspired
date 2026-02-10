'use client'

import { useState, useEffect } from 'react'

type Theme = 'light' | 'dark' | 'green'
type CollegeTheme = 'default' | 'science' | 'arts-letters' | 'architecture'

interface LoadingFallbackProps {
  message?: string
  variant?: 'page' | 'modal' | 'inline'
  theme?: Theme
  showSpinner?: boolean
}

export default function LoadingFallback({
  message = 'Loading...',
  variant = 'page',
  showSpinner = true
}: LoadingFallbackProps) {
  const [theme, setTheme] = useState<Theme>('green')
  const [collegeTheme, setCollegeTheme] = useState<CollegeTheme>('default')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('faculty-base-theme') || localStorage.getItem('admin-base-theme') || 'green'
      setTheme(savedTheme as Theme)

      const savedCollegeTheme = localStorage.getItem('faculty-college-theme')
      if (savedCollegeTheme && ['science', 'arts-letters', 'architecture'].includes(savedCollegeTheme)) {
        setCollegeTheme(savedCollegeTheme as CollegeTheme)
      }
      setMounted(true)
    }
  }, [])

  if (!mounted) return null

  const getColorScheme = () => {
    const isLight = theme === 'light'
    if (isLight) {
      switch (collegeTheme) {
        case 'science':
          return { primary: '#0284c7', secondary: '#38bdf8', bg: '#f0f9ff' }
        case 'arts-letters':
          return { primary: '#7e22ce', secondary: '#d8b4fe', bg: '#faf5ff' }
        case 'architecture':
          return { primary: '#ea580c', secondary: '#fb923c', bg: '#fff7ed' }
        default:
          return { primary: '#10b981', secondary: '#34d399', bg: '#ffffff' }
      }
    } else {
      switch (collegeTheme) {
        case 'science':
          return { primary: '#0284c7', secondary: '#0284c7', bg: '#001f3f' }
        case 'arts-letters':
          return { primary: '#a855f7', secondary: '#a855f7', bg: '#1e1033' }
        case 'architecture':
          return { primary: '#f97316', secondary: '#f97316', bg: '#1f1010' }
        default:
          return { primary: '#00d4ff', secondary: '#00d4ff', bg: '#0a0e27' }
      }
    }
  }

  const colors = getColorScheme()

  if (variant === 'page') {
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
          background: colors.bg,
          color: colors.primary,
          zIndex: 9999,
          overflow: 'hidden'
        }}
        data-theme={theme}
        data-college-theme={collegeTheme}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle at 50% 50%, ${colors.secondary}15 0%, transparent 70%)`,
            animation: 'pulseGlow 3.5s ease-in-out infinite',
            pointerEvents: 'none'
          }}
        />

        {showSpinner && (
          <div
            style={{
              width: '56px',
              height: '56px',
              border: `4px solid ${colors.secondary}40`,
              borderTopColor: colors.primary,
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              boxShadow: `0 0 24px ${colors.secondary}40`,
              position: 'relative',
              zIndex: 2
            }}
          />
        )}

        {message && (
          <p
            style={{
              fontSize: '15px',
              fontWeight: 500,
              color: colors.primary,
              margin: 0,
              position: 'relative',
              zIndex: 2
            }}
          >
            {message}
          </p>
        )}

        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          @keyframes pulseGlow {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.6; }
          }
        `}</style>
      </div>
    )
  }

  if (variant === 'modal') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '48px 24px',
          minHeight: '300px'
        }}
      >
        {showSpinner && (
          <div
            style={{
              width: '48px',
              height: '48px',
              border: `4px solid ${colors.secondary}40`,
              borderTopColor: colors.primary,
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              boxShadow: `0 0 16px ${colors.secondary}30`
            }}
          />
        )}
        {message && <p style={{ color: colors.primary, fontSize: '14px', margin: 0 }}>{message}</p>}
        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px'
      }}
    >
      {showSpinner && (
        <div
          style={{
            width: '36px',
            height: '36px',
            border: `3px solid ${colors.secondary}40`,
            borderTopColor: colors.primary,
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }}
        />
      )}
      {message && <span style={{ color: colors.primary, fontSize: '13px' }}>{message}</span>}
      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
