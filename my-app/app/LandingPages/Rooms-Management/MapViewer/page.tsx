'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import { useTheme } from '@/app/context/ThemeContext'

import styles from './styles.module.css'
import {
  Map, Building2, Layers, Plus, Minus, Move, MousePointer, Square,
  Type, Trash2, Save, Download, Settings, Eye, EyeOff, ChevronDown, ChevronUp,
  Search, X, Check, Share2, Link, Grid, ZoomIn, ZoomOut, DoorOpen,
  Building, Users, GraduationCap, FlaskConical, BookOpen, Coffee,
  Projector, Thermometer, RefreshCw, FileText, ChevronRight, ChevronLeft, Edit3,
  Box, Maximize2, LayoutGrid, Footprints, Info, Monitor, AlertTriangle,
  PanelLeftClose, PanelLeftOpen, Loader2, RotateCcw, Wifi, Wind, Star,
  Calendar, Clock, Copy, ExternalLink, Palette, Image, Lock, Unlock,
  ArrowUpDown, Laptop, Beaker, Library, UtensilsCrossed, Bath, Archive,
  Dumbbell, Music, Theater, Presentation, Server, CircleDot, Triangle,
  Hexagon, Pentagon, Octagon, Heart, Zap, Flame, Droplets, Sun, Moon,
  MoveUp, MoveDown, ChevronsUp, ChevronsDown, LayoutList, Grip,
  BoxSelect, Menu, Wrench
} from 'lucide-react'

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
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [menuBarHidden, setMenuBarHidden] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)

  // Responsive detection
  const [isMobile, setIsMobile] = useState(false)
  const [isTablet, setIsTablet] = useState(false)
  const [showMobileWarning, setShowMobileWarning] = useState(false)

  // Panel state
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  
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

  // Schedule integration
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null)
  const [roomAllocations, setRoomAllocations] = useState<RoomAllocation[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<string>('')
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('')

  // Canvas state
  const [zoom, setZoom] = useState(100)
  const [snapToGrid, setSnapToGrid] = useState(true)
  const [showGrid, setShowGrid] = useState(true)
  const [gridSize, setGridSize] = useState(20)
  const [canvasSize, setCanvasSize] = useState({ width: 1600, height: 1000 })
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [canvasBackground, setCanvasBackground] = useState('#ffffff')

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
  const [activeRightTab, setActiveRightTab] = useState<'properties' | 'layers'>('properties')

  // Auth state to prevent rendering before auth check completes
  const [authChecked, setAuthChecked] = useState(false)
  const [isAuthorized, setIsAuthorized] = useState(false)

  // Mobile FAB state
  const [showMobileFAB, setShowMobileFAB] = useState(false)
  const [activeMobilePanel, setActiveMobilePanel] = useState<'none' | 'toolbox' | 'properties'>('none')

  // Multi-select state
  const [selectedElements, setSelectedElements] = useState<string[]>([])
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false)
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null)
  const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; y: number } | null>(null)
  const [selectMode, setSelectMode] = useState<'single' | 'multi'>('single')

  // Editing state
  const [editForm, setEditForm] = useState({
    label: '',
    type: '',
    width: 0,
    height: 0,
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

  // Show notification
  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 3000)
  }

  // Device detection for responsive adjustments (no warning)
  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth
      setIsMobile(width < 768)
      setIsTablet(width >= 768 && width < 1024)
      // Auto-collapse panels on mobile
      if (width < 768) {
        setLeftPanelOpen(false)
        setRightPanelOpen(false)
        setShowMobileFAB(true)
      } else {
        setShowMobileFAB(false)
        setActiveMobilePanel('none')
      }
    }

    checkDevice()
    window.addEventListener('resize', checkDevice)
    return () => window.removeEventListener('resize', checkDevice)
  }, [])

  // Update current time for live mode
  useEffect(() => {
    if (viewMode === 'live') {
      const interval = setInterval(() => {
        setCurrentTime(new Date())
      }, 60000) // Update every minute
      return () => clearInterval(interval)
    }
  }, [viewMode])

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
  const fetchSavedFloorPlans = async () => {
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

      // Find matching floor plan for current building/floor
      const match = floorPlanData.find(fp => 
        fp.floor_name?.toLowerCase().includes(selectedBuilding.toLowerCase()) && 
        fp.floor_number === selectedFloor
      )
      if (match) {
        loadFloorPlan(match)
      }
    } catch (error) {
      console.error('Error fetching floor plans:', error)
    }
  }

  // Load a floor plan
  const loadFloorPlan = (floorPlan: FloorPlan) => {
    setCurrentFloorPlan(floorPlan)
    setFloorPlanName(floorPlan.floor_name)
    setIsDefault(floorPlan.is_default_view)
    if (floorPlan.canvas_data?.elements) {
      setCanvasElements(floorPlan.canvas_data.elements)
    }
    if (floorPlan.canvas_data?.canvasSize) {
      setCanvasSize(floorPlan.canvas_data.canvasSize)
    }
    if (floorPlan.linked_schedule_id) {
      setSelectedScheduleId(floorPlan.linked_schedule_id)
    }
    showNotification('success', `Loaded: ${floorPlan.floor_name}`)
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

    const now = currentTime
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

    const now = currentTime
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

  // Handle element selection
  const handleElementClick = (element: CanvasElement, e: React.MouseEvent) => {
    e.stopPropagation()
    if (element.isLocked && viewMode === 'editor') return
    setSelectedElement(element)
    setEditForm({
      label: element.label || '',
      type: element.type,
      width: element.width,
      height: element.height,
      color: element.color || getRoomColor(element.linkedRoomData?.room_type).bg,
      rotation: element.rotation,
      iconType: element.iconType || '',
      fontSize: element.fontSize || 14,
      opacity: element.opacity ?? 100,
      borderWidth: element.borderWidth ?? 2
    })
  }

  // Handle canvas click (deselect)
  const handleCanvasClick = () => {
    setSelectedElement(null)
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
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'room', roomId: room.id }))
  }

  // Handle toolbox item drag start
  const handleToolboxDragStart = (e: React.DragEvent, item: any) => {
    if (viewMode !== 'editor') return
    autoHideMobileToolbox()
    setDragItem({ type: 'toolbox', data: item })
    setIsDragging(true)
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'toolbox', itemType: item.type }))
  }

  // Handle icon drag start
  const handleIconDragStart = (e: React.DragEvent, iconOption: any) => {
    if (viewMode !== 'editor') return
    autoHideMobileToolbox()
    setDragItem({ type: 'icon', data: iconOption })
    setIsDragging(true)
    e.dataTransfer.effectAllowed = 'copy'
  }

  // Handle shape drag start
  const handleShapeDragStart = (e: React.DragEvent, shapeOption: any) => {
    if (viewMode !== 'editor') return
    autoHideMobileToolbox()
    setDragItem({ type: 'shape', data: shapeOption })
    setIsDragging(true)
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

  // Handle element drag on canvas
  const handleElementDragStart = (e: React.MouseEvent, element: CanvasElement) => {
    e.stopPropagation()
    if (viewMode !== 'editor' || element.isLocked) return
    setDraggingElement(element.id)
    
    // Get the canvas rect and calculate the click position relative to the element
    // Use the canvas ref to get accurate position regardless of which child element was clicked
    if (!canvasRef.current) return
    const canvasRect = canvasRef.current.getBoundingClientRect()
    const scale = zoom / 100
    
    // Calculate click position in canvas coordinates
    const clickX = (e.clientX - canvasRect.left) / scale
    const clickY = (e.clientY - canvasRect.top) / scale
    
    // Calculate offset from element's top-left corner
    setDragOffset({
      x: clickX - element.x,
      y: clickY - element.y
    })
  }

  const handleElementDrag = (e: React.MouseEvent) => {
    if (!draggingElement || !canvasRef.current || viewMode !== 'editor') return

    const rect = canvasRef.current.getBoundingClientRect()
    const scale = zoom / 100
    
    // Calculate new position: mouse position in canvas coords minus offset
    let x = (e.clientX - rect.left) / scale - dragOffset.x
    let y = (e.clientY - rect.top) / scale - dragOffset.y

    x = snapToGridPosition(x)
    y = snapToGridPosition(y)

    setCanvasElements(prev => prev.map(el =>
      el.id === draggingElement ? { ...el, x, y } : el
    ))
  }

  const handleElementDragEnd = () => {
    setDraggingElement(null)
  }

  // Handle element resize
  const handleResizeStart = (e: React.MouseEvent, elementId: string, handle: string) => {
    e.stopPropagation()
    e.preventDefault()
    if (viewMode !== 'editor') return
    
    const element = canvasElements.find(el => el.id === elementId)
    if (!element || element.isLocked) return
    
    setResizingElement(elementId)
    setResizeHandle(handle)
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: element.width,
      height: element.height,
      elementX: element.x,
      elementY: element.y
    })
  }

  const handleResizeMove = (e: React.MouseEvent) => {
    if (!resizingElement || !resizeHandle || viewMode !== 'editor') return

    const element = canvasElements.find(el => el.id === resizingElement)
    if (!element) return

    const scale = zoom / 100
    const deltaX = (e.clientX - resizeStart.x) / scale
    const deltaY = (e.clientY - resizeStart.y) / scale

    let newWidth = resizeStart.width
    let newHeight = resizeStart.height
    let newX = resizeStart.elementX
    let newY = resizeStart.elementY

    // Handle different resize directions
    if (resizeHandle.includes('e')) {
      newWidth = Math.max(40, snapToGridPosition(resizeStart.width + deltaX))
    }
    if (resizeHandle.includes('w')) {
      const proposedWidth = snapToGridPosition(resizeStart.width - deltaX)
      newWidth = Math.max(40, proposedWidth)
      // Only adjust X if width actually changed
      newX = resizeStart.elementX + (resizeStart.width - newWidth)
    }
    if (resizeHandle.includes('s')) {
      newHeight = Math.max(40, snapToGridPosition(resizeStart.height + deltaY))
    }
    if (resizeHandle.includes('n')) {
      const proposedHeight = snapToGridPosition(resizeStart.height - deltaY)
      newHeight = Math.max(40, proposedHeight)
      // Only adjust Y if height actually changed
      newY = resizeStart.elementY + (resizeStart.height - newHeight)
    }

    setCanvasElements(prev => prev.map(el =>
      el.id === resizingElement ? { ...el, width: newWidth, height: newHeight, x: newX, y: newY } : el
    ))
  }

  const handleResizeEnd = () => {
    setResizingElement(null)
    setResizeHandle(null)
  }

  // Touch event handlers for mobile support
  const handleTouchStart = (e: React.TouchEvent, element: CanvasElement) => {
    if (viewMode !== 'editor' || element.isLocked) return
    e.preventDefault()
    const touch = e.touches[0]
    setDraggingElement(element.id)
    
    // Use canvas ref to get accurate position
    if (!canvasRef.current) return
    const canvasRect = canvasRef.current.getBoundingClientRect()
    const scale = zoom / 100
    
    // Calculate touch position in canvas coordinates
    const touchX = (touch.clientX - canvasRect.left) / scale
    const touchY = (touch.clientY - canvasRect.top) / scale
    
    // Calculate offset from element's top-left corner
    setDragOffset({
      x: touchX - element.x,
      y: touchY - element.y
    })
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!draggingElement && !resizingElement) return
    if (!canvasRef.current || viewMode !== 'editor') return
    
    const touch = e.touches[0]
    const rect = canvasRef.current.getBoundingClientRect()
    const scale = zoom / 100

    if (draggingElement) {
      // Calculate new position: touch position in canvas coords minus offset
      let x = (touch.clientX - rect.left) / scale - dragOffset.x
      let y = (touch.clientY - rect.top) / scale - dragOffset.y
      x = snapToGridPosition(x)
      y = snapToGridPosition(y)
      setCanvasElements(prev => prev.map(el =>
        el.id === draggingElement ? { ...el, x, y } : el
      ))
    }

    if (resizingElement && resizeHandle) {
      const element = canvasElements.find(el => el.id === resizingElement)
      if (!element) return

      const deltaX = (touch.clientX - resizeStart.x) / scale
      const deltaY = (touch.clientY - resizeStart.y) / scale

      let newWidth = resizeStart.width
      let newHeight = resizeStart.height
      let newX = resizeStart.elementX
      let newY = resizeStart.elementY

      if (resizeHandle.includes('e')) {
        newWidth = Math.max(40, snapToGridPosition(resizeStart.width + deltaX))
      }
      if (resizeHandle.includes('w')) {
        const proposedWidth = snapToGridPosition(resizeStart.width - deltaX)
        newWidth = Math.max(40, proposedWidth)
        newX = resizeStart.elementX + (resizeStart.width - newWidth)
      }
      if (resizeHandle.includes('s')) {
        newHeight = Math.max(40, snapToGridPosition(resizeStart.height + deltaY))
      }
      if (resizeHandle.includes('n')) {
        const proposedHeight = snapToGridPosition(resizeStart.height - deltaY)
        newHeight = Math.max(40, proposedHeight)
        newY = resizeStart.elementY + (resizeStart.height - newHeight)
      }

      setCanvasElements(prev => prev.map(el =>
        el.id === resizingElement ? { ...el, width: newWidth, height: newHeight, x: newX, y: newY } : el
      ))
    }
  }

  const handleTouchEnd = () => {
    setDraggingElement(null)
    setResizingElement(null)
    setResizeHandle(null)
  }

  const handleResizeTouchStart = (e: React.TouchEvent, elementId: string, handle: string) => {
    e.stopPropagation()
    e.preventDefault()
    if (viewMode !== 'editor') return
    
    const element = canvasElements.find(el => el.id === elementId)
    if (!element || element.isLocked) return
    
    const touch = e.touches[0]
    setResizingElement(elementId)
    setResizeHandle(handle)
    setResizeStart({
      x: touch.clientX,
      y: touch.clientY,
      width: element.width,
      height: element.height,
      elementX: element.x,
      elementY: element.y
    })
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
    setSelectMode(prev => prev === 'single' ? 'multi' : 'single')
    setSelectedElements([])
    if (selectMode === 'single') {
      showNotification('info', 'Multi-select mode: Click and drag to select multiple elements')
    }
  }

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

  // Mobile panel toggle handler
  const toggleMobilePanel = (panel: 'toolbox' | 'properties') => {
    if (activeMobilePanel === panel) {
      setActiveMobilePanel('none')
      setLeftPanelOpen(false)
      setRightPanelOpen(false)
    } else {
      setActiveMobilePanel(panel)
      if (panel === 'toolbox') {
        setLeftPanelOpen(true)
        setRightPanelOpen(false)
      } else {
        setRightPanelOpen(true)
        setLeftPanelOpen(false)
      }
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

  // Save floor plan
  const saveFloorPlan = async () => {
    if (!floorPlanName.trim()) {
      showNotification('error', 'Please enter a floor plan name')
      return
    }

    try {
      setSaving(true)

      const canvasData = {
        elements: canvasElements,
        canvasSize,
        zoom,
        gridSize
      }

      // If setting as default, unset other defaults first
      if (isDefault) {
        await db
          .from('floor_plans')
          .update({ is_default_view: false })
          .eq('is_default_view', true)
      }

      if (currentFloorPlan?.id) {
        // Update existing
        console.log('Updating floor plan ID:', currentFloorPlan.id)
        const { data, error } = await db
          .from('floor_plans')
          .update({
            floor_name: floorPlanName,
            canvas_data: canvasData,
            canvas_width: canvasSize.width,
            canvas_height: canvasSize.height,
            is_default_view: isDefault,
            linked_schedule_id: selectedScheduleId,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentFloorPlan.id)
          .select()

        console.log('Update result:', { data, error })
        if (error) throw error
        if (!data || data.length === 0) {
          throw new Error('Update failed - database did not confirm the change. Check RLS policies in Supabase.')
        }
        showNotification('success', 'Floor plan updated!')
      } else {
        // Create new
        const { data, error } = await db
          .from('floor_plans')
          .insert([{
            building_id: 1,
            floor_number: selectedFloor,
            floor_name: floorPlanName,
            canvas_data: canvasData,
            canvas_width: canvasSize.width,
            canvas_height: canvasSize.height,
            is_default_view: isDefault,
            is_published: false,
            status: 'draft',
            linked_schedule_id: selectedScheduleId
          }])
          .select()
          .single()

        if (error) throw error
        setCurrentFloorPlan(data as FloorPlan)
        showNotification('success', 'Floor plan saved!')
      }

      setShowSaveModal(false)
      fetchSavedFloorPlans()
    } catch (error) {
      console.error('Error saving floor plan:', error)
      showNotification('error', 'Failed to save floor plan')
    } finally {
      setSaving(false)
    }
  }

  // Export as PDF with QTime logo - Landscape orientation
  const exportPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [215.9, 279.4] // Short bond paper (landscape: width > height)
      })

      const pageWidth = 279.4  // Swapped for landscape
      const pageHeight = 215.9
      const margin = 10

      // QTime Logo
      const logoSize = 10
      const logoX = margin
      const logoY = margin

      // Green rounded rectangle for Q
      pdf.setFillColor(22, 163, 74)
      pdf.roundedRect(logoX, logoY, logoSize, logoSize, 2, 2, 'F')
      
      // "Q" letter in white
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Q', logoX + 3.5, logoY + 7)
      
      // "Qtime Scheduler" text
      pdf.setTextColor(0, 0, 0)
      pdf.setFontSize(12)
      pdf.text('Qtime Scheduler', logoX + logoSize + 3, logoY + 7)

      // Title
      pdf.setFontSize(16)
      pdf.setFont('helvetica', 'bold')
      pdf.text(`Floor Plan: ${floorPlanName || `${selectedBuilding} - Floor ${selectedFloor}`}`, margin, logoY + 20)

      // Subtitle with schedule info
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'normal')
      const schedule = schedules.find(s => s.id === selectedScheduleId)
      if (schedule) {
        pdf.text(`Schedule: ${schedule.schedule_name} | ${schedule.semester} ${schedule.academic_year}`, margin, logoY + 28)
      }

      // Date
      pdf.setFontSize(9)
      pdf.text(`Generated: ${new Date().toLocaleDateString()}`, margin, logoY + 35)

      // Draw floor plan area - larger in landscape
      const floorPlanY = logoY + 45
      const floorPlanWidth = pageWidth - (margin * 2)
      const floorPlanHeight = pageHeight - floorPlanY - 40  // More room for floor plan

      // Border
      pdf.setDrawColor(200, 200, 200)
      pdf.setLineWidth(0.5)
      pdf.rect(margin, floorPlanY, floorPlanWidth, floorPlanHeight)

      // Calculate scale to fit elements
      const scaleX = floorPlanWidth / canvasSize.width
      const scaleY = floorPlanHeight / canvasSize.height
      const scale = Math.min(scaleX, scaleY) * 0.9

      // Draw elements
      canvasElements.forEach(element => {
        const x = margin + (element.x * scale)
        const y = floorPlanY + (element.y * scale)
        const w = element.width * scale
        const h = element.height * scale

        if (element.type === 'room') {
          const color = element.color || '#3b82f6'
          const rgb = hexToRgb(color)
          pdf.setFillColor(rgb.r, rgb.g, rgb.b)
          pdf.rect(x, y, w, h, 'F')

          pdf.setDrawColor(100, 100, 100)
          pdf.setLineWidth(0.3)
          pdf.rect(x, y, w, h)

          // Availability indicator
          if (showScheduleOverlay && element.linkedRoomData) {
            const availability = getRoomAvailability(element.linkedRoomData.room)
            if (availability === 'available') {
              pdf.setFillColor(34, 197, 94)
            } else if (availability === 'occupied') {
              pdf.setFillColor(239, 68, 68)
            }
            pdf.circle(x + w - 3, y + 3, 2, 'F')
          }

          // Room label
          pdf.setTextColor(255, 255, 255)
          pdf.setFontSize(6)
          pdf.setFont('helvetica', 'bold')
          const label = element.label || ''
          const textWidth = pdf.getTextWidth(label)
          if (textWidth < w - 2) {
            pdf.text(label, x + (w - textWidth) / 2, y + h / 2 + 1)
          }
        } else if (element.type === 'wall') {
          pdf.setFillColor(55, 65, 81)
          pdf.rect(x, y, w, h, 'F')
        } else if (element.type === 'hallway') {
          pdf.setFillColor(209, 213, 219)
          pdf.rect(x, y, w, h, 'F')
        } else if (element.type === 'text') {
          pdf.setTextColor(0, 0, 0)
          pdf.setFontSize(8)
          pdf.text(element.label || '', x, y + 5)
        }
      })

      // Legend
      const legendY = floorPlanY + floorPlanHeight + 10
      pdf.setTextColor(0, 0, 0)
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Legend:', margin, legendY)

      const legendItems = getLegendItems()
      let legendX = margin
      let currentLegendY = legendY + 6
      
      legendItems.forEach((item, idx) => {
        const rgb = hexToRgb(item.bg)
        pdf.setFillColor(rgb.r, rgb.g, rgb.b)
        pdf.rect(legendX, currentLegendY, 8, 5, 'F')
        
        pdf.setFontSize(8)
        pdf.setFont('helvetica', 'normal')
        pdf.text(item.label, legendX + 10, currentLegendY + 4)
        
        legendX += 50
        if (legendX > pageWidth - margin - 50) {
          legendX = margin
          currentLegendY += 8
        }
      })

      // Availability legend if showing schedule
      if (showScheduleOverlay) {
        currentLegendY += 12
        pdf.setFontSize(9)
        pdf.setFont('helvetica', 'bold')
        pdf.text('Room Status:', margin, currentLegendY)
        
        pdf.setFillColor(34, 197, 94)
        pdf.circle(margin + 40, currentLegendY - 1.5, 3, 'F')
        pdf.setFont('helvetica', 'normal')
        pdf.text('Available', margin + 45, currentLegendY)
        
        pdf.setFillColor(239, 68, 68)
        pdf.circle(margin + 80, currentLegendY - 1.5, 3, 'F')
        pdf.text('Occupied', margin + 85, currentLegendY)
      }

      // Save
      const fileName = `FloorPlan_${selectedBuilding.replace(/\s+/g, '_')}_F${selectedFloor}_${new Date().toISOString().split('T')[0]}.pdf`
      pdf.save(fileName)
      showNotification('success', 'PDF exported successfully!')
    } catch (error) {
      console.error('Error exporting PDF:', error)
      showNotification('error', 'Failed to export PDF')
    }
  }

  // Helper: hex to rgb
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 100, g: 100, b: 100 }
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

  return (
    <div className={styles.layout} data-theme={globalTheme || 'green'}>
      {/* Full page loading overlay during auth check */}
      {(!authChecked || !isAuthorized) && (
        <div className={styles.authLoadingOverlay}>
          <div className={styles.authLoadingContent}>
            <Loader2 size={48} className={styles.spinnerIcon} />
            <h2>{!authChecked ? 'Verifying access...' : 'Redirecting...'}</h2>
          </div>
        </div>
      )}
      
      <MenuBar onToggleSidebar={toggleSidebar} showSidebarToggle={true} onMenuBarToggle={handleMenuBarToggle} />
      <Sidebar isOpen={sidebarOpen} />

      <main
        className={`${styles.main} ${sidebarOpen ? '' : styles.fullWidth} ${menuBarHidden ? styles.menuHidden : ''}`}
        onMouseMove={(e) => {
          if (draggingElement) handleElementDrag(e)
          if (resizingElement) handleResizeMove(e)
        }}
        onMouseUp={() => {
          handleElementDragEnd()
          handleResizeEnd()
        }}
        onMouseLeave={() => {
          handleElementDragEnd()
          handleResizeEnd()
        }}
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
                <Edit3 size={16} />
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
            <button className={styles.loadBtn} onClick={() => setShowLoadModal(true)} title="Load Floor Plan">
              <FileText size={18} />
            </button>
            {viewMode === 'editor' && (
              <button className={styles.saveBtn} onClick={() => setShowSaveModal(true)} disabled={saving}>
                {saving ? <Loader2 size={18} className={styles.spinning} /> : <Save size={18} />}
                Save
              </button>
            )}
            <button className={styles.exportBtn} onClick={exportPDF}>
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
          {/* Left Toolbox Panel - Only visible in editor mode */}
          {viewMode === 'editor' && (
            <div className={`${styles.leftPanel} ${leftPanelOpen ? '' : styles.collapsed}`}>
              <button
                className={styles.panelToggle}
                onClick={() => setLeftPanelOpen(!leftPanelOpen)}
                title={leftPanelOpen ? 'Collapse toolbox' : 'Expand toolbox'}
              >
                {leftPanelOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
              </button>

              {leftPanelOpen && (
                <>
                  <div className={styles.panelHeader}>
                    <h3>TOOLBOX</h3>
                  </div>

                  <div className={styles.toolboxContent}>
                    {/* Rooms & Zones Section */}
                    <div className={styles.toolSection}>
                      <button
                        className={styles.sectionHeader}
                        onClick={() => setSectionsOpen(p => ({ ...p, roomsZones: !p.roomsZones }))}
                      >
                        <span><Building size={16} /> Rooms & Zones</span>
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
                                <Loader2 size={20} className={styles.spinning} />
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
                                    <Check size={14} className={styles.addedCheck} />
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
                  </div>
                </>
              )}
            </div>
          )}

          {/* Main Canvas */}
          <div
            ref={canvasContainerRef}
            className={`${styles.canvasContainer} ${viewMode !== 'editor' ? styles.viewOnly : ''}`}
            onDragOver={viewMode === 'editor' ? handleDragOver : undefined}
            onDrop={viewMode === 'editor' ? handleDrop : undefined}
            onDragLeave={() => setDragGhost(null)}
          >
            <div
              ref={canvasRef}
              className={`${styles.canvas} ${selectMode === 'multi' ? styles.multiSelectMode : ''}`}
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
              onMouseDown={selectMode === 'multi' ? handleMarqueeStart : undefined}
              onMouseMove={(e) => {
                handleElementDrag(e)
                handleResizeMove(e)
                if (isMarqueeSelecting) handleMarqueeMove(e)
              }}
              onMouseUp={() => {
                handleElementDragEnd()
                handleResizeEnd()
                if (isMarqueeSelecting) handleMarqueeEnd()
              }}
              onMouseLeave={() => {
                handleElementDragEnd()
                handleResizeEnd()
                if (isMarqueeSelecting) handleMarqueeEnd()
              }}
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
                      transform: `rotate(${element.rotation}deg)`,
                      zIndex: element.zIndex
                    }}
                    onClick={(e) => handleElementClick(element, e)}
                    onMouseDown={(e) => viewMode === 'editor' && !element.isLocked && handleElementDragStart(e, element)}
                    onTouchStart={(e) => viewMode === 'editor' && !element.isLocked && handleTouchStart(e, element)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
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
                        <div className={`${styles.resizeHandle} ${styles.resizeN}`} onMouseDown={(e) => handleResizeStart(e, element.id, 'n')} onTouchStart={(e) => handleResizeTouchStart(e, element.id, 'n')} />
                        <div className={`${styles.resizeHandle} ${styles.resizeS}`} onMouseDown={(e) => handleResizeStart(e, element.id, 's')} onTouchStart={(e) => handleResizeTouchStart(e, element.id, 's')} />
                        <div className={`${styles.resizeHandle} ${styles.resizeE}`} onMouseDown={(e) => handleResizeStart(e, element.id, 'e')} onTouchStart={(e) => handleResizeTouchStart(e, element.id, 'e')} />
                        <div className={`${styles.resizeHandle} ${styles.resizeW}`} onMouseDown={(e) => handleResizeStart(e, element.id, 'w')} onTouchStart={(e) => handleResizeTouchStart(e, element.id, 'w')} />
                        <div className={`${styles.resizeHandle} ${styles.resizeNE}`} onMouseDown={(e) => handleResizeStart(e, element.id, 'ne')} onTouchStart={(e) => handleResizeTouchStart(e, element.id, 'ne')} />
                        <div className={`${styles.resizeHandle} ${styles.resizeNW}`} onMouseDown={(e) => handleResizeStart(e, element.id, 'nw')} onTouchStart={(e) => handleResizeTouchStart(e, element.id, 'nw')} />
                        <div className={`${styles.resizeHandle} ${styles.resizeSE}`} onMouseDown={(e) => handleResizeStart(e, element.id, 'se')} onTouchStart={(e) => handleResizeTouchStart(e, element.id, 'se')} />
                        <div className={`${styles.resizeHandle} ${styles.resizeSW}`} onMouseDown={(e) => handleResizeStart(e, element.id, 'sw')} onTouchStart={(e) => handleResizeTouchStart(e, element.id, 'sw')} />
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

            {/* Canvas Controls */}
            <div className={styles.canvasControls}>
              <div className={styles.zoomControls}>
                <button onClick={() => setZoom(z => Math.max(25, z - 25))}>
                  <ZoomOut size={18} />
                </button>
                <span>Zoom: {zoom}%</span>
                <button onClick={() => setZoom(z => Math.min(200, z + 25))}>
                  <ZoomIn size={18} />
                </button>
                <button onClick={() => setZoom(100)} title="Reset zoom">
                  <Maximize2 size={16} />
                </button>
              </div>

              {viewMode === 'editor' && (
                <>
                  <div className={styles.selectControl}>
                    <button
                      className={`${styles.selectModeBtn} ${selectMode === 'multi' ? styles.active : ''}`}
                      onClick={toggleSelectMode}
                      title={selectMode === 'single' ? 'Enable multi-select (drag to select multiple)' : 'Disable multi-select'}
                    >
                      <BoxSelect size={16} />
                      {!isMobile && <span>{selectMode === 'multi' ? 'Multi' : 'Single'}</span>}
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

              {viewMode === 'live' && showScheduleOverlay && (
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
                            <Building size={16} />
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
                                    <Check size={14} /> Available
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
                            className={styles.applyBtn}
                            onClick={() => {
                              updateElement(selectedElement.id, {
                                label: editForm.label,
                                width: editForm.width,
                                height: editForm.height,
                                color: editForm.color,
                                rotation: editForm.rotation,
                                iconType: editForm.iconType,
                                fontSize: editForm.fontSize,
                                opacity: editForm.opacity,
                                borderWidth: editForm.borderWidth
                              })
                              showNotification('success', 'Element updated!')
                            }}
                          >
                            <Check size={16} />
                            Apply Changes
                          </button>

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
      </main>

      {/* Save Modal */}
      {showSaveModal && (
        <div className={styles.modalOverlay} onClick={() => setShowSaveModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2><Save size={20} /> Save Floor Plan</h2>
              <button onClick={() => setShowSaveModal(false)}><X size={20} /></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>Floor Plan Name</label>
                <input
                  type="text"
                  value={floorPlanName}
                  onChange={(e) => setFloorPlanName(e.target.value)}
                  placeholder={`${selectedBuilding} - Floor ${selectedFloor}`}
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
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setShowSaveModal(false)}>
                Cancel
              </button>
              <button className={styles.saveModalBtn} onClick={saveFloorPlan} disabled={saving}>
                {saving ? <Loader2 size={16} className={styles.spinning} /> : <Save size={16} />}
                {saving ? 'Saving...' : 'Save Floor Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Modal */}
      {showLoadModal && (
        <div className={styles.modalOverlay} onClick={() => setShowLoadModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2><FileText size={20} /> Load Floor Plan</h2>
              <button onClick={() => setShowLoadModal(false)}><X size={20} /></button>
            </div>
            <div className={styles.modalBody}>
              {savedFloorPlans.length === 0 ? (
                <div className={styles.emptyState}>
                  <Info size={32} />
                  <p>No saved floor plans found</p>
                </div>
              ) : (
                <div className={styles.floorPlanList}>
                  {savedFloorPlans.map(fp => (
                    <div
                      key={fp.id}
                      className={`${styles.floorPlanItem} ${currentFloorPlan?.id === fp.id ? styles.active : ''}`}
                      onClick={() => {
                        loadFloorPlan(fp)
                        setShowLoadModal(false)
                      }}
                    >
                      <div className={styles.floorPlanInfo}>
                        <span className={styles.floorPlanName}>
                          {fp.floor_name}
                          {fp.is_default_view && <Star size={14} className={styles.defaultIcon} />}
                        </span>
                        <span className={styles.floorPlanMeta}>
                          Floor {fp.floor_number} • {new Date(fp.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className={styles.floorPlanStatus}>
                        {fp.is_published ? (
                          <span className={styles.published}>Published</span>
                        ) : (
                          <span className={styles.draft}>Draft</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setShowLoadModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
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
                  value={currentFloorPlan?.id ? `${typeof window !== 'undefined' ? window.location.origin : ''}/floor-plan/view/${currentFloorPlan.id}` : 'Save floor plan first'}
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
      )}

      {/* Mobile Floating Action Buttons */}
      {showMobileFAB && viewMode === 'editor' && (
        <div className={styles.mobileFAB}>
          <button
            className={`${styles.fabButton} ${activeMobilePanel === 'toolbox' ? styles.active : ''}`}
            onClick={() => toggleMobilePanel('toolbox')}
            title="Toolbox"
          >
            <Wrench size={22} />
          </button>
          <button
            className={`${styles.fabButton} ${activeMobilePanel === 'properties' ? styles.active : ''}`}
            onClick={() => toggleMobilePanel('properties')}
            title="Properties"
          >
            <Settings size={22} />
          </button>
        </div>
      )}

      {/* Mobile Panel Overlay */}
      {showMobileFAB && activeMobilePanel !== 'none' && (
        <div 
          className={styles.mobileOverlay} 
          onClick={() => {
            setActiveMobilePanel('none')
            setLeftPanelOpen(false)
            setRightPanelOpen(false)
          }} 
        />
      )}

      {/* Notification */}
      {notification && (
        <div className={`${styles.notification} ${styles[notification.type]}`}>
          {notification.type === 'success' && <Check size={18} />}
          {notification.type === 'error' && <X size={18} />}
          {notification.type === 'info' && <Info size={18} />}
          <span>{notification.message}</span>
        </div>
      )}
    </div>
  )
}
