'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

// Base themes
type BaseTheme = 'light' | 'dark'

// College-specific color themes
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
  },
  default: {
    primary: 'rgba(0, 212, 255, 1)',
    primaryLight: 'rgba(0, 212, 255, 0.2)',
    primaryDark: 'rgba(0, 153, 204, 1)',
    accent: '#00d4ff',
    gradient: 'linear-gradient(135deg, #00d4ff 0%, #0099cc 50%, #006699 100%)',
    glow: 'rgba(0, 212, 255, 0.5)',
    name: 'Default Theme'
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

// Provide a default value so hooks don't throw during initial render
const defaultContext: ThemeContextType = {
  theme: 'dark',
  collegeTheme: 'default',
  setTheme: () => { },
  setCollegeTheme: () => { },
  toggleTheme: () => { },
  getCollegeColors: () => COLLEGE_COLORS.default,
}

const ThemeContext = createContext<ThemeContextType>(defaultContext)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<BaseTheme>('dark')
  const [collegeTheme, setCollegeThemeState] = useState<CollegeTheme>('default')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Load saved themes from localStorage
    const savedTheme = localStorage.getItem('app-base-theme') as BaseTheme
    const savedCollegeTheme = localStorage.getItem('app-college-theme') as CollegeTheme

    if (savedTheme && ['light', 'dark'].includes(savedTheme)) {
      setThemeState(savedTheme)
      document.documentElement.setAttribute('data-theme', savedTheme)
    } else {
      document.documentElement.setAttribute('data-theme', 'dark')
    }

    if (savedCollegeTheme && Object.keys(COLLEGE_COLORS).includes(savedCollegeTheme)) {
      setCollegeThemeState(savedCollegeTheme)
      document.documentElement.setAttribute('data-college-theme', savedCollegeTheme)
      applyCollegeThemeCSS(savedCollegeTheme)
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
    localStorage.setItem('app-base-theme', newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  const setCollegeTheme = (college: CollegeTheme) => {
    setCollegeThemeState(college)
    localStorage.setItem('app-college-theme', college)
    document.documentElement.setAttribute('data-college-theme', college)
    applyCollegeThemeCSS(college)
  }

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
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
