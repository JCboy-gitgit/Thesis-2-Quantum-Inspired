'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import { useTheme } from '@/app/context/ThemeContext'
import styles from './styles.module.css'
import { 
  Map, 
  Building2, 
  Layers, 
  Plus,
  Minus,
  Move,
  MousePointer,
  Square,
  Circle,
  Type,
  Trash2,
  Save,
  Download,
  Upload,
  Settings,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Copy,
  Clipboard,
  ClipboardPaste,
  Files,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  RotateCw,
  Grid,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Check,
  Share2,
  Link,
  ExternalLink,
  Image,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  DoorOpen,
  ArrowUpDown,
  Building,
  Sofa,
  Monitor,
  Users,
  GraduationCap,
  FlaskConical,
  BookOpen,
  Coffee,
  Wifi,
  Printer,
  Projector,
  Thermometer,
  AlertTriangle,
  Info,
  RefreshCw,
  FolderOpen,
  FilePlus,
  MoreVertical,
  Undo,
  Redo,
  PanelLeftClose,
  PanelLeftOpen,
  Grip,
  Fullscreen
} from 'lucide-react'

// Types
interface CanvasElement {
  id: string
  type: 'room' | 'wall' | 'door' | 'window' | 'stair' | 'text' | 'icon' | 'shape' | 'image' | 'hallway' | 'elevator' | 'restroom' | 'entrance'
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  label?: string
  color?: string
  borderColor?: string
  fontSize?: number
  fontWeight?: 'normal' | 'bold'
  textAlign?: 'left' | 'center' | 'right'
  icon?: string
  linkedRoomId?: number
  linkedRoomData?: any
  isLocked?: boolean
  isVisible?: boolean
  properties?: Record<string, any>
  shapeType?: 'rectangle' | 'circle' | 'triangle' | 'line'
  opacity?: number
  borderWidth?: number
  borderStyle?: 'solid' | 'dashed' | 'dotted'
}

interface Building {
  id: number
  name: string
  code?: string
  campus?: string
  total_floors: number
  floor_plans?: FloorPlan[]
}

interface FloorPlan {
  id: number
  building_id: number
  floor_number: number
  floor_name?: string
  canvas_data: any
  canvas_width: number
  canvas_height: number
  grid_size: number
  background_color: string
  background_image_url?: string
  is_default_view: boolean
  is_published: boolean
  status: string
  buildings?: Building
}

interface Room {
  id: number
  name: string
  building: string
  campus: string
  capacity: number
  floorNumber?: number
  roomType?: string
  hasAC?: boolean
  hasProjector?: boolean
  isPWDAccessible?: boolean
}

// Icon mapping for the toolbox
const ICONS = {
  door: DoorOpen,
  stairs: Building,
  elevator: ArrowUpDown,
  sofa: Sofa,
  monitor: Monitor,
  users: Users,
  graduation: GraduationCap,
  lab: FlaskConical,
  library: BookOpen,
  coffee: Coffee,
  wifi: Wifi,
  printer: Printer,
  projector: Projector,
  ac: Thermometer,
  warning: AlertTriangle,
  info: Info
}

// Preset colors
const PRESET_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  '#14B8A6', '#A855F7', '#F43F5E', '#22C55E', '#0EA5E9',
  '#ffffff', '#f3f4f6', '#e5e7eb', '#9ca3af', '#6b7280',
  '#4b5563', '#374151', '#1f2937', '#111827', '#000000'
]

