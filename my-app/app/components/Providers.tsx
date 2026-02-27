
'use client'

import { useEffect } from 'react'
import { ThemeProvider } from '../context/ThemeContext'
import { CollegesProvider } from '../context/CollegesContext'
import { SchedulingProvider } from '../context/SchedulingContext'

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.warn('Service worker registration failed:', error)
      })
    }
  }, [])

  return (
    <ThemeProvider>
      <CollegesProvider>
        <SchedulingProvider>
          {children}
        </SchedulingProvider>
      </CollegesProvider>
    </ThemeProvider>
  )
}
