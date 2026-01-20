'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { 
  Archive, 
  X, 
  RotateCcw, 
  Trash2, 
  FileSpreadsheet, 
  Building2, 
  User, 
  Search,
  AlertTriangle,
  Check,
  Clock,
  Filter
} from 'lucide-react'
import './ArchiveModal.css'

interface ArchivedItem {
  id: string
  item_type: 'csv_file' | 'department' | 'faculty' | 'schedule' | 'room'
  item_name: string
  item_data: any
  deleted_at: string
  deleted_by: string | null
  original_table: string
  original_id: string | number
}

interface ArchiveModalProps {
  isOpen: boolean
  onClose: () => void
  onRestore?: (item: ArchivedItem) => void
  onPermanentDelete?: (item: ArchivedItem) => void
}

export default function ArchiveModal({ isOpen, onClose, onRestore, onPermanentDelete }: ArchiveModalProps) {
  const [archivedItems, setArchivedItems] = useState<ArchivedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [confirmDelete, setConfirmDelete] = useState<ArchivedItem | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    if (isOpen) {
      fetchArchivedItems()
    }
  }, [isOpen])

  const fetchArchivedItems = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('archived_items')
        .select('*')
        .order('deleted_at', { ascending: false })

      if (error) {
        // Handle case where table doesn't exist yet
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          console.warn('Archive table not yet created. Run the archive_schema.sql in Supabase.')
          setArchivedItems([])
          return
        }
        throw error
      }
      setArchivedItems(data || [])
    } catch (error: any) {
      console.error('Error fetching archived items:', error?.message || error)
      // Don't show error message for missing table - just show empty state
      setArchivedItems([])
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async (item: ArchivedItem) => {
    setActionLoading(true)
    try {
      console.log('Restoring item:', item.item_type, item.item_name, item.item_data)
      
      // Handle different item types for restoration
      if (item.item_type === 'csv_file') {
        // For CSV files (campuses/class_schedules), restore all records
        const data = item.item_data
        if (data.rooms && Array.isArray(data.rooms)) {
          // Restore campus rooms - remove id to let DB generate new ones if conflict
          for (const room of data.rooms) {
            const { id, ...roomWithoutId } = room
            const { error } = await supabase.from('campuses').insert(roomWithoutId)
            if (error && !error.message?.includes('duplicate')) {
              console.error('Error restoring room:', error)
              throw error
            }
          }
        } else if (data.schedules && Array.isArray(data.schedules)) {
          // Restore class schedules
          for (const schedule of data.schedules) {
            const { id, ...scheduleWithoutId } = schedule
            const { error } = await supabase.from('class_schedules').insert(scheduleWithoutId)
            if (error && !error.message?.includes('duplicate')) {
              console.error('Error restoring class schedule:', error)
              throw error
            }
          }
        }
      } else if (item.item_type === 'faculty') {
        // Restore teacher schedules
        const data = item.item_data
        if (data.teachers && Array.isArray(data.teachers)) {
          for (const teacher of data.teachers) {
            const { id, ...teacherWithoutId } = teacher
            const { error } = await supabase.from('teacher_schedules').insert(teacherWithoutId)
            if (error && !error.message?.includes('duplicate')) {
              console.error('Error restoring teacher:', error)
              throw error
            }
          }
        }
      } else if (item.item_type === 'schedule') {
        // Restore generated schedule and its allocations
        const data = item.item_data
        if (data.schedule) {
          // Filter out fields that don't exist in generated_schedules table
          const { 
            school_name, college, // These are UI-only fields, not in DB
            ...cleanSchedule 
          } = data.schedule
          
          // Try to restore the schedule with original ID first
          const { error: scheduleError } = await supabase
            .from('generated_schedules')
            .upsert(cleanSchedule, { onConflict: 'id' })
          
          if (scheduleError) {
            console.error('Error restoring schedule:', scheduleError)
            throw scheduleError
          }
          
          if (data.allocations && Array.isArray(data.allocations)) {
            // Restore allocations - skip errors for allocations as they may already exist
            for (const allocation of data.allocations) {
              // Only keep fields that exist in room_allocations table
              const cleanAllocation = {
                id: allocation.id,
                schedule_id: allocation.schedule_id,
                class_id: allocation.class_id,
                room_id: allocation.room_id,
                course_code: allocation.course_code,
                course_name: allocation.course_name,
                section: allocation.section,
                year_level: allocation.year_level,
                schedule_day: allocation.schedule_day,
                schedule_time: allocation.schedule_time,
                campus: allocation.campus,
                building: allocation.building,
                room: allocation.room,
                capacity: allocation.capacity,
                teacher_name: allocation.teacher_name,
                department: allocation.department,
                lec_hours: allocation.lec_hours,
                lab_hours: allocation.lab_hours,
                status: allocation.status
              }
              
              const { error: allocError } = await (supabase as any)
                .from('room_allocations')
                .upsert(cleanAllocation, { onConflict: 'id' })
              if (allocError) {
                console.warn('Allocation restore warning (may already exist):', allocError?.message || allocError)
                // Don't throw - continue with other allocations
              }
            }
          }
        } else {
          // Single schedule object (class_schedules from CoursesManagement)
          const { id, ...dataWithoutId } = data
          const { error } = await supabase.from(item.original_table).insert(dataWithoutId)
          if (error) {
            console.error('Error restoring single schedule:', error)
            throw error
          }
        }
      } else if (item.item_type === 'room') {
        // Single room restore - remove id to avoid conflicts
        const { id, ...dataWithoutId } = item.item_data
        const { error } = await supabase.from(item.original_table).insert(dataWithoutId)
        if (error) {
          console.error('Error restoring room:', error)
          throw error
        }
      } else {
        // Default: direct insert for other types (department, etc.)
        const { id, ...dataWithoutId } = item.item_data
        const { error } = await supabase.from(item.original_table).insert(dataWithoutId)
        if (error) {
          console.error('Error restoring item:', error)
          throw error
        }
      }

      // Remove from archive AFTER successful restore
      const { error: deleteError } = await supabase
        .from('archived_items')
        .delete()
        .eq('id', item.id)

      if (deleteError) {
        console.error('Error removing from archive:', deleteError)
        // Don't throw here - the restore was successful, just log the archive deletion error
      }

      setArchivedItems(prev => prev.filter(i => i.id !== item.id))
      setMessage({ type: 'success', text: `${item.item_name} has been restored successfully` })
      onRestore?.(item)

      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      console.error('Error restoring item:', error?.message || error?.code || JSON.stringify(error) || error)
      setMessage({ type: 'error', text: `Failed to restore item: ${error?.message || 'Unknown error'}` })
    } finally {
      setActionLoading(false)
    }
  }

  const handlePermanentDelete = async (item: ArchivedItem) => {
    setActionLoading(true)
    try {
      const { error } = await supabase
        .from('archived_items')
        .delete()
        .eq('id', item.id)

      if (error) throw error

      setArchivedItems(prev => prev.filter(i => i.id !== item.id))
      setConfirmDelete(null)
      setMessage({ type: 'success', text: `${item.item_name} has been permanently deleted` })
      onPermanentDelete?.(item)

      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Error permanently deleting item:', error)
      setMessage({ type: 'error', text: 'Failed to delete item permanently' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleBulkRestore = async () => {
    setActionLoading(true)
    let restoredCount = 0
    try {
      for (const id of selectedItems) {
        const item = archivedItems.find(i => i.id === id)
        if (item) {
          // Use same restore logic as single restore
          if (item.item_type === 'csv_file') {
            const data = item.item_data
            if (data.rooms && Array.isArray(data.rooms)) {
              for (const room of data.rooms) {
                const { id: roomId, ...roomWithoutId } = room
                await supabase.from('campuses').insert(roomWithoutId)
              }
            } else if (data.schedules && Array.isArray(data.schedules)) {
              for (const schedule of data.schedules) {
                const { id: scheduleId, ...scheduleWithoutId } = schedule
                await supabase.from('class_schedules').insert(scheduleWithoutId)
              }
            }
          } else if (item.item_type === 'faculty') {
            const data = item.item_data
            if (data.teachers && Array.isArray(data.teachers)) {
              for (const teacher of data.teachers) {
                const { id: teacherId, ...teacherWithoutId } = teacher
                await supabase.from('teacher_schedules').insert(teacherWithoutId)
              }
            }
          } else if (item.item_type === 'schedule') {
            const data = item.item_data
            if (data.schedule) {
              // Filter out UI-only fields not in the DB
              const { school_name, college, ...cleanSchedule } = data.schedule
              await supabase.from('generated_schedules').upsert(cleanSchedule, { onConflict: 'id' })
              if (data.allocations && Array.isArray(data.allocations)) {
                for (const allocation of data.allocations) {
                  // Only keep fields that exist in room_allocations table
                  const cleanAllocation = {
                    id: allocation.id,
                    schedule_id: allocation.schedule_id,
                    class_id: allocation.class_id,
                    room_id: allocation.room_id,
                    course_code: allocation.course_code,
                    course_name: allocation.course_name,
                    section: allocation.section,
                    year_level: allocation.year_level,
                    schedule_day: allocation.schedule_day,
                    schedule_time: allocation.schedule_time,
                    campus: allocation.campus,
                    building: allocation.building,
                    room: allocation.room,
                    capacity: allocation.capacity,
                    teacher_name: allocation.teacher_name,
                    department: allocation.department,
                    lec_hours: allocation.lec_hours,
                    lab_hours: allocation.lab_hours,
                    status: allocation.status
                  }
                  await (supabase as any).from('room_allocations').upsert(cleanAllocation, { onConflict: 'id' })
                }
              }
            } else {
              const { id: dataId, ...dataWithoutId } = data
              await supabase.from(item.original_table).insert(dataWithoutId)
            }
          } else {
            const { id: dataId, ...dataWithoutId } = item.item_data
            await supabase.from(item.original_table).insert(dataWithoutId)
          }
          await supabase.from('archived_items').delete().eq('id', id)
          restoredCount++
        }
      }
      
      setArchivedItems(prev => prev.filter(i => !selectedItems.includes(i.id)))
      setSelectedItems([])
      setMessage({ type: 'success', text: `${restoredCount} items restored successfully` })
      
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      console.error('Error bulk restoring:', error?.message || error)
      setMessage({ type: 'error', text: `Failed to restore items: ${error?.message || 'Unknown error'}` })
    } finally {
      setActionLoading(false)
    }
  }

  const handleBulkDelete = async () => {
    setActionLoading(true)
    try {
      const { error } = await supabase
        .from('archived_items')
        .delete()
        .in('id', selectedItems)

      if (error) throw error
      
      setArchivedItems(prev => prev.filter(i => !selectedItems.includes(i.id)))
      setSelectedItems([])
      setMessage({ type: 'success', text: `${selectedItems.length} items permanently deleted` })
      
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Error bulk deleting:', error)
      setMessage({ type: 'error', text: 'Failed to delete items' })
    } finally {
      setActionLoading(false)
    }
  }

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedItems.length === filteredItems.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(filteredItems.map(i => i.id))
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'csv_file': return <FileSpreadsheet size={20} />
      case 'department': return <Building2 size={20} />
      case 'faculty': return <User size={20} />
      default: return <Archive size={20} />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'csv_file': return 'CSV File'
      case 'department': return 'Department'
      case 'faculty': return 'Faculty'
      case 'schedule': return 'Schedule'
      case 'room': return 'Room'
      default: return type
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const filteredItems = archivedItems.filter(item => {
    const matchesSearch = item.item_name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = filterType === 'all' || item.item_type === filterType
    return matchesSearch && matchesType
  })

  if (!isOpen) return null

  return (
    <div className="archive-modal-overlay" onClick={onClose}>
      <div className="archive-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="archive-modal-header">
          <div className="archive-modal-title">
            <Archive size={28} />
            <div>
              <h2>Archive</h2>
              <p>Manage deleted items - restore or permanently remove</p>
            </div>
          </div>
          <button className="archive-close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className={`archive-message ${message.type}`}>
            {message.type === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}
            {message.text}
          </div>
        )}

        {/* Controls */}
        <div className="archive-controls">
          <div className="archive-search">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search archived items..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="archive-filter">
            <Filter size={18} />
            <select value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="all">All Types</option>
              <option value="csv_file">CSV Files</option>
              <option value="department">Departments</option>
              <option value="faculty">Faculty</option>
              <option value="schedule">Schedules</option>
              <option value="room">Rooms</option>
            </select>
          </div>

          {selectedItems.length > 0 && (
            <div className="archive-bulk-actions">
              <button 
                className="archive-bulk-btn restore"
                onClick={handleBulkRestore}
                disabled={actionLoading}
              >
                <RotateCcw size={16} />
                Restore ({selectedItems.length})
              </button>
              <button 
                className="archive-bulk-btn delete"
                onClick={handleBulkDelete}
                disabled={actionLoading}
              >
                <Trash2 size={16} />
                Delete ({selectedItems.length})
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="archive-content">
          {loading ? (
            <div className="archive-loading">
              <div className="archive-spinner"></div>
              <p>Loading archived items...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="archive-empty">
              <Archive size={64} />
              <h3>No Archived Items</h3>
              <p>{searchTerm || filterType !== 'all' 
                ? 'No items match your search criteria' 
                : 'Deleted items will appear here for recovery'}
              </p>
            </div>
          ) : (
            <>
              <div className="archive-list-header">
                <label className="archive-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
                    onChange={toggleSelectAll}
                  />
                  <span className="checkmark"></span>
                </label>
                <span className="archive-col-name">Item Name</span>
                <span className="archive-col-type">Type</span>
                <span className="archive-col-date">Deleted At</span>
                <span className="archive-col-actions">Actions</span>
              </div>
              
              <div className="archive-list">
                {filteredItems.map(item => (
                  <div key={item.id} className={`archive-item ${selectedItems.includes(item.id) ? 'selected' : ''}`}>
                    <label className="archive-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item.id)}
                        onChange={() => toggleSelectItem(item.id)}
                      />
                      <span className="checkmark"></span>
                    </label>
                    
                    <div className="archive-item-name">
                      <span className="archive-item-icon">{getTypeIcon(item.item_type)}</span>
                      <span>{item.item_name}</span>
                    </div>
                    
                    <div className="archive-item-type">
                      <span className={`type-badge ${item.item_type}`}>
                        {getTypeLabel(item.item_type)}
                      </span>
                    </div>
                    
                    <div className="archive-item-date">
                      <Clock size={14} />
                      {formatDate(item.deleted_at)}
                    </div>
                    
                    <div className="archive-item-actions">
                      <button
                        className="archive-action-btn restore"
                        onClick={() => handleRestore(item)}
                        disabled={actionLoading}
                        title="Restore"
                      >
                        <RotateCcw size={16} />
                      </button>
                      <button
                        className="archive-action-btn delete"
                        onClick={() => setConfirmDelete(item)}
                        disabled={actionLoading}
                        title="Permanent Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Stats Footer */}
        <div className="archive-footer">
          <span>Total: {filteredItems.length} items</span>
          <span>Selected: {selectedItems.length}</span>
        </div>

        {/* Confirm Delete Modal */}
        {confirmDelete && (
          <div className="archive-confirm-overlay">
            <div className="archive-confirm-modal">
              <div className="archive-confirm-icon">
                <AlertTriangle size={48} />
              </div>
              <h3>Permanent Delete</h3>
              <p>
                Are you sure you want to permanently delete <strong>{confirmDelete.item_name}</strong>?
                <br />
                <span className="warning-text">This action cannot be undone.</span>
              </p>
              <div className="archive-confirm-actions">
                <button 
                  className="archive-confirm-btn cancel"
                  onClick={() => setConfirmDelete(null)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button 
                  className="archive-confirm-btn delete"
                  onClick={() => handlePermanentDelete(confirmDelete)}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
