'use client'

import React, { useState, useEffect, Suspense, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { fetchNoCache } from '@/lib/fetchUtils'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import { useColleges } from '@/app/context/CollegesContext'
import { useTheme } from '@/app/context/ThemeContext'
import styles from './styles.module.css'

// ==================== INTERFACES ====================
interface College {
  id: number
  department_code: string
  department_name: string
  college: string
  head_name: string | null
  head_email: string | null
  contact_phone: string | null
  office_location: string | null
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

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
  employment_type: 'full-time' | 'part-time' | 'adjunct' | 'guest' | 'vsl'
  preferred_times?: 'morning' | 'night' | 'any' | null
  unavailable_days?: string[] | null
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

interface FileGroup {
  upload_group_id: number
  file_name: string
  college: string
  faculty_count: number
  departments: string[]
  created_at: string
  isLegacy?: boolean // true when upload_group_id is null in DB
}

interface CollegeFormData {
  department_code: string
  department_name: string
  college: string
  head_name: string
  head_email: string
  contact_phone: string
  office_location: string
  description: string
  is_active: boolean
}

// ==================== HELPER FUNCTIONS ====================
const ROLE_ORDER: Record<string, number> = {
  'administrator': 1,
  'department_head': 2,
  'program_chair': 3,
  'coordinator': 4,
  'faculty': 5,
  'staff': 6
}

function getPositionPriority(position: string | null | undefined): number {
  if (!position) return 99
  const pos = position.toLowerCase().trim()
  if (pos === 'dean' || pos.match(/^dean$/i)) return 1
  if (pos.includes('dean') && !pos.includes('associate') && !pos.includes('assistant')) return 2
  if (pos.includes('associate dean')) return 3
  if (pos.includes('assistant dean')) return 4
  return 10
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.split(/[,\s]+/).filter(p => p.length > 0)
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

function getRoleInfo(role: string) {
  switch (role) {
    case 'administrator':
      return { icon: '★', label: 'Administrator / Dean', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)' }
    case 'department_head':
      return { icon: '◆', label: 'Department Head', color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.15)' }
    case 'program_chair':
      return { icon: '●', label: 'Program Chair', color: '#ec4899', bgColor: 'rgba(236, 72, 153, 0.15)' }
    case 'coordinator':
      return { icon: '◎', label: 'Coordinator', color: '#06b6d4', bgColor: 'rgba(6, 182, 212, 0.15)' }
    case 'staff':
      return { icon: '■', label: 'Staff', color: '#64748b', bgColor: 'rgba(100, 116, 139, 0.15)' }
    default:
      return { icon: '○', label: 'Faculty Member', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)' }
  }
}

function getEmploymentBadge(type: string) {
  switch (type) {
    case 'full-time': return { label: 'Full-Time', color: '#22c55e' }
    case 'part-time': return { label: 'Part-Time', color: '#f59e0b' }
    case 'adjunct': return { label: 'Adjunct', color: '#8b5cf6' }
    case 'guest': return { label: 'Guest', color: '#06b6d4' }
    default: return { label: type, color: '#64748b' }
  }
}

// SVG Icons
function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
      <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
    </svg>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
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

function BackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
    </svg>
  )
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
    </svg>
  )
}

function MoveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
      <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 12h-2v-2.59l-2.79 2.79-1.41-1.41L10.59 14H8v-2h6v6zm4-8l-2 2h1.5v3h2v-3H21l-2-2z" />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
  )
}

