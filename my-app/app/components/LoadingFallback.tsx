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
  theme: forcedTheme,
  showSpinner = false
}: LoadingFallbackProps) {
  const [theme, setTheme] = useState<Theme>(forcedTheme || 'green')
  const [collegeTheme, setCollegeTheme] = useState<CollegeTheme>('default')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (forcedTheme) {
        setTheme(forcedTheme)
      } else {
        const liveTheme = document.documentElement.getAttribute('data-theme')
        if (liveTheme && ['green', 'light', 'dark'].includes(liveTheme)) {
          setTheme(liveTheme as Theme)
        } else {
          const savedTheme = localStorage.getItem('faculty-base-theme') || localStorage.getItem('admin-base-theme') || 'green'
          setTheme(savedTheme as Theme)
        }
      }

      const liveCollegeTheme = document.documentElement.getAttribute('data-college-theme')
      if (liveCollegeTheme && ['science', 'arts-letters', 'architecture'].includes(liveCollegeTheme)) {
        setCollegeTheme(liveCollegeTheme as CollegeTheme)
      } else {
        const savedCollegeTheme = localStorage.getItem('faculty-college-theme')
        if (savedCollegeTheme && ['science', 'arts-letters', 'architecture'].includes(savedCollegeTheme)) {
          setCollegeTheme(savedCollegeTheme as CollegeTheme)
        }
      }
    }
  }, [forcedTheme])

  const SkeletonLine = ({ width = '100%', height = 10 }: { width?: string; height?: number }) => (
    <div className="q-skeleton" style={{ width, height, borderRadius: 999 }} />
  )

  if (variant === 'page') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          justifyContent: 'flex-start',
          gap: '14px',
          background: 'var(--background)',
          color: 'var(--text-primary)',
          overflow: 'hidden',
          padding: 'clamp(16px, 3vw, 32px)'
        }}
        data-theme={theme}
        data-college-theme={collegeTheme}
      >
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            width: '100%',
            maxWidth: '1280px',
            margin: '0 auto'
          }}
        >
          <div
            style={{
              height: 54,
              borderRadius: 12,
              border: '1px solid var(--card-border)',
              background: 'var(--card-bg)',
              padding: '0 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <SkeletonLine width="36px" height={36} />
            <SkeletonLine width="180px" height={12} />
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <SkeletonLine width="30px" height={30} />
              <SkeletonLine width="30px" height={30} />
            </div>
          </div>

          <div
            style={{
              marginTop: 14,
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: 14,
            }}
          >
            <div style={{ display: 'grid', gap: 12 }}>
              <div
                style={{
                  borderRadius: 14,
                  border: '1px solid var(--card-border)',
                  background: 'var(--card-bg)',
                  padding: 14,
                }}
              >
                <SkeletonLine width="36%" height={13} />
                <SkeletonLine width="92%" height={10} />
                <SkeletonLine width="64%" height={10} />
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 12,
                }}
              >
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={`card-${idx}`}
                    style={{
                      borderRadius: 14,
                      border: '1px solid var(--card-border)',
                      background: 'var(--card-bg)',
                      padding: 14,
                      minHeight: idx % 3 === 0 ? 120 : 96,
                    }}
                  >
                    <SkeletonLine width={idx % 2 ? '68%' : '54%'} height={11} />
                    <SkeletonLine width="94%" height={10} />
                    <SkeletonLine width={idx % 2 ? '75%' : '60%'} height={10} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {message && (
          <p
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              margin: 0,
              position: 'relative',
              zIndex: 2,
              textAlign: 'center',
              letterSpacing: '0.01em'
            }}
          >
            {message}
          </p>
        )}

        <style jsx>{`
          .q-skeleton {
            display: block;
            background: var(--primary-alpha);
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
          minHeight: '300px',
          background: 'var(--background)'
        }}
      >
        {showSpinner && (
          <div
            style={{
              width: '48px',
              height: '48px',
              border: '4px solid var(--card-border)',
              borderTopColor: 'var(--primary)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              boxShadow: '0 0 16px var(--primary-alpha)'
            }}
          />
        )}
        <div style={{ width: '100%', maxWidth: '420px' }}>
          <div className="q-skeleton" style={{ height: '12px', width: '48%', margin: '0 auto 10px', borderRadius: '999px' }} />
          <div className="q-skeleton" style={{ height: '11px', width: '100%', marginBottom: '8px', borderRadius: '999px' }} />
          <div className="q-skeleton" style={{ height: '11px', width: '78%', margin: '0 auto', borderRadius: '999px' }} />
        </div>
        {message && <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>{message}</p>}
        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }

          .q-skeleton {
            background: var(--primary-alpha);
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
        padding: '16px',
        background: 'var(--background)'
      }}
    >
      <div className="q-skeleton" style={{ width: '100px', height: '10px', borderRadius: '999px' }} />
      <div className="q-skeleton" style={{ width: '72px', height: '10px', borderRadius: '999px' }} />
      {showSpinner && <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Syncing...</span>}
      {message && <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{message}</span>}
      <style jsx>{`
        .q-skeleton {
          background: var(--primary-alpha);
        }
      `}</style>
    </div>
  )
}
