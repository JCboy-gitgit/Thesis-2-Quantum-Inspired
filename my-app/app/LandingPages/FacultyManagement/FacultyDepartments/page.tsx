'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/app/hooks/useAuth'
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
  FolderOpen,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  Check,
  AlertTriangle,
  Upload,
  FileSpreadsheet,
  Download
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

interface DepartmentFormData {
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

const initialFormData: DepartmentFormData = {
  department_code: '',
  department_name: '',
  college: '',
  head_name: '',
  head_email: '',
  contact_phone: '',
  office_location: '',
  description: '',
  is_active: true
}

export default function FacultyDepartmentsPage() {
  const router = useRouter()
  const { isAdmin, isLoading: authLoading, isAuthenticated } = useAuth({
    requireAuth: true,
    requireAdmin: true,
    redirectTo: '/faculty/login'
  })

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

  // CRUD States
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [formData, setFormData] = useState<DepartmentFormData>(initialFormData)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  // Delete Confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<Department | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // CSV Upload States
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [csvPreview, setCsvPreview] = useState<any[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!authLoading && isAuthenticated && isAdmin) {
      fetchDepartments()
    }
  }, [authLoading, isAuthenticated, isAdmin])

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

  // CRUD Functions
  const openCreateModal = () => {
    setFormData(initialFormData)
    setEditingId(null)
    setModalMode('create')
    setFormError(null)
    setFormSuccess(null)
    setShowModal(true)
  }

  const openEditModal = (dept: Department) => {
    setFormData({
      department_code: dept.department_code,
      department_name: dept.department_name,
      college: dept.college || '',
      head_name: dept.head_name || '',
      head_email: dept.head_email || '',
      contact_phone: dept.contact_phone || '',
      office_location: dept.office_location || '',
      description: dept.description || '',
      is_active: dept.is_active
    })
    setEditingId(dept.id)
    setModalMode('edit')
    setFormError(null)
    setFormSuccess(null)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setFormData(initialFormData)
    setEditingId(null)
    setFormError(null)
    setFormSuccess(null)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError(null)
    setFormSuccess(null)

    try {
      if (!formData.department_code || !formData.department_name) {
        throw new Error('Department code and name are required')
      }

      if (modalMode === 'create') {
        console.log('Creating department:', formData)
        const { data, error } = await (supabase
          .from('departments') as any)
          .insert([{
            ...formData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select()

        console.log('Insert result:', { data, error })
        if (error) throw error
        if (!data || data.length === 0) {
          throw new Error('Insert failed - database did not confirm the change. Check RLS policies in Supabase.')
        }
        setFormSuccess('Department created successfully!')
      } else {
        console.log('Updating department ID:', editingId)
        const { data, error } = await (supabase
          .from('departments') as any)
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId)
          .select()

        console.log('Update result:', { data, error })
        if (error) throw error
        if (!data || data.length === 0) {
          throw new Error('Update failed - database did not confirm the change. Check RLS policies in Supabase.')
        }
        setFormSuccess('Department updated successfully!')
      }

      await fetchDepartments()
      setTimeout(() => {
        closeModal()
      }, 1500)

    } catch (error: any) {
      console.error('Error saving department:', error)
      setFormError(error.message || 'Failed to save department')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    setDeleteLoading(true)

    try {
      // First archive the department
      const { error: archiveError } = await (supabase
        .from('archived_items') as any)
        .insert([{
          item_type: 'department',
          item_name: deleteConfirm.department_name,
          item_data: deleteConfirm,
          original_table: 'departments',
          original_id: String(deleteConfirm.id)
        }])

      if (archiveError) {
        console.warn('Failed to archive, but continuing with deletion:', archiveError)
      }

      // Then delete the department
      console.log('Deleting department ID:', deleteConfirm.id)
      const { data, error } = await supabase
        .from('departments')
        .delete()
        .eq('id', deleteConfirm.id)
        .select()

      console.log('Delete result:', { data, error })
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('Delete failed - database did not confirm the change. Check RLS policies in Supabase.')
      }

      await fetchDepartments()
      setDeleteConfirm(null)

    } catch (error: any) {
      console.error('Error deleting department:', error)
      alert('Failed to delete department: ' + error.message)
    } finally {
      setDeleteLoading(false)
    }
  }

  // CSV Upload Functions
  const openUploadModal = () => {
    setShowUploadModal(true)
    setUploadError(null)
    setUploadSuccess(null)
    setCsvPreview([])
  }

  const closeUploadModal = () => {
    setShowUploadModal(false)
    setUploadError(null)
    setUploadSuccess(null)
    setCsvPreview([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const parseCSV = (text: string): any[] => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
    const data: any[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || []
      const row: any = {}

      headers.forEach((header, index) => {
        let value = values[index] || ''
        value = value.replace(/^"|"$/g, '').trim()
        row[header] = value
      })

      if (Object.values(row).some(v => v)) {
        data.push(row)
      }
    }

    return data
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadError(null)
    setUploadSuccess(null)

    if (!file.name.endsWith('.csv')) {
      setUploadError('Please select a valid CSV file')
      return
    }

    try {
      const text = await file.text()
      const data = parseCSV(text)

      if (data.length === 0) {
        setUploadError('No valid data found in CSV file')
        return
      }

      setCsvPreview(data.slice(0, 10)) // Show first 10 rows
      setUploadSuccess(`Found ${data.length} faculty records. Click "Import" to add them.`)
    } catch (error) {
      setUploadError('Failed to read CSV file')
    }
  }

  const handleImportFaculty = async () => {
    if (csvPreview.length === 0) {
      setUploadError('No data to import')
      return
    }

    setUploadLoading(true)
    setUploadError(null)

    try {
      const file = fileInputRef.current?.files?.[0]
      if (!file) throw new Error('No file selected')

      const text = await file.text()
      const data = parseCSV(text)

      // Insert faculty data into database
      const facultyRecords = data.map(row => ({
        faculty_id: row.faculty_id || null,
        full_name: row.full_name || '',
        position: row.position || 'Faculty',
        role: row.role || 'faculty',
        department: row.department || '',
        college: row.college || '',
        email: row.email || '',
        phone: row.phone || null,
        office_location: row.office_location || null,
        is_active: row.is_active === 'true' || row.is_active === '1',
        profile_image: row.profile_image || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }))

      // Try to insert into faculty_profiles table
      const { error } = await (supabase
        .from('faculty_profiles') as any)
        .upsert(facultyRecords, {
          onConflict: 'faculty_id',
          ignoreDuplicates: false
        })

      if (error) {
        // If table doesn't exist or different schema, try alternative
        console.warn('faculty_profiles insert error:', error)
        throw new Error(`Import failed: ${error.message}. Please ensure the faculty_profiles table exists.`)
      }

      setUploadSuccess(`Successfully imported ${data.length} faculty records!`)
      setTimeout(() => {
        closeUploadModal()
        fetchDepartments() // Refresh data
      }, 2000)

    } catch (error: any) {
      console.error('Import error:', error)
      setUploadError(error.message || 'Failed to import faculty data')
    } finally {
      setUploadLoading(false)
    }
  }

  const downloadSampleCSV = () => {
    const sampleData = `faculty_id,full_name,position,role,department,college,email,phone,office_location,is_active,profile_image
CS-001,Thelma V. Pagtalunan,Dean,administrator,College of Science,College of Science,thelma.pagtalunan@bulsu.edu.ph,(044) 123-4001,CS Building Room 101,true,
CS-002,Benedict M. Estrella,Associate Dean,administrator,College of Science,College of Science,benedict.estrella@bulsu.edu.ph,(044) 123-4002,CS Building Room 102,true,
CS-003,Rosario M. Poñado,Department Head,department_head,Science Department,College of Science,rosario.ponado@bulsu.edu.ph,(044) 123-4003,CS Building Room 103,true,`

    const blob = new Blob([sampleData], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'faculty_template.csv'
    link.click()
  }

  if (authLoading) {
    return (
      <div className={styles.pageLayout}>
        <div className={styles.loadingState} style={{ marginTop: '100px' }}>
          <div className={styles.spinner}></div>
          <p>Checking authentication...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.pageLayout} data-page="admin">
      <MenuBar
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        showSidebarToggle={true}
        setSidebarOpen={setSidebarOpen}
      />
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
              <div className={styles.headerButtons}>
                <button className={styles.uploadButton} onClick={openUploadModal}>
                  <Upload size={20} />
                  Upload Faculty CSV
                </button>
                <button className={styles.addButton} onClick={openCreateModal}>
                  <Plus size={20} />
                  Add Department
                </button>
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
                      <span className={`${styles.departmentBadge} ${dept.is_active ? styles.active : styles.inactive}`}>
                        {dept.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className={styles.departmentActions}>
                      <button
                        className={styles.actionBtn}
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditModal(dept)
                        }}
                        title="Edit Department"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        className={`${styles.actionBtn} ${styles.deleteBtn}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteConfirm(dept)
                        }}
                        title="Delete Department"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>
                {modalMode === 'create' ? <Plus size={24} /> : <Edit2 size={24} />}
                {modalMode === 'create' ? 'Add New Department' : 'Edit Department'}
              </h2>
              <button className={styles.modalClose} onClick={closeModal}>
                <X size={24} />
              </button>
            </div>

            {formError && (
              <div className={`${styles.formMessage} ${styles.error}`}>
                <AlertTriangle size={18} />
                {formError}
              </div>
            )}

            {formSuccess && (
              <div className={`${styles.formMessage} ${styles.success}`}>
                <Check size={18} />
                {formSuccess}
              </div>
            )}

            <form onSubmit={handleSubmit} className={styles.modalForm}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Department Code *</label>
                  <input
                    type="text"
                    name="department_code"
                    value={formData.department_code}
                    onChange={handleInputChange}
                    placeholder="e.g., CICS"
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Department Name *</label>
                  <input
                    type="text"
                    name="department_name"
                    value={formData.department_name}
                    onChange={handleInputChange}
                    placeholder="e.g., College of Information and Computing Sciences"
                    required
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>College</label>
                  <input
                    type="text"
                    name="college"
                    value={formData.college}
                    onChange={handleInputChange}
                    placeholder="e.g., BulSU Main Campus"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Office Location</label>
                  <input
                    type="text"
                    name="office_location"
                    value={formData.office_location}
                    onChange={handleInputChange}
                    placeholder="e.g., Building A, Room 101"
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Department Head</label>
                  <input
                    type="text"
                    name="head_name"
                    value={formData.head_name}
                    onChange={handleInputChange}
                    placeholder="e.g., Dr. Juan Dela Cruz"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Head Email</label>
                  <input
                    type="email"
                    name="head_email"
                    value={formData.head_email}
                    onChange={handleInputChange}
                    placeholder="e.g., head@ms.bulsu.edu.ph"
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Contact Phone</label>
                  <input
                    type="tel"
                    name="contact_phone"
                    value={formData.contact_phone}
                    onChange={handleInputChange}
                    placeholder="e.g., (044) 123-4567"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Status</label>
                  <select
                    name="is_active"
                    value={formData.is_active ? 'true' : 'false'}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.value === 'true' }))}
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                <label>Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Brief description of the department..."
                  rows={3}
                />
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={closeModal}
                  disabled={formLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={formLoading}
                >
                  {formLoading ? (
                    <>
                      <div className={styles.btnSpinner}></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      {modalMode === 'create' ? 'Create Department' : 'Update Department'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className={styles.modalOverlay} onClick={() => setDeleteConfirm(null)}>
          <div className={styles.confirmModal} onClick={e => e.stopPropagation()}>
            <div className={styles.confirmIcon}>
              <AlertTriangle size={48} />
            </div>
            <h3>Delete Department</h3>
            <p>
              Are you sure you want to delete <strong>{deleteConfirm.department_name}</strong>?
              <br />
              <span className={styles.warningText}>This will move the department to archive.</span>
            </p>
            <div className={styles.confirmActions}>
              <button
                className={styles.btnSecondary}
                onClick={() => setDeleteConfirm(null)}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                className={styles.btnDanger}
                onClick={handleDelete}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Upload Modal */}
      {showUploadModal && (
        <div className={styles.modalOverlay} onClick={closeUploadModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>
                <Upload size={24} />
                Upload Faculty CSV
              </h2>
              <button className={styles.modalClose} onClick={closeUploadModal}>
                <X size={24} />
              </button>
            </div>

            {uploadError && (
              <div className={`${styles.formMessage} ${styles.error}`}>
                <AlertTriangle size={18} />
                {uploadError}
              </div>
            )}

            {uploadSuccess && (
              <div className={`${styles.formMessage} ${styles.success}`}>
                <Check size={18} />
                {uploadSuccess}
              </div>
            )}

            <div className={styles.uploadContent}>
              <div className={styles.uploadZone}>
                <FileSpreadsheet size={48} className={styles.uploadIcon} />
                <h3>Select CSV File</h3>
                <p>Upload faculty data in CSV format</p>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv"
                  onChange={handleFileSelect}
                  className={styles.fileInput}
                />
                <button
                  className={styles.btnSecondary}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={18} />
                  Choose File
                </button>
              </div>

              <div className={styles.uploadInfo}>
                <h4>CSV Format Requirements:</h4>
                <ul>
                  <li><strong>faculty_id</strong> - Unique identifier (e.g., CS-001)</li>
                  <li><strong>full_name</strong> - Full name of faculty member</li>
                  <li><strong>position</strong> - Job title (Dean, Professor, etc.)</li>
                  <li><strong>role</strong> - administrator, department_head, program_chair, coordinator, faculty, staff</li>
                  <li><strong>department</strong> - Department or program name</li>
                  <li><strong>college</strong> - College name</li>
                  <li><strong>email</strong> - Email address</li>
                  <li><strong>phone</strong> - Contact number (optional)</li>
                  <li><strong>office_location</strong> - Office location (optional)</li>
                  <li><strong>is_active</strong> - true/false</li>
                </ul>
                <button
                  className={styles.downloadSampleBtn}
                  onClick={downloadSampleCSV}
                >
                  <Download size={16} />
                  Download Sample Template
                </button>
              </div>

              {csvPreview.length > 0 && (
                <div className={styles.csvPreview}>
                  <h4>Preview (First {csvPreview.length} records):</h4>
                  <div className={styles.previewTable}>
                    <table>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Name</th>
                          <th>Position</th>
                          <th>Department</th>
                          <th>College</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.map((row, i) => (
                          <tr key={i}>
                            <td>{row.faculty_id}</td>
                            <td>{row.full_name}</td>
                            <td>{row.position}</td>
                            <td>{row.department}</td>
                            <td>{row.college?.substring(0, 20)}...</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={closeUploadModal}
                disabled={uploadLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleImportFaculty}
                disabled={uploadLoading || csvPreview.length === 0}
              >
                {uploadLoading ? (
                  <>
                    <div className={styles.btnSpinner}></div>
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    Import Faculty
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}