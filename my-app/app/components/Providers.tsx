'use client'

import { ThemeProvider } from '../context/ThemeContext'
import { CollegesProvider } from '../context/CollegesContext'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <CollegesProvider>
        {children}
      </CollegesProvider>
    </ThemeProvider>
  )
}
