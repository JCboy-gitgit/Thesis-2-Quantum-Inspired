'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useTheme } from '@/app/context/ThemeContext'
import { 
  Building2, 
  ArrowLeft, 
  Search, 
  Users,
  BookOpen,
  GraduationCap,
  Briefcase,
  FolderOpen,
  Mail,
  Phone,
  MapPin,
  X
} from 'lucide-react'
import styles from './styles.module.css'
import '@/app/styles/faculty-global.css'

interface Department {
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

interface DepartmentStats {
  totalDepartments: number
  activeDepartments: number
  totalFaculty: number
  totalCourses: number
}

function DepartmentsViewContent() {
  const router = useRouter()
  const { theme, collegeTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  const [departments, setDepartments] = useState<Department[]>([])
  const [filteredDepartments, setFilteredDepartments] = useState<Department[]>([])
  const [stats, setStats] = useState<DepartmentStats>({
    totalDepartments: 0,
    activeDepartments: 0,
    totalFaculty: 0,
    totalCourses: 0
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDept, setSelectedDept] = useState<Department | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setMounted(true)
    checkAuth()
    fetchDepartments()
  }, [])

  useEffect(() => {
    if (searchTerm) {
      const filtered = departments.filter(dept => 
        dept.department_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dept.department_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dept.college?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredDepartments(filtered)
    } else {
      setFilteredDepartments(departments)
    }
  }, [searchTerm, departments])

  // Prevent body scroll when modal is open - simpler approach
  useEffect(() => {
    if (selectedDept && isMobile) {
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
  }, [selectedDept, isMobile])

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

  const fetchDepartments = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('department_name', { ascending: true })

      if (error) throw error

      setDepartments(data || [])
      setFilteredDepartments(data || [])
      
      const activeDepts = (data || []).filter((d: Department) => d.is_active).length
      setStats({
        totalDepartments: data?.length || 0,
        activeDepartments: activeDepts,
        totalFaculty: 0,
        totalCourses: 0
      })

      const { count: facultyCount } = await supabase
        .from('faculty_profiles')
        .select('*', { count: 'exact', head: true })
      
      const { count: coursesCount } = await supabase
        .from('courses')
        .select('*', { count: 'exact', head: true })

      setStats(prev => ({
        ...prev,
        totalFaculty: facultyCount || 0,
        totalCourses: coursesCount || 0
      }))

    } catch (error) {
      console.error('Error fetching departments:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDepartmentIcon = (code: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      'CICS': <BookOpen size={32} />,
      'COE': <Building2 size={32} />,
      'CBA': <Briefcase size={32} />,
      'CAS': <GraduationCap size={32} />,
      'CON': <Users size={32} />,
      'CED': <GraduationCap size={32} />
    }
    return iconMap[code] || <FolderOpen size={32} />
  }

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading Departments...</p>
      </div>
    )
  }

