'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  MdAccessTime, MdPeople, MdCheckCircle, MdCancel, MdBusiness,
  MdZoomIn, MdZoomOut, MdFullscreen, MdFullscreenExit, MdExpandMore, MdExpandLess, MdChevronLeft, MdChevronRight,
  MdRefresh, MdInfo, MdMap, MdWarning, MdVisibility, MdMeetingRoom, MdDirectionsWalk,
  MdSwapVert, MdWc, MdLaptop, MdScience, MdLocalLibrary, MdRestaurant,
  MdArchive, MdFitnessCenter, MdMusicNote, MdTheaterComedy, MdCoPresent, MdDns, MdWifi,
  MdAir, MdLocalFireDepartment, MdWaterDrop, MdRadioButtonChecked, MdChangeHistory, MdHexagon, MdStar,
  MdStop, MdFavorite, MdCalendarToday, MdImage, MdClose
} from 'react-icons/md'
import { supabase } from '@/lib/supabaseClient'
import styles from './RoomViewer2D.module.css'

// Untyped supabase helper for tables not in generated types
const db = supabase as any

// Icon mapping
const ICON_MAP: Record<string, any> = {
  exit: MdMeetingRoom,
  stairs: MdDirectionsWalk,
  elevator: MdSwapVert,
  restroom: MdWc,
  computer: MdLaptop,
  lab: MdScience,
  library: MdLocalLibrary,
  cafeteria: MdRestaurant,
  storage: MdArchive,
  gym: MdFitnessCenter,
  music: MdMusicNote,
  theater: MdTheaterComedy,
  presentation: MdCoPresent,
  server: MdDns,
  wifi: MdWifi,
  ac: MdAir,
  fire: MdLocalFireDepartment,
  water: MdWaterDrop,
  info: MdInfo,
  warning: MdWarning,
}

