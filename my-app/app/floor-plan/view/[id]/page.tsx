'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Building2, Layers, Users, Clock, ZoomIn, ZoomOut, Maximize2, Calendar, Download, ChevronLeft, Info, Map, Check, Loader2, Wind, Projector, Wifi, Square, Building, Footprints, DoorOpen, ArrowUpDown, Bath, Laptop, Beaker, Library, UtensilsCrossed, Archive, Dumbbell, Music, Theater, Presentation, Server, Flame, Droplets, AlertTriangle, CircleDot, Triangle, Hexagon, Pentagon, Octagon, Star, Heart, RotateCcw, CheckCircle, AlertCircle } from 'lucide-react'
import styles from './styles.module.css'

// Untyped supabase helper for tables not in generated types
const db = supabase as any

// Types
interface Room {
  id: number
  room: string
  room_code?: string
  building: string
  capacity: number
  floor_number?: number
  room_type?: string
  has_ac?: boolean
  has_projector?: boolean
  has_wifi?: boolean
}

interface RoomAllocation {
  id: number
  schedule_id: number
  room: string
  building: string
  course_code: string
  section: string
  schedule_day: string
  schedule_time: string
  teacher_name?: string
}

interface CanvasElement {
  id: string
  type: 'room' | 'wall' | 'door' | 'text' | 'icon' | 'hallway' | 'stair' | 'shape'
  x: number
  y: number
  width: number
  height: number
  rotation: number
  label?: string
  color?: string
  borderColor?: string
  linkedRoomId?: number
  linkedRoomData?: Room
  zIndex: number
  iconType?: string
  shapeType?: string
  fontSize?: number
}

interface FloorPlan {
  id: number
  building_id: number
  floor_number: number
  floor_name: string
  canvas_data: any
  canvas_width: number
  canvas_height: number
  is_default_view: boolean
  linked_schedule_id?: number
}

interface Schedule {
  id: number
  schedule_name: string
  school_name: string
  semester: string
  academic_year: string
}

// Room type colors
const ROOM_TYPE_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  'classroom': { bg: '#3b82f6', border: '#1d4ed8', label: 'Lecture Rooms' },
  'lecture_hall': { bg: '#8b5cf6', border: '#6d28d9', label: 'Lecture Hall' },
  'computer_lab': { bg: '#06b6d4', border: '#0891b2', label: 'Computer Lab' },
  'laboratory': { bg: '#ec4899', border: '#be185d', label: 'Laboratory' },
  'library': { bg: '#22c55e', border: '#15803d', label: 'Library Center' },
  'office': { bg: '#f59e0b', border: '#d97706', label: 'Office' },
  'storage': { bg: '#78716c', border: '#57534e', label: 'Tool Storage' },
  'stockroom': { bg: '#d4a373', border: '#bc8f5a', label: 'Stock Room' },
  'restroom': { bg: '#94a3b8', border: '#64748b', label: 'Restroom' },
  'gymnasium': { bg: '#f97316', border: '#ea580c', label: 'Gymnasium' },
  'cafeteria': { bg: '#84cc16', border: '#65a30d', label: 'Cafeteria' },
  'auditorium': { bg: '#a855f7', border: '#9333ea', label: 'Auditorium' },
  'default': { bg: '#e5e7eb', border: '#9ca3af', label: 'Other' }
}

