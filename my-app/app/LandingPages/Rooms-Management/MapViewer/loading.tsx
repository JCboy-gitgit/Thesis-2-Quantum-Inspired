'use client'

import { useState, useEffect } from 'react'
import styles from './loading.module.css'

type Theme = 'green' | 'light' | 'dark'

export default function MapViewerLoading() {
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
        {/* Animated Map Icon */}
        <div className={styles.iconContainer}>
          <div className={styles.mapIcon}>
            <svg 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className={styles.mapSvg}
            >
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" />
              <line x1="16" y1="6" x2="16" y2="22" />
            </svg>
          </div>
          
          {/* Scanning line effect */}
          <div className={styles.scanLine}></div>
        </div>

        {/* Loading Text */}
        <h2 className={styles.title}>Loading Map Viewer</h2>
        <p className={styles.subtitle}>Preparing floor plan editor...</p>

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
            <span>Initializing canvas</span>
          </div>
          <div className={styles.step}>
            <div className={styles.stepDot}></div>
            <span>Loading buildings</span>
          </div>
          <div className={styles.step}>
            <div className={styles.stepDot}></div>
            <span>Fetching floor plans</span>
          </div>
        </div>
      </div>

      {/* Background Grid Pattern */}
      <div className={styles.gridBackground}></div>
    </div>
  )
}
