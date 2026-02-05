'use client'

import { useState, useEffect } from 'react'
import styles from './loading.module.css'

type Theme = 'green' | 'light' | 'dark'

export default function ViewScheduleLoading() {
  const [theme, setTheme] = useState<Theme>('green')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Read theme from localStorage immediately
    const savedTheme = localStorage.getItem('faculty-base-theme') as Theme
    if (savedTheme && ['green', 'light', 'dark'].includes(savedTheme)) {
      setTheme(savedTheme)
    }
    setMounted(true)
  }, [])

  // Prevent flash by not rendering until theme is determined
  if (!mounted) {
    return null
  }

  return (
    <div className={`${styles.loadingContainer} ${styles[theme]}`} data-theme={theme}>
      <div className={styles.loadingContent}>
        {/* Animated Schedule Icon */}
        <div className={styles.iconContainer}>
          <div className={styles.scheduleIcon}>
            <svg 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className={styles.scheduleSvg}
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <line x1="8" y1="14" x2="8" y2="14.01" />
              <line x1="12" y1="14" x2="12" y2="14.01" />
              <line x1="16" y1="14" x2="16" y2="14.01" />
              <line x1="8" y1="18" x2="8" y2="18.01" />
              <line x1="12" y1="18" x2="12" y2="18.01" />
              <line x1="16" y1="18" x2="16" y2="18.01" />
            </svg>
          </div>
          
          {/* Pulse ring effect */}
          <div className={styles.pulseRing}></div>
          <div className={styles.pulseRing} style={{ animationDelay: '0.5s' }}></div>
        </div>

        {/* Loading Text */}
        <h2 className={styles.title}>Loading Schedules</h2>
        <p className={styles.subtitle}>Preparing schedule history...</p>

        {/* Progress Bar */}
        <div className={styles.progressContainer}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill}></div>
          </div>
        </div>

        {/* Loading Steps */}
        <div className={styles.loadingSteps}>
          <div className={styles.step}>
            <div className={styles.stepDot}></div>
            <span>Verifying access</span>
          </div>
          <div className={styles.step}>
            <div className={styles.stepDot}></div>
            <span>Loading schedules</span>
          </div>
          <div className={styles.step}>
            <div className={styles.stepDot}></div>
            <span>Preparing view</span>
          </div>
        </div>
      </div>

      {/* Background Grid Pattern */}
      <div className={styles.gridBackground}></div>
    </div>
  )
}
