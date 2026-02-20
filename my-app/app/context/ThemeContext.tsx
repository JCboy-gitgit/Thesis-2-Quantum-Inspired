'use client'

import React, { createContext, useContext, useState, useEffect, useLayoutEffect, ReactNode } from 'react'
import { usePathname } from 'next/navigation'

// Base themes - includes green (nature-inspired), light, and dark modes
type BaseTheme = 'green' | 'light' | 'dark'

// College-specific color themes (accent colors)
type CollegeTheme = 'science' | 'arts-letters' | 'architecture' | 'default'

interface ThemeContextType {
  theme: BaseTheme
  collegeTheme: CollegeTheme
  setTheme: (theme: BaseTheme) => void
  setCollegeTheme: (college: CollegeTheme) => void
  toggleTheme: () => void
  getCollegeColors: () => CollegeColors
}

interface CollegeColors {
  primary: string
  primaryRgb: string
  primaryLight: string
  primaryDark: string
  accent: string
  gradient: string
  glow: string
  name: string
}

// College theme color definitions
const COLLEGE_COLORS: Record<CollegeTheme, CollegeColors> = {
  default: {
    primary: 'rgba(0, 212, 255, 1)',
    primaryRgb: '0, 212, 255',
    primaryLight: 'rgba(0, 212, 255, 0.2)',
    primaryDark: 'rgba(0, 153, 204, 1)',
    accent: '#00d4ff',
    gradient: 'linear-gradient(135deg, #00d4ff 0%, #0099cc 50%, #006699 100%)',
    glow: 'rgba(0, 212, 255, 0.5)',
    name: 'Quantum Inspired'
  },
  science: {
    primary: 'rgba(37, 150, 190, 1)',
    primaryRgb: '37, 150, 190',
    primaryLight: 'rgba(37, 150, 190, 0.2)',
    primaryDark: 'rgba(25, 100, 130, 1)',
    accent: '#10b981',
    gradient: 'linear-gradient(135deg, #25969e 0%, #10b981 50%, #34d399 100%)',
    glow: 'rgba(37, 150, 190, 0.5)',
    name: 'College of Science'
  },
  'arts-letters': {
    primary: 'rgba(249, 115, 22, 1)',
    primaryRgb: '249, 115, 22',
    primaryLight: 'rgba(249, 115, 22, 0.2)',
    primaryDark: 'rgba(194, 65, 12, 1)',
    accent: '#fbbf24',
    gradient: 'linear-gradient(135deg, #f97316 0%, #fb923c 50%, #fbbf24 100%)',
    glow: 'rgba(249, 115, 22, 0.5)',
    name: 'College of Arts and Letters'
  },
  architecture: {
    primary: 'rgba(239, 68, 68, 1)',
    primaryRgb: '239, 68, 68',
    primaryLight: 'rgba(239, 68, 68, 0.2)',
    primaryDark: 'rgba(127, 29, 29, 1)',
    accent: '#f87171',
    gradient: 'linear-gradient(135deg, #991b1b 0%, #dc2626 50%, #ef4444 100%)',
    glow: 'rgba(239, 68, 68, 0.5)',
    name: 'College of Architecture and Fine Arts'
  }
}

// Map college names to theme keys
export const COLLEGE_THEME_MAP: Record<string, CollegeTheme> = {
  'college of science': 'science',
  'science': 'science',
  'cos': 'science',
  'college of arts and letters': 'arts-letters',
  'arts and letters': 'arts-letters',
  'cal': 'arts-letters',
  'college of architecture and fine arts': 'architecture',
  'architecture': 'architecture',
  'cafa': 'architecture',
  'fine arts': 'architecture',
}

// Function to determine default theme based on path
const getDefaultThemeForPath = (): BaseTheme => {
  if (typeof window !== 'undefined') {
    const path = window.location.pathname
    // Faculty pages default to light mode
    if (path.startsWith('/faculty')) {
      return 'light'
    }
  }
  // Admin pages default to green mode
  return 'green'
}

// Function to get college theme from college name
export const getCollegeThemeFromName = (collegeName: string): CollegeTheme => {
  if (!collegeName) return 'default'
  const collegeLower = collegeName.toLowerCase().trim()
  return COLLEGE_THEME_MAP[collegeLower] || 'default'
}

// Provide a default value so hooks don't throw during initial render
// DEFAULT: green mode (nature-inspired) with quantum-inspired theme
const defaultContext: ThemeContextType = {
  theme: 'green',
  collegeTheme: 'default',
  setTheme: () => { },
  setCollegeTheme: () => { },
  toggleTheme: () => { },
  getCollegeColors: () => COLLEGE_COLORS.default,
}

const ThemeContext = createContext<ThemeContextType>(defaultContext)