export default function MapViewerPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [isMenuBarHidden, setIsMenuBarHidden] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  // Canvas state
  const canvasRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [elements, setElements] = useState<CanvasElement[]>([])
  const [selectedElement, setSelectedElement] = useState<CanvasElement | null>(null)
  const [selectedElements, setSelectedElements] = useState<string[]>([])
  const [zoom, setZoom] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 })
  const [gridSize, setGridSize] = useState(20)
  const [showGrid, setShowGrid] = useState(true)
  const [snapToGrid, setSnapToGrid] = useState(true)
  const [snapToElements, setSnapToElements] = useState(true)
  const [snapThreshold] = useState(15) // pixels for magnetic snap
  const [backgroundColor, setBackgroundColor] = useState('#ffffff')
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null)
  
  // Tool state
  const [activeTool, setActiveTool] = useState<'select' | 'pan' | 'room' | 'wall' | 'text' | 'shape' | 'icon' | 'hallway' | 'stair' | 'elevator' | 'entrance' | 'restroom'>('select')
  const [activeShape, setActiveShape] = useState<'rectangle' | 'circle' | 'triangle' | 'line'>('rectangle')
  const [activeIcon, setActiveIcon] = useState<string>('door')
  const [drawColor, setDrawColor] = useState('#3B82F6')
  const [borderColor, setBorderColor] = useState('#1E40AF')
  const [fontSize, setFontSize] = useState(14)
  
  // Drag state
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dragElement, setDragElement] = useState<CanvasElement | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 })
  
  // Data state
  const [buildings, setBuildings] = useState<Building[]>([])
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null)
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([])
  const [currentFloorPlan, setCurrentFloorPlan] = useState<FloorPlan | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [roomSearch, setRoomSearch] = useState('')
  const [filteredRooms, setFilteredRooms] = useState<Room[]>([])
  
  // UI state
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showBuildingModal, setShowBuildingModal] = useState(false)
  const [showFloorModal, setShowFloorModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null)
  
  // History for undo/redo
  const [history, setHistory] = useState<CanvasElement[][]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  
  // New building/floor form
  const [newBuilding, setNewBuilding] = useState({ name: '', code: '', campus: '', total_floors: 1 })
  const [newFloor, setNewFloor] = useState({ floor_number: 1, floor_name: '' })
  
  // Share state
  const [shareLink, setShareLink] = useState('')
  const [shareSettings, setShareSettings] = useState({ expires_in_days: 7, password: '' })
  
  // Clipboard state for copy/paste
  const [clipboard, setClipboard] = useState<CanvasElement | null>(null)
  
  // Export state
  const [showExportModal, setShowExportModal] = useState(false)
  const [exporting, setExporting] = useState(false)

  const toggleSidebar = () => setSidebarOpen(prev => !prev)
  
  // Handle menubar toggle callback
  const handleMenuBarToggle = (isHidden: boolean) => {
    setIsMenuBarHidden(isHidden)
  }
  
  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }
  
  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Show notification
  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 3000)
  }

  // Fetch buildings on mount
  useEffect(() => {
    fetchBuildings()
    fetchRooms()
  }, [])

  // Filter rooms based on search
  useEffect(() => {
    if (roomSearch) {
      setFilteredRooms(rooms.filter(room => 
        room.name.toLowerCase().includes(roomSearch.toLowerCase()) ||
        room.building?.toLowerCase().includes(roomSearch.toLowerCase())
      ))
    } else {
      setFilteredRooms(rooms)
    }
  }, [roomSearch, rooms])

  // Add to history when elements change
  useEffect(() => {
    if (elements.length > 0 || history.length === 0) {
      const newHistory = history.slice(0, historyIndex + 1)
      newHistory.push([...elements])
      setHistory(newHistory)
      setHistoryIndex(newHistory.length - 1)
    }
  }, [elements.length])

  const fetchBuildings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/floor-plans')
      const result = await response.json()
      
      if (result.success) {
        setBuildings(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching buildings:', error)
      showNotification('error', 'Failed to fetch buildings')
    } finally {
      setLoading(false)
    }
  }

  const fetchRooms = async (building?: string) => {
    try {
      const params = new URLSearchParams()
      if (building) params.append('building', building)
      
      const response = await fetch(`/api/floor-plans/rooms?${params}`)
      const result = await response.json()
      
      if (result.success) {
        setRooms(result.data.rooms || [])
      }
    } catch (error) {
      console.error('Error fetching rooms:', error)
    }
  }

  const fetchFloorPlan = async (floorPlanId: number) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/floor-plans?floorPlanId=${floorPlanId}&includeElements=true`)
      const result = await response.json()
      
      if (result.success) {
        const plan = result.data
        setCurrentFloorPlan(plan)
        setCanvasSize({ width: plan.canvas_width, height: plan.canvas_height })
        setGridSize(plan.grid_size || 20)
        setBackgroundColor(plan.background_color || '#ffffff')
        setBackgroundImage(plan.background_image_url || null)
        
        // Convert elements from DB format
        if (plan.elements && plan.elements.length > 0) {
          const convertedElements = plan.elements.map((elem: any) => ({
            id: elem.element_id || `elem-${elem.id}`,
            type: elem.element_type,
            x: elem.x,
            y: elem.y,
            width: elem.width,
            height: elem.height,
            rotation: elem.rotation || 0,
            zIndex: elem.z_index || 0,
            label: elem.label,
            color: elem.color,
            borderColor: elem.border_color,
            fontSize: elem.font_size,
            linkedRoomId: elem.linked_room_id,
            isLocked: elem.is_locked,
            isVisible: elem.is_visible,
            properties: elem.properties || {}
          }))
          setElements(convertedElements)
        } else if (plan.canvas_data?.elements) {
          setElements(plan.canvas_data.elements)
        } else {
          setElements([])
        }
      }
    } catch (error) {
      console.error('Error fetching floor plan:', error)
      showNotification('error', 'Failed to load floor plan')
    } finally {
      setLoading(false)
    }
  }

  const saveFloorPlan = async () => {
    if (!currentFloorPlan) {
      showNotification('error', 'No floor plan selected')
      return
    }

    try {
      setSaving(true)
      
      // Save floor plan data
      const response = await fetch('/api/floor-plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'floor_plan',
          id: currentFloorPlan.id,
          data: {
            building_id: currentFloorPlan.building_id,
            canvas_data: { elements },
            canvas_width: canvasSize.width,
            canvas_height: canvasSize.height,
            grid_size: gridSize,
            background_color: backgroundColor,
            background_image_url: backgroundImage,
            is_default_view: currentFloorPlan.is_default_view,
            is_published: currentFloorPlan.is_published,
            status: currentFloorPlan.status
          }
        })
      })

      const result = await response.json()
      
      if (result.success) {
        // Save elements separately
        await fetch('/api/floor-plans', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'elements',
            id: currentFloorPlan.id,
            data: { elements }
          })
        })
        
        showNotification('success', 'Floor plan saved successfully!')
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error saving floor plan:', error)
      showNotification('error', 'Failed to save floor plan')
    } finally {
      setSaving(false)
    }
  }

  // Export functions
  const exportAsImage = async (format: 'png' | 'jpeg' = 'png') => {
    if (!canvasRef.current) return
    
    try {
      setExporting(true)
      
      // Use html2canvas to capture the canvas
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(canvasRef.current, {
        backgroundColor: backgroundColor,
        scale: 2,
        useCORS: true
      })
      
      const link = document.createElement('a')
      link.download = `${selectedBuilding?.name || 'floor-plan'}-floor-${currentFloorPlan?.floor_number || 1}.${format}`
      link.href = canvas.toDataURL(`image/${format}`, 0.9)
      link.click()
      
      showNotification('success', `Floor plan exported as ${format.toUpperCase()}!`)
    } catch (error) {
      console.error('Error exporting image:', error)
      showNotification('error', 'Failed to export image. Try installing html2canvas: npm install html2canvas')
    } finally {
      setExporting(false)
    }
  }

  const exportAsPDF = async (size: 'a4' | 'letter' = 'a4') => {
    if (!canvasRef.current) return
    
    try {
      setExporting(true)
      
      // Use html2canvas and jspdf
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')
      
      const canvas = await html2canvas(canvasRef.current, {
        backgroundColor: backgroundColor,
        scale: 2,
        useCORS: true
      })
      
      const imgData = canvas.toDataURL('image/png')
      
      // Calculate dimensions
      const pageWidth = size === 'a4' ? 210 : 216 // mm
      const pageHeight = size === 'a4' ? 297 : 279 // mm
      
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'mm',
        format: size
      })
      
      const imgWidth = pdf.internal.pageSize.getWidth() - 20
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      
      // Add title
      pdf.setFontSize(16)
      pdf.text(`${selectedBuilding?.name || 'Building'} - Floor ${currentFloorPlan?.floor_number || 1}`, 10, 15)
      
      // Add image
      pdf.addImage(imgData, 'PNG', 10, 25, imgWidth, Math.min(imgHeight, pdf.internal.pageSize.getHeight() - 35))
      
      pdf.save(`${selectedBuilding?.name || 'floor-plan'}-floor-${currentFloorPlan?.floor_number || 1}.pdf`)
      
      showNotification('success', 'Floor plan exported as PDF!')
    } catch (error) {
      console.error('Error exporting PDF:', error)
      showNotification('error', 'Failed to export PDF. Try installing jspdf: npm install jspdf')
    } finally {
      setExporting(false)
    }
  }

  const openWebView = () => {
    if (!currentFloorPlan || !shareLink) {
      showNotification('info', 'Please generate a share link first to view in browser')
      setShowShareModal(true)
      return
    }
    window.open(shareLink, '_blank')
  }

  const createBuilding = async () => {
    if (!newBuilding.name) {
      showNotification('error', 'Building name is required')
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/floor-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'building',
          data: newBuilding
        })
      })

      const result = await response.json()
      
      if (result.success) {
        showNotification('success', 'Building created successfully!')
        setShowBuildingModal(false)
        setNewBuilding({ name: '', code: '', campus: '', total_floors: 1 })
        fetchBuildings()
      } else {
        // Show specific error message from API
        if (result.needsSetup) {
          showNotification('error', 'Database tables not set up. Run floor_plans_schema.sql in Supabase first.')
        } else {
          showNotification('error', result.error || 'Failed to create building')
        }
      }
    } catch (error: any) {
      console.error('Error creating building:', error)
      showNotification('error', error.message || 'Failed to create building')
    } finally {
      setLoading(false)
    }
  }

  const createFloorPlan = async () => {
    if (!selectedBuilding) {
      showNotification('error', 'Please select a building first')
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/floor-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'floor_plan',
          data: {
            building_id: selectedBuilding.id,
            floor_number: newFloor.floor_number,
            floor_name: newFloor.floor_name || `Floor ${newFloor.floor_number}`,
            canvas_width: canvasSize.width,
            canvas_height: canvasSize.height,
            grid_size: gridSize,
            background_color: backgroundColor
          }
        })
      })

      const result = await response.json()
      
      if (result.success) {
        showNotification('success', 'Floor plan created successfully!')
        setShowFloorModal(false)
        setNewFloor({ floor_number: 1, floor_name: '' })
        fetchBuildings()
        fetchFloorPlan(result.data.id)
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error creating floor plan:', error)
      showNotification('error', 'Failed to create floor plan')
    } finally {
      setLoading(false)
    }
  }

  const createShareLink = async () => {
    if (!currentFloorPlan) return

    try {
      const response = await fetch('/api/floor-plans/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          floor_plan_id: currentFloorPlan.id,
          share_name: `${selectedBuilding?.name || 'Building'} - Floor ${currentFloorPlan.floor_number}`,
          expires_in_days: shareSettings.expires_in_days,
          password: shareSettings.password || undefined
        })
      })

      const result = await response.json()
      
      if (result.success) {
        setShareLink(result.data.share_url)
        showNotification('success', 'Share link created!')
      }
    } catch (error) {
      console.error('Error creating share link:', error)
      showNotification('error', 'Failed to create share link')
    }
  }

  // Canvas interaction handlers
  const getCanvasCoordinates = (e: React.MouseEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 }
    
    const rect = canvasRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left - panOffset.x) / zoom
    const y = (e.clientY - rect.top - panOffset.y) / zoom
    
    if (snapToGrid) {
      return {
        x: Math.round(x / gridSize) * gridSize,
        y: Math.round(y / gridSize) * gridSize
      }
    }
    
    return { x, y }
  }

  // Find nearest snap point to other elements (magnetic snap)
  const findSnapPoints = (element: CanvasElement, newX: number, newY: number) => {
    if (!snapToElements) return { x: newX, y: newY, snappedEdges: { left: false, right: false, top: false, bottom: false } }
    
    let snapX = newX
    let snapY = newY
    const snappedEdges = { left: false, right: false, top: false, bottom: false }
    
    // Check against all other elements
    for (const other of elements) {
      if (other.id === element.id) continue
      if (other.isVisible === false) continue
      
      // Element edges
      const elemLeft = newX
      const elemRight = newX + element.width
      const elemTop = newY
      const elemBottom = newY + element.height
      
      // Other element edges
      const otherLeft = other.x
      const otherRight = other.x + other.width
      const otherTop = other.y
      const otherBottom = other.y + other.height
      
      // Check horizontal alignment (left-to-right or left-to-left)
      if (Math.abs(elemRight - otherLeft) < snapThreshold) {
        snapX = otherLeft - element.width
        snappedEdges.right = true
      } else if (Math.abs(elemLeft - otherRight) < snapThreshold) {
        snapX = otherRight
        snappedEdges.left = true
      } else if (Math.abs(elemLeft - otherLeft) < snapThreshold) {
        snapX = otherLeft
        snappedEdges.left = true
      } else if (Math.abs(elemRight - otherRight) < snapThreshold) {
        snapX = otherRight - element.width
        snappedEdges.right = true
      }
      
      // Check vertical alignment (top-to-bottom or top-to-top)
      if (Math.abs(elemBottom - otherTop) < snapThreshold) {
        snapY = otherTop - element.height
        snappedEdges.bottom = true
      } else if (Math.abs(elemTop - otherBottom) < snapThreshold) {
        snapY = otherBottom
        snappedEdges.top = true
      } else if (Math.abs(elemTop - otherTop) < snapThreshold) {
        snapY = otherTop
        snappedEdges.top = true
      } else if (Math.abs(elemBottom - otherBottom) < snapThreshold) {
        snapY = otherBottom - element.height
        snappedEdges.bottom = true
      }
    }
    
    return { x: snapX, y: snapY, snappedEdges }
  }

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const coords = getCanvasCoordinates(e)
    
    if (activeTool === 'pan') {
      setIsPanning(true)
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y })
      return
    }
    
    if (activeTool === 'select') {
      // Check if clicking on an element
      const clickedElement = elements.find(elem => 
        elem.isVisible !== false &&
        coords.x >= elem.x && coords.x <= elem.x + elem.width &&
        coords.y >= elem.y && coords.y <= elem.y + elem.height
      )
      
      if (clickedElement) {
        if (!clickedElement.isLocked) {
          setSelectedElement(clickedElement)
          setSelectedElements([clickedElement.id])
          setDragElement(clickedElement)
          setIsDragging(true)
          setDragStart({ x: coords.x - clickedElement.x, y: coords.y - clickedElement.y })
        }
      } else {
        setSelectedElement(null)
        setSelectedElements([])
      }
      return
    }
    
    // Drawing tools - including new floor plan elements
    if (['room', 'wall', 'shape', 'text', 'icon', 'hallway', 'stair', 'elevator', 'entrance', 'restroom'].includes(activeTool)) {
      setIsDrawing(true)
      setDrawStart(coords)
    }
  }

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
      return
    }
    
    if (isDragging && dragElement && !dragElement.isLocked) {
      const coords = getCanvasCoordinates(e)
      let newX = coords.x - dragStart.x
      let newY = coords.y - dragStart.y
      
      // Apply magnetic snapping to nearby elements
      const snapped = findSnapPoints(dragElement, newX, newY)
      newX = snapped.x
      newY = snapped.y
      
      setElements(prev => prev.map(elem => 
        elem.id === dragElement.id
          ? { ...elem, x: newX, y: newY }
          : elem
      ))
    }
    
    if (isResizing && selectedElement && resizeHandle) {
      const coords = getCanvasCoordinates(e)
      // Handle resize logic based on handle position
      handleResize(coords, resizeHandle)
    }
  }

  const handleCanvasMouseUp = (e: React.MouseEvent) => {
    if (isPanning) {
      setIsPanning(false)
      return
    }
    
    if (isDragging) {
      setIsDragging(false)
      setDragElement(null)
      return
    }
    
    if (isResizing) {
      setIsResizing(false)
      setResizeHandle(null)
      return
    }
    
    if (isDrawing) {
      const coords = getCanvasCoordinates(e)
      const width = Math.max(Math.abs(coords.x - drawStart.x), 40)
      const height = Math.max(Math.abs(coords.y - drawStart.y), 40)
      const x = Math.min(coords.x, drawStart.x)
      const y = Math.min(coords.y, drawStart.y)
      
      createNewElement(x, y, width, height)
      setIsDrawing(false)
    }
  }

  const createNewElement = (x: number, y: number, width: number, height: number) => {
    const newElement: CanvasElement = {
      id: `elem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: activeTool as any,
      x,
      y,
      width: activeTool === 'text' ? 150 : width,
      height: activeTool === 'text' ? 40 : height,
      rotation: 0,
      zIndex: elements.length,
      color: drawColor,
      borderColor: borderColor,
      fontSize: fontSize,
      isVisible: true,
      isLocked: false
    }
    
    if (activeTool === 'shape') {
      newElement.shapeType = activeShape
    }
    
    if (activeTool === 'icon') {
      newElement.icon = activeIcon
      newElement.width = 40
      newElement.height = 40
    }
    
    if (activeTool === 'text') {
      newElement.label = 'Double-click to edit'
      newElement.textAlign = 'center'
    }
    
    if (activeTool === 'room') {
      newElement.label = 'Room'
      newElement.properties = { capacity: 30 }
    }
    
    // New floor plan element types
    if (activeTool === 'hallway') {
      newElement.label = 'Hallway'
      newElement.color = '#D1D5DB'
      newElement.borderColor = '#9CA3AF'
      newElement.height = Math.max(height, 60)
    }
    
    if (activeTool === 'stair') {
      newElement.label = 'Stairs'
      newElement.color = '#FEF3C7'
      newElement.borderColor = '#F59E0B'
      newElement.width = Math.max(width, 80)
      newElement.height = Math.max(height, 100)
      newElement.icon = 'stairs'
    }
    
    if (activeTool === 'elevator') {
      newElement.label = 'Elevator'
      newElement.color = '#DBEAFE'
      newElement.borderColor = '#3B82F6'
      newElement.width = Math.max(width, 60)
      newElement.height = Math.max(height, 60)
      newElement.icon = 'elevator'
    }
    
    if (activeTool === 'entrance') {
      newElement.label = 'Entrance'
      newElement.color = '#D1FAE5'
      newElement.borderColor = '#10B981'
      newElement.width = Math.max(width, 100)
      newElement.height = Math.max(height, 40)
      newElement.icon = 'door'
    }
    
    if (activeTool === 'restroom') {
      newElement.label = 'Restroom'
      newElement.color = '#E0E7FF'
      newElement.borderColor = '#6366F1'
      newElement.width = Math.max(width, 60)
      newElement.height = Math.max(height, 60)
      newElement.icon = 'users'
    }
    
    setElements(prev => [...prev, newElement])
    setSelectedElement(newElement)
    setSelectedElements([newElement.id])
  }

  const handleResize = (coords: { x: number, y: number }, handle: string) => {
    if (!selectedElement) return
    
    setElements(prev => prev.map(elem => {
      if (elem.id !== selectedElement.id) return elem
      
      let newX = elem.x
      let newY = elem.y
      let newWidth = elem.width
      let newHeight = elem.height
      
      switch (handle) {
        case 'se':
          newWidth = Math.max(20, coords.x - elem.x)
          newHeight = Math.max(20, coords.y - elem.y)
          break
        case 'sw':
          newWidth = Math.max(20, elem.x + elem.width - coords.x)
          newX = coords.x
          newHeight = Math.max(20, coords.y - elem.y)
          break
        case 'ne':
          newWidth = Math.max(20, coords.x - elem.x)
          newHeight = Math.max(20, elem.y + elem.height - coords.y)
          newY = coords.y
          break
        case 'nw':
          newWidth = Math.max(20, elem.x + elem.width - coords.x)
          newHeight = Math.max(20, elem.y + elem.height - coords.y)
          newX = coords.x
          newY = coords.y
          break
      }
      
      return { ...elem, x: newX, y: newY, width: newWidth, height: newHeight }
    }))
  }

  // Handle dropping room from the list
  const handleRoomDrop = (e: React.DragEvent, room: Room) => {
    e.preventDefault()
    const coords = getCanvasCoordinates(e as any)
    
    const newElement: CanvasElement = {
      id: `room-${room.id}-${Date.now()}`,
      type: 'room',
      x: coords.x,
      y: coords.y,
      width: 120,
      height: 80,
      rotation: 0,
      zIndex: elements.length,
      label: room.name,
      color: drawColor,
      borderColor: borderColor,
      linkedRoomId: room.id,
      linkedRoomData: room,
      isVisible: true,
      isLocked: false,
      properties: {
        capacity: room.capacity,
        roomType: room.roomType,
        hasAC: room.hasAC,
        hasProjector: room.hasProjector,
        isPWDAccessible: room.isPWDAccessible
      }
    }
    
    setElements(prev => [...prev, newElement])
    setSelectedElement(newElement)
  }

  // Element manipulation functions
  const deleteSelected = () => {
    if (selectedElements.length > 0) {
      setElements(prev => prev.filter(elem => !selectedElements.includes(elem.id)))
      setSelectedElement(null)
      setSelectedElements([])
    }
  }

  const duplicateSelected = () => {
    if (selectedElement) {
      const duplicate: CanvasElement = {
        ...selectedElement,
        id: `elem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        x: selectedElement.x + 20,
        y: selectedElement.y + 20,
        zIndex: elements.length
      }
      setElements(prev => [...prev, duplicate])
      setSelectedElement(duplicate)
      setSelectedElements([duplicate.id])
    }
  }

  const updateSelectedElement = (updates: Partial<CanvasElement>) => {
    if (!selectedElement) return
    
    setElements(prev => prev.map(elem => 
      elem.id === selectedElement.id
        ? { ...elem, ...updates }
        : elem
    ))
    setSelectedElement(prev => prev ? { ...prev, ...updates } : null)
  }

  const bringToFront = () => {
    if (selectedElement) {
      const maxZ = Math.max(...elements.map(e => e.zIndex))
      updateSelectedElement({ zIndex: maxZ + 1 })
    }
  }

  const sendToBack = () => {
    if (selectedElement) {
      const minZ = Math.min(...elements.map(e => e.zIndex))
      updateSelectedElement({ zIndex: minZ - 1 })
    }
  }

  // Copy element to clipboard
  const copyElement = () => {
    if (selectedElement) {
      setClipboard({ ...selectedElement })
      showNotification('info', 'Element copied to clipboard')
    }
  }

  // Paste element from clipboard
  const pasteElement = () => {
    if (clipboard) {
      const newElement: CanvasElement = {
        ...clipboard,
        id: `elem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        x: clipboard.x + 30,
        y: clipboard.y + 30,
        zIndex: elements.length
      }
      setElements(prev => [...prev, newElement])
      setSelectedElement(newElement)
      setSelectedElements([newElement.id])
      showNotification('success', 'Element pasted')
    }
  }

  // Duplicate element (alias for copy then paste in place)
  const duplicateElement = () => {
    if (selectedElement) {
      const duplicate: CanvasElement = {
        ...selectedElement,
        id: `elem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        x: selectedElement.x + 20,
        y: selectedElement.y + 20,
        zIndex: elements.length
      }
      setElements(prev => [...prev, duplicate])
      setSelectedElement(duplicate)
      setSelectedElements([duplicate.id])
      showNotification('success', 'Element duplicated')
    }
  }

  // Delete selected element
  const deleteSelectedElement = () => {
    if (selectedElement) {
      setElements(prev => prev.filter(elem => elem.id !== selectedElement.id))
      setSelectedElement(null)
      setSelectedElements([])
      showNotification('info', 'Element deleted')
    }
  }

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1)
      setElements(history[historyIndex - 1])
    }
  }

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1)
      setElements(history[historyIndex + 1])
    }
  }

  // Zoom controls
  const handleZoom = (delta: number) => {
    setZoom(prev => Math.min(Math.max(prev + delta, 0.25), 3))
  }

  const resetView = () => {
    setZoom(1)
    setPanOffset({ x: 0, y: 0 })
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected()
      }
      if (e.ctrlKey && e.key === 'c') {
        // Copy
      }
      if (e.ctrlKey && e.key === 'v') {
        duplicateSelected()
      }
      if (e.ctrlKey && e.key === 'z') {
        undo()
      }
      if (e.ctrlKey && e.key === 'y') {
        redo()
      }
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        saveFloorPlan()
      }
      if (e.key === 'Escape') {
        setSelectedElement(null)
        setSelectedElements([])
        setActiveTool('select')
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedElement, elements, historyIndex])

  // Render element on canvas
  const renderElement = (element: CanvasElement) => {
    if (element.isVisible === false) return null
    
    const isSelected = selectedElements.includes(element.id)
    const style: React.CSSProperties = {
      position: 'absolute',
      left: element.x,
      top: element.y,
      width: element.width,
      height: element.height,
      transform: `rotate(${element.rotation}deg)`,
      zIndex: element.zIndex,
      opacity: element.opacity ?? 1,
      cursor: element.isLocked ? 'not-allowed' : 'move',
      outline: isSelected ? '2px solid var(--primary-color)' : 'none',
      outlineOffset: '2px'
    }
    
    switch (element.type) {
      case 'room':
        return (
          <div
            key={element.id}
            className={styles.canvasElement}
            style={{
              ...style,
              backgroundColor: element.color || '#E3F2FD',
              border: `${element.borderWidth || 2}px ${element.borderStyle || 'solid'} ${element.borderColor || '#1976D2'}`,
              borderRadius: '4px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px'
            }}
            onClick={(e) => {
              e.stopPropagation()
              if (!element.isLocked) {
                setSelectedElement(element)
                setSelectedElements([element.id])
              }
            }}
            onDoubleClick={() => {
              // Edit label
              const newLabel = prompt('Enter room label:', element.label)
              if (newLabel !== null) {
                updateSelectedElement({ label: newLabel })
              }
            }}
          >
            <span style={{ 
              fontSize: element.fontSize || 12, 
              fontWeight: 'bold',
              textAlign: 'center',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              width: '100%',
              color: '#333'
            }}>
              {element.label}
            </span>
            {element.linkedRoomData && (
              <span style={{ fontSize: 10, color: '#666' }}>
                Cap: {element.linkedRoomData.capacity}
              </span>
            )}
            {isSelected && !element.isLocked && (
              <>
                <div className={`${styles.resizeHandle} ${styles.nw}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('nw') }} />
                <div className={`${styles.resizeHandle} ${styles.ne}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('ne') }} />
                <div className={`${styles.resizeHandle} ${styles.sw}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('sw') }} />
                <div className={`${styles.resizeHandle} ${styles.se}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('se') }} />
              </>
            )}
          </div>
        )
      
      case 'wall':
        return (
          <div
            key={element.id}
            className={styles.canvasElement}
            style={{
              ...style,
              backgroundColor: element.color || '#424242',
              border: 'none'
            }}
            onClick={(e) => {
              e.stopPropagation()
              if (!element.isLocked) {
                setSelectedElement(element)
                setSelectedElements([element.id])
              }
            }}
          >
            {isSelected && !element.isLocked && (
              <>
                <div className={`${styles.resizeHandle} ${styles.nw}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('nw') }} />
                <div className={`${styles.resizeHandle} ${styles.ne}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('ne') }} />
                <div className={`${styles.resizeHandle} ${styles.sw}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('sw') }} />
                <div className={`${styles.resizeHandle} ${styles.se}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('se') }} />
              </>
            )}
          </div>
        )
      
      case 'text':
        return (
          <div
            key={element.id}
            className={styles.canvasElement}
            style={{
              ...style,
              display: 'flex',
              alignItems: 'center',
              justifyContent: element.textAlign || 'center',
              padding: '4px 8px',
              backgroundColor: 'transparent'
            }}
            onClick={(e) => {
              e.stopPropagation()
              if (!element.isLocked) {
                setSelectedElement(element)
                setSelectedElements([element.id])
              }
            }}
            onDoubleClick={() => {
              const newLabel = prompt('Enter text:', element.label)
              if (newLabel !== null) {
                updateSelectedElement({ label: newLabel })
              }
            }}
          >
            <span style={{
              fontSize: element.fontSize || 14,
              fontWeight: element.fontWeight || 'normal',
              color: element.color || '#333',
              textAlign: element.textAlign || 'center',
              width: '100%'
            }}>
              {element.label}
            </span>
            {isSelected && !element.isLocked && (
              <>
                <div className={`${styles.resizeHandle} ${styles.nw}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('nw') }} />
                <div className={`${styles.resizeHandle} ${styles.ne}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('ne') }} />
                <div className={`${styles.resizeHandle} ${styles.sw}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('sw') }} />
                <div className={`${styles.resizeHandle} ${styles.se}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('se') }} />
              </>
            )}
          </div>
        )
      
      case 'shape':
        return (
          <div
            key={element.id}
            className={styles.canvasElement}
            style={{
              ...style,
              backgroundColor: element.shapeType === 'circle' ? element.color : element.color,
              border: `${element.borderWidth || 2}px ${element.borderStyle || 'solid'} ${element.borderColor || '#333'}`,
              borderRadius: element.shapeType === 'circle' ? '50%' : '4px'
            }}
            onClick={(e) => {
              e.stopPropagation()
              if (!element.isLocked) {
                setSelectedElement(element)
                setSelectedElements([element.id])
              }
            }}
          >
            {isSelected && !element.isLocked && (
              <>
                <div className={`${styles.resizeHandle} ${styles.nw}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('nw') }} />
                <div className={`${styles.resizeHandle} ${styles.ne}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('ne') }} />
                <div className={`${styles.resizeHandle} ${styles.sw}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('sw') }} />
                <div className={`${styles.resizeHandle} ${styles.se}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('se') }} />
              </>
            )}
          </div>
        )
      
      case 'icon':
        const IconComponent = ICONS[element.icon as keyof typeof ICONS] || Info
        return (
          <div
            key={element.id}
            className={styles.canvasElement}
            style={{
              ...style,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent'
            }}
            onClick={(e) => {
              e.stopPropagation()
              if (!element.isLocked) {
                setSelectedElement(element)
                setSelectedElements([element.id])
              }
            }}
          >
            <IconComponent 
              size={Math.min(element.width, element.height) * 0.8} 
              color={element.color || '#333'} 
            />
          </div>
        )
      
      case 'hallway':
        return (
          <div
            key={element.id}
            className={styles.canvasElement}
            style={{
              ...style,
              backgroundColor: element.color || '#D1D5DB',
              border: `2px dashed ${element.borderColor || '#9CA3AF'}`,
              borderRadius: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={(e) => {
              e.stopPropagation()
              if (!element.isLocked) {
                setSelectedElement(element)
                setSelectedElements([element.id])
              }
            }}
            onDoubleClick={() => {
              const newLabel = prompt('Enter hallway label:', element.label)
              if (newLabel !== null) {
                updateSelectedElement({ label: newLabel })
              }
            }}
          >
            <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>
              {element.label || 'Hallway'}
            </span>
            {isSelected && !element.isLocked && (
              <>
                <div className={`${styles.resizeHandle} ${styles.nw}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('nw') }} />
                <div className={`${styles.resizeHandle} ${styles.ne}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('ne') }} />
                <div className={`${styles.resizeHandle} ${styles.sw}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('sw') }} />
                <div className={`${styles.resizeHandle} ${styles.se}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('se') }} />
              </>
            )}
          </div>
        )
      
      case 'stair':
        return (
          <div
            key={element.id}
            className={styles.canvasElement}
            style={{
              ...style,
              backgroundColor: element.color || '#FEF3C7',
              border: `2px solid ${element.borderColor || '#F59E0B'}`,
              borderRadius: '4px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 8px, rgba(245,158,11,0.2) 8px, rgba(245,158,11,0.2) 10px)'
            }}
            onClick={(e) => {
              e.stopPropagation()
              if (!element.isLocked) {
                setSelectedElement(element)
                setSelectedElements([element.id])
              }
            }}
          >
            <ArrowUpDown size={20} color="#F59E0B" />
            <span style={{ fontSize: 10, color: '#92400E', fontWeight: 600 }}>
              {element.label || 'Stairs'}
            </span>
            {isSelected && !element.isLocked && (
              <>
                <div className={`${styles.resizeHandle} ${styles.nw}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('nw') }} />
                <div className={`${styles.resizeHandle} ${styles.ne}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('ne') }} />
                <div className={`${styles.resizeHandle} ${styles.sw}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('sw') }} />
                <div className={`${styles.resizeHandle} ${styles.se}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('se') }} />
              </>
            )}
          </div>
        )
      
      case 'elevator':
        return (
          <div
            key={element.id}
            className={styles.canvasElement}
            style={{
              ...style,
              backgroundColor: element.color || '#DBEAFE',
              border: `2px solid ${element.borderColor || '#3B82F6'}`,
              borderRadius: '4px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
            onClick={(e) => {
              e.stopPropagation()
              if (!element.isLocked) {
                setSelectedElement(element)
                setSelectedElements([element.id])
              }
            }}
          >
            <Building size={20} color="#3B82F6" />
            <span style={{ fontSize: 10, color: '#1E40AF', fontWeight: 600 }}>
              {element.label || 'Elevator'}
            </span>
            {isSelected && !element.isLocked && (
              <>
                <div className={`${styles.resizeHandle} ${styles.nw}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('nw') }} />
                <div className={`${styles.resizeHandle} ${styles.ne}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('ne') }} />
                <div className={`${styles.resizeHandle} ${styles.sw}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('sw') }} />
                <div className={`${styles.resizeHandle} ${styles.se}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('se') }} />
              </>
            )}
          </div>
        )
      
      case 'entrance':
        return (
          <div
            key={element.id}
            className={styles.canvasElement}
            style={{
              ...style,
              backgroundColor: element.color || '#D1FAE5',
              border: `2px solid ${element.borderColor || '#10B981'}`,
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
            onClick={(e) => {
              e.stopPropagation()
              if (!element.isLocked) {
                setSelectedElement(element)
                setSelectedElements([element.id])
              }
            }}
            onDoubleClick={() => {
              const newLabel = prompt('Enter entrance label:', element.label)
              if (newLabel !== null) {
                updateSelectedElement({ label: newLabel })
              }
            }}
          >
            <DoorOpen size={18} color="#10B981" />
            <span style={{ fontSize: 11, color: '#065F46', fontWeight: 600 }}>
              {element.label || 'Entrance'}
            </span>
            {isSelected && !element.isLocked && (
              <>
                <div className={`${styles.resizeHandle} ${styles.nw}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('nw') }} />
                <div className={`${styles.resizeHandle} ${styles.ne}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('ne') }} />
                <div className={`${styles.resizeHandle} ${styles.sw}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('sw') }} />
                <div className={`${styles.resizeHandle} ${styles.se}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('se') }} />
              </>
            )}
          </div>
        )
      
      case 'restroom':
        return (
          <div
            key={element.id}
            className={styles.canvasElement}
            style={{
              ...style,
              backgroundColor: element.color || '#E0E7FF',
              border: `2px solid ${element.borderColor || '#6366F1'}`,
              borderRadius: '4px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
            onClick={(e) => {
              e.stopPropagation()
              if (!element.isLocked) {
                setSelectedElement(element)
                setSelectedElements([element.id])
              }
            }}
            onDoubleClick={() => {
              const newLabel = prompt('Enter restroom label:', element.label)
              if (newLabel !== null) {
                updateSelectedElement({ label: newLabel })
              }
            }}
          >
            <Users size={18} color="#6366F1" />
            <span style={{ fontSize: 10, color: '#3730A3', fontWeight: 600 }}>
              {element.label || 'Restroom'}
            </span>
            {isSelected && !element.isLocked && (
              <>
                <div className={`${styles.resizeHandle} ${styles.nw}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('nw') }} />
                <div className={`${styles.resizeHandle} ${styles.ne}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('ne') }} />
                <div className={`${styles.resizeHandle} ${styles.sw}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('sw') }} />
                <div className={`${styles.resizeHandle} ${styles.se}`} onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeHandle('se') }} />
              </>
            )}
          </div>
        )
      
      default:
        return null
    }
  }

  return (
    <div ref={containerRef} className={`${styles.pageContainer} ${isFullscreen ? styles.fullscreen : ''}`}>
      <MenuBar 
        onToggleSidebar={toggleSidebar}
        showSidebarToggle={true}
        showAccountIcon={true}
        onMenuBarToggle={handleMenuBarToggle}
        setSidebarOpen={setSidebarOpen}
      />
      <Sidebar isOpen={sidebarOpen} />
      
      <main className={`${styles.mainContent} ${sidebarOpen ? styles.withSidebar : ''} ${isMenuBarHidden ? styles.menuHidden : ''} ${isFullscreen ? styles.fullscreen : ''}`}>
        {/* Notification */}
        {notification && (
          <div className={`${styles.notification} ${styles[notification.type]}`}>
            {notification.type === 'success' && <Check size={18} />}
            {notification.type === 'error' && <AlertTriangle size={18} />}
            {notification.type === 'info' && <Info size={18} />}
            <span>{notification.message}</span>
          </div>
        )}

        {/* Top Toolbar */}
        <div className={styles.topToolbar}>
          <div className={styles.toolbarLeft}>
            <button 
              className={styles.toolbarButton}
              onClick={() => setLeftPanelOpen(!leftPanelOpen)}
              title="Toggle Buildings Panel"
            >
              {leftPanelOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
            </button>
            
            <div className={styles.toolbarDivider} />
            
            <button 
              className={`${styles.toolbarButton} ${activeTool === 'select' ? styles.active : ''}`}
              onClick={() => setActiveTool('select')}
              title="Select (V)"
            >
              <MousePointer size={18} />
            </button>
            <button 
              className={`${styles.toolbarButton} ${activeTool === 'pan' ? styles.active : ''}`}
              onClick={() => setActiveTool('pan')}
              title="Pan (H)"
            >
              <Move size={18} />
            </button>
            
            <div className={styles.toolbarDivider} />
            
            <button 
              className={`${styles.toolbarButton} ${activeTool === 'room' ? styles.active : ''}`}
              onClick={() => setActiveTool('room')}
              title="Draw Room (R)"
            >
              <Square size={18} />
              <span className={styles.toolLabel}>Room</span>
            </button>
            <button 
              className={`${styles.toolbarButton} ${activeTool === 'wall' ? styles.active : ''}`}
              onClick={() => setActiveTool('wall')}
              title="Draw Wall (W)"
            >
              <Grip size={18} />
              <span className={styles.toolLabel}>Wall</span>
            </button>
            <button 
              className={`${styles.toolbarButton} ${activeTool === 'text' ? styles.active : ''}`}
              onClick={() => setActiveTool('text')}
              title="Add Text (T)"
            >
              <Type size={18} />
              <span className={styles.toolLabel}>Text</span>
            </button>
            <button 
              className={`${styles.toolbarButton} ${activeTool === 'shape' ? styles.active : ''}`}
              onClick={() => setActiveTool('shape')}
              title="Draw Shape (S)"
            >
              <Circle size={18} />
              <span className={styles.toolLabel}>Shape</span>
            </button>
            <button 
              className={`${styles.toolbarButton} ${activeTool === 'icon' ? styles.active : ''}`}
              onClick={() => setActiveTool('icon')}
              title="Add Icon (I)"
            >
              <DoorOpen size={18} />
              <span className={styles.toolLabel}>Icon</span>
            </button>
            
            <div className={styles.toolbarDivider} />
            
            {/* Floor Plan Elements */}
            <button 
              className={`${styles.toolbarButton} ${activeTool === 'hallway' ? styles.active : ''}`}
              onClick={() => setActiveTool('hallway')}
              title="Draw Hallway"
            >
              <Grip size={18} />
              <span className={styles.toolLabel}>Hallway</span>
            </button>
            <button 
              className={`${styles.toolbarButton} ${activeTool === 'stair' ? styles.active : ''}`}
              onClick={() => setActiveTool('stair')}
              title="Add Staircase"
            >
              <ArrowUpDown size={18} />
              <span className={styles.toolLabel}>Stairs</span>
            </button>
            <button 
              className={`${styles.toolbarButton} ${activeTool === 'elevator' ? styles.active : ''}`}
              onClick={() => setActiveTool('elevator')}
              title="Add Elevator"
            >
              <Building size={18} />
              <span className={styles.toolLabel}>Elevator</span>
            </button>
            <button 
              className={`${styles.toolbarButton} ${activeTool === 'entrance' ? styles.active : ''}`}
              onClick={() => setActiveTool('entrance')}
              title="Add Entrance/Exit"
            >
              <DoorOpen size={18} />
              <span className={styles.toolLabel}>Entrance</span>
            </button>
            <button 
              className={`${styles.toolbarButton} ${activeTool === 'restroom' ? styles.active : ''}`}
              onClick={() => setActiveTool('restroom')}
              title="Add Restroom"
            >
              <Users size={18} />
              <span className={styles.toolLabel}>Restroom</span>
            </button>
            
            <div className={styles.toolbarDivider} />
            
            <button 
              className={styles.toolbarButton}
              onClick={undo}
              disabled={historyIndex <= 0}
              title="Undo (Ctrl+Z)"
            >
              <Undo size={18} />
            </button>
            <button 
              className={styles.toolbarButton}
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              title="Redo (Ctrl+Y)"
            >
              <Redo size={18} />
            </button>
          </div>
          
          <div className={styles.toolbarCenter}>
            {currentFloorPlan && (
              <span className={styles.floorPlanTitle}>
                {selectedBuilding?.name} - {currentFloorPlan.floor_name || `Floor ${currentFloorPlan.floor_number}`}
              </span>
            )}
          </div>
          
          <div className={styles.toolbarRight}>
            <button 
              className={`${styles.toolbarButton} ${showGrid ? styles.active : ''}`}
              onClick={() => setShowGrid(!showGrid)}
              title="Toggle Grid"
            >
              <Grid size={18} />
            </button>
            <button 
              className={`${styles.toolbarButton} ${snapToGrid ? styles.active : ''}`}
              onClick={() => setSnapToGrid(!snapToGrid)}
              title="Snap to Grid"
            >
              <Maximize2 size={18} />
            </button>
            <button 
              className={`${styles.toolbarButton} ${snapToElements ? styles.active : ''}`}
              onClick={() => setSnapToElements(!snapToElements)}
              title="Magnetic Snap (Auto-connect)"
            >
              <Link size={18} />
            </button>
            
            <div className={styles.toolbarDivider} />
            
            <div className={styles.zoomControls}>
              <button onClick={() => handleZoom(-0.1)} title="Zoom Out">
                <ZoomOut size={16} />
              </button>
              <span className={styles.zoomLevel}>{Math.round(zoom * 100)}%</span>
              <button onClick={() => handleZoom(0.1)} title="Zoom In">
                <ZoomIn size={16} />
              </button>
              <button onClick={resetView} title="Reset View">
                <Maximize2 size={16} />
              </button>
            </div>
            
            <div className={styles.toolbarDivider} />
            
            <button 
              className={styles.fullscreenBtn}
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Fullscreen size={18} />}
            </button>
            
            <button 
              className={styles.toolbarButton}
              onClick={() => setShowSettingsModal(true)}
              title="Canvas Settings"
            >
              <Settings size={18} />
            </button>
            <button 
              className={`${styles.toolbarButton} ${styles.saveButton}`}
              onClick={saveFloorPlan}
              disabled={saving || !currentFloorPlan}
              title="Save (Ctrl+S)"
            >
              {saving ? <RefreshCw size={18} className={styles.spinning} /> : <Save size={18} />}
              <span>Save</span>
            </button>
            <button 
              className={styles.toolbarButton}
              onClick={() => setShowShareModal(true)}
              disabled={!currentFloorPlan}
              title="Share"
            >
              <Share2 size={18} />
            </button>
            <button 
              className={styles.toolbarButton}
              onClick={() => setShowExportModal(true)}
              disabled={!currentFloorPlan}
              title="Export"
            >
              <Download size={18} />
            </button>
            <button 
              className={styles.toolbarButton}
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              title="Toggle Properties Panel"
            >
              {rightPanelOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>
        </div>

        <div className={styles.editorContainer}>
          {/* Left Panel - Buildings & Rooms */}
          <div className={`${styles.leftPanel} ${leftPanelOpen ? styles.open : ''}`}>
            <div className={styles.panelSection}>
              <div className={styles.panelHeader}>
                <Building2 size={18} />
                <span>Buildings</span>
                <button 
                  className={styles.addButton}
                  onClick={() => setShowBuildingModal(true)}
                  title="Add Building"
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className={styles.buildingList}>
                {loading && <div className={styles.loading}>Loading...</div>}
                {buildings.map(building => (
                  <div 
                    key={building.id}
                    className={`${styles.buildingItem} ${selectedBuilding?.id === building.id ? styles.selected : ''}`}
                    onClick={() => {
                      setSelectedBuilding(building)
                      setFloorPlans(building.floor_plans || [])
                    }}
                  >
                    <Building2 size={16} />
                    <span>{building.name}</span>
                    <span className={styles.floorCount}>{building.floor_plans?.length || 0} floors</span>
                  </div>
                ))}
                {!loading && buildings.length === 0 && (
                  <div className={styles.emptyState}>
                    <p>No buildings yet</p>
                    <button onClick={() => setShowBuildingModal(true)}>
                      <Plus size={14} /> Add Building
                    </button>
                  </div>
                )}
              </div>
            </div>

            {selectedBuilding && (
              <div className={styles.panelSection}>
                <div className={styles.panelHeader}>
                  <Layers size={18} />
                  <span>Floors</span>
                  <button 
                    className={styles.addButton}
                    onClick={() => setShowFloorModal(true)}
                    title="Add Floor"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className={styles.floorList}>
                  {(selectedBuilding.floor_plans || []).map(floor => (
                    <div 
                      key={floor.id}
                      className={`${styles.floorItem} ${currentFloorPlan?.id === floor.id ? styles.selected : ''}`}
                      onClick={() => fetchFloorPlan(floor.id)}
                    >
                      <Layers size={14} />
                      <span>{floor.floor_name || `Floor ${floor.floor_number}`}</span>
                      {floor.is_default_view && <Eye size={12} title="Default View" />}
                      {floor.is_published && <ExternalLink size={12} title="Published" />}
                    </div>
                  ))}
                  {(selectedBuilding.floor_plans || []).length === 0 && (
                    <div className={styles.emptyState}>
                      <p>No floors yet</p>
                      <button onClick={() => setShowFloorModal(true)}>
                        <Plus size={14} /> Add Floor
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className={styles.panelSection}>
              <div className={styles.panelHeader}>
                <Map size={18} />
                <span>Rooms (Drag to Canvas)</span>
              </div>
              <div className={styles.searchBox}>
                <Search size={14} />
                <input
                  type="text"
                  placeholder="Search rooms..."
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                />
                {roomSearch && (
                  <button onClick={() => setRoomSearch('')}>
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className={styles.roomList}>
                {filteredRooms.slice(0, 50).map(room => (
                  <div
                    key={room.id}
                    className={styles.roomItem}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('room', JSON.stringify(room))
                    }}
                  >
                    <div className={styles.roomIcon}>
                      <Square size={14} />
                    </div>
                    <div className={styles.roomInfo}>
                      <span className={styles.roomName}>{room.name}</span>
                      <span className={styles.roomMeta}>
                        {room.building} • Cap: {room.capacity}
                      </span>
                    </div>
                    <Grip size={14} className={styles.dragHandle} />
                  </div>
                ))}
                {filteredRooms.length === 0 && (
                  <div className={styles.emptyState}>
                    <p>No rooms found</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Canvas Area */}
          <div 
            className={styles.canvasContainer}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const roomData = e.dataTransfer.getData('room')
              if (roomData) {
                const room = JSON.parse(roomData)
                handleRoomDrop(e, room)
              }
            }}
          >
            <div
              ref={canvasRef}
              className={styles.canvas}
              style={{
                width: canvasSize.width * zoom,
                height: canvasSize.height * zoom,
                transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
                backgroundColor: backgroundColor,
                backgroundImage: showGrid 
                  ? `linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px),
                     linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)`
                  : 'none',
                backgroundSize: showGrid ? `${gridSize * zoom}px ${gridSize * zoom}px` : 'auto',
                cursor: activeTool === 'pan' ? (isPanning ? 'grabbing' : 'grab') : 
                        activeTool === 'select' ? 'default' : 'crosshair'
              }}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={() => {
                setIsDragging(false)
                setIsPanning(false)
                setIsDrawing(false)
              }}
            >
              {/* Background Image */}
              {backgroundImage && (
                <img 
                  src={backgroundImage} 
                  alt="Floor plan background"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    opacity: 0.5,
                    pointerEvents: 'none'
                  }}
                />
              )}
              
              {/* Render elements */}
              <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
                {elements.map(renderElement)}
              </div>
              
              {/* Drawing preview */}
              {isDrawing && (
                <div
                  style={{
                    position: 'absolute',
                    left: Math.min(drawStart.x, getCanvasCoordinates({ clientX: 0, clientY: 0 } as any).x) * zoom,
                    top: Math.min(drawStart.y, getCanvasCoordinates({ clientX: 0, clientY: 0 } as any).y) * zoom,
                    width: Math.abs(getCanvasCoordinates({ clientX: 0, clientY: 0 } as any).x - drawStart.x) * zoom,
                    height: Math.abs(getCanvasCoordinates({ clientX: 0, clientY: 0 } as any).y - drawStart.y) * zoom,
                    border: '2px dashed var(--primary-color)',
                    backgroundColor: 'rgba(var(--primary-rgb), 0.1)',
                    pointerEvents: 'none'
                  }}
                />
              )}
            </div>
            
            {!currentFloorPlan && (
              <div className={styles.canvasPlaceholder}>
                <Map size={48} />
                <h3>No Floor Plan Selected</h3>
                <p>Select a building and floor from the left panel, or create a new one to get started.</p>
                <button onClick={() => setShowBuildingModal(true)}>
                  <Plus size={16} /> Create Building
                </button>
              </div>
            )}

            {/* Floating Action Bar - Shows when element is selected */}
            {selectedElement && (
              <div className={styles.floatingActionBar}>
                <div className={styles.elementInfo}>
                  <span>{selectedElement.type.toUpperCase()}</span>
                  {selectedElement.label && <span className={styles.elementLabel}>{selectedElement.label}</span>}
                </div>
                <div className={styles.divider} />
                <button 
                  className={styles.actionBtn}
                  onClick={copyElement}
                  title="Copy (Ctrl+C)"
                >
                  <Copy size={16} />
                  <span>Copy</span>
                </button>
                <button 
                  className={styles.actionBtn}
                  onClick={pasteElement}
                  disabled={!clipboard}
                  title="Paste (Ctrl+V)"
                >
                  <ClipboardPaste size={16} />
                  <span>Paste</span>
                </button>
                <button 
                  className={styles.actionBtn}
                  onClick={duplicateElement}
                  title="Duplicate (Ctrl+D)"
                >
                  <Files size={16} />
                  <span>Duplicate</span>
                </button>
                <div className={styles.divider} />
                <button 
                  className={styles.actionBtn}
                  onClick={bringToFront}
                  title="Bring to Front"
                >
                  <ArrowUp size={16} />
                  <span>Front</span>
                </button>
                <button 
                  className={styles.actionBtn}
                  onClick={sendToBack}
                  title="Send to Back"
                >
                  <ArrowDown size={16} />
                  <span>Back</span>
                </button>
                <div className={styles.divider} />
                <button 
                  className={`${styles.actionBtn} ${styles.deleteBtn}`}
                  onClick={deleteSelectedElement}
                  title="Delete (Delete)"
                >
                  <Trash2 size={16} />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>

          {/* Right Panel - Properties & Tools */}
          <div className={`${styles.rightPanel} ${rightPanelOpen ? styles.open : ''}`}>
            {/* Tool Options */}
            {activeTool === 'shape' && (
              <div className={styles.panelSection}>
                <div className={styles.panelHeader}>
                  <Circle size={18} />
                  <span>Shape Options</span>
                </div>
                <div className={styles.shapeOptions}>
                  <button 
                    className={`${styles.shapeButton} ${activeShape === 'rectangle' ? styles.active : ''}`}
                    onClick={() => setActiveShape('rectangle')}
                  >
                    <Square size={20} />
                    <span>Rectangle</span>
                  </button>
                  <button 
                    className={`${styles.shapeButton} ${activeShape === 'circle' ? styles.active : ''}`}
                    onClick={() => setActiveShape('circle')}
                  >
                    <Circle size={20} />
                    <span>Circle</span>
                  </button>
                </div>
              </div>
            )}

            {activeTool === 'icon' && (
              <div className={styles.panelSection}>
                <div className={styles.panelHeader}>
                  <DoorOpen size={18} />
                  <span>Icons</span>
                </div>
                <div className={styles.iconGrid}>
                  {Object.entries(ICONS).map(([key, Icon]) => (
                    <button
                      key={key}
                      className={`${styles.iconButton} ${activeIcon === key ? styles.active : ''}`}
                      onClick={() => setActiveIcon(key)}
                      title={key}
                    >
                      <Icon size={20} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Colors */}
            <div className={styles.panelSection}>
              <div className={styles.panelHeader}>
                <Palette size={18} />
                <span>Colors</span>
              </div>
              <div className={styles.colorSection}>
                <label>Fill Color</label>
                <div className={styles.colorPicker}>
                  <input
                    type="color"
                    value={drawColor}
                    onChange={(e) => {
                      setDrawColor(e.target.value)
                      if (selectedElement) {
                        updateSelectedElement({ color: e.target.value })
                      }
                    }}
                  />
                  <span>{drawColor}</span>
                </div>
                <div className={styles.presetColors}>
                  {PRESET_COLORS.slice(0, 10).map(color => (
                    <button
                      key={color}
                      className={styles.presetColor}
                      style={{ backgroundColor: color }}
                      onClick={() => {
                        setDrawColor(color)
                        if (selectedElement) {
                          updateSelectedElement({ color })
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className={styles.colorSection}>
                <label>Border Color</label>
                <div className={styles.colorPicker}>
                  <input
                    type="color"
                    value={borderColor}
                    onChange={(e) => {
                      setBorderColor(e.target.value)
                      if (selectedElement) {
                        updateSelectedElement({ borderColor: e.target.value })
                      }
                    }}
                  />
                  <span>{borderColor}</span>
                </div>
              </div>
            </div>

            {/* Selected Element Properties */}
            {selectedElement && (
              <div className={styles.panelSection}>
                <div className={styles.panelHeader}>
                  <Settings size={18} />
                  <span>Properties</span>
                </div>
                <div className={styles.propertiesForm}>
                  <div className={styles.formGroup}>
                    <label>Label</label>
                    <input
                      type="text"
                      value={selectedElement.label || ''}
                      onChange={(e) => updateSelectedElement({ label: e.target.value })}
                    />
                  </div>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>X</label>
                      <input
                        type="number"
                        value={Math.round(selectedElement.x)}
                        onChange={(e) => updateSelectedElement({ x: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Y</label>
                      <input
                        type="number"
                        value={Math.round(selectedElement.y)}
                        onChange={(e) => updateSelectedElement({ y: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>Width</label>
                      <input
                        type="number"
                        value={Math.round(selectedElement.width)}
                        onChange={(e) => updateSelectedElement({ width: parseInt(e.target.value) || 40 })}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Height</label>
                      <input
                        type="number"
                        value={Math.round(selectedElement.height)}
                        onChange={(e) => updateSelectedElement({ height: parseInt(e.target.value) || 40 })}
                      />
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Rotation</label>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={selectedElement.rotation}
                      onChange={(e) => updateSelectedElement({ rotation: parseInt(e.target.value) })}
                    />
                    <span>{selectedElement.rotation}°</span>
                  </div>
                  {selectedElement.type === 'text' && (
                    <>
                      <div className={styles.formGroup}>
                        <label>Font Size</label>
                        <input
                          type="number"
                          min="8"
                          max="72"
                          value={selectedElement.fontSize || 14}
                          onChange={(e) => updateSelectedElement({ fontSize: parseInt(e.target.value) || 14 })}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label>Text Align</label>
                        <div className={styles.alignButtons}>
                          <button 
                            className={selectedElement.textAlign === 'left' ? styles.active : ''}
                            onClick={() => updateSelectedElement({ textAlign: 'left' })}
                          >
                            <AlignLeft size={16} />
                          </button>
                          <button 
                            className={selectedElement.textAlign === 'center' ? styles.active : ''}
                            onClick={() => updateSelectedElement({ textAlign: 'center' })}
                          >
                            <AlignCenter size={16} />
                          </button>
                          <button 
                            className={selectedElement.textAlign === 'right' ? styles.active : ''}
                            onClick={() => updateSelectedElement({ textAlign: 'right' })}
                          >
                            <AlignRight size={16} />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                  
                  {/* Linked Room Info */}
                  {selectedElement.linkedRoomData && (
                    <div className={styles.linkedRoomInfo}>
                      <h4>Linked Room Data</h4>
                      <p><strong>Building:</strong> {selectedElement.linkedRoomData.building}</p>
                      <p><strong>Capacity:</strong> {selectedElement.linkedRoomData.capacity}</p>
                      <p><strong>Type:</strong> {selectedElement.linkedRoomData.roomType || 'Classroom'}</p>
                      {selectedElement.linkedRoomData.hasAC && <span className={styles.tag}>AC</span>}
                      {selectedElement.linkedRoomData.hasProjector && <span className={styles.tag}>Projector</span>}
                      {selectedElement.linkedRoomData.isPWDAccessible && <span className={styles.tag}>PWD</span>}
                    </div>
                  )}
                  
                  <div className={styles.actionButtons}>
                    <button onClick={duplicateSelected} title="Duplicate">
                      <Copy size={16} />
                    </button>
                    <button onClick={bringToFront} title="Bring to Front">
                      <ChevronUp size={16} />
                    </button>
                    <button onClick={sendToBack} title="Send to Back">
                      <ChevronDown size={16} />
                    </button>
                    <button 
                      onClick={() => updateSelectedElement({ isLocked: !selectedElement.isLocked })}
                      title={selectedElement.isLocked ? 'Unlock' : 'Lock'}
                    >
                      {selectedElement.isLocked ? <Lock size={16} /> : <Unlock size={16} />}
                    </button>
                    <button 
                      onClick={() => updateSelectedElement({ isVisible: !selectedElement.isVisible })}
                      title={selectedElement.isVisible ? 'Hide' : 'Show'}
                    >
                      {selectedElement.isVisible !== false ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                    <button onClick={deleteSelected} className={styles.deleteButton} title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Layers */}
            <div className={styles.panelSection}>
              <div className={styles.panelHeader}>
                <Layers size={18} />
                <span>Layers ({elements.length})</span>
              </div>
              <div className={styles.layersList}>
                {[...elements].reverse().map(elem => (
                  <div 
                    key={elem.id}
                    className={`${styles.layerItem} ${selectedElements.includes(elem.id) ? styles.selected : ''}`}
                    onClick={() => {
                      setSelectedElement(elem)
                      setSelectedElements([elem.id])
                    }}
                  >
                    <span className={styles.layerType}>{elem.type}</span>
                    <span className={styles.layerLabel}>{elem.label || elem.id.slice(0, 8)}</span>
                    <div className={styles.layerActions}>
                      <button onClick={(e) => {
                        e.stopPropagation()
                        setElements(prev => prev.map(el => 
                          el.id === elem.id ? { ...el, isVisible: !el.isVisible } : el
                        ))
                      }}>
                        {elem.isVisible !== false ? <Eye size={12} /> : <EyeOff size={12} />}
                      </button>
                      <button onClick={(e) => {
                        e.stopPropagation()
                        setElements(prev => prev.map(el => 
                          el.id === elem.id ? { ...el, isLocked: !el.isLocked } : el
                        ))
                      }}>
                        {elem.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                      </button>
                    </div>
                  </div>
                ))}
                {elements.length === 0 && (
                  <div className={styles.emptyState}>
                    <p>No elements yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      {/* Create Building Modal */}
      {showBuildingModal && (
        <div className={styles.modalOverlay} onClick={() => setShowBuildingModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2><Building2 size={20} /> Create Building</h2>
              <button onClick={() => setShowBuildingModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>Building Name *</label>
                <input
                  type="text"
                  value={newBuilding.name}
                  onChange={(e) => setNewBuilding(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Federizo Hall"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Building Code</label>
                <input
                  type="text"
                  value={newBuilding.code}
                  onChange={(e) => setNewBuilding(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="e.g., FH"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Campus</label>
                <input
                  type="text"
                  value={newBuilding.campus}
                  onChange={(e) => setNewBuilding(prev => ({ ...prev, campus: e.target.value }))}
                  placeholder="e.g., Main Campus"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Total Floors</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={newBuilding.total_floors}
                  onChange={(e) => setNewBuilding(prev => ({ ...prev, total_floors: parseInt(e.target.value) || 1 }))}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelButton} onClick={() => setShowBuildingModal(false)}>
                Cancel
              </button>
              <button className={styles.primaryButton} onClick={createBuilding} disabled={loading}>
                {loading ? <RefreshCw size={16} className={styles.spinning} /> : <Check size={16} />}
                Create Building
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Floor Modal */}
      {showFloorModal && (
        <div className={styles.modalOverlay} onClick={() => setShowFloorModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2><Layers size={20} /> Create Floor Plan</h2>
              <button onClick={() => setShowFloorModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>Building</label>
                <input type="text" value={selectedBuilding?.name || ''} disabled />
              </div>
              <div className={styles.formGroup}>
                <label>Floor Number *</label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={newFloor.floor_number}
                  onChange={(e) => setNewFloor(prev => ({ ...prev, floor_number: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Floor Name</label>
                <input
                  type="text"
                  value={newFloor.floor_name}
                  onChange={(e) => setNewFloor(prev => ({ ...prev, floor_name: e.target.value }))}
                  placeholder={`e.g., Ground Floor, ${newFloor.floor_number}${newFloor.floor_number === 1 ? 'st' : newFloor.floor_number === 2 ? 'nd' : newFloor.floor_number === 3 ? 'rd' : 'th'} Floor`}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelButton} onClick={() => setShowFloorModal(false)}>
                Cancel
              </button>
              <button className={styles.primaryButton} onClick={createFloorPlan} disabled={loading}>
                {loading ? <RefreshCw size={16} className={styles.spinning} /> : <Check size={16} />}
                Create Floor Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && currentFloorPlan && (
        <div className={styles.modalOverlay} onClick={() => setShowShareModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2><Share2 size={20} /> Share Floor Plan</h2>
              <button onClick={() => setShowShareModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>Expires In (Days)</label>
                <select
                  value={shareSettings.expires_in_days}
                  onChange={(e) => setShareSettings(prev => ({ ...prev, expires_in_days: parseInt(e.target.value) }))}
                >
                  <option value={1}>1 Day</option>
                  <option value={7}>7 Days</option>
                  <option value={30}>30 Days</option>
                  <option value={90}>90 Days</option>
                  <option value={365}>1 Year</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Password (Optional)</label>
                <input
                  type="password"
                  value={shareSettings.password}
                  onChange={(e) => setShareSettings(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Leave empty for no password"
                />
              </div>
              
              {shareLink && (
                <div className={styles.shareLinkBox}>
                  <label>Share Link</label>
                  <div className={styles.shareLinkInput}>
                    <input type="text" value={shareLink} readOnly />
                    <button onClick={() => {
                      navigator.clipboard.writeText(shareLink)
                      showNotification('success', 'Link copied!')
                    }}>
                      <Copy size={16} />
                    </button>
                  </div>
                </div>
              )}

              <div className={styles.publishOption}>
                <label>
                  <input
                    type="checkbox"
                    checked={currentFloorPlan.is_default_view}
                    onChange={(e) => {
                      setCurrentFloorPlan(prev => prev ? { ...prev, is_default_view: e.target.checked } : null)
                    }}
                  />
                  Set as Default View
                </label>
                <p>When enabled, this floor plan will be shown by default when viewing this building.</p>
              </div>

              <div className={styles.publishOption}>
                <label>
                  <input
                    type="checkbox"
                    checked={currentFloorPlan.is_published}
                    onChange={(e) => {
                      setCurrentFloorPlan(prev => prev ? { ...prev, is_published: e.target.checked } : null)
                    }}
                  />
                  Publish Floor Plan
                </label>
                <p>Published floor plans can be viewed publicly.</p>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelButton} onClick={() => setShowShareModal(false)}>
                Close
              </button>
              <button className={styles.primaryButton} onClick={createShareLink}>
                <Link size={16} />
                Generate Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && currentFloorPlan && (
        <div className={styles.modalOverlay} onClick={() => setShowExportModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Export Floor Plan</h2>
              <button onClick={() => setShowExportModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalContent}>
              <p className={styles.exportDescription}>
                Export your floor plan in different formats for sharing, printing, or viewing online.
              </p>
              
              <div className={styles.exportSection}>
                <h3>
                  <Image size={18} />
                  Export as Image
                </h3>
                <div className={styles.exportButtons}>
                  <button 
                    className={styles.exportButton}
                    onClick={() => exportAsImage('png')}
                    disabled={exporting}
                  >
                    <Download size={18} />
                    <span>PNG</span>
                    <small>High quality, transparent</small>
                  </button>
                  <button 
                    className={styles.exportButton}
                    onClick={() => exportAsImage('jpeg')}
                    disabled={exporting}
                  >
                    <Download size={18} />
                    <span>JPEG</span>
                    <small>Compressed, smaller file</small>
                  </button>
                </div>
              </div>

              <div className={styles.exportSection}>
                <h3>
                  <FilePlus size={18} />
                  Export as PDF
                </h3>
                <div className={styles.exportButtons}>
                  <button 
                    className={styles.exportButton}
                    onClick={() => exportAsPDF('a4')}
                    disabled={exporting}
                  >
                    <Download size={18} />
                    <span>A4</span>
                    <small>210 × 297 mm</small>
                  </button>
                  <button 
                    className={styles.exportButton}
                    onClick={() => exportAsPDF('letter')}
                    disabled={exporting}
                  >
                    <Download size={18} />
                    <span>Letter</span>
                    <small>8.5 × 11 inches</small>
                  </button>
                </div>
              </div>

              <div className={styles.exportSection}>
                <h3>
                  <ExternalLink size={18} />
                  View Online
                </h3>
                <div className={styles.exportButtons}>
                  <button 
                    className={styles.exportButton}
                    onClick={openWebView}
                    disabled={exporting || !shareLink}
                  >
                    <ExternalLink size={18} />
                    <span>Open Web View</span>
                    <small>{shareLink ? 'Open in new tab' : 'Generate share link first'}</small>
                  </button>
                  <button 
                    className={styles.exportButton}
                    onClick={() => {
                      setShowExportModal(false)
                      setShowShareModal(true)
                    }}
                  >
                    <Share2 size={18} />
                    <span>Generate Link</span>
                    <small>Create shareable URL</small>
                  </button>
                </div>
              </div>

              {exporting && (
                <div className={styles.exportingOverlay}>
                  <RefreshCw size={24} className={styles.spinning} />
                  <span>Exporting...</span>
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelButton} onClick={() => setShowExportModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className={styles.modalOverlay} onClick={() => setShowSettingsModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2><Settings size={20} /> Canvas Settings</h2>
              <button onClick={() => setShowSettingsModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Canvas Width</label>
                  <input
                    type="number"
                    min="400"
                    max="4000"
                    value={canvasSize.width}
                    onChange={(e) => setCanvasSize(prev => ({ ...prev, width: parseInt(e.target.value) || 1200 }))}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Canvas Height</label>
                  <input
                    type="number"
                    min="400"
                    max="4000"
                    value={canvasSize.height}
                    onChange={(e) => setCanvasSize(prev => ({ ...prev, height: parseInt(e.target.value) || 800 }))}
                  />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Grid Size</label>
                <input
                  type="number"
                  min="5"
                  max="100"
                  value={gridSize}
                  onChange={(e) => setGridSize(parseInt(e.target.value) || 20)}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Background Color</label>
                <div className={styles.colorPicker}>
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                  />
                  <span>{backgroundColor}</span>
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Background Image URL</label>
                <input
                  type="text"
                  value={backgroundImage || ''}
                  onChange={(e) => setBackgroundImage(e.target.value || null)}
                  placeholder="https://example.com/floorplan.png"
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelButton} onClick={() => setShowSettingsModal(false)}>
                Close
              </button>
              <button className={styles.primaryButton} onClick={() => setShowSettingsModal(false)}>
                <Check size={16} />
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
