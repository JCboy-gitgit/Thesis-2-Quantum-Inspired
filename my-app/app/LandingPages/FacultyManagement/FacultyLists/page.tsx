'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import { supabase } from '@/lib/supabaseClient'
import styles from './FacultyLists.module.css'

// Faculty Profile interface (from faculty_profiles table)
interface FacultyProfile {
  id: string
  faculty_id: string
  full_name: string
  position: string
  role: 'administrator' | 'department_head' | 'program_chair' | 'coordinator' | 'faculty' | 'staff'
  department: string | null
  college: string | null
  email: string | null
  phone: string | null
  office_location: string | null
  employment_type: 'full-time' | 'part-time' | 'adjunct' | 'guest'
  is_active: boolean
  profile_image: string | null
  bio: string | null
  specialization: string | null
  education: string | null
  upload_group_id: number | null
  file_name: string | null
  created_at: string
  updated_at: string
}

// File group interface (replaces CollegeGroup - now tracks by uploaded file)
interface FileGroup {
  upload_group_id: number
  file_name: string
  college: string
  faculty_count: number
  departments: string[]
  created_at: string
}

// Form data interface (uses strings instead of null for input compatibility)
interface FacultyFormData {
  faculty_id: string
  full_name: string
  position: string
  role: 'administrator' | 'department_head' | 'program_chair' | 'coordinator' | 'faculty' | 'staff'
  department: string
  college: string
  email: string
  phone: string
  office_location: string
  employment_type: 'full-time' | 'part-time' | 'adjunct' | 'guest'
  is_active: boolean
}

interface FacultyStats {
  totalFaculty: number
  totalFiles: number
  administrators: number
  fullTime: number
  partTime: number
}

// Helper function to fetch ALL rows with pagination
async function fetchAllRows(table: string, filters: Record<string, string | number | boolean> = {}) {
  const PAGE_SIZE = 1000
  let allData: FacultyProfile[] = []
  let page = 0
  let hasMore = true

  while (hasMore) {
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from(table)
      .select('*')
      .range(from, to)
      .order('full_name', { ascending: true })

    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value)
    }

    const { data, error } = await query

    if (error) throw error
    if (!data || data.length === 0) {
      hasMore = false
      break
    }

    allData = [...allData, ...data]
    if (data.length < PAGE_SIZE) hasMore = false
    page++
  }

  return allData
}

// Get initials from name
function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.split(/[,\s]+/).filter(p => p.length > 0)
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

// Get role color
function getRoleColor(role: string): string {
  switch (role) {
    case 'administrator': return '#f59e0b'
    case 'department_head': return '#8b5cf6'
    case 'program_chair': return '#ec4899'
    case 'coordinator': return '#06b6d4'
    case 'staff': return '#64748b'
    default: return '#22c55e'
  }
}

// Get role label
function getRoleLabel(role: string): string {
  switch (role) {
    case 'administrator': return 'Administrator'
    case 'department_head': return 'Dept. Head'
    case 'program_chair': return 'Program Chair'
    case 'coordinator': return 'Coordinator'
    case 'staff': return 'Staff'
    default: return 'Faculty'
  }
}


// Get employment type badge
function getEmploymentBadge(type: string): { label: string; color: string } {
  switch (type) {
    case 'full-time': return { label: 'Full-Time', color: '#22c55e' }
    case 'part-time': return { label: 'Part-Time', color: '#f59e0b' }
    case 'adjunct': return { label: 'Adjunct', color: '#8b5cf6' }
    case 'guest': return { label: 'Guest', color: '#06b6d4' }
    default: return { label: type, color: '#64748b' }
  }
}

// SVG Icons
function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  )
}

function EmailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
    </svg>
  )
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
    </svg>
  )
}

function LocationIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
    </svg>
  )
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
    </svg>
  )
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
      <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
    </svg>
  )
}

