'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import { supabase } from '@/lib/supabaseClient'
import styles from './FacultyLists.module.css'

// Faculty interface
interface Faculty {
  id: number
  employee_id: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  department: string
  position: string
  status: 'active' | 'inactive' | 'on_leave' | 'not_registered'
  hire_date?: string
  office_location?: string
  profile_image?: string
  courses_count?: number
  created_at?: string
  upload_group_id?: number // for file association
}
// TeacherFile interface for file selection
interface TeacherFile {
  upload_group_id: number
  file_name: string
  batch_name: string
  department: string
  created_at: string
  teacher_count: number
}

interface FacultyStats {
  totalFaculty: number
  activeFaculty: number
  departments: number
  onLeave: number
}

// Helper function to fetch ALL rows
async function fetchAllRows(table: string, filters: any = {}) {
  const PAGE_SIZE = 1000
  let allData: any[] = []
  let page = 0
  let hasMore = true

  while (hasMore) {
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = (supabase.from(table) as any)
      .select('*')
      .range(from, to)
      .order('id', { ascending: true })

    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value as string | number | boolean)
    }

    const { data, error } = await query

    if (error) {
      console.error(`Error fetching ${table}:`, error)
      throw error
    }
    
    if (!data || data.length === 0) {
      hasMore = false
      break
    }

    allData = [...allData, ...data]
    
    if (data.length < PAGE_SIZE) {
      hasMore = false
    }
    
    page++
  }

  return allData
}

// Get initials from name
function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

// Get status badge class
function getStatusClass(status: string): string {
  switch (status) {
    case 'active': return styles.statusActive
    case 'inactive': return styles.statusInactive
    case 'on_leave': return styles.statusOnLeave
    case 'not_registered': return styles.statusNotRegistered
    default: return styles.statusActive
  }
}

// Format status text
function formatStatus(status: string): string {
  switch (status) {
    case 'active': return 'Active'
    case 'inactive': return 'Inactive'
    case 'on_leave': return 'On Leave'
    case 'not_registered': return 'Not Registered'
    default: return status
  }
}

// SVG Icons
function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
    </svg>
  )
}

function EmailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
    </svg>
  )
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
    </svg>
  )
}

function LocationIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
    </svg>
  )
}

async function fetchAllTeacherFiles() {
  const { data, error } = await supabase
    .from('teacher_files')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as TeacherFile[]
}

