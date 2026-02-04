'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  MapPin, Clock, Users, CheckCircle, XCircle, Building2, Calendar, 
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, Minimize2,
  Loader2, Info, Map, AlertTriangle, Eye, DoorOpen, Footprints,
  ArrowUpDown, Bath, Laptop, Beaker, Library, UtensilsCrossed,
  Archive, Dumbbell, Music, Theater, Presentation, Server, Wifi,
  Wind, Flame, Droplets, CircleDot, Triangle, Hexagon, Pentagon, 
  Octagon, Star, Heart
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import styles from './RoomViewer2D.module.css'

// Untyped supabase helper for tables not in generated types
const db = supabase as any

// Icon mapping
const ICON_MAP: Record<string, any> = {
  exit: DoorOpen,
  stairs: Footprints,
  elevator: ArrowUpDown,
  restroom: Bath,
  computer: Laptop,
  lab: Beaker,
  library: Library,
  cafeteria: UtensilsCrossed,
  storage: Archive,
  gym: Dumbbell,
  music: Music,
  theater: Theater,
  presentation: Presentation,
  server: Server,
  wifi: Wifi,
  ac: Wind,
  fire: Flame,
  water: Droplets,
  info: Info,
  warning: AlertTriangle,
}

// Shape mapping
const SHAPE_MAP: Record<string, any> = {
  circle: CircleDot,
  triangle: Triangle,
  hexagon: Hexagon,
  pentagon: Pentagon,
  octagon: Octagon,
  star: Star,
  heart: Heart,
}

