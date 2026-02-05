'use client'

import { useState, useEffect } from 'react'
import styles from './loading.module.css'

type Theme = 'green' | 'light' | 'dark'

export default function GenerateScheduleLoading() {
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
        {/* Animated Quantum Icon */}
        <div className={styles.iconContainer}>
          <div className={styles.quantumIcon}>
            {/* Atom/Quantum representation */}
            <div className={styles.nucleus}></div>
            <div className={styles.orbit1}><div className={styles.electron}></div></div>
            <div className={styles.orbit2}><div className={styles.electron}></div></div>
            <div className={styles.orbit3}><div className={styles.electron}></div></div>
          </div>
        </div>

        {/* Loading Text */}
        <h2 className={styles.title}>Loading Schedule Generator</h2>
        <p className={styles.subtitle}>Initializing Quantum-Inspired Algorithm...</p>

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
            <span>Loading rooms data</span>
          </div>
          <div className={styles.step}>
            <div className={styles.stepDot}></div>
            <span>Fetching course schedules</span>
          </div>
          <div className={styles.step}>
            <div className={styles.stepDot}></div>
            <span>Preparing optimization engine</span>
          </div>
        </div>
      </div>

      {/* Background Grid Pattern */}
      <div className={styles.gridBackground}></div>
      
      {/* Floating particles effect */}
      <div className={styles.particles}>
        <div className={styles.particle}></div>
        <div className={styles.particle}></div>
        <div className={styles.particle}></div>
        <div className={styles.particle}></div>
        <div className={styles.particle}></div>
      </div>
    </div>
  )
}