  return (
    <div className={`${styles.pageContainer} faculty-page-wrapper`} data-theme={theme} data-college-theme={collegeTheme}>
      <div className={styles.header}>
        <button onClick={() => router.push('/faculty/home')} className={styles.backButton}>
          <ArrowLeft size={20} />
          Back to Home
        </button>
        <h1 className={styles.pageTitle}>
          <Building2 size={32} />
          Departments
        </h1>
        <p className={styles.subtitle}>View department structures and information</p>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <Building2 size={24} />
          <div>
            <div className={styles.statValue}>{stats.totalDepartments}</div>
            <div className={styles.statLabel}>Total Departments</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <Building2 size={24} />
          <div>
            <div className={styles.statValue}>{stats.activeDepartments}</div>
            <div className={styles.statLabel}>Active Departments</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <Users size={24} />
          <div>
            <div className={styles.statValue}>{stats.totalFaculty}</div>
            <div className={styles.statLabel}>Faculty Members</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <BookOpen size={24} />
          <div>
            <div className={styles.statValue}>{stats.totalCourses}</div>
            <div className={styles.statLabel}>Total Courses</div>
          </div>
        </div>
      </div>

      <div className={styles.searchSection}>
        <div className={styles.searchBar}>
          <Search size={20} />
          <input
            type="text"
            placeholder="Search departments by name, code, or college..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.resultsInfo}>
        Showing {filteredDepartments.length} of {departments.length} departments
      </div>

      <div className={styles.departmentsGrid}>
        {filteredDepartments.map(dept => (
          <div 
            key={dept.id} 
            className={styles.departmentCard}
            onClick={() => setSelectedDept(dept)}
          >
            <div className={styles.departmentIcon}>
              {getDepartmentIcon(dept.department_code)}
            </div>
            <div className={styles.departmentInfo}>
              <div className={styles.departmentHeader}>
                <h3 className={styles.departmentName}>{dept.department_name}</h3>
                <span className={styles.departmentCode}>{dept.department_code}</span>
              </div>
              <p className={styles.collegeName}>
                <Building2 size={14} />
                {dept.college}
              </p>
              {dept.head_name && (
                <p className={styles.headName}>
                  <Users size={14} />
                  Head: {dept.head_name}
                </p>
              )}
              <div className={styles.statusBadge} data-active={dept.is_active}>
                {dept.is_active ? 'Active' : 'Inactive'}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile Modal */}
      {isMobile && selectedDept && (
        <div className={styles.modalOverlay} onClick={() => setSelectedDept(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeButton} onClick={() => setSelectedDept(null)}>
              <X size={24} />
            </button>
            <div className={styles.modalHeader}>
              <div className={styles.modalIcon}>
                {getDepartmentIcon(selectedDept.department_code)}
              </div>
              <div>
                <h2 className={styles.modalName}>{selectedDept.department_name}</h2>
                <p className={styles.modalCode}>{selectedDept.department_code}</p>
                <div className={styles.statusBadge} data-active={selectedDept.is_active}>
                  {selectedDept.is_active ? 'Active' : 'Inactive'}
                </div>
              </div>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <Building2 size={16} />
                  <strong>College:</strong>
                  <span>{selectedDept.college}</span>
                </div>
                {selectedDept.head_name && (
                  <div className={styles.infoItem}>
                    <Users size={16} />
                    <strong>Department Head:</strong>
                    <span>{selectedDept.head_name}</span>
                  </div>
                )}
                {selectedDept.head_email && (
                  <div className={styles.infoItem}>
                    <Mail size={16} />
                    <strong>Email:</strong>
                    <span>{selectedDept.head_email}</span>
                  </div>
                )}
                {selectedDept.contact_phone && (
                  <div className={styles.infoItem}>
                    <Phone size={16} />
                    <strong>Phone:</strong>
                    <span>{selectedDept.contact_phone}</span>
                  </div>
                )}
                {selectedDept.office_location && (
                  <div className={styles.infoItem}>
                    <MapPin size={16} />
                    <strong>Office Location:</strong>
                    <span>{selectedDept.office_location}</span>
                  </div>
                )}
              </div>
              {selectedDept.description && (
                <div className={styles.section}>
                  <h3>Description</h3>
                  <p>{selectedDept.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Desktop Side Panel */}
      {!isMobile && (
        <div className={`${styles.sidePanel} ${selectedDept ? styles.sidePanelOpen : ''}`}>
          {selectedDept && (
            <>
              <button className={styles.closePanelButton} onClick={() => setSelectedDept(null)}>
                <X size={24} />
              </button>
              <div className={styles.panelHeader}>
                <div className={styles.panelIcon}>
                  {getDepartmentIcon(selectedDept.department_code)}
                </div>
                <div>
                  <h2 className={styles.panelName}>{selectedDept.department_name}</h2>
                  <p className={styles.panelCode}>{selectedDept.department_code}</p>
                  <div className={styles.statusBadge} data-active={selectedDept.is_active}>
                    {selectedDept.is_active ? 'Active' : 'Inactive'}
                  </div>
                </div>
              </div>
              <div className={styles.panelBody}>
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <Building2 size={16} />
                    <strong>College:</strong>
                    <span>{selectedDept.college}</span>
                  </div>
                  {selectedDept.head_name && (
                    <div className={styles.infoItem}>
                      <Users size={16} />
                      <strong>Department Head:</strong>
                      <span>{selectedDept.head_name}</span>
                    </div>
                  )}
                  {selectedDept.head_email && (
                    <div className={styles.infoItem}>
                      <Mail size={16} />
                      <strong>Email:</strong>
                      <span>{selectedDept.head_email}</span>
                    </div>
                  )}
                  {selectedDept.contact_phone && (
                    <div className={styles.infoItem}>
                      <Phone size={16} />
                      <strong>Phone:</strong>
                      <span>{selectedDept.contact_phone}</span>
                    </div>
                  )}
                  {selectedDept.office_location && (
                    <div className={styles.infoItem}>
                      <MapPin size={16} />
                      <strong>Office Location:</strong>
                      <span>{selectedDept.office_location}</span>
                    </div>
                  )}
                </div>
                {selectedDept.description && (
                  <div className={styles.section}>
                    <h3>Description</h3>
                    <p>{selectedDept.description}</p>
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

export default function FacultyDepartmentsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DepartmentsViewContent />
    </Suspense>
  )
}
