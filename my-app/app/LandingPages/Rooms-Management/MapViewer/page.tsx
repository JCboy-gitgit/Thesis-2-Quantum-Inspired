'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import LoadingFallback from '@/app/components/LoadingFallback'
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
  room_id?: number
  building: string
  course_code: string
  section: string
  schedule_day: string
  schedule_time: string
  teacher_name?: string
  faculty_name?: string
}

interface CanvasElement {
  id: string
  type: 'room' | 'wall' | 'door' | 'text' | 'icon' | 'hallway' | 'stair' | 'shape'
  groupId?: string
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
  textColor?: string
  iconColor?: string
  isLocked?: boolean
  orientation?: 'horizontal' | 'vertical'  // For hallways
  opacity?: number  // 0-100 for transparency
  textBackgroundOpacity?: number  // 0-100 for text label background only
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
  const exportRenderMetricsRef = useRef<{
    canvasX: number
    canvasY: number
    canvasW: number
    canvasH: number
    planW: number
    planH: number
    maxOffsetXPx: number
    maxOffsetYPx: number
  } | null>(null)
  const exportDragRef = useRef<{
    startClientX: number
    startClientY: number
    startOffsetXPx: number
    startOffsetYPx: number
  } | null>(null)

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

  // Mode state: 'editor' for editing, 'live' for real-time availability
  const [viewMode, setViewMode] = useState<'editor' | 'live'>('editor')
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
  const clipboardElementsRef = useRef<CanvasElement[]>([])
  const pasteOffsetRef = useRef(0)
  const [canvasContextMenu, setCanvasContextMenu] = useState<{
    visible: boolean
    x: number
    y: number
    targetElementId: string | null
  }>({
    visible: false,
    x: 0,
    y: 0,
    targetElementId: null,
  })

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
  const changeVersionRef = useRef(0)

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
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)

  const getGroupMemberIds = useCallback((groupId?: string) => {
    if (!groupId) return []
    return canvasElements.filter(el => el.groupId === groupId).map(el => el.id)
  }, [canvasElements])

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
          textColor: getContrastColor(colors.bg),
          iconColor: getContrastColor(colors.bg),
          linkedRoomId: room.id,
          linkedRoomData: room,
          zIndex: canvasElements.length + 1
        }
        setCanvasElements(prev => [...prev, newElement])
        showNotification('success', `Added ${room.room} to canvas`)
      }
    } else if (dragItem.type === 'toolbox') {
      const item = dragItem.data
      const isTextItem = item.type === 'text'
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
        textColor: isTextItem ? '#1f2937' : getContrastColor(item.color || '#1f2937'),
        iconColor: isTextItem ? '#1f2937' : getContrastColor(item.color || '#1f2937'),
        textBackgroundOpacity: isTextItem ? 0 : undefined,
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
        textColor: '#374151',
        iconColor: '#ffffff',
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
        textColor: getContrastColor('#10b981'),
        iconColor: getContrastColor('#10b981'),
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
  const [roomFilterMode, setRoomFilterMode] = useState<'all' | 'placed' | 'unplaced'>('all')
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showShortcutsModal, setShowShortcutsModal] = useState(false)
  const [isFocusMode, setIsFocusMode] = useState(false)
  const [liveRoomModalRoom, setLiveRoomModalRoom] = useState<Room | null>(null)
  const [showAdminActionsMenu, setShowAdminActionsMenu] = useState(false)
  const [adminMenuPosition, setAdminMenuPosition] = useState({ top: 0, left: 0 })
  const [showExportPreview, setShowExportPreview] = useState(false)
  const [isDraggingExportMap, setIsDraggingExportMap] = useState(false)
  const roomSearchInputRef = useRef<HTMLInputElement>(null)
  const focusPanelStateRef = useRef({ left: true, right: true })
  const adminActionsRef = useRef<HTMLDivElement>(null)
  const adminActionsButtonRef = useRef<HTMLButtonElement>(null)
  const exportCanvasRef = useRef<HTMLCanvasElement>(null)
  const exportSnapshotRef = useRef<HTMLCanvasElement | null>(null)
  const exportSnapshotPromiseRef = useRef<Promise<HTMLCanvasElement | null> | null>(null)
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
    mapOffsetX: 0,
    mapOffsetY: 0,
    labelsOffsetX: 0,
    labelsOffsetY: 0,
    useWhiteBackground: false
  })

  useEffect(() => {
    if (!showAdminActionsMenu) return

    const updateMenuPosition = () => {
      const buttonRect = adminActionsButtonRef.current?.getBoundingClientRect()
      if (!buttonRect) return

      const menuWidth = window.innerWidth <= 768 ? 170 : 190
      const estimatedMenuHeight = 164
      const gap = 8

      const left = Math.min(
        Math.max(gap, buttonRect.right - menuWidth),
        window.innerWidth - menuWidth - gap
      )

      const showAbove = buttonRect.bottom + estimatedMenuHeight + gap > window.innerHeight
      const top = showAbove
        ? Math.max(gap, buttonRect.top - estimatedMenuHeight - gap)
        : buttonRect.bottom + gap

      setAdminMenuPosition({ top, left })
    }

    updateMenuPosition()

    const handleOutsideClick = (event: MouseEvent) => {
      if (adminActionsRef.current && !adminActionsRef.current.contains(event.target as Node)) {
        setShowAdminActionsMenu(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowAdminActionsMenu(false)
      }
    }

    const handleWindowChange = () => updateMenuPosition()

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('resize', handleWindowChange)
    window.addEventListener('scroll', handleWindowChange, true)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('resize', handleWindowChange)
      window.removeEventListener('scroll', handleWindowChange, true)
    }
  }, [showAdminActionsMenu])

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
  const historyInitializedRef = useRef(false)

  // Record state to history whenever canvasElements changes (but not from undo/redo itself)
  useEffect(() => {
    if (!historyInitializedRef.current) {
      historyInitializedRef.current = true
      setHistory([canvasElements])
      setHistoryIndex(0)
      ignoreUnsavedRef.current = false
      return
    }

    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false
      return
    }
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1)
      newHistory.push(canvasElements)
      // Keep last 50 states — if we overflow, trim from the front
      if (newHistory.length > 50) newHistory.shift()
      return newHistory
    })
    setHistoryIndex(prev => {
      const next = prev + 1
      // If history was trimmed, the index stays at 49, not 50
      return Math.min(next, 49)
    })

    if (!isUndoRedoRef.current && !ignoreUnsavedRef.current) {
      changeVersionRef.current += 1
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
    textColor: '#1f2937',
    iconColor: '#1f2937',
    rotation: 0,
    iconType: '',
    fontSize: 14,
    opacity: 100,
    textBackgroundOpacity: 0,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalTheme])

  const toggleSidebar = () => setSidebarOpen(prev => !prev)
  const handleMenuBarToggle = (isHidden: boolean) => setMenuBarHidden(isHidden)

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

  // Show notification (clears previous timer so rapid notifications don't vanish too early)
  const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current)
    setNotification({ type, message })
    notificationTimerRef.current = setTimeout(() => setNotification(null), 3000)
  }

  const toggleFocusMode = useCallback(() => {
    if (isMobile) return

    setIsFocusMode(prev => {
      if (prev) {
        setLeftPanelOpen(focusPanelStateRef.current.left)
        setRightPanelOpen(focusPanelStateRef.current.right)
        return false
      }

      focusPanelStateRef.current = {
        left: leftPanelOpenRef.current,
        right: rightPanelOpenRef.current
      }
      setLeftPanelOpen(false)
      setRightPanelOpen(false)
      return true
    })
  }, [isMobile])

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

  useEffect(() => {
    if (!mounted) return
    const stored = window.localStorage.getItem('mapviewer_autosave_enabled')
    if (stored !== null) {
      setAutoSaveEnabled(stored === '1')
    }
  }, [mounted])

  useEffect(() => {
    if (!mounted) return
    window.localStorage.setItem('mapviewer_autosave_enabled', autoSaveEnabled ? '1' : '0')
  }, [autoSaveEnabled, mounted])
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

  useEffect(() => {
    if (viewMode !== 'live') {
      setLiveRoomModalRoom(null)
    }
  }, [viewMode, currentFloorPlan?.id])

  useEffect(() => {
    if (isMobile && isFocusMode) {
      setIsFocusMode(false)
    }
  }, [isMobile, isFocusMode])

  const fitCanvasToViewport = useCallback(() => {
    const container = canvasContainerRef.current
    if (!container) return

    const padding = 80
    const availW = container.clientWidth - padding
    const availH = container.clientHeight - padding
    if (availW <= 0 || availH <= 0) return

    const scaleX = (availW / canvasSize.width) * 100
    const scaleY = (availH / canvasSize.height) * 100
    const best = Math.min(scaleX, scaleY)
    setZoom(Math.max(25, Math.round(best)))
  }, [canvasSize.height, canvasSize.width])

  const hasAutoFittedRef = useRef(false)

  // Auto-fit zoom: calculate best zoom to fit canvas in viewport on mount
  useEffect(() => {
    if (hasAutoFittedRef.current) return
    const container = canvasContainerRef.current
    if (!container) return

    // Run once after a short delay so the container has its real size
    const timer = setTimeout(() => {
      if (!hasAutoFittedRef.current) {
        hasAutoFittedRef.current = true
        fitCanvasToViewport()
      }
    }, 200)

    return () => { clearTimeout(timer) }
  }, [fitCanvasToViewport])

  // Ctrl+Scroll wheel zoom on canvas container
  useEffect(() => {
    const container = canvasContainerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -10 : 10
        setZoom(z => Math.min(500, Math.max(25, z + delta)))
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [])

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
  // Only auto-load a floor plan on very first mount or explicit building switch
  const prevBuildingRef = useRef<string | null>(null)
  const prevFloorRef = useRef<number | null>(null)
  useEffect(() => {
    if (!selectedBuilding) return

    const isFirstLoad = prevBuildingRef.current === null
    const buildingChanged = prevBuildingRef.current !== selectedBuilding
    const floorChanged = prevFloorRef.current !== null && prevFloorRef.current !== selectedFloor

    prevBuildingRef.current = selectedBuilding
    prevFloorRef.current = selectedFloor

    fetchRooms()

    if (isFirstLoad || buildingChanged || floorChanged) {
      // Only auto-load when the user actually switched building/floor, not on re-renders
      // If there are unsaved changes, skip the auto-load to prevent data loss
      if (hasUnsavedChanges && !isFirstLoad) {
        fetchSavedFloorPlans(true) // refresh list but don't auto-load
      } else {
        fetchSavedFloorPlans()
      }
    } else {
      fetchSavedFloorPlans(true) // refresh list only, don't overwrite canvas
    }
  }, [selectedBuilding, selectedFloor])

  const fetchRooms = async () => {
    if (!selectedBuilding) return

    try {
      setLoading(true)
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

      // If current floor is invalid for this building, select the first available floor
      if (roomFloors.length > 0 && (!selectedFloor || !roomFloors.includes(selectedFloor))) {
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
        return
      }

      const floorPlanData = (data || []) as FloorPlan[]
      setSavedFloorPlans(floorPlanData)

      if (skipAutoLoad) return

      const buildingPlans = floorPlanData.filter(fp => {
        const floorName = (fp.floor_name || '').toLowerCase()
        const isSameBuildingByCanvas = (fp.canvas_data?.building || '').toLowerCase() === selectedBuilding.toLowerCase()
        const isSameBuildingByName = floorName.includes(selectedBuilding.toLowerCase())
        return isSameBuildingByCanvas || isSameBuildingByName
      })

      if (buildingPlans.length === 0) {
        return
      }

      // Find matching floor plan for current building/floor
      const match = buildingPlans.find(fp => fp.floor_number === selectedFloor)

      if (match) {
        loadFloorPlan(match, { skipUnsavedConfirm: true, showToast: false })
        return
      }

      // Fallback: load latest plan for building and sync selected floor
      const fallback = buildingPlans[0]
      if (fallback) {
        if (selectedFloor !== fallback.floor_number) {
          setSelectedFloor(fallback.floor_number)
        }
        loadFloorPlan(fallback, { skipUnsavedConfirm: true, showToast: false })
      }
    } catch (error) {
      console.error('Error fetching floor plans:', error)
    }
  }

  // Load a floor plan
  const loadFloorPlan = (
    floorPlan: FloorPlan,
    options?: { skipUnsavedConfirm?: boolean; showToast?: boolean }
  ) => {
    if (!options?.skipUnsavedConfirm && hasUnsavedChanges) {
      if (!window.confirm("You have unsaved changes that will be lost. Do you want to continue?")) {
        return
      }
    }
    ignoreUnsavedRef.current = true
    setHasUnsavedChanges(false)
    setLastSavedAt(floorPlan.updated_at ? new Date(floorPlan.updated_at) : new Date())
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
        textBackgroundOpacity: el.textBackgroundOpacity != null
          ? Number(el.textBackgroundOpacity)
          : (el.text_background_opacity != null ? Number(el.text_background_opacity) : undefined),
        borderWidth: el.borderWidth != null ? Number(el.borderWidth) : 2,
        color: el.color || el.fillColor || el.fill_color,
        borderColor: el.borderColor || el.border_color,
        textColor: el.textColor || el.text_color || el.fontColor || el.font_color,
        iconColor: el.iconColor || el.icon_color,
        fontSize: el.fontSize != null ? Number(el.fontSize) : (el.font_size != null ? Number(el.font_size) : undefined),
      }))
      setCanvasElements(normalizedElements)
    } else {
      setCanvasElements([])
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
    // Restore canvas background and grid size from saved data
    if (floorPlan.canvas_data?.backgroundColor != null) {
      setCanvasBackground(floorPlan.canvas_data.backgroundColor)
    } else if (floorPlan.background_color != null) {
      setCanvasBackground(floorPlan.background_color)
    }
    if (floorPlan.grid_size != null) {
      setGridSize(floorPlan.grid_size)
    } else if (floorPlan.canvas_data?.gridSize != null) {
      setGridSize(floorPlan.canvas_data.gridSize)
    }
    if (floorPlan.linked_schedule_id) {
      setSelectedScheduleId(floorPlan.linked_schedule_id)
    }
    if (options?.showToast !== false) {
      showNotification('success', `Loaded: ${floorPlan.floor_name}`)
    }
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
  const normalizeRoomType = (roomType?: string) => {
    if (!roomType) return 'default'
    const normalized = roomType
      .toLowerCase()
      .trim()
      .replace(/[\s-]+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
    if (!normalized) return 'default'
    return ROOM_TYPE_COLORS[normalized] ? normalized : 'default'
  }

  const getRoomColor = (roomType?: string) => {
    const type = normalizeRoomType(roomType)
    return ROOM_TYPE_COLORS[type] || ROOM_TYPE_COLORS.default
  }

  const normalizeRoomKey = (value?: string) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')

  const matchesAllocationRoom = (allocationRoom: string, roomName?: string, roomCode?: string, allocRoomId?: number, roomId?: number, allocBuilding?: string) => {
    // Match by room_id if available
    if (allocRoomId && roomId && allocRoomId === roomId) return true

    const allocKey = normalizeRoomKey(allocationRoom)
    if (!allocKey) return false
    const candidateKeys = [normalizeRoomKey(roomName), normalizeRoomKey(roomCode)].filter(Boolean)
    if (candidateKeys.includes(allocKey)) return true

    // Also check if allocRoom contains building prefix (e.g. "Building1-Room101")
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

  const normalizeDayToken = (day: string): string => {
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

  const expandScheduleDays = (dayText?: string): string[] => {
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

  const splitTimeRange = (timeStr: string): [string, string] => {
    if (!timeStr) return ['', '']
    const normalized = timeStr
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/\s+to\s+/gi, '-')
    const parts = normalized.split('-').map(part => part.trim()).filter(Boolean)
    if (parts.length < 2) return ['', '']
    return [parts[0], parts[1]]
  }

  const parseTimeToMinutes = (value: string): number => {
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

  // Shared helper: check if an allocation is active at the given day & time
  const isAllocActiveNow = (alloc: RoomAllocation, roomName: string, roomCode: string | undefined, day: string, minuteOfDay: number, roomId?: number): boolean => {
    if (!matchesAllocationRoom(alloc.room, roomName, roomCode, alloc.room_id, roomId, alloc.building)) return false

    const allocDays = expandScheduleDays(alloc.schedule_day)
    if (!allocDays.some((d) => d.toLowerCase() === day.toLowerCase())) return false

    const [startRaw, endRaw] = splitTimeRange(alloc.schedule_time || '')
    if (!startRaw || !endRaw) return false

    const startMins = parseTimeToMinutes(startRaw)
    const endMins = parseTimeToMinutes(endRaw)
    if (startMins < 0 || endMins < 0) return false

    return minuteOfDay >= startMins && minuteOfDay < endMins
  }

  // Resolve day/time context for schedule checks
  const getScheduleContext = () => {
    const now = currentTime || new Date()
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const day = selectedDay || dayNames[now.getDay()]
    const minuteOfDay = now.getHours() * 60 + now.getMinutes()
    return { day, minuteOfDay }
  }

  // Get room availability status
  const getRoomAvailability = (roomName: string, roomCode?: string, roomId?: number): 'available' | 'occupied' | 'unknown' => {
    if (!showScheduleOverlay || !selectedScheduleId || roomAllocations.length === 0) {
      return 'unknown'
    }

    const { day, minuteOfDay } = getScheduleContext()
    const isOccupied = roomAllocations.some(alloc => isAllocActiveNow(alloc, roomName, roomCode, day, minuteOfDay, roomId))
    return isOccupied ? 'occupied' : 'available'
  }

  // Get current class for a room
  const getCurrentClass = (roomName: string, roomCode?: string, roomId?: number): RoomAllocation | null => {
    if (!selectedScheduleId || roomAllocations.length === 0) return null

    const { day, minuteOfDay } = getScheduleContext()
    return roomAllocations.find(alloc => isAllocActiveNow(alloc, roomName, roomCode, day, minuteOfDay, roomId)) || null
  }

  // Snap position to grid
  const snapToGridPosition = (value: number) => {
    if (!snapToGrid) return value
    return Math.round(value / gridSize) * gridSize
  }

  // Generate unique ID (crypto.randomUUID where available, fallback for older browsers)
  const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `element_${crypto.randomUUID()}`
    }
    return `element_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Handle element selection focus
  const selectElement = useCallback((element: CanvasElement, multiSelect: boolean = false) => {
    const groupedSelection = element.groupId ? getGroupMemberIds(element.groupId) : [element.id]

    if (multiSelect) {
      setSelectedElements(prev => {
        const allSelected = groupedSelection.every(id => prev.includes(id))
        if (allSelected) {
          return prev.filter(id => !groupedSelection.includes(id))
        } else {
          return Array.from(new Set([...prev, ...groupedSelection]))
        }
      })
      if (selectedElement?.id === element.id) {
        setSelectedElement(null)
      } else if (!selectedElement) {
        setSelectedElement(element)
      }
    } else {
      setSelectedElement(element)
      setSelectedElements(groupedSelection)
    }

    const fallbackColor = getRoomColor(element.linkedRoomData?.room_type).bg
    const resolvedTextColor = resolveElementTextColor(element, fallbackColor)
    const textBackgroundOpacity = element.textBackgroundOpacity ?? (element.type === 'text' && !isTransparentColor(element.color) ? 35 : 0)

    // Always update edit form when focusing an element
    setEditForm({
      label: element.label || '',
      type: element.type,
      width: element.width,
      height: element.height,
      x: element.x,
      y: element.y,
      color: element.color || fallbackColor,
      textColor: element.textColor || resolvedTextColor,
      iconColor: element.iconColor || element.textColor || resolvedTextColor,
      rotation: element.rotation,
      iconType: element.iconType || '',
      fontSize: element.fontSize || 14,
      opacity: element.opacity ?? 100,
      textBackgroundOpacity,
      borderWidth: element.borderWidth ?? 2
    })
  }, [selectedElement, getGroupMemberIds])

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
        textColor: editForm.textColor,
        iconColor: editForm.iconColor,
        rotation: editForm.rotation,
        iconType: editForm.iconType,
        fontSize: editForm.fontSize,
        opacity: editForm.opacity,
        textBackgroundOpacity: editForm.textBackgroundOpacity,
        borderWidth: editForm.borderWidth
      })
    }, 50)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editForm])

  // Handle canvas click (deselect)
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (interactionHandledRef.current) {
      interactionHandledRef.current = false
      return
    }

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
      const fallbackColor = getRoomColor(element.linkedRoomData?.room_type).bg
      const resolvedTextColor = resolveElementTextColor(element, fallbackColor)
      const textBackgroundOpacity = element.textBackgroundOpacity ?? (element.type === 'text' && !isTransparentColor(element.color) ? 35 : 0)

      setEditForm({
        label: element.label || '',
        type: element.type,
        width: element.width,
        height: element.height,
        x: element.x,
        y: element.y,
        color: element.color || fallbackColor,
        textColor: element.textColor || resolvedTextColor,
        iconColor: element.iconColor || element.textColor || resolvedTextColor,
        rotation: element.rotation,
        iconType: element.iconType || '',
        fontSize: element.fontSize || 14,
        opacity: element.opacity ?? 100,
        textBackgroundOpacity,
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
    const groupedSelection = element.groupId ? getGroupMemberIds(element.groupId) : [element.id]
    const selections = selectedElements.includes(element.id)
      ? Array.from(new Set([...selectedElements, ...groupedSelection]))
      : groupedSelection
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
    const groupedSelection = element.groupId ? getGroupMemberIds(element.groupId) : [element.id]
    const selections = selectedElements.includes(element.id)
      ? Array.from(new Set([...selectedElements, ...groupedSelection]))
      : groupedSelection
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

    const dragW = Math.abs(marqueeEnd.x - marqueeStart.x)
    const dragH = Math.abs(marqueeEnd.y - marqueeStart.y)
    const isDragBox = dragW > 2 || dragH > 2

    interactionHandledRef.current = isDragBox

    if (!isDragBox) {
      setIsMarqueeSelecting(false)
      setMarqueeStart(null)
      setMarqueeEnd(null)
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

    const expandedSelection = Array.from(new Set(selected.flatMap(id => {
      const found = canvasElements.find(el => el.id === id)
      if (found?.groupId) {
        return getGroupMemberIds(found.groupId)
      }
      return [id]
    })))

    setSelectedElements(expandedSelection)
    if (expandedSelection.length === 1) {
      const el = canvasElements.find(e => e.id === expandedSelection[0])
      if (el) setSelectedElement(el)
    } else if (expandedSelection.length > 1) {
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
    interactionHandledRef.current = false

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

  const getActionSelectionIds = useCallback(() => {
    if (selectedElements.length > 0) return selectedElements
    if (selectedElement) {
      if (selectedElement.groupId) return getGroupMemberIds(selectedElement.groupId)
      return [selectedElement.id]
    }
    return [] as string[]
  }, [selectedElements, selectedElement, getGroupMemberIds])

  const copySelectedElements = useCallback(() => {
    if (viewMode !== 'editor') return
    const ids = getActionSelectionIds()
    if (ids.length === 0) return

    const copied = canvasElements
      .filter(el => ids.includes(el.id))
      .map(el => ({
        ...el,
        groupId: undefined,
        linkedRoomData: el.linkedRoomData ? { ...el.linkedRoomData } : undefined,
      }))

    clipboardElementsRef.current = copied
    pasteOffsetRef.current = 0
    showNotification('success', `${copied.length} element(s) copied`)
  }, [viewMode, getActionSelectionIds, canvasElements])

  const pasteClipboardElements = useCallback(() => {
    if (viewMode !== 'editor') return
    const clipboard = clipboardElementsRef.current
    if (!clipboard || clipboard.length === 0) {
      showNotification('info', 'Clipboard is empty')
      return
    }

    pasteOffsetRef.current += 20
    const offset = pasteOffsetRef.current

    const maxZ = Math.max(...canvasElements.map(el => el.zIndex || 0), 0)
    const newIds: string[] = []
    const pasted = clipboard.map((el, idx) => {
      const newId = generateId()
      newIds.push(newId)
      return {
        ...el,
        id: newId,
        groupId: undefined,
        x: el.x + offset,
        y: el.y + offset,
        zIndex: maxZ + idx + 1,
      }
    })

    setCanvasElements(prev => [...prev, ...pasted])
    setSelectedElements(newIds)
    setSelectedElement(pasted.length === 1 ? pasted[0] : null)
    showNotification('success', `${pasted.length} element(s) pasted`)
  }, [viewMode, canvasElements])

  const duplicateSelectedElements = useCallback(() => {
    if (viewMode !== 'editor') return
    const ids = getActionSelectionIds()
    if (ids.length === 0) return

    const source = canvasElements.filter(el => ids.includes(el.id))
    if (source.length === 0) return

    const maxZ = Math.max(...canvasElements.map(el => el.zIndex || 0), 0)
    const offset = 20
    const newIds: string[] = []
    const duplicated = source.map((el, idx) => {
      const newId = generateId()
      newIds.push(newId)
      return {
        ...el,
        id: newId,
        groupId: undefined,
        x: el.x + offset,
        y: el.y + offset,
        zIndex: maxZ + idx + 1,
      }
    })

    setCanvasElements(prev => [...prev, ...duplicated])
    setSelectedElements(newIds)
    setSelectedElement(duplicated.length === 1 ? duplicated[0] : null)
    showNotification('success', `${duplicated.length} element(s) duplicated`)
  }, [viewMode, getActionSelectionIds, canvasElements])

  const closeCanvasContextMenu = useCallback(() => {
    setCanvasContextMenu(prev => ({ ...prev, visible: false, targetElementId: null }))
  }, [])

  const openCanvasContextMenu = useCallback((clientX: number, clientY: number, targetElementId: string | null) => {
    const menuWidth = 200
    const menuHeight = 240
    const x = Math.min(clientX, window.innerWidth - menuWidth - 8)
    const y = Math.min(clientY, window.innerHeight - menuHeight - 8)

    setCanvasContextMenu({
      visible: true,
      x: Math.max(8, x),
      y: Math.max(8, y),
      targetElementId,
    })
  }, [])

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

  // Keyboard shortcuts for undo/redo + clipboard actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        !!target?.closest('[contenteditable="true"]')

      if (isTypingTarget) return

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault()
        fitCanvasToViewport()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (viewMode === 'editor') {
          e.preventDefault()
          copySelectedElements()
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (viewMode === 'editor') {
          e.preventDefault()
          pasteClipboardElements()
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        if (viewMode === 'editor') {
          e.preventDefault()
          duplicateSelectedElements()
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if ((selectedElements.length > 0 || selectedElement) && viewMode === 'editor') {
          e.preventDefault()
          deleteSelectedElements()
        }
      } else if (e.key === 'f' || e.key === 'F') {
        if (viewMode === 'editor') {
          e.preventDefault()
          toggleFocusMode()
        }
      } else if (e.key === '/' && viewMode === 'editor') {
        e.preventDefault()
        setLeftPanelOpen(true)
        setSectionsOpen(prev => ({ ...prev, roomsZones: true }))
        setTimeout(() => roomSearchInputRef.current?.focus(), 0)
      } else if (e.key === '?') {
        e.preventDefault()
        setShowShortcutsModal(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, fitCanvasToViewport, selectedElement, selectedElements, viewMode, copySelectedElements, pasteClipboardElements, duplicateSelectedElements, toggleFocusMode])

  const groupSelectedElements = () => {
    if (selectedElements.length < 2) {
      showNotification('info', 'Select at least 2 elements to group')
      return
    }

    const newGroupId = `group_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    setCanvasElements(prev => prev.map(el =>
      selectedElements.includes(el.id) ? { ...el, groupId: newGroupId } : el
    ))
    showNotification('success', `${selectedElements.length} element(s) grouped`)
  }

  const ungroupSelectedElements = () => {
    if (selectedElements.length === 0) return

    const selectedGroupIds = new Set(
      canvasElements
        .filter(el => selectedElements.includes(el.id) && el.groupId)
        .map(el => el.groupId as string)
    )

    if (selectedGroupIds.size === 0) {
      showNotification('info', 'No grouped elements selected')
      return
    }

    const ungroupedIds = canvasElements
      .filter(el => el.groupId && selectedGroupIds.has(el.groupId))
      .map(el => el.id)

    setCanvasElements(prev => prev.map(el =>
      el.groupId && selectedGroupIds.has(el.groupId) ? { ...el, groupId: undefined } : el
    ))
    setSelectedElements(ungroupedIds)
    showNotification('success', 'Group removed')
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
  const savingRef = useRef(false)
  const saveFloorPlan = async (options?: {
    silent?: boolean
    refreshList?: boolean
    closeModal?: boolean
  }) => {
    // Prevent concurrent saves using ref (state check may be stale in closures)
    if (savingRef.current) return
    const silent = options?.silent === true
    const shouldRefreshList = options?.refreshList !== false
    const shouldCloseModal = options?.closeModal !== false

    // Easier naming: Default to just "Floor X" if no name is provided
    const defaultName = `Floor ${selectedFloor}`
    const finalName = floorPlanName.trim() || defaultName

    // If the name is already the default or just a floor description, 
    // we don't need to force the building dash into the UI state
    if (!floorPlanName.trim()) {
      setFloorPlanName(finalName)
    }

    const saveStartedAtVersion = changeVersionRef.current

    try {
      savingRef.current = true
      setSaving(true)

      const syncedElements = selectedElement
        ? canvasElements.map(el =>
          el.id === selectedElement.id
            ? {
              ...el,
              label: editForm.label,
              width: editForm.width,
              height: editForm.height,
              x: editForm.x,
              y: editForm.y,
              color: editForm.color,
              textColor: editForm.textColor,
              iconColor: editForm.iconColor,
              rotation: editForm.rotation,
              iconType: editForm.iconType,
              fontSize: editForm.fontSize,
              opacity: editForm.opacity,
              textBackgroundOpacity: editForm.textBackgroundOpacity,
              borderWidth: editForm.borderWidth
            }
            : el
        )
        : canvasElements

      const canvasData = {
        elements: syncedElements,
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
        if (!silent) {
          showNotification('success', `Floor plan ${isPublished ? 'published' : 'saved as draft'}!`)
        }
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
        if (!silent) {
          showNotification('success', `Floor plan ${isPublished ? 'published' : 'saved as draft'}!`)
        }
      }

      if (changeVersionRef.current === saveStartedAtVersion) {
        setHasUnsavedChanges(false)
      } else {
        setHasUnsavedChanges(true)
      }
      setLastSavedAt(new Date())
      if (shouldCloseModal) {
        setShowSaveModal(false)
      }
      if (shouldRefreshList) {
        await fetchSavedFloorPlans(true) // Refresh the list
      }
    } catch (error: any) {
      console.error('Save failure details:', error)
      const details = error?.details || error?.hint || ''
      const msg = error?.message || (typeof error === 'string' ? error : '')
      const errMsg = msg + (details ? ` (${details})` : '') || 'Unknown error - bridge to Supabase might be disconnected.'
      if (!silent) {
        showNotification('error', `Save failed: ${errMsg}`)
      }
    } finally {
      savingRef.current = false
      setSaving(false)
    } to the latest saveFloorPlan so timers/events never capture a stale closure
  const saveFloorPlanRef = useRef(saveFloorPlan)
  useEffect(() => {
    saveFloorPlanRef.current = saveFloorPlan
  })

  useEffect(() => {
    if (!mounted) return
    if (viewMode !== 'editor') return
    if (!autoSaveEnabled) return
    if (!hasUnsavedChanges) return
    if (saving) return

    const autoSaveTimer = window.setTimeout(() => {
      void saveFloorPlanRef.current({
        silent: true,
        refreshList: false,
        closeModal: false,
      })
    }, 1500)

    return () => window.clearTimeout(autoSaveTimer)
  }, [
    mounted,
    viewMode,
    autoSaveEnabled,
    hasUnsavedChanges,
    saving,
    canvasElements,
    floorPlanName,
    selectedBuilding,
    selectedFloor,
    gridSize,
    canvasBackground,
    canvasSize.width,
    canvasSize.height,
    isDefault,
    isPublished,
    selectedScheduleId,
    selectedElement?.id,
    editForm,
  ])

  useEffect(() => {
    if (!mounted) return

    const flushSave = () => {
      if (!autoSaveEnabled) return
      if (!hasUnsavedChanges) return
      if (saving) return
      if (viewMode !== 'editor') return

      void saveFloorPlanRef.current({
        silent: true,
        refreshList: false,
        closeModal: false,
      })
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushSave()
      }
    }

    const handlePageHide = () => {
      flushSave()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [mounted, autoSaveEnabled, hasUnsavedChanges, saving, viewMode])

  const saveStateText = useMemo(() => {
    if (viewMode !== 'editor') return ''
    if (saving) return 'Saving...'
    if (hasUnsavedChanges && !autoSaveEnabled) return 'Autosave off • Unsaved'
    if (hasUnsavedChanges) return 'Unsaved changes'
    if (!currentFloorPlan?.id) return 'New draft'
    if (lastSavedAt) {
      return `Saved ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    }
    return 'Saved'
  }, [viewMode, saving, hasUnsavedChanges, autoSaveEnabled, currentFloorPlan?.id, lastSavedAt])

  const saveStateToneClass = useMemo(() => {
    if (saving) return styles.saveStateSaving
    if (hasUnsavedChanges) return styles.saveStateUnsaved
    return styles.saveStateSaved
  }, [saving, hasUnsavedChanges])



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
    setLastSavedAt(null)
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
    exportSnapshotRef.current = null
    exportSnapshotPromiseRef.current = null
    setExportSettings(prev => ({
      ...prev,
      title: floorPlanName || `${selectedBuilding} - Floor ${selectedFloor}`,
      subtitle: schedules.find(s => s.id === selectedScheduleId)?.schedule_name || '',
      buildingLabel: selectedBuilding || '',
      floorName: currentFloorPlan?.floor_name || `Floor ${selectedFloor}`,
      floorNumber: String(currentFloorPlan?.floor_number || selectedFloor),
    }))
    setShowExportPreview(true)
    // Render preview after modal opens
    setTimeout(() => void renderExportPreview(), 100)
  }

  const getElementAabb = (el: CanvasElement) => {
    const rotation = ((el.rotation || 0) % 360 + 360) % 360
    const x1 = el.x
    const y1 = el.y
    const x2 = el.x + el.width
    const y2 = el.y + el.height

    if (!rotation) {
      return { minX: x1, minY: y1, maxX: x2, maxY: y2 }
    }

    const cx = el.x + el.width / 2
    const cy = el.y + el.height / 2
    const rad = rotation * Math.PI / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)

    const corners = [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 }
    ].map((corner) => {
      const dx = corner.x - cx
      const dy = corner.y - cy
      return {
        x: cx + (dx * cos - dy * sin),
        y: cy + (dx * sin + dy * cos)
      }
    })

    return {
      minX: Math.min(...corners.map(c => c.x)),
      minY: Math.min(...corners.map(c => c.y)),
      maxX: Math.max(...corners.map(c => c.x)),
      maxY: Math.max(...corners.map(c => c.y))
    }
  }

  const getExportBounds = (elements: CanvasElement[]) => {
    const inCanvasBounds = elements
      .map(getElementAabb)
      .map((b) => ({
        minX: Math.max(0, b.minX),
        minY: Math.max(0, b.minY),
        maxX: Math.min(canvasSize.width, b.maxX),
        maxY: Math.min(canvasSize.height, b.maxY)
      }))
      .filter((b) => b.maxX > b.minX && b.maxY > b.minY)

    if (!inCanvasBounds.length) {
      return { minX: 0, minY: 0, maxX: canvasSize.width, maxY: canvasSize.height }
    }

    return inCanvasBounds.reduce((acc, b) => ({
      minX: Math.min(acc.minX, b.minX),
      minY: Math.min(acc.minY, b.minY),
      maxX: Math.max(acc.maxX, b.maxX),
      maxY: Math.max(acc.maxY, b.maxY),
    }), { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY })
  }

  // Get legend items based on rooms on canvas (memoised)
  const legendItems = useMemo(() => Array.from(new Set(
    canvasElements
      .filter(el => el.type === 'room' && el.linkedRoomData)
      .map(el => normalizeRoomType(el.linkedRoomData?.room_type))
  ))
    .map(type => ({
      type,
      ...getRoomColor(type)
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
  , [canvasElements])

  // Render export document (used by preview + PDF generation)
  const renderExportPreview = useCallback(async (options?: {
    canvas?: HTMLCanvasElement
    width?: number
    height?: number
    includeFrame?: boolean
    forceSnapshot?: boolean
  }) => {
    const canvas = options?.canvas || exportCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const previewW = options?.width || 800
    const previewH = options?.height || 600
    const includeFrame = options?.includeFrame !== false

    const dpr = options?.canvas ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.floor(previewW * dpr)
    canvas.height = Math.floor(previewH * dpr)
    if (!options?.canvas) {
      canvas.style.width = `${previewW}px`
      canvas.style.height = `${previewH}px`
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

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

    // Scale factor to fit page in preview / export canvas
    const sf = Math.min(previewW / pageW, previewH / pageH) * (includeFrame ? 0.92 : 1)
    const offsetX = (previewW - pageW * sf) / 2
    const offsetY = (previewH - pageH * sf) / 2

    // Clear
    ctx.fillStyle = includeFrame ? '#e2e8f0' : '#ffffff'
    ctx.fillRect(0, 0, previewW, previewH)

    // Draw page shadow (preview only)
    if (includeFrame) {
      ctx.shadowColor = 'rgba(0,0,0,0.15)'
      ctx.shadowBlur = 12
      ctx.shadowOffsetX = 4
      ctx.shadowOffsetY = 4
    }
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(offsetX, offsetY, pageW * sf, pageH * sf)
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0

    // Page border (preview only)
    if (includeFrame) {
      ctx.strokeStyle = '#cbd5e1'
      ctx.lineWidth = 1
      ctx.strokeRect(offsetX, offsetY, pageW * sf, pageH * sf)
    }

    const m = includeFrame ? pageW * 0.05 * sf : 0 // full-bleed when exporting
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
    const labelsOffsetXPx = (exportSettings.labelsOffsetX / 100) * contentW
    const labelsOffsetYPx = (exportSettings.labelsOffsetY / 100) * contentH
    const labelsCenterX = offsetX + pageW * sf / 2 + labelsOffsetXPx

    // Title — primary text
    const titleFontPx = Math.max(6 * sf, (exportSettings.titleFontSize / 22) * 7.5 * sf)
    let infoY = titleY + titleFontPx + 2 * sf

    if (exportSettings.showScheduleInfo && exportSettings.subtitle) infoY += 5 * sf
    const metaParts: string[] = []
    if (exportSettings.buildingLabel) metaParts.push(`Building: ${exportSettings.buildingLabel}`)
    if (exportSettings.floorName) metaParts.push(`Floor: ${exportSettings.floorName}`)
    if (exportSettings.floorNumber) metaParts.push(`# ${exportSettings.floorNumber}`)
    if (exportSettings.showDate) metaParts.push(`Generated: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`)
    if (metaParts.length) infoY += 5 * sf

    const drawDocumentLabels = () => {
      const baseTitleY = titleY + labelsOffsetYPx

      ctx.fillStyle = '#0f172a'
      ctx.font = `bold ${titleFontPx}px Arial`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(exportSettings.title || 'Floor Plan', labelsCenterX, baseTitleY, maxTextW)

      let labelsY = baseTitleY + titleFontPx + 2 * sf

      if (exportSettings.showScheduleInfo && exportSettings.subtitle) {
        ctx.fillStyle = '#475569'
        ctx.font = `${4 * sf}px Arial`
        ctx.textAlign = 'center'
        ctx.fillText(exportSettings.subtitle, labelsCenterX, labelsY, maxTextW)
        labelsY += 5 * sf
      }

      if (metaParts.length) {
        ctx.fillStyle = '#94a3b8'
        ctx.font = `${3 * sf}px Arial`
        ctx.textAlign = 'center'
        ctx.fillText(metaParts.join('  •  '), labelsCenterX, labelsY, maxTextW)
      }
    }

    drawDocumentLabels()

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
    if (includeFrame) {
      ctx.strokeStyle = '#e2e8f0'
      ctx.lineWidth = 1
      ctx.strokeRect(px, planY, planW, planH)
    }

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

    const sourceCanvasEl = canvasRef.current
    const sourceW = Math.max(1, canvasSize.width)
    const sourceH = Math.max(1, canvasSize.height)
    const scaleEX = planW / sourceW
    const scaleEY = planH / sourceH
    const fitScale = Math.min(scaleEX, scaleEY) * 0.95
    const scaleE = fitScale * (exportSettings.mapScale / 100)
    const centeredCanvasX = px + (planW - sourceW * scaleE) / 2
    const centeredCanvasY = planY + (planH - sourceH * scaleE) / 2
    const maxOffsetXPx = Math.max(0, (planW - sourceW * scaleE) / 2)
    const maxOffsetYPx = Math.max(0, (planH - sourceH * scaleE) / 2)
    const requestedOffsetXPx = (exportSettings.mapOffsetX / 100) * planW
    const requestedOffsetYPx = (exportSettings.mapOffsetY / 100) * planH
    const clampedOffsetXPx = Math.max(-maxOffsetXPx, Math.min(maxOffsetXPx, requestedOffsetXPx))
    const clampedOffsetYPx = Math.max(-maxOffsetYPx, Math.min(maxOffsetYPx, requestedOffsetYPx))
    const canvasX = centeredCanvasX + clampedOffsetXPx
    const canvasY = centeredCanvasY + clampedOffsetYPx
    const canvasW = sourceW * scaleE
    const canvasH = sourceH * scaleE

    exportRenderMetricsRef.current = {
      canvasX,
      canvasY,
      canvasW,
      canvasH,
      planW,
      planH,
      maxOffsetXPx,
      maxOffsetYPx,
    }

    // Draw explicit canvas area to mirror editor canvas bounds in export.
    const exportCanvasIsTransparent = isTransparentColor(canvasBackground)
    if (exportSettings.useWhiteBackground) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(canvasX, canvasY, canvasW, canvasH)
    } else if (!exportCanvasIsTransparent) {
      ctx.fillStyle = canvasBackground || '#ffffff'
      ctx.fillRect(canvasX, canvasY, canvasW, canvasH)
    }
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 1
    ctx.strokeRect(canvasX, canvasY, canvasW, canvasH)

    if (sourceCanvasEl) {
      const needsFreshSnapshot = options?.forceSnapshot || !exportSnapshotRef.current

      if (needsFreshSnapshot) {
        if (!exportSnapshotPromiseRef.current) {
          exportSnapshotPromiseRef.current = (async () => {
            try {
              const html2canvas = (await import('html2canvas')).default
              const snapshotScale = options?.canvas ? 4 : 2
              const snapshot = await html2canvas(sourceCanvasEl, {
                backgroundColor: exportSettings.useWhiteBackground
                  ? '#ffffff'
                  : (isTransparentColor(canvasBackground) ? null : (canvasBackground || '#ffffff')),
                width: sourceW,
                height: sourceH,
                scale: snapshotScale,
                useCORS: true,
                logging: false,
                scrollX: 0,
                scrollY: 0,
                onclone: (doc) => {
                  const clonedCanvas = doc.querySelector('[data-export-canvas="true"]') as HTMLElement | null
                  if (!clonedCanvas) return

                  clonedCanvas.style.transform = 'none'
                  clonedCanvas.style.transformOrigin = 'top left'
                  clonedCanvas.style.top = '0px'
                  clonedCanvas.style.left = '0px'
                  clonedCanvas.style.boxShadow = 'none'

                  doc.querySelectorAll(`.${styles.resizeHandle}, .${styles.orientationBtn}`).forEach((el) => {
                    ; (el as HTMLElement).style.display = 'none'
                  })

                  doc.querySelectorAll(`.${styles.selected}, .${styles.dragging}, .${styles.resizing}`).forEach((el) => {
                    ; (el as HTMLElement).style.boxShadow = 'none'
                  })
                }
              })

              exportSnapshotRef.current = snapshot
              return snapshot
            } catch (error) {
              console.error('Export canvas snapshot failed:', error)
              return null
            } finally {
              exportSnapshotPromiseRef.current = null
            }
          })()
        }

        await exportSnapshotPromiseRef.current
      }

      if (exportSnapshotRef.current) {
        ctx.drawImage(exportSnapshotRef.current, canvasX, canvasY, canvasW, canvasH)
      }
    }

    // Reinforce labels in export preview/PDF so text and hallway callouts remain readable.
    const visibleExportElements = [...canvasElements]
      .filter((el) => isLayerVisible(el.id))
      .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))

    visibleExportElements.forEach((element) => {
      const label = element.label?.trim()
      if (!label) return
      if (element.type !== 'text') return

      const elementX = canvasX + element.x * scaleE
      const elementY = canvasY + element.y * scaleE
      const elementW = Math.max(1, element.width * scaleE)
      const elementH = Math.max(1, element.height * scaleE)
      const rotation = (element.rotation || 0) * Math.PI / 180
      const textColor = resolveElementTextColor(element)

      ctx.save()
      ctx.translate(elementX + elementW / 2, elementY + elementH / 2)
      if (rotation) {
        ctx.rotate(rotation)
      }

      if (element.type === 'text') {
        const textBgOpacity = element.textBackgroundOpacity ?? (!isTransparentColor(element.color) ? 35 : 0)
        const hasTextBg = textBgOpacity > 0 && !isTransparentColor(element.color)
        const boxPadding = Math.max(2, 4 * scaleE)
        const boxW = elementW
        const boxH = Math.max(elementH, 16 * scaleE)

        if (hasTextBg) {
          ctx.fillStyle = applyAlphaToColor(element.color || '#ffffff', textBgOpacity / 100)
          ctx.strokeStyle = element.borderColor && !isTransparentColor(element.borderColor)
            ? element.borderColor
            : '#94a3b8'
          ctx.lineWidth = Math.max(0.75, 1 * scaleE)
          ctx.beginPath()
          if (ctx.roundRect) {
            ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, Math.max(2, 3 * scaleE))
          } else {
            ctx.rect(-boxW / 2, -boxH / 2, boxW, boxH)
          }
          ctx.fill()
          ctx.stroke()
        }

        ctx.fillStyle = textColor
        ctx.font = `${Math.max(8, (element.fontSize || 14) * scaleE)}px Arial`
        ctx.textAlign = element.textAlign || 'center'
        ctx.textBaseline = 'middle'
        const textX = element.textAlign === 'left' ? (-boxW / 2 + boxPadding) : element.textAlign === 'right' ? (boxW / 2 - boxPadding) : 0
        ctx.fillText(label, textX, 0, boxW - boxPadding * 2)
      }

      ctx.restore()
    })

    // Keep document labels above map layer as a movable top overlay.
    drawDocumentLabels()

    // Reset text alignment
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'

    // ===== LEGEND (MORE COMPACT) =====
    if (exportSettings.showLegend) {
      const legendY2 = py + contentH - 8 * sf
      ctx.fillStyle = '#1e293b'
      ctx.font = `bold ${3.5 * sf}px Arial`
      ctx.fillText('Legend:', px, legendY2)

      const legendItemsToRender = legendItems
      let lx = px + 18 * sf
      legendItemsToRender.forEach(item => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasSize, exportSettings, floorPlanName, selectedBuilding, selectedFloor, schedules, selectedScheduleId, canvasBackground, currentFloorPlan, legendItems])

  // Re-render preview when settings change
  useEffect(() => {
    if (!showExportPreview) return
    const frame = requestAnimationFrame(() => {
      void renderExportPreview()
    })
    return () => cancelAnimationFrame(frame)
  }, [showExportPreview, exportSettings, renderExportPreview])

  useEffect(() => {
    if (!showExportPreview) return
    exportSnapshotRef.current = null
    exportSnapshotPromiseRef.current = null
    const frame = requestAnimationFrame(() => {
      void renderExportPreview({ forceSnapshot: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [showExportPreview, canvasElements, layerVisibility, canvasSize, canvasBackground, showGrid, showScheduleOverlay, selectedElement?.id, editForm.label, editForm.fontSize, editForm.textColor, editForm.color, renderExportPreview])

  useEffect(() => {
    if (!canvasContextMenu.visible) return

    const handleClickOutside = () => closeCanvasContextMenu()
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCanvasContextMenu()
    }

    window.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleEscape)
    window.addEventListener('scroll', handleClickOutside, true)

    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleEscape)
      window.removeEventListener('scroll', handleClickOutside, true)
    }
  }, [canvasContextMenu.visible, closeCanvasContextMenu])

  const handleExportPreviewMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const metrics = exportRenderMetricsRef.current
    const canvas = exportCanvasRef.current
    if (!metrics || !canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const insideMap =
      x >= metrics.canvasX &&
      x <= metrics.canvasX + metrics.canvasW &&
      y >= metrics.canvasY &&
      y <= metrics.canvasY + metrics.canvasH

    if (!insideMap) return

    exportDragRef.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetXPx: (exportSettings.mapOffsetX / 100) * metrics.planW,
      startOffsetYPx: (exportSettings.mapOffsetY / 100) * metrics.planH,
    }
    setIsDraggingExportMap(true)
  }

  useEffect(() => {
    if (!isDraggingExportMap) return

    const handleMove = (event: MouseEvent) => {
      const metrics = exportRenderMetricsRef.current
      const dragStart = exportDragRef.current
      if (!metrics || !dragStart) return

      const dx = event.clientX - dragStart.startClientX
      const dy = event.clientY - dragStart.startClientY
      const nextOffsetXPx = Math.max(-metrics.maxOffsetXPx, Math.min(metrics.maxOffsetXPx, dragStart.startOffsetXPx + dx))
      const nextOffsetYPx = Math.max(-metrics.maxOffsetYPx, Math.min(metrics.maxOffsetYPx, dragStart.startOffsetYPx + dy))

      setExportSettings(prev => ({
        ...prev,
        mapOffsetX: Number(((nextOffsetXPx / metrics.planW) * 100).toFixed(2)),
        mapOffsetY: Number(((nextOffsetYPx / metrics.planH) * 100).toFixed(2)),
      }))
    }

    const handleUp = () => {
      exportDragRef.current = null
      setIsDraggingExportMap(false)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [isDraggingExportMap])

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

      const pageWidthMm = isLandscape ? Math.max(widthMm, heightMm) : Math.min(widthMm, heightMm)
      const pageHeightMm = isLandscape ? Math.min(widthMm, heightMm) : Math.max(widthMm, heightMm)

      const pageWidthPx = isLandscape ? Math.max(paper.width, paper.height) : Math.min(paper.width, paper.height)
      const pageHeightPx = isLandscape ? Math.min(paper.width, paper.height) : Math.max(paper.width, paper.height)
      const exportScale = 3
      const offscreenCanvas = document.createElement('canvas')

      await renderExportPreview({
        canvas: offscreenCanvas,
        width: Math.max(1200, Math.round(pageWidthPx * exportScale)),
        height: Math.max(1200, Math.round(pageHeightPx * exportScale)),
        includeFrame: false,
        forceSnapshot: true,
      })

      const imageData = offscreenCanvas.toDataURL('image/png')

      const pdf = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [pageWidthMm, pageHeightMm],
        compress: true,
        putOnlyUsedFonts: true,
        precision: 12
      })

      const bleedMm = 0.15
      pdf.addImage(imageData, 'PNG', -bleedMm, -bleedMm, pageWidthMm + bleedMm * 2, pageHeightMm + bleedMm * 2, undefined, 'MEDIUM')
      const fileName = `FloorPlan_${selectedBuilding.replace(/\s+/g, '_')}_F${selectedFloor}_${new Date().toISOString().split('T')[0]}.pdf`
      pdf.save(fileName)
      setShowExportPreview(false)
      showNotification('success', 'PDF exported successfully (high quality)!')
    } catch (error) {
      console.error('Error exporting PDF:', error)
      showNotification('error', 'Failed to export PDF')
    }
  }

  // Helper: hex to rgb — handles #RGB, #RRGGBB, rgb(), named colors, and fallbacks
  const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
    if (!hex || typeof hex !== 'string') return { r: 0, g: 0, b: 0 }

    // Handle rgb()/rgba() strings
    const rgbMatch = hex.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
    if (rgbMatch) {
      return { r: parseInt(rgbMatch[1]), g: parseInt(rgbMatch[2]), b: parseInt(rgbMatch[3]) }
    }

    // Strip # prefix
    let h = hex.startsWith('#') ? hex.slice(1) : hex

    // Expand shorthand #RGB → RRGGBB
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
    }

    if (h.length === 6 && /^[0-9a-fA-F]{6}$/.test(h)) {
      return {
        r: parseInt(h.substring(0, 2), 16),
        g: parseInt(h.substring(2, 4), 16),
        b: parseInt(h.substring(4, 6), 16)
      }
    }

    // Fallback for named colors or unknown formats
    return { r: 0, g: 0, b: 0 }
  }

  const getContrastColor = (hex: string) => {
    const { r, g, b } = hexToRgb(hex)
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000
    return (yiq >= 128) ? '#1e293b' : '#ffffff'
  }

  const isTransparentColor = (value?: string) => {
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

  const resolveElementTextColor = (element: CanvasElement, fallbackBackground: string = '#e5e7eb') => {
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

  const resolveLayerSwatchColor = (element: CanvasElement) => {
    if (element.type === 'text') {
      return resolveElementTextColor(element, '#ffffff')
    }

    if (element.color && !isTransparentColor(element.color)) {
      return element.color
    }

    if (element.borderColor && !isTransparentColor(element.borderColor)) {
      return element.borderColor
    }

    return resolveElementTextColor(element)
  }

  const applyAlphaToColor = (hex: string, alpha: number): string => {
    const { r, g, b } = hexToRgb(hex)
    const a = Math.max(0, Math.min(1, alpha))
    return `rgba(${r}, ${g}, ${b}, ${a})`
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

  const placedRoomIds = useMemo(() => {
    return new Set(
      canvasElements
        .filter(el => typeof el.linkedRoomId === 'number')
        .map(el => el.linkedRoomId as number)
    )
  }, [canvasElements])

  const roomStats = useMemo(() => {
    const total = allRooms.length
    const placed = allRooms.reduce((count, room) => count + (placedRoomIds.has(room.id) ? 1 : 0), 0)
    const unplaced = Math.max(0, total - placed)
    return { total, placed, unplaced }
  }, [allRooms, placedRoomIds])

  // Filter rooms in toolbox (memoised so we don't re-filter on every render)
  const filteredRooms = useMemo(() => allRooms.filter(room => {
    const matchesSearch =
      !searchQuery ||
      room.room?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.room_code?.toLowerCase().includes(searchQuery.toLowerCase())

    if (!matchesSearch) return false

    const onCanvas = placedRoomIds.has(room.id)
    if (roomFilterMode === 'placed') return onCanvas
    if (roomFilterMode === 'unplaced') return !onCanvas
    return true
  }), [allRooms, searchQuery, roomFilterMode, placedRoomIds])

  const exportLayerItems = useMemo(() => (
    [...canvasElements]
      .sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0))
  ), [canvasElements])

  // Check if room is on canvas
  const isRoomOnCanvas = (roomId: number) => {
    return canvasElements.some(el => el.linkedRoomId === roomId)
  }

  // Get icon component
  const getIconComponent = (iconName: string, size: number = 24, color?: string) => {
    const iconMap: Record<string, any> = {
      exit: DoorOpen,
      stairs: Footprints,
      elevator: ArrowUpDown,
      restroom: Bath,
      men_room: MdMan,
      women_room: MdWoman,
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
    return <IconComp size={size} color={color} />
  }

  // Get shape component
  const getShapeComponent = (shapeName: string, size: number = 24, color?: string) => {
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
    return <ShapeComp size={size} color={color} />
  }

  if (!mounted) {
    return <LoadingFallback message="Loading map viewer..." theme={globalTheme || 'green'} variant="modal" />
  }

  if (!authChecked) {
    return <LoadingFallback message="Loading map viewer..." theme={globalTheme || 'green'} variant="modal" />
  }

  if (!isAuthorized) {
    return <LoadingFallback message="Redirecting..." theme={globalTheme || 'green'} variant="modal" />
  }

  return (
    <div className={styles.layout} data-theme={globalTheme || 'green'}>
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
        <div className={styles.header} id="map-header">
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

            {/* Mode Toggle */}
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
            {!isMobile && (
              <>
                {viewMode === 'editor' && (
                  <button
                    className={`${styles.loadBtn} ${isFocusMode ? styles.focusModeBtnActive : ''}`}
                    onClick={toggleFocusMode}
                    title={isFocusMode ? 'Exit Focus Mode (F)' : 'Enter Focus Mode (F)'}
                  >
                    <Monitor size={18} />
                  </button>
                )}
                <button
                  className={styles.loadBtn}
                  onClick={() => setShowShortcutsModal(true)}
                  title="Keyboard shortcuts (?)"
                >
                  <Info size={18} />
                </button>
                <button
                  className={styles.loadBtn}
                  onClick={() => setLeftPanelOpen(!leftPanelOpen)}
                  title={leftPanelOpen ? 'Hide Toolbox Sidebar' : 'Show Toolbox Sidebar'}
                >
                  {leftPanelOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
                </button>
                <button
                  className={styles.loadBtn}
                  onClick={() => setRightPanelOpen(!rightPanelOpen)}
                  title={rightPanelOpen ? 'Hide Properties/Layers Sidebar' : 'Show Properties/Layers Sidebar'}
                >
                  {rightPanelOpen
                    ? <PanelLeftClose size={18} style={{ transform: 'scaleX(-1)' }} />
                    : <PanelLeftOpen size={18} style={{ transform: 'scaleX(-1)' }} />}
                </button>
              </>
            )}

            {viewMode === 'editor' && (
              <div className={styles.saveStateWrap}>
                <span className={`${styles.saveStateBadge} ${saveStateToneClass}`} title={saveStateText}>
                  {saveStateText}
                </span>
                <label className={styles.autoSaveToggle} title="Enable or disable autosave">
                  <input
                    type="checkbox"
                    checked={autoSaveEnabled}
                    onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                  />
                  <Save
                    size={14}
                    className={`${styles.autoSaveIcon} ${autoSaveEnabled ? styles.autoSaveIconOn : styles.autoSaveIconOff}`}
                  />
                </label>
              </div>
            )}

            {viewMode === 'live' && (
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
            <div className={styles.adminActionsWrap} ref={adminActionsRef}>
              <button
                className={`${styles.saveBtn} ${styles.adminActionsBtn}`}
                ref={adminActionsButtonRef}
                onClick={() => setShowAdminActionsMenu(prev => !prev)}
                aria-expanded={showAdminActionsMenu}
                aria-haspopup="menu"
                title="Admin Actions"
              >
                <Share2 size={18} />
              </button>

              {showAdminActionsMenu && (
                <div className={styles.adminActionsMenu} role="menu" style={{ top: adminMenuPosition.top, left: adminMenuPosition.left }}>
                  <button
                    id="map-save-btn"
                    className={styles.adminActionItem}
                    onClick={() => {
                      setShowAdminActionsMenu(false)
                      setShowSaveModal(true)
                    }}
                    disabled={viewMode !== 'editor' || saving}
                    role="menuitem"
                  >
                    {saving ? <RotateCcw size={16} className={styles.spinning} /> : <Save size={16} />}
                    <span>Save</span>
                  </button>

                  <button
                    className={styles.adminActionItem}
                    onClick={() => {
                      setShowAdminActionsMenu(false)
                      openExportPreview()
                    }}
                    role="menuitem"
                  >
                    <Download size={16} />
                    <span>Export PDF</span>
                  </button>

                  <button
                    id="map-share-btn"
                    className={styles.adminActionItem}
                    onClick={() => {
                      setShowAdminActionsMenu(false)
                      generateShareLink()
                    }}
                    role="menuitem"
                  >
                    <Share2 size={16} />
                    <span>Share</span>
                  </button>
                </div>
              )}
            </div>
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
                    <div className={styles.panelHeader} id="map-toolbox-header">
                      <h3>TOOLBOX</h3>
                    </div>
                    <div className={styles.toolboxContent}>
                      <div className={styles.toolboxStatusRow}>
                        <button
                          className={`${styles.statusPill} ${roomFilterMode === 'all' ? styles.active : ''}`}
                          onClick={() => setRoomFilterMode('all')}
                          title="Show all rooms"
                        >
                          All {roomStats.total}
                        </button>
                        <button
                          className={`${styles.statusPill} ${roomFilterMode === 'placed' ? styles.active : ''}`}
                          onClick={() => setRoomFilterMode('placed')}
                          title="Show rooms already on canvas"
                        >
                          Placed {roomStats.placed}
                        </button>
                        <button
                          className={`${styles.statusPill} ${roomFilterMode === 'unplaced' ? styles.active : ''}`}
                          onClick={() => setRoomFilterMode('unplaced')}
                          title="Show rooms not yet placed"
                        >
                          Missing {roomStats.unplaced}
                        </button>
                      </div>

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
                                    ref={roomSearchInputRef}
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
                        <div className={styles.panelHeader} style={{ marginTop: isMobile ? 0 : 16, paddingTop: isMobile ? 0 : 16, borderTop: isMobile ? 'none' : '1px solid var(--border-color)' }} id="map-floorplans-header">
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
              onContextMenu={(e) => {
                if (viewMode !== 'editor') return
                e.preventDefault()
                openCanvasContextMenu(e.clientX, e.clientY, null)
              }}
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
                  data-export-canvas="true"
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
                      const availability = element.linkedRoomData ? getRoomAvailability(element.linkedRoomData.room, element.linkedRoomData.room_code, element.linkedRoomData.id) : 'unknown'
                      const currentClass = viewMode === 'live' && element.linkedRoomData ? getCurrentClass(element.linkedRoomData.room, element.linkedRoomData.room_code, element.linkedRoomData.id) : null
                      const isActiveTextSelection = element.type === 'text' && viewMode === 'editor' && selectedElement?.id === element.id
                      const textPreviewColor = isActiveTextSelection ? editForm.color : element.color
                      const textPreviewBgOpacity = isActiveTextSelection
                        ? editForm.textBackgroundOpacity
                        : (element.textBackgroundOpacity ?? (!isTransparentColor(element.color) ? 35 : 0))
                      const textHasBackground = element.type === 'text' && textPreviewBgOpacity > 0 && !isTransparentColor(textPreviewColor)
                      const resolvedTextColor = isActiveTextSelection
                        ? ((editForm.textColor && !isTransparentColor(editForm.textColor))
                          ? editForm.textColor
                          : (textHasBackground
                            ? getContrastColor(textPreviewColor || '#e5e7eb')
                            : '#1f2937'))
                        : resolveElementTextColor(element)

                      return (
                        <div
                          key={element.id}
                          className={`${styles.canvasElement} ${styles[`element_${element.type}`]} ${isSelected || isMultiSelected ? styles.selected : ''} ${isDraggingEl ? styles.dragging : ''} ${isResizing ? styles.resizing : ''} ${element.isLocked ? styles.locked : ''} ${viewMode === 'live' && showScheduleOverlay ? styles[availability] : ''} ${element.orientation === 'vertical' ? styles.vertical : ''}`}
                          style={{
                            left: element.x,
                            top: element.y,
                            width: element.width,
                            height: element.height,
                            backgroundColor: element.type === 'text'
                              ? (textHasBackground
                                ? applyAlphaToColor(textPreviewColor || '#ffffff', textPreviewBgOpacity / 100)
                                : 'transparent')
                              : element.color,
                            borderColor: element.type === 'text'
                              ? (textHasBackground ? (element.borderColor || '#94a3b8') : 'transparent')
                              : element.borderColor,
                            borderWidth: element.type === 'text'
                              ? (textHasBackground ? (element.borderWidth ?? 1) : 0)
                              : (element.borderWidth ?? 2),
                            borderRadius: element.type === 'text' ? (textHasBackground ? 6 : 0) : undefined,
                            opacity: (element.opacity ?? 100) / 100,
                            transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
                            zIndex: element.zIndex ?? 1
                          }}
                          onClick={(e) => {
                            handleElementClick(element, e)
                            if (viewMode === 'live' && element.type === 'room' && element.linkedRoomData) {
                              setLiveRoomModalRoom(element.linkedRoomData)
                            }
                          }}
                          onMouseDown={(e) => viewMode === 'editor' && !element.isLocked && handleElementDragStart(e, element)}
                          onTouchStart={(e) => viewMode === 'editor' && !element.isLocked && handleTouchStart(e, element)}
                          onContextMenu={(e) => {
                            if (viewMode !== 'editor') return
                            e.preventDefault()
                            e.stopPropagation()
                            if (selectedElement?.id !== element.id) {
                              selectElement(element, false)
                            }
                            openCanvasContextMenu(e.clientX, e.clientY, element.id)
                          }}
                        >
                          {element.type === 'room' && (
                            <>
                              <span
                                className={styles.elementLabel}
                                style={{
                                  color: resolvedTextColor,
                                  fontSize: element.fontSize || undefined
                                }}
                              >
                                {element.label}
                              </span>
                              {element.linkedRoomData && (
                                <span className={styles.elementCapacity} style={{ color: resolvedTextColor }}>
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
                            <span className={styles.textLabel} style={{
                              fontSize: (selectedElement?.id === element.id ? editForm.fontSize : element.fontSize),
                              color: resolvedTextColor
                            }}>
                              {selectedElement?.id === element.id ? editForm.label : element.label}
                            </span>
                          )}
                          {element.type === 'hallway' && (
                            <>
                              <span className={styles.hallwayLabel} style={{ color: resolvedTextColor }}>{element.label}</span>
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
                              <Footprints size={20} color={element.iconColor || resolvedTextColor} />
                              <span style={{ color: resolvedTextColor }}>{element.label}</span>
                            </>
                          )}
                          {element.type === 'door' && (
                            <DoorOpen size={16} />
                          )}
                          {element.type === 'icon' && (
                            <div className={styles.iconElement}>
                              {getIconComponent(element.iconType || 'info', 28, element.iconColor || element.textColor || element.color)}
                              {element.label && <span style={{ color: resolvedTextColor }}>{element.label}</span>}
                            </div>
                          )}
                          {element.type === 'shape' && (
                            <div className={styles.shapeElement}>
                              {getShapeComponent(element.shapeType || 'circle', Math.min(element.width, element.height) * 0.7, element.color)}
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
                <button onClick={(e) => { e.stopPropagation(); fitCanvasToViewport(); }} title="Fit to view (Ctrl+0)">
                  <LayoutGrid size={16} />
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
                    {selectedElements.length >= 2 && (
                      <button
                        className={styles.selectModeBtn}
                        onClick={groupSelectedElements}
                        title="Group selected elements"
                      >
                        Group
                      </button>
                    )}
                    {selectedElements.length > 0 && canvasElements.some(el => selectedElements.includes(el.id) && !!el.groupId) && (
                      <button
                        className={styles.selectModeBtn}
                        onClick={ungroupSelectedElements}
                        title="Ungroup selected elements"
                      >
                        Ungroup
                      </button>
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
                  <div className={styles.panelTabs} id="map-panel-tabs">
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

                              <p className={styles.propertyHelp}>
                                Size controls resize the selected object on the floor map. Text size only changes the label text.
                              </p>

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
                              <div className={styles.propertyGroupLabel}>Transform</div>
                              <div className={styles.propertyGroupLabelMinor}>Element Size</div>
                              <div className={styles.propertyRow}>
                                <div className={styles.propertyGroup}>
                                  <label>Element Width</label>
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
                                  <label>Element Height</label>
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
                              <div className={styles.propertyGroupLabelMinor}>Canvas Position</div>
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

                              {selectedElement.type === 'text' && (
                                <div className={styles.propertyGroup}>
                                  <label>Text Background Opacity</label>
                                  <div className={styles.rotationInput}>
                                    <input
                                      type="range"
                                      min="0"
                                      max="100"
                                      value={editForm.textBackgroundOpacity}
                                      onChange={(e) => setEditForm(p => ({ ...p, textBackgroundOpacity: Number(e.target.value) }))}
                                    />
                                    <span>{editForm.textBackgroundOpacity}%</span>
                                  </div>
                                  <button
                                    type="button"
                                    className={styles.loadBtn}
                                    style={{ width: '100%', marginTop: 8 }}
                                    onClick={() => setEditForm(p => ({ ...p, textBackgroundOpacity: 0 }))}
                                  >
                                    Plain Text (No Background)
                                  </button>
                                </div>
                              )}

                              {(selectedElement.type === 'room' || selectedElement.type === 'text' || selectedElement.type === 'hallway' || selectedElement.type === 'stair' || selectedElement.type === 'icon') && (
                                <div className={styles.propertyGroup}>
                                  <label>Text Color</label>
                                  <div className={styles.colorPicker}>
                                    <div
                                      className={styles.colorPreview}
                                      style={{ backgroundColor: editForm.textColor }}
                                    />
                                    <input
                                      type="color"
                                      value={editForm.textColor}
                                      onChange={(e) => setEditForm(p => ({ ...p, textColor: e.target.value }))}
                                    />
                                  </div>
                                </div>
                              )}

                              {(selectedElement.type === 'room' || selectedElement.type === 'icon' || selectedElement.type === 'stair') && (
                                <div className={styles.propertyGroup}>
                                  <label>Icon Color</label>
                                  <div className={styles.colorPicker}>
                                    <div
                                      className={styles.colorPreview}
                                      style={{ backgroundColor: editForm.iconColor }}
                                    />
                                    <input
                                      type="color"
                                      value={editForm.iconColor}
                                      onChange={(e) => setEditForm(p => ({ ...p, iconColor: e.target.value }))}
                                    />
                                  </div>
                                </div>
                              )}

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
                              <div className={styles.propertyGroupLabel}>Appearance</div>
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
                                <>
                                <div className={styles.propertyGroupLabel}>Typography</div>
                                <div className={styles.propertyGroup}>
                                  <label>Label Text Size</label>
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
                                </>
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
                                    const currentClass = getCurrentClass(selectedElement.linkedRoomData.room, selectedElement.linkedRoomData.room_code, selectedElement.linkedRoomData.id)
                                    const availability = getRoomAvailability(selectedElement.linkedRoomData.room, selectedElement.linkedRoomData.room_code, selectedElement.linkedRoomData.id)
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
                        {showScheduleOverlay && viewMode === 'live' && (
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
                          {legendItems.length > 0 ? legendItems.map(item => (
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
                              (() => {
                                const layerTextColor = resolveElementTextColor(element)
                                const layerSwatchColor = resolveLayerSwatchColor(element)
                                return (
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
                                    textColor: layerTextColor,
                                    iconColor: element.iconColor || layerTextColor,
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
                                    style={{ backgroundColor: layerSwatchColor || '#3b82f6' }}
                                  />
                                  <span className={styles.layerName} style={element.type === 'text' ? { color: layerTextColor } : undefined}>
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
                                )
                              })()
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

                  <div className={styles.exportFieldRow}>
                    <div className={styles.exportField}>
                      <label>Labels X: {exportSettings.labelsOffsetX.toFixed(0)}%</label>
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        step="1"
                        value={exportSettings.labelsOffsetX}
                        onChange={(e) => setExportSettings(p => ({ ...p, labelsOffsetX: Number(e.target.value) }))}
                        className={styles.exportSlider}
                      />
                    </div>
                    <div className={styles.exportField}>
                      <label>Labels Y: {exportSettings.labelsOffsetY.toFixed(0)}%</label>
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        step="1"
                        value={exportSettings.labelsOffsetY}
                        onChange={(e) => setExportSettings(p => ({ ...p, labelsOffsetY: Number(e.target.value) }))}
                        className={styles.exportSlider}
                      />
                    </div>
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
                        max="150"
                        step="5"
                        value={exportSettings.mapScale}
                        onChange={(e) => setExportSettings(p => ({ ...p, mapScale: Number(e.target.value) }))}
                        className={styles.exportSlider}
                      />
                    </div>
                  </div>

                  <div className={styles.exportFieldRow}>
                    <div className={styles.exportField}>
                      <label>Map X Position: {exportSettings.mapOffsetX.toFixed(0)}%</label>
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        step="1"
                        value={exportSettings.mapOffsetX}
                        onChange={(e) => setExportSettings(p => ({ ...p, mapOffsetX: Number(e.target.value) }))}
                        className={styles.exportSlider}
                      />
                    </div>
                    <div className={styles.exportField}>
                      <label>Map Y Position: {exportSettings.mapOffsetY.toFixed(0)}%</label>
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        step="1"
                        value={exportSettings.mapOffsetY}
                        onChange={(e) => setExportSettings(p => ({ ...p, mapOffsetY: Number(e.target.value) }))}
                        className={styles.exportSlider}
                      />
                    </div>
                  </div>

                  <div className={styles.exportField}>
                    <button
                      className={styles.loadBtn}
                      onClick={() => setExportSettings(p => ({ ...p, mapScale: 100, mapOffsetX: 0, mapOffsetY: 0 }))}
                      style={{ width: '100%' }}
                    >
                      Reset Map Position & Size
                    </button>
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

                  <h4 className={styles.exportSectionTitle}>
                    <Layers size={16} /> Element Layers
                  </h4>

                  <div className={styles.layerList} style={{ maxHeight: 220, overflowY: 'auto' }}>
                    {exportLayerItems.length === 0 ? (
                      <div className={styles.emptyState}><span>No visible elements</span></div>
                    ) : (
                      exportLayerItems.map((el) => (
                        <div key={el.id} className={`${styles.layerItem} ${!isLayerVisible(el.id) ? styles.hidden : ''}`}>
                          <div className={styles.layerInfo}>
                            <span className={styles.layerName}>{el.label || `${el.type} (${el.id.slice(0, 4)})`}</span>
                            <span className={styles.layerType}>{el.type} • z:{el.zIndex}{!isLayerVisible(el.id) ? ' • hidden' : ''}</span>
                          </div>
                          <div className={styles.layerControls}>
                            <button onClick={() => bringToFront(el.id)} title="Bring to front"><ChevronsUp size={14} /></button>
                            <button onClick={() => moveLayerUp(el.id)} title="Move up"><MoveUp size={14} /></button>
                            <button onClick={() => moveLayerDown(el.id)} title="Move down"><MoveDown size={14} /></button>
                            <button onClick={() => sendToBack(el.id)} title="Send to back"><ChevronsDown size={14} /></button>
                          </div>
                        </div>
                      ))
                    )}
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
                  <Eye size={14} /> Live Preview (Drag map directly to reposition)
                </div>
                <div className={styles.exportCanvasWrapper}>
                  <canvas
                    ref={exportCanvasRef}
                    className={styles.exportCanvas}
                    onMouseDown={handleExportPreviewMouseDown}
                    style={{ cursor: isDraggingExportMap ? 'grabbing' : 'grab' }}
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

      {showShortcutsModal && (
        <div className={styles.modalOverlay} onClick={() => setShowShortcutsModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2><Info size={20} /> Keyboard Shortcuts</h2>
              <button onClick={() => setShowShortcutsModal(false)}><X size={20} /></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.shortcutGrid}>
                <div className={styles.shortcutItem}><kbd>Ctrl/Cmd + Z</kbd><span>Undo</span></div>
                <div className={styles.shortcutItem}><kbd>Ctrl/Cmd + Y</kbd><span>Redo</span></div>
                <div className={styles.shortcutItem}><kbd>Ctrl/Cmd + C</kbd><span>Copy selected element(s)</span></div>
                <div className={styles.shortcutItem}><kbd>Ctrl/Cmd + V</kbd><span>Paste copied element(s)</span></div>
                <div className={styles.shortcutItem}><kbd>Ctrl/Cmd + D</kbd><span>Duplicate selected element(s)</span></div>
                <div className={styles.shortcutItem}><kbd>Delete</kbd><span>Remove selected element(s)</span></div>
                <div className={styles.shortcutItem}><kbd>/</kbd><span>Focus room search</span></div>
                <div className={styles.shortcutItem}><kbd>F</kbd><span>Toggle focus mode</span></div>
                <div className={styles.shortcutItem}><kbd>Ctrl/Cmd + 0</kbd><span>Fit canvas to viewport</span></div>
                <div className={styles.shortcutItem}><kbd>Ctrl/Cmd + Scroll</kbd><span>Smooth zoom</span></div>
                <div className={styles.shortcutItem}><kbd>Space</kbd><span>Hold to pan</span></div>
                <div className={styles.shortcutItem}><kbd>?</kbd><span>Open shortcuts</span></div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setShowShortcutsModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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

      {canvasContextMenu.visible && viewMode === 'editor' && (
        <div
          className={styles.adminActionsMenu}
          style={{
            position: 'fixed',
            top: canvasContextMenu.y,
            left: canvasContextMenu.x,
            zIndex: 5000,
            minWidth: 190,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            className={styles.adminActionItem}
            onClick={() => {
              copySelectedElements()
              closeCanvasContextMenu()
            }}
            role="menuitem"
          >
            <Copy size={16} />
            <span>Copy</span>
          </button>

          <button
            className={styles.adminActionItem}
            onClick={() => {
              pasteClipboardElements()
              closeCanvasContextMenu()
            }}
            role="menuitem"
          >
            <Plus size={16} />
            <span>Paste</span>
          </button>

          <button
            className={styles.adminActionItem}
            onClick={() => {
              duplicateSelectedElements()
              closeCanvasContextMenu()
            }}
            role="menuitem"
          >
            <Copy size={16} />
            <span>Duplicate</span>
          </button>

          {canvasContextMenu.targetElementId && (
            <>
              <button
                className={styles.adminActionItem}
                onClick={() => {
                  bringToFront(canvasContextMenu.targetElementId as string)
                  closeCanvasContextMenu()
                }}
                role="menuitem"
              >
                <ChevronsUp size={16} />
                <span>Bring To Front</span>
              </button>

              <button
                className={styles.adminActionItem}
                onClick={() => {
                  sendToBack(canvasContextMenu.targetElementId as string)
                  closeCanvasContextMenu()
                }}
                role="menuitem"
              >
                <ChevronsDown size={16} />
                <span>Send To Back</span>
              </button>

              <button
                className={styles.adminActionItem}
                onClick={() => {
                  toggleElementLock(canvasContextMenu.targetElementId as string)
                  closeCanvasContextMenu()
                }}
                role="menuitem"
              >
                <Lock size={16} />
                <span>Toggle Lock</span>
              </button>
            </>
          )}

          <button
            className={styles.adminActionItem}
            onClick={() => {
              deleteSelectedElements()
              closeCanvasContextMenu()
            }}
            role="menuitem"
          >
            <Trash2 size={16} />
            <span>Delete</span>
          </button>
        </div>
      )}

      {viewMode === 'live' && liveRoomModalRoom && (
        <AdminLiveRoomModal
          room={liveRoomModalRoom}
          availability={getRoomAvailability(liveRoomModalRoom.room, liveRoomModalRoom.room_code, liveRoomModalRoom.id)}
          currentClass={getCurrentClass(liveRoomModalRoom.room, liveRoomModalRoom.room_code, liveRoomModalRoom.id)}
          roomAllocations={roomAllocations}
          onClose={() => setLiveRoomModalRoom(null)}
        />
      )}

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

interface AdminLiveRoomModalProps {
  room: Room
  availability: 'available' | 'occupied' | 'unknown'
  currentClass: RoomAllocation | null
  roomAllocations: RoomAllocation[]
  onClose: () => void
}

function AdminLiveRoomModal({
  room,
  availability,
  currentClass,
  roomAllocations,
  onClose
}: AdminLiveRoomModalProps) {
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  const normalizeDayToken = (day: string): string => {
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

  const expandScheduleDays = (dayText?: string): string[] => {
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

    if (expanded.length > 0) return Array.from(new Set(expanded))
    return [normalizeDayToken(compact)]
  }

  const splitTimeRange = (timeStr: string): [string, string] => {
    if (!timeStr) return ['', '']
    const normalized = timeStr
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/\s+to\s+/gi, '-')
    const parts = normalized.split('-').map(part => part.trim()).filter(Boolean)
    if (parts.length < 2) return ['', '']
    return [parts[0], parts[1]]
  }

  const parseTimeToMinutes = (value: string): number => {
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

  type ModalScheduleEntry = {
    allocation: RoomAllocation
    dayIdx: number
    startMinutes: number
    endMinutes: number
  }

  const normalizeRoomKey = (value?: string) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const matchesAllocationRoom = (allocationRoom: string, allocRoomId?: number, allocBuilding?: string) => {
    // Match by room_id if available
    if (allocRoomId && allocRoomId === room.id) return true

    const allocKey = normalizeRoomKey(allocationRoom)
    if (!allocKey) return false
    const candidateKeys = [normalizeRoomKey(room.room), normalizeRoomKey(room.room_code)].filter(Boolean)
    if (candidateKeys.includes(allocKey)) return true

    // Also check if allocRoom contains building prefix (e.g. "Building1-Room101")
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

  const [activeTab, setActiveTab] = useState<'details' | 'schedule' | 'images'>('details')
  const [selectedScheduleDay, setSelectedScheduleDay] = useState<number | 'all'>('all')
  const [roomImages, setRoomImages] = useState<any[]>([])
  const [selectedImageIdx, setSelectedImageIdx] = useState(0)
  const [loadingImages, setLoadingImages] = useState(true)
  const [isImageLightboxOpen, setIsImageLightboxOpen] = useState(false)

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
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isImageLightboxOpen) {
          setIsImageLightboxOpen(false)
          return
        }
        onClose()
        return
      }

      if (!isImageLightboxOpen) return

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goPrevImage()
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        goNextImage()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [goNextImage, goPrevImage, isImageLightboxOpen, onClose])

  useEffect(() => {
    const fetchRoomImages = async () => {
      try {
        setLoadingImages(true)
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
          setIsImageLightboxOpen(false)
        }
      } catch (error) {
        console.error('Error fetching room images:', error)
      } finally {
        setLoadingImages(false)
      }
    }

    fetchRoomImages()
  }, [room.id])

  const roomSchedules = roomAllocations.filter((allocation) => matchesAllocationRoom(allocation.room, allocation.room_id, allocation.building))

  const datedSchedules = useMemo<ModalScheduleEntry[]>(() => {
    return roomSchedules
      .flatMap((allocation) => {
        const days = expandScheduleDays(allocation.schedule_day)
        const [startRaw, endRaw] = splitTimeRange(allocation.schedule_time || '')
        const startMinutes = parseTimeToMinutes(startRaw)
        const endMinutes = parseTimeToMinutes(endRaw)
        if (!startRaw || !endRaw || startMinutes < 0 || endMinutes < 0) return []

        return days
          .map((day) => DAY_NAMES.findIndex((name) => name.toLowerCase() === day.toLowerCase()))
          .filter((idx) => idx >= 0)
          .map((dayIdx) => ({ allocation, dayIdx, startMinutes, endMinutes }))
      })
      .sort((a, b) => (a.dayIdx - b.dayIdx) || (a.startMinutes - b.startMinutes))
  }, [roomSchedules])

  const dayButtonIndexes = useMemo(() => {
    const includesSunday = datedSchedules.some((entry) => entry.dayIdx === 0)
    return includesSunday ? [1, 2, 3, 4, 5, 6, 0] : [1, 2, 3, 4, 5, 6]
  }, [datedSchedules])

  const filteredDatedSchedules = useMemo(() => {
    if (selectedScheduleDay === 'all') return datedSchedules
    return datedSchedules.filter((entry) => entry.dayIdx === selectedScheduleDay)
  }, [datedSchedules, selectedScheduleDay])

  const scheduleBuckets = useMemo(() => {
    const now = new Date()
    const nowDayIdx = now.getDay()
    const nowMinutes = now.getHours() * 60 + now.getMinutes()

    const done: ModalScheduleEntry[] = []
    const ongoing: ModalScheduleEntry[] = []
    const upcoming: ModalScheduleEntry[] = []

    filteredDatedSchedules.forEach((entry) => {
      if (entry.dayIdx < nowDayIdx || (entry.dayIdx === nowDayIdx && nowMinutes >= entry.endMinutes)) {
        done.push(entry)
      } else if (entry.dayIdx === nowDayIdx && nowMinutes >= entry.startMinutes && nowMinutes < entry.endMinutes) {
        ongoing.push(entry)
      } else {
        upcoming.push(entry)
      }
    })

    return { done, ongoing, upcoming }
  }, [filteredDatedSchedules])

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.liveRoomModal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h2>{room.room}</h2>
            <p className={styles.liveRoomSubtitle}>{room.building}</p>
          </div>
          <button onClick={onClose} aria-label="Close room details">
            <X size={18} />
          </button>
        </div>

        <div className={`${styles.liveRoomStatusBadge} ${styles[availability]}`}>
          {availability === 'available' ? (
            <><CheckCircle size={15} /> Available Now</>
          ) : availability === 'occupied' ? (
            <><AlertTriangle size={15} /> In Use</>
          ) : (
            <><Clock size={15} /> Status Unknown</>
          )}
        </div>

        <div className={styles.liveRoomTabs}>
          <button
            className={`${styles.liveRoomTabBtn} ${activeTab === 'details' ? styles.liveRoomTabActive : ''}`}
            onClick={() => setActiveTab('details')}
          >
            <Info size={15} /> Details
          </button>
          <button
            className={`${styles.liveRoomTabBtn} ${activeTab === 'schedule' ? styles.liveRoomTabActive : ''}`}
            onClick={() => setActiveTab('schedule')}
          >
            <Calendar size={15} /> Schedule ({roomSchedules.length})
          </button>
          <button
            className={`${styles.liveRoomTabBtn} ${activeTab === 'images' ? styles.liveRoomTabActive : ''}`}
            onClick={() => setActiveTab('images')}
          >
            <Eye size={15} /> Photos ({roomImages.length})
          </button>
        </div>

        <div className={styles.liveRoomBody}>
          {activeTab === 'details' && (
            <div className={styles.liveRoomDetailsGrid}>
              <div className={styles.liveRoomDetailItem}><Building2 size={14} /><span>{room.building}</span></div>
              <div className={styles.liveRoomDetailItem}><Square size={14} /><span>{room.room_type || 'General'}</span></div>
              <div className={styles.liveRoomDetailItem}><Users size={14} /><span>Capacity: {room.capacity || 'Unknown'}</span></div>
              <div className={styles.liveRoomDetailItem}><Layers size={14} /><span>Floor: {room.floor_number || 'N/A'}</span></div>

              {currentClass && (
                <div className={styles.liveRoomCurrentClass}>
                  <h4>Currently in Use</h4>
                  <p><strong>Course:</strong> {currentClass.course_code}</p>
                  <p><strong>Section:</strong> {currentClass.section}</p>
                  <p><strong>Time:</strong> {currentClass.schedule_time}</p>
                  {(currentClass.teacher_name || currentClass.faculty_name) && (
                    <p><strong>Teacher:</strong> {currentClass.teacher_name || currentClass.faculty_name}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'schedule' && (
            roomSchedules.length === 0 ? (
              <div className={styles.emptyState}>
                <Calendar size={28} />
                <p>No scheduled classes</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  <button
                    className={`${styles.liveRoomTabBtn} ${selectedScheduleDay === 'all' ? styles.liveRoomTabActive : ''}`}
                    onClick={() => setSelectedScheduleDay('all')}
                  >
                    All Days
                  </button>
                  {dayButtonIndexes.map((dayIdx) => (
                    <button
                      key={`live-room-day-${dayIdx}`}
                      className={`${styles.liveRoomTabBtn} ${selectedScheduleDay === dayIdx ? styles.liveRoomTabActive : ''}`}
                      onClick={() => setSelectedScheduleDay(dayIdx)}
                    >
                      {DAY_NAMES[dayIdx]}
                    </button>
                  ))}
                </div>

                <div className={styles.liveRoomScheduleList}>
                  {[
                    { title: 'Done', items: scheduleBuckets.done },
                    { title: 'Ongoing', items: scheduleBuckets.ongoing },
                    { title: 'Upcoming', items: scheduleBuckets.upcoming }
                  ].map((bucket) => (
                    <div key={`bucket-${bucket.title}`}>
                      <h4 style={{ margin: '4px 0 8px 2px', fontSize: 12, opacity: 0.85 }}>{bucket.title}</h4>
                      {bucket.items.length === 0 ? (
                        <div className={styles.liveRoomScheduleItem}>
                          <div className={styles.liveRoomScheduleDetails}>No {bucket.title.toLowerCase()} schedules.</div>
                        </div>
                      ) : bucket.items.map((entry, index) => (
                        <div key={`${bucket.title}-${entry.allocation.id ?? index}-${entry.dayIdx}-${entry.startMinutes}`} className={styles.liveRoomScheduleItem}>
                          <div className={styles.liveRoomScheduleTime}>
                            <Clock size={13} /> {entry.allocation.schedule_time}
                          </div>
                          <div className={styles.liveRoomScheduleDetails}>
                            <div className={styles.liveRoomScheduleCourse}>{entry.allocation.course_code}</div>
                            <div>{entry.allocation.section}</div>
                            <div>{DAY_NAMES[entry.dayIdx]}</div>
                            {(entry.allocation.teacher_name || entry.allocation.faculty_name) && (
                              <div>{entry.allocation.teacher_name || entry.allocation.faculty_name}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )
          )}

          {activeTab === 'images' && (
            loadingImages ? (
              <div className={styles.emptyState}>
                <RefreshCw size={28} className={styles.spinning} />
                <p>Loading images...</p>
              </div>
            ) : roomImages.length === 0 ? (
              <div className={styles.emptyState}>
                <ImageIcon size={28} />
                <p>No photos available yet</p>
              </div>
            ) : (
              <div className={styles.liveRoomImagesWrap}>
                <div className={styles.liveRoomImageViewer}>
                  <button
                    className={styles.liveRoomExpandBtn}
                    onClick={() => setIsImageLightboxOpen(true)}
                    aria-label="Open photo in full view"
                  >
                    <Maximize2 size={16} /> Full View
                  </button>
                  <img
                    src={roomImages[selectedImageIdx]?.image_url}
                    alt={`Room ${room.room}`}
                    className={`${styles.liveRoomMainImage} ${styles.clickableImage}`}
                    onClick={() => setIsImageLightboxOpen(true)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setIsImageLightboxOpen(true)
                      }
                    }}
                    onError={(event) => {
                      (event.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200"%3E%3Crect fill="%23e5e7eb" width="300" height="200"/%3E%3Ctext x="50%25" y="50%25" font-size="16" text-anchor="middle" dy=".3em" fill="%23999"%3EImage not found%3C/text%3E%3C/svg%3E'
                    }}
                  />
                  {roomImages[selectedImageIdx]?.caption && (
                    <p className={styles.liveRoomImageCaption}>{roomImages[selectedImageIdx].caption}</p>
                  )}
                </div>

                <div className={styles.liveRoomImageMeta}>
                  Photo {selectedImageIdx + 1} of {roomImages.length}
                </div>

                {hasMultipleImages && (
                  <div className={styles.liveRoomImageNav}>
                    <button
                      className={styles.liveRoomImageNavBtn}
                      onClick={goPrevImage}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span>{selectedImageIdx + 1} / {roomImages.length}</span>
                    <button
                      className={styles.liveRoomImageNavBtn}
                      onClick={goNextImage}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}

                {hasMultipleImages && (
                  <div className={styles.liveRoomThumbStrip}>
                    {roomImages.map((img, idx) => (
                      <button
                        key={`${img.id ?? idx}-${img.image_url}`}
                        className={`${styles.liveRoomThumbBtn} ${selectedImageIdx === idx ? styles.activeThumb : ''}`}
                        onClick={() => setSelectedImageIdx(idx)}
                        aria-label={`Show photo ${idx + 1}`}
                      >
                        <img
                          src={img.image_url}
                          alt={`Thumbnail ${idx + 1}`}
                          className={styles.liveRoomThumbImage}
                          onError={(event) => {
                            (event.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="60"%3E%3Crect fill="%23e5e7eb" width="100" height="60"/%3E%3C/svg%3E'
                          }}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {isImageLightboxOpen && roomImages[selectedImageIdx] && (
          <div className={styles.liveRoomLightboxOverlay} onClick={() => setIsImageLightboxOpen(false)}>
            <div className={styles.liveRoomLightboxContent} onClick={(event) => event.stopPropagation()}>
              <button
                className={styles.liveRoomLightboxClose}
                onClick={() => setIsImageLightboxOpen(false)}
                aria-label="Close full image view"
              >
                <X size={18} />
              </button>

              {hasMultipleImages && (
                <button className={styles.liveRoomLightboxNavBtn} onClick={goPrevImage} aria-label="Previous photo">
                  <ChevronLeft size={20} />
                </button>
              )}

              <img
                src={roomImages[selectedImageIdx].image_url}
                alt={`Room ${room.room} photo ${selectedImageIdx + 1}`}
                className={styles.liveRoomLightboxImage}
                onError={(event) => {
                  (event.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="900" height="600"%3E%3Crect fill="%23e5e7eb" width="900" height="600"/%3E%3Ctext x="50%25" y="50%25" font-size="24" text-anchor="middle" dy=".3em" fill="%23999"%3EImage not found%3C/text%3E%3C/svg%3E'
                }}
              />

              {hasMultipleImages && (
                <button className={styles.liveRoomLightboxNavBtn} onClick={goNextImage} aria-label="Next photo">
                  <ChevronRight size={20} />
                </button>
              )}

              <div className={styles.liveRoomLightboxFooter}>
                <span>{selectedImageIdx + 1} / {roomImages.length}</span>
                <span>{roomImages[selectedImageIdx].caption || `Photo of ${room.room}`}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

