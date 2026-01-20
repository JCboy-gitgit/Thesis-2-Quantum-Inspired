'use client'

import { Suspense, useEffect, useState } from 'react'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import styles from './ClassSchedules.module.css'
import { supabase } from '@/lib/supabaseClient'
import { 
  FaCalendar,
  FaSearch,
  FaGraduationCap,
  FaBuilding,
  FaPlus,
  FaEdit,
  FaTrash,
  FaTimes,
  FaSave
} from 'react-icons/fa'
import { BookOpen, ChevronDown, ChevronRight, FileSpreadsheet, AlertTriangle, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

// ==================== Interfaces ====================
interface ClassSchedule {
  id: number
  upload_group_id: number
  course_code: string
  course_name: string
  section: string
  lec_units: number
  lab_units: number
  credit_units: number
  schedule_day: string
  schedule_time: string
  start_time: string | null
  end_time: string | null
  semester: string
  academic_year: string
  department: string
  college: string
  status: string
  file_name: string
  created_at: string
}

interface UploadGroup {
  upload_group_id: number
  file_name: string
  college: string
  department: string
  semester: string
  academic_year: string
  total_classes: number
  created_at: string
}

interface Stats {
  totalClasses: number
  totalDepartments: number
  totalSections: number
  totalUnits: number
}

// Form data for creating/editing
interface ClassFormData {
  course_code: string
  course_name: string
  section: string
  credit_units: number
  schedule_day: string
  schedule_time: string
  semester: string
  academic_year: string
  department: string
  college: string
  status: string
}

const emptyFormData: ClassFormData = {
  course_code: '',
  course_name: '',
  section: '',
  credit_units: 0,
  schedule_day: 'Monday',
  schedule_time: '',
  semester: '1st Semester',
  academic_year: '2025-2026',
  department: '',
  college: '',
  status: 'active'
}

// ==================== Helper Functions ====================
async function fetchAllRows<T = Record<string, unknown>>(
  table: string, 
  filters: Record<string, string | number | boolean> = {}, 
  orderBy: string = 'id'
): Promise<T[]> {
  const PAGE_SIZE = 1000
  let allData: T[] = []
  let page = 0
  let hasMore = true

  while (hasMore) {
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from(table)
      .select('*')
      .range(from, to)
      .order(orderBy, { ascending: true })

    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value as string | number | boolean)
    }

    const { data, error } = await query

    if (error) throw error
    if (!data || data.length === 0) {
      hasMore = false
      break
    }

    allData = [...allData, ...(data as T[])]
    if (data.length < PAGE_SIZE) hasMore = false
    page++
  }

  return allData
}

