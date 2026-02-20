'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import { useTheme } from '@/app/context/ThemeContext'

import styles from './styles.module.css'
import { MdMap as Map, MdDomain as Building2, MdLayers as Layers, MdAdd as Plus, MdRemove as Minus, MdOpenWith as Move, MdTouchApp as MousePointer, MdCropSquare as Square, MdTextFields as Type, MdDelete as Trash2, MdSave as Save, MdDownload as Download, MdSettings as Settings, MdVisibility as Eye, MdVisibilityOff as EyeOff, MdKeyboardArrowDown as ChevronDown, MdKeyboardArrowUp as ChevronUp, MdSearch as Search, MdClose as X, MdCheck as Check, MdShare as Share2, MdLink as Link, MdGridOn as Grid, MdZoomIn as ZoomIn, MdZoomOut as ZoomOut, MdMeetingRoom as DoorOpen, MdLocationCity as Building, MdPeople as Users, MdSchool as GraduationCap, MdScience as FlaskConical, MdMenuBook as BookOpen, MdLocalCafe as Coffee, MdVideocam as Projector, MdThermostat as Thermometer, MdRefresh as RefreshCw, MdDescription as FileText, MdKeyboardArrowRight as ChevronRight, MdKeyboardArrowLeft as ChevronLeft, MdEdit as Edit3, MdFolderOpen as FolderOpen, MdCheckBoxOutlineBlank as Box, MdFullscreen as Maximize2, MdGridView as LayoutGrid, MdDirectionsWalk as Footprints, MdInfo as Info, MdMonitor as Monitor, MdWarning as AlertTriangle, MdKeyboardDoubleArrowLeft as PanelLeftClose, MdKeyboardDoubleArrowRight as PanelLeftOpen, MdLoop as Loader2, MdReplay as RotateCcw, MdWifi as Wifi, MdAir as Wind, MdStar as Star, MdCalendarToday as Calendar, MdAccessTime as Clock, MdContentCopy as Copy, MdOpenInNew as ExternalLink, MdPalette as Palette, MdImage as ImageIcon, MdLock as Lock, MdLockOpen as Unlock, MdSwapVert as ArrowUpDown, MdLaptop as Laptop, MdScience as Beaker, MdLocalLibrary as Library, MdRestaurant as UtensilsCrossed, MdBathtub as Bath, MdArchive as Archive, MdFitnessCenter as Dumbbell, MdMusicNote as Music, MdTheaters as Theater, MdCoPresent as Presentation, MdDns as Server, MdRadioButtonChecked as CircleDot, MdChangeHistory as Triangle, MdHexagon as Hexagon, MdPentagon as Pentagon, MdStop as Octagon, MdFavorite as Heart, MdFlashOn as Zap, MdLocalFireDepartment as Flame, MdWaterDrop as Droplets, MdSunny as Sun, MdDarkMode as Moon, MdArrowUpward as MoveUp, MdArrowDownward as MoveDown, MdKeyboardDoubleArrowUp as ChevronsUp, MdKeyboardDoubleArrowDown as ChevronsDown, MdViewList as LayoutList, MdDragHandle as Grip, MdSelectAll as BoxSelect, MdMenu as Menu, MdBuild as Wrench, MdCheckCircle as CheckCircle, MdEdit as Edit, MdMan, MdWoman } from 'react-icons/md'

// Untyped supabase helper for tables not in generated types
const db = supabase as any

// Types
interface Room {
  id: number
  room: string
  room_code?: string
  building: string
  campus: string
  school_name?: string
  capacity: number
  floor_number?: number
  room_type?: string
  has_ac?: boolean
  has_projector?: boolean
  has_whiteboard?: boolean
  has_tv?: boolean
  has_wifi?: boolean
  status?: string
  notes?: string
  college?: string
  specific_classification?: string
}

interface Schedule {
  id: number
  schedule_name: string
  school_name: string
  semester: string
  academic_year: string
  is_default?: boolean
  created_at: string
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
  isLocked?: boolean
  orientation?: 'horizontal' | 'vertical'  // For hallways
  opacity?: number  // 0-100 for transparency
  borderWidth?: number
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
  is_published: boolean
  status: string
  linked_schedule_id?: number
  created_at: string
  updated_at: string
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

// Icon options for toolbox
const ICON_OPTIONS = [
  { name: 'exit', icon: DoorOpen, label: 'Exit' },
  { name: 'stairs', icon: Footprints, label: 'Stairs' },
  { name: 'elevator', icon: ArrowUpDown, label: 'Elevator' },
  { name: 'restroom', icon: Bath, label: 'Restroom' },
  { name: 'men_room', icon: MdMan, label: 'Mens Room' },
  { name: 'women_room', icon: MdWoman, label: 'Womens Room' },
  { name: 'computer', icon: Laptop, label: 'Computer' },
  { name: 'lab', icon: Beaker, label: 'Lab' },
  { name: 'library', icon: Library, label: 'Library' },
  { name: 'cafeteria', icon: UtensilsCrossed, label: 'Cafeteria' },
  { name: 'storage', icon: Archive, label: 'Storage' },
  { name: 'gym', icon: Dumbbell, label: 'Gym' },
  { name: 'music', icon: Music, label: 'Music' },
  { name: 'theater', icon: Theater, label: 'Theater' },
  { name: 'presentation', icon: Presentation, label: 'Presentation' },
  { name: 'server', icon: Server, label: 'Server Room' },
  { name: 'wifi', icon: Wifi, label: 'WiFi Zone' },
  { name: 'ac', icon: Wind, label: 'AC' },
  { name: 'fire', icon: Flame, label: 'Fire Exit' },
  { name: 'water', icon: Droplets, label: 'Water' },
  { name: 'info', icon: Info, label: 'Info' },
  { name: 'warning', icon: AlertTriangle, label: 'Warning' },
]

// Standard paper sizes for canvas (at 96 DPI)
const PAPER_SIZES = {
  letter: { name: 'Letter (8.5" x 11")', width: 1056, height: 816 },
  legal: { name: 'Legal (8.5" x 14")', width: 1344, height: 816 },
  a4: { name: 'A4 (210 x 297 mm)', width: 1123, height: 794 },
  custom: { name: 'Custom size', width: 0, height: 0 }
}

// Shape options
const SHAPE_OPTIONS = [
  { name: 'circle', icon: CircleDot, label: 'Circle' },
  { name: 'triangle', icon: Triangle, label: 'Triangle' },
  { name: 'hexagon', icon: Hexagon, label: 'Hexagon' },
  { name: 'pentagon', icon: Pentagon, label: 'Pentagon' },
  { name: 'octagon', icon: Octagon, label: 'Octagon' },
  { name: 'star', icon: Star, label: 'Star' },
  { name: 'heart', icon: Heart, label: 'Heart' },
]

// Toolbox items for drag and drop
const TOOLBOX_ITEMS = {
  structures: [
    { type: 'wall', label: 'Wall', icon: Box, color: '#374151', width: 100, height: 10 },
    { type: 'hallway', label: 'Hallway', icon: Move, color: '#d1d5db', width: 200, height: 60 },
  ],
  elements: [
    { type: 'door', label: 'Door', icon: DoorOpen, color: '#10b981', width: 40, height: 10 },
    { type: 'stair', label: 'Stairs', icon: Footprints, color: '#f59e0b', width: 80, height: 60 },
  ],
  labels: [
    { type: 'text', label: 'Text Label', icon: Type, color: '#1f2937', width: 100, height: 30 },
  ]
}

export default function MapViewerPage() {
  const router = useRouter()
  const { theme: globalTheme } = useTheme() // Use global theme from context
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [menuBarHidden, setMenuBarHidden] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)

  // Responsive detection
  const [mounted, setMounted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isTablet, setIsTablet] = useState(false)
  const [showMobileWarning, setShowMobileWarning] = useState(false)

  // Panel state
  const leftPanelOpenRef = useRef(true)
  const rightPanelOpenRef = useRef(true)

  const [leftPanelOpen, _setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, _setRightPanelOpen] = useState(true)

  const setLeftPanelOpen = (val: boolean) => {
    leftPanelOpenRef.current = val
    _setLeftPanelOpen(val)
  }

  const setRightPanelOpen = (val: boolean) => {
    rightPanelOpenRef.current = val
    _setRightPanelOpen(val)
  }

