"use client"

import { Edit3, Info, UserPlus } from 'lucide-react'
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
  if (allocations.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No allocations to display</p>
      </div>
    )
  }

  // Sort allocations by day and time
  const sortedAllocations = [...allocations].sort((a, b) => {
    const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    const dayDiff = daysOrder.indexOf(a.schedule_day) - daysOrder.indexOf(b.schedule_day)
    if (dayDiff !== 0) return dayDiff
    return a.schedule_time.localeCompare(b.schedule_time)
  })

  return (
    <div className={styles.tableContainer}>
      <div className={styles.tableHeader}>
        <h3>Re-allocation Details</h3>
        <p className={styles.subtitle}>{allocations.length} total allocations</p>
      </div>

      <div className={styles.scrollWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Course</th>
              <th>Section</th>
              <th>Day</th>
              <th>Time</th>
              <th>Room</th>
              <th>Building</th>
              <th>Capacity</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedAllocations.map((alloc) => (
              <tr key={alloc.id} className={styles.row}>
                <td className={styles.courseCode}>
                  <span className={styles.courseLabel}>{alloc.course_code}</span>
                </td>
                <td className={styles.section}>
                  {alloc.section}
                </td>
                <td className={styles.day}>
                  {alloc.schedule_day}
                </td>
                <td className={styles.time}>
                  {alloc.schedule_time}
                </td>
                <td className={styles.room}>
                  <span className={styles.roomBadge}>{alloc.room}</span>
                </td>
                <td className={styles.building}>
                  {alloc.building}
                </td>
                <td className={styles.capacity}>
                  {alloc.capacity || 'N/A'}
                </td>
                <td className={styles.actions}>
                  <button
                    className={`${styles.actionBtn} ${isLocked ? styles.disabled : ''}`}
                    onClick={() => onReassignRoom(alloc)}
                    disabled={isLocked}
                    title={isLocked ? 'Schedule is locked' : 'Reassign room'}
                  >
                    <Edit3 size={16} />
                    Room
                  </button>
                  {onAssignFaculty && (
                    <button
                      className={`${styles.actionBtn} ${isLocked ? styles.disabled : ''}`}
                      onClick={() => onAssignFaculty(alloc)}
                      disabled={isLocked}
                      title={isLocked ? 'Schedule is locked' : 'Assign faculty'}
                    >
                      <UserPlus size={16} />
                      Faculty
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