// ==================== Main Component ====================
function ClassSchedulesContent() {
  const router = useRouter()
  // State
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [uploadGroups, setUploadGroups] = useState<UploadGroup[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [classSchedules, setClassSchedules] = useState<ClassSchedule[]>([])
  const [filteredSchedules, setFilteredSchedules] = useState<ClassSchedule[]>([])
  const [viewMode, setViewMode] = useState<'selection' | 'list'>('selection')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDay, setFilterDay] = useState<string>('all')
  const [filterDepartment, setFilterDepartment] = useState<string>('all')
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set())
  const [stats, setStats] = useState<Stats>({
    totalClasses: 0,
    totalDepartments: 0,
    totalSections: 0,
    totalUnits: 0
  })

  // CRUD Modal States
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [formData, setFormData] = useState<ClassFormData>(emptyFormData)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [deleteGroupConfirm, setDeleteGroupConfirm] = useState<number | null>(null)

  // Days of the week
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const timeSlots = [
    '7:00-8:30', '8:30-10:00', '10:00-11:30', '11:30-13:00',
    '13:00-14:30', '14:30-16:00', '16:00-17:30', '17:30-19:00', '19:00-20:30'
  ]
  const statuses = ['active', 'pending', 'cancelled', 'completed']
  const semesters = ['1st Semester', '2nd Semester', 'Summer']

  // Effects
  useEffect(() => {
    checkAuth()
    fetchUploadGroups()
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

  useEffect(() => {
    filterSchedules()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterDay, filterDepartment, classSchedules])

  // Fetch upload groups
  const fetchUploadGroups = async () => {
    setLoading(true)
    try {
      const schedules = await fetchAllRows<ClassSchedule>('class_schedules', {}, 'created_at')
      
      // Group by upload_group_id
      const groupMap = new Map<number, UploadGroup>()
      
      schedules.forEach(schedule => {
        if (!groupMap.has(schedule.upload_group_id)) {
          groupMap.set(schedule.upload_group_id, {
            upload_group_id: schedule.upload_group_id,
            file_name: schedule.file_name || '',
            college: schedule.college || '', // Shows exact name from UploadCSV batch name input
            department: schedule.department || '',
            semester: schedule.semester || '',
            academic_year: schedule.academic_year || '',
            total_classes: 0,
            created_at: schedule.created_at
          })
        }
        const group = groupMap.get(schedule.upload_group_id)!
        group.total_classes++
      })

      const groups = Array.from(groupMap.values()).sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      setUploadGroups(groups)
    } catch (error) {
      console.error('Error fetching upload groups:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch class schedules for a group
  const fetchClassSchedules = async (groupId: number) => {
    setLoading(true)
    try {
      const schedules = await fetchAllRows<ClassSchedule>('class_schedules', {
        upload_group_id: groupId
      }, 'course_code')

      setClassSchedules(schedules)
      setFilteredSchedules(schedules)
      calculateStats(schedules)
      setViewMode('list')
    } catch (error) {
      console.error('Error fetching class schedules:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate stats
  const calculateStats = (schedules: ClassSchedule[]) => {
    const departments = new Set(schedules.map(s => s.department).filter(Boolean))
    const sections = new Set(schedules.map(s => `${s.course_code}-${s.section}`))
    const totalUnits = schedules.reduce((sum, s) => sum + (s.credit_units || 0), 0)

    setStats({
      totalClasses: schedules.length,
      totalDepartments: departments.size,
      totalSections: sections.size,
      totalUnits
    })

    // Expand all departments by default
    setExpandedDepartments(departments)
  }

  // Filter schedules
  const filterSchedules = () => {
    let filtered = [...classSchedules]

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(s =>
        s.course_code?.toLowerCase().includes(term) ||
        s.course_name?.toLowerCase().includes(term) ||
        s.section?.toLowerCase().includes(term) ||
        s.department?.toLowerCase().includes(term)
      )
    }

    if (filterDay !== 'all') {
      filtered = filtered.filter(s => 
        s.schedule_day?.toLowerCase().includes(filterDay.toLowerCase())
      )
    }

    if (filterDepartment !== 'all') {
      filtered = filtered.filter(s => s.department === filterDepartment)
    }

    setFilteredSchedules(filtered)
  }

  // Toggle department expansion
  const toggleDepartment = (dept: string) => {
    setExpandedDepartments(prev => {
      const next = new Set(prev)
      if (next.has(dept)) {
        next.delete(dept)
      } else {
        next.add(dept)
      }
      return next
    })
  }

  // Get unique departments
  const getDepartments = () => {
    return [...new Set(classSchedules.map(s => s.department).filter(Boolean))]
  }

  // Format time from 24-hour to 12-hour AM/PM format
  const formatTimeToAMPM = (time24: string): string => {
    if (!time24) return time24
    
    // Handle time ranges like "10:00-11:30" or "13:00-14:30"
    if (time24.includes('-')) {
      const [start, end] = time24.split('-')
      return `${convertTo12Hour(start.trim())} - ${convertTo12Hour(end.trim())}`
    }
    
    return convertTo12Hour(time24)
  }

  const convertTo12Hour = (time: string): string => {
    const [hourStr, minuteStr] = time.split(':')
    let hour = parseInt(hourStr)
    const minute = minuteStr || '00'
    
    if (isNaN(hour)) return time
    
    const period = hour >= 12 ? 'PM' : 'AM'
    hour = hour % 12 || 12 // Convert 0 to 12 for midnight, keep 12 for noon
    
    return `${hour}:${minute} ${period}`
  }

  // Group schedules by department
  const getSchedulesByDepartment = () => {
    const grouped = new Map<string, ClassSchedule[]>()
    
    filteredSchedules.forEach(schedule => {
      const dept = schedule.department || 'Unassigned'
      if (!grouped.has(dept)) {
        grouped.set(dept, [])
      }
      grouped.get(dept)!.push(schedule)
    })

    return grouped
  }

  // Handle back to selection
  const handleBackToSelection = () => {
    setViewMode('selection')
    setSelectedGroupId(null)
    setClassSchedules([])
    setFilteredSchedules([])
    setSearchTerm('')
    setFilterDay('all')
    setFilterDepartment('all')
    fetchUploadGroups() // Refresh groups
  }

  // Handle group select
  const handleGroupSelect = (groupId: number) => {
    setSelectedGroupId(groupId)
    fetchClassSchedules(groupId)
  }

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return '#38a169'
      case 'pending': return '#dd6b20'
      case 'cancelled': return '#e53e3e'
      case 'completed': return '#3182ce'
      default: return '#718096'
    }
  }

  // ==================== CRUD Operations ====================

  // Open create modal
  const openCreateModal = () => {
    const selectedGroup = uploadGroups.find(g => g.upload_group_id === selectedGroupId)
    setFormData({
      ...emptyFormData,
      college: selectedGroup?.college || '',
      department: selectedGroup?.department || '',
      semester: selectedGroup?.semester || '1st Semester',
      academic_year: selectedGroup?.academic_year || '2025-2026'
    })
    setModalMode('create')
    setEditingId(null)
    setShowModal(true)
  }

  // Open edit modal
  const openEditModal = (schedule: ClassSchedule) => {
    setFormData({
      course_code: schedule.course_code || '',
      course_name: schedule.course_name || '',
      section: schedule.section || '',
      credit_units: schedule.credit_units || 0,
      schedule_day: schedule.schedule_day || 'Monday',
      schedule_time: schedule.schedule_time || '',
      semester: schedule.semester || '1st Semester',
      academic_year: schedule.academic_year || '2025-2026',
      department: schedule.department || '',
      college: schedule.college || '',
      status: schedule.status || 'active'
    })
    setModalMode('edit')
    setEditingId(schedule.id)
    setShowModal(true)
  }

  // Close modal
  const closeModal = () => {
    setShowModal(false)
    setFormData(emptyFormData)
    setEditingId(null)
  }

  // Handle form input change
  const handleInputChange = (field: keyof ClassFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Save (Create or Update)
  const handleSave = async () => {
    if (!formData.course_code || !formData.course_name) {
      alert('Please fill in Course Code and Course Name')
      return
    }

    setSaving(true)
    try {
      if (modalMode === 'create') {
        // Create new class schedule
        const newData = {
          upload_group_id: selectedGroupId,
          ...formData,
          file_name: 'Manual Entry'
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('class_schedules')
          .insert([newData])

        if (error) throw error

        // Refresh data
        if (selectedGroupId) {
          await fetchClassSchedules(selectedGroupId)
        }
      } else {
        // Update existing class schedule
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('class_schedules')
          .update(formData)
          .eq('id', editingId)

        if (error) throw error

        // Update local state
        setClassSchedules(prev => 
          prev.map(s => s.id === editingId ? { ...s, ...formData } : s)
        )
      }

      closeModal()
    } catch (error) {
      console.error('Error saving class schedule:', error)
      alert('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // Delete single class schedule
  const handleDelete = async (id: number) => {
    try {
      // Find the schedule to archive
      const scheduleToDelete = classSchedules.find(s => s.id === id)
      
      if (scheduleToDelete) {
        // Archive the schedule before deleting
        try {
          const { data: { user } } = await supabase.auth.getUser()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('archived_items')
            .insert({
              item_type: 'schedule',
              item_name: `${scheduleToDelete.course_code} - ${scheduleToDelete.section}`,
              item_data: scheduleToDelete,
              deleted_by: user?.id || null,
              original_table: 'class_schedules',
              original_id: String(id)
            })
        } catch (archiveError) {
          console.warn('Could not archive schedule (table may not exist):', archiveError)
          // Continue with deletion even if archiving fails
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('class_schedules')
        .delete()
        .eq('id', id)

      if (error) throw error

      // Update local state
      const updated = classSchedules.filter(s => s.id !== id)
      setClassSchedules(updated)
      calculateStats(updated)
      setDeleteConfirm(null)
    } catch (error) {
      console.error('Error deleting class schedule:', error)
      alert('Failed to delete. Please try again.')
    }
  }

  // Delete entire upload group
  const handleDeleteGroup = async (groupId: number) => {
    try {
      // Find the group info for archiving
      const groupToDelete = uploadGroups.find(g => g.upload_group_id === groupId)
      
      // Get all schedules for this group for archiving
      const schedulesToArchive = await fetchAllRows<ClassSchedule>('class_schedules', { upload_group_id: groupId })
      
      if (groupToDelete && schedulesToArchive.length > 0) {
        // Archive the group before deleting
        try {
          const { data: { user } } = await supabase.auth.getUser()
          await supabase
            .from('archived_items')
            .insert({
              item_type: 'csv_file',
              item_name: groupToDelete.file_name || `Upload Group ${groupId}`,
              item_data: {
                group_info: groupToDelete,
                schedules: schedulesToArchive
              },
              deleted_by: user?.id || null,
              original_table: 'class_schedules',
              original_id: String(groupId)
            })
        } catch (archiveError) {
          console.warn('Could not archive group (table may not exist):', archiveError)
          // Continue with deletion even if archiving fails
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('class_schedules')
        .delete()
        .eq('upload_group_id', groupId)

      if (error) throw error

      // Refresh upload groups
      await fetchUploadGroups()
      setDeleteGroupConfirm(null)
    } catch (error) {
      console.error('Error deleting upload group:', error)
      alert('Failed to delete group. Please try again.')
    }
  }

  // ==================== Render ====================

  // Loading state
  if (loading && viewMode === 'selection') {
    return (
      <div className={styles.pageLayout}>
        <MenuBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} showSidebarToggle={true} showAccountIcon={true} />
        <Sidebar isOpen={sidebarOpen} />
        <main className={`${styles.pageMain} ${!sidebarOpen ? styles.fullWidth : ''}`}>
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p>Loading class schedules...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={styles.pageLayout}>
      <MenuBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} showSidebarToggle={true} showAccountIcon={true} />
      <Sidebar isOpen={sidebarOpen} />
      
      <main className={`${styles.pageMain} ${!sidebarOpen ? styles.fullWidth : ''}`}>
        <div className={styles.pageContainer}>
          
          {/* ==================== Upload Group Selection View ==================== */}
          {viewMode === 'selection' && (
            <>
              <div className={styles.welcomeSection}>
                <h1 className={styles.welcomeTitle}>📚 Class Schedules Management</h1>
                <p className={styles.welcomeSubtitle}>
                  View, edit, and manage uploaded class schedules from CSV files
                </p>
              </div>

              <div className={styles.searchSection}>
                <div className={styles.searchBox}>
                  <FaSearch className={styles.searchIcon} />
                  <input
                    type="text"
                    placeholder="Search by college, department, or file name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={styles.searchInput}
                  />
                </div>
              </div>

              <div className={styles.schedulesGrid}>
                {uploadGroups
                  .filter(group => 
                    !searchTerm || 
                    group.college?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    group.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    group.file_name?.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((group) => (
                  <div 
                    key={group.upload_group_id} 
                    className={styles.scheduleCard}
                  >
                    <div className={styles.scheduleCardHeader}>
                      <h3 className={styles.scheduleEventName}>
                        <FileSpreadsheet size={20} />
                        {group.college || `Upload Group #${group.upload_group_id}`}
                      </h3>
                      <span className={styles.scheduleType}>
                        {group.total_classes} Classes
                      </span>
                    </div>
                    <div className={styles.scheduleCardBody} onClick={() => handleGroupSelect(group.upload_group_id)}>
                      {group.department && (
                        <div className={styles.scheduleInfo}>
                          <FaGraduationCap />
                          <span>{group.department}</span>
                        </div>
                      )}
                      {(group.semester || group.academic_year) && (
                        <div className={styles.scheduleInfo}>
                          <FaCalendar />
                          <span>{[group.semester, group.academic_year].filter(Boolean).join(' - ')}</span>
                        </div>
                      )}
                      <div className={styles.scheduleInfo}>
                        <FileSpreadsheet size={16} />
                        <span style={{ fontSize: '12px', opacity: 0.8 }}>File: {group.file_name || 'N/A'}</span>
                      </div>
                    </div>
                    <div className={styles.scheduleCardFooter}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className={styles.viewButton}
                          onClick={() => handleGroupSelect(group.upload_group_id)}
                          style={{ flex: 1 }}
                        >
                          <BookOpen size={16} />
                          View & Manage
                        </button>
                        <button 
                          onClick={() => setDeleteGroupConfirm(group.upload_group_id)}
                          style={{
                            padding: '12px 16px',
                            background: '#fed7d7',
                            color: '#c53030',
                            border: 'none',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: 600,
                            transition: 'all 0.2s ease'
                          }}
                          title="Delete entire group"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      
                      {/* Delete Group Confirmation */}
                      {deleteGroupConfirm === group.upload_group_id && (
                        <div style={{
                          marginTop: '12px',
                          padding: '12px',
                          background: '#fff5f5',
                          borderRadius: '8px',
                          border: '1px solid #fed7d7'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <AlertTriangle size={16} color="#c53030" />
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#c53030' }}>
                              Delete all {group.total_classes} classes?
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => handleDeleteGroup(group.upload_group_id)}
                              style={{
                                flex: 1,
                                padding: '8px',
                                background: '#c53030',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontSize: '12px'
                              }}
                            >
                              Yes, Delete All
                            </button>
                            <button
                              onClick={() => setDeleteGroupConfirm(null)}
                              style={{
                                flex: 1,
                                padding: '8px',
                                background: '#e2e8f0',
                                color: '#4a5568',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontSize: '12px'
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {uploadGroups.length === 0 && (
                <div className={styles.emptyState}>
                  <FileSpreadsheet size={64} />
                  <h3>No Class Schedules Found</h3>
                  <p>Upload class schedule CSV files from the Upload CSV page to see them here.</p>
                </div>
              )}
            </>
          )}

          {/* ==================== Class Schedules List View ==================== */}
          {viewMode === 'list' && (
            <>
              {/* Header */}
              <div className={styles.pageHeader}>
                <div className={styles.headerLeft}>
                  <button 
                    className={styles.backButton}
                    onClick={handleBackToSelection}
                  >
                    ← Back to Groups
                  </button>
                  <div className={styles.headerInfo}>
                    <h1 className={styles.pageTitle}>
                      <BookOpen size={28} />
                      {uploadGroups.find(g => g.upload_group_id === selectedGroupId)?.college || 'Class Schedules'}
                    </h1>
                    <p className={styles.pageSubtitle}>
                      {[
                        uploadGroups.find(g => g.upload_group_id === selectedGroupId)?.semester,
                        uploadGroups.find(g => g.upload_group_id === selectedGroupId)?.academic_year
                      ].filter(Boolean).join(' - ')}{stats.totalClasses > 0 ? ` • ${stats.totalClasses} Classes` : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={openCreateModal}
                  style={{
                    padding: '12px 24px',
                    background: 'linear-gradient(135deg, #38a169 0%, #48bb78 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(56, 161, 105, 0.3)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <FaPlus />
                  Add New Class
                </button>
              </div>

              {/* Stats Grid */}
              <div className={styles.statsGrid}>
                <div className={`${styles.statCard} ${styles.blue}`}>
                  <span className={styles.statIcon}>📚</span>
                  <div className={styles.statContent}>
                    <span className={styles.statLabel}>Total Classes</span>
                    <span className={styles.statValue}>{stats.totalClasses}</span>
                  </div>
                </div>
                <div className={`${styles.statCard} ${styles.green}`}>
                  <span className={styles.statIcon}>🏢</span>
                  <div className={styles.statContent}>
                    <span className={styles.statLabel}>Departments</span>
                    <span className={styles.statValue}>{stats.totalDepartments}</span>
                  </div>
                </div>
                <div className={`${styles.statCard} ${styles.purple}`}>
                  <span className={styles.statIcon}>📖</span>
                  <div className={styles.statContent}>
                    <span className={styles.statLabel}>Sections</span>
                    <span className={styles.statValue}>{stats.totalSections}</span>
                  </div>
                </div>
                <div className={`${styles.statCard} ${styles.orange}`}>
                  <span className={styles.statIcon}>⭐</span>
                  <div className={styles.statContent}>
                    <span className={styles.statLabel}>Total Units</span>
                    <span className={styles.statValue}>{stats.totalUnits}</span>
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div style={{ 
                display: 'flex', 
                gap: '16px', 
                marginBottom: '24px',
                flexWrap: 'wrap',
                alignItems: 'center'
              }}>
                <div className={styles.searchBox} style={{ flex: '1', minWidth: '250px' }}>
                  <FaSearch className={styles.searchIcon} />
                  <input
                    type="text"
                    placeholder="Search by course code, name, or section..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={styles.searchInput}
                  />
                </div>
                
                <select
                  value={filterDay}
                  onChange={(e) => setFilterDay(e.target.value)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: '2px solid var(--border-color, #e2e8f0)',
                    background: 'var(--bg-white, #fff)',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    minWidth: '150px'
                  }}
                >
                  <option value="all">All Days</option>
                  {daysOfWeek.map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>

                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: '2px solid var(--border-color, #e2e8f0)',
                    background: 'var(--bg-white, #fff)',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    minWidth: '180px'
                  }}
                >
                  <option value="all">All Departments</option>
                  {getDepartments().map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              {/* Loading */}
              {loading && (
                <div className={styles.loadingState}>
                  <div className={styles.spinner}></div>
                  <p>Loading class schedules...</p>
                </div>
              )}

              {/* Schedules by Department */}
              {!loading && (
                <div className={styles.campusView}>
                  {Array.from(getSchedulesByDepartment().entries()).map(([department, schedules]) => (
                    <div key={department} className={styles.campusSection}>
                      <div 
                        className={styles.campusHeaderRow}
                        onClick={() => toggleDepartment(department)}
                      >
                        <FaGraduationCap />
                        <span>{department}</span>
                        <span className={styles.roomCount}>{schedules.length} classes</span>
                        <button className={styles.toggleBtn}>
                          {expandedDepartments.has(department) ? (
                            <ChevronDown size={20} />
                          ) : (
                            <ChevronRight size={20} />
                          )}
                        </button>
                      </div>

                      {expandedDepartments.has(department) && (
                        <div style={{ marginTop: '16px' }}>
                          {/* Table Header */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: '100px 1fr 70px 70px 110px 80px 100px',
                            gap: '10px',
                            padding: '12px 16px',
                            background: 'var(--bg-gray-100, #edf2f7)',
                            borderRadius: '10px',
                            fontWeight: 700,
                            fontSize: '11px',
                            color: 'var(--text-medium, #718096)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: '8px'
                          }}>
                            <span>Code</span>
                            <span>Course Name</span>
                            <span>Section</span>
                            <span>Units</span>
                            <span>Schedule</span>
                            <span>Status</span>
                            <span style={{ textAlign: 'center' }}>Actions</span>
                          </div>

                          {/* Schedule Rows */}
                          {schedules.map((schedule) => (
                            <div 
                              key={schedule.id}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '100px 1fr 70px 70px 110px 80px 100px',
                                gap: '10px',
                                padding: '14px 16px',
                                background: 'var(--bg-white, #fff)',
                                borderRadius: '10px',
                                marginBottom: '8px',
                                border: '1px solid var(--border-color, #e2e8f0)',
                                alignItems: 'center',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <span style={{ 
                                fontWeight: 700, 
                                color: 'var(--primary-medium, #2c5282)',
                                fontSize: '13px'
                              }}>
                                {schedule.course_code}
                              </span>
                              <span style={{ 
                                fontWeight: 500,
                                color: 'var(--text-dark, #1a202c)',
                                fontSize: '13px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                {schedule.course_name || 'N/A'}
                              </span>
                              <span style={{
                                background: 'rgba(44, 82, 130, 0.1)',
                                color: 'var(--primary-medium, #2c5282)',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 600,
                                textAlign: 'center'
                              }}>
                                {schedule.section}
                              </span>
                              <span style={{ 
                                fontSize: '12px',
                                color: 'var(--text-medium, #718096)',
                                fontWeight: 600
                              }}>
                                {schedule.credit_units || 0}
                              </span>
                              <span style={{ 
                                fontSize: '11px',
                                color: 'var(--text-dark, #1a202c)',
                                fontWeight: 500
                              }}>
                                {schedule.schedule_day ? (
                                  <>
                                    {schedule.schedule_day.substring(0, 3)}
                                    {schedule.schedule_time && (
                                      <span style={{ 
                                        display: 'block', 
                                        fontSize: '10px',
                                        color: 'var(--text-medium, #718096)'
                                      }}>
                                        {schedule.schedule_time}
                                      </span>
                                    )}
                                  </>
                                ) : 'TBA'}
                              </span>
                              <span style={{
                                background: `${getStatusColor(schedule.status)}20`,
                                color: getStatusColor(schedule.status),
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '10px',
                                fontWeight: 600,
                                textTransform: 'capitalize'
                              }}>
                                {schedule.status || 'pending'}
                              </span>
                              
                              {/* Action Buttons */}
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                <button
                                  onClick={() => openEditModal(schedule)}
                                  style={{
                                    padding: '6px 10px',
                                    background: '#edf2f7',
                                    color: '#4a5568',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    transition: 'all 0.2s ease'
                                  }}
                                  title="Edit"
                                >
                                  <FaEdit size={12} />
                                </button>
                                
                                {deleteConfirm === schedule.id ? (
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    <button
                                      onClick={() => handleDelete(schedule.id)}
                                      style={{
                                        padding: '6px 8px',
                                        background: '#c53030',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '10px',
                                        fontWeight: 600
                                      }}
                                    >
                                      Yes
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirm(null)}
                                      style={{
                                        padding: '6px 8px',
                                        background: '#e2e8f0',
                                        color: '#4a5568',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '10px',
                                        fontWeight: 600
                                      }}
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setDeleteConfirm(schedule.id)}
                                    style={{
                                      padding: '6px 10px',
                                      background: '#fed7d7',
                                      color: '#c53030',
                                      border: 'none',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      transition: 'all 0.2s ease'
                                    }}
                                    title="Delete"
                                  >
                                    <FaTrash size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Empty State */}
              {!loading && filteredSchedules.length === 0 && (
                <div className={styles.emptyState}>
                  <BookOpen size={64} />
                  <h3>No Classes Found</h3>
                  <p>Try adjusting your search or filter criteria, or add a new class.</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* ==================== Create/Edit Modal ==================== */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--card-bg)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '700px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: 'var(--shadow-md)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--primary-gradient)',
              color: 'white',
              borderRadius: '16px 16px 0 0'
            }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                {modalMode === 'create' ? <FaPlus /> : <FaEdit />}
                {modalMode === 'create' ? 'Add New Class Schedule' : 'Edit Class Schedule'}
              </h2>
              <button
                onClick={closeModal}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  color: 'white',
                  padding: '8px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <FaTimes size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px' }}>
              {/* Course Info Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--label-color)' }}>
                    Course Code *
                  </label>
                  <input
                    type="text"
                    value={formData.course_code}
                    onChange={(e) => handleInputChange('course_code', e.target.value)}
                    placeholder="e.g., CS101"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '2px solid var(--input-border)',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: 'var(--input-text)',
                      background: 'var(--input-bg)',
                      transition: 'border-color 0.2s'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--label-color)' }}>
                    Course Name *
                  </label>
                  <input
                    type="text"
                    value={formData.course_name}
                    onChange={(e) => handleInputChange('course_name', e.target.value)}
                    placeholder="e.g., Introduction to Programming"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '2px solid var(--input-border)',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: 'var(--input-text)',
                      background: 'var(--input-bg)'
                    }}
                  />
                </div>
              </div>

              {/* Section & Units Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--label-color)' }}>
                    Section
                  </label>
                  <input
                    type="text"
                    value={formData.section}
                    onChange={(e) => handleInputChange('section', e.target.value)}
                    placeholder="e.g., A"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '2px solid var(--input-border)',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: 'var(--input-text)',
                      background: 'var(--input-bg)'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--label-color)' }}>
                    Units
                  </label>
                  <input
                    type="number"
                    value={formData.credit_units}
                    onChange={(e) => handleInputChange('credit_units', parseInt(e.target.value) || 0)}
                    min="0"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '2px solid var(--input-border)',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: 'var(--input-text)',
                      background: 'var(--input-bg)'
                    }}
                  />
                </div>
              </div>

              {/* Schedule Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--label-color)' }}>
                    <FaCalendar style={{ marginRight: '6px' }} />
                    Schedule Day
                  </label>
                  <select
                    value={formData.schedule_day}
                    onChange={(e) => handleInputChange('schedule_day', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '2px solid var(--input-border)',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: 'var(--input-text)',
                      background: 'var(--input-bg)',
                      cursor: 'pointer'
                    }}
                  >
                    {daysOfWeek.map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--label-color)' }}>
                    Schedule Time
                  </label>
                  <select
                    value={formData.schedule_time}
                    onChange={(e) => handleInputChange('schedule_time', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '2px solid var(--input-border)',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: 'var(--input-text)',
                      background: 'var(--input-bg)',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">Select Time</option>
                    {timeSlots.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Semester & Year Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--label-color)' }}>
                    Semester
                  </label>
                  <select
                    value={formData.semester}
                    onChange={(e) => handleInputChange('semester', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '2px solid var(--input-border)',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: 'var(--input-text)',
                      background: 'var(--input-bg)',
                      cursor: 'pointer'
                    }}
                  >
                    {semesters.map(sem => (
                      <option key={sem} value={sem}>{sem}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--label-color)' }}>
                    Academic Year
                  </label>
                  <input
                    type="text"
                    value={formData.academic_year}
                    onChange={(e) => handleInputChange('academic_year', e.target.value)}
                    placeholder="e.g., 2025-2026"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '2px solid var(--input-border)',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: 'var(--input-text)',
                      background: 'var(--input-bg)'
                    }}
                  />
                </div>
              </div>

              {/* Department & College Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--label-color)' }}>
                    <FaGraduationCap style={{ marginRight: '6px' }} />
                    Department
                  </label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => handleInputChange('department', e.target.value)}
                    placeholder="e.g., Computer Science"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '2px solid var(--input-border)',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: 'var(--input-text)',
                      background: 'var(--input-bg)'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--label-color)' }}>
                    <FaBuilding style={{ marginRight: '6px' }} />
                    College
                  </label>
                  <input
                    type="text"
                    value={formData.college}
                    onChange={(e) => handleInputChange('college', e.target.value)}
                    placeholder="e.g., College of Engineering"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '2px solid var(--input-border)',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: 'var(--input-text)',
                      background: 'var(--input-bg)'
                    }}
                  />
                </div>
              </div>

              {/* Status Row */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--label-color)' }}>
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '2px solid var(--input-border)',
                    borderRadius: '10px',
                    fontSize: '14px',
                    color: 'var(--input-text)',
                    background: 'var(--input-bg)',
                    cursor: 'pointer'
                  }}
                >
                  {statuses.map(status => (
                    <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={closeModal}
                  style={{
                    padding: '12px 24px',
                    background: 'var(--bg-gray-100)',
                    color: 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    padding: '12px 24px',
                    background: saving ? 'var(--bg-gray-100)' : 'var(--primary-gradient)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: saving ? 'none' : 'var(--shadow-sm)'
                  }}
                >
                  <FaSave />
                  {saving ? 'Saving...' : (modalMode === 'create' ? 'Create Class' : 'Save Changes')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Loading fallback component
function LoadingFallback() {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      flexDirection: 'column',
      gap: '16px'
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        border: '4px solid rgba(44, 82, 130, 0.1)',
        borderTopColor: '#2c5282',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }}></div>
      <p style={{ color: '#718096', fontWeight: 500 }}>Loading Class Schedules...</p>
    </div>
  )
}

// Main export wrapped in Suspense
export default function ClassSchedulesPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ClassSchedulesContent />
    </Suspense>
  )
}