interface Room {
  id: number
  room: string
  room_code?: string
  building: string
  capacity: number
  floor_number?: number
  room_type?: string
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

interface Building {
  id: number
  name: string
  floors: FloorPlan[]
}

interface RoomViewer2DProps {
  fullscreen?: boolean
  onToggleFullscreen?: () => void
  collegeTheme?: 'science' | 'arts-letters' | 'architecture' | 'default'
}

export default function RoomViewer2D({ fullscreen = false, onToggleFullscreen, collegeTheme = 'default' }: RoomViewer2DProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  
  const [loading, setLoading] = useState(true)
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null)
  const [selectedFloor, setSelectedFloor] = useState<FloorPlan | null>(null)
  const [currentFloorPlan, setCurrentFloorPlan] = useState<FloorPlan | null>(null)
  const [canvasElements, setCanvasElements] = useState<CanvasElement[]>([])
  const [roomAllocations, setRoomAllocations] = useState<RoomAllocation[]>([])
  const [selectedElement, setSelectedElement] = useState<CanvasElement | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isMobile, setIsMobile] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [zoom, setZoom] = useState(fullscreen ? 70 : 45)
  const [canvasSize, setCanvasSize] = useState({ width: 1600, height: 1000 })
  const [error, setError] = useState<string | null>(null)
  const [hasFloorPlan, setHasFloorPlan] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(fullscreen)

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
      // Adjust zoom for mobile
      if (window.innerWidth < 768) {
        setZoom(35)
      } else if (window.innerWidth < 1024) {
        setZoom(45)
      }
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  // Fetch floor plans on mount
  useEffect(() => {
    fetchFloorPlans()
  }, [])

  // Update zoom when fullscreen changes
  useEffect(() => {
    setZoom(isFullscreen ? 70 : 45)
  }, [isFullscreen])

  const fetchFloorPlans = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch all published/default floor plans with building info
      const { data: fps, error: fpError } = await db
        .from('floor_plans')
        .select('*, buildings(id, name)')
        .or('is_default_view.eq.true,is_published.eq.true')
        .order('building_id', { ascending: true })
        .order('floor_number', { ascending: true })

      if (fpError) {
        console.error('Error fetching floor plans:', fpError)
        setHasFloorPlan(false)
        setError('No floor plans available')
        return
      }

      if (!fps || fps.length === 0) {
        setHasFloorPlan(false)
        setError('No floor plans have been created yet')
        return
      }

      setFloorPlans(fps as FloorPlan[])
      setHasFloorPlan(true)

      // Group floor plans by building
      const buildingMap: Record<number, Building> = {}
      
      fps.forEach((fp: any) => {
        const buildingId = fp.building_id || 0
        const buildingName = fp.buildings?.name || `Building ${buildingId}`
        
        if (!buildingMap[buildingId]) {
          buildingMap[buildingId] = {
            id: buildingId,
            name: buildingName,
            floors: []
          }
        }
        buildingMap[buildingId].floors.push(fp as FloorPlan)
      })

      const buildingList: Building[] = Object.values(buildingMap)
      setBuildings(buildingList)

      // Auto-select first building and its first floor
      if (buildingList.length > 0) {
        const firstBuilding = buildingList[0]
        setSelectedBuilding(firstBuilding)
        
        if (firstBuilding.floors.length > 0) {
          const defaultFloor = firstBuilding.floors.find((f: FloorPlan) => f.is_default_view) || firstBuilding.floors[0]
          setSelectedFloor(defaultFloor)
          loadFloorPlan(defaultFloor)
        }
      }

    } catch (err) {
      console.error('Error:', err)
      setError('Failed to load floor plans')
      setHasFloorPlan(false)
    } finally {
      setLoading(false)
    }
  }

  const handleBuildingChange = (buildingId: string) => {
    const building = buildings.find(b => b.id === parseInt(buildingId))
    if (building) {
      setSelectedBuilding(building)
      // Auto-select first floor of new building
      if (building.floors.length > 0) {
        const firstFloor = building.floors[0]
        setSelectedFloor(firstFloor)
        loadFloorPlan(firstFloor)
      }
    }
  }

  const handleFloorChange = (floorPlanId: string) => {
    if (selectedBuilding) {
      const floor = selectedBuilding.floors.find(f => f.id === parseInt(floorPlanId))
      if (floor) {
        setSelectedFloor(floor)
        loadFloorPlan(floor)
      }
    }
  }

  const loadFloorPlan = async (floorPlan: FloorPlan) => {
    setCurrentFloorPlan(floorPlan)

    if (floorPlan.canvas_data?.elements) {
      setCanvasElements(floorPlan.canvas_data.elements)
    } else {
      setCanvasElements([])
    }
    
    if (floorPlan.canvas_data?.canvasSize) {
      setCanvasSize(floorPlan.canvas_data.canvasSize)
    }

    // Fetch room allocations if linked to a schedule
    if (floorPlan.linked_schedule_id) {
      const { data: allocations } = await supabase
        .from('room_allocations')
        .select('*')
        .eq('schedule_id', floorPlan.linked_schedule_id)

      setRoomAllocations(allocations || [])
    } else {
      // Try to get the most recent schedule's allocations
      const { data: schedules } = await db
        .from('generated_schedules')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)

      if (schedules && schedules.length > 0) {
        const { data: allocations } = await supabase
          .from('room_allocations')
          .select('*')
          .eq('schedule_id', schedules[0].id)

        setRoomAllocations(allocations || [])
      }
    }
  }

  // Get room color
  const getRoomColor = (roomType?: string) => {
    const type = roomType?.toLowerCase().replace(/\s+/g, '_') || 'default'
    return ROOM_TYPE_COLORS[type] || ROOM_TYPE_COLORS.default
  }

  // Get room availability
  const getRoomAvailability = (roomName: string): 'available' | 'occupied' | 'unknown' => {
    if (roomAllocations.length === 0) return 'unknown'

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

  const handleToggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
    if (onToggleFullscreen) {
      onToggleFullscreen()
    }
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <Loader2 className={styles.spinner} size={32} />
        <p>Loading floor plan...</p>
      </div>
    )
  }

  if (!hasFloorPlan || error) {
    return (
      <div className={styles.noFloorPlan}>
        <Map size={48} />
        <h3>No Floor Plan Available</h3>
        <p>{error || 'The admin has not created a floor plan yet.'}</p>
        <p className={styles.hint}>Floor plans will appear here once they are created and published by the admin.</p>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      className={`${styles.container} ${isFullscreen ? styles.fullscreen : ''} ${isMobile ? styles.mobileView : ''}`}
      data-college-theme={collegeTheme}
    >
      {/* Compact Header for Mobile */}
      <div className={`${styles.header} ${isMobile && !showControls ? styles.headerCollapsed : ''}`}>
        <div className={styles.headerLeft}>
          <Map size={isMobile ? 16 : 20} />
          <h2>{isMobile ? 'Floor Plan' : 'Campus Floor Plan'}</h2>
          {isMobile && (
            <button 
              className={styles.toggleControlsBtn}
              onClick={() => setShowControls(!showControls)}
              title={showControls ? 'Hide controls' : 'Show controls'}
            >
              {showControls ? '−' : '+'}
            </button>
          )}
        </div>
        
        <div className={`${styles.controls} ${isMobile && !showControls ? styles.controlsHidden : ''}`}>
          {/* Building selector */}
          {buildings.length > 0 && (
            <div className={styles.selector}>
              <Building2 size={16} />
              <select
                value={selectedBuilding?.id || ''}
                onChange={(e) => handleBuildingChange(e.target.value)}
                className={styles.selectDropdown}
                aria-label="Select building"
              >
                {buildings.map(building => (
                  <option key={building.id} value={building.id}>
                    {building.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Floor selector */}
          {selectedBuilding && selectedBuilding.floors.length > 0 && (
            <div className={styles.selector}>
              <Map size={16} />
              <select
                value={selectedFloor?.id || ''}
                onChange={(e) => handleFloorChange(e.target.value)}
                className={styles.selectDropdown}
                aria-label="Select floor"
              >
                {selectedBuilding.floors.map(floor => (
                  <option key={floor.id} value={floor.id}>
                    {floor.floor_name || `Floor ${floor.floor_number}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Zoom controls */}
          <div className={styles.zoomControls}>
            <button
              onClick={() => setZoom(Math.max(20, zoom - 10))}
              className={styles.zoomBtn}
              title="Zoom out"
            >
              <ZoomOut size={16} />
            </button>
            <span className={styles.zoomLevel}>{zoom}%</span>
            <button
              onClick={() => setZoom(Math.min(150, zoom + 10))}
              className={styles.zoomBtn}
              title="Zoom in"
            >
              <ZoomIn size={16} />
            </button>
          </div>

          {/* Fullscreen toggle */}
          <button
            onClick={handleToggleFullscreen}
            className={styles.fullscreenBtn}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          {/* Refresh */}
          <button
            onClick={fetchFloorPlans}
            className={styles.refreshBtn}
            title="Refresh"
          >
            <Clock size={16} />
          </button>
        </div>
      </div>

      {/* Legend - Enhanced visibility */}
      <div className={`${styles.legend} ${isMobile ? styles.legendCompact : ''}`}>
        <div className={`${styles.legendItem} ${styles.availableLegend}`}>
          <div className={`${styles.statusIndicator} ${styles.available}`}>
            <CheckCircle size={10} className={styles.statusIcon} />
          </div>
          <span>{isMobile ? 'Free' : 'Available / Free'}</span>
        </div>
        <div className={`${styles.legendItem} ${styles.occupiedLegend}`}>
          <div className={`${styles.statusIndicator} ${styles.occupied}`}>
            <XCircle size={10} className={styles.statusIcon} />
          </div>
          <span>{isMobile ? 'In Use' : 'Occupied / In Use'}</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.liveIndicator}>
            <Clock size={14} />
          </div>
          <span className={styles.liveText}>Live ({currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})</span>
        </div>
      </div>

      {/* Mobile hint */}
      {isMobile && (
        <div className={styles.mobileHint}>
          <span>👆 Drag to pan • Pinch to zoom • Tap room for details</span>
        </div>
      )}

      {/* Canvas Area - Touch optimized */}
      <div ref={wrapperRef} className={`${styles.canvasWrapper} ${isMobile ? styles.canvasWrapperMobile : ''}`}>
        <div
          ref={canvasRef}
          className={styles.canvas}
          style={{
            width: canvasSize.width,
            height: canvasSize.height,
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top left'
          }}
        >
          {/* Render canvas elements */}
          {canvasElements
            .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
            .map(element => {
              const isRoom = element.type === 'room'
              const availability = isRoom && element.linkedRoomData 
                ? getRoomAvailability(element.linkedRoomData.room) 
                : 'unknown'
              const currentClass = isRoom && element.linkedRoomData 
                ? getCurrentClass(element.linkedRoomData.room) 
                : null
              const isSelected = selectedElement?.id === element.id

              return (
                <div
                  key={element.id}
                  className={`${styles.canvasElement} ${styles[element.type]} ${isSelected ? styles.selected : ''}`}
                  style={{
                    position: 'absolute',
                    left: element.x,
                    top: element.y,
                    width: element.width,
                    height: element.height,
                    backgroundColor: element.color || '#e5e7eb',
                    borderColor: element.borderColor || '#9ca3af',
                    transform: element.rotation ? `rotate(${element.rotation}deg)` : 'none',
                    zIndex: element.zIndex || 1
                  }}
                  onClick={() => setSelectedElement(isSelected ? null : element)}
                  title={element.label || ''}
                >
                  {/* Room content */}
                  {isRoom && (
                    <>
                      {/* Availability indicator */}
                      <div className={`${styles.availabilityDot} ${styles[availability]}`} />
                      
                      {/* Room label */}
                      <div className={styles.roomLabel}>{element.label}</div>
                      
                      {/* Current class info on hover/selection */}
                      {currentClass && (
                        <div className={styles.classInfo}>
                          <div className={styles.courseCode}>{currentClass.course_code}</div>
                          <div className={styles.section}>{currentClass.section}</div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Icon element */}
                  {element.type === 'icon' && (
                    <div className={styles.iconElement}>
                      {(() => {
                        const IconComp = ICON_MAP[element.iconType || 'info'] || Info
                        return <IconComp size={Math.min(element.width, element.height) * 0.4} />
                      })()}
                      {element.label && <span className={styles.iconLabel}>{element.label}</span>}
                    </div>
                  )}

                  {/* Shape element */}
                  {element.type === 'shape' && (
                    <div className={styles.shapeElement}>
                      {(() => {
                        const ShapeComp = SHAPE_MAP[element.shapeType || 'circle'] || CircleDot
                        return <ShapeComp size={Math.min(element.width, element.height) * 0.7} />
                      })()}
                    </div>
                  )}

                  {/* Text label for non-room elements */}
                  {element.type === 'text' && (
                    <span style={{ fontSize: element.fontSize || 14 }}>{element.label}</span>
                  )}

                  {/* Hallway/Door/Wall labels */}
                  {(element.type === 'hallway' || element.type === 'door' || element.type === 'stair') && element.label && (
                    <span className={styles.elementLabel}>{element.label}</span>
                  )}
                </div>
              )
            })}
        </div>
      </div>

      {/* Room details popup */}
      {selectedElement && selectedElement.type === 'room' && selectedElement.linkedRoomData && (
        <div className={styles.roomDetails}>
          <div className={styles.detailsHeader}>
            <h3>{selectedElement.label}</h3>
            <button onClick={() => setSelectedElement(null)} className={styles.closeBtn}>×</button>
          </div>
          <div className={styles.detailsBody}>
            <div className={styles.detailRow}>
              <Building2 size={14} />
              <span>{selectedElement.linkedRoomData.building}</span>
            </div>
            {selectedElement.linkedRoomData.capacity && (
              <div className={styles.detailRow}>
                <Users size={14} />
                <span>Capacity: {selectedElement.linkedRoomData.capacity}</span>
              </div>
            )}
            
            {/* Enhanced Status Badge */}
            <div className={`${styles.statusBadge} ${
              getRoomAvailability(selectedElement.linkedRoomData.room) === 'available' 
                ? styles.statusAvailable 
                : getRoomAvailability(selectedElement.linkedRoomData.room) === 'occupied' 
                  ? styles.statusOccupied 
                  : styles.statusUnknown
            }`}>
              {getRoomAvailability(selectedElement.linkedRoomData.room) === 'available' ? (
                <>
                  <CheckCircle size={18} />
                  <span>✓ AVAILABLE NOW</span>
                </>
              ) : getRoomAvailability(selectedElement.linkedRoomData.room) === 'occupied' ? (
                <>
                  <XCircle size={18} />
                  <span>⚠ IN USE</span>
                </>
              ) : (
                <>
                  <Info size={18} />
                  <span>Status Unknown</span>
                </>
              )}
            </div>
            
            {getCurrentClass(selectedElement.linkedRoomData.room) && (
              <div className={styles.currentClassDetails}>
                <h4>Current Class</h4>
                <p><strong>{getCurrentClass(selectedElement.linkedRoomData.room)?.course_code}</strong></p>
                <p>{getCurrentClass(selectedElement.linkedRoomData.room)?.section}</p>
                <p>{getCurrentClass(selectedElement.linkedRoomData.room)?.schedule_time}</p>
                {getCurrentClass(selectedElement.linkedRoomData.room)?.teacher_name && (
                  <p>{getCurrentClass(selectedElement.linkedRoomData.room)?.teacher_name}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
