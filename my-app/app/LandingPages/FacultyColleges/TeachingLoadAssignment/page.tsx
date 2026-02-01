'use client'

import { Suspense, useEffect, useState } from 'react'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import styles from '../../CoursesManagement/ClassSchedules.module.css'
import stylesLocal from './styles.module.css'
import { supabase } from '@/lib/supabaseClient'
import { useColleges } from '@/app/context/CollegesContext'
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
  BookMarked,
  Layers
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ==================== Interfaces ====================
interface Course {
  id: number
  upload_group_id?: number
  course_code: string
  course_name: string
  section?: string
  lec_hours: number
  lab_hours: number
  total_hours?: number // Computed: lec_hours + lab_hours
  semester: string
  academic_year: string
  department: string
  college: string
  degree_program: string | null
  year_level: number
  prerequisite?: string
  file_name?: string
  status?: string
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

interface Section {
  id: number
  section_name: string
  year_batch_id: number
  year_level: number
  degree_program: string
  department?: string | null
  college?: string | null
  student_count: number
  max_capacity: number
  is_active?: boolean
  created_at: string
}

interface SectionCourseAssignment {
  id: number
  section_id: number
  course_id: number
  created_at: string
}

// ==================== Main Component ====================
function TeachingLoadAssignmentContent() {
  const router = useRouter()
  const { activeColleges: bulsuColleges } = useColleges()

  // Options
  const semesters = ['First Semester', 'Second Semester', 'Summer']
  const currentYear = new Date().getFullYear()
  const academicYears = [
    `${currentYear}-${currentYear + 1}`,
    `${currentYear + 1}-${currentYear + 2}`,
    `${currentYear - 1}-${currentYear}`
  ]

  // State
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [faculties, setFaculties] = useState<FacultyProfile[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [sectionCourseAssignments, setSectionCourseAssignments] = useState<SectionCourseAssignment[]>([])
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
  const [assignmentAcademicYear, setAssignmentAcademicYear] = useState<string>(academicYears[0])
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null)
  const [assignmentSection, setAssignmentSection] = useState<string>('')
  const [assignmentNotes, setAssignmentNotes] = useState<string>('')
  
  // Course filter states for modal
  const [courseFilterDegreeProgram, setCourseFilterDegreeProgram] = useState<string>('all')
  const [courseFilterYearLevel, setCourseFilterYearLevel] = useState<string>('all')
  const [courseFilterSemester, setCourseFilterSemester] = useState<string>('all')
  const [courseSearchTerm, setCourseSearchTerm] = useState<string>('')

  // CSV upload
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvPreview, setCsvPreview] = useState<string>('')

