"use client"

import { MdEdit, MdPersonAdd, MdSearch, MdClose, MdChevronLeft, MdChevronRight } from 'react-icons/md'
import { useState, useMemo, useRef, useEffect } from 'react'
import styles from './AllocationTable.module.css'

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

interface AllocationTableProps {
  allocations: RoomAllocation[]
  onReassignRoom: (allocation: RoomAllocation) => void
  onAssignFaculty?: (allocation: RoomAllocation) => void
  isLocked?: boolean
}

export default function AllocationTable({
  allocations,
  onReassignRoom,
  onAssignFaculty,
  isLocked
}: AllocationTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterDay, setFilterDay] = useState<string>('all')
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const normalizeDayName = (day: string) => {
    const normalized = String(day || '').trim().toLowerCase()
    const dayMap: Record<string, string> = {
      mon: 'Monday', monday: 'Monday',
      tue: 'Tuesday', tues: 'Tuesday', tuesday: 'Tuesday',
      wed: 'Wednesday', wednesday: 'Wednesday',
      thu: 'Thursday', thur: 'Thursday', thurs: 'Thursday', thursday: 'Thursday',
      fri: 'Friday', friday: 'Friday',
      sat: 'Saturday', saturday: 'Saturday',
      sun: 'Sunday', sunday: 'Sunday',
    }

    if (dayMap[normalized]) return dayMap[normalized]
    if (!normalized) return ''
    return normalized.charAt(0).toUpperCase() + normalized.slice(1)
  }

  const dayRank = (day: string) => {
    const idx = DAYS.indexOf(normalizeDayName(day))
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx
  }

  const normalizedAllocations = useMemo(() => {
    return allocations.map(a => ({
      ...a,
      schedule_day: normalizeDayName(a.schedule_day),
    }))
  }, [allocations])

  const activeDays = useMemo(() => {
    return [...new Set(normalizedAllocations.map(a => a.schedule_day).filter(Boolean))].sort(
      (a, b) => dayRank(a) - dayRank(b)
    )
  }, [normalizedAllocations])

  const displayAllocations = useMemo(() => {
    let filtered = [...normalizedAllocations]
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(a =>
        a.course_code.toLowerCase().includes(q) ||
        a.course_name.toLowerCase().includes(q) ||
        a.section.toLowerCase().includes(q) ||
        a.room.toLowerCase().includes(q) ||
        a.building.toLowerCase().includes(q) ||
        (a.teacher_name || '').toLowerCase().includes(q)
      )
    }
    if (filterDay !== 'all') filtered = filtered.filter(a => normalizeDayName(a.schedule_day) === filterDay)
    filtered.sort((a, b) => {
      const dayDiff = dayRank(a.schedule_day) - dayRank(b.schedule_day)
      if (dayDiff !== 0) return dayDiff
      return a.schedule_time.localeCompare(b.schedule_time)
    })
    return filtered
  }, [normalizedAllocations, searchQuery, filterDay])

  // Horizontal scroll detection
  const checkScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2)
  }

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (el) {
      el.addEventListener('scroll', checkScroll)
      window.addEventListener('resize', checkScroll)
      return () => { el.removeEventListener('scroll', checkScroll); window.removeEventListener('resize', checkScroll) }
    }
  }, [displayAllocations])

  const scrollTable = (dir: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' })
  }

  if (allocations.length === 0) {
    return <div className={styles.emptyState}><p>No allocations to display</p></div>
  }

  return (
    <div className={styles.tableContainer} id="view-allocation-panel">
      <div className={styles.tableHeader}>
        <div className={styles.tableHeaderTop}>
          <div className={styles.headerInfo}>
            <h3>Manual Re-allocation Panel</h3>
            <p className={styles.subtitle}>
              {displayAllocations.length} of {allocations.length} allocations
              {isLocked && <span className={styles.lockedBadge}> (Locked)</span>}
            </p>
          </div>
          <div className={styles.tableFilters} id="view-allocation-filters">
            <div className={styles.tableSearchBox} id="view-allocation-search">
              <MdSearch size={14} />
              <input
                type="text"
                placeholder="Search course, room, teacher..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={styles.tableSearchInput}
              />
              {searchQuery && <button className={styles.tableClearSearch} onClick={() => setSearchQuery('')}><MdClose size={14} /></button>}
            </div>
            <select className={styles.tableDaySelect} value={filterDay} onChange={e => setFilterDay(e.target.value)}>
              <option value="all">All Days</option>
              {activeDays.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Horizontal Scroll Controls */}
      <div className={styles.scrollControlsRow}>
        <button
          className={`${styles.scrollBtn} ${!canScrollLeft ? styles.scrollBtnHidden : ''}`}
          onClick={() => scrollTable('left')}
          aria-label="Scroll left"
        >
          <MdChevronLeft size={16} />
        </button>
        <span className={styles.scrollHint}>Scroll horizontally to view all columns</span>
        <button
          className={`${styles.scrollBtn} ${!canScrollRight ? styles.scrollBtnHidden : ''}`}
          onClick={() => scrollTable('right')}
          aria-label="Scroll right"
        >
          <MdChevronRight size={16} />
        </button>
      </div>

      <div className={styles.scrollWrapper} ref={scrollRef} id="view-allocation-table-wrap">
        <table className={styles.table} id="view-allocation-table">
          <thead>
            <tr>
              <th>Course</th>
              <th>Section</th>
              <th>Day</th>
              <th>Time</th>
              <th>Faculty</th>
              <th>Room</th>
              <th>Building</th>
              <th>Cap.</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayAllocations.map((alloc, index) => (
              <tr key={alloc.id} className={styles.row}>
                <td className={styles.courseCode}><span className={styles.courseLabel}>{alloc.course_code}</span></td>
                <td className={styles.section}>{alloc.section}</td>
                <td className={styles.day}>{alloc.schedule_day}</td>
                <td className={styles.time}>{alloc.schedule_time}</td>
                <td className={styles.teacher}>
                  {alloc.teacher_name ? <span className={styles.teacherName}>{alloc.teacher_name}</span> : <span className={styles.unassigned}>Unassigned</span>}
                </td>
                <td className={styles.room}><span className={styles.roomBadge}>{alloc.room}</span></td>
                <td className={styles.building}>{alloc.building}</td>
                <td className={styles.capacity}>{alloc.capacity || 'N/A'}</td>
                <td className={styles.actions}>
                  <button
                    id={index === 0 ? 'view-first-reassign-room-btn' : undefined}
                    className={`${styles.actionBtn} ${styles.actionBtnRoom} ${isLocked ? styles.disabled : ''}`}
                    onClick={() => onReassignRoom(alloc)}
                    disabled={isLocked}
                    title={isLocked ? 'Schedule is locked' : 'Reassign room'}
                  >
                    <MdEdit size={13} /> Room
                  </button>
                  {onAssignFaculty && (
                    <button
                      id={index === 0 ? 'view-first-assign-faculty-btn' : undefined}
                      className={`${styles.actionBtn} ${styles.actionBtnFaculty} ${isLocked ? styles.disabled : ''}`}
                      onClick={() => onAssignFaculty(alloc)}
                      disabled={isLocked}
                      title={isLocked ? 'Schedule is locked' : 'Assign/change faculty'}
                    >
                      <MdPersonAdd size={13} /> Faculty
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
