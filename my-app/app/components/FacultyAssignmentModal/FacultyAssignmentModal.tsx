"use client"

import { useState, useEffect } from 'react'
import { X, Check, AlertCircle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import styles from './FacultyAssignmentModal.module.css'

const db = createClient()

interface Faculty {
  id: string
  full_name: string
  email: string
  department?: string
  specialization?: string
  teaching_load_id?: number
  assigned_units?: number
}

interface RoomAllocation {
  id: number
  schedule_id: number
  class_id?: number
  room_id?: number
  course_code: string
  course_name: string
  section: string
  year_level?: number
  schedule_day: string
  schedule_time: string
  campus: string
  building: string
  room: string
  capacity: number
  teacher_name?: string
  teacher_id?: string
  department?: string
  lec_hours?: number
  lab_hours?: number
}

interface FacultyAssignmentModalProps {
  isOpen: boolean
  allocation: RoomAllocation | null
  availableFaculty: Faculty[]
  onConfirm: (facultyId: string, facultyName: string) => Promise<void>
  onClose: () => void
  allAllocations: RoomAllocation[]
  eligibleFacultyIds?: Set<string>
}

export default function FacultyAssignmentModal({
  isOpen,
  allocation,
  availableFaculty,
  onConfirm,
  onClose,
  allAllocations,
  eligibleFacultyIds = new Set()
}: FacultyAssignmentModalProps) {
  const [selectedFaculty, setSelectedFaculty] = useState<Faculty | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasConflict, setHasConflict] = useState(false)
  const [conflictDetails, setConflictDetails] = useState<string>('')
  const [eligibleFaculty, setEligibleFaculty] = useState<Faculty[]>([])
  const [fetchingFaculty, setFetchingFaculty] = useState(false)

  // Fetch eligible faculty from teaching_loads when modal opens
  useEffect(() => {
    const fetchEligibleFaculty = async () => {
      if (!isOpen || !allocation) {
        setEligibleFaculty([])
        return
      }

      setFetchingFaculty(true)
      setError(null)

      console.log('🔍 Fetching faculty for course:', allocation.course_code)

      try {
        // APPROACH 1: Try finding via class_schedules course_code match
        console.log('📌 Approach 1: Searching class_schedules for course_code')
        const { data: courses, error: courseError } = await db
          .from('class_schedules')
          .select('id, course_code')
          .eq('course_code', allocation.course_code)

        if (courseError) {
          console.error('❌ Error finding courses:', courseError)
        }

        console.log('📚 Courses found via class_schedules:', courses?.length || 0, courses)

        let allTeachingLoads: any[] = []

        if (courses && courses.length > 0) {
          const courseIds = courses.map(c => c.id)
          
          const { data: teachingLoads, error: loadError } = await db
            .from('teaching_loads')
            .select('id, faculty_id, course_id')
            .in('course_id', courseIds)

          if (!loadError && teachingLoads) {
            console.log('📋 Teaching loads found (via course_id):', teachingLoads.length)
            allTeachingLoads = teachingLoads
          }
        }

        // APPROACH 2: If no results, try searching by course code directly in teaching_loads
        // (in case there's a course_code column or relationship we're missing)
        if (allTeachingLoads.length === 0) {
          console.log('📌 Approach 2: Searching teaching_loads directly')
          const { data: directLoads, error: directError } = await db
            .from('teaching_loads')
            .select('*')

          if (!directError && directLoads) {
            console.log('🔎 All teaching loads:', directLoads)
            // Filter client-side for debugging
            const filtered = directLoads.filter((load: any) => {
              console.log(`Teaching load ${load.id}: course_id=${load.course_id}, data=${JSON.stringify(load)}`)
              return true
            })
          }
        }

        if (allTeachingLoads.length === 0) {
          console.log('⚠️ No faculty assigned to teach', allocation.course_code)
          setEligibleFaculty([])
          setError('No faculty assigned to teach ' + allocation.course_code + '. Please assign faculty in Teaching Load Assignment first.')
          setFetchingFaculty(false)
          return
        }

        // Step 3: Get unique faculty IDs
        const facultyIds = [...new Set(allTeachingLoads.map((load: any) => load.faculty_id))]
        console.log('👥 Unique faculty IDs:', facultyIds.length, facultyIds)

        // Step 4: Fetch faculty profile details
        const { data: facultyData, error: facultyError } = await db
          .from('faculty_profiles')
          .select('id, full_name, email, department, specialization')
          .in('id', facultyIds)

        if (facultyError) {
          console.error('❌ Error fetching faculty profiles:', facultyError)
          setError('Failed to fetch faculty details: ' + facultyError.message)
          setFetchingFaculty(false)
          return
        }

        console.log('📋 Faculty profiles retrieved:', facultyData?.length || 0, facultyData)

        if (!facultyData || facultyData.length === 0) {
          console.log('⚠️ No faculty profiles found for IDs:', facultyIds)
          setEligibleFaculty([])
          setFetchingFaculty(false)
          return
        }

        // Map to Faculty interface
        const facultyList: Faculty[] = facultyData.map((faculty: any) => ({
          id: faculty.id,
          full_name: faculty.full_name,
          email: faculty.email,
          department: faculty.department,
          specialization: faculty.specialization
        }))

        console.log('✅ Eligible faculty:', facultyList.length, facultyList)
        setEligibleFaculty(facultyList)

      } catch (err: any) {
        console.error('❌ Exception fetching faculty:', err)
        setError(err.message || 'Failed to fetch eligible faculty')
      } finally {
        setFetchingFaculty(false)
      }
    }

    fetchEligibleFaculty()
  }, [isOpen, allocation])

  useEffect(() => {
    if (allocation) {
      setSelectedFaculty(null)
      setError(null)
      setHasConflict(false)
      setConflictDetails('')
    }
  }, [allocation, isOpen])

  // Check for conflicts when faculty selection changes
  useEffect(() => {
    if (!selectedFaculty || !allocation) {
      setHasConflict(false)
      setConflictDetails('')
      return
    }

    // Check if faculty is already assigned to another class at the same time
    const conflict = allAllocations.find(
      alloc =>
        alloc.teacher_id === selectedFaculty.id &&
        alloc.schedule_day === allocation.schedule_day &&
        alloc.schedule_time === allocation.schedule_time
    )

    if (conflict) {
      setHasConflict(true)
      setConflictDetails(
        `${selectedFaculty.full_name} is already assigned to ${conflict.course_code} (${conflict.section}) at ${allocation.schedule_time} on ${allocation.schedule_day}`
      )
    } else {
      setHasConflict(false)
      setConflictDetails('')
    }
  }, [selectedFaculty, allocation, allAllocations])

  const handleConfirm = async () => {
    if (!selectedFaculty || !allocation) return

    setLoading(true)
    setError(null)

    try {
      await onConfirm(selectedFaculty.id, selectedFaculty.full_name)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to assign faculty')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !allocation) return null

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Assign Faculty</h2>
          <button className={styles.closeButton} onClick={onClose} disabled={loading}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* Current Allocation Details */}
          <div className={styles.allocationDetails}>
            <h3>Class Details</h3>
            <div className={styles.detailsGrid}>
              <div className={styles.detailItem}>
                <span className={styles.label}>Course</span>
                <span className={styles.value}>{allocation.course_code}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.label}>Course Name</span>
                <span className={styles.value}>{allocation.course_name}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.label}>Section</span>
                <span className={styles.value}>{allocation.section}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.label}>Day</span>
                <span className={styles.value}>{allocation.schedule_day}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.label}>Time</span>
                <span className={styles.value}>{allocation.schedule_time}</span>
              </div>
              {allocation.teacher_name && (
                <div className={styles.detailItem}>
                  <span className={styles.label}>Current Faculty</span>
                  <span className={styles.value}>{allocation.teacher_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Faculty Selection */}
          <div className={styles.facultySelection}>
            <h3>Select Faculty</h3>
            <div className={styles.facultyList}>
              {fetchingFaculty ? (
                <div className={styles.loadingState}>
                  <Loader2 size={24} className={styles.spinner} />
                  <p>Loading eligible faculty...</p>
                </div>
              ) : eligibleFaculty.length === 0 ? (
                <div className={styles.noFaculty}>
                  No faculty assigned to teach {allocation.course_code} in Teaching Load system.
                  <br />
                  <small style={{ marginTop: '8px', display: 'block', opacity: 0.8 }}>
                    Please assign faculty to this course in Teaching Load Assignment first.
                  </small>
                </div>
              ) : (
                eligibleFaculty.map(faculty => {
                  // Check if this faculty has a conflict
                  const facultyConflict = allAllocations.find(
                    alloc =>
                      alloc.teacher_id === faculty.id &&
                      alloc.schedule_day === allocation.schedule_day &&
                      alloc.schedule_time === allocation.schedule_time &&
                      alloc.id !== allocation.id
                  )

                  return (
                    <div
                      key={faculty.id}
                      className={`${styles.facultyOption} ${selectedFaculty?.id === faculty.id ? styles.selected : ''} ${facultyConflict ? styles.hasConflict : ''}`}
                      onClick={() => !facultyConflict && setSelectedFaculty(faculty)}
                      style={{ cursor: facultyConflict ? 'not-allowed' : 'pointer' }}
                    >
                      <div className={styles.facultyInfo}>
                        <div className={styles.facultyName}>
                          {faculty.full_name}
                          {facultyConflict && (
                            <span className={styles.conflictBadge}>
                              <AlertCircle size={14} />
                              Conflict
                            </span>
                          )}
                        </div>
                        <div className={styles.facultyMeta}>
                          {faculty.email}
                          {faculty.department && <span> • {faculty.department}</span>}
                        </div>
                        {faculty.specialization && (
                          <div className={styles.specialization}>{faculty.specialization}</div>
                        )}
                        {facultyConflict && (
                          <div className={styles.conflictInfo}>
                            Already teaching {facultyConflict.course_code} ({facultyConflict.section})
                          </div>
                        )}
                      </div>
                      {selectedFaculty?.id === faculty.id && !facultyConflict && (
                        <Check size={20} className={styles.selectedIcon} />
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Conflict Warning */}
          {hasConflict && (
            <div className={styles.conflictWarning}>
              <AlertCircle size={20} />
              <div>
                <p className={styles.conflictTitle}>Schedule Conflict</p>
                <p className={styles.conflictMessage}>{conflictDetails}</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className={styles.errorMessage}>
              <AlertCircle size={20} />
              <p>{error}</p>
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button
            className={styles.cancelButton}
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className={`${styles.confirmButton} ${hasConflict ? styles.disabled : ''}`}
            onClick={handleConfirm}
            disabled={loading || !selectedFaculty || hasConflict}
          >
            {loading ? (
              <>
                <Loader2 size={16} className={styles.spinner} />
                Assigning...
              </>
            ) : (
              <>
                <Check size={16} />
                Assign Faculty
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
