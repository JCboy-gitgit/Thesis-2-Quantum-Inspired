"use client"

import { useState, useEffect } from 'react'
import { X, Check, AlertCircle, Loader2, AlertTriangle } from 'lucide-react'
import styles from './RoomReassignmentModal.module.css'

interface Room {
  id: number
  room: string
  building: string
  campus: string
  capacity: number
}

interface RoomEquipment {
  feature_id: number
  tag_name: string
  tag_category: string
  quantity: number
  description: string
  icon: string
}

interface CourseRequirement {
  feature_id: number
  tag_name: string
  tag_category: string
  is_mandatory: boolean
  min_quantity: number
  description: string
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
  department?: string
  lec_hours?: number
  lab_hours?: number
}

interface RoomReassignmentModalProps {
  isOpen: boolean
  allocation: RoomAllocation | null
  availableRooms: Room[]
  onConfirm: (newRoomId: number, newRoom: string, newBuilding: string) => Promise<void>
  onClose: () => void
  allAllocations: RoomAllocation[]
  courseRequirements?: CourseRequirement[]
  roomEquipment?: Map<number, RoomEquipment[]>
}

export default function RoomReassignmentModal({
  isOpen,
  allocation,
  availableRooms,
  onConfirm,
  onClose,
  allAllocations,
  courseRequirements = [],
  roomEquipment = new Map()
}: RoomReassignmentModalProps) {
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasConflict, setHasConflict] = useState(false)
  const [conflictDetails, setConflictDetails] = useState<string>('')

  useEffect(() => {
    if (allocation) {
      setSelectedRoom(null)
      setError(null)
      setHasConflict(false)
      setConflictDetails('')
    }
  }, [allocation, isOpen])

  // Check for schedule conflicts when room selection changes
  useEffect(() => {
    if (!selectedRoom || !allocation) {
      setHasConflict(false)
      setConflictDetails('')
      return
    }

    // Check for schedule conflicts
    const [startTime, endTime] = allocation.schedule_time.split('-').map(t => t.trim())
    const conflict = allAllocations.find(
      alloc =>
        alloc.id !== allocation.id &&
        alloc.room === selectedRoom.room &&
        alloc.building === selectedRoom.building &&
        alloc.schedule_day === allocation.schedule_day &&
        alloc.schedule_time === allocation.schedule_time
    )

    if (conflict) {
      setHasConflict(true)
      setConflictDetails(
        `${conflict.course_code} (${conflict.section}) is already scheduled in ${selectedRoom.room} at ${allocation.schedule_time} on ${allocation.schedule_day}`
      )
    } else {
      setHasConflict(false)
      setConflictDetails('')
    }
  }, [selectedRoom, allocation, allAllocations])

  const handleConfirm = async () => {
    if (!selectedRoom || !allocation) return

    setLoading(true)
    setError(null)

    try {
      await onConfirm(selectedRoom.id, selectedRoom.room, selectedRoom.building)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to reassign room')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !allocation) return null

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Reassign Room</h2>
          <button className={styles.closeButton} onClick={onClose} disabled={loading}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* Current Allocation Details */}
          <div className={styles.allocationDetails}>
            <h3>Current Allocation</h3>
            <div className={styles.detailsGrid}>
              <div className={styles.detailItem}>
                <span className={styles.label}>Course</span>
                <span className={styles.value}>{allocation.course_code}</span>
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
              <div className={styles.detailItem}>
                <span className={styles.label}>Current Room</span>
                <span className={styles.value}>
                  {allocation.room} ({allocation.building})
                </span>
              </div>
            </div>
          </div>

          {/* Room Selection */}
          <div className={styles.roomSelection}>
            <h3>Select New Room</h3>
            {courseRequirements.length > 0 && (
              <div className={styles.requirementsInfo}>
                <h4>Course Equipment Requirements:</h4>
                <ul>
                  {courseRequirements.map((req, idx) => (
                    <li key={idx}>
                      {req.tag_name}
                      {req.is_mandatory ? (
                        <span className={styles.mandatoryBadge}>Required</span>
                      ) : (
                        <span className={styles.optionalBadge}>Optional</span>
                      )}
                      {req.min_quantity > 1 && <span> (Qty: {req.min_quantity})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className={styles.roomList}>
              {(() => {
                // Filter rooms: exclude those with mandatory equipment gaps
                const compatibleRooms = availableRooms.filter(room => {
                  const roomFeatures = roomEquipment.get(room.id) || []
                  return !courseRequirements.some(req => {
                    if (!req.is_mandatory) return false
                    const has = roomFeatures.find(f => f.feature_id === req.feature_id)
                    return !has || (has.quantity < req.min_quantity)
                  })
                })

                if (compatibleRooms.length === 0) {
                  return (
                    <div className={styles.noRooms}>
                      No rooms with required equipment available
                    </div>
                  )
                }

                return compatibleRooms.map(room => {
                  const roomFeatures = roomEquipment.get(room.id) || []
                  const hasMissingOptional = courseRequirements.some(req => {
                    if (req.is_mandatory) return false
                    const has = roomFeatures.find(f => f.feature_id === req.feature_id)
                    return !has || (has.quantity < req.min_quantity)
                  })

                  return (
                    <div
                      key={room.id}
                      className={`${styles.roomOption} ${selectedRoom?.id === room.id ? styles.selected : ''}`}
                      onClick={() => setSelectedRoom(room)}
                    >
                      <div className={styles.roomInfo}>
                        <div className={styles.roomName}>{room.room}</div>
                        <div className={styles.roomMeta}>
                          {room.building} • Capacity: {room.capacity}
                        </div>
                        {hasMissingOptional && (
                          <div className={styles.equipmentStatus}>
                            <div className={styles.equipmentWarning}>
                              <AlertCircle size={14} />
                              Missing some optional equipment
                            </div>
                          </div>
                        )}
                      </div>
                      {selectedRoom?.id === room.id && (
                        <Check size={20} className={styles.selectedIcon} />
                      )}
                    </div>
                  )
                })
              })()}
            </div>
          </div>

          {/* Conflict Warning */}
          {hasConflict && (
            <div className={styles.conflictWarning}>
              <AlertCircle size={20} />
              <div>
                <p className={styles.conflictTitle}>Room Conflict Detected</p>
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
            disabled={loading || !selectedRoom || hasConflict}
          >
            {loading ? (
              <>
                <Loader2 size={16} className={styles.spinner} />
                Updating...
              </>
            ) : (
              <>
                <Check size={16} />
                Confirm Reassignment
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
