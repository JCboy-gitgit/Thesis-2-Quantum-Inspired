'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import styles from './styles.module.css'
import { 
  Map, 
  Building2, 
  Layers, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Square, 
  Circle, 
  Type, 
  DoorOpen, 
  Lock,
  Eye,
  Grid,
  ChevronLeft,
  ChevronRight,
  Home,
  Share2,
  Download,
  Printer,
  Info,
  X,
  Building,
  Sofa,
  Monitor,
  Users,
  GraduationCap,
  FlaskConical,
  BookOpen,
  Coffee,
  Wifi,
  Printer as PrinterIcon,
  Projector,
  Thermometer,
  ArrowUpDown,
  MapPin,
  Clock,
  User
} from 'lucide-react'

// Icon mapping
const ICONS: Record<string, any> = {
  door: DoorOpen,
  stairs: Building,
  chair: Sofa,
  desk: Monitor,
  restroom: Users,
  classroom: GraduationCap,
  lab: FlaskConical,
  library: BookOpen,
  cafeteria: Coffee,
  wifi: Wifi,
  printer: PrinterIcon,
  projector: Projector,
  ac: Thermometer,
}

interface CanvasElement {
  id: string
  type: string
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
  fontWeight?: string
  textAlign?: string
  icon?: string
  linkedRoomData?: any
  shapeType?: string
  opacity?: number
  borderWidth?: number
  borderStyle?: string
}

interface FloorPlan {
  id: number
  floor_number: number
  floor_name?: string
  canvas_data: any
  canvas_width: number
  canvas_height: number
  grid_size: number
  background_color: string
  background_image_url?: string
  elements: CanvasElement[]
  buildings?: {
    id: number
    name: string
    code?: string
  }
}

interface ShareData {
  id: number
  share_name: string
  view_count: number
  created_at: string
  password_protected: boolean
}

