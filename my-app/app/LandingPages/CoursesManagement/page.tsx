'use client'

import { Suspense, useEffect, useState } from 'react'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import FeatureTagsManager from '@/app/components/FeatureTagsManager'
import styles from './ClassSchedules.module.css'
import { supabase } from '@/lib/supabaseClient'
import { MdMenuBook as BookOpen, MdKeyboardArrowDown as ChevronDown, MdKeyboardArrowRight as ChevronRight, MdTableChart as FileSpreadsheet, MdWarning as AlertTriangle, MdDelete as Trash2, MdAdd as Plus, MdEdit as Edit3, MdClose as X, MdSave as Save, MdCalendarToday as Calendar, MdSchool as GraduationCap, MdAccessTime as Clock, MdLayers as Layers, MdBookmark as BookMarked, MdFilterList as Filter, MdPeople as Users, MdArrowBack as ArrowLeft, MdSearch as Search, MdLabel as Tag, MdScience as Beaker, MdFolder as Folder, MdFolderOpen as FolderOpen, MdHome as Home, MdSettings as Settings, MdPalette as Palette, MdMoreVert as MoreVertical, MdDriveFileMove as FolderInput, MdArrowForward as MoveRight, MdMonitor as Monitor, MdSlideshow as Presentation, MdError as AlertCircle, MdEdit as Edit, MdDescription as FileText } from 'react-icons/md'
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
  grade: string | null
  year_level: number
  file_name: string
  created_at: string
}

interface UploadGroup {
  upload_group_id: number
  file_name: string
  college: string
  semester: string
  academic_year: string
  total_courses: number
  created_at: string
  degree_programs: string[]
}

interface Stats {
  totalCourses: number
  totalDegreePrograms: number
  firstYearCourses: number
  secondYearCourses: number
  thirdYearCourses: number
  fourthYearCourses: number
}

// Form data for creating/editing
interface CourseFormData {
  course_code: string
  course_name: string
  lec_hours: number
  lab_hours: number
  semester: string
  year_level: number
  department: string
  college: string
  prerequisite: string
}

const emptyFormData: CourseFormData = {
  course_code: '',
  course_name: '',
  lec_hours: 3,
  lab_hours: 0,
  semester: 'First Semester',
  year_level: 1,
  department: '',
  college: '',
  prerequisite: 'None'
}

// Folder color presets - theme aligned
const FOLDER_COLORS = [
  { name: 'Default', gradient: 'var(--primary-gradient, linear-gradient(135deg, #1a365d 0%, #2c5282 100%))' },
  { name: 'Green', gradient: 'linear-gradient(135deg, #276749 0%, #38a169 100%)' },
  { name: 'Purple', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { name: 'Teal', gradient: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)' },
  { name: 'Orange', gradient: 'linear-gradient(135deg, #c2410c 0%, #ea580c 100%)' },
  { name: 'Pink', gradient: 'linear-gradient(135deg, #be185d 0%, #ec4899 100%)' },
  { name: 'Indigo', gradient: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)' },
  { name: 'Cyan', gradient: 'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)' },
]

// Interface for folder settings
interface FolderSettings {
  [collegeName: string]: {
    color: string
    customName?: string
  }
}

// ==================== Helper Functions ====================
async function fetchAllRows<T = Record<string, unknown>>(
  table: string,
  filters: Record<string, string | number | boolean> = {},
  orderBy: string = 'id'
): Promise<T[]> {
  const PAGE_SIZE = 1000
  let allData: T[] = []
  let page = 0
  let hasMore = true

  while (hasMore) {
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from(table)
      .select('*')
      .range(from, to)
      .order(orderBy, { ascending: true })

    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value as string | number | boolean)
    }

    const { data, error } = await query

    if (error) throw error
    if (!data || data.length === 0) {
      hasMore = false
      break
    }

    allData = [...allData, ...(data as T[])]
    if (data.length < PAGE_SIZE) hasMore = false
    page++
  }

  return allData
}

