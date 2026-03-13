'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  MdAccessTime, MdPeople, MdCheckCircle, MdCancel, MdBusiness,
  MdZoomIn, MdZoomOut, MdFullscreen, MdFullscreenExit, MdExpandMore, MdExpandLess, MdChevronLeft, MdChevronRight,
  MdRefresh, MdInfo, MdMap, MdWarning, MdVisibility, MdMeetingRoom, MdDirectionsWalk,
  MdSwapVert, MdWc, MdMan, MdWoman, MdLaptop, MdScience, MdLocalLibrary, MdRestaurant,
  MdArchive, MdFitnessCenter, MdMusicNote, MdTheaterComedy, MdCoPresent, MdDns, MdWifi,
  MdAir, MdLocalFireDepartment, MdWaterDrop, MdRadioButtonChecked, MdChangeHistory, MdHexagon, MdStar,
  MdStop, MdFavorite, MdCalendarToday, MdImage, MdClose, MdSearch, MdFilterList, MdCenterFocusStrong,
  MdHelpOutline, MdVisibilityOff, MdLayers
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
  specific_classification?: string
  equipment?: string
  has_ac?: boolean
  has_whiteboard?: boolean
  has_tv?: boolean
  has_projector?: boolean
  has_wifi?: boolean
  has_lab_equipment?: boolean
  has_computers?: number
  is_accessible?: boolean
}

interface Building {
  id: number
  name: string
  floors: FloorPlan[]
}

interface RoomAllocation {
  id?: number
  room: string
  room_id?: number
  building?: string
  schedule_day: string
  schedule_time: string
  schedule_id?: number
  course_code?: string
  course_name?: string
  section?: string
  faculty_name?: string
  teacher_name?: string
  department?: string
  campus?: string
  capacity?: number
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
  background_color?: string
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

  const bg = !isTransparentColor(element.color) ? element.color! : fallbackBackground
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

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value > 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === '1' || normalized === 'yes'
  }
  return false
}

function normalizeRoomKey(value?: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function matchesRoomAllocation(allocRoom: string, roomName?: string, roomCode?: string, allocRoomId?: number, roomId?: number, allocBuilding?: string): boolean {
  // Match by room_id if both sides have it
  if (allocRoomId && roomId && allocRoomId === roomId) return true

  const allocKey = normalizeRoomKey(allocRoom)
  if (!allocKey) return false

  const candidateKeys = [normalizeRoomKey(roomName), normalizeRoomKey(roomCode)].filter(Boolean)
  if (candidateKeys.includes(allocKey)) return true

  // Also check if allocRoom contains building prefix (e.g. "Building1-Room101")
  // Try stripping building prefix and matching just the room part
  if (allocBuilding) {
    const buildingPrefix = normalizeRoomKey(allocBuilding)
    if (buildingPrefix && allocKey.startsWith(buildingPrefix)) {
      const roomPart = allocKey.slice(buildingPrefix.length)
      if (roomPart && candidateKeys.includes(roomPart)) return true
    }
  }

  // Check if any candidate key is contained in allocKey or vice versa
  for (const candidate of candidateKeys) {
    if (candidate && candidate.length >= 3) {
      if (allocKey.includes(candidate) || candidate.includes(allocKey)) return true
    }
  }

  return false
}

function normalizeDayToken(day: string): string {
  const dayMap: Record<string, string> = {
    'M': 'Monday', 'MON': 'Monday', 'MONDAY': 'Monday',
    'T': 'Tuesday', 'TUE': 'Tuesday', 'TU': 'Tuesday', 'TUESDAY': 'Tuesday',
    'W': 'Wednesday', 'WED': 'Wednesday', 'WEDNESDAY': 'Wednesday',
    'TH': 'Thursday', 'THU': 'Thursday', 'R': 'Thursday', 'THURSDAY': 'Thursday',
    'F': 'Friday', 'FRI': 'Friday', 'FRIDAY': 'Friday',
    'S': 'Saturday', 'SA': 'Saturday', 'SAT': 'Saturday', 'SATURDAY': 'Saturday',
    'SU': 'Sunday', 'U': 'Sunday', 'SUN': 'Sunday', 'SUNDAY': 'Sunday'
  }

  const normalized = String(day || '').trim().toUpperCase().replace(/\./g, '')
  return dayMap[normalized] || day
}

function expandScheduleDays(dayText?: string): string[] {
  if (!dayText) return []

  const compact = dayText.toUpperCase().replace(/\./g, '').replace(/\s+/g, '')
  const comboMap: Record<string, string[]> = {
    TTH: ['Tuesday', 'Thursday'],
    MWF: ['Monday', 'Wednesday', 'Friday'],
    MW: ['Monday', 'Wednesday'],
    TF: ['Tuesday', 'Friday'],
    MTWTHF: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    MTWTHFS: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  }

  if (comboMap[compact]) return comboMap[compact]

  if (compact.includes('/') || compact.includes(',')) {
    return compact
      .split(/[\/,]+/)
      .map(token => normalizeDayToken(token))
      .filter(Boolean)
  }

  const orderedTokens = ['THURSDAY', 'THU', 'TH', 'TUESDAY', 'TUE', 'TU', 'MONDAY', 'MON', 'WEDNESDAY', 'WED', 'FRIDAY', 'FRI', 'SATURDAY', 'SAT', 'SUNDAY', 'SUN', 'SA', 'SU', 'M', 'T', 'W', 'R', 'F', 'S', 'U']
  const expanded: string[] = []
  let i = 0

  while (i < compact.length) {
    const token = orderedTokens.find(t => compact.startsWith(t, i))
    if (!token) {
      i += 1
      continue
    }
    expanded.push(normalizeDayToken(token))
    i += token.length
  }

  if (expanded.length > 0) {
    return Array.from(new Set(expanded))
  }

  return [normalizeDayToken(compact)]
}

function splitTimeRange(timeStr: string): [string, string] {
  if (!timeStr) return ['', '']
  const normalized = timeStr
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+to\s+/gi, '-')
  const parts = normalized.split('-').map(part => part.trim()).filter(Boolean)
  if (parts.length < 2) return ['', '']
  return [parts[0], parts[1]]
}