export default function PublicFloorPlanView() {
  const params = useParams()
  const token = params.token as string
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [floorPlan, setFloorPlan] = useState<FloorPlan | null>(null)
  const [shareData, setShareData] = useState<ShareData | null>(null)
  const [password, setPassword] = useState('')
  const [needsPassword, setNeedsPassword] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [showRoomDetails, setShowRoomDetails] = useState(false)
  
  // Canvas state
  const [zoom, setZoom] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [showGrid, setShowGrid] = useState(true)
  const [selectedElement, setSelectedElement] = useState<CanvasElement | null>(null)
  
  const canvasRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (token) {
      fetchSharedFloorPlan()
    }
  }, [token])

  const fetchSharedFloorPlan = async (enteredPassword?: string) => {
    try {
      setLoading(true)
      setError(null)
      
      let url = `/api/floor-plans/share?token=${token}`
      if (enteredPassword) {
        url += `&password=${encodeURIComponent(enteredPassword)}`
      }
      
      const response = await fetch(url)
      const result = await response.json()
      
      if (!result.success) {
        if (result.needsPassword) {
          setNeedsPassword(true)
          setLoading(false)
          return
        }
        throw new Error(result.error || 'Failed to load floor plan')
      }
      
      setShareData(result.data.share)
      
      // Parse canvas data to get elements
      const planData = result.data.floorPlan
      let elements: CanvasElement[] = []
      
      if (planData.elements && Array.isArray(planData.elements)) {
        elements = planData.elements
      } else if (planData.canvas_data?.elements) {
        elements = planData.canvas_data.elements
      }
      
      setFloorPlan({
        ...planData,
        elements
      })
      
      setNeedsPassword(false)
      
    } catch (err) {
      console.error('Error fetching shared floor plan:', err)
      setError(err instanceof Error ? err.message : 'Failed to load floor plan')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    fetchSharedFloorPlan(password)
  }

  // Canvas interaction handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.button === 0) { // Middle click or left click for panning
      setIsPanning(true)
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsPanning(false)
  }

  const handleZoom = (delta: number) => {
    setZoom(prev => Math.min(Math.max(prev + delta, 0.25), 3))
  }

  const resetView = () => {
    setZoom(1)
    setPanOffset({ x: 0, y: 0 })
  }

  const handlePrint = () => {
    window.print()
  }

  // Render element
  const renderElement = (element: CanvasElement) => {
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left: element.x,
      top: element.y,
      width: element.width,
      height: element.height,
      transform: `rotate(${element.rotation || 0}deg)`,
      zIndex: element.zIndex,
      opacity: element.opacity ?? 1,
      cursor: 'pointer',
      transition: 'box-shadow 0.2s ease, transform 0.2s ease'
    }

    const isSelected = selectedElement?.id === element.id

    switch (element.type) {
      case 'room':
        return (
          <div
            key={element.id}
            style={{
              ...baseStyle,
              backgroundColor: element.color || '#E5E7EB',
              border: `${element.borderWidth || 2}px ${element.borderStyle || 'solid'} ${element.borderColor || '#374151'}`,
              borderRadius: '4px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px',
              boxShadow: isSelected ? '0 0 0 3px #10B981, 0 4px 12px rgba(16, 185, 129, 0.3)' : 'none',
              transform: isSelected ? 'scale(1.02)' : 'scale(1)'
            }}
            onClick={() => {
              setSelectedElement(element)
              if (element.linkedRoomData) {
                setShowRoomDetails(true)
              }
            }}
          >
            <span style={{ 
              fontSize: element.fontSize || 12, 
              fontWeight: element.fontWeight || 'bold',
              textAlign: element.textAlign as any || 'center',
              color: '#1F2937',
              wordBreak: 'break-word'
            }}>
              {element.label || 'Room'}
            </span>
            {element.linkedRoomData && (
              <span style={{ fontSize: 10, color: '#6B7280', marginTop: 4 }}>
                Cap: {element.linkedRoomData.capacity}
              </span>
            )}
          </div>
        )

      case 'wall':
        return (
          <div
            key={element.id}
            style={{
              ...baseStyle,
              backgroundColor: element.color || '#374151',
              boxShadow: isSelected ? '0 0 0 3px #10B981' : 'none'
            }}
            onClick={() => setSelectedElement(element)}
          />
        )

      case 'text':
        return (
          <div
            key={element.id}
            style={{
              ...baseStyle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: element.textAlign || 'center',
              fontSize: element.fontSize || 14,
              fontWeight: element.fontWeight || 'normal',
              color: element.color || '#1F2937',
              boxShadow: isSelected ? '0 0 0 3px #10B981' : 'none'
            }}
            onClick={() => setSelectedElement(element)}
          >
            {element.label || 'Text'}
          </div>
        )

      case 'icon':
        const IconComponent = element.icon ? ICONS[element.icon] : DoorOpen
        return (
          <div
            key={element.id}
            style={{
              ...baseStyle,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: element.color || 'transparent',
              borderRadius: '4px',
              boxShadow: isSelected ? '0 0 0 3px #10B981' : 'none'
            }}
            onClick={() => setSelectedElement(element)}
          >
            {IconComponent && <IconComponent size={Math.min(element.width, element.height) * 0.6} color={element.borderColor || '#374151'} />}
            {element.label && (
              <span style={{ fontSize: 10, marginTop: 4, color: '#374151' }}>{element.label}</span>
            )}
          </div>
        )

      case 'shape':
        if (element.shapeType === 'circle') {
          return (
            <div
              key={element.id}
              style={{
                ...baseStyle,
                backgroundColor: element.color || '#E5E7EB',
                border: `${element.borderWidth || 2}px ${element.borderStyle || 'solid'} ${element.borderColor || '#374151'}`,
                borderRadius: '50%',
                boxShadow: isSelected ? '0 0 0 3px #10B981' : 'none'
              }}
              onClick={() => setSelectedElement(element)}
            />
          )
        }
        return (
          <div
            key={element.id}
            style={{
              ...baseStyle,
              backgroundColor: element.color || '#E5E7EB',
              border: `${element.borderWidth || 2}px ${element.borderStyle || 'solid'} ${element.borderColor || '#374151'}`,
              borderRadius: '4px',
              boxShadow: isSelected ? '0 0 0 3px #10B981' : 'none'
            }}
            onClick={() => setSelectedElement(element)}
          />
        )
      
      case 'hallway':
        return (
          <div
            key={element.id}
            style={{
              ...baseStyle,
              backgroundColor: element.color || '#D1D5DB',
              border: `2px dashed ${element.borderColor || '#9CA3AF'}`,
              borderRadius: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isSelected ? '0 0 0 3px #10B981' : 'none'
            }}
            onClick={() => setSelectedElement(element)}
          >
            <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>
              {element.label || 'Hallway'}
            </span>
          </div>
        )
      
      case 'stair':
        return (
          <div
            key={element.id}
            style={{
              ...baseStyle,
              backgroundColor: element.color || '#FEF3C7',
              border: `2px solid ${element.borderColor || '#F59E0B'}`,
              borderRadius: '4px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 8px, rgba(245,158,11,0.2) 8px, rgba(245,158,11,0.2) 10px)',
              boxShadow: isSelected ? '0 0 0 3px #10B981' : 'none'
            }}
            onClick={() => setSelectedElement(element)}
          >
            <ArrowUpDown size={20} color="#F59E0B" />
            <span style={{ fontSize: 10, color: '#92400E', fontWeight: 600 }}>
              {element.label || 'Stairs'}
            </span>
          </div>
        )
      
      case 'elevator':
        return (
          <div
            key={element.id}
            style={{
              ...baseStyle,
              backgroundColor: element.color || '#DBEAFE',
              border: `2px solid ${element.borderColor || '#3B82F6'}`,
              borderRadius: '4px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              boxShadow: isSelected ? '0 0 0 3px #10B981' : 'none'
            }}
            onClick={() => setSelectedElement(element)}
          >
            <Building size={20} color="#3B82F6" />
            <span style={{ fontSize: 10, color: '#1E40AF', fontWeight: 600 }}>
              {element.label || 'Elevator'}
            </span>
          </div>
        )
      
      case 'entrance':
        return (
          <div
            key={element.id}
            style={{
              ...baseStyle,
              backgroundColor: element.color || '#D1FAE5',
              border: `2px solid ${element.borderColor || '#10B981'}`,
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: isSelected ? '0 0 0 3px #10B981' : 'none'
            }}
            onClick={() => setSelectedElement(element)}
          >
            <DoorOpen size={18} color="#10B981" />
            <span style={{ fontSize: 11, color: '#065F46', fontWeight: 600 }}>
              {element.label || 'Entrance'}
            </span>
          </div>
        )
      
      case 'restroom':
        return (
          <div
            key={element.id}
            style={{
              ...baseStyle,
              backgroundColor: element.color || '#E0E7FF',
              border: `2px solid ${element.borderColor || '#6366F1'}`,
              borderRadius: '4px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              boxShadow: isSelected ? '0 0 0 3px #10B981' : 'none'
            }}
            onClick={() => setSelectedElement(element)}
          >
            <Users size={18} color="#6366F1" />
            <span style={{ fontSize: 10, color: '#3730A3', fontWeight: 600 }}>
              {element.label || 'Restroom'}
            </span>
          </div>
        )

      default:
        return (
          <div
            key={element.id}
            style={{
              ...baseStyle,
              backgroundColor: element.color || '#E5E7EB',
              border: `2px solid ${element.borderColor || '#374151'}`,
              borderRadius: '4px',
              boxShadow: isSelected ? '0 0 0 3px #10B981' : 'none'
            }}
            onClick={() => setSelectedElement(element)}
          />
        )
    }
  }

  // Password screen
  if (needsPassword) {
    return (
      <div className={styles.passwordContainer}>
        <div className={styles.passwordCard}>
          <Lock size={48} className={styles.lockIcon} />
          <h2>Password Protected</h2>
          <p>This floor plan is password protected. Please enter the password to view.</p>
          <form onSubmit={handlePasswordSubmit}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className={styles.passwordInput}
              autoFocus
            />
            <button type="submit" className={styles.submitButton}>
              <Eye size={18} />
              View Floor Plan
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Loading screen
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>Loading floor plan...</p>
      </div>
    )
  }

  // Error screen
  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorCard}>
          <X size={48} className={styles.errorIcon} />
          <h2>Unable to Load Floor Plan</h2>
          <p>{error}</p>
          <a href="/" className={styles.homeButton}>
            <Home size={18} />
            Go to Home
          </a>
        </div>
      </div>
    )
  }

  if (!floorPlan) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorCard}>
          <Map size={48} className={styles.errorIcon} />
          <h2>Floor Plan Not Found</h2>
          <p>The floor plan you're looking for doesn't exist or has been removed.</p>
          <a href="/" className={styles.homeButton}>
            <Home size={18} />
            Go to Home
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.viewerContainer} ref={containerRef}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>Q</span>
            <span className={styles.logoText}>Qtime</span>
          </div>
          <div className={styles.divider} />
          <div className={styles.floorInfo}>
            <Building2 size={18} />
            <span className={styles.buildingName}>{floorPlan.buildings?.name || 'Building'}</span>
            <ChevronRight size={14} />
            <Layers size={18} />
            <span className={styles.floorName}>{floorPlan.floor_name || `Floor ${floorPlan.floor_number}`}</span>
          </div>
        </div>
        
        <div className={styles.headerRight}>
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
          
          <div className={styles.divider} />
          
          <button 
            className={`${styles.iconButton} ${showGrid ? styles.active : ''}`}
            onClick={() => setShowGrid(!showGrid)}
            title="Toggle Grid"
          >
            <Grid size={18} />
          </button>
          
          <button 
            className={styles.iconButton}
            onClick={() => setShowInfo(!showInfo)}
            title="Floor Plan Info"
          >
            <Info size={18} />
          </button>
          
          <button 
            className={styles.iconButton}
            onClick={handlePrint}
            title="Print"
          >
            <Printer size={18} />
          </button>
        </div>
      </header>

      {/* Info Panel */}
      {showInfo && shareData && (
        <div className={styles.infoPanel}>
          <div className={styles.infoPanelHeader}>
            <h3>Floor Plan Information</h3>
            <button onClick={() => setShowInfo(false)}>
              <X size={18} />
            </button>
          </div>
          <div className={styles.infoPanelContent}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Name:</span>
              <span>{shareData.share_name}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Building:</span>
              <span>{floorPlan.buildings?.name || 'Unknown'}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Floor:</span>
              <span>{floorPlan.floor_name || `Floor ${floorPlan.floor_number}`}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Canvas Size:</span>
              <span>{floorPlan.canvas_width} × {floorPlan.canvas_height}px</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Elements:</span>
              <span>{floorPlan.elements?.length || 0}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Views:</span>
              <span>{shareData.view_count}</span>
            </div>
          </div>
        </div>
      )}

      {/* Canvas Area */}
      <div 
        className={styles.canvasContainer}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          ref={canvasRef}
          className={styles.canvas}
          style={{
            width: (floorPlan.canvas_width || 1200) * zoom,
            height: (floorPlan.canvas_height || 800) * zoom,
            transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
            backgroundColor: floorPlan.background_color || '#FFFFFF',
            backgroundImage: showGrid 
              ? `linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px),
                 linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)`
              : 'none',
            backgroundSize: showGrid ? `${(floorPlan.grid_size || 20) * zoom}px ${(floorPlan.grid_size || 20) * zoom}px` : 'auto',
            cursor: isPanning ? 'grabbing' : 'grab'
          }}
        >
          {/* Background Image */}
          {floorPlan.background_image_url && (
            <img 
              src={floorPlan.background_image_url} 
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
            {floorPlan.elements?.map(renderElement)}
          </div>
        </div>
      </div>

      {/* Selected Element Info Bar */}
      {selectedElement && !showRoomDetails && (
        <div className={styles.elementInfoBar}>
          <div className={styles.elementType}>
            {selectedElement.type === 'room' && <Square size={16} />}
            {selectedElement.type === 'text' && <Type size={16} />}
            {selectedElement.type === 'icon' && <DoorOpen size={16} />}
            {selectedElement.type === 'shape' && <Circle size={16} />}
            {selectedElement.type === 'hallway' && <MapPin size={16} />}
            {selectedElement.type === 'stair' && <ArrowUpDown size={16} />}
            {selectedElement.type === 'elevator' && <Building size={16} />}
            {selectedElement.type === 'entrance' && <DoorOpen size={16} />}
            {selectedElement.type === 'restroom' && <Users size={16} />}
            <span>{selectedElement.type.toUpperCase()}</span>
          </div>
          {selectedElement.label && (
            <div className={styles.elementLabel}>
              <strong>{selectedElement.label}</strong>
            </div>
          )}
          {selectedElement.linkedRoomData && (
            <button 
              className={styles.viewDetailsBtn}
              onClick={() => setShowRoomDetails(true)}
            >
              <Info size={14} />
              View Details
            </button>
          )}
          <button className={styles.closeBtn} onClick={() => setSelectedElement(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Room Details Modal */}
      {showRoomDetails && selectedElement && selectedElement.linkedRoomData && (
        <div className={styles.modalOverlay} onClick={() => setShowRoomDetails(false)}>
          <div className={styles.roomDetailsModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>
                <Square size={20} />
                {selectedElement.label || 'Room Details'}
              </h2>
              <button onClick={() => setShowRoomDetails(false)}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalContent}>
              <div className={styles.detailsGrid}>
                <div className={styles.detailItem}>
                  <div className={styles.detailIcon}>
                    <MapPin size={18} />
                  </div>
                  <div className={styles.detailInfo}>
                    <span className={styles.detailLabel}>Room Name</span>
                    <span className={styles.detailValue}>{selectedElement.linkedRoomData.name || selectedElement.label}</span>
                  </div>
                </div>
                
                <div className={styles.detailItem}>
                  <div className={styles.detailIcon}>
                    <Building2 size={18} />
                  </div>
                  <div className={styles.detailInfo}>
                    <span className={styles.detailLabel}>Building</span>
                    <span className={styles.detailValue}>{selectedElement.linkedRoomData.building || 'N/A'}</span>
                  </div>
                </div>
                
                <div className={styles.detailItem}>
                  <div className={styles.detailIcon}>
                    <Users size={18} />
                  </div>
                  <div className={styles.detailInfo}>
                    <span className={styles.detailLabel}>Capacity</span>
                    <span className={styles.detailValue}>{selectedElement.linkedRoomData.capacity || 'N/A'} people</span>
                  </div>
                </div>
                
                {selectedElement.linkedRoomData.room_type && (
                  <div className={styles.detailItem}>
                    <div className={styles.detailIcon}>
                      <Layers size={18} />
                    </div>
                    <div className={styles.detailInfo}>
                      <span className={styles.detailLabel}>Room Type</span>
                      <span className={styles.detailValue}>{selectedElement.linkedRoomData.room_type}</span>
                    </div>
                  </div>
                )}
                
                {selectedElement.linkedRoomData.floor && (
                  <div className={styles.detailItem}>
                    <div className={styles.detailIcon}>
                      <Layers size={18} />
                    </div>
                    <div className={styles.detailInfo}>
                      <span className={styles.detailLabel}>Floor</span>
                      <span className={styles.detailValue}>{selectedElement.linkedRoomData.floor}</span>
                    </div>
                  </div>
                )}
                
                {selectedElement.linkedRoomData.department && (
                  <div className={styles.detailItem}>
                    <div className={styles.detailIcon}>
                      <GraduationCap size={18} />
                    </div>
                    <div className={styles.detailInfo}>
                      <span className={styles.detailLabel}>Department</span>
                      <span className={styles.detailValue}>{selectedElement.linkedRoomData.department}</span>
                    </div>
                  </div>
                )}
                
                {selectedElement.linkedRoomData.equipment && (
                  <div className={styles.detailItem}>
                    <div className={styles.detailIcon}>
                      <Monitor size={18} />
                    </div>
                    <div className={styles.detailInfo}>
                      <span className={styles.detailLabel}>Equipment</span>
                      <span className={styles.detailValue}>{selectedElement.linkedRoomData.equipment}</span>
                    </div>
                  </div>
                )}
                
                {selectedElement.linkedRoomData.availability !== undefined && (
                  <div className={styles.detailItem}>
                    <div className={styles.detailIcon}>
                      <Clock size={18} />
                    </div>
                    <div className={styles.detailInfo}>
                      <span className={styles.detailLabel}>Availability</span>
                      <span className={`${styles.detailValue} ${selectedElement.linkedRoomData.availability ? styles.available : styles.unavailable}`}>
                        {selectedElement.linkedRoomData.availability ? 'Available' : 'Not Available'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              
              {selectedElement.linkedRoomData.description && (
                <div className={styles.descriptionSection}>
                  <h4>Description</h4>
                  <p>{selectedElement.linkedRoomData.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className={styles.footer}>
        <span>Shared via Qtime Scheduler</span>
        <span className={styles.viewCount}>
          <Eye size={14} />
          {shareData?.view_count || 0} views
        </span>
      </footer>
    </div>
  )
}
