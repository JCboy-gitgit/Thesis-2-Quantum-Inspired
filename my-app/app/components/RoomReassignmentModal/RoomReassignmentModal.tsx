"use client"

import { useState, useEffect, useMemo, useCallback } from 'react'
import { X, Check, AlertCircle, Loader2, AlertTriangle, Search, ChevronDown, ChevronUp, Zap, Shield, Star, MapPin, Monitor } from 'lucide-react'
import styles from './RoomReassignmentModal.module.css'

interface Room {
  id: number
  room: string
  building: string
  campus: string
  capacity: number
  room_type?: string
  specific_classification?: string
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
  teacher_id?: string
  department?: string
  lec_hours?: number
  lab_hours?: number
}

type SortMode = 'compatibility' | 'capacity' | 'building' | 'name'

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
  availableRooms: propRooms,
  onConfirm,
  onClose,
  allAllocations,
  courseRequirements: propRequirements = [],
  roomEquipment: propEquipment = new Map()
}: RoomReassignmentModalProps) {
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasConflict, setHasConflict] = useState(false)
  const [conflictDetails, setConflictDetails] = useState<string>('')

  const [fetchingRooms, setFetchingRooms] = useState(false)
  const [allRooms, setAllRooms] = useState<Room[]>([])
  const [roomFeatures, setRoomFeatures] = useState<Map<number, RoomEquipment[]>>(new Map())
  const [courseReqs, setCourseReqs] = useState<CourseRequirement[]>([])

  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('compatibility')
  const [expandedRoom, setExpandedRoom] = useState<number | null>(null)

  const fetchRoomData = useCallback(async () => {
    if (!allocation) return
    if (propRooms.length > 0) {
      setAllRooms(propRooms)
      setRoomFeatures(propEquipment)
      setCourseReqs(propRequirements)
      return
    }

    setFetchingRooms(true)
    setError(null)

    try {
      // Fetch rooms, features, and course requirements via API route (bypasses RLS)
      const courseCode = allocation.course_code?.trim() || ''
      const params = new URLSearchParams({
        includeFeatures: 'true',
        ...(courseCode && { courseCode })
      })
      
      const response = await fetch(`/api/rooms-list?${params}`, { cache: 'no-store' })
      const data = await response.json()

      if (!data.success) throw new Error(data.error || 'Failed to load rooms')

      const rooms = data.rooms || []
      console.log(`[RoomModal] ✅ Loaded ${rooms.length} rooms via API`)
      setAllRooms(rooms)

      // Convert roomFeatures from object to Map
      const featureMap = new Map<number, RoomEquipment[]>()
      if (data.roomFeatures) {
        Object.entries(data.roomFeatures).forEach(([roomId, features]: [string, any]) => {
          featureMap.set(Number(roomId), features)
        })
      }
      console.log(`[RoomModal] ✅ ${featureMap.size} rooms have equipment data`)
      setRoomFeatures(featureMap)

      // Set course requirements
      setCourseReqs(data.courseRequirements || [])
    } catch (err: any) {
      console.error('[RoomModal] Error:', err)
      setError(err.message || 'Failed to load rooms')
    } finally {
      setFetchingRooms(false)
    }
  }, [allocation, propRooms.length])

  useEffect(() => {
    if (isOpen && allocation) fetchRoomData()
  }, [isOpen, allocation, fetchRoomData])

  useEffect(() => {
    if (allocation) {
      setSelectedRoom(null)
      setError(null)
      setHasConflict(false)
      setConflictDetails('')
      setSearchQuery('')
      setExpandedRoom(null)
    }
  }, [allocation, isOpen])

  useEffect(() => {
    if (!selectedRoom || !allocation) { setHasConflict(false); setConflictDetails(''); return }
    const conflict = allAllocations.find(a =>
      a.id !== allocation.id && a.room === selectedRoom.room && a.building === selectedRoom.building &&
      a.schedule_day === allocation.schedule_day && a.schedule_time === allocation.schedule_time
    )
    if (conflict) {
      setHasConflict(true)
      setConflictDetails(`${conflict.course_code} (${conflict.section}) is already in ${selectedRoom.room} at ${allocation.schedule_time} on ${allocation.schedule_day}`)
    } else { setHasConflict(false); setConflictDetails('') }
  }, [selectedRoom, allocation, allAllocations])

  const roomScores = useMemo(() => {
    const scores = new Map<number, { score: number; total: number; missingMandatory: string[]; missingOptional: string[]; matched: string[] }>()
    allRooms.forEach(room => {
      const features = roomFeatures.get(room.id) || []
      const mandatory = courseReqs.filter(r => r.is_mandatory)
      const optional = courseReqs.filter(r => !r.is_mandatory)
      const total = courseReqs.length
      const missingMandatory: string[] = [], missingOptional: string[] = [], matched: string[] = []
      mandatory.forEach(req => {
        const has = features.find(f => f.feature_id === req.feature_id)
        if (!has || has.quantity < req.min_quantity) missingMandatory.push(req.tag_name)
        else matched.push(req.tag_name)
      })
      optional.forEach(req => {
        const has = features.find(f => f.feature_id === req.feature_id)
        if (!has || has.quantity < req.min_quantity) missingOptional.push(req.tag_name)
        else matched.push(req.tag_name)
      })
      const score = total > 0 ? (matched.length / total) * 100 : -1
      scores.set(room.id, { score, total, missingMandatory, missingOptional, matched })
    })
    return scores
  }, [allRooms, roomFeatures, courseReqs])

  const roomConflicts = useMemo(() => {
    const conflicts = new Map<number, RoomAllocation | null>()
    allRooms.forEach(room => {
      if (!allocation) { conflicts.set(room.id, null); return }
      const c = allAllocations.find(a =>
        a.id !== allocation.id && a.room === room.room && a.building === room.building &&
        a.schedule_day === allocation.schedule_day && a.schedule_time === allocation.schedule_time
      )
      conflicts.set(room.id, c || null)
    })
    return conflicts
  }, [allRooms, allocation, allAllocations])

  const filteredRooms = useMemo(() => {
    let rooms = [...allRooms]
    if (allocation) rooms = rooms.filter(r => !(r.room === allocation.room && r.building === allocation.building))
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      rooms = rooms.filter(r => r.room.toLowerCase().includes(q) || r.building.toLowerCase().includes(q) || r.campus.toLowerCase().includes(q) || (r.room_type || '').toLowerCase().includes(q))
    }
    rooms.sort((a, b) => {
      if (sortMode === 'compatibility') {
        const sa = roomScores.get(a.id)?.score ?? -1, sb = roomScores.get(b.id)?.score ?? -1
        if (sb !== sa) return sb - sa
        return a.room.localeCompare(b.room)
      }
      if (sortMode === 'capacity') return (b.capacity || 0) - (a.capacity || 0)
      if (sortMode === 'building') { const d = a.building.localeCompare(b.building); return d !== 0 ? d : a.room.localeCompare(b.room) }
      return a.room.localeCompare(b.room)
    })
    return rooms
  }, [allRooms, allocation, searchQuery, sortMode, roomScores])

  const handleConfirm = async () => {
    if (!selectedRoom || !allocation) return
    setLoading(true); setError(null)
    try { await onConfirm(selectedRoom.id, selectedRoom.room, selectedRoom.building); onClose() }
    catch (err: any) { setError(err.message || 'Failed to reassign room') }
    finally { setLoading(false) }
  }

  const getScoreBadge = (roomId: number) => {
    const d = roomScores.get(roomId)
    if (!d || d.total === 0) return null
    if (d.missingMandatory.length > 0) return <span className={styles.scoreBadgeRed}><AlertTriangle size={11} /> Incompatible</span>
    if (d.score >= 100) return <span className={styles.scoreBadgeGreen}><Shield size={11} /> Perfect Match</span>
    if (d.score >= 50) return <span className={styles.scoreBadgeYellow}><Star size={11} /> {Math.round(d.score)}%</span>
    return <span className={styles.scoreBadgeRed}><AlertTriangle size={11} /> {Math.round(d.score)}%</span>
  }

  if (!isOpen || !allocation) return null

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.headerLeft}>
            <h2>Reassign Room</h2>
            <span className={styles.headerSubtitle}>
              {allocation.course_code} &bull; {allocation.section} &bull; {allocation.schedule_day} {allocation.schedule_time}
            </span>
          </div>
          <button className={styles.closeButton} onClick={onClose} disabled={loading}><X size={20} /></button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.allocationDetails}>
            <h3>Current Allocation</h3>
            <div className={styles.detailsGrid}>
              <div className={styles.detailItem}><span className={styles.label}>Course</span><span className={styles.value}>{allocation.course_code} — {allocation.course_name}</span></div>
              <div className={styles.detailItem}><span className={styles.label}>Section</span><span className={styles.value}>{allocation.section}</span></div>
              <div className={styles.detailItem}><span className={styles.label}>Schedule</span><span className={styles.value}>{allocation.schedule_day} {allocation.schedule_time}</span></div>
              <div className={styles.detailItem}><span className={styles.label}>Current Room</span><span className={styles.currentRoomValue}>{allocation.room} — {allocation.building}</span></div>
              {allocation.teacher_name && <div className={styles.detailItem}><span className={styles.label}>Faculty</span><span className={styles.value}>{allocation.teacher_name}</span></div>}
            </div>
          </div>

          {courseReqs.length > 0 && (
            <div className={styles.requirementsInfo}>
              <h4><Zap size={14} /> Course Equipment Requirements</h4>
              <div className={styles.reqTagsList}>
                {courseReqs.map((req, i) => (
                  <span key={i} className={`${styles.reqTag} ${req.is_mandatory ? styles.reqMandatory : styles.reqOptional}`}>
                    {req.tag_name}
                    {req.is_mandatory ? <span className={styles.mandatoryBadge}>Required</span> : <span className={styles.optionalBadge}>Optional</span>}
                    {req.min_quantity > 1 && <span className={styles.qtyBadge}>x{req.min_quantity}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className={styles.roomSelection}>
            <h3>Select New Room</h3>
            <div className={styles.filterBar}>
              <div className={styles.searchBox}>
                <Search size={16} />
                <input type="text" placeholder="Search rooms, buildings..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className={styles.searchInput} />
                {searchQuery && <button className={styles.clearSearch} onClick={() => setSearchQuery('')}><X size={14} /></button>}
              </div>
              <select className={styles.filterSelect} value={sortMode} onChange={e => setSortMode(e.target.value as SortMode)}>
                <option value="compatibility">Sort: Best Match</option>
                <option value="capacity">Sort: Capacity</option>
                <option value="building">Sort: Building</option>
                <option value="name">Sort: Name</option>
              </select>
            </div>
            <div className={styles.roomCount}>
              Showing {filteredRooms.length} of {allRooms.length} rooms
              {courseReqs.length > 0 && ` • ${courseReqs.length} requirement${courseReqs.length > 1 ? 's' : ''}`}
            </div>

            <div className={styles.roomList}>
              {fetchingRooms ? (
                <div className={styles.loadingState}><Loader2 size={28} className={styles.spinner} /><p>Loading rooms & equipment data...</p></div>
              ) : filteredRooms.length === 0 && allRooms.length === 0 ? (
                <div className={styles.noRooms}><AlertCircle size={20} /><p>No rooms found in the database.</p><small>Check Room Management settings.</small></div>
              ) : filteredRooms.length === 0 ? (
                <div className={styles.noRooms}><Search size={20} /><p>No rooms match your filters.</p><small>Try relaxing filters or search criteria.</small></div>
              ) : (
                filteredRooms.map(room => {
                  const scoreData = roomScores.get(room.id)
                  const conflict = roomConflicts.get(room.id)
                  const features = roomFeatures.get(room.id) || []
                  const isExpanded = expandedRoom === room.id
                  const isIncompatible = scoreData && scoreData.total > 0 ? scoreData.missingMandatory.length > 0 : false
                  return (
                    <div key={room.id} className={styles.roomItemWrapper}>
                      <div
                        className={`${styles.roomOption} ${selectedRoom?.id === room.id ? styles.selected : ''} ${conflict ? styles.hasConflict : ''} ${isIncompatible ? styles.incompatible : ''}`}
                        onClick={() => { if (!conflict && !isIncompatible) setSelectedRoom(room) }}
                      >
                        <div className={styles.roomInfo}>
                          <div className={styles.roomNameRow}>
                            <span className={styles.roomName}>{room.room}</span>
                            {getScoreBadge(room.id)}
                            {conflict && <span className={styles.conflictBadge}><AlertCircle size={11} /> Occupied</span>}
                          </div>
                          <div className={styles.roomMeta}>{room.building} &bull; {room.campus} &bull; Cap: {room.capacity || 'N/A'}{room.room_type && ` • ${room.room_type}`}</div>
                          {features.length > 0 && (
                            <div className={styles.equipmentTags}>
                              {features.slice(0, 5).map((f, i) => (
                                <span key={i} className={`${styles.eqTag} ${scoreData?.matched.includes(f.tag_name) ? styles.eqTagMatched : ''}`}>
                                  {f.tag_name}{f.quantity > 1 && <span className={styles.eqQty}>x{f.quantity}</span>}
                                </span>
                              ))}
                              {features.length > 5 && <span className={styles.eqTagMore}>+{features.length - 5}</span>}
                            </div>
                          )}
                          {features.length === 0 && <div className={styles.noEquipmentNote}>No equipment data</div>}
                          {conflict && <div className={styles.conflictInfo}>Occupied by {conflict.course_code} ({conflict.section})</div>}
                          {scoreData && scoreData.missingMandatory.length > 0 && <div className={styles.missingInfo}>Missing: {scoreData.missingMandatory.join(', ')}</div>}
                        </div>
                        <div className={styles.roomActions}>
                          {selectedRoom?.id === room.id && !conflict && !isIncompatible && <Check size={20} className={styles.selectedIcon} />}
                          {features.length > 0 && (
                            <button className={styles.expandBtn} onClick={e => { e.stopPropagation(); setExpandedRoom(isExpanded ? null : room.id) }} title="View equipment">
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          )}
                        </div>
                      </div>
                      {isExpanded && features.length > 0 && (
                        <div className={styles.expandedFeatures}>
                          <div className={styles.featureGrid}>
                            {features.map((f, i) => {
                              const isReq = courseReqs.some(r => r.feature_id === f.feature_id && r.is_mandatory)
                              const isOpt = courseReqs.some(r => r.feature_id === f.feature_id && !r.is_mandatory)
                              return (
                                <div key={i} className={`${styles.featureItem} ${isReq ? styles.featureRequired : ''} ${isOpt ? styles.featureOptional : ''}`}>
                                  <span className={styles.featureName}>{f.tag_name}</span>
                                  <span className={styles.featureCategory}>{f.tag_category}</span>
                                  {f.quantity > 1 && <span className={styles.featureQty}>Qty: {f.quantity}</span>}
                                </div>
                              )
                            })}
                          </div>
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
              <div><p className={styles.conflictTitle}>Room Conflict Detected</p><p className={styles.conflictMessage}>{conflictDetails}</p></div>
            </div>
          )}
          {error && <div className={styles.errorMessage}><AlertCircle size={20} /><p>{error}</p></div>}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelButton} onClick={onClose} disabled={loading}>Cancel</button>
          <button className={`${styles.confirmButton} ${hasConflict ? styles.disabled : ''}`} onClick={handleConfirm} disabled={loading || !selectedRoom || hasConflict}>
            {loading ? <><Loader2 size={16} className={styles.spinner} /> Updating...</> : <><Check size={16} /> Confirm Reassignment</>}
          </button>
        </div>
      </div>
    </div>
  )
}
