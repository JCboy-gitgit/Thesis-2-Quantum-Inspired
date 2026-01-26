'use client'

import React, { useState, useEffect, useMemo } from 'react'
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
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  MapPin,
  University,
  Hotel,
  Landmark,
  Wind,
  Tv,
  PresentationIcon,
  CheckCircle2,
  XCircle,
  Wrench,
  Save,
  FileSpreadsheet,
  Layers,
  Filter
} from 'lucide-react'
import styles from './styles.module.css'

// ==================== INTERFACES ====================

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
  room_code?: string | null
  capacity: number
  floor_number?: number | null
  room_type?: string
  specific_classification?: string | null
  has_ac?: boolean | null
  has_whiteboard?: boolean | null
  has_tv?: boolean | null
  has_projector?: boolean | null
  status?: string | null
  notes?: string | null
  upload_group_id?: number
  school_name?: string
  file_name?: string
  college?: string | null
}

interface CampusStats {
  totalCampuses: number
  totalBuildings: number
  totalRooms: number
  totalCapacity: number
  avgCapacity: number
  usableRooms: number
  notUsableRooms: number
}

// ==================== HELPERS ====================

const displayValue = (value: any, defaultVal: string = 'None'): string => {
  if (value === null || value === undefined || value === '') return defaultVal
  return String(value)
}

const displayBool = (value: boolean | null | undefined): string => {
  if (value === null || value === undefined) return 'None'
  return value ? 'Yes' : 'No'
}

const getRoomStatusInfo = (status: string | null | undefined) => {
  switch (status?.toLowerCase()) {
    case 'usable':
    case 'available':
    case 'active':
      return { label: 'Usable', color: '#059669', bgColor: '#d1fae5', icon: 'check' as const }
    case 'not_usable':
    case 'unavailable':
    case 'inactive':
      return { label: 'Not Usable', color: '#dc2626', bgColor: '#fee2e2', icon: 'x' as const }
    case 'maintenance':
    case 'under_maintenance':
      return { label: 'Maintenance', color: '#d97706', bgColor: '#fef3c7', icon: 'wrench' as const }
    default:
      return { label: 'Usable', color: '#059669', bgColor: '#d1fae5', icon: 'check' as const }
  }
}

// ==================== COMPONENT ====================

