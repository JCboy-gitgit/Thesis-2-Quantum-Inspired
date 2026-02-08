'use client'

import { Suspense, useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useTheme } from '@/app/context/ThemeContext'
import { ArrowLeft, Search, Users, Building2, Briefcase, Mail, Phone, MapPin, X } from 'lucide-react'
import styles from './styles.module.css'
import '@/app/styles/faculty-global.css'

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
}

interface CollegeGroup {
  college: string
  faculty_count: number
  departments: string[]
}

interface FacultyStats {
  totalFaculty: number
  totalColleges: number
  fullTime: number
  partTime: number
}

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

function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.split(/[,\s]+/).filter(p => p.length > 0)
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

function getRoleColor(role: string): string {
  switch (role) {
    case 'administrator': return '#f59e0b'
    case 'department_head': return '#8b5cf6'
    case 'program_chair': return '#ec4899'
    case 'coordinator': return '#06b6d4'
    case 'staff': return '#64748b'
    default: return 'var(--college-primary, var(--primary))' // Default faculty color (theme-aware)
  }
}

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

function getEmploymentBadge(type: string): { label: string; color: string } {
  switch (type) {
    case 'full-time': return { label: 'Full-Time', color: 'var(--college-primary, var(--primary))' } // Theme-aware
    case 'part-time': return { label: 'Part-Time', color: '#f59e0b' }
    case 'adjunct': return { label: 'Adjunct', color: '#8b5cf6' }
    case 'guest': return { label: 'Guest', color: '#06b6d4' }
    default: return { label: type, color: '#64748b' }
  }
}

