"use client"

import { useState, useEffect, useMemo, useCallback } from 'react'
import { MdClose as X, MdCheck as Check, MdCheckCircle as CheckCircle, MdError as AlertCircle, MdLoop as Loader2, MdReplay as RotateCcw, MdSearch as Search, MdKeyboardArrowDown as ChevronDown, MdKeyboardArrowUp as ChevronUp, MdMenuBook as BookOpen, MdAccessTime as Clock, MdPeople as Users, MdSchool as GraduationCap } from 'react-icons/md'
import styles from './FacultyAssignmentModal.module.css'
import { parseScheduleTime, timeRangesOverlap } from '@/lib/conflictChecker'

interface Faculty {
  id: string
  full_name: string
  email: string
  department?: string
  college?: string
  specialization?: string
  position?: string
  employment_type?: string
  currentLoadCount?: number
  isEligible?: boolean
  teachingLoadCount?: number
  teachingLoads?: { course_code: string; course_name: string; section: string; semester: string; academic_year: string; lec_hours: number; lab_hours: number }[]
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
  college?: string
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

const normalizeTeacherName = (name?: string) => String(name || '').trim().replace(/\s+/g, ' ').toUpperCase()

const normalizeDayLabel = (day?: string) => String(day || '').trim().toLowerCase()

const hasTimeOverlap = (left?: string, right?: string) => {
  const leftRange = parseScheduleTime(String(left || ''))
  const rightRange = parseScheduleTime(String(right || ''))
  if (leftRange && rightRange) return timeRangesOverlap(leftRange, rightRange)
  return String(left || '').trim() === String(right || '').trim()
}

const normalizeCollegeValue = (value: unknown) => String(value || '').trim().toUpperCase()

const isCollegeUnsetValue = (value: unknown) => {
  const normalized = normalizeCollegeValue(value)
  return (
    !normalized ||
    normalized === 'UNASSIGNED COLLEGE' ||
    normalized === 'UNASSIGNED' ||
    normalized === 'N/A' ||
    normalized === 'NA' ||
    normalized === 'NONE' ||
    normalized === 'NULL'
  )
}

const isSharedCollegeValue = (value: unknown) => normalizeCollegeValue(value) === 'SHARED'

const areCollegesCompatible = (classCollege: unknown, facultyCollege: unknown) => {
  const normalizedClassCollege = normalizeCollegeValue(classCollege)
  const normalizedFacultyCollege = normalizeCollegeValue(facultyCollege)

  if (!normalizedClassCollege || !normalizedFacultyCollege) return true
  if (isCollegeUnsetValue(normalizedClassCollege) || isCollegeUnsetValue(normalizedFacultyCollege)) return true
  if (isSharedCollegeValue(normalizedClassCollege) || isSharedCollegeValue(normalizedFacultyCollege)) return true

  return normalizedClassCollege === normalizedFacultyCollege
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
  const [allFaculty, setAllFaculty] = useState<Faculty[]>([])
  const [fetchingFaculty, setFetchingFaculty] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [expandedFaculty, setExpandedFaculty] = useState<string | null>(null)

  const fetchFacultyData = useCallback(async () => {
    if (!allocation) return
    setFetchingFaculty(true)
    setError(null)

    try {
      // Fetch faculty via API route (bypasses RLS)
      const courseCode = allocation.course_code?.trim() || ''
      const params = new URLSearchParams({
        ...(courseCode && { courseCode }),
        ...(allocation.class_id && { classId: String(allocation.class_id) })
      })

      const response = await fetch(`/api/faculty-list?${params}`, { cache: 'no-store' })
      const data = await response.json()

      if (!data.success) throw new Error(data.error || 'Failed to load faculty')

      const allFacultyData = data.faculty || []
      const eligibleIds: string[] = data.eligibleIds || []

      // Count current scheduled classes per faculty (by name since room_allocations has no teacher_id)
      const loadCounts = new Map<string, number>()
      allAllocations.forEach(a => {
        if (a.teacher_name) {
          const fac = allFacultyData.find((f: any) => f.full_name === a.teacher_name)
          if (fac) loadCounts.set(fac.id, (loadCounts.get(fac.id) || 0) + 1)
        }
      })

      const enriched: Faculty[] = allFacultyData.map((f: any) => ({
        id: f.id, full_name: f.full_name, email: f.email,
        department: f.department, college: f.college,
        specialization: f.specialization, position: f.position,
        employment_type: f.employment_type,
        currentLoadCount: loadCounts.get(f.id) || 0,
        isEligible: eligibleIds.includes(f.id),
        teachingLoadCount: f.teachingLoadCount || 0,
        teachingLoads: f.teachingLoads || []
      }))

      const eligible = enriched.filter(f => f.isEligible)
      setEligibleFaculty(eligible)
      setAllFaculty(enriched)

      if (eligible.length === 0) {
        setError(`No faculty assigned to teach ${courseCode || allocation.course_code}. Toggle "Show all faculty" to see everyone.`)
      }
    } catch (err: any) {
      console.error('[FacultyModal] Error:', err)
      setError(err.message || 'Failed to load faculty')
    } finally {
      setFetchingFaculty(false)
    }
  }, [allocation, allAllocations])

  useEffect(() => {
    if (isOpen && allocation) fetchFacultyData()
  }, [isOpen, allocation, fetchFacultyData])

  useEffect(() => {
    if (allocation) {
      setSelectedFaculty(null)
      setError(null)
      setHasConflict(false)
      setConflictDetails('')
      setSearchQuery('')
      setExpandedFaculty(null)
    }
  }, [allocation, isOpen])

  useEffect(() => {
    if (!selectedFaculty || !allocation) { setHasConflict(false); setConflictDetails(''); return }
    const selectedTeacher = normalizeTeacherName(selectedFaculty.full_name)
    const targetDay = normalizeDayLabel(allocation.schedule_day)

    const conflict = allAllocations.find(a => {
      if (a.id === allocation.id) return false
      if (normalizeTeacherName(a.teacher_name) !== selectedTeacher) return false
      if (normalizeDayLabel(a.schedule_day) !== targetDay) return false
      return hasTimeOverlap(a.schedule_time, allocation.schedule_time)
    })

    if (conflict) {
      setHasConflict(true)
      setConflictDetails(`${selectedFaculty.full_name} is already teaching ${conflict.course_code} (${conflict.section}) at ${allocation.schedule_time} on ${allocation.schedule_day}`)
    } else { setHasConflict(false); setConflictDetails('') }
  }, [selectedFaculty, allocation, allAllocations])

  const displayFaculty = useMemo(() => {
    let list = [...allFaculty]
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(f => f.full_name.toLowerCase().includes(q) || (f.email || '').toLowerCase().includes(q) || (f.department || '').toLowerCase().includes(q) || (f.specialization || '').toLowerCase().includes(q))
    }
    // Sort: eligible first, then alphabetical
    list.sort((a, b) => {
      if (a.isEligible && !b.isEligible) return -1
      if (!a.isEligible && b.isEligible) return 1
      return a.full_name.localeCompare(b.full_name)
    })
    return list
  }, [allFaculty, searchQuery])

