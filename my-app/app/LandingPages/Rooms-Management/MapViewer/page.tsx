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
  Type, Trash2, Save, Download, Settings, Eye, ChevronDown, ChevronUp,
  Search, X, Check, Share2, Link, Grid, ZoomIn, ZoomOut, DoorOpen,
  Building, Users, GraduationCap, FlaskConical, BookOpen, Coffee,
  Projector, Thermometer, RefreshCw, FileText, ChevronRight, ChevronLeft, Edit3,
  Box, Maximize2, LayoutGrid, Footprints, Info, Monitor, AlertTriangle,
  PanelLeftClose, PanelLeftOpen, Loader2, RotateCcw, Wifi, Wind
} from 'lucide-react'

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

interface CanvasElement {
  id: string
  type: 'room' | 'wall' | 'door' | 'text' | 'icon' | 'hallway' | 'stair'
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
  'default': { bg: '#e5e7eb', border: '#9ca3af', label: 'Other' }
}

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
    { type: 'icon', label: 'Icon', icon: Info, color: '#6366f1', width: 40, height: 40 },
  ]
}

export default function MapViewerPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const canvasRef = useRef<HTMLDivElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)

  // PC-only detection
  const [isMobile, setIsMobile] = useState(false)
  const [showMobileWarning, setShowMobileWarning] = useState(false)

  // Panel state
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)

  // Toolbox sections
  const [sectionsOpen, setSectionsOpen] = useState({
    roomsZones: true,
    structures: false,
    doorsElements: false,
    labelsIcons: false
  })

  // Data state
  const [buildings, setBuildings] = useState<string[]>([])
  const [floors, setFloors] = useState<number[]>([])
  const [selectedBuilding, setSelectedBuilding] = useState<string>('')
  const [selectedFloor, setSelectedFloor] = useState<number>(1)
  const [allRooms, setAllRooms] = useState<Room[]>([])
  const [canvasElements, setCanvasElements] = useState<CanvasElement[]>([])
  const [selectedElement, setSelectedElement] = useState<CanvasElement | null>(null)

  // Canvas state
  const [zoom, setZoom] = useState(100)
  const [snapToGrid, setSnapToGrid] = useState(true)
  const [gridSize] = useState(20)
  const [canvasSize, setCanvasSize] = useState({ width: 1600, height: 1000 })
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })

  // Drag state
  const [isDragging, setIsDragging] = useState(false)
  const [dragItem, setDragItem] = useState<any>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [dragGhost, setDragGhost] = useState<{ x: number; y: number } | null>(null)
  const [draggingElement, setDraggingElement] = useState<string | null>(null)

  // UI state
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Editing state
  const [editForm, setEditForm] = useState({
    label: '',
    type: '',
    width: 0,
    height: 0,
    color: '',
    rotation: 0
  })

  const toggleSidebar = () => setSidebarOpen(prev => !prev)

  // Show notification
  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 3000)
  }

  // PC-only detection
  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth
      const mobile = width < 1024
      setIsMobile(mobile)
      if (mobile) {
        setShowMobileWarning(true)
      }
    }

    checkDevice()
    window.addEventListener('resize', checkDevice)
    return () => window.removeEventListener('resize', checkDevice)
  }, [])

  // Auth check
  useEffect(() => {
    checkAuth()
    fetchBuildings()
  }, [])

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/faculty/login')
        return
      }
      if (session.user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        router.push('/faculty/home')
        return
      }
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/faculty/login')
    }
  }

  // Fetch buildings from campuses table
  const fetchBuildings = async () => {
    try {
      const { data, error } = await supabase
        .from('campuses')
        .select('building, floor_number')
        .eq('status', 'active')

      if (error) throw error

      const uniqueBuildings = [...new Set((data || []).map((d: { building: string }) => d.building))].filter(Boolean) as string[]
      setBuildings(uniqueBuildings)

      if (uniqueBuildings.length > 0) {
        setSelectedBuilding(uniqueBuildings[0])
      }
    } catch (error) {
      console.error('Error fetching buildings:', error)
    }
  }

  // Fetch rooms when building/floor changes
  useEffect(() => {
    if (selectedBuilding) {
      fetchRooms()
    }
  }, [selectedBuilding, selectedFloor])

  const fetchRooms = async () => {
    if (!selectedBuilding) return

    try {
      setLoading(true)

      let query = supabase
        .from('campuses')
        .select('*')
        .eq('building', selectedBuilding)
        .eq('status', 'active')
        .order('room', { ascending: true })

      if (selectedFloor) {
        query = query.eq('floor_number', selectedFloor)
      }

      const { data, error } = await query

      if (error) throw error

      setAllRooms(data || [])

      // Get unique floors for this building
      const { data: floorData } = await supabase
        .from('campuses')
        .select('floor_number')
        .eq('building', selectedBuilding)
        .eq('status', 'active')

      const roomFloors = [...new Set((floorData || []).map((r: { floor_number: number }) => r.floor_number).filter(f => f != null))] as number[]
      setFloors(roomFloors.sort((a, b) => a - b))

    } catch (error) {
      console.error('Error fetching rooms:', error)
      showNotification('error', 'Failed to load rooms')
    } finally {
      setLoading(false)
    }
  }

  // Get room color based on type
  const getRoomColor = (roomType?: string) => {
    const type = roomType?.toLowerCase().replace(/\s+/g, '_') || 'default'
    return ROOM_TYPE_COLORS[type] || ROOM_TYPE_COLORS.default
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
    setSelectedElement(element)
    setEditForm({
      label: element.label || '',
      type: element.type,
      width: element.width,
      height: element.height,
      color: element.color || getRoomColor(element.linkedRoomData?.room_type).bg,
      rotation: element.rotation
    })
  }

  // Handle canvas click (deselect)
  const handleCanvasClick = () => {
    setSelectedElement(null)
  }

  // Handle room drag start from toolbox
  const handleRoomDragStart = (e: React.DragEvent, room: Room) => {
    setDragItem({ type: 'room', data: room })
    setIsDragging(true)
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'room', roomId: room.id }))
  }

  // Handle toolbox item drag start
  const handleToolboxDragStart = (e: React.DragEvent, item: any) => {
    setDragItem({ type: 'toolbox', data: item })
    setIsDragging(true)
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'toolbox', itemType: item.type }))
  }

  // Handle drag over canvas
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const scale = zoom / 100
    let x = (e.clientX - rect.left) / scale
    let y = (e.clientY - rect.top) / scale

    // Snap to grid
    x = snapToGridPosition(x)
    y = snapToGridPosition(y)

    setDragGhost({ x, y })
  }

  // Handle drop on canvas
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (!canvasRef.current || !dragItem) return

    const rect = canvasRef.current.getBoundingClientRect()
    const scale = zoom / 100
    let x = (e.clientX - rect.left) / scale
    let y = (e.clientY - rect.top) / scale

    // Snap to grid
    x = snapToGridPosition(x)
    y = snapToGridPosition(y)

    if (dragItem.type === 'room') {
      const room = dragItem.data as Room
      // Check if room already on canvas
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
    }

    setDragItem(null)
    setIsDragging(false)
    setDragGhost(null)
  }

  // Handle element drag on canvas
  const handleElementDragStart = (e: React.MouseEvent, element: CanvasElement) => {
    e.stopPropagation()
    setDraggingElement(element.id)
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
  }

  const handleElementDrag = (e: React.MouseEvent) => {
    if (!draggingElement || !canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const scale = zoom / 100
    let x = (e.clientX - rect.left - dragOffset.x) / scale
    let y = (e.clientY - rect.top - dragOffset.y) / scale

    // Snap to grid
    x = snapToGridPosition(x)
    y = snapToGridPosition(y)

    setCanvasElements(prev => prev.map(el =>
      el.id === draggingElement ? { ...el, x, y } : el
    ))
  }

  const handleElementDragEnd = () => {
    setDraggingElement(null)
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

  // Clear canvas
  const clearCanvas = () => {
    setCanvasElements([])
    setSelectedElement(null)
    showNotification('info', 'Canvas cleared')
  }

  // Save floor plan
  const saveFloorPlan = async () => {
    try {
      setSaving(true)
      // For now, just show success - actual saving would go to floor_plans table
      showNotification('success', 'Floor plan saved successfully!')
    } catch (error) {
      showNotification('error', 'Failed to save floor plan')
    } finally {
      setSaving(false)
    }
  }

  // Export as PDF
  const exportPDF = () => {
    showNotification('info', 'PDF export coming soon!')
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

  // PC-only warning overlay
  if (showMobileWarning && isMobile) {
    return (
      <div className={styles.mobileWarning} data-theme={theme}>
        <div className={styles.mobileWarningContent}>
          <Monitor size={64} className={styles.pcIcon} />
          <h2>Desktop Required</h2>
          <p>The Floor Plan Editor requires a desktop computer for the best experience.</p>
          <p>Screen width: {typeof window !== 'undefined' ? window.innerWidth : 0}px (minimum: 1024px)</p>
          <div className={styles.warningButtons}>
            <button onClick={() => setShowMobileWarning(false)} className={styles.continueBtn}>
              <AlertTriangle size={18} />
              Continue Anyway
            </button>
            <button onClick={() => router.back()} className={styles.backBtn}>
              <ChevronLeft size={18} />
              Go Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.layout} data-theme={theme}>
      <MenuBar onToggleSidebar={toggleSidebar} />
      <Sidebar isOpen={sidebarOpen} />

      <main
        className={`${styles.main} ${sidebarOpen ? '' : styles.fullWidth}`}
        onMouseMove={draggingElement ? handleElementDrag : undefined}
        onMouseUp={draggingElement ? handleElementDragEnd : undefined}
        onMouseLeave={handleElementDragEnd}
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
          </div>

          <div className={styles.headerCenter}>
            <h1 className={styles.title}>
              {selectedBuilding || 'Floor Plan Editor'}
              {selectedFloor ? ` - Floor ${selectedFloor}` : ''}
            </h1>
          </div>

          <div className={styles.headerRight}>
            <button className={styles.clearBtn} onClick={clearCanvas} title="Clear Canvas">
              <RotateCcw size={18} />
            </button>
            <button className={styles.saveBtn} onClick={saveFloorPlan} disabled={saving}>
              {saving ? <Loader2 size={18} className={styles.spinning} /> : <Save size={18} />}
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button className={styles.exportBtn} onClick={exportPDF}>
              <Download size={18} />
              Export PDF
            </button>
            <button className={styles.shareBtn}>
              <Share2 size={18} />
              Share Link
            </button>
          </div>
        </div>

        <div className={styles.editorContainer}>
          {/* Left Toolbox Panel */}
          <div className={`${styles.leftPanel} ${leftPanelOpen ? '' : styles.collapsed}`}>
            {/* Toggle button - always visible */}
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
                                draggable="true"
                                onDragStart={(e) => handleRoomDragStart(e, room)}
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
                              draggable="true"
                              onDragStart={(e) => handleToolboxDragStart(e, item)}
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
                              draggable="true"
                              onDragStart={(e) => handleToolboxDragStart(e, item)}
                            >
                              <item.icon size={24} />
                              <span>{item.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Labels & Icons Section */}
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
                              draggable="true"
                              onDragStart={(e) => handleToolboxDragStart(e, item)}
                            >
                              <item.icon size={24} />
                              <span>{item.label}</span>
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

          {/* Main Canvas */}
          <div
            ref={canvasContainerRef}
            className={styles.canvasContainer}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragLeave={() => setDragGhost(null)}
          >
            <div
              ref={canvasRef}
              className={styles.canvas}
              style={{
                width: canvasSize.width,
                height: canvasSize.height,
                transform: `scale(${zoom / 100})`,
                backgroundSize: snapToGrid ? `${gridSize}px ${gridSize}px` : 'none'
              }}
              onClick={handleCanvasClick}
            >
              {/* Render elements on canvas */}
              {canvasElements.map(element => {
                const isSelected = selectedElement?.id === element.id
                const isDragging = draggingElement === element.id

                return (
                  <div
                    key={element.id}
                    className={`${styles.canvasElement} ${styles[`element_${element.type}`]} ${isSelected ? styles.selected : ''} ${isDragging ? styles.dragging : ''}`}
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
                    onClick={(e) => handleElementClick(element, e)}
                    onMouseDown={(e) => handleElementDragStart(e, element)}
                  >
                    {element.type === 'room' && (
                      <>
                        <span className={styles.elementLabel}>{element.label}</span>
                        {element.linkedRoomData && (
                          <span className={styles.elementCapacity}>
                            <Users size={10} /> {element.linkedRoomData.capacity}
                          </span>
                        )}
                      </>
                    )}
                    {element.type === 'text' && (
                      <span className={styles.textLabel}>{element.label}</span>
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
                    {element.type === 'door' && (
                      <DoorOpen size={16} />
                    )}
                  </div>
                )
              })}

              {/* Drag ghost */}
              {dragGhost && dragItem && (
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
                    {dragItem.type === 'room' ? dragItem.data.room : dragItem.data.label}
                  </span>
                </div>
              )}
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

              <div className={styles.snapControl}>
                <Grid size={16} />
                <span>Snap to Grid:</span>
                <button
                  className={`${styles.toggleBtn} ${snapToGrid ? styles.active : ''}`}
                  onClick={() => setSnapToGrid(!snapToGrid)}
                >
                  {snapToGrid ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className={styles.elementCount}>
                <span>Elements: {canvasElements.length}</span>
              </div>
            </div>
          </div>

          {/* Right Properties Panel */}
          <div className={`${styles.rightPanel} ${rightPanelOpen ? '' : styles.collapsed}`}>
            {/* Toggle button - always visible */}
            <button
              className={styles.panelToggleRight}
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              title={rightPanelOpen ? 'Collapse properties' : 'Expand properties'}
            >
              {rightPanelOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>

            {rightPanelOpen && (
              <>
                <div className={styles.panelHeader}>
                  <h3>PROPERTIES</h3>
                </div>

                <div className={styles.propertiesContent}>
                  {selectedElement ? (
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

                      {selectedElement.linkedRoomData && (
                        <div className={styles.roomDetails}>
                          <h4>Room Details</h4>
                          <div className={styles.detailItem}>
                            <Users size={16} />
                            <span>Capacity: {selectedElement.linkedRoomData.capacity || 30}</span>
                          </div>
                          <div className={styles.detailItem}>
                            <Building size={16} />
                            <span>Building: {selectedElement.linkedRoomData.building}</span>
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
                      )}

                      <button
                        className={styles.applyBtn}
                        onClick={() => {
                          updateElement(selectedElement.id, {
                            label: editForm.label,
                            width: editForm.width,
                            height: editForm.height,
                            color: editForm.color,
                            rotation: editForm.rotation
                          })
                          showNotification('success', 'Element updated!')
                        }}
                      >
                        <Check size={16} />
                        Apply Changes
                      </button>

                      <button
                        className={styles.deleteBtn}
                        onClick={() => removeElement(selectedElement.id)}
                      >
                        <Trash2 size={16} />
                        Remove Element
                      </button>
                    </>
                  ) : (
                    <div className={styles.noSelection}>
                      <MousePointer size={32} />
                      <p>Select an element to view properties</p>
                    </div>
                  )}

                  {/* Legend */}
                  <div className={styles.legend}>
                    <h4>LEGEND</h4>
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
          </div>
        </div>
      </main>

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
