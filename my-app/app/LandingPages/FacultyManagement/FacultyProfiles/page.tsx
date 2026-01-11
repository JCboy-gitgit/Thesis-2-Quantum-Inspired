'use client'

import { Suspense, useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import styles from './styles.module.css'
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
  FaChalkboardTeacher
} from 'react-icons/fa'

// Interfaces
interface TeacherFile {
  upload_group_id: number
  file_name: string
  batch_name: string
  department: string
  created_at: string
  teacher_count: number
}

interface Teacher {
  id: number
  upload_group_id: number
  teacher_id: string
  name: string
  schedule_day: string
  schedule_time: string
  batch_name: string
  file_name: string
  department: string
  email: string
  status: string
  created_at: string
}

interface TeacherWithRole extends Teacher {
  role: 'dean' | 'head' | 'senior' | 'faculty'
  scheduleCount: number
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

    let query = supabase
      .from(table)
      .select('*')
      .range(from, to)
      .order('id', { ascending: true }) as any

    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value as string | number | boolean)
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

// Get initials from name
function getInitials(name: string | undefined | null): string {
  if (!name) return '?'
  const parts = name.split(' ')
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

// Assign roles based on schedule count and position in list
function assignRoles(teachers: Teacher[]): TeacherWithRole[] {
  // Group by unique teacher
  const teacherMap = new Map<string, Teacher[]>()
  teachers.forEach(t => {
    const key = t.teacher_id || t.name
    if (!teacherMap.has(key)) {
      teacherMap.set(key, [])
    }
    teacherMap.get(key)!.push(t)
  })

  // Convert to unique teachers with schedule count
  const uniqueTeachers: TeacherWithRole[] = []
  teacherMap.forEach((schedules, key) => {
    const first = schedules[0]
    uniqueTeachers.push({
      ...first,
      scheduleCount: schedules.length,
      role: 'faculty'
    })
  })

  // Sort by schedule count (more schedules = more senior)
  uniqueTeachers.sort((a, b) => b.scheduleCount - a.scheduleCount)

  // Assign roles based on position
  uniqueTeachers.forEach((teacher, index) => {
    if (index === 0) {
      teacher.role = 'dean'
    } else if (index <= 2) {
      teacher.role = 'head'
    } else if (index <= 6) {
      teacher.role = 'senior'
    } else {
      teacher.role = 'faculty'
    }
  })

  return uniqueTeachers
}

function FacultyProfilesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const groupIdFromUrl = searchParams.get('id')

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingTeachers, setLoadingTeachers] = useState(false)

  // File selection state
  const [teacherFiles, setTeacherFiles] = useState<TeacherFile[]>([])
  const [selectedFile, setSelectedFile] = useState<TeacherFile | null>(null)
  const [fileSearchTerm, setFileSearchTerm] = useState('')

  // Teacher data state
  const [teachers, setTeachers] = useState<TeacherWithRole[]>([])
  const [filteredTeachers, setFilteredTeachers] = useState<TeacherWithRole[]>([])
  const [teacherSearchTerm, setTeacherSearchTerm] = useState('')

  // Carousel state
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherWithRole | null>(null)
  const carouselRef = useRef<HTMLDivElement>(null)

  // Fetch teacher files on mount
  useEffect(() => {
    fetchTeacherFiles()
  }, [])

  // Auto-select file from URL parameter
  useEffect(() => {
    if (groupIdFromUrl && teacherFiles.length > 0) {
      const groupId = parseInt(groupIdFromUrl)
      const file = teacherFiles.find(f => f.upload_group_id === groupId)
      if (file) {
        handleSelectFile(file)
      }
    }
  }, [groupIdFromUrl, teacherFiles])

  // Filter teachers when search changes
  useEffect(() => {
    if (teacherSearchTerm) {
      const filtered = teachers.filter(t =>
        t.name.toLowerCase().includes(teacherSearchTerm.toLowerCase()) ||
        t.teacher_id.toLowerCase().includes(teacherSearchTerm.toLowerCase()) ||
        t.email?.toLowerCase().includes(teacherSearchTerm.toLowerCase()) ||
        t.department?.toLowerCase().includes(teacherSearchTerm.toLowerCase())
      )
      setFilteredTeachers(filtered)
    } else {
      setFilteredTeachers(teachers)
    }
    setCurrentIndex(0)
  }, [teacherSearchTerm, teachers])

  const fetchTeacherFiles = async () => {
    setLoading(true)
    try {
      const allData = await fetchAllRows('teacher_schedules')

      // Group by upload_group_id
      const grouped = allData.reduce((acc: any[], curr) => {
        const existing = acc.find(item => item.upload_group_id === curr.upload_group_id)
        if (existing) {
          existing.teacher_count++
        } else {
          acc.push({
            upload_group_id: curr.upload_group_id,
            file_name: curr.file_name || 'Unknown File',
            batch_name: curr.batch_name || '',
            department: curr.department || 'General',
            created_at: curr.created_at,
            teacher_count: 1
          })
        }
        return acc
      }, [])

      // Sort by date (newest first)
      grouped.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setTeacherFiles(grouped)
    } catch (error) {
      console.error('Error fetching teacher files:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectFile = async (file: TeacherFile) => {
    setSelectedFile(file)
    setLoadingTeachers(true)
    setTeacherSearchTerm('')

    try {
      const allData = await fetchAllRows('teacher_schedules', { upload_group_id: file.upload_group_id })
      const teachersWithRoles = assignRoles(allData)
      setTeachers(teachersWithRoles)
      setFilteredTeachers(teachersWithRoles)
      setCurrentIndex(0)
      
      // Auto-select the first (dean) teacher
      if (teachersWithRoles.length > 0) {
        setSelectedTeacher(teachersWithRoles[0])
      }
    } catch (error) {
      console.error('Error fetching teachers:', error)
    } finally {
      setLoadingTeachers(false)
    }
  }

  const handleBackToFiles = () => {
    setSelectedFile(null)
    setTeachers([])
    setFilteredTeachers([])
    setSelectedTeacher(null)
    setCurrentIndex(0)
  }

  const handleSelectTeacher = (teacher: TeacherWithRole) => {
    setSelectedTeacher(teacher)
    const index = filteredTeachers.findIndex(t => t.id === teacher.id)
    if (index !== -1) {
      setCurrentIndex(index)
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setSelectedTeacher(filteredTeachers[currentIndex - 1])
    }
  }

  const handleNext = () => {
    if (currentIndex < filteredTeachers.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setSelectedTeacher(filteredTeachers[currentIndex + 1])
    }
  }

  // Get role display info
  const getRoleInfo = (role: string) => {
    switch (role) {
      case 'dean':
        return { icon: <FaCrown />, label: 'Dean / Department Head', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)' }
      case 'head':
        return { icon: <FaStar />, label: 'Program Head', color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.15)' }
      case 'senior':
        return { icon: <FaGraduationCap />, label: 'Senior Faculty', color: '#06b6d4', bgColor: 'rgba(6, 182, 212, 0.15)' }
      default:
        return { icon: <FaChalkboardTeacher />, label: 'Faculty Member', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)' }
    }
  }

  // Filter files by search
  const filteredFiles = teacherFiles.filter(f =>
    f.file_name.toLowerCase().includes(fileSearchTerm.toLowerCase()) ||
    f.department.toLowerCase().includes(fileSearchTerm.toLowerCase()) ||
    f.batch_name?.toLowerCase().includes(fileSearchTerm.toLowerCase())
  )

  // Group teachers by role for pyramid display
  const deans = filteredTeachers.filter(t => t.role === 'dean')
  const heads = filteredTeachers.filter(t => t.role === 'head')
  const seniors = filteredTeachers.filter(t => t.role === 'senior')
  const faculty = filteredTeachers.filter(t => t.role === 'faculty')

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className={styles.layout}>
      <MenuBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} />

      <main className={`${styles.main} ${!sidebarOpen ? styles.fullWidth : ''}`}>
        <div className={styles.container}>
          {/* Header */}
          <div className={styles.header}>
            <button 
              className={styles.backButton} 
              onClick={selectedFile ? handleBackToFiles : () => router.back()}
            >
              <FaArrowLeft /> {selectedFile ? 'Back to Files' : 'Back'}
            </button>
            <h1 className={styles.title}>
              <FaUserTie className={styles.titleIcon} />
              {selectedFile ? selectedFile.file_name : 'Faculty Profiles'}
            </h1>
          </div>

          {/* Loading State */}
          {loading && (
            <div className={styles.loadingState}>
              <FaSpinner className={styles.spinner} />
              <p>Loading faculty files...</p>
            </div>
          )}

          {/* File Selection View */}
          {!loading && !selectedFile && (
            <div className={styles.fileSelectionSection}>
              <div className={styles.welcomeCard}>
                <FaUsers className={styles.welcomeIcon} />
                <h2>Select a Faculty File</h2>
                <p>Choose an uploaded teacher CSV file to view faculty profiles in a hierarchical display</p>
              </div>

              {/* Search */}
              <div className={styles.searchBar}>
                <FaSearch className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Search files by name, department..."
                  value={fileSearchTerm}
                  onChange={(e) => setFileSearchTerm(e.target.value)}
                  className={styles.searchInput}
                />
                {fileSearchTerm && (
                  <button className={styles.clearButton} onClick={() => setFileSearchTerm('')}>
                    <FaTimes />
                  </button>
                )}
              </div>

              {/* File Grid */}
              {filteredFiles.length === 0 ? (
                <div className={styles.emptyState}>
                  <FaFileAlt className={styles.emptyIcon} />
                  <h3>No Faculty Files Found</h3>
                  <p>Upload a teacher CSV file from the Upload CSV page to get started.</p>
                </div>
              ) : (
                <div className={styles.fileGrid}>
                  {filteredFiles.map((file) => (
                    <div
                      key={file.upload_group_id}
                      className={styles.fileCard}
                      onClick={() => handleSelectFile(file)}
                    >
                      <div className={styles.fileCardIcon}>
                        <FaFileAlt />
                      </div>
                      <div className={styles.fileCardContent}>
                        <h3>{file.file_name}</h3>
                        <p className={styles.fileDepartment}>{file.department}</p>
                        <div className={styles.fileStats}>
                          <span><FaUsers /> {file.teacher_count} Teachers</span>
                          <span><FaCalendar /> {formatDate(file.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Faculty Profiles View */}
          {selectedFile && (
            <div className={styles.profilesSection}>
              {loadingTeachers ? (
                <div className={styles.loadingState}>
                  <FaSpinner className={styles.spinner} />
                  <p>Loading faculty profiles...</p>
                </div>
              ) : (
                <>
                  {/* Search Bar */}
                  <div className={styles.searchBar}>
                    <FaSearch className={styles.searchIcon} />
                    <input
                      type="text"
                      placeholder="Search faculty by name, ID, email..."
                      value={teacherSearchTerm}
                      onChange={(e) => setTeacherSearchTerm(e.target.value)}
                      className={styles.searchInput}
                    />
                    {teacherSearchTerm && (
                      <button className={styles.clearButton} onClick={() => setTeacherSearchTerm('')}>
                        <FaTimes />
                      </button>
                    )}
                    <span className={styles.resultCount}>
                      {filteredTeachers.length} of {teachers.length} faculty
                    </span>
                  </div>

                  {/* Pyramid Hierarchy Display */}
                  <div className={styles.pyramidSection}>
                    <h2 className={styles.pyramidTitle}>Faculty Hierarchy</h2>
                    
                    {/* Dean Level (Top) */}
                    {deans.length > 0 && (
                      <div className={styles.pyramidLevel}>
                        <div className={styles.levelLabel}>
                          <FaCrown /> Dean / Department Head
                        </div>
                        <div className={styles.levelCards} style={{ justifyContent: 'center' }}>
                          {deans.map((teacher) => (
                            <div
                              key={teacher.id}
                              className={`${styles.pyramidCard} ${styles.deanCard} ${selectedTeacher?.id === teacher.id ? styles.selected : ''}`}
                              onClick={() => handleSelectTeacher(teacher)}
                            >
                              <div className={styles.pyramidAvatar} style={{ backgroundColor: getRoleInfo(teacher.role).bgColor, borderColor: getRoleInfo(teacher.role).color }}>
                                {getInitials(teacher.name)}
                              </div>
                              <div className={styles.pyramidName}>{teacher.name || 'Unknown'}</div>
                              <div className={styles.pyramidId}>{teacher.teacher_id || 'N/A'}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Head Level */}
                    {heads.length > 0 && (
                      <div className={styles.pyramidLevel}>
                        <div className={styles.levelLabel}>
                          <FaStar /> Program Heads
                        </div>
                        <div className={styles.levelCards}>
                          {heads.map((teacher) => (
                            <div
                              key={teacher.id}
                              className={`${styles.pyramidCard} ${styles.headCard} ${selectedTeacher?.id === teacher.id ? styles.selected : ''}`}
                              onClick={() => handleSelectTeacher(teacher)}
                            >
                              <div className={styles.pyramidAvatar} style={{ backgroundColor: getRoleInfo(teacher.role).bgColor, borderColor: getRoleInfo(teacher.role).color }}>
                                {getInitials(teacher.name)}
                              </div>
                              <div className={styles.pyramidName}>{teacher.name || 'Unknown'}</div>
                              <div className={styles.pyramidId}>{teacher.teacher_id || 'N/A'}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Senior Level */}
                    {seniors.length > 0 && (
                      <div className={styles.pyramidLevel}>
                        <div className={styles.levelLabel}>
                          <FaGraduationCap /> Senior Faculty
                        </div>
                        <div className={styles.levelCards}>
                          {seniors.map((teacher) => (
                            <div
                              key={teacher.id}
                              className={`${styles.pyramidCard} ${styles.seniorCard} ${selectedTeacher?.id === teacher.id ? styles.selected : ''}`}
                              onClick={() => handleSelectTeacher(teacher)}
                            >
                              <div className={styles.pyramidAvatar} style={{ backgroundColor: getRoleInfo(teacher.role).bgColor, borderColor: getRoleInfo(teacher.role).color }}>
                                {getInitials(teacher.name)}
                              </div>
                              <div className={styles.pyramidName}>{teacher.name || 'Unknown'}</div>
                              <div className={styles.pyramidId}>{teacher.teacher_id || 'N/A'}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Faculty Level */}
                    {faculty.length > 0 && (
                      <div className={styles.pyramidLevel}>
                        <div className={styles.levelLabel}>
                          <FaChalkboardTeacher /> Faculty Members
                        </div>
                        <div className={styles.levelCards}>
                          {faculty.slice(0, 8).map((teacher) => (
                            <div
                              key={teacher.id}
                              className={`${styles.pyramidCard} ${styles.facultyCard} ${selectedTeacher?.id === teacher.id ? styles.selected : ''}`}
                              onClick={() => handleSelectTeacher(teacher)}
                            >
                              <div className={styles.pyramidAvatar} style={{ backgroundColor: getRoleInfo(teacher.role).bgColor, borderColor: getRoleInfo(teacher.role).color }}>
                                {getInitials(teacher.name)}
                              </div>
                              <div className={styles.pyramidName}>{teacher.name || 'Unknown'}</div>
                              <div className={styles.pyramidId}>{teacher.teacher_id || 'N/A'}</div>
                            </div>
                          ))}
                          {faculty.length > 8 && (
                            <div className={styles.moreIndicator}>
                              +{faculty.length - 8} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Carousel Section */}
                  <div className={styles.carouselSection}>
                    <h2 className={styles.carouselTitle}>Individual Profiles</h2>
                    
                    <div className={styles.carouselContainer}>
                      <button 
                        className={`${styles.carouselButton} ${styles.prevButton}`}
                        onClick={handlePrevious}
                        disabled={currentIndex === 0}
                      >
                        <FaChevronLeft />
                      </button>

                      <div className={styles.carouselContent} ref={carouselRef}>
                        {selectedTeacher && (
                          <div className={styles.profileCard}>
                            <div className={styles.profileHeader} style={{ background: `linear-gradient(135deg, ${getRoleInfo(selectedTeacher.role).color}20 0%, ${getRoleInfo(selectedTeacher.role).color}40 100%)` }}>
                              <div className={styles.profileBadge} style={{ backgroundColor: getRoleInfo(selectedTeacher.role).color }}>
                                {getRoleInfo(selectedTeacher.role).icon}
                                <span>{getRoleInfo(selectedTeacher.role).label}</span>
                              </div>
                              <div className={styles.profileAvatar} style={{ borderColor: getRoleInfo(selectedTeacher.role).color }}>
                                {getInitials(selectedTeacher.name)}
                              </div>
                              <h2 className={styles.profileName}>{selectedTeacher.name || 'Unknown'}</h2>
                              <p className={styles.profileId}>{selectedTeacher.teacher_id || 'N/A'}</p>
                            </div>

                            <div className={styles.profileBody}>
                              <div className={styles.profileInfo}>
                                <div className={styles.infoRow}>
                                  <FaEnvelope className={styles.infoIcon} />
                                  <div>
                                    <span className={styles.infoLabel}>Email</span>
                                    <span className={styles.infoValue}>{selectedTeacher.email || 'Not provided'}</span>
                                  </div>
                                </div>
                                <div className={styles.infoRow}>
                                  <FaBuilding className={styles.infoIcon} />
                                  <div>
                                    <span className={styles.infoLabel}>Department</span>
                                    <span className={styles.infoValue}>{selectedTeacher.department || 'Not assigned'}</span>
                                  </div>
                                </div>
                                <div className={styles.infoRow}>
                                  <FaCalendar className={styles.infoIcon} />
                                  <div>
                                    <span className={styles.infoLabel}>Schedule Day</span>
                                    <span className={styles.infoValue}>{selectedTeacher.schedule_day || 'Not set'}</span>
                                  </div>
                                </div>
                                <div className={styles.infoRow}>
                                  <FaClock className={styles.infoIcon} />
                                  <div>
                                    <span className={styles.infoLabel}>Schedule Time</span>
                                    <span className={styles.infoValue}>{selectedTeacher.schedule_time || 'Not set'}</span>
                                  </div>
                                </div>
                              </div>

                              <div className={styles.profileStats}>
                                <div className={styles.statItem}>
                                  <span className={styles.statNumber}>{selectedTeacher.scheduleCount}</span>
                                  <span className={styles.statLabel}>Schedules</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <button 
                        className={`${styles.carouselButton} ${styles.nextButton}`}
                        onClick={handleNext}
                        disabled={currentIndex >= filteredTeachers.length - 1}
                      >
                        <FaChevronRight />
                      </button>
                    </div>

                    {/* Carousel Indicators */}
                    <div className={styles.carouselIndicators}>
                      <span className={styles.indicatorText}>
                        {currentIndex + 1} of {filteredTeachers.length}
                      </span>
                      <div className={styles.indicatorDots}>
                        {filteredTeachers.slice(Math.max(0, currentIndex - 3), Math.min(filteredTeachers.length, currentIndex + 4)).map((_, idx) => {
                          const actualIndex = Math.max(0, currentIndex - 3) + idx
                          return (
                            <button
                              key={actualIndex}
                              className={`${styles.dot} ${actualIndex === currentIndex ? styles.activeDot : ''}`}
                              onClick={() => {
                                setCurrentIndex(actualIndex)
                                setSelectedTeacher(filteredTeachers[actualIndex])
                              }}
                            />
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Quick Navigation List */}
                  <div className={styles.quickNavSection}>
                    <h3 className={styles.quickNavTitle}>All Faculty ({filteredTeachers.length})</h3>
                    <div className={styles.quickNavGrid}>
                      {filteredTeachers.map((teacher, idx) => {
                        const roleInfo = getRoleInfo(teacher.role)
                        return (
                          <button
                            key={teacher.id}
                            className={`${styles.quickNavItem} ${selectedTeacher?.id === teacher.id ? styles.activeNav : ''}`}
                            onClick={() => handleSelectTeacher(teacher)}
                            style={{ borderLeftColor: roleInfo.color }}
                          >
                            <span className={styles.quickNavIcon} style={{ color: roleInfo.color }}>
                              {roleInfo.icon}
                            </span>
                            <div className={styles.quickNavInfo}>
                              <span className={styles.quickNavName}>{teacher.name || 'Unknown'}</span>
                              <span className={styles.quickNavId}>{teacher.teacher_id || 'N/A'}</span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
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
