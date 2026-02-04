'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

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
    primaryLight: 'rgba(0, 212, 255, 0.2)',
    primaryDark: 'rgba(0, 153, 204, 1)',
    accent: '#00d4ff',
    gradient: 'linear-gradient(135deg, #00d4ff 0%, #0099cc 50%, #006699 100%)',
    glow: 'rgba(0, 212, 255, 0.5)',
    name: 'Quantum Inspired'
  },
  science: {
    primary: 'rgba(37, 150, 190, 1)',
    primaryLight: 'rgba(37, 150, 190, 0.2)',
    primaryDark: 'rgba(25, 100, 130, 1)',
    accent: '#10b981',
    gradient: 'linear-gradient(135deg, #25969e 0%, #10b981 50%, #34d399 100%)',
    glow: 'rgba(37, 150, 190, 0.5)',
    name: 'College of Science'
  },
  'arts-letters': {
    primary: 'rgba(249, 115, 22, 1)',
    primaryLight: 'rgba(249, 115, 22, 0.2)',
    primaryDark: 'rgba(194, 65, 12, 1)',
    accent: '#fbbf24',
    gradient: 'linear-gradient(135deg, #f97316 0%, #fb923c 50%, #fbbf24 100%)',
    glow: 'rgba(249, 115, 22, 0.5)',
    name: 'College of Arts and Letters'
  },
  architecture: {
    primary: 'rgba(239, 68, 68, 1)',
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

  useEffect(() => {
    setMounted(true)
    // Load saved themes from localStorage
    const savedTheme = localStorage.getItem('faculty-base-theme') as BaseTheme
    const savedCollegeTheme = localStorage.getItem('faculty-college-theme') as CollegeTheme
    
    // Check if we're on a faculty page
    const isFacultyPage = window.location.pathname.startsWith('/faculty')
    
    // Faculty pages should NEVER use green theme - default to light mode
    const defaultTheme: BaseTheme = isFacultyPage ? 'light' : 'green'

    // Valid base themes include green, light and dark
    const allowedThemes: BaseTheme[] = ['green', 'light', 'dark']

    if (savedTheme && allowedThemes.includes(savedTheme)) {
      // For faculty pages, convert green to light mode
      let themeToApply = savedTheme
      if (isFacultyPage && savedTheme === 'green') {
        themeToApply = 'light'
      }
      setThemeState(themeToApply)
      document.documentElement.setAttribute('data-theme', themeToApply)
    } else {
      // Default theme based on page
      setThemeState(defaultTheme)
      document.documentElement.setAttribute('data-theme', defaultTheme)
      localStorage.setItem('faculty-base-theme', defaultTheme)
    }

    if (savedCollegeTheme && Object.keys(COLLEGE_COLORS).includes(savedCollegeTheme)) {
      setCollegeThemeState(savedCollegeTheme)
      document.documentElement.setAttribute('data-college-theme', savedCollegeTheme)
      applyCollegeThemeCSS(savedCollegeTheme)
    } else {
      // Default to quantum-inspired theme
      setCollegeThemeState('default')
      document.documentElement.setAttribute('data-college-theme', 'default')
      applyCollegeThemeCSS('default')
      localStorage.setItem('faculty-college-theme', 'default')
    }
  }, [])

  const applyCollegeThemeCSS = (college: CollegeTheme) => {
    const colors = COLLEGE_COLORS[college]
    const root = document.documentElement
    root.style.setProperty('--college-primary', colors.primary)
    root.style.setProperty('--college-primary-light', colors.primaryLight)
    root.style.setProperty('--college-primary-dark', colors.primaryDark)
    root.style.setProperty('--college-accent', colors.accent)
    root.style.setProperty('--college-gradient', colors.gradient)
    root.style.setProperty('--college-glow', colors.glow)
  }

  const setTheme = (newTheme: BaseTheme) => {
    setThemeState(newTheme)
    localStorage.setItem('faculty-base-theme', newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  const setCollegeTheme = (college: CollegeTheme) => {
    setCollegeThemeState(college)
    localStorage.setItem('faculty-college-theme', college)
    document.documentElement.setAttribute('data-college-theme', college)
    applyCollegeThemeCSS(college)
  }

  const toggleTheme = () => {
    // Cycle through green -> dark -> light -> green
    let newTheme: BaseTheme
    if (theme === 'green') {
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