function FacultyListsContent() {
  const router = useRouter()

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [allFaculty, setAllFaculty] = useState<FacultyProfile[]>([])
  const [filteredData, setFilteredData] = useState<FacultyProfile[]>([])
  const [fileGroups, setFileGroups] = useState<FileGroup[]>([])
  const [selectedFile, setSelectedFile] = useState<FileGroup | null>(null)
  const [stats, setStats] = useState<FacultyStats | null>(null)

  // Search and filters
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState<string>('all')
  const [filterEmployment, setFilterEmployment] = useState<string>('all')
  const [departments, setDepartments] = useState<string[]>([])
  const [filterDepartment, setFilterDepartment] = useState<string>('all')

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [showDeleteFileConfirm, setShowDeleteFileConfirm] = useState(false)
  const [selectedFaculty, setSelectedFaculty] = useState<FacultyProfile | null>(null)
  const [renameFileName, setRenameFileName] = useState('')
  const [formData, setFormData] = useState<FacultyFormData>({
    faculty_id: '',
    full_name: '',
    position: '',
    role: 'faculty',
    department: '',
    college: '',
    email: '',
    phone: '',
    office_location: '',
    employment_type: 'full-time',
    is_active: true
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 12

  useEffect(() => {
    checkAuth()
    fetchFacultyData()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [allFaculty, searchTerm, filterRole, filterEmployment, filterDepartment, selectedFile])

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

  const fetchFacultyData = async () => {
    setLoading(true)
    try {
      const data = await fetchAllRows('faculty_profiles')
      setAllFaculty(data)

      // Group by upload_group_id (each CSV file is a separate group)
      const fileMap = new Map<number, { faculty: FacultyProfile[], departments: Set<string>, file_name: string, college: string }>()
      
      data.forEach(f => {
        // Use upload_group_id if available, otherwise use 0 for legacy data
        const groupId = f.upload_group_id || 0
        const fileName = f.file_name || f.college || 'Legacy Import'
        
        if (!fileMap.has(groupId)) {
          fileMap.set(groupId, { 
            faculty: [], 
            departments: new Set(), 
            file_name: fileName,
            college: f.college || 'Unassigned'
          })
        }
        fileMap.get(groupId)!.faculty.push(f)
        if (f.department) {
          fileMap.get(groupId)!.departments.add(f.department)
        }
      })

      const groups: FileGroup[] = Array.from(fileMap.entries()).map(([groupId, info]) => ({
        upload_group_id: groupId,
        file_name: info.file_name,
        college: info.college,
        faculty_count: info.faculty.length,
        departments: Array.from(info.departments),
        created_at: info.faculty[0]?.created_at || ''
      })).sort((a, b) => b.upload_group_id - a.upload_group_id) // Most recent first

      setFileGroups(groups)

      // Extract unique departments
      const uniqueDepts = [...new Set(data.map(f => f.department).filter(Boolean))] as string[]
      setDepartments(uniqueDepts.sort())

      // Calculate stats
      setStats({
        totalFaculty: data.length,
        totalFiles: groups.length,
        administrators: data.filter(f => f.role === 'administrator' || f.role === 'department_head').length,
        fullTime: data.filter(f => f.employment_type === 'full-time').length,
        partTime: data.filter(f => f.employment_type !== 'full-time').length
      })
    } catch (error) {
      console.error('Error fetching faculty data:', error)
      setAllFaculty([])
      setFileGroups([])
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...allFaculty]

    // Filter by selected file (upload_group_id)
    if (selectedFile) {
      filtered = filtered.filter(f => (f.upload_group_id || 0) === selectedFile.upload_group_id)
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(f =>
        f.full_name?.toLowerCase().includes(term) ||
        f.faculty_id?.toLowerCase().includes(term) ||
        f.email?.toLowerCase().includes(term) ||
        f.position?.toLowerCase().includes(term) ||
        f.department?.toLowerCase().includes(term)
      )
    }

    // Role filter
    if (filterRole !== 'all') {
      filtered = filtered.filter(f => f.role === filterRole)
    }

    // Employment filter
    if (filterEmployment !== 'all') {
      filtered = filtered.filter(f => f.employment_type === filterEmployment)
    }

    // Department filter
    if (filterDepartment !== 'all') {
      filtered = filtered.filter(f => f.department === filterDepartment)
    }

    setFilteredData(filtered)
    setCurrentPage(1)
  }

  // Generate faculty ID
  const generateFacultyId = (name: string) => {
    const nameParts = name.split(/[,\s]+/).filter(p => p.length > 0)
    const initials = nameParts.map(p => p.charAt(0).toUpperCase()).join('')
    const random = Math.floor(Math.random() * 9000) + 1000
    return `FAC-${initials}-${random}`
  }

  // CREATE - Add new faculty
  const handleAddFaculty = async () => {
    if (!formData.full_name || !formData.position || !formData.department) {
      alert('Please fill in required fields: Name, Position, and Department')
      return
    }

    setSaving(true)
    try {
      const newFaculty = {
        faculty_id: formData.faculty_id || generateFacultyId(formData.full_name),
        full_name: formData.full_name,
        position: formData.position,
        role: formData.role || 'faculty',
        department: formData.department,
        college: formData.college || selectedCollege || '',
        email: formData.email || null,
        phone: formData.phone || null,
        office_location: formData.office_location || null,
        employment_type: formData.employment_type || 'full-time',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('faculty_profiles')
        .insert([newFaculty])

      if (error) throw error

      setSuccessMessage('Faculty member added successfully!')
      setShowAddModal(false)
      resetForm()
      fetchFacultyData()

      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error adding faculty:', error)
      alert(`Failed to add faculty: ${errorMessage}`)
    } finally {
      setSaving(false)
    }
  }

  // UPDATE - Edit faculty
  const handleEditFaculty = async () => {
    if (!selectedFaculty || !formData.full_name) {
      alert('Please fill in required fields')
      return
    }

    setSaving(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('faculty_profiles')
        .update({
          full_name: formData.full_name,
          position: formData.position,
          role: formData.role,
          department: formData.department,
          college: formData.college,
          email: formData.email,
          phone: formData.phone,
          office_location: formData.office_location,
          employment_type: formData.employment_type,
          is_active: formData.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedFaculty.id)

      if (error) throw error

      setSuccessMessage('Faculty member updated successfully!')
      setShowEditModal(false)
      resetForm()
      fetchFacultyData()

      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error updating faculty:', error)
      alert(`Failed to update faculty: ${errorMessage}`)
    } finally {
      setSaving(false)
    }
  }

  // DELETE - Archive and delete faculty
  const handleDeleteFaculty = async () => {
    if (!selectedFaculty) return

    setDeleting(true)
    try {
      // Archive before deleting
      try {
        const { data: { user } } = await supabase.auth.getUser()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('archived_items')
          .insert({
            item_type: 'faculty',
            item_name: selectedFaculty.full_name,
            item_data: selectedFaculty,
            deleted_by: user?.id || null,
            original_table: 'faculty_profiles',
            original_id: selectedFaculty.id
          })
      } catch (archiveError) {
        console.warn('Could not archive faculty:', archiveError)
      }

      // Delete from faculty_profiles
      const { error } = await supabase
        .from('faculty_profiles')
        .delete()
        .eq('id', selectedFaculty.id)

      if (error) throw error

      setSuccessMessage(`"${selectedFaculty.full_name}" has been archived and deleted`)
      setShowDeleteConfirm(false)
      setSelectedFaculty(null)
      fetchFacultyData()

      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error deleting faculty:', error)
      alert(`Failed to delete faculty: ${errorMessage}`)
    } finally {
      setDeleting(false)
    }
  }

  // RENAME FILE - Update file_name for all faculty in the group
  const handleRenameFile = async () => {
    if (!selectedFile || !renameFileName.trim()) {
      alert('Please enter a new file name')
      return
    }

    setSaving(true)
    try {
      // Update all faculty records with this upload_group_id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('faculty_profiles')
        .update({ 
          file_name: renameFileName.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('upload_group_id', selectedFile.upload_group_id)

      if (error) throw error

      setSuccessMessage(`File renamed to "${renameFileName.trim()}" successfully!`)
      setShowRenameModal(false)
      setRenameFileName('')
      fetchFacultyData()

      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error renaming file:', error)
      alert(`Failed to rename file: ${errorMessage}`)
    } finally {
      setSaving(false)
    }
  }

  // DELETE FILE - Delete all faculty from this file
  const handleDeleteFile = async () => {
    if (!selectedFile) return

    setDeleting(true)
    try {
      // Get all faculty in this file for archiving
      const facultyInFile = allFaculty.filter(f => (f.upload_group_id || 0) === selectedFile.upload_group_id)

      // Archive all faculty before deleting
      try {
        const { data: { user } } = await supabase.auth.getUser()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('archived_items')
          .insert({
            item_type: 'faculty_file',
            item_name: selectedFile.file_name,
            item_data: { 
              file_name: selectedFile.file_name,
              college: selectedFile.college,
              faculty_count: selectedFile.faculty_count,
              faculty: facultyInFile
            },
            deleted_by: user?.id || null,
            original_table: 'faculty_profiles',
            original_id: `file_${selectedFile.upload_group_id}`
          })
      } catch (archiveError) {
        console.warn('Could not archive file:', archiveError)
      }

      // Delete all faculty from this file
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('faculty_profiles')
        .delete()
        .eq('upload_group_id', selectedFile.upload_group_id)

      if (error) throw error

      setSuccessMessage(`File "${selectedFile.file_name}" with ${selectedFile.faculty_count} faculty members has been archived and deleted`)
      setShowDeleteFileConfirm(false)
      setSelectedFile(null)
      fetchFacultyData()

      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error deleting file:', error)
      alert(`Failed to delete file: ${errorMessage}`)
    } finally {
      setDeleting(false)
    }
  }

  // Open rename modal
  const openRenameModal = (file: FileGroup) => {
    setSelectedFile(file)
    setRenameFileName(file.file_name)
    setShowRenameModal(true)
  }

  // Open delete file confirmation
  const openDeleteFileConfirm = (file: FileGroup) => {
    setSelectedFile(file)
    setShowDeleteFileConfirm(true)
  }

  const resetForm = () => {
    setFormData({
      faculty_id: '',
      full_name: '',
      position: '',
      role: 'faculty',
      department: '',
      college: selectedFile?.college || '',
      email: '',
      phone: '',
      office_location: '',
      employment_type: 'full-time',
      is_active: true
    })
    setSelectedFaculty(null)
  }

  const openEditModal = (faculty: FacultyProfile) => {
    setSelectedFaculty(faculty)
    setFormData({
      faculty_id: faculty.faculty_id,
      full_name: faculty.full_name,
      position: faculty.position,
      role: faculty.role,
      department: faculty.department || '',
      college: faculty.college || '',
      email: faculty.email || '',
      phone: faculty.phone || '',
      office_location: faculty.office_location || '',
      employment_type: faculty.employment_type,
      is_active: faculty.is_active
    })
    setShowEditModal(true)
  }

  const openDeleteConfirm = (faculty: FacultyProfile) => {
    setSelectedFaculty(faculty)
    setShowDeleteConfirm(true)
  }

  // Pagination
  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE)
  const paginatedData = filteredData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  if (loading) {
    return (
      <div className={styles.facultyLayout} data-page="admin">
        <MenuBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} showSidebarToggle={true} showAccountIcon={true} />
        <Sidebar isOpen={sidebarOpen} />
        <main className={`${styles.facultyMain} ${!sidebarOpen ? styles.fullWidth : ''}`}>
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p>Loading faculty data...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={styles.facultyLayout} data-page="admin">
      <MenuBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} showSidebarToggle={true} showAccountIcon={true} />
      <Sidebar isOpen={sidebarOpen} />
      <main className={`${styles.facultyMain} ${!sidebarOpen ? styles.fullWidth : ''}`}>
        <div className={styles.facultyContainer}>
          {/* File Selection Bar */}
          <div className={styles.selectedFileBar}>
            {selectedFile ? (
              <>
                <span>📄 File: <b>{selectedFile.file_name}</b> ({filteredData.length} faculty members) | College: {selectedFile.college}</span>
                <div className={styles.fileActions}>
                  <button className={styles.renameFileBtn} onClick={() => openRenameModal(selectedFile)}>
                    ✏️ Rename
                  </button>
                  <button className={styles.deleteFileBtn} onClick={() => openDeleteFileConfirm(selectedFile)}>
                    🗑️ Delete File
                  </button>
                  <button className={styles.changeFileBtn} onClick={() => setSelectedFile(null)}>
                    View All Files
                  </button>
                </div>
              </>
            ) : (
              <span>👥 Viewing: <b>All Faculty Profiles</b> ({allFaculty.length} total from {fileGroups.length} CSV files)</span>
            )}
          </div>

          {/* Header */}
          <div className={styles.facultyHeader}>
            <button className={styles.backButton} onClick={() => router.back()}>
              <span className={styles.iconBack}>←</span>
              Back
            </button>

            <div className={styles.headerTitleSection}>
              <div className={styles.headerIconWrapper}>
                <svg className={styles.headerLargeIcon} viewBox="0 0 24 24" fill="none">
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" fill="currentColor" />
                </svg>
              </div>
              <div className={styles.headerText}>
                <h1 className={styles.facultyTitle}>Faculty Lists</h1>
                <p className={styles.facultySubtitle}>
                  Manage faculty members from uploaded CSV files
                </p>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          {stats && (
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <UserIcon />
                </div>
                <div className={styles.statContent}>
                  <p className={styles.statLabel}>Total Faculty</p>
                  <p className={styles.statValue}>{stats.totalFaculty}</p>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <FolderIcon />
                </div>
                <div className={styles.statContent}>
                  <p className={styles.statLabel}>CSV Files</p>
                  <p className={styles.statValue}>{stats.totalFiles}</p>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                </div>
                <div className={styles.statContent}>
                  <p className={styles.statLabel}>Full-Time</p>
                  <p className={styles.statValue}>{stats.fullTime}</p>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                </div>
                <div className={styles.statContent}>
                  <p className={styles.statLabel}>Administrators</p>
                  <p className={styles.statValue}>{stats.administrators}</p>
                </div>
              </div>
            </div>
          )}

          {/* CSV File Groups (if no file selected) */}
          {!selectedFile && fileGroups.length > 0 && (
            <div className={styles.collegeGroupsSection}>
              <h3 className={styles.sectionTitle}>📁 Uploaded CSV Files</h3>
              <div className={styles.collegeGrid}>
                {fileGroups.map(group => (
                  <div
                    key={group.upload_group_id}
                    className={styles.collegeCard}
                  >
                    <div 
                      className={styles.collegeCardContent}
                      onClick={() => setSelectedFile(group)}
                      style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, cursor: 'pointer' }}
                    >
                      <div className={styles.collegeIcon}>
                        <FolderIcon />
                      </div>
                      <div className={styles.collegeInfo}>
                        <h4>{group.file_name}</h4>
                        <p>{group.faculty_count} faculty members • {group.college}</p>
                        <p className={styles.collegeDepts}>
                          {group.departments.slice(0, 3).join(', ')}
                          {group.departments.length > 3 && ` +${group.departments.length - 3} more`}
                        </p>
                      </div>
                    </div>
                    <div className={styles.fileCardActions}>
                      <button 
                        className={styles.fileEditBtn}
                        onClick={(e) => { e.stopPropagation(); openRenameModal(group); }}
                        title="Rename file"
                      >
                        <EditIcon />
                      </button>
                      <button 
                        className={styles.fileDeleteBtn}
                        onClick={(e) => { e.stopPropagation(); openDeleteFileConfirm(group); }}
                        title="Delete file"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                    <span className={styles.collegeArrow} onClick={() => setSelectedFile(group)}>→</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search & Filter Section */}
          <div className={styles.searchSection}>
            <div className={styles.searchHeader}>
              <div className={styles.searchBox}>
                <SearchIcon className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Search by name, email, department, or position..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className={styles.searchInput}
                />
              </div>

              <div className={styles.filterButtons}>
                <select
                  className={styles.filterBtn}
                  value={filterRole}
                  onChange={e => setFilterRole(e.target.value)}
                >
                  <option value="all">All Roles</option>
                  <option value="administrator">Administrator</option>
                  <option value="department_head">Dept. Head</option>
                  <option value="program_chair">Program Chair</option>
                  <option value="coordinator">Coordinator</option>
                  <option value="faculty">Faculty</option>
                  <option value="staff">Staff</option>
                </select>

                <select
                  className={styles.filterBtn}
                  value={filterEmployment}
                  onChange={e => setFilterEmployment(e.target.value)}
                >
                  <option value="all">All Types</option>
                  <option value="full-time">Full-Time</option>
                  <option value="part-time">Part-Time</option>
                  <option value="adjunct">Adjunct</option>
                  <option value="guest">Guest</option>
                </select>

                <select
                  className={styles.filterBtn}
                  value={filterDepartment}
                  onChange={e => setFilterDepartment(e.target.value)}
                >
                  <option value="all">All Departments</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <button className={styles.addFacultyBtn} onClick={() => {
                resetForm()
                setShowAddModal(true)
              }}>
                <PlusIcon />
                Add Faculty
              </button>
            </div>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className={styles.successMessage}>{successMessage}</div>
          )}

          {/* Faculty Grid */}
          {paginatedData.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <UserIcon />
              </div>
              <h3>No Faculty Found</h3>
              <p>
                {allFaculty.length === 0
                  ? 'Upload faculty profiles from the Upload CSV page to get started.'
                  : 'Try adjusting your search or filter criteria'}
              </p>
              {allFaculty.length === 0 && (
                <button
                  className={styles.addFacultyBtn}
                  onClick={() => router.push('/LandingPages/UploadCSV')}
                  style={{ marginTop: '16px' }}
                >
                  Go to Upload CSV
                </button>
              )}
            </div>
          ) : (
            <>
              <div className={styles.facultyGrid}>
                {paginatedData.map(faculty => (
                  <div key={faculty.id} className={styles.profileCard}>
                    {/* Cover */}
                    <div className={styles.profileCover}>
                      <div className={styles.profileCoverPattern}></div>
                      <span
                        className={styles.statusBadge}
                        style={{ backgroundColor: getRoleColor(faculty.role) }}
                      >
                        {getRoleLabel(faculty.role)}
                      </span>
                    </div>

                    {/* Avatar */}
                    <div className={styles.profileAvatarSection}>
                      <div className={styles.profileAvatar} style={{ borderColor: getRoleColor(faculty.role) }}>
                        {faculty.profile_image ? (
                          <img src={faculty.profile_image} alt={faculty.full_name} />
                        ) : (
                          <div className={styles.avatarInitials}>
                            {getInitials(faculty.full_name)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Body */}
                    <div className={styles.profileBody}>
                      <h3 className={styles.profileName}>{faculty.full_name}</h3>
                      <p className={styles.profileTitle}>{faculty.position}</p>
                      <span
                        className={styles.employmentBadge}
                        style={{ backgroundColor: getEmploymentBadge(faculty.employment_type).color }}
                      >
                        {getEmploymentBadge(faculty.employment_type).label}
                      </span>
                      <br />
                      <span className={styles.profileDepartment}>
                        <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                          <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10z" />
                        </svg>
                        {faculty.department || 'No Department'}
                      </span>

                      {/* Stats */}
                      <div className={styles.profileStats}>
                        <div className={styles.profileStat}>
                          <span className={styles.profileStatValue}>{faculty.faculty_id}</span>
                          <span className={styles.profileStatLabel}>Faculty ID</span>
                        </div>
                      </div>

                      {/* Contact Info */}
                      <div className={styles.profileContact}>
                        {faculty.email && (
                          <div className={styles.contactItem}>
                            <EmailIcon />
                            <span>{faculty.email}</span>
                          </div>
                        )}
                        {faculty.phone && (
                          <div className={styles.contactItem}>
                            <PhoneIcon />
                            <span>{faculty.phone}</span>
                          </div>
                        )}
                        {faculty.office_location && (
                          <div className={styles.contactItem}>
                            <LocationIcon />
                            <span>{faculty.office_location}</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className={styles.profileActions}>
                        <button
                          className={styles.btnViewProfile}
                          onClick={() => openEditModal(faculty)}
                        >
                          <EditIcon />
                          Edit
                        </button>
                        <button
                          className={styles.btnDelete}
                          onClick={() => openDeleteConfirm(faculty)}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className={styles.paginationWrapper}>
                  <button
                    className={styles.paginationBtn}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    ← Prev
                  </button>

                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }
                    return (
                      <button
                        key={pageNum}
                        className={`${styles.paginationBtn} ${currentPage === pageNum ? styles.activePage : ''}`}
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    )
                  })}

                  <button
                    className={styles.paginationBtn}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Add Faculty Modal */}
      {showAddModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Add New Faculty Member</h3>
              <button className={styles.modalClose} onClick={() => setShowAddModal(false)}>
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Full Name *</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={formData.full_name}
                    onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Position *</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={formData.position}
                    onChange={e => setFormData({ ...formData, position: e.target.value })}
                    placeholder="Professor"
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Role</label>
                  <select
                    className={styles.formSelect}
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value as FacultyProfile['role'] })}
                  >
                    <option value="faculty">Faculty</option>
                    <option value="administrator">Administrator</option>
                    <option value="department_head">Department Head</option>
                    <option value="program_chair">Program Chair</option>
                    <option value="coordinator">Coordinator</option>
                    <option value="staff">Staff</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Employment Type</label>
                  <select
                    className={styles.formSelect}
                    value={formData.employment_type}
                    onChange={e => setFormData({ ...formData, employment_type: e.target.value as FacultyProfile['employment_type'] })}
                  >
                    <option value="full-time">Full-Time</option>
                    <option value="part-time">Part-Time</option>
                    <option value="adjunct">Adjunct</option>
                    <option value="guest">Guest</option>
                  </select>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Department *</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={formData.department}
                    onChange={e => setFormData({ ...formData, department: e.target.value })}
                    placeholder="Computer Science"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>College</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={formData.college}
                    onChange={e => setFormData({ ...formData, college: e.target.value })}
                    placeholder="College of Science"
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Email</label>
                <input
                  type="email"
                  className={styles.formInput}
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john.doe@university.edu"
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Phone</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+63 912 345 6789"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Office Location</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={formData.office_location}
                    onChange={e => setFormData({ ...formData, office_location: e.target.value })}
                    placeholder="Building A, Room 101"
                  />
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.btnCancel} onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
              <button className={styles.btnSave} onClick={handleAddFaculty} disabled={saving}>
                {saving ? 'Saving...' : 'Add Faculty'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Faculty Modal */}
      {showEditModal && selectedFaculty && (
        <div className={styles.modalOverlay} onClick={() => setShowEditModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Edit Faculty Member</h3>
              <button className={styles.modalClose} onClick={() => setShowEditModal(false)}>
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Faculty ID</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={formData.faculty_id}
                    disabled
                    style={{ backgroundColor: 'var(--bg-gray-50)' }}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Active Status</label>
                  <select
                    className={styles.formSelect}
                    value={formData.is_active ? 'true' : 'false'}
                    onChange={e => setFormData({ ...formData, is_active: e.target.value === 'true' })}
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Full Name *</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={formData.full_name}
                    onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Position *</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={formData.position}
                    onChange={e => setFormData({ ...formData, position: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Role</label>
                  <select
                    className={styles.formSelect}
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value as FacultyProfile['role'] })}
                  >
                    <option value="faculty">Faculty</option>
                    <option value="administrator">Administrator</option>
                    <option value="department_head">Department Head</option>
                    <option value="program_chair">Program Chair</option>
                    <option value="coordinator">Coordinator</option>
                    <option value="staff">Staff</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Employment Type</label>
                  <select
                    className={styles.formSelect}
                    value={formData.employment_type}
                    onChange={e => setFormData({ ...formData, employment_type: e.target.value as FacultyProfile['employment_type'] })}
                  >
                    <option value="full-time">Full-Time</option>
                    <option value="part-time">Part-Time</option>
                    <option value="adjunct">Adjunct</option>
                    <option value="guest">Guest</option>
                  </select>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Department</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={formData.department}
                    onChange={e => setFormData({ ...formData, department: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>College</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={formData.college}
                    onChange={e => setFormData({ ...formData, college: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Email</label>
                <input
                  type="email"
                  className={styles.formInput}
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Phone</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Office Location</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={formData.office_location}
                    onChange={e => setFormData({ ...formData, office_location: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.btnCancel} onClick={() => setShowEditModal(false)}>
                Cancel
              </button>
              <button className={styles.btnSave} onClick={handleEditFaculty} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedFaculty && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteConfirm(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className={styles.modalHeader}>
              <h3>⚠️ Confirm Delete</h3>
              <button className={styles.modalClose} onClick={() => setShowDeleteConfirm(false)}>
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              <p style={{ marginBottom: '16px' }}>
                Are you sure you want to delete <strong>&quot;{selectedFaculty.full_name}&quot;</strong>?
              </p>
              <p style={{ color: 'var(--text-light)', fontSize: '14px' }}>
                This faculty member will be moved to the archive and can be restored later if needed.
              </p>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.btnCancel} onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button
                className={styles.btnDelete}
                onClick={handleDeleteFaculty}
                disabled={deleting}
                style={{
                  backgroundColor: '#ef4444',
                  color: 'white',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {deleting ? 'Deleting...' : 'Delete & Archive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename File Modal */}
      {showRenameModal && selectedFile && (
        <div className={styles.modalOverlay} onClick={() => setShowRenameModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className={styles.modalHeader}>
              <h3>✏️ Rename CSV File</h3>
              <button className={styles.modalClose} onClick={() => setShowRenameModal(false)}>
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              <p style={{ marginBottom: '16px', color: 'var(--text-light)', fontSize: '14px' }}>
                Current file: <strong>{selectedFile.file_name}</strong> ({selectedFile.faculty_count} faculty members)
              </p>
              <div className={styles.formGroup}>
                <label>New File Name</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={renameFileName}
                  onChange={e => setRenameFileName(e.target.value)}
                  placeholder="Enter new file name..."
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.btnCancel} onClick={() => setShowRenameModal(false)}>
                Cancel
              </button>
              <button className={styles.btnSave} onClick={handleRenameFile} disabled={saving}>
                {saving ? 'Renaming...' : 'Rename File'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete File Confirmation Modal */}
      {showDeleteFileConfirm && selectedFile && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteFileConfirm(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className={styles.modalHeader}>
              <h3>⚠️ Delete Entire CSV File</h3>
              <button className={styles.modalClose} onClick={() => setShowDeleteFileConfirm(false)}>
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              <p style={{ marginBottom: '16px' }}>
                Are you sure you want to delete the file <strong>&quot;{selectedFile.file_name}&quot;</strong>?
              </p>
              <p style={{ color: '#ef4444', fontSize: '14px', marginBottom: '12px' }}>
                ⚠️ This will delete <strong>{selectedFile.faculty_count} faculty members</strong> from the database!
              </p>
              <p style={{ color: 'var(--text-light)', fontSize: '14px' }}>
                All faculty members from this file will be archived and can be restored later if needed.
              </p>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.btnCancel} onClick={() => setShowDeleteFileConfirm(false)}>
                Cancel
              </button>
              <button
                className={styles.btnDelete}
                onClick={handleDeleteFile}
                disabled={deleting}
                style={{
                  backgroundColor: '#ef4444',
                  color: 'white',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {deleting ? 'Deleting...' : `Delete ${selectedFile.faculty_count} Faculty Members`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Loading fallback
function LoadingFallback() {
  return <div>Loading faculty directory...</div>
}

// Main export wrapped in Suspense
export default function FacultyListsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <FacultyListsContent />
    </Suspense>
  )
}
