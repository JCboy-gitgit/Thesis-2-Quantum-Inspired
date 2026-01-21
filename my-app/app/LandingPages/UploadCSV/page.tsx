'use client'
import { useRouter } from 'next/navigation'
import { 
  FileText, 
  Upload, 
  Building2, 
  CheckCircle2, 
  XCircle, 
  ArrowRight,
  FileSpreadsheet,
  Info,
  AlertTriangle,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Download,
  BookOpen,
  GraduationCap,
  DoorOpen,
  Users
} from 'lucide-react'
import styles from './styles/bQtime.module.css'
import React, { useState, useRef } from 'react'
import type { JSX } from 'react'
import { supabase } from '@/lib/supabaseClient'
import MenuBar from '@/app/components/MenuBar'
import Tesseract from 'tesseract.js'

export default function UploadCSVPage(): JSX.Element {
  const router = useRouter()
  
  // ==================== Room/Campus Upload States ====================
  const [roomFile, setRoomFile] = useState<File | null>(null)
  const [roomSchoolName, setRoomSchoolName] = useState('')
  const [roomLoading, setRoomLoading] = useState(false)
  const [roomMessage, setRoomMessage] = useState<string | null>(null)
  const [roomError, setRoomError] = useState<string | null>(null)
  
  // ==================== Class Schedule Upload States ====================
  const [classFile, setClassFile] = useState<File | null>(null)
  const [classBatchName, setClassBatchName] = useState('')
  const [classLoading, setClassLoading] = useState(false)
  const [classMessage, setClassMessage] = useState<string | null>(null)
  const [classError, setClassError] = useState<string | null>(null)
  
  // ==================== Teacher Schedule Upload States ====================
  const [teacherFile, setTeacherFile] = useState<File | null>(null)
  const [teacherCollegeName, setTeacherCollegeName] = useState('')
  const [teacherLoading, setTeacherLoading] = useState(false)
  const [teacherMessage, setTeacherMessage] = useState<string | null>(null)
  const [teacherError, setTeacherError] = useState<string | null>(null)
  
  // ==================== Faculty Profiles Upload States ====================
  const [facultyFile, setFacultyFile] = useState<File | null>(null)
  const [facultyCollegeName, setFacultyCollegeName] = useState('')
  const [facultyLoading, setFacultyLoading] = useState(false)
  const [facultyMessage, setFacultyMessage] = useState<string | null>(null)
  const [facultyError, setFacultyError] = useState<string | null>(null)

  // ==================== Image OCR States ====================
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imageProcessing, setImageProcessing] = useState(false)
  const [imageProgress, setImageProgress] = useState<string>('')
  const [extractedCSV, setExtractedCSV] = useState<string | null>(null)
  const [imageUploadType, setImageUploadType] = useState<'class' | 'teacher'>('class')
  
  const imageFolderInputRef = useRef<HTMLInputElement>(null)

  // Auth check on mount
  React.useEffect(() => {
    checkAuth()
  }, [])

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

  // ==================== CSV Parsing Utilities ====================
  const parseCSV = (text: string): string[][] => {
    const lines = text.trim().split('\n')
    return lines.map(line => {
      if (line.includes('|')) {
        return line.split('|').map(cell => cell.trim())
      }
      return line.split(',').map(cell => cell.trim())
    })
  }

  // ==================== Validation Functions ====================
  
  // ==================== NEW v2 CSV Format Validation ====================
  
  // Validate Room/Campus CSV headers (supports both old and new v2 format)
  const validateRoomHeaders = (headers: string[]): boolean => {
    if (headers.length < 4) return false
    const headerStr = headers.map(h => h.toLowerCase()).join(' ')
    
    // NEW v2 format: room_id | capacity | room_type | equipment_bitmask | campus_id | building | floor_number | is_pwd_accessible
    const isNewFormat = headerStr.includes('room_id') && headerStr.includes('equipment_bitmask')
    
    // OLD format: campus | building | room | capacity
    const hasRoom = headerStr.includes('room') || headerStr.includes('building')
    const hasCampus = headerStr.includes('campus') || headerStr.includes('school')
    const hasCapacity = headerStr.includes('capacity') || headerStr.includes('seats')
    
    return isNewFormat || (hasRoom || (hasCampus && hasCapacity))
  }

  // Validate Class/Course CSV headers (supports both old and new v2 format)
  const validateClassHeaders = (headers: string[]): boolean => {
    if (headers.length < 4) return false
    const headerStr = headers.map(h => h.toLowerCase()).join(' ')
    
    // NEW v2 format: class_id | course_code | course_name | section | subject_code | subject_name | size | duration | room_req | year_level | semester | academic_year
    const isNewFormat = headerStr.includes('class_id') && headerStr.includes('subject_code')
    
    // OLD format: class section | course code | course name
    const hasClassOrSection = headerStr.includes('class') || headerStr.includes('section')
    const hasCourseCode = headerStr.includes('course') || headerStr.includes('code')
    const hasSchedule = headerStr.includes('schedule') || headerStr.includes('day') || headerStr.includes('time') || headerStr.includes('subject')
    
    return isNewFormat || (hasClassOrSection || hasCourseCode || hasSchedule)
  }

  // Validate Faculty CSV headers (NEW v2 format)
  const validateFacultyHeaders = (headers: string[]): boolean => {
    if (headers.length < 3) return false
    const headerStr = headers.map(h => h.toLowerCase()).join(' ')
    
    // NEW v2 format: faculty_id | first_name | last_name | email | department | max_units | employment_type | home_bldg
    const isNewFacultyFormat = headerStr.includes('faculty_id') && (headerStr.includes('first_name') || headerStr.includes('department'))
    
    // OLD teacher format
    const hasTeacherId = headerStr.includes('teacher') || headerStr.includes('id')
    const hasName = headerStr.includes('name')
    
    return isNewFacultyFormat || (hasTeacherId && hasName)
  }

  // Validate Faculty Assignment CSV headers (NEW v2 format)
  const validateAssignmentHeaders = (headers: string[]): boolean => {
    if (headers.length < 4) return false
    const headerStr = headers.map(h => h.toLowerCase()).join(' ')
    
    // NEW v2 format: assignment_id | faculty_id | section_id | subject_code | subject_name | units_type | weekly_hours
    return headerStr.includes('assignment_id') || 
           (headerStr.includes('faculty_id') && headerStr.includes('section_id')) ||
           (headerStr.includes('subject_code') && headerStr.includes('weekly_hours'))
  }

  // Validate Faculty Profiles CSV headers (Name, Position, Department, Type format)
  const validateFacultyProfilesHeaders = (headers: string[]): boolean => {
    if (headers.length < 4) return false
    const headerStr = headers.map(h => h.toLowerCase()).join(' ')
    
    // Expected format: Name | Position | Department | Type
    const hasName = headerStr.includes('name')
    const hasPosition = headerStr.includes('position')
    const hasDepartment = headerStr.includes('department')
    const hasType = headerStr.includes('type')
    
    return hasName && hasPosition && hasDepartment && hasType
  }

  // LEGACY: Validate Teacher Schedule CSV headers (kept for backwards compatibility)
  const validateTeacherHeaders = (headers: string[]): boolean => {
    if (headers.length < 3) return false
    const headerStr = headers.map(h => h.toLowerCase()).join(' ')
    const hasTeacherId = headerStr.includes('teacher') || headerStr.includes('id') || headerStr.includes('faculty')
    const hasName = headerStr.includes('name')
    const hasSchedule = headerStr.includes('schedule') || headerStr.includes('day') || headerStr.includes('time') || headerStr.includes('department')
    return (hasTeacherId || hasName) && hasSchedule
  }
  
  // Detect CSV format version
  const detectCSVVersion = (headers: string[]): 'v1' | 'v2' => {
    const headerStr = headers.map(h => h.toLowerCase()).join(' ')
    if (headerStr.includes('_id') || headerStr.includes('bitmask') || headerStr.includes('subject_code')) {
      return 'v2'
    }
    return 'v1'
  }

  // ==================== File Change Handlers ====================

  // Room file validation
  const handleRoomFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setRoomError(null)
    setRoomMessage(null)

    try {
      const text = await file.text()
      const rows = parseCSV(text)

      if (rows.length < 1) {
        throw new Error('CSV file is empty or invalid.')
      }

      const headers = rows[0]
      if (!validateRoomHeaders(headers)) {
        e.target.value = ''
        throw new Error(
          '❌ INVALID CSV FORMAT DETECTED!\n\n' +
          '📋 Expected headers (NEW v2 format - pipe-separated):\n' +
          'room_id | capacity | room_type | equipment_bitmask | campus_id | building | floor_number | is_pwd_accessible\n\n' +
          '📋 OR Legacy format:\n' +
          'campus | building | room | capacity | floor_number | room_type | is_pwd_accessible\n\n' +
          `❗ Found headers:\n${headers.join(' | ')}\n\n` +
          '⚠️ Please fix the format and try again.'
        )
      }

      const version = detectCSVVersion(headers)
      setRoomFile(file)
      setRoomMessage(`✅ CSV format validated successfully! (${version === 'v2' ? 'NEW v2' : 'Legacy'} format)`)
    } catch (err: any) {
      console.error('Room file validation error:', err)
      setRoomFile(null)
      setRoomError(err?.message ?? String(err))
    }
  }

  // Class schedule file validation
  const handleClassFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setClassError(null)
    setClassMessage(null)

    try {
      const text = await file.text()
      const rows = parseCSV(text)

      if (rows.length < 1) {
        throw new Error('CSV file is empty or invalid.')
      }

      const headers = rows[0]
      if (!validateClassHeaders(headers)) {
        e.target.value = ''
        throw new Error(
          '❌ INVALID CSV FORMAT DETECTED!\n\n' +
          '📋 Expected headers (NEW v2 format - pipe-separated):\n' +
          'class_id | course_code | course_name | section | subject_code | subject_name | size | duration | room_req | year_level | semester | academic_year\n\n' +
          '📋 OR Legacy format:\n' +
          'course_code | course_name | section | lec_units | lab_units | schedule_day | schedule_time\n\n' +
          `❗ Found headers:\n${headers.join(' | ')}\n\n` +
          '⚠️ Please fix the format and try again.'
        )
      }

      const version = detectCSVVersion(headers)
      setClassFile(file)
      setClassMessage(`✅ CSV format validated successfully! (${version === 'v2' ? 'NEW v2' : 'Legacy'} format)`)
    } catch (err: any) {
      console.error('Class file validation error:', err)
      setClassFile(null)
      setClassError(err?.message ?? String(err))
    }
  }

  // Teacher schedule file validation
  const handleTeacherFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setTeacherError(null)
    setTeacherMessage(null)

    try {
      const text = await file.text()
      const rows = parseCSV(text)

      if (rows.length < 1) {
        throw new Error('CSV file is empty or invalid.')
      }

      const headers = rows[0]
      if (!validateTeacherHeaders(headers) && !validateFacultyHeaders(headers)) {
        e.target.value = ''
        throw new Error(
          '❌ INVALID CSV FORMAT DETECTED!\n\n' +
          '📋 Expected headers (NEW v2 Faculty format - pipe-separated):\n' +
          'faculty_id | first_name | last_name | email | department | max_units | employment_type | home_bldg\n\n' +
          '📋 OR Legacy Teacher format:\n' +
          "teacher_id | name | schedule_day | schedule_time | department\n\n" +
          `❗ Found headers:\n${headers.join(' | ')}\n\n` +
          '⚠️ Please fix the format and try again.'
        )
      }

      const version = detectCSVVersion(headers)
      setTeacherFile(file)
      setTeacherMessage(`✅ CSV format validated successfully! (${version === 'v2' ? 'NEW v2 Faculty' : 'Legacy Teacher'} format)`)
    } catch (err: any) {
      console.error('Teacher file validation error:', err)
      setTeacherFile(null)
      setTeacherError(err?.message ?? String(err))
    }
  }

  // Faculty Profiles file validation (Name, Position, Department, Type format)
  const handleFacultyFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFacultyError(null)
    setFacultyMessage(null)

    try {
      const text = await file.text()
      const rows = parseCSV(text)

      if (rows.length < 1) {
        throw new Error('CSV file is empty or invalid.')
      }

      const headers = rows[0]
      if (!validateFacultyProfilesHeaders(headers)) {
        e.target.value = ''
        throw new Error(
          '❌ INVALID CSV FORMAT DETECTED!\n\n' +
          '📋 Expected headers (pipe-separated):\n' +
          'Name | Position | Department | Type\n\n' +
          '📋 Examples:\n' +
          '"Thelma V. Pagtalunan" | "Dean" | "Administration" | "Official"\n' +
          '"Benedict M. Estrella" | "Faculty" | "Mathematics" | "Faculty"\n' +
          '"Joshua P. Valeroso" | "Faculty (Part-Time)" | "Mathematics" | "Faculty (Part-Time)"\n\n' +
          `❗ Found headers:\n${headers.join(' | ')}\n\n` +
          '⚠️ Please fix the format and try again.'
        )
      }

      setFacultyFile(file)
      setFacultyMessage(`✅ Faculty Profiles CSV format validated successfully! (${rows.length - 1} entries found)`)
    } catch (err: any) {
      console.error('Faculty file validation error:', err)
      setFacultyFile(null)
      setFacultyError(err?.message ?? String(err))
    }
  }

  // ==================== Upload Handlers ====================

  // Upload Rooms/Campuses
  const handleRoomUpload = async () => {
    if (!roomFile || !roomSchoolName) {
      setRoomError('Please provide school name and choose a file.')
      return
    }

    setRoomLoading(true)
    setRoomError(null)
    setRoomMessage(null)

    try {
      const text = await roomFile.text()
      const rows = parseCSV(text)

      if (rows.length < 2) {
        throw new Error('CSV file must contain at least one data row.')
      }

      const dataRows = rows.slice(1)
      const headers = rows[0]
      const version = detectCSVVersion(headers)

      // Get the next upload_group_id for rooms
      const { data: maxGroupData } = await supabase
        .from('campuses' as any)
        .select('upload_group_id')
        .order('upload_group_id', { ascending: false })
        .limit(1)
      
      const nextGroupId = ((maxGroupData as any)?.[0]?.upload_group_id || 0) + 1

      // Parse based on detected format version
      let roomData: any[] = []
      
      if (version === 'v2') {
        // NEW v2 format: room_id | capacity | room_type | equipment_bitmask | campus_id | building | floor_number | is_pwd_accessible
        roomData = dataRows.map(row => {
          const equipmentBitmask = row[3] || '11111'
          return {
            upload_group_id: nextGroupId,
            school_name: roomSchoolName,
            campus: row[4] || 'MAIN',
            building: row[5] || '',
            room: row[0] || '',
            capacity: parseInt(row[1]) || 30,
            is_first_floor: (parseInt(row[6]) || 1) === 1,
            floor_number: parseInt(row[6]) || 1,
            room_type: row[2] || 'Lecture',
            has_ac: equipmentBitmask.charAt(1) === '1',
            has_projector: equipmentBitmask.charAt(0) === '1',
            has_whiteboard: equipmentBitmask.charAt(2) === '1',
            is_pwd_accessible: row[7]?.toLowerCase() === 'true',
            status: 'active',
            file_name: roomFile.name
          }
        })
      } else {
        // LEGACY format: campus | building | room | capacity | is_first_floor | floor_number | room_type | has_ac | has_projector | has_whiteboard | is_pwd_accessible | status
        roomData = dataRows.map(row => ({
          upload_group_id: nextGroupId,
          school_name: roomSchoolName,
          campus: row[0] || '',
          building: row[1] || '',
          room: row[2] || '',
          capacity: parseInt(row[3]) || 30,
          is_first_floor: row[4]?.toLowerCase() === 'true',
          floor_number: parseInt(row[5]) || 1,
          room_type: row[6] || 'Classroom',
          has_ac: row[7]?.toLowerCase() === 'true',
          has_projector: row[8]?.toLowerCase() === 'true',
          has_whiteboard: row[9]?.toLowerCase() === 'true' || row[9] === undefined,
          is_pwd_accessible: row[10]?.toLowerCase() === 'true',
          status: row[11] || 'active',
          file_name: roomFile.name
        }))
      }

      console.log('Inserting room data:', roomData.length, 'rows')

      const { error: insertError } = await supabase
        .from('campuses' as any)
        .insert(roomData as any)

      if (insertError) {
        console.error('Room insert error:', insertError)
        throw insertError
      }

      setRoomMessage(
        `✅ Rooms uploaded successfully!\n` +
        `School: ${roomSchoolName}\n` +
        `File: ${roomFile.name}\n` +
        `Rooms: ${roomData.length}`
      )
      
      setRoomFile(null)
      setRoomSchoolName('')
      const fileInput = document.getElementById('roomFile') as HTMLInputElement
      if (fileInput) fileInput.value = ''
    } catch (err: any) {
      console.error('Room upload error:', err)
      setRoomError(err?.message ?? String(err))
    } finally {
      setRoomLoading(false)
    }
  }

  // Upload Class Schedules
  const handleClassUpload = async () => {
    if (!classFile || !classBatchName) {
      setClassError('Please provide batch name and choose a file.')
      return
    }

    setClassLoading(true)
    setClassError(null)
    setClassMessage(null)

    try {
      const text = await classFile.text()
      const rows = parseCSV(text)

      if (rows.length < 2) {
        throw new Error('CSV file must contain at least one data row.')
      }

      const dataRows = rows.slice(1)
      const headers = rows[0]
      const version = detectCSVVersion(headers)

      // Get the next upload_group_id for class schedules
      const { data: maxGroupData } = await supabase
        .from('class_schedules')
        .select('upload_group_id')
        .order('upload_group_id', { ascending: false })
        .limit(1)
      
      const nextGroupId = ((maxGroupData as any)?.[0]?.upload_group_id || 0) + 1

      // Parse based on detected format version
      let classData: any[] = []
      
      if (version === 'v2') {
        // NEW v2 format: class_id | course_code | course_name | section | subject_code | subject_name | size | duration | room_req | year_level | semester | academic_year
        classData = dataRows.map(row => ({
          upload_group_id: nextGroupId,
          course_code: row[1] || '',
          course_name: row[2] || '',
          section: row[3] || '',
          year_level: parseInt(row[9]) || parseInt(row[3]?.charAt(0)) || 1,
          student_count: parseInt(row[6]) || 30,
          lec_units: row[8]?.toLowerCase() === 'lecture' ? 3 : 0,
          lab_units: row[8]?.toLowerCase() === 'lab' || row[8]?.toLowerCase() === 'computerlab' ? 3 : 0,
          credit_units: 3,
          lec_hours: parseInt(row[7]) || 3,
          lab_hours: row[8]?.toLowerCase().includes('lab') ? parseInt(row[7]) || 3 : 0,
          schedule_day: '', // Will be assigned by scheduler
          schedule_time: '', // Will be assigned by scheduler
          semester: row[10] || '1st Semester',
          academic_year: row[11] || '2025-2026',
          department: row[2]?.substring(0, 50) || '',
          college: classBatchName,
          status: 'pending',
          file_name: classFile.name,
          // NEW v2 fields
          class_id: row[0] || '',
          subject_code: row[4] || '',
          subject_name: row[5] || '',
          room_req: row[8] || 'Lecture'
        }))
      } else {
        // LEGACY formats
        classData = dataRows.map(row => {
          // Check if this is the new format with year_level and student_count (17 columns)
          const hasYearLevelAndStudentCount = row.length >= 17;
          
          if (hasYearLevelAndStudentCount) {
            // New format with year_level at position 3 and student_count at position 4
            return {
              upload_group_id: nextGroupId,
              course_code: row[0] || '',
              course_name: row[1] || '',
              section: row[2] || '',
              year_level: parseInt(row[3]) || 1,
              student_count: parseInt(row[4]) || 30,
              lec_units: parseInt(row[5]) || 0,
              lab_units: parseInt(row[6]) || 0,
              credit_units: parseInt(row[7]) || 0,
              lec_hours: parseInt(row[8]) || 0,
              lab_hours: parseInt(row[9]) || 0,
              schedule_day: row[10] || '',
              schedule_time: row[11] || '',
              semester: row[12] || '1st Semester',
              academic_year: row[13] || '2025-2026',
              department: row[14] || '',
              college: classBatchName,
              status: row[16] || 'pending',
              file_name: classFile.name
            }
          } else if (row.length >= 16) {
            // Format with student_count but no year_level (16 columns)
            return {
              upload_group_id: nextGroupId,
              course_code: row[0] || '',
              course_name: row[1] || '',
              section: row[2] || '',
              year_level: parseInt(row[2]?.charAt(0)) || 1, // Extract year from section (e.g., "1A" -> 1)
              student_count: parseInt(row[3]) || 30,
              lec_units: parseInt(row[4]) || 0,
              lab_units: parseInt(row[5]) || 0,
              credit_units: parseInt(row[6]) || 0,
              lec_hours: parseInt(row[7]) || 0,
              lab_hours: parseInt(row[8]) || 0,
              schedule_day: row[9] || '',
              schedule_time: row[10] || '',
              semester: row[11] || '1st Semester',
              academic_year: row[12] || '2025-2026',
              department: row[13] || '',
              college: classBatchName,
              status: row[15] || 'pending',
              file_name: classFile.name
            }
          } else {
            // Old format without year_level and student_count (15 columns)
            return {
              upload_group_id: nextGroupId,
              course_code: row[0] || '',
              course_name: row[1] || '',
              section: row[2] || '',
              year_level: parseInt(row[2]?.charAt(0)) || 1, // Extract year from section
              lec_units: parseInt(row[3]) || 0,
              lab_units: parseInt(row[4]) || 0,
              credit_units: parseInt(row[5]) || 0,
              lec_hours: parseInt(row[6]) || 0,
              lab_hours: parseInt(row[7]) || 0,
              schedule_day: row[8] || '',
              schedule_time: row[9] || '',
              semester: row[10] || '1st Semester',
              academic_year: row[11] || '2025-2026',
              department: row[12] || '',
              college: classBatchName,
              status: row[14] || 'pending',
              file_name: classFile.name
            }
          }
        })
      }

      console.log('Inserting class schedule data:', classData.length, 'rows')

      const { error: insertError } = await supabase
        .from('class_schedules')
        .insert(classData as any)

      if (insertError) {
        console.error('Class schedule insert error:', insertError)
        throw insertError
      }

      setClassMessage(
        `✅ Class Schedule uploaded successfully!\n` +
        `Batch: ${classBatchName}\n` +
        `File: ${classFile.name}\n` +
        `Rows: ${classData.length}`
      )
      
      setClassFile(null)
      setClassBatchName('')
      const fileInput = document.getElementById('classFile') as HTMLInputElement
      if (fileInput) fileInput.value = ''
    } catch (err: any) {
      console.error('Class upload error:', err)
      setClassError(err?.message ?? String(err))
    } finally {
      setClassLoading(false)
    }
  }

  // Upload Teacher Schedules
  const handleTeacherUpload = async () => {
    if (!teacherFile || !teacherCollegeName) {
      setTeacherError('Please provide college name and choose a file.')
      return
    }

    setTeacherLoading(true)
    setTeacherError(null)
    setTeacherMessage(null)

    try {
      const text = await teacherFile.text()
      const rows = parseCSV(text)

      if (rows.length < 2) {
        throw new Error('CSV file must contain at least one data row.')
      }

      const dataRows = rows.slice(1)
      const headers = rows[0]
      const version = detectCSVVersion(headers)

      // Get the next upload_group_id for teacher schedules
      const { data: maxGroupData } = await supabase
        .from('teacher_schedules')
        .select('upload_group_id')
        .order('upload_group_id', { ascending: false })
        .limit(1)
      
      const nextGroupId = ((maxGroupData as any)?.[0]?.upload_group_id || 0) + 1

      // Parse based on detected format version
      let teacherData: any[] = []
      
      if (version === 'v2') {
        // NEW v2 Faculty format: faculty_id | first_name | last_name | email | department | max_units | employment_type | home_bldg
        teacherData = dataRows.map(row => ({
          upload_group_id: nextGroupId,
          teacher_id: row[0] || '',
          teacher_name: `${row[1] || ''} ${row[2] || ''}`.trim(),
          schedule_day: '', // Faculty availability will be set separately
          schedule_time: '', // Faculty availability will be set separately
          department: row[4] || '',
          email: row[3] || '',
          college: teacherCollegeName,
          is_available: true,
          schedule_type: row[6] || 'full-time',
          file_name: teacherFile.name,
          // NEW v2 fields
          faculty_id: row[0] || '',
          first_name: row[1] || '',
          last_name: row[2] || '',
          max_units: parseInt(row[5]) || 24,
          employment_type: row[6] || 'full-time',
          home_bldg: row[7] || ''
        }))
      } else {
        // LEGACY Teacher format: teacher_id | teacher_name | schedule_day | schedule_time | department | email | college
        teacherData = dataRows.map(row => ({
          upload_group_id: nextGroupId,
          teacher_id: row[0] || '',
          teacher_name: row[1] || '',
          schedule_day: row[2] || '',
          schedule_time: row[3] || '',
          department: row[4] || '',
          email: row[5] || '',
          college: row[6] || teacherCollegeName,
          is_available: true,
          schedule_type: 'teaching',
          file_name: teacherFile.name
        }))
      }

      console.log('Inserting teacher schedule data:', teacherData.length, 'rows')

      const { error: insertError } = await supabase
        .from('teacher_schedules')
        .insert(teacherData as any)

      if (insertError) {
        console.error('Teacher schedule insert error:', insertError)
        throw insertError
      }

      setTeacherMessage(
        `✅ Teacher Schedule uploaded successfully!\n` +
        `Department: ${teacherCollegeName}\n` +
        `File: ${teacherFile.name}\n` +
        `Rows: ${teacherData.length}`
      )
      
      setTeacherFile(null)
      setTeacherCollegeName('')
      const fileInput = document.getElementById('teacherFile') as HTMLInputElement
      if (fileInput) fileInput.value = ''
    } catch (err: any) {
      console.error('Teacher upload error:', err)
      setTeacherError(err?.message ?? String(err))
    } finally {
      setTeacherLoading(false)
    }
  }

  // Upload Faculty Profiles (Name, Position, Department, Type format)
  const handleFacultyUpload = async () => {
    if (!facultyFile || !facultyCollegeName) {
      setFacultyError('Please provide college name and choose a file.')
      return
    }

    setFacultyLoading(true)
    setFacultyError(null)
    setFacultyMessage(null)

    try {
      const text = await facultyFile.text()
      const rows = parseCSV(text)

      if (rows.length < 2) {
        throw new Error('CSV file must contain at least one data row.')
      }

      const dataRows = rows.slice(1)

      // Generate faculty_id based on name
      const generateFacultyId = (name: string, index: number) => {
        const nameParts = name.split(/[,\s]+/).filter(p => p.length > 0)
        const initials = nameParts.map(p => p.charAt(0).toUpperCase()).join('')
        return `FAC-${initials}-${String(index + 1).padStart(4, '0')}`
      }

      // Parse the Name, Position, Department, Type format
      const facultyData = dataRows.map((row, index) => {
        const name = row[0]?.replace(/"/g, '').trim() || ''
        const position = row[1]?.replace(/"/g, '').trim() || 'Faculty'
        const department = row[2]?.replace(/"/g, '').trim() || ''
        const type = row[3]?.replace(/"/g, '').trim() || 'Faculty'

        // Determine role based on position
        let role = 'faculty'
        if (position.toLowerCase().includes('dean')) role = 'administrator'
        else if (position.toLowerCase().includes('department head')) role = 'department_head'
        else if (position.toLowerCase().includes('program chair')) role = 'program_chair'
        else if (position.toLowerCase().includes('coordinator') || position.toLowerCase().includes('head')) role = 'coordinator'
        else if (position.toLowerCase().includes('staff') || position.toLowerCase().includes('technician') || position.toLowerCase().includes('clerk')) role = 'staff'

        return {
          faculty_id: generateFacultyId(name, index),
          full_name: name,
          position: position,
          role: role,
          department: department,
          college: facultyCollegeName,
          employment_type: type.toLowerCase().includes('part-time') ? 'part-time' 
            : type.toLowerCase().includes('adjunct') ? 'adjunct'
            : type.toLowerCase().includes('guest') ? 'guest'
            : 'full-time',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      })

      console.log('Upserting faculty profiles data:', facultyData.length, 'rows')

      // Upsert into faculty_profiles table (insert or update on conflict)
      const { error: insertError } = await supabase
        .from('faculty_profiles')
        .upsert(facultyData as any, { 
          onConflict: 'faculty_id',
          ignoreDuplicates: false 
        })

      if (insertError) {
        console.error('Faculty profiles insert error:', insertError)
        throw insertError
      }

      // Count by type
      const typeCounts = facultyData.reduce((acc: any, f) => {
        acc[f.role] = (acc[f.role] || 0) + 1
        return acc
      }, {})

      setFacultyMessage(
        `✅ Faculty Profiles uploaded successfully!\n` +
        `College: ${facultyCollegeName}\n` +
        `File: ${facultyFile.name}\n` +
        `Total: ${facultyData.length} profiles\n` +
        `Breakdown:\n` +
        Object.entries(typeCounts).map(([role, count]) => `  • ${role}: ${count}`).join('\n')
      )
      
      setFacultyFile(null)
      setFacultyCollegeName('')
      const fileInput = document.getElementById('facultyFile') as HTMLInputElement
      if (fileInput) fileInput.value = ''
    } catch (err: any) {
      console.error('Faculty upload error:', err)
      setFacultyError(err?.message ?? String(err))
    } finally {
      setFacultyLoading(false)
    }
  }

  // ==================== Image OCR Functions ====================
  
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    
    const imageArray = Array.from(files).filter(file => 
      file.type.startsWith('image/') || 
      file.name.toLowerCase().match(/\.(png|jpg|jpeg|gif|bmp|webp)$/)
    )
    
    setImageFiles(imageArray)
    setExtractedCSV(null)
    setImageProgress('')
  }

  const processImagesWithOCR = async () => {
    if (imageFiles.length === 0) return
    
    setImageProcessing(true)
    setImageProgress('🔄 Initializing AI-powered OCR analysis...')
    setExtractedCSV(null)
    
    const TIMEOUT_MS = 5 * 60 * 1000
    
    try {
      const allExtractedText: string[] = []
      
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i]
        setImageProgress(`📷 Processing image ${i + 1} of ${imageFiles.length}: ${file.name}`)
        
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = (e) => resolve(e.target?.result as string)
          reader.readAsDataURL(file)
        })
        
        const ocrPromise = Tesseract.recognize(dataUrl, 'eng', {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              const percent = Math.round(m.progress * 100)
              setImageProgress(`🧠 Analyzing ${file.name}: ${percent}%`)
            }
          }
        })
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`OCR timeout: ${file.name}`)), TIMEOUT_MS)
        })
        
        try {
          const result = await Promise.race([ocrPromise, timeoutPromise])
          allExtractedText.push(result.data.text)
        } catch (timeoutErr: any) {
          console.warn(`⚠️ ${file.name} timed out`)
          continue
        }
      }
      
      setImageProgress('🤖 Extracting schedule data...')
      
      const combinedText = allExtractedText.join('\n\n--- NEW IMAGE ---\n\n')
      const parsedData = parseExtractedText(combinedText, imageUploadType)
      
      let csvContent = ''
      if (imageUploadType === 'class') {
        csvContent = 'Class Section | Course Code | Course Name | LEC Unit | LAB Unit | Credit Unit | LEC Hr | LAB Hr | Section | Schedule(Day) | Schedule(Time)\n'
      } else {
        csvContent = "Teacher's ID | Name | Schedule(Day) | Schedule(Time)\n"
      }
      
      parsedData.forEach(row => {
        csvContent += row.join(' | ') + '\n'
      })
      
      setExtractedCSV(csvContent)
      setImageProgress(
        `✅ OCR COMPLETE!\n` +
        `Images: ${imageFiles.length}\n` +
        `Entries: ${parsedData.length}\n\n` +
        (parsedData.length === 0 ? 
          `⚠️ No data extracted. Check image quality.` :
          `✅ Data ready! Review and download.`)
      )
      
    } catch (err: any) {
      console.error('OCR Error:', err)
      setImageProgress(`❌ Error: ${err.message}`)
    } finally {
      setImageProcessing(false)
    }
  }

  // Simple text parser for OCR output
  const parseExtractedText = (text: string, type: 'class' | 'teacher'): string[][] => {
    const result: string[][] = []
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3)
    
    if (type === 'class') {
      const coursePattern = /([A-Z]{2,4}\s*\d{3,4})/gi
      for (const line of lines) {
        const match = line.match(coursePattern)
        if (match) {
          result.push([
            '', // Class Section
            match[0], // Course Code
            line.replace(match[0], '').trim().substring(0, 50), // Course Name
            '3', '0', '3', '3', '0', '', '', '' // Defaults
          ])
        }
      }
    } else {
      let idCounter = 1
      for (const line of lines) {
        if (line.match(/[A-Za-z]{2,}/)) {
          result.push([
            String(2020000000 + idCounter++),
            line.substring(0, 50),
            '', ''
          ])
        }
      }
    }
    
    return result
  }

  const downloadExtractedCSV = () => {
    if (!extractedCSV) return
    
    const blob = new Blob([extractedCSV], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `extracted_${imageUploadType}_schedule_${Date.now()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleSkip = () => {
    router.push('/LandingPages/Home')
  }

  return (
    <div className={styles['page-layout']}>
      <MenuBar onToggleSidebar={() => {}} showSidebarToggle={false} showAccountIcon={false} />
      
      <div className={styles['page-header-content']}>
        <h1>📤 Upload CSV Data</h1>
        <h2>Upload Rooms, Class Schedules, and Teacher Schedules for Room Allocation</h2>
      </div>

      <main className={styles['upload-container']}>
        <div className={styles['upload-wrapper']}>
          
          {/* ==================== ROOMS/CAMPUSES UPLOAD ==================== */}
          <div className={styles['upload-card']}>
            <h2 className={styles['section-title']}>
              <DoorOpen size={28} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '10px' }} />
              Rooms & Campuses
            </h2>
            
            <div className={styles['format-info']}>
              <h3>
                <Info size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                Expected CSV Format (NEW v2):
              </h3>
              <p style={{ fontSize: '11px', wordBreak: 'break-word' }}>room_id | capacity | room_type | equipment_bitmask | campus_id | building | floor_number | is_pwd_accessible</p>
              <small style={{ color: 'var(--text-light)', marginTop: '8px', display: 'block' }}>
                <FileSpreadsheet size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                Example: MN-CICT-101 | 40 | ComputerLab | 11111 | MAIN | CICT Building | 1 | true
              </small>
              <div style={{ marginTop: '8px', padding: '8px', background: 'var(--info-bg, #dbeafe)', borderRadius: '4px', fontSize: '12px' }}>
                <Info size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px', color: '#2563eb' }} />
                <strong style={{ color: '#1e40af' }}>Equipment Bitmask:</strong> <span style={{ color: 'var(--text-dark)' }}>5 bits: Projector|AC|Whiteboard|Computers|LabEquip (e.g., 11110 = all except lab equipment)</span>
              </div>
              <div style={{ marginTop: '8px', padding: '8px', background: 'var(--warning-bg, #fef3c7)', borderRadius: '4px', fontSize: '12px' }}>
                <AlertTriangle size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px', color: '#d97706' }} />
                <strong style={{ color: '#92400e' }}>Note:</strong> <span style={{ color: 'var(--text-dark)' }}>School Name is entered above, not in CSV. Use pipe (|) separator. Legacy format also supported.</span>
              </div>
            </div>

            <div className={styles['form-group']}>
              <label className={styles['label']}>
                <Building2 size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                School Name
                <input
                  type="text"
                  value={roomSchoolName}
                  onChange={(e) => setRoomSchoolName(e.target.value)}
                  className={styles['input']}
                  placeholder="e.g., University of the Philippines"
                  required
                />
              </label>
            </div>

            <div className={styles['form-group']}>
              <label className={styles['label']}>
                <FileText size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                Select CSV File
                <input
                  id="roomFile"
                  type="file"
                  accept=".csv"
                  onChange={handleRoomFileChange}
                  className={styles['file-input']}
                  required
                />
              </label>
              {roomFile && (
                <small style={{ color: '#10b981', fontSize: '12px', marginTop: '4px', fontWeight: '600' }}>
                  <CheckCircle2 size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                  Selected: {roomFile.name}
                </small>
              )}
            </div>

            <button
              onClick={handleRoomUpload}
              disabled={roomLoading || !roomFile || !roomSchoolName}
              className={styles['upload-button']}
            >
              <Upload size={20} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
              {roomLoading ? 'Uploading...' : 'Upload Rooms CSV'}
            </button>

            {roomMessage && (
              <div className={`${styles['message']} ${styles['success']}`} style={{ whiteSpace: 'pre-line' }}>
                <CheckCircle2 size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
                {roomMessage}
              </div>
            )}
            {roomError && (
              <div className={`${styles['message']} ${styles['error']}`} style={{ whiteSpace: 'pre-line' }}>
                <XCircle size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
                {roomError}
              </div>
            )}
          </div>

          {/* ==================== CLASS SCHEDULES UPLOAD ==================== */}
          <div className={styles['upload-card']}>
            <h2 className={styles['section-title']}>
              <BookOpen size={28} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '10px' }} />
              Class Schedules
            </h2>
            
            <div className={styles['format-info']}>
              <h3>
                <Info size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                Expected CSV Format:
              </h3>
              <p style={{ fontSize: '11px', wordBreak: 'break-word' }}>course_code | course_name | section | lec_units | lab_units | credit_units | lec_hours | lab_hours | schedule_day | schedule_time | semester | academic_year | department | college | status</p>
              <small style={{ color: 'var(--text-light)', marginTop: '8px', display: 'block' }}>
                <FileSpreadsheet size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                Example: CS101 | Intro to Programming | A | 3 | 0 | 3 | 3 | 0 | Monday | 7:00-8:30 | 1st Semester | 2025-2026 | Computer Science | College of Science | pending
              </small>
            </div>

            <div className={styles['form-group']}>
              <label className={styles['label']}>
                <GraduationCap size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                Batch/Semester Name
                <input
                  type="text"
                  value={classBatchName}
                  onChange={(e) => setClassBatchName(e.target.value)}
                  className={styles['input']}
                  placeholder="e.g., 2025-2026 First Semester"
                  required
                />
              </label>
            </div>

            <div className={styles['form-group']}>
              <label className={styles['label']}>
                <FileText size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                Select CSV File
                <input
                  id="classFile"
                  type="file"
                  accept=".csv"
                  onChange={handleClassFileChange}
                  className={styles['file-input']}
                  required
                />
              </label>
              {classFile && (
                <small style={{ color: '#10b981', fontSize: '12px', marginTop: '4px', fontWeight: '600' }}>
                  <CheckCircle2 size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                  Selected: {classFile.name}
                </small>
              )}
            </div>

            <button
              onClick={handleClassUpload}
              disabled={classLoading || !classFile || !classBatchName}
              className={styles['upload-button']}
            >
              <Upload size={20} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
              {classLoading ? 'Uploading...' : 'Upload Class Schedule CSV'}
            </button>

            {classMessage && (
              <div className={`${styles['message']} ${styles['success']}`} style={{ whiteSpace: 'pre-line' }}>
                <CheckCircle2 size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
                {classMessage}
              </div>
            )}
            {classError && (
              <div className={`${styles['message']} ${styles['error']}`} style={{ whiteSpace: 'pre-line' }}>
                <XCircle size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
                {classError}
              </div>
            )}
          </div>

          {/* ==================== TEACHER SCHEDULES UPLOAD ==================== */}
          <div className={styles['upload-card']}>
            <h2 className={styles['section-title']}>
              <GraduationCap size={28} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '10px' }} />
              Teacher Schedules
            </h2>
            
            <div className={styles['format-info']}>
              <h3>
                <Info size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                Expected CSV Format:
              </h3>
              <p style={{ fontSize: '11px', wordBreak: 'break-word' }}>teacher_id | teacher_name | schedule_day | schedule_time | department | email | college</p>
              <small style={{ color: 'var(--text-light)', marginTop: '8px', display: 'block' }}>
                <FileSpreadsheet size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                Example: T-0001 | Prof. Juan Santos | Monday | 7:00-8:30 | Computer Science | juan.santos@faculty.edu.ph | College of Science
              </small>
            </div>

            <div className={styles['form-group']}>
              <label className={styles['label']}>
                <Building2 size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                College Name
                <input
                  type="text"
                  value={teacherCollegeName}
                  onChange={(e) => setTeacherCollegeName(e.target.value)}
                  className={styles['input']}
                  placeholder="e.g., College of Science"
                  required
                />
              </label>
            </div>

            <div className={styles['form-group']}>
              <label className={styles['label']}>
                <FileText size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                Select CSV File
                <input
                  id="teacherFile"
                  type="file"
                  accept=".csv"
                  onChange={handleTeacherFileChange}
                  className={styles['file-input']}
                  required
                />
              </label>
              {teacherFile && (
                <small style={{ color: '#10b981', fontSize: '12px', marginTop: '4px', fontWeight: '600' }}>
                  <CheckCircle2 size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                  Selected: {teacherFile.name}
                </small>
              )}
            </div>

            <button
              onClick={handleTeacherUpload}
              disabled={teacherLoading || !teacherFile || !teacherCollegeName}
              className={styles['upload-button']}
            >
              <Upload size={20} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
              {teacherLoading ? 'Uploading...' : 'Upload Teacher Schedule CSV'}
            </button>

            {teacherMessage && (
              <div className={`${styles['message']} ${styles['success']}`} style={{ whiteSpace: 'pre-line' }}>
                <CheckCircle2 size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
                {teacherMessage}
              </div>
            )}
            {teacherError && (
              <div className={`${styles['message']} ${styles['error']}`} style={{ whiteSpace: 'pre-line' }}>
                <XCircle size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
                {teacherError}
              </div>
            )}
          </div>

          {/* ==================== FACULTY PROFILES UPLOAD ==================== */}
          <div className={styles['upload-card']}>
            <h2 className={styles['section-title']}>
              <GraduationCap size={28} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '10px' }} />
              👔 Faculty Profiles (Officials & Staff)
            </h2>
            
            <div className={styles['format-info']}>
              <h3>
                <Info size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                Expected CSV Format:
              </h3>
              <p style={{ fontSize: '12px', wordBreak: 'break-word', fontWeight: '600', color: '#10b981' }}>Name | Position | Department | Type</p>
              <small style={{ color: 'var(--text-light)', marginTop: '8px', display: 'block' }}>
                <FileSpreadsheet size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                Examples:
              </small>
              <div style={{ marginTop: '8px', padding: '10px', background: 'var(--info-bg, #dbeafe)', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace' }}>
                "Thelma V. Pagtalunan" | "Dean" | "Administration" | "Official"<br/>
                "Benedict M. Estrella" | "Associate Dean" | "Administration" | "Official"<br/>
                "Harris R. Dela Cruz" | "Faculty" | "Mathematics" | "Faculty"<br/>
                "Joshua P. Valeroso" | "Faculty (Part-Time)" | "Mathematics" | "Faculty (Part-Time)"<br/>
                "Aubrey Rose T. Gan" | "Faculty (Adjunct)" | "Mathematics" | "Faculty (Adjunct)"<br/>
                "Karl Kenneth R. Santos" | "Guest Lecturer" | "Science" | "Guest Lecturer"
              </div>
              <div style={{ marginTop: '8px', padding: '8px', background: 'var(--success-bg, #d1fae5)', borderRadius: '4px', fontSize: '12px' }}>
                <CheckCircle2 size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px', color: '#059669' }} />
                <strong style={{ color: '#065f46' }}>Types Supported:</strong> <span style={{ color: 'var(--text-dark)' }}>Official, Staff, Faculty, Faculty (Part-Time), Faculty (Adjunct), Guest Lecturer</span>
              </div>
            </div>

            <div className={styles['form-group']}>
              <label className={styles['label']}>
                <Building2 size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                College Name
                <input
                  type="text"
                  value={facultyCollegeName}
                  onChange={(e) => setFacultyCollegeName(e.target.value)}
                  className={styles['input']}
                  placeholder="e.g., College of Science"
                  required
                />
              </label>
            </div>

            <div className={styles['form-group']}>
              <label className={styles['label']}>
                <FileText size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                Select CSV File
                <input
                  id="facultyFile"
                  type="file"
                  accept=".csv"
                  onChange={handleFacultyFileChange}
                  className={styles['file-input']}
                  required
                />
              </label>
              {facultyFile && (
                <small style={{ color: '#10b981', fontSize: '12px', marginTop: '4px', fontWeight: '600' }}>
                  <CheckCircle2 size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                  Selected: {facultyFile.name}
                </small>
              )}
            </div>

            <button
              onClick={handleFacultyUpload}
              disabled={facultyLoading || !facultyFile || !facultyCollegeName}
              className={styles['upload-button']}
              style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
            >
              <Upload size={20} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
              {facultyLoading ? 'Uploading...' : 'Upload Faculty Profiles CSV'}
            </button>

            {facultyMessage && (
              <div className={`${styles['message']} ${styles['success']}`} style={{ whiteSpace: 'pre-line' }}>
                <CheckCircle2 size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
                {facultyMessage}
              </div>
            )}
            {facultyError && (
              <div className={`${styles['message']} ${styles['error']}`} style={{ whiteSpace: 'pre-line' }}>
                <XCircle size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
                {facultyError}
              </div>
            )}
          </div>

          {/* ==================== IMAGE OCR UPLOAD ==================== */}
          <div className={styles['upload-card']}>
            <h2 className={styles['section-title']}>
              <ImageIcon size={28} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '10px' }} />
              Scan Images (OCR)
            </h2>
            
            <div className={styles['format-info']}>
              <h3>
                <Info size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                Image Upload Feature
              </h3>
              <p style={{ fontSize: '13px' }}>
                Upload images of schedule timetables and we'll extract the data using OCR.
              </p>
              <small style={{ color: 'var(--text-light)', marginTop: '8px', display: 'block' }}>
                Supported: PNG, JPG, JPEG, GIF, BMP, WebP
              </small>
            </div>

            <div className={styles['form-group']}>
              <label className={styles['label']}>
                Schedule Type:
                <select
                  value={imageUploadType}
                  onChange={(e) => setImageUploadType(e.target.value as 'class' | 'teacher')}
                  className={styles['input']}
                  style={{ marginTop: '6px', cursor: 'pointer' }}
                >
                  <option value="class">Class Schedule</option>
                  <option value="teacher">Teacher Schedule</option>
                </select>
              </label>
            </div>

            <div className={styles['form-group']}>
              <label className={styles['label']}>
                <FolderOpen size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                Select Images
                <input
                  ref={imageFolderInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className={styles['file-input']}
                />
              </label>
              {imageFiles.length > 0 && (
                <small style={{ color: '#10b981', fontSize: '12px', marginTop: '4px', fontWeight: '600' }}>
                  <CheckCircle2 size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                  {imageFiles.length} image(s) selected
                </small>
              )}
            </div>

            <button
              onClick={processImagesWithOCR}
              disabled={imageProcessing || imageFiles.length === 0}
              className={styles['upload-button']}
              style={{ 
                background: imageProcessing 
                  ? 'linear-gradient(135deg, #6b7280, #9ca3af)' 
                  : 'linear-gradient(135deg, #7c3aed, #a855f7)'
              }}
            >
              {imageProcessing ? (
                <>
                  <Loader2 size={20} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px', animation: 'spin 1s linear infinite' }} />
                  Processing...
                </>
              ) : (
                <>
                  <ImageIcon size={20} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
                  Scan Images (OCR)
                </>
              )}
            </button>

            {imageProgress && (
              <div className={`${styles['message']} ${imageProgress.includes('❌') ? styles['error'] : styles['success']}`}>
                {imageProgress}
              </div>
            )}

            {extractedCSV && (
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ marginBottom: '8px', color: 'var(--text-dark)', fontWeight: '600' }}>
                  <FileSpreadsheet size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                  Extracted CSV (Editable):
                </h4>
                <textarea
                  value={extractedCSV}
                  onChange={(e) => setExtractedCSV(e.target.value)}
                  className={styles['input']}
                  style={{ 
                    height: '200px', 
                    fontFamily: 'monospace', 
                    fontSize: '11px',
                    resize: 'vertical',
                    lineHeight: '1.5',
                    whiteSpace: 'pre'
                  }}
                />
                <button
                  onClick={downloadExtractedCSV}
                  className={styles['upload-button']}
                  style={{ marginTop: '12px', background: 'linear-gradient(135deg, #059669, #10b981)' }}
                >
                  <Download size={20} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
                  Download as CSV
                </button>
              </div>
            )}
          </div>

          {/* Skip Button */}
          <div className={styles['skip-container']}>
            <button onClick={handleSkip} className={styles['skip-button']}>
              Continue to Home
              <ArrowRight size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: '8px' }} />
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
