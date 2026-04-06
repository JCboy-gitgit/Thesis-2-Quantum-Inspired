'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import FeatureTagsManager from '@/app/components/FeatureTagsManager'
import { useColleges } from '@/app/context/CollegesContext'
import { MdDomain, MdArrowBack, MdSearch, MdCalendarToday, MdAdd, MdCheck, MdClose, MdPeople, MdBarChart, MdMeetingRoom, MdEdit, MdArchive, MdKeyboardArrowDown, MdKeyboardArrowRight, MdLocationOn, MdSchool, MdHotel, MdAccountBalance, MdAir, MdTv, MdCoPresent, MdCheckCircle, MdCancel, MdBuild, MdSave, MdTableChart, MdLayers, MdFilterList, MdInfo, MdImage, MdUpload, MdLabel, MdDescription } from 'react-icons/md'
import { SiGoogleclassroom } from 'react-icons/si'
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

// ==================== HELPERS ====================

const displayValue = (value: any, defaultVal: string = 'None'): string => {
  if (value === null || value === undefined || value === '') return defaultVal
  return String(value)
}

const displayBool = (value: boolean | null | undefined): string => {
  if (value === null || value === undefined) return 'None'
  return value ? 'Yes' : 'No'
}

const ROOM_TYPE_OPTIONS = [
  'Computer Room (Lab)',
  'Lecture Room (Lec)',
  'Laboratory Room (Lab)',
  'Other (Lec)'
] as const

const normalizeRoomType = (roomType?: string | null): string => {
  if (!roomType) return 'Other (Lec)'

  const value = roomType.trim().toLowerCase()

  if (value.includes('computer')) return 'Computer Room (Lab)'
  if (value.includes('laboratory') || value === 'lab') return 'Laboratory Room (Lab)'
  if (value.includes('lecture') || value.includes('classroom') || value.includes('hall')) return 'Lecture Room (Lec)'

  if (value === 'computer room (lab)' || value === 'lecture room (lec)' || value === 'laboratory room (lab)' || value === 'other (lec)') {
    return roomType
  }

  return 'Other (Lec)'
}

