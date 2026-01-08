'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import { 
  Building2, 
  ArrowLeft, 
  Search, 
  Users,
  BookOpen,
  GraduationCap,
  Briefcase,
  FolderOpen
} from 'lucide-react'
import styles from './styles.module.css'

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

export default function FacultyDepartmentsPage() {
  const router = useRouter()
  
  const [sidebarOpen, setSidebarOpen] = useState(true)
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

  useEffect(() => {
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

  const fetchDepartments = async () => {
    setLoading(true)
    try {
      const { data, error } = await (supabase
        .from('departments')
        .select('*')
        .order('department_name', { ascending: true }) as any)

      if (error) throw error

      setDepartments(data || [])
      setFilteredDepartments(data || [])
      
      // Calculate stats
      const activeDepts = (data || []).filter((d: Department) => d.is_active).length
      setStats({
        totalDepartments: data?.length || 0,
        activeDepartments: activeDepts,
        totalFaculty: 0,
        totalCourses: 0
      })

      // Optionally fetch faculty count
      const { count: facultyCount } = await (supabase
        .from('faculty')
        .select('*', { count: 'exact', head: true }) as any)
      
      // Optionally fetch courses count
      const { count: coursesCount } = await (supabase
        .from('courses')
        .select('*', { count: 'exact', head: true }) as any)

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
      'CICS': <BookOpen />,
      'COE': <Building2 />,
      'CBA': <Briefcase />,
      'CAS': <GraduationCap />,
      'CON': <Users />,
      'CED': <GraduationCap />
    }
    return iconMap[code] || <FolderOpen />
  }

  return (
    <div className={styles.pageLayout}>
      <MenuBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} />
      
      <main className={`${styles.pageMain} ${!sidebarOpen ? styles.fullWidth : ''}`}>
        <div className={styles.pageContainer}>
          {/* Header */}
          <div className={styles.pageHeader}>
            <button className={styles.backButton} onClick={() => router.back()}>
              <ArrowLeft size={18} />
              Back
            </button>
            
            <div className={styles.headerTitleSection}>
              <div className={styles.headerIconWrapper}>
                <Building2 className={styles.headerLargeIcon} size={48} />
              </div>
              <div className={styles.headerText}>
                <h1 className={styles.pageTitle}>Faculty Departments</h1>
                <p className={styles.pageSubtitle}>
                  Manage and view all academic departments in the institution
                </p>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className={styles.statsGrid}>
            <div className={`${styles.statCard} ${styles.primary}`}>
              <div className={styles.statIcon}>
                <Building2 />
              </div>
              <div className={styles.statContent}>
                <p className={styles.statLabel}>Total Departments</p>
                <p className={styles.statValue}>{stats.totalDepartments}</p>
              </div>
            </div>

            <div className={`${styles.statCard} ${styles.success}`}>
              <div className={styles.statIcon}>
                <Building2 />
              </div>
              <div className={styles.statContent}>
                <p className={styles.statLabel}>Active Departments</p>
                <p className={styles.statValue}>{stats.activeDepartments}</p>
              </div>
            </div>

            <div className={`${styles.statCard} ${styles.info}`}>
              <div className={styles.statIcon}>
                <Users />
              </div>
              <div className={styles.statContent}>
                <p className={styles.statLabel}>Total Faculty</p>
                <p className={styles.statValue}>{stats.totalFaculty}</p>
              </div>
            </div>

            <div className={`${styles.statCard} ${styles.warning}`}>
              <div className={styles.statIcon}>
                <BookOpen />
              </div>
              <div className={styles.statContent}>
                <p className={styles.statLabel}>Total Courses</p>
                <p className={styles.statValue}>{stats.totalCourses}</p>
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className={styles.contentSection}>
            <div className={styles.sectionHeader}>
              <h2>
                <FolderOpen size={24} />
                Departments
              </h2>
              <div className={styles.searchBox}>
                <Search className={styles.searchIcon} size={18} />
                <input
                  type="text"
                  placeholder="Search departments..."
                  className={styles.searchInput}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {loading ? (
              <div className={styles.loadingState}>
                <div className={styles.spinner}></div>
                <p>Loading departments...</p>
              </div>
            ) : filteredDepartments.length === 0 ? (
              <div className={styles.emptyState}>
                <FolderOpen className={styles.emptyStateIcon} size={80} />
                <h3>No Departments Found</h3>
                <p>
                  {searchTerm 
                    ? 'No departments match your search criteria.' 
                    : 'No departments have been added yet. Run the database schema to add default departments.'}
                </p>
              </div>
            ) : (
              <div className={styles.departmentsGrid}>
                {filteredDepartments.map((dept) => (
                  <div 
                    key={dept.id} 
                    className={styles.departmentCard}
                    onClick={() => router.push(`/LandingPages/FacultyManagement/FacultyLists?department=${dept.id}`)}
                  >
                    <div className={styles.departmentCardIcon}>
                      {getDepartmentIcon(dept.department_code)}
                    </div>
                    <div className={styles.departmentCardContent}>
                      <h3 className={styles.departmentName}>{dept.department_name}</h3>
                      <p className={styles.departmentCode}>{dept.department_code}</p>
                      {dept.college && (
                        <p className={styles.departmentMeta}>{dept.college}</p>
                      )}
                      {dept.head_name && (
                        <p className={styles.departmentMeta}>Head: {dept.head_name}</p>
                      )}
                      <span className={`${styles.departmentBadge}`}>
                        {dept.is_active ? '✓ Active' : '✗ Inactive'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}