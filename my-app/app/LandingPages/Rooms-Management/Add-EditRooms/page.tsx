'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import styles from './styles.module.css'
import {
  PenSquare,
  Plus,
  Building2,
  DoorOpen,
  Users,
  Save,
  X,
  Trash2,
  Edit2,
  AlertTriangle,
  CheckCircle,
  University,
  Hotel,
  FileSpreadsheet,
  Calendar,
  ChevronDown,
  ChevronRight,
  Landmark,
  MapPin,
  Wind,
  Tv,
  PresentationIcon,
  Accessibility,
  ArrowLeft,
  Search
} from 'lucide-react'

// Helper function to display "None" for null/undefined values
const displayValue = (value: any, defaultVal: string = 'None'): string => {
  if (value === null || value === undefined || value === '') return defaultVal
  return String(value)
}

// Helper function to display boolean values
const displayBool = (value: boolean | null | undefined): string => {
  if (value === null || value === undefined) return 'None'
  return value ? 'Yes' : 'No'
}

// Campus room from CSV uploads
interface CampusRoom {
  id: number
  upload_group_id: number
  school_name: string
  campus: string
  building: string
  room: string
  room_code: string | null
  capacity: number
  floor_number: number | null
  room_type: string
  specific_classification: string | null
  has_ac: boolean | null
  has_whiteboard: boolean | null
  has_tv: boolean | null
  has_projector: boolean | null
  status: string
  notes: string | null
  file_name: string
  created_at: string
  college: string | null
}

interface CampusGroup {
  upload_group_id: number
  school_name: string
  file_name: string
  created_at: string
  room_count: number
}