  // Notification
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)

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

  // Lock background scroll when any modal is open
  const anyModalOpen = showAssignCoursesModal || showUploadCSVModal || showDeleteConfirm !== null
  useEffect(() => {
    const body = document.body
    if (anyModalOpen) {
      body.style.overflow = 'hidden'
    } else {
      body.style.overflow = ''
    }
    return () => {
      body.style.overflow = ''
    }
  }, [anyModalOpen])

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
      // Get unique courses (deduplicate by course_code + semester + academic_year)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: coursesData, error: coursesError } = await (supabase as any)
        .from('class_schedules')
        .select('*')
        .not('course_code', 'is', null)
        .not('course_name', 'is', null)
        .order('course_code', { ascending: true })

      if (coursesError) {
        console.error('Error fetching courses:', coursesError)
        throw coursesError
      }

      // Deduplicate courses by course_code + degree_program + year_level + semester
      const uniqueCourses = new Map<string, Course>()
      coursesData?.forEach((course: Course) => {
        const key = `${course.course_code}-${course.degree_program || 'unknown'}-${course.year_level}-${course.semester}`
        if (!uniqueCourses.has(key)) {
          uniqueCourses.set(key, course)
        }
      })

      const deduplicatedCourses = Array.from(uniqueCourses.values())
      console.log('Fetched courses:', deduplicatedCourses.length, 'unique courses from', coursesData?.length || 0, 'total records')
      setCourses(deduplicatedCourses)

      // Fetch sections
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sectionsData, error: sectionsError } = await (supabase as any)
        .from('sections')
        .select('*')
        .order('section_name', { ascending: true })

      if (sectionsError) {
        console.log('sections table may not exist:', sectionsError)
        setSections([])
      } else {
        setSections(sectionsData || [])
      }

      // Fetch section course assignments
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: assignmentsData, error: assignmentsError } = await (supabase as any)
        .from('section_course_assignments')
        .select('*')

      if (assignmentsError) {
        console.log('section_course_assignments table may not exist:', assignmentsError)
        setSectionCourseAssignments([])
      } else {
        setSectionCourseAssignments(assignmentsData || [])
      }

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
      // Fetch teaching loads with joined course data from class_schedules
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: loadsData, error: loadsError } = await (supabase as any)
        .from('teaching_loads')
        .select(`
          *,
          class_schedules:course_id (
            id,
            course_code,
            course_name,
            section,
            lec_hours,
            lab_hours,
            semester,
            academic_year,
            department,
            college,
            degree_program,
            year_level
          )
        `)
        .order('created_at', { ascending: false })

      if (loadsError) {
        console.log('teaching_loads table may not exist:', loadsError)
        setTeachingLoads([])
        return
      }

      // Combine with faculty data and use joined course data
      const enrichedLoads = loadsData?.map((load: any) => {
        const faculty = faculties.find(f => f.id === load.faculty_id)
        // Use the joined class_schedules data as course, or fallback to finding in courses array
        const course = load.class_schedules || courses.find(c => c.id === load.course_id)
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

  // Include prior academic years from this faculty's history
  const getAcademicYearOptionsForFaculty = (faculty: FacultyProfile | null) => {
    const years = new Set(academicYears)
    if (faculty) {
      getTeachingLoadsForFaculty(faculty.id).forEach(load => years.add(load.academic_year))
    }
    return Array.from(years).sort((a, b) => {
      const startA = parseInt(a.split('-')[0] || '0', 10)
      const startB = parseInt(b.split('-')[0] || '0', 10)
      return startB - startA
    })
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

  // Calculate total hours for faculty
  const getTotalUnits = (facultyId: string): { total: number, lec: number, lab: number } => {
    const loads = getTeachingLoadsForFaculty(facultyId)
    let totalLec = 0
    let totalLab = 0

    loads.forEach(load => {
      if (load.course) {
        totalLec += load.course.lec_hours || 0
        totalLab += load.course.lab_hours || 0
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
    setAssignmentAcademicYear(getAcademicYearOptionsForFaculty(faculty)[0] || academicYears[0])
    setSelectedSectionId(null)
    setAssignmentSection('')
    setAssignmentNotes('')
    setCourseFilterDegreeProgram('all')
    setCourseFilterYearLevel('all')
    setCourseFilterSemester('all')  // Changed from 'First Semester' to 'all'
    setCourseSearchTerm('')
    setShowAssignCoursesModal(true)
  }

  // Get filtered sections for dropdown
  const getAvailableSections = () => {
    if (!selectedFaculty) return []
    
    return sections.filter(s => 
      (s.college === selectedFaculty.college || s.department === selectedFaculty.department) &&
      s.is_active !== false
    )
  }

  // Get courses assigned to a section
  const getCoursesForSection = (sectionId: number): number[] => {
    return sectionCourseAssignments
      .filter(a => a.section_id === sectionId)
      .map(a => a.course_id)
  }

  // When section is selected, auto-populate courses
  const handleSectionChange = (sectionId: number | null) => {
    setSelectedSectionId(sectionId)
    
    if (sectionId) {
      const section = sections.find(s => s.id === sectionId)
      if (section) {
        setAssignmentSection(section.section_name)
        // Auto-select courses assigned to this section
        const sectionCourses = getCoursesForSection(sectionId)
        setSelectedCourses(sectionCourses)
        
        // Auto-set filters based on section
        setCourseFilterDegreeProgram(section.degree_program)
        setCourseFilterYearLevel(section.year_level.toString())
      }
    } else {
      setAssignmentSection('')
    }
  }

  // Get degree programs from courses
  const getDegreePrograms = () => {
    const programs = new Set<string>()
    courses.forEach(c => {
      if (c.degree_program) programs.add(c.degree_program)
    })
    return Array.from(programs).sort()
  }

  // Get filtered courses for assignment modal
  const getFilteredCoursesForAssignment = () => {
    let filtered = [...courses]

    console.log('Total courses before filtering:', filtered.length)
    console.log('Selected faculty:', selectedFaculty?.college, selectedFaculty?.department)

    // Filter by faculty's college/department (more lenient - show all if college/dept match OR are in same general area)
    if (selectedFaculty) {
      // If faculty has college or department, try to match, otherwise show all
      if (selectedFaculty.college || selectedFaculty.department) {
        filtered = filtered.filter(c => {
          const collegeMatch = selectedFaculty.college && c.college && c.college.toLowerCase().includes(selectedFaculty.college.toLowerCase())
          const deptMatch = selectedFaculty.department && c.department && c.department.toLowerCase().includes(selectedFaculty.department.toLowerCase())
          const reverseCollegeMatch = selectedFaculty.college && c.college && selectedFaculty.college.toLowerCase().includes(c.college.toLowerCase())
          const reverseDeptMatch = selectedFaculty.department && c.department && selectedFaculty.department.toLowerCase().includes(c.department.toLowerCase())
          
          return collegeMatch || deptMatch || reverseCollegeMatch || reverseDeptMatch
        })
      }
    }

    console.log('After college/dept filter:', filtered.length)

    // Apply degree program filter
    if (courseFilterDegreeProgram !== 'all') {
      filtered = filtered.filter(c => c.degree_program === courseFilterDegreeProgram)
      console.log('After degree program filter:', filtered.length)
    }

    // Apply year level filter
    if (courseFilterYearLevel !== 'all') {
      filtered = filtered.filter(c => c.year_level === parseInt(courseFilterYearLevel))
      console.log('After year level filter:', filtered.length)
    }

    // Apply semester filter
    if (courseFilterSemester !== 'all') {
      filtered = filtered.filter(c => c.semester === courseFilterSemester)
      console.log('After semester filter:', filtered.length)
    }

    // Apply search filter
    if (courseSearchTerm) {
      const term = courseSearchTerm.toLowerCase()
      filtered = filtered.filter(c => 
        c.course_code.toLowerCase().includes(term) ||
        c.course_name.toLowerCase().includes(term)
      )
    }

    return filtered.sort((a, b) => {
      // Sort by year level, then semester, then course code
      if (a.year_level !== b.year_level) return a.year_level - b.year_level
      if (a.semester !== b.semester) return a.semester.localeCompare(b.semester)
      return a.course_code.localeCompare(b.course_code)
    })
  }

  // Group courses by degree program and year level
  const getGroupedCourses = () => {
    const filtered = getFilteredCoursesForAssignment()
    const grouped = new Map<string, Map<number, Course[]>>()

    filtered.forEach(course => {
      const program = course.degree_program || 'Unknown Program'
      
      if (!grouped.has(program)) {
        grouped.set(program, new Map())
      }
      const programMap = grouped.get(program)!
      
      if (!programMap.has(course.year_level)) {
        programMap.set(course.year_level, [])
      }
      programMap.get(course.year_level)!.push(course)
    })

    return grouped
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
      const existingLoads = getTeachingLoadsForFaculty(selectedFaculty.id)
      const existingKeys = new Set(existingLoads.map(load => buildAssignmentKey(load.course_id, load.academic_year, load.semester, load.section)))

      // Create teaching load entries
      const assignments = selectedCourses.map(courseId => ({
        faculty_id: selectedFaculty.id,
        course_id: courseId,
        academic_year: assignmentAcademicYear,
        semester: assignmentSemester,
        section: assignmentSection || null,
        notes: assignmentNotes || null
      }))

      const dedupedAssignments = assignments.filter(a => !existingKeys.has(buildAssignmentKey(a.course_id, a.academic_year, a.semester, a.section)))

      if (dedupedAssignments.length === 0) {
        setNotification({ type: 'error', message: 'These courses are already assigned for this academic year and semester.' })
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('teaching_loads')
        .insert(dedupedAssignments)

      if (error) {
        console.error('Error saving assignments:', error?.message || error)
        throw error
      }

      setNotification({ type: 'success', message: `Assigned ${dedupedAssignments.length} course(s) successfully!` })
      setShowAssignCoursesModal(false)
      await fetchTeachingLoads()
    } catch (error: any) {
      const message = error?.message || 'Failed to save assignments. Please try again.'
      console.error('Error saving assignments:', error)
      setNotification({ type: 'error', message })
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
    // Comprehensive CSV header with all relevant data
    let csvContent = 'Faculty ID,Faculty Name,Email,Position,Employment Type,Department,College,Specialization,Course Code,Course Name,Lec Hours,Lab Hours,Total Units,Degree Program,Year Level,Academic Year,Semester,Section,Notes\n'

    // Group loads by faculty for better organization
    const facultyMap = new Map<string, TeachingLoadWithDetails[]>()
    teachingLoads.forEach(load => {
      if (load.faculty) {
        const existing = facultyMap.get(load.faculty.id) || []
        existing.push(load)
        facultyMap.set(load.faculty.id, existing)
      }
    })

    // Export all assignments grouped by faculty
    facultyMap.forEach((loads) => {
      loads.forEach(load => {
        if (load.faculty && load.course) {
          const lecHours = load.course.lec_hours || 0
          const labHours = load.course.lab_hours || 0
          const totalUnits = lecHours + labHours
          
          csvContent += `"${load.faculty.faculty_id}",`
          csvContent += `"${load.faculty.full_name}",`
          csvContent += `"${load.faculty.email || ''}",`
          csvContent += `"${load.faculty.position || ''}",`
          csvContent += `"${load.faculty.employment_type || ''}",`
          csvContent += `"${load.faculty.department || ''}",`
          csvContent += `"${load.faculty.college || ''}",`
          csvContent += `"${load.faculty.specialization || ''}",`
          csvContent += `"${load.course.course_code}",`
          csvContent += `"${load.course.course_name}",`
          csvContent += `${lecHours},`
          csvContent += `${labHours},`
          csvContent += `${totalUnits},`
          csvContent += `"${load.course.degree_program || ''}",`
          csvContent += `${load.course.year_level || ''},`
          csvContent += `"${load.academic_year}",`
          csvContent += `"${load.semester}",`
          csvContent += `"${load.section || ''}",`
          csvContent += `"${load.notes || ''}"\n`
        }
      })
    })

    // Also include faculty with no assignments for completeness
    faculties.forEach(faculty => {
      if (!facultyMap.has(faculty.id)) {
        csvContent += `"${faculty.faculty_id}",`
        csvContent += `"${faculty.full_name}",`
        csvContent += `"${faculty.email || ''}",`
        csvContent += `"${faculty.position || ''}",`
        csvContent += `"${faculty.employment_type || ''}",`
        csvContent += `"${faculty.department || ''}",`
        csvContent += `"${faculty.college || ''}",`
        csvContent += `"${faculty.specialization || ''}",`
        csvContent += `"(No courses assigned)",`
        csvContent += `"",`
        csvContent += `0,`
        csvContent += `0,`
        csvContent += `0,`
        csvContent += `"",`
        csvContent += `"",`
        csvContent += `"",`
        csvContent += `"",`
        csvContent += `"",`
        csvContent += `""\n`
      }
    })

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `teaching_load_assignments_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    const totalAssignments = teachingLoads.filter(l => l.faculty && l.course).length
    setNotification({ type: 'success', message: `Exported ${totalAssignments} assignments for ${faculties.length} faculty members!` })
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

  const buildAssignmentKey = (courseId: number, ay: string, sem: string, section?: string | null) =>
    `${courseId}::${ay}::${sem}::${section || ''}`

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
              {bulsuColleges.map(college => (
                <option key={college.code} value={college.name}>{college.name}</option>
              ))}
              {getColleges().filter(college => !bulsuColleges.some(bc => bc.name === college)).map(college => (
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
                          <div style={{ fontWeight: 700, color: 'var(--text-dark, #1a202c)' }}>
                            {faculty.full_name}
                            <span style={{ 
                              marginLeft: 8, 
                              fontSize: 12, 
                              fontWeight: 600, 
                              padding: '2px 8px', 
                              background: 'var(--primary-gradient, linear-gradient(135deg, #667eea, #764ba2))', 
                              color: 'white', 
                              borderRadius: 6 
                            }}>
                              ID: {faculty.faculty_id}
                            </span>
                          </div>
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
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <strong style={{ fontSize: 15 }}>{load.course?.course_code}</strong>
                                    {load.course?.degree_program && (
                                      <span style={{ 
                                        fontSize: 11, 
                                        padding: '2px 6px', 
                                        background: 'var(--primary-gradient)', 
                                        color: 'white',
                                        borderRadius: 4,
                                        fontWeight: 600
                                      }}>
                                        {load.course.degree_program}
                                      </span>
                                    )}
                                  </div>
                                  <span style={{ fontSize: 12, color: 'var(--text-medium, #718096)', background: 'white', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>
                                    {(load.course?.lec_hours || 0) + (load.course?.lab_hours || 0)} hrs
                                  </span>
                                </div>
                                <div style={{ fontSize: 14, color: 'var(--text-medium, #718096)', marginBottom: 6 }}>
                                  {load.course?.course_name}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-light, #a0aec0)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                  <span>Year {load.course?.year_level}</span>
                                  <span>•</span>
                                  <span>{load.academic_year}</span>
                                  <span>•</span>
                                  <span>{load.semester}</span>
                                  {load.section && (
                                    <>
                                      <span>•</span>
                                      <span style={{ fontWeight: 600, color: 'var(--text-medium, #718096)' }}>{load.section}</span>
                                    </>
                                  )}
                                </div>
                                {load.notes && (
                                  <div style={{ fontSize: 12, color: 'var(--text-medium, #718096)', fontStyle: 'italic', marginTop: 4 }}>
                                    Note: {load.notes}
                                  </div>
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
                  <div className={stylesLocal.facultyInfoBar}>
                    <div><strong>Department:</strong> {selectedFaculty.department || 'N/A'}</div>
                    <div><strong>College:</strong> {selectedFaculty.college || 'N/A'}</div>
                    <div><strong>Email:</strong> {selectedFaculty.email || 'N/A'}</div>
                    <div><strong>Employment:</strong> {selectedFaculty.employment_type}</div>
                  </div>

                  <div className={stylesLocal.historySection}>
                    <div className={stylesLocal.historyHeader}>Teaching History</div>
                    {getTeachingLoadsForFaculty(selectedFaculty.id).length === 0 ? (
                      <div className={stylesLocal.historyEmpty}>No previous assignments yet.</div>
                    ) : (
                      <div className={stylesLocal.historyList}>
                        {getTeachingLoadsForFaculty(selectedFaculty.id)
                          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                          .map(load => (
                            <div key={load.id} className={stylesLocal.historyItem}>
                              <div className={stylesLocal.historyTop}>
                                <span className={stylesLocal.historyCourse}>{load.course?.course_code || 'Course'}</span>
                                <span className={stylesLocal.historyMeta}>{load.academic_year} • {load.semester}</span>
                              </div>
                              <div className={stylesLocal.historyName}>{load.course?.course_name || 'Untitled course'}</div>
                              <div className={stylesLocal.historyMetaSmall}>Section: {load.section || 'N/A'}</div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Assignment Details */}
                  <div className={stylesLocal.formGrid}>
                    <div className={stylesLocal.formGroup}>
                      <label>Academic Year</label>
                      <select
                        value={assignmentAcademicYear}
                        onChange={(e) => setAssignmentAcademicYear(e.target.value)}
                      >
                        {getAcademicYearOptionsForFaculty(selectedFaculty).map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>

                    <div className={stylesLocal.formGroup}>
                      <label>Semester</label>
                      <select
                        value={assignmentSemester}
                        onChange={(e) => {
                          setAssignmentSemester(e.target.value)
                          setCourseFilterSemester(e.target.value)
                        }}
                      >
                        {semesters.map(sem => (
                          <option key={sem} value={sem}>{sem}</option>
                        ))}
                      </select>
                    </div>

                    <div className={stylesLocal.formGroup}>
                      <label>Select Section (Optional)</label>
                      <select
                        value={selectedSectionId || ''}
                        onChange={(e) => handleSectionChange(e.target.value ? parseInt(e.target.value) : null)}
                      >
                        <option value="">-- None / Enter Manually --</option>
                        {getAvailableSections().map(section => (
                          <option key={section.id} value={section.id}>
                            {section.section_name} ({section.degree_program} - Year {section.year_level})
                          </option>
                        ))}
                      </select>
                      <small style={{ fontSize: '12px', color: 'var(--text-light, #a0aec0)', marginTop: '4px', display: 'block' }}>
                        {selectedSectionId ? 'Courses auto-populated from section' : 'Or enter section name manually below'}
                      </small>
                    </div>

                    <div className={stylesLocal.formGroup}>
                      <label>Section Name (Manual Entry)</label>
                      <input
                        type="text"
                        placeholder="e.g., BSCS 1A"
                        value={assignmentSection}
                        onChange={(e) => setAssignmentSection(e.target.value)}
                        disabled={selectedSectionId !== null}
                      />
                    </div>

                    <div className={stylesLocal.formGroup} style={{ gridColumn: '1 / -1' }}>
                      <label>Notes (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g., Main instructor"
                        value={assignmentNotes}
                        onChange={(e) => setAssignmentNotes(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Course Filters */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                    gap: '12px',
                    marginTop: '20px',
                    marginBottom: '16px',
                    padding: '16px',
                    background: 'var(--bg-gray-50, #f7fafc)',
                    borderRadius: '10px'
                  }}>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-medium, #718096)', marginBottom: '6px', display: 'block' }}>
                        Search Courses
                      </label>
                      <input
                        type="text"
                        placeholder="Search by code or name..."
                        value={courseSearchTerm}
                        onChange={(e) => setCourseSearchTerm(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color, #e2e8f0)',
                          fontSize: '14px'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-medium, #718096)', marginBottom: '6px', display: 'block' }}>
                        Degree Program
                      </label>
                      <select
                        value={courseFilterDegreeProgram}
                        onChange={(e) => setCourseFilterDegreeProgram(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color, #e2e8f0)',
                          fontSize: '14px'
                        }}
                      >
                        <option value="all">All Programs</option>
                        {getDegreePrograms().map(program => (
                          <option key={program} value={program}>{program}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-medium, #718096)', marginBottom: '6px', display: 'block' }}>
                        Year Level
                      </label>
                      <select
                        value={courseFilterYearLevel}
                        onChange={(e) => setCourseFilterYearLevel(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color, #e2e8f0)',
                          fontSize: '14px'
                        }}
                      >
                        <option value="all">All Years</option>
                        <option value="1">1st Year</option>
                        <option value="2">2nd Year</option>
                        <option value="3">3rd Year</option>
                        <option value="4">4th Year</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-medium, #718096)', marginBottom: '6px', display: 'block' }}>
                        Semester
                      </label>
                      <select
                        value={courseFilterSemester}
                        onChange={(e) => setCourseFilterSemester(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color, #e2e8f0)',
                          fontSize: '14px'
                        }}
                      >
                        <option value="all">All Semesters</option>
                        {semesters.map(sem => (
                          <option key={sem} value={sem}>{sem}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Course Selection - Grouped by Program and Year */}
                  <div className={stylesLocal.courseSelection}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h3>Select Courses ({selectedCourses.length} selected)</h3>
                      <button
                        onClick={() => setSelectedCourses([])}
                        style={{
                          padding: '6px 12px',
                          background: 'var(--bg-gray-100, #edf2f7)',
                          border: '1px solid var(--border-color, #e2e8f0)',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          color: 'var(--text-medium, #718096)'
                        }}
                      >
                        Clear All
                      </button>
                    </div>

                    <div style={{ maxHeight: '450px', overflowY: 'auto', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '10px', padding: '12px' }}>
                      {getGroupedCourses().size === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light, #a0aec0)' }}>
                          <BookOpen size={48} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                          <p style={{ marginBottom: '8px', fontSize: '15px', fontWeight: 600 }}>No courses found matching your filters</p>
                          {courses.length === 0 ? (
                            <p style={{ fontSize: '13px', color: 'var(--text-light, #a0aec0)' }}>
                              No courses available in the database. Please add courses in Course Management.
                            </p>
                          ) : (
                            <p style={{ fontSize: '13px', color: 'var(--text-light, #a0aec0)' }}>
                              Try adjusting your filters above or check the browser console for details.
                            </p>
                          )}
                        </div>
                      ) : (
                        Array.from(getGroupedCourses()).map(([program, yearMap]) => (
                          <div key={program} style={{ marginBottom: '20px' }}>
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '8px',
                              padding: '8px 12px',
                              background: 'var(--primary-gradient)',
                              color: 'white',
                              borderRadius: '8px',
                              fontWeight: 700,
                              fontSize: '15px',
                              marginBottom: '12px'
                            }}>
                              <GraduationCap size={20} />
                              {program}
                            </div>

                            {Array.from(yearMap).sort(([a], [b]) => a - b).map(([yearLevel, coursesInYear]) => (
                              <div key={yearLevel} style={{ marginBottom: '16px', marginLeft: '12px' }}>
                                <div style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '6px',
                                  padding: '6px 10px',
                                  background: 'var(--bg-gray-100, #edf2f7)',
                                  borderRadius: '6px',
                                  fontWeight: 600,
                                  fontSize: '14px',
                                  color: 'var(--text-dark, #1a202c)',
                                  marginBottom: '8px'
                                }}>
                                  <Layers size={16} />
                                  Year {yearLevel} - {coursesInYear.length} course(s)
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginLeft: '8px' }}>
                                  {coursesInYear.map(course => (
                                    <label 
                                      key={course.id} 
                                      style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '10px',
                                        padding: '10px 12px',
                                        background: selectedCourses.includes(course.id) 
                                          ? 'rgba(99, 102, 241, 0.1)' 
                                          : 'var(--bg-white, #fff)',
                                        border: selectedCourses.includes(course.id)
                                          ? '2px solid rgba(99, 102, 241, 0.5)'
                                          : '1px solid var(--border-color, #e2e8f0)',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selectedCourses.includes(course.id)}
                                        onChange={() => toggleCourseSelection(course.id)}
                                        style={{ marginTop: '2px', cursor: 'pointer' }}
                                      />
                                      <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                          <strong style={{ color: 'var(--text-dark, #1a202c)', fontSize: '14px' }}>
                                          {course.course_code}
                                          </strong>
                                          <span style={{ 
                                            padding: '2px 8px', 
                                            background: 'var(--bg-gray-100, #edf2f7)', 
                                            borderRadius: '4px', 
                                            fontSize: '12px',
                                            color: 'var(--text-medium, #718096)',
                                            fontWeight: 600
                                          }}>
                                            {(course.lec_hours || 0) + (course.lab_hours || 0)} hrs
                                          </span>
                                          <span style={{ 
                                            fontSize: '12px',
                                            color: 'var(--text-light, #a0aec0)'
                                          }}>
                                            {course.semester}
                                          </span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-medium, #718096)' }}>
                                          {course.course_name}
                                        </div>
                                        <div style={{ 
                                          fontSize: '12px', 
                                          color: 'var(--text-light, #a0aec0)',
                                          marginTop: '4px',
                                          display: 'flex',
                                          gap: '12px'
                                        }}>
                                          <span>Lec: {course.lec_hours}hrs</span>
                                          {course.lab_hours > 0 && (
                                            <span>Lab: {course.lab_hours}hrs</span>
                                          )}
                                        </div>
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))
                      )}
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
