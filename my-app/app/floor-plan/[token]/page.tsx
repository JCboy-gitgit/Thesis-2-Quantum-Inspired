'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import styles from './styles.module.css'
import { 
  Map, 
  Building2, 
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Lock,
  Eye,
  Calendar,
  Users,
  Info,
  DoorOpen,
  ArrowUpDown,
  Building,
  Sofa,
  Monitor,
  GraduationCap,
  FlaskConical,
  BookOpen,
  Coffee,
  Wifi,
  Printer,
  Projector,
  Thermometer,
  AlertTriangle,
  ExternalLink,
  X,
  Check,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

// Types
interface CanvasElement {
  id: string
  type: 'room' | 'wall' | 'door' | 'window' | 'stair' | 'text' | 'icon' | 'shape' | 'image'
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
  buildings?: {
    name: string
    code?: string
    campus?: string
  }
}

interface SharedFloorPlan {
  id: number
  share_name: string
  share_token: string
  floor_plan: FloorPlan
  view_count: number
  expires_at: string
  is_password_protected: boolean
}

// Icon mapping
const ICONS: Record<string, any> = {
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

export default function PublicFloorPlanPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string
  
  const canvasRef = useRef<HTMLDivElement>(null)
  const [sharedFloorPlan, setSharedFloorPlan] = useState<SharedFloorPlan | null>(null)
  const [elements, setElements] = useState<CanvasElement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Password state
  const [requiresPassword, setRequiresPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  
  // View state
  const [zoom, setZoom] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [selectedElement, setSelectedElement] = useState<CanvasElement | null>(null)
  const [showRoomDetails, setShowRoomDetails] = useState(false)
  
  // Canvas settings from floor plan
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 })
  const [backgroundColor, setBackgroundColor] = useState('#ffffff')
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null)

  useEffect(() => {
    if (token) {
      fetchSharedFloorPlan()
    }
  }, [token])

  const fetchSharedFloorPlan = async (pwd?: string) => {
    try {
      setLoading(true)
      setError(null)
      
      const url = new URL('/api/floor-plans/share', window.location.origin)
      url.searchParams.set('token', token)
      if (pwd) {
        url.searchParams.set('password', pwd)
      }
      
      const response = await fetch(url)
      const result = await response.json()
      
      if (!result.success) {
        if (result.requiresPassword) {
          setRequiresPassword(true)
          if (pwd) {
            setPasswordError('Invalid password')
          }
          return
        }
        throw new Error(result.error)
      }
      
      setRequiresPassword(false)
      setPasswordError(null)
      setSharedFloorPlan(result.data)
      
      const plan = result.data.floor_plan
      setCanvasSize({ width: plan.canvas_width || 1200, height: plan.canvas_height || 800 })
      setBackgroundColor(plan.background_color || '#ffffff')
      setBackgroundImage(plan.background_image_url || null)
      
      // Load elements
      if (plan.canvas_data?.elements) {
        setElements(plan.canvas_data.elements)
      } else if (plan.elements && plan.elements.length > 0) {
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
          linkedRoomData: elem.linked_room_data,
          isLocked: elem.is_locked,
          isVisible: elem.is_visible,
          properties: elem.properties || {}
        }))
        setElements(convertedElements)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load floor plan')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) {
      setPasswordError('Please enter a password')
      return
    }
    fetchSharedFloorPlan(password)
  }

  // Zoom controls
  const handleZoom = (delta: number) => {
    setZoom(prev => Math.min(Math.max(prev + delta, 0.25), 3))
  }

  const resetView = () => {
    setZoom(1)
    setPanOffset({ x: 0, y: 0 })
  }

  const fitToView = () => {
    if (canvasRef.current) {
      const container = canvasRef.current.parentElement
      if (container) {
        const containerWidth = container.clientWidth
        const containerHeight = container.clientHeight
        const scaleX = (containerWidth - 40) / canvasSize.width
        const scaleY = (containerHeight - 40) / canvasSize.height
        const scale = Math.min(scaleX, scaleY, 1)
        setZoom(scale)
        setPanOffset({ x: 0, y: 0 })
      }
    }
  }

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true)
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsPanning(false)
  }

  // Render element on canvas
  const renderElement = (element: CanvasElement) => {
    if (element.isVisible === false) return null
    
    const isSelected = selectedElement?.id === element.id
    const style: React.CSSProperties = {
      position: 'absolute',
      left: element.x,
      top: element.y,
      width: element.width,
      height: element.height,
      transform: `rotate(${element.rotation}deg)`,
      zIndex: element.zIndex,
      opacity: element.opacity ?? 1,
      cursor: element.type === 'room' && element.linkedRoomData ? 'pointer' : 'default',
      outline: isSelected ? '3px solid #3B82F6' : 'none',
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
            onClick={() => {
              if (element.linkedRoomData) {
                setSelectedElement(element)
                setShowRoomDetails(true)
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
          />
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
          </div>
        )
      
      case 'shape':
        return (
          <div
            key={element.id}
            className={styles.canvasElement}
            style={{
              ...style,
              backgroundColor: element.color,
              border: `${element.borderWidth || 2}px ${element.borderStyle || 'solid'} ${element.borderColor || '#333'}`,
              borderRadius: element.shapeType === 'circle' ? '50%' : '4px'
            }}
          />
        )
      
      case 'icon':
        const IconComponent = ICONS[element.icon as string] || Info
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
          >
            <IconComponent 
              size={Math.min(element.width, element.height) * 0.8} 
              color={element.color || '#333'} 
            />
          </div>
        )
      
      default:
        return null
    }
  }

  // Loading state
  if (loading && !requiresPassword) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner} />
        <p>Loading floor plan...</p>
      </div>
    )
  }

  // Password required
  if (requiresPassword) {
    return (
      <div className={styles.passwordContainer}>
        <div className={styles.passwordCard}>
          <div className={styles.passwordIcon}>
            <Lock size={32} />
          </div>
          <h2>Password Protected</h2>
          <p>This floor plan is password protected. Please enter the password to continue.</p>
          <form onSubmit={handlePasswordSubmit}>
            <div className={styles.passwordInput}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoFocus
              />
            </div>
            {passwordError && (
              <p className={styles.errorMessage}>{passwordError}</p>
            )}
            <button type="submit" className={styles.submitButton}>
              <Check size={18} />
              Access Floor Plan
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorCard}>
          <div className={styles.errorIcon}>
            <AlertTriangle size={32} />
          </div>
          <h2>Unable to Load Floor Plan</h2>
          <p>{error}</p>
          <button onClick={() => router.push('/')} className={styles.backButton}>
            Go to Home
          </button>
        </div>
      </div>
    )
  }

  // Main view
  return (
    <div className={styles.viewerContainer}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Map size={24} className={styles.headerIcon} />
          <div className={styles.headerInfo}>
            <h1>{sharedFloorPlan?.share_name || 'Floor Plan'}</h1>
            {sharedFloorPlan?.floor_plan?.buildings && (
              <span className={styles.buildingInfo}>
                <Building2 size={14} />
                {sharedFloorPlan.floor_plan.buildings.name}
                {sharedFloorPlan.floor_plan.buildings.campus && 
                  ` - ${sharedFloorPlan.floor_plan.buildings.campus}`
                }
              </span>
            )}
          </div>
        </div>
        
        <div className={styles.headerRight}>
          <div className={styles.zoomControls}>
            <button onClick={() => handleZoom(-0.1)} title="Zoom Out">
              <ZoomOut size={18} />
            </button>
            <span className={styles.zoomLevel}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => handleZoom(0.1)} title="Zoom In">
              <ZoomIn size={18} />
            </button>
            <button onClick={fitToView} title="Fit to View">
              <Maximize2 size={18} />
            </button>
          </div>
          
          <div className={styles.viewStats}>
            <Eye size={14} />
            <span>{sharedFloorPlan?.view_count || 0} views</span>
          </div>
        </div>
      </header>

      {/* Canvas */}
      <main 
        className={styles.canvasArea}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          ref={canvasRef}
          className={styles.canvas}
          style={{
            width: canvasSize.width * zoom,
            height: canvasSize.height * zoom,
            transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
            backgroundColor: backgroundColor,
            cursor: isPanning ? 'grabbing' : 'grab'
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
          
          {/* Elements */}
          <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
            {elements.map(renderElement)}
          </div>
        </div>
        
        {/* Help Text */}
        <div className={styles.helpText}>
          <p>Drag to pan • Scroll or use buttons to zoom • Click rooms for details</p>
        </div>
      </main>

      {/* Room Details Modal */}
      {showRoomDetails && selectedElement?.linkedRoomData && (
        <div className={styles.detailsModal}>
          <div className={styles.detailsCard}>
            <button 
              className={styles.closeButton}
              onClick={() => {
                setShowRoomDetails(false)
                setSelectedElement(null)
              }}
            >
              <X size={20} />
            </button>
            
            <div className={styles.detailsHeader}>
              <div className={styles.roomBadge} style={{ backgroundColor: selectedElement.color }}>
                <Building2 size={20} />
              </div>
              <div>
                <h3>{selectedElement.label}</h3>
                <span>{selectedElement.linkedRoomData.building}</span>
              </div>
            </div>
            
            <div className={styles.detailsGrid}>
              <div className={styles.detailItem}>
                <Users size={16} />
                <span>Capacity</span>
                <strong>{selectedElement.linkedRoomData.capacity}</strong>
              </div>
              {selectedElement.linkedRoomData.roomType && (
                <div className={styles.detailItem}>
                  <Layers size={16} />
                  <span>Type</span>
                  <strong>{selectedElement.linkedRoomData.roomType}</strong>
                </div>
              )}
            </div>
            
            {(selectedElement.linkedRoomData.hasAC || 
              selectedElement.linkedRoomData.hasProjector || 
              selectedElement.linkedRoomData.isPWDAccessible) && (
              <div className={styles.amenities}>
                <h4>Amenities</h4>
                <div className={styles.amenityTags}>
                  {selectedElement.linkedRoomData.hasAC && (
                    <span className={styles.amenityTag}>
                      <Thermometer size={12} /> Air Conditioned
                    </span>
                  )}
                  {selectedElement.linkedRoomData.hasProjector && (
                    <span className={styles.amenityTag}>
                      <Projector size={12} /> Projector
                    </span>
                  )}
                  {selectedElement.linkedRoomData.isPWDAccessible && (
                    <span className={styles.amenityTag}>
                      <Users size={12} /> PWD Accessible
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expiry Notice */}
      {sharedFloorPlan?.expires_at && (
        <div className={styles.expiryNotice}>
          <Calendar size={14} />
          <span>
            This link expires on {new Date(sharedFloorPlan.expires_at).toLocaleDateString()}
          </span>
        </div>
      )}
    </div>
  )
}
