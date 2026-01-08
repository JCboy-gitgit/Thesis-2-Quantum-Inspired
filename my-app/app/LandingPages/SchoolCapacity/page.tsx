'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import { 
  Building2, 
  ArrowLeft, 
  Search, 
  Calendar,
  Plus,
  Check,
  X,
  Users,
  BarChart3,
  DoorOpen,
  Settings,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  MapPin,
  Hash,
  AlertTriangle,
  School,
  Home,
  Landmark,
  Hotel,
  University
} from 'lucide-react'
import './styles.css'
import { RiBuilding3Fill } from 'react-icons/ri'

interface CampusFile {
  upload_group_id: number
  school_name: string
  file_name: string
  created_at: string
  row_count: number
}

interface CampusRoom {
  id?: number
  campus: string
  building: string
  room: string
  capacity: number
  upload_group_id?: number
  school_name?: string
  file_name?: string
}

interface CampusStats {
  totalRooms: number
  totalCapacity: number
  avgCapacity: number
  buildings: number
}

interface ParsedRoom {
  original: string
  floor: number
  roomNumber: number
  displayName: string
}

// Update the RoomUsage interface
interface RoomUsage {
  roomId: string
  assignedSeats: number
  capacity: number
  isOverbooked: boolean
  utilizationPercent: number
  batchCount: number
}

