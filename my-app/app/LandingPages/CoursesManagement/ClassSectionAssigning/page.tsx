'use client'

import { Suspense, useEffect, useState } from 'react'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import styles from '../ClassSchedules.module.css'
import { supabase } from '@/lib/supabaseClient'
import { useColleges } from '@/app/context/CollegesContext'
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Plus,
  Edit3,
  X,
  Save,
  Calendar,
  GraduationCap,
  Layers,
  BookMarked,
  Users,
  Search,
  Trash2,
  FolderPlus,
  UserPlus,
  FileText,
  CheckCircle,
  AlertCircle,
  Download
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ==================== Interfaces ====================
interface Course {
  id: number
  upload_group_id: number
  course_code: string
  course_name: string
  lec_hours: number
  lab_hours: number
  total_hours?: number // Computed: lec_hours + lab_hours
  semester: string
  academic_year: string
  department: string
  college: string
  degree_program: string | null
  prerequisite: string | null
  year_level: number
  created_at: string
}

interface YearBatch {
  id: number
  year_batch: string // e.g., "2024-2025 First Semester"
  academic_year: string
  is_active?: boolean
  created_at: string
  updated_at?: string
}

interface Section {
  id: number
  section_name: string // e.g., "BSCS 1A", "BSCS 1B"
  year_batch_id: number
  year_batch?: string
  year_level: number
  degree_program: string
  department?: string | null
  college?: string | null
  student_count: number
  max_capacity: number
  is_active?: boolean
  created_at: string
  assigned_courses?: Course[]
}

interface SectionCourseAssignment {
  id: number
  section_id: number
  course_id: number
  created_at: string
}

// Form data
interface YearBatchFormData {
  year_batch: string
  academic_year: string
}

interface SectionFormData {
  section_name: string
  year_batch_id: number
  year_level: number
  degree_program: string
  department: string
  college: string
  max_capacity: number
}

const emptyYearBatchForm: YearBatchFormData = {
  year_batch: '2024-25 1st Sem',
  academic_year: '2024-2025'
}

const emptySectionForm: SectionFormData = {
  section_name: '',
  year_batch_id: 0,
  year_level: 1,
  degree_program: '',
  department: '',
  college: '',
  max_capacity: 40
}

