'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'

// College interface matching the database schema
export interface BulSUCollege {
  id: number
  code: string
  name: string
  short_name?: string
  color?: string
  is_active: boolean
  display_order: number
  created_at?: string
  updated_at?: string
}

interface CollegesContextType {
  colleges: BulSUCollege[]
  activeColleges: BulSUCollege[]
  loading: boolean
  error: string | null
  isDefault: boolean
  refreshColleges: () => Promise<void>
  addCollege: (college: Omit<BulSUCollege, 'id' | 'created_at' | 'updated_at'>) => Promise<BulSUCollege | null>
  updateCollege: (college: Partial<BulSUCollege> & { id: number }) => Promise<BulSUCollege | null>
  deleteCollege: (id: number) => Promise<boolean>
  getCollegeByCode: (code: string) => BulSUCollege | undefined
  getCollegeByName: (name: string) => BulSUCollege | undefined
  getCollegeOptions: (includeAll?: boolean) => { value: string; label: string; code: string }[]
}

// Default colleges for immediate use (before API loads)
const DEFAULT_COLLEGES: BulSUCollege[] = [
  { id: 1, code: 'CAFA', name: 'College of Architecture and Fine Arts', short_name: 'Architecture & Fine Arts', display_order: 1, is_active: true },
  { id: 2, code: 'CAL', name: 'College of Arts and Letters', short_name: 'Arts & Letters', display_order: 2, is_active: true },
  { id: 3, code: 'CBEA', name: 'College of Business Education and Accountancy', short_name: 'Business Education', display_order: 3, is_active: true },
  { id: 4, code: 'CCJE', name: 'College of Criminal Justice Education', short_name: 'Criminal Justice', display_order: 4, is_active: true },
  { id: 5, code: 'CHTM', name: 'College of Hospitality and Tourism Management', short_name: 'Hospitality & Tourism', display_order: 5, is_active: true },
  { id: 6, code: 'CICT', name: 'College of Information and Communications Technology', short_name: 'Info & Comm Tech', display_order: 6, is_active: true },
  { id: 7, code: 'CIT', name: 'College of Industrial Technology', short_name: 'Industrial Technology', display_order: 7, is_active: true },
  { id: 8, code: 'CLaw', name: 'College of Law', short_name: 'Law', display_order: 8, is_active: true },
  { id: 9, code: 'CN', name: 'College of Nursing', short_name: 'Nursing', display_order: 9, is_active: true },
  { id: 10, code: 'COE', name: 'College of Engineering', short_name: 'Engineering', display_order: 10, is_active: true },
  { id: 11, code: 'COED', name: 'College of Education', short_name: 'Education', display_order: 11, is_active: true },
  { id: 12, code: 'CS', name: 'College of Science', short_name: 'Science', display_order: 12, is_active: true },
  { id: 13, code: 'CSER', name: 'College of Sports, Exercise and Recreation', short_name: 'Sports & Recreation', display_order: 13, is_active: true },
  { id: 14, code: 'CSSP', name: 'College of Social Sciences and Philosophy', short_name: 'Social Sciences', display_order: 14, is_active: true },
  { id: 15, code: 'GS', name: 'Graduate School', short_name: 'Graduate School', display_order: 15, is_active: true }
]

const CollegesContext = createContext<CollegesContextType | undefined>(undefined)

export function CollegesProvider({ children }: { children: ReactNode }) {
  const [colleges, setColleges] = useState<BulSUCollege[]>(DEFAULT_COLLEGES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDefault, setIsDefault] = useState(true)

  // Fetch colleges from API
  const refreshColleges = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/colleges?active=false')
      const data = await response.json()
      
      if (data.colleges && data.colleges.length > 0) {
        setColleges(data.colleges)
        setIsDefault(data.isDefault || false)
      } else {
        // Keep defaults if no data
        setColleges(DEFAULT_COLLEGES)
        setIsDefault(true)
      }
    } catch (err: any) {
      console.error('Error fetching colleges:', err)
      setError(err.message)
      // Keep defaults on error
      setColleges(DEFAULT_COLLEGES)
      setIsDefault(true)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    refreshColleges()
  }, [refreshColleges])

  // Get only active colleges
  const activeColleges = colleges.filter(c => c.is_active)

  // Add a new college
  const addCollege = async (collegeData: Omit<BulSUCollege, 'id' | 'created_at' | 'updated_at'>): Promise<BulSUCollege | null> => {
    try {
      const response = await fetch('/api/colleges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collegeData)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add college')
      }
      
      const data = await response.json()
      await refreshColleges()
      return data.college
    } catch (err: any) {
      console.error('Error adding college:', err)
      setError(err.message)
      return null
    }
  }

  // Update a college
  const updateCollege = async (collegeData: Partial<BulSUCollege> & { id: number }): Promise<BulSUCollege | null> => {
    try {
      const response = await fetch('/api/colleges', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collegeData)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update college')
      }
      
      const data = await response.json()
      await refreshColleges()
      return data.college
    } catch (err: any) {
      console.error('Error updating college:', err)
      setError(err.message)
      return null
    }
  }

  // Delete a college
  const deleteCollege = async (id: number): Promise<boolean> => {
    try {
      const response = await fetch(`/api/colleges?id=${id}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete college')
      }
      
      await refreshColleges()
      return true
    } catch (err: any) {
      console.error('Error deleting college:', err)
      setError(err.message)
      return false
    }
  }

  // Get college by code
  const getCollegeByCode = (code: string): BulSUCollege | undefined => {
    return colleges.find(c => c.code.toLowerCase() === code.toLowerCase())
  }

  // Get college by name (partial match)
  const getCollegeByName = (name: string): BulSUCollege | undefined => {
    const lowerName = name.toLowerCase()
    return colleges.find(c => 
      c.name.toLowerCase() === lowerName ||
      c.name.toLowerCase().includes(lowerName) ||
      lowerName.includes(c.name.toLowerCase())
    )
  }

  // Get college options for select dropdowns
  const getCollegeOptions = (includeAll: boolean = false): { value: string; label: string; code: string }[] => {
    const options = activeColleges.map(c => ({
      value: c.code,
      label: `${c.name} (${c.code})`,
      code: c.code
    }))
    
    if (includeAll) {
      return [{ value: 'all', label: 'All Colleges', code: 'all' }, ...options]
    }
    
    return options
  }

  return (
    <CollegesContext.Provider value={{
      colleges,
      activeColleges,
      loading,
      error,
      isDefault,
      refreshColleges,
      addCollege,
      updateCollege,
      deleteCollege,
      getCollegeByCode,
      getCollegeByName,
      getCollegeOptions
    }}>
      {children}
    </CollegesContext.Provider>
  )
}

// Custom hook to use colleges context
export function useColleges() {
  const context = useContext(CollegesContext)
  if (context === undefined) {
    throw new Error('useColleges must be used within a CollegesProvider')
  }
  return context
}

// Export default colleges for static use
export { DEFAULT_COLLEGES }