export function ThemeProvider({ children }: { children: ReactNode }) {
  // DEFAULT: green mode (nature-inspired) with default color theme
  const [theme, setThemeState] = useState<BaseTheme>('green')
  const [collegeTheme, setCollegeThemeState] = useState<CollegeTheme>('default')
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

  // Separate theme storage keys for admin and faculty to prevent conflicts
  const getThemeStorageKey = (isFaculty: boolean) =>
    isFaculty ? 'faculty-base-theme' : 'admin-base-theme'

  const getCollegeThemeStorageKey = (isFaculty: boolean) =>
    isFaculty ? 'faculty-college-theme' : 'admin-college-theme'

  // Use useLayoutEffect to apply theme BEFORE paint - prevents flash
  useLayoutEffect(() => {
    const isFacultyPage = pathname?.startsWith('/faculty') ?? false
    const isLoginPage = pathname === '/' || pathname === '/login'

    // Skip theme management for login page (it has its own styles)
    if (isLoginPage) return

    const themeKey = getThemeStorageKey(isFacultyPage)
    const savedTheme = localStorage.getItem(themeKey) as BaseTheme

    // Define valid themes
    const allowedThemes: BaseTheme[] = ['green', 'light', 'dark']

    // Determine the correct theme for this context
    let themeToApply: BaseTheme

    if (savedTheme && allowedThemes.includes(savedTheme)) {
      // Use saved theme, but enforce light/dark for faculty (never green)
      if (isFacultyPage) {
        themeToApply = savedTheme === 'green' ? 'light' : savedTheme
      } else {
        themeToApply = savedTheme
      }
    } else {
      // Default: green for admin, light for faculty
      themeToApply = isFacultyPage ? 'light' : 'green'
    }

    // Apply the theme
    setThemeState(themeToApply)
    document.documentElement.setAttribute('data-theme', themeToApply)
    // Keep body in sync to prevent stale ancestor selector conflicts
    document.body.setAttribute('data-theme', themeToApply)

    // For faculty pages, also clear any admin-specific body classes
    if (isFacultyPage) {
      const adminClasses = ['admin-dashboard', 'admin-page', 'green', 'admin', 'admin-layout']
      adminClasses.forEach(cls => {
        document.body.classList.remove(cls)
        document.documentElement.classList.remove(cls)
      })
    }

  }, [pathname])

  // Initial mount: set up college theme
  useEffect(() => {
    setMounted(true)
    const isFacultyPage = pathname?.startsWith('/faculty') ?? false
    const collegeKey = getCollegeThemeStorageKey(isFacultyPage)
    const savedCollegeTheme = localStorage.getItem(collegeKey) as CollegeTheme

    if (savedCollegeTheme && Object.keys(COLLEGE_COLORS).includes(savedCollegeTheme)) {
      setCollegeThemeState(savedCollegeTheme)
      document.documentElement.setAttribute('data-college-theme', savedCollegeTheme)
      applyCollegeThemeCSS(savedCollegeTheme)
    } else {
      // Default to quantum-inspired theme
      setCollegeThemeState('default')
      document.documentElement.setAttribute('data-college-theme', 'default')
      applyCollegeThemeCSS('default')
    }
  }, [pathname])

  const applyCollegeThemeCSS = (college: CollegeTheme) => {
    const colors = COLLEGE_COLORS[college]
    const root = document.documentElement
    root.style.setProperty('--college-primary', colors.primary)
    root.style.setProperty('--college-primary-rgb', colors.primaryRgb)
    root.style.setProperty('--college-primary-light', colors.primaryLight)
    root.style.setProperty('--college-primary-dark', colors.primaryDark)
    root.style.setProperty('--college-accent', colors.accent)
    root.style.setProperty('--college-gradient', colors.gradient)
    root.style.setProperty('--college-glow', colors.glow)
  }

  const setTheme = (newTheme: BaseTheme) => {
    const isFacultyPage = typeof window !== 'undefined' && window.location.pathname.startsWith('/faculty')
    const normalizedTheme: BaseTheme = isFacultyPage && newTheme === 'green' ? 'light' : newTheme
    const storageKey = getThemeStorageKey(isFacultyPage)
    setThemeState(normalizedTheme)
    localStorage.setItem(storageKey, normalizedTheme)
    // Sync with login page preference as well
    localStorage.setItem('login-theme-preference', normalizedTheme)
    document.documentElement.setAttribute('data-theme', normalizedTheme)
    document.body.setAttribute('data-theme', normalizedTheme)
  }

  const setCollegeTheme = (college: CollegeTheme) => {
    const isFacultyPage = typeof window !== 'undefined' && window.location.pathname.startsWith('/faculty')
    const storageKey = getCollegeThemeStorageKey(isFacultyPage)
    setCollegeThemeState(college)
    localStorage.setItem(storageKey, college)
    document.documentElement.setAttribute('data-college-theme', college)
    document.body.setAttribute('data-college-theme', college)
    applyCollegeThemeCSS(college)
  }

  const toggleTheme = () => {
    const isFacultyPage = typeof window !== 'undefined' && window.location.pathname.startsWith('/faculty')
    let newTheme: BaseTheme
    if (isFacultyPage) {
      newTheme = theme === 'dark' ? 'light' : 'dark'
    } else if (theme === 'green') {
      newTheme = 'dark'
    } else if (theme === 'dark') {
      newTheme = 'light'
    } else {
      newTheme = 'green'
    }
    setTheme(newTheme)
  }

  const getCollegeColors = (): CollegeColors => {
    return COLLEGE_COLORS[collegeTheme] || COLLEGE_COLORS.default
  }

  // Always provide the context, but with default values until mounted
  const value = mounted
    ? { theme, collegeTheme, setTheme, setCollegeTheme, toggleTheme, getCollegeColors }
    : defaultContext

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