  const collegeMismatchWarning = useMemo(() => {
    if (!selectedFaculty || !allocation) return null

    if (!areCollegesCompatible(allocation.college, selectedFaculty.college)) {
      return `Warning: This faculty belongs to ${selectedFaculty.college}, but the class is from ${allocation.college}.`
    }

    return null
  }, [selectedFaculty, allocation])

  const getFacultyDaySchedule = (facultyName: string) => {
    if (!allocation) return []
    return allAllocations.filter(a =>
      (a.teacher_name === facultyName) && a.schedule_day === allocation.schedule_day
    ).sort((a, b) => a.schedule_time.localeCompare(b.schedule_time))
  }

  const handleConfirm = async () => {
    if (!selectedFaculty || !allocation) return
    setLoading(true); setError(null)
    try { await onConfirm(selectedFaculty.id, selectedFaculty.full_name); onClose() }
    catch (err: any) { setError(err.message || 'Failed to assign faculty') }
    finally { setLoading(false) }
  }

  if (!isOpen || !allocation) return null

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div id="view-faculty-assign-modal" className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.headerLeft}>
            <h2>Assign Faculty</h2>
            <span className={styles.headerSubtitle}>
              {allocation.course_code} &bull; {allocation.section} &bull; {allocation.schedule_day} {allocation.schedule_time}
            </span>
          </div>
          <button id="view-faculty-assign-close-btn" className={styles.closeButton} onClick={onClose} disabled={loading}><X size={20} /></button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.allocationDetails}>
            <h3>Class Details</h3>
            <div className={styles.detailsGrid}>
              <div className={styles.detailItem}><span className={styles.label}>Course</span><span className={styles.value}>{allocation.course_code} — {allocation.course_name}</span></div>
              <div className={styles.detailItem}><span className={styles.label}>Section</span><span className={styles.value}>{allocation.section}</span></div>
              <div className={styles.detailItem}><span className={styles.label}>Schedule</span><span className={styles.value}>{allocation.schedule_day} {allocation.schedule_time}</span></div>
              <div className={styles.detailItem}><span className={styles.label}>Room</span><span className={styles.value}>{allocation.room} ({allocation.building})</span></div>
              {allocation.teacher_name && <div className={styles.detailItem}><span className={styles.label}>Current Faculty</span><span className={styles.currentFacultyValue}>{allocation.teacher_name}</span></div>}
            </div>
          </div>

          <div className={styles.facultySelection} id="view-faculty-assign-list">
            <div className={styles.selectionHeader}>
              <h3>Select Faculty</h3>
              <div className={styles.eligibleBadge}><GraduationCap size={14} /> {eligibleFaculty.length} assigned to {allocation.course_code}</div>
            </div>

            <div className={styles.filterBar}>
              <div className={styles.searchBox}>
                <Search size={16} />
                <input type="text" placeholder="Search faculty..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className={styles.searchInput} />
                {searchQuery && <button className={styles.clearSearch} onClick={() => setSearchQuery('')}><X size={14} /></button>}
              </div>
            </div>

            <div className={styles.facultyCount}>
              Showing {displayFaculty.length} of {allFaculty.length} faculty
              {eligibleFaculty.length > 0 && ` • ${eligibleFaculty.length} assigned to ${allocation.course_code}`}
            </div>

            <div className={styles.facultyList}>
              {fetchingFaculty ? (
                <div className={styles.loadingState}><RotateCcw size={28} className={styles.spinner} /><p>Loading faculty data...</p></div>
              ) : displayFaculty.length === 0 ? (
                <div className={styles.noFaculty}>
                  <Users size={20} /><p>No faculty found matching your search.</p><small>Try a different search term.</small>
                </div>
              ) : (
                displayFaculty.map(faculty => {
                  const isEligible = faculty.isEligible || eligibleFaculty.some(ef => ef.id === faculty.id)
                  const isExpanded = expandedFaculty === faculty.id
                  const daySchedule = isExpanded ? getFacultyDaySchedule(faculty.full_name) : []
                  const hasCollegeMismatch = !areCollegesCompatible(allocation.college, faculty.college)
                  const facultyConflict = allAllocations.find(a => {
                    if (a.id === allocation.id) return false
                    if (normalizeTeacherName(a.teacher_name) !== normalizeTeacherName(faculty.full_name)) return false
                    if (normalizeDayLabel(a.schedule_day) !== normalizeDayLabel(allocation.schedule_day)) return false
                    return hasTimeOverlap(a.schedule_time, allocation.schedule_time)
                  })

                  return (
                    <div key={faculty.id} className={styles.facultyItemWrapper}>
                      <div
                        className={`${styles.facultyOption} ${selectedFaculty?.id === faculty.id ? styles.selected : ''} ${facultyConflict ? styles.hasConflict : ''} ${hasCollegeMismatch ? styles.collegeMismatch : ''}`}
                        onClick={() => {
                          if (!facultyConflict && !hasCollegeMismatch) {
                            setSelectedFaculty(faculty)
                          }
                        }}
                      >
                        <div className={styles.facultyInfo}>
                          <div className={styles.facultyNameRow}>
                            <span className={styles.facultyName}>{faculty.full_name}</span>
                            {isEligible && <span className={styles.eligibleTag}><BookOpen size={11} /> Teaches this course</span>}
                            {!isEligible && <span className={styles.nonEligibleTag}>Not assigned</span>}
                            {facultyConflict && <span className={styles.conflictBadge}><AlertCircle size={11} /> Conflict</span>}
                            {hasCollegeMismatch && <span className={styles.collegeMismatchTag}><AlertCircle size={11} /> College Mismatch</span>}
                          </div>
                          <div className={styles.facultyMeta}>
                            {faculty.department || faculty.college || 'No department'}{faculty.college && faculty.department ? ` • ${faculty.college}` : ''}{faculty.specialization && ` • ${faculty.specialization}`}
                          </div>
                          <div className={styles.loadInfo}>
                            <span className={styles.loadBadge}><Clock size={11} /> {faculty.currentLoadCount || 0} classes scheduled</span>
                            {(faculty.teachingLoadCount || 0) > 0 && <span className={styles.loadBadge}><BookOpen size={11} /> {faculty.teachingLoadCount} teaching loads assigned</span>}
                          </div>
                          {facultyConflict && <div className={styles.conflictInfo}>Already teaching {facultyConflict.course_code} ({facultyConflict.section}) at this time</div>}
                          {hasCollegeMismatch && <div className={styles.collegeMismatchInfo}>Class college: {allocation.college || 'Unassigned'} • Faculty college: {faculty.college || 'Unassigned'}</div>}
                        </div>
                        <div className={styles.facultyActions}>
                          {selectedFaculty?.id === faculty.id && !facultyConflict && !hasCollegeMismatch && <CheckCircle size={20} className={styles.selectedIcon} />}
                          <button className={styles.expandBtn} onClick={e => { e.stopPropagation(); setExpandedFaculty(isExpanded ? null : faculty.id) }} title={`${allocation.schedule_day} schedule`}>
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className={styles.expandedSchedule}>
                          <div className={styles.scheduleTitle}><Clock size={14} /> {allocation.schedule_day} Schedule</div>
                          {daySchedule.length === 0 ? (
                            <div className={styles.noSchedule}>No other classes on {allocation.schedule_day}</div>
                          ) : (
                            <div className={styles.scheduleItems}>
                              {daySchedule.map((s, i) => (
                                <div key={i} className={styles.scheduleItem}>
                                  <span className={styles.scheduleTime}>{s.schedule_time}</span>
                                  <span className={styles.scheduleCourse}>{s.course_code}</span>
                                  <span className={styles.scheduleSection}>{s.section}</span>
                                  <span className={styles.scheduleRoom}>{s.room}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {hasConflict && (
            <div className={styles.conflictWarning}>
              <AlertCircle size={20} />
              <div><p className={styles.conflictTitle}>Schedule Conflict</p><p className={styles.conflictMessage}>{conflictDetails}</p></div>
            </div>
          )}
          {collegeMismatchWarning && (
            <div className={styles.warningMessage}>
              <AlertCircle size={20} />
              <div><p className={styles.conflictTitle}>College Mismatch</p><p className={styles.conflictMessage}>{collegeMismatchWarning}</p></div>
            </div>
          )}
          {error && eligibleFaculty.length === 0 && (
            <div className={styles.infoMessage}><AlertCircle size={18} /><p>{error}</p></div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelButton} onClick={onClose} disabled={loading}>Cancel</button>
          <button id="view-faculty-assign-confirm-btn" className={`${styles.confirmButton} ${hasConflict || !!collegeMismatchWarning ? styles.disabled : ''}`} onClick={handleConfirm} disabled={loading || !selectedFaculty || hasConflict || !!collegeMismatchWarning}>
            {loading ? <><RotateCcw size={16} className={styles.spinner} /> Assigning...</> : <><CheckCircle size={16} /> Assign Faculty</>}
          </button>
        </div>
      </div>
    </div>
  )
}