// ==================== Main Component ====================
function ClassSectionAssigningContent() {
  const router = useRouter()
  const { activeColleges: bulsuColleges } = useColleges()

  // State
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [yearBatches, setYearBatches] = useState<YearBatch[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [assignments, setAssignments] = useState<SectionCourseAssignment[]>([])
  const [selectedSection, setSelectedSection] = useState<Section | null>(null)
  const [expandedBatches, setExpandedBatches] = useState<Set<number>>(new Set())
  const [expandedYearLevels, setExpandedYearLevels] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [filterYearLevel, setFilterYearLevel] = useState<string>('all')
  const [filterDegreeProgram, setFilterDegreeProgram] = useState<string>('all')
  const [filterCollege, setFilterCollege] = useState<string>('all')

  // Modal States
  const [showYearBatchModal, setShowYearBatchModal] = useState(false)
  const [showSectionModal, setShowSectionModal] = useState(false)
  const [showAssignCoursesModal, setShowAssignCoursesModal] = useState(false)
  const [yearBatchForm, setYearBatchForm] = useState<YearBatchFormData>(emptyYearBatchForm)
  const [sectionForm, setSectionForm] = useState<SectionFormData>(emptySectionForm)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  // Course assignment by Year Level
  const [selectedYearLevelForAssignment, setSelectedYearLevelForAssignment] = useState<number | null>(null)
  const [selectedDegreeForAssignment, setSelectedDegreeForAssignment] = useState<string>('')
  const [selectedSemester, setSelectedSemester] = useState<string>('all')

  // Notification
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  // Options
  const yearLevels = [1, 2, 3, 4]
  const semesters = ['First Semester', 'Second Semester', 'Summer']

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
      // Fetch courses from class_schedules
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: coursesData, error: coursesError } = await (supabase as any)
        .from('class_schedules')
        .select('*')
        .order('year_level', { ascending: true })
        .order('course_code', { ascending: true })

      if (coursesError) throw coursesError
      if (coursesData) {
        setCourses(coursesData)
      }

      // Fetch year batches from Supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: batchesData, error: batchesError } = await (supabase as any)
        .from('year_batches')
        .select('*')
        .order('year_batch', { ascending: false })

      if (batchesError) {
        console.log('year_batches table may not exist, using empty array:', batchesError)
        setYearBatches([])
      } else {
        setYearBatches(batchesData || [])
        if (batchesData && batchesData.length > 0) {
          setExpandedBatches(new Set([batchesData[0].id]))
        }
      }

      // Fetch sections from Supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sectionsData, error: sectionsError } = await (supabase as any)
        .from('sections')
        .select('*')
        .order('section_name', { ascending: true })

      if (sectionsError) {
        console.log('sections table may not exist, using empty array:', sectionsError)
        setSections([])
      } else {
        setSections(sectionsData || [])
        if (sectionsData && sectionsData.length > 0) {
          const keys = sectionsData.slice(0, 2).map((s: Section) => `${s.year_batch_id}-${s.year_level}`)
          setExpandedYearLevels(new Set(keys))
        }
      }

      // Fetch course assignments
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: assignmentsData, error: assignmentsError } = await (supabase as any)
        .from('section_course_assignments')
        .select('*')

      if (assignmentsError) {
        console.log('section_course_assignments table may not exist:', assignmentsError)
        setAssignments([])
      } else {
        setAssignments(assignmentsData || [])
      }

    } catch (error) {
      console.error('Error fetching data:', error)
      setNotification({ type: 'error', message: 'Failed to fetch data. Please refresh.' })
    } finally {
      setLoading(false)
    }
  }

  // Get year level label
  const getYearLevelLabel = (year: number): string => {
    const labels: Record<number, string> = {
      1: '1st Year',
      2: '2nd Year',
      3: '3rd Year',
      4: '4th Year'
    }
    return labels[year] || `Year ${year}`
  }

  // Get unique degree programs from sections
  const getDegreePrograms = () => {
    return [...new Set(sections.map(s => s.degree_program).filter(Boolean))]
  }

  // Get unique degree programs from courses
  const getCourseDegreePrograms = () => {
    return [...new Set(courses.map(c => c.degree_program).filter(Boolean))] as string[]
  }

  // Get assigned courses for a section
  const getAssignedCourses = (sectionId: number): Course[] => {
    const sectionAssignments = assignments.filter(a => a.section_id === sectionId)
    return courses.filter(c => sectionAssignments.some(a => a.course_id === c.id))
  }

  // Download CSV for a specific year batch
  const downloadBatchCSV = (batch: YearBatch) => {
    const batchSections = sections.filter(s => s.year_batch_id === batch.id)

    if (batchSections.length === 0) {
      setNotification({ type: 'error', message: 'No sections found for this year batch' })
      return
    }

    // Create CSV content with header
    let csvContent = `Year Batch: ${batch.year_batch}\n\n`
    csvContent += 'Section Name,Year Level,Degree Program,Student Count,Max Capacity,Assigned Courses (Code),Assigned Courses (Name)\n'

    batchSections.forEach(section => {
      const assignedCourses = getAssignedCourses(section.id)

      const courseCodes = assignedCourses.map(c => c.course_code).join('; ')
      const courseNames = assignedCourses.map(c => c.course_name).join('; ')

      csvContent += `"${section.section_name}",`
      csvContent += `${section.year_level},`
      csvContent += `"${section.degree_program}",`
      csvContent += `${section.student_count},`
      csvContent += `${section.max_capacity},`
      csvContent += `"${courseCodes}",`
      csvContent += `"${courseNames}"\n`
    })

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `sections_${batch.year_batch.replace(/ /g, '_')}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setNotification({ type: 'success', message: 'CSV downloaded successfully!' })
  }

  // Filter sections
  const getFilteredSections = () => {
    let filtered = [...sections]

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(s =>
        s.section_name.toLowerCase().includes(term) ||
        s.degree_program.toLowerCase().includes(term) ||
        (s.college && s.college.toLowerCase().includes(term))
      )
    }

    if (filterYearLevel !== 'all') {
      filtered = filtered.filter(s => s.year_level === parseInt(filterYearLevel))
    }

    if (filterDegreeProgram !== 'all') {
      filtered = filtered.filter(s => s.degree_program === filterDegreeProgram)
    }

    if (filterCollege !== 'all') {
      filtered = filtered.filter(s => s.college === filterCollege)
    }

    return filtered
  }

  // Get unique colleges from sections
  const getColleges = () => {
    return [...new Set(sections.map(s => s.college).filter(Boolean))] as string[]
  }

  // Group sections by year batch and year level
  const getSectionsByBatchAndYear = () => {
    const grouped = new Map<number, Map<number, Section[]>>()

    getFilteredSections().forEach(section => {
      // Get the batch for this section
      const batch = yearBatches.find(b => b.id === section.year_batch_id)
      if (!batch) return

      if (!grouped.has(section.year_batch_id)) {
        grouped.set(section.year_batch_id, new Map())
      }
      const batchMap = grouped.get(section.year_batch_id)!

      if (!batchMap.has(section.year_level)) {
        batchMap.set(section.year_level, [])
      }
      batchMap.get(section.year_level)!.push(section)
    })

    return grouped
  }

  // Get courses for selected year level in assignment modal
  const getCoursesForAssignment = () => {
    if (!selectedSection || selectedYearLevelForAssignment === null) return []

    let filtered = courses.filter(c =>
      c.degree_program === selectedDegreeForAssignment &&
      c.year_level === selectedYearLevelForAssignment
    )

    if (selectedSemester !== 'all') {
      filtered = filtered.filter(c => c.semester === selectedSemester)
    }

    return filtered
  }

  // Toggle batch expansion
  const toggleBatch = (batchId: number) => {
    setExpandedBatches(prev => {
      const next = new Set(prev)
      if (next.has(batchId)) {
        next.delete(batchId)
      } else {
        next.add(batchId)
      }
      return next
    })
  }

  // Toggle year level expansion
  const toggleYearLevel = (key: string) => {
    setExpandedYearLevels(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  // ==================== Year Batch CRUD ====================
  const openCreateYearBatchModal = () => {
    setYearBatchForm(emptyYearBatchForm)
    setModalMode('create')
    setEditingId(null)
    setShowYearBatchModal(true)
  }

  const handleSaveYearBatch = async () => {
    if (!yearBatchForm.year_batch) {
      setNotification({ type: 'error', message: 'Please enter a year batch name' })
      return
    }

    // Check for duplicate year_batch names
    const duplicateBatch = yearBatches.find(b =>
      b.year_batch.toLowerCase() === yearBatchForm.year_batch.toLowerCase() &&
      (modalMode === 'create' || b.id !== editingId)
    )

    if (duplicateBatch) {
      setNotification({ type: 'error', message: `Year batch "${yearBatchForm.year_batch}" already exists.` })
      return
    }

    setSaving(true)
    try {
      if (modalMode === 'create') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('year_batches')
          .insert({
            year_batch: yearBatchForm.year_batch,
            academic_year: yearBatchForm.academic_year || yearBatchForm.year_batch.split(' ')[0],
            is_active: true
          })
          .select()
          .single()

        if (error) {
          console.error('Supabase insert error:', error)
          throw new Error(error.message || 'Failed to create year batch')
        }

        setYearBatches(prev => [data, ...prev])
        setExpandedBatches(prev => new Set([...prev, data.id]))
        setNotification({ type: 'success', message: 'Year batch created successfully!' })
      } else {
        // Edit mode
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('year_batches')
          .update({
            year_batch: yearBatchForm.year_batch,
            academic_year: yearBatchForm.academic_year || yearBatchForm.year_batch.split(' ')[0],
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId)
          .select()
          .single()

        if (error) {
          console.error('Supabase update error:', error)
          throw new Error(error.message || 'Failed to update year batch')
        }

        setYearBatches(prev => prev.map(b => b.id === editingId ? data : b))
        setNotification({ type: 'success', message: 'Year batch updated successfully!' })
      }
      setShowYearBatchModal(false)
    } catch (error) {
      console.error('Error saving year batch:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to save year batch. Please try again.'
      setNotification({ type: 'error', message: errorMessage })
    } finally {
      setSaving(false)
    }
  }

  // Open Edit Year Batch Modal
  const openEditYearBatchModal = (batch: YearBatch) => {
    setYearBatchForm({
      year_batch: batch.year_batch,
      academic_year: batch.academic_year
    })
    setModalMode('edit')
    setEditingId(batch.id)
    setShowYearBatchModal(true)
  }

  // Delete Year Batch
  const [deleteYearBatchConfirm, setDeleteYearBatchConfirm] = useState<number | null>(null)

  const handleDeleteYearBatch = async (id: number) => {
    try {
      // Check if there are sections associated with this year batch
      const associatedSections = sections.filter(s => s.year_batch_id === id)
      if (associatedSections.length > 0) {
        setNotification({
          type: 'error',
          message: `Cannot delete: ${associatedSections.length} section(s) are assigned to this year batch. Delete the sections first.`
        })
        setDeleteYearBatchConfirm(null)
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('year_batches')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Supabase delete error:', error)
        throw new Error(error.message || 'Failed to delete year batch')
      }

      setYearBatches(prev => prev.filter(b => b.id !== id))
      setExpandedBatches(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setNotification({ type: 'success', message: 'Year batch deleted successfully!' })
    } catch (error) {
      console.error('Error deleting year batch:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete year batch.'
      setNotification({ type: 'error', message: errorMessage })
    }
    setDeleteYearBatchConfirm(null)
  }

  // ==================== Section CRUD ====================
  const openCreateSectionModal = (batchId?: number) => {
    setSectionForm({
      ...emptySectionForm,
      year_batch_id: batchId || yearBatches[0]?.id || 0
    })
    setModalMode('create')
    setEditingId(null)
    setShowSectionModal(true)
  }

  const openEditSectionModal = (section: Section) => {
    setSectionForm({
      section_name: section.section_name,
      year_batch_id: section.year_batch_id,
      year_level: section.year_level,
      degree_program: section.degree_program,
      department: section.department || '',
      college: section.college || '',
      max_capacity: section.max_capacity
    })
    setModalMode('edit')
    setEditingId(section.id)
    setShowSectionModal(true)
  }

  const handleSaveSection = async () => {
    if (!sectionForm.section_name || !sectionForm.degree_program) {
      setNotification({ type: 'error', message: 'Please fill in Section Name and Degree Program' })
      return
    }

    if (!sectionForm.year_batch_id) {
      setNotification({ type: 'error', message: 'Please select a Year Batch' })
      return
    }

    // Check for duplicate section names in the same year batch and year level
    const duplicateSection = sections.find(s =>
      s.section_name.toLowerCase() === sectionForm.section_name.toLowerCase() &&
      s.year_batch_id === sectionForm.year_batch_id &&
      s.year_level === sectionForm.year_level &&
      (modalMode === 'create' || s.id !== editingId)
    )

    if (duplicateSection) {
      setNotification({
        type: 'error',
        message: `Section "${sectionForm.section_name}" already exists in ${getYearLevelLabel(sectionForm.year_level)} of this year batch.`
      })
      return
    }

    setSaving(true)
    try {
      if (modalMode === 'create') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('sections')
          .insert({
            section_name: sectionForm.section_name,
            year_batch_id: sectionForm.year_batch_id,
            year_level: sectionForm.year_level,
            degree_program: sectionForm.degree_program,
            department: sectionForm.department || null,
            college: sectionForm.college || null,
            student_count: 0,
            max_capacity: sectionForm.max_capacity,
            is_active: true
          })
          .select()
          .single()

        if (error) throw error

        setSections(prev => [...prev, data])
        const yearKey = `${data.year_batch_id}-${data.year_level}`
        setExpandedYearLevels(prev => new Set([...prev, yearKey]))

        // Auto-assign courses for the year level if available
        const coursesToAutoAssign = courses.filter(course =>
          course.year_level === data.year_level &&
          (course.degree_program === data.degree_program || !course.degree_program)
        )

        if (coursesToAutoAssign.length > 0) {
          try {
            const assignments = coursesToAutoAssign.map(course => ({
              section_id: data.id,
              course_id: course.id
            }))

            const { error: assignError } = await (supabase as any)
              .from('section_course_assignments')
              .insert(assignments)

            if (!assignError) {
              setAssignments(prev => [...prev, ...assignments.map((a, i) => ({
                id: Date.now() + i,
                ...a,
                created_at: new Date().toISOString()
              }))])
              setNotification({
                type: 'success',
                message: `Section created successfully! Auto-assigned ${coursesToAutoAssign.length} courses.`
              })
            } else {
              setNotification({ type: 'success', message: 'Section created successfully!' })
            }
          } catch (autoAssignError) {
            console.log('Auto-assign failed:', autoAssignError)
            setNotification({ type: 'success', message: 'Section created successfully!' })
          }
        } else {
          setNotification({ type: 'success', message: 'Section created successfully!' })
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('sections')
          .update({
            section_name: sectionForm.section_name,
            year_batch_id: sectionForm.year_batch_id,
            year_level: sectionForm.year_level,
            degree_program: sectionForm.degree_program,
            department: sectionForm.department || null,
            college: sectionForm.college || null,
            max_capacity: sectionForm.max_capacity
          })
          .eq('id', editingId)
          .select()
          .single()

        if (error) throw error

        setSections(prev => prev.map(s => s.id === editingId ? data : s))
        setNotification({ type: 'success', message: 'Section updated successfully!' })
      }
      setShowSectionModal(false)
    } catch (error) {
      console.error('Error saving section:', error)
      setNotification({ type: 'error', message: 'Failed to save section. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSection = async (id: number) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('sections')
        .delete()
        .eq('id', id)

      if (error) throw error

      setSections(prev => prev.filter(s => s.id !== id))
      setAssignments(prev => prev.filter(a => a.section_id !== id))
      setNotification({ type: 'success', message: 'Section deleted successfully!' })
    } catch (error) {
      console.error('Error deleting section:', error)
      setNotification({ type: 'error', message: 'Failed to delete section.' })
    }
    setDeleteConfirm(null)
  }

  // ==================== Course Assignment by Year Level ====================
  const openAssignCoursesModal = (section: Section) => {
    setSelectedSection(section)
    setSelectedDegreeForAssignment(section.degree_program)
    setSelectedYearLevelForAssignment(section.year_level)

    // Default to showing all semesters
    setSelectedSemester('all')

    setShowAssignCoursesModal(true)
  }

  const handleAssignYearLevelCourses = async () => {
    if (!selectedSection || selectedYearLevelForAssignment === null) return

    setSaving(true)
    try {
      const coursesToAssign = getCoursesForAssignment()

      if (coursesToAssign.length === 0) {
        setNotification({ type: 'error', message: 'No courses found for the selected year level and semester.' })
        setSaving(false)
        return
      }

      // First, remove existing assignments for this section
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: deleteError } = await (supabase as any)
        .from('section_course_assignments')
        .delete()
        .eq('section_id', selectedSection.id)

      if (deleteError) throw deleteError

      // Insert new assignments
      const assignmentRecords = coursesToAssign.map(course => ({
        section_id: selectedSection.id,
        course_id: course.id
      }))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('section_course_assignments')
        .insert(assignmentRecords)
        .select()

      if (error) throw error

      // Update local state
      setAssignments(prev => {
        const filtered = prev.filter(a => a.section_id !== selectedSection.id)
        return [...filtered, ...(data || [])]
      })

      setNotification({
        type: 'success',
        message: `Successfully assigned ${coursesToAssign.length} courses from ${getYearLevelLabel(selectedYearLevelForAssignment)} to ${selectedSection.section_name}!`
      })
      setShowAssignCoursesModal(false)
    } catch (error) {
      console.error('Error assigning courses:', error)
      setNotification({ type: 'error', message: 'Failed to assign courses. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  // Get courses for assignment modal (filtered by year level and degree program)
  const getAvailableCourses = () => {
    if (!selectedSection) return []

    return courses.filter(c =>
      c.year_level === selectedSection.year_level ||
      c.degree_program === selectedSection.degree_program ||
      !c.year_level // Include courses without year level
    )
  }

  // ==================== Render ====================

  if (loading) {
    return (
      <div className={styles.pageLayout}>
        <MenuBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} showSidebarToggle={true} showAccountIcon={true} />
        <Sidebar isOpen={sidebarOpen} />
        <main className={`${styles.pageMain} ${!sidebarOpen ? styles.fullWidth : ''}`}>
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p>Loading sections...</p>
          </div>
        </main>
      </div>
    )
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
              <Users size={32} style={{ marginRight: '12px' }} />
              Class & Section Assigning
            </h1>
            <p className={styles.welcomeSubtitle}>
              Manage year batches, create sections, and assign courses by year level
            </p>
          </div>

          {/* Navigation Tabs */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '24px',
            borderBottom: '2px solid var(--border-color, #e2e8f0)',
            paddingBottom: '0'
          }}>
            <Link href="/LandingPages/CoursesManagement" style={{
              padding: '12px 24px',
              fontWeight: 600,
              fontSize: '14px',
              color: 'var(--text-secondary, #718096)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              textDecoration: 'none',
              transition: 'color 0.2s ease'
            }}>
              <BookMarked size={18} />
              Courses
            </Link>
            <div style={{
              padding: '12px 24px',
              fontWeight: 700,
              fontSize: '14px',
              color: 'var(--primary-dark, #276749)',
              borderBottom: '3px solid var(--primary-medium, #38a169)',
              marginBottom: '-2px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Users size={18} />
              Class & Section Assigning
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '24px',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={openCreateYearBatchModal}
              style={{
                padding: '12px 20px',
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
              <FolderPlus size={18} />
              Add Year Batch
            </button>
            <button
              onClick={() => openCreateSectionModal()}
              style={{
                padding: '12px 20px',
                background: 'var(--card-bg, #fff)',
                color: 'var(--primary-medium, #38a169)',
                border: '2px solid var(--primary-medium, #38a169)',
                borderRadius: '10px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease'
              }}
            >
              <UserPlus size={18} />
              Add Section
            </button>
          </div>

          {/* Search and Filters */}
          <div style={{
            display: 'flex',
            gap: '16px',
            marginBottom: '24px',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <div className={styles.searchBox} style={{ flex: '1', minWidth: '250px' }}>
              <Search className={styles.searchIcon} size={18} />
              <input
                type="text"
                placeholder="Search sections..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.searchInput}
              />
            </div>

            <select
              value={filterYearLevel}
              onChange={(e) => setFilterYearLevel(e.target.value)}
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                border: '2px solid var(--border-color, #e2e8f0)',
                background: 'var(--bg-white, #fff)',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                minWidth: '140px',
                color: 'var(--text-dark, #1a202c)'
              }}
            >
              <option value="all">All Year Levels</option>
              {yearLevels.map(year => (
                <option key={year} value={year}>{getYearLevelLabel(year)}</option>
              ))}
            </select>

            <select
              value={filterDegreeProgram}
              onChange={(e) => setFilterDegreeProgram(e.target.value)}
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                border: '2px solid var(--border-color, #e2e8f0)',
                background: 'var(--bg-white, #fff)',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                minWidth: '200px',
                color: 'var(--text-dark, #1a202c)'
              }}
            >
              <option value="all">All Degree Programs</option>
              {getDegreePrograms().map(program => (
                <option key={program} value={program}>{program}</option>
              ))}
            </select>

            <select
              value={filterCollege}
              onChange={(e) => setFilterCollege(e.target.value)}
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
              <option value="all">All Colleges</option>
              {bulsuColleges.map(c => (
                <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
              ))}
              <option value="CAFA">CAFA</option>
              <option value="CAL">CAL</option>
              <option value="CBA">CBA</option>
              <option value="COE">COE</option>
              <option value="CICT">CICT</option>
              <option value="CIT">CIT</option>
              <option value="CON">CON</option>
              <option value="CED">CED</option>
              <option value="CHASS">CHASS</option>
              {getColleges().filter(c => !['CS', 'CAFA', 'CAL', 'CBA', 'COE', 'CICT', 'CIT', 'CON', 'CED', 'CHASS'].includes(c)).map(college => (
                <option key={college} value={college}>{college}</option>
              ))}
            </select>
          </div>

          {/* Stats Cards */}
          <div className={styles.statsGrid} style={{ marginBottom: '24px' }}>
            <div className={`${styles.statCard} ${styles.blue}`}>
              <div className={styles.statIcon}>
                <Calendar size={24} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statLabel}>Year Batches</span>
                <span className={styles.statValue}>{yearBatches.length}</span>
              </div>
            </div>
            <div className={`${styles.statCard} ${styles.green}`}>
              <div className={styles.statIcon}>
                <Users size={24} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statLabel}>Total Sections</span>
                <span className={styles.statValue}>{sections.length}</span>
              </div>
            </div>
            <div className={`${styles.statCard} ${styles.purple}`}>
              <div className={styles.statIcon}>
                <GraduationCap size={24} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statLabel}>Degree Programs</span>
                <span className={styles.statValue}>{getDegreePrograms().length}</span>
              </div>
            </div>
            <div className={`${styles.statCard} ${styles.orange}`}>
              <div className={styles.statIcon}>
                <BookOpen size={24} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statLabel}>Available Courses</span>
                <span className={styles.statValue}>{courses.length}</span>
              </div>
            </div>
          </div>

          {/* Sections Grid - Google Classroom Style */}
          <div className={styles.campusView}>
            {yearBatches.map(batch => {
              const batchSections = getSectionsByBatchAndYear().get(batch.id)
              const totalSections = batchSections
                ? Array.from(batchSections.values()).reduce((sum, arr) => sum + arr.length, 0)
                : 0

              return (
                <div key={batch.id} className={styles.campusSection}>
                  {/* Year Batch Header */}
                  <div
                    className={styles.campusHeaderRow}
                    style={{ marginBottom: '12px', cursor: 'pointer' }}
                  >
                    <Calendar size={20} />
                    <span
                      style={{ fontWeight: 700, fontSize: '16px', flex: 1 }}
                      onClick={() => toggleBatch(batch.id)}
                    >
                      {batch.year_batch}
                    </span>

                    {/* Edit Year Batch Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        openEditYearBatchModal(batch)
                      }}
                      title="Edit Year Batch"
                      style={{
                        padding: '6px 10px',
                        background: 'rgba(49, 130, 206, 0.1)',
                        color: 'var(--primary-blue, #3182ce)',
                        border: '1px solid var(--primary-blue, #3182ce)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        marginRight: '8px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <Edit3 size={14} />
                    </button>

                    {/* Delete Year Batch Button */}
                    {deleteYearBatchConfirm === batch.id ? (
                      <div style={{ display: 'flex', gap: '4px', marginRight: '8px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteYearBatch(batch.id)
                          }}
                          style={{
                            padding: '6px 12px',
                            background: '#e53e3e',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Confirm
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteYearBatchConfirm(null)
                          }}
                          style={{
                            padding: '6px 12px',
                            background: 'var(--bg-gray-100, #edf2f7)',
                            color: 'var(--text-secondary)',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteYearBatchConfirm(batch.id)
                        }}
                        title="Delete Year Batch"
                        style={{
                          padding: '6px 10px',
                          background: 'rgba(229, 62, 62, 0.1)',
                          color: '#e53e3e',
                          border: '1px solid #e53e3e',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          marginRight: '8px',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        downloadBatchCSV(batch)
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(56, 161, 105, 0.15)'
                        e.currentTarget.style.transform = 'scale(1.05)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(56, 161, 105, 0.1)'
                        e.currentTarget.style.transform = 'scale(1)'
                      }}
                      className={styles.downloadCsvBtn}
                    >
                      <Download size={16} />
                      <span className={styles.downloadCsvText}>Download CSV</span>
                    </button>
                    <span className={styles.roomCount}>
                      {totalSections} sections
                    </span>
                    <button
                      className={styles.toggleBtn}
                      onClick={() => toggleBatch(batch.id)}
                    >
                      {expandedBatches.has(batch.id) ? (
                        <ChevronDown size={20} />
                      ) : (
                        <ChevronRight size={20} />
                      )}
                    </button>
                  </div>

                  {expandedBatches.has(batch.id) && batchSections && (
                    <div style={{ marginLeft: '20px' }}>
                      {Array.from(batchSections.entries())
                        .sort((a, b) => a[0] - b[0])
                        .map(([yearLevel, levelSections]) => {
                          const yearKey = `${batch.id}-${yearLevel}`

                          return (
                            <div key={yearKey} style={{ marginBottom: '16px' }}>
                              {/* Year Level Header */}
                              <div
                                onClick={() => toggleYearLevel(yearKey)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '10px',
                                  padding: '10px 16px',
                                  background: 'var(--bg-gray-50, #f7fafc)',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  marginBottom: '12px'
                                }}
                              >
                                <Layers size={16} style={{ color: 'var(--primary-medium, #38a169)' }} />
                                <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-dark, #1a202c)' }}>
                                  {getYearLevelLabel(yearLevel)}
                                </span>
                                <span style={{
                                  fontSize: '12px',
                                  color: 'var(--text-secondary, #718096)',
                                  background: 'var(--bg-gray-100, #edf2f7)',
                                  padding: '2px 8px',
                                  borderRadius: '10px'
                                }}>
                                  {levelSections.length} sections
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openCreateSectionModal(batch.id)
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'var(--primary-medium, #38a169)'
                                    e.currentTarget.style.color = 'white'
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'var(--primary-light, #c6f6d5)'
                                    e.currentTarget.style.color = 'var(--primary-dark, #276749)'
                                  }}
                                  style={{
                                    marginLeft: 'auto',
                                    padding: '4px 10px',
                                    background: 'var(--primary-light, #c6f6d5)',
                                    color: 'var(--primary-dark, #276749)',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    transition: 'all 0.2s ease'
                                  }}
                                >
                                  <Plus size={12} />
                                  Add
                                </button>
                                <div>
                                  {expandedYearLevels.has(yearKey) ? (
                                    <ChevronDown size={16} />
                                  ) : (
                                    <ChevronRight size={16} />
                                  )}
                                </div>
                              </div>

                              {/* Section Cards - Google Classroom Style */}
                              {expandedYearLevels.has(yearKey) && (
                                <div style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                  gap: '16px',
                                  marginLeft: '16px'
                                }}>
                                  {levelSections
                                    .sort((a, b) => a.section_name.localeCompare(b.section_name))
                                    .map(section => (
                                      <div
                                        key={section.id}
                                        style={{
                                          background: 'var(--card-bg, #fff)',
                                          borderRadius: '12px',
                                          border: '1px solid var(--border-color, #e2e8f0)',
                                          overflow: 'hidden',
                                          transition: 'all 0.2s ease',
                                          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                                          cursor: 'pointer'
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.transform = 'translateY(-2px)'
                                          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.transform = 'translateY(0px)'
                                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'
                                        }}
                                      >
                                        {/* Card Header - Colored Banner */}
                                        <div style={{
                                          background: 'linear-gradient(135deg, #38a169 0%, #48bb78 100%)',
                                          padding: '16px',
                                          color: 'white',
                                          position: 'relative'
                                        }}>
                                          <h3 style={{
                                            margin: 0,
                                            fontSize: '18px',
                                            fontWeight: 700,
                                            marginBottom: '4px'
                                          }}>
                                            {section.section_name}
                                          </h3>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                            <p style={{
                                              margin: 0,
                                              fontSize: '12px',
                                              opacity: 0.9,
                                              flex: 1
                                            }}>
                                              {section.degree_program}
                                            </p>
                                            {/* Completion Status */}
                                            <div style={{
                                              padding: '2px 6px',
                                              borderRadius: '10px',
                                              fontSize: '10px',
                                              fontWeight: 600,
                                              background: getAssignedCourses(section.id).length > 0
                                                ? 'rgba(255, 255, 255, 0.3)'
                                                : 'rgba(255, 255, 255, 0.2)',
                                              color: 'white'
                                            }}>
                                              {getAssignedCourses(section.id).length > 0 ? 'Complete' : 'Incomplete'}
                                            </div>
                                          </div>

                                          {/* Action Buttons */}
                                          <div style={{
                                            position: 'absolute',
                                            top: '12px',
                                            right: '12px',
                                            display: 'flex',
                                            gap: '4px'
                                          }}>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                openEditSectionModal(section)
                                              }}
                                              onMouseEnter={(e) => {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.3)'
                                                e.currentTarget.style.transform = 'scale(1.1)'
                                              }}
                                              onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.2)'
                                                e.currentTarget.style.transform = 'scale(1)'
                                              }}
                                              style={{
                                                padding: '6px',
                                                background: 'rgba(255,255,255,0.2)',
                                                border: 'none',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                color: 'white',
                                                transition: 'all 0.2s ease'
                                              }}
                                            >
                                              <Edit3 size={14} />
                                            </button>
                                            {deleteConfirm === section.id ? (
                                              <div style={{ display: 'flex', gap: '2px' }}>
                                                <button
                                                  onClick={() => handleDeleteSection(section.id)}
                                                  style={{
                                                    padding: '6px 8px',
                                                    background: '#c53030',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontSize: '10px'
                                                  }}
                                                >
                                                  Yes
                                                </button>
                                                <button
                                                  onClick={() => setDeleteConfirm(null)}
                                                  style={{
                                                    padding: '6px 8px',
                                                    background: 'rgba(255,255,255,0.3)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontSize: '10px'
                                                  }}
                                                >
                                                  No
                                                </button>
                                              </div>
                                            ) : (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  setDeleteConfirm(section.id)
                                                }}
                                                onMouseEnter={(e) => {
                                                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.8)'
                                                  e.currentTarget.style.transform = 'scale(1.1)'
                                                }}
                                                onMouseLeave={(e) => {
                                                  e.currentTarget.style.background = 'rgba(255,255,255,0.2)'
                                                  e.currentTarget.style.transform = 'scale(1)'
                                                }}
                                                style={{
                                                  padding: '6px',
                                                  background: 'rgba(255,255,255,0.2)',
                                                  border: 'none',
                                                  borderRadius: '6px',
                                                  cursor: 'pointer',
                                                  color: 'white',
                                                  transition: 'all 0.2s ease'
                                                }}
                                              >
                                                <Trash2 size={14} />
                                              </button>
                                            )}
                                          </div>
                                        </div>

                                        {/* Card Body */}
                                        <div style={{ padding: '16px' }}>
                                          {/* Student Count */}
                                          <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            marginBottom: '12px'
                                          }}>
                                            <Users size={16} style={{ color: 'var(--text-secondary, #718096)' }} />
                                            <span style={{
                                              fontSize: '13px',
                                              color: 'var(--text-dark, #1a202c)',
                                              fontWeight: 500
                                            }}>
                                              {section.student_count} / {section.max_capacity} students
                                            </span>
                                            <div style={{
                                              flex: 1,
                                              height: '6px',
                                              background: 'var(--bg-gray-100, #edf2f7)',
                                              borderRadius: '3px',
                                              overflow: 'hidden'
                                            }}>
                                              <div style={{
                                                width: `${(section.student_count / section.max_capacity) * 100}%`,
                                                height: '100%',
                                                background: section.student_count >= section.max_capacity
                                                  ? '#e53e3e'
                                                  : 'var(--primary-medium, #38a169)',
                                                borderRadius: '3px'
                                              }} />
                                            </div>
                                          </div>

                                          {/* Assigned Courses */}
                                          <div style={{ marginBottom: '12px' }}>
                                            <div style={{
                                              fontSize: '11px',
                                              color: 'var(--text-secondary, #718096)',
                                              fontWeight: 600,
                                              marginBottom: '6px',
                                              textTransform: 'uppercase'
                                            }}>
                                              Assigned Courses
                                            </div>
                                            {(() => {
                                              const assignedCourses = getAssignedCourses(section.id)
                                              return assignedCourses.length > 0 ? (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                  {assignedCourses.slice(0, 3).map(course => (
                                                    <span
                                                      key={course.id}
                                                      style={{
                                                        padding: '2px 8px',
                                                        background: 'var(--bg-gray-100, #edf2f7)',
                                                        borderRadius: '4px',
                                                        fontSize: '11px',
                                                        color: 'var(--text-dark, #1a202c)'
                                                      }}
                                                    >
                                                      {course.course_code}
                                                    </span>
                                                  ))}
                                                  {assignedCourses.length > 3 && (
                                                    <span style={{
                                                      padding: '2px 8px',
                                                      background: 'var(--primary-light, #c6f6d5)',
                                                      borderRadius: '4px',
                                                      fontSize: '11px',
                                                      color: 'var(--primary-dark, #276749)',
                                                      fontWeight: 600
                                                    }}>
                                                      +{assignedCourses.length - 3} more
                                                    </span>
                                                  )}
                                                </div>
                                              ) : (
                                                <span style={{
                                                  fontSize: '12px',
                                                  color: 'var(--text-secondary, #718096)',
                                                  fontStyle: 'italic'
                                                }}>
                                                  No courses assigned
                                                </span>
                                              )
                                            })()}
                                          </div>

                                          {/* Assign Courses Button */}
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              openAssignCoursesModal(section)
                                            }}
                                            onMouseEnter={(e) => {
                                              e.currentTarget.style.background = 'var(--primary-light, #c6f6d5)'
                                              e.currentTarget.style.borderColor = 'var(--primary-dark, #276749)'
                                            }}
                                            onMouseLeave={(e) => {
                                              e.currentTarget.style.background = 'var(--bg-gray-50, #f7fafc)'
                                              e.currentTarget.style.borderColor = 'var(--primary-medium, #38a169)'
                                            }}
                                            style={{
                                              width: '100%',
                                              padding: '10px',
                                              background: 'var(--bg-gray-50, #f7fafc)',
                                              color: 'var(--primary-medium, #38a169)',
                                              border: '1px dashed var(--primary-medium, #38a169)',
                                              borderRadius: '8px',
                                              fontWeight: 600,
                                              cursor: 'pointer',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              gap: '6px',
                                              fontSize: '13px',
                                              transition: 'all 0.2s ease'
                                            }}
                                          >
                                            <FileText size={16} />
                                            Assign Courses by Year Level
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Empty State */}
          {yearBatches.length === 0 && (
            <div className={styles.emptyState}>
              <Calendar size={64} />
              <h3>No Year Batches Found</h3>
              <p>Create a year batch to start adding sections and assigning courses.</p>
              <button
                onClick={openCreateYearBatchModal}
                style={{
                  marginTop: '16px',
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #38a169 0%, #48bb78 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <FolderPlus size={18} />
                Create Year Batch
              </button>
            </div>
          )}
        </div>
      </main>

      {/* ==================== Year Batch Modal ==================== */}
      {showYearBatchModal && (
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
            background: 'var(--card-bg, #fff)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '450px',
            boxShadow: 'var(--shadow-md)'
          }}>
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
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FolderPlus size={20} />
                {modalMode === 'edit' ? 'Edit Year Batch' : 'Add Year Batch'}
              </h2>
              <button
                onClick={() => setShowYearBatchModal(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  color: 'white',
                  padding: '8px',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px' }}>
                  Year Batch Name * <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(max 40 chars)</span>
                </label>
                <input
                  type="text"
                  value={yearBatchForm.year_batch}
                  onChange={(e) => setYearBatchForm(prev => ({ ...prev, year_batch: e.target.value.slice(0, 40) }))}
                  placeholder="e.g., 2024-25 1st Sem"
                  maxLength={40}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '2px solid var(--border-color, #e2e8f0)',
                    borderRadius: '10px',
                    fontSize: '14px'
                  }}
                />
                <span style={{ fontSize: '11px', color: yearBatchForm.year_batch.length > 38 ? '#e53e3e' : 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                  {yearBatchForm.year_batch.length}/40 characters • e.g., &quot;2024-25 1st Sem&quot;, &quot;2024-25 2nd Sem&quot;, &quot;2024-25 Summer&quot;
                </span>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px' }}>
                  Academic Year
                </label>
                <input
                  type="text"
                  value={yearBatchForm.academic_year}
                  onChange={(e) => setYearBatchForm(prev => ({ ...prev, academic_year: e.target.value }))}
                  placeholder="e.g., 2024-2025"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '2px solid var(--border-color, #e2e8f0)',
                    borderRadius: '10px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowYearBatchModal(false)}
                  style={{
                    padding: '12px 24px',
                    background: 'var(--bg-gray-100, #edf2f7)',
                    color: 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveYearBatch}
                  disabled={saving}
                  style={{
                    padding: '12px 24px',
                    background: 'var(--primary-gradient)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Save size={16} />
                  {saving ? 'Saving...' : (modalMode === 'edit' ? 'Update' : 'Create')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Section Modal ==================== */}
      {showSectionModal && (
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
            background: 'var(--card-bg, #fff)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '500px',
            boxShadow: 'var(--shadow-md)'
          }}>
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
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                {modalMode === 'create' ? <UserPlus size={20} /> : <Edit3 size={20} />}
                {modalMode === 'create' ? 'Add Section' : 'Edit Section'}
              </h2>
              <button
                onClick={() => setShowSectionModal(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  color: 'white',
                  padding: '8px',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px' }}>
                  Section Name *
                </label>
                <input
                  type="text"
                  value={sectionForm.section_name}
                  onChange={(e) => setSectionForm(prev => ({ ...prev, section_name: e.target.value }))}
                  placeholder="e.g., BSCS 1A"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '2px solid var(--border-color, #e2e8f0)',
                    borderRadius: '10px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px' }}>
                    Year Batch
                  </label>
                  <select
                    value={sectionForm.year_batch_id}
                    onChange={(e) => setSectionForm(prev => ({ ...prev, year_batch_id: parseInt(e.target.value) }))}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '2px solid var(--border-color, #e2e8f0)',
                      borderRadius: '10px',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    {yearBatches.map(batch => (
                      <option key={batch.id} value={batch.id}>{batch.year_batch}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px' }}>
                    Year Level
                  </label>
                  <select
                    value={sectionForm.year_level}
                    onChange={(e) => setSectionForm(prev => ({ ...prev, year_level: parseInt(e.target.value) }))}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '2px solid var(--border-color, #e2e8f0)',
                      borderRadius: '10px',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    {yearLevels.map(year => (
                      <option key={year} value={year}>{getYearLevelLabel(year)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px' }}>
                  Degree Program *
                </label>
                <input
                  type="text"
                  value={sectionForm.degree_program}
                  onChange={(e) => setSectionForm(prev => ({ ...prev, degree_program: e.target.value }))}
                  placeholder="e.g., BS Computer Science"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '2px solid var(--border-color, #e2e8f0)',
                    borderRadius: '10px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px' }}>
                  College *
                </label>
                <select
                  value={sectionForm.college}
                  onChange={(e) => setSectionForm(prev => ({ ...prev, college: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '2px solid var(--border-color, #e2e8f0)',
                    borderRadius: '10px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">-- Select College --</option>
                  {bulsuColleges.map(c => (
                    <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px' }}>
                  Max Capacity
                </label>
                <input
                  type="number"
                  value={sectionForm.max_capacity}
                  onChange={(e) => setSectionForm(prev => ({ ...prev, max_capacity: parseInt(e.target.value) || 40 }))}
                  min="1"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '2px solid var(--border-color, #e2e8f0)',
                    borderRadius: '10px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowSectionModal(false)}
                  style={{
                    padding: '12px 24px',
                    background: 'var(--bg-gray-100, #edf2f7)',
                    color: 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSection}
                  disabled={saving}
                  style={{
                    padding: '12px 24px',
                    background: 'var(--primary-gradient)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Save size={16} />
                  {saving ? 'Saving...' : (modalMode === 'create' ? 'Create' : 'Save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Assign Courses by Year Level Modal ==================== */}
      {showAssignCoursesModal && selectedSection && (
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
            background: 'var(--card-bg, #fff)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '800px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: 'var(--shadow-md)'
          }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, #38a169 0%, #48bb78 100%)',
              color: 'white',
              borderRadius: '16px 16px 0 0'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Layers size={20} />
                  Assign Courses by Year Level
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '12px', opacity: 0.9 }}>
                  Section: {selectedSection.section_name} | {selectedSection.degree_program}
                </p>
              </div>
              <button
                onClick={() => setShowAssignCoursesModal(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  color: 'white',
                  padding: '8px',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
              {/* Year Level Selection */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '16px',
                marginBottom: '16px'
              }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px' }}>
                    Degree Program
                  </label>
                  <select
                    value={selectedDegreeForAssignment}
                    onChange={(e) => setSelectedDegreeForAssignment(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '2px solid var(--border-color, #e2e8f0)',
                      borderRadius: '10px',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">Select Degree Program</option>
                    {getCourseDegreePrograms().map(program => (
                      <option key={program} value={program}>{program}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px' }}>
                    Year Level
                  </label>
                  <select
                    value={selectedYearLevelForAssignment ?? ''}
                    onChange={(e) => setSelectedYearLevelForAssignment(e.target.value ? parseInt(e.target.value) : null)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '2px solid var(--border-color, #e2e8f0)',
                      borderRadius: '10px',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">Select Year Level</option>
                    {yearLevels.map(year => (
                      <option key={year} value={year}>{getYearLevelLabel(year)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px' }}>
                    Semester
                  </label>
                  <select
                    value={selectedSemester}
                    onChange={(e) => setSelectedSemester(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '2px solid var(--border-color, #e2e8f0)',
                      borderRadius: '10px',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="all">All Semesters</option>
                    {semesters.map(sem => (
                      <option key={sem} value={sem}>{sem}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Info Box */}
              <div style={{
                padding: '12px 16px',
                background: 'var(--primary-light, #c6f6d5)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '13px',
                color: 'var(--primary-dark, #276749)'
              }}>
                <CheckCircle size={18} />
                <span>
                  <strong>{getCoursesForAssignment().length} courses</strong> will be assigned from{' '}
                  {selectedYearLevelForAssignment ? getYearLevelLabel(selectedYearLevelForAssignment) : 'selected year level'}
                  {selectedSemester !== 'all' ? ` (${selectedSemester})` : ' (All Semesters)'}
                </span>
              </div>
            </div>

            <div style={{ padding: '16px 24px', flex: 1, overflow: 'auto' }}>
              {selectedDegreeForAssignment && selectedYearLevelForAssignment !== null ? (
                getCoursesForAssignment().length > 0 ? (
                  <div>
                    <h4 style={{
                      margin: '0 0 12px',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--text-dark, #1a202c)'
                    }}>
                      Courses to be Assigned:
                    </h4>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                      gap: '10px'
                    }}>
                      {getCoursesForAssignment().map(course => (
                        <div
                          key={course.id}
                          style={{
                            padding: '12px 16px',
                            background: 'var(--bg-gray-50, #f7fafc)',
                            borderRadius: '10px',
                            border: '1px solid var(--border-color, #e2e8f0)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                          }}
                        >
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            background: 'var(--primary-light, #c6f6d5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <BookOpen size={18} style={{ color: 'var(--primary-dark, #276749)' }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontWeight: 600,
                              fontSize: '13px',
                              color: 'var(--text-dark, #1a202c)'
                            }}>
                              {course.course_code}
                            </div>
                            <div style={{
                              fontSize: '11px',
                              color: 'var(--text-secondary, #718096)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {course.course_name}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{
                              fontSize: '11px',
                              color: 'var(--text-secondary, #718096)'
                            }}>
                              {(course.lec_hours || 0) + (course.lab_hours || 0)} hrs
                            </div>
                            <div style={{
                              fontSize: '10px',
                              color: 'var(--primary-medium, #38a169)',
                              fontWeight: 500
                            }}>
                              {course.semester || 'N/A'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px',
                    color: 'var(--text-secondary, #718096)'
                  }}>
                    <BookOpen size={48} style={{ opacity: 0.5, marginBottom: '12px' }} />
                    <p style={{ margin: 0, fontWeight: 500 }}>No courses found</p>
                    <p style={{ fontSize: '13px', marginTop: '8px' }}>
                      No courses available for {selectedDegreeForAssignment} - {getYearLevelLabel(selectedYearLevelForAssignment)}
                      {selectedSemester !== 'all' ? ` (${selectedSemester})` : ''}
                    </p>
                  </div>
                )
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '40px',
                  color: 'var(--text-secondary, #718096)'
                }}>
                  <Layers size={48} style={{ opacity: 0.5, marginBottom: '12px' }} />
                  <p style={{ margin: 0, fontWeight: 500 }}>Select options above</p>
                  <p style={{ fontSize: '13px', marginTop: '8px' }}>
                    Choose a Degree Program and Year Level to see available courses
                  </p>
                </div>
              )}
            </div>

            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setShowAssignCoursesModal(false)}
                style={{
                  padding: '12px 24px',
                  background: 'var(--bg-gray-100, #edf2f7)',
                  color: 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAssignYearLevelCourses}
                disabled={saving || getCoursesForAssignment().length === 0}
                style={{
                  padding: '12px 24px',
                  background: getCoursesForAssignment().length === 0
                    ? 'var(--bg-gray-200, #cbd5e0)'
                    : 'linear-gradient(135deg, #38a169 0%, #48bb78 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  cursor: getCoursesForAssignment().length === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Save size={16} />
                {saving ? 'Assigning...' : `Assign ${getCoursesForAssignment().length} Courses`}
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
        border: '4px solid rgba(56, 161, 105, 0.1)',
        borderTopColor: '#38a169',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }}></div>
      <p style={{ color: '#718096', fontWeight: 500 }}>Loading Class & Section Assigning...</p>
    </div>
  )
}

// Main export
export default function ClassSectionAssigningPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ClassSectionAssigningContent />
    </Suspense>
  )
}