export default function RoomsManagementPage() {
  const router = useRouter()

  // Layout states
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  // Navigation: 'files' -> 'campuses' -> 'buildings' -> 'rooms'
  const [currentView, setCurrentView] = useState<'files' | 'campuses' | 'buildings' | 'rooms'>('files')

  // Data states
  const [campusFiles, setCampusFiles] = useState<CampusFile[]>([])
  const [selectedFile, setSelectedFile] = useState<CampusFile | null>(null)
  const [allRooms, setAllRooms] = useState<CampusRoom[]>([])
  const [selectedCampusName, setSelectedCampusName] = useState<string | null>(null)
  const [selectedBuildingName, setSelectedBuildingName] = useState<string | null>(null)

  // Search & Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [filterBuilding, setFilterBuilding] = useState<string>('all')
  const [filterFloor, setFilterFloor] = useState<string>('all')
  const [filterRoomType, setFilterRoomType] = useState<string>('all')
  const [filterAC, setFilterAC] = useState(false)
  const [filterTV, setFilterTV] = useState(false)
  const [filterWhiteboard, setFilterWhiteboard] = useState(false)

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingRoom, setEditingRoom] = useState<CampusRoom | null>(null)
  const [showDeleteFileModal, setShowDeleteFileModal] = useState(false)
  const [fileToDelete, setFileToDelete] = useState<CampusFile | null>(null)
  const [deletingFile, setDeletingFile] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    campus: '',
    building: '',
    room: '',
    room_code: '',
    capacity: 30,
    floor_number: 1,
    room_type: 'Classroom',
    specific_classification: '',
    has_ac: false,
    has_whiteboard: true,
    has_tv: false,
    status: 'usable',
    notes: ''
  })

  // ==================== AUTH & INIT ====================

  useEffect(() => {
    checkAuth()
    fetchCampusFiles()
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

  // ==================== DATA FETCHING ====================

  const fetchCampusFiles = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('campuses')
        .select('upload_group_id, school_name, file_name, created_at')
        .order('created_at', { ascending: false })

      if (error) throw error

      const grouped = (data || []).reduce((acc: CampusFile[], curr: any) => {
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

      setCampusFiles(grouped)
    } catch (error) {
      console.error('Error fetching campus files:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRoomsForFile = async (groupId: number) => {
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
      setAllRooms(data || [])
    } catch (error) {
      console.error('Error fetching rooms:', error)
    } finally {
      setLoadingData(false)
    }
  }

  // ==================== NAVIGATION ====================

  const handleSelectFile = async (file: CampusFile) => {
    setSelectedFile(file)
    setCurrentView('campuses')
    await fetchRoomsForFile(file.upload_group_id)
  }

  const handleSelectCampus = (campusName: string) => {
    setSelectedCampusName(campusName)
    setCurrentView('buildings')
  }

  const handleSelectBuilding = (buildingName: string) => {
    setSelectedBuildingName(buildingName)
    setCurrentView('rooms')
  }

  const handleBack = () => {
    if (currentView === 'rooms') {
      setCurrentView('buildings')
      setSelectedBuildingName(null)
    } else if (currentView === 'buildings') {
      setCurrentView('campuses')
      setSelectedCampusName(null)
    } else if (currentView === 'campuses') {
      setCurrentView('files')
      setSelectedFile(null)
      setAllRooms([])
    }
  }

  // ==================== COMPUTED DATA ====================

  // Get unique campuses from allRooms
  const campusGroups = useMemo(() => {
    const groups = new Map<string, CampusRoom[]>()
    allRooms.forEach(room => {
      const campusName = room.campus || 'Unknown Campus'
      if (!groups.has(campusName)) groups.set(campusName, [])
      groups.get(campusName)!.push(room)
    })
    return groups
  }, [allRooms])

  // Get buildings for selected campus
  const buildingsForCampus = useMemo(() => {
    if (!selectedCampusName) return new Map<string, CampusRoom[]>()
    const rooms = campusGroups.get(selectedCampusName) || []
    const buildings = new Map<string, CampusRoom[]>()
    rooms.forEach(room => {
      const buildingName = room.building || 'Unknown Building'
      if (!buildings.has(buildingName)) buildings.set(buildingName, [])
      buildings.get(buildingName)!.push(room)
    })
    return buildings
  }, [campusGroups, selectedCampusName])

  // Get rooms for selected building
  const roomsForBuilding = useMemo(() => {
    if (!selectedCampusName || !selectedBuildingName) return []
    const buildings = buildingsForCampus
    return buildings.get(selectedBuildingName) || []
  }, [buildingsForCampus, selectedBuildingName])

  // Get unique values for filters
  const uniqueBuildings = useMemo(() => [...new Set(allRooms.map(r => r.building))].sort(), [allRooms])
  const uniqueFloors = useMemo(() => {
    const floors = new Set(allRooms.map(r => r.floor_number).filter(f => f !== null))
    return Array.from(floors).sort((a, b) => (a as number) - (b as number)) as number[]
  }, [allRooms])
  const uniqueRoomTypes = useMemo(() => [...new Set(allRooms.map(r => r.room_type).filter(t => t))].sort(), [allRooms])

  // Filtered rooms for search view
  const filteredRooms = useMemo(() => {
    return allRooms.filter(room => {
      // Search filter
      if (searchTerm) {
        const query = searchTerm.toLowerCase()
        const matchesSearch =
          room.room.toLowerCase().includes(query) ||
          room.building.toLowerCase().includes(query) ||
          room.campus.toLowerCase().includes(query) ||
          (room.room_code && room.room_code.toLowerCase().includes(query)) ||
          (room.room_type && room.room_type.toLowerCase().includes(query))
        if (!matchesSearch) return false
      }
      if (filterBuilding !== 'all' && room.building !== filterBuilding) return false
      if (filterFloor !== 'all' && room.floor_number !== parseInt(filterFloor)) return false
      if (filterRoomType !== 'all' && room.room_type !== filterRoomType) return false
      if (filterAC && !room.has_ac) return false
      if (filterTV && !room.has_tv) return false
      if (filterWhiteboard && !room.has_whiteboard) return false
      return true
    })
  }, [allRooms, searchTerm, filterBuilding, filterFloor, filterRoomType, filterAC, filterTV, filterWhiteboard])

  // Stats calculation
  const stats: CampusStats = useMemo(() => {
    const totalCampuses = campusGroups.size
    let totalBuildings = 0
    campusGroups.forEach((rooms) => {
      const buildings = new Set(rooms.map(r => r.building))
      totalBuildings += buildings.size
    })
    const totalRooms = allRooms.length
    const totalCapacity = allRooms.reduce((sum, r) => sum + r.capacity, 0)
    const avgCapacity = totalRooms > 0 ? Math.round(totalCapacity / totalRooms) : 0
    let usableRooms = 0
    let notUsableRooms = 0
    allRooms.forEach(room => {
      const status = room.status?.toLowerCase()
      if (status === 'not_usable' || status === 'unavailable' || status === 'inactive') {
        notUsableRooms++
      } else {
        usableRooms++
      }
    })
    return { totalCampuses, totalBuildings, totalRooms, totalCapacity, avgCapacity, usableRooms, notUsableRooms }
  }, [allRooms, campusGroups])

  const hasActiveFilters = filterBuilding !== 'all' || filterFloor !== 'all' || filterRoomType !== 'all' || filterAC || filterTV || filterWhiteboard

  const clearFilters = () => {
    setSearchTerm('')
    setFilterBuilding('all')
    setFilterFloor('all')
    setFilterRoomType('all')
    setFilterAC(false)
    setFilterTV(false)
    setFilterWhiteboard(false)
  }

  // ==================== CRUD OPERATIONS ====================

  const handleAddRoom = async () => {
    if (!selectedFile) return
    if (!formData.campus || !formData.building || !formData.room || formData.capacity <= 0) {
      alert('Please fill in all required fields')
      return
    }

    try {
      const { error } = await supabase
        .from('campuses')
        .insert({
          upload_group_id: selectedFile.upload_group_id,
          school_name: selectedFile.school_name,
          campus: formData.campus,
          building: formData.building,
          room: formData.room,
          room_code: formData.room_code || null,
          capacity: formData.capacity,
          floor_number: formData.floor_number || null,
          room_type: formData.room_type,
          specific_classification: formData.specific_classification || null,
          has_ac: Boolean(formData.has_ac),
          has_whiteboard: Boolean(formData.has_whiteboard),
          has_tv: Boolean(formData.has_tv),
          has_projector: false,
          status: formData.status || 'usable',
          notes: formData.notes || null,
          file_name: 'Manual Entry'
        })

      if (error) throw error

      setSuccessMessage('Room added successfully!')
      resetForm()
      await fetchRoomsForFile(selectedFile.upload_group_id)
      await fetchCampusFiles()
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      console.error('Error adding room:', error)
      alert(error.message || 'Failed to add room')
    }
  }

  const handleUpdateRoom = async () => {
    if (!editingRoom || !editingRoom.id) return

    try {
      const { error } = await supabase
        .from('campuses')
        .update({
          campus: formData.campus,
          building: formData.building,
          room: formData.room,
          room_code: formData.room_code || null,
          capacity: formData.capacity,
          floor_number: formData.floor_number || null,
          room_type: formData.room_type,
          specific_classification: formData.specific_classification || null,
          has_ac: Boolean(formData.has_ac),
          has_whiteboard: Boolean(formData.has_whiteboard),
          has_tv: Boolean(formData.has_tv),
          status: formData.status || 'usable',
          notes: formData.notes || null
        })
        .eq('id', editingRoom.id)

      if (error) throw error

      setSuccessMessage('Room updated successfully!')
      resetForm()
      if (selectedFile) await fetchRoomsForFile(selectedFile.upload_group_id)
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      console.error('Error updating room:', error)
      alert(error.message || 'Failed to update room')
    }
  }

  const handleDeleteRoom = async (room: CampusRoom) => {
    if (!room.id) return
    if (!confirm('Are you sure you want to delete this room?')) return

    try {
      // Archive first
      const { data: { user } } = await supabase.auth.getUser()
      await supabase
        .from('archived_items')
        .insert({
          item_type: 'room',
          item_name: `${room.building} - ${room.room}`,
          item_data: room,
          deleted_by: user?.id || null,
          original_table: 'campuses',
          original_id: String(room.id)
        })

      const { error } = await supabase
        .from('campuses')
        .delete()
        .eq('id', room.id)

      if (error) throw error

      setSuccessMessage('Room deleted successfully!')
      if (selectedFile) await fetchRoomsForFile(selectedFile.upload_group_id)
      await fetchCampusFiles()
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      console.error('Error deleting room:', error)
      alert(error.message || 'Failed to delete room')
    }
  }

  const handleDeleteFile = async () => {
    if (!fileToDelete) return
    setDeletingFile(true)

    try {
      // Get all rooms for archiving
      const { data: roomsToArchive } = await supabase
        .from('campuses')
        .select('*')
        .eq('upload_group_id', fileToDelete.upload_group_id)

      // Archive the file data
      const { data: { user } } = await supabase.auth.getUser()
      await supabase
        .from('archived_items')
        .insert({
          item_type: 'csv_file',
          item_name: fileToDelete.file_name || fileToDelete.school_name,
          item_data: {
            file_info: fileToDelete,
            rooms: roomsToArchive
          },
          deleted_by: user?.id || null,
          original_table: 'campuses',
          original_id: String(fileToDelete.upload_group_id)
        })

      // Delete all rooms in this file
      const { error } = await supabase
        .from('campuses')
        .delete()
        .eq('upload_group_id', fileToDelete.upload_group_id)

      if (error) throw error

      setSuccessMessage(`"${fileToDelete.school_name}" deleted successfully!`)
      setShowDeleteFileModal(false)
      setFileToDelete(null)

      // Reset if currently viewing this file
      if (selectedFile?.upload_group_id === fileToDelete.upload_group_id) {
        setCurrentView('files')
        setSelectedFile(null)
        setAllRooms([])
      }

      await fetchCampusFiles()
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      console.error('Error deleting file:', error)
      alert(error.message || 'Failed to delete file')
    } finally {
      setDeletingFile(false)
    }
  }

  const handleEditRoom = (room: CampusRoom) => {
    setEditingRoom(room)
    setFormData({
      campus: room.campus || '',
      building: room.building || '',
      room: room.room || '',
      room_code: room.room_code || '',
      capacity: room.capacity || 30,
      floor_number: room.floor_number || 1,
      room_type: room.room_type || 'Classroom',
      specific_classification: room.specific_classification || '',
      has_ac: room.has_ac || false,
      has_whiteboard: room.has_whiteboard ?? true,
      has_tv: room.has_tv || false,
      status: room.status || 'usable',
      notes: room.notes || ''
    })
    setShowAddModal(true)
  }

  const resetForm = () => {
    setShowAddModal(false)
    setEditingRoom(null)
    setFormData({
      campus: '',
      building: '',
      room: '',
      room_code: '',
      capacity: 30,
      floor_number: 1,
      room_type: 'Classroom',
      specific_classification: '',
      has_ac: false,
      has_whiteboard: true,
      has_tv: false,
      status: 'usable',
      notes: ''
    })
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingRoom) {
      handleUpdateRoom()
    } else {
      handleAddRoom()
    }
  }

  // ==================== RENDER ====================

  return (
    <div className={styles.layout} data-page="admin">
      <MenuBar
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        showSidebarToggle={true}
        showAccountIcon={true}
      />
      <Sidebar isOpen={sidebarOpen} />

      <main className={`${styles.main} ${!sidebarOpen ? styles.fullWidth : ''}`}>
        <div className={styles.container}>
          {/* Success Message */}
          {successMessage && (
            <div className={styles.successMessage}>{successMessage}</div>
          )}

          {/* Breadcrumb Navigation */}
          {currentView !== 'files' && (
            <div className={styles.breadcrumb}>
              <button className={styles.backBtn} onClick={handleBack}>
                <ArrowLeft size={16} />
                Back
              </button>
              <div className={styles.breadcrumbPath}>
                <span className={styles.breadcrumbLink} onClick={() => { setCurrentView('files'); setSelectedFile(null); setAllRooms([]); }}>
                  All Files
                </span>
                {selectedFile && (
                  <>
                    <span className={styles.breadcrumbSeparator}>›</span>
                    <span className={currentView === 'campuses' ? styles.breadcrumbActive : styles.breadcrumbLink}
                      onClick={() => { setCurrentView('campuses'); setSelectedCampusName(null); }}>
                      {selectedFile.school_name}
                    </span>
                  </>
                )}
                {selectedCampusName && (
                  <>
                    <span className={styles.breadcrumbSeparator}>›</span>
                    <span className={currentView === 'buildings' ? styles.breadcrumbActive : styles.breadcrumbLink}
                      onClick={() => { setCurrentView('buildings'); setSelectedBuildingName(null); }}>
                      {selectedCampusName}
                    </span>
                  </>
                )}
                {selectedBuildingName && (
                  <>
                    <span className={styles.breadcrumbSeparator}>›</span>
                    <span className={styles.breadcrumbActive}>{selectedBuildingName}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerTitleSection}>
              <div className={styles.headerIconWrapper}>
                <Building2 size={28} />
              </div>
              <div className={styles.headerText}>
                <h1 className={styles.title}>Rooms Management</h1>
                <p className={styles.subtitle}>
                  {currentView === 'files' && 'Select a campus file to manage rooms'}
                  {currentView === 'campuses' && `Viewing campuses in ${selectedFile?.school_name}`}
                  {currentView === 'buildings' && `Viewing buildings in ${selectedCampusName}`}
                  {currentView === 'rooms' && `Viewing rooms in ${selectedBuildingName}`}
                </p>
              </div>
            </div>
            {selectedFile && (
              <button className={styles.addBtn} onClick={() => setShowAddModal(true)}>
                <Plus size={18} />
                Add Room
              </button>
            )}
          </div>

          {/* Stats Grid - Only show when a file is selected */}
          {selectedFile && !loadingData && (
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statIcon}><Landmark size={24} /></div>
                <div className={styles.statContent}>
                  <p className={styles.statLabel}>Campuses</p>
                  <h3 className={styles.statValue}>{stats.totalCampuses}</h3>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}><Hotel size={24} /></div>
                <div className={styles.statContent}>
                  <p className={styles.statLabel}>Buildings</p>
                  <h3 className={styles.statValue}>{stats.totalBuildings}</h3>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}><DoorOpen size={24} /></div>
                <div className={styles.statContent}>
                  <p className={styles.statLabel}>Total Rooms</p>
                  <h3 className={styles.statValue}>{stats.totalRooms}</h3>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}><Users size={24} /></div>
                <div className={styles.statContent}>
                  <p className={styles.statLabel}>Total Capacity</p>
                  <h3 className={styles.statValue}>{stats.totalCapacity}</h3>
                </div>
              </div>
              <div className={`${styles.statCard} ${styles.statUsable}`}>
                <div className={styles.statIcon}><CheckCircle2 size={24} /></div>
                <div className={styles.statContent}>
                  <p className={styles.statLabel}>Usable</p>
                  <h3 className={styles.statValue}>{stats.usableRooms}</h3>
                </div>
              </div>
              <div className={`${styles.statCard} ${styles.statNotUsable}`}>
                <div className={styles.statIcon}><XCircle size={24} /></div>
                <div className={styles.statContent}>
                  <p className={styles.statLabel}>Not Usable</p>
                  <h3 className={styles.statValue}>{stats.notUsableRooms}</h3>
                </div>
              </div>
            </div>
          )}

          {/* Search & Filter Section */}
          {selectedFile && currentView !== 'files' && (
            <div className={styles.searchSection}>
              <div className={styles.searchBox}>
                <Search className={styles.searchIcon} size={18} />
                <input
                  type="text"
                  placeholder="Search rooms by name, building, campus..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={styles.searchInput}
                />
              </div>
              <div className={styles.filterButtons}>
                <select value={filterBuilding} onChange={(e) => setFilterBuilding(e.target.value)} className={styles.filterSelect}>
                  <option value="all">All Buildings</option>
                  {uniqueBuildings.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <select value={filterFloor} onChange={(e) => setFilterFloor(e.target.value)} className={styles.filterSelect}>
                  <option value="all">All Floors</option>
                  {uniqueFloors.map(f => <option key={f} value={f}>Floor {f}</option>)}
                </select>
                <select value={filterRoomType} onChange={(e) => setFilterRoomType(e.target.value)} className={styles.filterSelect}>
                  <option value="all">All Types</option>
                  {uniqueRoomTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className={styles.amenityFilters}>
                <button className={`${styles.amenityBtn} ${filterAC ? styles.active : ''}`} onClick={() => setFilterAC(!filterAC)}>
                  <Wind size={14} /> AC
                </button>
                <button className={`${styles.amenityBtn} ${filterTV ? styles.active : ''}`} onClick={() => setFilterTV(!filterTV)}>
                  <Tv size={14} /> TV
                </button>
                <button className={`${styles.amenityBtn} ${filterWhiteboard ? styles.active : ''}`} onClick={() => setFilterWhiteboard(!filterWhiteboard)}>
                  <PresentationIcon size={14} /> Board
                </button>
              </div>
              {hasActiveFilters && (
                <button className={styles.clearFiltersBtn} onClick={clearFilters}>
                  <X size={14} /> Clear
                </button>
              )}
            </div>
          )}

          {/* Loading State */}
          {(loading || loadingData) && (
            <div className={styles.loadingState}>
              <div className={styles.spinner}></div>
              <p>Loading...</p>
            </div>
          )}

          {/* FILES VIEW */}
          {!loading && currentView === 'files' && (
            <>
              {campusFiles.length === 0 ? (
                <div className={styles.emptyState}>
                  <FileSpreadsheet size={64} />
                  <h3>No Campus Files Found</h3>
                  <p>Upload a Campus/Building CSV file to get started</p>
                  <button className={styles.addBtn} onClick={() => router.push('/LandingPages/UploadCSV')}>
                    <Plus size={18} /> Upload CSV
                  </button>
                </div>
              ) : (
                <div className={styles.fileGrid}>
                  {campusFiles.map(file => (
                    <div key={file.upload_group_id} className={styles.fileCard} onClick={() => handleSelectFile(file)}>
                      <div className={styles.fileCardContent}>
                        <div className={styles.fileIcon}>
                          <University size={24} />
                        </div>
                        <div className={styles.fileInfo}>
                          <h4>{file.school_name}</h4>
                          <p><DoorOpen size={14} /> {file.row_count} rooms</p>
                          <p className={styles.fileMeta}>
                            <FileSpreadsheet size={12} /> {file.file_name}
                          </p>
                          <p className={styles.fileMeta}>
                            <Calendar size={12} /> {new Date(file.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className={styles.fileActions}>
                        <button className={styles.deleteBtn} onClick={(e) => { e.stopPropagation(); setFileToDelete(file); setShowDeleteFileModal(true); }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <span className={styles.fileArrow}>→</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* CAMPUSES VIEW */}
          {!loadingData && currentView === 'campuses' && (
            <div className={styles.campusGrid}>
              {Array.from(campusGroups.entries()).map(([campusName, rooms]) => {
                const buildings = new Set(rooms.map(r => r.building)).size
                const totalCapacity = rooms.reduce((sum, r) => sum + r.capacity, 0)
                return (
                  <div key={campusName} className={styles.campusCard} onClick={() => handleSelectCampus(campusName)}>
                    <div className={styles.campusCardContent}>
                      <div className={styles.campusIcon}>
                        <Landmark size={24} />
                      </div>
                      <div className={styles.campusInfo}>
                        <h4>{campusName}</h4>
                        <p><Hotel size={14} /> {buildings} buildings</p>
                        <p><DoorOpen size={14} /> {rooms.length} rooms</p>
                        <p className={styles.campusMeta}><Users size={12} /> {totalCapacity} total capacity</p>
                      </div>
                    </div>
                    <span className={styles.campusArrow}>→</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* BUILDINGS VIEW */}
          {!loadingData && currentView === 'buildings' && (
            <div className={styles.buildingGrid}>
              {Array.from(buildingsForCampus.entries()).map(([buildingName, rooms]) => {
                const floors = new Set(rooms.map(r => r.floor_number).filter(f => f !== null)).size
                const totalCapacity = rooms.reduce((sum, r) => sum + r.capacity, 0)
                return (
                  <div key={buildingName} className={styles.buildingCard} onClick={() => handleSelectBuilding(buildingName)}>
                    <div className={styles.buildingCardContent}>
                      <div className={styles.buildingIcon}>
                        <Hotel size={24} />
                      </div>
                      <div className={styles.buildingInfo}>
                        <h4>{buildingName}</h4>
                        <p><Layers size={14} /> {floors} floors</p>
                        <p><DoorOpen size={14} /> {rooms.length} rooms</p>
                        <p className={styles.buildingMeta}><Users size={12} /> {totalCapacity} total capacity</p>
                      </div>
                    </div>
                    <span className={styles.buildingArrow}>→</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* ROOMS VIEW */}
          {!loadingData && currentView === 'rooms' && (
            <>
              <div className={styles.roomsHeader}>
                <h2><DoorOpen size={20} /> Rooms in {selectedBuildingName}</h2>
                <span className={styles.roomCount}>{roomsForBuilding.length} rooms</span>
              </div>
              <div className={styles.roomsGrid}>
                {roomsForBuilding.map(room => {
                  const statusInfo = getRoomStatusInfo(room.status)
                  return (
                    <div key={room.id} className={`${styles.roomCard} ${styles[statusInfo.icon]}`}>
                      <div className={styles.roomStatusBadge} style={{ background: statusInfo.bgColor, color: statusInfo.color }}>
                        {statusInfo.icon === 'check' && <CheckCircle2 size={12} />}
                        {statusInfo.icon === 'x' && <XCircle size={12} />}
                        {statusInfo.icon === 'wrench' && <Wrench size={12} />}
                        {statusInfo.label}
                      </div>
                      <div className={styles.roomCardIcon} style={{ background: statusInfo.color }}>
                        <DoorOpen size={20} />
                      </div>
                      <div className={styles.roomCardInfo}>
                        <h4>{room.room}</h4>
                        {room.room_code && <span className={styles.roomCode}>{room.room_code}</span>}
                        <p><Users size={12} /> Capacity: {room.capacity}</p>
                        <p><MapPin size={12} /> Floor {displayValue(room.floor_number, 'G')}</p>
                        <p className={styles.roomType}>{room.room_type || 'Classroom'}</p>
                      </div>
                      <div className={styles.roomAmenities}>
                        <span className={room.has_ac ? styles.hasAmenity : styles.noAmenity} title="AC"><Wind size={14} /></span>
                        <span className={room.has_tv ? styles.hasAmenity : styles.noAmenity} title="TV"><Tv size={14} /></span>
                        <span className={room.has_whiteboard ? styles.hasAmenity : styles.noAmenity} title="Board"><PresentationIcon size={14} /></span>
                      </div>
                      <div className={styles.roomActions}>
                        <button className={styles.editBtn} onClick={() => handleEditRoom(room)}><Edit2 size={14} /></button>
                        <button className={styles.deleteBtn} onClick={() => handleDeleteRoom(room)}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* FILTERED SEARCH RESULTS */}
          {selectedFile && searchTerm && (
            <div className={styles.searchResults}>
              <h3>Search Results: {filteredRooms.length} rooms found</h3>
              <div className={styles.roomsGrid}>
                {filteredRooms.map(room => {
                  const statusInfo = getRoomStatusInfo(room.status)
                  return (
                    <div key={room.id} className={`${styles.roomCard} ${styles[statusInfo.icon]}`}>
                      <div className={styles.roomStatusBadge} style={{ background: statusInfo.bgColor, color: statusInfo.color }}>
                        {statusInfo.icon === 'check' && <CheckCircle2 size={12} />}
                        {statusInfo.icon === 'x' && <XCircle size={12} />}
                        {statusInfo.icon === 'wrench' && <Wrench size={12} />}
                        {statusInfo.label}
                      </div>
                      <div className={styles.roomCardIcon} style={{ background: statusInfo.color }}>
                        <DoorOpen size={20} />
                      </div>
                      <div className={styles.roomCardInfo}>
                        <h4>{room.room}</h4>
                        <span className={styles.roomLocation}>{room.campus} › {room.building}</span>
                        {room.room_code && <span className={styles.roomCode}>{room.room_code}</span>}
                        <p><Users size={12} /> Capacity: {room.capacity}</p>
                      </div>
                      <div className={styles.roomActions}>
                        <button className={styles.editBtn} onClick={() => handleEditRoom(room)}><Edit2 size={14} /></button>
                        <button className={styles.deleteBtn} onClick={() => handleDeleteRoom(room)}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Add/Edit Room Modal */}
      {showAddModal && (
        <div className={styles.modalOverlay} onClick={() => resetForm()}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{editingRoom ? 'Edit Room' : 'Add New Room'}</h3>
              <button className={styles.modalClose} onClick={() => resetForm()}>×</button>
            </div>
            <form onSubmit={handleFormSubmit} className={styles.modalBody}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Campus/College *</label>
                  <input
                    type="text"
                    value={formData.campus}
                    onChange={e => setFormData(prev => ({ ...prev, campus: e.target.value }))}
                    required
                    className={styles.formInput}
                    placeholder="e.g., College of Science"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Building *</label>
                  <input
                    type="text"
                    value={formData.building}
                    onChange={e => setFormData(prev => ({ ...prev, building: e.target.value }))}
                    required
                    className={styles.formInput}
                    placeholder="e.g., Science Building"
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Room Name *</label>
                  <input
                    type="text"
                    value={formData.room}
                    onChange={e => setFormData(prev => ({ ...prev, room: e.target.value }))}
                    required
                    className={styles.formInput}
                    placeholder="e.g., Room 101"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Room Code (Optional)</label>
                  <input
                    type="text"
                    value={formData.room_code}
                    onChange={e => setFormData(prev => ({ ...prev, room_code: e.target.value }))}
                    className={styles.formInput}
                    placeholder="e.g., CS-101"
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Capacity *</label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={e => setFormData(prev => ({ ...prev, capacity: parseInt(e.target.value) || 30 }))}
                    required
                    min="1"
                    className={styles.formInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Floor Number</label>
                  <input
                    type="number"
                    value={formData.floor_number || ''}
                    onChange={e => setFormData(prev => ({ ...prev, floor_number: parseInt(e.target.value) || 0 }))}
                    min="0"
                    className={styles.formInput}
                    placeholder="Leave empty for Ground"
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Room Type</label>
                  <select
                    value={formData.room_type}
                    onChange={e => setFormData(prev => ({ ...prev, room_type: e.target.value }))}
                    className={styles.formSelect}
                  >
                    <option value="Lecture Room">Lecture Room</option>
                    <option value="Laboratory">Laboratory</option>
                    <option value="Computer Lab">Computer Lab</option>
                    <option value="Lecture Hall">Lecture Hall</option>
                    <option value="Conference Room">Conference Room</option>
                    <option value="Classroom">Classroom</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className={styles.formSelect}
                  >
                    <option value="usable">✓ Usable</option>
                    <option value="not_usable">✗ Not Usable</option>
                    <option value="maintenance">🔧 Under Maintenance</option>
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Room Features</label>
                <div className={styles.featuresGrid}>
                  <label className={styles.featureCheckbox}>
                    <input
                      type="checkbox"
                      checked={formData.has_ac}
                      onChange={e => setFormData(prev => ({ ...prev, has_ac: e.target.checked }))}
                    />
                    <Wind size={16} /> Air Conditioned
                  </label>
                  <label className={styles.featureCheckbox}>
                    <input
                      type="checkbox"
                      checked={formData.has_whiteboard}
                      onChange={e => setFormData(prev => ({ ...prev, has_whiteboard: e.target.checked }))}
                    />
                    <PresentationIcon size={16} /> Whiteboard
                  </label>
                  <label className={styles.featureCheckbox}>
                    <input
                      type="checkbox"
                      checked={formData.has_tv}
                      onChange={e => setFormData(prev => ({ ...prev, has_tv: e.target.checked }))}
                    />
                    <Tv size={16} /> TV
                  </label>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className={styles.formTextarea}
                  rows={3}
                  placeholder="Additional notes about this room..."
                />
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnCancel} onClick={() => resetForm()}>Cancel</button>
                <button type="submit" className={styles.btnSave}>
                  <Save size={16} /> {editingRoom ? 'Update Room' : 'Add Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete File Modal */}
      {showDeleteFileModal && fileToDelete && (
        <div className={styles.modalOverlay} onClick={() => { setShowDeleteFileModal(false); setFileToDelete(null); }}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Delete Campus File</h3>
              <button className={styles.modalClose} onClick={() => { setShowDeleteFileModal(false); setFileToDelete(null); }}>×</button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.dangerText}>
                Are you sure you want to delete "{fileToDelete.school_name}"?
              </p>
              <p className={styles.warningText}>
                This will delete all {fileToDelete.row_count} rooms in this file. This action can be undone from the Archive.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnCancel} onClick={() => { setShowDeleteFileModal(false); setFileToDelete(null); }}>Cancel</button>
              <button className={styles.btnDelete} onClick={handleDeleteFile} disabled={deletingFile}>
                {deletingFile ? 'Deleting...' : 'Delete File'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