export default function AddEditRoomsPage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [campusGroups, setCampusGroups] = useState<CampusGroup[]>([])
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null)
  const [rooms, setRooms] = useState<CampusRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [editingRoom, setEditingRoom] = useState<CampusRoom | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedBuildings, setExpandedBuildings] = useState<Set<string>>(new Set())

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

  const toggleSidebar = () => setSidebarOpen(prev => !prev)

  useEffect(() => {
    checkAuth()
    fetchCampusGroups()
  }, [])

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        router.push('/faculty/login')
        return
      }

      // Only admin can access admin pages
      if (session.user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        router.push('/faculty/home')
        return
      }
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/faculty/login')
    }
  }

  // Fetch all upload groups from campuses table
  const fetchCampusGroups = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('campuses')
        .select('upload_group_id, school_name, file_name, created_at')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Group by upload_group_id
      const grouped = (data || []).reduce((acc: CampusGroup[], curr: any) => {
        const existing = acc.find(item => item.upload_group_id === curr.upload_group_id)
        if (existing) {
          existing.room_count++
        } else {
          acc.push({
            upload_group_id: curr.upload_group_id,
            school_name: curr.school_name,
            file_name: curr.file_name,
            created_at: curr.created_at,
            room_count: 1
          })
        }
        return acc
      }, [])

      setCampusGroups(grouped)
    } catch (error: any) {
      console.error('Error fetching campus groups:', error)
      setErrorMessage(error?.message || 'Failed to fetch campus data')
    } finally {
      setLoading(false)
    }
  }

  // Fetch rooms for a specific upload group
  const fetchRooms = async (groupId: number) => {
    setLoadingRooms(true)
    try {
      const { data, error } = await supabase
        .from('campuses')
        .select('*')
        .eq('upload_group_id', groupId)
        .order('campus', { ascending: true })
        .order('building', { ascending: true })
        .order('room', { ascending: true })

      if (error) throw error
      setRooms(data || [])
    } catch (error: any) {
      console.error('Error fetching rooms:', error)
      setErrorMessage(error?.message || 'Failed to fetch rooms')
    } finally {
      setLoadingRooms(false)
    }
  }

  const handleSelectGroup = (groupId: number) => {
    if (selectedGroup === groupId) {
      setSelectedGroup(null)
      setRooms([])
      setExpandedBuildings(new Set())
    } else {
      setSelectedGroup(groupId)
      fetchRooms(groupId)
      setExpandedBuildings(new Set())
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (!selectedGroup) {
      setErrorMessage('Please select a campus group first')
      return
    }

    try {
      const selectedGroupData = campusGroups.find(g => g.upload_group_id === selectedGroup)

      if (editingRoom) {
        // Update existing room
        console.log('Updating room ID:', editingRoom.id)
        const { data, error } = await (supabase
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
            has_projector: false,
            status: formData.status || 'usable',
            notes: formData.notes || null
          })
          .eq('id', editingRoom.id)
          .select()

        console.log('Update result:', { data, error })
        if (error) throw error
        if (!data || data.length === 0) {
          throw new Error('Update failed - database did not confirm the change. Check RLS policies in Supabase.')
        }
        setSuccessMessage('Room updated successfully!')
      } else {
        // Add new room
        console.log('Inserting new room')
        const { data, error } = await (supabase
          .from('campuses') as any)
          .insert({
            upload_group_id: selectedGroup,
            school_name: selectedGroupData?.school_name || 'Unknown School',
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
          .select()

        console.log('Insert result:', { data, error })
        if (error) throw error
        if (!data || data.length === 0) {
          throw new Error('Insert failed - database did not confirm the change. Check RLS policies in Supabase.')
        }
        setSuccessMessage('Room added successfully!')
      }

      resetForm()
      fetchRooms(selectedGroup)
      fetchCampusGroups() // Refresh counts
      router.refresh() // Force refresh cached data
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      console.error('Error saving room:', error)
      setErrorMessage(error.message)
    }
  }

  const handleEdit = (room: CampusRoom) => {
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

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this room?')) return

    try {
      console.log('Deleting room ID:', id)
      const { data, error } = await (supabase
        .from('campuses') as any)
        .delete()
        .eq('id', id)
        .select()

      console.log('Delete result:', { data, error })
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('Delete failed - database did not confirm the change. Check RLS policies in Supabase.')
      }
      setSuccessMessage('Room deleted successfully!')
      if (selectedGroup) {
        fetchRooms(selectedGroup)
        fetchCampusGroups()
      }
      router.refresh() // Force refresh cached data
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      console.error('Error deleting room:', error)
      setErrorMessage(error.message)
    }
  }

  const resetForm = () => {
    setEditingRoom(null)
    setShowAddModal(false)
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

  // Group rooms by building
  const getBuildingGroups = () => {
    const groups = new Map<string, CampusRoom[]>()
    const filteredRooms = rooms.filter(room =>
      !searchTerm ||
      room.room.toLowerCase().includes(searchTerm.toLowerCase()) ||
      room.building.toLowerCase().includes(searchTerm.toLowerCase()) ||
      room.campus.toLowerCase().includes(searchTerm.toLowerCase())
    )

    filteredRooms.forEach(room => {
      const key = `${room.campus}|||${room.building}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(room)
    })
    return groups
  }

  const toggleBuilding = (key: string) => {
    const newExpanded = new Set(expandedBuildings)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedBuildings(newExpanded)
  }

  const selectedGroupData = campusGroups.find(g => g.upload_group_id === selectedGroup)

  return (
    <div className={styles.pageContainer} data-page="admin">
      <MenuBar
        onToggleSidebar={toggleSidebar}
        showSidebarToggle={true}
        showAccountIcon={true}
      />
      <Sidebar isOpen={sidebarOpen} />

      <main className={`${styles.mainContent} ${sidebarOpen ? styles.withSidebar : ''}`}>
        <div className={styles.contentWrapper}>
          {/* Back Button */}
          <button
            className={styles.backButton}
            onClick={() => router.push('/LandingPages/Home')}
          >
            <ArrowLeft size={18} />
            Back to Home
          </button>

          {/* Header */}
          <div className={styles.headerCard}>
            <div className={styles.headerContent}>
              <div className={styles.headerInfo}>
                <div className={styles.headerTitleRow}>
                  <div className={styles.headerIcon}>
                    <PenSquare size={24} />
                  </div>
                  <h1 className={styles.headerTitle}>Add / Edit Rooms</h1>
                </div>
                <p className={styles.headerSubtitle}>Manage room information from uploaded Campus/Building CSV files</p>
              </div>
            </div>
          </div>

          {/* Messages */}
          {successMessage && (
            <div className={styles.successMessage}>
              <CheckCircle size={20} />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className={styles.errorMessage}>
              <AlertTriangle size={20} />
              <span>{errorMessage}</span>
              <button onClick={() => setErrorMessage('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>
          )}

          {/* Campus Group Selection */}
          {loading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner}></div>
              <p>Loading campus data...</p>
            </div>
          ) : campusGroups.length === 0 ? (
            <div className={styles.emptyState}>
              <FileSpreadsheet size={64} />
              <h3 className={styles.emptyTitle}>No Campus Data Found</h3>
              <p className={styles.emptyText}>Upload a Campus/Building CSV file first to manage rooms</p>
              <button
                onClick={() => router.push('/LandingPages/UploadCSV')}
                className={styles.addButton}
              >
                <Plus size={20} />
                Upload CSV
              </button>
            </div>
          ) : (
            <>
              {/* Campus Group Cards */}
              <div className={styles.sectionHeader}>
                <h2>
                  <University size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                  Select School/Campus File
                </h2>
              </div>

              <div className={styles.campusGrid}>
                {campusGroups.map(group => (
                  <div
                    key={group.upload_group_id}
                    className={`${styles.campusCard} ${selectedGroup === group.upload_group_id ? styles.selected : ''}`}
                    onClick={() => handleSelectGroup(group.upload_group_id)}
                  >
                    <div className={styles.campusCardIcon}>
                      <University size={32} />
                    </div>
                    <div className={styles.campusCardContent}>
                      <h3>{group.school_name}</h3>
                      <p className={styles.campusCardMeta}>
                        <DoorOpen size={14} /> {group.room_count} rooms
                      </p>
                      <p className={styles.campusCardFile}>
                        <FileSpreadsheet size={14} /> {group.file_name}
                      </p>
                      <p className={styles.campusCardDate}>
                        <Calendar size={14} /> {new Date(group.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {selectedGroup === group.upload_group_id && (
                      <div className={styles.selectedBadge}>
                        <CheckCircle size={20} />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Rooms Management Section */}
              {selectedGroup && (
                <div className={styles.roomsSection}>
                  <div className={styles.roomsSectionHeader}>
                    <div>
                      <h2>
                        <Building2 size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                        Rooms in {selectedGroupData?.school_name}
                      </h2>
                      <p className={styles.roomsSectionSubtitle}>
                        {rooms.length} rooms total
                      </p>
                    </div>
                    <div className={styles.roomsActions}>
                      <div className={styles.searchWrapper}>
                        <Search size={18} className={styles.searchIcon} />
                        <input
                          type="text"
                          placeholder="Search rooms..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className={styles.searchInput}
                        />
                      </div>
                      <button onClick={() => setShowAddModal(true)} className={styles.addButton}>
                        <Plus size={20} />
                        Add Room
                      </button>
                    </div>
                  </div>

                  {loadingRooms ? (
                    <div className={styles.loadingState}>
                      <div className={styles.spinner}></div>
                      <p>Loading rooms...</p>
                    </div>
                  ) : rooms.length === 0 ? (
                    <div className={styles.emptyState}>
                      <DoorOpen size={48} />
                      <h3>No Rooms Found</h3>
                      <p>Add rooms to this campus group</p>
                    </div>
                  ) : (
                    <div className={styles.buildingsContainer}>
                      {Array.from(getBuildingGroups().entries()).map(([key, buildingRooms]) => {
                        const [campus, building] = key.split('|||')
                        const isExpanded = expandedBuildings.has(key)
                        const totalCapacity = buildingRooms.reduce((sum, r) => sum + r.capacity, 0)

                        return (
                          <div key={key} className={styles.buildingGroup}>
                            <div
                              className={styles.buildingHeader}
                              onClick={() => toggleBuilding(key)}
                            >
                              <div className={styles.buildingHeaderLeft}>
                                {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                <Hotel size={20} />
                                <div>
                                  <h3>{building}</h3>
                                  <span className={styles.buildingCampus}>
                                    <Landmark size={14} /> {campus}
                                  </span>
                                </div>
                              </div>
                              <div className={styles.buildingHeaderRight}>
                                <span className={styles.roomBadge}>{buildingRooms.length} rooms</span>
                                <span className={styles.capacityBadge}>
                                  <Users size={14} /> {totalCapacity} seats
                                </span>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className={styles.roomsTable}>
                                <table>
                                  <thead>
                                    <tr>
                                      <th>Room</th>
                                      <th>Floor</th>
                                      <th>Capacity</th>
                                      <th>Type</th>
                                      <th>Features</th>
                                      <th>Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {buildingRooms.map(room => (
                                      <tr key={room.id}>
                                        <td>
                                          <div className={styles.roomCell}>
                                            <DoorOpen size={16} />
                                            <span>{room.room}</span>
                                            {room.room_code && (
                                              <small style={{ color: 'var(--text-light)', marginLeft: '4px' }}>({room.room_code})</small>
                                            )}
                                          </div>
                                        </td>
                                        <td>
                                          <div className={styles.floorCell}>
                                            <MapPin size={14} />
                                            {room.floor_number ? `Floor ${room.floor_number}` : 'None'}
                                          </div>
                                        </td>
                                        <td>
                                          <div className={styles.capacityCell}>
                                            <Users size={14} />
                                            {room.capacity}
                                          </div>
                                        </td>
                                        <td>
                                          <span className={styles.roomTypeBadge}>
                                            {room.room_type || 'Classroom'}
                                          </span>
                                        </td>
                                        <td>
                                          <div className={styles.featuresCell}>
                                            <span className={styles.featureIcon} title={`AC: ${displayBool(room.has_ac)}`} style={{
                                              opacity: room.has_ac ? 1 : 0.3
                                            }}>
                                              <Wind size={14} />
                                            </span>
                                            <span className={styles.featureIcon} title={`Whiteboard: ${displayBool(room.has_whiteboard)}`} style={{
                                              opacity: room.has_whiteboard ? 1 : 0.3
                                            }}>
                                              <PresentationIcon size={14} />
                                            </span>
                                            <span className={styles.featureIcon} title={`TV: ${displayBool(room.has_tv)}`} style={{
                                              opacity: room.has_tv ? 1 : 0.3
                                            }}>
                                              <Tv size={14} />
                                            </span>
                                          </div>
                                        </td>
                                        <td>
                                          <div className={styles.actionsCell}>
                                            <button
                                              onClick={() => handleEdit(room)}
                                              className={styles.editBtn}
                                              title="Edit Room"
                                            >
                                              <Edit2 size={16} />
                                            </button>
                                            <button
                                              onClick={() => handleDelete(room.id)}
                                              className={styles.deleteBtn}
                                              title="Delete Room"
                                            >
                                              <Trash2 size={16} />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className={styles.modalOverlay} onClick={() => resetForm()}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editingRoom ? 'Edit Room' : 'Add New Room'}
              </h2>
              <button onClick={resetForm} className={styles.modalCloseButton}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.modalBody}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    <Landmark size={16} /> Campus/College *
                  </label>
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
                  <label className={styles.formLabel}>
                    <Hotel size={16} /> Building *
                  </label>
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
                  <label className={styles.formLabel}>
                    <DoorOpen size={16} /> Room Name *
                  </label>
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
                  <label className={styles.formLabel}>
                    Room ID (Optional)
                  </label>
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
                  <label className={styles.formLabel}>
                    <Users size={16} /> Capacity *
                  </label>
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
                  <label className={styles.formLabel}>
                    <MapPin size={16} /> Floor (Optional)
                  </label>
                  <input
                    type="number"
                    value={formData.floor_number || ''}
                    onChange={e => setFormData(prev => ({ ...prev, floor_number: parseInt(e.target.value) || 0 }))}
                    min="0"
                    className={styles.formInput}
                    placeholder="Leave empty for None"
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Primary Type</label>
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
                    <option value="Auditorium">Auditorium</option>
                    <option value="Classroom">Classroom</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Specific Classification</label>
                  <input
                    type="text"
                    value={formData.specific_classification}
                    onChange={e => setFormData(prev => ({ ...prev, specific_classification: e.target.value }))}
                    className={styles.formInput}
                    placeholder="e.g., Physics Lab, Computer Room"
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.featuresLabel}>Room Features</label>
                <div className={styles.featuresGrid}>
                  <label className={styles.featureCheckbox}>
                    <input
                      type="checkbox"
                      checked={formData.has_ac || false}
                      onChange={e => setFormData(prev => ({ ...prev, has_ac: e.target.checked }))}
                    />
                    <Wind size={16} />
                    <span>Air Conditioned</span>
                  </label>
                  <label className={styles.featureCheckbox}>
                    <input
                      type="checkbox"
                      checked={formData.has_whiteboard || false}
                      onChange={e => setFormData(prev => ({ ...prev, has_whiteboard: e.target.checked }))}
                    />
                    <PresentationIcon size={16} />
                    <span>Whiteboard</span>
                  </label>
                  <label className={styles.featureCheckbox}>
                    <input
                      type="checkbox"
                      checked={formData.has_tv || false}
                      onChange={e => setFormData(prev => ({ ...prev, has_tv: e.target.checked }))}
                    />
                    <Tv size={16} />
                    <span>TV</span>
                  </label>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Room Status</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData(prev => ({ ...prev, status: e.target.value }))}
                  className={styles.formSelect}
                  style={{
                    borderColor: formData.status === 'usable' ? '#22c55e' : formData.status === 'not_usable' ? '#ef4444' : '#f59e0b',
                    background: formData.status === 'usable' ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' :
                      formData.status === 'not_usable' ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)' :
                        'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'
                  }}
                >
                  <option value="usable">✓ Usable</option>
                  <option value="not_usable">✗ Not Usable</option>
                  <option value="maintenance">🔧 Under Maintenance</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className={styles.formTextarea}
                  placeholder="Additional notes about this room..."
                />
              </div>

              <div className={styles.modalFooter}>
                <button type="button" onClick={resetForm} className={styles.cancelButton}>
                  Cancel
                </button>
                <button type="submit" className={styles.saveButton}>
                  <Save size={18} />
                  {editingRoom ? 'Update Room' : 'Add Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
