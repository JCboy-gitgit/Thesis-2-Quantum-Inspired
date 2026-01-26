'use client'

import { Suspense, useEffect, useState } from 'react'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import styles from '../../CoursesManagement/ClassSchedules.module.css'
import stylesLocal from './styles.module.css'
import { supabase } from '@/lib/supabaseClient'
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  Save,
  Calendar,
  GraduationCap,
  Users,
  Search,
  Trash2,
  UserPlus,
  FileText,
  CheckCircle,
  AlertCircle,
  Download,
  Upload,
  BookMarked
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ==================== Interfaces ====================
interface Course {
  id: number
  course_code: string
  course_name: string
  lec_units: number
  lab_units: number
  credit_units: number
  lec_hours: number
  lab_hours: number
  semester: string
  academic_year: string
  department: string
  college: string
  degree_program: string | null
  year_level: number
}

interface FacultyProfile {
  id: string
  faculty_id: string
  full_name: string
  position: string
  role: string
  department: string | null
  college: string | null
  email: string | null
  employment_type: 'full-time' | 'part-time' | 'adjunct' | 'guest'
  is_active: boolean
  specialization: string | null
}

interface TeachingLoad {
  id: number
  faculty_id: string
  course_id: number
  academic_year: string
  semester: string
  section?: string
  notes?: string
  created_at: string
}

interface TeachingLoadWithDetails extends TeachingLoad {
  faculty?: FacultyProfile
  course?: Course
}

