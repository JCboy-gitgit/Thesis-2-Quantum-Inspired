'use client'

import { Suspense, useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import styles from './styles.module.css'
import { useColleges } from '@/app/context/CollegesContext'
import {
  FaChevronLeft,
  FaChevronRight,
  FaUser,
  FaEnvelope,
  FaCalendar,
  FaClock,
  FaBuilding,
  FaUsers,
  FaUserTie,
  FaArrowLeft,
  FaSearch,
  FaFileAlt,
  FaTimes,
  FaSpinner,
  FaCrown,
  FaStar,
  FaGraduationCap,
  FaChalkboardTeacher,
  FaTrash,
  FaUserCog,
  FaUserShield,
  FaUserGraduate,
  FaBriefcase,
  FaFilter,
  FaPhone,
  FaMapMarkerAlt
} from 'react-icons/fa'

// Interface for faculty_profiles table
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
  created_at: string
  updated_at: string
  last_login?: string | null
}

// Helper function to fetch ALL rows with pagination and join last_login from users
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
      .select('*, users(last_login)')
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

    // Map data to include last_login from joined users table
    const mappedData = data.map((item: any) => ({
      ...item,
      last_login: item.users?.last_login || null
    }))

    allData = [...allData, ...mappedData]
    if (data.length < PAGE_SIZE) hasMore = false
    page++
  }

  return allData
}