// ==================== Main Component ====================
function CoursesManagementContent() {
  const router = useRouter()
  // State
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploadGroups, setUploadGroups] = useState<UploadGroup[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)

  // Folder navigation state
  const [selectedCollegeFolder, setSelectedCollegeFolder] = useState<string | null>(null)

  // Folder settings state
  const [folderSettings, setFolderSettings] = useState<FolderSettings>({})
  const [showFolderSettingsModal, setShowFolderSettingsModal] = useState(false)
  const [editingFolderName, setEditingFolderName] = useState<string | null>(null)
  const [folderMenuOpen, setFolderMenuOpen] = useState<string | null>(null)

  // Move file state
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [movingGroupId, setMovingGroupId] = useState<number | null>(null)
  const [movingFromCollege, setMovingFromCollege] = useState<string | null>(null)

  const [courses, setCourses] = useState<Course[]>([])
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([])
  const [viewMode, setViewMode] = useState<'selection' | 'list'>('selection')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSemester, setFilterSemester] = useState<string>('all')
  const [filterYearLevel, setFilterYearLevel] = useState<string>('all')
  const [filterDegreeProgram, setFilterDegreeProgram] = useState<string>('all')
  const [filterCourseType, setFilterCourseType] = useState<string>('all') // 'all', 'lec', 'lab', 'lec_lab'
  const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(new Set())
  const [expandedYearLevels, setExpandedYearLevels] = useState<Set<string>>(new Set())
  const [stats, setStats] = useState<Stats>({
    totalCourses: 0,
    totalDegreePrograms: 0,
    firstYearCourses: 0,
    secondYearCourses: 0,
    thirdYearCourses: 0,
    fourthYearCourses: 0
  })

  // CRUD Modal States
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [formData, setFormData] = useState<CourseFormData>(emptyFormData)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [deleteGroupConfirm, setDeleteGroupConfirm] = useState<number | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [featuresTab, setFeaturesTab] = useState<'lec' | 'lab'>('lec')

  // Options
  const semesters = ['First Semester', 'Second Semester', 'Summer']
  const yearLevels = [1, 2, 3, 4]

  // Effects
  useEffect(() => {
    checkAuth()
    fetchUploadGroups()
    // Load folder settings from localStorage
    const savedSettings = localStorage.getItem('courseFolderSettings')
    if (savedSettings) {
      try {
        setFolderSettings(JSON.parse(savedSettings))
      } catch (e) {
        console.error('Failed to parse folder settings:', e)
      }
    }
  }, [])

  // Save folder settings to localStorage when they change
  useEffect(() => {
    if (Object.keys(folderSettings).length > 0) {
      localStorage.setItem('courseFolderSettings', JSON.stringify(folderSettings))
    }
  }, [folderSettings])

  // Get folder color for a college
  const getFolderColor = (collegeName: string) => {
    return folderSettings[collegeName]?.color || FOLDER_COLORS[0].gradient
  }

  // Update folder color
  const updateFolderColor = (collegeName: string, color: string) => {
    setFolderSettings(prev => ({
      ...prev,
      [collegeName]: {
        ...prev[collegeName],
        color
      }
    }))
    setFolderMenuOpen(null)
  }

  // Update folder custom name
  const updateFolderName = (collegeName: string, customName: string) => {
    setFolderSettings(prev => ({
      ...prev,
      [collegeName]: {
        ...prev[collegeName],
        customName: customName || undefined
      }
    }))
    setEditingFolderName(null)
    setShowFolderSettingsModal(false)
  }

  // Get display name for folder
  const getFolderDisplayName = (collegeName: string) => {
    return folderSettings[collegeName]?.customName || collegeName
  }

  // Handle renaming a college in the entire database
  const handleRenameCollege = async (oldName: string, newName: string) => {
    if (!newName || newName === oldName) return

    const confirmMessage = `Are you sure you want to permanently rename "${oldName}" to "${newName}" in the database?\n\nThis will update ALL courses currently under this college. This action cannot be undone.`
    if (!window.confirm(confirmMessage)) return

    setRenaming(true)
    try {
      // Use the server-side API route to bypass RLS
      const response = await fetch('/api/class-schedules/rename-college', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ oldName, newName })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to rename college')
      }

      // 2. Migrate folder settings (colors/custom names)
      setFolderSettings(prev => {
        const next = { ...prev }
        if (next[oldName]) {
          // Keep the color but reset customName since the DB value is now correct
          next[newName] = { ...next[oldName], customName: undefined }
          delete next[oldName]
        }
        return next
      })

      // 3. Refresh data and UI
      await fetchUploadGroups()
      setFolderMenuOpen(null)

      alert(result.message || `Success! Renamed "${oldName}" to "${newName}".`)

    } catch (err: any) {
      console.error('Renaming error:', err)
      alert(`Failed to rename college: ${err.message || 'Unknown error'}`)
    } finally {
      setRenaming(false)
    }
  }

  // Get all unique colleges for move modal
  const getAllColleges = () => {
    return Array.from(new Set(uploadGroups.map(g => g.college || 'Uncategorized'))).sort()
  }

  // Open move modal
  const openMoveModal = (groupId: number, currentCollege: string) => {
    setMovingGroupId(groupId)
    setMovingFromCollege(currentCollege)
    setShowMoveModal(true)
  }

  // Move file to different college
  const handleMoveFile = async (targetCollege: string) => {
    if (!movingGroupId || targetCollege === movingFromCollege) {
      setShowMoveModal(false)
      return
    }

    try {
      // Update all courses in the upload group to the new college
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      console.log('Moving courses in group:', movingGroupId, 'to college:', targetCollege)
      const { data, error } = await (supabase as any)
        .from('class_schedules')
        .update({ college: targetCollege })
        .eq('upload_group_id', movingGroupId)
        .select()

      console.log('Move result:', { data, error })
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('Move failed - database did not confirm the change. Check RLS policies in Supabase.')
      }

      // Refresh the data
      await fetchUploadGroups()

      // Close modal and reset state
      setShowMoveModal(false)
      setMovingGroupId(null)
      setMovingFromCollege(null)

      // If we're inside a folder that's now empty, go back to root
      if (selectedCollegeFolder === movingFromCollege) {
        const remainingInFolder = uploadGroups.filter(
          g => g.college === movingFromCollege && g.upload_group_id !== movingGroupId
        )
        if (remainingInFolder.length === 0) {
          setSelectedCollegeFolder(null)
        }
      }
    } catch (error) {
      console.error('Error moving file:', error)
      alert('Failed to move file. Please try again.')
    }
  }

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        router.push('/')
        return
      }

      // Only admin can access admin pages
      if (session.user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        router.push('/faculty/home')
        return
      }
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/')
    }
  }

  useEffect(() => {
    filterCourses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterSemester, filterYearLevel, filterDegreeProgram, filterCourseType, courses])

  // Fetch upload groups
  const fetchUploadGroups = async () => {
    setLoading(true)
    try {
      const coursesList = await fetchAllRows<Course>('class_schedules', {}, 'created_at')

      // Group by upload_group_id
      const groupMap = new Map<number, UploadGroup>()

      coursesList.forEach(course => {
        if (!groupMap.has(course.upload_group_id)) {
          groupMap.set(course.upload_group_id, {
            upload_group_id: course.upload_group_id,
            file_name: course.file_name || '',
            college: course.college || '',
            semester: course.semester || '',
            academic_year: course.academic_year || '',
            total_courses: 0,
            created_at: course.created_at,
            degree_programs: []
          })
        }
        const group = groupMap.get(course.upload_group_id)!
        group.total_courses++

        // Collect unique degree programs
        if (course.degree_program && !group.degree_programs.includes(course.degree_program)) {
          group.degree_programs.push(course.degree_program)
        }
      })

      const groups = Array.from(groupMap.values()).sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      setUploadGroups(groups)
    } catch (error) {
      console.error('Error fetching upload groups:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch courses for a group
  const fetchCourses = async (groupId: number) => {
    setLoading(true)
    try {
      const coursesList = await fetchAllRows<Course>('class_schedules', {
        upload_group_id: groupId
      }, 'course_code')

      setCourses(coursesList)
      setFilteredCourses(coursesList)
      calculateStats(coursesList)
      setViewMode('list')
    } catch (error) {
      console.error('Error fetching courses:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate stats
  const calculateStats = (coursesList: Course[]) => {
    const degreePrograms = new Set(coursesList.map(c => c.degree_program).filter(Boolean))
    const firstYear = coursesList.filter(c => c.year_level === 1).length
    const secondYear = coursesList.filter(c => c.year_level === 2).length
    const thirdYear = coursesList.filter(c => c.year_level === 3).length
    const fourthYear = coursesList.filter(c => c.year_level === 4).length

    setStats({
      totalCourses: coursesList.length,
      totalDegreePrograms: degreePrograms.size,
      firstYearCourses: firstYear,
      secondYearCourses: secondYear,
      thirdYearCourses: thirdYear,
      fourthYearCourses: fourthYear
    })

    // Expand all programs by default
    setExpandedPrograms(degreePrograms as Set<string>)

    // Expand all year levels by default
    const yearLevelKeys = new Set(['1st Year', '2nd Year', '3rd Year', '4th Year'])
    setExpandedYearLevels(yearLevelKeys)
  }

  // Filter courses
  const filterCourses = () => {
    let filtered = [...courses]

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(c =>
        c.course_code?.toLowerCase().includes(term) ||
        c.course_name?.toLowerCase().includes(term) ||
        c.degree_program?.toLowerCase().includes(term)
      )
    }

    if (filterSemester !== 'all') {
      filtered = filtered.filter(c => c.semester === filterSemester)
    }

    if (filterYearLevel !== 'all') {
      filtered = filtered.filter(c => c.year_level === parseInt(filterYearLevel))
    }

    if (filterDegreeProgram !== 'all') {
      filtered = filtered.filter(c => c.degree_program === filterDegreeProgram)
    }

    // Filter by course type (lec/lab)
    if (filterCourseType !== 'all') {
      filtered = filtered.filter(c => {
        const hasLec = (c.lec_hours || 0) > 0
        const hasLab = (c.lab_hours || 0) > 0
        switch (filterCourseType) {
          case 'lec': return hasLec && !hasLab
          case 'lab': return hasLab && !hasLec
          case 'lec_lab': return hasLec && hasLab
          default: return true
        }
      })
    }

    setFilteredCourses(filtered)
  }

  // Toggle program expansion
  const toggleProgram = (program: string) => {
    setExpandedPrograms(prev => {
      const next = new Set(prev)
      if (next.has(program)) {
        next.delete(program)
      } else {
        next.add(program)
      }
      return next
    })
  }

  // Toggle year level expansion
  const toggleYearLevel = (yearKey: string) => {
    setExpandedYearLevels(prev => {
      const next = new Set(prev)
      if (next.has(yearKey)) {
        next.delete(yearKey)
      } else {
        next.add(yearKey)
      }
      return next
    })
  }

  // Get unique degree programs
  const getDegreePrograms = () => {
    return [...new Set(courses.map(c => c.degree_program).filter(Boolean))] as string[]
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

  // Group courses by degree program and year level
  const getCoursesByProgramAndYear = () => {
    const grouped = new Map<string, Map<number, Course[]>>()

    filteredCourses.forEach(course => {
      const program = course.degree_program || 'Unassigned'
      const year = course.year_level || 1

      if (!grouped.has(program)) {
        grouped.set(program, new Map())
      }
      const programMap = grouped.get(program)!

      if (!programMap.has(year)) {
        programMap.set(year, [])
      }
      programMap.get(year)!.push(course)
    })

    return grouped
  }

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Handle back to selection
  const handleBackToSelection = () => {
    setViewMode('selection')
    setSelectedGroupId(null)
    setCourses([])
    setFilteredCourses([])
    setSearchTerm('')
    setFilterSemester('all')
    setFilterYearLevel('all')
    setFilterDegreeProgram('all')
    setFilterCourseType('all')
    fetchUploadGroups() // Refresh groups
  }

  // Handle group select
  const handleGroupSelect = (groupId: number) => {
    setSelectedGroupId(groupId)
    fetchCourses(groupId)
  }

  // ==================== CRUD Operations ====================

  // Open create modal
  const openCreateModal = () => {
    const selectedGroup = uploadGroups.find(g => g.upload_group_id === selectedGroupId)
    setFormData({
      ...emptyFormData,
      college: selectedGroup?.college || '',
      semester: selectedGroup?.semester || 'First Semester',
      department: ''
    })
    setModalMode('create')
    setEditingId(null)
    setShowModal(true)
  }

  // Open edit modal
  const openEditModal = (course: Course) => {
    setFormData({
      course_code: course.course_code || '',
      course_name: course.course_name || '',
      lec_hours: course.lec_hours || 0,
      lab_hours: course.lab_hours || 0,
      semester: course.semester || 'First Semester',
      year_level: course.year_level || 1,
      department: course.department || '',
      college: course.college || '',
      prerequisite: course.prerequisite || 'None'
    })
    setModalMode('edit')
    setEditingId(course.id)
    setFeaturesTab('lec')
    setShowModal(true)
  }

  // Close modal
  const closeModal = () => {
    setShowModal(false)
    setFormData(emptyFormData)
    setEditingId(null)
  }

  // Handle form input change
  const handleInputChange = (field: keyof CourseFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Save (Create or Update)
  const handleSave = async () => {
    if (!formData.course_code || !formData.course_name) {
      alert('Please fill in Course Code and Course Name')
      return
    }

    setSaving(true)
    try {
      // Total hours = lec_hours + lab_hours
      const total_hours = formData.lec_hours + formData.lab_hours

      if (modalMode === 'create') {
        // Create new course
        const newData = {
          upload_group_id: selectedGroupId,
          ...formData,
          total_hours: total_hours,
          file_name: 'Manual Entry'
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        console.log('Creating course:', newData)
        const { data, error } = await (supabase as any)
          .from('class_schedules')
          .insert([newData])
          .select()

        console.log('Insert result:', { data, error })
        if (error) throw error
        if (!data || data.length === 0) {
          throw new Error('Insert failed - database did not confirm the change. Check RLS policies in Supabase.')
        }

        // Refresh data
        if (selectedGroupId) {
          await fetchCourses(selectedGroupId)
        }
      } else {
        // Update existing course
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        console.log('Updating course ID:', editingId)
        const { data, error } = await (supabase as any)
          .from('class_schedules')
          .update({ ...formData, total_hours: total_hours })
          .eq('id', editingId)
          .select()

        console.log('Update result:', { data, error })
        if (error) throw error
        if (!data || data.length === 0) {
          throw new Error('Update failed - database did not confirm the change. Check RLS policies in Supabase.')
        }

        // Update local state
        setCourses(prev =>
          prev.map(c => c.id === editingId ? { ...c, ...formData, total_hours: total_hours } : c)
        )
      }

      closeModal()
      router.refresh() // Force refresh cached data
    } catch (error) {
      console.error('Error saving course:', error)
      alert('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // Delete single course
  const handleDelete = async (id: number) => {
    try {
      // Find the course to archive
      const courseToDelete = courses.find(c => c.id === id)

      if (courseToDelete) {
        // Archive the course before deleting
        try {
          const { data: { user } } = await supabase.auth.getUser()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('archived_items')
            .insert({
              item_type: 'course',
              item_name: `${courseToDelete.course_code} - ${courseToDelete.course_name}`,
              item_data: courseToDelete,
              deleted_by: user?.id || null,
              original_table: 'class_schedules',
              original_id: String(id)
            })
        } catch (archiveError) {
          console.warn('Could not archive course (table may not exist):', archiveError)
          // Continue with deletion even if archiving fails
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      console.log('Deleting course ID:', id)
      const { data, error } = await (supabase as any)
        .from('class_schedules')
        .delete()
        .eq('id', id)
        .select()

      console.log('Delete result:', { data, error })
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('Delete failed - database did not confirm the change. Check RLS policies in Supabase.')
      }

      // Update local state
      const updated = courses.filter(c => c.id !== id)
      setCourses(updated)
      calculateStats(updated)
      setDeleteConfirm(null)
      router.refresh() // Force refresh cached data
    } catch (error) {
      console.error('Error deleting course:', error)
      alert('Failed to delete. Please try again.')
    }
  }

  // Delete entire upload group
  const handleDeleteGroup = async (groupId: number) => {
    try {
      // Find the group info for archiving
      const groupToDelete = uploadGroups.find(g => g.upload_group_id === groupId)

      // Get all courses for this group for archiving
      const coursesToArchive = await fetchAllRows<Course>('class_schedules', { upload_group_id: groupId })

      if (groupToDelete && coursesToArchive.length > 0) {
        // Archive the group before deleting
        try {
          const { data: { user } } = await supabase.auth.getUser()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('archived_items')
            .insert({
              item_type: 'csv_file',
              item_name: groupToDelete.file_name || `Upload Group ${groupId}`,
              item_data: {
                group_info: groupToDelete,
                courses: coursesToArchive
              },
              deleted_by: user?.id || null,
              original_table: 'class_schedules',
              original_id: String(groupId)
            })
        } catch (archiveError) {
          console.warn('Could not archive group (table may not exist):', archiveError)
          // Continue with deletion even if archiving fails
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      console.log('Deleting upload group ID:', groupId)
      const { data, error } = await (supabase as any)
        .from('class_schedules')
        .delete()
        .eq('upload_group_id', groupId)
        .select()

      console.log('Delete group result:', { data, error })
      if (error) throw error
      if (!data || data.length === 0) {
        console.warn('No rows deleted - group may have been empty or RLS blocked the operation')
      }

      // Refresh upload groups
      await fetchUploadGroups()
      setDeleteGroupConfirm(null)
      router.refresh() // Force refresh cached data
    } catch (error) {
      console.error('Error deleting upload group:', error)
      alert('Failed to delete group. Please try again.')
    }
  }

  // ==================== Render ====================

  // Loading state
  if (loading && viewMode === 'selection') {
    return (
      <div className={styles.pageLayout}>
        <MenuBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} showSidebarToggle={true} showAccountIcon={true} />
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className={`${styles.pageMain} ${!sidebarOpen ? styles.fullWidth : ''}`}>
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p>Loading courses...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={styles.pageLayout} data-page="admin">
      <MenuBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} showSidebarToggle={true} showAccountIcon={true} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className={`${styles.pageMain} ${!sidebarOpen ? styles.fullWidth : ''}`}>
        <div className={styles.pageContainer}>

          {/* ==================== Upload Group Selection View ==================== */}
          {viewMode === 'selection' && (
            <>
              {/* Header with Title and Navigation Tabs */}
              <div className={styles.welcomeSection} id="courses-selection-header">
                <h1 className={styles.welcomeTitle}>
                  <BookOpen size={32} style={{ marginRight: '12px' }} />
                  Course Management
                </h1>
                <p className={styles.welcomeSubtitle}>
                  View and manage uploaded course curricula from CSV files
                </p>
              </div>

              {/* Navigation Tabs */}
              <div style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '24px',
                borderBottom: '2px solid var(--border-color, #e2e8f0)',
                paddingBottom: '0'
              }} id="courses-selection-tabs">
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
                  <BookMarked size={18} />
                  Courses
                </div>
                <Link href="/LandingPages/CoursesManagement/ClassSectionAssigning" style={{
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
                  <Users size={18} />
                  Class & Section Assigning
                </Link>
              </div>

              {/* Search Section */}
              <div className={styles.searchSection}>
                <div className={styles.searchBox}>
                  <Search className={styles.searchIcon} size={18} />
                  <input
                    type="text"
                    placeholder="Search by college, degree program, or file name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={styles.searchInput}
                  />
                </div>
              </div>

              {/* Breadcrumb Navigation */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '20px',
                padding: '12px 16px',
                background: 'var(--bg-white, #ffffff)',
                borderRadius: '10px',
                border: '1px solid var(--border-color, #e2e8f0)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
              }}>
                <button
                  onClick={() => setSelectedCollegeFolder(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    background: selectedCollegeFolder ? 'transparent' : 'var(--primary-gradient, linear-gradient(135deg, #1a365d 0%, #2c5282 100%))',
                    color: selectedCollegeFolder ? 'var(--text-secondary, #718096)' : 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '14px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Home size={16} />
                  All Colleges
                </button>
                {selectedCollegeFolder && (
                  <>
                    <ChevronRight size={16} style={{ color: 'var(--text-secondary, #718096)' }} />
                    <span style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      background: getFolderColor(selectedCollegeFolder),
                      color: 'white',
                      borderRadius: '6px',
                      fontWeight: 600,
                      fontSize: '14px'
                    }}>
                      <FolderOpen size={16} />
                      {getFolderDisplayName(selectedCollegeFolder)}
                    </span>
                  </>
                )}
              </div>

              {/* Folder View - College Folders */}
              {!selectedCollegeFolder && (
                <>
                  <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{
                      fontSize: '16px',
                      fontWeight: 600,
                      color: 'var(--text-dark, #1a202c)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <Folder size={20} />
                      College Folders
                    </h3>
                  </div>
                  <div className={styles.schedulesGrid} id="courses-college-grid">
                    {/* Get unique colleges from upload groups */}
                    {Array.from(new Set(uploadGroups
                      .filter(group =>
                        !searchTerm ||
                        group.college?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        group.degree_programs?.some(dp => dp.toLowerCase().includes(searchTerm.toLowerCase())) ||
                        group.file_name?.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map(group => group.college || 'Uncategorized')
                    )).sort().map((college) => {
                      const collegeGroups = uploadGroups.filter(g => (g.college || 'Uncategorized') === college)
                      const totalCourses = collegeGroups.reduce((sum, g) => sum + g.total_courses, 0)
                      const totalPrograms = new Set(collegeGroups.flatMap(g => g.degree_programs || [])).size
                      const folderColor = getFolderColor(college)

                      return (
                        <div
                          key={college}
                          className={styles.scheduleCard}
                          onClick={() => setSelectedCollegeFolder(college)}
                          style={{ cursor: 'pointer', position: 'relative' }}
                        >
                          <div className={styles.scheduleCardHeader} style={{
                            background: folderColor
                          }}>
                            <h3 className={styles.scheduleEventName}>
                              <Folder size={24} />
                              {getFolderDisplayName(college)}
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
                              <span className={styles.scheduleType}>
                                {collegeGroups.length} File(s)
                              </span>
                              {/* Settings Menu Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setFolderMenuOpen(folderMenuOpen === college ? null : college)
                                }}
                                style={{
                                  background: 'rgba(255,255,255,0.2)',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '4px 6px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                <MoreVertical size={16} color="white" />
                              </button>

                              {/* Dropdown Menu - Positioned relative to the action bar */}
                              {folderMenuOpen === college && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 12px)',
                                    left: '0',
                                    background: 'var(--bg-white, #ffffff)',
                                    borderRadius: '16px',
                                    boxShadow: '0 20px 80px rgba(0,0,0,0.3)',
                                    padding: '16px',
                                    zIndex: 99999,
                                    minWidth: '300px',
                                    border: '1px solid var(--border-color, #e2e8f0)',
                                    animation: 'fadeInUp 0.3s ease'
                                  }}
                                >
                                  <div style={{ marginBottom: '12px' }}>
                                    <label style={{
                                      fontSize: '12px',
                                      fontWeight: 600,
                                      color: 'var(--text-secondary, #718096)',
                                      marginBottom: '8px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px'
                                    }}>
                                      <Palette size={14} />
                                      Folder Color
                                    </label>
                                    <div style={{
                                      display: 'grid',
                                      gridTemplateColumns: 'repeat(4, 1fr)',
                                      gap: '6px',
                                      marginTop: '8px'
                                    }}>
                                      {FOLDER_COLORS.map((colorOption) => (
                                        <button
                                          key={colorOption.name}
                                          onClick={() => updateFolderColor(college, colorOption.gradient)}
                                          title={colorOption.name}
                                          style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '8px',
                                            border: folderColor === colorOption.gradient
                                              ? '3px solid var(--primary-medium, #2c5282)'
                                              : '2px solid var(--border-color, #e2e8f0)',
                                            background: colorOption.gradient,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease'
                                          }}
                                        />
                                      ))}
                                    </div>
                                  </div>

                                  <div style={{ borderTop: '1px solid var(--border-color, #e2e8f0)', paddingTop: '12px' }}>
                                    <label style={{
                                      fontSize: '12px',
                                      fontWeight: 600,
                                      color: 'var(--text-secondary, #718096)',
                                      marginBottom: '8px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px'
                                    }}>
                                      <Edit size={14} />
                                      Display Name
                                    </label>
                                    <input
                                      type="text"
                                      defaultValue={getFolderDisplayName(college)}
                                      placeholder={college}
                                      onFocus={(e) => e.stopPropagation()}
                                      onMouseDown={(e) => e.stopPropagation()}
                                      onClick={(e) => e.stopPropagation()}
                                      onBlur={(e) => updateFolderName(college, e.target.value)}
                                      onKeyDown={(e) => {
                                        e.stopPropagation()
                                        if (e.key === 'Enter') {
                                          updateFolderName(college, (e.target as HTMLInputElement).value)
                                        }
                                      }}
                                      style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color, #e2e8f0)',
                                        fontSize: '13px',
                                        marginTop: '6px',
                                        background: '#ffffff',
                                        color: '#1a202c'
                                      }}
                                    />
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                        handleRenameCollege(college, input.value);
                                      }}
                                      disabled={renaming}
                                      style={{
                                        width: '100%',
                                        marginTop: '8px',
                                        padding: '8px',
                                        background: renaming ? 'var(--bg-gray-100)' : 'var(--primary-gradient)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        cursor: renaming ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                      }}
                                    >
                                      {renaming ? <div className={styles.spinnerSmall}></div> : <Save size={14} />}
                                      Rename in Database (Global)
                                    </button>
                                  </div>

                                  <button
                                    onClick={() => setFolderMenuOpen(null)}
                                    style={{
                                      width: '100%',
                                      marginTop: '12px',
                                      padding: '8px',
                                      background: 'var(--bg-gray-100, #edf2f7)',
                                      border: 'none',
                                      borderRadius: '8px',
                                      fontSize: '12px',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      color: 'var(--text-secondary, #718096)'
                                    }}
                                  >
                                    Close
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className={styles.scheduleCardBody}>
                            <div className={styles.scheduleInfo}>
                              <FileText size={16} />
                              <span>{totalCourses} Total Courses</span>
                            </div>
                            <div className={styles.scheduleInfo}>
                              <GraduationCap size={16} />
                              <span>{totalPrograms} Degree Program(s)</span>
                            </div>
                          </div>
                          <div className={styles.scheduleCardFooter}>
                            <button
                              className={styles.viewButton}
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedCollegeFolder(college)
                              }}
                              style={{
                                background: folderColor
                              }}
                            >
                              <FolderOpen size={16} />
                              Open Folder
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {
                    uploadGroups.length === 0 && (
                      <div className={styles.emptyState}>
                        <Folder size={64} />
                        <h3>No Course Files Found</h3>
                        <p>Upload course curriculum CSV files from the Upload CSV page to see them here.</p>
                      </div>
                    )
                  }
                </>
              )}

              {/* Inside College Folder - Show Upload Groups */}
              {selectedCollegeFolder && (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <h3 style={{
                      fontSize: '16px',
                      fontWeight: 600,
                      color: 'var(--text-dark, #1a202c)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <FileText size={20} />
                      Course Files in {getFolderDisplayName(selectedCollegeFolder)}
                    </h3>
                  </div>
                  <div className={styles.schedulesGrid}>
                    {uploadGroups
                      .filter(group =>
                        (group.college || 'Uncategorized') === selectedCollegeFolder &&
                        (!searchTerm ||
                          group.college?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          group.degree_programs?.some(dp => dp.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          group.file_name?.toLowerCase().includes(searchTerm.toLowerCase()))
                      )
                      .map((group) => (
                        <div
                          key={group.upload_group_id}
                          className={styles.scheduleCard}
                        >
                          <div className={styles.scheduleCardHeader}>
                            <h3 className={styles.scheduleEventName}>
                              <FileText size={20} />
                              {group.degree_programs?.join(', ') || `Upload Group #${group.upload_group_id}`}
                            </h3>
                            <span className={styles.scheduleType}>
                              {group.total_courses} Courses
                            </span>
                          </div>
                          <div className={styles.scheduleCardBody} onClick={() => handleGroupSelect(group.upload_group_id)}>
                            {group.file_name && (
                              <div className={styles.scheduleInfo}>
                                <Tag size={16} />
                                <span style={{ fontSize: '12px' }}>{group.file_name}</span>
                              </div>
                            )}
                            {group.degree_programs && group.degree_programs.length > 0 && (
                              <div className={styles.scheduleInfo}>
                                <GraduationCap size={16} />
                                <span>{group.degree_programs.length} Degree Program(s)</span>
                              </div>
                            )}

                            <div className={styles.scheduleInfo}>
                              <Clock size={16} />
                              <span style={{ fontSize: '12px', opacity: 0.8 }}>Uploaded: {formatDate(group.created_at)}</span>
                            </div>
                          </div>
                          <div className={styles.scheduleCardFooter}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                className={styles.viewButton}
                                onClick={() => handleGroupSelect(group.upload_group_id)}
                                style={{ flex: 1 }}
                              >
                                <BookOpen size={16} />
                                View & Manage
                              </button>
                              <button
                                onClick={() => openMoveModal(group.upload_group_id, group.college || 'Uncategorized')}
                                style={{
                                  padding: '12px 16px',
                                  background: 'var(--primary-gradient, linear-gradient(135deg, #1a365d 0%, #2c5282 100%))',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '10px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontWeight: 600,
                                  transition: 'all 0.2s ease'
                                }}
                                title="Move to another folder"
                              >
                                <FolderInput size={16} />
                              </button>
                              <button
                                onClick={() => setDeleteGroupConfirm(group.upload_group_id)}
                                style={{
                                  padding: '12px 16px',
                                  background: '#fed7d7',
                                  color: '#c53030',
                                  border: 'none',
                                  borderRadius: '10px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontWeight: 600,
                                  transition: 'all 0.2s ease'
                                }}
                                title="Delete entire group"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>

                            {/* Delete Group Confirmation */}
                            {deleteGroupConfirm === group.upload_group_id && (
                              <div style={{
                                marginTop: '12px',
                                padding: '12px',
                                background: '#fff5f5',
                                borderRadius: '8px',
                                border: '1px solid #fed7d7'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                  <AlertCircle size={16} color="#c53030" />
                                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#c53030' }}>
                                    Delete all {group.total_courses} courses?
                                  </span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button
                                    onClick={() => handleDeleteGroup(group.upload_group_id)}
                                    style={{
                                      flex: 1,
                                      padding: '8px',
                                      background: '#c53030',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontWeight: 600,
                                      fontSize: '12px'
                                    }}
                                  >
                                    Yes, Delete All
                                  </button>
                                  <button
                                    onClick={() => setDeleteGroupConfirm(null)}
                                    style={{
                                      flex: 1,
                                      padding: '8px',
                                      background: '#e2e8f0',
                                      color: '#4a5568',
                                      border: 'none',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontWeight: 600,
                                      fontSize: '12px'
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>

                  {uploadGroups.filter(g => (g.college || 'Uncategorized') === selectedCollegeFolder).length === 0 && (
                    <div className={styles.emptyState}>
                      <FileText size={64} />
                      <h3>No Course Files Found</h3>
                      <p>No course files have been uploaded for this college yet.</p>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ==================== Courses List View ==================== */}
          {viewMode === 'list' && (
            <>
              {/* Header */}
              <div className={styles.pageHeader}>
                <div className={styles.headerLeft}>
                  <button
                    className={styles.backButton}
                    onClick={handleBackToSelection}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <ArrowLeft size={18} />
                    Back to Groups
                  </button>
                  <div className={styles.headerInfo} id="courses-list-header">
                    <h1 className={styles.pageTitle}>
                      <BookOpen size={28} />
                      {uploadGroups.find(g => g.upload_group_id === selectedGroupId)?.college || 'Courses'}
                    </h1>
                    <p className={styles.pageSubtitle}>
                      {[
                        uploadGroups.find(g => g.upload_group_id === selectedGroupId)?.semester,
                        uploadGroups.find(g => g.upload_group_id === selectedGroupId)?.academic_year
                      ].filter(Boolean).join(' - ')}{stats.totalCourses > 0 ? ` • ${stats.totalCourses} Courses` : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={openCreateModal}
                  style={{
                    padding: '12px 24px',
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
                  <Plus size={18} />
                  Add New Course
                </button>
              </div>

              {/* Stats Grid - Updated with SVG icons and Year Level Stats */}
              <div className={styles.statsGrid} id="courses-stats-ribbon">
                <div className={`${styles.statCard} ${styles.blue}`}>
                  <div className={styles.statIcon}>
                    <BookOpen size={24} />
                  </div>
                  <div className={styles.statContent}>
                    <span className={styles.statLabel}>Total Courses</span>
                    <span className={styles.statValue}>{stats.totalCourses}</span>
                  </div>
                </div>
                <div className={`${styles.statCard} ${styles.green}`}>
                  <div className={styles.statIcon}>
                    <GraduationCap size={24} />
                  </div>
                  <div className={styles.statContent}>
                    <span className={styles.statLabel}>Degree Programs</span>
                    <span className={styles.statValue}>{stats.totalDegreePrograms}</span>
                  </div>
                </div>
                <div className={`${styles.statCard} ${styles.purple}`}>
                  <div className={styles.statIcon}>
                    <Layers size={24} />
                  </div>
                  <div className={styles.statContent}>
                    <span className={styles.statLabel}>1st Year</span>
                    <span className={styles.statValue}>{stats.firstYearCourses}</span>
                  </div>
                </div>
                <div className={`${styles.statCard} ${styles.orange}`}>
                  <div className={styles.statIcon}>
                    <Layers size={24} />
                  </div>
                  <div className={styles.statContent}>
                    <span className={styles.statLabel}>2nd Year</span>
                    <span className={styles.statValue}>{stats.secondYearCourses}</span>
                  </div>
                </div>
              </div>

              {/* Secondary Stats Row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '16px',
                marginBottom: '24px'
              }}>
                <div style={{
                  background: 'var(--card-bg, #fff)',
                  padding: '16px 20px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    padding: '10px',
                    background: 'rgba(99, 102, 241, 0.1)',
                    borderRadius: '10px',
                    color: '#6366f1'
                  }}>
                    <Layers size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary, #718096)', fontWeight: 500 }}>3rd Year Courses</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-dark, #1a202c)' }}>{stats.thirdYearCourses}</div>
                  </div>
                </div>
                <div style={{
                  background: 'var(--card-bg, #fff)',
                  padding: '16px 20px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    padding: '10px',
                    background: 'rgba(236, 72, 153, 0.1)',
                    borderRadius: '10px',
                    color: '#ec4899'
                  }}>
                    <Layers size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary, #718096)', fontWeight: 500 }}>4th Year Courses</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-dark, #1a202c)' }}>{stats.fourthYearCourses}</div>
                  </div>
                </div>
              </div>

              {/* Filters - Updated with Semester, Year Level, Degree Program */}
              <div style={{
                display: 'flex',
                gap: '16px',
                marginBottom: '24px',
                flexWrap: 'wrap',
                alignItems: 'center'
              }} id="courses-list-filters">
                <div className={styles.searchBox} style={{ flex: '1', minWidth: '250px' }}>
                  <Search className={styles.searchIcon} size={18} />
                  <input
                    type="text"
                    placeholder="Search by course code or name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={styles.searchInput}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Filter size={16} style={{ color: 'var(--text-secondary, #718096)' }} />
                </div>

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
                    minWidth: '150px',
                    color: 'var(--text-dark, #1a202c)'
                  }}
                >
                  <option value="all">All Semesters</option>
                  {semesters.map(sem => (
                    <option key={sem} value={sem}>{sem}</option>
                  ))}
                </select>

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
                  value={filterCourseType}
                  onChange={(e) => setFilterCourseType(e.target.value)}
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
                  <option value="all">All Types</option>
                  <option value="lec">Lecture Only</option>
                  <option value="lab">Lab Only</option>
                  <option value="lec_lab">Lec + Lab</option>
                </select>
              </div>

              {/* Loading */}
              {loading && (
                <div className={styles.loadingState}>
                  <div className={styles.spinner}></div>
                  <p>Loading courses...</p>
                </div>
              )}

              {/* Courses Grouped by Degree Program and Year Level */}
              {!loading && (
                <div className={styles.campusView}>
                  {Array.from(getCoursesByProgramAndYear().entries()).map(([program, yearMap]) => (
                    <div key={program} className={styles.campusSection}>
                      {/* Degree Program Header */}
                      <div
                        className={styles.campusHeaderRow}
                        onClick={() => toggleProgram(program)}
                        style={{ marginBottom: '12px' }}
                      >
                        <GraduationCap size={20} />
                        <span style={{ fontWeight: 700, fontSize: '16px' }}>{program}</span>
                        <span className={styles.roomCount}>
                          {Array.from(yearMap.values()).reduce((sum, arr) => sum + arr.length, 0)} courses
                        </span>
                        <button className={styles.toggleBtn}>
                          {expandedPrograms.has(program) ? (
                            <ChevronDown size={20} />
                          ) : (
                            <ChevronRight size={20} />
                          )}
                        </button>
                      </div>

                      {expandedPrograms.has(program) && (
                        <div style={{ marginLeft: '20px' }}>
                          {/* Year Level Groups */}
                          {Array.from(yearMap.entries())
                            .sort((a, b) => a[0] - b[0])
                            .map(([year, yearCourses]) => {
                              const yearKey = `${program}-${year}`
                              const yearLabel = getYearLevelLabel(year)

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
                                      marginBottom: '8px'
                                    }}
                                  >
                                    <Layers size={16} style={{ color: 'var(--primary-medium, #38a169)' }} />
                                    <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-dark, #1a202c)' }}>
                                      {yearLabel}
                                    </span>
                                    <span style={{
                                      fontSize: '12px',
                                      color: 'var(--text-secondary, #718096)',
                                      background: 'var(--bg-gray-100, #edf2f7)',
                                      padding: '2px 8px',
                                      borderRadius: '10px'
                                    }}>
                                      {yearCourses.length} courses
                                    </span>
                                    <div style={{ marginLeft: 'auto' }}>
                                      {expandedYearLevels.has(yearKey) ? (
                                        <ChevronDown size={16} />
                                      ) : (
                                        <ChevronRight size={16} />
                                      )}
                                    </div>
                                  </div>

                                  {/* Course Cards for this Year Level */}
                                  {expandedYearLevels.has(yearKey) && (
                                    <div style={{
                                      display: 'grid',
                                      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                                      gap: '12px',
                                      marginLeft: '16px'
                                    }}>
                                      {yearCourses.map((course) => (
                                        <div
                                          key={course.id}
                                          style={{
                                            background: 'var(--card-bg, #fff)',
                                            borderRadius: '12px',
                                            border: '1px solid var(--border-color, #e2e8f0)',
                                            padding: '16px',
                                            transition: 'all 0.2s ease',
                                            position: 'relative'
                                          }}
                                        >
                                          {/* Course Header */}
                                          <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'flex-start',
                                            marginBottom: '12px'
                                          }}>
                                            <div>
                                              <span style={{
                                                fontWeight: 700,
                                                color: 'var(--primary-dark, #276749)',
                                                fontSize: '15px',
                                                display: 'block',
                                                marginBottom: '4px'
                                              }}>
                                                {course.course_code}
                                              </span>
                                              <span style={{
                                                fontWeight: 500,
                                                color: 'var(--text-dark, #1a202c)',
                                                fontSize: '13px',
                                                lineHeight: '1.4'
                                              }}>
                                                {course.course_name || 'N/A'}
                                              </span>
                                            </div>

                                            {/* Actions */}
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                              <button
                                                onClick={() => openEditModal(course)}
                                                style={{
                                                  padding: '6px',
                                                  background: 'var(--bg-gray-100, #edf2f7)',
                                                  color: 'var(--text-secondary, #718096)',
                                                  border: 'none',
                                                  borderRadius: '6px',
                                                  cursor: 'pointer',
                                                  display: 'flex',
                                                  alignItems: 'center'
                                                }}
                                                title="Edit"
                                              >
                                                <Edit size={14} />
                                              </button>

                                              {deleteConfirm === course.id ? (
                                                <div style={{ display: 'flex', gap: '2px' }}>
                                                  <button
                                                    onClick={() => handleDelete(course.id)}
                                                    style={{
                                                      padding: '6px 8px',
                                                      background: '#c53030',
                                                      color: 'white',
                                                      border: 'none',
                                                      borderRadius: '6px',
                                                      cursor: 'pointer',
                                                      fontSize: '10px',
                                                      fontWeight: 600
                                                    }}
                                                  >
                                                    Yes
                                                  </button>
                                                  <button
                                                    onClick={() => setDeleteConfirm(null)}
                                                    style={{
                                                      padding: '6px 8px',
                                                      background: '#e2e8f0',
                                                      color: '#4a5568',
                                                      border: 'none',
                                                      borderRadius: '6px',
                                                      cursor: 'pointer',
                                                      fontSize: '10px',
                                                      fontWeight: 600
                                                    }}
                                                  >
                                                    No
                                                  </button>
                                                </div>
                                              ) : (
                                                <button
                                                  onClick={() => setDeleteConfirm(course.id)}
                                                  style={{
                                                    padding: '6px',
                                                    background: '#fed7d7',
                                                    color: '#c53030',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center'
                                                  }}
                                                  title="Delete"
                                                >
                                                  <Trash2 size={14} />
                                                </button>
                                              )}
                                            </div>
                                          </div>

                                          {/* Course Details */}
                                          <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: '8px',
                                            fontSize: '12px',
                                            color: 'var(--text-secondary, #718096)'
                                          }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                              <Clock size={12} />
                                              <span>Lec: {course.lec_hours || 0} hrs</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                              <Clock size={12} />
                                              <span>Lab: {course.lab_hours || 0} hrs</span>
                                            </div>
                                            {course.prerequisite && course.prerequisite !== 'None' && (
                                              <div style={{
                                                gridColumn: '1 / -1',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                marginTop: '4px'
                                              }}>
                                                <BookMarked size={12} />
                                                <span>Pre-req: {course.prerequisite}</span>
                                              </div>
                                            )}
                                          </div>

                                          {/* Semester Badge */}
                                          <div style={{
                                            marginTop: '12px',
                                            display: 'flex',
                                            gap: '6px'
                                          }}>
                                            <span style={{
                                              background: 'rgba(56, 161, 105, 0.1)',
                                              color: 'var(--primary-medium, #38a169)',
                                              padding: '4px 10px',
                                              borderRadius: '6px',
                                              fontSize: '11px',
                                              fontWeight: 600
                                            }}>
                                              {course.semester || 'N/A'}
                                            </span>
                                            <span style={{
                                              background: 'rgba(66, 153, 225, 0.1)',
                                              color: '#4299e1',
                                              padding: '4px 10px',
                                              borderRadius: '6px',
                                              fontSize: '11px',
                                              fontWeight: 600
                                            }}>
                                              {(course.lec_hours || 0) + (course.lab_hours || 0)} Total Hours
                                            </span>
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
                  ))}
                </div>
              )}

              {/* Empty State */}
              {!loading && filteredCourses.length === 0 && (
                <div className={styles.emptyState}>
                  <BookOpen size={64} />
                  <h3>No Courses Found</h3>
                  <p>Try adjusting your search or filter criteria, or add a new course.</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* ==================== Move File Modal ==================== */}
      {showMoveModal && (
        <div
          onClick={() => setShowMoveModal(false)}
          style={{
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
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-white, #ffffff)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '450px',
              maxHeight: '80vh',
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
            }}
            data-modal="move-file"
          >
            {/* Modal Header */}
            <div
              data-modal-header="move-file"
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-color, #e2e8f0)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--primary-gradient, linear-gradient(135deg, #1a365d 0%, #2c5282 100%))',
                color: 'white'
              }}>
              <h3 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <FolderInput size={22} />
                Move File to Folder
              </h3>
              <button
                onClick={() => {
                  setShowMoveModal(false)
                  setMovingGroupId(null)
                  setMovingFromCollege(null)
                }}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={20} color="white" />
              </button>
            </div>

            {/* Current Location */}
            <div style={{
              padding: '16px 24px',
              background: 'var(--bg-gray-50, #f7fafc)',
              borderBottom: '1px solid var(--border-color, #e2e8f0)'
            }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary, #718096)', marginBottom: '4px' }}>
                Moving from:
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text-dark, #1a202c)'
              }}>
                <Folder size={18} style={{ color: 'var(--primary-medium, #2c5282)' }} />
                {movingFromCollege && getFolderDisplayName(movingFromCollege)}
              </div>
            </div>

            {/* Destination Folders */}
            <div style={{
              padding: '16px 24px',
              maxHeight: '400px',
              overflowY: 'auto'
            }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary, #718096)', marginBottom: '12px' }}>
                Select destination folder:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {getAllColleges().map((college) => {
                  const isCurrentFolder = college === movingFromCollege
                  const folderColor = getFolderColor(college)

                  return (
                    <button
                      key={college}
                      onClick={() => !isCurrentFolder && handleMoveFile(college)}
                      disabled={isCurrentFolder}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '14px 16px',
                        background: isCurrentFolder
                          ? 'var(--bg-gray-100, #edf2f7)'
                          : 'var(--bg-white, #ffffff)',
                        border: isCurrentFolder
                          ? '2px dashed var(--border-color, #e2e8f0)'
                          : '2px solid var(--border-color, #e2e8f0)',
                        borderRadius: '12px',
                        cursor: isCurrentFolder ? 'not-allowed' : 'pointer',
                        opacity: isCurrentFolder ? 0.6 : 1,
                        transition: 'all 0.2s ease',
                        textAlign: 'left'
                      }}
                      onMouseEnter={(e) => {
                        if (!isCurrentFolder) {
                          e.currentTarget.style.borderColor = 'var(--primary-medium, #2c5282)'
                          e.currentTarget.style.background = 'var(--primary-light, rgba(44, 82, 130, 0.05))'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isCurrentFolder) {
                          e.currentTarget.style.borderColor = 'var(--border-color, #e2e8f0)'
                          e.currentTarget.style.background = 'var(--bg-white, #ffffff)'
                        }
                      }}
                    >
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background: folderColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Folder size={20} color="white" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontWeight: 600,
                          fontSize: '14px',
                          color: 'var(--text-dark, #1a202c)'
                        }}>
                          {getFolderDisplayName(college)}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: 'var(--text-secondary, #718096)',
                          marginTop: '2px'
                        }}>
                          {uploadGroups.filter(g => (g.college || 'Uncategorized') === college).length} file(s)
                        </div>
                      </div>
                      {!isCurrentFolder && (
                        <MoveRight size={18} style={{ color: 'var(--primary-medium, #2c5282)' }} />
                      )}
                      {isCurrentFolder && (
                        <span style={{
                          fontSize: '11px',
                          color: 'var(--text-secondary, #718096)',
                          fontWeight: 500
                        }}>
                          Current
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-color, #e2e8f0)',
              background: 'var(--bg-gray-50, #f7fafc)'
            }}>
              <button
                onClick={() => {
                  setShowMoveModal(false)
                  setMovingGroupId(null)
                  setMovingFromCollege(null)
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'var(--bg-gray-200, #e2e8f0)',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: 'var(--text-secondary, #718096)'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Create/Edit Modal ==================== */}
      {showModal && (
        <div
          onClick={closeModal}
          style={{
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
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--card-bg)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '700px',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: 'var(--shadow-md)'
            }}>
            {/* Modal Header */}
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
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                {modalMode === 'create' ? <Plus size={20} /> : <Edit size={20} />}
                {modalMode === 'create' ? 'Add New Course' : 'Edit Course'}
              </h2>
              <button
                onClick={closeModal}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  color: 'white',
                  padding: '8px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px' }} id="course-modal-details">
              {/* Course Info Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--label-color)' }}>
                    Course Code *
                  </label>
                  <input
                    type="text"
                    value={formData.course_code}
                    onChange={(e) => handleInputChange('course_code', e.target.value)}
                    placeholder="e.g., CS101"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '2px solid var(--input-border)',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: 'var(--input-text)',
                      background: 'var(--input-bg)',
                      transition: 'border-color 0.2s'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--label-color)' }}>
                    Course Name *
                  </label>
                  <input
                    type="text"
                    value={formData.course_name}
                    onChange={(e) => handleInputChange('course_name', e.target.value)}
                    placeholder="e.g., Introduction to Programming"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '2px solid var(--input-border)',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: 'var(--input-text)',
                      background: 'var(--input-bg)'
                    }}
                  />
                </div>
              </div>

              {/* Hours Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--label-color)' }}>
                    Lecture Hours
                  </label>
                  <input
                    type="number"
                    value={formData.lec_hours}
                    onChange={(e) => handleInputChange('lec_hours', parseInt(e.target.value) || 0)}
                    min="0"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '2px solid var(--input-border)',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: 'var(--input-text)',
                      background: 'var(--input-bg)'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--label-color)' }}>
                    Lab Hours
                  </label>
                  <input
                    type="number"
                    value={formData.lab_hours}
                    onChange={(e) => handleInputChange('lab_hours', parseInt(e.target.value) || 0)}
                    min="0"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '2px solid var(--input-border)',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: 'var(--input-text)',
                      background: 'var(--input-bg)'
                    }}
                  />
                </div>
              </div>

              {/* Semester & Year Level Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--label-color)' }}>
                    <Calendar size={14} style={{ marginRight: '6px' }} />
                    Semester
                  </label>
                  <select
                    value={formData.semester}
                    onChange={(e) => handleInputChange('semester', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '2px solid var(--input-border)',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: 'var(--input-text)',
                      background: 'var(--input-bg)',
                      cursor: 'pointer'
                    }}
                  >
                    {semesters.map(sem => (
                      <option key={sem} value={sem}>{sem}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--label-color)' }}>
                    <Layers size={14} style={{ marginRight: '6px' }} />
                    Year Level
                  </label>
                  <select
                    value={formData.year_level}
                    onChange={(e) => handleInputChange('year_level', parseInt(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '2px solid var(--input-border)',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: 'var(--input-text)',
                      background: 'var(--input-bg)',
                      cursor: 'pointer'
                    }}
                  >
                    {yearLevels.map(year => (
                      <option key={year} value={year}>{getYearLevelLabel(year)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Department & Prerequisite Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--label-color)' }}>
                    <GraduationCap size={14} style={{ marginRight: '6px' }} />
                    Department
                  </label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => handleInputChange('department', e.target.value)}
                    placeholder="e.g., Computer Science"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '2px solid var(--input-border)',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: 'var(--input-text)',
                      background: 'var(--input-bg)'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--label-color)' }}>
                    <BookMarked size={14} style={{ marginRight: '6px' }} />
                    Pre-requisite
                  </label>
                  <input
                    type="text"
                    value={formData.prerequisite}
                    onChange={(e) => handleInputChange('prerequisite', e.target.value)}
                    placeholder="e.g., CS100 or None"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '2px solid var(--input-border)',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: 'var(--input-text)',
                      background: 'var(--input-bg)'
                    }}
                  />
                </div>
              </div>

              {/* Room Requirements Section - Only show in Edit mode when we have an ID */}
              {modalMode === 'edit' && editingId && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '12px',
                    padding: '10px 14px',
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(99, 102, 241, 0.05) 100%)',
                    borderRadius: '8px',
                    border: '1px solid rgba(139, 92, 246, 0.2)'
                  }} id="course-equipment-section">
                    <Beaker size={18} style={{ color: '#8b5cf6' }} />
                    <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                      Required Room Equipment
                    </span>
                    <span style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      fontStyle: 'italic',
                      marginLeft: 'auto'
                    }}>
                      (Scheduler will only assign rooms with these features)
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }} id="course-equipment-tabs">
                    <button
                      onClick={() => setFeaturesTab('lec')}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '8px',
                        border: featuresTab === 'lec' ? '2px solid #8b5cf6' : '1px solid var(--border-color)',
                        background: featuresTab === 'lec' ? 'rgba(139, 92, 246, 0.1)' : 'var(--bg-gray-50)',
                        color: featuresTab === 'lec' ? '#7c3aed' : 'var(--text-secondary)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <Presentation size={16} /> Lecture Requirements
                    </button>
                    <button
                      onClick={() => setFeaturesTab('lab')}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '8px',
                        border: featuresTab === 'lab' ? '2px solid #38a169' : '1px solid var(--border-color)',
                        background: featuresTab === 'lab' ? 'rgba(56, 161, 105, 0.1)' : 'var(--bg-gray-50)',
                        color: featuresTab === 'lab' ? '#2f855a' : 'var(--text-secondary)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <Monitor size={16} /> Lab Requirements
                    </button>
                  </div>

                  <FeatureTagsManager
                    key={featuresTab}
                    mode="course"
                    entityId={editingId}
                    entityName={formData.course_code}
                    subType={featuresTab}
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={closeModal}
                  style={{
                    padding: '12px 24px',
                    background: 'var(--bg-gray-100)',
                    color: 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    padding: '12px 24px',
                    background: saving ? 'var(--bg-gray-100)' : 'var(--primary-gradient)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: saving ? 'none' : 'var(--shadow-sm)'
                  }}
                >
                  <Save size={16} />
                  {saving ? 'Saving...' : (modalMode === 'create' ? 'Create Course' : 'Save Changes')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Loading fallback component
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
      <p style={{ color: '#718096', fontWeight: 500 }}>Loading Courses...</p>
    </div>
  )
}

// Main export wrapped in Suspense
export default function CoursesManagementPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CoursesManagementContent />
    </Suspense>
  )
}

