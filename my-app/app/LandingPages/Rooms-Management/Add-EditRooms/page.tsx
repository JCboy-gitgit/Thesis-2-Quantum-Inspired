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
  Computer,
  Beaker,
  Projector,
  Wind,
  Accessibility
} from 'lucide-react'
import type { Room, RoomType } from '@/lib/database.types'

export default function AddEditRoomsPage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  
  const [formData, setFormData] = useState({
    room_code: '',
    room_name: '',
    building: '',
    floor_number: 1,
    capacity: 40,
    room_type: 'lecture' as RoomType,
    has_ac: false,
    has_projector: false,
    has_whiteboard: true,
    has_computers: 0,
    has_lab_equipment: false,
    is_accessible: false,
    notes: ''
  })

  const toggleSidebar = () => setSidebarOpen(prev => !prev)

  useEffect(() => {
    fetchRooms()
  }, [])

  const fetchRooms = async () => {
    setLoading(true)
    try {
      const { data, error } = await (supabase
        .from('rooms') as any)
        .select('*')
        .order('building', { ascending: true })
        .order('room_code', { ascending: true })

      if (error) {
        // Check if table doesn't exist
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          console.warn('Rooms table does not exist yet. Please run the database schema.')
          setErrorMessage('The rooms table has not been created yet. Please run the database schema in Supabase.')
        } else {
          throw error
        }
      } else {
        setRooms(data || [])
      }
    } catch (error: any) {
      console.error('Error fetching rooms:', error)
      setErrorMessage(error?.message || 'Failed to fetch rooms. Please check your database connection.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    
    try {
      if (editingRoom) {
        // Update existing room
        const { error } = await (supabase
          .from('rooms') as any)
          .update({
            room_code: formData.room_code,
            room_name: formData.room_name || null,
            building: formData.building,
            floor_number: formData.floor_number,
            capacity: formData.capacity,
            room_type: formData.room_type,
            has_ac: formData.has_ac,
            has_projector: formData.has_projector,
            has_whiteboard: formData.has_whiteboard,
            has_computers: formData.has_computers,
            has_lab_equipment: formData.has_lab_equipment,
            is_accessible: formData.is_accessible,
            notes: formData.notes || null
          })
          .eq('id', editingRoom.id)
        
        if (error) throw error
        setSuccessMessage('Room updated successfully!')
      } else {
        // Add new room
        const { error } = await (supabase
          .from('rooms') as any)
          .insert({
            room_code: formData.room_code,
            room_name: formData.room_name || null,
            building: formData.building,
            floor_number: formData.floor_number,
            capacity: formData.capacity,
            room_type: formData.room_type,
            has_ac: formData.has_ac,
            has_projector: formData.has_projector,
            has_whiteboard: formData.has_whiteboard,
            has_computers: formData.has_computers,
            has_lab_equipment: formData.has_lab_equipment,
            is_accessible: formData.is_accessible,
            notes: formData.notes || null
          })
        
        if (error) throw error
        setSuccessMessage('Room added successfully!')
      }
      
      resetForm()
      fetchRooms()
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      console.error('Error saving room:', error)
      setErrorMessage(error.message)
    }
  }

  const handleEdit = (room: Room) => {
    setEditingRoom(room)
    setFormData({
      room_code: room.room_code,
      room_name: room.room_name || '',
      building: room.building,
      floor_number: room.floor_number,
      capacity: room.capacity,
      room_type: room.room_type,
      has_ac: room.has_ac,
      has_projector: room.has_projector,
      has_whiteboard: room.has_whiteboard,
      has_computers: room.has_computers,
      has_lab_equipment: room.has_lab_equipment,
      is_accessible: room.is_accessible,
      notes: room.notes || ''
    })
    setShowAddModal(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this room?')) return
    
    try {
      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      setSuccessMessage('Room deleted successfully!')
      fetchRooms()
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
      room_code: '',
      room_name: '',
      building: '',
      floor_number: 1,
      capacity: 40,
      room_type: 'lecture',
      has_ac: false,
      has_projector: false,
      has_whiteboard: true,
      has_computers: 0,
      has_lab_equipment: false,
      is_accessible: false,
      notes: ''
    })
  }

  const getRoomTypeIcon = (type: RoomType) => {
    switch (type) {
      case 'laboratory': return <Beaker className="w-4 h-4" />
      case 'computer_lab': return <Computer className="w-4 h-4" />
      default: return <DoorOpen className="w-4 h-4" />
    }
  }

  const getRoomTypeClass = (type: RoomType) => {
    switch (type) {
      case 'laboratory': return styles.typeLaboratory
      case 'computer_lab': return styles.typeComputerLab
      case 'auditorium': return styles.typeAuditorium
      default: return styles.typeLecture
    }
  }

  return (
    <div className={styles.pageContainer}>
      <MenuBar 
        onToggleSidebar={toggleSidebar}
        showSidebarToggle={true}
        showAccountIcon={true}
      />
      <Sidebar isOpen={sidebarOpen} />
      
      <main className={`${styles.mainContent} ${sidebarOpen ? styles.withSidebar : ''}`}>
        <div className={styles.contentWrapper}>
          {/* Header */}
          <div className={styles.headerCard}>
            <div className={styles.headerContent}>
              <div className={styles.headerInfo}>
                <div className={styles.headerTitleRow}>
                  <div className={styles.headerIcon}>
                    <PenSquare className="w-6 h-6" />
                  </div>
                  <h1 className={styles.headerTitle}>Add / Edit Rooms</h1>
                </div>
                <p className={styles.headerSubtitle}>Manage classroom and laboratory information</p>
              </div>
              <button onClick={() => setShowAddModal(true)} className={styles.addButton}>
                <Plus className="w-5 h-5" />
                Add Room
              </button>
            </div>
          </div>

          {/* Messages */}
          {successMessage && (
            <div className={styles.successMessage}>
              <CheckCircle className="w-5 h-5" />
              <span>{successMessage}</span>
            </div>
          )}
          
          {errorMessage && (
            <div className={styles.errorMessage}>
              <AlertTriangle className="w-5 h-5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Rooms Table */}
          <div className={styles.tableCard}>
            {loading ? (
              <div className={styles.loadingState}>Loading rooms...</div>
            ) : rooms.length === 0 ? (
              <div className={styles.emptyState}>
                <DoorOpen className={styles.emptyIcon} />
                <h3 className={styles.emptyTitle}>No Rooms Added</h3>
                <p className={styles.emptyText}>Start by adding your first room</p>
                <button onClick={() => setShowAddModal(true)} className={styles.addButton}>
                  Add Room
                </button>
              </div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead className={styles.tableHeader}>
                    <tr>
                      <th className={styles.tableHeaderCell}>Room</th>
                      <th className={styles.tableHeaderCell}>Building</th>
                      <th className={styles.tableHeaderCell}>Type</th>
                      <th className={styles.tableHeaderCell}>Capacity</th>
                      <th className={styles.tableHeaderCell}>Features</th>
                      <th className={styles.tableHeaderCell}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className={styles.tableBody}>
                    {rooms.map(room => (
                      <tr key={room.id} className={styles.tableRow}>
                        <td className={styles.tableCell}>
                          <div className={styles.roomCode}>{room.room_code}</div>
                          {room.room_name && <div className={styles.roomName}>{room.room_name}</div>}
                        </td>
                        <td className={styles.tableCell}>
                          <div className={styles.buildingInfo}>
                            <Building2 className={`w-4 h-4 ${styles.buildingIcon}`} />
                            <span className={styles.buildingName}>{room.building}</span>
                          </div>
                          <div className={styles.floorNumber}>Floor {room.floor_number}</div>
                        </td>
                        <td className={styles.tableCell}>
                          <span className={`${styles.roomTypeBadge} ${getRoomTypeClass(room.room_type)}`}>
                            {getRoomTypeIcon(room.room_type)}
                            {room.room_type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className={styles.tableCell}>
                          <div className={styles.capacityInfo}>
                            <Users className={`w-4 h-4 ${styles.capacityIcon}`} />
                            <span className={styles.capacityValue}>{room.capacity}</span>
                          </div>
                        </td>
                        <td className={styles.tableCell}>
                          <div className={styles.featuresRow}>
                            {room.has_ac && <span className={`${styles.featureIcon} ${styles.featureAc}`} title="Air Conditioned"><Wind className="w-4 h-4" /></span>}
                            {room.has_projector && <span className={`${styles.featureIcon} ${styles.featureProjector}`} title="Projector"><Projector className="w-4 h-4" /></span>}
                            {room.has_computers > 0 && <span className={`${styles.featureIcon} ${styles.featureComputer}`} title={`${room.has_computers} Computers`}><Computer className="w-4 h-4" /></span>}
                            {room.is_accessible && <span className={`${styles.featureIcon} ${styles.featureAccessible}`} title="Accessible"><Accessibility className="w-4 h-4" /></span>}
                          </div>
                        </td>
                        <td className={styles.tableCell}>
                          <div className={styles.actionsRow}>
                            <button onClick={() => handleEdit(room)} className={`${styles.actionButton} ${styles.editButton}`}>
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(room.id)} className={`${styles.actionButton} ${styles.deleteButton}`}>
                              <Trash2 className="w-4 h-4" />
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
        </div>
      </main>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editingRoom ? 'Edit Room' : 'Add New Room'}
              </h2>
              <button onClick={resetForm} className={styles.modalCloseButton}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className={styles.modalBody}>
              <div className={`${styles.formGrid} ${styles.formGrid2}`}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Room Code *</label>
                  <input
                    type="text"
                    value={formData.room_code}
                    onChange={e => setFormData(prev => ({ ...prev, room_code: e.target.value }))}
                    required
                    className={styles.formInput}
                    placeholder="e.g., FH-201"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Room Name</label>
                  <input
                    type="text"
                    value={formData.room_name}
                    onChange={e => setFormData(prev => ({ ...prev, room_name: e.target.value }))}
                    className={styles.formInput}
                    placeholder="e.g., Computer Lab 1"
                  />
                </div>
              </div>

              <div className={`${styles.formGrid} ${styles.formGrid3}`}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Building *</label>
                  <input
                    type="text"
                    value={formData.building}
                    onChange={e => setFormData(prev => ({ ...prev, building: e.target.value }))}
                    required
                    className={styles.formInput}
                    placeholder="e.g., Fleming Hall"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Floor</label>
                  <input
                    type="number"
                    value={formData.floor_number}
                    onChange={e => setFormData(prev => ({ ...prev, floor_number: parseInt(e.target.value) || 1 }))}
                    min="1"
                    className={styles.formInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Capacity *</label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={e => setFormData(prev => ({ ...prev, capacity: parseInt(e.target.value) || 0 }))}
                    required
                    min="1"
                    className={styles.formInput}
                  />
                </div>
              </div>

              <div className={`${styles.formGrid} ${styles.formGrid2}`}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Room Type</label>
                  <select
                    value={formData.room_type}
                    onChange={e => setFormData(prev => ({ ...prev, room_type: e.target.value as RoomType }))}
                    className={styles.formSelect}
                  >
                    <option value="lecture">Lecture Room</option>
                    <option value="laboratory">Laboratory</option>
                    <option value="computer_lab">Computer Lab</option>
                    <option value="drawing_room">Drawing Room</option>
                    <option value="auditorium">Auditorium</option>
                    <option value="conference">Conference Room</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Number of Computers</label>
                  <input
                    type="number"
                    value={formData.has_computers}
                    onChange={e => setFormData(prev => ({ ...prev, has_computers: parseInt(e.target.value) || 0 }))}
                    min="0"
                    className={styles.formInput}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.featuresLabel}>Room Features</label>
                <div className={styles.featuresGrid}>
                  {[
                    { key: 'has_ac', label: 'Air Conditioned', icon: Wind },
                    { key: 'has_projector', label: 'Projector', icon: Projector },
                    { key: 'has_whiteboard', label: 'Whiteboard', icon: PenSquare },
                    { key: 'has_lab_equipment', label: 'Lab Equipment', icon: Beaker },
                    { key: 'is_accessible', label: 'Accessible', icon: Accessibility },
                  ].map(({ key, label, icon: Icon }) => (
                    <label key={key} className={styles.featureCheckbox}>
                      <input
                        type="checkbox"
                        checked={formData[key as keyof typeof formData] as boolean}
                        onChange={e => setFormData(prev => ({ ...prev, [key]: e.target.checked }))}
                        className={styles.featureCheckboxInput}
                      />
                      <Icon className="w-4 h-4" />
                      <span className={styles.featureCheckboxLabel}>{label}</span>
                    </label>
                  ))}
                </div>
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
                  <Save className="w-4 h-4" />
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