// Shape mapping
const SHAPE_MAP: Record<string, any> = {
  circle: MdRadioButtonChecked,
  triangle: MdChangeHistory,
  hexagon: MdHexagon,
  pentagon: MdStar,
  octagon: MdStop,
  star: MdStar,
  heart: MdFavorite,
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

interface Building {
  id: number
  name: string
  floors: FloorPlan[]
}

interface RoomAllocation {
  id?: number
  room: string
  schedule_day: string
  schedule_time: string
  schedule_id?: number
  course_code?: string
  section?: string
  faculty_name?: string
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
  floor_number: number
  floor_name: string
  canvas_data: any
  canvas_width: number
  canvas_height: number
  is_default_view: boolean
  linked_schedule_id?: number
  is_published?: boolean
}

interface RoomViewer2DProps {
  fullscreen?: boolean
  onToggleFullscreen?: (isFullscreen: boolean) => void
  collegeTheme?: string
  highlightEmpty?: boolean
}

// ... (other interfaces unchanged)

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
    initData()
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

  const initData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Parallel fetch of buildings and floor plans
      await Promise.all([fetchBuildings(), fetchFloorPlans()])
    } catch (err) {
      console.error('Error initializing data:', err)
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const fetchBuildings = async () => {
    try {
      const { data, error } = await supabase
        .from('campuses')
        .select('building')

      if (error) throw error

      // We process unique buildings in fetchFloorPlans logic
      return data
    } catch (err) {
      console.error('Error fetching buildings:', err)
      return []
    }
  }

  const fetchFloorPlans = async () => {
    try {
      // 1. Fetch available building names first
      const { data: campusData, error: campusError } = await supabase
        .from('campuses')
        .select('building')

      const validBuildings = new Set((campusData || []).map((c: any) => c.building).filter(Boolean))

      // 2. Fetch floor plans explicitly selecting columns (no building_id)
      const { data, error: fpError } = await db
        .from('floor_plans')
        .select('id, floor_number, floor_name, canvas_data, is_default_view, is_published, linked_schedule_id')
        .order('floor_number', { ascending: true })

      if (fpError) {
        console.error('Error fetching floor plans:', fpError?.message || JSON.stringify(fpError))
        setHasFloorPlan(false)
        setError('No floor plans available')
        return
      }

      if (!data || data.length === 0) {
        setHasFloorPlan(false)
        setError('No floor plans have been created yet')
        return
      }

      // 3. Filter for published or default items in-memory
      const fps = data.filter((fp: any) => fp.is_published || fp.is_default_view)

      if (fps.length === 0) {
        setHasFloorPlan(false)
        setError('No published floor plans available')
        return
      }

      setHasFloorPlan(true)

      // 4. Group floor plans by building
      const buildingMap: Record<string, Building> = {}

      fps.forEach((fp: any) => {
        // Try to parse building from floor_name "BuildingName - FloorName"
        let buildingName = 'Main Building'
        if (fp.floor_name && fp.floor_name.includes(' - ')) {
          buildingName = fp.floor_name.split(' - ')[0].trim()
        }

        // If the parsed name is a valid building from campuses, use it. 
        // Otherwise, trust the parsed name anyway as fallback.

        if (!buildingMap[buildingName]) {
          buildingMap[buildingName] = {
            id: Object.keys(buildingMap).length + 1, // Artificial ID for frontend keying
            name: buildingName,
            floors: []
          }
        }
        buildingMap[buildingName].floors.push(fp as FloorPlan)
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
      console.error('Error in fetchFloorPlans:', err)
      setError('Failed to load floor plans')
      setHasFloorPlan(false)
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
      const floor = selectedBuilding.floors.find((f: any) => f.id === parseInt(floorPlanId))
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
      onToggleFullscreen(!isFullscreen)
    }
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <MdRefresh className={styles.spinner} size={32} />
        <p>Loading floor plan...</p>
      </div>
    )
  }

  if (!hasFloorPlan || error) {
    return (
      <div className={styles.noFloorPlan}>
        <MdMap size={48} />
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
          <MdMap size={isMobile ? 16 : 20} />
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
              <MdZoomOut size={16} />
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
              <MdZoomIn size={16} />
            </button>
          </div>

          {/* Fullscreen toggle */}
          <button
            onClick={handleToggleFullscreen}
            className={styles.fullscreenBtn}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <MdFullscreenExit size={16} /> : <MdFullscreen size={16} />}
          </button>

          {/* Refresh */}
          <button
            onClick={fetchFloorPlans}
            className={styles.refreshBtn}
            title="Refresh"
          >
            <MdRefresh size={16} />
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
              <MdBusiness size={14} />
              <span>Buildings ({buildings.length})</span>
            </div>
            {buildingNavCollapsed ? <MdExpandMore size={14} /> : <MdExpandLess size={14} />}
          </button>
          {!buildingNavCollapsed && buildings.map((building, buildingIdx) => (
            <div key={`building-${building.name}-${buildingIdx}`} className={styles.buildingSection}>
              {/* Building header row */}
              <div
                className={`${styles.buildingSectionHeader} ${selectedBuilding?.id === building.id ? styles.buildingSectionHeaderActive : ''}`}
                onClick={() => handleBuildingChange(String(building.id))}
              >
                <div className={styles.buildingSectionLeft}>
                  <MdBusiness size={16} />
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
                            {floor.is_default_view && <MdVisibility size={11} className={styles.floorCardDefaultIcon} />}
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
            <MdCheckCircle size={10} className={styles.statusIcon} />
          </div>
          <span>{isMobile ? 'Free' : 'Available / Free'}</span>
        </div>
        <div className={`${styles.legendItem} ${styles.occupiedLegend}`}>
          <div className={`${styles.statusIndicator} ${styles.occupied}`}>
            <MdCancel size={10} className={styles.statusIcon} />
          </div>
          <span>{isMobile ? 'In Use' : 'Occupied / In Use'}</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.liveIndicator}>
            <MdAccessTime size={14} />
          </div>
          <span className={styles.liveText}>Live ({currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
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
                        const IconComp = ICON_MAP[element.iconType || 'info'] || MdInfo
                        return <IconComp size={Math.min(element.width, element.height) * 0.4} />
                      })()}
                      {element.label && <span className={styles.iconLabel}>{element.label}</span>}
                    </div>
                  )}

                  {/* Shape element */}
                  {element.type === 'shape' && (
                    <div className={styles.shapeElement}>
                      {(() => {
                        const ShapeComp = SHAPE_MAP[element.shapeType || 'circle'] || MdRadioButtonChecked
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

      {/* Enhanced Room Details Modal */}
      {selectedElement && selectedElement.type === 'room' && selectedElement.linkedRoomData && (
        <RoomDetailsModal
          room={selectedElement.linkedRoomData}
          availability={getRoomAvailability(selectedElement.linkedRoomData.room)}
          currentClass={getCurrentClass(selectedElement.linkedRoomData.room)}
          roomAllocations={roomAllocations}
          onClose={() => setSelectedElement(null)}
          styles={styles}
        />
      )}
    </div>
  )
}

// Room Details Modal Component with Images and Schedule
interface RoomDetailsModalProps {
  room: Room
  availability: 'available' | 'occupied' | 'unknown'
  currentClass: RoomAllocation | null
  roomAllocations: RoomAllocation[]
  onClose: () => void
  styles: any
}

function RoomDetailsModal({
  room,
  availability,
  currentClass,
  roomAllocations,
  onClose,
  styles
}: RoomDetailsModalProps) {
  const [roomImages, setRoomImages] = useState<any[]>([])
  const [selectedImageIdx, setSelectedImageIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'details' | 'schedule' | 'images'>('details')

  useEffect(() => {
    fetchRoomImages()
  }, [room.id])

  const fetchRoomImages = async () => {
    try {
      setLoading(true)
      const { data, error } = await db
        .from('room_images')
        .select('*')
        .eq('room_id', room.id)
        .order('uploaded_at', { ascending: false })

      if (error) {
        console.error('Error fetching room images:', error)
      } else {
        setRoomImages(data || [])
        setSelectedImageIdx(0)
      }
    } catch (err) {
      console.error('Error in fetchRoomImages:', err)
    } finally {
      setLoading(false)
    }
  }

  const roomSchedules = roomAllocations.filter(a => a.room === room.room)

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Header with close button */}
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.roomTitle}>{room.room}</h2>
            <p className={styles.roomSubtitle}>{room.building}</p>
          </div>
          <button className={styles.closeModalBtn} onClick={onClose}>✕</button>
        </div>

        {/* Status badge */}
        <div className={`${styles.statusBadgeModal} ${styles[availability]}`}>
          {availability === 'available' ? (
            <><MdCheckCircle size={16} /> Available Now</>
          ) : availability === 'occupied' ? (
            <><MdCancel size={16} /> In Use</>
          ) : (
            <><MdAccessTime size={16} /> Status Unknown</>
          )}
        </div>

        {/* Tab navigation */}
        <div className={styles.modalTabs}>
          <button
            className={`${styles.tabBtn} ${activeTab === 'details' ? styles.active : ''}`}
            onClick={() => setActiveTab('details')}
          >
            <MdInfo size={16} />Details
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'schedule' ? styles.active : ''}`}
            onClick={() => setActiveTab('schedule')}
          >
            <MdCalendarToday size={16} />Schedule ({roomSchedules.length})
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'images' ? styles.active : ''}`}
            onClick={() => setActiveTab('images')}
          >
            <MdVisibility size={16} />Photos ({roomImages.length})
          </button>
        </div>

        {/* Content area */}
        <div className={styles.modalBody}>
          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className={styles.detailsTab}>
              <div className={styles.detailsGrid}>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Building</span>
                  <span className={styles.detailValue}>{room.building}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Room Code</span>
                  <span className={styles.detailValue}>{room.room_code || 'N/A'}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Capacity</span>
                  <span className={styles.detailValue}>{room.capacity || 'Unknown'}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Floor</span>
                  <span className={styles.detailValue}>{room.floor_number || 'N/A'}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Type</span>
                  <span className={styles.detailValue}>{room.room_type || 'General'}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Status</span>
                  <span className={`${styles.detailValue} ${styles[availability]}`}>
                    {availability === 'available' ? '🟢 Available' : availability === 'occupied' ? '🔴 Occupied' : '⚪ Unknown'}
                  </span>
                </div>
              </div>

              {currentClass && (
                <div className={styles.currentClassSection}>
                  <h3>Currently in Use</h3>
                  <div className={styles.classInfo}>
                    <div><strong>Course:</strong> {currentClass.course_code}</div>
                    <div><strong>Section:</strong> {currentClass.section}</div>
                    <div><strong>Time:</strong> {currentClass.schedule_time}</div>
                    {currentClass.teacher_name && <div><strong>Teacher:</strong> {currentClass.teacher_name}</div>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Schedule Tab */}
          {activeTab === 'schedule' && (
            <div className={styles.scheduleTab}>
              {roomSchedules.length === 0 ? (
                <div className={styles.emptyState}>
                  <MdCalendarToday size={32} />
                  <p>No scheduled classes</p>
                </div>
              ) : (
                <div className={styles.scheduleList}>
                  {roomSchedules.map((alloc, idx) => (
                    <div key={idx} className={styles.scheduleItem}>
                      <div className={styles.scheduleTime}>
                        <MdAccessTime size={14} />
                        {alloc.schedule_time}
                      </div>
                      <div className={styles.scheduleDetails}>
                        <div className={styles.scheduleCourse}>{alloc.course_code}</div>
                        <div className={styles.scheduleSection}>{alloc.section}</div>
                        <div className={styles.scheduleDay}>{alloc.schedule_day}</div>
                        {alloc.teacher_name && <div className={styles.scheduleTeacher}>{alloc.teacher_name}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Images Tab */}
          {activeTab === 'images' && (
            <div className={styles.imagesTab}>
              {loading ? (
                <div className={styles.emptyState}>
                  <MdRefresh size={32} className={styles.spinner} />
                  <p>Loading images...</p>
                </div>
              ) : roomImages.length === 0 ? (
                <div className={styles.emptyState}>
                  <MdVisibility size={32} />
                  <p>No photos available yet</p>
                </div>
              ) : (
                <div>
                  <div className={styles.imageViewer}>
                    {roomImages[selectedImageIdx] && (
                      <>
                        <img
                          src={roomImages[selectedImageIdx].image_url}
                          alt={`Room ${room.room}`}
                          className={styles.mainImage}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200"%3E%3Crect fill="%23e5e7eb" width="300" height="200"/%3E%3Ctext x="50%25" y="50%25" font-size="16" text-anchor="middle" dy=".3em" fill="%23999"%3EImage not found%3C/text%3E%3C/svg%3E'
                          }}
                        />
                        {roomImages[selectedImageIdx].caption && (
                          <p className={styles.imageCaption}>{roomImages[selectedImageIdx].caption}</p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Image navigation */}
                  {roomImages.length > 1 && (
                    <div className={styles.imageNavigation}>
                      <button
                        className={styles.navBtn}
                        onClick={() => setSelectedImageIdx((prev) => (prev - 1 + roomImages.length) % roomImages.length)}
                        title="Previous"
                      >
                        <MdChevronLeft size={18} />
                      </button>
                      <span className={styles.imageCounter}>
                        {selectedImageIdx + 1} / {roomImages.length}
                      </span>
                      <button
                        className={styles.navBtn}
                        onClick={() => setSelectedImageIdx((prev) => (prev + 1) % roomImages.length)}
                        title="Next"
                      >
                        <MdChevronRight size={18} />
                      </button>
                    </div>
                  )}

                  {/* Thumbnails */}
                  {roomImages.length > 1 && (
                    <div className={styles.imageThumbnails}>
                      {roomImages.map((img, idx) => (
                        <button
                          key={idx}
                          className={`${styles.thumbnail} ${selectedImageIdx === idx ? styles.activeThumbnail : ''}`}
                          onClick={() => setSelectedImageIdx(idx)}
                          title={img.caption || `Photo ${idx + 1}`}
                        >
                          <img src={img.image_url} alt={`Thumbnail ${idx + 1}`} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
