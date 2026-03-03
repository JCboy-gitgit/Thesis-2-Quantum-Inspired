'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  MdAccessTime, MdPeople, MdCheckCircle, MdCancel, MdBusiness,
  MdZoomIn, MdZoomOut, MdFullscreen, MdFullscreenExit, MdExpandMore, MdExpandLess, MdChevronLeft, MdChevronRight,
  MdRefresh, MdInfo, MdMap, MdWarning, MdVisibility, MdMeetingRoom, MdDirectionsWalk,
  MdSwapVert, MdWc, MdMan, MdWoman, MdLaptop, MdScience, MdLocalLibrary, MdRestaurant,
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
  men_room: MdMan,
  women_room: MdWoman,
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
  textColor?: string
  iconColor?: string
  opacity?: number
  textBackgroundOpacity?: number
  borderWidth?: number
  borderStyle?: 'solid' | 'dashed' | 'dotted'
  textAlign?: 'left' | 'center' | 'right'
  fontWeight?: 'normal' | 'bold'
  orientation?: 'horizontal' | 'vertical'
  isLocked?: boolean
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

// Helper: convert hex/rgb/named color to r,g,b
function hexToRgb(color: string): { r: number; g: number; b: number } {
  if (!color) return { r: 0, g: 0, b: 0 }
  let hex = color.replace('#', '')
  // Handle rgb()/rgba()
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (rgbMatch) return { r: parseInt(rgbMatch[1]), g: parseInt(rgbMatch[2]), b: parseInt(rgbMatch[3]) }
  // Handle shorthand hex
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2]
  if (hex.length !== 6) return { r: 0, g: 0, b: 0 }
  return { r: parseInt(hex.slice(0,2),16), g: parseInt(hex.slice(2,4),16), b: parseInt(hex.slice(4,6),16) }
}

// Helper: get readable text color based on background
function getContrastColor(bgColor: string): string {
  const { r, g, b } = hexToRgb(bgColor)
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000
  return yiq >= 128 ? '#1e293b' : '#ffffff'
}

function isTransparentColor(value?: string): boolean {
  if (!value) return true
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '')
  return (
    normalized === 'transparent' ||
    normalized === '#0000' ||
    normalized === '#00000000' ||
    normalized === 'rgba(0,0,0,0)' ||
    normalized === 'hsla(0,0%,0%,0)'
  )
}