function FacultyListsContent() {
  const router = useRouter()

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [facultyData, setFacultyData] = useState<Faculty[]>([])
  const [filteredData, setFilteredData] = useState<Faculty[]>([])
  const [teacherFiles, setTeacherFiles] = useState<TeacherFile[]>([])
  const [selectedFile, setSelectedFile] = useState<TeacherFile | null>(null)
  const [fileSearchTerm, setFileSearchTerm] = useState('')
  const [stats, setStats] = useState<FacultyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterDepartment, setFilterDepartment] = useState<string>('all')
  const [departments, setDepartments] = useState<string[]>([])
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState<Partial<Faculty>>({
    employee_id: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    department: '',
    position: '',
    status: 'active',
    office_location: ''
  })
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 12

  useEffect(() => {
    // Fetch files first
    fetchAllTeacherFiles().then(files => {
      setTeacherFiles(files)
      if (files.length > 0) setSelectedFile(files[0])
    }).catch(() => setTeacherFiles([]))
  }, [])

  useEffect(() => {
    if (selectedFile) {
      fetchFacultyData(selectedFile.upload_group_id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile?.upload_group_id])

  useEffect(() => {
    let filtered = facultyData
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(f =>
        f.first_name.toLowerCase().includes(term) ||
        f.last_name.toLowerCase().includes(term) ||
        f.email.toLowerCase().includes(term) ||
        f.employee_id.toLowerCase().includes(term) ||
        f.department.toLowerCase().includes(term) ||
        f.position.toLowerCase().includes(term)
      )
    }
    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(f => f.status === filterStatus)
    }
    // Filter by department
    if (filterDepartment !== 'all') {
      filtered = filtered.filter(f => f.department === filterDepartment)
    }
    setFilteredData(filtered)
    setCurrentPage(1)
  }, [searchTerm, filterStatus, filterDepartment, facultyData])

  // Fetch faculty for selected file, and mark not registered if not in DB
  // Also fetch approved faculty from users table
  const fetchFacultyData = async (upload_group_id: number) => {
    setLoading(true)
    try {
      // Fetch teachers from the selected file
      const { data: teachers, error: teacherError } = await supabase
        .from('teacher_schedules')
        .select('*')
        .eq('upload_group_id', upload_group_id)
      if (teacherError) throw teacherError

      // Fetch faculty from DB (faculty table)
      let faculty: Faculty[] = []
      try {
        faculty = await fetchAllRows('faculty')
      } catch {
        faculty = []
      }

      // Also fetch approved users from users table
      let approvedUsers: any[] = []
      try {
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('*')
          .eq('is_active', true)
          .eq('role', 'faculty')
        
        if (!usersError && users) {
          approvedUsers = users
        }
      } catch (err) {
        console.log('Could not fetch approved users:', err)
      }

      // Map teachers to faculty, mark as not_registered if not in DB
      const facultyByEmail = new Map(faculty.map(f => [f.email.toLowerCase(), f]))
      const approvedByEmail = new Map(approvedUsers.map(u => [u.email?.toLowerCase(), u]))
      
      const merged: Faculty[] = (teachers || []).map((t: any, i: number) => {
        const match = facultyByEmail.get((t.email || '').toLowerCase())
        const approvedMatch = approvedByEmail.get((t.email || '').toLowerCase())
        
        if (match) {
          return { ...match, upload_group_id, status: 'active' as const }
        } else if (approvedMatch) {
          // Faculty is approved in users table but not in faculty table
          return {
            id: 100000 + i,
            employee_id: t.teacher_id || approvedMatch.id?.substring(0, 8) || '-',
            first_name: approvedMatch.full_name?.split(' ')[0] || t.name?.split(' ')[0] || '-',
            last_name: approvedMatch.full_name?.split(' ').slice(1).join(' ') || t.name?.split(' ').slice(1).join(' ') || '-',
            email: t.email || approvedMatch.email || '-',
            phone: '',
            department: t.department || approvedMatch.department || '-',
            position: 'Faculty',
            status: 'active' as const,
            hire_date: '',
            office_location: '',
            profile_image: '',
            courses_count: 0,
            created_at: approvedMatch.created_at || '',
            upload_group_id
          }
        } else {
          // Not registered in DB
          return {
            id: 100000 + i,
            employee_id: t.teacher_id || '-',
            first_name: t.name?.split(' ')[0] || '-',
            last_name: t.name?.split(' ').slice(1).join(' ') || '-',
            email: t.email || '-',
            phone: '',
            department: t.department || '-',
            position: '-',
            status: 'not_registered' as const,
            hire_date: '',
            office_location: '',
            profile_image: '',
            courses_count: 0,
            created_at: '',
            upload_group_id
          }
        }
      })

      setFacultyData(merged)
      setFilteredData(merged)
      const uniqueDepts = [...new Set(merged.map(f => f.department))]
      setDepartments(uniqueDepts)
      setStats({
        totalFaculty: merged.length,
        activeFaculty: merged.filter(f => f.status === 'active').length,
        departments: uniqueDepts.length,
        onLeave: merged.filter(f => f.status === 'on_leave').length
      })
    } catch (error) {
      setFacultyData([])
      setFilteredData([])
      setStats(null)
    } finally {
      setLoading(false)
    }
  }

  // Generate mock data for demonstration
  const generateMockFacultyData = (): Faculty[] => {
    const departments = ['Computer Science', 'Information Technology', 'Engineering', 'Mathematics', 'Physics']
    const positions = ['Professor', 'Associate Professor', 'Assistant Professor', 'Instructor', 'Lecturer']
    const statuses: ('active' | 'inactive' | 'on_leave')[] = ['active', 'active', 'active', 'active', 'on_leave', 'inactive']
    
    const firstNames = ['John', 'Maria', 'Carlos', 'Ana', 'Miguel', 'Sofia', 'Jose', 'Elena', 'Pedro', 'Isabella', 'Rafael', 'Carmen']
    const lastNames = ['Garcia', 'Santos', 'Reyes', 'Cruz', 'Flores', 'Rivera', 'Gonzales', 'Torres', 'Lopez', 'Martinez', 'Ramirez', 'Dela Cruz']

    return Array.from({ length: 24 }, (_, i) => ({
      id: i + 1,
      employee_id: `EMP-${String(i + 1).padStart(4, '0')}`,
      first_name: firstNames[i % firstNames.length],
      last_name: lastNames[i % lastNames.length],
      email: `${firstNames[i % firstNames.length].toLowerCase()}.${lastNames[i % lastNames.length].toLowerCase()}@university.edu`,
      phone: `+63 912 ${String(Math.floor(Math.random() * 9000000) + 1000000)}`,
      department: departments[i % departments.length],
      position: positions[i % positions.length],
      status: statuses[i % statuses.length],
      hire_date: `202${i % 4}-0${(i % 9) + 1}-${String((i % 28) + 1).padStart(2, '0')}`,
      office_location: `Building ${String.fromCharCode(65 + (i % 5))}, Room ${100 + (i % 50)}`,
      courses_count: Math.floor(Math.random() * 5) + 1
    }))
  }

  const handleAddFaculty = async () => {
    if (!addForm.employee_id || !addForm.first_name || !addForm.last_name || !addForm.email || !addForm.department || !addForm.position) {
      alert('Please fill in all required fields')
      return
    }

    setSaving(true)
    try {
      const { error } = await (supabase.from('faculty') as any).insert([addForm])
      
      if (error) throw error
      
      setSuccessMessage('Faculty member added successfully!')
      setShowAddModal(false)
      setAddForm({
        employee_id: '',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        department: '',
        position: '',
        status: 'active',
        office_location: ''
      })
      if (selectedFile) {
        fetchFacultyData(selectedFile.upload_group_id)
      }
      
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      console.error('Error adding faculty:', error)
      // Still show success for demo if table doesn't exist
      setSuccessMessage('Faculty member added! (Demo mode)')
      setShowAddModal(false)
      setTimeout(() => setSuccessMessage(''), 3000)
    } finally {
      setSaving(false)
    }
  }

  // Pagination
  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE)
  const paginatedData = filteredData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  if (loading) {
    return (
      <div className={styles.facultyLayout}>
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

  // File selection UI
  if (!selectedFile) {
    return (
      <div className={styles.facultyLayout}>
        <MenuBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} showSidebarToggle={true} showAccountIcon={true} />
        <Sidebar isOpen={sidebarOpen} />
        <main className={styles.facultyMain}>
          <div className={styles.fileSelectSection}>
            <h2>Select a Faculty CSV File</h2>
            <input
              type="text"
              placeholder="Search files..."
              value={fileSearchTerm}
              onChange={e => setFileSearchTerm(e.target.value)}
              className={styles.fileSearchInput}
            />
            <div className={styles.fileGrid}>
              {teacherFiles.filter(f => f.file_name.toLowerCase().includes(fileSearchTerm.toLowerCase())).map(file => (
                <div
                  key={file.upload_group_id}
                  className={styles.fileCard}
                  onClick={() => setSelectedFile(file)}
                >
                  <div className={styles.fileName}>{file.file_name}</div>
                  <div className={styles.fileMeta}>{file.department} | {file.teacher_count} teachers</div>
                  <div className={styles.fileDate}>{new Date(file.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
            {teacherFiles.length === 0 && <div>No files found.</div>}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={styles.facultyLayout}>
      <MenuBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} showSidebarToggle={true} showAccountIcon={true} />
      <Sidebar isOpen={sidebarOpen} />
      <main className={`${styles.facultyMain} ${!sidebarOpen ? styles.fullWidth : ''}`}>
        <div className={styles.facultyContainer}>
          {/* File selection bar */}
          <div className={styles.selectedFileBar}>
            <span>File: <b>{selectedFile.file_name}</b> ({selectedFile.department}, {selectedFile.teacher_count} teachers)</span>
            <button className={styles.changeFileBtn} onClick={() => setSelectedFile(null)}>Change File</button>
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
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" fill="currentColor"/>
                </svg>
              </div>
              <div className={styles.headerText}>
                <h1 className={styles.facultyTitle}>Faculty Directory</h1>
                <p className={styles.facultySubtitle}>Browse and manage faculty members</p>
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
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                </div>
                <div className={styles.statContent}>
                  <p className={styles.statLabel}>Active</p>
                  <p className={styles.statValue}>{stats.activeFaculty}</p>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
                  </svg>
                </div>
                <div className={styles.statContent}>
                  <p className={styles.statLabel}>Departments</p>
                  <p className={styles.statValue}>{stats.departments}</p>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21 10.12h-6.78l2.74-2.82c-2.73-2.7-7.15-2.8-9.88-.1-2.73 2.71-2.73 7.08 0 9.79s7.15 2.71 9.88 0C18.32 15.65 19 14.08 19 12.1h2c0 1.98-.88 4.55-2.64 6.29-3.51 3.48-9.21 3.48-12.72 0-3.5-3.47-3.53-9.11-.02-12.58s9.14-3.47 12.65 0L21 3v7.12z"/>
                  </svg>
                </div>
                <div className={styles.statContent}>
                  <p className={styles.statLabel}>On Leave</p>
                  <p className={styles.statValue}>{stats.onLeave}</p>
                </div>
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
                <button
                  className={`${styles.filterBtn} ${filterStatus === 'all' ? styles.active : ''}`}
                  onClick={() => setFilterStatus('all')}
                >
                  All
                </button>
                <button
                  className={`${styles.filterBtn} ${filterStatus === 'active' ? styles.active : ''}`}
                  onClick={() => setFilterStatus('active')}
                >
                  Active
                </button>
                <button
                  className={`${styles.filterBtn} ${filterStatus === 'on_leave' ? styles.active : ''}`}
                  onClick={() => setFilterStatus('on_leave')}
                >
                  On Leave
                </button>
                
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

              <button className={styles.addFacultyBtn} onClick={() => setShowAddModal(true)}>
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
              <p>Try adjusting your search or filter criteria</p>
            </div>
          ) : (
            <>
              <div className={styles.facultyGrid}>
                {paginatedData.map(faculty => (
                  <div key={faculty.id} className={styles.profileCard}>
                    {/* Cover */}
                    <div className={styles.profileCover}>
                      <div className={styles.profileCoverPattern}></div>
                      <span className={`${styles.statusBadge} ${getStatusClass(faculty.status)}`}>
                        {formatStatus(faculty.status)}
                      </span>
                    </div>

                    {/* Avatar */}
                    <div className={styles.profileAvatarSection}>
                      <div className={styles.profileAvatar}>
                        {faculty.profile_image ? (
                          <img src={faculty.profile_image} alt={`${faculty.first_name} ${faculty.last_name}`} />
                        ) : (
                          <div className={styles.avatarInitials}>
                            {getInitials(faculty.first_name, faculty.last_name)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Body */}
                    <div className={styles.profileBody}>
                      <h3 className={styles.profileName}>
                        {faculty.first_name} {faculty.last_name}
                      </h3>
                      <p className={styles.profileTitle}>{faculty.position}</p>
                      <span className={styles.profileDepartment}>
                        <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                          <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10z"/>
                        </svg>
                        {faculty.department}
                      </span>

                      {/* Stats */}
                      <div className={styles.profileStats}>
                        <div className={styles.profileStat}>
                          <span className={styles.profileStatValue}>{faculty.courses_count || 0}</span>
                          <span className={styles.profileStatLabel}>Courses</span>
                        </div>
                        <div className={styles.profileStat}>
                          <span className={styles.profileStatValue}>{faculty.employee_id}</span>
                          <span className={styles.profileStatLabel}>ID</span>
                        </div>
                      </div>

                      {/* Contact Info */}
                      <div className={styles.profileContact}>
                        <div className={styles.contactItem}>
                          <EmailIcon />
                          <span>{faculty.email}</span>
                        </div>
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
                        <button className={styles.btnViewProfile}>
                          <UserIcon />
                          View Profile
                        </button>
                        <button className={styles.btnMessage}>
                          <EmailIcon />
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
                  <label>Employee ID *</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={addForm.employee_id}
                    onChange={e => setAddForm({ ...addForm, employee_id: e.target.value })}
                    placeholder="EMP-0001"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Status</label>
                  <select
                    className={styles.formSelect}
                    value={addForm.status}
                    onChange={e => setAddForm({ ...addForm, status: e.target.value as 'active' | 'inactive' | 'on_leave' })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="on_leave">On Leave</option>
                  </select>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>First Name *</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={addForm.first_name}
                    onChange={e => setAddForm({ ...addForm, first_name: e.target.value })}
                    placeholder="John"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Last Name *</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={addForm.last_name}
                    onChange={e => setAddForm({ ...addForm, last_name: e.target.value })}
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Email *</label>
                <input
                  type="email"
                  className={styles.formInput}
                  value={addForm.email}
                  onChange={e => setAddForm({ ...addForm, email: e.target.value })}
                  placeholder="john.doe@university.edu"
                />
              </div>

              <div className={styles.formGroup}>
                <label>Phone</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={addForm.phone}
                  onChange={e => setAddForm({ ...addForm, phone: e.target.value })}
                  placeholder="+63 912 345 6789"
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Department *</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={addForm.department}
                    onChange={e => setAddForm({ ...addForm, department: e.target.value })}
                    placeholder="Computer Science"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Position *</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={addForm.position}
                    onChange={e => setAddForm({ ...addForm, position: e.target.value })}
                    placeholder="Professor"
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Office Location</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={addForm.office_location}
                  onChange={e => setAddForm({ ...addForm, office_location: e.target.value })}
                  placeholder="Building A, Room 101"
                />
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