  // Resizing state
  const [resizingElement, setResizingElement] = useState<string | null>(null)
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, elementX: 0, elementY: 0 })

  // Mode state: 'editor' for editing, 'floorplan' for view-only, 'live' for real-time availability
  const [viewMode, setViewMode] = useState<'editor' | 'floorplan' | 'live'>('editor')
  const [showScheduleOverlay, setShowScheduleOverlay] = useState(false)

  // Toolbox sections
  const [sectionsOpen, setSectionsOpen] = useState({
    roomsZones: true,
    structures: false,
    doorsElements: false,
    labelsIcons: false,
    shapes: false
  })

  // Data state
  const [buildings, setBuildings] = useState<string[]>([])
  const [floors, setFloors] = useState<number[]>([])
  const [selectedBuilding, setSelectedBuilding] = useState<string>('')
  const [selectedFloor, setSelectedFloor] = useState<number>(1)
  const [allRooms, setAllRooms] = useState<Room[]>([])
  const [canvasElements, setCanvasElements] = useState<CanvasElement[]>([])
  const [selectedElement, setSelectedElement] = useState<CanvasElement | null>(null)

  // Floor plan data
  const [savedFloorPlans, setSavedFloorPlans] = useState<FloorPlan[]>([])
  const [currentFloorPlan, setCurrentFloorPlan] = useState<FloorPlan | null>(null)
  const [floorPlanName, setFloorPlanName] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [isPublished, setIsPublished] = useState(false)
  const [isEditingMetadata, setIsEditingMetadata] = useState(false)
  const [metadataForm, setMetadataForm] = useState({
    floor_name: '',
    building: '',
    floor_number: 1
  })
  const [buildingsList, setBuildingsList] = useState<{ id: number; name: string }[]>([])
  const [showMobileDetails, setShowMobileDetails] = useState(false)

  // Schedule integration
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null)
  const [roomAllocations, setRoomAllocations] = useState<RoomAllocation[]>([])
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [selectedDay, setSelectedDay] = useState<string>('')
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('')

  // Canvas state
  const [zoom, setZoom] = useState(75)
  const [snapToGrid, setSnapToGrid] = useState(true)
  const [showGrid, setShowGrid] = useState(true)
  const [gridSize, setGridSize] = useState(20)
  const [canvasSize, setCanvasSize] = useState({ width: 1056, height: 816 }) // Letter Bond Paper 11x8.5" landscape at 96 DPI
  const [presetSize, setPresetSize] = useState<keyof typeof PAPER_SIZES>('letter')
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const [canvasBackground, setCanvasBackground] = useState('#ffffff')

  // Draggable controls card state
  const [controlsPos, setControlsPos] = useState<{ x: number; y: number } | null>(null)
  const [isDraggingControls, setIsDraggingControls] = useState(false)
  const controlsDragOffset = useRef({ x: 0, y: 0 })
  const controlsRef = useRef<HTMLDivElement>(null)
  const logoImageRef = useRef<HTMLImageElement | null>(null)

  // Drag handlers for floating controls card
  const handleControlsDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const card = controlsRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    const parentRect = card.offsetParent?.getBoundingClientRect() || { left: 0, top: 0 }
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    controlsDragOffset.current = {
      x: clientX - rect.left,
      y: clientY - rect.top
    }
    setIsDraggingControls(true)
    setControlsPos({
      x: rect.left - parentRect.left,
      y: rect.top - parentRect.top
    })
  }, [])

  // Preload logo for export
  useEffect(() => {
    const img = new Image()
    img.src = '/app-icon.png'
    img.onload = () => {
      logoImageRef.current = img
    }
  }, [])

  useEffect(() => {
    if (!isDraggingControls) return
    const moveHandler = (clientX: number, clientY: number) => {
      const card = controlsRef.current
      if (!card) return
      const parentRect = card.offsetParent?.getBoundingClientRect() || { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
      const newX = clientX - parentRect.left - controlsDragOffset.current.x
      const newY = clientY - parentRect.top - controlsDragOffset.current.y
      const maxX = parentRect.width - (card.offsetWidth || 220)
      const maxY = parentRect.height - (card.offsetHeight || 200)
      setControlsPos({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      })
    }
    const handleMouseMove = (e: MouseEvent) => moveHandler(e.clientX, e.clientY)
    const handleTouchMoveControls = (e: TouchEvent) => {
      e.preventDefault()
      moveHandler(e.touches[0].clientX, e.touches[0].clientY)
    }
    const handleUp = () => setIsDraggingControls(false)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleUp)
    window.addEventListener('touchmove', handleTouchMoveControls, { passive: false })
    window.addEventListener('touchend', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleUp)
      window.removeEventListener('touchmove', handleTouchMoveControls)
      window.removeEventListener('touchend', handleUp)
    }
  }, [isDraggingControls])

  // Layer state
  const [showLayersPanel, setShowLayersPanel] = useState(false)
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({})

  // Drag state
  const [isDragging, setIsDragging] = useState(false)
  const [dragItem, setDragItem] = useState<any>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [dragGhost, setDragGhost] = useState<{ x: number; y: number } | null>(null)
  const [draggingElement, setDraggingElement] = useState<string | null>(null)
  const [pointerDragActive, setPointerDragActive] = useState(false)
  const [initialDragPositions, setInitialDragPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const ignoreUnsavedRef = useRef(false)

  // Interaction Ref to avoid stale state in high-frequency events (panning, dragging, resizing)
  const interactionRef = useRef({
    isPanning: false,
    panStart: { x: 0, y: 0 },
    draggingElement: null as string | null,
    resizingElement: null as string | null,
    resizeHandle: null as string | null,
    dragOffset: { x: 0, y: 0 },
    resizeStart: { x: 0, y: 0, width: 0, height: 0, elementX: 0, elementY: 0 },
    initialDragPositions: {} as Record<string, { x: number; y: number }>
  })

  // UI state
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)

  const autoHideMobileToolbox = useCallback(() => {
    if (!isMobile) return
    setActiveMobilePanel('none')
    setLeftPanelOpen(false)
  }, [isMobile])

  const updateDragGhostFromPointer = useCallback((clientX: number, clientY: number) => {
    if (viewMode !== 'editor' || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const scale = zoom / 100
    let x = (clientX - rect.left) / scale
    let y = (clientY - rect.top) / scale
    x = snapToGridPosition(x)
    y = snapToGridPosition(y)
    setDragGhost({ x, y })
  }, [viewMode, zoom])

  const placeDraggedItem = useCallback((clientX: number, clientY: number) => {
    if (viewMode !== 'editor' || !canvasRef.current || !dragItem) return
    const rect = canvasRef.current.getBoundingClientRect()
    const scale = zoom / 100
    let x = (clientX - rect.left) / scale
    let y = (clientY - rect.top) / scale

    x = snapToGridPosition(x)
    y = snapToGridPosition(y)

    if (dragItem.type === 'room') {
      const room = dragItem.data as Room
      const exists = canvasElements.find(el => el.linkedRoomId === room.id)
      if (exists) {
        showNotification('info', 'Room already on canvas')
      } else {
        const colors = getRoomColor(room.room_type)
        const newElement: CanvasElement = {
          id: generateId(),
          type: 'room',
          x,
          y,
          width: 140,
          height: 100,
          rotation: 0,
          label: room.room,
          color: colors.bg,
          borderColor: colors.border,
          linkedRoomId: room.id,
          linkedRoomData: room,
          zIndex: canvasElements.length + 1
        }
        setCanvasElements(prev => [...prev, newElement])
        showNotification('success', `Added ${room.room} to canvas`)
      }
    } else if (dragItem.type === 'toolbox') {
      const item = dragItem.data
      const newElement: CanvasElement = {
        id: generateId(),
        type: item.type,
        x,
        y,
        width: item.width || 100,
        height: item.height || 60,
        rotation: 0,
        label: item.label,
        color: item.color,
        borderColor: item.color,
        zIndex: canvasElements.length + 1
      }
      setCanvasElements(prev => [...prev, newElement])
      showNotification('success', `Added ${item.label} to canvas`)
    } else if (dragItem.type === 'icon') {
      const iconOption = dragItem.data
      const newElement: CanvasElement = {
        id: generateId(),
        type: 'icon',
        x,
        y,
        width: 50,
        height: 50,
        rotation: 0,
        label: iconOption.label,
        color: '#6366f1',
        iconType: iconOption.name,
        zIndex: canvasElements.length + 1
      }
      setCanvasElements(prev => [...prev, newElement])
      showNotification('success', `Added ${iconOption.label} icon`)
    } else if (dragItem.type === 'shape') {
      const shapeOption = dragItem.data
      const newElement: CanvasElement = {
        id: generateId(),
        type: 'shape',
        x,
        y,
        width: 60,
        height: 60,
        rotation: 0,
        label: shapeOption.label,
        color: '#10b981',
        shapeType: shapeOption.name,
        zIndex: canvasElements.length + 1
      }
      setCanvasElements(prev => [...prev, newElement])
      showNotification('success', `Added ${shapeOption.label} shape`)
    }

    setDragItem(null)
    setIsDragging(false)
    setDragGhost(null)
  }, [viewMode, dragItem, zoom, canvasElements])

  useEffect(() => {
    if (!pointerDragActive) return

    const handlePointerMove = (e: PointerEvent) => {
      updateDragGhostFromPointer(e.clientX, e.clientY)
    }

    const handlePointerUp = (e: PointerEvent) => {
      placeDraggedItem(e.clientX, e.clientY)
      setPointerDragActive(false)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [pointerDragActive, updateDragGhostFromPointer, placeDraggedItem])
  const [searchQuery, setSearchQuery] = useState('')
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showExportPreview, setShowExportPreview] = useState(false)
  const exportCanvasRef = useRef<HTMLCanvasElement>(null)
  const [exportSettings, setExportSettings] = useState({
    title: '',
    subtitle: '',
    buildingLabel: '',
    floorName: '',
    floorNumber: '',
    showWatermark: true,
    showLegend: true,
    showDate: true,
    showScheduleInfo: true,
    showRoomLabels: true,
    roomFontSize: 9,
    titleFontSize: 22,
    orientation: 'auto' as 'auto' | 'landscape' | 'portrait',
    paperSize: 'letter' as 'letter' | 'legal' | 'a4' | 'custom',
    customPaperWidth: 800,
    customPaperHeight: 600,
    mapScale: 100, // 100% of fit
    useWhiteBackground: true
  })
  const [activeRightTab, setActiveRightTab] = useState<'properties' | 'layers'>('properties')

  // Auth state to prevent rendering before auth check completes
  const [authChecked, setAuthChecked] = useState(false)
  const [isAuthorized, setIsAuthorized] = useState(false)

  // Mobile FAB state
  const [showMobileFAB, setShowMobileFAB] = useState(false)
  const [activeMobilePanel, setActiveMobilePanel] = useState<'none' | 'toolbox' | 'properties' | 'floorPlans'>('none')

  // Toggle mobile panels
  const toggleMobilePanel = (panel: 'toolbox' | 'properties' | 'floorPlans') => {
    setActiveMobilePanel(current => {
      const next = current === panel ? 'none' : panel

      // Sync with desktop panel state
      if (next === 'none') {
        setLeftPanelOpen(false)
        setRightPanelOpen(false)
      } else if (next === 'toolbox' || next === 'floorPlans') {
        setLeftPanelOpen(true)
        setRightPanelOpen(false)
      } else if (next === 'properties') {
        setLeftPanelOpen(false)
        setRightPanelOpen(true)
      }

      return next
    })
  }

  // Multi-select state
  const [selectedElements, setSelectedElements] = useState<string[]>([])
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false)
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null)
  const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; y: number } | null>(null)
  const [selectMode, setSelectMode] = useState<'single' | 'multi' | 'pan'>('single')
  const interactionHandledRef = useRef<boolean>(false)
  const justSelectedElementRef = useRef<string | null>(null)

  // Undo/redo history
  const [history, setHistory] = useState<CanvasElement[][]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const isUndoRedoRef = useRef(false)

  // Record state to history whenever canvasElements changes (but not from undo/redo itself)
  useEffect(() => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false
      return
    }
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1)
      newHistory.push(canvasElements)
      // Keep last 50 states
      if (newHistory.length > 50) newHistory.shift()
      return newHistory
    })
    setHistoryIndex(prev => Math.min(prev + 1, 49))

    if (!isUndoRedoRef.current && !ignoreUnsavedRef.current) {
      setHasUnsavedChanges(true)
    }
    ignoreUnsavedRef.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasElements])

  const undo = useCallback(() => {
    if (historyIndex <= 0) return
    const newIndex = historyIndex - 1
    isUndoRedoRef.current = true
    setCanvasElements(history[newIndex])
    setHistoryIndex(newIndex)
    setSelectedElement(null)
    // showNotification called after declaration below
    setNotification({ type: 'info', message: 'Undo' })
    setTimeout(() => setNotification(null), 3000)
  }, [history, historyIndex])

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return
    const newIndex = historyIndex + 1
    isUndoRedoRef.current = true
    setCanvasElements(history[newIndex])
    setHistoryIndex(newIndex)
    setSelectedElement(null)
    setNotification({ type: 'info', message: 'Redo' })
    setTimeout(() => setNotification(null), 3000)
  }, [history, historyIndex])

  // Editing state
  const [editForm, setEditForm] = useState({
    label: '',
    type: '',
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    color: '',
    rotation: 0,
    iconType: '',
    fontSize: 14,
    opacity: 100,
    borderWidth: 2
  })

  // Sync canvas background with global theme
  useEffect(() => {
    // Update canvas background based on global theme
    if (globalTheme === 'dark') {
      setCanvasBackground('#1a1f3a')
    } else if (canvasBackground === '#1a1f3a') {
      // Reset to white if coming from dark mode
      setCanvasBackground('#ffffff')
    }
  }, [globalTheme])

  const toggleSidebar = () => setSidebarOpen(prev => !prev)
  const handleMenuBarToggle = (isHidden: boolean) => setMenuBarHidden(isHidden)

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElement && viewMode === 'editor') {
          e.preventDefault()
          removeElement(selectedElement.id)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, selectedElement, viewMode])

  // Spacebar panning listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        setIsSpacePressed(true)
        if (e.target === document.body) e.preventDefault()
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpacePressed(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // Show notification
  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 3000)
  }

  // Track whether panels were open before mobile collapse
  const panelsBeforeMobileRef = useRef({ left: true, right: true })

  // Device detection for responsive adjustments
  const wasMobileRef = useRef<boolean | null>(null)
  const isFirstCheckRef = useRef(true)

  useEffect(() => {
    setMounted(true)
    const checkDevice = () => {
      const width = window.innerWidth
      const isNowMobile = width < 768
      const prevWasMobile = wasMobileRef.current

      setIsMobile(isNowMobile)
      setIsTablet(width >= 768 && width < 1024)

      // Only handle transitions to/from mobile, or initial check
      if (isFirstCheckRef.current) {
        if (isNowMobile) {
          // Initial load on mobile: hide panels but don't overwrite ref yet
          setLeftPanelOpen(false)
          setRightPanelOpen(false)
          setShowMobileFAB(true)
        } else {
          setShowMobileFAB(false)
        }
        isFirstCheckRef.current = false
      } else if (isNowMobile && prevWasMobile === false) {
        // Entering mobile from desktop: save current state and collapse
        panelsBeforeMobileRef.current = { left: leftPanelOpenRef.current, right: rightPanelOpenRef.current }
        setLeftPanelOpen(false)
        setRightPanelOpen(false)
        setShowMobileFAB(true)
      } else if (!isNowMobile && prevWasMobile === true) {
        // Leaving mobile to desktop: restore panels
        setLeftPanelOpen(panelsBeforeMobileRef.current.left)
        setRightPanelOpen(panelsBeforeMobileRef.current.right)
        setShowMobileFAB(false)
        setActiveMobilePanel('none')
      }

      wasMobileRef.current = isNowMobile
    }

    checkDevice()
    window.addEventListener('resize', checkDevice)
    return () => window.removeEventListener('resize', checkDevice)
    // Removed leftPanelOpen, rightPanelOpen from dependencies to prevent closure cycle
  }, []) // Depend on nothing for the resize listener, but it will use current state via closure if we're careful.
  // Actually, to get current panel state during transition, we might need a ref for them or use the state from the last render.
  // But wait, the transition only happens ONCE during resize. 
  // The issue was it re-running on every toggle.


  // Update current time for live mode
  useEffect(() => {
    if (viewMode === 'live') {
      if (!currentTime) setCurrentTime(new Date())
      const interval = setInterval(() => {
        setCurrentTime(new Date())
      }, 60000) // Update every minute
      return () => clearInterval(interval)
    }
  }, [viewMode])

  // Auto-fit zoom: calculate best zoom to fit canvas in viewport on mount/resize
  useEffect(() => {
    const container = canvasContainerRef.current
    if (!container) return
    const fitZoom = () => {
      const padding = 80 // 40px on each side
      const availW = container.clientWidth - padding
      const availH = container.clientHeight - padding
      if (availW <= 0 || availH <= 0) return
      const scaleX = (availW / canvasSize.width) * 100
      const scaleY = (availH / canvasSize.height) * 100
      const best = Math.min(scaleX, scaleY, 100) // never exceed 100%
      // Only set zoom initially if it hasn't been set by user
      if (zoom === 75) {
        setZoom(Math.max(25, Math.round(best / 25) * 25))
      }
    }
    // Run once after a short delay so the container has its real size
    const timer = setTimeout(fitZoom, 200)
    // Only run on mount, don't observe resize to avoid resetting user zoom
    return () => { clearTimeout(timer) }
  }, []) // Empty dependency array to run only once on mount

  // Auth check - sequential initialization
  useEffect(() => {
    let isMounted = true

    const initPage = async () => {
      const authorized = await checkAuth()
      if (isMounted && authorized) {
        setIsAuthorized(true)
        setAuthChecked(true)
        await Promise.all([fetchBuildings(), fetchSchedules()])
      } else if (isMounted) {
        setAuthChecked(true)
      }
    }

    initPage()

    return () => {
      isMounted = false
    }
  }, [])

  const checkAuth = async (): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/')
        return false
      }
      if (session.user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        router.push('/faculty/home')
        return false
      }
      return true
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/')
      return false
    }
  }

  // Fetch buildings from campuses table
  const fetchBuildings = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('campuses')
        .select('building, floor_number')

      if (error) {
        console.error('Error fetching buildings:', error)
        return
      }

      // Get unique buildings
      const uniqueBuildings = [...new Set((data || [])
        .map((d: { building: string }) => d.building)
        .filter(Boolean)
      )] as string[]

      console.log('Fetched buildings:', uniqueBuildings)
      setBuildings(uniqueBuildings)

      // Note: Using building name as identifier since 'buildings' table is not present in SQL schema
      // and 'floor_plans' currently lacks a building_id column.
      try {
        const { data: bData } = await db.from('buildings').select('id, name')
        if (bData) setBuildingsList(bData)
      } catch (e) {
        // Silently fail if table doesn't exist, as we fall back to string-based building names
      }

      if (uniqueBuildings.length > 0) {
        setSelectedBuilding(uniqueBuildings[0])
      }
    } catch (error) {
      console.error('Error fetching buildings:', error)
      showNotification('error', 'Failed to load buildings')
    } finally {
      setLoading(false)
    }
  }

  // Fetch schedules
  const fetchSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('generated_schedules')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      const scheduleData = (data || []) as Schedule[]
      setSchedules(scheduleData)

      // Find most recent schedule as "default" (since is_default may not exist)
      if (scheduleData.length > 0) {
        setSelectedScheduleId(scheduleData[0].id)
      }
    } catch (error) {
      console.error('Error fetching schedules:', error)
    }
  }

  // Fetch room allocations when schedule selected
  useEffect(() => {
    if (selectedScheduleId) {
      fetchRoomAllocations()
    }
  }, [selectedScheduleId])

  const fetchRoomAllocations = async () => {
    if (!selectedScheduleId) return

    try {
      const { data, error } = await supabase
        .from('room_allocations')
        .select('*')
        .eq('schedule_id', selectedScheduleId)

      if (error) throw error
      setRoomAllocations(data || [])
    } catch (error) {
      console.error('Error fetching allocations:', error)
    }
  }

  // Fetch rooms when building/floor changes
  useEffect(() => {
    if (selectedBuilding) {
      fetchRooms()
      fetchSavedFloorPlans()
    }
  }, [selectedBuilding, selectedFloor])

  const fetchRooms = async () => {
    if (!selectedBuilding) return

    try {
      setLoading(true)
      console.log('Fetching rooms for building:', selectedBuilding, 'floor:', selectedFloor)

      // First get all rooms for this building
      let query = supabase
        .from('campuses')
        .select('*')
        .eq('building', selectedBuilding)
        .order('room', { ascending: true })

      // Only filter by floor if we have a valid floor number
      if (selectedFloor && selectedFloor > 0) {
        query = query.eq('floor_number', selectedFloor)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching rooms:', error)
        showNotification('error', 'Failed to load rooms')
        return
      }

      console.log('Fetched rooms:', data?.length || 0)
      setAllRooms(data || [])

      // Get unique floors for this building
      const { data: floorData } = await supabase
        .from('campuses')
        .select('floor_number')
        .eq('building', selectedBuilding)

      const roomFloors = [...new Set(
        (floorData || [])
          .map((r: { floor_number: number }) => r.floor_number)
          .filter(f => f != null && f > 0)
      )] as number[]

      setFloors(roomFloors.sort((a, b) => a - b))

      // If no floor selected and we have floors, select the first one
      if (!selectedFloor && roomFloors.length > 0) {
        setSelectedFloor(roomFloors[0])
      }

    } catch (error) {
      console.error('Error fetching rooms:', error)
      showNotification('error', 'Failed to load rooms')
    } finally {
      setLoading(false)
    }
  }

  // Fetch saved floor plans for current building
  const fetchSavedFloorPlans = async (skipAutoLoad = false) => {
    try {
      const { data, error } = await db
        .from('floor_plans')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.log('Floor plans table might not exist yet')
        return
      }

      const floorPlanData = (data || []) as FloorPlan[]
      setSavedFloorPlans(floorPlanData)

      if (skipAutoLoad) return

      // Find matching floor plan for current building/floor
      const match = floorPlanData.find(fp => {
        const isSameBuilding = fp.canvas_data?.building === selectedBuilding ||
          fp.floor_name?.toLowerCase().includes(selectedBuilding.toLowerCase());
        return isSameBuilding && fp.floor_number === selectedFloor;
      })
      if (match) {
        loadFloorPlan(match)
      }
    } catch (error) {
      console.error('Error fetching floor plans:', error)
    }
  }

  // Load a floor plan
  const loadFloorPlan = (floorPlan: FloorPlan) => {
    if (hasUnsavedChanges) {
      if (!window.confirm("You have unsaved changes that will be lost. Do you want to continue?")) {
        return
      }
    }
    ignoreUnsavedRef.current = true
    setHasUnsavedChanges(false)
    setCurrentFloorPlan(floorPlan)
    setFloorPlanName(floorPlan.floor_name)
    setIsDefault(floorPlan.is_default_view)
    setIsPublished(floorPlan.is_published || false)
    if (floorPlan.canvas_data?.elements) {
      // Normalize element data to fix missing/undefined fields from older saves
      const normalizedElements = floorPlan.canvas_data.elements.map((el: any) => ({
        ...el,
        x: Number(el.x) || 0,
        y: Number(el.y) || 0,
        width: Number(el.width) || 100,
        height: Number(el.height) || 60,
        rotation: Number(el.rotation) || 0,
        zIndex: Number(el.zIndex) || 1,
        opacity: el.opacity != null ? Number(el.opacity) : 100,
        borderWidth: el.borderWidth != null ? Number(el.borderWidth) : 2,
      }))
      setCanvasElements(normalizedElements)
    }
    if (floorPlan.canvas_data?.canvasSize) {
      const size = floorPlan.canvas_data.canvasSize
      setCanvasSize(size)

      // Detect preset
      const match = Object.entries(PAPER_SIZES).find(([key, val]) =>
        key !== 'custom' && val.width === size.width && val.height === size.height
      )
      if (match) {
        setPresetSize(match[0] as keyof typeof PAPER_SIZES)
      } else {
        setPresetSize('custom')
      }
    }
    if (floorPlan.linked_schedule_id) {
      setSelectedScheduleId(floorPlan.linked_schedule_id)
    }
    showNotification('success', `Loaded: ${floorPlan.floor_name}`)
  }

  // Delete floor plan
  const deleteFloorPlan = async (id: number) => {
    if (!confirm('Are you sure you want to delete this floor plan?')) return

    try {
      const { error } = await db
        .from('floor_plans')
        .delete()
        .eq('id', id)

      if (error) throw error

      setSavedFloorPlans(prev => prev.filter(fp => fp.id !== id))
      if (currentFloorPlan?.id === id) {
        createNewDraft()
      }
      showNotification('success', 'Floor plan deleted')
    } catch (error) {
      console.error('Error deleting floor plan:', error)
      showNotification('error', 'Failed to delete floor plan')
    }
  }

  // Get room color based on type
  const getRoomColor = (roomType?: string) => {
    const type = roomType?.toLowerCase().replace(/\s+/g, '_') || 'default'
    return ROOM_TYPE_COLORS[type] || ROOM_TYPE_COLORS.default
  }

  // Get room availability status
  const getRoomAvailability = (roomName: string): 'available' | 'occupied' | 'unknown' => {
    if (!showScheduleOverlay || !selectedScheduleId || roomAllocations.length === 0) {
      return 'unknown'
    }

    const now = currentTime || new Date()
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const currentDay = selectedDay || dayNames[now.getDay()]
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()

    // Check if room has any allocation at current time
    const isOccupied = roomAllocations.some(alloc => {
      if (alloc.room !== roomName) return false

      const allocDay = alloc.schedule_day?.toLowerCase()
      if (!allocDay?.includes(currentDay)) return false

      // Parse time range
      const timeParts = alloc.schedule_time?.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
      if (!timeParts) return false

      let startHour = parseInt(timeParts[1])
      const startMin = parseInt(timeParts[2])
      const startPeriod = timeParts[3]?.toUpperCase()
      let endHour = parseInt(timeParts[4])
      const endMin = parseInt(timeParts[5])
      const endPeriod = timeParts[6]?.toUpperCase()

      // Convert to 24-hour
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

  // Get current class for a room
  const getCurrentClass = (roomName: string): RoomAllocation | null => {
    if (!selectedScheduleId || roomAllocations.length === 0) return null

    const now = currentTime || new Date()
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const currentDay = selectedDay || dayNames[now.getDay()]
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

  // Snap position to grid
  const snapToGridPosition = (value: number) => {
    if (!snapToGrid) return value
    return Math.round(value / gridSize) * gridSize
  }

  // Generate unique ID
  const generateId = () => `element_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // Handle element selection focus
  const selectElement = useCallback((element: CanvasElement, multiSelect: boolean = false) => {
    if (multiSelect) {
      setSelectedElements(prev => {
        if (prev.includes(element.id)) {
          return prev.filter(id => id !== element.id)
        } else {
          return [...prev, element.id]
        }
      })
      if (selectedElement?.id === element.id) {
        setSelectedElement(null)
      } else if (!selectedElement) {
        setSelectedElement(element)
      }
    } else {
      setSelectedElement(element)
      setSelectedElements([element.id])
    }

    // Always update edit form when focusing an element
    setEditForm({
      label: element.label || '',
      type: element.type,
      width: element.width,
      height: element.height,
      x: element.x,
      y: element.y,
      color: element.color || getRoomColor(element.linkedRoomData?.room_type).bg,
      rotation: element.rotation,
      iconType: element.iconType || '',
      fontSize: element.fontSize || 14,
      opacity: element.opacity ?? 100,
      borderWidth: element.borderWidth ?? 2
    })
  }, [selectedElement])

  // Handle element selection
  const handleElementClick = (element: CanvasElement, e: React.MouseEvent) => {
    e.stopPropagation()
    if (element.isLocked && viewMode === 'editor') return

    // If this element was just selected during down/start, don't toggle it again on click
    if (justSelectedElementRef.current === element.id) {
      justSelectedElementRef.current = null
      return
    }

    selectElement(element, e.ctrlKey || e.metaKey || e.shiftKey || selectMode === 'multi')
    justSelectedElementRef.current = null
  }

  // Real-time property sync: apply editForm changes to the selected element immediately
  useEffect(() => {
    if (!selectedElement || viewMode !== 'editor' || draggingElement || resizingElement) return
    // Debounce slightly to avoid thrashing during fast input
    const timer = setTimeout(() => {
      updateElement(selectedElement.id, {
        label: editForm.label,
        width: editForm.width,
        height: editForm.height,
        x: editForm.x,
        y: editForm.y,
        color: editForm.color,
        rotation: editForm.rotation,
        iconType: editForm.iconType,
        fontSize: editForm.fontSize,
        opacity: editForm.opacity,
        borderWidth: editForm.borderWidth
      })
    }, 50)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editForm])

  // Handle canvas click (deselect)
  const handleCanvasClick = (e: React.MouseEvent) => {
    // Only deselect if clicking exactly on the canvas background or container
    const isBackground = e.target === canvasRef.current || e.target === canvasContainerRef.current
    if (isBackground) {
      setSelectedElement(null)
      setSelectedElements([])
    }
  }

  const handlePointerDragStart = (itemType: 'room' | 'toolbox' | 'icon' | 'shape', data: any, clientX: number, clientY: number) => {
    if (viewMode !== 'editor' || !isMobile) return
    autoHideMobileToolbox()
    setDragItem({ type: itemType, data })
    setIsDragging(true)
    setPointerDragActive(true)
    updateDragGhostFromPointer(clientX, clientY)
  }

  // Handle room drag start from toolbox
  const handleRoomDragStart = (e: React.DragEvent, room: Room) => {
    if (viewMode !== 'editor') return
    autoHideMobileToolbox()
    setDragItem({ type: 'room', data: room })
    setIsDragging(true)

    // Create a transparent drag image to hide the browser's default ghost
    const img = new window.Image()
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    e.dataTransfer.setDragImage(img, 0, 0)

    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'room', roomId: room.id }))
  }

  // Handle toolbox item drag start
  const handleToolboxDragStart = (e: React.DragEvent, item: any) => {
    if (viewMode !== 'editor') return
    autoHideMobileToolbox()
    setDragItem({ type: 'toolbox', data: item })
    setIsDragging(true)

    const img = new window.Image()
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    e.dataTransfer.setDragImage(img, 0, 0)

    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'toolbox', itemType: item.type }))
  }

  // Handle icon drag start
  const handleIconDragStart = (e: React.DragEvent, iconOption: any) => {
    if (viewMode !== 'editor') return
    autoHideMobileToolbox()
    setDragItem({ type: 'icon', data: iconOption })
    setIsDragging(true)

    const img = new window.Image()
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    e.dataTransfer.setDragImage(img, 0, 0)

    e.dataTransfer.effectAllowed = 'copy'
  }

  // Handle shape drag start
  const handleShapeDragStart = (e: React.DragEvent, shapeOption: any) => {
    if (viewMode !== 'editor') return
    autoHideMobileToolbox()
    setDragItem({ type: 'shape', data: shapeOption })
    setIsDragging(true)

    const img = new window.Image()
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    e.dataTransfer.setDragImage(img, 0, 0)

    e.dataTransfer.effectAllowed = 'copy'
  }

  // Handle drag over canvas
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (viewMode !== 'editor' || !canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const scale = zoom / 100
    let x = (e.clientX - rect.left) / scale
    let y = (e.clientY - rect.top) / scale

    x = snapToGridPosition(x)
    y = snapToGridPosition(y)

    setDragGhost({ x, y })
  }

  // Handle drop on canvas
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    placeDraggedItem(e.clientX, e.clientY)
  }

  const handleElementDragStart = (e: React.MouseEvent, element: CanvasElement) => {
    e.stopPropagation()
    if (viewMode !== 'editor' || element.isLocked) return

    // Selection logic for dragging - ensure primary focus
    if (!selectedElements.includes(element.id)) {
      selectElement(element, e.ctrlKey || e.metaKey || e.shiftKey || selectMode === 'multi')
      // Track that we just selected this so we don't toggle it off on the click event
      justSelectedElementRef.current = element.id
    } else if (selectedElement?.id !== element.id && !(e.ctrlKey || e.metaKey || e.shiftKey || selectMode === 'multi')) {
      // If part of multi-selection but not primary, make it primary on drag start
      setSelectedElement(element)
      setEditForm({
        label: element.label || '',
        type: element.type,
        width: element.width,
        height: element.height,
        x: element.x,
        y: element.y,
        color: element.color || getRoomColor(element.linkedRoomData?.room_type).bg,
        rotation: element.rotation,
        iconType: element.iconType || '',
        fontSize: element.fontSize || 14,
        opacity: element.opacity ?? 100,
        borderWidth: element.borderWidth ?? 2
      })
    }

    const scale = (zoom || 75) / 100
    if (!canvasRef.current || scale <= 0) return
    const canvasRect = canvasRef.current.getBoundingClientRect()

    const clickX = (e.clientX - canvasRect.left) / scale
    const clickY = (e.clientY - canvasRect.top) / scale

    const offset = {
      x: clickX - element.x,
      y: clickY - element.y
    }

    setDraggingElement(element.id)
    setDragOffset(offset)

    // Capture initial positions of ALL selected elements for stable relative movement
    const selections = selectedElements.includes(element.id) ? selectedElements : [element.id]
    const initialPos: Record<string, { x: number; y: number }> = {}
    canvasElements.forEach(el => {
      if (selections.includes(el.id)) {
        initialPos[el.id] = { x: el.x, y: el.y }
      }
    })
    setInitialDragPositions(initialPos)

    // Update Interaction Ref
    interactionRef.current.draggingElement = element.id
    interactionRef.current.dragOffset = offset
    interactionRef.current.initialDragPositions = initialPos
  }

  const handleElementDrag = (e: React.MouseEvent | React.TouchEvent) => {
    const draggingElId = interactionRef.current.draggingElement
    if (!draggingElId || !canvasRef.current || viewMode !== 'editor') return

    const rect = canvasRef.current.getBoundingClientRect()
    const scale = (zoom || 75) / 100
    if (scale <= 0) return

    // Anchor element initial position
    const anchorInitial = interactionRef.current.initialDragPositions[draggingElId]
    if (!anchorInitial) return

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    // Calculate absolute target position for the anchor
    const rawX = (clientX - rect.left) / scale - interactionRef.current.dragOffset.x
    const rawY = (clientY - rect.top) / scale - interactionRef.current.dragOffset.y

    const snappedX = snapToGridPosition(rawX)
    const snappedY = snapToGridPosition(rawY)

    if (isNaN(snappedX) || isNaN(snappedY)) return

    // Calculate total displacement from the start of the drag
    const totalDx = snappedX - anchorInitial.x
    const totalDy = snappedY - anchorInitial.y

    if (totalDx === 0 && totalDy === 0) return

    setCanvasElements(prev => prev.map(el => {
      const initial = interactionRef.current.initialDragPositions[el.id]
      if (initial) {
        const nextX = initial.x + totalDx
        const nextY = initial.y + totalDy
        return { ...el, x: isNaN(nextX) ? el.x : nextX, y: isNaN(nextY) ? el.y : nextY }
      }
      return el
    }))
  }

  const handleElementDragEnd = () => {
    setDraggingElement(null)
    setInitialDragPositions({})
    interactionRef.current.draggingElement = null
    interactionRef.current.initialDragPositions = {}
  }

  const handleResizeStart = (e: React.MouseEvent, elementId: string, handle: string) => {
    e.stopPropagation()
    e.preventDefault()
    if (viewMode !== 'editor') return

    const element = canvasElements.find(el => el.id === elementId)
    if (!element || element.isLocked) return

    const startValues = {
      x: e.clientX,
      y: e.clientY,
      width: element.width,
      height: element.height,
      elementX: element.x,
      elementY: element.y
    }

    setResizingElement(elementId)
    setResizeHandle(handle)
    setResizeStart(startValues)

    // Clear dragging state to prevent other elements from moving while resizing
    setDraggingElement(null)
    setInitialDragPositions({})
    interactionRef.current.draggingElement = null
    interactionRef.current.initialDragPositions = {}

    interactionRef.current.resizingElement = elementId
    interactionRef.current.resizeHandle = handle
    interactionRef.current.resizeStart = startValues
  }

  const handleResizeMove = (e: React.MouseEvent | React.TouchEvent) => {
    const resId = interactionRef.current.resizingElement
    const handle = interactionRef.current.resizeHandle
    if (!resId || !handle || viewMode !== 'editor') return

    const element = canvasElements.find(el => el.id === resId)
    if (!element) return

    const scale = (zoom || 75) / 100
    if (scale <= 0) return

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    const start = interactionRef.current.resizeStart
    const deltaX = (clientX - start.x) / scale
    const deltaY = (clientY - start.y) / scale

    if (isNaN(deltaX) || isNaN(deltaY)) return

    let newWidth = start.width
    let newHeight = start.height
    let newX = start.elementX
    let newY = start.elementY

    // Handle different resize directions
    if (handle.includes('e')) {
      newWidth = Math.max(40, snapToGridPosition(start.width + deltaX))
    }
    if (handle.includes('w')) {
      const proposedWidth = snapToGridPosition(start.width - deltaX)
      newWidth = Math.max(40, proposedWidth)
      newX = start.elementX + (start.width - newWidth)
    }
    if (handle.includes('s')) {
      newHeight = Math.max(40, snapToGridPosition(start.height + deltaY))
    }
    if (handle.includes('n')) {
      const proposedHeight = snapToGridPosition(start.height - deltaY)
      newHeight = Math.max(40, proposedHeight)
      newY = start.elementY + (start.height - newHeight)
    }

    if (isNaN(newWidth) || isNaN(newHeight) || isNaN(newX) || isNaN(newY)) return

    setCanvasElements(prev => prev.map(el =>
      el.id === resId ? { ...el, width: newWidth, height: newHeight, x: newX, y: newY } : el
    ))
  }

  const handleResizeEnd = () => {
    setResizingElement(null)
    setResizeHandle(null)
    interactionRef.current.resizingElement = null
    interactionRef.current.resizeHandle = null
  }

  // Touch event handlers for mobile support
  const handleTouchStart = (e: React.TouchEvent, element: CanvasElement) => {
    if (viewMode !== 'editor' || element.isLocked) return
    const touch = e.touches[0]
    if (!touch) return

    if (!canvasRef.current) return
    const canvasRect = canvasRef.current.getBoundingClientRect()
    const scale = (zoom || 75) / 100
    if (scale <= 0) return

    const clickX = (touch.clientX - canvasRect.left) / scale
    const clickY = (touch.clientY - canvasRect.top) / scale

    const offset = {
      x: clickX - element.x,
      y: clickY - element.y
    }

    // Ensure selected on touch start
    if (!selectedElements.includes(element.id)) {
      selectElement(element, selectMode === 'multi')
      justSelectedElementRef.current = element.id
    } else if (selectedElement?.id !== element.id && selectMode !== 'multi') {
      setSelectedElement(element)
    }

    setDraggingElement(element.id)
    setDragOffset(offset)

    // Capture initial positions of ALL selected elements for stable relative movement
    const selections = selectedElements.includes(element.id) ? selectedElements : [element.id]
    const initialPos: Record<string, { x: number; y: number }> = {}
    canvasElements.forEach(el => {
      if (selections.includes(el.id)) {
        initialPos[el.id] = { x: el.x, y: el.y }
      }
    })
    setInitialDragPositions(initialPos)

    interactionRef.current.draggingElement = element.id
    interactionRef.current.dragOffset = offset
    interactionRef.current.initialDragPositions = initialPos
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!interactionRef.current.draggingElement && !interactionRef.current.resizingElement) return

    // Prevent scrolling while interacting with elements
    if (e.cancelable) e.preventDefault()

    handleElementDrag(e)
    handleResizeMove(e)
  }

  const handleTouchEnd = () => {
    handleElementDragEnd()
    handleResizeEnd()
  }

  const handleResizeTouchStart = (e: React.TouchEvent, elementId: string, handle: string) => {
    e.stopPropagation()
    e.preventDefault()
    if (viewMode !== 'editor') return

    const element = canvasElements.find(el => el.id === elementId)
    if (!element || element.isLocked) return

    const touch = e.touches[0]
    const startValues = {
      x: touch.clientX,
      y: touch.clientY,
      width: element.width,
      height: element.height,
      elementX: element.x,
      elementY: element.y
    }

    setResizingElement(elementId)
    setResizeHandle(handle)
    setResizeStart(startValues)

    // Clear dragging state
    setDraggingElement(null)
    setInitialDragPositions({})
    interactionRef.current.draggingElement = null
    interactionRef.current.initialDragPositions = {}

    interactionRef.current.resizingElement = elementId
    interactionRef.current.resizeHandle = handle
    interactionRef.current.resizeStart = startValues
  }

  // Marquee selection handlers
  const handleMarqueeStart = (e: React.MouseEvent) => {
    if (viewMode !== 'editor' || selectMode !== 'multi') return
    if ((e.target as HTMLElement).closest(`.${styles.canvasElement}`)) return // Don't start if clicking on an element

    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const scale = zoom / 100
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale

    setIsMarqueeSelecting(true)
    setMarqueeStart({ x, y })
    setMarqueeEnd({ x, y })
  }

  const handleMarqueeMove = (e: React.MouseEvent) => {
    if (!isMarqueeSelecting || !canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const scale = zoom / 100
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale

    setMarqueeEnd({ x, y })
  }

  const handleMarqueeEnd = () => {
    if (!isMarqueeSelecting || !marqueeStart || !marqueeEnd) {
      setIsMarqueeSelecting(false)
      return
    }

    // Calculate selection box bounds
    const left = Math.min(marqueeStart.x, marqueeEnd.x)
    const right = Math.max(marqueeStart.x, marqueeEnd.x)
    const top = Math.min(marqueeStart.y, marqueeEnd.y)
    const bottom = Math.max(marqueeStart.y, marqueeEnd.y)

    // Find all elements that intersect with the selection box
    const selected = canvasElements.filter(el => {
      const elRight = el.x + el.width
      const elBottom = el.y + el.height

      // Check if element intersects with selection box
      return el.x < right && elRight > left && el.y < bottom && elBottom > top
    }).map(el => el.id)

    setSelectedElements(selected)
    if (selected.length === 1) {
      const el = canvasElements.find(e => e.id === selected[0])
      if (el) setSelectedElement(el)
    } else if (selected.length > 1) {
      setSelectedElement(null) // Clear single selection when multiple selected
    }

    setIsMarqueeSelecting(false)
    setMarqueeStart(null)
    setMarqueeEnd(null)
  }

  // Toggle selection mode
  const toggleSelectMode = () => {
    setSelectMode(prev => {
      if (prev === 'single') return 'multi'
      if (prev === 'multi') return 'pan'
      return 'single'
    })
    setSelectedElements([])
  }

  // Handle canvas mouse down
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Middle click OR Left click with Space OR Left click in Pan mode
    if (e.button === 1 || (e.button === 0 && (isSpacePressed || selectMode === 'pan'))) {
      setIsPanning(true)
      setPanStart({ x: e.clientX, y: e.clientY })
      interactionRef.current.isPanning = true
      interactionRef.current.panStart = { x: e.clientX, y: e.clientY }
      return
    }

    // Only handle marquee or click if not clicking on an element (which stops propagation)
    if (selectMode === 'multi') {
      handleMarqueeStart(e)
    }
    // Deselection is now strictly handled by handleCanvasClick for better accuracy
  }

  // Handle canvas mouse move
  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (interactionRef.current.isPanning && canvasContainerRef.current) {
      const dx = e.clientX - interactionRef.current.panStart.x
      const dy = e.clientY - interactionRef.current.panStart.y

      // Use scrollLeft/scrollTop for natural panning
      canvasContainerRef.current.scrollLeft -= dx
      canvasContainerRef.current.scrollTop -= dy

      interactionRef.current.panStart = { x: e.clientX, y: e.clientY }
      return
    }

    // These are now also handled by window listeners for better robustness, 
    // but kept here for backward compatibility/multi-layered event handling
    if (interactionRef.current.draggingElement) handleElementDrag(e)
    if (interactionRef.current.resizingElement) handleResizeMove(e)
    if (isMarqueeSelecting) handleMarqueeMove(e)
  }

  // Handle canvas mouse up
  const handleCanvasMouseUp = () => {
    if (interactionRef.current.isPanning) {
      setIsPanning(false)
      interactionRef.current.isPanning = false
    }

    if (interactionRef.current.draggingElement) handleElementDragEnd()
    if (interactionRef.current.resizingElement) handleResizeEnd()
    if (isMarqueeSelecting) handleMarqueeEnd()
  }

  // Global interaction listeners for robustness
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (interactionRef.current.draggingElement) handleElementDrag(e as any)
      if (interactionRef.current.resizingElement) handleResizeMove(e as any)
      if (isMarqueeSelecting) handleMarqueeMove(e as any)
    }

    const handleGlobalMouseUp = () => {
      if (interactionRef.current.draggingElement) handleElementDragEnd()
      if (interactionRef.current.resizingElement) handleResizeEnd()
      if (isMarqueeSelecting) handleMarqueeEnd()
    }

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (interactionRef.current.draggingElement || interactionRef.current.resizingElement) {
        if (e.cancelable) e.preventDefault()
        handleElementDrag(e as any)
        handleResizeMove(e as any)
      }
    }

    if (draggingElement || resizingElement || isMarqueeSelecting) {
      window.addEventListener('mousemove', handleGlobalMouseMove)
      window.addEventListener('mouseup', handleGlobalMouseUp)
      window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false })
      window.addEventListener('touchend', handleGlobalMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove)
      window.removeEventListener('mouseup', handleGlobalMouseUp)
      window.removeEventListener('touchmove', handleGlobalTouchMove)
      window.removeEventListener('touchend', handleGlobalMouseUp)
    }
  }, [draggingElement, resizingElement, isMarqueeSelecting])

  // Clear all selections
  const clearSelection = () => {
    setSelectedElements([])
    setSelectedElement(null)
  }

  // Delete selected elements
  const deleteSelectedElements = () => {
    if (selectedElements.length > 0) {
      setCanvasElements(prev => prev.filter(el => !selectedElements.includes(el.id)))
      setSelectedElements([])
      showNotification('success', `${selectedElements.length} element(s) removed`)
    } else if (selectedElement) {
      removeElement(selectedElement.id)
    }
  }



  // Toggle hallway orientation
  const toggleHallwayOrientation = (elementId: string) => {
    setCanvasElements(prev => prev.map(el => {
      if (el.id === elementId && el.type === 'hallway') {
        const newOrientation = el.orientation === 'vertical' ? 'horizontal' : 'vertical'
        // Swap width and height when toggling orientation
        return {
          ...el,
          orientation: newOrientation,
          width: el.height,
          height: el.width
        }
      }
      return el
    }))
  }

  // Update element
  const updateElement = (elementId: string, updates: Partial<CanvasElement>) => {
    setCanvasElements(prev => prev.map(el =>
      el.id === elementId ? { ...el, ...updates } : el
    ))
    if (selectedElement?.id === elementId) {
      setSelectedElement(prev => prev ? { ...prev, ...updates } : null)
    }
  }

  // Delete element from canvas
  const removeElement = (elementId: string) => {
    setCanvasElements(prev => prev.filter(el => el.id !== elementId))
    if (selectedElement?.id === elementId) {
      setSelectedElement(null)
    }
    showNotification('success', 'Element removed')
  }

  // Toggle element lock
  const toggleElementLock = (elementId: string) => {
    setCanvasElements(prev => prev.map(el =>
      el.id === elementId ? { ...el, isLocked: !el.isLocked } : el
    ))
  }

  // Layer management functions
  const moveLayerUp = (elementId: string) => {
    setCanvasElements(prev => {
      const sorted = [...prev].sort((a, b) => a.zIndex - b.zIndex)
      const idx = sorted.findIndex(el => el.id === elementId)
      if (idx < sorted.length - 1) {
        // Swap z-indices with the element above
        const currentZ = sorted[idx].zIndex
        const aboveZ = sorted[idx + 1].zIndex
        return prev.map(el => {
          if (el.id === elementId) return { ...el, zIndex: aboveZ }
          if (el.id === sorted[idx + 1].id) return { ...el, zIndex: currentZ }
          return el
        })
      }
      return prev
    })
  }

  const moveLayerDown = (elementId: string) => {
    setCanvasElements(prev => {
      const sorted = [...prev].sort((a, b) => a.zIndex - b.zIndex)
      const idx = sorted.findIndex(el => el.id === elementId)
      if (idx > 0) {
        // Swap z-indices with the element below
        const currentZ = sorted[idx].zIndex
        const belowZ = sorted[idx - 1].zIndex
        return prev.map(el => {
          if (el.id === elementId) return { ...el, zIndex: belowZ }
          if (el.id === sorted[idx - 1].id) return { ...el, zIndex: currentZ }
          return el
        })
      }
      return prev
    })
  }

  const bringToFront = (elementId: string) => {
    setCanvasElements(prev => {
      const maxZ = Math.max(...prev.map(el => el.zIndex), 0)
      return prev.map(el =>
        el.id === elementId ? { ...el, zIndex: maxZ + 1 } : el
      )
    })
  }

  const sendToBack = (elementId: string) => {
    setCanvasElements(prev => {
      const minZ = Math.min(...prev.map(el => el.zIndex), 0)
      return prev.map(el =>
        el.id === elementId ? { ...el, zIndex: minZ - 1 } : el
      )
    })
  }

  const toggleLayerVisibility = (elementId: string) => {
    setLayerVisibility(prev => ({
      ...prev,
      [elementId]: prev[elementId] === undefined ? false : !prev[elementId]
    }))
  }

  const isLayerVisible = (elementId: string) => {
    return layerVisibility[elementId] !== false
  }

  // Clear canvas
  const clearCanvas = () => {
    if (viewMode !== 'editor') return
    setCanvasElements([])
    setSelectedElement(null)
    showNotification('info', 'Canvas cleared')
  }

  // Update floor plan metadata
  const updateFloorPlanMetadata = async () => {
    if (!currentFloorPlan) return

    try {
      setSaving(true)
      const { data, error } = await db
        .from('floor_plans')
        .update({
          floor_name: metadataForm.floor_name,
          floor_number: metadataForm.floor_number,
          canvas_data: {
            ...currentFloorPlan.canvas_data,
            building: metadataForm.building
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', currentFloorPlan.id)
        .select()

      if (error) throw error

      showNotification('success', 'Floor plan details updated')
      setIsEditingMetadata(false)
      setCurrentFloorPlan(prev => prev ? {
        ...prev,
        floor_name: metadataForm.floor_name,
        floor_number: metadataForm.floor_number,
        canvas_data: {
          ...prev.canvas_data,
          building: metadataForm.building
        }
      } : null)
      fetchSavedFloorPlans(true)
    } catch (error) {
      console.error('Error updating metadata:', error)
      showNotification('error', 'Failed to update details')
    } finally {
      setSaving(false)
    }
  }

  const startEditingMetadata = () => {
    if (!currentFloorPlan) return
    setMetadataForm({
      floor_name: currentFloorPlan.floor_name,
      building: currentFloorPlan.canvas_data?.building || selectedBuilding || '',
      floor_number: currentFloorPlan.floor_number
    })
    setIsEditingMetadata(true)
  }

  // Save floor plan
  const saveFloorPlan = async () => {
    // Easier naming: Default to just "Floor X" if no name is provided
    const defaultName = `Floor ${selectedFloor}`
    const finalName = floorPlanName.trim() || defaultName

    // If the name is already the default or just a floor description, 
    // we don't need to force the building dash into the UI state
    if (!floorPlanName.trim()) {
      setFloorPlanName(finalName)
    }

    try {
      setSaving(true)

      const canvasData = {
        elements: canvasElements,
        canvasSize,
        zoom,
        gridSize,
        building: selectedBuilding, // Save building name for grouping
        backgroundColor: canvasBackground
      }

      // Try to find building_id
      let bId = 1
      const foundB = buildingsList.find(b => b.name === selectedBuilding)
      if (foundB) bId = foundB.id

      // If setting as default, unset other defaults first
      // Without building_id in schema, we unset by floor_number or rely on name matching
      if (isDefault) {
        await db
          .from('floor_plans')
          .update({ is_default_view: false })
          .eq('is_default_view', true)
          .ilike('floor_name', `%${selectedBuilding}%`)
      }

      if (currentFloorPlan?.id) {
        // Update existing
        console.log('Updating floor plan ID:', currentFloorPlan.id)
        const { data: updateData, error: updateError } = await db
          .from('floor_plans')
          .update({
            floor_name: finalName,
            canvas_data: canvasData,
            canvas_width: canvasSize.width,
            canvas_height: canvasSize.height,
            grid_size: gridSize,
            background_color: canvasBackground,
            is_default_view: isDefault,
            is_published: isPublished,
            status: isPublished ? 'published' : 'draft',
            linked_schedule_id: selectedScheduleId,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentFloorPlan.id)
          .select()

        if (updateError) throw updateError
        if (!updateData || updateData.length === 0) {
          throw new Error('Update failed - database did not confirm the change. Check RLS policies in Supabase.')
        }

        // Update local state with fresh data from DB
        setCurrentFloorPlan(updateData[0] as FloorPlan)
        showNotification('success', `Floor plan ${isPublished ? 'published' : 'saved as draft'}!`)
      } else {
        // Create new
        const { data: sessionData } = await supabase.auth.getSession()
        const session = sessionData?.session

        const { data: insertData, error: insertError } = await db
          .from('floor_plans')
          .insert([{
            floor_number: selectedFloor,
            floor_name: finalName,
            canvas_data: canvasData,
            canvas_width: canvasSize.width,
            canvas_height: canvasSize.height,
            grid_size: gridSize,
            background_color: canvasBackground,
            is_default_view: isDefault,
            is_published: isPublished,
            status: isPublished ? 'published' : 'draft',
            linked_schedule_id: selectedScheduleId,
            created_by: session?.user?.id
          }])
          .select()
          .single()

        if (insertError) throw insertError
        setCurrentFloorPlan(insertData as FloorPlan)
        showNotification('success', `Floor plan ${isPublished ? 'published' : 'saved as draft'}!`)
      }

      setHasUnsavedChanges(false)
      setShowSaveModal(false)
      await fetchSavedFloorPlans(true) // Refresh the list
    } catch (error: any) {
      console.error('Save failure details:', error)
      const details = error?.details || error?.hint || ''
      const msg = error?.message || (typeof error === 'string' ? error : '')
      const errMsg = msg + (details ? ` (${details})` : '') || 'Unknown error - bridge to Supabase might be disconnected.'

      showNotification('error', `Save failed: ${errMsg}`)
    } finally {
      setSaving(false)
    }
  }



  // Create a new blank draft
  const createNewDraft = () => {
    if (hasUnsavedChanges) {
      if (!window.confirm("You have unsaved changes. Are you sure you want to clear the canvas for a new draft?")) {
        return
      }
    }
    ignoreUnsavedRef.current = true
    setHasUnsavedChanges(false)
    setCanvasElements([])
    setSelectedElements([])
    setSelectedElement(null)
    setFloorPlanName('')
    setCurrentFloorPlan(null)
    setIsDefault(false)
    setIsPublished(false)
    setShowLoadModal(false)

    // Reset canvas size to default Letter
    setCanvasSize(PAPER_SIZES.letter)
    setPresetSize('letter')
    showNotification('success', 'Canvas cleared — ready for a new draft')
  }

  // Open export preview modal
  const openExportPreview = () => {
    setExportSettings(prev => ({
      ...prev,
      title: prev.title || floorPlanName || `${selectedBuilding} - Floor ${selectedFloor}`,
      subtitle: prev.subtitle || (schedules.find(s => s.id === selectedScheduleId)?.schedule_name || ''),
      buildingLabel: prev.buildingLabel || selectedBuilding || '',
      floorName: prev.floorName || (currentFloorPlan?.floor_name || `Floor ${selectedFloor}`),
      floorNumber: prev.floorNumber || String(currentFloorPlan?.floor_number || selectedFloor),
    }))
    setShowExportPreview(true)
    // Render preview after modal opens
    setTimeout(() => renderExportPreview(), 100)
  }

  // Render the export preview on a canvas
  const renderExportPreview = useCallback(() => {
    const canvas = exportCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Preview at a reasonable size (scaled down)
    const previewW = 800
    const previewH = 600
    canvas.width = previewW
    canvas.height = previewH

    const paper = exportSettings.paperSize === 'custom'
      ? { width: exportSettings.customPaperWidth, height: exportSettings.customPaperHeight }
      : PAPER_SIZES[exportSettings.paperSize] || PAPER_SIZES.letter

    const widthMm = paper.width * (25.4 / 96)
    const heightMm = paper.height * (25.4 / 96)

    const isLandscape = exportSettings.orientation === 'auto'
      ? widthMm > heightMm
      : exportSettings.orientation === 'landscape'
    const pageW = isLandscape ? Math.max(widthMm, heightMm) : Math.min(widthMm, heightMm)
    const pageH = isLandscape ? Math.min(widthMm, heightMm) : Math.max(widthMm, heightMm)

    // Scale factor to fit page in preview
    const sf = Math.min(previewW / pageW, previewH / pageH) * 0.92
    const offsetX = (previewW - pageW * sf) / 2
    const offsetY = (previewH - pageH * sf) / 2

    // Clear
    ctx.fillStyle = '#e2e8f0'
    ctx.fillRect(0, 0, previewW, previewH)

    // Draw page shadow
    ctx.shadowColor = 'rgba(0,0,0,0.15)'
    ctx.shadowBlur = 12
    ctx.shadowOffsetX = 4
    ctx.shadowOffsetY = 4
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(offsetX, offsetY, pageW * sf, pageH * sf)
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0

    // Page border
    ctx.strokeStyle = '#cbd5e1'
    ctx.lineWidth = 1
    ctx.strokeRect(offsetX, offsetY, pageW * sf, pageH * sf)

    const m = pageW * 0.05 * sf // margin
    const px = offsetX + m
    const py = offsetY + m
    const contentW = pageW * sf - m * 2
    const contentH = pageH * sf - m * 2

    // ===== WATERMARK =====
    if (exportSettings.showWatermark) {
      ctx.save()
      ctx.globalAlpha = 0.04
      ctx.translate(offsetX + pageW * sf / 2, offsetY + pageH * sf / 2)
      ctx.rotate(-Math.PI / 6)

      // Large Q box
      const wSize = Math.min(pageW, pageH) * sf * 0.35
      ctx.fillStyle = '#16a34a'
      const radius = wSize * 0.12
      const qX = -wSize / 2
      const qY = -wSize / 2
      ctx.beginPath()
      ctx.moveTo(qX + radius, qY)
      ctx.lineTo(qX + wSize - radius, qY)
      ctx.quadraticCurveTo(qX + wSize, qY, qX + wSize, qY + radius)
      ctx.lineTo(qX + wSize, qY + wSize - radius)
      ctx.quadraticCurveTo(qX + wSize, qY + wSize, qX + wSize - radius, qY + wSize)
      ctx.lineTo(qX + radius, qY + wSize)
      ctx.quadraticCurveTo(qX, qY + wSize, qX, qY + wSize - radius)
      ctx.lineTo(qX, qY + radius)
      ctx.quadraticCurveTo(qX, qY, qX + radius, qY)
      ctx.closePath()
      ctx.fill()

      // Q letter
      ctx.fillStyle = '#ffffff'
      ctx.font = `bold ${wSize * 0.7}px Arial`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Q', 0, 0)

      // "time" text below
      ctx.fillStyle = '#16a34a'
      ctx.font = `bold ${wSize * 0.22}px Arial`
      ctx.fillText('time', 0, wSize / 2 + wSize * 0.15)

      ctx.restore()
    }

    // ===== COMPACT HEADER (all labels in one tight block) =====
    const titleY = py + 6 * sf
    const maxTextW = contentW - 4 * sf

    // Title — primary text
    const titleFontPx = Math.max(6 * sf, (exportSettings.titleFontSize / 22) * 7.5 * sf)
    ctx.fillStyle = '#0f172a'
    ctx.font = `bold ${titleFontPx}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(exportSettings.title || 'Floor Plan', offsetX + pageW * sf / 2, titleY, maxTextW)

    let infoY = titleY + titleFontPx + 2 * sf

    // Schedule subtitle (if enabled)
    if (exportSettings.showScheduleInfo && exportSettings.subtitle) {
      ctx.fillStyle = '#475569'
      ctx.font = `${4 * sf}px Arial`
      ctx.textAlign = 'center'
      ctx.fillText(exportSettings.subtitle, offsetX + pageW * sf / 2, infoY, maxTextW)
      infoY += 5 * sf
    }

    // Building / Floor / Date — all on ONE compact line to save space
    {
      ctx.fillStyle = '#94a3b8'
      ctx.font = `${3 * sf}px Arial`
      ctx.textAlign = 'center'
      const metaParts: string[] = []
      if (exportSettings.buildingLabel) metaParts.push(`Building: ${exportSettings.buildingLabel}`)
      if (exportSettings.floorName) metaParts.push(`Floor: ${exportSettings.floorName}`)
      if (exportSettings.floorNumber) metaParts.push(`# ${exportSettings.floorNumber}`)
      if (exportSettings.showDate) metaParts.push(`Generated: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`)
      if (metaParts.length) {
        ctx.fillText(metaParts.join('  •  '), offsetX + pageW * sf / 2, infoY, maxTextW)
        infoY += 5 * sf
      }
    }

    // ===== FLOOR PLAN AREA =====
    // Clamp planY so we always have room for the floor plan area
    const legendReserve = exportSettings.showLegend ? 18 * sf : 4 * sf
    const footerReserve = 10 * sf
    const minPlanH = 40 * sf // minimum meaningful height
    const maxPlanY = py + contentH - legendReserve - footerReserve - minPlanH
    const planY = Math.min(infoY + 4 * sf, maxPlanY)
    const planW = contentW
    const planH = Math.max(minPlanH, contentH - (planY - py) - legendReserve - footerReserve)

    // Floor plan border
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 1
    ctx.strokeRect(px, planY, planW, planH)

    // Background - use white if set
    ctx.fillStyle = exportSettings.useWhiteBackground ? '#ffffff' : (canvasBackground || '#ffffff')
    ctx.fillRect(px, planY, planW, planH)

    // ===== WATERMARK (OVER BACKGROUND) =====
    if (exportSettings.showWatermark) {
      ctx.save()
      // Clip to floor plan area so watermark doesn't bleed outside
      ctx.rect(px, planY, planW, planH)
      ctx.clip()
      ctx.globalAlpha = 0.05
      ctx.translate(px + planW / 2, planY + planH / 2)
      ctx.rotate(-Math.PI / 6)

      const wSize = Math.min(planW, planH) * 0.4
      const qX = -wSize / 2
      const qY = -wSize / 2

      if (logoImageRef.current) {
        ctx.drawImage(logoImageRef.current, qX, qY, wSize, wSize)
      } else {
        // Fallback if image not loaded
        ctx.fillStyle = '#16a34a'
        const radius = wSize * 0.12
        ctx.beginPath()
        if (ctx.roundRect) {
          ctx.roundRect(qX, qY, wSize, wSize, radius)
        } else {
          ctx.rect(qX, qY, wSize, wSize)
        }
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.font = `bold ${wSize * 0.7}px Arial`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('Q', 0, 0)
      }
      ctx.restore()
    }

    // Scale elements to fit — base scale uses planW/planH directly
    const scaleEX = planW / canvasSize.width
    const scaleEY = planH / canvasSize.height
    // Use 0.95 to leave a small padding inside the plan area
    const baseScale = Math.min(scaleEX, scaleEY) * 0.95
    const scaleE = baseScale * (exportSettings.mapScale / 100)
    const planCenterX = px + (planW - canvasSize.width * scaleE) / 2
    const planCenterY = planY + (planH - canvasSize.height * scaleE) / 2

    // Draw elements - SORT BY Z-INDEX, clipped to floor plan area
    ctx.save()
    ctx.beginPath()
    ctx.rect(px, planY, planW, planH)
    ctx.clip()

    canvasElements
      .filter(el => isLayerVisible(el.id))
      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
      .forEach(element => {
        const ex = planCenterX + element.x * scaleE
        const ey = planCenterY + element.y * scaleE
        const ew = element.width * scaleE
        const eh = element.height * scaleE

        if (element.type === 'room') {
          const color = element.color || '#f1f5f9'
          ctx.fillStyle = color
          ctx.fillRect(ex, ey, ew, eh)

          // Border
          ctx.strokeStyle = element.borderColor || '#cbd5e1'
          ctx.lineWidth = Math.max(0.5, (element.borderWidth ?? 1) * scaleE * 0.5)
          ctx.strokeRect(ex, ey, ew, eh)

          // Room label — clipped to room bounds, shrinks until it fits
          if (exportSettings.showRoomLabels) {
            const label = element.label || ''
            const maxLabelW = ew - 4 // more margin

            ctx.save()
            ctx.beginPath()
            ctx.rect(ex, ey, ew, eh)
            ctx.clip()

            let roomFs = Math.max(5, exportSettings.roomFontSize * scaleE * 1.1)
            ctx.fillStyle = getContrastColor(color)
            ctx.font = `bold ${roomFs}px Arial`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'

            let tw = ctx.measureText(label).width
            while (tw > maxLabelW && roomFs > 5) {
              roomFs *= 0.85
              ctx.font = `bold ${roomFs}px Arial`
              tw = ctx.measureText(label).width
            }

            let displayLabel = label
            if (tw > maxLabelW) {
              while (displayLabel.length > 1 && ctx.measureText(displayLabel + '…').width > maxLabelW) {
                displayLabel = displayLabel.slice(0, -1)
              }
              displayLabel += '…'
            }

            const hasCapacity = !!element.linkedRoomData?.capacity
            const labelY = hasCapacity ? ey + eh / 2 - roomFs * 0.4 : ey + eh / 2
            ctx.fillText(displayLabel, ex + ew / 2, labelY)

            if (hasCapacity) {
              const capFs = Math.max(4, roomFs * 0.7)
              ctx.font = `${capFs}px Arial`
              ctx.globalAlpha = 0.85
              let capLabel = `Cap: ${element.linkedRoomData!.capacity}`
              while (ctx.measureText(capLabel).width > maxLabelW && capFs > 4) {
                capLabel = capLabel.slice(0, -1)
              }
              ctx.fillText(capLabel, ex + ew / 2, ey + eh / 2 + roomFs * 0.5)
              ctx.globalAlpha = 1.0
            }

            ctx.restore()
          }

          // Availability dot
          if (showScheduleOverlay && element.linkedRoomData) {
            const avail = getRoomAvailability(element.linkedRoomData.room)
            ctx.fillStyle = avail === 'available' ? '#22c55e' : (avail === 'occupied' ? '#ef4444' : '#94a3b8')
            ctx.beginPath()
            ctx.arc(ex + ew - 3 * scaleE, ey + 3 * scaleE, 2.5 * scaleE, 0, Math.PI * 2)
            ctx.fill()
          }
        } else if (element.type === 'hallway') {
          ctx.fillStyle = '#d1d5db'
          ctx.fillRect(ex, ey, ew, eh)

          // Adjacency: smaller tolerance for snapped elements
          const snapTol2 = 2
          const adj = {
            n: canvasElements.some(o => o.id !== element.id && o.type === 'hallway' && isLayerVisible(o.id) && Math.abs(element.y - (o.y + o.height)) < snapTol2 && Math.max(element.x, o.x) < Math.min(element.x + element.width, o.x + o.width) - 1),
            s: canvasElements.some(o => o.id !== element.id && o.type === 'hallway' && isLayerVisible(o.id) && Math.abs((element.y + element.height) - o.y) < snapTol2 && Math.max(element.x, o.x) < Math.min(element.x + element.width, o.x + o.width) - 1),
            w: canvasElements.some(o => o.id !== element.id && o.type === 'hallway' && isLayerVisible(o.id) && Math.abs(element.x - (o.x + o.width)) < snapTol2 && Math.max(element.y, o.y) < Math.min(element.y + element.height, o.y + o.height) - 1),
            e: canvasElements.some(o => o.id !== element.id && o.type === 'hallway' && isLayerVisible(o.id) && Math.abs((element.x + element.width) - o.x) < snapTol2 && Math.max(element.y, o.y) < Math.min(element.y + element.height, o.y + o.height) - 1),
          }

          ctx.strokeStyle = '#9ca3af'
          ctx.lineWidth = Math.max(0.5, 1.5 * scaleE)
          ctx.setLineDash([5 * scaleE, 3 * scaleE])
          if (!adj.n) { ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + ew, ey); ctx.stroke(); }
          if (!adj.s) { ctx.beginPath(); ctx.moveTo(ex, ey + eh); ctx.lineTo(ex + ew, ey + eh); ctx.stroke(); }
          if (!adj.w) { ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex, ey + eh); ctx.stroke(); }
          if (!adj.e) { ctx.beginPath(); ctx.moveTo(ex + ew, ey); ctx.lineTo(ex + ew, ey + eh); ctx.stroke(); }
          ctx.setLineDash([])

          if (element.label) {
            ctx.save()
            ctx.fillStyle = '#4b5563'
            const hfs = Math.max(4, 6 * scaleE)
            ctx.font = `bold ${hfs}px Arial`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            if (element.orientation === 'vertical') {
              ctx.translate(ex + ew / 2, ey + eh / 2)
              ctx.rotate(-Math.PI / 2)
              ctx.fillText(element.label, 0, 0)
            } else {
              ctx.fillText(element.label, ex + ew / 2, ey + eh / 2)
            }
            ctx.restore()
          }
        } else if (element.type === 'stair') {
          ctx.fillStyle = '#f59e0b'
          ctx.fillRect(ex, ey, ew, eh)
          // Draw stair lines
          ctx.strokeStyle = 'rgba(255,255,255,0.4)'
          ctx.lineWidth = 1
          for (let i = 1; i <= 4; i++) {
            ctx.beginPath()
            ctx.moveTo(ex, ey + (eh / 5) * i)
            ctx.lineTo(ex + ew, ey + (eh / 5) * i)
            ctx.stroke()
          }
          ctx.fillStyle = '#ffffff'
          ctx.font = `bold ${Math.max(4, 6 * scaleE)}px Arial`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('STAIRS', ex + ew / 2, ey + eh / 2)
        } else if (element.type === 'door') {
          ctx.fillStyle = '#10b981'
          ctx.fillRect(ex, ey, ew, eh)
        } else if (element.type === 'wall') {
          ctx.fillStyle = '#334155'
          ctx.fillRect(ex, ey, ew, eh)
        } else if (element.type === 'text') {
          ctx.fillStyle = element.color || '#1e293b'
          ctx.font = `${(element.fontSize || 12) * scaleE}px Arial`
          ctx.textAlign = 'left'
          ctx.textBaseline = 'top'
          ctx.fillText(element.label || '', ex, ey)
        } else if (element.type === 'icon') {
          const iconType = element.iconType || ''
          const lowLabel = (element.label || '').toLowerCase()
          const cx = ex + ew / 2
          const cy = ey + eh / 2
          const radius = Math.min(ew, eh) / 2

          const isRestroom = iconType === 'restroom' || iconType === 'men_room' || iconType === 'women_room' ||
            lowLabel.includes('restroom') || lowLabel.includes('comfort') || lowLabel.includes('cr') || lowLabel.includes('wc') ||
            lowLabel.includes('men') || lowLabel.includes('women') || lowLabel.includes('boy') || lowLabel.includes('girl')

          if (isRestroom) {
            const isMale = iconType === 'men_room' || lowLabel.includes('men') || lowLabel.includes('boy')
            const isFemale = iconType === 'women_room' || lowLabel.includes('women') || lowLabel.includes('girl')

            // Draw restroom symbol background
            ctx.fillStyle = isMale ? '#2563eb' : isFemale ? '#db2777' : '#6366f1'
            ctx.beginPath()
            ctx.arc(cx, cy, radius * 0.85, 0, Math.PI * 2)
            ctx.fill()

            // Draw person icon (stick figure)
            ctx.fillStyle = '#ffffff'
            ctx.strokeStyle = '#ffffff'
            ctx.lineWidth = Math.max(0.5, radius * 0.12)

            if (isFemale) {
              // Female: dress silhouette
              // Head
              const headR = radius * 0.22
              ctx.beginPath()
              ctx.arc(cx, cy - radius * 0.48, headR, 0, Math.PI * 2)
              ctx.fill()
              // Dress (triangle)
              ctx.beginPath()
              ctx.moveTo(cx, cy - radius * 0.22)
              ctx.lineTo(cx - radius * 0.38, cy + radius * 0.45)
              ctx.lineTo(cx + radius * 0.38, cy + radius * 0.45)
              ctx.closePath()
              ctx.fill()
            } else {
              // Male: rectangle body with legs
              // Head
              const headR = radius * 0.2
              ctx.beginPath()
              ctx.arc(cx, cy - radius * 0.5, headR, 0, Math.PI * 2)
              ctx.fill()
              // Body
              ctx.fillRect(cx - radius * 0.15, cy - radius * 0.28, radius * 0.3, radius * 0.4)
              // Legs
              ctx.beginPath()
              ctx.moveTo(cx - radius * 0.05, cy + radius * 0.12)
              ctx.lineTo(cx - radius * 0.22, cy + radius * 0.48)
              ctx.moveTo(cx + radius * 0.05, cy + radius * 0.12)
              ctx.lineTo(cx + radius * 0.22, cy + radius * 0.48)
              ctx.stroke()
            }

            // Generic restroom: draw neutral person figure
            if (!isMale && !isFemale) {
              // Head
              const headR2 = radius * 0.21
              ctx.beginPath()
              ctx.arc(cx, cy - radius * 0.49, headR2, 0, Math.PI * 2)
              ctx.fill()
              // Body (narrower rectangle)
              ctx.fillRect(cx - radius * 0.12, cy - radius * 0.26, radius * 0.24, radius * 0.35)
              // Legs
              ctx.beginPath()
              ctx.moveTo(cx - radius * 0.04, cy + radius * 0.09)
              ctx.lineTo(cx - radius * 0.18, cy + radius * 0.46)
              ctx.moveTo(cx + radius * 0.04, cy + radius * 0.09)
              ctx.lineTo(cx + radius * 0.18, cy + radius * 0.46)
              ctx.stroke()
            }
          } else {
            // Generic icon: colored circle with initial
            ctx.fillStyle = element.color || '#6366f1'
            ctx.beginPath()
            ctx.arc(cx, cy, radius * 0.8, 0, Math.PI * 2)
            ctx.fill()
            ctx.fillStyle = '#ffffff'
            ctx.font = `bold ${radius * 0.75}px Arial`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText((element.label || 'i').charAt(0).toUpperCase(), cx, cy)
          }

          if (element.label) {
            ctx.fillStyle = '#475569'
            ctx.font = `${Math.max(4, 5 * scaleE)}px Arial`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'top'
            ctx.fillText(element.label, cx, ey + eh + 2 * scaleE)
          }
        } else if (element.type === 'shape') {
          ctx.fillStyle = element.color || '#10b981'
          if (element.shapeType === 'circle') {
            ctx.beginPath()
            ctx.arc(ex + ew / 2, ey + eh / 2, Math.min(ew, eh) / 2, 0, Math.PI * 2)
            ctx.fill()
          } else {
            ctx.fillRect(ex, ey, ew, eh)
          }
        }
      })

    // Restore clip after drawing elements
    ctx.restore()

    // Reset text alignment
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'

    // ===== LEGEND (MORE COMPACT) =====
    if (exportSettings.showLegend) {
      const legendY2 = py + contentH - 8 * sf
      ctx.fillStyle = '#1e293b'
      ctx.font = `bold ${3.5 * sf}px Arial`
      ctx.fillText('Legend:', px, legendY2)

      const legendItems = getLegendItems()
      let lx = px + 18 * sf
      legendItems.forEach(item => {
        ctx.fillStyle = item.bg
        ctx.fillRect(lx, legendY2 - 3 * sf, 5 * sf, 3 * sf)
        ctx.fillStyle = '#64748b'
        ctx.font = `${3 * sf}px Arial`
        ctx.fillText(item.label, lx + 6 * sf, legendY2)
        lx += 30 * sf
      })

      if (showScheduleOverlay) {
        lx += 5 * sf
        ctx.fillStyle = '#22c55e'
        ctx.beginPath()
        ctx.arc(lx, legendY2 - 1.5 * sf, 1.5 * sf, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#64748b'
        ctx.fillText('Available', lx + 2.5 * sf, legendY2)

        lx += 25 * sf
        ctx.fillStyle = '#ef4444'
        ctx.beginPath()
        ctx.arc(lx, legendY2 - 1.5 * sf, 1.5 * sf, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#64748b'
        ctx.fillText('Occupied', lx + 2.5 * sf, legendY2)
      }
    }

    // ===== FOOTER BRANDING =====
    const footerY = offsetY + pageH * sf - 5 * sf
    ctx.fillStyle = '#94a3b8'
    ctx.font = `${2.8 * sf}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText('Campus Map System  •  University Floor Plan Management', offsetX + pageW * sf / 2, footerY)

    // Qtime Scheduler Branding — logo BESIDE text, both bottom-right
    const brandFont = `bold ${4.6 * sf}px Arial`
    ctx.font = brandFont
    const brandingText = 'Qtime Scheduler'
    const brandingW = ctx.measureText(brandingText).width
    const boxS = 5.5 * sf
    const gap = 2 * sf
    // Total branding block width: boxS + gap + brandingW
    const brandBlockRight = offsetX + pageW * sf - m
    const brandBlockLeft = brandBlockRight - brandingW - gap - boxS
    const brandBaseY = footerY // text baseline aligns with footer

    // Draw logo box first (to the LEFT of text)
    const boxX = brandBlockLeft
    const boxY = brandBaseY - boxS // box top

    if (logoImageRef.current) {
      ctx.drawImage(logoImageRef.current, boxX, boxY, boxS, boxS)
    } else {
      ctx.fillStyle = '#16a34a'
      ctx.beginPath()
      if (ctx.roundRect) {
        ctx.roundRect(boxX, boxY, boxS, boxS, 1.2 * sf)
      } else {
        ctx.rect(boxX, boxY, boxS, boxS)
      }
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.font = `bold ${3.5 * sf}px Arial`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Q', boxX + boxS / 2, boxY + boxS / 2)
    }

    // Draw branding text to the RIGHT of box
    ctx.fillStyle = '#1e293b'
    ctx.font = brandFont
    ctx.textAlign = 'left'
    ctx.textBaseline = 'bottom'
    ctx.fillText(brandingText, boxX + boxS + gap, brandBaseY)

    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
  }, [canvasElements, canvasSize, exportSettings, showScheduleOverlay, floorPlanName, selectedBuilding, selectedFloor, schedules, selectedScheduleId, canvasBackground, currentFloorPlan])

  // Re-render preview when settings change
  useEffect(() => {
    if (showExportPreview) {
      const timer = setTimeout(() => renderExportPreview(), 50)
      return () => clearTimeout(timer)
    }
  }, [showExportPreview, exportSettings, renderExportPreview])

  // Export as PDF with QTime logo (enhanced)
  const exportPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf')

      const paper = exportSettings.paperSize === 'custom'
        ? { width: exportSettings.customPaperWidth, height: exportSettings.customPaperHeight }
        : PAPER_SIZES[exportSettings.paperSize] || PAPER_SIZES.letter

      const widthMm = paper.width * (25.4 / 96)
      const heightMm = paper.height * (25.4 / 96)

      const isLandscape = exportSettings.orientation === 'auto'
        ? widthMm > heightMm
        : exportSettings.orientation === 'landscape'

      const pdf = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: isLandscape ? [Math.max(widthMm, heightMm), Math.min(widthMm, heightMm)] : [Math.min(widthMm, heightMm), Math.max(widthMm, heightMm)]
      })

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = Math.min(pageWidth, pageHeight) * 0.05

      // ===== WATERMARK =====
      if (exportSettings.showWatermark) {
        pdf.saveGraphicsState()
        // @ts-ignore - Lower opacity watermark
        const gState = new (pdf as any).GState({ opacity: 0.02 })
        pdf.setGState(gState)

        const wmSize = Math.min(pageWidth, pageHeight) * 0.5
        const wmX = (pageWidth - wmSize) / 2
        const wmY = (pageHeight - wmSize) / 2

        try {
          pdf.addImage('/app-icon.png', 'PNG', wmX, wmY, wmSize, wmSize)
        } catch (e) {
          pdf.setFillColor(22, 163, 74)
          pdf.roundedRect(wmX, wmY, wmSize, wmSize, wmSize * 1.5, wmSize * 1.5, 'F')
          pdf.setTextColor(255, 255, 255)
          pdf.setFontSize(wmSize * 2.2)
          pdf.setFont('helvetica', 'bold')
          pdf.text('Q', wmX + wmSize * 0.26, wmY + wmSize * 0.75)
        }

        pdf.restoreGraphicsState()
      }

      // Top-left logo removed as per user request

      // Move "Qtime Scheduler" to bottom right instead of top left
      // We'll draw this later in the footer section

      // ===== COMPACT TITLE & INFO =====
      const titleX = margin
      const titleY = margin + 16 // Adjusted to account for removed logo space

      pdf.setFontSize(exportSettings.titleFontSize || 20)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(15, 23, 42)
      const title = exportSettings.title || floorPlanName || `${selectedBuilding}`
      const titleW = pdf.getTextWidth(title)
      pdf.text(title, (pageWidth - titleW) / 2, margin + 10) // Move title higher

      // Smaller info row to save space
      let infoY = titleY + 6
      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(100, 116, 139)

      const parts: string[] = []
      if (exportSettings.buildingLabel) parts.push(`Building: ${exportSettings.buildingLabel}`)
      if (exportSettings.floorName) parts.push(`Floor: ${exportSettings.floorName}`)
      if (exportSettings.floorNumber) parts.push(`Floor #: ${exportSettings.floorNumber}`)

      const infoText = parts.join('  |  ')
      const infoW = pdf.getTextWidth(infoText)
      pdf.text(infoText, (pageWidth - infoW) / 2, infoY)
      infoY += 4

      if (exportSettings.showScheduleInfo && exportSettings.subtitle) {
        pdf.setFontSize(8)
        const subW = pdf.getTextWidth(exportSettings.subtitle)
        pdf.text(exportSettings.subtitle, (pageWidth - subW) / 2, infoY)
        infoY += 4
      }

      if (exportSettings.showDate) {
        pdf.setFontSize(8)
        const dateText = `Exported: ${new Date().toLocaleDateString()}`
        const dateW = pdf.getTextWidth(dateText)
        pdf.text(dateText, (pageWidth - dateW) / 2, infoY)
        infoY += 4
      }

      // ===== FLOOR PLAN AREA =====
      const floorPlanY = infoY + 2
      const floorPlanWidth = pageWidth - (margin * 2)
      const floorPlanHeight = pageHeight - floorPlanY - (exportSettings.showLegend ? 20 : 10)

      // Background
      const bgColor = exportSettings.useWhiteBackground ? '#ffffff' : (canvasBackground || '#ffffff')
      const rgbBg = hexToRgb(bgColor)
      pdf.setFillColor(rgbBg.r, rgbBg.g, rgbBg.b)
      pdf.rect(margin, floorPlanY, floorPlanWidth, floorPlanHeight, 'F')

      // ===== WATERMARK (ON TOP OF BACKGROUND) =====
      if (exportSettings.showWatermark) {
        pdf.saveGraphicsState()
        // @ts-ignore
        const gState = new (pdf as any).GState({ opacity: 0.05 })
        pdf.setGState(gState)

        const wmSize = Math.min(floorPlanWidth, floorPlanHeight) * 0.4
        const wmX = margin + (floorPlanWidth - wmSize) / 2
        const wmY = floorPlanY + (floorPlanHeight - wmSize) / 2

        try {
          pdf.addImage('/app-icon.png', 'PNG', wmX, wmY, wmSize, wmSize)
        } catch (e) {
          pdf.setFillColor(22, 163, 74)
          pdf.roundedRect(wmX, wmY, wmSize, wmSize, wmSize * 0.1, wmSize * 0.1, 'F')
          pdf.setTextColor(255, 255, 255)
          pdf.setFontSize(wmSize * 1.5)
          pdf.text('Q', wmX + wmSize * 0.25, wmY + wmSize * 0.7)
        }
        pdf.restoreGraphicsState()
      }

      // Scale
      const scaleX = floorPlanWidth / canvasSize.width
      const scaleY = floorPlanHeight / canvasSize.height
      const baseScale = Math.min(scaleX, scaleY) * 0.96
      const scale = baseScale * (exportSettings.mapScale / 100)
      const centerX = margin + (floorPlanWidth - canvasSize.width * scale) / 2
      const centerY = floorPlanY + (floorPlanHeight - canvasSize.height * scale) / 2

      // Draw elements
      canvasElements
        .filter(el => isLayerVisible(el.id))
        .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
        .forEach(element => {
          const x = centerX + element.x * scale
          const y = centerY + element.y * scale
          const w = element.width * scale
          const h = element.height * scale

          // Helper to draw rotated rect/shape
          const drawRotated = (drawFn: () => void) => {
            if (element.rotation) {
              pdf.saveGraphicsState()
              // Translate to center, rotate, then translate back
              const cx = x + w / 2
              const cy = y + h / 2
              // @ts-ignore - jspdf rotation
              pdf.setCurrentTransformationMatrix(pdf.matrixMult(
                new (pdf as any).Matrix(1, 0, 0, 1, cx, cy),
                pdf.matrixMult(
                  // @ts-ignore
                  new (pdf as any).Matrix(Math.cos(element.rotation * Math.PI / 180), Math.sin(element.rotation * Math.PI / 180), -Math.sin(element.rotation * Math.PI / 180), Math.cos(element.rotation * Math.PI / 180), 0, 0),
                  // @ts-ignore
                  new (pdf as any).Matrix(1, 0, 0, 1, -cx, -cy)
                )
              ))
              drawFn()
              pdf.restoreGraphicsState()
            } else {
              drawFn()
            }
          }

          if (element.type === 'room') {
            drawRotated(() => {
              const color = element.color || '#f1f5f9'
              const rgb = hexToRgb(color)
              pdf.setFillColor(rgb.r, rgb.g, rgb.b)
              pdf.rect(x, y, w, h, 'F')

              const borderC = hexToRgb(element.borderColor || '#cbd5e1')
              pdf.setDrawColor(borderC.r, borderC.g, borderC.b)
              pdf.setLineWidth(Math.max(0.1, (element.borderWidth ?? 1) * scale * 0.3))
              pdf.rect(x, y, w, h)

              // Availability indicator
              if (showScheduleOverlay && element.linkedRoomData) {
                const availability = getRoomAvailability(element.linkedRoomData.room)
                pdf.setFillColor(availability === 'available' ? 34 : 239, availability === 'available' ? 197 : 68, availability === 'available' ? 94 : 68)
                pdf.circle(x + w - 2, y + 2, 1.5, 'F')
              }

              // Enhanced room label - shrink until it fits, never overflow
              if (exportSettings.showRoomLabels) {
                const contrastHex = getContrastColor(color)
                const cRgb = hexToRgb(contrastHex)
                pdf.setTextColor(cRgb.r, cRgb.g, cRgb.b)

                const label = element.label || ''
                const maxLabelW = w - 1.5

                // Start at preferred size, shrink until label fits
                let roomFs = Math.max(4, exportSettings.roomFontSize * scale * 3.2)
                pdf.setFont('helvetica', 'bold')
                pdf.setFontSize(roomFs)
                let textWidth = pdf.getTextWidth(label)
                while (textWidth > maxLabelW && roomFs > 4.5) {
                  roomFs *= 0.85
                  pdf.setFontSize(roomFs)
                  textWidth = pdf.getTextWidth(label)
                }

                // If it still doesn't fit even at min size, truncate with ellipsis
                let displayLabel = label
                if (textWidth > maxLabelW) {
                  displayLabel = label
                  while (displayLabel.length > 1 && pdf.getTextWidth(displayLabel + '…') > maxLabelW) {
                    displayLabel = displayLabel.slice(0, -1)
                  }
                  displayLabel += '…'
                  textWidth = pdf.getTextWidth(displayLabel)
                }

                const labelX = x + (w - textWidth) / 2
                const hasCapacity = !!element.linkedRoomData?.capacity
                // Vertical centering: jsPDF default baseline is 'alphabetic'.
                // For a single label, center it vertically by using y + h/2 + roomFs*0.3
                const labelY = hasCapacity ? y + h / 2 - roomFs * 0.15 : y + h / 2 + roomFs * 0.3
                pdf.text(displayLabel, labelX, labelY)

                if (hasCapacity) {
                  const capFs = Math.max(3.5, roomFs * 0.7)
                  pdf.setFontSize(capFs)
                  pdf.setFont('helvetica', 'normal')
                  const capText = `Cap: ${element.linkedRoomData!.capacity}`
                  let capW = pdf.getTextWidth(capText)
                  let capFsAdj = capFs
                  while (capW > maxLabelW && capFsAdj > 3) {
                    capFsAdj *= 0.85
                    pdf.setFontSize(capFsAdj)
                    capW = pdf.getTextWidth(capText)
                  }
                  pdf.text(capText, x + (w - capW) / 2, y + h / 2 + roomFs * 0.6)
                }
              }
            })
          } else if (element.type === 'wall') {
            drawRotated(() => {
              pdf.setFillColor(55, 65, 81)
              pdf.rect(x, y, w, h, 'F')
            })
          } else if (element.type === 'hallway') {
            drawRotated(() => {
              pdf.setFillColor(209, 213, 219)
              pdf.rect(x, y, w, h, 'F')

              // Adjacency: smaller tolerance (2px)
              const snapTol = 2
              const adj = {
                n: canvasElements.some(o => o.id !== element.id && o.type === 'hallway' && isLayerVisible(o.id) && Math.abs(element.y - (o.y + o.height)) < snapTol && Math.max(element.x, o.x) < Math.min(element.x + element.width, o.x + o.width) - 1),
                s: canvasElements.some(o => o.id !== element.id && o.type === 'hallway' && isLayerVisible(o.id) && Math.abs((element.y + element.height) - o.y) < snapTol && Math.max(element.x, o.x) < Math.min(element.x + element.width, o.x + o.width) - 1),
                w: canvasElements.some(o => o.id !== element.id && o.type === 'hallway' && isLayerVisible(o.id) && Math.abs(element.x - (o.x + o.width)) < snapTol && Math.max(element.y, o.y) < Math.min(element.y + element.height, o.y + o.height) - 1),
                e: canvasElements.some(o => o.id !== element.id && o.type === 'hallway' && isLayerVisible(o.id) && Math.abs((element.x + element.width) - o.x) < snapTol && Math.max(element.y, o.y) < Math.min(element.y + element.height, o.y + o.height) - 1),
              }

              pdf.setDrawColor(156, 163, 175)
              pdf.setLineWidth(0.4)
              pdf.setLineDashPattern([2, 1.2], 0)

              if (!adj.n) pdf.line(x, y, x + w, y)
              if (!adj.s) pdf.line(x, y + h, x + w, y + h)
              if (!adj.w) pdf.line(x, y, x, y + h)
              if (!adj.e) pdf.line(x + w, y, x + w, y + h)

              pdf.setLineDashPattern([], 0)

              if (element.label) {
                pdf.setTextColor(75, 85, 99)
                const hfs = Math.max(4, 6 * scale)
                pdf.setFontSize(hfs)
                pdf.setFont('helvetica', 'bold')
                const hw = pdf.getTextWidth(element.label)

                if (element.orientation === 'vertical') {
                  const cx = x + w / 2
                  const cy = y + h / 2
                  // @ts-ignore
                  pdf.text(element.label, cx, cy, { angle: 270, align: 'center' })
                } else {
                  pdf.text(element.label, x + (w - hw) / 2, y + h / 2 + 1)
                }
              }
            })
          } else if (element.type === 'door') {
            drawRotated(() => {
              pdf.setFillColor(16, 185, 129)
              pdf.rect(x, y, w, h, 'F')
            })
          } else if (element.type === 'text') {
            drawRotated(() => {
              const rgb = hexToRgb(element.color || '#1e293b')
              pdf.setTextColor(rgb.r, rgb.g, rgb.b)
              pdf.setFontSize((element.fontSize || 12) * scale * 2.8)
              pdf.setFont('helvetica', 'normal')
              pdf.text(element.label || '', x, y + h * 0.75)
            })
          } else if (element.type === 'stair') {
            drawRotated(() => {
              pdf.setFillColor(245, 158, 11)
              pdf.rect(x, y, w, h, 'F')
              pdf.setDrawColor(255, 255, 255)
              pdf.setLineWidth(0.1)
              for (let i = 1; i <= 4; i++) {
                pdf.line(x, y + (h / 5) * i, x + w, y + (h / 5) * i)
              }
              pdf.setTextColor(255, 255, 255)
              pdf.setFontSize(Math.max(4, 5 * scale))
              pdf.setFont('helvetica', 'bold')
              const sw = pdf.getTextWidth('STAIRS')
              pdf.text('STAIRS', x + (w - sw) / 2, y + h / 2 + 1)
            })
          } else if (element.type === 'icon') {
            drawRotated(() => {
              const lowLabel = (element.label || '').toLowerCase()
              const iconType = element.iconType || ''
              const radius = Math.min(w, h) / 2
              const cx = x + w / 2
              const cy = y + h / 2

              const isRestroom = iconType === 'restroom' || iconType === 'men_room' || iconType === 'women_room' ||
                lowLabel.includes('restroom') || lowLabel.includes('comfort') || lowLabel.includes('cr') || lowLabel.includes('wc') ||
                lowLabel.includes('men') || lowLabel.includes('women') || lowLabel.includes('boy') || lowLabel.includes('girl')

              if (isRestroom) {
                const isMale = iconType === 'men_room' || lowLabel.includes('men') || lowLabel.includes('boy')
                const isFemale = iconType === 'women_room' || lowLabel.includes('women') || lowLabel.includes('girl')

                if (isMale) {
                  pdf.setFillColor(37, 99, 235) // blue
                } else if (isFemale) {
                  pdf.setFillColor(219, 39, 119) // pink
                } else {
                  pdf.setFillColor(99, 102, 241) // purple fallback
                }
                pdf.circle(cx, cy, radius * 0.85, 'F')

                // Draw figure letter inside  — M / F / R (restroom)
                pdf.setTextColor(255, 255, 255)
                const figLabel = isMale ? 'M' : isFemale ? 'F' : 'R'
                const figFs = Math.max(5, radius * 1.4)
                pdf.setFontSize(figFs)
                pdf.setFont('helvetica', 'bold')
                const figW = pdf.getTextWidth(figLabel)
                pdf.text(figLabel, cx - figW / 2, cy + figFs * 0.35)
              } else {
                const iconRgb = hexToRgb(element.color || '#6366f1')
                pdf.setFillColor(iconRgb.r, iconRgb.g, iconRgb.b)
                pdf.circle(cx, cy, radius * 0.8, 'F')
                pdf.setTextColor(255, 255, 255)
                const initLabel = (element.label || 'i').charAt(0).toUpperCase()
                const initFs = Math.max(5, radius * 1.5)
                pdf.setFontSize(initFs)
                pdf.setFont('helvetica', 'bold')
                const initW = pdf.getTextWidth(initLabel)
                pdf.text(initLabel, cx - initW / 2, cy + initFs * 0.35)
              }

              if (element.label) {
                pdf.setTextColor(71, 85, 105)
                pdf.setFontSize(Math.max(4, 5 * scale))
                pdf.setFont('helvetica', 'normal')
                const iw = pdf.getTextWidth(element.label)
                pdf.text(element.label, cx - iw / 2, y + h + 2)
              }
            })
          } else if (element.type === 'shape') {
            drawRotated(() => {
              const sRgb = hexToRgb(element.color || '#10b981')
              pdf.setFillColor(sRgb.r, sRgb.g, sRgb.b)
              if (element.shapeType === 'circle') {
                pdf.circle(x + w / 2, y + h / 2, Math.min(w, h) / 2, 'F')
              } else {
                pdf.rect(x, y, w, h, 'F')
              }
            })
          }
        })

      // ===== LEGEND =====
      if (exportSettings.showLegend) {
        const legendY = floorPlanY + floorPlanHeight + 5
        pdf.setTextColor(30, 41, 59)
        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'bold')
        pdf.text('Legend:', margin, legendY)

        const legendItems = getLegendItems()
        let legendX = margin
        let currentLegendY = legendY + 6

        legendItems.forEach(item => {
          const rgb = hexToRgb(item.bg)
          pdf.setFillColor(rgb.r, rgb.g, rgb.b)
          pdf.roundedRect(legendX, currentLegendY, 8, 4, 0.8, 0.8, 'F')

          pdf.setFontSize(8)
          pdf.setFont('helvetica', 'normal')
          pdf.setTextColor(71, 85, 105)
          pdf.text(item.label, legendX + 10, currentLegendY + 3.2)

          legendX += 45
          if (legendX > pageWidth - margin - 45) {
            legendX = margin
            currentLegendY += 7
          }
        })

        if (showScheduleOverlay) {
          currentLegendY += 9
          pdf.setFontSize(9)
          pdf.setFont('helvetica', 'bold')
          pdf.setTextColor(30, 41, 59)
          pdf.text('Room Status:', margin, currentLegendY)

          pdf.setFillColor(34, 197, 94)
          pdf.circle(margin + 34, currentLegendY - 1.2, 2.5, 'F')
          pdf.setFont('helvetica', 'normal')
          pdf.setTextColor(71, 85, 105)
          pdf.text('Available', margin + 38, currentLegendY)

          pdf.setFillColor(239, 68, 68)
          pdf.circle(margin + 68, currentLegendY - 1.2, 2.5, 'F')
          pdf.text('Occupied', margin + 72, currentLegendY)
        }
      }

      // ===== FOOTER & BRANDING =====
      pdf.setFontSize(7)
      pdf.setTextColor(148, 163, 184)
      pdf.setFont('helvetica', 'normal')
      const footerText = 'Campus Map System  •  University Floor Plan Management'
      const footerW = pdf.getTextWidth(footerText)
      pdf.text(footerText, (pageWidth - footerW) / 2, pageHeight - margin * 0.4)

      // Qtime Scheduler Branding - Improved placement (Logo to the left of text)
      const brandY = pageHeight - margin * 0.4
      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'bold')
      const brandingText = 'Qtime Scheduler'
      const brandingW = pdf.getTextWidth(brandingText)
      const qBoxSize = 5
      const totalWidth = qBoxSize + 2 + brandingW
      const startX = pageWidth - margin - totalWidth

      const qBoxX = startX
      const qBoxY = brandY - 4

      try {
        pdf.addImage('/app-icon.png', 'PNG', qBoxX, qBoxY, qBoxSize, qBoxSize)
      } catch (e) {
        pdf.setFillColor(22, 163, 74)
        pdf.roundedRect(qBoxX, qBoxY, qBoxSize, qBoxSize, 1, 1, 'F')
        pdf.setTextColor(255, 255, 255)
        pdf.setFontSize(7)
        pdf.text('Q', qBoxX + 1.2, qBoxY + 3.8)
      }

      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(30, 41, 59)
      pdf.text(brandingText, qBoxX + qBoxSize + 2, brandY)

      // Save
      const fileName = `FloorPlan_${selectedBuilding.replace(/\s+/g, '_')}_F${selectedFloor}_${new Date().toISOString().split('T')[0]}.pdf`
      pdf.save(fileName)
      setShowExportPreview(false)
      showNotification('success', 'PDF exported successfully!')
    } catch (error) {
      console.error('Error exporting PDF:', error)
      showNotification('error', 'Failed to export PDF')
    }
  }

  // Helper: hex to rgb
  const hexToRgb = (hex: string) => {
    let r = 0, g = 0, b = 0
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16)
      g = parseInt(hex[2] + hex[2], 16)
      b = parseInt(hex[3] + hex[3], 16)
    } else if (hex.length === 7) {
      r = parseInt(hex.substring(1, 3), 16)
      g = parseInt(hex.substring(3, 5), 16)
      b = parseInt(hex.substring(5, 7), 16)
    }
    return { r, g, b }
  }

  const getContrastColor = (hex: string) => {
    const { r, g, b } = hexToRgb(hex)
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000
    return (yiq >= 128) ? '#1e293b' : '#ffffff'
  }

  // Generate shareable link
  const generateShareLink = () => {
    if (!currentFloorPlan?.id) {
      showNotification('error', 'Please save the floor plan first')
      return
    }
    const link = `${window.location.origin}/floor-plan/view/${currentFloorPlan.id}`
    navigator.clipboard.writeText(link)
    showNotification('success', 'Link copied to clipboard!')
    setShowShareModal(true)
  }

  // Filter rooms in toolbox
  const filteredRooms = allRooms.filter(room =>
    !searchQuery ||
    room.room?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.room_code?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Get legend items based on rooms on canvas
  const getLegendItems = () => {
    const types = new Set(canvasElements
      .filter(el => el.type === 'room' && el.linkedRoomData)
      .map(el => el.linkedRoomData?.room_type || 'default'))
    return Array.from(types).map(type => ({
      type,
      ...getRoomColor(type)
    }))
  }

  // Check if room is on canvas
  const isRoomOnCanvas = (roomId: number) => {
    return canvasElements.some(el => el.linkedRoomId === roomId)
  }

  // Get icon component
  const getIconComponent = (iconName: string, size: number = 24) => {
    const iconMap: Record<string, any> = {
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
    const IconComp = iconMap[iconName] || Info
    return <IconComp size={size} />
  }

  // Get shape component
  const getShapeComponent = (shapeName: string, size: number = 24) => {
    const shapeMap: Record<string, any> = {
      circle: CircleDot,
      triangle: Triangle,
      hexagon: Hexagon,
      pentagon: Pentagon,
      octagon: Octagon,
      star: Star,
      heart: Heart,
    }
    const ShapeComp = shapeMap[shapeName] || CircleDot
    return <ShapeComp size={size} />
  }

  if (!mounted) {
    return (
      <div className={styles.layout} data-theme={globalTheme || 'green'}>
        <div className={styles.authLoadingOverlay}>
          <div className={styles.authLoadingContent}>
            <RotateCcw size={48} className={styles.spinnerIcon} />
            <h2>Loading...</h2>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.layout} data-theme={globalTheme || 'green'}>
      {/* Full page loading overlay during auth check */}
      {(!authChecked || !isAuthorized) && (
        <div className={styles.authLoadingOverlay}>
          <div className={styles.authLoadingContent}>
            <RotateCcw size={48} className={styles.spinnerIcon} />
            <h2>{!authChecked ? 'Verifying access...' : 'Redirecting...'}</h2>
          </div>
        </div>
      )}

      <MenuBar onToggleSidebar={toggleSidebar} showSidebarToggle={true} onMenuBarToggle={handleMenuBarToggle} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main
        className={`${styles.main} ${sidebarOpen ? '' : styles.fullWidth} ${menuBarHidden ? styles.menuHidden : ''}`}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header Bar */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.buildingSelector}>
              <Building2 size={20} />
              <select
                value={selectedBuilding}
                onChange={(e) => setSelectedBuilding(e.target.value)}
                className={styles.select}
              >
                <option value="">Select Building</option>
                {buildings.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>

              <span className={styles.divider}>-</span>

              <Layers size={18} />
              <select
                value={selectedFloor}
                onChange={(e) => setSelectedFloor(Number(e.target.value))}
                className={styles.select}
              >
                {floors.length > 0 ? floors.map(f => (
                  <option key={f} value={f}>Floor {f}</option>
                )) : (
                  <option value={1}>Floor 1</option>
                )}
              </select>
            </div>

            {/* Mode Toggle - Three Modes */}
            <div className={styles.modeToggle}>
              <button
                className={`${styles.modeBtn} ${viewMode === 'editor' ? styles.active : ''}`}
                onClick={() => setViewMode('editor')}
                title="Editor Mode - Create and edit floor plans"
              >
                <Edit size={16} />
                Editor
              </button>
              <button
                className={`${styles.modeBtn} ${viewMode === 'floorplan' ? styles.active : ''}`}
                onClick={() => setViewMode('floorplan')}
                title="Floor Plan Mode - View only"
              >
                <Map size={16} />
                Floor Plan
              </button>
              <button
                className={`${styles.modeBtn} ${viewMode === 'live' ? styles.active : ''}`}
                onClick={() => {
                  setViewMode('live')
                  setShowScheduleOverlay(true)
                }}
                title="Live Mode - Real-time room availability"
              >
                <Eye size={16} />
                Live
              </button>
            </div>
          </div>

          <div className={styles.headerCenter}>
            <h1 className={styles.title}>
              {floorPlanName || `${selectedBuilding || 'Floor Plan'} - Floor ${selectedFloor}`}
              {isDefault && <Star size={16} className={styles.defaultStar} />}
            </h1>
          </div>

          <div className={styles.headerRight}>
            {(viewMode === 'live' || viewMode === 'floorplan') && (
              <div className={styles.scheduleSelector}>
                <Calendar size={16} />
                <select
                  value={selectedScheduleId || ''}
                  onChange={(e) => setSelectedScheduleId(Number(e.target.value) || null)}
                  className={styles.select}
                >
                  <option value="">Select Schedule</option>
                  {schedules.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.schedule_name} {s.is_default ? '★' : ''}
                    </option>
                  ))}
                </select>
                {viewMode === 'live' && (
                  <button
                    className={`${styles.overlayToggle} ${showScheduleOverlay ? styles.active : ''}`}
                    onClick={() => setShowScheduleOverlay(!showScheduleOverlay)}
                    title="Toggle room availability overlay"
                  >
                    <Clock size={16} />
                  </button>
                )}
              </div>
            )}

            {viewMode === 'editor' && (
              <button className={styles.clearBtn} onClick={clearCanvas} title="Clear Canvas">
                <RotateCcw size={18} />
              </button>
            )}
            <button
              className={styles.loadBtn}
              onClick={() => createNewDraft()}
              title="Create New Floor Plan"
            >
              <Plus size={18} />
            </button>
            <button
              className={styles.loadBtn}
              onClick={() => setShowLoadModal(true)}
              title="Load Floor Plan"
            >
              <FolderOpen size={18} />
            </button>
            {viewMode === 'editor' && (
              <button className={styles.saveBtn} onClick={() => setShowSaveModal(true)} disabled={saving}>
                {saving ? <RotateCcw size={18} className={styles.spinning} /> : <Save size={18} />}
                Save
              </button>
            )}
            <button className={styles.exportBtn} onClick={openExportPreview}>
              <Download size={18} />
              Export PDF
            </button>
            <button className={styles.shareBtn} onClick={generateShareLink}>
              <Share2 size={18} />
              Share
            </button>
          </div>
        </div>

        <div className={styles.editorContainer}>
          {/* Left Panel - Toolbox & Floor Plans */}
          <div className={`${styles.leftPanel} ${leftPanelOpen ? '' : styles.collapsed}`}>
            <button
              className={styles.panelToggle}
              onClick={() => setLeftPanelOpen(!leftPanelOpen)}
              title={leftPanelOpen ? 'Collapse panel' : 'Expand panel'}
            >
              {leftPanelOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
            </button>

            {leftPanelOpen && (
              <>
                {viewMode === 'editor' ? (
                  <>
                    <div className={styles.panelHeader}>
                      <h3>TOOLBOX</h3>
                    </div>
                    <div className={styles.toolboxContent}>
                      {/* Toolbox Content - Show if not mobile OR if mobile and active panel is toolbox */}
                      {(!isMobile || activeMobilePanel === 'toolbox') && (
                        <>
                          {/* Rooms & Zones Section */}
                          <div className={styles.toolSection}>
                            <button
                              className={styles.sectionHeader}
                              onClick={() => setSectionsOpen(p => ({ ...p, roomsZones: !p.roomsZones }))}
                            >
                              <span><Building2 size={16} /> Rooms & Zones</span>
                              {sectionsOpen.roomsZones ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>

                            {sectionsOpen.roomsZones && (
                              <div className={styles.sectionContent}>
                                <div className={styles.searchBox}>
                                  <Search size={16} />
                                  <input
                                    type="text"
                                    placeholder="Search rooms..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                  />
                                  {searchQuery && (
                                    <button onClick={() => setSearchQuery('')} className={styles.clearSearch}>
                                      <X size={14} />
                                    </button>
                                  )}
                                </div>

                                <div className={styles.roomList}>
                                  {loading ? (
                                    <div className={styles.loading}>
                                      <RotateCcw size={20} className={styles.spinning} />
                                      Loading rooms...
                                    </div>
                                  ) : filteredRooms.length === 0 ? (
                                    <div className={styles.emptyState}>
                                      <Info size={20} />
                                      <span>No rooms found</span>
                                    </div>
                                  ) : (
                                    filteredRooms.slice(0, 30).map(room => (
                                      <div
                                        key={room.id}
                                        className={`${styles.roomItem} ${isRoomOnCanvas(room.id) ? styles.onCanvas : ''}`}
                                        draggable={true}
                                        onDragStart={(e) => handleRoomDragStart(e, room)}
                                        onPointerDown={(e) => {
                                          if (!isMobile) return
                                          e.preventDefault()
                                          handlePointerDragStart('room', room, e.clientX, e.clientY)
                                        }}
                                        style={{
                                          borderLeftColor: getRoomColor(room.room_type).bg
                                        }}
                                        title={isRoomOnCanvas(room.id) ? 'Already on canvas' : 'Drag to add to canvas'}
                                      >
                                        <Square size={16} style={{ color: getRoomColor(room.room_type).bg }} />
                                        <div className={styles.roomInfo}>
                                          <span className={styles.roomName}>{room.room}</span>
                                          <span className={styles.roomType}>{room.room_type || 'Classroom'}</span>
                                        </div>
                                        <div className={styles.roomMeta}>
                                          <Users size={12} />
                                          <span>{room.capacity || 30}</span>
                                        </div>
                                        {isRoomOnCanvas(room.id) && (
                                          <CheckCircle size={14} className={styles.addedCheck} />
                                        )}
                                      </div>
                                    ))
                                  )}
                                  {filteredRooms.length > 30 && (
                                    <div className={styles.moreRooms}>
                                      +{filteredRooms.length - 30} more rooms
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Structures Section */}
                          <div className={styles.toolSection}>
                            <button
                              className={styles.sectionHeader}
                              onClick={() => setSectionsOpen(p => ({ ...p, structures: !p.structures }))}
                            >
                              <span><Box size={16} /> Walls & Structures</span>
                              {sectionsOpen.structures ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>

                            {sectionsOpen.structures && (
                              <div className={styles.sectionContent}>
                                <div className={styles.toolGrid}>
                                  {TOOLBOX_ITEMS.structures.map(item => (
                                    <div
                                      key={item.type}
                                      className={styles.toolItem}
                                      draggable={true}
                                      onDragStart={(e) => handleToolboxDragStart(e, item)}
                                      onPointerDown={(e) => {
                                        if (!isMobile) return
                                        e.preventDefault()
                                        handlePointerDragStart('toolbox', item, e.clientX, e.clientY)
                                      }}
                                    >
                                      <item.icon size={24} />
                                      <span>{item.label}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Doors & Elements Section */}
                          <div className={styles.toolSection}>
                            <button
                              className={styles.sectionHeader}
                              onClick={() => setSectionsOpen(p => ({ ...p, doorsElements: !p.doorsElements }))}
                            >
                              <span><DoorOpen size={16} /> Doors & Elements</span>
                              {sectionsOpen.doorsElements ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>

                            {sectionsOpen.doorsElements && (
                              <div className={styles.sectionContent}>
                                <div className={styles.toolGrid}>
                                  {TOOLBOX_ITEMS.elements.map(item => (
                                    <div
                                      key={item.type}
                                      className={styles.toolItem}
                                      draggable={true}
                                      onDragStart={(e) => handleToolboxDragStart(e, item)}
                                      onPointerDown={(e) => {
                                        if (!isMobile) return
                                        e.preventDefault()
                                        handlePointerDragStart('toolbox', item, e.clientX, e.clientY)
                                      }}
                                    >
                                      <item.icon size={24} />
                                      <span>{item.label}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Icons Section */}
                          <div className={styles.toolSection}>
                            <button
                              className={styles.sectionHeader}
                              onClick={() => setSectionsOpen(p => ({ ...p, labelsIcons: !p.labelsIcons }))}
                            >
                              <span><Type size={16} /> Labels & Icons</span>
                              {sectionsOpen.labelsIcons ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>

                            {sectionsOpen.labelsIcons && (
                              <div className={styles.sectionContent}>
                                <div className={styles.toolGrid}>
                                  {TOOLBOX_ITEMS.labels.map(item => (
                                    <div
                                      key={item.type}
                                      className={styles.toolItem}
                                      draggable={true}
                                      onDragStart={(e) => handleToolboxDragStart(e, item)}
                                      onPointerDown={(e) => {
                                        if (!isMobile) return
                                        e.preventDefault()
                                        handlePointerDragStart('toolbox', item, e.clientX, e.clientY)
                                      }}
                                    >
                                      <item.icon size={24} />
                                      <span>{item.label}</span>
                                    </div>
                                  ))}
                                </div>
                                <div className={styles.iconGrid}>
                                  {ICON_OPTIONS.slice(0, 12).map(iconOpt => (
                                    <div
                                      key={iconOpt.name}
                                      className={styles.iconItem}
                                      draggable={true}
                                      onDragStart={(e) => handleIconDragStart(e, iconOpt)}
                                      onPointerDown={(e) => {
                                        if (!isMobile) return
                                        e.preventDefault()
                                        handlePointerDragStart('icon', iconOpt, e.clientX, e.clientY)
                                      }}
                                      title={iconOpt.label}
                                    >
                                      <iconOpt.icon size={20} />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Shapes Section */}
                          <div className={styles.toolSection}>
                            <button
                              className={styles.sectionHeader}
                              onClick={() => setSectionsOpen(p => ({ ...p, shapes: !p.shapes }))}
                            >
                              <span><Hexagon size={16} /> Shapes</span>
                              {sectionsOpen.shapes ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>

                            {sectionsOpen.shapes && (
                              <div className={styles.sectionContent}>
                                <div className={styles.iconGrid}>
                                  {SHAPE_OPTIONS.map(shapeOpt => (
                                    <div
                                      key={shapeOpt.name}
                                      className={styles.iconItem}
                                      draggable={true}
                                      onDragStart={(e) => handleShapeDragStart(e, shapeOpt)}
                                      onPointerDown={(e) => {
                                        if (!isMobile) return
                                        e.preventDefault()
                                        handlePointerDragStart('shape', shapeOpt, e.clientX, e.clientY)
                                      }}
                                      title={shapeOpt.label}
                                    >
                                      <shapeOpt.icon size={20} />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Floor Plans Section - Show if not mobile OR if mobile and active panel is floorPlans */}
                    {(!isMobile || activeMobilePanel === 'floorPlans') && (
                      <>
                        <div className={styles.panelHeader} style={{ marginTop: isMobile ? 0 : 16, paddingTop: isMobile ? 0 : 16, borderTop: isMobile ? 'none' : '1px solid var(--border-color)' }}>
                          <h3>FLOOR PLANS</h3>
                          <button
                            className={styles.iconBtn}
                            onClick={() => {
                              setFloorPlanName('')
                              setCurrentFloorPlan(null)
                              setIsDefault(false)
                              setCanvasElements([])
                              showNotification('success', 'Ready for new draft')
                              if (isMobile) toggleMobilePanel('floorPlans')
                            }}
                            title="New Draft"
                          >
                            <Plus size={16} />
                          </button>
                        </div>

                        <div className={styles.toolboxContent}>
                          {savedFloorPlans.length === 0 ? (
                            <div className={styles.emptyState}>
                              <Info size={20} />
                              <span>No saved plans</span>
                              <button className={styles.textBtn} onClick={createNewDraft}>Create New</button>
                            </div>
                          ) : (
                            <div className={styles.floorPlanGrid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12, padding: '0 8px' }}>
                              {savedFloorPlans
                                .filter(fp => {
                                  if (!selectedBuilding) return true
                                  // Match by metadata or name
                                  return (fp.canvas_data?.building === selectedBuilding) ||
                                    (fp.floor_name?.toLowerCase().includes(selectedBuilding.toLowerCase()))
                                })
                                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                .map(fp => (
                                  <div
                                    key={fp.id}
                                    className={`${styles.floorPlanCard} ${currentFloorPlan?.id === fp.id ? styles.active : ''}`}
                                    onClick={() => loadFloorPlan(fp)}
                                    style={{ padding: 10 }}
                                  >
                                    <div className={styles.cardStatus} style={{ top: 6, right: 6, display: 'flex', gap: 4, flexDirection: 'column' }}>
                                      {fp.is_default_view && (
                                        <span
                                          className={`${styles.statusDot} ${styles.published}`}
                                          title="Default View"
                                          style={{ fontSize: 10 }}
                                        >
                                          ⭐
                                        </span>
                                      )}
                                      {fp.is_published && !fp.is_default_view && (
                                        <span
                                          className={`${styles.statusDot} ${styles.published}`}
                                          title="Published"
                                          style={{ fontSize: 10 }}
                                        >
                                          👁
                                        </span>
                                      )}
                                      {!fp.is_published && !fp.is_default_view && (
                                        <span
                                          className={`${styles.statusDot} ${styles.draft}`}
                                          title="Draft"
                                          style={{ fontSize: 10 }}
                                        >
                                          📝
                                        </span>
                                      )}
                                    </div>

                                    <div className={styles.cardIcon} style={{ width: 36, height: 36, marginBottom: 8 }}>
                                      <FileText size={18} />
                                    </div>

                                    <div className={styles.cardName} style={{ fontSize: 12 }}>
                                      {fp.floor_name?.replace(selectedBuilding + ' - ', '') || fp.floor_name}
                                    </div>

                                    <div className={styles.cardMeta} style={{ fontSize: 10 }}>
                                      {fp.is_default_view ? 'Default' : fp.is_published ? 'Published' : 'Draft'}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {/* In Non-Editor View modes, we can show Floor Plans list for quick switching if desired */}
                    <div className={styles.panelHeader} style={{ justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}>
                      <h3>FLOOR PLANS</h3>
                      <button
                        className={styles.headerBtn}
                        onClick={() => {
                          setViewMode('editor')
                          createNewDraft()
                        }}
                        title="Create New Draft"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <div className={styles.toolboxContent}>
                      {savedFloorPlans.length === 0 ? (
                        <div className={styles.emptyState}>
                          <span>No floors found</span>
                        </div>
                      ) : (
                        <div className={styles.floorPlanGrid} style={{ gridTemplateColumns: '1fr', gap: 8 }}>
                          {savedFloorPlans
                            .filter(fp => {
                              if (!selectedBuilding) return true
                              return (fp.canvas_data?.building === selectedBuilding) ||
                                (fp.floor_name?.toLowerCase().includes(selectedBuilding.toLowerCase()))
                            })
                            .map(fp => (
                              <div
                                key={fp.id}
                                className={`${styles.floorPlanCard} ${currentFloorPlan?.id === fp.id ? styles.active : ''}`}
                                onClick={() => loadFloorPlan(fp)}
                                style={{ padding: '8px 12px', minHeight: 'auto' }}
                              >
                                <div className={styles.cardName} style={{ fontSize: 13 }}>
                                  {fp.floor_name?.replace(selectedBuilding + ' - ', '') || fp.floor_name}
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Main Canvas Area */}
          <div className={styles.canvasArea}>
            <div
              ref={canvasContainerRef}
              className={`${styles.canvasContainer} ${viewMode !== 'editor' ? styles.viewOnly : ''} ${selectMode === 'pan' || isSpacePressed ? styles.panMode : ''} ${isPanning ? styles.panning : ''}`}
              onDragOver={viewMode === 'editor' ? handleDragOver : undefined}
              onDrop={viewMode === 'editor' ? handleDrop : undefined}
              onDragLeave={() => setDragGhost(null)}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {/* Scale wrapper — sized to the visual (scaled) canvas so scroll area matches */}
              <div
                className={styles.canvasScaleWrapper}
                style={{
                  width: canvasSize.width * (zoom / 100),
                  height: canvasSize.height * (zoom / 100),
                }}
              >
                <div
                  ref={canvasRef}
                  className={`${styles.canvas} ${selectMode === 'multi' ? styles.multiSelectMode : ''} ${selectMode === 'pan' || isSpacePressed ? styles.panMode : ''} ${isPanning ? styles.panning : ''} ${(draggingElement || resizingElement) ? styles.isInteracting : ''}`}
                  style={{
                    width: canvasSize.width,
                    height: canvasSize.height,
                    transform: `scale(${zoom / 100})`,
                    backgroundColor: canvasBackground,
                    backgroundImage: showGrid && viewMode === 'editor'
                      ? `linear-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.05) 1px, transparent 1px)`
                      : 'none',
                    backgroundSize: showGrid && viewMode === 'editor' ? `${gridSize}px ${gridSize}px` : 'none'
                  }}
                  onClick={handleCanvasClick}
                >
                  {/* Marquee Selection Box */}
                  {isMarqueeSelecting && marqueeStart && marqueeEnd && (
                    <div
                      className={styles.marqueeSelection}
                      style={{
                        left: Math.min(marqueeStart.x, marqueeEnd.x),
                        top: Math.min(marqueeStart.y, marqueeEnd.y),
                        width: Math.abs(marqueeEnd.x - marqueeStart.x),
                        height: Math.abs(marqueeEnd.y - marqueeStart.y)
                      }}
                    />
                  )}

                  {/* Render elements on canvas - filter by visibility */}
                  {canvasElements
                    .filter(element => isLayerVisible(element.id))
                    .map(element => {
                      const isSelected = selectedElement?.id === element.id
                      const isMultiSelected = selectedElements.includes(element.id)
                      const isDraggingEl = draggingElement === element.id
                      const isResizing = resizingElement === element.id
                      const availability = element.linkedRoomData ? getRoomAvailability(element.linkedRoomData.room) : 'unknown'
                      const currentClass = viewMode === 'live' && element.linkedRoomData ? getCurrentClass(element.linkedRoomData.room) : null

                      // Calculate hallway adjacencies for "connecting" effect
                      const neighbors = element.type === 'hallway' ? {
                        n: canvasElements.some(o => o.id !== element.id && o.type === 'hallway' && isLayerVisible(o.id) && Math.abs(element.y - (o.y + o.height)) < 2 && Math.max(element.x, o.x) < Math.min(element.x + element.width, o.x + o.width)),
                        s: canvasElements.some(o => o.id !== element.id && o.type === 'hallway' && isLayerVisible(o.id) && Math.abs((element.y + element.height) - o.y) < 2 && Math.max(element.x, o.x) < Math.min(element.x + element.width, o.x + o.width)),
                        w: canvasElements.some(o => o.id !== element.id && o.type === 'hallway' && isLayerVisible(o.id) && Math.abs(element.x - (o.x + o.width)) < 2 && Math.max(element.y, o.y) < Math.min(element.y + element.height, o.y + o.height)),
                        e: canvasElements.some(o => o.id !== element.id && o.type === 'hallway' && isLayerVisible(o.id) && Math.abs((element.x + element.width) - o.x) < 2 && Math.max(element.y, o.y) < Math.min(element.y + element.height, o.y + o.height)),
                      } : null

                      return (
                        <div
                          key={element.id}
                          className={`${styles.canvasElement} ${styles[`element_${element.type}`]} ${isSelected || isMultiSelected ? styles.selected : ''} ${isDraggingEl ? styles.dragging : ''} ${isResizing ? styles.resizing : ''} ${element.isLocked ? styles.locked : ''} ${viewMode === 'live' && showScheduleOverlay ? styles[availability] : ''} ${element.orientation === 'vertical' ? styles.vertical : ''}`}
                          style={{
                            left: element.x,
                            top: element.y,
                            width: element.width,
                            height: element.height,
                            backgroundColor: element.color,
                            borderColor: element.borderColor,
                            borderWidth: element.borderWidth ?? 2,
                            opacity: (element.opacity ?? 100) / 100,
                            transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
                            zIndex: element.zIndex ?? 1,
                            // Hide borders for connected hallways
                            ...(neighbors ? {
                              borderTop: neighbors.n ? 'none' : undefined,
                              borderBottom: neighbors.s ? 'none' : undefined,
                              borderLeft: neighbors.w ? 'none' : undefined,
                              borderRight: neighbors.e ? 'none' : undefined,
                              borderRadius: 0 // Remove rounding when connected
                            } : {})
                          }}
                          onClick={(e) => handleElementClick(element, e)}
                          onMouseDown={(e) => viewMode === 'editor' && !element.isLocked && handleElementDragStart(e, element)}
                          onTouchStart={(e) => viewMode === 'editor' && !element.isLocked && handleTouchStart(e, element)}
                        >
                          {element.type === 'room' && (
                            <>
                              <span className={styles.elementLabel}>{element.label}</span>
                              {element.linkedRoomData && (
                                <span className={styles.elementCapacity}>
                                  <Users size={10} /> {element.linkedRoomData.capacity}
                                </span>
                              )}
                              {showScheduleOverlay && availability !== 'unknown' && (
                                <div className={`${styles.availabilityDot} ${styles[availability]}`} />
                              )}
                              {currentClass && viewMode === 'live' && (
                                <div className={styles.currentClassInfo}>
                                  <span className={styles.classCode}>{currentClass.course_code}</span>
                                  <span className={styles.classSection}>{currentClass.section}</span>
                                </div>
                              )}
                              {element.isLocked && <Lock size={12} className={styles.lockIcon} />}
                            </>
                          )}
                          {element.type === 'text' && (
                            <span className={styles.textLabel} style={{ fontSize: element.fontSize }}>{element.label}</span>
                          )}
                          {element.type === 'hallway' && (
                            <>
                              <span className={styles.hallwayLabel}>{element.label}</span>
                              {viewMode === 'editor' && (
                                <button
                                  className={styles.orientationBtn}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleHallwayOrientation(element.id)
                                  }}
                                  title={`Switch to ${element.orientation === 'vertical' ? 'horizontal' : 'vertical'}`}
                                >
                                  <RotateCcw size={12} />
                                </button>
                              )}
                            </>
                          )}
                          {element.type === 'stair' && (
                            <>
                              <Footprints size={20} />
                              <span>{element.label}</span>
                            </>
                          )}
                          {element.type === 'door' && (
                            <DoorOpen size={16} />
                          )}
                          {element.type === 'icon' && (
                            <div className={styles.iconElement}>
                              {getIconComponent(element.iconType || 'info', 28)}
                              {element.label && <span>{element.label}</span>}
                            </div>
                          )}
                          {element.type === 'shape' && (
                            <div className={styles.shapeElement}>
                              {getShapeComponent(element.shapeType || 'circle', Math.min(element.width, element.height) * 0.7)}
                            </div>
                          )}

                          {/* Resize handles - only show when selected and in editor mode */}
                          {isSelected && viewMode === 'editor' && !element.isLocked && (
                            <>
                              <div
                                className={`${styles.resizeHandle} ${styles.resizeN}`}
                                onMouseDown={(e) => handleResizeStart(e, element.id, 'n')}
                                onTouchStart={(e) => handleResizeTouchStart(e, element.id, 'n')}
                              />
                              <div
                                className={`${styles.resizeHandle} ${styles.resizeS}`}
                                onMouseDown={(e) => handleResizeStart(e, element.id, 's')}
                                onTouchStart={(e) => handleResizeTouchStart(e, element.id, 's')}
                              />
                              <div
                                className={`${styles.resizeHandle} ${styles.resizeE}`}
                                onMouseDown={(e) => handleResizeStart(e, element.id, 'e')}
                                onTouchStart={(e) => handleResizeTouchStart(e, element.id, 'e')}
                              />
                              <div
                                className={`${styles.resizeHandle} ${styles.resizeW}`}
                                onMouseDown={(e) => handleResizeStart(e, element.id, 'w')}
                                onTouchStart={(e) => handleResizeTouchStart(e, element.id, 'w')}
                              />
                              <div
                                className={`${styles.resizeHandle} ${styles.resizeNE}`}
                                onMouseDown={(e) => handleResizeStart(e, element.id, 'ne')}
                                onTouchStart={(e) => handleResizeTouchStart(e, element.id, 'ne')}
                              />
                              <div
                                className={`${styles.resizeHandle} ${styles.resizeNW}`}
                                onMouseDown={(e) => handleResizeStart(e, element.id, 'nw')}
                                onTouchStart={(e) => handleResizeTouchStart(e, element.id, 'nw')}
                              />
                              <div
                                className={`${styles.resizeHandle} ${styles.resizeSE}`}
                                onMouseDown={(e) => handleResizeStart(e, element.id, 'se')}
                                onTouchStart={(e) => handleResizeTouchStart(e, element.id, 'se')}
                              />
                              <div
                                className={`${styles.resizeHandle} ${styles.resizeSW}`}
                                onMouseDown={(e) => handleResizeStart(e, element.id, 'sw')}
                                onTouchStart={(e) => handleResizeTouchStart(e, element.id, 'sw')}
                              />
                            </>
                          )}
                        </div>
                      )
                    })}

                  {/* Drag ghost */}
                  {dragGhost && dragItem && viewMode === 'editor' && (
                    <div
                      className={styles.dragGhost}
                      style={{
                        left: dragGhost.x,
                        top: dragGhost.y,
                        width: dragItem.type === 'room' ? 140 : dragItem.data?.width || 100,
                        height: dragItem.type === 'room' ? 100 : dragItem.data?.height || 60
                      }}
                    >
                      <span>
                        {dragItem.type === 'room' ? dragItem.data.room : dragItem.data?.label || 'Element'}
                      </span>
                    </div>
                  )}

                  {/* Dimension tooltip when resizing */}
                  {resizingElement && viewMode === 'editor' && (() => {
                    const element = canvasElements.find(el => el.id === resizingElement)
                    if (!element) return null
                    return (
                      <div
                        className={styles.dimensionTooltip}
                        style={{
                          left: element.x + element.width / 2,
                          top: element.y - 35
                        }}
                      >
                        {Math.round(element.width)} × {Math.round(element.height)} px
                      </div>
                    )
                  })()}
                </div>
              </div>{/* end canvasScaleWrapper */}
            </div>

            {/* Floating Canvas Controls - Draggable */}
            <div
              ref={controlsRef}
              className={`${styles.canvasControls} ${isDraggingControls ? styles.dragging : ''}`}
              style={controlsPos ? { position: 'absolute', left: controlsPos.x, top: controlsPos.y, bottom: 'auto', right: 'auto' } : undefined}
            >
              <div
                className={styles.controlsDragHandle}
                onMouseDown={handleControlsDragStart}
                onTouchStart={handleControlsDragStart}
                title="Drag to move"
              >
                <Grip size={14} />
              </div>
              <div className={styles.zoomControls} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
                <button onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(25, z - 25)); }} title="Zoom Out">
                  <ZoomOut size={18} />
                </button>
                <span>Zoom: {zoom}%</span>
                <button onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(500, z + 25)); }} title="Zoom In">
                  <ZoomIn size={18} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); setZoom(100); }} title="Reset zoom">
                  <Maximize2 size={16} />
                </button>
              </div>

              {viewMode === 'editor' && (
                <div className={styles.undoRedoControls} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
                  <button
                    className={styles.undoRedoBtn}
                    onClick={(e) => { e.stopPropagation(); undo(); }}
                    disabled={historyIndex <= 0}
                    title="Undo (Ctrl+Z)"
                  >
                    <RotateCcw size={16} />
                  </button>
                  <button
                    className={styles.undoRedoBtn}
                    onClick={(e) => { e.stopPropagation(); redo(); }}
                    disabled={historyIndex >= history.length - 1}
                    title="Redo (Ctrl+Y)"
                    style={{ transform: 'scaleX(-1)' }}
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>
              )}

              {viewMode === 'editor' && (
                <>
                  <div className={styles.selectControl}>
                    <button
                      className={`${styles.selectModeBtn} ${selectMode !== 'single' ? styles.active : ''}`}
                      onClick={toggleSelectMode}
                      title={selectMode === 'single' ? 'Enable multi-select' : selectMode === 'multi' ? 'Enable pan tool' : 'Return to single select'}
                    >
                      {selectMode === 'multi' ? <BoxSelect size={16} /> : selectMode === 'pan' ? <Move size={16} /> : <MousePointer size={16} />}
                      {!isMobile && <span>{selectMode === 'multi' ? 'Multi' : selectMode === 'pan' ? 'Pan' : 'Select'}</span>}
                    </button>
                    {selectedElements.length > 0 && (
                      <span className={styles.selectedCount}>{selectedElements.length} selected</span>
                    )}
                    {(selectedElements.length > 0 || selectedElement) && (
                      <button
                        className={styles.deleteSelectedBtn}
                        onClick={deleteSelectedElements}
                        title="Delete selected elements"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <div className={styles.snapControl}>
                    <button
                      className={`${styles.gridToggleBtn} ${showGrid ? styles.active : ''}`}
                      onClick={() => setShowGrid(!showGrid)}
                      title={showGrid ? 'Hide Grid' : 'Show Grid'}
                    >
                      <Grid size={16} />
                    </button>
                    <span>Snap:</span>
                    <button
                      className={`${styles.toggleBtn} ${snapToGrid ? styles.active : ''}`}
                      onClick={() => setSnapToGrid(!snapToGrid)}
                    >
                      {snapToGrid ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </>
              )}

              <div className={styles.elementCount}>
                <span>Elements: {canvasElements.length}</span>
              </div>

              {viewMode === 'live' && showScheduleOverlay && currentTime && (
                <div className={styles.timeDisplay}>
                  <Clock size={16} />
                  <span>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className={styles.dayDisplay}>
                    {currentTime.toLocaleDateString([], { weekday: 'long' })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right Properties/Layers Panel */}
          <div className={`${styles.rightPanel} ${rightPanelOpen ? '' : styles.collapsed}`}>
            <button
              className={styles.panelToggleRight}
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              title={rightPanelOpen ? 'Collapse panel' : 'Expand panel'}
            >
              {rightPanelOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>

            {rightPanelOpen && (
              <>
                {/* Tab Navigation */}
                {viewMode === 'editor' && (
                  <div className={styles.panelTabs}>
                    <button
                      className={`${styles.panelTab} ${activeRightTab === 'properties' ? styles.active : ''}`}
                      onClick={() => setActiveRightTab('properties')}
                    >
                      <Settings size={16} />
                      Properties
                    </button>
                    <button
                      className={`${styles.panelTab} ${activeRightTab === 'layers' ? styles.active : ''}`}
                      onClick={() => setActiveRightTab('layers')}
                    >
                      <Layers size={16} />
                      Layers
                    </button>
                  </div>
                )}

                {/* Properties Tab Content */}
                {(activeRightTab === 'properties' || viewMode !== 'editor') && (
                  <>
                    <div className={styles.panelHeader}>
                      <h3>{viewMode === 'live' ? 'ROOM INFO' : 'PROPERTIES'}</h3>
                    </div>

                    <div className={styles.propertiesContent}>
                      {selectedElement ? (
                        <>
                          {viewMode === 'editor' && (
                            <>
                              {/* Live-update indicator */}
                              <div className={styles.liveUpdateBadge}>
                                <CheckCircle size={12} />
                                <span>Changes apply live</span>
                              </div>

                              <div className={styles.propertyGroup}>
                                <label>Label Name</label>
                                <input
                                  type="text"
                                  value={editForm.label}
                                  onChange={(e) => setEditForm(p => ({ ...p, label: e.target.value }))}
                                  className={styles.propertyInput}
                                />
                              </div>

                              <div className={styles.propertyGroup}>
                                <label>Type</label>
                                <div className={styles.typeDisplay}>
                                  {selectedElement.type.charAt(0).toUpperCase() + selectedElement.type.slice(1)}
                                </div>
                              </div>

                              {/* Size controls */}
                              <div className={styles.propertyGroupLabel}>Size</div>
                              <div className={styles.propertyRow}>
                                <div className={styles.propertyGroup}>
                                  <label>Width</label>
                                  <div className={styles.sizeInput}>
                                    <input
                                      type="number"
                                      value={editForm.width}
                                      onChange={(e) => setEditForm(p => ({ ...p, width: Number(e.target.value) }))}
                                      className={styles.propertyInput}
                                    />
                                    <span>px</span>
                                  </div>
                                </div>
                                <div className={styles.propertyGroup}>
                                  <label>Height</label>
                                  <div className={styles.sizeInput}>
                                    <input
                                      type="number"
                                      value={editForm.height}
                                      onChange={(e) => setEditForm(p => ({ ...p, height: Number(e.target.value) }))}
                                      className={styles.propertyInput}
                                    />
                                    <span>px</span>
                                  </div>
                                </div>
                              </div>

                              {/* Position controls */}
                              <div className={styles.propertyGroupLabel}>Position</div>
                              <div className={styles.propertyRow}>
                                <div className={styles.propertyGroup}>
                                  <label>X</label>
                                  <div className={styles.sizeInput}>
                                    <input
                                      type="number"
                                      value={Math.round(editForm.x)}
                                      onChange={(e) => setEditForm(p => ({ ...p, x: Number(e.target.value) }))}
                                      className={styles.propertyInput}
                                    />
                                    <span>px</span>
                                  </div>
                                </div>
                                <div className={styles.propertyGroup}>
                                  <label>Y</label>
                                  <div className={styles.sizeInput}>
                                    <input
                                      type="number"
                                      value={Math.round(editForm.y)}
                                      onChange={(e) => setEditForm(p => ({ ...p, y: Number(e.target.value) }))}
                                      className={styles.propertyInput}
                                    />
                                    <span>px</span>
                                  </div>
                                </div>
                              </div>

                              <div className={styles.propertyGroup}>
                                <label>Color</label>
                                <div className={styles.colorPicker}>
                                  <div
                                    className={styles.colorPreview}
                                    style={{ backgroundColor: editForm.color }}
                                  />
                                  <input
                                    type="color"
                                    value={editForm.color}
                                    onChange={(e) => setEditForm(p => ({ ...p, color: e.target.value }))}
                                  />
                                </div>
                              </div>

                              <div className={styles.propertyGroup}>
                                <label>Rotation</label>
                                <div className={styles.rotationInput}>
                                  <input
                                    type="range"
                                    min="0"
                                    max="360"
                                    value={editForm.rotation}
                                    onChange={(e) => setEditForm(p => ({ ...p, rotation: Number(e.target.value) }))}
                                  />
                                  <span>{editForm.rotation}°</span>
                                </div>
                              </div>

                              {/* Opacity/Transparency Control */}
                              <div className={styles.propertyGroup}>
                                <label>Opacity</label>
                                <div className={styles.rotationInput}>
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={editForm.opacity}
                                    onChange={(e) => setEditForm(p => ({ ...p, opacity: Number(e.target.value) }))}
                                  />
                                  <span>{editForm.opacity}%</span>
                                </div>
                              </div>

                              {/* Border Width Control */}
                              <div className={styles.propertyGroup}>
                                <label>Border Width</label>
                                <div className={styles.sizeInput}>
                                  <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    value={editForm.borderWidth}
                                    onChange={(e) => setEditForm(p => ({ ...p, borderWidth: Number(e.target.value) }))}
                                    className={styles.propertyInput}
                                  />
                                  <span>px</span>
                                </div>
                              </div>

                              {/* Font Size Control for text and labels */}
                              {(selectedElement.type === 'text' || selectedElement.type === 'room') && (
                                <div className={styles.propertyGroup}>
                                  <label>Font Size</label>
                                  <div className={styles.sizeInput}>
                                    <input
                                      type="number"
                                      min="8"
                                      max="48"
                                      value={editForm.fontSize}
                                      onChange={(e) => setEditForm(p => ({ ...p, fontSize: Number(e.target.value) }))}
                                      className={styles.propertyInput}
                                    />
                                    <span>px</span>
                                  </div>
                                </div>
                              )}

                              {selectedElement.type === 'icon' && (
                                <div className={styles.propertyGroup}>
                                  <label>Icon Type</label>
                                  <select
                                    value={editForm.iconType}
                                    onChange={(e) => setEditForm(p => ({ ...p, iconType: e.target.value }))}
                                    className={styles.propertySelect}
                                  >
                                    {ICON_OPTIONS.map(opt => (
                                      <option key={opt.name} value={opt.name}>{opt.label}</option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              {selectedElement.type === 'hallway' && (
                                <div className={styles.propertyGroup}>
                                  <label>Orientation</label>
                                  <div className={styles.orientationToggleWrapper}>
                                    <button
                                      className={`${styles.orientationOption} ${selectedElement.orientation !== 'vertical' ? styles.active : ''}`}
                                      onClick={() => {
                                        if (selectedElement.orientation === 'vertical') {
                                          toggleHallwayOrientation(selectedElement.id)
                                        }
                                      }}
                                    >
                                      <span>━</span> Horizontal
                                    </button>
                                    <button
                                      className={`${styles.orientationOption} ${selectedElement.orientation === 'vertical' ? styles.active : ''}`}
                                      onClick={() => {
                                        if (selectedElement.orientation !== 'vertical') {
                                          toggleHallwayOrientation(selectedElement.id)
                                        }
                                      }}
                                    >
                                      <span>┃</span> Vertical
                                    </button>
                                  </div>
                                </div>
                              )}
                            </>
                          )}

                          {selectedElement.linkedRoomData && (
                            <div className={styles.roomDetails}>
                              <h4>Room Details</h4>
                              <div className={styles.detailItem}>
                                <Building2 size={16} />
                                <span>{selectedElement.linkedRoomData.room}</span>
                              </div>
                              <div className={styles.detailItem}>
                                <Users size={16} />
                                <span>Capacity: {selectedElement.linkedRoomData.capacity || 30}</span>
                              </div>
                              <div className={styles.detailItem}>
                                <Layers size={16} />
                                <span>Floor: {selectedElement.linkedRoomData.floor_number || 1}</span>
                              </div>
                              {selectedElement.linkedRoomData.room_type && (
                                <div className={styles.detailItem}>
                                  <Square size={16} style={{ color: getRoomColor(selectedElement.linkedRoomData.room_type).bg }} />
                                  <span>{selectedElement.linkedRoomData.room_type}</span>
                                </div>
                              )}
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

                              {/* Current schedule info in live mode */}
                              {viewMode === 'live' && showScheduleOverlay && (
                                <div className={styles.liveRoomStatus}>
                                  <h5>Current Status</h5>
                                  {(() => {
                                    const currentClass = getCurrentClass(selectedElement.linkedRoomData.room)
                                    const availability = getRoomAvailability(selectedElement.linkedRoomData.room)
                                    return currentClass ? (
                                      <div className={styles.occupiedInfo}>
                                        <div className={`${styles.statusBadge} ${styles.occupied}`}>
                                          <Clock size={14} /> Occupied
                                        </div>
                                        <div className={styles.classDetails}>
                                          <span className={styles.courseCode}>{currentClass.course_code}</span>
                                          <span className={styles.section}>{currentClass.section}</span>
                                          <span className={styles.time}>{currentClass.schedule_time}</span>
                                          {currentClass.teacher_name && (
                                            <span className={styles.teacher}>{currentClass.teacher_name}</span>
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className={`${styles.statusBadge} ${styles.available}`}>
                                        <CheckCircle size={14} /> Available
                                      </div>
                                    )
                                  })()}
                                </div>
                              )}

                              <a
                                href={`/LandingPages/Rooms-Management?room=${selectedElement.linkedRoomData.id}`}
                                target="_blank"
                                className={styles.editRoomLink}
                              >
                                <ExternalLink size={14} />
                                Edit in Rooms Management
                              </a>
                            </div>
                          )}

                          {viewMode === 'editor' && (
                            <>
                              <button
                                className={styles.lockBtn}
                                onClick={() => toggleElementLock(selectedElement.id)}
                              >
                                {selectedElement.isLocked ? <Unlock size={16} /> : <Lock size={16} />}
                                {selectedElement.isLocked ? 'Unlock' : 'Lock'} Element
                              </button>

                              <button
                                className={styles.deleteBtn}
                                onClick={() => removeElement(selectedElement.id)}
                              >
                                <Trash2 size={16} />
                                Remove Element
                              </button>
                            </>
                          )}
                        </>
                      ) : (
                        <div className={styles.noSelection}>
                          <MousePointer size={32} />
                          <p>Select an element to view {viewMode === 'live' ? 'room info' : 'properties'}</p>
                        </div>
                      )}

                      {/* Legend */}
                      <div className={styles.legend}>
                        <h4>LEGEND</h4>
                        {showScheduleOverlay && (viewMode === 'live' || viewMode === 'floorplan') && (
                          <div className={styles.availabilityLegend}>
                            <div className={styles.legendItem}>
                              <div className={`${styles.availabilityDotLegend} ${styles.available}`} />
                              <span>Available</span>
                            </div>
                            <div className={styles.legendItem}>
                              <div className={`${styles.availabilityDotLegend} ${styles.occupied}`} />
                              <span>Occupied</span>
                            </div>
                          </div>
                        )}
                        <p className={styles.legendHint}>
                          Colors based on room types on canvas.
                        </p>
                        <div className={styles.legendItems}>
                          {getLegendItems().length > 0 ? getLegendItems().map(item => (
                            <div key={item.type} className={styles.legendItem}>
                              <div
                                className={styles.legendColor}
                                style={{ backgroundColor: item.bg }}
                              />
                              <span>- {item.label}</span>
                            </div>
                          )) : (
                            <div className={styles.legendEmpty}>
                              Add rooms to see legend
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Layers Tab Content */}
                {activeRightTab === 'layers' && viewMode === 'editor' && (
                  <div className={styles.layersContent}>
                    {/* Canvas Size Section */}
                    <div className={styles.layerSection}>
                      <div className={styles.layerSectionHeader}>
                        <Maximize2 size={16} />
                        <span>Canvas Size</span>
                      </div>
                      <div className={styles.layerSettings}>
                        <select
                          className={styles.canvasSizeSelect}
                          value={presetSize}
                          onChange={(e) => {
                            const newPreset = e.target.value as keyof typeof PAPER_SIZES
                            setPresetSize(newPreset)
                            if (newPreset !== 'custom') {
                              setCanvasSize({
                                width: PAPER_SIZES[newPreset].width,
                                height: PAPER_SIZES[newPreset].height
                              })
                            }
                          }}
                        >
                          {Object.entries(PAPER_SIZES).map(([key, val]) => (
                            <option key={key} value={key}>{val.name}</option>
                          ))}
                        </select>

                        {(presetSize === 'custom' || true) && (
                          <div className={styles.customSizeRow}>
                            <div className={styles.customSizeInputGroup}>
                              <label>Width (px)</label>
                              <input
                                type="number"
                                className={styles.propertyInput}
                                value={canvasSize.width}
                                onChange={(e) => {
                                  const w = Number(e.target.value)
                                  setCanvasSize(p => ({ ...p, width: w }))
                                  setPresetSize('custom')
                                }}
                              />
                            </div>
                            <div className={styles.customSizeInputGroup}>
                              <label>Height (px)</label>
                              <input
                                type="number"
                                className={styles.propertyInput}
                                value={canvasSize.height}
                                onChange={(e) => {
                                  const h = Number(e.target.value)
                                  setCanvasSize(p => ({ ...p, height: h }))
                                  setPresetSize('custom')
                                }}
                              />
                            </div>
                          </div>
                        )}
                        <p className={styles.legendHint} style={{ marginTop: '8px' }}>
                          Standard landscape bonding paper sizes at 96 DPI.
                        </p>
                      </div>
                    </div>

                    {/* Background Settings */}
                    <div className={styles.layerSection}>
                      <div className={styles.layerSectionHeader}>
                        <LayoutGrid size={16} />
                        <span>Background</span>
                      </div>
                      <div className={styles.layerSettings}>
                        <div className={styles.layerSettingRow}>
                          <label>Show Grid</label>
                          <button
                            className={`${styles.toggleBtn} ${showGrid ? styles.active : ''}`}
                            onClick={() => setShowGrid(!showGrid)}
                          >
                            {showGrid ? 'ON' : 'OFF'}
                          </button>
                        </div>
                        {showGrid && (
                          <div className={styles.layerSettingRow}>
                            <label>Grid Size</label>
                            <div className={styles.gridSizeControl}>
                              <button onClick={() => setGridSize(Math.max(10, gridSize - 5))}>-</button>
                              <span>{gridSize}px</span>
                              <button onClick={() => setGridSize(Math.min(50, gridSize + 5))}>+</button>
                            </div>
                          </div>
                        )}
                        <div className={styles.layerSettingRow}>
                          <label>Snap to Grid</label>
                          <button
                            className={`${styles.toggleBtn} ${snapToGrid ? styles.active : ''}`}
                            onClick={() => setSnapToGrid(!snapToGrid)}
                          >
                            {snapToGrid ? 'ON' : 'OFF'}
                          </button>
                        </div>
                        <div className={styles.layerSettingRow}>
                          <label>Background Color</label>
                          <div className={styles.bgColorPicker}>
                            <input
                              type="color"
                              value={canvasBackground}
                              onChange={(e) => setCanvasBackground(e.target.value)}
                            />
                            <span>{canvasBackground}</span>
                          </div>
                        </div>
                        <div className={styles.bgPresets}>
                          <button onClick={() => setCanvasBackground('#ffffff')} title="White" style={{ background: '#ffffff' }} />
                          <button onClick={() => setCanvasBackground('#f0fdf4')} title="Light Green" style={{ background: '#f0fdf4' }} />
                          <button onClick={() => setCanvasBackground('#f8fafc')} title="Light Gray" style={{ background: '#f8fafc' }} />
                          <button onClick={() => setCanvasBackground('#fef3c7')} title="Cream" style={{ background: '#fef3c7' }} />
                          <button onClick={() => setCanvasBackground('#e0e7ff')} title="Light Blue" style={{ background: '#e0e7ff' }} />
                          <button onClick={() => setCanvasBackground('#fce7f3')} title="Light Pink" style={{ background: '#fce7f3' }} />
                        </div>
                      </div>
                    </div>

                    {/* Layer List */}
                    <div className={styles.layerSection}>
                      <div className={styles.layerSectionHeader}>
                        <Layers size={16} />
                        <span>Elements ({canvasElements.length})</span>
                      </div>
                      <div className={styles.layerList}>
                        {canvasElements.length === 0 ? (
                          <div className={styles.noLayers}>
                            <LayoutList size={24} />
                            <p>No elements on canvas</p>
                          </div>
                        ) : (
                          [...canvasElements]
                            .sort((a, b) => b.zIndex - a.zIndex)
                            .map((element, index) => (
                              <div
                                key={element.id}
                                className={`${styles.layerItem} ${selectedElement?.id === element.id ? styles.selected : ''} ${!isLayerVisible(element.id) ? styles.hidden : ''}`}
                                onClick={() => {
                                  setSelectedElement(element)
                                  setEditForm({
                                    label: element.label || '',
                                    type: element.type,
                                    width: element.width,
                                    height: element.height,
                                    x: element.x,
                                    y: element.y,
                                    color: element.color || '',
                                    rotation: element.rotation,
                                    iconType: element.iconType || '',
                                    fontSize: element.fontSize || 14,
                                    opacity: element.opacity ?? 100,
                                    borderWidth: element.borderWidth ?? 2
                                  })
                                }}
                              >
                                <div className={styles.layerDragHandle}>
                                  <Grip size={14} />
                                </div>
                                <div className={styles.layerInfo}>
                                  <div
                                    className={styles.layerColorDot}
                                    style={{ backgroundColor: element.color || '#3b82f6' }}
                                  />
                                  <span className={styles.layerName}>
                                    {element.label || element.type}
                                  </span>
                                  <span className={styles.layerType}>
                                    {element.type}
                                  </span>
                                </div>
                                <div className={styles.layerActions}>
                                  <button
                                    className={styles.layerActionBtn}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      toggleLayerVisibility(element.id)
                                    }}
                                    title={isLayerVisible(element.id) ? 'Hide layer' : 'Show layer'}
                                  >
                                    {isLayerVisible(element.id) ? <Eye size={14} /> : <EyeOff size={14} />}
                                  </button>
                                  <button
                                    className={styles.layerActionBtn}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      toggleElementLock(element.id)
                                    }}
                                    title={element.isLocked ? 'Unlock layer' : 'Lock layer'}
                                  >
                                    {element.isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                                  </button>
                                  <button
                                    className={`${styles.layerActionBtn} ${styles.deleteBtn}`}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      removeElement(element.id)
                                    }}
                                    title="Delete layer"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    </div>

                    {/* Layer Controls */}
                    {selectedElement && (
                      <div className={styles.layerControls}>
                        <div className={styles.layerControlHeader}>
                          <span>Arrange: {selectedElement.label || selectedElement.type}</span>
                        </div>
                        <div className={styles.layerControlBtns}>
                          <button
                            className={styles.layerControlBtn}
                            onClick={() => bringToFront(selectedElement.id)}
                            title="Bring to Front"
                          >
                            <ChevronsUp size={16} />
                            <span>Front</span>
                          </button>
                          <button
                            className={styles.layerControlBtn}
                            onClick={() => moveLayerUp(selectedElement.id)}
                            title="Move Up"
                          >
                            <MoveUp size={16} />
                            <span>Up</span>
                          </button>
                          <button
                            className={styles.layerControlBtn}
                            onClick={() => moveLayerDown(selectedElement.id)}
                            title="Move Down"
                          >
                            <MoveDown size={16} />
                            <span>Down</span>
                          </button>
                          <button
                            className={styles.layerControlBtn}
                            onClick={() => sendToBack(selectedElement.id)}
                            title="Send to Back"
                          >
                            <ChevronsDown size={16} />
                            <span>Back</span>
                          </button>
                        </div>
                        <div className={styles.layerZIndex}>
                          Z-Index: {selectedElement.zIndex}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main >

      {/* Load Modal */}
      {
        showLoadModal && (
          <div className={styles.modalOverlay} onClick={() => setShowLoadModal(false)}>
            <div className={`${styles.modal} ${styles.largeModal}`} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', width: '90%' }}>
              <div className={styles.modalHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ padding: '0.5rem', borderRadius: '0.5rem', background: 'var(--primary-light)', color: 'var(--primary-color)' }}>
                    <FolderOpen size={24} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Load Floor Plan</h2>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>Select a floor plan to edit or view</p>
                  </div>
                </div>
                <button onClick={() => setShowLoadModal(false)} className={styles.closeBtn}><X size={20} /></button>
              </div>

              <div className={styles.loadModalBody}>
                {/* Left Column: Plan List */}
                <div className={styles.planListColumn}>
                  {savedFloorPlans.length === 0 ? (
                    <div className={styles.emptyState}>
                      <FolderOpen size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                      <p>No saved floor plans yet.</p>
                      <button className={styles.createNewBtn} onClick={createNewDraft} style={{ marginTop: '1rem' }}>
                        Create New Draft
                      </button>
                    </div>
                  ) : (
                    <div className={styles.groupList}>
                      {/* Group by Building */}
                      {Object.entries(
                        savedFloorPlans.reduce((acc, plan) => {
                          const building = plan.canvas_data?.building || 'Uncategorized';
                          if (!acc[building]) acc[building] = [];
                          acc[building].push(plan);
                          return acc;
                        }, {} as Record<string, FloorPlan[]>)
                      ).sort((a, b) => a[0].localeCompare(b[0])).map(([buildingName, plans]) => (
                        <div key={buildingName} className={styles.buildingGroup} style={{ marginBottom: '1.5rem' }}>
                          <h3 style={{
                            fontSize: '0.875rem',
                            fontWeight: 700,
                            color: '#6b7280',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            marginBottom: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}>
                            <Building2 size={14} />
                            {buildingName}
                          </h3>

                          {/* Group by Floor within Building */}
                          {Object.entries(
                            plans.reduce((acc, plan) => {
                              const floor = plan.floor_number;
                              if (!acc[floor]) acc[floor] = [];
                              acc[floor].push(plan);
                              return acc;
                            }, {} as Record<number, FloorPlan[]>)
                          ).sort((a, b) => Number(a[0]) - Number(b[0])).map(([floorNum, floorPlans]) => (
                            <div key={floorNum} className={styles.floorGroup} style={{ marginLeft: '0.75rem', marginBottom: '1rem' }}>
                              <div style={{
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                color: '#374151',
                                marginBottom: '0.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                              }}>
                                <Layers size={12} />
                                Floor {floorNum}
                              </div>
                              <div className={styles.planGrid} style={{ display: 'grid', gap: '0.5rem' }}>
                                {floorPlans.map(plan => (
                                  <div
                                    key={plan.id}
                                    onClick={() => {
                                      loadFloorPlan(plan);
                                      if (window.innerWidth < 768) {
                                        setShowMobileDetails(true);
                                      }
                                    }}
                                    className={styles.planItem}
                                    style={{
                                      padding: '0.75rem',
                                      borderRadius: '0.5rem',
                                      border: currentFloorPlan?.id === plan.id ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                                      background: currentFloorPlan?.id === plan.id ? 'var(--primary-light)' : 'var(--bg-secondary)',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                      <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{plan.floor_name}</span>
                                      {plan.is_default_view && <Star size={12} fill="#eab308" color="#eab308" />}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                                      {new Date(plan.created_at || Date.now()).toLocaleDateString()}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right Column: Selected Plan Details */}
                <div className={`${styles.planDetailsColumn} ${showMobileDetails ? styles.mobileVisible : ''}`}>
                  <div className={styles.mobileDetailsHeader}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Info size={16} /> Selected Plan Details
                    </h3>
                    <button
                      className={styles.mobileToggleDetailsBtn}
                      onClick={() => setShowMobileDetails(!showMobileDetails)}
                    >
                      {showMobileDetails ? <ChevronsDown size={18} /> : <ChevronsUp size={18} />}
                    </button>
                  </div>

                  {currentFloorPlan ? (
                    <div style={{ flex: 1 }}>
                      <div className={styles.detailCard}>

                        {isEditingMetadata ? (
                          <>
                            <div className={styles.formGroup}>
                              <label>PLAN NAME</label>
                              <input
                                type="text"
                                value={metadataForm.floor_name}
                                onChange={e => setMetadataForm({ ...metadataForm, floor_name: e.target.value })}
                                className={styles.modalInput}
                              />
                            </div>

                            <div className={styles.formGrid}>
                              <div>
                                <label>BUILDING</label>
                                <select
                                  value={metadataForm.building}
                                  onChange={e => setMetadataForm({ ...metadataForm, building: e.target.value })}
                                  className={styles.modalSelect}
                                >
                                  {buildings.map(b => (
                                    <option key={b} value={b}>{b}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label>FLOOR</label>
                                <input
                                  type="number"
                                  value={metadataForm.floor_number}
                                  onChange={e => setMetadataForm({ ...metadataForm, floor_number: Number(e.target.value) })}
                                  className={styles.modalInput}
                                />
                              </div>
                            </div>

                            <div className={styles.editActions}>
                              <button
                                onClick={updateFloorPlanMetadata}
                                className={styles.saveModalBtn}
                                disabled={saving}
                              >
                                {saving ? <RotateCcw size={14} className={styles.spinning} /> : <CheckCircle size={14} />} Save
                              </button>
                              <button
                                onClick={() => setIsEditingMetadata(false)}
                                className={styles.cancelBtn}
                              >
                                Cancel
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className={styles.editBtnWrapper}>
                              <button
                                onClick={startEditingMetadata}
                                className={styles.iconBtn}
                                title="Edit Details"
                              >
                                <Edit size={16} />
                              </button>
                            </div>

                            <div className={styles.fieldGroup}>
                              <label>PLAN NAME</label>
                              <div className={styles.fieldValue}>{currentFloorPlan.floor_name}</div>
                            </div>

                            <div className={styles.formGrid}>
                              <div>
                                <label>BUILDING</label>
                                <div className={styles.fieldValue}>{currentFloorPlan.canvas_data?.building || 'Unknown'}</div>
                              </div>
                              <div>
                                <label>FLOOR</label>
                                <div className={styles.fieldValue}>{currentFloorPlan.floor_number}</div>
                              </div>
                            </div>

                            <div className={styles.fieldGroup}>
                              <label>LAST UPDATED</label>
                              <div className={styles.fieldValue}>{new Date(currentFloorPlan.updated_at || currentFloorPlan.created_at || Date.now()).toLocaleString()}</div>
                            </div>
                          </>
                        )}

                        {currentFloorPlan.is_default_view && (
                          <div className={styles.defaultBadge}>
                            <Star size={14} fill="currentColor" />
                            <span>This is the default view for visitors</span>
                          </div>
                        )}
                      </div>

                      <div className={styles.actionButtons} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <button
                          onClick={() => setShowLoadModal(false)}
                          style={{
                            width: '100%', padding: '0.75rem', borderRadius: '0.5rem',
                            background: 'var(--primary-color)', color: 'white', border: 'none',
                            fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                          }}
                        >
                          <CheckCircle size={18} /> Confirm Selection
                        </button>

                        <button
                          onClick={() => deleteFloorPlan(currentFloorPlan.id)}
                          style={{
                            width: '100%', padding: '0.75rem', borderRadius: '0.5rem',
                            background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca',
                            fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                          }}
                        >
                          <Trash2 size={18} /> Delete Plan
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: '#6b7280', marginTop: '2rem' }}>
                      <MousePointer size={32} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                      <p>Select a floor plan from the list to view details.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.modalFooter} style={{ justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', padding: '1rem 1.5rem' }}>
                <button className={styles.createNewBtn} onClick={createNewDraft} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Plus size={16} /> Create New Draft
                </button>
                <button className={styles.cancelBtn} onClick={() => setShowLoadModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Save Modal */}
      {
        showSaveModal && (
          <div className={styles.modalOverlay} onClick={() => setShowSaveModal(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h2><Save size={20} /> Save Floor Plan</h2>
                <button onClick={() => setShowSaveModal(false)}><X size={20} /></button>
              </div>
              <div className={styles.modalBody}>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '0.875rem' }}>
                  <div>
                    <span style={{ color: '#64748b', fontWeight: 500, marginRight: '0.5rem' }}>Building:</span>
                    <span style={{ color: '#0f172a', fontWeight: 600 }}>{selectedBuilding}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontWeight: 500, marginRight: '0.5rem' }}>Floor:</span>
                    <span style={{ color: '#0f172a', fontWeight: 600 }}>{selectedFloor}</span>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Floor Plan Name</label>
                  <input
                    type="text"
                    value={floorPlanName}
                    onChange={(e) => setFloorPlanName(e.target.value)}
                    placeholder={`Floor ${selectedFloor}`}
                    className={styles.modalInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Link to Schedule (for Live View)</label>
                  <select
                    value={selectedScheduleId || ''}
                    onChange={(e) => setSelectedScheduleId(Number(e.target.value) || null)}
                    className={styles.modalSelect}
                  >
                    <option value="">No linked schedule</option>
                    {schedules.map(s => (
                      <option key={s.id} value={s.id}>{s.schedule_name} {s.is_default ? '(Default)' : ''}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.checkboxGroup}>
                  <input
                    type="checkbox"
                    id="isDefault"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                  />
                  <label htmlFor="isDefault">
                    <Star size={16} />
                    Set as default floor plan (faculty will see this)
                  </label>
                </div>
                <div className={styles.checkboxGroup}>
                  <input
                    type="checkbox"
                    id="isPublished"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                  />
                  <label htmlFor="isPublished">
                    <Eye size={16} />
                    Publish floor plan (make visible to faculty)
                  </label>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button className={styles.cancelBtn} onClick={() => setShowSaveModal(false)}>
                  Cancel
                </button>
                <button className={styles.saveModalBtn} onClick={saveFloorPlan} disabled={saving}>
                  {saving ? <RotateCcw size={16} className={styles.spinning} /> : <Save size={16} />}
                  {saving ? 'Saving...' : 'Save Floor Plan'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Export Preview Modal */}
      {showExportPreview && (
        <div className={styles.modalOverlay} onClick={() => setShowExportPreview(false)}>
          <div className={styles.exportPreviewModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2><Download size={20} /> Export PDF Preview</h2>
              <button onClick={() => setShowExportPreview(false)}><X size={20} /></button>
            </div>
            <div className={styles.exportPreviewContent}>
              {/* Left: Settings Panel */}
              <div className={styles.exportSettingsPanel}>
                <div className={styles.exportSettingsScroll}>
                  <h4 className={styles.exportSectionTitle}>
                    <Type size={16} /> Document Labels
                  </h4>

                  <div className={styles.exportField}>
                    <label>Title</label>
                    <input
                      type="text"
                      value={exportSettings.title}
                      onChange={(e) => setExportSettings(p => ({ ...p, title: e.target.value }))}
                      placeholder="Floor Plan Title"
                      className={styles.modalInput}
                    />
                  </div>

                  <div className={styles.exportField}>
                    <label>Subtitle / Schedule</label>
                    <input
                      type="text"
                      value={exportSettings.subtitle}
                      onChange={(e) => setExportSettings(p => ({ ...p, subtitle: e.target.value }))}
                      placeholder="Schedule or subtitle"
                      className={styles.modalInput}
                    />
                  </div>

                  <div className={styles.exportFieldRow}>
                    <div className={styles.exportField}>
                      <label>Building</label>
                      <input
                        type="text"
                        value={exportSettings.buildingLabel}
                        onChange={(e) => setExportSettings(p => ({ ...p, buildingLabel: e.target.value }))}
                        placeholder="Building name"
                        className={styles.modalInput}
                      />
                    </div>
                    <div className={styles.exportField}>
                      <label>Floor Name</label>
                      <input
                        type="text"
                        value={exportSettings.floorName}
                        onChange={(e) => setExportSettings(p => ({ ...p, floorName: e.target.value }))}
                        placeholder="e.g. Ground Floor"
                        className={styles.modalInput}
                      />
                    </div>
                  </div>

                  <div className={styles.exportFieldRow}>
                    <div className={styles.exportField}>
                      <label>Floor Number</label>
                      <input
                        type="text"
                        value={exportSettings.floorNumber}
                        onChange={(e) => setExportSettings(p => ({ ...p, floorNumber: e.target.value }))}
                        placeholder="1"
                        className={styles.modalInput}
                      />
                    </div>
                    <div className={styles.exportField}>
                      <label>Orientation</label>
                      <select
                        value={exportSettings.orientation}
                        onChange={(e) => setExportSettings(p => ({ ...p, orientation: e.target.value as any }))}
                        className={styles.modalSelect}
                      >
                        <option value="auto">Auto</option>
                        <option value="landscape">Landscape</option>
                        <option value="portrait">Portrait</option>
                      </select>
                    </div>
                  </div>

                  <div className={styles.exportFieldRow}>
                    <div className={styles.exportField}>
                      <label>Paper Size</label>
                      <select
                        value={exportSettings.paperSize}
                        onChange={(e) => setExportSettings(p => ({ ...p, paperSize: e.target.value as any }))}
                        className={styles.modalSelect}
                      >
                        <option value="letter">Letter (8.5" x 11")</option>
                        <option value="legal">Legal (8.5" x 14")</option>
                        <option value="a4">A4 (210 x 297 mm)</option>
                        <option value="custom">Custom Size</option>
                      </select>
                    </div>
                    {exportSettings.paperSize === 'custom' && (
                      <div className={styles.exportField}>
                        <label>Dimensions (px)</label>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <input
                            type="number"
                            value={exportSettings.customPaperWidth}
                            onChange={(e) => setExportSettings(p => ({ ...p, customPaperWidth: Number(e.target.value) }))}
                            className={styles.modalInput}
                            style={{ width: '60px' }}
                            placeholder="W"
                          />
                          <input
                            type="number"
                            value={exportSettings.customPaperHeight}
                            onChange={(e) => setExportSettings(p => ({ ...p, customPaperHeight: Number(e.target.value) }))}
                            className={styles.modalInput}
                            style={{ width: '60px' }}
                            placeholder="H"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <h4 className={styles.exportSectionTitle}>
                    <Settings size={16} /> Typography
                  </h4>

                  <div className={styles.exportFieldRow}>
                    <div className={styles.exportField}>
                      <label>Room Label Size: {exportSettings.roomFontSize}pt</label>
                      <input
                        type="range"
                        min="6"
                        max="20"
                        step="1"
                        value={exportSettings.roomFontSize}
                        onChange={(e) => setExportSettings(p => ({ ...p, roomFontSize: Number(e.target.value) }))}
                        className={styles.exportSlider}
                      />
                    </div>
                    <div className={styles.exportField}>
                      <label>Map Scale: {exportSettings.mapScale}%</label>
                      <input
                        type="range"
                        min="50"
                        max="200"
                        step="5"
                        value={exportSettings.mapScale}
                        onChange={(e) => setExportSettings(p => ({ ...p, mapScale: Number(e.target.value) }))}
                        className={styles.exportSlider}
                      />
                    </div>
                  </div>

                  <h4 className={styles.exportSectionTitle}>
                    <Eye size={16} /> Visibility
                  </h4>

                  <div className={styles.exportTogglesGrid}>
                    <label className={styles.exportToggle}>
                      <input
                        type="checkbox"
                        checked={exportSettings.showWatermark}
                        onChange={(e) => setExportSettings(p => ({ ...p, showWatermark: e.target.checked }))}
                      />
                      <span className={styles.exportToggleSlider} />
                      <span>QTime Watermark</span>
                    </label>
                    <label className={styles.exportToggle}>
                      <input
                        type="checkbox"
                        checked={exportSettings.showLegend}
                        onChange={(e) => setExportSettings(p => ({ ...p, showLegend: e.target.checked }))}
                      />
                      <span className={styles.exportToggleSlider} />
                      <span>Legend</span>
                    </label>
                    <label className={styles.exportToggle}>
                      <input
                        type="checkbox"
                        checked={exportSettings.showDate}
                        onChange={(e) => setExportSettings(p => ({ ...p, showDate: e.target.checked }))}
                      />
                      <span className={styles.exportToggleSlider} />
                      <span>Date</span>
                    </label>
                    <label className={styles.exportToggle}>
                      <input
                        type="checkbox"
                        checked={exportSettings.showScheduleInfo}
                        onChange={(e) => setExportSettings(p => ({ ...p, showScheduleInfo: e.target.checked }))}
                      />
                      <span className={styles.exportToggleSlider} />
                      <span>Schedule Info</span>
                    </label>
                    <label className={styles.exportToggle}>
                      <input
                        type="checkbox"
                        checked={exportSettings.showRoomLabels}
                        onChange={(e) => setExportSettings(p => ({ ...p, showRoomLabels: e.target.checked }))}
                      />
                      <span className={styles.exportToggleSlider} />
                      <span>Room Labels</span>
                    </label>
                    <label className={styles.exportToggle}>
                      <input
                        type="checkbox"
                        checked={exportSettings.useWhiteBackground}
                        onChange={(e) => setExportSettings(p => ({ ...p, useWhiteBackground: e.target.checked }))}
                      />
                      <span className={styles.exportToggleSlider} />
                      <span>White Background</span>
                    </label>
                  </div>
                </div>

                <div className={styles.exportActions}>
                  <button className={styles.cancelBtn} onClick={() => setShowExportPreview(false)}>
                    Cancel
                  </button>
                  <button className={styles.saveModalBtn} onClick={exportPDF}>
                    <Download size={16} />
                    Export PDF
                  </button>
                </div>
              </div>

              {/* Right: Preview Canvas */}
              <div className={styles.exportPreviewArea}>
                <div className={styles.exportPreviewLabel}>
                  <Eye size={14} /> Live Preview
                </div>
                <div className={styles.exportCanvasWrapper}>
                  <canvas
                    ref={exportCanvasRef}
                    className={styles.exportCanvas}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {
        showShareModal && (
          <div className={styles.modalOverlay} onClick={() => setShowShareModal(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h2><Share2 size={20} /> Share Floor Plan</h2>
                <button onClick={() => setShowShareModal(false)}><X size={20} /></button>
              </div>
              <div className={styles.modalBody}>
                <p>Share this link with faculty members to let them view the floor plan:</p>
                <div className={styles.shareLink}>
                  <input
                    type="text"
                    readOnly
                    value={currentFloorPlan?.id ? `${mounted ? window.location.origin : ''}/floor-plan/view/${currentFloorPlan.id}` : 'Save floor plan first'}
                    className={styles.modalInput}
                  />
                  <button
                    className={styles.copyBtn}
                    onClick={() => {
                      if (currentFloorPlan?.id) {
                        navigator.clipboard.writeText(`${window.location.origin}/floor-plan/view/${currentFloorPlan.id}`)
                        showNotification('success', 'Link copied!')
                      }
                    }}
                  >
                    <Copy size={16} />
                  </button>
                </div>
                <div className={styles.shareInfo}>
                  <Info size={16} />
                  <span>Faculty members can view room availability when this floor plan is set as default.</span>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button className={styles.cancelBtn} onClick={() => setShowShareModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Mobile Floating Action Buttons - shown in all view modes */}
      {
        showMobileFAB && (
          <div className={styles.mobileFAB}>
            {viewMode === 'editor' && (
              <button
                className={`${styles.fabButton} ${activeMobilePanel === 'toolbox' ? styles.active : ''}`}
                onClick={() => toggleMobilePanel('toolbox')}
                title="Toolbox"
              >
                <Wrench size={20} />
              </button>
            )}
            <button
              className={`${styles.fabButton} ${activeMobilePanel === 'properties' ? styles.active : ''}`}
              onClick={() => toggleMobilePanel('properties')}
              title={viewMode === 'editor' ? "Properties" : "Room Info"}
            >
              {viewMode === 'editor' ? <Settings size={20} /> : <Info size={20} />}
            </button>
            <button
              className={`${styles.fabButton} ${activeMobilePanel === 'floorPlans' ? styles.active : ''}`}
              onClick={() => toggleMobilePanel('floorPlans')}
              title="Floor Plans"
            >
              <FileText size={20} />
            </button>
            <button
              className={styles.fabButton}
              onClick={() => setShowLoadModal(true)}
              title="Load Floor Plan"
            >
              <FolderOpen size={20} />
            </button>
          </div>
        )
      }

      {/* Mobile Panel Overlay */}
      {
        showMobileFAB && activeMobilePanel !== 'none' && (
          <div
            className={styles.mobileOverlay}
            onClick={() => {
              setActiveMobilePanel('none')
              setLeftPanelOpen(false)
              setRightPanelOpen(false)
            }}
          />
        )
      }

      {/* Notification */}
      {
        notification && (
          <div className={`${styles.notification} ${styles[notification.type]}`}>
            {notification.type === 'success' && <CheckCircle size={18} />}
            {notification.type === 'error' && <X size={18} />}
            {notification.type === 'info' && <Info size={18} />}
            <span>{notification.message}</span>
          </div>
        )
      }
    </div>
  )
}