function FacultyDirectoryContent() {
  const router = useRouter()
  const { theme, collegeTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const [loading, setLoading] = useState(true)
  const [allFaculty, setAllFaculty] = useState<FacultyProfile[]>([])
  const [filteredData, setFilteredData] = useState<FacultyProfile[]>([])
  const [collegeGroups, setCollegeGroups] = useState<CollegeGroup[]>([])
  const [selectedCollege, setSelectedCollege] = useState<string | null>(null)
  const [stats, setStats] = useState<FacultyStats | null>(null)
  const [selectedFaculty, setSelectedFaculty] = useState<FacultyProfile | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState<string>('all')
  const [filterEmployment, setFilterEmployment] = useState<string>('all')
  const [departments, setDepartments] = useState<string[]>([])
  const [filterDepartment, setFilterDepartment] = useState<string>('all')
  
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 12
  
  // Store scroll position in a ref to preserve it across renders
  const scrollPositionRef = useRef<number>(0)

  useEffect(() => {
    setMounted(true)
    checkAuth()
    fetchFacultyData()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [allFaculty, searchTerm, filterRole, filterEmployment, filterDepartment, selectedCollege])

  // Prevent body scroll when modal is open - simpler approach
  useEffect(() => {
    if (selectedFaculty && isMobile) {
      // Simply prevent scrolling without changing position
      document.body.style.overflow = 'hidden'
      document.body.style.touchAction = 'none'
    } else {
      // Restore scrolling
      document.body.style.overflow = ''
      document.body.style.touchAction = ''
    }
    
    return () => {
      document.body.style.overflow = ''
      document.body.style.touchAction = ''
    }
  }, [selectedFaculty, isMobile])

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user) {
        router.push('/')
        return
      }

      // Check if faculty member
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single() as { data: any; error: any }

      if (!userData || !userData.is_active) {
        router.push('/')
        return
      }
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/')
    }
  }

  const fetchFacultyData = async () => {
    setLoading(true)
    try {
      const data = await fetchAllRows('faculty_profiles')
      
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
      const enrichedData = data.map(f => ({
        ...f,
        profile_image: f.profile_image || (f.email ? userAvatarMap.get(f.email.toLowerCase()) : null) || null
      }))
      
      setAllFaculty(enrichedData)

      const collegeMap = new Map<string, { faculty: FacultyProfile[], departments: Set<string> }>()
      data.forEach(f => {
        const college = f.college || 'Unassigned'
        if (!collegeMap.has(college)) {
          collegeMap.set(college, { faculty: [], departments: new Set() })
        }
        collegeMap.get(college)!.faculty.push(f)
        if (f.department) {
          collegeMap.get(college)!.departments.add(f.department)
        }
      })

      const groups: CollegeGroup[] = Array.from(collegeMap.entries()).map(([college, info]) => ({
        college,
        faculty_count: info.faculty.length,
        departments: Array.from(info.departments)
      })).sort((a, b) => b.faculty_count - a.faculty_count)

      setCollegeGroups(groups)

      const uniqueDepts = [...new Set(data.map(f => f.department).filter(Boolean))] as string[]
      setDepartments(uniqueDepts.sort())

      setStats({
        totalFaculty: data.length,
        totalColleges: groups.length,
        fullTime: data.filter(f => f.employment_type === 'full-time').length,
        partTime: data.filter(f => f.employment_type !== 'full-time').length
      })
    } catch (error) {
      console.error('Error fetching faculty data:', error)
      setAllFaculty([])
      setCollegeGroups([])
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...allFaculty]

    if (selectedCollege) {
      filtered = filtered.filter(f => (f.college || 'Unassigned') === selectedCollege)
    }

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

    if (filterRole !== 'all') {
      filtered = filtered.filter(f => f.role === filterRole)
    }

    if (filterEmployment !== 'all') {
      filtered = filtered.filter(f => f.employment_type === filterEmployment)
    }

    if (filterDepartment !== 'all') {
      filtered = filtered.filter(f => f.department === filterDepartment)
    }

    setFilteredData(filtered)
    setCurrentPage(1)
  }

  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE)
  const startIdx = (currentPage - 1) * PAGE_SIZE
  const endIdx = startIdx + PAGE_SIZE
  const currentData = filteredData.slice(startIdx, endIdx)

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading Faculty Directory...</p>
      </div>
    )
  }

  return (
    <div className={`${styles.pageContainer} faculty-page-wrapper`} data-theme={theme} data-college-theme={collegeTheme}>
      <div className={`${styles.mainContentArea} ${selectedFaculty ? styles.withPanel : ''}`}>
        <div className={styles.header}>
          <button onClick={() => router.push('/faculty/home')} className={styles.backButton}>
            <ArrowLeft size={20} />
            Back to Home
          </button>
          <h1 className={styles.pageTitle}>
            <Users size={32} />
            Faculty Directory
          </h1>
        <p className={styles.subtitle}>View all faculty members across the institution</p>
      </div>

      {!selectedCollege ? (
        <>
          {stats && (
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <Users size={24} />
                <div>
                  <div className={styles.statValue}>{stats.totalFaculty}</div>
                  <div className={styles.statLabel}>Total Faculty</div>
                </div>
              </div>
              <div className={styles.statCard}>
                <Building2 size={24} />
                <div>
                  <div className={styles.statValue}>{stats.totalColleges}</div>
                  <div className={styles.statLabel}>Colleges</div>
                </div>
              </div>
              <div className={styles.statCard}>
                <Briefcase size={24} />
                <div>
                  <div className={styles.statValue}>{stats.fullTime}</div>
                  <div className={styles.statLabel}>Full-Time</div>
                </div>
              </div>
              <div className={styles.statCard}>
                <Briefcase size={24} />
                <div>
                  <div className={styles.statValue}>{stats.partTime}</div>
                  <div className={styles.statLabel}>Part-Time</div>
                </div>
              </div>
            </div>
          )}

          <div className={styles.collegeGrid}>
            {collegeGroups.map(group => (
              <div
                key={group.college}
                className={styles.collegeCard}
                onClick={() => setSelectedCollege(group.college)}
              >
                <Building2 size={32} className={styles.collegeIcon} />
                <h3 className={styles.collegeName}>{group.college}</h3>
                <p className={styles.facultyCount}>{group.faculty_count} Faculty Members</p>
                <div className={styles.departmentList}>
                  {group.departments.slice(0, 3).map(dept => (
                    <span key={dept} className={styles.departmentBadge}>{dept}</span>
                  ))}
                  {group.departments.length > 3 && (
                    <span className={styles.moreBadge}>+{group.departments.length - 3} more</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className={styles.collegeHeader}>
            <button onClick={() => setSelectedCollege(null)} className={styles.backLink}>
              <ArrowLeft size={18} />
              Back to Colleges
            </button>
            <h2 className={styles.collegeTitle}>{selectedCollege}</h2>
          </div>

          <div className={styles.searchSection}>
            <div className={styles.searchBar}>
              <Search size={20} />
              <input
                type="text"
                placeholder="Search by name, ID, email, position..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className={styles.filters}>
              <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
                <option value="all">All Roles</option>
                <option value="administrator">Administrator</option>
                <option value="department_head">Department Head</option>
                <option value="program_chair">Program Chair</option>
                <option value="coordinator">Coordinator</option>
                <option value="faculty">Faculty</option>
                <option value="staff">Staff</option>
              </select>
              <select value={filterEmployment} onChange={(e) => setFilterEmployment(e.target.value)}>
                <option value="all">All Employment Types</option>
                <option value="full-time">Full-Time</option>
                <option value="part-time">Part-Time</option>
                <option value="adjunct">Adjunct</option>
                <option value="guest">Guest</option>
              </select>
              <select value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)}>
                <option value="all">All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.resultsInfo}>
            Showing {startIdx + 1}-{Math.min(endIdx, filteredData.length)} of {filteredData.length} faculty members
          </div>

          <div className={styles.facultyGrid}>
            {currentData.map(faculty => (
              <div 
                key={faculty.id} 
                className={`${styles.facultyCard} ${selectedFaculty?.id === faculty.id ? styles.facultyCardSelected : ''}`} 
                onClick={() => setSelectedFaculty(faculty)}
              >
                {faculty.profile_image ? (
                  <img 
                    src={faculty.profile_image} 
                    alt={faculty.full_name}
                    className={styles.facultyAvatarImg}
                  />
                ) : (
                  <div className={styles.facultyAvatar} style={{ backgroundColor: getRoleColor(faculty.role) }}>
                    {getInitials(faculty.full_name)}
                  </div>
                )}
                <div className={styles.facultyInfo}>
                  <h3 className={styles.facultyName}>{faculty.full_name}</h3>
                  <p className={styles.facultyPosition}>{faculty.position}</p>
                  <div className={styles.badges}>
                    <span className={styles.roleBadge} style={{ backgroundColor: getRoleColor(faculty.role) }}>
                      {getRoleLabel(faculty.role)}
                    </span>
                    <span 
                      className={styles.employmentBadge} 
                      style={{ backgroundColor: getEmploymentBadge(faculty.employment_type).color }}
                    >
                      {getEmploymentBadge(faculty.employment_type).label}
                    </span>
                  </div>
                  {faculty.department && (
                    <p className={styles.facultyDepartment}>
                      <Building2 size={14} />
                      {faculty.department}
                    </p>
                  )}
                  {faculty.email && (
                    <p className={styles.facultyEmail}>
                      <Mail size={14} />
                      {faculty.email}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={styles.pageButton}
              >
                Previous
              </button>
              <span className={styles.pageInfo}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className={styles.pageButton}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
      </div> {/* End mainContentArea */}

      {/* Mobile Modal */}
      {isMobile && selectedFaculty && (
        <div className={styles.modalOverlay} onClick={() => setSelectedFaculty(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeButton} onClick={() => setSelectedFaculty(null)}>
              <X size={24} />
            </button>
            <div className={styles.modalHeader}>
              {selectedFaculty.profile_image ? (
                <img 
                  src={selectedFaculty.profile_image} 
                  alt={selectedFaculty.full_name}
                  className={styles.modalAvatarImg}
                />
              ) : (
                <div className={styles.modalAvatar} style={{ backgroundColor: getRoleColor(selectedFaculty.role) }}>
                  {getInitials(selectedFaculty.full_name)}
                </div>
              )}
              <div>
                <h2 className={styles.modalName}>{selectedFaculty.full_name}</h2>
                <p className={styles.modalPosition}>{selectedFaculty.position}</p>
                <div className={styles.modalBadges}>
                  <span className={styles.roleBadge} style={{ backgroundColor: getRoleColor(selectedFaculty.role) }}>
                    {getRoleLabel(selectedFaculty.role)}
                  </span>
                  <span 
                    className={styles.employmentBadge} 
                    style={{ backgroundColor: getEmploymentBadge(selectedFaculty.employment_type).color }}
                  >
                    {getEmploymentBadge(selectedFaculty.employment_type).label}
                  </span>
                </div>
              </div>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.infoGrid}>
                {selectedFaculty.faculty_id && (
                  <div className={styles.infoItem}>
                    <strong>Faculty ID:</strong>
                    <span>{selectedFaculty.faculty_id}</span>
                  </div>
                )}
                {selectedFaculty.college && (
                  <div className={styles.infoItem}>
                    <Building2 size={16} />
                    <strong>College:</strong>
                    <span>{selectedFaculty.college}</span>
                  </div>
                )}
                {selectedFaculty.department && (
                  <div className={styles.infoItem}>
                    <Building2 size={16} />
                    <strong>Department:</strong>
                    <span>{selectedFaculty.department}</span>
                  </div>
                )}
                {selectedFaculty.email && (
                  <div className={styles.infoItem}>
                    <Mail size={16} />
                    <strong>Email:</strong>
                    <span>{selectedFaculty.email}</span>
                  </div>
                )}
                {selectedFaculty.phone && (
                  <div className={styles.infoItem}>
                    <Phone size={16} />
                    <strong>Phone:</strong>
                    <span>{selectedFaculty.phone}</span>
                  </div>
                )}
                {selectedFaculty.office_location && (
                  <div className={styles.infoItem}>
                    <MapPin size={16} />
                    <strong>Office:</strong>
                    <span>{selectedFaculty.office_location}</span>
                  </div>
                )}
              </div>
              {selectedFaculty.specialization && (
                <div className={styles.section}>
                  <h3>Specialization</h3>
                  <p>{selectedFaculty.specialization}</p>
                </div>
              )}
              {selectedFaculty.education && (
                <div className={styles.section}>
                  <h3>Education</h3>
                  <p>{selectedFaculty.education}</p>
                </div>
              )}
              {selectedFaculty.bio && (
                <div className={styles.section}>
                  <h3>Biography</h3>
                  <p>{selectedFaculty.bio}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Desktop Side Panel */}
      {!isMobile && (
        <div className={`${styles.sidePanel} ${selectedFaculty ? styles.sidePanelOpen : ''}`}>
          {selectedFaculty && (
            <>
              <button className={styles.closePanelButton} onClick={() => setSelectedFaculty(null)}>
                <X size={24} />
              </button>
              <div className={styles.panelHeader}>
                <div className={styles.panelAvatar} style={{ backgroundColor: getRoleColor(selectedFaculty.role) }}>
                  {getInitials(selectedFaculty.full_name)}
                </div>
                <div>
                  <h2 className={styles.panelName}>{selectedFaculty.full_name}</h2>
                  <p className={styles.panelPosition}>{selectedFaculty.position}</p>
                  <div className={styles.panelBadges}>
                    <span className={styles.roleBadge} style={{ backgroundColor: getRoleColor(selectedFaculty.role) }}>
                      {getRoleLabel(selectedFaculty.role)}
                    </span>
                    <span 
                      className={styles.employmentBadge} 
                      style={{ backgroundColor: getEmploymentBadge(selectedFaculty.employment_type).color }}
                    >
                      {getEmploymentBadge(selectedFaculty.employment_type).label}
                    </span>
                  </div>
                </div>
              </div>
              <div className={styles.panelBody}>
                <div className={styles.infoGrid}>
                  {selectedFaculty.faculty_id && (
                    <div className={styles.infoItem}>
                      <strong>Faculty ID:</strong>
                      <span>{selectedFaculty.faculty_id}</span>
                    </div>
                  )}
                  {selectedFaculty.college && (
                    <div className={styles.infoItem}>
                      <Building2 size={16} />
                      <strong>College:</strong>
                      <span>{selectedFaculty.college}</span>
                    </div>
                  )}
                  {selectedFaculty.department && (
                    <div className={styles.infoItem}>
                      <Building2 size={16} />
                      <strong>Department:</strong>
                      <span>{selectedFaculty.department}</span>
                    </div>
                  )}
                  {selectedFaculty.email && (
                    <div className={styles.infoItem}>
                      <Mail size={16} />
                      <strong>Email:</strong>
                      <span>{selectedFaculty.email}</span>
                    </div>
                  )}
                  {selectedFaculty.phone && (
                    <div className={styles.infoItem}>
                      <Phone size={16} />
                      <strong>Phone:</strong>
                      <span>{selectedFaculty.phone}</span>
                    </div>
                  )}
                  {selectedFaculty.office_location && (
                    <div className={styles.infoItem}>
                      <MapPin size={16} />
                      <strong>Office:</strong>
                      <span>{selectedFaculty.office_location}</span>
                    </div>
                  )}
                </div>
                {selectedFaculty.specialization && (
                  <div className={styles.section}>
                    <h3>Specialization</h3>
                    <p>{selectedFaculty.specialization}</p>
                  </div>
                )}
                {selectedFaculty.education && (
                  <div className={styles.section}>
                    <h3>Education</h3>
                    <p>{selectedFaculty.education}</p>
                  </div>
                )}
                {selectedFaculty.bio && (
                  <div className={styles.section}>
                    <h3>Biography</h3>
                    <p>{selectedFaculty.bio}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function FacultyDirectoryPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <FacultyDirectoryContent />
    </Suspense>
  )
}
