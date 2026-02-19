'use client'
import { useRouter } from 'next/navigation'
import { FileText, Upload, Building2, CheckCircle2, XCircle, ArrowRight, FileSpreadsheet, Info, AlertTriangle, BookOpen, GraduationCap, DoorOpen, Tv, Landmark, AlertCircle } from 'lucide-react'
import styles from './styles/bQtime.module.css'
import React, { useState } from 'react'
import type { JSX } from 'react'
import { supabase } from '@/lib/supabaseClient'
import MenuBar from '@/app/components/MenuBar'

export default function UploadCSVPage(): JSX.Element {
  const router = useRouter()

  // ==================== Room/Campus Upload States ====================
  const [roomFile, setRoomFile] = useState<File | null>(null)
  const [roomSchoolName, setRoomSchoolName] = useState('')
  const [roomCampusName, setRoomCampusName] = useState('')
  const [roomLoading, setRoomLoading] = useState(false)
  const [roomMessage, setRoomMessage] = useState<string | null>(null)
  const [roomError, setRoomError] = useState<string | null>(null)

  // ==================== Degree Program Upload States ====================
  const [classFile, setClassFile] = useState<File | null>(null)
  const [degreeProgramName, setDegreeProgramName] = useState('')
  const [classLoading, setClassLoading] = useState(false)
  const [classMessage, setClassMessage] = useState<string | null>(null)
  const [classError, setClassError] = useState<string | null>(null)
  // ==================== Faculty Profiles Upload States ====================
  const [facultyFile, setFacultyFile] = useState<File | null>(null)
  const [facultyCollegeName, setFacultyCollegeName] = useState('')
  const [facultyLoading, setFacultyLoading] = useState(false)
  const [facultyMessage, setFacultyMessage] = useState<string | null>(null)
  const [facultyError, setFacultyError] = useState<string | null>(null)

  // Auth check on mount
  React.useEffect(() => {
    checkAuth()
  }, [])

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

  // ==================== CSV Parsing Utilities ====================
  const parseCSV = (text: string): string[][] => {
    const lines = text.trim().split('\n')
    return lines.map(line => {
      // Check if pipe-separated
      if (line.includes('|')) {
        return line.split('|').map(cell => cell.trim().replace(/^["']|["']$/g, ''))
      }

      // Parse comma-separated with proper quote handling
      const cells: string[] = []
      let current = ''
      let inQuotes = false
      let quoteChar = ''

      for (let i = 0; i < line.length; i++) {
        const char = line[i]

        if ((char === '"' || char === "'") && !inQuotes) {
          // Start of quoted field
          inQuotes = true
          quoteChar = char
        } else if (char === quoteChar && inQuotes) {
          // Check for escaped quote (double quote)
          if (line[i + 1] === quoteChar) {
            current += char
            i++ // Skip the next quote
          } else {
            // End of quoted field
            inQuotes = false
            quoteChar = ''
          }
        } else if (char === ',' && !inQuotes) {
          // Field separator
          cells.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      // Push the last field
      cells.push(current.trim())

      return cells
    })
  }

  // ==================== Validation Functions ====================

  // ==================== NEW v2 CSV Format Validation ====================

  // Validate Room/Campus CSV headers
  // NEW format: Room_ID, Room_Name, Building, Floor, College, Primary_Type, Specific_Classification, Capacity, Is_Airconditioned, Has_Whiteboard, Has_TV
  const validateRoomHeaders = (headers: string[]): boolean => {
    if (headers.length < 6) return false
    const headerStr = headers.map(h => h.toLowerCase().replace(/[_\s-]/g, '')).join(' ')

    // NEW format check - must have room_name, building, and capacity
    const hasRoomName = headerStr.includes('roomname') || headerStr.includes('roomid')
    const hasBuilding = headerStr.includes('building')
    const hasCapacity = headerStr.includes('capacity')
    const hasCollege = headerStr.includes('college')
    const hasPrimaryType = headerStr.includes('primarytype') || headerStr.includes('type')

    return hasRoomName && hasBuilding && hasCapacity && (hasCollege || hasPrimaryType)
  }

  // Validate Degree Program CSV headers (NEW format)
  const validateClassHeaders = (headers: string[]): boolean => {
    if (headers.length < 4) return false
    const headerStr = headers.map(h => h.toLowerCase().replace(/[_\s-]/g, '')).join(' ')

    // NEW Degree Program format: Degree Program, Year Level, Semester, Grade, Course Code, Descriptive Title, Lab Units, Lab Hours, Lec Hours, Pre-requisite
    const hasDegreeProgram = headerStr.includes('degreeprogram') || headerStr.includes('program')
    const hasCourseCode = headerStr.includes('coursecode') || headerStr.includes('code')
    const hasYearLevel = headerStr.includes('yearlevel') || headerStr.includes('year')
    const hasSemester = headerStr.includes('semester')
    const hasDescriptiveTitle = headerStr.includes('descriptivetitle') || headerStr.includes('title') || headerStr.includes('coursename')

    // OLD format fallback: class section | course code | course name
    const hasClassOrSection = headerStr.includes('class') || headerStr.includes('section')
    const hasSchedule = headerStr.includes('schedule') || headerStr.includes('day') || headerStr.includes('time')

    return (hasDegreeProgram && hasCourseCode) || (hasYearLevel && hasCourseCode && hasDescriptiveTitle) || (hasClassOrSection || hasSchedule)
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
  // Teacher schedules removed

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
          'INVALID CSV FORMAT DETECTED!\n\n' +
          'Expected headers (comma-separated):\n' +
          'Room_ID, Room_Name, Building, Floor, College, Primary_Type, Specific_Classification, Capacity, Is_Airconditioned, Has_Whiteboard, Has_TV\n\n' +
          'Note: Room_ID, Floor, and Is_Airconditioned can be empty\n\n' +
          `Found headers:\n${headers.join(', ')}\n\n` +
          'Please fix the format and try again.'
        )
      }

      setRoomFile(file)
      setRoomMessage('CSV format validated successfully!')
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
          '📋 Expected headers (comma or pipe-separated):\n' +
          'Degree Program, Year Level, Semester, Grade, Course Code, Descriptive Title, Lab Units, Lab Hours, Lec Hours, Pre-requisite\n\n' +
          '📋 Example row:\n' +
          'BS Biology, 1, 1st Semester, 1.0, BIO 101, General Biology, 1, 3, 2, None\n\n' +
          `❗ Found headers:\n${headers.join(', ')}\n\n` +
          '⚠️ Please fix the format and try again.'
        )
      }

      setClassFile(file)
      setClassMessage(`✅ Degree Program CSV format validated successfully! (${rows.length - 1} courses found)`)
    } catch (err: any) {
      console.error('Class file validation error:', err)
      setClassFile(null)
      setClassError(err?.message ?? String(err))
    }
  }

  // Teacher schedules removed

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
  // NEW CSV Format: Room_ID, Room_Name, Building, Floor, College, Primary_Type, Specific_Classification, Capacity, Is_Airconditioned, Has_Whiteboard, Has_TV
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
      const headers = rows[0].map(h => h.toLowerCase().replace(/[_\s-]/g, ''))

      // Get the next upload_group_id for rooms
      const { data: maxGroupData } = await supabase
        .from('campuses' as any)
        .select('upload_group_id')
        .order('upload_group_id', { ascending: false })
        .limit(1)

      const nextGroupId = ((maxGroupData as any)?.[0]?.upload_group_id || 0) + 1

      // Map headers to indices
      const getIndex = (names: string[]): number => {
        return headers.findIndex(h => names.some(n => h.includes(n)))
      }

      const roomIdIdx = getIndex(['roomid'])
      const roomNameIdx = getIndex(['roomname'])
      const buildingIdx = getIndex(['building'])
      const floorIdx = getIndex(['floor'])
      const collegeIdx = getIndex(['college'])
      const primaryTypeIdx = getIndex(['primarytype'])
      const specificClassIdx = getIndex(['specificclassification', 'classification'])
      const capacityIdx = getIndex(['capacity'])
      const acIdx = getIndex(['isaircon', 'airconditioned', 'hasac', 'ac'])
      const whiteboardIdx = getIndex(['whiteboard', 'haswhiteboard'])
      const tvIdx = getIndex(['hastv', 'tv'])

      // Parse NEW format data
      const roomData = dataRows.map(row => {
        // Handle empty values - show as 'None' or default values
        const roomId = roomIdIdx >= 0 ? (row[roomIdIdx]?.trim() || '') : ''
        const roomName = roomNameIdx >= 0 ? (row[roomNameIdx]?.trim() || '') : ''
        const building = buildingIdx >= 0 ? (row[buildingIdx]?.trim() || '') : ''
        const floorStr = floorIdx >= 0 ? row[floorIdx]?.trim() : ''
        // Properly parse floor number - handle empty, invalid, and valid cases
        const floorNum = floorStr ? parseInt(floorStr, 10) : null
        const floor = (floorNum !== null && !isNaN(floorNum)) ? floorNum : null
        const college = collegeIdx >= 0 ? (row[collegeIdx]?.trim() || '') : ''
        const primaryType = primaryTypeIdx >= 0 ? (row[primaryTypeIdx]?.trim() || 'Classroom') : 'Classroom'
        const specificClass = specificClassIdx >= 0 ? (row[specificClassIdx]?.trim() || '') : ''
        const capacityStr = capacityIdx >= 0 ? row[capacityIdx]?.trim() : '30'
        const capacity = parseInt(capacityStr) || 30

        // Handle boolean fields - empty means null/none
        const acStr = acIdx >= 0 ? row[acIdx]?.trim().toLowerCase() : ''
        const hasAc = acStr === '' ? null : (acStr === 'true' || acStr === 'yes' || acStr === '1')

        const whiteboardStr = whiteboardIdx >= 0 ? row[whiteboardIdx]?.trim().toLowerCase() : 'true'
        const hasWhiteboard = whiteboardStr === '' ? null : (whiteboardStr === 'true' || whiteboardStr === 'yes' || whiteboardStr === '1')

        const tvStr = tvIdx >= 0 ? row[tvIdx]?.trim().toLowerCase() : ''
        const hasTv = tvStr === '' ? null : (tvStr === 'true' || tvStr === 'yes' || tvStr === '1')

        return {
          upload_group_id: nextGroupId,
          school_name: roomSchoolName,
          campus: roomCampusName || 'Main Campus',  // Use the admin-input campus name
          building: building,
          room: roomName || roomId || 'Unknown Room',
          room_code: roomId || null,
          capacity: capacity,
          floor_number: floor,
          room_type: primaryType,
          specific_classification: specificClass || null,
          college: college || null,  // Store college from CSV in college field
          has_ac: hasAc,
          has_whiteboard: hasWhiteboard,
          has_tv: hasTv,
          status: 'active',
          file_name: roomFile.name
        }
      }).filter(room => room.room && room.building) // Filter out completely empty rows

      console.log('Inserting room data:', roomData.length, 'rows')

      const { data: insertedData, error: insertError } = await supabase
        .from('campuses' as any)
        .insert(roomData as any)
        .select()

      if (insertError) {
        console.error('Room insert error:', insertError)
        throw insertError
      }
      
      if (!insertedData || insertedData.length === 0) {
        throw new Error('Insert failed - database did not confirm the change. Check RLS policies in Supabase.')
      }
      
      console.log('Room insert result:', insertedData.length, 'rows inserted')

      setRoomMessage(
        `Rooms uploaded successfully!\n` +
        `School: ${roomSchoolName}\n` +
        `Campus: ${roomCampusName}\n` +
        `File: ${roomFile.name}\n` +
        `Rooms: ${roomData.length}`
      )

      setRoomFile(null)
      setRoomSchoolName('')
      setRoomCampusName('')
      const fileInput = document.getElementById('roomFile') as HTMLInputElement
      if (fileInput) fileInput.value = ''
      router.refresh() // Force refresh cached data
    } catch (err: any) {
      console.error('Room upload error:', err)
      setRoomError(err?.message ?? String(err))
    } finally {
      setRoomLoading(false)
    }
  }

  // Upload Degree Program Courses
  const handleClassUpload = async () => {
    if (!classFile || !degreeProgramName) {
      setClassError('Please provide College name (from Admin Settings) and choose a file.')
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
      const headers = rows[0].map(h => h.toLowerCase().replace(/[_\s-]/g, ''))

      // Get the next upload_group_id for class schedules
      const { data: maxGroupData } = await supabase
        .from('class_schedules')
        .select('upload_group_id')
        .order('upload_group_id', { ascending: false })
        .limit(1)

      const nextGroupId = ((maxGroupData as any)?.[0]?.upload_group_id || 0) + 1

      // Map headers to indices for new Degree Program format
      const getIndex = (names: string[]): number => {
        return headers.findIndex(h => names.some(n => h.includes(n)))
      }

      const degreeProgramIdx = getIndex(['degreeprogram', 'program'])
      const yearLevelIdx = getIndex(['yearlevel', 'year'])
      const semesterIdx = getIndex(['semester'])
      const gradeIdx = getIndex(['grade'])
      const courseCodeIdx = getIndex(['coursecode', 'code'])
      const descriptiveTitleIdx = getIndex(['descriptivetitle', 'title', 'coursename'])
      const labUnitsIdx = getIndex(['labunits', 'labunit'])
      const labHoursIdx = getIndex(['labhours', 'labhour'])
      const lecHoursIdx = getIndex(['lechours', 'lecturehours', 'lechour'])
      const prerequisiteIdx = getIndex(['prerequisite', 'prereq'])

      // Check if this is the new Degree Program format
      const isDegreeProgramFormat = degreeProgramIdx >= 0 || (courseCodeIdx >= 0 && descriptiveTitleIdx >= 0)

      let classData: any[] = []

      // Helper function to convert text year level to integer
      const parseYearLevel = (yearStr: string): number => {
        if (!yearStr) return 1
        const trimmed = yearStr.trim().toLowerCase()
        // Handle text format: "First Year", "Second Year", etc.
        if (trimmed.includes('first') || trimmed === '1st year' || trimmed === '1') return 1
        if (trimmed.includes('second') || trimmed === '2nd year' || trimmed === '2') return 2
        if (trimmed.includes('third') || trimmed === '3rd year' || trimmed === '3') return 3
        if (trimmed.includes('fourth') || trimmed === '4th year' || trimmed === '4') return 4
        // Try to parse as integer
        const parsed = parseInt(trimmed)
        return !isNaN(parsed) && parsed >= 1 && parsed <= 4 ? parsed : 1
      }

      if (isDegreeProgramFormat) {
        // NEW Degree Program format: Degree Program, Year Level, Semester, Grade, Course Code, Descriptive Title, Lab Units, Lab Hours, Lec Hours, Pre-requisite
        classData = dataRows.map(row => {
          const degreeProgram = degreeProgramIdx >= 0 ? (row[degreeProgramIdx]?.trim() || '') : ''
          const yearLevelRaw = yearLevelIdx >= 0 ? row[yearLevelIdx]?.trim() || '' : ''
          const yearLevel = parseYearLevel(yearLevelRaw)
          const semester = semesterIdx >= 0 ? (row[semesterIdx]?.trim() || '1st Semester') : '1st Semester'
          const grade = gradeIdx >= 0 ? (row[gradeIdx]?.trim() || '') : ''
          const courseCode = courseCodeIdx >= 0 ? (row[courseCodeIdx]?.trim() || '') : (row[0]?.trim() || '')
          const descriptiveTitle = descriptiveTitleIdx >= 0 ? (row[descriptiveTitleIdx]?.trim() || '') : (row[1]?.trim() || '')
          const labUnits = labUnitsIdx >= 0 ? parseInt(row[labUnitsIdx]?.trim()) || 0 : 0
          const labHours = labHoursIdx >= 0 ? parseInt(row[labHoursIdx]?.trim()) || 0 : 0
          const lecHours = lecHoursIdx >= 0 ? parseInt(row[lecHoursIdx]?.trim()) || 3 : 3
          const prerequisite = prerequisiteIdx >= 0 ? (row[prerequisiteIdx]?.trim() || 'None') : 'None'

          return {
            upload_group_id: nextGroupId,
            course_code: courseCode,
            course_name: descriptiveTitle,
            section: `${yearLevel}A`, // Default section based on year level
            year_level: yearLevel,
            student_count: 30, // Default
            lec_hours: lecHours,
            lab_hours: labHours,
            total_hours: lecHours + labHours,
            schedule_day: '', // Will be assigned by scheduler
            schedule_time: '', // Will be assigned by scheduler
            semester: semester,
            academic_year: '2025-2026',
            department: degreeProgram,
            college: degreeProgramName,
            status: 'pending',
            file_name: classFile.name,
            // Additional fields
            degree_program: degreeProgram,
            prerequisite: prerequisite,
            grade: grade
          }
        }).filter(item => item.course_code) // Filter out empty rows
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
              lec_hours: parseInt(row[8]) || 0,
              lab_hours: parseInt(row[9]) || 0,
              total_hours: (parseInt(row[8]) || 0) + (parseInt(row[9]) || 0),
              schedule_day: row[10] || '',
              schedule_time: row[11] || '',
              semester: row[12] || '1st Semester',
              academic_year: row[13] || '2025-2026',
              department: row[14] || '',
              college: degreeProgramName,
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
              lec_hours: parseInt(row[7]) || 0,
              lab_hours: parseInt(row[8]) || 0,
              total_hours: (parseInt(row[7]) || 0) + (parseInt(row[8]) || 0),
              schedule_day: row[9] || '',
              schedule_time: row[10] || '',
              semester: row[11] || '1st Semester',
              academic_year: row[12] || '2025-2026',
              department: row[13] || '',
              college: degreeProgramName,
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
              lec_hours: parseInt(row[6]) || 0,
              lab_hours: parseInt(row[7]) || 0,
              total_hours: (parseInt(row[6]) || 0) + (parseInt(row[7]) || 0),
              schedule_day: row[8] || '',
              schedule_time: row[9] || '',
              semester: row[10] || '1st Semester',
              academic_year: row[11] || '2025-2026',
              department: row[12] || '',
              college: degreeProgramName,
              status: row[14] || 'pending',
              file_name: classFile.name
            }
          }
        })
      }

      console.log('Inserting class schedule data:', classData.length, 'rows')

      const { data: insertedData, error: insertError } = await supabase
        .from('class_schedules')
        .insert(classData as any)
        .select()

      if (insertError) {
        console.error('Class schedule insert error:', insertError)
        throw insertError
      }
      
      if (!insertedData || insertedData.length === 0) {
        throw new Error('Insert failed - database did not confirm the change. Check RLS policies in Supabase.')
      }
      
      console.log('Class schedule insert result:', insertedData.length, 'rows inserted')

      setClassMessage(
        `✅ Degree Program Courses uploaded successfully!\n` +
        `College & Program: ${degreeProgramName}\n` +
        `File: ${classFile.name}\n` +
        `Courses: ${classData.length}`
      )

      setClassFile(null)
      setDegreeProgramName('')
      const fileInput = document.getElementById('classFile') as HTMLInputElement
      if (fileInput) fileInput.value = ''
      router.refresh() // Force refresh cached data
    } catch (err: any) {
      console.error('Class upload error:', err)
      setClassError(err?.message ?? String(err))
    } finally {
      setClassLoading(false)
    }
  }

  // Teacher schedules removed

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

      // Get the next upload_group_id for faculty_profiles
      const { data: maxGroupData } = await supabase
        .from('faculty_profiles' as any)
        .select('upload_group_id')
        .order('upload_group_id', { ascending: false })
        .limit(1)

      const nextGroupId = ((maxGroupData as any)?.[0]?.upload_group_id || 0) + 1

      // Generate faculty_id based on name with unique group prefix
      const generateFacultyId = (name: string, index: number) => {
        const nameParts = name.split(/[,\s]+/).filter(p => p.length > 0)
        const initials = nameParts.map(p => p.charAt(0).toUpperCase()).join('')
        return `FAC-G${nextGroupId}-${initials}-${String(index + 1).padStart(4, '0')}`
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
          upload_group_id: nextGroupId,
          file_name: facultyFile.name,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      })

      console.log('Inserting faculty profiles data:', facultyData.length, 'rows with upload_group_id:', nextGroupId)

      // Insert into faculty_profiles table (each upload is a separate group)
      const { data: insertedData, error: insertError } = await supabase
        .from('faculty_profiles')
        .insert(facultyData as any)
        .select()

      if (insertError) {
        console.error('Faculty profiles insert error:', insertError)
        throw insertError
      }
      
      if (!insertedData || insertedData.length === 0) {
        throw new Error('Insert failed - database did not confirm the change. Check RLS policies in Supabase.')
      }
      
      console.log('Faculty profiles insert result:', insertedData.length, 'rows inserted')

      // Count by type
      const typeCounts = facultyData.reduce((acc: any, f) => {
        acc[f.role] = (acc[f.role] || 0) + 1
        return acc
      }, {})

      setFacultyMessage(
        `Faculty Profiles uploaded successfully!\n` +
        `College: ${facultyCollegeName}\n` +
        `File: ${facultyFile.name}\n` +
        `Upload Group ID: ${nextGroupId}\n` +
        `Total: ${facultyData.length} profiles\n` +
        `Breakdown:\n` +
        Object.entries(typeCounts).map(([role, count]) => `  - ${role}: ${count}`).join('\n')
      )

      setFacultyFile(null)
      setFacultyCollegeName('')
      const fileInput = document.getElementById('facultyFile') as HTMLInputElement
      if (fileInput) fileInput.value = ''
      router.refresh() // Force refresh cached data
    } catch (err: any) {
      console.error('Faculty upload error:', err)
      setFacultyError(err?.message ?? String(err))
    } finally {
      setFacultyLoading(false)
    }
  }

  const handleSkip = () => {
    router.push('/LandingPages/Home')
  }

  return (
    <div className={styles['page-layout']} data-page="admin">
      <MenuBar onToggleSidebar={() => { }} showSidebarToggle={false} showAccountIcon={false} />

      <div className={styles['page-header-content']}>
        <h1>
          <Upload size={32} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '12px' }} />
          Upload CSV Data
        </h1>
        <h2>Upload CSV data for Rooms, Courses, and Faculty</h2>
      </div>

      <main className={styles['upload-container']}>
        <div className={styles['upload-wrapper']}>

          {/* ==================== ROOMS/CAMPUSES UPLOAD ==================== */}
          <div className={styles['upload-card']}>
            <h2 className={styles['section-title']}>
              <DoorOpen size={28} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '10px' }} />
              Rooms & Buildings
            </h2>

            <div className={styles['format-info']}>
              <h3>
                <Info size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                Expected CSV Format:
              </h3>
              <p style={{ fontSize: '11px', wordBreak: 'break-word', fontFamily: 'monospace' }}>
                Room_ID, Room_Name, Building, Floor, College, Primary_Type, Specific_Classification, Capacity, Is_Airconditioned, Has_Whiteboard, Has_TV
              </p>
              <small style={{ color: 'var(--text-light)', marginTop: '8px', display: 'block' }}>
                <FileText size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                Example: CS-101, Room 101, Science Building, 1, CS, Lecture Room, Standard Classroom, 40, true, true, false
              </small>
              <div style={{ marginTop: '8px', padding: '8px', background: 'var(--info-bg, #dbeafe)', borderRadius: '4px', fontSize: '12px' }}>
                <Info size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px', color: '#2563eb' }} />
                <strong style={{ color: '#1e40af' }}>Where this goes:</strong>{' '}
                <span style={{ color: 'var(--text-dark)' }}>Rooms upload populates RoomsManagement (Rooms & Buildings).</span>
              </div>
              <div style={{ marginTop: '8px', padding: '8px', background: 'var(--info-bg, #dbeafe)', borderRadius: '4px', fontSize: '12px' }}>
                <Info size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px', color: '#2563eb' }} />
                <strong style={{ color: '#1e40af' }}>Room Types:</strong> <span style={{ color: 'var(--text-dark)' }}>Lecture Room, Laboratory, Computer Lab, Conference Room, Auditorium, etc.</span>
              </div>
              <div style={{ marginTop: '8px', padding: '8px', background: 'var(--success-bg, #d1fae5)', borderRadius: '4px', fontSize: '12px' }}>
                <CheckCircle2 size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px', color: '#059669' }} />
                <strong style={{ color: '#065f46' }}>College Field:</strong>{' '}
                <span style={{ color: 'var(--text-dark)' }}>Use a college code from Admin Settings (e.g., CS, CICT). Use Shared for multi-college rooms.</span>
              </div>
              <div style={{ marginTop: '8px', padding: '8px', background: 'var(--warning-bg, #fef3c7)', borderRadius: '4px', fontSize: '12px' }}>
                <AlertCircle size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px', color: '#d97706' }} />
                <strong style={{ color: '#92400e' }}>Note:</strong> <span style={{ color: 'var(--text-dark)' }}>Room_ID, Floor, and Is_Airconditioned can be empty. Empty values will show as "None".</span>
              </div>
            </div>

            <div className={styles['form-row']}>
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
                  <Landmark size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                  Campus Name
                  <input
                    type="text"
                    value={roomCampusName}
                    onChange={(e) => setRoomCampusName(e.target.value)}
                    className={styles['input']}
                    placeholder="e.g., Main Campus, Diliman Campus"
                    required
                  />
                </label>
              </div>
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
              disabled={roomLoading || !roomFile || !roomSchoolName || !roomCampusName}
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

          {/* ==================== DEGREE PROGRAM SECTION UPLOAD ==================== */}
          <div className={styles['upload-card']}>
            <h2 className={styles['section-title']}>
              <BookOpen size={28} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '10px' }} />
              Degree Program Section
            </h2>

            <div className={styles['format-info']}>
              <h3>
                <Info size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                Expected CSV Format:
              </h3>
              <p style={{ fontSize: '12px', wordBreak: 'break-word', fontWeight: '600', color: '#10b981' }}>Degree Program, Year Level, Semester, Grade, Course Code, Descriptive Title, Lab Units, Lab Hours, Lec Hours, Pre-requisite</p>
              <small style={{ color: 'var(--text-light)', marginTop: '8px', display: 'block' }}>
                <FileText size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                Example: BS Biology, 1, 1st Semester, 1.0, BIO 101, General Biology, 1, 3, 2, None
              </small>
              <div style={{ marginTop: '8px', padding: '8px', background: 'var(--info-bg, #dbeafe)', borderRadius: '4px', fontSize: '12px' }}>
                <Info size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px', color: '#2563eb' }} />
                <strong style={{ color: '#1e40af' }}>Degree Programs:</strong> <span style={{ color: 'var(--text-dark)' }}>BS Biology, BS Mathematics, BS Computer Science, BS Chemistry, BS Physics, etc.</span>
              </div>
              <div style={{ marginTop: '8px', padding: '8px', background: 'var(--info-bg, #dbeafe)', borderRadius: '4px', fontSize: '12px' }}>
                <Info size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px', color: '#2563eb' }} />
                <strong style={{ color: '#1e40af' }}>Where this goes:</strong>{' '}
                <span style={{ color: 'var(--text-dark)' }}>Course uploads appear in CoursesManagement and are grouped by college.</span>
              </div>
              <div style={{ marginTop: '8px', padding: '8px', background: 'var(--success-bg, #d1fae5)', borderRadius: '4px', fontSize: '12px' }}>
                <CheckCircle2 size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px', color: '#059669' }} />
                <strong style={{ color: '#065f46' }}>College Name:</strong>{' '}
                <span style={{ color: 'var(--text-dark)' }}>Use a college from Admin Settings (e.g., College of Science). This value controls the CoursesManagement folder.</span>
              </div>
            </div>

            <div className={styles['form-group']}>
              <label className={styles['label']}>
                <GraduationCap size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                College Name (from Admin Settings)
                <input
                  type="text"
                  value={degreeProgramName}
                  onChange={(e) => setDegreeProgramName(e.target.value)}
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
              disabled={classLoading || !classFile || !degreeProgramName}
              className={styles['upload-button']}
            >
              <Upload size={20} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
              {classLoading ? 'Uploading...' : 'Upload Degree Program CSV'}
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

          {/* Teacher schedules removed */}

          {/* ==================== FACULTY PROFILES UPLOAD ==================== */}
          <div className={styles['upload-card']}>
            <h2 className={styles['section-title']}>
              <GraduationCap size={28} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '10px' }} />
              Faculty Profiles (Officials & Staff)
            </h2>

            <div className={styles['format-info']}>
              <h3>
                <Info size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                Expected CSV Format:
              </h3>
              <p style={{ fontSize: '12px', wordBreak: 'break-word', fontWeight: '600', color: '#10b981' }}>Name | Position | Department | Type</p>
              <small style={{ color: 'var(--text-light)', marginTop: '8px', display: 'block' }}>
                <FileText size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                Examples:
              </small>
              <div style={{ marginTop: '8px', padding: '10px', background: 'var(--info-bg, #dbeafe)', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace' }}>
                "Thelma V. Pagtalunan" | "Dean" | "Administration" | "Official"<br />
                "Benedict M. Estrella" | "Associate Dean" | "Administration" | "Official"<br />
                "Harris R. Dela Cruz" | "Faculty" | "Mathematics" | "Faculty"<br />
                "Joshua P. Valeroso" | "Faculty (Part-Time)" | "Mathematics" | "Faculty (Part-Time)"<br />
                "Aubrey Rose T. Gan" | "Faculty (Adjunct)" | "Mathematics" | "Faculty (Adjunct)"<br />
                "Karl Kenneth R. Santos" | "Guest Lecturer" | "Science" | "Guest Lecturer"
              </div>
              <div style={{ marginTop: '8px', padding: '8px', background: 'var(--success-bg, #d1fae5)', borderRadius: '4px', fontSize: '12px' }}>
                <CheckCircle2 size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px', color: '#059669' }} />
                <strong style={{ color: '#065f46' }}>Types Supported:</strong> <span style={{ color: 'var(--text-dark)' }}>Official, Staff, Faculty, Faculty (Part-Time), Faculty (Adjunct), Guest Lecturer</span>
              </div>
              <div style={{ marginTop: '8px', padding: '8px', background: 'var(--info-bg, #dbeafe)', borderRadius: '4px', fontSize: '12px' }}>
                <Info size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px', color: '#2563eb' }} />
                <strong style={{ color: '#1e40af' }}>Where this goes:</strong>{' '}
                <span style={{ color: 'var(--text-dark)' }}>Faculty uploads appear in FacultyColleges and Faculty Management.</span>
              </div>
              <div style={{ marginTop: '8px', padding: '8px', background: 'var(--success-bg, #d1fae5)', borderRadius: '4px', fontSize: '12px' }}>
                <CheckCircle2 size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px', color: '#059669' }} />
                <strong style={{ color: '#065f46' }}>College Name:</strong>{' '}
                <span style={{ color: 'var(--text-dark)' }}>Use a college from Admin Settings (e.g., College of Science). This value controls the FacultyColleges folder.</span>
              </div>
            </div>

            <div className={styles['form-group']}>
              <label className={styles['label']}>
                <Building2 size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                College Name (from Admin Settings)
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