// ==================== MAIN COMPONENT ====================
function FacultyCollegesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { theme } = useTheme()

  // Theme-aware colors
  const activeColor = theme === 'green' ? '#059669' : '#2563eb' // emerald-600 vs blue-600
  const activeBorder = theme === 'green' ? '#059669' : '#2563eb'

  // Use untyped Supabase client for flexibility across tables
  const db = supabase as any

  // Get colleges from context
  const { activeColleges: bulsuColleges } = useColleges()

  // View state: 'colleges' | 'files' | 'faculty'
  const [currentView, setCurrentView] = useState<'colleges' | 'files' | 'faculty'>('colleges')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  // Colleges data
  const [colleges, setColleges] = useState<College[]>([])
  const [selectedCollege, setSelectedCollege] = useState<College | null>(null)

  // Faculty files data
  const [fileGroups, setFileGroups] = useState<FileGroup[]>([])
  const [selectedFile, setSelectedFile] = useState<FileGroup | null>(null)

  // Faculty profiles data
  const [facultyProfiles, setFacultyProfiles] = useState<FacultyProfile[]>([])
  const [hierarchyFaculty, setHierarchyFaculty] = useState<FacultyProfile[]>([])
  const [regularFaculty, setRegularFaculty] = useState<FacultyProfile[]>([])

  // Search and filters
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState<string>('all')
  const [filterEmployment, setFilterEmployment] = useState<string>('all')

  // Modal states
  const [showAddCollegeModal, setShowAddCollegeModal] = useState(false)
  const [showEditCollegeModal, setShowEditCollegeModal] = useState(false)
  const [showDeleteCollegeConfirm, setShowDeleteCollegeConfirm] = useState(false)
  const [showRenameFileModal, setShowRenameFileModal] = useState(false)
  const [showDeleteFileConfirm, setShowDeleteFileConfirm] = useState(false)
  const [showEditFacultyModal, setShowEditFacultyModal] = useState(false)
  const [deleteFacultyTarget, setDeleteFacultyTarget] = useState<string | null>(null)
  const [renameFileName, setRenameFileName] = useState('')

  // Move file modal states
  const [showMoveFileModal, setShowMoveFileModal] = useState(false)
  const [movingFileGroup, setMovingFileGroup] = useState<FileGroup | null>(null)
  const [selectedMoveCollege, setSelectedMoveCollege] = useState('')
  const [moveSearchTerm, setMoveSearchTerm] = useState('')
  const [movingFile, setMovingFile] = useState(false)

  // Add Faculty and Export modal states
  const [showAddFacultyModal, setShowAddFacultyModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportOptions, setExportOptions] = useState({
    format: 'csv' as 'csv' | 'pdf' | 'png',
    includeId: true,
    includeType: true,
    onlyNames: false,
    sortByDepartment: true
  })
  const [exporting, setExporting] = useState(false)

  // Approved faculty emails for autocomplete
  interface ApprovedFacultyUser {
    id: string
    email: string
    full_name: string
    is_active: boolean
  }
  const [approvedFacultyUsers, setApprovedFacultyUsers] = useState<ApprovedFacultyUser[]>([])
  const [showEmailSuggestions, setShowEmailSuggestions] = useState(false)
  const [filteredEmailSuggestions, setFilteredEmailSuggestions] = useState<ApprovedFacultyUser[]>([])

  const [collegeFormData, setCollegeFormData] = useState<CollegeFormData>({
    department_code: '',
    department_name: '',
    college: '',
    head_name: '',
    head_email: '',
    contact_phone: '',
    office_location: '',
    description: '',
    is_active: true
  })

  const [facultyFormData, setFacultyFormData] = useState({
    faculty_id: '',
    full_name: '',
    email: '',
    position: '',
    role: 'faculty' as FacultyProfile['role'],
    employment_type: 'full-time' as FacultyProfile['employment_type'],
    preferred_times: 'any' as 'morning' | 'night' | 'any',
    unavailable_days: [] as string[],
    department: '',
    college: '',
    phone: '',
    office_location: '',
    profile_image: '' as string | null
  })
  const [selectedFacultyProfile, setSelectedFacultyProfile] = useState<FacultyProfile | null>(null)

  // Image upload states for admin editing
  const [uploadingFacultyImage, setUploadingFacultyImage] = useState(false)
  const facultyImageInputRef = useRef<HTMLInputElement>(null)

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  // Stats
  const [stats, setStats] = useState({
    totalColleges: 0,
    totalFaculty: 0,
    totalFiles: 0
  })

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 12

  useEffect(() => {
    checkAuth()
    fetchColleges()
    fetchAllFaculty()
    fetchApprovedFacultyUsers()
  }, [])

  // Parse URL params for deep linking
  useEffect(() => {
    const collegeId = searchParams.get('college')
    const fileId = searchParams.get('file')

    if (collegeId && colleges.length > 0) {
      const college = colleges.find(c => c.id === parseInt(collegeId))
      if (college) {
        handleSelectCollege(college)
      }
    }
  }, [searchParams, colleges])

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

  // ==================== FETCH FUNCTIONS ====================
  const fetchColleges = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('department_name', { ascending: true })

      if (error) throw error
      setColleges(data || [])
      setStats(prev => ({ ...prev, totalColleges: data?.length || 0 }))
    } catch (error) {
      console.error('Error fetching colleges:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAllFaculty = async () => {
    try {
      const { data, error } = await supabase
        .from('faculty_profiles')
        .select('*')
        .order('full_name', { ascending: true })

      if (error) throw error
      const facultyData = (data || []) as FacultyProfile[]
      setStats(prev => ({ ...prev, totalFaculty: facultyData.length }))

      // Count file groups (include legacy rows where upload_group_id is null)
      const uniqueGroups = new Set(
        facultyData.map(f => (f.upload_group_id ?? `legacy-${f.file_name || 'Manual'}`))
      )
      setStats(prev => ({ ...prev, totalFiles: uniqueGroups.size }))
    } catch (error) {
      console.error('Error fetching faculty:', error)
    }
  }

  // Fetch approved faculty users for email autocomplete
  const fetchApprovedFacultyUsers = async () => {
    try {
      const response = await fetchNoCache('/api/faculty-default-schedule?action=approved-faculty')
      const data = await response.json()

      if (data.success && data.approvedFaculty) {
        setApprovedFacultyUsers(data.approvedFaculty)
      }
    } catch (error) {
      console.error('Error fetching approved faculty users:', error)
    }
  }

  // Handle email input change with suggestions
  const handleEmailInputChange = (email: string) => {
    setFacultyFormData({ ...facultyFormData, email })

    if (email.length >= 2) {
      const filtered = approvedFacultyUsers.filter(u =>
        u.email.toLowerCase().includes(email.toLowerCase()) ||
        u.full_name.toLowerCase().includes(email.toLowerCase())
      )
      setFilteredEmailSuggestions(filtered)
      setShowEmailSuggestions(filtered.length > 0)
    } else {
      setShowEmailSuggestions(false)
    }
  }

  // Select email from suggestions
  const selectEmailSuggestion = (user: ApprovedFacultyUser) => {
    setFacultyFormData({
      ...facultyFormData,
      email: user.email,
      full_name: facultyFormData.full_name || user.full_name
    })
    setShowEmailSuggestions(false)
  }

  const fetchFilesForCollege = async (collegeName: string) => {
    setLoading(true)
    try {
      // Fetch faculty profiles that match this college name
      const { data, error } = await supabase
        .from('faculty_profiles')
        .select('*')
        .or(
          `college.ilike.%${collegeName}%,department.ilike.%${collegeName}%`
        )
        .order('full_name', { ascending: true })

      if (error) throw error

      // Group by upload_group_id (each CSV file)
      const facultyData = (data || []) as FacultyProfile[]
      const fileMap = new Map<number, { faculty: FacultyProfile[], departments: Set<string>, file_name: string, isLegacy: boolean }>()

      facultyData.forEach((f: FacultyProfile) => {
        const isLegacy = f.upload_group_id === null || f.upload_group_id === undefined
        const groupId = isLegacy ? 0 : f.upload_group_id!
        const fileName = f.file_name || 'Legacy Import'

        if (!fileMap.has(groupId)) {
          fileMap.set(groupId, { faculty: [], departments: new Set(), file_name: fileName, isLegacy })
        }
        fileMap.get(groupId)!.faculty.push(f)
        if (f.department) {
          fileMap.get(groupId)!.departments.add(f.department)
        }
      })

      const groups = ([...fileMap.entries()].map(([groupId, info]) => ({
        upload_group_id: groupId,
        file_name: info.file_name,
        college: collegeName,
        faculty_count: info.faculty.length,
        departments: Array.from(info.departments),
        created_at: info.faculty[0]?.created_at || '',
        isLegacy: info.isLegacy
      })) as FileGroup[]).sort((a, b) => b.upload_group_id - a.upload_group_id)

      setFileGroups(groups)
    } catch (error) {
      console.error('Error fetching files for college:', error)
      setFileGroups([])
    } finally {
      setLoading(false)
    }
  }

  const fetchFacultyForFile = async (uploadGroupId: number, isLegacy?: boolean) => {
    setLoading(true)
    try {
      const query = supabase
        .from('faculty_profiles')
        .select('*')

      const { data, error } = isLegacy
        ? await query.is('upload_group_id', null).order('full_name', { ascending: true })
        : await query.eq('upload_group_id', uploadGroupId).order('full_name', { ascending: true })

      if (error) throw error

      // Also fetch users table to get avatar_url as fallback for profile_image
      const { data: usersData } = await supabase
        .from('users')
        .select('email, avatar_url')

      // Create email -> avatar_url map
      const userAvatarMap = new Map<string, string>()
      usersData?.forEach(u => {
        if (u.email && u.avatar_url) {
          userAvatarMap.set(u.email.toLowerCase(), u.avatar_url)
        }
      })

      // Merge avatar_url as fallback for profile_image
      const enrichedData = (data || []).map(f => ({
        ...f,
        profile_image: f.profile_image || (f.email ? userAvatarMap.get(f.email.toLowerCase()) : null) || null
      }))

      setFacultyProfiles(enrichedData)

      // Separate hierarchy (with position/role) from regular faculty
      const hierarchy = enrichedData
        .filter((f: FacultyProfile) =>
          f.role !== 'faculty' ||
          (f.position && f.position.toLowerCase() !== 'faculty' && f.position.toLowerCase() !== '')
        )
        .sort((a: FacultyProfile, b: FacultyProfile) => {
          const roleOrderA = ROLE_ORDER[a.role] || 99
          const roleOrderB = ROLE_ORDER[b.role] || 99
          if (roleOrderA !== roleOrderB) return roleOrderA - roleOrderB
          return getPositionPriority(a.position) - getPositionPriority(b.position)
        })

      const regular = enrichedData
        .filter((f: FacultyProfile) =>
          f.role === 'faculty' &&
          (!f.position || f.position.toLowerCase() === 'faculty' || f.position.toLowerCase() === '')
        )

      setHierarchyFaculty(hierarchy)
      setRegularFaculty(regular)
    } catch (error) {
      console.error('Error fetching faculty for file:', error)
      setFacultyProfiles([])
    } finally {
      setLoading(false)
    }
  }

  // ==================== NAVIGATION HANDLERS ====================
  const handleSelectCollege = (college: College) => {
    setSelectedCollege(college)
    setCurrentView('files')
    fetchFilesForCollege(college.college || college.department_name)
  }

  const handleSelectFile = (file: FileGroup) => {
    setSelectedFile(file)
    setCurrentView('faculty')
    fetchFacultyForFile(file.upload_group_id, file.isLegacy)
  }

  const handleBack = () => {
    if (currentView === 'faculty') {
      setCurrentView('files')
      setSelectedFile(null)
      setFacultyProfiles([])
    } else if (currentView === 'files') {
      setCurrentView('colleges')
      setSelectedCollege(null)
      setFileGroups([])
    }
  }

  // ==================== COLLEGE CRUD ====================
  const handleAddCollege = async () => {
    if (!collegeFormData.department_name || !collegeFormData.department_code) {
      alert('Please fill in required fields: College Name and Code')
      return
    }

    setSaving(true)
    try {
      console.log('Adding college:', collegeFormData)
      const { data, error } = await db
        .from('departments')
        .insert([{
          department_code: collegeFormData.department_code,
          department_name: collegeFormData.department_name,
          college: collegeFormData.college || collegeFormData.department_name,
          head_name: collegeFormData.head_name || null,
          head_email: collegeFormData.head_email || null,
          contact_phone: collegeFormData.contact_phone || null,
          office_location: collegeFormData.office_location || null,
          description: collegeFormData.description || null,
          is_active: true
        }])
        .select()

      console.log('Insert result:', { data, error })
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('Insert failed - database did not confirm the change. Check RLS policies in Supabase.')
      }

      setSuccessMessage('College added successfully!')
      setShowAddCollegeModal(false)
      resetCollegeForm()
      fetchColleges()
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      console.error('Error adding college:', error)
      alert(`Failed to add college: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleEditCollege = async () => {
    if (!selectedCollege || !collegeFormData.department_name) {
      alert('Please fill in required fields')
      return
    }

    setSaving(true)
    try {
      console.log('Updating college ID:', selectedCollege.id)
      const { data, error } = await db
        .from('departments')
        .update({
          department_code: collegeFormData.department_code,
          department_name: collegeFormData.department_name,
          college: collegeFormData.college,
          head_name: collegeFormData.head_name || null,
          head_email: collegeFormData.head_email || null,
          contact_phone: collegeFormData.contact_phone || null,
          office_location: collegeFormData.office_location || null,
          description: collegeFormData.description || null,
          is_active: collegeFormData.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedCollege.id)
        .select()

      console.log('Update result:', { data, error })
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('Update failed - database did not confirm the change. Check RLS policies in Supabase.')
      }

      setSuccessMessage('College updated successfully!')
      setShowEditCollegeModal(false)
      fetchColleges()
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      console.error('Error updating college:', error)
      alert(`Failed to update college: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCollege = async () => {
    if (!selectedCollege) return

    setDeleting(true)
    try {
      // Archive before deleting
      try {
        const { data: { user } } = await supabase.auth.getUser()
        await db
          .from('archived_items')
          .insert({
            item_type: 'department',
            item_name: selectedCollege.department_name,
            item_data: selectedCollege,
            deleted_by: user?.id || null,
            original_table: 'departments',
            original_id: String(selectedCollege.id)
          })
      } catch (archiveError) {
        console.warn('Could not archive college:', archiveError)
      }

      console.log('Deleting college ID:', selectedCollege.id)
      const { data, error } = await db
        .from('departments')
        .delete()
        .eq('id', selectedCollege.id)
        .select()

      console.log('Delete result:', { data, error })
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('Delete failed - database did not confirm the change. Check RLS policies in Supabase.')
      }

      setSuccessMessage(`"${selectedCollege.department_name}" has been archived and deleted`)
      setShowDeleteCollegeConfirm(false)
      setSelectedCollege(null)
      setCurrentView('colleges')
      fetchColleges()
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      console.error('Error deleting college:', error)
      alert(`Failed to delete college: ${error.message}`)
    } finally {
      setDeleting(false)
    }
  }

  // ==================== FILE CRUD ====================
  const handleRenameFile = async () => {
    if (!selectedFile || !renameFileName.trim()) {
      alert('Please enter a new file name')
      return
    }

    setSaving(true)
    try {
      const { error } = await db
        .from('faculty_profiles')
        .update({
          file_name: renameFileName.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('upload_group_id', selectedFile.upload_group_id)

      if (error) throw error

      setSuccessMessage(`File renamed to "${renameFileName.trim()}" successfully!`)
      setShowRenameFileModal(false)
      setRenameFileName('')
      if (selectedCollege) {
        fetchFilesForCollege(selectedCollege.college || selectedCollege.department_name)
      }
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      console.error('Error renaming file:', error)
      alert(`Failed to rename file: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteFile = async () => {
    if (!selectedFile) return

    setDeleting(true)
    try {
      // Archive faculty before deleting
      try {
        const { data: { user } } = await supabase.auth.getUser()
        await db
          .from('archived_items')
          .insert({
            item_type: 'faculty_file' as any,
            item_name: selectedFile.file_name,
            item_data: {
              file_name: selectedFile.file_name,
              college: selectedFile.college,
              faculty_count: selectedFile.faculty_count,
              upload_group_id: selectedFile.upload_group_id
            },
            deleted_by: user?.id || null,
            original_table: 'faculty_profiles',
            original_id: `file_${selectedFile.upload_group_id}`
          })
      } catch (archiveError) {
        console.warn('Could not archive file:', archiveError)
      }

      console.log('Deleting file with upload_group_id:', selectedFile.upload_group_id)
      const { data, error } = await db
        .from('faculty_profiles')
        .delete()
        .eq('upload_group_id', selectedFile.upload_group_id)
        .select()

      console.log('Delete file result:', { data, error })
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('Delete failed - database did not confirm the change. Check RLS policies in Supabase.')
      }

      setSuccessMessage(`File "${selectedFile.file_name}" with ${selectedFile.faculty_count} faculty members has been archived and deleted`)
      setShowDeleteFileConfirm(false)
      setSelectedFile(null)
      if (selectedCollege) {
        fetchFilesForCollege(selectedCollege.college || selectedCollege.department_name)
      }
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      console.error('Error deleting file:', error)
      alert(`Failed to delete file: ${error.message}`)
    } finally {
      setDeleting(false)
    }
  }

  // Move file to different college
  const handleMoveFile = async () => {
    if (!movingFileGroup || !selectedMoveCollege) return

    setMovingFile(true)
    try {
      // Update all faculty profiles in this file group to the new college
      console.log('Moving file to college:', selectedMoveCollege)
      const { data, error } = await db
        .from('faculty_profiles')
        .update({ college: selectedMoveCollege })
        .eq('upload_group_id', movingFileGroup.upload_group_id)
        .select()

      console.log('Move file result:', { data, error })
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('Move failed - database did not confirm the change. Check RLS policies in Supabase.')
      }

      setSuccessMessage(`File "${movingFileGroup.file_name}" moved to ${selectedMoveCollege}`)
      setShowMoveFileModal(false)
      setMovingFileGroup(null)
      setSelectedMoveCollege('')
      setMoveSearchTerm('')

      // Refresh files for current college
      if (selectedCollege) {
        fetchFilesForCollege(selectedCollege.college || selectedCollege.department_name)
      }
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      console.error('Error moving file:', error)
      alert(`Failed to move file: ${error.message}`)
    } finally {
      setMovingFile(false)
    }
  }

  const openMoveFileModal = (file: FileGroup) => {
    setMovingFileGroup(file)
    setSelectedMoveCollege('')
    setMoveSearchTerm('')
    setShowMoveFileModal(true)
  }

  // ==================== UTILITY FUNCTIONS ====================
  const resetCollegeForm = () => {
    setCollegeFormData({
      department_code: '',
      department_name: '',
      college: '',
      head_name: '',
      head_email: '',
      contact_phone: '',
      office_location: '',
      description: '',
      is_active: true
    })
  }

  const openEditCollegeModal = (college: College) => {
    setSelectedCollege(college)
    setCollegeFormData({
      department_code: college.department_code,
      department_name: college.department_name,
      college: college.college || '',
      head_name: college.head_name || '',
      head_email: college.head_email || '',
      contact_phone: college.contact_phone || '',
      office_location: college.office_location || '',
      description: college.description || '',
      is_active: college.is_active
    })
    setShowEditCollegeModal(true)
  }

  const openRenameFileModal = (file: FileGroup) => {
    setSelectedFile(file)
    setRenameFileName(file.file_name)
    setShowRenameFileModal(true)
  }

  const openEditFacultyModal = (faculty: FacultyProfile) => {
    setSelectedFacultyProfile(faculty)
    setFacultyFormData({
      faculty_id: faculty.faculty_id || '',
      full_name: faculty.full_name || '',
      email: faculty.email || '',
      position: faculty.position || '',
      role: faculty.role || 'faculty',
      employment_type: faculty.employment_type || 'full-time',
      department: faculty.department || '',
      college: faculty.college || '',
      phone: faculty.phone || '',
      office_location: faculty.office_location || '',
      profile_image: faculty.profile_image || null,
      preferred_times: faculty.preferred_times || 'any',
      unavailable_days: (faculty.unavailable_days as string[]) || []
    })
    setShowEditFacultyModal(true)
  }

  // Handle faculty profile image upload (admin)
  const handleFacultyImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !selectedFacultyProfile) return

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid image file (JPEG, PNG, GIF, or WebP)')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB')
      return
    }

    setUploadingFacultyImage(true)

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `faculty_${selectedFacultyProfile.id}_${Date.now()}.${fileExt}`
      const filePath = `faculty-avatars/${fileName}`

      // 🚀 Admin Priority: Upload via API route to bypass RLS restrictions
      const formData = new FormData()
      formData.append('file', file)
      formData.append('filePath', filePath)
      formData.append('bucket', 'profile-images')

      const response = await fetch('/api/faculty/upload-image', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const { publicUrl } = await response.json()

      // Update faculty_profiles table
      const { error: updateError } = await supabase
        .from('faculty_profiles')
        .update({ profile_image: publicUrl })
        .eq('id', selectedFacultyProfile.id)

      if (updateError) throw updateError

      // Also update users table if faculty has a user account
      if (facultyFormData.email) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', facultyFormData.email)
          .single()

        if (existingUser) {
          await supabase
            .from('users')
            .update({ avatar_url: publicUrl })
            .eq('id', existingUser.id)
        }
      }

      // Update local state
      const imageUrlWithCacheBust = `${publicUrl}?t=${Date.now()}`
      setFacultyFormData({ ...facultyFormData, profile_image: imageUrlWithCacheBust })
      setSelectedFacultyProfile({ ...selectedFacultyProfile, profile_image: imageUrlWithCacheBust })

      // Update the main faculty list so cards show the new image
      setFacultyProfiles(prev => prev.map(f =>
        f.id === selectedFacultyProfile.id
          ? { ...f, profile_image: imageUrlWithCacheBust }
          : f
      ))

      setSuccessMessage('✅ Profile image updated!')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      console.error('Error uploading faculty image:', error)
      alert(`Failed to upload image: ${error.message || error}`)
    } finally {
      setUploadingFacultyImage(false)
      if (facultyImageInputRef.current) {
        facultyImageInputRef.current.value = ''
      }
    }
  }

  const openDeleteFacultyConfirm = (faculty: FacultyProfile) => {
    setSelectedFacultyProfile(faculty)
    setDeleteFacultyTarget(faculty.id)
  }

  const openDeleteFileConfirmModal = (file: FileGroup) => {
    setSelectedFile(file)
    setShowDeleteFileConfirm(true)
  }

  const handleUpdateFaculty = async () => {
    if (!selectedFacultyProfile) {
      alert('No faculty selected')
      return
    }
    if (!facultyFormData.full_name.trim()) {
      alert('Name is required')
      return
    }

    setSaving(true)
    console.log('Updating faculty:', selectedFacultyProfile.id, facultyFormData)

    try {
      // First update faculty_profiles
      const { data: updatedFaculty, error: updateError } = await supabase
        .from('faculty_profiles')
        .update({
          faculty_id: facultyFormData.faculty_id.trim() || null,
          full_name: facultyFormData.full_name.trim(),
          email: facultyFormData.email.trim() || null,
          position: facultyFormData.position.trim() || null,
          role: facultyFormData.role,
          employment_type: facultyFormData.employment_type,
          department: facultyFormData.department.trim() || null,
          college: facultyFormData.college.trim() || null,
          phone: facultyFormData.phone.trim() || null,
          office_location: facultyFormData.office_location.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedFacultyProfile.id)
        .select()

      if (updateError) {
        console.error('Faculty update error:', updateError)
        throw new Error(`Database error: ${updateError.message}`)
      }

      console.log('Faculty updated successfully:', updatedFaculty)

      // If email is provided, sync this data to the users table (for approved faculty)
      if (facultyFormData.email.trim()) {
        const { data: existingUser, error: userCheckError } = await supabase
          .from('users')
          .select('id')
          .eq('email', facultyFormData.email.trim())
          .single()

        if (existingUser && !userCheckError) {
          // Update the user's profile with faculty data
          const { error: userUpdateError } = await supabase
            .from('users')
            .update({
              full_name: facultyFormData.full_name.trim(),
              phone: facultyFormData.phone.trim() || null,
              department: facultyFormData.department.trim() || null,
              college: facultyFormData.college.trim() || null,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingUser.id)

          if (userUpdateError) {
            console.warn('Could not sync to user account:', userUpdateError)
          } else {
            console.log('Synced faculty profile data to user account')
          }
        }
      }

      // Close modal and refresh data
      setShowEditFacultyModal(false)
      setSuccessMessage('✅ Faculty updated successfully!')

      // Force refresh the faculty list
      if (selectedFile) {
        await fetchFacultyForFile(selectedFile.upload_group_id, selectedFile.isLegacy)
      }

      // Also refresh all faculty stats
      await fetchAllFaculty()

      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      console.error('Error updating faculty:', error)
      alert(`Failed to update faculty: ${error.message || error}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteFaculty = async () => {
    if (!selectedFacultyProfile) return
    setDeleting(true)
    try {
      console.log('Deleting faculty ID:', selectedFacultyProfile.id)
      const { data, error } = await db
        .from('faculty_profiles')
        .delete()
        .eq('id', selectedFacultyProfile.id)
        .select()

      console.log('Delete faculty result:', { data, error })
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('Delete failed - database did not confirm the change. Check RLS policies in Supabase.')
      }

      setSuccessMessage('Faculty deleted successfully')
      setDeleteFacultyTarget(null)
      setSelectedFacultyProfile(null)
      if (selectedFile) fetchFacultyForFile(selectedFile.upload_group_id, selectedFile.isLegacy)
      setTimeout(() => setSuccessMessage(''), 2500)
    } catch (error: any) {
      console.error('Error deleting faculty:', error)
      alert(`Failed to delete faculty: ${error.message || error}`)
    } finally {
      setDeleting(false)
    }
  }

  // ==================== ADD NEW FACULTY ====================
  const resetFacultyForm = () => {
    setFacultyFormData({
      faculty_id: '',
      full_name: '',
      email: '',
      position: '',
      role: 'faculty',
      employment_type: 'full-time',
      department: '',
      college: selectedCollege?.department_name || '',
      phone: '',
      office_location: '',
      profile_image: null,
      preferred_times: 'any',
      unavailable_days: []  // Use empty array instead of string[] assumption here? YES.
    })
  }

  const handleAddNewFaculty = async () => {
    if (!facultyFormData.full_name.trim()) {
      alert('Full Name is required')
      return
    }

    setSaving(true)
    try {
      const newFaculty = {
        faculty_id: facultyFormData.faculty_id.trim() || `FAC-${Date.now()}`,
        full_name: facultyFormData.full_name.trim(),
        email: facultyFormData.email.trim() || null,
        position: facultyFormData.position.trim() || 'Faculty',
        role: facultyFormData.role,
        employment_type: facultyFormData.employment_type,
        department: facultyFormData.department.trim() || null,
        college: facultyFormData.college.trim() || selectedCollege?.department_name || null,
        phone: facultyFormData.phone.trim() || null,
        office_location: facultyFormData.office_location.trim() || null,
        upload_group_id: selectedFile?.isLegacy ? null : selectedFile?.upload_group_id,
        file_name: selectedFile?.file_name || 'Manual Entry',
        is_active: true
      }

      const { error } = await db
        .from('faculty_profiles')
        .insert([newFaculty])

      if (error) throw error

      // If email is provided, sync this data to the users table (for approved faculty)
      if (facultyFormData.email.trim()) {
        const { data: existingUser } = await db
          .from('users')
          .select('id')
          .eq('email', facultyFormData.email.trim())
          .single()

        if (existingUser) {
          // Update the user's profile with faculty data
          await db
            .from('users')
            .update({
              full_name: facultyFormData.full_name.trim(),
              phone: facultyFormData.phone.trim() || null,
              department: facultyFormData.department.trim() || null,
              college: facultyFormData.college.trim() || null,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingUser.id)

          console.log('Synced new faculty profile data to user account')
        }
      }

      setSuccessMessage('Faculty added successfully!')
      setShowAddFacultyModal(false)
      resetFacultyForm()
      if (selectedFile) fetchFacultyForFile(selectedFile.upload_group_id, selectedFile.isLegacy)
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      console.error('Error adding faculty:', error)
      alert(`Failed to add faculty: ${error.message || error}`)
    } finally {
      setSaving(false)
    }
  }

  // ==================== EXPORT FUNCTIONS ====================
  const getSortedFacultyForExport = () => {
    const faculty = [...facultyProfiles]
    if (exportOptions.sortByDepartment) {
      faculty.sort((a, b) => {
        const deptA = (a.department || 'ZZZ').toLowerCase()
        const deptB = (b.department || 'ZZZ').toLowerCase()
        if (deptA !== deptB) return deptA.localeCompare(deptB)
        return (a.full_name || '').localeCompare(b.full_name || '')
      })
    } else {
      faculty.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
    }
    return faculty
  }

  const generateCSV = () => {
    const faculty = getSortedFacultyForExport()
    const headers: string[] = []

    if (exportOptions.onlyNames) {
      headers.push('Full Name')
    } else {
      if (exportOptions.sortByDepartment) headers.push('Department')
      headers.push('Full Name')
      if (exportOptions.includeId) headers.push('Faculty ID')
      if (exportOptions.includeType) headers.push('Employment Type')
    }

    const rows = faculty.map(f => {
      const row: string[] = []
      if (exportOptions.onlyNames) {
        row.push(f.full_name || '')
      } else {
        if (exportOptions.sortByDepartment) row.push(f.department || 'N/A')
        row.push(f.full_name || '')
        if (exportOptions.includeId) row.push(f.faculty_id || 'N/A')
        if (exportOptions.includeType) row.push(f.employment_type || 'N/A')
      }
      return row.join(',')
    })

    return [headers.join(','), ...rows].join('\n')
  }

  const handleExportCSV = () => {
    const csv = generateCSV()
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${selectedFile?.file_name || 'faculty'}_export_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
    setSuccessMessage('CSV exported successfully!')
    setShowExportModal(false)
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  const handleExportPDFPNG = async () => {
    setExporting(true)
    try {
      // Dynamically import the libraries
      const html2canvas = (await import('html2canvas')).default
      const jsPDFModule = await import('jspdf')
      const jsPDF = jsPDFModule.default

      const previewElement = document.getElementById('export-preview-content')
      if (!previewElement) {
        alert('Preview content not found')
        return
      }

      const canvas = await html2canvas(previewElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      })

      if (exportOptions.format === 'png') {
        const link = document.createElement('a')
        link.download = `${selectedFile?.file_name || 'faculty'}_export_${new Date().toISOString().split('T')[0]}.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
      } else {
        // PDF export
        const imgData = canvas.toDataURL('image/png')
        const pdf = new jsPDF({
          orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [canvas.width, canvas.height]
        })
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)
        pdf.save(`${selectedFile?.file_name || 'faculty'}_export_${new Date().toISOString().split('T')[0]}.pdf`)
      }

      setSuccessMessage(`${exportOptions.format.toUpperCase()} exported successfully!`)
      setShowExportModal(false)
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      console.error('Export error:', error)
      alert(`Export failed: ${error.message || error}`)
    } finally {
      setExporting(false)
    }
  }

  const handleExport = () => {
    if (exportOptions.format === 'csv') {
      handleExportCSV()
    } else {
      handleExportPDFPNG()
    }
  }

  // Filter faculty
  const filteredFaculty = facultyProfiles.filter(f => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      if (!f.full_name?.toLowerCase().includes(term) &&
        !f.email?.toLowerCase().includes(term) &&
        !f.position?.toLowerCase().includes(term) &&
        !f.department?.toLowerCase().includes(term)) {
        return false
      }
    }
    if (filterRole !== 'all' && f.role !== filterRole) return false
    if (filterEmployment !== 'all' && f.employment_type !== filterEmployment) return false
    return true
  })

  // Pagination
  const totalPages = Math.ceil(filteredFaculty.length / PAGE_SIZE)
  const paginatedFaculty = filteredFaculty.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // ==================== RENDER ====================
  if (loading && currentView === 'colleges' && colleges.length === 0) {
    return (
      <div className={styles.layout} data-page="admin">
        <MenuBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} showSidebarToggle={true} showAccountIcon={true} />
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className={`${styles.main} ${!sidebarOpen ? styles.fullWidth : ''}`}>
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p>Loading colleges...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={styles.layout} data-page="admin">
      <MenuBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} showSidebarToggle={true} showAccountIcon={true} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className={`${styles.main} ${!sidebarOpen ? styles.fullWidth : ''}`}>
        <div className={styles.container}>
          {/* Breadcrumb / Navigation Bar */}
          <div className={styles.breadcrumb}>
            {currentView !== 'colleges' && (
              <button className={styles.backBtn} onClick={handleBack}>
                <BackIcon />
                Back
              </button>
            )}
            <div className={styles.breadcrumbPath}>
              <span
                className={currentView === 'colleges' ? styles.breadcrumbActive : styles.breadcrumbLink}
                onClick={() => { setCurrentView('colleges'); setSelectedCollege(null); setSelectedFile(null); }}
              >
                Faculty Colleges
              </span>
              {selectedCollege && (
                <>
                  <span className={styles.breadcrumbSeparator}>/</span>
                  <span
                    className={currentView === 'files' ? styles.breadcrumbActive : styles.breadcrumbLink}
                    onClick={() => { setCurrentView('files'); setSelectedFile(null); }}
                  >
                    {selectedCollege.department_name}
                  </span>
                </>
              )}
              {selectedFile && (
                <>
                  <span className={styles.breadcrumbSeparator}>/</span>
                  <span className={styles.breadcrumbActive}>
                    {selectedFile.file_name}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className={styles.successMessage}>{successMessage}</div>
          )}

          {/* ==================== COLLEGES VIEW ==================== */}
          {currentView === 'colleges' && (
            <>
              {/* Header */}
              <div className={styles.header}>
                <div className={styles.headerTitleSection}>
                  <div className={styles.headerIconWrapper}>
                    <UsersIcon />
                  </div>
                  <div className={styles.headerText}>
                    <h1 className={styles.title}>Faculty Colleges</h1>
                    <p className={styles.subtitle}>
                      Manage faculty members organized by college
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    className={styles.secondaryBtn}
                    onClick={() => window.location.href = '/LandingPages/FacultyColleges/TeachingLoadAssignment'}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 20px',
                      backgroundColor: '#8b5cf6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />
                    </svg>
                    Teaching Load Assignment
                  </button>
                  <button className={styles.addBtn} onClick={() => { resetCollegeForm(); setShowAddCollegeModal(true); }}>
                    <PlusIcon />
                    Add College
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}><FolderIcon /></div>
                  <div className={styles.statContent}>
                    <p className={styles.statLabel}>Total Colleges</p>
                    <p className={styles.statValue}>{stats.totalColleges}</p>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}><UsersIcon /></div>
                  <div className={styles.statContent}>
                    <p className={styles.statLabel}>Total Faculty</p>
                    <p className={styles.statValue}>{stats.totalFaculty}</p>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}><FileIcon /></div>
                  <div className={styles.statContent}>
                    <p className={styles.statLabel}>CSV Files</p>
                    <p className={styles.statValue}>{stats.totalFiles}</p>
                  </div>
                </div>
              </div>

              {/* College Cards Grid */}
              <div className={styles.collegeGrid}>
                {colleges.map(college => (
                  <div key={college.id} className={styles.collegeCard}>
                    <div className={styles.collegeCardContent} onClick={() => handleSelectCollege(college)}>
                      <div className={styles.collegeIcon}>
                        <FolderIcon />
                      </div>
                      <div className={styles.collegeInfo}>
                        <h4>{college.department_name}</h4>
                        <p>{college.department_code}</p>
                        <p className={styles.collegeMeta}>{college.office_location || 'BulSU Main Campus'}</p>
                        <span className={`${styles.statusBadge} ${college.is_active ? styles.statusActive : styles.statusInactive}`}>
                          {college.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    <div className={styles.collegeActions}>
                      <button
                        className={styles.editBtn}
                        onClick={(e) => { e.stopPropagation(); openEditCollegeModal(college); }}
                        title="Edit college"
                      >
                        <EditIcon />
                      </button>
                      <button
                        className={styles.deleteBtn}
                        onClick={(e) => { e.stopPropagation(); setSelectedCollege(college); setShowDeleteCollegeConfirm(true); }}
                        title="Delete college"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {colleges.length === 0 && !loading && (
                <div className={styles.emptyState}>
                  <FolderIcon />
                  <h3>No Colleges Found</h3>
                  <p>Add your first college to start organizing faculty members.</p>
                  <button className={styles.addBtn} onClick={() => { resetCollegeForm(); setShowAddCollegeModal(true); }}>
                    <PlusIcon />
                    Add College
                  </button>
                </div>
              )}
            </>
          )}

          {/* ==================== FILES VIEW ==================== */}
          {currentView === 'files' && selectedCollege && (
            <>
              {/* Header */}
              <div className={styles.header}>
                <div className={styles.headerTitleSection}>
                  <div className={styles.headerIconWrapper}>
                    <FileIcon />
                  </div>
                  <div className={styles.headerText}>
                    <h1 className={styles.title}>{selectedCollege.department_name}</h1>
                    <p className={styles.subtitle}>
                      {fileGroups.length} CSV file(s) with faculty data
                    </p>
                  </div>
                </div>
              </div>

              {/* File Cards Grid */}
              {loading ? (
                <div className={styles.loadingState}>
                  <div className={styles.spinner}></div>
                  <p>Loading files...</p>
                </div>
              ) : fileGroups.length > 0 ? (
                <div className={styles.fileGrid}>
                  {fileGroups.map(file => (
                    <div key={file.upload_group_id} className={styles.fileCard}>
                      <div className={styles.fileCardContent} onClick={() => handleSelectFile(file)}>
                        <div className={styles.fileIcon}>
                          <FileIcon />
                        </div>
                        <div className={styles.fileInfo}>
                          <h4>{file.file_name}</h4>
                          <p>{file.faculty_count} faculty members</p>
                          <p className={styles.fileMeta}>
                            {file.departments.slice(0, 2).join(', ')}
                            {file.departments.length > 2 && ` +${file.departments.length - 2} more`}
                          </p>
                        </div>
                      </div>
                      <div className={styles.fileActions}>
                        <button
                          className={styles.editBtn}
                          onClick={(e) => { e.stopPropagation(); openMoveFileModal(file); }}
                          title="Move file"
                        >
                          <MoveIcon />
                        </button>
                        <button
                          className={styles.editBtn}
                          onClick={(e) => { e.stopPropagation(); openRenameFileModal(file); }}
                          title="Rename file"
                        >
                          <EditIcon />
                        </button>
                        <button
                          className={styles.deleteBtn}
                          onClick={(e) => { e.stopPropagation(); openDeleteFileConfirmModal(file); }}
                          title="Delete file"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                      <span className={styles.fileArrow} onClick={() => handleSelectFile(file)}>→</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <FileIcon />
                  <h3>No Faculty Files Found</h3>
                  <p>No CSV files match this college. Upload faculty data from the Upload CSV page.</p>
                  <button
                    className={styles.addBtn}
                    onClick={() => router.push('/LandingPages/UploadCSV')}
                  >
                    Go to Upload CSV
                  </button>
                </div>
              )}
            </>
          )}

          {/* ==================== FACULTY VIEW ==================== */}
          {currentView === 'faculty' && selectedFile && (
            <>
              {/* Header */}
              <div className={styles.header}>
                <div className={styles.headerTitleSection}>
                  <div className={styles.headerIconWrapper}>
                    <UsersIcon />
                  </div>
                  <div className={styles.headerText}>
                    <h1 className={styles.title}>{selectedFile.file_name}</h1>
                    <p className={styles.subtitle}>
                      {facultyProfiles.length} faculty members • {selectedCollege?.department_name}
                    </p>
                  </div>
                </div>
                <div className={styles.headerActions}>
                  <button
                    className={styles.exportBtn}
                    onClick={() => setShowExportModal(true)}
                    title="Export faculty list"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                    </svg>
                    Export
                  </button>
                  <button
                    className={styles.addBtn}
                    onClick={() => { resetFacultyForm(); setShowAddFacultyModal(true); }}
                    title="Add new faculty member"
                  >
                    <PlusIcon />
                    Add Faculty
                  </button>
                </div>
              </div>

              {/* Search & Filter */}
              <div className={styles.searchSection}>
                <div className={styles.searchBox}>
                  <SearchIcon className={styles.searchIcon} />
                  <input
                    type="text"
                    placeholder="Search by name, email, position..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className={styles.searchInput}
                  />
                </div>
                <div className={styles.filterButtons}>
                  <select
                    className={styles.filterSelect}
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
                    className={styles.filterSelect}
                    value={filterEmployment}
                    onChange={e => setFilterEmployment(e.target.value)}
                  >
                    <option value="all">All Types</option>
                    <option value="full-time">Full-Time</option>
                    <option value="part-time">Part-Time</option>
                    <option value="adjunct">Adjunct</option>
                    <option value="guest">Guest</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div className={styles.loadingState}>
                  <div className={styles.spinner}></div>
                  <p>Loading faculty...</p>
                </div>
              ) : (
                <>
                  {/* Hierarchy Section */}
                  {hierarchyFaculty.length > 0 && (
                    <div className={styles.hierarchySection}>
                      <h3 className={styles.sectionTitle}>★ College Leadership & Staff</h3>
                      <div className={styles.hierarchyGrid}>
                        {hierarchyFaculty.map(faculty => {
                          const roleInfo = getRoleInfo(faculty.role)
                          const empBadge = getEmploymentBadge(faculty.employment_type)
                          return (
                            <div key={faculty.id} className={`${styles.hierarchyCard} ${styles.cardWithActions}`}>
                              <div className={styles.cardActions}>
                                <button
                                  className={styles.iconBtn}
                                  title="Edit"
                                  onClick={(e) => { e.stopPropagation(); openEditFacultyModal(faculty) }}
                                >
                                  <EditIcon />
                                </button>
                                <button
                                  className={`${styles.iconBtn} ${styles.danger}`}
                                  title="Delete"
                                  onClick={(e) => { e.stopPropagation(); openDeleteFacultyConfirm(faculty) }}
                                >
                                  <TrashIcon />
                                </button>
                                {deleteFacultyTarget === faculty.id && (
                                  <div className={styles.inlineConfirm}>
                                    <p>Delete this faculty?</p>
                                    <div className={styles.inlineConfirmActions}>
                                      <button onClick={(e) => { e.stopPropagation(); handleDeleteFaculty() }} disabled={deleting}>Yes</button>
                                      <button onClick={(e) => { e.stopPropagation(); setDeleteFacultyTarget(null); setSelectedFacultyProfile(null) }}>Cancel</button>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className={styles.hierarchyAvatar} style={{ borderColor: roleInfo.color }}>
                                {faculty.profile_image ? (
                                  <img src={faculty.profile_image} alt={faculty.full_name} />
                                ) : (
                                  <span>{getInitials(faculty.full_name)}</span>
                                )}
                              </div>
                              <div className={styles.hierarchyInfo}>
                                <span className={styles.roleIcon}>{roleInfo.icon}</span>
                                <h4>{faculty.full_name}</h4>
                                <p className={styles.facultyIdBadge}>ID: {faculty.faculty_id}</p>
                                <p className={styles.hierarchyPosition}>{faculty.position}</p>
                                <span className={styles.roleBadge} style={{ backgroundColor: roleInfo.bgColor, color: roleInfo.color }}>
                                  {roleInfo.label}
                                </span>
                                <span className={styles.empBadge} style={{ backgroundColor: empBadge.color }}>
                                  {empBadge.label}
                                </span>
                              </div>
                              {faculty.email && (
                                <p className={styles.hierarchyEmail}>{faculty.email}</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Regular Faculty Section */}
                  {regularFaculty.length > 0 && (
                    <div className={styles.facultySection}>
                      <h3 className={styles.sectionTitle}>● Faculty Members ({regularFaculty.length})</h3>
                      <div className={styles.facultyGrid}>
                        {paginatedFaculty.filter(f => f.role === 'faculty').map(faculty => {
                          const empBadge = getEmploymentBadge(faculty.employment_type)
                          return (
                            <div key={faculty.id} className={`${styles.facultyCard} ${styles.cardWithActions}`}>
                              <div className={styles.cardActions}>
                                <button
                                  className={styles.iconBtn}
                                  title="Edit"
                                  onClick={(e) => { e.stopPropagation(); openEditFacultyModal(faculty) }}
                                >
                                  <EditIcon />
                                </button>
                                <button
                                  className={`${styles.iconBtn} ${styles.danger}`}
                                  title="Delete"
                                  onClick={(e) => { e.stopPropagation(); openDeleteFacultyConfirm(faculty) }}
                                >
                                  <TrashIcon />
                                </button>
                                {deleteFacultyTarget === faculty.id && (
                                  <div className={styles.inlineConfirm}>
                                    <p>Delete this faculty?</p>
                                    <div className={styles.inlineConfirmActions}>
                                      <button onClick={(e) => { e.stopPropagation(); handleDeleteFaculty() }} disabled={deleting}>Yes</button>
                                      <button onClick={(e) => { e.stopPropagation(); setDeleteFacultyTarget(null); setSelectedFacultyProfile(null) }}>Cancel</button>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className={styles.facultyAvatar}>
                                {faculty.profile_image ? (
                                  <img src={faculty.profile_image} alt={faculty.full_name} />
                                ) : (
                                  <span>{getInitials(faculty.full_name)}</span>
                                )}
                              </div>
                              <div className={styles.facultyInfo}>
                                <h4>{faculty.full_name}</h4>
                                <p className={styles.facultyIdBadge}>ID: {faculty.faculty_id}</p>
                                <p>{faculty.department || 'No Department'}</p>
                                <span className={styles.empBadge} style={{ backgroundColor: empBadge.color }}>
                                  {empBadge.label}
                                </span>
                              </div>
                              {faculty.email && (
                                <p className={styles.facultyEmail}>{faculty.email}</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className={styles.pagination}>
                      <button
                        className={styles.paginationBtn}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        ← Prev
                      </button>
                      <span className={styles.paginationInfo}>
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        className={styles.paginationBtn}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next →
                      </button>
                    </div>
                  )}

                  {facultyProfiles.length === 0 && (
                    <div className={styles.emptyState}>
                      <UsersIcon />
                      <h3>No Faculty Found</h3>
                      <p>This file contains no faculty members.</p>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>

      {/* ==================== MODALS ==================== */}
      {/* Add College Modal */}
      {showAddCollegeModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddCollegeModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Add New College</h3>
              <button className={styles.modalClose} onClick={() => setShowAddCollegeModal(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>College Name *</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={collegeFormData.department_name}
                    onChange={e => setCollegeFormData({ ...collegeFormData, department_name: e.target.value })}
                    placeholder="College of Science"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Code *</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={collegeFormData.department_code}
                    onChange={e => setCollegeFormData({ ...collegeFormData, department_code: e.target.value })}
                    placeholder="CS"
                  />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Campus Location</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={collegeFormData.office_location}
                  onChange={e => setCollegeFormData({ ...collegeFormData, office_location: e.target.value })}
                  placeholder="BulSU Main Campus"
                />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Head Name</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={collegeFormData.head_name}
                    onChange={e => setCollegeFormData({ ...collegeFormData, head_name: e.target.value })}
                    placeholder="Dr. John Doe"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Head Email</label>
                  <input
                    type="email"
                    className={styles.formInput}
                    value={collegeFormData.head_email}
                    onChange={e => setCollegeFormData({ ...collegeFormData, head_email: e.target.value })}
                    placeholder="john.doe@bulsu.edu.ph"
                  />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Description</label>
                <textarea
                  className={styles.formTextarea}
                  value={collegeFormData.description}
                  onChange={e => setCollegeFormData({ ...collegeFormData, description: e.target.value })}
                  placeholder="Brief description of the college..."
                  rows={3}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnCancel} onClick={() => setShowAddCollegeModal(false)}>Cancel</button>
              <button className={styles.btnSave} onClick={handleAddCollege} disabled={saving}>
                {saving ? 'Saving...' : 'Add College'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Faculty Modal */}
      {showEditFacultyModal && selectedFacultyProfile && (
        <div className={styles.modalOverlay} onClick={() => setShowEditFacultyModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Edit Faculty</h3>
              <button className={styles.modalClose} onClick={() => setShowEditFacultyModal(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              {/* Profile Image Upload Section */}
              <div className={styles.imageUploadSection} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginBottom: '20px',
                padding: '16px',
                background: 'rgba(16, 185, 129, 0.05)',
                borderRadius: '12px',
                border: '1px solid rgba(16, 185, 129, 0.2)'
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {facultyFormData.profile_image ? (
                    <img
                      src={facultyFormData.profile_image}
                      alt="Profile"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ fontSize: '28px', fontWeight: 'bold', color: 'white' }}>
                      {getInitials(facultyFormData.full_name)}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px', display: 'block' }}>
                    Profile Photo
                  </label>
                  <input
                    type="file"
                    ref={facultyImageInputRef}
                    onChange={handleFacultyImageUpload}
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => facultyImageInputRef.current?.click()}
                    disabled={uploadingFacultyImage}
                    style={{
                      padding: '8px 16px',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: uploadingFacultyImage ? 'wait' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      opacity: uploadingFacultyImage ? 0.7 : 1
                    }}
                  >
                    {uploadingFacultyImage ? 'Uploading...' : 'Upload Photo'}
                  </button>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                    JPG, PNG, GIF or WebP. Max 5MB.
                  </p>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Faculty ID</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={facultyFormData.faculty_id}
                    onChange={e => setFacultyFormData({ ...facultyFormData, faculty_id: e.target.value })}
                    placeholder="e.g., FAC-2025-001"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Full Name *</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={facultyFormData.full_name}
                    onChange={e => setFacultyFormData({ ...facultyFormData, full_name: e.target.value })}
                  />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Email</label>
                  <input
                    type="email"
                    className={styles.formInput}
                    value={facultyFormData.email}
                    onChange={e => setFacultyFormData({ ...facultyFormData, email: e.target.value })}
                  />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Position</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={facultyFormData.position}
                    onChange={e => setFacultyFormData({ ...facultyFormData, position: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Role</label>
                  <select
                    className={styles.formInput}
                    value={facultyFormData.role}
                    onChange={e => setFacultyFormData({ ...facultyFormData, role: e.target.value as FacultyProfile['role'] })}
                  >
                    <option value="administrator">Administrator</option>
                    <option value="department_head">Department Head</option>
                    <option value="program_chair">Program Chair</option>
                    <option value="coordinator">Coordinator</option>
                    <option value="faculty">Faculty</option>
                    <option value="staff">Staff</option>
                  </select>
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                </div>
                <div className={styles.formGroup}>
                  <label>Employment Type</label>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {['full-time', 'part-time', 'vsl', 'guest'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          let newUnavailable = [...(facultyFormData.unavailable_days || [])];
                          if (type === 'part-time') {
                            if (!newUnavailable.includes('Saturday')) newUnavailable.push('Saturday');
                          } else {
                            newUnavailable = newUnavailable.filter(d => d !== 'Saturday');
                          }
                          setFacultyFormData({
                            ...facultyFormData,
                            employment_type: type as any,
                            unavailable_days: newUnavailable
                          })
                        }}
                        style={{
                          padding: '6px 4px',
                          fontSize: '0.8rem',
                          borderRadius: '4px',
                          border: '1px solid',
                          borderColor: facultyFormData.employment_type === type ? '#2563eb' : '#e5e7eb',
                          backgroundColor: facultyFormData.employment_type === type ? '#2563eb' : 'white',
                          color: facultyFormData.employment_type === type ? 'white' : '#374151',
                          cursor: 'pointer'
                        }}
                      >
                        {type === 'vsl' ? 'VSL' : type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ')}
                      </button>
                    ))}
                  </div>

                  {facultyFormData.employment_type === 'vsl' && (
                    <div style={{ padding: '8px', background: '#f8fafc', borderRadius: '4px', marginBottom: '8px' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Preferred Shift</label>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="edit_preferred_times"
                            checked={facultyFormData.preferred_times === 'morning'}
                            onChange={() => setFacultyFormData({ ...facultyFormData, preferred_times: 'morning' })}
                          /> Morning
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="edit_preferred_times"
                            checked={facultyFormData.preferred_times === 'night'}
                            onChange={() => setFacultyFormData({ ...facultyFormData, preferred_times: 'night' })}
                          /> Night
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="edit_preferred_times"
                            checked={facultyFormData.preferred_times === 'any'}
                            onChange={() => setFacultyFormData({ ...facultyFormData, preferred_times: 'any' })}
                          /> Any
                        </label>
                      </div>
                    </div>
                  )}

                  {facultyFormData.employment_type === 'part-time' && (
                    <div style={{ padding: '8px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '4px', fontSize: '0.75rem', color: '#92400e' }}>
                      Part-time faculty are restricted from Saturday classes.
                    </div>
                  )}
                </div>
                <div className={styles.formGroup}>
                  <label>Department</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={facultyFormData.department}
                    onChange={e => setFacultyFormData({ ...facultyFormData, department: e.target.value })}
                  />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>College</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={facultyFormData.college}
                    onChange={e => setFacultyFormData({ ...facultyFormData, college: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Phone</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={facultyFormData.phone}
                    onChange={e => setFacultyFormData({ ...facultyFormData, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Office Location</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={facultyFormData.office_location}
                  onChange={e => setFacultyFormData({ ...facultyFormData, office_location: e.target.value })}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.secondaryBtn} onClick={() => setShowEditFacultyModal(false)} disabled={saving}>Cancel</button>
              <button className={styles.addBtn} onClick={handleUpdateFaculty} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit College Modal */}
      {showEditCollegeModal && selectedCollege && (
        <div className={styles.modalOverlay} onClick={() => setShowEditCollegeModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Edit College</h3>
              <button className={styles.modalClose} onClick={() => setShowEditCollegeModal(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>College Name *</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={collegeFormData.department_name}
                    onChange={e => setCollegeFormData({ ...collegeFormData, department_name: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Code *</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={collegeFormData.department_code}
                    onChange={e => setCollegeFormData({ ...collegeFormData, department_code: e.target.value })}
                  />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Campus Location</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={collegeFormData.office_location}
                  onChange={e => setCollegeFormData({ ...collegeFormData, office_location: e.target.value })}
                />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Head Name</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={collegeFormData.head_name}
                    onChange={e => setCollegeFormData({ ...collegeFormData, head_name: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Head Email</label>
                  <input
                    type="email"
                    className={styles.formInput}
                    value={collegeFormData.head_email}
                    onChange={e => setCollegeFormData({ ...collegeFormData, head_email: e.target.value })}
                  />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Status</label>
                <select
                  className={styles.formSelect}
                  value={collegeFormData.is_active ? 'active' : 'inactive'}
                  onChange={e => setCollegeFormData({ ...collegeFormData, is_active: e.target.value === 'active' })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnCancel} onClick={() => setShowEditCollegeModal(false)}>Cancel</button>
              <button className={styles.btnSave} onClick={handleEditCollege} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete College Confirmation Modal */}
      {showDeleteCollegeConfirm && selectedCollege && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteCollegeConfirm(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className={styles.modalHeader}>
              <h3>⚠️ Delete College</h3>
              <button className={styles.modalClose} onClick={() => setShowDeleteCollegeConfirm(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <p>Are you sure you want to delete <strong>"{selectedCollege.department_name}"</strong>?</p>
              <p className={styles.warningText}>This will archive the college and can be restored later.</p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnCancel} onClick={() => setShowDeleteCollegeConfirm(false)}>Cancel</button>
              <button className={styles.btnDelete} onClick={handleDeleteCollege} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete & Archive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename File Modal */}
      {showRenameFileModal && selectedFile && (
        <div className={styles.modalOverlay} onClick={() => setShowRenameFileModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className={styles.modalHeader}>
              <h3>✏️ Rename File</h3>
              <button className={styles.modalClose} onClick={() => setShowRenameFileModal(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalSubtext}>Current: <strong>{selectedFile.file_name}</strong> ({selectedFile.faculty_count} faculty)</p>
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
              <button className={styles.btnCancel} onClick={() => setShowRenameFileModal(false)}>Cancel</button>
              <button className={styles.btnSave} onClick={handleRenameFile} disabled={saving}>
                {saving ? 'Renaming...' : 'Rename'}
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
              <h3>⚠️ Delete File</h3>
              <button className={styles.modalClose} onClick={() => setShowDeleteFileConfirm(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <p>Are you sure you want to delete <strong>"{selectedFile.file_name}"</strong>?</p>
              <p className={styles.dangerText}>⚠️ This will delete <strong>{selectedFile.faculty_count} faculty members</strong>!</p>
              <p className={styles.warningText}>All data will be archived and can be restored later.</p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnCancel} onClick={() => setShowDeleteFileConfirm(false)}>Cancel</button>
              <button className={styles.btnDelete} onClick={handleDeleteFile} disabled={deleting}>
                {deleting ? 'Deleting...' : `Delete ${selectedFile.faculty_count} Faculty`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move File Modal */}
      {showMoveFileModal && movingFileGroup && (
        <div className={styles.modalOverlay} onClick={() => setShowMoveFileModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <div className={styles.modalHeader} data-modal-header="move-file">
              <h3>📁 Move File to College</h3>
              <button className={styles.modalClose} onClick={() => setShowMoveFileModal(false)}>
                <CloseIcon />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalSubtext}>
                Moving: <strong>{movingFileGroup.file_name}</strong> ({movingFileGroup.faculty_count} faculty)
              </p>
              <p className={styles.modalSubtext} style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                Current college: <strong>{movingFileGroup.college}</strong>
              </p>

              <div className={styles.formGroup} style={{ marginTop: '16px' }}>
                <label>Search College</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={moveSearchTerm}
                  onChange={e => setMoveSearchTerm(e.target.value)}
                  placeholder="Search colleges..."
                />
              </div>

              <div className={styles.formGroup}>
                <label>Select Destination College</label>
                <div style={{
                  maxHeight: '250px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-color, #ddd)',
                  borderRadius: '8px',
                  marginTop: '8px'
                }}>
                  {bulsuColleges
                    .filter(college => {
                      const searchLower = moveSearchTerm.toLowerCase()
                      return (
                        college.code.toLowerCase().includes(searchLower) ||
                        college.name.toLowerCase().includes(searchLower)
                      )
                    })
                    .filter(college => college.code !== movingFileGroup.college && college.name !== movingFileGroup.college)
                    .map(college => (
                      <div
                        key={college.code}
                        onClick={() => setSelectedMoveCollege(college.name)}
                        style={{
                          padding: '12px 16px',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border-color, #eee)',
                          background: selectedMoveCollege === college.name ? 'var(--primary-color, #4f46e5)' : 'transparent',
                          color: selectedMoveCollege === college.name ? 'white' : 'inherit',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px'
                        }}
                        onMouseEnter={e => {
                          if (selectedMoveCollege !== college.name) {
                            e.currentTarget.style.background = 'var(--hover-bg, #f3f4f6)'
                          }
                        }}
                        onMouseLeave={e => {
                          if (selectedMoveCollege !== college.name) {
                            e.currentTarget.style.background = 'transparent'
                          }
                        }}
                      >
                        <FolderIcon className={styles.folderIconSmall} />
                        <div>
                          <div style={{ fontWeight: 500 }}>{college.code}</div>
                          <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>{college.name}</div>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnCancel} onClick={() => setShowMoveFileModal(false)}>Cancel</button>
              <button
                className={styles.btnSave}
                onClick={handleMoveFile}
                disabled={movingFile || !selectedMoveCollege}
              >
                {movingFile ? 'Moving...' : `Move to ${selectedMoveCollege || 'selected college'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Faculty Modal */}
      {showAddFacultyModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddFacultyModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>➕ Add New Faculty</h3>
              <button className={styles.modalClose} onClick={() => setShowAddFacultyModal(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Faculty ID</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={facultyFormData.faculty_id}
                    onChange={e => setFacultyFormData({ ...facultyFormData, faculty_id: e.target.value })}
                    placeholder="e.g., FAC-2025-001 (auto-generated if empty)"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Full Name *</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={facultyFormData.full_name}
                    onChange={e => setFacultyFormData({ ...facultyFormData, full_name: e.target.value })}
                    placeholder="Dela Cruz, Juan A."
                  />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup} style={{ position: 'relative' }}>
                  <label>Email (Approved Faculty Only)</label>
                  <input
                    type="email"
                    className={styles.formInput}
                    value={facultyFormData.email}
                    onChange={e => handleEmailInputChange(e.target.value)}
                    onFocus={() => {
                      if (facultyFormData.email.length >= 2) {
                        const filtered = approvedFacultyUsers.filter(u =>
                          u.email.toLowerCase().includes(facultyFormData.email.toLowerCase()) ||
                          u.full_name.toLowerCase().includes(facultyFormData.email.toLowerCase())
                        )
                        setFilteredEmailSuggestions(filtered)
                        setShowEmailSuggestions(filtered.length > 0)
                      }
                    }}
                    onBlur={() => setTimeout(() => setShowEmailSuggestions(false), 200)}
                    placeholder="Type to search approved faculty emails..."
                  />
                  {showEmailSuggestions && filteredEmailSuggestions.length > 0 && (
                    <div className={styles.emailSuggestions}>
                      <div className={styles.suggestionsHeader}>
                        ✅ Approved Faculty ({filteredEmailSuggestions.length})
                      </div>
                      {filteredEmailSuggestions.map(user => (
                        <div
                          key={user.id}
                          className={styles.suggestionItem}
                          onClick={() => selectEmailSuggestion(user)}
                        >
                          <span className={styles.suggestionName}>{user.full_name}</span>
                          <span className={styles.suggestionEmail}>{user.email}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {approvedFacultyUsers.length > 0 && (
                    <span className={styles.emailHint}>
                      💡 Only approved faculty emails will sync with the faculty portal
                    </span>
                  )}
                </div>
                <div className={styles.formGroup}>
                  <label>Position</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={facultyFormData.position}
                    onChange={e => setFacultyFormData({ ...facultyFormData, position: e.target.value })}
                    placeholder="e.g., Instructor I"
                  />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Role</label>
                  <select
                    className={styles.formInput}
                    value={facultyFormData.role}
                    onChange={e => setFacultyFormData({ ...facultyFormData, role: e.target.value as FacultyProfile['role'] })}
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
                </div>
                <div className={styles.formGroup}>
                  <label>Employment Type</label>
                  <div className="grid grid-cols-4 gap-2 mb-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '8px' }}>
                    {['full-time', 'part-time', 'vsl', 'guest'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          let newUnavailable = [...(facultyFormData.unavailable_days || [])];
                          if (type === 'part-time') {
                            if (!newUnavailable.includes('Saturday')) newUnavailable.push('Saturday');
                          } else {
                            newUnavailable = newUnavailable.filter(d => d !== 'Saturday');
                          }
                          setFacultyFormData({
                            ...facultyFormData,
                            employment_type: type as any,
                            unavailable_days: newUnavailable
                          })
                        }}
                        style={{
                          padding: '6px 4px',
                          fontSize: '0.8rem',
                          borderRadius: '4px',
                          border: '1px solid',
                          borderColor: facultyFormData.employment_type === type ? activeBorder : '#e5e7eb',
                          backgroundColor: facultyFormData.employment_type === type ? activeColor : 'white',
                          color: facultyFormData.employment_type === type ? 'white' : '#374151',
                          cursor: 'pointer'
                        }}
                      >
                        {type === 'vsl' ? 'VSL' : type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ')}
                      </button>
                    ))}
                  </div>

                  {facultyFormData.employment_type === 'vsl' && (
                    <div style={{ padding: '8px', background: '#f8fafc', borderRadius: '4px', marginBottom: '8px' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Preferred Shift</label>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="add_preferred_times"
                            checked={facultyFormData.preferred_times === 'morning'}
                            onChange={() => setFacultyFormData({ ...facultyFormData, preferred_times: 'morning' })}
                          /> Morning
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="add_preferred_times"
                            checked={facultyFormData.preferred_times === 'night'}
                            onChange={() => setFacultyFormData({ ...facultyFormData, preferred_times: 'night' })}
                          /> Night
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="add_preferred_times"
                            checked={facultyFormData.preferred_times === 'any'}
                            onChange={() => setFacultyFormData({ ...facultyFormData, preferred_times: 'any' })}
                          /> Any
                        </label>
                      </div>
                    </div>
                  )}

                  {facultyFormData.employment_type === 'part-time' && (
                    <div style={{ padding: '8px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '4px', fontSize: '0.75rem', color: '#92400e' }}>
                      Part-time faculty are restricted from Saturday classes.
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Department</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={facultyFormData.department}
                    onChange={e => setFacultyFormData({ ...facultyFormData, department: e.target.value })}
                    placeholder="e.g., Mathematics"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>College</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={facultyFormData.college}
                    onChange={e => setFacultyFormData({ ...facultyFormData, college: e.target.value })}
                    placeholder={selectedCollege?.department_name || 'College of Science'}
                  />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Phone</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={facultyFormData.phone}
                    onChange={e => setFacultyFormData({ ...facultyFormData, phone: e.target.value })}
                    placeholder="09XX-XXX-XXXX"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Office Location</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={facultyFormData.office_location}
                    onChange={e => setFacultyFormData({ ...facultyFormData, office_location: e.target.value })}
                    placeholder="Room 101, Science Building"
                  />
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnCancel} onClick={() => setShowAddFacultyModal(false)}>Cancel</button>
              <button className={styles.btnSave} onClick={handleAddNewFaculty} disabled={saving}>
                {saving ? 'Adding...' : 'Add Faculty'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className={styles.modalOverlay} onClick={() => setShowExportModal(false)}>
          <div className={`${styles.modalContent} ${styles.exportModal}`} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>📥 Export Faculty List</h3>
              <button className={styles.modalClose} onClick={() => setShowExportModal(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.exportInfo}>
                Export <strong>{facultyProfiles.length}</strong> faculty members from <strong>{selectedFile?.file_name}</strong>
              </p>

              {/* Format Selection */}
              <div className={styles.exportSection}>
                <label className={styles.exportSectionLabel}>Export Format</label>
                <div className={styles.formatButtons}>
                  <button
                    className={`${styles.formatBtn} ${exportOptions.format === 'csv' ? styles.active : ''}`}
                    onClick={() => setExportOptions({ ...exportOptions, format: 'csv' })}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                    </svg>
                    CSV
                  </button>
                  <button
                    className={`${styles.formatBtn} ${exportOptions.format === 'pdf' ? styles.active : ''}`}
                    onClick={() => setExportOptions({ ...exportOptions, format: 'pdf' })}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z" />
                    </svg>
                    PDF
                  </button>
                  <button
                    className={`${styles.formatBtn} ${exportOptions.format === 'png' ? styles.active : ''}`}
                    onClick={() => setExportOptions({ ...exportOptions, format: 'png' })}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                    </svg>
                    PNG
                  </button>
                </div>
              </div>

              {/* Export Options */}
              <div className={styles.exportSection}>
                <label className={styles.exportSectionLabel}>Include in Export</label>
                <div className={styles.exportCheckboxes}>
                  <label className={styles.exportCheckbox}>
                    <input
                      type="checkbox"
                      checked={exportOptions.onlyNames}
                      onChange={e => setExportOptions({
                        ...exportOptions,
                        onlyNames: e.target.checked,
                        includeId: e.target.checked ? false : exportOptions.includeId,
                        includeType: e.target.checked ? false : exportOptions.includeType
                      })}
                    />
                    <span>Only Names (minimal export)</span>
                  </label>
                  <label className={`${styles.exportCheckbox} ${exportOptions.onlyNames ? styles.disabled : ''}`}>
                    <input
                      type="checkbox"
                      checked={exportOptions.includeId}
                      onChange={e => setExportOptions({ ...exportOptions, includeId: e.target.checked })}
                      disabled={exportOptions.onlyNames}
                    />
                    <span>Include Faculty ID</span>
                  </label>
                  <label className={`${styles.exportCheckbox} ${exportOptions.onlyNames ? styles.disabled : ''}`}>
                    <input
                      type="checkbox"
                      checked={exportOptions.includeType}
                      onChange={e => setExportOptions({ ...exportOptions, includeType: e.target.checked })}
                      disabled={exportOptions.onlyNames}
                    />
                    <span>Include Employment Type</span>
                  </label>
                  <label className={styles.exportCheckbox}>
                    <input
                      type="checkbox"
                      checked={exportOptions.sortByDepartment}
                      onChange={e => setExportOptions({ ...exportOptions, sortByDepartment: e.target.checked })}
                    />
                    <span>Group by Department (alphabetically)</span>
                  </label>
                </div>
              </div>

              {/* Preview for PDF/PNG */}
              {(exportOptions.format === 'pdf' || exportOptions.format === 'png') && (
                <div className={styles.exportSection}>
                  <label className={styles.exportSectionLabel}>Preview (Black & White)</label>
                  <div className={styles.exportPreviewWrapper}>
                    <div id="export-preview-content" className={styles.exportPreviewContent}>
                      <div className={styles.exportPreviewHeader}>
                        <h2>{selectedFile?.file_name || 'Faculty List'}</h2>
                        <p>{selectedCollege?.department_name} • {new Date().toLocaleDateString()}</p>
                      </div>
                      <div className={styles.exportPreviewBody}>
                        {getSortedFacultyForExport().slice(0, 15).map((f, idx, arr) => {
                          const prevDept = idx > 0 ? arr[idx - 1].department : null
                          const showDeptHeader = exportOptions.sortByDepartment && f.department !== prevDept
                          return (
                            <React.Fragment key={f.id}>
                              {showDeptHeader && (
                                <div className={styles.exportDeptHeader}>
                                  {f.department || 'No Department'}
                                </div>
                              )}
                              <div className={styles.exportPreviewRow}>
                                <span className={styles.exportRowNum}>{idx + 1}.</span>
                                <span className={styles.exportRowName}>{f.full_name}</span>
                                {!exportOptions.onlyNames && exportOptions.includeId && (
                                  <span className={styles.exportRowId}>{f.faculty_id}</span>
                                )}
                                {!exportOptions.onlyNames && exportOptions.includeType && (
                                  <span className={styles.exportRowType}>{f.employment_type}</span>
                                )}
                              </div>
                            </React.Fragment>
                          )
                        })}
                        {facultyProfiles.length > 15 && (
                          <div className={styles.exportPreviewMore}>
                            ... and {facultyProfiles.length - 15} more faculty members
                          </div>
                        )}
                      </div>
                      <div className={styles.exportPreviewFooter}>
                        Total: {facultyProfiles.length} faculty members
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnCancel} onClick={() => setShowExportModal(false)}>Cancel</button>
              <button className={styles.btnSave} onClick={handleExport} disabled={exporting}>
                {exporting ? 'Exporting...' : `Export as ${exportOptions.format.toUpperCase()}`}
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
  return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Faculty Colleges...</div>
}

// Main export wrapped in Suspense
export default function FacultyCollegesPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <FacultyCollegesContent />
    </Suspense>
  )
}