function parseTimeToMinutes(value: string): number {
  if (!value) return -1
  const match = value.trim().match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i)
  if (!match) return -1
  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const period = match[3]?.toUpperCase()
  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0
  return hours * 60 + minutes
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
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [buildings, setBuildings] = useState<Building[]>([])
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null)
  const [selectedFloor, setSelectedFloor] = useState<FloorPlan | null>(null)
  const [canvasElements, setCanvasElements] = useState<CanvasElement[]>([])
  const [roomAllocations, setRoomAllocations] = useState<RoomAllocation[]>([])
  const [hasLockedCurrentSchedule, setHasLockedCurrentSchedule] = useState(false)
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
  const [roomSearchQuery, setRoomSearchQuery] = useState('')
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'occupied' | 'unknown'>('all')
  const [showLegend, setShowLegend] = useState(true)
  const [showShortcuts, setShowShortcuts] = useState(false)

  const notifyFullscreenChange = (nextValue: boolean) => {
    if (onToggleFullscreen) {
      onToggleFullscreen(nextValue)
    }
  }

  const sortedCanvasElements = useMemo(
    () => [...canvasElements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)),
    [canvasElements]
  )

  const fitCanvasToViewport = useCallback(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const horizontalPadding = 56
    const verticalPadding = 56
    const availableWidth = Math.max(0, wrapper.clientWidth - horizontalPadding)
    const availableHeight = Math.max(0, wrapper.clientHeight - verticalPadding)
    if (availableWidth <= 0 || availableHeight <= 0) return

    const fitScaleX = (availableWidth / canvasSize.width) * 100
    const fitScaleY = (availableHeight / canvasSize.height) * 100
    const nextZoom = Math.min(300, Math.max(10, Math.floor(Math.min(fitScaleX, fitScaleY))))

    setZoom(nextZoom)
    setZoomInput(String(nextZoom))
  }, [canvasSize.height, canvasSize.width])

  const roomElements = useMemo(
    () => sortedCanvasElements.filter((element) => element.type === 'room'),
    [sortedCanvasElements]
  )

  const roomSearchOptions = useMemo(() => {
    const normalizedQuery = roomSearchQuery.trim().toLowerCase()
    return roomElements
      .filter((element) => {
        const roomLabel = element.linkedRoomData?.room || element.label || ''
        const roomCode = element.linkedRoomData?.room_code || ''
        if (!normalizedQuery) return true
        return roomLabel.toLowerCase().includes(normalizedQuery) || roomCode.toLowerCase().includes(normalizedQuery)
      })
      .slice(0, 8)
  }, [roomElements, roomSearchQuery])

  const roomStatusSummary = useMemo(() => {
    return roomElements.reduce(
      (summary, element) => {
        const roomName = element.linkedRoomData?.room || element.label
        if (!roomName) {
          summary.unknown += 1
          return summary
        }

        const status = getRoomAvailability(roomName, element.linkedRoomData?.room_code, element.linkedRoomData?.id)
        summary.total += 1
        if (status === 'available') summary.available += 1
        else if (status === 'occupied') summary.occupied += 1
        else summary.unknown += 1
        return summary
      },
      { total: 0, available: 0, occupied: 0, unknown: 0 }
    )
  }, [roomElements, roomAllocations, currentTime])

  const visibleRoomIdSet = useMemo(() => {
    const normalizedQuery = roomSearchQuery.trim().toLowerCase()
    const visibleIds = new Set<string>()

    roomElements.forEach((element) => {
      const roomLabel = element.linkedRoomData?.room || element.label || ''
      const roomCode = element.linkedRoomData?.room_code || ''
      const availability = roomLabel ? getRoomAvailability(roomLabel, element.linkedRoomData?.room_code, element.linkedRoomData?.id) : 'unknown'

      const matchesQuery = !normalizedQuery ||
        roomLabel.toLowerCase().includes(normalizedQuery) ||
        roomCode.toLowerCase().includes(normalizedQuery)

      const matchesAvailability = availabilityFilter === 'all' || availability === availabilityFilter

      if (matchesQuery && matchesAvailability) {
        visibleIds.add(element.id)
      }
    })

    return visibleIds
  }, [roomElements, roomSearchQuery, availabilityFilter, roomAllocations, currentTime])

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

  useEffect(() => {
    if (!isMobile || !selectedFloor) return
    setAvailabilityFilter('all')
  }, [isMobile, selectedFloor?.id])

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

  const centerAndSelectRoom = useCallback((element: CanvasElement) => {
    setSelectedElement(element)

    const wrapper = wrapperRef.current
    if (!wrapper) return

    const scale = zoom / 100
    const targetX = (element.x + element.width / 2) * scale - wrapper.clientWidth / 2
    const targetY = (element.y + element.height / 2) * scale - wrapper.clientHeight / 2

    wrapper.scrollTo({
      left: Math.max(0, targetX),
      top: Math.max(0, targetY),
      behavior: 'smooth'
    })
  }, [zoom])

  const handleWrapperWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!(event.ctrlKey || event.metaKey)) return

    event.preventDefault()
    const step = event.deltaY > 0 ? -8 : 8
    setZoom((prev) => Math.max(10, Math.min(300, prev + step)))
  }

  useEffect(() => {
    const handleViewerShortcuts = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        !!target?.closest('[contenteditable="true"]')

      if (isTypingTarget) return

      if (event.key === '/') {
        event.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      if (event.key === '?' || (event.shiftKey && event.key === '/')) {
        event.preventDefault()
        setShowShortcuts(true)
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key === '0') {
        event.preventDefault()
        fitCanvasToViewport()
        return
      }

      if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        setZoom((prev) => Math.min(300, prev + 10))
        return
      }

      if (event.key === '-') {
        event.preventDefault()
        setZoom((prev) => Math.max(10, prev - 10))
        return
      }

      if (event.key.toLowerCase() === 'l') {
        event.preventDefault()
        setShowLegend((prev) => !prev)
        return
      }

      if (event.key === 'Escape') {
        if (showShortcuts) {
          event.preventDefault()
          setShowShortcuts(false)
          return
        }

        if (selectedElement) {
          event.preventDefault()
          setSelectedElement(null)
        }
      }
    }

    window.addEventListener('keydown', handleViewerShortcuts)
    return () => window.removeEventListener('keydown', handleViewerShortcuts)
  }, [fitCanvasToViewport, selectedElement, showShortcuts])

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

  const fetchLiveCurrentLockedScheduleAllocations = async (): Promise<{ allocations: RoomAllocation[]; hasSchedule: boolean }> => {
    try {
      // Campus map live view must follow the same source of truth as ViewSchedule:
      // the schedule that is both current and locked.
      let scheduleResponse = await db
        .from('generated_schedules')
        .select('id, created_at, activated_at')
        .eq('is_current', true)
        .eq('is_locked', true)
        .order('activated_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(1)

      if (scheduleResponse.error) {
        scheduleResponse = await db
          .from('generated_schedules')
          .select('id, created_at')
          .eq('is_current', true)
          .eq('is_locked', true)
          .order('created_at', { ascending: false })
          .limit(1)
      }

      let currentSchedule = scheduleResponse.data?.[0]

      // Fallback: if no locked+current schedule, try just current
      if (!currentSchedule?.id) {
        const currentOnlyResponse = await db
          .from('generated_schedules')
          .select('id, created_at')
          .eq('is_current', true)
          .order('created_at', { ascending: false })
          .limit(1)

        currentSchedule = currentOnlyResponse.data?.[0]
      }

      // Fallback: if still nothing, try just locked
      if (!currentSchedule?.id) {
        const lockedOnlyResponse = await db
          .from('generated_schedules')
          .select('id, created_at')
          .eq('is_locked', true)
          .order('created_at', { ascending: false })
          .limit(1)

        currentSchedule = lockedOnlyResponse.data?.[0]
      }

      // Final fallback: use the most recent schedule
      if (!currentSchedule?.id) {
        const latestResponse = await db
          .from('generated_schedules')
          .select('id, created_at')
          .order('created_at', { ascending: false })
          .limit(1)

        currentSchedule = latestResponse.data?.[0]
      }

      if (!currentSchedule?.id) {
        return { allocations: [], hasSchedule: false }
      }

      const { data: allocations } = await supabase
        .from('room_allocations')
        .select('*')
        .eq('schedule_id', currentSchedule.id)

      return { allocations: allocations || [], hasSchedule: true }
    } catch (err) {
      console.error('Error fetching locked/current live allocations:', err)
      return { allocations: [], hasSchedule: false }
    }
  }

  const enrichElementsWithRoomMetadata = async (elements: CanvasElement[]): Promise<CanvasElement[]> => {
    const roomElements = elements.filter((element) => element.type === 'room')
    if (roomElements.length === 0) return elements

    const roomIds = Array.from(new Set(
      roomElements
        .map((element) => Number(element.linkedRoomId || element.linkedRoomData?.id))
        .filter((id) => Number.isFinite(id) && id > 0)
    ))

    const roomNames = Array.from(new Set(
      roomElements
        .map((element) => String(element.linkedRoomData?.room || element.label || '').trim())
        .filter(Boolean)
    ))

    const readColumns = 'id, room, room_code, building, capacity, floor_number, room_type, specific_classification, equipment, has_ac, has_whiteboard, has_tv, has_projector, has_wifi, has_lab_equipment, has_computers, is_accessible'
    const fallbackColumns = 'id, room, room_code, building, capacity, floor_number, room_type, specific_classification, has_ac, has_whiteboard, has_tv, has_projector'

    const byId = new Map<number, any>()
    const byRoomName = new Map<string, any>()

    const mergeRows = (rows: any[] | null | undefined) => {
      ;(rows || []).forEach((row) => {
        if (Number.isFinite(Number(row.id))) {
          byId.set(Number(row.id), row)
        }
        const normalizedRoom = String(row.room || '').trim().toLowerCase()
        if (normalizedRoom) {
          byRoomName.set(normalizedRoom, row)
        }
      })
    }

    try {
      if (roomIds.length > 0) {
        let byIdResult = await db
          .from('campuses')
          .select(readColumns)
          .in('id', roomIds)

        if (byIdResult.error) {
          byIdResult = await db
            .from('campuses')
            .select(fallbackColumns)
            .in('id', roomIds)
        }

        mergeRows(byIdResult.data)
      }

      const unresolvedNames = roomNames.filter((name) => !byRoomName.has(name.toLowerCase()))
      if (unresolvedNames.length > 0) {
        let byNameResult = await db
          .from('campuses')
          .select(readColumns)
          .in('room', unresolvedNames)

        if (byNameResult.error) {
          byNameResult = await db
            .from('campuses')
            .select(fallbackColumns)
            .in('room', unresolvedNames)
        }

        mergeRows(byNameResult.data)
      }
    } catch (err) {
      console.warn('Room metadata enrichment skipped:', err)
    }

    return elements.map((element) => {
      if (element.type !== 'room') return element

      const linkedRoomId = Number(element.linkedRoomId || element.linkedRoomData?.id)
      const linkedRoomName = String(element.linkedRoomData?.room || element.label || '').trim().toLowerCase()

      const roomMeta =
        (Number.isFinite(linkedRoomId) && linkedRoomId > 0 ? byId.get(linkedRoomId) : null) ||
        (linkedRoomName ? byRoomName.get(linkedRoomName) : null)

      if (!roomMeta) return element

      return {
        ...element,
        linkedRoomData: {
          ...element.linkedRoomData,
          ...roomMeta
        }
      }
    })
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

    const hasDataCanvasSize =
      Number.isFinite(Number(floorPlan.canvas_data?.canvasSize?.width)) && Number(floorPlan.canvas_data?.canvasSize?.width) > 0 &&
      Number.isFinite(Number(floorPlan.canvas_data?.canvasSize?.height)) && Number(floorPlan.canvas_data?.canvasSize?.height) > 0

    const hasColumnCanvasSize =
      Number.isFinite(Number(floorPlan.canvas_width)) && Number(floorPlan.canvas_width) > 0 &&
      Number.isFinite(Number(floorPlan.canvas_height)) && Number(floorPlan.canvas_height) > 0

    // Use canvas_data.canvasSize as primary source of truth since elements were authored at that size
    // Fall back to DB columns, then default
    const resolvedCanvasSize = hasDataCanvasSize
      ? {
        width: toFiniteNumber(floorPlan.canvas_data.canvasSize.width, 1056),
        height: toFiniteNumber(floorPlan.canvas_data.canvasSize.height, 816)
      }
      : hasColumnCanvasSize
        ? {
          width: toFiniteNumber(floorPlan.canvas_width, 1056),
          height: toFiniteNumber(floorPlan.canvas_height, 816)
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
      const enrichedElements = await enrichElementsWithRoomMetadata(normalizedElements)
      setCanvasElements(enrichedElements)
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

    const liveSchedule = await fetchLiveCurrentLockedScheduleAllocations()
    setRoomAllocations(liveSchedule.allocations)
    setHasLockedCurrentSchedule(liveSchedule.hasSchedule)
  }

  // Get room availability
  function getRoomAvailability(roomName: string, roomCode?: string, roomId?: number): 'available' | 'occupied' | 'unknown' {
    if (roomAllocations.length === 0) return 'unknown'

    const now = currentTime
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const currentDay = dayNames[now.getDay()]
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()

    const isOccupied = roomAllocations.some(alloc => {
      if (!matchesRoomAllocation(alloc.room, roomName, roomCode, alloc.room_id, roomId, alloc.building)) return false

      const allocDays = expandScheduleDays(alloc.schedule_day)
      if (!allocDays.some((day) => day.toLowerCase() === currentDay.toLowerCase())) return false

      const [startRaw, endRaw] = splitTimeRange(alloc.schedule_time || '')
      if (!startRaw || !endRaw) return false
      const startMins = parseTimeToMinutes(startRaw)
      const endMins = parseTimeToMinutes(endRaw)
      if (startMins < 0 || endMins < 0) return false
      const currentMins = currentHour * 60 + currentMinute

      return currentMins >= startMins && currentMins < endMins
    })

    return isOccupied ? 'occupied' : 'available'
  }

  // Get current class for room
  function getCurrentClass(roomName: string, roomCode?: string, roomId?: number): RoomAllocation | null {
    if (roomAllocations.length === 0) return null

    const now = currentTime
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const currentDay = dayNames[now.getDay()]
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()

    return roomAllocations.find(alloc => {
      if (!matchesRoomAllocation(alloc.room, roomName, roomCode, alloc.room_id, roomId, alloc.building)) return false

      const allocDays = expandScheduleDays(alloc.schedule_day)
      if (!allocDays.some((day) => day.toLowerCase() === currentDay.toLowerCase())) return false

      const [startRaw, endRaw] = splitTimeRange(alloc.schedule_time || '')
      if (!startRaw || !endRaw) return false
      const startMins = parseTimeToMinutes(startRaw)
      const endMins = parseTimeToMinutes(endRaw)
      if (startMins < 0 || endMins < 0) return false
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
          <h2>{isMobile ? 'Building Schedules' : 'Live Building Schedules'}</h2>
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
            <button
              onClick={fitCanvasToViewport}
              className={styles.zoomBtn}
              title="Fit to viewport (Ctrl/Cmd + 0)"
            >
              <MdCenterFocusStrong size={16} />
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

          <button
            onClick={() => setShowShortcuts(true)}
            className={styles.refreshBtn}
            title="Viewer shortcuts"
          >
            <MdHelpOutline size={16} />
          </button>
        </div>
      </div>

      {/* Building & Floor Navigator — Compact Inline */}
      {buildings.length > 0 && (
        <div className={styles.buildingNavInline}>
          <div className={styles.buildingChipRow}>
            <MdBusiness size={14} className={styles.buildingNavIcon} />
            {buildings.map((building, buildingIdx) => (
              <button
                key={`building-${building.name}-${buildingIdx}`}
                className={`${styles.buildingChip} ${selectedBuilding?.id === building.id ? styles.buildingChipActive : ''}`}
                onClick={() => handleBuildingChange(String(building.id))}
              >
                {building.name}
              </button>
            ))}
          </div>
          {selectedBuilding && selectedBuilding.floors.length > 0 && (
            <div className={styles.floorChipRow}>
              <MdLayers size={13} className={styles.buildingNavIcon} />
              {selectedBuilding.floors.map(floor => {
                const shortName = floor.floor_name
                  ? floor.floor_name.replace(new RegExp(`^${selectedBuilding.name}\\s*[-–]\\s*`, 'i'), '')
                  : `Floor ${floor.floor_number}`
                const isActive = selectedFloor?.id === floor.id
                return (
                  <button
                    key={floor.id}
                    className={`${styles.floorChip} ${isActive ? styles.floorChipActive : ''}`}
                    onClick={() => handleFloorChange(String(floor.id))}
                    title={floor.floor_name || `Floor ${floor.floor_number}`}
                  >
                    {shortName}
                    {floor.is_default_view && <MdVisibility size={10} />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div className={styles.viewerToolbar}>
        <div className={styles.viewerSearchRow}>
          <div className={styles.viewerSearchBox}>
            <MdSearch size={14} />
            <input
              ref={searchInputRef}
              type="text"
              value={roomSearchQuery}
              onChange={(event) => setRoomSearchQuery(event.target.value)}
              placeholder="Find room by name/code ( / )"
              aria-label="Search rooms"
            />
            {roomSearchQuery && (
              <button
                className={styles.searchClearBtn}
                onClick={() => setRoomSearchQuery('')}
                title="Clear room search"
              >
                <MdClose size={14} />
              </button>
            )}
          </div>

          <button
            className={styles.legendToggleBtn}
            onClick={() => setShowLegend((prev) => !prev)}
            title={showLegend ? 'Hide legend (L)' : 'Show legend (L)'}
          >
            {showLegend ? <MdVisibilityOff size={14} /> : <MdVisibility size={14} />}
            <span>{showLegend ? 'Hide Legend' : 'Show Legend'}</span>
          </button>
        </div>

        {roomSearchQuery && (
          <div className={styles.searchResultsRow}>
            {roomSearchOptions.length === 0 ? (
              <span className={styles.searchResultEmpty}>No rooms found for "{roomSearchQuery}"</span>
            ) : (
              roomSearchOptions.map((element) => {
                const roomName = element.linkedRoomData?.room || element.label || 'Room'
                const roomCode = element.linkedRoomData?.room_code
                return (
                  <button
                    key={`search-room-${element.id}`}
                    className={styles.searchResultChip}
                    onClick={() => centerAndSelectRoom(element)}
                    title={`Jump to ${roomName}`}
                  >
                    {roomName}{roomCode ? ` (${roomCode})` : ''}
                  </button>
                )
              })
            )}
          </div>
        )}

        <div className={styles.filterStatsRow}>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}><MdFilterList size={14} /> Availability</span>
            {(['all', 'available', 'occupied', 'unknown'] as const).map((filter) => (
              <button
                key={`filter-${filter}`}
                className={`${styles.filterChip} ${availabilityFilter === filter ? styles.active : ''}`}
                onClick={() => setAvailabilityFilter(filter)}
              >
                {filter === 'all' ? 'All' : filter === 'available' ? 'Free' : filter === 'occupied' ? 'In Use' : 'Unknown'}
              </button>
            ))}
          </div>

          <div className={styles.statsGroup}>
            <span className={styles.statCard}>Rooms: {roomStatusSummary.total}</span>
            <span className={`${styles.statCard} ${styles.statFree}`}>Free: {roomStatusSummary.available}</span>
            <span className={`${styles.statCard} ${styles.statBusy}`}>In Use: {roomStatusSummary.occupied}</span>
          </div>
        </div>
      </div>

      {/* Legend - Enhanced visibility */}
      {showLegend && (
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
      )}

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
        onWheel={handleWrapperWheel}
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
                ? getRoomAvailability(element.linkedRoomData.room, element.linkedRoomData.room_code, element.linkedRoomData.id)
                : 'unknown'
              const currentClass = isRoom && element.linkedRoomData
                ? getCurrentClass(element.linkedRoomData.room, element.linkedRoomData.room_code, element.linkedRoomData.id)
                : null
              const isSelected = selectedElement?.id === element.id
              const isFilteredOutRoom = isRoom && !visibleRoomIdSet.has(element.id)
              const isSearchMatchRoom = isRoom && roomSearchQuery.trim().length > 0 && visibleRoomIdSet.has(element.id)

              const textBgOpacity = element.textBackgroundOpacity ?? (!isTransparentColor(element.color) ? 35 : 0)
              const textHasBackground = textBgOpacity > 0 && !isTransparentColor(element.color)
              const textBackgroundColor = !isTransparentColor(element.color) ? element.color! : '#e5e7eb'
              const resolvedTextColor = resolveElementTextColor(element, textBackgroundColor)
              const elementOpacity = highlightEmpty && availability === 'occupied'
                ? 0.25
                : isFilteredOutRoom
                  ? Math.max(0.12, normalizeOpacity(element.opacity) * 0.2)
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
                  className={`${styles.canvasElement} ${styles[element.type] || ''} ${isSelected ? styles.selected : ''} ${element.orientation === 'vertical' ? styles.vertical : ''} ${isFilteredOutRoom ? styles.canvasElementFiltered : ''} ${isSearchMatchRoom ? styles.canvasElementSearchMatch : ''}`}
                  style={elementStyle}
                  onClick={() => {
                    if (suppressNextElementClickRef.current) {
                      return
                    }
                    // Non-interactive elements should not be selectable
                    if (element.type === 'hallway' || element.type === 'wall') return
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

      {showShortcuts && (
        <div className={styles.viewerShortcutOverlay} onClick={() => setShowShortcuts(false)}>
          <div className={styles.viewerShortcutModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.viewerShortcutHeader}>
              <h3><MdHelpOutline size={18} /> Viewer Shortcuts</h3>
              <button onClick={() => setShowShortcuts(false)} aria-label="Close shortcuts"><MdClose size={18} /></button>
            </div>
            <div className={styles.viewerShortcutGrid}>
              <div><kbd>/</kbd><span>Focus room search</span></div>
              <div><kbd>L</kbd><span>Toggle legend</span></div>
              <div><kbd>+</kbd><span>Zoom in</span></div>
              <div><kbd>-</kbd><span>Zoom out</span></div>
              <div><kbd>Ctrl/Cmd + 0</kbd><span>Fit map to viewport</span></div>
              <div><kbd>Ctrl/Cmd + Scroll</kbd><span>Smooth zoom with wheel</span></div>
              <div><kbd>?</kbd><span>Open shortcuts</span></div>
              <div><kbd>Esc</kbd><span>Close selected room/modal</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Room Details Modal */}
      {selectedElement && selectedElement.type === 'room' && selectedElement.linkedRoomData && (
        <RoomDetailsModal
          room={selectedElement.linkedRoomData}
          availability={getRoomAvailability(selectedElement.linkedRoomData.room, selectedElement.linkedRoomData.room_code, selectedElement.linkedRoomData.id)}
          currentClass={getCurrentClass(selectedElement.linkedRoomData.room, selectedElement.linkedRoomData.room_code, selectedElement.linkedRoomData.id)}
          roomAllocations={roomAllocations}
          hasLockedCurrentSchedule={hasLockedCurrentSchedule}
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
  hasLockedCurrentSchedule: boolean
  onClose: () => void
  styles: any
}

function RoomDetailsModal({
  room,
  availability,
  currentClass,
  roomAllocations,
  hasLockedCurrentSchedule,
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

  interface DatedRoomSchedule {
    allocation: RoomAllocation
    dayIdx: number
    startMinutes: number
    endMinutes: number
  }

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const WEEKDAY_COLUMNS = [1, 2, 3, 4, 5, 6] // Mon-Sat

  const extractDayIndexes = (dayText?: string): number[] => {
    const expandedDays = expandScheduleDays(dayText)
    return expandedDays
      .map((day) => DAY_NAMES.findIndex((dayName) => dayName.toLowerCase() === day.toLowerCase()))
      .filter((idx) => idx >= 0)
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

    const [startRaw, endRaw] = splitTimeRange(scheduleTime)
    if (!startRaw || !endRaw) return null
    const startMinutes = parseTimeToMinutes(startRaw)
    let endMinutes = parseTimeToMinutes(endRaw)
    if (startMinutes < 0 || endMinutes < 0) return null

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
  const [isImageLightboxOpen, setIsImageLightboxOpen] = useState(false)
  const [now, setNow] = useState(new Date())
  const [selectedScheduleDay, setSelectedScheduleDay] = useState<number | 'all'>('all')

  const hasMultipleImages = roomImages.length > 1

  const goPrevImage = useCallback(() => {
    if (!hasMultipleImages) return
    setSelectedImageIdx((prev) => (prev - 1 + roomImages.length) % roomImages.length)
  }, [hasMultipleImages, roomImages.length])

  const goNextImage = useCallback(() => {
    if (!hasMultipleImages) return
    setSelectedImageIdx((prev) => (prev + 1) % roomImages.length)
  }, [hasMultipleImages, roomImages.length])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (activeTab === 'images') {
      fetchRoomImages()
    }
  }, [room.id, activeTab])

  useEffect(() => {
    const handleImageHotkeys = (event: KeyboardEvent) => {
      if (!isImageLightboxOpen) return

      if (event.key === 'Escape') {
        event.preventDefault()
        setIsImageLightboxOpen(false)
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goPrevImage()
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        goNextImage()
      }
    }

    window.addEventListener('keydown', handleImageHotkeys)
    return () => window.removeEventListener('keydown', handleImageHotkeys)
  }, [goNextImage, goPrevImage, isImageLightboxOpen])

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
        setIsImageLightboxOpen(false)
      } else {
        setRoomImages([])
      }
    } catch (err) {
      setRoomImages([])
    } finally {
      setLoading(false)
    }
  }

  const roomSchedules = roomAllocations.filter(a => matchesRoomAllocation(a.room, room.room, room.room_code, a.room_id, room.id, a.building))
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

  const selectedDayText = selectedScheduleDay === 'all' ? 'All days' : DAY_NAMES[selectedScheduleDay]

  const nextTodaySchedule = useMemo(() => {
    return parsedRoomSchedules
      .filter((entry) => entry.dayIndexes.includes(nowDayIndex) && entry.startMinutes > nowMinutes)
      .sort((a, b) => a.startMinutes - b.startMinutes)[0] || null
  }, [parsedRoomSchedules, nowDayIndex, nowMinutes])

  const ongoingNowSchedules = useMemo(() => {
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
      const currentEntry = ongoingNowSchedules[0]
      if (currentEntry) {
        return `Occupied until ${toReadableTime(currentEntry.endMinutes)}`
      }
      return 'Currently in use'
    }

    return 'Availability time unknown'
  }, [availability, nextTodaySchedule, ongoingNowSchedules])

  const equipmentList = useMemo(() => {
    const roomAny = room as any
    const tags: string[] = []

    if (typeof roomAny.equipment === 'string' && roomAny.equipment.trim()) {
      roomAny.equipment
        .split(',')
        .map((token: string) => token.trim())
        .filter(Boolean)
        .forEach((token: string) => tags.push(token))
    }

    if (toBoolean(roomAny.has_tv ?? roomAny.hasTV)) tags.push('TV')
    if (toBoolean(roomAny.has_projector ?? roomAny.hasProjector)) tags.push('Projector')
    if (toBoolean(roomAny.has_whiteboard ?? roomAny.hasWhiteboard)) tags.push('Whiteboard')
    if (toBoolean(roomAny.has_ac ?? roomAny.hasAC)) tags.push('Air Conditioned')
    if (toBoolean(roomAny.has_wifi ?? roomAny.hasWifi)) tags.push('WiFi')
    if (toBoolean(roomAny.has_lab_equipment ?? roomAny.hasLabEquipment)) tags.push('Lab Equipment')
    if (toBoolean(roomAny.is_accessible ?? roomAny.isPWDAccessible)) tags.push('PWD Accessible')

    const computerCount = Number(roomAny.has_computers)
    if (Number.isFinite(computerCount) && computerCount > 0) {
      tags.push(`Desktop PCs (${computerCount})`)
    }

    if (typeof roomAny.specific_classification === 'string' && roomAny.specific_classification.trim()) {
      tags.push(roomAny.specific_classification.trim())
    }

    return Array.from(new Set(tags))
  }, [room])

  const scheduleEntriesByDay = useMemo<DatedRoomSchedule[]>(() => {
    return parsedRoomSchedules
      .flatMap((entry) => entry.dayIndexes.map((dayIdx) => ({
        allocation: entry.allocation,
        dayIdx,
        startMinutes: entry.startMinutes,
        endMinutes: entry.endMinutes
      })))
      .sort((a, b) => {
        if (a.dayIdx !== b.dayIdx) return a.dayIdx - b.dayIdx
        return a.startMinutes - b.startMinutes
      })
  }, [parsedRoomSchedules])

  const dayButtonIndexes = useMemo(() => {
    const includesSunday = scheduleEntriesByDay.some((entry) => entry.dayIdx === 0)
    return includesSunday ? [1, 2, 3, 4, 5, 6, 0] : [1, 2, 3, 4, 5, 6]
  }, [scheduleEntriesByDay])

  const filteredScheduleEntries = useMemo(() => {
    if (selectedScheduleDay === 'all') return scheduleEntriesByDay
    return scheduleEntriesByDay.filter((entry) => entry.dayIdx === selectedScheduleDay)
  }, [scheduleEntriesByDay, selectedScheduleDay])

  const getScheduleStatus = useCallback((entry: DatedRoomSchedule): 'done' | 'ongoing' | 'upcoming' => {
    if (entry.dayIdx < nowDayIndex) return 'done'
    if (entry.dayIdx > nowDayIndex) return 'upcoming'
    if (nowMinutes >= entry.endMinutes) return 'done'
    if (nowMinutes >= entry.startMinutes && nowMinutes < entry.endMinutes) return 'ongoing'
    return 'upcoming'
  }, [nowDayIndex, nowMinutes])

  const scheduleSections = useMemo(() => {
    const done: DatedRoomSchedule[] = []
    const ongoing: DatedRoomSchedule[] = []
    const upcoming: DatedRoomSchedule[] = []

    filteredScheduleEntries.forEach((entry) => {
      const status = getScheduleStatus(entry)
      if (status === 'done') done.push(entry)
      else if (status === 'ongoing') ongoing.push(entry)
      else upcoming.push(entry)
    })

    return { done, ongoing, upcoming }
  }, [filteredScheduleEntries, getScheduleStatus])

  useEffect(() => {
    if (activeTab !== 'schedule') return
    if (selectedScheduleDay !== 'all') return
    if (nowDayIndex >= 1 && nowDayIndex <= 6) {
      setSelectedScheduleDay(nowDayIndex)
    }
  }, [activeTab, selectedScheduleDay, nowDayIndex])

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

              <div className={styles.equipmentSection}>
                <h3>Available Equipment</h3>
                {equipmentList.length === 0 ? (
                  <p className={styles.scheduleEmptyText}>No equipment metadata available for this room.</p>
                ) : (
                  <div className={styles.equipmentTagList}>
                    {equipmentList.map((item) => (
                      <span key={`equip-${item}`} className={styles.equipmentTag}>{item}</span>
                    ))}
                  </div>
                )}
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
                  <p>{hasLockedCurrentSchedule ? 'No scheduled classes for this room' : 'No locked current schedule is active in ViewSchedule'}</p>
                </div>
              ) : (
                <>
                  {/* Day filters + timetable button in one row */}
                  <div className={styles.scheduleTopBar}>
                    <div className={styles.scheduleDayFilters}>
                      <button
                        className={`${styles.scheduleDayBtn} ${selectedScheduleDay === 'all' ? styles.active : ''}`}
                        onClick={() => setSelectedScheduleDay('all')}
                      >
                        All
                      </button>
                      {dayButtonIndexes.map((dayIdx) => (
                        <button
                          key={`schedule-day-${dayIdx}`}
                          className={`${styles.scheduleDayBtn} ${selectedScheduleDay === dayIdx ? styles.active : ''}`}
                          onClick={() => setSelectedScheduleDay(dayIdx)}
                        >
                          {DAY_NAMES[dayIdx].slice(0, 3)}
                        </button>
                      ))}
                    </div>
                    <button
                      className={styles.timetableBtn}
                      onClick={() => setShowTimetableModal(true)}
                      title="Open fullscreen timetable"
                    >
                      <MdFullscreen size={14} />
                    </button>
                  </div>

                  <div className={styles.scheduleScopeText}>
                    {filteredScheduleEntries.length} class{filteredScheduleEntries.length !== 1 ? 'es' : ''} · {selectedDayText}
                  </div>

                  {/* Ongoing Section */}
                  {scheduleSections.ongoing.length > 0 && (
                    <div className={styles.scheduleSectionBlock}>
                      <div className={`${styles.scheduleSectionHeader} ${styles.sectionOngoing}`}>
                        <span className={styles.sectionLiveDot} />
                        <h4 className={styles.scheduleSectionTitle}>Ongoing</h4>
                        <span className={styles.sectionCount}>{scheduleSections.ongoing.length}</span>
                      </div>
                      <div className={styles.scheduleList}>
                        {scheduleSections.ongoing.map((entry, idx) => (
                          <div key={`ongoing-${entry.allocation.id ?? idx}-${entry.dayIdx}-${entry.startMinutes}`} className={`${styles.scheduleItem} ${styles.scheduleItemOngoing}`}>
                            <div className={styles.scheduleItemTop}>
                              <span className={styles.scheduleCourse}>{entry.allocation.course_code || 'N/A'}</span>
                              <span className={`${styles.scheduleStatusBadge} ${styles.badgeOngoing}`}>LIVE</span>
                            </div>
                            <div className={styles.scheduleItemMeta}>
                              <span className={styles.scheduleMetaItem}>
                                <MdAccessTime size={11} />
                                {entry.allocation.schedule_time || `${toReadableTime(entry.startMinutes)} - ${toReadableTime(entry.endMinutes)}`}
                              </span>
                              <span className={styles.scheduleMetaDivider} />
                              <span className={styles.scheduleMetaItem}>{entry.allocation.section || 'No section'}</span>
                              <span className={styles.scheduleMetaDivider} />
                              <span className={styles.scheduleMetaItem}>{DAY_NAMES[entry.dayIdx]}</span>
                            </div>
                            {(entry.allocation.teacher_name || entry.allocation.faculty_name) && (
                              <div className={styles.scheduleTeacher}>
                                {entry.allocation.teacher_name || entry.allocation.faculty_name}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upcoming Section */}
                  {scheduleSections.upcoming.length > 0 && (
                    <div className={styles.scheduleSectionBlock}>
                      <div className={`${styles.scheduleSectionHeader} ${styles.sectionUpcoming}`}>
                        <MdAccessTime size={12} />
                        <h4 className={styles.scheduleSectionTitle}>Upcoming</h4>
                        <span className={styles.sectionCount}>{scheduleSections.upcoming.length}</span>
                      </div>
                      <div className={styles.scheduleList}>
                        {scheduleSections.upcoming.map((entry, idx) => (
                          <div key={`upcoming-${entry.allocation.id ?? idx}-${entry.dayIdx}-${entry.startMinutes}`} className={`${styles.scheduleItem} ${styles.scheduleItemUpcoming}`}>
                            <div className={styles.scheduleItemTop}>
                              <span className={styles.scheduleCourse}>{entry.allocation.course_code || 'N/A'}</span>
                              <span className={`${styles.scheduleStatusBadge} ${styles.badgeUpcoming}`}>NEXT</span>
                            </div>
                            <div className={styles.scheduleItemMeta}>
                              <span className={styles.scheduleMetaItem}>
                                <MdAccessTime size={11} />
                                {entry.allocation.schedule_time || `${toReadableTime(entry.startMinutes)} - ${toReadableTime(entry.endMinutes)}`}
                              </span>
                              <span className={styles.scheduleMetaDivider} />
                              <span className={styles.scheduleMetaItem}>{entry.allocation.section || 'No section'}</span>
                              <span className={styles.scheduleMetaDivider} />
                              <span className={styles.scheduleMetaItem}>{DAY_NAMES[entry.dayIdx]}</span>
                            </div>
                            {(entry.allocation.teacher_name || entry.allocation.faculty_name) && (
                              <div className={styles.scheduleTeacher}>
                                {entry.allocation.teacher_name || entry.allocation.faculty_name}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Completed Section */}
                  {scheduleSections.done.length > 0 && (
                    <div className={styles.scheduleSectionBlock}>
                      <div className={`${styles.scheduleSectionHeader} ${styles.sectionDone}`}>
                        <MdCheckCircle size={12} />
                        <h4 className={styles.scheduleSectionTitle}>Completed</h4>
                        <span className={styles.sectionCount}>{scheduleSections.done.length}</span>
                      </div>
                      <div className={styles.scheduleList}>
                        {scheduleSections.done.map((entry, idx) => (
                          <div key={`done-${entry.allocation.id ?? idx}-${entry.dayIdx}-${entry.startMinutes}`} className={`${styles.scheduleItem} ${styles.scheduleItemDone}`}>
                            <div className={styles.scheduleItemTop}>
                              <span className={styles.scheduleCourse}>{entry.allocation.course_code || 'N/A'}</span>
                              <span className={`${styles.scheduleStatusBadge} ${styles.badgeDone}`}>DONE</span>
                            </div>
                            <div className={styles.scheduleItemMeta}>
                              <span className={styles.scheduleMetaItem}>
                                <MdAccessTime size={11} />
                                {entry.allocation.schedule_time || `${toReadableTime(entry.startMinutes)} - ${toReadableTime(entry.endMinutes)}`}
                              </span>
                              <span className={styles.scheduleMetaDivider} />
                              <span className={styles.scheduleMetaItem}>{entry.allocation.section || 'No section'}</span>
                              <span className={styles.scheduleMetaDivider} />
                              <span className={styles.scheduleMetaItem}>{DAY_NAMES[entry.dayIdx]}</span>
                            </div>
                            {(entry.allocation.teacher_name || entry.allocation.faculty_name) && (
                              <div className={styles.scheduleTeacher}>
                                {entry.allocation.teacher_name || entry.allocation.faculty_name}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Show empty state if all sections are empty after filtering */}
                  {scheduleSections.ongoing.length === 0 && scheduleSections.upcoming.length === 0 && scheduleSections.done.length === 0 && (
                    <div className={styles.emptyState}>
                      <MdCalendarToday size={28} />
                      <p>No classes for {selectedDayText}</p>
                    </div>
                  )}
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
                        <button
                          className={styles.imageExpandBtn}
                          onClick={() => setIsImageLightboxOpen(true)}
                          title="Open full view"
                        >
                          <MdFullscreen size={16} /> Full View
                        </button>
                        <img
                          src={roomImages[selectedImageIdx].image_url}
                          alt={`Room ${room.room}`}
                          className={`${styles.mainImage} ${styles.clickableImage}`}
                          onClick={() => setIsImageLightboxOpen(true)}
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

                  <div className={styles.imageMeta}>Photo {selectedImageIdx + 1} of {roomImages.length}</div>

                  {/* Image navigation */}
                  {hasMultipleImages && (
                    <div className={styles.imageNavigation}>
                      <button
                        className={styles.navBtn}
                        onClick={goPrevImage}
                        title="Previous"
                      >
                        <MdChevronLeft size={18} />
                      </button>
                      <span className={styles.imageCounter}>
                        {selectedImageIdx + 1} / {roomImages.length}
                      </span>
                      <button
                        className={styles.navBtn}
                        onClick={goNextImage}
                        title="Next"
                      >
                        <MdChevronRight size={18} />
                      </button>
                    </div>
                  )}

                  {/* Thumbnails */}
                  {hasMultipleImages && (
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

      {isImageLightboxOpen && roomImages[selectedImageIdx] && (
        <div className={styles.imageLightboxOverlay} onClick={() => setIsImageLightboxOpen(false)}>
          <div className={styles.imageLightboxContent} onClick={(event) => event.stopPropagation()}>
            <button
              className={styles.imageLightboxClose}
              onClick={() => setIsImageLightboxOpen(false)}
              aria-label="Close full image"
            >
              <MdClose size={18} />
            </button>

            {hasMultipleImages && (
              <button className={styles.imageLightboxNavBtn} onClick={goPrevImage} aria-label="Previous image">
                <MdChevronLeft size={20} />
              </button>
            )}

            <img
              src={roomImages[selectedImageIdx].image_url}
              alt={`Room ${room.room} photo ${selectedImageIdx + 1}`}
              className={styles.imageLightboxImage}
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="900" height="600"%3E%3Crect fill="%23e5e7eb" width="900" height="600"/%3E%3Ctext x="50%25" y="50%25" font-size="24" text-anchor="middle" dy=".3em" fill="%23999"%3EImage not found%3C/text%3E%3C/svg%3E'
              }}
            />

            {hasMultipleImages && (
              <button className={styles.imageLightboxNavBtn} onClick={goNextImage} aria-label="Next image">
                <MdChevronRight size={20} />
              </button>
            )}

            <div className={styles.imageLightboxFooter}>
              <span>{selectedImageIdx + 1} / {roomImages.length}</span>
              <span>{roomImages[selectedImageIdx].caption || `Photo of ${room.room}`}</span>
            </div>
          </div>
        </div>
      )}

      {showTimetableModal && (() => {
        const START_HOUR = 7
        const END_HOUR = 20
        const TOTAL_SLOTS = END_HOUR - START_HOUR // 13 hour rows
        const hourLabels: number[] = []
        for (let h = START_HOUR; h < END_HOUR; h++) hourLabels.push(h)

        // Build per-day entries with grid row positions
        type GridEntry = { entry: ParsedRoomSchedule; rowStart: number; rowSpan: number; status: 'done' | 'ongoing' | 'upcoming' }
        const dayGridEntries: Record<number, GridEntry[]> = {}
        WEEKDAY_COLUMNS.forEach((dayIdx) => {
          const entries = parsedRoomSchedules.filter((e) => e.dayIndexes.includes(dayIdx))
          dayGridEntries[dayIdx] = entries.map((entry) => {
            const clampedStart = Math.max(entry.startMinutes, START_HOUR * 60)
            const clampedEnd = Math.min(entry.endMinutes, END_HOUR * 60)
            const rowStart = (clampedStart - START_HOUR * 60) / 60
            const rowSpan = Math.max((clampedEnd - clampedStart) / 60, 0.5)
            // Determine status for this day
            let status: 'done' | 'ongoing' | 'upcoming' = 'upcoming'
            if (dayIdx < nowDayIndex) status = 'done'
            else if (dayIdx > nowDayIndex) status = 'upcoming'
            else if (nowMinutes >= entry.endMinutes) status = 'done'
            else if (nowMinutes >= entry.startMinutes && nowMinutes < entry.endMinutes) status = 'ongoing'
            return { entry, rowStart, rowSpan, status }
          })
        })

        // NOW indicator position (only show if today is Mon-Sat and within time range)
        const isTodayVisible = nowDayIndex >= 1 && nowDayIndex <= 6
        const isNowInRange = nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60
        const showNowLine = isTodayVisible && isNowInRange
        const nowRowOffset = showNowLine ? (nowMinutes - START_HOUR * 60) / 60 : 0
        const todayColIndex = WEEKDAY_COLUMNS.indexOf(nowDayIndex)

        return (
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
                <div className={styles.ttGrid} style={{ gridTemplateRows: `auto repeat(${TOTAL_SLOTS}, 56px)` }}>
                  {/* Header row */}
                  <div className={styles.ttCorner}>Time</div>
                  {WEEKDAY_COLUMNS.map((dayIdx) => (
                    <div
                      key={`head-${dayIdx}`}
                      className={`${styles.ttDayHeader} ${dayIdx === nowDayIndex ? styles.ttDayToday : ''}`}
                    >
                      {DAY_NAMES[dayIdx]}
                      {dayIdx === nowDayIndex && <span className={styles.ttTodayDot} />}
                    </div>
                  ))}

                  {/* Time labels + background cells */}
                  {hourLabels.map((h, i) => (
                    <React.Fragment key={`row-${h}`}>
                      <div className={styles.ttTimeLabel} style={{ gridRow: `${i + 2} / ${i + 3}`, gridColumn: 1 }}>
                        {toReadableTime(h * 60)}
                      </div>
                      {WEEKDAY_COLUMNS.map((dayIdx, di) => (
                        <div key={`bg-${dayIdx}-${h}`} className={styles.ttCell} style={{ gridRow: `${i + 2} / ${i + 3}`, gridColumn: di + 2 }} />
                      ))}
                    </React.Fragment>
                  ))}

                  {/* NOW indicator line */}
                  {showNowLine && (() => {
                    const nowRowStartInt = Math.floor(nowRowOffset)
                    const nowTopPx = (nowRowOffset - nowRowStartInt) * 56
                    return (
                      <>
                        {/* NOW label in time column */}
                        <div
                          className={styles.ttNowLabel}
                          style={{
                            gridRow: `${nowRowStartInt + 2} / ${nowRowStartInt + 3}`,
                            gridColumn: 1,
                            marginTop: `${nowTopPx - 10}px`,
                          }}
                        >
                          <span className={styles.ttNowBadge}>NOW</span>
                        </div>
                        {/* NOW line across all day columns */}
                        {WEEKDAY_COLUMNS.map((_dayIdx, di) => (
                          <div
                            key={`now-line-${di}`}
                            className={styles.ttNowLine}
                            style={{
                              gridRow: `${nowRowStartInt + 2} / ${nowRowStartInt + 3}`,
                              gridColumn: di + 2,
                              marginTop: `${nowTopPx}px`,
                            }}
                          />
                        ))}
                      </>
                    )
                  })()}

                  {/* Schedule entries spanning their full time range */}
                  {WEEKDAY_COLUMNS.map((dayIdx, di) =>
                    dayGridEntries[dayIdx].map((ge, idx) => {
                      const rowStartInt = Math.floor(ge.rowStart)
                      const rowEndInt = Math.ceil(ge.rowStart + ge.rowSpan)
                      const topOffset = (ge.rowStart - rowStartInt) * 56
                      const totalHeight = ge.rowSpan * 56
                      const statusClass = ge.status === 'done'
                        ? styles.ttEntryDone
                        : ge.status === 'ongoing'
                          ? styles.ttEntryOngoing
                          : ''
                      return (
                        <div
                          key={`entry-${dayIdx}-${ge.entry.allocation.id ?? idx}`}
                          className={`${styles.ttEntry} ${statusClass}`}
                          style={{
                            gridRow: `${rowStartInt + 2} / ${rowEndInt + 2}`,
                            gridColumn: di + 2,
                            marginTop: `${topOffset}px`,
                            height: `${totalHeight}px`,
                          }}
                        >
                          <div className={styles.timetableCourse}>{ge.entry.allocation.course_code || 'N/A'}</div>
                          <div className={styles.timetableMeta}>{ge.entry.allocation.section || 'No section'}</div>
                          <div className={styles.timetableMeta}>{ge.entry.allocation.schedule_time}</div>
                          {(ge.entry.allocation.teacher_name || ge.entry.allocation.faculty_name) && (
                            <div className={styles.timetableMeta}>{ge.entry.allocation.teacher_name || ge.entry.allocation.faculty_name}</div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
