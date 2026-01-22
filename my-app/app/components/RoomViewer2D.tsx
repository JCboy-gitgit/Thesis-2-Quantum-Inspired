'use client'

import React, { useState, useEffect } from 'react'
import { MapPin, Clock, Users, CheckCircle, XCircle, Building2, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import styles from './RoomViewer2D.module.css'

interface Room {
  id: string
  name: string
  building: string
  floor_number: number
  capacity?: number
  type?: string
  x?: number
  y?: number
  width?: number
  height?: number
}

interface ScheduleItem {
  id: number
  course_code: string
  course_name: string
  room: string
  building: string
  day: string
  start_time: string
  end_time: string
  section: string
  instructor?: string
}

interface RoomStatus {
  room: Room
  isOccupied: boolean
  currentClass?: ScheduleItem
  nextClass?: ScheduleItem
  todaysSchedule: ScheduleItem[]
}

interface BuildingInfo {
  name: string
  floors: number
  rooms: Room[]
}

export default function RoomViewer2D() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [roomStatuses, setRoomStatuses] = useState<RoomStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRoom, setSelectedRoom] = useState<RoomStatus | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [selectedBuilding, setSelectedBuilding] = useState<string>('Federizo Hall')
  const [selectedFloor, setSelectedFloor] = useState<number>(1)
  const [viewMode, setViewMode] = useState<'overview' | 'schedule'>('overview')

  // Building configurations
  const buildings: BuildingInfo[] = [
    { name: 'Federizo Hall', floors: 3, rooms: [] },
    { name: 'SRLC Building', floors: 2, rooms: [] }
  ]

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  // Fetch rooms and schedules
  useEffect(() => {
    fetchRoomsAndSchedules()
  }, [])

  // Update room statuses when data changes
  useEffect(() => {
    if (rooms.length > 0 && schedules.length >= 0) {
      updateRoomStatuses()
    }
  }, [rooms, schedules, currentTime])

  const fetchRoomsAndSchedules = async () => {
    try {
      setLoading(true)

      // Fetch rooms
      const roomsResponse = await fetch('/api/room-allocation/rooms')
      const roomsData = await roomsResponse.json()

      // Fetch schedules
      const schedulesResponse = await fetch('/api/room-allocation')
      const schedulesData = await schedulesResponse.json()

      // Transform rooms data
      const transformedRooms: Room[] = (roomsData.rooms || roomsData || []).map((room: any, index: number) => {
        // Assign rooms to buildings if not specified
        let building = room.building
        let floor = room.floor_number || room.floor || 1

        // If no building specified, distribute between the two buildings
        if (!building) {
          building = index % 2 === 0 ? 'Federizo Hall' : 'SRLC Building'
          // Ensure floor doesn't exceed building limits
          if (building === 'Federizo Hall' && floor > 3) floor = 3
          if (building === 'SRLC Building' && floor > 2) floor = 2
        }

        // Calculate position based on building and floor
        const buildingIndex = buildings.findIndex(b => b.name === building)
        const roomsPerFloor = 8 // Approximate rooms per floor
        const roomIndex = index % roomsPerFloor

        const x = 50 + (roomIndex % 4) * 120 // 4 rooms per row
        const y = 50 + Math.floor(roomIndex / 4) * 80 // 2 rows

        return {
          id: room.id || room.room_id || room.name || `room-${index}`,
          name: room.room || room.name || `Room ${index + 1}`,
          building,
          floor_number: floor,
          capacity: room.capacity || 30,
          type: room.type || 'Classroom',
          x,
          y,
          width: 100,
          height: 60
        }
      })

      // Transform schedules data
      const transformedSchedules: ScheduleItem[] = (schedulesData.schedules || schedulesData || []).map((schedule: any) => ({
        id: schedule.id,
        course_code: schedule.course_code || schedule.code,
        course_name: schedule.course_name || schedule.name,
        room: schedule.room,
        building: schedule.building,
        day: schedule.day,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        section: schedule.section,
        instructor: schedule.instructor
      }))

      setRooms(transformedRooms)
      setSchedules(transformedSchedules)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateRoomStatuses = () => {
    const now = currentTime
    const currentDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()]
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    const statuses: RoomStatus[] = rooms.map(room => {
      // Find all classes for this room today
      const todaysSchedule = schedules.filter(s =>
        s.room === room.name &&
        s.building === room.building &&
        s.day === currentDay
      ).sort((a, b) => {
        const aStart = a.start_time.split(':').map(Number)
        const bStart = b.start_time.split(':').map(Number)
        return (aStart[0] * 60 + aStart[1]) - (bStart[0] * 60 + bStart[1])
      })

      let currentClass: ScheduleItem | undefined
      let nextClass: ScheduleItem | undefined
      let isOccupied = false

      for (const schedule of todaysSchedule) {
        const [startHour, startMin] = schedule.start_time.split(':').map(Number)
        const [endHour, endMin] = schedule.end_time.split(':').map(Number)
        const startMinutes = startHour * 60 + startMin
        const endMinutes = endHour * 60 + endMin

        if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
          currentClass = schedule
          isOccupied = true
          break
        } else if (currentMinutes < startMinutes && !nextClass) {
          nextClass = schedule
        }
      }

      return {
        room,
        isOccupied,
        currentClass,
        nextClass,
        todaysSchedule
      }
    })

    setRoomStatuses(statuses)
  }

  const filteredStatuses = roomStatuses.filter(status =>
    status.room.building === selectedBuilding &&
    status.room.floor_number === selectedFloor
  )

  const selectedBuildingInfo = buildings.find(b => b.name === selectedBuilding)
  const maxFloors = selectedBuildingInfo?.floors || 3

  const handleRoomClick = (roomStatus: RoomStatus) => {
    setSelectedRoom(roomStatus)
    setViewMode('schedule')
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading room viewer...</p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2><MapPin size={20} /> Room Viewer 2D</h2>
        <div className={styles.controls}>
          <select
            value={selectedBuilding}
            onChange={(e) => {
              setSelectedBuilding(e.target.value)
              setSelectedFloor(1) // Reset to first floor when changing building
            }}
            className={styles.select}
          >
            {buildings.map(building => (
              <option key={building.name} value={building.name}>{building.name}</option>
            ))}
          </select>

          <div className={styles.floorControls}>
            <button
              onClick={() => setSelectedFloor(Math.max(1, selectedFloor - 1))}
              disabled={selectedFloor <= 1}
              className={styles.floorBtn}
            >
              <ChevronLeft size={16} />
            </button>
            <span className={styles.floorLabel}>Floor {selectedFloor}</span>
            <button
              onClick={() => setSelectedFloor(Math.min(maxFloors, selectedFloor + 1))}
              disabled={selectedFloor >= maxFloors}
              className={styles.floorBtn}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            onClick={fetchRoomsAndSchedules}
            className={styles.refreshBtn}
            title="Refresh data"
          >
            <Clock size={16} />
          </button>
        </div>
      </div>

      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <div className={`${styles.statusIndicator} ${styles.vacant}`}></div>
          <span>Vacant</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.statusIndicator} ${styles.occupied}`}></div>
          <span>Occupied</span>
        </div>
        <div className={styles.legendItem}>
          <Clock size={14} />
          <span>Real-time ({currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})</span>
        </div>
      </div>

      {viewMode === 'overview' ? (
        <div className={styles.viewer}>
          <div className={styles.buildingInfo}>
            <Building2 size={16} />
            <span>{selectedBuilding} - Floor {selectedFloor}</span>
          </div>

          <div className={styles.floorPlan}>
            {filteredStatuses.length === 0 ? (
              <div className={styles.noRooms}>
                <Building2 size={48} />
                <p>No rooms found for {selectedBuilding} Floor {selectedFloor}</p>
              </div>
            ) : (
              filteredStatuses.map(status => (
                <div
                  key={`${status.room.building}-${status.room.name}`}
                  className={`${styles.room} ${status.isOccupied ? styles.occupied : styles.vacant}`}
                  style={{
                    left: status.room.x || 0,
                    top: status.room.y || 0,
                    width: status.room.width || 100,
                    height: status.room.height || 60,
                  }}
                  onClick={() => handleRoomClick(status)}
                  title={`${status.room.name} - ${status.isOccupied ? 'Occupied' : 'Vacant'}`}
                >
                  <div className={styles.roomHeader}>
                    <div className={styles.roomLabel}>
                      {status.room.name}
                    </div>
                    <div className={styles.roomStatus}>
                      {status.isOccupied ? <XCircle size={12} /> : <CheckCircle size={12} />}
                    </div>
                  </div>

                  {status.room.capacity && (
                    <div className={styles.roomCapacity}>
                      <Users size={10} />
                      <span>{status.room.capacity}</span>
                    </div>
                  )}

                  {status.currentClass && (
                    <div className={styles.currentClass}>
                      <div className={styles.classCode}>{status.currentClass.course_code}</div>
                      <div className={styles.classTime}>
                        {formatTime(status.currentClass.start_time)} - {formatTime(status.currentClass.end_time)}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className={styles.scheduleView}>
          <div className={styles.scheduleHeader}>
            <button
              onClick={() => setViewMode('overview')}
              className={styles.backBtn}
            >
              <ChevronLeft size={16} />
              Back to Overview
            </button>
            <h3><Calendar size={20} /> {selectedRoom?.room.name} - Full Schedule</h3>
          </div>

          <div className={styles.scheduleContent}>
            <div className={styles.roomInfo}>
              <div className={styles.infoItem}>
                <Building2 size={16} />
                <span>{selectedRoom?.room.building}, Floor {selectedRoom?.room.floor_number}</span>
              </div>
              {selectedRoom?.room.capacity && (
                <div className={styles.infoItem}>
                  <Users size={16} />
                  <span>Capacity: {selectedRoom.room.capacity}</span>
                </div>
              )}
            </div>

            <div className={styles.scheduleGrid}>
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => {
                const daySchedule = selectedRoom?.todaysSchedule.filter(s => s.day === day) || []

                return (
                  <div key={day} className={styles.dayColumn}>
                    <h4 className={styles.dayHeader}>{day}</h4>
                    <div className={styles.daySchedule}>
                      {daySchedule.length === 0 ? (
                        <div className={styles.noClasses}>No classes</div>
                      ) : (
                        daySchedule.map((schedule, index) => (
                          <div key={index} className={styles.scheduleItem}>
                            <div className={styles.scheduleTime}>
                              {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                            </div>
                            <div className={styles.scheduleDetails}>
                              <div className={styles.courseCode}>{schedule.course_code}</div>
                              <div className={styles.courseName}>{schedule.course_name}</div>
                              <div className={styles.section}>{schedule.section}</div>
                              {schedule.instructor && (
                                <div className={styles.instructor}>{schedule.instructor}</div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}