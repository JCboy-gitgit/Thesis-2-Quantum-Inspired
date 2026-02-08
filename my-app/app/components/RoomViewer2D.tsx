'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  Clock, Users, CheckCircle, XCircle, Building2, 
  ZoomIn, ZoomOut, Maximize2, Minimize2, ChevronDown, ChevronUp,
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

interface Building {
  id: number
  name: string
  floors: FloorPlan[]
}

interface RoomViewer2DProps {
  fullscreen?: boolean
  onToggleFullscreen?: () => void
  collegeTheme?: 'science' | 'arts-letters' | 'architecture' | 'default'
  highlightEmpty?: boolean
}

export default function RoomViewer2D({ fullscreen = false, onToggleFullscreen, collegeTheme = 'default', highlightEmpty = false }: RoomViewer2DProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  
  const [loading, setLoading] = useState(true)
  const [buildings, setBuildings] = useState<Building[]>([])
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null)
  const [selectedFloor, setSelectedFloor] = useState<FloorPlan | null>(null)
  const [canvasElements, setCanvasElements] = useState<CanvasElement[]>([])
  const [roomAllocations, setRoomAllocations] = useState<RoomAllocation[]>([])
  const [selectedElement, setSelectedElement] = useState<CanvasElement | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isMobile, setIsMobile] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [zoom, setZoom] = useState(fullscreen ? 100 : 100)
  const [zoomInput, setZoomInput] = useState('100')
  const [canvasSize, setCanvasSize] = useState({ width: 1600, height: 1000 })
  const [error, setError] = useState<string | null>(null)
  const [hasFloorPlan, setHasFloorPlan] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(fullscreen)
  const [buildingNavCollapsed, setBuildingNavCollapsed] = useState(false)

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
      // Adjust zoom for mobile - keep 100% as base
      if (window.innerWidth < 768) {
        setZoom(70)
        setZoomInput('70')
      } else {
        setZoom(100)
        setZoomInput('100')
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
    const newZoom = isFullscreen ? 100 : 100
    setZoom(newZoom)
    setZoomInput(String(newZoom))
  }, [isFullscreen])

  // Sync zoomInput with zoom
  useEffect(() => {
    setZoomInput(String(zoom))
  }, [zoom])

  // Handle manual zoom input
  const handleZoomInputChange = (value: string) => {
    setZoomInput(value)
  }

  const handleZoomInputBlur = () => {
    const numValue = parseInt(zoomInput, 10)
    if (!isNaN(numValue) && numValue >= 10 && numValue <= 300) {
      setZoom(numValue)
    } else {
      setZoomInput(String(zoom))
    }
  }

  const handleZoomInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleZoomInputBlur()
    }
  }

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

      setHasFloorPlan(true)

      // Group floor plans by building name parsed from floor_name
      // This matches the admin's "Floor Plans & Drafts" grouping logic,
      // which splits floor_name on " - " to get the building prefix.
      const buildingMap: Record<string, Building> = {}
      
      fps.forEach((fp: any) => {
        const parts = fp.floor_name?.split(' - ')
        const buildingKey = parts && parts.length > 1 ? parts[0].trim() : (fp.buildings?.name || `Building ${fp.building_id || 0}`)
        const buildingId = fp.building_id || 0
        
        if (!buildingMap[buildingKey]) {
          buildingMap[buildingKey] = {
            id: buildingId,
            name: buildingKey,
            floors: []
          }
        }
        buildingMap[buildingKey].floors.push(fp as FloorPlan)
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
    if (!building) return
    
    // Toggle: clicking the same building collapses it
    if (selectedBuilding?.id === building.id) {
      setSelectedBuilding(null)
      return
    }
    
    setSelectedBuilding(building)
    // Auto-select first floor of new building
    if (building.floors.length > 0) {
      const firstFloor = building.floors[0]
      setSelectedFloor(firstFloor)
      loadFloorPlan(firstFloor)
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
        .order('is_current', { ascending: false })
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
          {/* Zoom controls */}
          <div className={styles.zoomControls}>
            <button
              onClick={() => setZoom(Math.max(10, zoom - 10))}
              className={styles.zoomBtn}
              title="Zoom out"
            >
              <ZoomOut size={16} />
            </button>
            <input
              type="text"
              value={zoomInput}
              onChange={(e) => handleZoomInputChange(e.target.value)}
              onBlur={handleZoomInputBlur}
              onKeyDown={handleZoomInputKeyDown}
              className={styles.zoomInput}
              title="Enter zoom percentage (10-300)"
              aria-label="Zoom percentage"
            />
            <span className={styles.zoomPercent}>%</span>
            <button
              onClick={() => setZoom(Math.min(300, zoom + 10))}
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

      {/* Building & Floor Navigator — Collapsible */}
      {buildings.length > 0 && (
        <div className={`${styles.buildingNav} ${buildingNavCollapsed ? styles.buildingNavCollapsed : ''}`}>
          <button
            className={styles.buildingNavToggle}
            onClick={() => setBuildingNavCollapsed(!buildingNavCollapsed)}
          >
            <div className={styles.buildingNavToggleLeft}>
              <Building2 size={14} />
              <span>Buildings ({buildings.length})</span>
            </div>
            {buildingNavCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          {!buildingNavCollapsed && buildings.map((building, buildingIdx) => (
            <div key={`building-${building.name}-${buildingIdx}`} className={styles.buildingSection}>
              {/* Building header row */}
              <div
                className={`${styles.buildingSectionHeader} ${selectedBuilding?.id === building.id ? styles.buildingSectionHeaderActive : ''}`}
                onClick={() => handleBuildingChange(String(building.id))}
              >
                <div className={styles.buildingSectionLeft}>
                  <Building2 size={16} />
                  <span className={styles.buildingSectionName}>{building.name}</span>
                </div>
                <span className={styles.buildingSectionCount}>
                  {building.floors.length} {building.floors.length === 1 ? 'plan' : 'plans'}
                </span>
              </div>

              {/* Floor cards — shown when building is selected */}
              {selectedBuilding?.id === building.id && building.floors.length > 0 && (
                <div className={styles.floorCardList}>
                  {building.floors.map(floor => {
                    const shortName = floor.floor_name
                      ? floor.floor_name.replace(new RegExp(`^${building.name}\\s*[-–]\\s*`, 'i'), '')
                      : `Floor ${floor.floor_number}`
                    const isActive = selectedFloor?.id === floor.id

                    return (
                      <button
                        key={floor.id}
                        className={`${styles.floorCard} ${isActive ? styles.floorCardActive : ''}`}
                        onClick={() => handleFloorChange(String(floor.id))}
                        title={floor.floor_name || `Floor ${floor.floor_number}`}
                      >
                        <div className={styles.floorCardInfo}>
                          <span className={styles.floorCardName}>
                            {shortName}
                            {floor.is_default_view && <Eye size={11} className={styles.floorCardDefaultIcon} />}
                          </span>
                          <span className={styles.floorCardMeta}>
                            Floor {floor.floor_number}
                            {floor.is_default_view ? ' · Published' : ''}
                          </span>
                        </div>
                        <span className={`${styles.floorCardBadge} ${floor.is_default_view ? styles.floorCardBadgePublished : styles.floorCardBadgeDraft}`}>
                          {floor.is_default_view ? 'Published' : 'Draft'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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
                    zIndex: element.zIndex || 1,
                    opacity: highlightEmpty && availability === 'occupied' ? 0.25 : 1
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