function applyAlphaToColor(color: string, alpha: number): string {
  const { r, g, b } = hexToRgb(color)
  const a = Math.max(0, Math.min(1, alpha))
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

function resolveElementTextColor(element: CanvasElement, fallbackBackground: string = '#e5e7eb'): string {
  const explicitTextColor = element.textColor
  if (explicitTextColor && !isTransparentColor(explicitTextColor)) {
    return explicitTextColor
  }

  if (element.type === 'text') {
    const textBgOpacity = element.textBackgroundOpacity ?? (!isTransparentColor(element.color) ? 35 : 0)
    if (textBgOpacity > 0 && element.color && !isTransparentColor(element.color)) {
      return getContrastColor(element.color)
    }
    return '#1f2937'
  }

  const bg = !isTransparentColor(element.color) ? element.color : fallbackBackground
  return getContrastColor(bg)
}

// Helper: normalize opacity 0-100 to 0-1
function normalizeOpacity(value?: number): number {
  if (value === undefined || value === null) return 1
  if (value > 1) return value / 100
  return value
}

function toFiniteNumber(value: unknown, fallback: number): number {
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  const numericValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
}

function pickFirstFiniteNumber(values: unknown[], fallback: number): number {
  for (const value of values) {
    if (value === undefined || value === null) {
      continue
    }
    const parsed = toFiniteNumber(value, Number.NaN)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return fallback
}

export default function RoomViewer2D({ fullscreen = false, onToggleFullscreen, collegeTheme = 'default', highlightEmpty = false }: RoomViewer2DProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const panDragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startScrollLeft: 0,
    startScrollTop: 0,
    moved: false,
  })
  const suppressNextElementClickRef = useRef(false)

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
  const [canvasBackground, setCanvasBackground] = useState('#ffffff')
  const [error, setError] = useState<string | null>(null)
  const [hasFloorPlan, setHasFloorPlan] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(fullscreen)
  const [buildingNavCollapsed, setBuildingNavCollapsed] = useState(false)

  const notifyFullscreenChange = (nextValue: boolean) => {
    if (onToggleFullscreen) {
      onToggleFullscreen(nextValue)
    }
  }

  const sortedCanvasElements = useMemo(
    () => [...canvasElements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)),
    [canvasElements]
  )

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

  useEffect(() => {
    const handleFullscreenChange = () => {
      const container = containerRef.current
      const nextIsFullscreen = !!container && document.fullscreenElement === container
      setIsFullscreen(nextIsFullscreen)
      notifyFullscreenChange(nextIsFullscreen)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

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
      let floorPlansResponse = await db
        .from('floor_plans')
        .select('id, floor_number, floor_name, canvas_data, canvas_width, canvas_height, is_default_view, is_published, linked_schedule_id')
        .order('floor_number', { ascending: true })

      if (floorPlansResponse.error) {
        floorPlansResponse = await db
          .from('floor_plans')
          .select('id, floor_number, floor_name, canvas_data, is_default_view, is_published, linked_schedule_id')
          .order('floor_number', { ascending: true })
      }

      const { data, error: fpError } = floorPlansResponse

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

    const hasColumnCanvasSize =
      Number.isFinite(Number(floorPlan.canvas_width)) && Number(floorPlan.canvas_width) > 0 &&
      Number.isFinite(Number(floorPlan.canvas_height)) && Number(floorPlan.canvas_height) > 0

    const hasDataCanvasSize =
      Number.isFinite(Number(floorPlan.canvas_data?.canvasSize?.width)) && Number(floorPlan.canvas_data?.canvasSize?.width) > 0 &&
      Number.isFinite(Number(floorPlan.canvas_data?.canvasSize?.height)) && Number(floorPlan.canvas_data?.canvasSize?.height) > 0

    const resolvedCanvasSize = hasColumnCanvasSize
      ? {
        width: toFiniteNumber(floorPlan.canvas_width, 1056),
        height: toFiniteNumber(floorPlan.canvas_height, 816)
      }
      : hasDataCanvasSize
        ? {
          width: toFiniteNumber(floorPlan.canvas_data.canvasSize.width, 1056),
          height: toFiniteNumber(floorPlan.canvas_data.canvasSize.height, 816)
        }
        : {
          width: 1056,
          height: 816
        }

    const sourceCanvasSize = hasDataCanvasSize
      ? {
        width: toFiniteNumber(floorPlan.canvas_data.canvasSize.width, resolvedCanvasSize.width),
        height: toFiniteNumber(floorPlan.canvas_data.canvasSize.height, resolvedCanvasSize.height)
      }
      : resolvedCanvasSize

    const scaleX = sourceCanvasSize.width > 0 ? (resolvedCanvasSize.width / sourceCanvasSize.width) : 1
    const scaleY = sourceCanvasSize.height > 0 ? (resolvedCanvasSize.height / sourceCanvasSize.height) : 1

    if (floorPlan.canvas_data?.elements) {
      const normalizedElements: CanvasElement[] = floorPlan.canvas_data.elements.map((el: any, index: number) => {
        const sourceX = pickFirstFiniteNumber([el.x, el.left, el.style?.x, el.style?.left], 0)
        const sourceY = pickFirstFiniteNumber([el.y, el.top, el.style?.y, el.style?.top], 0)
        const sourceWidth = pickFirstFiniteNumber([el.width, el.w, el.style?.width], 100)
        const sourceHeight = pickFirstFiniteNumber([el.height, el.h, el.style?.height], 60)

        const baseElement: CanvasElement = {
          ...el,
          x: sourceX * scaleX,
          y: sourceY * scaleY,
          width: sourceWidth * scaleX,
          height: sourceHeight * scaleY,
          rotation: toFiniteNumber(el.rotation, 0),
          zIndex: toFiniteNumber(el.zIndex, index + 1),
          opacity: el.opacity != null ? toFiniteNumber(el.opacity, 100) : 100,
          textBackgroundOpacity: el.textBackgroundOpacity != null
            ? toFiniteNumber(el.textBackgroundOpacity, 0)
            : (el.text_background_opacity != null ? toFiniteNumber(el.text_background_opacity, 0) : undefined),
          borderWidth: el.borderWidth != null ? toFiniteNumber(el.borderWidth, 2) : 2,
          color: el.color || el.fillColor || el.fill_color,
          borderColor: el.borderColor || el.border_color,
          textColor: el.textColor || el.text_color || el.fontColor || el.font_color,
          iconColor: el.iconColor || el.icon_color,
          fontSize: el.fontSize != null ? toFiniteNumber(el.fontSize, 14) : (el.font_size != null ? toFiniteNumber(el.font_size, 14) : undefined),
          borderStyle: el.borderStyle || el.border_style || 'solid',
          iconType: el.iconType || el.icon || '',
          orientation: el.orientation || el.direction || (el.isVertical ? 'vertical' : 'horizontal'),
        }

        return baseElement
      })
      setCanvasElements(normalizedElements)
    } else {
      setCanvasElements([])
    }

    setCanvasSize(resolvedCanvasSize)

    // Load saved background color (editor saves it in canvas_data.backgroundColor)
    if (floorPlan.canvas_data?.backgroundColor) {
      setCanvasBackground(floorPlan.canvas_data.backgroundColor)
    } else if (floorPlan.background_color) {
      setCanvasBackground(floorPlan.background_color)
    } else {
      setCanvasBackground('#ffffff')
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
      let schedulesResponse = await db
        .from('generated_schedules')
        .select('id')
        .order('is_current', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)

      if (schedulesResponse.error) {
        schedulesResponse = await db
          .from('generated_schedules')
          .select('id')
          .order('created_at', { ascending: false })
          .limit(1)
      }

      const { data: schedules } = schedulesResponse

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

  const handleToggleFullscreen = async () => {
    const container = containerRef.current
    if (!container) return

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen()
      } else if (document.fullscreenElement === container) {
        await document.exitFullscreen()
      }
    } catch (error) {
      const fallbackNext = !isFullscreen
      setIsFullscreen(fallbackNext)
      notifyFullscreenChange(fallbackNext)
      console.error('Fullscreen API failed, using CSS fallback:', error)
    }
  }

  const beginPanDrag = (clientX: number, clientY: number) => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    panDragRef.current = {
      active: true,
      startX: clientX,
      startY: clientY,
      startScrollLeft: wrapper.scrollLeft,
      startScrollTop: wrapper.scrollTop,
      moved: false,
    }
  }

  const updatePanDrag = (clientX: number, clientY: number) => {
    const wrapper = wrapperRef.current
    if (!wrapper || !panDragRef.current.active) return

    const deltaX = clientX - panDragRef.current.startX
    const deltaY = clientY - panDragRef.current.startY

    wrapper.scrollLeft = panDragRef.current.startScrollLeft - deltaX
    wrapper.scrollTop = panDragRef.current.startScrollTop - deltaY

    if (!panDragRef.current.moved && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
      panDragRef.current.moved = true
    }
  }

  const endPanDrag = () => {
    if (!panDragRef.current.active) return

    if (panDragRef.current.moved) {
      suppressNextElementClickRef.current = true
      window.setTimeout(() => {
        suppressNextElementClickRef.current = false
      }, 0)
    }

    panDragRef.current.active = false
  }

  const handleWrapperMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const target = event.target as HTMLElement
    if (target.closest(`.${styles.canvasElement}`)) return

    beginPanDrag(event.clientX, event.clientY)
    event.preventDefault()
  }

  const handleWrapperTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) return
    const target = event.target as HTMLElement
    if (target.closest(`.${styles.canvasElement}`)) return

    const touch = event.touches[0]
    beginPanDrag(touch.clientX, touch.clientY)
  }

  const handleWrapperTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!panDragRef.current.active || event.touches.length !== 1) return

    const touch = event.touches[0]
    updatePanDrag(touch.clientX, touch.clientY)
    event.preventDefault()
  }

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!panDragRef.current.active) return
      updatePanDrag(event.clientX, event.clientY)
    }

    const handleMouseUp = () => {
      endPanDrag()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

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
      <div
        ref={wrapperRef}
        className={`${styles.canvasWrapper} ${isMobile ? styles.canvasWrapperMobile : ''}`}
        onMouseDown={handleWrapperMouseDown}
        onTouchStart={handleWrapperTouchStart}
        onTouchMove={handleWrapperTouchMove}
        onTouchEnd={endPanDrag}
      >
        {/* Scale wrapper — sized to the visual (scaled) canvas so scroll area matches */}
        <div
          className={styles.canvasScaleWrapper}
          style={{
            width: canvasSize.width * (zoom / 100),
            height: canvasSize.height * (zoom / 100)
          }}
        >
        <div
          ref={canvasRef}
          className={styles.canvas}
          style={{
            width: canvasSize.width,
            height: canvasSize.height,
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top left',
            backgroundColor: canvasBackground
          }}
        >
          {/* Render canvas elements */}
          {sortedCanvasElements
            .map(element => {
              const isRoom = element.type === 'room'
              const availability = isRoom && element.linkedRoomData
                ? getRoomAvailability(element.linkedRoomData.room)
                : 'unknown'
              const currentClass = isRoom && element.linkedRoomData
                ? getCurrentClass(element.linkedRoomData.room)
                : null
              const isSelected = selectedElement?.id === element.id

              const textBgOpacity = element.textBackgroundOpacity ?? (!isTransparentColor(element.color) ? 35 : 0)
              const textHasBackground = textBgOpacity > 0 && !isTransparentColor(element.color)
              const textBackgroundColor = !isTransparentColor(element.color) ? element.color! : '#e5e7eb'
              const resolvedTextColor = resolveElementTextColor(element, textBackgroundColor)
              const elementOpacity = highlightEmpty && availability === 'occupied'
                ? 0.25
                : normalizeOpacity(element.opacity)

              const elementStyle: React.CSSProperties = {
                position: 'absolute',
                left: element.x,
                top: element.y,
                width: element.width,
                height: element.height,
                backgroundColor: element.color,
                borderColor: element.borderColor,
                borderWidth: element.borderWidth ?? 2,
                borderStyle: element.borderStyle || 'solid',
                transform: element.rotation ? `rotate(${element.rotation}deg)` : 'none',
                zIndex: element.zIndex || 1,
                opacity: elementOpacity
              }

              if (element.type === 'wall') {
                elementStyle.backgroundColor = element.color || '#374151'
                elementStyle.borderWidth = 0
              }

              if (element.type === 'hallway') {
                elementStyle.backgroundColor = element.color && !isTransparentColor(element.color) ? element.color : '#d1d5db'
                elementStyle.borderColor = element.borderColor && !isTransparentColor(element.borderColor) ? element.borderColor : '#9ca3af'
                elementStyle.borderStyle = 'dashed'
              }

              if (element.type === 'door') {
                elementStyle.backgroundColor = element.color || '#d1fae5'
                elementStyle.borderColor = element.borderColor || '#10b981'
              }

              if (element.type === 'stair') {
                elementStyle.backgroundColor = element.color || '#fef3c7'
                elementStyle.borderColor = element.borderColor || '#f59e0b'
              }

              if (element.type === 'text') {
                elementStyle.backgroundColor = textHasBackground
                  ? applyAlphaToColor(element.color || '#ffffff', textBgOpacity / 100)
                  : 'transparent'
                elementStyle.borderStyle = textHasBackground ? 'solid' : 'none'
                elementStyle.borderColor = textHasBackground
                  ? (element.borderColor && !isTransparentColor(element.borderColor) ? element.borderColor : '#94a3b8')
                  : 'transparent'
                elementStyle.borderWidth = textHasBackground ? 1 : 0
                elementStyle.borderRadius = textHasBackground ? 6 : 0
              }

              if (element.type === 'icon') {
                elementStyle.backgroundColor = element.color || 'transparent'
              }

              return (
                <div
                  key={element.id}
                  className={`${styles.canvasElement} ${styles[element.type] || ''} ${isSelected ? styles.selected : ''} ${element.orientation === 'vertical' ? styles.vertical : ''}`}
                  style={elementStyle}
                  onClick={() => {
                    if (suppressNextElementClickRef.current) {
                      return
                    }
                    setSelectedElement(isSelected ? null : element)
                  }}
                  title={element.label || ''}
                >
                  {/* Room content */}
                  {isRoom && (
                    <>
                      {/* Room label — use saved textColor or compute contrast */}
                      <div className={styles.roomLabel} style={{ color: resolvedTextColor }}>{element.label}</div>

                      {/* Capacity label - Live feature from admin */}
                      {element.linkedRoomData && (
                        <div className={styles.roomCapacity}>
                          <MdPeople size={10} /> {element.linkedRoomData.capacity}
                        </div>
                      )}

                      {/* Current class info on hover/selection */}
                      {currentClass && (
                        <div className={styles.classInfo}>
                          <div className={styles.courseCode}>{currentClass.course_code}</div>
                          <div className={styles.section}>{currentClass.section}</div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Icon element — match editor exactly */}
                  {element.type === 'icon' && (
                    <div className={styles.iconElement}>
                      {(() => {
                        const IconComp = ICON_MAP[element.iconType || 'info'] || MdInfo
                        return <IconComp size={Math.min(element.width, element.height) * 0.6} color={element.iconColor || element.textColor || element.color || '#374151'} />
                      })()}
                      {element.label && <span className={styles.iconLabel} style={{ color: resolvedTextColor }}>{element.label}</span>}
                    </div>
                  )}

                  {/* Shape element — pass saved color */}
                  {element.type === 'shape' && (
                    <div className={styles.shapeElement}>
                      {(() => {
                        const ShapeComp = SHAPE_MAP[element.shapeType || 'circle'] || MdRadioButtonChecked
                        return <ShapeComp size={Math.min(element.width, element.height) * 0.7} color={element.color} />
                      })()}
                    </div>
                  )}

                  {/* Text label for non-room elements */}
                  {element.type === 'text' && (
                    <span style={{
                      fontSize: element.fontSize || 14,
                      color: resolvedTextColor,
                      fontWeight: element.fontWeight || 'normal',
                      textAlign: element.textAlign || 'center',
                      width: '100%'
                    }}>{element.label}</span>
                  )}

                  {/* Stair — show Footprints icon like editor */}
                  {element.type === 'stair' && (
                    <>
                      <MdDirectionsWalk size={20} color={element.iconColor || resolvedTextColor} />
                      {element.label && <span style={{ color: resolvedTextColor, fontSize: 10 }}>{element.label}</span>}
                    </>
                  )}

                  {/* Hallway label */}
                  {element.type === 'hallway' && element.label && (
                    <span className={styles.elementLabel} style={{ color: resolvedTextColor }}>{element.label}</span>
                  )}

                  {/* Door — show MdMeetingRoom icon like editor */}
                  {element.type === 'door' && (
                    <MdMeetingRoom size={16} />
                  )}
                </div>
              )
            })}
        </div>
        </div>{/* end scale wrapper */}
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
  interface ParsedRoomSchedule {
    allocation: RoomAllocation
    dayIndexes: number[]
    startMinutes: number
    endMinutes: number
    displayDay: string
  }

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const WEEKDAY_COLUMNS = [1, 2, 3, 4, 5, 6] // Mon-Sat

  const extractDayIndexes = (dayText?: string): number[] => {
    if (!dayText) return []
    const normalized = dayText.toLowerCase()
    const map = [
      { idx: 0, patterns: ['sunday', 'sun'] },
      { idx: 1, patterns: ['monday', 'mon'] },
      { idx: 2, patterns: ['tuesday', 'tue', 'tues'] },
      { idx: 3, patterns: ['wednesday', 'wed'] },
      { idx: 4, patterns: ['thursday', 'thu', 'thur', 'thurs'] },
      { idx: 5, patterns: ['friday', 'fri'] },
      { idx: 6, patterns: ['saturday', 'sat'] },
    ]

    const indices: number[] = []
    map.forEach(({ idx, patterns }) => {
      if (patterns.some((pattern) => normalized.includes(pattern))) {
        indices.push(idx)
      }
    })

    return [...new Set(indices)]
  }

  const parseTimeToken = (hourText: string, minuteText: string, period?: string): number => {
    let hour = parseInt(hourText, 10)
    const minute = parseInt(minuteText, 10)
    const upper = period?.toUpperCase()

    if (upper === 'PM' && hour !== 12) hour += 12
    if (upper === 'AM' && hour === 12) hour = 0

    return hour * 60 + minute
  }

  const parseTimeRange = (scheduleTime?: string): { startMinutes: number; endMinutes: number } | null => {
    if (!scheduleTime) return null

    const timeParts = scheduleTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
    if (!timeParts) return null

    const startMinutes = parseTimeToken(timeParts[1], timeParts[2], timeParts[3])
    let endMinutes = parseTimeToken(timeParts[4], timeParts[5], timeParts[6] || timeParts[3])

    if (endMinutes <= startMinutes) {
      endMinutes += 12 * 60
    }

    return { startMinutes, endMinutes }
  }

  const toReadableTime = (minutes: number): string => {
    const normalized = Math.max(0, minutes)
    const h24 = Math.floor(normalized / 60)
    const mins = normalized % 60
    const period = h24 >= 12 ? 'PM' : 'AM'
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12
    return `${h12}:${String(mins).padStart(2, '0')} ${period}`
  }

  const [roomImages, setRoomImages] = useState<any[]>([])
  const [selectedImageIdx, setSelectedImageIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'details' | 'schedule' | 'images'>('details')
  const [showTimetableModal, setShowTimetableModal] = useState(false)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (activeTab === 'images') {
      fetchRoomImages()
    }
  }, [room.id, activeTab])

  const fetchRoomImages = async () => {
    try {
      setLoading(true)
      const { data, error } = await db
        .from('room_images')
        .select('*')
        .eq('room_id', room.id)
        .order('uploaded_at', { ascending: false })

      if (!error) {
        setRoomImages(data || [])
        setSelectedImageIdx(0)
      } else {
        setRoomImages([])
      }
    } catch (err) {
      setRoomImages([])
    } finally {
      setLoading(false)
    }
  }

  const roomSchedules = roomAllocations.filter(a => a.room === room.room)
  const parsedRoomSchedules = useMemo<ParsedRoomSchedule[]>(() => {
    return roomSchedules
      .map((allocation) => {
        const dayIndexes = extractDayIndexes(allocation.schedule_day)
        const range = parseTimeRange(allocation.schedule_time)
        if (!range || dayIndexes.length === 0) return null

        return {
          allocation,
          dayIndexes,
          startMinutes: range.startMinutes,
          endMinutes: range.endMinutes,
          displayDay: allocation.schedule_day || dayIndexes.map((idx) => DAY_NAMES[idx]).join(', ')
        }
      })
      .filter((item): item is ParsedRoomSchedule => item !== null)
      .sort((a, b) => {
        const dayA = Math.min(...a.dayIndexes)
        const dayB = Math.min(...b.dayIndexes)
        if (dayA !== dayB) return dayA - dayB
        return a.startMinutes - b.startMinutes
      })
  }, [roomSchedules])

  const nowDayIndex = now.getDay()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const nextTodaySchedule = useMemo(() => {
    return parsedRoomSchedules
      .filter((entry) => entry.dayIndexes.includes(nowDayIndex) && entry.startMinutes > nowMinutes)
      .sort((a, b) => a.startMinutes - b.startMinutes)[0] || null
  }, [parsedRoomSchedules, nowDayIndex, nowMinutes])

  const ongoingSchedules = useMemo(() => {
    return parsedRoomSchedules.filter((entry) =>
      entry.dayIndexes.includes(nowDayIndex) &&
      nowMinutes >= entry.startMinutes &&
      nowMinutes < entry.endMinutes
    )
  }, [parsedRoomSchedules, nowDayIndex, nowMinutes])

  const availabilityText = useMemo(() => {
    if (availability === 'available') {
      if (nextTodaySchedule) {
        return `Available until ${toReadableTime(nextTodaySchedule.startMinutes)}`
      }
      return 'Available for the rest of today'
    }

    if (availability === 'occupied') {
      const currentEntry = ongoingSchedules[0]
      if (currentEntry) {
        return `Occupied until ${toReadableTime(currentEntry.endMinutes)}`
      }
      return 'Currently in use'
    }

    return 'Availability time unknown'
  }, [availability, nextTodaySchedule, ongoingSchedules])

  const upcomingSchedules = useMemo(() => {
    return parsedRoomSchedules
      .flatMap((entry) => entry.dayIndexes.map((dayIdx) => ({ dayIdx, entry })))
      .filter(({ dayIdx, entry }) => {
        if (dayIdx < nowDayIndex) return false
        if (dayIdx === nowDayIndex && entry.startMinutes <= nowMinutes) return false
        return dayIdx <= 6
      })
      .sort((a, b) => {
        if (a.dayIdx !== b.dayIdx) return a.dayIdx - b.dayIdx
        return a.entry.startMinutes - b.entry.startMinutes
      })
      .slice(0, 8)
  }, [parsedRoomSchedules, nowDayIndex, nowMinutes])

  const timetableHours = useMemo(() => {
    const startHour = 7
    const endHour = 20
    const values: number[] = []
    for (let hour = startHour; hour <= endHour; hour += 1) {
      values.push(hour)
    }
    return values
  }, [])

  const getSchedulesForSlot = (dayIdx: number, hour24: number) => {
    const slotStart = hour24 * 60
    const slotEnd = slotStart + 60
    return parsedRoomSchedules.filter((entry) =>
      entry.dayIndexes.includes(dayIdx) &&
      entry.startMinutes < slotEnd &&
      entry.endMinutes > slotStart
    )
  }

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
            <><MdCheckCircle size={16} /> Available Now · {availabilityText}</>
          ) : availability === 'occupied' ? (
            <><MdCancel size={16} /> In Use · {availabilityText}</>
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
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Availability Window</span>
                  <span className={styles.detailValue}>{availabilityText}</span>
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
                <>
                  <div className={styles.scheduleActions}>
                    <button
                      className={styles.timetableBtn}
                      onClick={() => setShowTimetableModal(true)}
                    >
                      <MdFullscreen size={16} /> Fullscreen Timetable (Mon–Sat until 8:00 PM)
                    </button>
                  </div>

                  <div className={styles.scheduleSectionBlock}>
                    <h4 className={styles.scheduleSectionTitle}>Ongoing Now</h4>
                    {ongoingSchedules.length === 0 ? (
                      <p className={styles.scheduleEmptyText}>No ongoing class right now.</p>
                    ) : (
                      <div className={styles.scheduleList}>
                        {ongoingSchedules.map((entry, idx) => (
                          <div key={`ongoing-${entry.allocation.id ?? idx}`} className={styles.scheduleItem}>
                            <div className={styles.scheduleTime}>
                              <MdAccessTime size={14} />
                              {entry.allocation.schedule_time}
                            </div>
                            <div className={styles.scheduleDetails}>
                              <div className={styles.scheduleCourse}>{entry.allocation.course_code || 'N/A'}</div>
                              <div className={styles.scheduleSection}>{entry.allocation.section || 'No section'}</div>
                              <div className={styles.scheduleDay}>{entry.displayDay}</div>
                              {(entry.allocation.teacher_name || entry.allocation.faculty_name) && (
                                <div className={styles.scheduleTeacher}>{entry.allocation.teacher_name || entry.allocation.faculty_name}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className={styles.scheduleSectionBlock}>
                    <h4 className={styles.scheduleSectionTitle}>Upcoming</h4>
                    {upcomingSchedules.length === 0 ? (
                      <p className={styles.scheduleEmptyText}>No upcoming schedules for the rest of this week.</p>
                    ) : (
                      <div className={styles.scheduleList}>
                        {upcomingSchedules.map(({ dayIdx, entry }, idx) => (
                          <div key={`upcoming-${entry.allocation.id ?? idx}-${dayIdx}`} className={styles.scheduleItem}>
                            <div className={styles.scheduleTime}>
                              <MdAccessTime size={14} />
                              {entry.allocation.schedule_time}
                            </div>
                            <div className={styles.scheduleDetails}>
                              <div className={styles.scheduleCourse}>{entry.allocation.course_code || 'N/A'}</div>
                              <div className={styles.scheduleSection}>{entry.allocation.section || 'No section'}</div>
                              <div className={styles.scheduleDay}>{DAY_NAMES[dayIdx]}</div>
                              {(entry.allocation.teacher_name || entry.allocation.faculty_name) && (
                                <div className={styles.scheduleTeacher}>{entry.allocation.teacher_name || entry.allocation.faculty_name}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
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

      {showTimetableModal && (
        <div className={styles.timetableOverlay} onClick={() => setShowTimetableModal(false)}>
          <div className={styles.timetableModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.timetableHeader}>
              <div>
                <h3 className={styles.timetableTitle}>Weekly Timetable</h3>
                <p className={styles.timetableSubtitle}>{room.room} · Monday to Saturday · 7:00 AM to 8:00 PM</p>
              </div>
              <button className={styles.closeModalBtn} onClick={() => setShowTimetableModal(false)}>✕</button>
            </div>

            <div className={styles.timetableGridWrap}>
              <table className={styles.timetableGrid}>
                <thead>
                  <tr>
                    <th>Time</th>
                    {WEEKDAY_COLUMNS.map((dayIdx) => (
                      <th key={`head-${dayIdx}`}>{DAY_NAMES[dayIdx]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timetableHours.map((hour24) => (
                    <tr key={`hour-${hour24}`}>
                      <td className={styles.timetableTimeCell}>{toReadableTime(hour24 * 60)}</td>
                      {WEEKDAY_COLUMNS.map((dayIdx) => {
                        const slotSchedules = getSchedulesForSlot(dayIdx, hour24)
                        return (
                          <td key={`slot-${dayIdx}-${hour24}`}>
                            <div className={styles.timetableSlotContent}>
                              {slotSchedules.map((entry, idx) => (
                                <div key={`slot-item-${dayIdx}-${hour24}-${entry.allocation.id ?? idx}`} className={styles.timetableEntry}>
                                  <div className={styles.timetableCourse}>{entry.allocation.course_code || 'N/A'}</div>
                                  <div className={styles.timetableMeta}>{entry.allocation.section || 'No section'}</div>
                                  <div className={styles.timetableMeta}>{entry.allocation.schedule_time}</div>
                                </div>
                              ))}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