// ==================== Main Component ====================
function TeachingLoadAssignmentContent() {
  const router = useRouter()

  // State
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [faculties, setFaculties] = useState<FacultyProfile[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [teachingLoads, setTeachingLoads] = useState<TeachingLoadWithDetails[]>([])
  const [selectedFaculty, setSelectedFaculty] = useState<FacultyProfile | null>(null)
  const [expandedFaculties, setExpandedFaculties] = useState<Set<string>>(new Set())
  
  // Search and filters
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCollege, setFilterCollege] = useState<string>('all')
  const [filterDepartment, setFilterDepartment] = useState<string>('all')
  const [filterSemester, setFilterSemester] = useState<string>('all')
  const [filterAcademicYear, setFilterAcademicYear] = useState<string>('all')

  // Modal States
  const [showAssignCoursesModal, setShowAssignCoursesModal] = useState(false)
  const [showUploadCSVModal, setShowUploadCSVModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  // Assignment form
  const [selectedCourses, setSelectedCourses] = useState<number[]>([])
  const [assignmentSemester, setAssignmentSemester] = useState<string>('First Semester')
  const [assignmentAcademicYear, setAssignmentAcademicYear] = useState<string>('2025-2026')
  const [assignmentSection, setAssignmentSection] = useState<string>('')
  const [assignmentNotes, setAssignmentNotes] = useState<string>('')

  // CSV upload
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvPreview, setCsvPreview] = useState<string>('')

  // Notification
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  // Options
  const semesters = ['First Semester', 'Second Semester', 'Summer']
  const currentYear = new Date().getFullYear()
  const academicYears = [
    `${currentYear}-${currentYear + 1}`,
    `${currentYear + 1}-${currentYear + 2}`,
    `${currentYear - 1}-${currentYear}`
  ]

  // Effects
  useEffect(() => {
    checkAuth()
    fetchData()
  }, [])

  // Auto-hide notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [notification])

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

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch faculty profiles
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: facultyData, error: facultyError } = await (supabase as any)
        .from('faculty_profiles')
        .select('*')
        .eq('is_active', true)
        .order('full_name', { ascending: true })

      if (facultyError) throw facultyError
      setFaculties(facultyData || [])

      // Fetch courses from class_schedules
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: coursesData, error: coursesError } = await (supabase as any)
        .from('class_schedules')
        .select('*')
        .order('course_code', { ascending: true })

      if (coursesError) throw coursesError
      setCourses(coursesData || [])

      // Fetch teaching loads
      await fetchTeachingLoads()

    } catch (error) {
      console.error('Error fetching data:', error)
      setNotification({ type: 'error', message: 'Failed to fetch data. Please refresh.' })
    } finally {
      setLoading(false)
    }
  }

  const fetchTeachingLoads = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: loadsData, error: loadsError } = await (supabase as any)
        .from('teaching_loads')
        .select('*')
        .order('created_at', { ascending: false })

      if (loadsError) {
        console.log('teaching_loads table may not exist:', loadsError)
        setTeachingLoads([])
        return
      }

      // Combine with faculty and course data
      const enrichedLoads = loadsData?.map((load: TeachingLoad) => {
        const faculty = faculties.find(f => f.id === load.faculty_id)
        const course = courses.find(c => c.id === load.course_id)
        return { ...load, faculty, course }
      }) || []

      setTeachingLoads(enrichedLoads)
    } catch (error) {
      console.error('Error fetching teaching loads:', error)
    }
  }

  // Get unique colleges
  const getColleges = () => {
    return [...new Set(faculties.map(f => f.college).filter(Boolean))] as string[]
  }

  // Get unique departments
  const getDepartments = () => {
    let depts = faculties.map(f => f.department).filter(Boolean) as string[]
    if (filterCollege !== 'all') {
      depts = faculties
        .filter(f => f.college === filterCollege)
        .map(f => f.department)
        .filter(Boolean) as string[]
    }
    return [...new Set(depts)]
  }

  // Get teaching loads for a faculty
  const getTeachingLoadsForFaculty = (facultyId: string): TeachingLoadWithDetails[] => {
    let loads = teachingLoads.filter(tl => tl.faculty_id === facultyId)

    if (filterSemester !== 'all') {
      loads = loads.filter(tl => tl.semester === filterSemester)
    }

    if (filterAcademicYear !== 'all') {
      loads = loads.filter(tl => tl.academic_year === filterAcademicYear)
    }

    return loads
  }

  // Calculate total units for faculty
  const getTotalUnits = (facultyId: string): { total: number, lec: number, lab: number } => {
    const loads = getTeachingLoadsForFaculty(facultyId)
    let totalLec = 0
    let totalLab = 0

    loads.forEach(load => {
      if (load.course) {
        totalLec += load.course.lec_units || 0
        totalLab += load.course.lab_units || 0
      }
    })

    return { total: totalLec + totalLab, lec: totalLec, lab: totalLab }
  }

  // Filter faculties
  const getFilteredFaculties = () => {
    let filtered = [...faculties]

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(f =>
        f.full_name.toLowerCase().includes(term) ||
        f.email?.toLowerCase().includes(term) ||
        f.department?.toLowerCase().includes(term)
      )
    }

    if (filterCollege !== 'all') {
      filtered = filtered.filter(f => f.college === filterCollege)
    }

    if (filterDepartment !== 'all') {
      filtered = filtered.filter(f => f.department === filterDepartment)
    }

    return filtered
  }

  // Toggle faculty expansion
  const toggleFaculty = (facultyId: string) => {
    setExpandedFaculties(prev => {
      const next = new Set(prev)
      if (next.has(facultyId)) {
        next.delete(facultyId)
      } else {
        next.add(facultyId)
      }
      return next
    })
  }

  // Open assign courses modal
  const openAssignModal = (faculty: FacultyProfile) => {
    setSelectedFaculty(faculty)
    setSelectedCourses([])
    setAssignmentSemester('First Semester')
    setAssignmentAcademicYear(academicYears[0])
    setAssignmentSection('')
    setAssignmentNotes('')
    setShowAssignCoursesModal(true)
  }

  // Toggle course selection
  const toggleCourseSelection = (courseId: number) => {
    setSelectedCourses(prev => {
      if (prev.includes(courseId)) {
        return prev.filter(id => id !== courseId)
      } else {
        return [...prev, courseId]
      }
    })
  }

  // Save teaching assignments
  const saveTeachingAssignments = async () => {
    if (!selectedFaculty || selectedCourses.length === 0) {
      setNotification({ type: 'error', message: 'Please select at least one course' })
      return
    }

    setSaving(true)
    try {
      // Create teaching load entries
      const assignments = selectedCourses.map(courseId => ({
        faculty_id: selectedFaculty.id,
        course_id: courseId,
        academic_year: assignmentAcademicYear,
        semester: assignmentSemester,
        section: assignmentSection || null,
        notes: assignmentNotes || null
      }))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('teaching_loads')
        .insert(assignments)

      if (error) throw error

      setNotification({ type: 'success', message: `Assigned ${selectedCourses.length} course(s) successfully!` })
      setShowAssignCoursesModal(false)
      await fetchTeachingLoads()
    } catch (error) {
      console.error('Error saving assignments:', error)
      setNotification({ type: 'error', message: 'Failed to save assignments. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  // Delete teaching load
  const deleteTeachingLoad = async (loadId: number) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('teaching_loads')
        .delete()
        .eq('id', loadId)

      if (error) throw error

      setNotification({ type: 'success', message: 'Course assignment removed successfully!' })
      setShowDeleteConfirm(null)
      await fetchTeachingLoads()
    } catch (error) {
      console.error('Error deleting assignment:', error)
      setNotification({ type: 'error', message: 'Failed to delete assignment.' })
    }
  }

  // Handle CSV file upload
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setCsvFile(file)

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setCsvPreview(text.split('\n').slice(0, 10).join('\n'))
    }
    reader.readAsText(file)
  }

  // Process CSV upload
  const processCSVUpload = async () => {
    if (!csvFile) {
      setNotification({ type: 'error', message: 'Please select a CSV file' })
      return
    }

    setSaving(true)
    try {
      const text = await csvFile.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length < 2) {
        throw new Error('CSV file is empty or invalid')
      }

      // Parse CSV: faculty_id, course_code, academic_year, semester, section, notes
      const assignments: any[] = []
      
      for (let i = 1; i < lines.length; i++) {
        const columns = lines[i].split(',').map(col => col.trim().replace(/^"|"$/g, ''))
        
        if (columns.length < 4) continue

        const [facultyId, courseCode, academicYear, semester, section = '', notes = ''] = columns

        // Find faculty
        const faculty = faculties.find(f => f.faculty_id === facultyId || f.id === facultyId)
        if (!faculty) continue

        // Find course
        const course = courses.find(c => c.course_code === courseCode)
        if (!course) continue

        assignments.push({
          faculty_id: faculty.id,
          course_id: course.id,
          academic_year: academicYear,
          semester: semester,
          section: section || null,
          notes: notes || null
        })
      }

      if (assignments.length === 0) {
        throw new Error('No valid assignments found in CSV')
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('teaching_loads')
        .insert(assignments)

      if (error) throw error

      setNotification({ type: 'success', message: `Imported ${assignments.length} teaching assignments!` })
      setShowUploadCSVModal(false)
      setCsvFile(null)
      setCsvPreview('')
      await fetchTeachingLoads()
    } catch (error) {
      console.error('Error processing CSV:', error)
      setNotification({ type: 'error', message: `Failed to process CSV: ${error}` })
    } finally {
      setSaving(false)
    }
  }

  // Download template CSV
  const downloadTemplate = () => {
    const csvContent = 'faculty_id,course_code,academic_year,semester,section,notes\n' +
      'FAC001,CS101,2025-2026,First Semester,BSCS 1A,Main instructor\n' +
      'FAC002,MATH101,2025-2026,First Semester,BSCS 1A,\n'

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'teaching_load_template.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setNotification({ type: 'success', message: 'Template downloaded!' })
  }

  // Download current assignments as CSV
  const downloadAssignments = () => {
    let csvContent = 'Faculty Name,Faculty ID,Email,Course Code,Course Name,Units,Academic Year,Semester,Section,Notes\n'

    teachingLoads.forEach(load => {
      if (load.faculty && load.course) {
        csvContent += `"${load.faculty.full_name}",`
        csvContent += `${load.faculty.faculty_id},`
        csvContent += `"${load.faculty.email || ''}",`
        csvContent += `${load.course.course_code},`
        csvContent += `"${load.course.course_name}",`
        csvContent += `${load.course.credit_units},`
        csvContent += `${load.academic_year},`
        csvContent += `"${load.semester}",`
        csvContent += `"${load.section || ''}",`
        csvContent += `"${load.notes || ''}"\n`
      }
    })

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `teaching_loads_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setNotification({ type: 'success', message: 'Teaching loads exported!' })
  }

  // Get initials for avatar
  const getInitials = (name: string): string => {
    const parts = name.split(' ').filter(p => p.length > 0)
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  // Get employment badge color
  const getEmploymentColor = (type: string) => {
    switch (type) {
      case 'full-time': return '#22c55e'
      case 'part-time': return '#f59e0b'
      case 'adjunct': return '#8b5cf6'
      case 'guest': return '#06b6d4'
      default: return '#64748b'
    }
  }

  return (
    <div className={styles.pageLayout} data-page="admin">
      <MenuBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} showSidebarToggle={true} showAccountIcon={true} />
      <Sidebar isOpen={sidebarOpen} />

      <main className={`${styles.pageMain} ${!sidebarOpen ? styles.fullWidth : ''}`}>
        <div className={styles.pageContainer}>

          {/* Notification */}
          {notification && (
            <div style={{
              position: 'fixed',
              top: '80px',
              right: '24px',
              padding: '14px 20px',
              borderRadius: '12px',
              background: notification.type === 'success' ? '#c6f6d5' : '#fed7d7',
              color: notification.type === 'success' ? '#276749' : '#c53030',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              zIndex: 2000,
              fontWeight: 600,
              fontSize: '14px'
            }}>
              {notification.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
              {notification.message}
            </div>
          )}

          {/* Header */}
          <div className={styles.welcomeSection}>
            <h1 className={styles.welcomeTitle}>
              <BookMarked size={32} style={{ marginRight: '12px' }} />
              Teaching Load Assignment
            </h1>
            <p className={styles.welcomeSubtitle}>
              Assign courses to faculty members and manage teaching loads
            </p>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowUploadCSVModal(true)}
              style={{
                padding: '12px 20px',
                background: 'var(--primary-gradient)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Upload size={20} />
              Upload CSV
            </button>
            <button
              onClick={downloadTemplate}
              style={{
                padding: '12px 20px',
                background: 'var(--bg-gray-100, #edf2f7)',
                color: 'var(--text-dark, #1a202c)',
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: '10px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Download size={20} />
              Download Template
            </button>
            <button
              onClick={downloadAssignments}
              style={{
                padding: '12px 20px',
                background: 'var(--bg-gray-100, #edf2f7)',
                color: 'var(--text-dark, #1a202c)',
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: '10px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <FileText size={20} />
              Export All Assignments
            </button>
          </div>

          {/* Search and Filters */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div className={styles.searchBox} style={{ flex: '1', minWidth: '260px' }}>
              <Search className={styles.searchIcon} size={18} />
              <input
                type="text"
                placeholder="Search faculty by name, email, department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.searchInput}
              />
            </div>

            <select
              value={filterCollege}
              onChange={(e) => { setFilterCollege(e.target.value); setFilterDepartment('all') }}
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                border: '2px solid var(--border-color, #e2e8f0)',
                background: 'var(--bg-white, #fff)',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                minWidth: '160px',
                color: 'var(--text-dark, #1a202c)'
              }}
            >
              <option value="all">All Colleges</option>
              {getColleges().map(college => (
                <option key={college} value={college}>{college}</option>
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
                minWidth: '180px',
                color: 'var(--text-dark, #1a202c)'
              }}
            >
              <option value="all">All Departments</option>
              {getDepartments().map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>

            <select
              value={filterAcademicYear}
              onChange={(e) => setFilterAcademicYear(e.target.value)}
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                border: '2px solid var(--border-color, #e2e8f0)',
                background: 'var(--bg-white, #fff)',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                minWidth: '180px',
                color: 'var(--text-dark, #1a202c)'
              }}
            >
              <option value="all">All Academic Years</option>
              {academicYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>

            <select
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value)}
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                border: '2px solid var(--border-color, #e2e8f0)',
                background: 'var(--bg-white, #fff)',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                minWidth: '160px',
                color: 'var(--text-dark, #1a202c)'
              }}
            >
              <option value="all">All Semesters</option>
              {semesters.map(sem => (
                <option key={sem} value={sem}>{sem}</option>
              ))}
            </select>
          </div>

          {/* Faculty Grid */}
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className={styles.spinner}></div>
              <p>Loading faculty and courses...</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '16px' }}>
              {getFilteredFaculties().map(faculty => {
                const isExpanded = expandedFaculties.has(faculty.id)
                const facultyLoads = getTeachingLoadsForFaculty(faculty.id)
                const units = getTotalUnits(faculty.id)

                return (
                  <div key={faculty.id} style={{
                    background: 'var(--bg-white, #ffffff)',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderRadius: '14px',
                    padding: '16px',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ display: 'flex', gap: '12px', flex: 1 }}>
                        <div style={{
                          width: 48, height: 48, borderRadius: '50%', color: 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: getEmploymentColor(faculty.employment_type), flexShrink: 0,
                          fontWeight: 700
                        }}>
                          {getInitials(faculty.full_name)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-dark, #1a202c)' }}>{faculty.full_name}</div>
                          <div style={{ fontSize: 13, color: 'var(--text-medium, #718096)' }}>{faculty.department} • {faculty.position}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-light, #a0aec0)' }}>{faculty.email}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button title="Assign Courses" onClick={() => openAssignModal(faculty)} style={{
                          background: 'var(--bg-gray-100, #edf2f7)', border: '1px solid var(--border-color)',
                          borderRadius: 10, padding: 8, cursor: 'pointer'
                        }}>
                          <Plus size={18} />
                        </button>
                        <button title={isExpanded ? 'Collapse' : 'Expand'} onClick={() => toggleFaculty(faculty.id)} style={{
                          background: 'var(--bg-gray-100, #edf2f7)', border: '1px solid var(--border-color)',
                          borderRadius: 10, padding: 8, cursor: 'pointer'
                        }}>
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: 12, background: 'var(--bg-gray-50, #f7fafc)', borderRadius: 10, marginTop: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-medium, #718096)' }}>
                        <BookOpen size={16} />
                        <span>{facultyLoads.length} course(s)</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-medium, #718096)' }}>
                        <Calendar size={16} />
                        <span>{units.total} total units</span>
                      </div>
                      <div style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: 'var(--bg-gray-100, #edf2f7)', color: 'var(--text-medium, #718096)', textTransform: 'capitalize' }}>
                        {faculty.employment_type}
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ marginTop: 12 }}>
                        {facultyLoads.length === 0 ? (
                          <div style={{ textAlign: 'center', color: 'var(--text-light, #a0aec0)', padding: 12 }}>No courses assigned yet</div>
                        ) : (
                          facultyLoads.map(load => (
                            <div key={load.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 12, background: 'var(--bg-gray-50, #f7fafc)', borderRadius: 10, marginBottom: 8 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <strong>{load.course?.course_code}</strong>
                                  <span style={{ fontSize: 12, color: 'var(--text-medium, #718096)', background: 'white', padding: '2px 8px', borderRadius: 6 }}>{load.course?.credit_units} units</span>
                                </div>
                                <div style={{ fontSize: 14, color: 'var(--text-medium, #718096)' }}>{load.course?.course_name}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-light, #a0aec0)' }}>
                                  {load.academic_year} • {load.semester}{load.section ? ` • ${load.section}` : ''}
                                </div>
                                {load.notes && (
                                  <div style={{ fontSize: 12, color: 'var(--text-medium, #718096)', fontStyle: 'italic' }}>{load.notes}</div>
                                )}
                              </div>
                              <button onClick={() => setShowDeleteConfirm(load.id)} title="Remove" style={{ background: 'transparent', border: 'none', color: '#ef4444', padding: 8, cursor: 'pointer' }}>
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Assign Courses Modal */}
          {showAssignCoursesModal && selectedFaculty && (
            <div className={stylesLocal.modalOverlay} onClick={() => setShowAssignCoursesModal(false)}>
              <div className={stylesLocal.modalContent} onClick={(e) => e.stopPropagation()}>
                <div className={stylesLocal.modalHeader}>
                  <h2>Assign Courses to {selectedFaculty.full_name}</h2>
                  <button onClick={() => setShowAssignCoursesModal(false)}>
                    <X size={24} />
                  </button>
                </div>

                <div className={stylesLocal.modalBody}>
                  {/* Assignment Details */}
                  <div className={stylesLocal.formGrid}>
                    <div className={stylesLocal.formGroup}>
                      <label>Academic Year</label>
                      <select
                        value={assignmentAcademicYear}
                        onChange={(e) => setAssignmentAcademicYear(e.target.value)}
                      >
                        {academicYears.map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>

                    <div className={stylesLocal.formGroup}>
                      <label>Semester</label>
                      <select
                        value={assignmentSemester}
                        onChange={(e) => setAssignmentSemester(e.target.value)}
                      >
                        {semesters.map(sem => (
                          <option key={sem} value={sem}>{sem}</option>
                        ))}
                      </select>
                    </div>

                    <div className={stylesLocal.formGroup}>
                      <label>Section (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g., BSCS 1A"
                        value={assignmentSection}
                        onChange={(e) => setAssignmentSection(e.target.value)}
                      />
                    </div>

                    <div className={stylesLocal.formGroup}>
                      <label>Notes (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g., Main instructor"
                        value={assignmentNotes}
                        onChange={(e) => setAssignmentNotes(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Course Selection */}
                  <div className={stylesLocal.courseSelection}>
                    <h3>Select Courses ({selectedCourses.length} selected)</h3>
                    <div className={stylesLocal.courseCheckboxList}>
                      {courses
                        .filter(c => 
                          c.college === selectedFaculty.college ||
                          c.department === selectedFaculty.department
                        )
                        .map(course => (
                          <label key={course.id} className={stylesLocal.courseCheckbox}>
                            <input
                              type="checkbox"
                              checked={selectedCourses.includes(course.id)}
                              onChange={() => toggleCourseSelection(course.id)}
                            />
                            <div className={stylesLocal.courseDetails}>
                              <div className={stylesLocal.courseCodeName}>
                                <strong>{course.course_code}</strong>
                                <span>{course.course_name}</span>
                              </div>
                              <div className={stylesLocal.courseMetaSmall}>
                                Year {course.year_level} • {course.credit_units} units • {course.semester}
                              </div>
                            </div>
                          </label>
                        ))}
                    </div>
                  </div>
                </div>

                <div className={stylesLocal.modalFooter}>
                  <button
                    className={stylesLocal.secondaryButton}
                    onClick={() => setShowAssignCoursesModal(false)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    className={stylesLocal.primaryButton}
                    onClick={saveTeachingAssignments}
                    disabled={saving || selectedCourses.length === 0}
                  >
                    {saving ? 'Saving...' : `Assign ${selectedCourses.length} Course(s)`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CSV Upload Modal */}
          {showUploadCSVModal && (
            <div className={stylesLocal.modalOverlay} onClick={() => setShowUploadCSVModal(false)}>
              <div className={stylesLocal.modalContent} onClick={(e) => e.stopPropagation()}>
                <div className={stylesLocal.modalHeader}>
                  <h2>Upload Teaching Load CSV</h2>
                  <button onClick={() => setShowUploadCSVModal(false)}>
                    <X size={24} />
                  </button>
                </div>

                <div className={stylesLocal.modalBody}>
                  <div className={stylesLocal.uploadInstructions}>
                    <p><strong>CSV Format:</strong></p>
                    <p>faculty_id, course_code, academic_year, semester, section, notes</p>
                    <button
                      className={stylesLocal.secondaryButton}
                      onClick={downloadTemplate}
                      style={{ marginTop: '10px' }}
                    >
                      <Download size={18} />
                      Download Template
                    </button>
                  </div>

                  <div className={stylesLocal.fileUpload}>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleCSVUpload}
                      id="csvInput"
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="csvInput" className={stylesLocal.uploadButton}>
                      <Upload size={24} />
                      {csvFile ? csvFile.name : 'Choose CSV File'}
                    </label>
                  </div>

                  {csvPreview && (
                    <div className={stylesLocal.csvPreview}>
                      <h4>Preview (first 10 lines):</h4>
                      <pre>{csvPreview}</pre>
                    </div>
                  )}
                </div>

                <div className={stylesLocal.modalFooter}>
                  <button
                    className={stylesLocal.secondaryButton}
                    onClick={() => {
                      setShowUploadCSVModal(false)
                      setCsvFile(null)
                      setCsvPreview('')
                    }}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    className={stylesLocal.primaryButton}
                    onClick={processCSVUpload}
                    disabled={saving || !csvFile}
                  >
                    {saving ? 'Processing...' : 'Upload & Import'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {showDeleteConfirm !== null && (
            <div className={stylesLocal.modalOverlay} onClick={() => setShowDeleteConfirm(null)}>
              <div className={stylesLocal.modalContent} style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
                <div className={stylesLocal.modalHeader}>
                  <h2>Confirm Delete</h2>
                  <button onClick={() => setShowDeleteConfirm(null)}>
                    <X size={24} />
                  </button>
                </div>

                <div className={stylesLocal.modalBody}>
                  <p>Are you sure you want to remove this course assignment?</p>
                </div>

                <div className={stylesLocal.modalFooter}>
                  <button
                    className={stylesLocal.secondaryButton}
                    onClick={() => setShowDeleteConfirm(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className={stylesLocal.dangerButton}
                    onClick={() => deleteTeachingLoad(showDeleteConfirm)}
                  >
                    <Trash2 size={18} />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

// ==================== Wrapper Component ====================
export default function TeachingLoadAssignmentPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TeachingLoadAssignmentContent />
    </Suspense>
  )
}