export default function FloorPlanViewPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const highlightRoom = searchParams.get('room') || null
  const canvasRef = useRef<HTMLDivElement>(null)
  const floorPlanId = params.id as string

  // State
  const [loading, setLoading] = useState(true)
  const [floorPlan, setFloorPlan] = useState<FloorPlan | null>(null)
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [canvasElements, setCanvasElements] = useState<CanvasElement[]>([])
  const [roomAllocations, setRoomAllocations] = useState<RoomAllocation[]>([])
  const [selectedElement, setSelectedElement] = useState<CanvasElement | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [zoom, setZoom] = useState(100)
  const [canvasSize, setCanvasSize] = useState({ width: 1600, height: 1000 })
  const [showLiveStatus, setShowLiveStatus] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  // Fetch floor plan data
  useEffect(() => {
    if (floorPlanId) {
      fetchFloorPlan()
    }
  }, [floorPlanId])

  const fetchFloorPlan = async () => {
    try {
      setLoading(true)
      
      const { data: fp, error: fpError } = await db
        .from('floor_plans')
        .select('*')
        .eq('id', floorPlanId)
        .single()

      if (fpError) throw fpError
      if (!fp) {
        setError('Floor plan not found')
        return
      }

      setFloorPlan(fp as FloorPlan)
      
      if (fp.canvas_data?.elements) {
        const elements = fp.canvas_data.elements
        setCanvasElements(elements)
        // Auto-select the room if ?room= query param is present
        if (highlightRoom) {
          const match = elements.find((el: CanvasElement) =>
            el.linkedRoomData?.room === highlightRoom || el.label === highlightRoom
          )
          if (match) setSelectedElement(match)
        }
      }
      if (fp.canvas_data?.canvasSize) {
        setCanvasSize(fp.canvas_data.canvasSize)
      }

      // Fetch linked schedule
      if (fp.linked_schedule_id) {
        const { data: scheduleData } = await db
          .from('generated_schedules')
          .select('*')
          .eq('id', fp.linked_schedule_id)
          .single()

        if (scheduleData) {
          setSchedule(scheduleData as Schedule)
          
          // Fetch room allocations
          const { data: allocations } = await supabase
            .from('room_allocations')
            .select('*')
            .eq('schedule_id', fp.linked_schedule_id)

          setRoomAllocations(allocations || [])
        }
      }

    } catch (err) {
      console.error('Error fetching floor plan:', err)
      setError('Failed to load floor plan')
    } finally {
      setLoading(false)
    }
  }

  // Get room color
  const getRoomColor = (roomType?: string) => {
    const type = roomType?.toLowerCase().replace(/\s+/g, '_') || 'default'
    return ROOM_TYPE_COLORS[type] || ROOM_TYPE_COLORS.default
  }

  // Get room availability
  const getRoomAvailability = (roomName: string): 'available' | 'occupied' | 'unknown' => {
    if (!showLiveStatus || roomAllocations.length === 0) return 'unknown'

    const now = currentTime
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const currentDay = dayNames[now.getDay()]
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()

    const isOccupied = roomAllocations.some(alloc => {
      if (alloc.room !== roomName) return false
      
      const allocDay = alloc.schedule_day?.toLowerCase()
      if (!allocDay?.includes(currentDay)) return false

      const timeParts = alloc.schedule_time?.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
      if (!timeParts) return false

      let startHour = parseInt(timeParts[1])
      const startMin = parseInt(timeParts[2])
      const startPeriod = timeParts[3]?.toUpperCase()
      let endHour = parseInt(timeParts[4])
      const endMin = parseInt(timeParts[5])
      const endPeriod = timeParts[6]?.toUpperCase()

      if (startPeriod === 'PM' && startHour !== 12) startHour += 12
      if (startPeriod === 'AM' && startHour === 12) startHour = 0
      if (endPeriod === 'PM' && endHour !== 12) endHour += 12
      if (endPeriod === 'AM' && endHour === 12) endHour = 0

      const startMins = startHour * 60 + startMin
      const endMins = endHour * 60 + endMin
      const currentMins = currentHour * 60 + currentMinute

      return currentMins >= startMins && currentMins < endMins
    })

    return isOccupied ? 'occupied' : 'available'
  }

  // Get current class for room
  const getCurrentClass = (roomName: string): RoomAllocation | null => {
    if (roomAllocations.length === 0) return null

    const now = currentTime
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const currentDay = dayNames[now.getDay()]
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()

    return roomAllocations.find(alloc => {
      if (alloc.room !== roomName) return false
      
      const allocDay = alloc.schedule_day?.toLowerCase()
      if (!allocDay?.includes(currentDay)) return false

      const timeParts = alloc.schedule_time?.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
      if (!timeParts) return false

      let startHour = parseInt(timeParts[1])
      const startMin = parseInt(timeParts[2])
      const startPeriod = timeParts[3]?.toUpperCase()
      let endHour = parseInt(timeParts[4])
      const endMin = parseInt(timeParts[5])
      const endPeriod = timeParts[6]?.toUpperCase()

      if (startPeriod === 'PM' && startHour !== 12) startHour += 12
      if (startPeriod === 'AM' && startHour === 12) startHour = 0
      if (endPeriod === 'PM' && endHour !== 12) endHour += 12
      if (endPeriod === 'AM' && endHour === 12) endHour = 0

      const startMins = startHour * 60 + startMin
      const endMins = endHour * 60 + endMin
      const currentMins = currentHour * 60 + currentMinute

      return currentMins >= startMins && currentMins < endMins
    }) || null
  }

  // Get icon component
  const getIconComponent = (iconName: string, size: number = 24) => {
    const iconMap: Record<string, any> = {
      exit: DoorOpen, stairs: Footprints, elevator: ArrowUpDown, restroom: Bath,
      computer: Laptop, lab: Beaker, library: Library, cafeteria: UtensilsCrossed,
      storage: Archive, gym: Dumbbell, music: Music, theater: Theater,
      presentation: Presentation, server: Server, wifi: Wifi, ac: Wind,
      fire: Flame, water: Droplets, info: Info, warning: AlertTriangle,
    }
    const IconComp = iconMap[iconName] || Info
    return <IconComp size={size} />
  }

  // Get shape component
  const getShapeComponent = (shapeName: string, size: number = 24) => {
    const shapeMap: Record<string, any> = {
      circle: CircleDot, triangle: Triangle, hexagon: Hexagon, pentagon: Pentagon,
      octagon: Octagon, star: Star, heart: Heart,
    }
    const ShapeComp = shapeMap[shapeName] || CircleDot
    return <ShapeComp size={size} />
  }

  // Get legend items
  const getLegendItems = () => {
    const types = new Set(canvasElements
      .filter(el => el.type === 'room' && el.linkedRoomData)
      .map(el => el.linkedRoomData?.room_type || 'default'))
    return Array.from(types).map(type => ({
      type,
      ...getRoomColor(type)
    }))
  }

  // Handle element click
  const handleElementClick = (element: CanvasElement) => {
    setSelectedElement(element)
  }

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <RotateCcw size={48} className={styles.spinner} />
        <p>Loading Floor Plan...</p>
      </div>
    )
  }

  if (error || !floorPlan) {
    return (
      <div className={styles.errorContainer}>
        <AlertCircle size={48} />
        <h2>Floor Plan Not Found</h2>
        <p>{error || 'The requested floor plan does not exist.'}</p>
        <button onClick={() => router.back()} className={styles.backBtn}>
          <ChevronLeft size={18} />
          Go Back
        </button>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button onClick={() => router.back()} className={styles.backLink}>
            <ChevronLeft size={20} />
          </button>
          <div className={styles.logoSection}>
            <div className={styles.logo}>
              <span className={styles.logoQ}>Q</span>
            </div>
            <span className={styles.logoText}>Qtime Scheduler</span>
          </div>
        </div>

        <div className={styles.headerCenter}>
          <h1 className={styles.title}>
            <Map size={24} />
            {floorPlan.floor_name}
          </h1>
          {schedule && (
            <span className={styles.scheduleInfo}>
              <Calendar size={16} />
              {schedule.schedule_name} | {schedule.semester} {schedule.academic_year}
            </span>
          )}
        </div>

        <div className={styles.headerRight}>
          <div className={styles.timeDisplay}>
            <Clock size={18} />
            <span className={styles.time}>
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className={styles.day}>
              {currentTime.toLocaleDateString([], { weekday: 'long' })}
            </span>
          </div>
          <button
            className={`${styles.liveToggle} ${showLiveStatus ? styles.active : ''}`}
            onClick={() => setShowLiveStatus(!showLiveStatus)}
          >
            {showLiveStatus ? 'Live View ON' : 'Live View OFF'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        {/* Canvas Area */}
        <div className={styles.canvasArea}>
          <div
            ref={canvasRef}
            className={styles.canvas}
            style={{
              width: canvasSize.width,
              height: canvasSize.height,
              transform: `scale(${zoom / 100})`
            }}
          >
            {canvasElements.map(element => {
              const availability = element.linkedRoomData ? getRoomAvailability(element.linkedRoomData.room) : 'unknown'
              const currentClass = element.linkedRoomData ? getCurrentClass(element.linkedRoomData.room) : null
              const isSelected = selectedElement?.id === element.id

              return (
                <div
                  key={element.id}
                  className={`${styles.canvasElement} ${styles[`element_${element.type}`]} ${isSelected ? styles.selected : ''} ${showLiveStatus ? styles[availability] : ''} ${highlightRoom && (element.linkedRoomData?.room === highlightRoom || element.label === highlightRoom) ? styles.highlighted : ''}`}
                  style={{
                    left: element.x,
                    top: element.y,
                    width: element.width,
                    height: element.height,
                    backgroundColor: element.color,
                    borderColor: element.borderColor,
                    transform: `rotate(${element.rotation}deg)`,
                    zIndex: element.zIndex
                  }}
                  onClick={() => handleElementClick(element)}
                >
                  {element.type === 'room' && (
                    <>
                      <span className={styles.elementLabel}>{element.label}</span>
                      {element.linkedRoomData && (
                        <span className={styles.elementCapacity}>
                          <Users size={10} /> {element.linkedRoomData.capacity}
                        </span>
                      )}
                      {showLiveStatus && availability !== 'unknown' && (
                        <div className={`${styles.availabilityDot} ${styles[availability]}`} />
                      )}
                      {currentClass && showLiveStatus && (
                        <div className={styles.currentClassBadge}>
                          <span>{currentClass.course_code}</span>
                        </div>
                      )}
                    </>
                  )}
                  {element.type === 'text' && (
                    <span className={styles.textLabel} style={{ fontSize: element.fontSize }}>{element.label}</span>
                  )}
                  {element.type === 'hallway' && (
                    <span className={styles.hallwayLabel}>{element.label}</span>
                  )}
                  {element.type === 'stair' && (
                    <>
                      <Footprints size={20} />
                      <span>{element.label}</span>
                    </>
                  )}
                  {element.type === 'door' && <DoorOpen size={16} />}
                  {element.type === 'icon' && (
                    <div className={styles.iconElement}>
                      {getIconComponent(element.iconType || 'info', 28)}
                    </div>
                  )}
                  {element.type === 'shape' && (
                    <div className={styles.shapeElement}>
                      {getShapeComponent(element.shapeType || 'circle', Math.min(element.width, element.height) * 0.7)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Zoom Controls */}
          <div className={styles.zoomControls}>
            <button onClick={() => setZoom(z => Math.max(25, z - 25))}>
              <ZoomOut size={18} />
            </button>
            <span>{zoom}%</span>
            <button onClick={() => setZoom(z => Math.min(200, z + 25))}>
              <ZoomIn size={18} />
            </button>
            <button onClick={() => setZoom(100)}>
              <Maximize2 size={16} />
            </button>
          </div>
        </div>

        {/* Side Panel */}
        <aside className={styles.sidePanel}>
          {selectedElement && selectedElement.linkedRoomData ? (
            <div className={styles.roomInfo}>
              <h3>Room Information</h3>
              
              <div className={styles.roomHeader}>
                <div 
                  className={styles.roomColorBadge}
                  style={{ backgroundColor: selectedElement.color }}
                />
                <div>
                  <h4>{selectedElement.linkedRoomData.room}</h4>
                  <p>{selectedElement.linkedRoomData.room_type || 'Classroom'}</p>
                </div>
              </div>

              <div className={styles.roomDetails}>
                <div className={styles.detailItem}>
                  <Users size={16} />
                  <span>Capacity: {selectedElement.linkedRoomData.capacity || 30}</span>
                </div>
                <div className={styles.detailItem}>
                  <Building2 size={16} />
                  <span>Building: {selectedElement.linkedRoomData.building}</span>
                </div>
                <div className={styles.detailItem}>
                  <Layers size={16} />
                  <span>Floor: {selectedElement.linkedRoomData.floor_number || 1}</span>
                </div>
                {selectedElement.linkedRoomData.has_ac && (
                  <div className={styles.detailItem}>
                    <Wind size={16} />
                    <span>Air Conditioned</span>
                  </div>
                )}
                {selectedElement.linkedRoomData.has_projector && (
                  <div className={styles.detailItem}>
                    <Projector size={16} />
                    <span>Has Projector</span>
                  </div>
                )}
                {selectedElement.linkedRoomData.has_wifi && (
                  <div className={styles.detailItem}>
                    <Wifi size={16} />
                    <span>WiFi Available</span>
                  </div>
                )}
              </div>

              {showLiveStatus && (
                <div className={styles.statusSection}>
                  <h5>Current Status</h5>
                  {(() => {
                    const currentClass = getCurrentClass(selectedElement.linkedRoomData!.room)
                    const availability = getRoomAvailability(selectedElement.linkedRoomData!.room)
                    
                    return currentClass ? (
                      <div className={styles.occupiedStatus}>
                        <div className={`${styles.statusBadge} ${styles.occupied}`}>
                          <Clock size={16} /> ⚠ IN USE
                        </div>
                        <div className={styles.classInfo}>
                          <p className={styles.courseCode}>{currentClass.course_code}</p>
                          <p className={styles.section}>{currentClass.section}</p>
                          <p className={styles.time}>{currentClass.schedule_time}</p>
                          {currentClass.teacher_name && (
                            <p className={styles.teacher}>{currentClass.teacher_name}</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className={`${styles.statusBadge} ${styles.available}`}>
                        <CheckCircle size={16} /> ✓ AVAILABLE NOW
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          ) : (
            <div className={styles.noSelection}>
              <Info size={32} />
              <p>Click on a room to view details</p>
            </div>
          )}

          {/* Legend */}
          <div className={styles.legend}>
            <h4>Legend</h4>
            
            {showLiveStatus && (
              <div className={styles.availabilityLegend}>
                <div className={styles.legendItem}>
                  <div className={`${styles.legendDot} ${styles.available}`} />
                  <span>Available</span>
                </div>
                <div className={styles.legendItem}>
                  <div className={`${styles.legendDot} ${styles.occupied}`} />
                  <span>Occupied</span>
                </div>
              </div>
            )}

            <div className={styles.roomTypeLegend}>
              {getLegendItems().map(item => (
                <div key={item.type} className={styles.legendItem}>
                  <div 
                    className={styles.legendColor}
                    style={{ backgroundColor: item.bg }}
                  />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}
