'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import FeatureTagsManager from '@/app/components/FeatureTagsManager'
import { useColleges } from '@/app/context/CollegesContext'
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
  Filter,
  Info,
  Image as ImageIcon,
  Upload,
  Palette,
  Tag
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

interface RoomImage {
  id: number
  room_id: number
  image_url: string
  caption?: string | null
  uploaded_at: string
}

// Color presets for folder customization
const FOLDER_COLORS = [
  { name: 'Green', gradient: 'linear-gradient(135deg, #16a34a 0%, #22c55e 50%, #4ade80 100%)' },
  { name: 'Blue', gradient: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 50%, #60a5fa 100%)' },
  { name: 'Purple', gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%)' },
  { name: 'Orange', gradient: 'linear-gradient(135deg, #ea580c 0%, #f97316 50%, #fb923c 100%)' },
  { name: 'Pink', gradient: 'linear-gradient(135deg, #db2777 0%, #ec4899 50%, #f472b6 100%)' },
  { name: 'Teal', gradient: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 50%, #2dd4bf 100%)' }
]

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

  // Get colleges from context
  const { activeColleges: bulsuColleges } = useColleges()

  // Layout states
  const [sidebarOpen, setSidebarOpen] = useState(false)
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
  const [filterCollege, setFilterCollege] = useState<string>('all')
  const [filterAC, setFilterAC] = useState(false)
  const [filterTV, setFilterTV] = useState(false)
  const [filterWhiteboard, setFilterWhiteboard] = useState(false)

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingRoom, setEditingRoom] = useState<CampusRoom | null>(null)
  const [showDeleteFileModal, setShowDeleteFileModal] = useState(false)
  const [fileToDelete, setFileToDelete] = useState<CampusFile | null>(null)
  const [deletingFile, setDeletingFile] = useState(false)

  // Color customization states
  const [folderColors, setFolderColors] = useState<Record<string, string>>({})
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null)

  // Room detail modal states
  const [showRoomDetail, setShowRoomDetail] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<CampusRoom | null>(null)
  const [roomImages, setRoomImages] = useState<RoomImage[]>([])
  const [loadingImages, setLoadingImages] = useState(false)

  // Room features count map (room_id -> feature count)
  const [roomFeatureCounts, setRoomFeatureCounts] = useState<Record<number, number>>({})

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
    notes: '',
    college: ''
  })

  // ==================== AUTH & INIT ====================

  useEffect(() => {
    checkAuth()
    fetchCampusFiles()
  }, [])

  // ==================== REAL-TIME SUBSCRIPTION ====================
  // Auto-refresh UI when database changes
  useEffect(() => {
    const channel = supabase
      .channel('rooms-realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'campuses' },
        (payload) => {
          console.log('[Realtime] campuses change:', payload.eventType)
          // Refetch data on any change
          fetchCampusFiles()
          if (selectedFile) {
            fetchRoomsForFile(selectedFile.upload_group_id)
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] campuses subscription:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedFile?.upload_group_id])

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/')
        return
      }
      if (session.user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        router.push('/faculty/home')
        return
      }
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/')
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

      // Fetch feature counts for all rooms
      const roomIds = (data || []).map((r: CampusRoom) => r.id).filter(Boolean)
      if (roomIds.length > 0) {
        const { data: features } = await supabase
          .from('room_features')
          .select('room_id')
          .in('room_id', roomIds)

        if (features) {
          const counts: Record<number, number> = {}
          features.forEach((f: { room_id: number }) => {
            counts[f.room_id] = (counts[f.room_id] || 0) + 1
          })
          setRoomFeatureCounts(counts)
        }
      }
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

  // ==================== COLOR CUSTOMIZATION ====================

  const getFolderColor = (key: string): string => {
    return folderColors[key] || FOLDER_COLORS[0].gradient
  }

  const handleColorSelect = (key: string, color: string) => {
    setFolderColors(prev => ({ ...prev, [key]: color }))
    setShowColorPicker(null)
    // Store in localStorage for persistence
    try {
      const stored = JSON.parse(localStorage.getItem('roomFolderColors') || '{}')
      stored[key] = color
      localStorage.setItem('roomFolderColors', JSON.stringify(stored))
    } catch (e) {
      console.error('Error saving folder colors:', e)
    }
  }

  // Load saved colors on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('roomFolderColors')
      if (stored) {
        setFolderColors(JSON.parse(stored))
      }
    } catch (e) {
      console.error('Error loading folder colors:', e)
    }
  }, [])

  // ==================== ROOM DETAIL & IMAGES ====================

  const handleShowRoomDetail = async (room: CampusRoom) => {
    setSelectedRoom(room)
    setShowRoomDetail(true)
    if (room.id) {
      await fetchRoomImages(room.id)
    }
  }

  const fetchRoomImages = async (roomId: number) => {
    setLoadingImages(true)
    try {
      const { data, error } = await supabase
        .from('room_images')
        .select('*')
        .eq('room_id', roomId)
        .order('uploaded_at', { ascending: false })

      if (error) {
        // Table might not exist yet - this is okay
        if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
          setRoomImages([])
          return
        }
        throw error
      }
      setRoomImages(data || [])
    } catch (error) {
      // Silently handle - table may not be created yet
      setRoomImages([])
    } finally {
      setLoadingImages(false)
    }
  }

  const handleCloseRoomDetail = () => {
    setShowRoomDetail(false)
    setSelectedRoom(null)
    setRoomImages([])
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

  // Get rooms for selected building (with filters applied)
  const roomsForBuilding = useMemo(() => {
    if (!selectedCampusName || !selectedBuildingName) return []
    const buildings = buildingsForCampus
    const rooms = buildings.get(selectedBuildingName) || []
    return rooms.filter(room => {
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
      if (filterFloor !== 'all' && room.floor_number !== parseInt(filterFloor)) return false
      if (filterRoomType !== 'all' && room.room_type !== filterRoomType) return false
      if (filterCollege !== 'all' && room.college !== filterCollege) return false
      if (filterAC && !room.has_ac) return false
      if (filterTV && !room.has_tv) return false
      if (filterWhiteboard && !room.has_whiteboard) return false
      return true
    })
  }, [buildingsForCampus, selectedBuildingName, searchTerm, filterFloor, filterRoomType, filterCollege, filterAC, filterTV, filterWhiteboard])

  // Get unique values for filters
  const uniqueBuildings = useMemo(() => [...new Set(allRooms.map(r => r.building))].sort(), [allRooms])
  const uniqueFloors = useMemo(() => {
    const floors = new Set(allRooms.map(r => r.floor_number).filter(f => f !== null))
    return Array.from(floors).sort((a, b) => (a as number) - (b as number)) as number[]
  }, [allRooms])
  const uniqueRoomTypes = useMemo(() => [...new Set(allRooms.map(r => r.room_type).filter(t => t))].sort(), [allRooms])
  const uniqueColleges = useMemo(() => [...new Set(allRooms.map(r => r.college).filter(c => c))].sort(), [allRooms])

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
      if (filterCollege !== 'all' && room.college !== filterCollege) return false
      if (filterAC && !room.has_ac) return false
      if (filterTV && !room.has_tv) return false
      if (filterWhiteboard && !room.has_whiteboard) return false
      return true
    })
  }, [allRooms, searchTerm, filterBuilding, filterFloor, filterRoomType, filterCollege, filterAC, filterTV, filterWhiteboard])

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

  const hasActiveFilters = filterBuilding !== 'all' || filterFloor !== 'all' || filterRoomType !== 'all' || filterCollege !== 'all' || filterAC || filterTV || filterWhiteboard

  const clearFilters = () => {
    setSearchTerm('')
    setFilterBuilding('all')
    setFilterFloor('all')
    setFilterRoomType('all')
    setFilterCollege('all')
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
      const { error } = await (supabase
        .from('campuses') as any)
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
          file_name: 'Manual Entry',
          college: formData.college || null
        })

      if (error) throw error

      setSuccessMessage('Room added successfully!')
      resetForm()
      await fetchRoomsForFile(selectedFile.upload_group_id)
      await fetchCampusFiles()
      router.refresh() // Force refresh cached data
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      console.error('Error adding room:', error)
      alert(error.message || 'Failed to add room')
    }
  }

  const handleUpdateRoom = async () => {
    if (!editingRoom || !editingRoom.id) return

    try {
      const { data, error, count } = await (supabase
        .from('campuses') as any)
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
          notes: formData.notes || null,
          college: formData.college || null
        })
        .eq('id', editingRoom.id)
        .select()

      if (error) throw error

      // Check if any rows were actually updated (RLS may block silently)
      if (!data || data.length === 0) {
        throw new Error('Update failed - no rows affected. Please check your permissions or run the RLS fix script in Supabase.')
      }

      setSuccessMessage('Room updated successfully!')
      resetForm()
      if (selectedFile) await fetchRoomsForFile(selectedFile.upload_group_id)
      router.refresh() // Force refresh cached data
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
      await (supabase
        .from('archived_items') as any)
        .insert({
          item_type: 'room',
          item_name: `${room.building} - ${room.room}`,
          item_data: room,
          deleted_by: user?.id || null,
          original_table: 'campuses',
          original_id: String(room.id)
        })

      const { data, error } = await supabase
        .from('campuses')
        .delete()
        .eq('id', room.id)
        .select()

      if (error) throw error

      // Check if any rows were actually deleted (RLS may block silently)
      if (!data || data.length === 0) {
        throw new Error('Delete failed - no rows affected. Please check your permissions or run the RLS fix script in Supabase.')
      }

      setSuccessMessage('Room deleted successfully!')
      if (selectedFile) await fetchRoomsForFile(selectedFile.upload_group_id)
      await fetchCampusFiles()
      router.refresh() // Force refresh cached data
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
      await (supabase
        .from('archived_items') as any)
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
      console.log('Deleting file with upload_group_id:', fileToDelete.upload_group_id)
      const { data, error } = await supabase
        .from('campuses')
        .delete()
        .eq('upload_group_id', fileToDelete.upload_group_id)
        .select()

      console.log('Delete file result:', { data, error })
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('Delete failed - database did not confirm the change. Check RLS policies in Supabase.')
      }

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
      notes: room.notes || '',
      college: room.college || ''
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
      notes: '',
      college: ''
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
                <h1 className={styles.title}>Room Management</h1>
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
                <select value={filterCollege} onChange={(e) => setFilterCollege(e.target.value)} className={styles.filterSelect}>
                  <option value="all">All Colleges</option>
                  {bulsuColleges.map(c => (
                    <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                  ))}
                  <option value="Shared">Shared / Multi-College</option>
                  {uniqueColleges.filter((c): c is string => !!c && !bulsuColleges.some(bc => bc.code === c) && c !== 'Shared').map(c => <option key={c} value={c}>{c}</option>)}
                </select>
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
                  {campusFiles.map(file => {
                    const fileKey = `file-${file.upload_group_id}`
                    return (
                      <div
                        key={file.upload_group_id}
                        className={styles.fileCard}
                        style={{ background: getFolderColor(fileKey) }}
                        onClick={() => handleSelectFile(file)}
                      >
                        {/* Color Picker */}
                        <div className={styles.colorPicker} onClick={(e) => e.stopPropagation()}>
                          <button
                            className={styles.colorPickerBtn}
                            style={{ background: getFolderColor(fileKey) }}
                            onClick={() => setShowColorPicker(showColorPicker === fileKey ? null : fileKey)}
                          >
                            <Palette size={16} color="white" />
                          </button>
                          {showColorPicker === fileKey && (
                            <div className={styles.colorPickerMenu}>
                              {FOLDER_COLORS.map(c => (
                                <div
                                  key={c.name}
                                  className={`${styles.colorOption} ${getFolderColor(fileKey) === c.gradient ? styles.selected : ''}`}
                                  style={{ background: c.gradient }}
                                  onClick={() => handleColorSelect(fileKey, c.gradient)}
                                  title={c.name}
                                />
                              ))}
                            </div>
                          )}
                        </div>

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
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* CAMPUSES VIEW */}
          {!loadingData && currentView === 'campuses' && !searchTerm && !hasActiveFilters && (
            <div className={styles.campusGrid}>
              {Array.from(campusGroups.entries()).map(([campusName, rooms]) => {
                const buildings = new Set(rooms.map(r => r.building)).size
                const totalCapacity = rooms.reduce((sum, r) => sum + r.capacity, 0)
                const campusKey = `campus-${campusName}`
                return (
                  <div
                    key={campusName}
                    className={styles.campusCard}
                    style={{ background: getFolderColor(campusKey) }}
                    onClick={() => handleSelectCampus(campusName)}
                  >
                    {/* Color Picker */}
                    <div className={styles.colorPicker} onClick={(e) => e.stopPropagation()}>
                      <button
                        className={styles.colorPickerBtn}
                        style={{ background: getFolderColor(campusKey) }}
                        onClick={() => setShowColorPicker(showColorPicker === campusKey ? null : campusKey)}
                      >
                        <Palette size={16} color="white" />
                      </button>
                      {showColorPicker === campusKey && (
                        <div className={styles.colorPickerMenu}>
                          {FOLDER_COLORS.map(c => (
                            <div
                              key={c.name}
                              className={`${styles.colorOption} ${getFolderColor(campusKey) === c.gradient ? styles.selected : ''}`}
                              style={{ background: c.gradient }}
                              onClick={() => handleColorSelect(campusKey, c.gradient)}
                              title={c.name}
                            />
                          ))}
                        </div>
                      )}
                    </div>

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
          {!loadingData && currentView === 'buildings' && !searchTerm && !hasActiveFilters && (
            <div className={styles.buildingGrid}>
              {Array.from(buildingsForCampus.entries()).map(([buildingName, rooms]) => {
                const floors = new Set(rooms.map(r => r.floor_number).filter(f => f !== null)).size
                const totalCapacity = rooms.reduce((sum, r) => sum + r.capacity, 0)
                const buildingKey = `building-${selectedCampusName}-${buildingName}`
                return (
                  <div
                    key={buildingName}
                    className={styles.buildingCard}
                    style={{ background: getFolderColor(buildingKey) }}
                    onClick={() => handleSelectBuilding(buildingName)}
                  >
                    {/* Color Picker */}
                    <div className={styles.colorPicker} onClick={(e) => e.stopPropagation()}>
                      <button
                        className={styles.colorPickerBtn}
                        style={{ background: getFolderColor(buildingKey) }}
                        onClick={() => setShowColorPicker(showColorPicker === buildingKey ? null : buildingKey)}
                      >
                        <Palette size={16} color="white" />
                      </button>
                      {showColorPicker === buildingKey && (
                        <div className={styles.colorPickerMenu}>
                          {FOLDER_COLORS.map(c => (
                            <div
                              key={c.name}
                              className={`${styles.colorOption} ${getFolderColor(buildingKey) === c.gradient ? styles.selected : ''}`}
                              style={{ background: c.gradient }}
                              onClick={() => handleColorSelect(buildingKey, c.gradient)}
                              title={c.name}
                            />
                          ))}
                        </div>
                      )}
                    </div>

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
                        {room.college && (
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(99, 102, 241, 0.15)',
                            color: '#6366f1',
                            display: 'inline-block',
                            marginBottom: '4px'
                          }}>
                            <University size={10} style={{ marginRight: '3px', verticalAlign: 'middle' }} />
                            {room.college}
                          </span>
                        )}
                        <div className={styles.roomInfoRow}>
                          <p><Users size={11} /> Capacity: {room.capacity}</p>
                          <p><MapPin size={11} /> Floor {displayValue(room.floor_number, 'G')}</p>
                        </div>
                        <p className={styles.roomType}>{room.room_type || 'Classroom'}</p>
                      </div>
                      <div className={styles.roomAmenities}>
                        <span className={room.has_ac ? styles.hasAmenity : styles.noAmenity} title="AC"><Wind size={14} /></span>
                        <span className={room.has_tv ? styles.hasAmenity : styles.noAmenity} title="TV"><Tv size={14} /></span>
                        <span className={room.has_whiteboard ? styles.hasAmenity : styles.noAmenity} title="Board"><PresentationIcon size={14} /></span>
                        {room.id && roomFeatureCounts[room.id] && (
                          <span
                            className={styles.hasAmenity}
                            title={`${roomFeatureCounts[room.id]} equipment tags`}
                            style={{
                              background: 'rgba(16, 185, 129, 0.2)',
                              color: '#10b981',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            <Tag size={10} /> {roomFeatureCounts[room.id]}
                          </span>
                        )}
                      </div>
                      <div className={styles.roomActions}>
                        <button className={styles.infoBtn} onClick={() => handleShowRoomDetail(room)} title="View room details & images">
                          <Info size={14} />
                        </button>
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
          {!loadingData && selectedFile && (searchTerm || hasActiveFilters) && currentView !== 'rooms' && (
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
                      <div className={styles.roomAmenities}>
                        <span className={room.has_ac ? styles.hasAmenity : styles.noAmenity} title="AC"><Wind size={14} /></span>
                        <span className={room.has_tv ? styles.hasAmenity : styles.noAmenity} title="TV"><Tv size={14} /></span>
                        <span className={room.has_whiteboard ? styles.hasAmenity : styles.noAmenity} title="Board"><PresentationIcon size={14} /></span>
                        {room.id && roomFeatureCounts[room.id] && (
                          <span
                            className={styles.hasAmenity}
                            title={`${roomFeatureCounts[room.id]} equipment tags`}
                            style={{
                              background: 'rgba(16, 185, 129, 0.2)',
                              color: '#10b981',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            <Tag size={10} /> {roomFeatureCounts[room.id]}
                          </span>
                        )}
                      </div>
                      <div className={styles.roomActions}>
                        <button className={styles.infoBtn} onClick={() => handleShowRoomDetail(room)} title="View room details & images">
                          <Info size={14} />
                        </button>
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
                  <label>College</label>
                  <select
                    value={formData.college}
                    onChange={e => setFormData(prev => ({ ...prev, college: e.target.value }))}
                    className={styles.formSelect}
                  >
                    <option value="">-- Select College --</option>
                    {bulsuColleges.map(c => (
                      <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                    ))}
                    <option value="Shared">Shared / Multi-College</option>
                  </select>
                </div>
              </div>

              <div className={styles.formRow}>
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
                <label>Basic Amenities</label>
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

              {/* Equipment & Feature Tags - Only for existing rooms */}
              {editingRoom?.id && (
                <div className={styles.formGroup}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Tag size={16} /> Equipment & Feature Tags
                    <span style={{
                      fontSize: '11px',
                      color: 'var(--emerald-500)',
                      background: 'rgba(16, 185, 129, 0.1)',
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}>
                      Used for course matching
                    </span>
                  </label>
                  <div style={{
                    background: 'var(--bg-tertiary)',
                    borderRadius: '12px',
                    padding: '16px',
                    border: '1px solid var(--border-color)'
                  }}>
                    <FeatureTagsManager
                      mode="room"
                      entityId={editingRoom.id}
                      entityName={editingRoom.room}
                    />
                  </div>
                </div>
              )}

              {/* Show hint for new rooms */}
              {!editingRoom && (
                <div style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '16px'
                }}>
                  <Info size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <strong>Equipment & Feature Tags</strong> can be added after the room is created.
                    These tags are used by the scheduler to match courses with compatible rooms.
                  </span>
                </div>
              )}

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

      {/* Room Detail Modal with Images */}
      {showRoomDetail && selectedRoom && (
        <div className={styles.roomDetailOverlay} onClick={handleCloseRoomDetail}>
          <div className={styles.roomDetailModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.roomDetailHeader}>
              <h3><DoorOpen size={20} /> {selectedRoom.room}</h3>
              <button className={styles.roomDetailClose} onClick={handleCloseRoomDetail}>×</button>
            </div>
            <div className={styles.roomDetailBody}>
              {/* Room Information */}
              <div className={styles.roomDetailSection}>
                <h4><Building2 size={16} /> Room Information</h4>
                <div className={styles.roomDetailInfo}>
                  <div className={styles.roomDetailItem}>
                    <span className={styles.roomDetailLabel}>Campus</span>
                    <span className={styles.roomDetailValue}>{selectedRoom.campus}</span>
                  </div>
                  <div className={styles.roomDetailItem}>
                    <span className={styles.roomDetailLabel}>Building</span>
                    <span className={styles.roomDetailValue}>{selectedRoom.building}</span>
                  </div>
                  <div className={styles.roomDetailItem}>
                    <span className={styles.roomDetailLabel}>Room Code</span>
                    <span className={styles.roomDetailValue}>{displayValue(selectedRoom.room_code)}</span>
                  </div>
                  <div className={styles.roomDetailItem}>
                    <span className={styles.roomDetailLabel}>Capacity</span>
                    <span className={styles.roomDetailValue}>{selectedRoom.capacity} seats</span>
                  </div>
                  <div className={styles.roomDetailItem}>
                    <span className={styles.roomDetailLabel}>Floor</span>
                    <span className={styles.roomDetailValue}>{displayValue(selectedRoom.floor_number, 'Ground')}</span>
                  </div>
                  <div className={styles.roomDetailItem}>
                    <span className={styles.roomDetailLabel}>Room Type</span>
                    <span className={styles.roomDetailValue}>{displayValue(selectedRoom.room_type)}</span>
                  </div>
                  <div className={styles.roomDetailItem}>
                    <span className={styles.roomDetailLabel}>Status</span>
                    <span className={styles.roomDetailValue}>{displayValue(selectedRoom.status)}</span>
                  </div>
                  <div className={styles.roomDetailItem}>
                    <span className={styles.roomDetailLabel}>Classification</span>
                    <span className={styles.roomDetailValue}>{displayValue(selectedRoom.specific_classification)}</span>
                  </div>
                </div>
              </div>

              {/* Amenities */}
              <div className={styles.roomDetailSection}>
                <h4><Wind size={16} /> Amenities</h4>
                <div className={styles.roomDetailInfo}>
                  <div className={styles.roomDetailItem}>
                    <span className={styles.roomDetailLabel}>Air Conditioning</span>
                    <span className={styles.roomDetailValue}>{displayBool(selectedRoom.has_ac)}</span>
                  </div>
                  <div className={styles.roomDetailItem}>
                    <span className={styles.roomDetailLabel}>Television</span>
                    <span className={styles.roomDetailValue}>{displayBool(selectedRoom.has_tv)}</span>
                  </div>
                  <div className={styles.roomDetailItem}>
                    <span className={styles.roomDetailLabel}>Whiteboard</span>
                    <span className={styles.roomDetailValue}>{displayBool(selectedRoom.has_whiteboard)}</span>
                  </div>
                  <div className={styles.roomDetailItem}>
                    <span className={styles.roomDetailLabel}>Projector</span>
                    <span className={styles.roomDetailValue}>{displayBool(selectedRoom.has_projector)}</span>
                  </div>
                </div>
              </div>

              {/* Equipment & Features Tags */}
              {selectedRoom.id && (
                <div className={styles.roomDetailSection}>
                  <h4><Tag size={16} /> Equipment & Features</h4>
                  <div style={{ marginTop: '12px' }}>
                    <FeatureTagsManager
                      mode="room"
                      entityId={selectedRoom.id}
                      entityName={selectedRoom.room}
                    />
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedRoom.notes && (
                <div className={styles.roomDetailSection}>
                  <h4>Notes</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{selectedRoom.notes}</p>
                </div>
              )}

              {/* Room Images */}
              <div className={styles.roomDetailSection}>
                <h4><ImageIcon size={16} /> Room Images</h4>
                {loadingImages ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Loading images...</p>
                ) : roomImages.length > 0 ? (
                  <div className={styles.imageGallery}>
                    {roomImages.map(img => (
                      <div key={img.id} className={styles.imageItem}>
                        <img src={img.image_url} alt={img.caption || 'Room image'} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.noImages}>
                    <ImageIcon size={48} style={{ color: 'var(--text-secondary)', marginBottom: '12px' }} />
                    <p>No images available for this room</p>
                    <button className={styles.uploadImageBtn} onClick={() => alert('Image upload feature coming soon!')}>
                      <Upload size={16} /> Upload Images
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