// Get initials from name
function getInitials(name: string | undefined | null): string {
  if (!name) return '?'
  const parts = name.split(/[,\s]+/).filter(p => p.length > 0)
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

// Role hierarchy order (for sorting)
const ROLE_ORDER: Record<string, number> = {
  'administrator': 1,
  'department_head': 2,
  'program_chair': 3,
  'coordinator': 4,
  'faculty': 5,
  'staff': 6
}

// Position priority for sorting within roles (lower = higher priority)
function getPositionPriority(position: string | null | undefined): number {
  if (!position) return 99
  const pos = position.toLowerCase().trim()

  // Dean positions - higher priority
  if (pos === 'dean' || pos.match(/^dean$/i)) return 1
  if (pos.includes('dean') && !pos.includes('associate') && !pos.includes('assistant')) return 2

  // Associate Dean - second priority
  if (pos.includes('associate dean')) return 3

  // Assistant Dean - third priority
  if (pos.includes('assistant dean')) return 4

  // Other positions
  return 10
}

// Get role display info with icons and colors
function getRoleInfo(role: string) {
  switch (role) {
    case 'administrator':
      return {
        icon: <FaCrown />,
        label: 'Administrator / Dean',
        color: '#f59e0b',
        bgColor: 'rgba(245, 158, 11, 0.15)',
        description: 'College/University Administration'
      }
    case 'department_head':
      return {
        icon: <FaUserShield />,
        label: 'Department Head',
        color: '#8b5cf6',
        bgColor: 'rgba(139, 92, 246, 0.15)',
        description: 'Department Leadership'
      }
    case 'program_chair':
      return {
        icon: <FaStar />,
        label: 'Program Chair',
        color: '#ec4899',
        bgColor: 'rgba(236, 72, 153, 0.15)',
        description: 'Program Management'
      }
    case 'coordinator':
      return {
        icon: <FaUserCog />,
        label: 'Coordinator',
        color: '#06b6d4',
        bgColor: 'rgba(6, 182, 212, 0.15)',
        description: 'Program/Area Coordination'
      }
    case 'staff':
      return {
        icon: <FaBriefcase />,
        label: 'Staff',
        color: '#64748b',
        bgColor: 'rgba(100, 116, 139, 0.15)',
        description: 'Administrative Staff'
      }
    default: // faculty
      return {
        icon: <FaChalkboardTeacher />,
        label: 'Faculty Member',
        color: '#22c55e',
        bgColor: 'rgba(34, 197, 94, 0.15)',
        description: 'Teaching Faculty'
      }
  }
}

// Get employment type badge
function getEmploymentBadge(type: string) {
  switch (type) {
    case 'full-time':
      return { label: 'Full-Time', color: '#22c55e' }
    case 'part-time':
      return { label: 'Part-Time', color: '#f59e0b' }
    case 'adjunct':
      return { label: 'Adjunct', color: '#8b5cf6' }
    case 'guest':
      return { label: 'Guest', color: '#06b6d4' }
    default:
      return { label: type, color: '#64748b' }
  }
}

// Get online status based on last_login timestamp
function getOnlineStatus(lastLogin: string | null | undefined) {
  if (!lastLogin) return { isOnline: false, label: 'Offline', color: '#64748b' }
  
  const lastLoginDate = new Date(lastLogin)
  const now = new Date()
  const minutesAgo = (now.getTime() - lastLoginDate.getTime()) / (1000 * 60)
  
  if (minutesAgo < 5) {
    return { isOnline: true, label: 'Online', color: '#22c55e' }
  } else if (minutesAgo < 30) {
    return { isOnline: false, label: 'Away', color: '#f59e0b' }
  } else {
    return { isOnline: false, label: 'Offline', color: '#64748b' }
  }
}

function FacultyProfilesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const collegeFilter = searchParams.get('college')
  const { activeColleges: bulsuColleges } = useColleges()

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Faculty data state
  const [allFaculty, setAllFaculty] = useState<FacultyProfile[]>([])
  const [filteredFaculty, setFilteredFaculty] = useState<FacultyProfile[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCollege, setSelectedCollege] = useState<string>(collegeFilter || '')
  const [selectedDepartment, setSelectedDepartment] = useState<string>('')
  const [selectedRole, setSelectedRole] = useState<string>('')
  const [selectedEmploymentType, setSelectedEmploymentType] = useState<string>('')

  // Available filter options
  const [colleges, setColleges] = useState<string[]>([])
  const [departments, setDepartments] = useState<string[]>([])

  // Carousel/Selection state
  const [selectedProfile, setSelectedProfile] = useState<FacultyProfile | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const carouselRef = useRef<HTMLDivElement>(null)

  // Fetch faculty profiles on mount
  useEffect(() => {
    checkAuth()
    fetchFacultyProfiles()
  }, [])

  // Apply filters when data or filter values change
  useEffect(() => {
    applyFilters()
  }, [allFaculty, searchTerm, selectedCollege, selectedDepartment, selectedRole, selectedEmploymentType])

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

  const fetchFacultyProfiles = async () => {
    setLoading(true)
    try {
      const data = await fetchAllRows('faculty_profiles')

      // Sort by role hierarchy, then by position priority, then by name
      data.sort((a, b) => {
        const roleCompare = (ROLE_ORDER[a.role] || 99) - (ROLE_ORDER[b.role] || 99)
        if (roleCompare !== 0) return roleCompare

        // Within the same role, sort by position priority (Dean before Associate Dean, etc.)
        const positionCompare = getPositionPriority(a.position) - getPositionPriority(b.position)
        if (positionCompare !== 0) return positionCompare

        return (a.full_name || '').localeCompare(b.full_name || '')
      })

      setAllFaculty(data)

      // Extract unique colleges and departments for filters
      const uniqueColleges = [...new Set(data.map(f => f.college).filter(Boolean))] as string[]
      const uniqueDepartments = [...new Set(data.map(f => f.department).filter(Boolean))] as string[]
      setColleges(uniqueColleges.sort())
      setDepartments(uniqueDepartments.sort())

      // Auto-select first profile
      if (data.length > 0) {
        setSelectedProfile(data[0])
      }
    } catch (error) {
      console.error('Error fetching faculty profiles:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...allFaculty]

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

    // College filter
    if (selectedCollege) {
      filtered = filtered.filter(f => f.college === selectedCollege)
    }

    // Department filter
    if (selectedDepartment) {
      filtered = filtered.filter(f => f.department === selectedDepartment)
    }

    // Role filter
    if (selectedRole) {
      filtered = filtered.filter(f => f.role === selectedRole)
    }

    // Employment type filter
    if (selectedEmploymentType) {
      filtered = filtered.filter(f => f.employment_type === selectedEmploymentType)
    }

    setFilteredFaculty(filtered)
    setCurrentIndex(0)

    // Update selected profile
    if (filtered.length > 0 && (!selectedProfile || !filtered.find(f => f.id === selectedProfile.id))) {
      setSelectedProfile(filtered[0])
    }
  }

  const handleSelectProfile = (profile: FacultyProfile) => {
    setSelectedProfile(profile)
    const index = filteredFaculty.findIndex(f => f.id === profile.id)
    if (index !== -1) {
      setCurrentIndex(index)
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setSelectedProfile(filteredFaculty[currentIndex - 1])
    }
  }

  const handleNext = () => {
    if (currentIndex < filteredFaculty.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setSelectedProfile(filteredFaculty[currentIndex + 1])
    }
  }

  const handleDeleteProfile = async (profile: FacultyProfile) => {
    if (!confirm(`Are you sure you want to delete "${profile.full_name}"?\n\nThis action cannot be undone.`)) {
      return
    }

    setDeleting(profile.id)

    try {
      // Archive before deleting
      try {
        const { data: { user } } = await supabase.auth.getUser()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('archived_items')
          .insert({
            item_type: 'faculty',
            item_name: profile.full_name,
            item_data: profile,
            deleted_by: user?.id || null,
            original_table: 'faculty_profiles',
            original_id: profile.id
          })
      } catch (archiveError) {
        console.warn('Could not archive profile:', archiveError)
      }

      // Delete from faculty_profiles
      const { data, error } = await supabase
        .from('faculty_profiles')
        .delete()
        .eq('id', profile.id)
        .select()

      if (error) throw error
      
      // Check if any rows were actually deleted (RLS may block silently)
      if (!data || data.length === 0) {
        throw new Error('Delete failed - no rows affected. Please run database/QUICK_FIX_RLS.sql in Supabase to fix permissions.')
      }

      // Update local state
      setAllFaculty(prev => prev.filter(f => f.id !== profile.id))

      router.refresh() // Force refresh cached data
      alert(`"${profile.full_name}" deleted successfully`)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error deleting profile:', error)
      alert(`Failed to delete profile: ${errorMessage}`)
    } finally {
      setDeleting(null)
    }
  }

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedCollege('')
    setSelectedDepartment('')
    setSelectedRole('')
    setSelectedEmploymentType('')
  }

  // Group faculty by role for hierarchy display
  const administrators = filteredFaculty.filter(f => f.role === 'administrator')
  const departmentHeads = filteredFaculty.filter(f => f.role === 'department_head')
  const programChairs = filteredFaculty.filter(f => f.role === 'program_chair')
  const coordinators = filteredFaculty.filter(f => f.role === 'coordinator')
  const facultyMembers = filteredFaculty.filter(f => f.role === 'faculty')
  const staffMembers = filteredFaculty.filter(f => f.role === 'staff')

  return (
    <div className={styles.layout} data-page="admin">
      <MenuBar
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        showSidebarToggle={true}
        setSidebarOpen={setSidebarOpen}
      />
      <Sidebar isOpen={sidebarOpen} />

      <main className={`${styles.main} ${!sidebarOpen ? styles.fullWidth : ''}`}>
        <div className={styles.container}>
          {/* Header */}
          <div className={styles.header}>
            <button
              className={styles.backButton}
              onClick={() => router.back()}
            >
              <FaArrowLeft /> Back
            </button>
            <h1 className={styles.title}>
              <FaUserTie className={styles.titleIcon} />
              Faculty Profiles
            </h1>
            <div className={styles.headerStats}>
              <span className={styles.statBadge}>
                <FaUsers /> {allFaculty.length} Total Faculty
              </span>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className={styles.loadingState}>
              <FaSpinner className={styles.spinner} />
              <p>Loading faculty profiles...</p>
            </div>
          )}

          {!loading && (
            <>
              {/* Filters Section */}
              <div className={styles.filtersSection}>
                {/* Search Bar */}
                <div className={styles.searchBar}>
                  <FaSearch className={styles.searchIcon} />
                  <input
                    type="text"
                    placeholder="Search by name, ID, email, position..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={styles.searchInput}
                  />
                  {searchTerm && (
                    <button className={styles.clearButton} onClick={() => setSearchTerm('')}>
                      <FaTimes />
                    </button>
                  )}
                </div>

                {/* Filter Dropdowns */}
                <div className={styles.filterRow}>
                  <div className={styles.filterGroup}>
                    <label><FaBuilding /> College</label>
                    <select
                      value={selectedCollege}
                      onChange={(e) => setSelectedCollege(e.target.value)}
                      className={styles.filterSelect}
                    >
                      <option value="">All Colleges</option>
                      {bulsuColleges.map(c => (
                        <option key={c.code} value={c.name}>{c.name}</option>
                      ))}
                      {colleges.filter(c => !bulsuColleges.some(bc => bc.name === c)).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.filterGroup}>
                    <label><FaUsers /> Department</label>
                    <select
                      value={selectedDepartment}
                      onChange={(e) => setSelectedDepartment(e.target.value)}
                      className={styles.filterSelect}
                    >
                      <option value="">All Departments</option>
                      {departments.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.filterGroup}>
                    <label><FaUserTie /> Role</label>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      className={styles.filterSelect}
                    >
                      <option value="">All Roles</option>
                      <option value="administrator">Administrator/Dean</option>
                      <option value="department_head">Department Head</option>
                      <option value="program_chair">Program Chair</option>
                      <option value="coordinator">Coordinator</option>
                      <option value="faculty">Faculty</option>
                      <option value="staff">Staff</option>
                    </select>
                  </div>

                  <div className={styles.filterGroup}>
                    <label><FaBriefcase /> Employment</label>
                    <select
                      value={selectedEmploymentType}
                      onChange={(e) => setSelectedEmploymentType(e.target.value)}
                      className={styles.filterSelect}
                    >
                      <option value="">All Types</option>
                      <option value="full-time">Full-Time</option>
                      <option value="part-time">Part-Time</option>
                      <option value="adjunct">Adjunct</option>
                      <option value="guest">Guest</option>
                    </select>
                  </div>

                  {(searchTerm || selectedCollege || selectedDepartment || selectedRole || selectedEmploymentType) && (
                    <button className={styles.clearFiltersButton} onClick={clearFilters}>
                      <FaTimes /> Clear Filters
                    </button>
                  )}
                </div>

                <div className={styles.resultCount}>
                  Showing {filteredFaculty.length} of {allFaculty.length} faculty profiles
                </div>
              </div>

              {/* Empty State */}
              {filteredFaculty.length === 0 ? (
                <div className={styles.emptyState}>
                  <FaUsers className={styles.emptyIcon} />
                  <h3>No Faculty Profiles Found</h3>
                  <p>
                    {allFaculty.length === 0
                      ? 'Upload faculty profiles from the Upload CSV page to get started.'
                      : 'No profiles match your current filters. Try adjusting your search criteria.'}
                  </p>
                  {allFaculty.length === 0 && (
                    <button
                      className={styles.uploadButton}
                      onClick={() => router.push('/LandingPages/UploadCSV')}
                    >
                      <FaFileAlt /> Go to Upload CSV
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Pyramid Hierarchy Display */}
                  <div className={styles.pyramidSection}>
                    <h2 className={styles.pyramidTitle}>
                      <FaCrown /> Organizational Hierarchy
                    </h2>

                    {/* Administrator Level (Top) */}
                    {administrators.length > 0 && (
                      <div className={styles.pyramidLevel}>
                        <div className={styles.levelLabel} style={{ color: getRoleInfo('administrator').color }}>
                          {getRoleInfo('administrator').icon} Administrators / Deans ({administrators.length})
                        </div>
                        <div className={styles.levelCards} style={{ justifyContent: 'center' }}>
                          {administrators.map((profile) => {
                            const onlineStatus = getOnlineStatus(profile.last_login)
                            return (
                              <div
                                key={profile.id}
                                className={`${styles.pyramidCard} ${styles.adminCard} ${selectedProfile?.id === profile.id ? styles.selected : ''}`}
                                onClick={() => handleSelectProfile(profile)}
                              >
                                <div style={{ position: 'relative', width: '100%' }}>
                                  <div className={styles.pyramidAvatar} style={{ backgroundColor: getRoleInfo(profile.role).bgColor, borderColor: getRoleInfo(profile.role).color, overflow: 'hidden' }}>
                                    {profile.profile_image ? (
                                      <img src={profile.profile_image} alt={profile.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                      getInitials(profile.full_name)
                                    )}
                                  </div>
                                  <div style={{
                                    position: 'absolute',
                                    bottom: 4,
                                    right: 4,
                                    width: 12,
                                    height: 12,
                                    borderRadius: '50%',
                                    backgroundColor: onlineStatus.color,
                                    border: '2px solid white',
                                    boxShadow: `0 0 4px ${onlineStatus.color}`
                                  }} title={onlineStatus.label} />
                                </div>
                                <div className={styles.pyramidName}>{profile.full_name}</div>
                                <div className={styles.pyramidPosition}>{profile.position}</div>
                                <div className={styles.pyramidId}>{profile.department || profile.college}</div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Department Heads Level */}
                    {departmentHeads.length > 0 && (
                      <div className={styles.pyramidLevel}>
                        <div className={styles.levelLabel} style={{ color: getRoleInfo('department_head').color }}>
                          {getRoleInfo('department_head').icon} Department Heads ({departmentHeads.length})
                        </div>
                        <div className={styles.levelCards}>
                          {departmentHeads.map((profile) => {
                            const onlineStatus = getOnlineStatus(profile.last_login)
                            return (
                              <div
                                key={profile.id}
                                className={`${styles.pyramidCard} ${styles.headCard} ${selectedProfile?.id === profile.id ? styles.selected : ''}`}
                                onClick={() => handleSelectProfile(profile)}
                              >
                                <div style={{ position: 'relative', width: '100%' }}>
                                  <div className={styles.pyramidAvatar} style={{ backgroundColor: getRoleInfo(profile.role).bgColor, borderColor: getRoleInfo(profile.role).color, overflow: 'hidden' }}>
                                    {profile.profile_image ? (
                                      <img src={profile.profile_image} alt={profile.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                      getInitials(profile.full_name)
                                    )}
                                  </div>
                                  <div style={{
                                    position: 'absolute',
                                    bottom: 4,
                                    right: 4,
                                    width: 12,
                                    height: 12,
                                    borderRadius: '50%',
                                    backgroundColor: onlineStatus.color,
                                    border: '2px solid white',
                                    boxShadow: `0 0 4px ${onlineStatus.color}`
                                  }} title={onlineStatus.label} />
                                </div>
                                <div className={styles.pyramidName}>{profile.full_name}</div>
                                <div className={styles.pyramidPosition}>{profile.position}</div>
                                <div className={styles.pyramidId}>{profile.department}</div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Program Chairs Level */}
                    {programChairs.length > 0 && (
                      <div className={styles.pyramidLevel}>
                        <div className={styles.levelLabel} style={{ color: getRoleInfo('program_chair').color }}>
                          {getRoleInfo('program_chair').icon} Program Chairs ({programChairs.length})
                        </div>
                        <div className={styles.levelCards}>
                          {programChairs.map((profile) => {
                            const onlineStatus = getOnlineStatus(profile.last_login)
                            return (
                              <div
                                key={profile.id}
                                className={`${styles.pyramidCard} ${styles.chairCard} ${selectedProfile?.id === profile.id ? styles.selected : ''}`}
                                onClick={() => handleSelectProfile(profile)}
                              >
                                <div style={{ position: 'relative', width: '100%' }}>
                                  <div className={styles.pyramidAvatar} style={{ backgroundColor: getRoleInfo(profile.role).bgColor, borderColor: getRoleInfo(profile.role).color, overflow: 'hidden' }}>
                                    {profile.profile_image ? (
                                      <img src={profile.profile_image} alt={profile.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                      getInitials(profile.full_name)
                                    )}
                                  </div>
                                  <div style={{
                                    position: 'absolute',
                                    bottom: 4,
                                    right: 4,
                                    width: 12,
                                    height: 12,
                                    borderRadius: '50%',
                                    backgroundColor: onlineStatus.color,
                                    border: '2px solid white',
                                    boxShadow: `0 0 4px ${onlineStatus.color}`
                                  }} title={onlineStatus.label} />
                                </div>
                                <div className={styles.pyramidName}>{profile.full_name}</div>
                                <div className={styles.pyramidPosition}>{profile.position}</div>
                                <div className={styles.pyramidId}>{profile.department}</div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Coordinators Level */}
                    {coordinators.length > 0 && (
                      <div className={styles.pyramidLevel}>
                        <div className={styles.levelLabel} style={{ color: getRoleInfo('coordinator').color }}>
                          {getRoleInfo('coordinator').icon} Coordinators ({coordinators.length})
                        </div>
                        <div className={styles.levelCards}>
                          {coordinators.map((profile) => {
                            const onlineStatus = getOnlineStatus(profile.last_login)
                            return (
                              <div
                                key={profile.id}
                                className={`${styles.pyramidCard} ${styles.coordinatorCard} ${selectedProfile?.id === profile.id ? styles.selected : ''}`}
                                onClick={() => handleSelectProfile(profile)}
                              >
                                <div style={{ position: 'relative', width: '100%' }}>
                                  <div className={styles.pyramidAvatar} style={{ backgroundColor: getRoleInfo(profile.role).bgColor, borderColor: getRoleInfo(profile.role).color, overflow: 'hidden' }}>
                                    {profile.profile_image ? (
                                      <img src={profile.profile_image} alt={profile.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                      getInitials(profile.full_name)
                                    )}
                                  </div>
                                  <div style={{
                                    position: 'absolute',
                                    bottom: 4,
                                    right: 4,
                                    width: 12,
                                    height: 12,
                                    borderRadius: '50%',
                                    backgroundColor: onlineStatus.color,
                                    border: '2px solid white',
                                    boxShadow: `0 0 4px ${onlineStatus.color}`
                                  }} title={onlineStatus.label} />
                                </div>
                                <div className={styles.pyramidName}>{profile.full_name}</div>
                                <div className={styles.pyramidPosition}>{profile.position}</div>
                                <div className={styles.pyramidId}>{profile.department}</div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Faculty Members Level */}
                    {facultyMembers.length > 0 && (
                      <div className={styles.pyramidLevel}>
                        <div className={styles.levelLabel} style={{ color: getRoleInfo('faculty').color }}>
                          {getRoleInfo('faculty').icon} Faculty Members ({facultyMembers.length})
                        </div>
                        <div className={styles.levelCards}>
                          {facultyMembers.slice(0, 12).map((profile) => {
                            const onlineStatus = getOnlineStatus(profile.last_login)
                            return (
                              <div
                                key={profile.id}
                                className={`${styles.pyramidCard} ${styles.facultyCard} ${selectedProfile?.id === profile.id ? styles.selected : ''}`}
                                onClick={() => handleSelectProfile(profile)}
                              >
                                <div style={{ position: 'relative', width: '100%' }}>
                                  <div className={styles.pyramidAvatar} style={{ backgroundColor: getRoleInfo(profile.role).bgColor, borderColor: getRoleInfo(profile.role).color, overflow: 'hidden' }}>
                                    {profile.profile_image ? (
                                      <img src={profile.profile_image} alt={profile.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                      getInitials(profile.full_name)
                                    )}
                                  </div>
                                  <div style={{
                                    position: 'absolute',
                                    bottom: 4,
                                    right: 4,
                                    width: 12,
                                    height: 12,
                                    borderRadius: '50%',
                                    backgroundColor: onlineStatus.color,
                                    border: '2px solid white',
                                    boxShadow: `0 0 4px ${onlineStatus.color}`
                                  }} title={onlineStatus.label} />
                                </div>
                                <div className={styles.pyramidName}>{profile.full_name}</div>
                                <div className={styles.pyramidPosition}>{profile.employment_type}</div>
                                <div className={styles.pyramidId}>{profile.department}</div>
                              </div>
                            )
                          })}
                          {facultyMembers.length > 12 && (
                            <div className={styles.moreIndicator}>
                              +{facultyMembers.length - 12} more faculty
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Staff Members Level */}
                    {staffMembers.length > 0 && (
                      <div className={styles.pyramidLevel}>
                        <div className={styles.levelLabel} style={{ color: getRoleInfo('staff').color }}>
                          {getRoleInfo('staff').icon} Staff ({staffMembers.length})
                        </div>
                        <div className={styles.levelCards}>
                          {staffMembers.slice(0, 8).map((profile) => (
                            <div
                              key={profile.id}
                              className={`${styles.pyramidCard} ${styles.staffCard} ${selectedProfile?.id === profile.id ? styles.selected : ''}`}
                              onClick={() => handleSelectProfile(profile)}
                            >
                              <div className={styles.pyramidAvatar} style={{ backgroundColor: getRoleInfo(profile.role).bgColor, borderColor: getRoleInfo(profile.role).color }}>
                                {getInitials(profile.full_name)}
                              </div>
                              <div className={styles.pyramidName}>{profile.full_name}</div>
                              <div className={styles.pyramidPosition}>{profile.position}</div>
                              <div className={styles.pyramidId}>{profile.department}</div>
                            </div>
                          ))}
                          {staffMembers.length > 8 && (
                            <div className={styles.moreIndicator}>
                              +{staffMembers.length - 8} more staff
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Selected Profile Detail Card */}
                  {selectedProfile && (
                    <div className={styles.carouselSection}>
                      <h2 className={styles.carouselTitle}>Profile Details</h2>

                      <div className={styles.carouselContainer}>
                        <button
                          className={`${styles.carouselButton} ${styles.prevButton}`}
                          onClick={handlePrevious}
                          disabled={currentIndex === 0}
                        >
                          <FaChevronLeft />
                        </button>

                        <div className={styles.carouselContent} ref={carouselRef}>
                          <div className={styles.profileCard}>
                            <div className={styles.profileHeader} style={{ background: `linear-gradient(135deg, ${getRoleInfo(selectedProfile.role).color}20 0%, ${getRoleInfo(selectedProfile.role).color}40 100%)` }}>
                              <div className={styles.profileBadge} style={{ backgroundColor: getRoleInfo(selectedProfile.role).color }}>
                                {getRoleInfo(selectedProfile.role).icon}
                                <span>{getRoleInfo(selectedProfile.role).label}</span>
                              </div>
                              <div className={styles.employmentBadge} style={{ backgroundColor: getEmploymentBadge(selectedProfile.employment_type).color }}>
                                {getEmploymentBadge(selectedProfile.employment_type).label}
                              </div>
                              <div className={styles.profileAvatar} style={{ borderColor: getRoleInfo(selectedProfile.role).color }}>
                                {getInitials(selectedProfile.full_name)}
                              </div>
                              <h2 className={styles.profileName}>{selectedProfile.full_name}</h2>
                              <p className={styles.profilePosition}>{selectedProfile.position}</p>
                              <p className={styles.profileId}>ID: {selectedProfile.faculty_id}</p>
                            </div>

                            <div className={styles.profileBody}>
                              <div className={styles.profileInfo}>
                                {selectedProfile.email && (
                                  <div className={styles.infoRow}>
                                    <FaEnvelope className={styles.infoIcon} />
                                    <div>
                                      <span className={styles.infoLabel}>Email</span>
                                      <span className={styles.infoValue}>{selectedProfile.email}</span>
                                    </div>
                                  </div>
                                )}
                                {selectedProfile.phone && (
                                  <div className={styles.infoRow}>
                                    <FaPhone className={styles.infoIcon} />
                                    <div>
                                      <span className={styles.infoLabel}>Phone</span>
                                      <span className={styles.infoValue}>{selectedProfile.phone}</span>
                                    </div>
                                  </div>
                                )}
                                <div className={styles.infoRow}>
                                  <FaBuilding className={styles.infoIcon} />
                                  <div>
                                    <span className={styles.infoLabel}>Department</span>
                                    <span className={styles.infoValue}>{selectedProfile.department || 'Not assigned'}</span>
                                  </div>
                                </div>
                                <div className={styles.infoRow}>
                                  <FaGraduationCap className={styles.infoIcon} />
                                  <div>
                                    <span className={styles.infoLabel}>College</span>
                                    <span className={styles.infoValue}>{selectedProfile.college || 'Not assigned'}</span>
                                  </div>
                                </div>
                                {selectedProfile.office_location && (
                                  <div className={styles.infoRow}>
                                    <FaMapMarkerAlt className={styles.infoIcon} />
                                    <div>
                                      <span className={styles.infoLabel}>Office Location</span>
                                      <span className={styles.infoValue}>{selectedProfile.office_location}</span>
                                    </div>
                                  </div>
                                )}
                                {selectedProfile.specialization && (
                                  <div className={styles.infoRow}>
                                    <FaStar className={styles.infoIcon} />
                                    <div>
                                      <span className={styles.infoLabel}>Specialization</span>
                                      <span className={styles.infoValue}>{selectedProfile.specialization}</span>
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className={styles.profileActions}>
                                <button
                                  className={styles.deleteProfileButton}
                                  onClick={() => handleDeleteProfile(selectedProfile)}
                                  disabled={deleting === selectedProfile.id}
                                >
                                  {deleting === selectedProfile.id ? (
                                    <FaSpinner className={styles.spinnerSmall} />
                                  ) : (
                                    <FaTrash />
                                  )}
                                  Delete Profile
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        <button
                          className={`${styles.carouselButton} ${styles.nextButton}`}
                          onClick={handleNext}
                          disabled={currentIndex >= filteredFaculty.length - 1}
                        >
                          <FaChevronRight />
                        </button>
                      </div>

                      {/* Carousel Indicators */}
                      <div className={styles.carouselIndicators}>
                        <span className={styles.indicatorText}>
                          {currentIndex + 1} of {filteredFaculty.length}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Quick Navigation List */}
                  <div className={styles.quickNavSection}>
                    <h3 className={styles.quickNavTitle}>All Faculty ({filteredFaculty.length})</h3>
                    <div className={styles.quickNavGrid}>
                      {filteredFaculty.map((profile) => {
                        const roleInfo = getRoleInfo(profile.role)
                        const onlineStatus = getOnlineStatus(profile.last_login)
                        return (
                          <button
                            key={profile.id}
                            className={`${styles.quickNavItem} ${selectedProfile?.id === profile.id ? styles.activeNav : ''}`}
                            onClick={() => handleSelectProfile(profile)}
                            style={{ borderLeftColor: roleInfo.color }}
                          >
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                              <div style={{ position: 'relative', width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', backgroundColor: roleInfo.bgColor, border: `2px solid ${roleInfo.color}` }}>
                                {profile.profile_image ? (
                                  <img src={profile.profile_image} alt={profile.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: roleInfo.color, fontWeight: 'bold' }}>
                                    {getInitials(profile.full_name)}
                                  </div>
                                )}
                                <div style={{
                                  position: 'absolute',
                                  bottom: 0,
                                  right: 0,
                                  width: 10,
                                  height: 10,
                                  borderRadius: '50%',
                                  backgroundColor: onlineStatus.color,
                                  border: '2px solid white',
                                  boxShadow: `0 0 3px ${onlineStatus.color}`
                                }} title={onlineStatus.label} />
                              </div>
                              <div className={styles.quickNavInfo}>
                                <span className={styles.quickNavName}>{profile.full_name}</span>
                                <span className={styles.quickNavPosition}>{profile.position}</span>
                                <span className={styles.quickNavDept}>{profile.department}</span>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default function FacultyProfilesPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <FaSpinner style={{ animation: 'spin 1s linear infinite', fontSize: '32px', color: 'var(--primary)' }} />
      </div>
    }>
      <FacultyProfilesContent />
    </Suspense>
  )
}