const getRoomStatusInfo = (status: string | null | undefined) => {
  switch (status?.toLowerCase()) {
    case 'usable':
    case 'available':
    case 'active':
      return {
        label: 'Usable',
        color: 'var(--primary-dark, #059669)',
        bgColor: 'var(--primary-alpha, rgba(var(--primary-rgb, 0, 166, 81), 0.15))',
        icon: 'check' as const,
      }
    case 'not_usable':
    case 'unavailable':
    case 'inactive':
      return {
        label: 'Not Usable',
        color: 'var(--error, #dc2626)',
        bgColor: 'rgba(239, 68, 68, 0.12)',
        icon: 'x' as const,
      }
    case 'maintenance':
    case 'under_maintenance':
      return {
        label: 'Maintenance',
        color: 'var(--warning-orange, #d97706)',
        bgColor: 'var(--warning-bg, #fef3c7)',
        icon: 'wrench' as const,
      }
    default:
      return {
        label: 'Usable',
        color: 'var(--primary-dark, #059669)',
        bgColor: 'var(--primary-alpha, rgba(var(--primary-rgb, 0, 166, 81), 0.15))',
        icon: 'check' as const,
      }
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
  const [syncing, setSyncing] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  // Navigation: 'files' -> 'campuses' -> 'buildings' -> 'rooms'
  const [currentView, setCurrentView] = useState<'files' | 'campuses' | 'buildings' | 'rooms'>('files')

  // Data states
  const [campusFiles, setCampusFiles] = useState<CampusFile[]>([])
  const [selectedFile, setSelectedFile] = useState<CampusFile | null>(null)
  const [allRooms, setAllRooms] = useState<CampusRoom[]>([])
  const [systemRoomOptions, setSystemRoomOptions] = useState<Array<Pick<CampusRoom, 'campus' | 'building' | 'room' | 'room_code'>>>([])
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

  // Room detail modal states
  const [showRoomDetail, setShowRoomDetail] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<CampusRoom | null>(null)
  const [roomImages, setRoomImages] = useState<RoomImage[]>([])
  const [loadingImages, setLoadingImages] = useState(false)
  const [uploadingRoomImage, setUploadingRoomImage] = useState(false)
  const roomImageInputRef = useRef<HTMLInputElement>(null)

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
    room_type: 'Lecture Room (Lec)',
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
    fetchSystemRoomOptions()
  }, [])

  // ==================== REAL-TIME SUBSCRIPTION ====================
  // Auto-refresh UI when database changes
  useEffect(() => {
    const channel = supabase
      .channel('rooms-realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'campuses' },
        (payload) => {
          // Refetch data on any change
          fetchCampusFiles()
          if (selectedFile) {
            fetchRoomsForFile(selectedFile.upload_group_id)
          }
        }
      )
      .subscribe((status) => {
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

  // Refresh data when something is restored from Archive
  useEffect(() => {
    const handler = () => {
      void fetchCampusFiles()
      if (selectedFile?.upload_group_id) {
        void fetchRoomsForFile(selectedFile.upload_group_id)
      }
    }

    window.addEventListener('archive:restored', handler)
    window.addEventListener('archive:bulkRestored', handler)
    return () => {
      window.removeEventListener('archive:restored', handler)
      window.removeEventListener('archive:bulkRestored', handler)
    }
  }, [selectedFile])

  const fetchSystemRoomOptions = async () => {
    try {
      const { data, error } = await supabase
        .from('campuses')
        .select('campus, building, room, room_code')
        .limit(5000)

      if (error) throw error
      setSystemRoomOptions((data || []) as Array<Pick<CampusRoom, 'campus' | 'building' | 'room' | 'room_code'>>)
    } catch (error) {
      console.error('Error fetching room suggestions:', error)
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

  const compressImage = (file: File, maxWidth = 1920, quality = 0.8): Promise<File> => {
    return new Promise((resolve) => {
      // GIFs can't be compressed via canvas, skip
      if (file.type === 'image/gif') { resolve(file); return }

      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)

        let { width, height } = img
        // Only downscale if larger than maxWidth
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              // If compressed is bigger, use original
              resolve(file)
              return
            }
            const compressed = new File([blob], file.name, { type: 'image/webp', lastModified: Date.now() })
            resolve(compressed)
          },
          'image/webp',
          quality
        )
      }
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
      img.src = url
    })
  }

  const openRoomImagePicker = () => {
    if (!selectedRoom?.id) {
      alert('Please select a valid room first.')
      return
    }
    roomImageInputRef.current?.click()
  }

  const handleRoomImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !selectedRoom?.id) return

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid image file (JPEG, PNG, WebP, or GIF).')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Image size must be less than 10MB.')
      return
    }

    setUploadingRoomImage(true)
    try {
      // Compress image before upload
      const compressed = await compressImage(file)
      const isCompressed = compressed !== file
      const fileExt = isCompressed ? 'webp' : (file.name.split('.').pop() || 'jpg')
      const safeRoomName = (selectedRoom.room || `room-${selectedRoom.id}`)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      const filePath = `rooms/${selectedRoom.id}/${safeRoomName}-${Date.now()}.${fileExt}`

      const formData = new FormData()
      formData.append('file', compressed)
      formData.append('filePath', filePath)
      formData.append('bucket', 'room-images')

      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token

      const uploadRes = await fetch('/api/rooms/upload-image', {
        method: 'POST',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        body: formData,
      })

      const uploadData = await uploadRes.json()
      if (!uploadRes.ok || !uploadData?.publicUrl) {
        throw new Error(uploadData?.error || 'Upload failed')
      }

      const { data: authData } = await supabase.auth.getUser()
      const uploaderId = authData?.user?.id || null

      const { data: imageRow, error: insertError } = await (supabase
        .from('room_images') as any)
        .insert({
          room_id: selectedRoom.id,
          image_url: uploadData.publicUrl,
          caption: null,
          uploaded_by: uploaderId,
        })
        .select('*')
        .single()

      if (insertError) {
        throw new Error(insertError.message || 'Failed to save image metadata')
      }

      setRoomImages((prev) => [imageRow as RoomImage, ...prev])
      setSuccessMessage('Room image uploaded successfully!')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      console.error('Room image upload error:', error)
      alert(error?.message || 'Failed to upload room image')
    } finally {
      setUploadingRoomImage(false)
      if (roomImageInputRef.current) {
        roomImageInputRef.current.value = ''
      }
    }
  }

  const handleDeleteRoomImage = async (img: RoomImage) => {
    if (!confirm('Archive this image? You can restore it from the Archive.')) return

    const previousImages = roomImages
    setRoomImages((prev) => prev.filter((i) => i.id !== img.id))

    try {
      // Archive first
      const { data: { user } } = await supabase.auth.getUser()
      await (supabase
        .from('archived_items') as any)
        .insert({
          item_type: 'room_image',
          item_name: img.caption || `Room image #${img.id}`,
          item_data: img,
          deleted_by: user?.id || null,
          original_table: 'room_images',
          original_id: String(img.id)
        })

      // Delete from room_images table
      const { error } = await supabase
        .from('room_images')
        .delete()
        .eq('id', img.id)

      if (error) throw error

      // Try to remove from storage (extract path from URL)
      try {
        const url = new URL(img.image_url)
        const pathMatch = url.pathname.match(/\/object\/public\/([^/]+)\/(.+)/)
        if (pathMatch) {
          const bucket = pathMatch[1]
          const storagePath = decodeURIComponent(pathMatch[2])
          await supabase.storage.from(bucket).remove([storagePath])
        }
      } catch {
        // Storage cleanup is best-effort
      }

      setSuccessMessage('Image archived successfully!')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      setRoomImages(previousImages)
      console.error('Error archiving room image:', error)
      alert(error.message || 'Failed to archive image')
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
      if (filterRoomType !== 'all' && normalizeRoomType(room.room_type) !== filterRoomType) return false
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
  const uniqueRoomTypes = useMemo(() => ROOM_TYPE_OPTIONS, [])
  const uniqueColleges = useMemo(() => [...new Set(allRooms.map(r => r.college).filter(c => c))].sort(), [allRooms])

  const normalizedFormCampus = formData.campus.trim().toLowerCase()
  const normalizedFormBuilding = formData.building.trim().toLowerCase()

  const suggestionSource = useMemo(
    () => (systemRoomOptions.length > 0 ? systemRoomOptions : allRooms),
    [systemRoomOptions, allRooms]
  )

  const suggestedCampuses = useMemo(() => {
    return Array.from(
      new Set(suggestionSource.map(item => item.campus?.trim()).filter((value): value is string => Boolean(value)))
    ).sort((a, b) => a.localeCompare(b))
  }, [suggestionSource])

  const suggestedBuildings = useMemo(() => {
    return Array.from(
      new Set(
        suggestionSource
          .filter(item => {
            if (!normalizedFormCampus) return true
            return (item.campus || '').trim().toLowerCase() === normalizedFormCampus
          })
          .map(item => item.building?.trim())
          .filter((value): value is string => Boolean(value))
      )
    ).sort((a, b) => a.localeCompare(b))
  }, [suggestionSource, normalizedFormCampus])

  const suggestedRoomNames = useMemo(() => {
    return Array.from(
      new Set(
        suggestionSource
          .filter(item => {
            const campusMatches = !normalizedFormCampus || (item.campus || '').trim().toLowerCase() === normalizedFormCampus
            const buildingMatches = !normalizedFormBuilding || (item.building || '').trim().toLowerCase() === normalizedFormBuilding
            return campusMatches && buildingMatches
          })
          .map(item => item.room?.trim())
          .filter((value): value is string => Boolean(value))
      )
    ).sort((a, b) => a.localeCompare(b))
  }, [suggestionSource, normalizedFormCampus, normalizedFormBuilding])

  const suggestedRoomCodes = useMemo(() => {
    return Array.from(
      new Set(
        suggestionSource
          .map(item => item.room_code?.trim())
          .filter((value): value is string => Boolean(value))
      )
    ).sort((a, b) => a.localeCompare(b))
  }, [suggestionSource])

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
      if (filterRoomType !== 'all' && normalizeRoomType(room.room_type) !== filterRoomType) return false
      if (filterCollege !== 'all' && room.college !== filterCollege) return false
      if (filterAC && !room.has_ac) return false
      if (filterTV && !room.has_tv) return false
      if (filterWhiteboard && !room.has_whiteboard) return false
      return true
    })
  }, [allRooms, searchTerm, filterBuilding, filterFloor, filterRoomType, filterCollege, filterAC, filterTV, filterWhiteboard])

  // Stats calculation
  const stats: CampusStats = useMemo(() => {
    // Use filteredRooms to respect active filters
    const roomsToCount = filteredRooms

    const uniqueCampuses = new Set(roomsToCount.map(r => r.campus))
    const totalCampuses = uniqueCampuses.size

    const uniqueBuildings = new Set(roomsToCount.map(r => `${r.campus}|${r.building}`))
    const totalBuildings = uniqueBuildings.size

    const totalRooms = roomsToCount.length
    const totalCapacity = roomsToCount.reduce((sum, r) => sum + r.capacity, 0)
    const avgCapacity = totalRooms > 0 ? Math.round(totalCapacity / totalRooms) : 0
    let usableRooms = 0
    let notUsableRooms = 0
    roomsToCount.forEach(room => {
      const status = room.status?.toLowerCase()
      if (status === 'not_usable' || status === 'unavailable' || status === 'inactive') {
        notUsableRooms++
      } else {
        usableRooms++
      }
    })
    return { totalCampuses, totalBuildings, totalRooms, totalCapacity, avgCapacity, usableRooms, notUsableRooms }
  }, [filteredRooms])

  const hasActiveFilters = filterBuilding !== 'all' || filterFloor !== 'all' || filterRoomType !== 'all' || filterCollege !== 'all' || filterAC || filterTV || filterWhiteboard

  const skeletonVariant = useMemo<'files' | 'campuses' | 'buildings' | 'rooms'>(() => {
    if (currentView === 'rooms') return 'rooms'
    if (currentView === 'buildings') return 'buildings'
    if (currentView === 'campuses') return 'campuses'
    return 'files'
  }, [currentView])

  const skeletonCount = useMemo(() => {
    if (currentView === 'files') return Math.max(campusFiles.length, 1)
    if (currentView === 'campuses') return Math.max(campusGroups.size, 1)
    if (currentView === 'buildings') return Math.max(buildingsForCampus.size, 1)

    if (searchTerm || hasActiveFilters) {
      return Math.max(filteredRooms.length, 1)
    }

    return Math.max(roomsForBuilding.length, 1)
  }, [
    currentView,
    campusFiles.length,
    campusGroups.size,
    buildingsForCampus.size,
    roomsForBuilding.length,
    filteredRooms.length,
    searchTerm,
    hasActiveFilters
  ])

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

  const handleAddRoom = async (openTagsAfterCreate: boolean = false) => {
    if (!selectedFile) return
    if (!formData.campus || !formData.building || !formData.room || formData.capacity <= 0) {
      alert('Please fill in all required fields')
      return
    }

    const optimisticId = -Date.now()
    const optimisticRoom: CampusRoom = {
      id: optimisticId,
      upload_group_id: selectedFile.upload_group_id,
      school_name: selectedFile.school_name,
      file_name: 'Manual Entry',
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
      college: formData.college || null,
    }

    setAllRooms((prev) => [optimisticRoom, ...prev])
    setSyncing(true)

    try {
      const { data, error } = await (supabase
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
        .select('*')
        .single()

      if (error) throw error

        setAllRooms((prev) => prev.map((room) => (room.id === optimisticId ? (data as CampusRoom) : room)))

      if (openTagsAfterCreate && data?.id) {
        const createdRoom = data as CampusRoom
        setEditingRoom(createdRoom)
        setFormData({
          campus: createdRoom.campus || '',
          building: createdRoom.building || '',
          room: createdRoom.room || '',
          room_code: createdRoom.room_code || '',
          capacity: createdRoom.capacity || 30,
          floor_number: createdRoom.floor_number || 1,
          room_type: normalizeRoomType(createdRoom.room_type),
          specific_classification: createdRoom.specific_classification || '',
          has_ac: createdRoom.has_ac || false,
          has_whiteboard: createdRoom.has_whiteboard ?? true,
          has_tv: createdRoom.has_tv || false,
          status: createdRoom.status || 'usable',
          notes: createdRoom.notes || '',
          college: createdRoom.college || ''
        })
        setSuccessMessage('Room added. You can now add Equipment & Feature Tags.')
      } else {
        setSuccessMessage('Room added successfully!')
        resetForm()
      }

      void fetchRoomsForFile(selectedFile.upload_group_id)
      void fetchCampusFiles()
      void fetchSystemRoomOptions()
      router.refresh() // Force refresh cached data
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      setAllRooms((prev) => prev.filter((room) => room.id !== optimisticId))
      console.error('Error adding room:', error)
      alert(error.message || 'Failed to add room')
    } finally {
      setSyncing(false)
    }
  }

  const handleUpdateRoom = async () => {
    if (!editingRoom || !editingRoom.id) return

    const previousRoom = allRooms.find((room) => room.id === editingRoom.id)
    const optimisticRoom: CampusRoom = {
      ...editingRoom,
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
      college: formData.college || null,
    }

    setAllRooms((prev) => prev.map((room) => (room.id === editingRoom.id ? optimisticRoom : room)))
    setSyncing(true)

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
      if (selectedFile) void fetchRoomsForFile(selectedFile.upload_group_id)
      router.refresh() // Force refresh cached data
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      if (previousRoom) {
        setAllRooms((prev) => prev.map((room) => (room.id === previousRoom.id ? previousRoom : room)))
      }
      console.error('Error updating room:', error)
      alert(error.message || 'Failed to update room')
    } finally {
      setSyncing(false)
    }
  }

  const handleDeleteRoom = async (room: CampusRoom) => {
    if (!room.id) return
    if (!confirm('Are you sure you want to archive this room? You can restore it from the Archive.')) return

    const previousRooms = allRooms
    setAllRooms((prev) => prev.filter((item) => item.id !== room.id))
    setSyncing(true)

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
        throw new Error('Archive failed - no rows affected. Please check your permissions or run the RLS fix script in Supabase.')
      }

      setSuccessMessage('Room archived successfully!')
      if (selectedFile) void fetchRoomsForFile(selectedFile.upload_group_id)
      void fetchCampusFiles()
      router.refresh() // Force refresh cached data
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      setAllRooms(previousRooms)
      console.error('Error archiving room:', error)
      alert(error.message || 'Failed to archive room')
    } finally {
      setSyncing(false)
    }
  }

  const handleDeleteFile = async () => {
    if (!fileToDelete) return
    setDeletingFile(true)

    const previousCampusFiles = campusFiles
    const previousSelectedFile = selectedFile
    const previousRooms = allRooms

    setCampusFiles((prev) => prev.filter((file) => file.upload_group_id !== fileToDelete.upload_group_id))
    if (selectedFile?.upload_group_id === fileToDelete.upload_group_id) {
      setCurrentView('files')
      setSelectedFile(null)
      setAllRooms([])
    }
    setSyncing(true)

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
      const { data, error } = await supabase
        .from('campuses')
        .delete()
        .eq('upload_group_id', fileToDelete.upload_group_id)
        .select()
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('Archive failed - database did not confirm the change. Check RLS policies in Supabase.')
      }

      setSuccessMessage(`"${fileToDelete.school_name}" archived successfully!`)
      setShowDeleteFileModal(false)
      setFileToDelete(null)

      // Reset if currently viewing this file
      if (selectedFile?.upload_group_id === fileToDelete.upload_group_id) {
        setCurrentView('files')
        setSelectedFile(null)
        setAllRooms([])
      }

      void fetchCampusFiles()
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      setCampusFiles(previousCampusFiles)
      setSelectedFile(previousSelectedFile)
      setAllRooms(previousRooms)
      console.error('Error archiving file:', error)
      alert(error.message || 'Failed to archive file')
    } finally {
      setDeletingFile(false)
      setSyncing(false)
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
      room_type: normalizeRoomType(room.room_type),
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
      room_type: 'Lecture Room (Lec)',
      specific_classification: '',
      has_ac: false,
      has_whiteboard: true,
      has_tv: false,
      status: 'usable',
      notes: '',
      college: ''
    })
  }

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const shouldOpenTagsAfterCreate = submitter?.value === 'save-and-tags'
    if (editingRoom) {
      handleUpdateRoom()
    } else {
      handleAddRoom(shouldOpenTagsAfterCreate)
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
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className={`${styles.main} ${!sidebarOpen ? styles.fullWidth : ''}`}>
        <div className={styles.container}>
          {/* Success Message */}
          {successMessage && (
            <div className={styles.successMessage}>{successMessage}</div>
          )}
          {syncing && (
            <div className={styles.syncHint}>Syncing latest changes...</div>
          )}

          {/* Breadcrumb Navigation */}
          {currentView !== 'files' && (
            <div className={styles.breadcrumb}>
              <button className={styles.backBtn} onClick={handleBack}>
                <MdArrowBack size={16} />
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
          <div className={styles.header} id="rooms-header">
            <div className={styles.headerTitleSection}>
              <div className={styles.headerIconWrapper}>
                <MdDomain size={28} />
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
              <button className={styles.addBtn} onClick={() => setShowAddModal(true)} id="rooms-add-btn">
                <MdAdd size={18} />
                Add Room
              </button>
            )}
          </div>

          {/* Stats Grid - Only show when a file is selected */}
          {selectedFile && !loadingData && (
            <div className={styles.statsGrid} id="rooms-stats">
              <div className={styles.statCard}>
                <div className={styles.statIcon}><MdLocationOn size={24} /></div>
                <div className={styles.statContent}>
                  <p className={styles.statLabel}>Campuses</p>
                  <h3 className={styles.statValue}>{stats.totalCampuses}</h3>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}><MdDomain size={24} /></div>
                <div className={styles.statContent}>
                  <p className={styles.statLabel}>Buildings</p>
                  <h3 className={styles.statValue}>{stats.totalBuildings}</h3>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}><SiGoogleclassroom size={24} /></div>
                <div className={styles.statContent}>
                  <p className={styles.statLabel}>Total Rooms</p>
                  <h3 className={styles.statValue}>{stats.totalRooms}</h3>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}><MdPeople size={24} /></div>
                <div className={styles.statContent}>
                  <p className={styles.statLabel}>Total Capacity</p>
                  <h3 className={styles.statValue}>{stats.totalCapacity}</h3>
                </div>
              </div>
              <div className={`${styles.statCard} ${styles.statUsable}`}>
                <div className={styles.statIcon}><MdCheckCircle size={24} /></div>
                <div className={styles.statContent}>
                  <p className={styles.statLabel}>Usable</p>
                  <h3 className={styles.statValue}>{stats.usableRooms}</h3>
                </div>
              </div>
              <div className={`${styles.statCard} ${styles.statNotUsable}`}>
                <div className={styles.statIcon}><MdCancel size={24} /></div>
                <div className={styles.statContent}>
                  <p className={styles.statLabel}>Not Usable</p>
                  <h3 className={styles.statValue}>{stats.notUsableRooms}</h3>
                </div>
              </div>
            </div>
          )}

          {/* Search & Filter Section */}
          {selectedFile && currentView !== 'files' && (
            <div className={styles.searchSection} id="rooms-search">
              <div className={styles.searchBox}>
                <MdSearch className={styles.searchIcon} size={18} />
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
                  <MdAir size={14} /> AC
                </button>
                <button className={`${styles.amenityBtn} ${filterTV ? styles.active : ''}`} onClick={() => setFilterTV(!filterTV)}>
                  <MdTv size={14} /> TV
                </button>
                <button className={`${styles.amenityBtn} ${filterWhiteboard ? styles.active : ''}`} onClick={() => setFilterWhiteboard(!filterWhiteboard)}>
                  <MdCoPresent size={14} /> Board
                </button>
              </div>
              {hasActiveFilters && (
                <button className={styles.clearFiltersBtn} onClick={clearFilters}>
                  <MdClose size={14} /> Clear
                </button>
              )}
            </div>
          )}

          {/* Loading State */}
          {(loading || loadingData) && (
            <div className={styles.loadingState}>
              <div className={`${styles.loadingSkeletonGrid} ${styles[`loadingSkeletonGrid_${skeletonVariant}`]}`}>
                {Array.from({ length: skeletonCount }).map((_, idx) => (
                  <div key={`skeleton-${idx}`} className={`${styles.loadingSkeletonCard} ${styles[`loadingSkeletonCard_${skeletonVariant}`]}`}>
                    <div className={styles.loadingSkeletonLine} style={{ width: idx % 2 ? '62%' : '48%' }} />
                    <div className={styles.loadingSkeletonLine} style={{ width: '90%' }} />
                    <div className={styles.loadingSkeletonLine} style={{ width: idx % 2 ? '78%' : '56%' }} />

                    {skeletonVariant === 'rooms' && (
                      <>
                        <div className={styles.loadingSkeletonLine} style={{ width: '36%' }} />
                        <div className={styles.loadingSkeletonAmenities}>
                          <span className={styles.loadingSkeletonChip} />
                          <span className={styles.loadingSkeletonChip} />
                          <span className={styles.loadingSkeletonChip} />
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FILES VIEW */}
          {!loading && currentView === 'files' && (
            <>
              {campusFiles.length === 0 ? (
                <div className={styles.emptyState}>
                  <MdDescription size={64} />
                  <h3>No Campus Files Found</h3>
                  <p>Upload a Campus/Building CSV file to get started</p>
                  <button className={styles.addBtn} onClick={() => router.push('/LandingPages/UploadCSV')} id="rooms-empty-upload-btn">
                    <MdAdd size={18} /> Upload CSV
                  </button>
                </div>
              ) : (
                <div className={styles.fileGrid} id="rooms-file-grid">
                  {campusFiles.map(file => {
                    return (
                      <div
                        key={file.upload_group_id}
                        className={styles.fileCard}
                        onClick={() => handleSelectFile(file)}
                      >
                        <div className={styles.fileCardContent}>
                          <div className={styles.fileIcon}>
                            <MdSchool size={24} />
                          </div>
                          <div className={styles.fileInfo}>
                            <h4>{file.school_name}</h4>
                            <p><MdMeetingRoom size={14} /> {file.row_count} rooms</p>
                            <p className={styles.fileMeta}>
                              <MdDescription size={12} /> {file.file_name}
                            </p>
                            <p className={styles.fileMeta}>
                              <MdCalendarToday size={12} /> {new Date(file.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className={styles.fileActions}>
                          <button
                            className={styles.deleteBtn}
                            onClick={(e) => { e.stopPropagation(); setFileToDelete(file); setShowDeleteFileModal(true); }}
                            title="Archive file"
                          >
                            <MdArchive size={16} />
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
                return (
                  <div
                    key={campusName}
                    className={styles.campusCard}
                    onClick={() => handleSelectCampus(campusName)}
                  >
                    <div className={styles.campusCardContent}>
                      <div className={styles.campusIcon}>
                        <MdLocationOn size={24} />
                      </div>
                      <div className={styles.campusInfo}>
                        <h4>{campusName}</h4>
                        <p><MdDomain size={14} /> {buildings} buildings</p>
                        <p><MdMeetingRoom size={14} /> {rooms.length} rooms</p>
                        <p className={styles.campusMeta}><MdPeople size={12} /> {totalCapacity} total capacity</p>
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
                return (
                  <div
                    key={buildingName}
                    className={styles.buildingCard}
                    onClick={() => handleSelectBuilding(buildingName)}
                  >
                    <div className={styles.buildingCardContent}>
                      <div className={styles.buildingIcon}>
                        <MdDomain size={24} />
                      </div>
                      <div className={styles.buildingInfo}>
                        <h4>{buildingName}</h4>
                        <p><MdLayers size={14} /> {floors} floors</p>
                        <p><MdMeetingRoom size={14} /> {rooms.length} rooms</p>
                        <p className={styles.buildingMeta}><MdPeople size={12} /> {totalCapacity} total capacity</p>
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
                <h2><MdMeetingRoom size={20} /> Rooms in {selectedBuildingName}</h2>
                <span className={styles.roomCount}>{roomsForBuilding.length} rooms</span>
              </div>
              <div className={styles.roomsGrid}>
                {roomsForBuilding.map((room, index) => {
                  const statusInfo = getRoomStatusInfo(room.status)
                  return (
                    <div key={room.id} className={`${styles.roomCard} ${styles[statusInfo.icon]}`} id={index === 0 ? "first-room-card" : undefined}>
                      <div className={styles.roomStatusBadge} style={{ background: statusInfo.bgColor, color: statusInfo.color }}>
                        {statusInfo.icon === 'check' && <MdCheckCircle size={12} />}
                        {statusInfo.icon === 'x' && <MdCancel size={12} />}
                        {statusInfo.icon === 'wrench' && <MdBuild size={12} />}
                        {statusInfo.label}
                      </div>
                      <div className={styles.roomCardIcon} style={{ background: statusInfo.color }}>
                        <MdMeetingRoom size={20} />
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
                            <MdSchool size={10} style={{ marginRight: '3px', verticalAlign: 'middle' }} />
                            {room.college}
                          </span>
                        )}
                        <div className={styles.roomInfoRow}>
                          <p><MdPeople size={11} /> Capacity: {room.capacity}</p>
                          <p><MdLocationOn size={11} /> Floor {displayValue(room.floor_number, 'G')}</p>
                        </div>
                        <p className={styles.roomType}>{normalizeRoomType(room.room_type)}</p>
                      </div>
                      <div className={styles.roomAmenities}>
                        <span className={room.has_ac ? styles.hasAmenity : styles.noAmenity} title="AC"><MdAir size={14} /></span>
                        <span className={room.has_tv ? styles.hasAmenity : styles.noAmenity} title="TV"><MdTv size={14} /></span>
                        <span className={room.has_whiteboard ? styles.hasAmenity : styles.noAmenity} title="Board"><MdCoPresent size={14} /></span>
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
                            <MdLabel size={10} /> {roomFeatureCounts[room.id]}
                          </span>
                        )}
                      </div>
                      <div className={styles.roomActions}>
                        <button className={styles.infoBtn} onClick={() => handleShowRoomDetail(room)} title="View room details & images">
                          <MdInfo size={14} />
                        </button>
                        <button className={styles.editBtn} onClick={() => handleEditRoom(room)}><MdEdit size={14} /></button>
                        <button className={styles.deleteBtn} onClick={() => handleDeleteRoom(room)} title="Archive room"><MdArchive size={14} /></button>
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
                        {statusInfo.icon === 'check' && <MdCheckCircle size={12} />}
                        {statusInfo.icon === 'x' && <MdCancel size={12} />}
                        {statusInfo.icon === 'wrench' && <MdBuild size={12} />}
                        {statusInfo.label}
                      </div>
                      <div className={styles.roomCardIcon} style={{ background: statusInfo.color }}>
                        <MdMeetingRoom size={20} />
                      </div>
                      <div className={styles.roomCardInfo}>
                        <h4>{room.room}</h4>
                        <span className={styles.roomLocation}>{room.campus} › {room.building}</span>
                        {room.room_code && <span className={styles.roomCode}>{room.room_code}</span>}
                        <p><MdPeople size={12} /> Capacity: {room.capacity}</p>
                      </div>
                      <div className={styles.roomAmenities}>
                        <span className={room.has_ac ? styles.hasAmenity : styles.noAmenity} title="AC"><MdAir size={14} /></span>
                        <span className={room.has_tv ? styles.hasAmenity : styles.noAmenity} title="TV"><MdTv size={14} /></span>
                        <span className={room.has_whiteboard ? styles.hasAmenity : styles.noAmenity} title="Board"><MdCoPresent size={14} /></span>
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
                            <MdLabel size={10} /> {roomFeatureCounts[room.id]}
                          </span>
                        )}
                      </div>
                      <div className={styles.roomActions}>
                        <button className={styles.infoBtn} onClick={() => handleShowRoomDetail(room)} title="View room details & images">
                          <MdInfo size={14} />
                        </button>
                        <button className={styles.editBtn} onClick={() => handleEditRoom(room)}><MdEdit size={14} /></button>
                        <button className={styles.deleteBtn} onClick={() => handleDeleteRoom(room)} title="Archive room"><MdArchive size={14} /></button>
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
                  <label>Campus *</label>
                  <input
                    type="text"
                    value={formData.campus}
                    onChange={e => setFormData(prev => ({ ...prev, campus: e.target.value }))}
                    required
                    className={styles.formInput}
                    placeholder="e.g., Main Campus"
                    list="campus-suggestions"
                  />
                  <datalist id="campus-suggestions">
                    {suggestedCampuses.map(campus => (
                      <option key={campus} value={campus} />
                    ))}
                  </datalist>
                </div>
                <div className={styles.formGroup}>
                  <label>Building *</label>
                  <input
                    type="text"
                    value={formData.building}
                    onChange={e => setFormData(prev => ({ ...prev, building: e.target.value }))}
                    required
                    className={styles.formInput}
                    placeholder="e.g., Federizo Hall"
                    list="building-suggestions"
                  />
                  <datalist id="building-suggestions">
                    {suggestedBuildings.map(building => (
                      <option key={building} value={building} />
                    ))}
                  </datalist>
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
                    list="room-name-suggestions"
                  />
                  <datalist id="room-name-suggestions">
                    {suggestedRoomNames.map(roomName => (
                      <option key={roomName} value={roomName} />
                    ))}
                  </datalist>
                </div>
                <div className={styles.formGroup}>
                  <label>Room Code (Optional)</label>
                  <input
                    type="text"
                    value={formData.room_code}
                    onChange={e => setFormData(prev => ({ ...prev, room_code: e.target.value }))}
                    className={styles.formInput}
                    placeholder="e.g., CS-101"
                    list="room-code-suggestions"
                  />
                  <datalist id="room-code-suggestions">
                    {suggestedRoomCodes.map(roomCode => (
                      <option key={roomCode} value={roomCode} />
                    ))}
                  </datalist>
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
                    {ROOM_TYPE_OPTIONS.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
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
                <label id="rooms-amenities-label">Basic Amenities</label>
                <div className={styles.featuresGrid}>
                  <label className={styles.featureCheckbox}>
                    <input
                      type="checkbox"
                      checked={formData.has_ac}
                      onChange={e => setFormData(prev => ({ ...prev, has_ac: e.target.checked }))}
                    />
                    <MdAir size={16} /> Air Conditioned
                  </label>
                  <label className={styles.featureCheckbox}>
                    <input
                      type="checkbox"
                      checked={formData.has_whiteboard}
                      onChange={e => setFormData(prev => ({ ...prev, has_whiteboard: e.target.checked }))}
                    />
                    <MdCoPresent size={16} /> Whiteboard
                  </label>
                  <label className={styles.featureCheckbox}>
                    <input
                      type="checkbox"
                      checked={formData.has_tv}
                      onChange={e => setFormData(prev => ({ ...prev, has_tv: e.target.checked }))}
                    />
                    <MdTv size={16} /> TV
                  </label>
                </div>
              </div>

              {/* Equipment & Feature Tags - Only for existing rooms */}
              {editingRoom?.id && (
                <div className={styles.formGroup}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }} id="rooms-equipment-label">
                    <MdLabel size={16} /> Equipment & Feature Tags
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
                  }} id="rooms-equipment-manager">
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
                  <MdInfo size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />
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
                {!editingRoom && (
                  <button type="submit" value="save-and-tags" className={styles.btnSaveSecondary}>
                    <MdLabel size={16} /> Save & Add Tags
                  </button>
                )}
                <button type="submit" className={styles.btnSave}>
                  <MdSave size={16} /> {editingRoom ? 'Update Room' : 'Add Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive File Modal */}
      {showDeleteFileModal && fileToDelete && (
        <div className={styles.modalOverlay} onClick={() => { setShowDeleteFileModal(false); setFileToDelete(null); }}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Archive Campus File</h3>
              <button className={styles.modalClose} onClick={() => { setShowDeleteFileModal(false); setFileToDelete(null); }}>×</button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.dangerText}>
                Are you sure you want to archive "{fileToDelete.school_name}"?
              </p>
              <p className={styles.warningText}>
                This will archive all {fileToDelete.row_count} rooms in this file. You can restore them from the Archive.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnCancel} onClick={() => { setShowDeleteFileModal(false); setFileToDelete(null); }}>Cancel</button>
              <button className={styles.btnDelete} onClick={handleDeleteFile} disabled={deletingFile}>
                {deletingFile ? 'Archiving...' : 'Archive File'}
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
              <h3><MdMeetingRoom size={20} /> {selectedRoom.room}</h3>
              <button className={styles.roomDetailClose} onClick={handleCloseRoomDetail}>×</button>
            </div>
            <div className={styles.roomDetailBody}>
              {/* Room Information */}
              <div className={styles.roomDetailSection}>
                <h4><MdDomain size={16} /> Room Information</h4>
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
                    <span className={styles.roomDetailValue}>{normalizeRoomType(selectedRoom.room_type)}</span>
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
                <h4><MdAir size={16} /> Amenities</h4>
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
                  <h4><MdLabel size={16} /> Equipment & Features</h4>
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
                <h4><MdImage size={16} /> Room Images</h4>
                <input
                  ref={roomImageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  style={{ display: 'none' }}
                  onChange={handleRoomImageUpload}
                />
                <div style={{ marginBottom: '12px' }}>
                  <button
                    className={styles.uploadImageBtn}
                    onClick={openRoomImagePicker}
                    disabled={uploadingRoomImage}
                  >
                    <MdUpload size={16} /> {uploadingRoomImage ? 'Uploading...' : 'Upload Images'}
                  </button>
                </div>
                {loadingImages ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Loading images...</p>
                ) : roomImages.length > 0 ? (
                  <div className={styles.imageGallery}>
                    {roomImages.map(img => (
                      <div key={img.id} className={styles.imageItem}>
                        <img src={img.image_url} alt={img.caption || 'Room image'} />
                        <button
                          className={styles.imageDeleteBtn}
                          onClick={(e) => { e.stopPropagation(); handleDeleteRoomImage(img) }}
                          title="Archive image"
                        >
                          <MdArchive size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.noImages}>
                    <MdImage size={48} style={{ color: 'var(--text-secondary)', marginBottom: '12px' }} />
                    <p>No images available for this room</p>
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