export default function SchoolCapacityPage() {
  const router = useRouter()
  
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [campusFiles, setCampusFiles] = useState<CampusFile[]>([])
  const [selectedCampus, setSelectedCampus] = useState<number | null>(null)
  const [campusData, setCampusData] = useState<CampusRoom[]>([])
  const [stats, setStats] = useState<CampusStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedBuildings, setExpandedBuildings] = useState<Set<string>>(new Set())
  
  // CRUD states
  const [showActionsFor, setShowActionsFor] = useState<number | null>(null)
  const [editingRoom, setEditingRoom] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<CampusRoom>({
    campus: '',
    building: '',
    room: '',
    capacity: 0
  })
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState<CampusRoom>({
    campus: '',
    building: '',
    room: '',
    capacity: 0
  })
  const [deletingRoom, setDeletingRoom] = useState<number | null>(null)

  // Delete campus states
  const [showDeleteCampusModal, setShowDeleteCampusModal] = useState(false)
  const [campusToDelete, setCampusToDelete] = useState<CampusFile | null>(null)
  const [deletingCampus, setDeletingCampus] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  // Add state for room usage (add this with other useState declarations)
  const [roomUsage, setRoomUsage] = useState<Map<string, RoomUsage>>(new Map())

  // NEW: Track selected campus name (not just groupId)
  const [selectedCampusName, setSelectedCampusName] = useState<string | null>(null)
  const [campusGroups, setCampusGroups] = useState<Map<string, CampusRoom[]>>(new Map())
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null)
  const [campusesExpanded, setCampusesExpanded] = useState(true)
  // NEW: Track expanded state for each campus
  const [expandedCampuses, setExpandedCampuses] = useState<Map<string, boolean>>(new Map())

  useEffect(() => {
    fetchCampusFiles()
  }, [])

  const fetchCampusFiles = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('campuses')
        .select('upload_group_id, school_name, file_name, created_at')
        .order('created_at', { ascending: false })

      if (error) throw error

      const grouped = data?.reduce((acc: any[], curr) => {
        const existing = acc.find(item => item.upload_group_id === curr.upload_group_id)
        if (existing) {
          existing.row_count++
        } else {
          acc.push({
            upload_group_id: curr.upload_group_id,
            school_name: curr.school_name,
            file_name: curr.file_name,
            created_at: curr.created_at,
            row_count: 1
          })
        }
        return acc
      }, [])

      setCampusFiles(grouped || [])
    } catch (error) {
      console.error('Error fetching campus files:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch all rooms for a school (by upload_group_id)
  const handleSelectSchool = async (groupId: number) => {
    setSelectedCampus(groupId)
    setSelectedCampusName(null)
    setCampusGroups(new Map())
    setSelectedBuilding(null)
    setLoadingData(true)
    try {
      const { data, error } = await supabase
        .from('campuses')
        .select('*')
        .eq('upload_group_id', groupId)
        .order('campus', { ascending: true })
        .order('building', { ascending: true })
        .order('room', { ascending: true })

      if (error) throw error

      setCampusData(data || [])
      calculateStats(data || [])

      // Group by campus name
      const groups = new Map<string, CampusRoom[]>()
      ;(data || []).forEach((room: CampusRoom) => {
        const campusName: string = room.campus || 'Unknown Campus'
        if (!groups.has(campusName)) groups.set(campusName, [])
        groups.get(campusName)!.push(room)
      })
      setCampusGroups(groups)

      // Hide all campuses by default when a school is selected
      const collapsedMap = new Map<string, boolean>()
      groups.forEach((_, campusName) => {
        collapsedMap.set(campusName, false) // false = collapsed
      })
      setExpandedCampuses(collapsedMap)
    } catch (error) {
      console.error('Error fetching campus data:', error)
    } finally {
      setLoadingData(false)
    }
  }

  // When a campus is selected, show its buildings
  const handleSelectCampus = (campusName: string) => {
    setSelectedCampusName(campusName)
    setSelectedBuilding(null)
  }

  // When a building is selected, show its rooms
  const handleSelectBuilding = (buildingName: string) => {
    setSelectedBuilding(buildingName)
  }

  // Helper: Get buildings for selected campus
  const getBuildingsForCampus = (campusName: string) => {
    const rooms = campusGroups.get(campusName) || []
    const buildings = new Map<string, CampusRoom[]>()
    rooms.forEach(room => {
      const buildingName = room.building || 'Unknown Building'
      if (!buildings.has(buildingName)) buildings.set(buildingName, [])
      buildings.get(buildingName)!.push(room)
    })
    return buildings
  }

  // Helper: Get rooms for selected building
  const getRoomsForBuilding = (campusName: string, buildingName: string) => {
    const buildings = getBuildingsForCampus(campusName)
    return buildings.get(buildingName) || []
  }

  const handleSelectCampusOld = async (groupId: number) => {
    if (selectedCampus === groupId) {
      setSelectedCampus(null)
      setCampusData([])
      setStats(null)
      setExpandedBuildings(new Set())
      setRoomUsage(new Map()) // ✅ Clear room usage
      return
    }

    setSelectedCampus(groupId)
    setLoadingData(true)
    setExpandedBuildings(new Set())
    
    try {
      const { data, error } = await supabase
        .from('campuses')
        .select('*')
        .eq('upload_group_id', groupId)
        .order('building', { ascending: true })
        .order('room', { ascending: true })

      if (error) throw error

      setCampusData(data || [])
      calculateStats(data || [])
      
      // ✅ Fetch room usage data from schedule_batches
      const usage = await fetchRoomUsage(groupId)
      setRoomUsage(usage)
    } catch (error) {
      console.error('Error fetching campus data:', error)
    } finally {
      setLoadingData(false)
    }
  }

  const fetchRoomUsage = async (campusGroupId: number): Promise<Map<string, RoomUsage>> => {
    try {
      // Get all schedule summaries for this campus group
      const { data: summaries, error: summaryError } = await supabase
        .from('schedule_summary')
        .select('id')
        .eq('campus_group_id', campusGroupId)
        .eq('status', 'completed')

      if (summaryError) throw summaryError
      if (!summaries || summaries.length === 0) return new Map()

      const summaryIds = summaries.map(s => s.id)

      // Get all batches from schedule_batches
      const { data: batches, error: batchError } = await supabase
        .from('schedule_batches')
        .select('room, participant_count, schedule_summary_id')
        .in('schedule_summary_id', summaryIds)

      if (batchError) throw batchError

      // Get room capacities from campuses table
      const { data: rooms, error: roomError } = await supabase
        .from('campuses')
        .select('room, capacity')
        .eq('upload_group_id', campusGroupId)

      if (roomError) throw roomError

      // Create a map of room capacities
      const capacityMap = new Map<string, number>()
      rooms?.forEach(room => {
        capacityMap.set(room.room, room.capacity)
      })

      // Calculate usage per room
      const usageMap = new Map<string, RoomUsage>()
      
      batches?.forEach(batch => {
        const roomKey = batch.room
        const capacity = capacityMap.get(roomKey) || 0
        
        if (!usageMap.has(roomKey)) {
          usageMap.set(roomKey, {
            roomId: roomKey,
            assignedSeats: 0,
            capacity: capacity,
            isOverbooked: false,
            utilizationPercent: 0,
            batchCount: 0
          })
        }
        
        const usage = usageMap.get(roomKey)!
        usage.assignedSeats += batch.participant_count
        usage.batchCount++
        usage.utilizationPercent = capacity > 0 
          ? Math.round((usage.assignedSeats / capacity) * 100) 
          : 0
        usage.isOverbooked = usage.assignedSeats > capacity
      })

      return usageMap
    } catch (error) {
      console.error('Error fetching room usage from schedule_batches:', error)
      return new Map()
    }
  }

  const calculateStats = (data: CampusRoom[]) => {
    const totalRooms = data.length
    const totalCapacity = data.reduce((sum, room) => sum + room.capacity, 0)
    const avgCapacity = totalRooms > 0 ? Math.round(totalCapacity / totalRooms) : 0
    const buildings = new Set(data.map(room => room.building)).size

    setStats({
      totalRooms,
      totalCapacity,
      avgCapacity,
      buildings
    })
  }

  const parseRoomNumber = (roomName: string): ParsedRoom => {
    const match = roomName.match(/\d+/)
    if (!match) {
      return {
        original: roomName,
        floor: 0,
        roomNumber: 0,
        displayName: roomName
      }
    }

    const number = match[0]
    const floor = parseInt(number.charAt(0))
    const roomNum = parseInt(number.slice(1))
    
    const floorName = floor === 1 ? '1st' : floor === 2 ? '2nd' : floor === 3 ? '3rd' : `${floor}th`
    
    return {
      original: roomName,
      floor: floor,
      roomNumber: roomNum,
      displayName: `Room ${roomNum}, ${floorName} Floor`
    }
  }

  // CRUD Operations
  const handleEditClick = (room: CampusRoom) => {
    setEditingRoom(room.id!)
    setEditForm({
      campus: room.campus,
      building: room.building,
      room: room.room,
      capacity: room.capacity
    })
    setShowActionsFor(null)
  }

  const handleEditCancel = () => {
    setEditingRoom(null)
    setEditForm({
      campus: '',
      building: '',
      room: '',
      capacity: 0
    })
  }

  const handleEditSave = async (roomId: number) => {
    try {
      const { error } = await supabase
        .from('campuses')
        .update({
          campus: editForm.campus,
          building: editForm.building,
          room: editForm.room,
          capacity: editForm.capacity
        })
        .eq('id', roomId)

      if (error) throw error

      const updatedData = campusData.map(room => 
        room.id === roomId ? { ...room, ...editForm } : room
      )
      setCampusData(updatedData)
      calculateStats(updatedData)
      setEditingRoom(null)
    } catch (error) {
      console.error('Error updating room:', error)
      alert('Failed to update room')
    }
  }

  const handleDelete = async (roomId: number) => {
    if (!confirm('Are you sure you want to delete this room?')) return

    setDeletingRoom(roomId)
    setShowActionsFor(null)
    try {
      const { error } = await supabase
        .from('campuses')
        .delete()
        .eq('id', roomId)

      if (error) throw error

      const updatedData = campusData.filter(room => room.id !== roomId)
      setCampusData(updatedData)
      calculateStats(updatedData)
    } catch (error) {
      console.error('Error deleting room:', error)
      alert('Failed to delete room')
    } finally {
      setDeletingRoom(null)
    }
  }

  const handleAddRoom = async () => {
    if (!selectedCampus) return
    if (!addForm.campus || !addForm.building || !addForm.room || addForm.capacity <= 0) {
      alert('Please fill in all fields')
      return
    }

    try {
      const selectedFile = campusFiles.find(f => f.upload_group_id === selectedCampus)
      
      const { data, error } = await supabase
        .from('campuses')
        .insert([{
          upload_group_id: selectedCampus,
          campus: addForm.campus,
          building: addForm.building,
          room: addForm.room,
          capacity: addForm.capacity,
          school_name: selectedFile?.school_name || '',
          file_name: selectedFile?.file_name || ''
        }])
        .select()

      if (error) throw error

      if (data && data.length > 0) {
        const updatedData = [...campusData, data[0]]
        setCampusData(updatedData)
        calculateStats(updatedData)
      }

      setAddForm({
        campus: '',
        building: '',
        room: '',
        capacity: 0
      })
      setShowAddModal(false)
    } catch (error) {
      console.error('Error adding room:', error)
      alert('Failed to add room')
    }
  }

  const handleDeleteCampusClick = (e: React.MouseEvent, campus: CampusFile) => {
    e.stopPropagation()
    setCampusToDelete(campus)
    setShowDeleteCampusModal(true)
  }

  const handleDeleteCampus = async () => {
    if (!campusToDelete) return

    setDeletingCampus(true)
    try {
      console.log(`🗑️ Deleting campus ${campusToDelete.upload_group_id}...`)

      // Delete all rooms in this campus
      const { error } = await supabase
        .from('campuses')
        .delete()
        .eq('upload_group_id', campusToDelete.upload_group_id)

      if (error) throw error

      // If the deleted campus was selected, clear selection
      if (selectedCampus === campusToDelete.upload_group_id) {
        setSelectedCampus(null)
        setCampusData([])
        setStats(null)
        setExpandedBuildings(new Set())
      }

      // Refresh the campus list
      await fetchCampusFiles()

      setSuccessMessage(`✅ Campus "${campusToDelete.school_name}" deleted successfully!`)
      setTimeout(() => setSuccessMessage(''), 3000)
      
      setShowDeleteCampusModal(false)
      setCampusToDelete(null)
    } catch (error) {
      console.error('❌ Error deleting campus:', error)
      setSuccessMessage('❌ Failed to delete campus')
      setTimeout(() => setSuccessMessage(''), 3000)
    } finally {
      setDeletingCampus(false)
    }
  }

  const getFilteredFiles = () => {
    if (!searchTerm) return campusFiles
    return campusFiles.filter(file => 
      file.school_name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }

  // FIX: Group buildings by campus, not just by building name
  const getBuildingGroups = () => {
    // Map: buildingKey (campus|building) -> rooms[]
    const groups = new Map<string, CampusRoom[]>()
    campusData.forEach(room => {
      // Use a composite key to ensure uniqueness per campus
      const campusName = room.campus || 'Unknown Campus'
      const buildingName = room.building || 'Unknown Building'
      const buildingKey = `${campusName}|||${buildingName}`
      if (!groups.has(buildingKey)) {
        groups.set(buildingKey, [])
      }
      groups.get(buildingKey)!.push(room)
    })
    return groups
  }

  const toggleBuilding = (buildingKey: string) => {
    const newExpanded = new Set(expandedBuildings)
    if (newExpanded.has(buildingKey)) {
      newExpanded.delete(buildingKey)
    } else {
      newExpanded.add(buildingKey)
    }
    setExpandedBuildings(newExpanded)
  }

  const groupRoomsByFloor = (rooms: CampusRoom[]) => {
    const floorGroups = new Map<number, CampusRoom[]>()
    
    rooms.forEach(room => {
      const parsed = parseRoomNumber(room.room)
      if (!floorGroups.has(parsed.floor)) {
        floorGroups.set(parsed.floor, [])
      }
      floorGroups.get(parsed.floor)?.push(room)
    })

    return new Map([...floorGroups.entries()].sort((a, b) => a[0] - b[0]))
  }

  const toggleActionsMenu = (roomId: number) => {
    setShowActionsFor(showActionsFor === roomId ? null : roomId)
  }

  // Helper: Arrange campusData by campus > building > rooms
  const getCampusHierarchy = (): Map<string, Map<string, CampusRoom[]>> => {
    // Map: campusName -> buildingName -> rooms[]
    const hierarchy = new Map<string, Map<string, CampusRoom[]>>()
    campusData.forEach(room => {
      const campusName = room.campus || 'Unknown Campus'
      const buildingName = room.building || 'Unknown Building'
      if (!hierarchy.has(campusName)) {
        hierarchy.set(campusName, new Map())
      }
      const buildingMap = hierarchy.get(campusName)!
      if (!buildingMap.has(buildingName)) {
        buildingMap.set(buildingName, [])
      }
      buildingMap.get(buildingName)!.push(room)
    })
    return hierarchy
  }

  // Helper: Arrange all campusData by campus > building > rooms (for diagnostics)
  const getAllCampusHierarchy = (): Map<string, Map<string, CampusRoom[]>> => {
    const hierarchy = new Map<string, Map<string, CampusRoom[]>>()
    campusData.forEach(room => {
      const campusName = room.campus || 'Unknown Campus'
      const buildingName = room.building || 'Unknown Building'
      if (!hierarchy.has(campusName)) {
        hierarchy.set(campusName, new Map())
      }
      const buildingMap = hierarchy.get(campusName)!
      if (!buildingMap.has(buildingName)) {
        buildingMap.set(buildingName, [])
      }
      buildingMap.get(buildingName)!.push(room)
    })
    return hierarchy
  }

  // Helper: Calculate stats per campus
  const getCampusStats = (): Map<string, CampusStats> => {
    const statsMap = new Map<string, CampusStats>()
    const hierarchy = getAllCampusHierarchy()
    hierarchy.forEach((buildingsMap, campusName) => {
      let totalRooms = 0
      let totalCapacity = 0
      let buildings = buildingsMap.size
      buildingsMap.forEach(rooms => {
        totalRooms += rooms.length
        totalCapacity += rooms.reduce((sum, room) => sum + room.capacity, 0)
      })
      const avgCapacity = totalRooms > 0 ? Math.round(totalCapacity / totalRooms) : 0
      statsMap.set(campusName, { totalRooms, totalCapacity, avgCapacity, buildings })
    })
    return statsMap
  }

  // Helper: Calculate overall stats for the selected file
  const getFileStats = () => {
    const totalCampuses = campusGroups.size
    let totalBuildings = 0
    let totalRooms = 0
    let totalCapacity = 0

    campusGroups.forEach((rooms, campusName) => {
      const buildings = getBuildingsForCampus(campusName)
      totalBuildings += buildings.size
      totalRooms += rooms.length
      totalCapacity += rooms.reduce((sum, room) => sum + room.capacity, 0)
    })

    const avgCapacity = totalRooms > 0 ? Math.round(totalCapacity / totalRooms) : 0

    return { totalCampuses, totalBuildings, totalRooms, totalCapacity, avgCapacity }
  }

  return (
    <div className="campus-layout">
      <MenuBar 
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
        showSidebarToggle={true}
        showAccountIcon={true}
      />
      <Sidebar isOpen={sidebarOpen} />
      
      <main className={`campus-main ${sidebarOpen ? 'with-sidebar' : 'full-width'}`}>
        <div className="campus-container">
          {/* Success Message */}
          {successMessage && (
            <div className={`success-message ${successMessage.includes('❌') ? 'error' : 'success'}`}>
              {successMessage}
            </div>
          )}
            <button 
              className="back-button"
              onClick={() => router.push('/LandingPages/QtimeHomePage')}
            >
              <ArrowLeft size={18} />
              Back to Home
            </button>
          <div className="campus-header">
            <div className="header-title-section">
              <div className="header-icon-wrapper">
                <University className="header-large-icon" size={48} />
              </div>
              <div className="header-text">
                <h1 className="campus-title">School Capacity Overview</h1>
                <p className="campus-subtitle">Select a school to view and manage room information</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading-screen">
              <div className="spinner"></div>
              <p>Loading your data...</p>
            </div>
          ) : (
            <>
              <div className="selection-section">
                <div className="search-header">
                  <h2>
                    <University size={24} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
                    Select School
                  </h2>
                  <div className="search-box">
                    <Search className="search-icon" size={18} />
                    <input
                      type="text"
                      placeholder="Search school..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="search-input"
                    />
                  </div>
                </div>

                <div className="campus-cards-grid">
                  {getFilteredFiles().map(file => (
                    <div 
                      key={file.upload_group_id}
                      className={`campus-select-card ${selectedCampus === file.upload_group_id ? 'selected' : ''}`}
                      onClick={() => handleSelectSchool(file.upload_group_id)}
                    >
                      <div className="campus-card-icon school-icon">
                        <University size={36} />
                      </div>
                      <div className="campus-card-content">
                        <h3 className="campus-card-name">{file.school_name}</h3>
                        <p className="campus-card-meta">
                          <DoorOpen size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                          {file.row_count} rooms available
                        </p>
                        <p className="campus-card-date">
                          <Calendar size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                          Uploaded: {new Date(file.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {selectedCampus === file.upload_group_id && (
                        <div className="selected-indicator">
                          <Check size={20} />
                        </div>
                      )}
                      <button
                        className="delete-campus-btn"
                        onClick={(e) => handleDeleteCampusClick(e, file)}
                        title="Delete entire campus"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>

                {getFilteredFiles().length === 0 && (
                  <div className="empty-results">
                    <p>No schools found matching "{searchTerm}"</p>
                  </div>
                )}
              </div>

              {selectedCampus && (
                <>
                  {loadingData ? (
                    <div className="loading-state">
                      <div className="spinner"></div>
                      <p>Loading campus data...</p>
                    </div>
                  ) : (
                    <>
                      {/* Stats Grid */}
                      {stats && (
                        <div className="stats-grid">
                          <div className="stat-card">
                            <div className="stat-icon">
                              <Landmark size={28} /> {/* Campus icon */}
                            </div>
                            <div className="stat-content">
                              <p className="stat-label">Total Campuses</p>
                              <h3 className="stat-value">{getFileStats().totalCampuses}</h3>
                            </div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-icon">
                              <Hotel size={28} /> {/* Building icon */}
                            </div>
                            <div className="stat-content">
                              <p className="stat-label">Total Buildings</p>
                              <h3 className="stat-value">{getFileStats().totalBuildings}</h3>
                            </div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-icon">
                              <DoorOpen size={28} /> {/* Room icon */}
                            </div>
                            <div className="stat-content">
                              <p className="stat-label">Total Rooms</p>
                              <h3 className="stat-value">{getFileStats().totalRooms}</h3>
                            </div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-icon">
                              <Users size={28} /> {/* Capacity icon */}
                            </div>
                            <div className="stat-content">
                              <p className="stat-label">Total Capacity</p>
                              <h3 className="stat-value">{getFileStats().totalCapacity}</h3>
                            </div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-icon">
                              <BarChart3 size={28} /> {/* Avg Capacity icon */}
                            </div>
                            <div className="stat-content">
                              <p className="stat-label">Avg Capacity</p>
                              <h3 className="stat-value">{getFileStats().avgCapacity}</h3>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="data-section">
                        <div className="section-header-actions">
                          <h2 className="section-heading">
                            <Landmark size={24} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
                            Campuses & Buildings
                          </h2>
                          <div style={{ display: 'flex', gap: 10 }}>
                            <button
                              className="toggle-campuses-btn"
                              onClick={() => setCampusesExpanded((prev) => !prev)}
                            >
                              {campusesExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                              {campusesExpanded ? 'Hide Campuses' : 'Show Campuses'}
                            </button>
                            <button 
                              className="add-room-button"
                              onClick={() => setShowAddModal(true)}
                            >
                              <Plus size={20} />
                              Add New Room
                            </button>
                          </div>
                        </div>

                        {/* Campuses -> Buildings -> Rooms */}
                        {campusesExpanded && Array.from(campusGroups.entries())
                          .sort(([aName], [bName]) => aName.localeCompare(bName))
                          .map(([campusName, rooms]) => {
                            const buildings = getBuildingsForCampus(campusName)
                            const isCampusExpanded = expandedCampuses.get(campusName) ?? true
                            function toggleCampus(campusName: string): void {
                              setExpandedCampuses(prev => {
                              const newMap = new Map(prev)
                              newMap.set(campusName, !(prev.get(campusName) ?? true))
                              return newMap
                              })
                            }

                            return (
                              <div key={campusName} className="campus-section" style={{ marginBottom: 28 }}>
                                <div className="campus-header" style={{ fontWeight: 600, fontSize: 20, marginBottom: 8 }}>
                                <Landmark size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                                  {campusName}
                                  <span style={{ marginLeft: 14, color: '#888', fontSize: 15 }}>
                                    {buildings.size} buildings
                                  </span>
                                  <button
                                    className="toggle-campus-btn"
                                    style={{ marginLeft: 'auto', marginRight: 0 }}
                                    onClick={() => toggleCampus(campusName)}
                                  >
                                    {isCampusExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    {isCampusExpanded ? 'Hide' : 'Show'}
                                  </button>
                                </div>
                                {/* Buildings inside campus */}
                                {isCampusExpanded && Array.from(buildings.entries())
                                  .sort(([aName], [bName]) => aName.localeCompare(bName))
                                  .map(([buildingName, buildingRooms]) => {
                                    const buildingKey = `${campusName}|||${buildingName}`
                                    const isExpanded = expandedBuildings.has(buildingKey)
                                    const floorGroups = groupRoomsByFloor(buildingRooms)
                                    const buildingCapacity = buildingRooms.reduce((sum, room) => sum + room.capacity, 0)
                                    return (
                                      <div key={buildingKey} className="building-section" style={{ marginLeft: 24 }}>
                                        <div 
                                          className="building-header clickable"
                                          onClick={() => toggleBuilding(buildingKey)}
                                        >
                                          <h3 className="building-name">
                                            <span className="expand-icon">
                                              {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                            </span>
                                            <Hotel size={20} style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: '4px', marginRight: '8px' }} />
                                            {buildingName}
                                          </h3>
                                          <span className="room-badge">{buildingRooms.length} rooms</span>
                                          <span className="capacity-badge-small">Total: {buildingCapacity}</span>
                                          <button className="expand-button">
                                            {isExpanded ? 'Hide' : 'Show'} Rooms
                                          </button>
                                        </div>
                                        {isExpanded && (
                                          <div className="building-content">
                                            {Array.from(floorGroups.entries()).map(([floor, floorRooms]) => {
                                              const floorName = floor === 1 ? '1st' : floor === 2 ? '2nd' : floor === 3 ? '3rd' : `${floor}th`
                                              const floorCapacity = floorRooms.reduce((sum, room) => sum + room.capacity, 0)
                                              return (
                                                <div key={floor} className="floor-section">
                                                  <div className="floor-header">
                                                    <h4 className="floor-name">
                                                      <MapPin size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                                                      {floorName} Floor
                                                    </h4>
                                                    <span className="floor-info">
                                                      {floorRooms.length} rooms · Capacity: {floorCapacity}
                                                    </span>
                                                  </div>
                                                  <div className="rooms-grid">
                                                    {floorRooms.map((room) => {
                                                      const parsed = parseRoomNumber(room.room)
                                                      const isEditing = editingRoom === room.id
                                                      const showActions = showActionsFor === room.id
                                                      const usage = roomUsage.get(room.room)
                                                      return (
                                                        <div
                                                          key={room.id}
                                                          className={`room-card ${isEditing ? 'editing' : ''}`}
                                                          onMouseLeave={() => {
                                                            // Only close if the popup is open for this room
                                                            if (showActionsFor === room.id) setShowActionsFor(null)
                                                          }}
                                                        >
                                                          {isEditing ? (
                                                            <div className="room-edit-form">
                                                              <input
                                                                type="text"
                                                                value={editForm.campus}
                                                                onChange={(e) => setEditForm({...editForm, campus: e.target.value})}
                                                                placeholder="Campus"
                                                                className="edit-input-small"
                                                              />
                                                              <input
                                                                type="text"
                                                                value={editForm.building}
                                                                onChange={(e) => setEditForm({...editForm, building: e.target.value})}
                                                                placeholder="Building"
                                                                className="edit-input-small"
                                                              />
                                                              <input
                                                                type="text"
                                                                value={editForm.room}
                                                                onChange={(e) => setEditForm({...editForm, room: e.target.value})}
                                                                placeholder="Room"
                                                                className="edit-input-small"
                                                              />
                                                              <input
                                                                type="number"
                                                                value={editForm.capacity}
                                                                onChange={(e) => setEditForm({...editForm, capacity: parseInt(e.target.value) || 0})}
                                                                placeholder="Capacity"
                                                                className="edit-input-small"
                                                              />
                                                              <div className="edit-actions">
                                                                <button 
                                                                  className="save-btn-small"
                                                                  onClick={() => handleEditSave(room.id!)}
                                                                >
                                                                  <Check size={16} />
                                                                  Save
                                                                </button>
                                                                <button 
                                                                  className="cancel-btn-small"
                                                                  onClick={handleEditCancel}
                                                                >
                                                                  <X size={16} />
                                                                  Cancel
                                                                </button>
                                                              </div>
                                                            </div>
                                                          ) : (
                                                            <>
                                                              <div className="room-icon">
                                                                <DoorOpen size={24} />
                                                              </div>
                                                              <div className="room-info">
                                                                <h4 className="room-name">{room.room}</h4>
                                                                <p className="room-parsed">{parsed.displayName}</p>
                                                                <p className="room-campus">
                                                                  <Building2 size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                                                                  {room.campus}
                                                                </p>
                                                                <p className="room-seats">
                                                                  <Users size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                                                                  Seats: {room.capacity}
                                                                </p>
                                                              </div>
                                                              <div className="room-capacity-badge">
                                                                {room.capacity}
                                                              </div>
                                                              
                                                              <div className="room-options">
                                                                <button 
                                                                  className="options-trigger"
                                                                  onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    toggleActionsMenu(room.id!)
                                                                  }}
                                                                  title="Options"
                                                                >
                                                                  <Settings size={18} />
                                                                </button>
                                                                {showActions && (
                                                                  <div className="actions-popup">
                                                                    <button 
                                                                      className="action-option edit-option"
                                                                      onClick={() => handleEditClick(room)}
                                                                    >
                                                                      <Edit2 size={16} />
                                                                      Edit Room
                                                                    </button>
                                                                    <button 
                                                                      className="action-option delete-option"
                                                                      onClick={() => handleDelete(room.id!)}
                                                                      disabled={deletingRoom === room.id}
                                                                    >
                                                                      <Trash2 size={16} />
                                                                      {deletingRoom === room.id ? 'Deleting...' : 'Delete Room'}
                                                                    </button>
                                                                  </div>
                                                                )}
                                                              </div>
                                                            </>
                                                          )}
                                                        </div>
                                                      )
                                                    })}
                                                  </div>
                                                </div>
                                              )
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )
                            })}
                        </div>
                      
                    </>
                  )}
                </>
              )}

              {!selectedCampus && !loading && campusFiles.length > 0 && (
                <div className="empty-selection">
                  <div className="empty-icon">
                    <Building2 size={80} />
                  </div>
                  <p>Please select a school above to view room details</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Add Room Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <Plus size={24} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
                Add New Room
              </h3>
              <button 
                className="modal-close"
                onClick={() => setShowAddModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>
                  <Building2 size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                  Campus
                </label>
                <input
                  type="text"
                  value={addForm.campus}
                  onChange={(e) => setAddForm({...addForm, campus: e.target.value})}
                  placeholder="e.g., Main Campus"
                  className="modal-input"
                />
              </div>
              <div className="form-group">
                <label>
                  <Building2 size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                  Building
                </label>
                <input
                  type="text"
                  value={addForm.building}
                  onChange={(e) => setAddForm({...addForm, building: e.target.value})}
                  placeholder="e.g., Building A"
                  className="modal-input"
                />
              </div>
              <div className="form-group">
                <label>
                  <DoorOpen size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                  Room
                </label>
                <input
                  type="text"
                  value={addForm.room}
                  onChange={(e) => setAddForm({...addForm, room: e.target.value})}
                  placeholder="e.g., 101"
                  className="modal-input"
                />
              </div>
              <div className="form-group">
                <label>
                  <Users size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                  Capacity
                </label>
                <input
                  type="number"
                  value={addForm.capacity || ''}
                  onChange={(e) => setAddForm({...addForm, capacity: parseInt(e.target.value) || 0})}
                  placeholder="e.g., 30"
                  className="modal-input"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="modal-btn-cancel"
                onClick={() => setShowAddModal(false)}
              >
                <X size={18} />
                Cancel
              </button>
              <button 
                className="modal-btn-save"
                onClick={handleAddRoom}
              >
                <Check size={18} />
                Add Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Campus Confirmation Modal */}
      {showDeleteCampusModal && campusToDelete && (
        <div className="modal-overlay" onClick={() => !deletingCampus && setShowDeleteCampusModal(false)}>
          <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header delete-header">
              <h3>
                <AlertTriangle size={24} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px', color: '#ef4444' }} />
                Delete Campus
              </h3>
              <button 
                className="modal-close"
                onClick={() => setShowDeleteCampusModal(false)}
                disabled={deletingCampus}
                title="Close modal"
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="delete-warning">
                <div className="warning-icon-wrapper">
                  <AlertTriangle size={64} className="warning-icon" />
                </div>
                <h4>Are you absolutely sure?</h4>
                <p>
                  You are about to permanently delete the campus:
                </p>
                <div className="delete-batch-info">
                  <strong>{campusToDelete.school_name}</strong>
                  <span>{campusToDelete.row_count} rooms</span>
                </div>
                <p className="warning-text">
                  This action <strong>CANNOT BE UNDONE</strong>. All {campusToDelete.row_count} rooms in this campus will be permanently removed from the database.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="modal-btn-cancel"
                onClick={() => setShowDeleteCampusModal(false)}
                disabled={deletingCampus}
              >
                <X size={18} />
                Cancel
              </button>
              <button 
                className="modal-btn-delete"
                onClick={handleDeleteCampus}
                disabled={deletingCampus}
              >
                <Trash2 size={18} />
                {deletingCampus ? 'Deleting...' : 'Delete Campus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}