'use client'
import { useRouter } from 'next/navigation'
import { 
  FileText, 
  Users, 
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
  Download
} from 'lucide-react'
import styles from './styles/bQtime.module.css'
import React, { useState, useRef } from 'react'
import type { JSX } from 'react'
import { supabase } from '@/lib/supabaseClient'
import MenuBar from '@/app/components/MenuBar'
import Tesseract from 'tesseract.js'

export default function BeforeQtimeHomePage(): JSX.Element {
  const router = useRouter()
  const [campusFile, setCampusFile] = useState<File | null>(null)
  const [participantFile, setParticipantFile] = useState<File | null>(null)
  const [campusSchoolName, setCampusSchoolName] = useState('')
  const [participantBatchName, setParticipantBatchName] = useState('')
  const [campusLoading, setCampusLoading] = useState(false)
  const [participantLoading, setParticipantLoading] = useState(false)
  const [campusMessage, setCampusMessage] = useState<string | null>(null)
  const [participantMessage, setParticipantMessage] = useState<string | null>(null)
  const [campusError, setCampusError] = useState<string | null>(null)
  const [participantError, setParticipantError] = useState<string | null>(null)
  
  // Image upload states
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imageProcessing, setImageProcessing] = useState(false)
  const [imageProgress, setImageProgress] = useState<string>('')
  const [extractedCSV, setExtractedCSV] = useState<string | null>(null)
  const [imageUploadType, setImageUploadType] = useState<'class' | 'teacher'>('class')
  
  const imageFolderInputRef = useRef<HTMLInputElement>(null)

  const parseCSV = (text: string): string[][] => {
    const lines = text.trim().split('\n')
    return lines.map(line => {
      // Handle both comma and pipe-separated values
      if (line.includes('|')) {
        return line.split('|').map(cell => cell.trim())
      }
      return line.split(',').map(cell => cell.trim())
    })
  }

  // Validate Class Schedule CSV headers (new format)
  const validateCampusHeaders = (headers: string[]): boolean => {
    // Minimum required headers for class schedule
    if (headers.length < 4) {
      return false
    }
    
    // Check if headers contain key identifiers (flexible matching)
    const headerStr = headers.map(h => h.toLowerCase()).join(' ')
    const hasClassOrSection = headerStr.includes('class') || headerStr.includes('section')
    const hasCourseCode = headerStr.includes('course') || headerStr.includes('code')
    const hasSchedule = headerStr.includes('schedule') || headerStr.includes('day') || headerStr.includes('time')
    
    return hasClassOrSection || hasCourseCode || hasSchedule
  }

  // Validate Teacher Schedule CSV headers (new format)
  const validateParticipantHeaders = (headers: string[]): boolean => {
    if (headers.length < 3) {
      return false
    }
    
    // Check if headers contain key identifiers (flexible matching)
    const headerStr = headers.map(h => h.toLowerCase()).join(' ')
    const hasTeacherId = headerStr.includes('teacher') || headerStr.includes('id')
    const hasName = headerStr.includes('name')
    const hasSchedule = headerStr.includes('schedule') || headerStr.includes('day') || headerStr.includes('time')
    
    return (hasTeacherId || hasName) && hasSchedule
  }

  // Validate campus file on selection
  const handleCampusFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setCampusError(null)
    setCampusMessage(null)

    try {
      const text = await file.text()
      const rows = parseCSV(text)

      if (rows.length < 1) {
        throw new Error('CSV file is empty or invalid.')
      }

      const headers = rows[0]
      if (!validateCampusHeaders(headers)) {
        // Reset the file input
        e.target.value = ''
        throw new Error(
          '❌ INVALID CSV FORMAT DETECTED!\n\n' +
          '📋 Expected headers (pipe-separated):\n' +
          'Class Section | Course Code | Course Name | LEC Unit | LAB Unit | Credit Unit | LEC Hr | LAB Hr | Section | Schedule(Day) | Schedule(Time)\n\n' +
          `❗ Found headers:\n${headers.join(' | ')}\n\n` +
          '⚠️ Please fix the format and try again.'
        )
      }

      // File is valid
      setCampusFile(file)
      setCampusMessage('✅ CSV format validated successfully!')
    } catch (err: any) {
      console.error('Campus file validation error:', err)
      setCampusFile(null)
      setCampusError(err?.message ?? String(err))
    }
  }

  // Validate participant file on selection
  const handleParticipantFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setParticipantError(null)
    setParticipantMessage(null)

    try {
      const text = await file.text()
      const rows = parseCSV(text)

      if (rows.length < 1) {
        throw new Error('CSV file is empty or invalid.')
      }

      const headers = rows[0]
      if (!validateParticipantHeaders(headers)) {
        // Reset the file input
        e.target.value = ''
        throw new Error(
          '❌ INVALID CSV FORMAT DETECTED!\n\n' +
          '📋 Expected headers (pipe-separated):\n' +
          "Teacher's ID | Name | Schedule(Day) | Schedule(Time)\n\n" +
          `❗ Found headers:\n${headers.join(' | ')}\n\n` +
          '⚠️ Please fix the format and try again.'
        )
      }

      // File is valid
      setParticipantFile(file)
      setParticipantMessage('✅ CSV format validated successfully!')
    } catch (err: any) {
      console.error('Participant file validation error:', err)
      setParticipantFile(null)
      setParticipantError(err?.message ?? String(err))
    }
  }

  // Get next upload group ID by finding max + 1
  const getNextCampusGroupId = async (): Promise<number> => {
    const { data, error } = await supabase
      .from('campuses')
      .select('upload_group_id')
      .order('upload_group_id', { ascending: false })
      .limit(1)
    
    if (error) {
      console.error('Error getting max campus ID:', error)
      return 1
    }
    
    return data && data.length > 0 ? data[0].upload_group_id + 1 : 1
  }

  const getNextParticipantGroupId = async (): Promise<number> => {
    const { data, error } = await supabase
      .from('participants')
      .select('upload_group_id')
      .order('upload_group_id', { ascending: false })
      .limit(1)
    
    if (error) {
      console.error('Error getting max participant ID:', error)
      return 1
    }
    
    return data && data.length > 0 ? data[0].upload_group_id + 1 : 1
  }

  const handleCampusUpload = async () => {
    if (!campusFile || !campusSchoolName) {
      setCampusError('Please provide school name and choose a file.')
      return
    }

    setCampusLoading(true)
    setCampusError(null)
    setCampusMessage(null)

    try {
      const text = await campusFile.text()
      const rows = parseCSV(text)

      if (rows.length < 2) {
        throw new Error('CSV file must contain at least one data row.')
      }

      const dataRows = rows.slice(1)

      // Get the next group ID - all rows from this CSV will share this ID
      const groupId = await getNextCampusGroupId()

      // Map to the new class schedule format
      const campusData = dataRows.map(row => ({
        upload_group_id: groupId,
        class_section: row[0] || '',
        course_code: row[1] || '',
        course_name: row[2] || '',
        lec_unit: parseInt(row[3]) || 0,
        lab_unit: parseInt(row[4]) || 0,
        credit_unit: parseInt(row[5]) || 0,
        lec_hr: parseInt(row[6]) || 0,
        lab_hr: parseInt(row[7]) || 0,
        section: row[8] || '',
        schedule_day: row[9] || '',
        schedule_time: row[10] || '',
        school_name: campusSchoolName,
        file_name: campusFile.name
      }))

      console.log('Inserting class schedule data with Group ID:', groupId)
      console.log('Data:', campusData)

      const { data, error: insertError } = await supabase
        .from('class_schedules')
        .insert(campusData)

      if (insertError) {
        console.error('Class schedule insert error:', insertError)
        throw insertError
      }

      setCampusMessage(
        `✅ Class Schedule uploaded successfully!\n` +
        `Group ID: ${groupId}\n` +
        `Batch: ${campusSchoolName}\n` +
        `File: ${campusFile.name}\n` +
        `Rows: ${campusData.length}`
      )
      
      // Reset form
      setCampusFile(null)
      setCampusSchoolName('')
      const fileInput = document.getElementById('campusFile') as HTMLInputElement
      if (fileInput) fileInput.value = ''
    } catch (err: any) {
      console.error('Campus upload error:', err)
      setCampusError(err?.message ?? String(err))
    } finally {
      setCampusLoading(false)
    }
  }

  const handleParticipantUpload = async () => {
    if (!participantFile || !participantBatchName) {
      setParticipantError('Please provide batch name and choose a file.')
      return
    }

    setParticipantLoading(true)
    setParticipantError(null)
    setParticipantMessage(null)

    try {
      const text = await participantFile.text()
      const rows = parseCSV(text)

      if (rows.length < 2) {
        throw new Error('CSV file must contain at least one data row.')
      }

      const dataRows = rows.slice(1)

      // Get the next group ID
      const groupId = await getNextParticipantGroupId()

      // Map to the new teacher schedule format
      const teacherData = dataRows.map(row => ({
        upload_group_id: groupId,
        teacher_id: row[0] || '',
        name: row[1] || '',
        schedule_day: row[2] || '',
        schedule_time: row[3] || '',
        batch_name: participantBatchName,
        file_name: participantFile.name
      }))

      console.log('Inserting teacher schedule data with Group ID:', groupId)
      console.log('Data:', teacherData)

      const { data, error: insertError } = await supabase
        .from('teacher_schedules')
        .insert(teacherData)

      if (insertError) {
        console.error('Teacher schedule insert error:', insertError)
        throw insertError
      }

      setParticipantMessage(
        `✅ Teacher Schedule uploaded successfully!\n` +
        `Group ID: ${groupId}\n` +
        `College: ${participantBatchName}\n` +
        `File: ${participantFile.name}\n` +
        `Rows: ${teacherData.length}`
      )
      
      // Reset form
      setParticipantFile(null)
      setParticipantBatchName('')
      const fileInput = document.getElementById('participantFile') as HTMLInputElement
      if (fileInput) fileInput.value = ''
    } catch (err: any) {
      console.error('Participant upload error:', err)
      setParticipantError(err?.message ?? String(err))
    } finally {
      setParticipantLoading(false)
    }
  }

  // Handle image file selection
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

  // Process images with OCR using Tesseract.js
  // 5-minute timeout per image for thorough analysis
  const processImagesWithOCR = async () => {
    if (imageFiles.length === 0) return
    
    setImageProcessing(true)
    setImageProgress('🔄 Initializing AI-powered OCR analysis (may take up to 5 minutes per image for best accuracy)...')
    setExtractedCSV(null)
    
    const TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes per image
    
    try {
      const allExtractedText: string[] = []
      
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i]
        setImageProgress(`📷 Processing image ${i + 1} of ${imageFiles.length}: ${file.name}\n⏱️ This may take up to 5 minutes for accurate reading...`)
        
        // Convert file to data URL for Tesseract
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = (e) => resolve(e.target?.result as string)
          reader.readAsDataURL(file)
        })
        
        setImageProgress(`🔍 Deep scanning ${file.name} for schedule data...\n⏱️ Timeout: 5 minutes`)
        
        // OCR with timeout
        const ocrPromise = Tesseract.recognize(
          dataUrl,
          'eng',
          {
            logger: (m) => {
              if (m.status === 'recognizing text') {
                const percent = Math.round(m.progress * 100)
                setImageProgress(`🧠 Deep analyzing ${file.name}: ${percent}%\n📊 Reading schedule grid structure...`)
              }
            }
          }
        )
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`OCR timeout: ${file.name} took longer than 5 minutes`)), TIMEOUT_MS)
        })
        
        try {
          const result = await Promise.race([ocrPromise, timeoutPromise])
          console.log(`📝 Raw OCR output for ${file.name}:`, result.data.text)
          allExtractedText.push(result.data.text)
        } catch (timeoutErr: any) {
          console.warn(`⚠️ ${file.name} timed out, skipping...`)
          setImageProgress(`⚠️ ${file.name} took too long (>5 min), skipping to next image...`)
          continue
        }
      }
      
      setImageProgress('🤖 AI is analyzing patterns and extracting schedule data...')
      
      // Combine all text
      const combinedText = allExtractedText.join('\n\n--- NEW IMAGE ---\n\n')
      
      // Detect schedule grid structure
      const gridInfo = detectScheduleGrid(combinedText)
      console.log('📊 Detected grid structure:', gridInfo)
      
      // Parse extracted text and convert to CSV format
      const parsedData = parseExtractedText(combinedText, imageUploadType)
      
      // Generate CSV content - CLEAN OUTPUT (no comments)
      let csvContent = ''
      
      if (imageUploadType === 'class') {
        csvContent = 'Class Section | Course Code | Course Name | LEC Unit | LAB Unit | Credit Unit | LEC Hr | LAB Hr | Section | Schedule(Day) | Schedule(Time)\n'
      } else {
        csvContent = "Teacher's ID | Name | Schedule(Day) | Schedule(Time)\n"
      }
      
      parsedData.forEach(row => {
        csvContent += row.join(' | ') + '\n'
      })
      
      // Extract unique course info for summary with units
      const uniqueCourses = new Map<string, { name: string, units: number, times: number }>()
      parsedData.forEach(row => {
        if (row[1]) {
          const existing = uniqueCourses.get(row[1])
          if (existing) {
            existing.times++
          } else {
            uniqueCourses.set(row[1], { 
              name: row[2] || 'Unknown', 
              units: parseInt(row[5]) || 0,
              times: 1
            })
          }
        }
      })
      
      // Calculate total units
      let totalUnits = 0
      uniqueCourses.forEach(({ units }) => {
        totalUnits += units
      })
      
      // Build course summary for progress message
      const courseSummary = Array.from(uniqueCourses).map(([code, { name, units, times }]) => 
        `   📚 ${code}: ${name} (${units} units, ${times}x/week)`
      ).join('\n')
      
      setExtractedCSV(csvContent)
      setImageProgress(
        `✅ AI OCR ANALYSIS COMPLETE!\n\n` +
        `📊 EXTRACTION RESULTS:\n` +
        `   • Images processed: ${imageFiles.length}\n` +
        `   • Schedule entries: ${parsedData.length}\n` +
        `   • Unique courses: ${uniqueCourses.size}\n` +
        `   • Total units: ${totalUnits}\n\n` +
        `📋 DETECTED COURSES:\n` +
        (courseSummary || '   (No courses detected)\n') + `\n\n` +
        `🔢 UNIT FORMULA: Hours/session × Times/week = Units\n` +
        `   Example: 1.5 hrs × 2 times = 3 units\n\n` +
        (parsedData.length === 0 ? 
          `⚠️ NO DATA EXTRACTED!\n` +
          `   Check browser console (F12) for OCR debug info.\n` +
          `   The raw OCR text is logged there.` :
          `✅ Data ready! Review the CSV below and download.`)
      )
      
    } catch (err: any) {
      console.error('OCR Error:', err)
      setImageProgress(`❌ Error during OCR analysis: ${err.message}`)
    } finally {
      setImageProcessing(false)
    }
  }

  // =====================================================
  // INTELLIGENT SCHEDULE OCR PARSER V2.0
  // AI-like analysis system for extracting schedule data
  // Auto-calculates units based on time duration & frequency
  // =====================================================

  // Known patterns and dictionaries for smart recognition
  const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const DAY_ABBREVIATIONS: Record<string, string> = {
    'sun': 'Sunday', 'mon': 'Monday', 'tue': 'Tuesday', 'wed': 'Wednesday',
    'thu': 'Thursday', 'fri': 'Friday', 'sat': 'Saturday',
    'm': 'Monday', 't': 'Tuesday', 'w': 'Wednesday', 'th': 'Thursday', 'f': 'Friday', 's': 'Saturday',
    'mwf': 'Mon/Wed/Fri', 'tth': 'Tue/Thu', 'mw': 'Mon/Wed', 'ttf': 'Tue/Thu/Fri'
  }

  // Course code patterns for Philippine universities
  const COURSE_CODE_PATTERNS = [
    /([A-Z]{2,4}\s*\d{3,4})\s*[-–]\s*([A-Za-z\s]+?)(?=\n|$)/gi, // MAT 403 - Numerical Analysis
    /\b([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\b/gi,  // MAT 403, CS 101, IT 3201A
    /\b([A-Z]{2,4}\s*-\s*\d{3,4})\b/gi,    // MAT-403, CS-101
    /\b(GE[A-Z]*\s*\d{2,3})\b/gi,          // GE 101, GED 101
    /\b(NSTP\s*\d{1,2})\b/gi,              // NSTP 1, NSTP 2
    /\b(PE\s*\d{1,2})\b/gi,                // PE 1, PE 2
    /\b(FEL\s*\d{3})\b/gi,                 // FEL 401
  ]

  // Room/Location patterns
  const ROOM_PATTERNS = [
    /\b(Smart\s+Development\s+Lab\s*\d*)\b/gi, // Smart Development Lab 4
    /\b([A-Z]{2}\s*\d{3})\b/gi,             // FH 205, GV 101
    /\b(Room\s*\d{1,4}[A-Z]?)\b/gi,         // Room 205
    /\b(Lab\s*\d{1,2})\b/gi,                // Lab 4
    /\b(Online)\b/gi,                        // Online
    /\b(TBA|TBD)\b/gi,                       // TBA, TBD
  ]

  // Time pattern - captures start and end time
  const TIME_PATTERN = /(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*[-–]\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/gi

  interface ExtractedCourse {
    courseCode: string
    courseName: string
    instructor: string
    day: string
    startTime: string
    endTime: string
    room: string
    durationHours: number
    lecUnit: number
    labUnit: number
    creditUnit: number
    section: string
  }

  // Parse time string to minutes since midnight
  const parseTimeToMinutes = (timeStr: string): number => {
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
    if (!match) return 0
    
    let hours = parseInt(match[1])
    const minutes = parseInt(match[2])
    const period = match[3]?.toUpperCase()
    
    if (period === 'PM' && hours !== 12) hours += 12
    if (period === 'AM' && hours === 12) hours = 0
    
    return hours * 60 + minutes
  }

  // Calculate duration in hours between two time strings
  const calculateDurationHours = (startTime: string, endTime: string): number => {
    const startMinutes = parseTimeToMinutes(startTime)
    const endMinutes = parseTimeToMinutes(endTime)
    const diff = (endMinutes - startMinutes) / 60
    return diff > 0 ? diff : 0
  }

  // =====================================================
  // INTELLIGENT TABLE & GRID SCHEDULE PARSER V3.0
  // Handles both TABLE formats and GRID (calendar) formats
  // =====================================================
  
  const extractCourseBlocks = (text: string): ExtractedCourse[] => {
    const courses: ExtractedCourse[] = []
    
    console.log('🔍 RAW OCR TEXT:', text)
    console.log('🔍 RAW OCR TEXT LENGTH:', text.length)
    
    // Clean up OCR text
    let cleanedText = text
      .replace(/°/g, '0')  // OCR reads 0 as degree symbol
      .replace(/[''`]/g, "'")
      .replace(/[""]/g, '"')
    
    const lines = cleanedText.split('\n').map(l => l.trim()).filter(l => l.length > 2)
    console.log('📜 Text lines:', lines)
    
    // ===== STRATEGY 1: TABLE FORMAT DETECTION =====
    // Look for patterns like "MAT 403" followed by course name, then numbers (units)
    // Format: CourseCode | CourseName | LEC | LAB | Credit | ... | Day Time | Room | Instructor
    
    const tableRowPattern = /([A-Z]{2,4}\s*\d{3,4})\s+([A-Za-z\s]+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/gi
    let tableMatch
    
    while ((tableMatch = tableRowPattern.exec(cleanedText)) !== null) {
      const courseCode = tableMatch[1].replace(/\s+/g, ' ').trim()
      const courseName = tableMatch[2].trim()
      const lecUnit = parseInt(tableMatch[3]) || 0
      const labUnit = parseInt(tableMatch[4]) || 0
      const creditUnit = parseInt(tableMatch[5]) || 0
      const lecHr = parseInt(tableMatch[6]) || 0
      const labHr = parseInt(tableMatch[7]) || 0
      
      // Get context after this match to find schedule info
      const contextAfter = cleanedText.substring(tableMatch.index, Math.min(cleanedText.length, tableMatch.index + 500))
      
      // Find day and time
      const dayTimeMatch = contextAfter.match(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*[-–]\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i)
      let day = '', startTime = '', endTime = ''
      if (dayTimeMatch) {
        day = dayTimeMatch[1]
        startTime = dayTimeMatch[2].toUpperCase().replace(/\s+/g, '')
        endTime = dayTimeMatch[3].toUpperCase().replace(/\s+/g, '')
      }
      
      // Find instructor
      let instructor = ''
      const instructorMatch = contextAfter.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*),\s*([A-Z][a-z]+(?:\s+[A-Z])?)/i)
      if (instructorMatch) {
        instructor = `${instructorMatch[1]}, ${instructorMatch[2]}`.trim()
      }
      
      // Find room
      let room = ''
      const roomMatch = contextAfter.match(/([A-Z]{2}\s*\d{3}[A-Z]?|Smart\s+Development\s+Lab\s*\d*|Online)/i)
      if (roomMatch) {
        room = roomMatch[0]
      }
      
      // Find section
      let section = ''
      const sectionMatch = contextAfter.match(/(BSM?\s*CS\s*\d+[A-Z]?\s*G?\d?)/i)
      if (sectionMatch) {
        section = sectionMatch[1].replace(/\s+/g, ' ').trim()
      }
      
      const durationHours = calculateDurationHours(startTime, endTime)
      
      courses.push({
        courseCode,
        courseName,
        instructor,
        day,
        startTime,
        endTime,
        room,
        durationHours,
        lecUnit,
        labUnit,
        creditUnit,
        section
      })
      
      console.log(`✅ TABLE: ${courseCode} | ${courseName} | LEC:${lecUnit} LAB:${labUnit} | ${day} ${startTime}-${endTime}`)
    }
    
    // ===== STRATEGY 2: PARSE LINE BY LINE FOR COURSE PATTERNS =====
    // If table parsing didn't find anything, try line-by-line
    if (courses.length === 0) {
      console.log('📋 Trying line-by-line parsing...')
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        
        // Look for course code at start of line: "MAT 403" or "FEL 401"
        const codeMatch = line.match(/^([A-Z]{2,4})\s*(\d{3,4})/)
        if (codeMatch) {
          const courseCode = `${codeMatch[1]} ${codeMatch[2]}`
          
          // Rest of line after course code
          const restOfLine = line.substring(codeMatch[0].length).trim()
          
          // Try to extract course name (text before numbers or day names)
          const nameMatch = restOfLine.match(/^([A-Za-z\s\-]+?)(?=\s+\d|\s+Mon|\s+Tue|\s+Wed|\s+Thu|\s+Fri|\s+Sat|\s+Sun|$)/i)
          let courseName = nameMatch ? nameMatch[1].trim() : ''
          
          // If course name is empty, check next line
          if (!courseName && i + 1 < lines.length && !lines[i + 1].match(/^\d|^[A-Z]{2,4}\s*\d{3}/)) {
            courseName = lines[i + 1].trim()
          }
          
          // Find time pattern in this line or nearby
          let startTime = '', endTime = '', day = ''
          const timeMatch = line.match(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*[-–]\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i)
          if (timeMatch) {
            day = timeMatch[1]
            startTime = timeMatch[2].toUpperCase().replace(/\s+/g, '')
            endTime = timeMatch[3].toUpperCase().replace(/\s+/g, '')
          } else {
            // Check for time without day
            const timeOnlyMatch = line.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*[-–]\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i)
            if (timeOnlyMatch) {
              startTime = timeOnlyMatch[1].toUpperCase().replace(/\s+/g, '')
              endTime = timeOnlyMatch[2].toUpperCase().replace(/\s+/g, '')
            }
          }
          
          // Extract units from numbers in line
          const numbers = line.match(/\b(\d)\b/g)
          let lecUnit = 0, labUnit = 0, creditUnit = 0
          if (numbers && numbers.length >= 3) {
            lecUnit = parseInt(numbers[0]) || 0
            labUnit = parseInt(numbers[1]) || 0
            creditUnit = parseInt(numbers[2]) || 0
          }
          
          // Find instructor
          let instructor = ''
          const instructorMatch = line.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*),\s*([A-Z][a-z]+(?:\s+[A-Z])?)/i)
          if (instructorMatch) {
            instructor = `${instructorMatch[1]}, ${instructorMatch[2]}`.trim()
          }
          
          // Find room
          let room = ''
          const roomMatch = line.match(/([A-Z]{2}\s*\d{3}[A-Z]?|Smart\s+Development\s+Lab\s*\d*|Online)/i)
          if (roomMatch) {
            room = roomMatch[0]
          }
          
          const durationHours = calculateDurationHours(startTime, endTime)
          
          // Only add if we have meaningful data
          if (courseName || startTime) {
            courses.push({
              courseCode,
              courseName: courseName.replace(/\d+\s*$/, '').trim(), // Remove trailing numbers
              instructor,
              day,
              startTime,
              endTime,
              room,
              durationHours,
              lecUnit,
              labUnit,
              creditUnit,
              section: ''
            })
            
            console.log(`✅ LINE: ${courseCode} | ${courseName} | ${day} ${startTime}-${endTime}`)
          }
        }
      }
    }
    
    // ===== STRATEGY 3: GRID/CALENDAR FORMAT =====
    // Look for "Course - Name" pattern followed by details
    if (courses.length === 0) {
      console.log('📋 Trying grid/calendar parsing...')
      
      const gridPattern = /([A-Z]{2,4}\s*\d{3,4})\s*[-–]\s*([A-Za-z\s]+?)[\n\r]+([A-Za-z\s\.]+?)[\n\r]+(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*[-–]\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/gi
      let gridMatch
      
      while ((gridMatch = gridPattern.exec(cleanedText)) !== null) {
        const courseCode = gridMatch[1].replace(/\s+/g, ' ').trim()
        const courseName = gridMatch[2].trim()
        const instructor = gridMatch[3].trim()
        const startTime = gridMatch[4].toUpperCase().replace(/\s+/g, '')
        const endTime = gridMatch[5].toUpperCase().replace(/\s+/g, '')
        
        const durationHours = calculateDurationHours(startTime, endTime)
        
        courses.push({
          courseCode,
          courseName,
          instructor,
          day: '',
          startTime,
          endTime,
          room: '',
          durationHours,
          lecUnit: 0,
          labUnit: 0,
          creditUnit: 0,
          section: ''
        })
        
        console.log(`✅ GRID: ${courseCode} | ${courseName} | ${startTime}-${endTime}`)
      }
    }
    
    console.log(`📊 Total courses extracted: ${courses.length}`)
    return courses
  }

  // Detect which days each course appears on by analyzing full text
  const detectCourseDays = (text: string, courses: ExtractedCourse[]): Map<string, string[]> => {
    const courseDays: Map<string, string[]> = new Map()
    
    // For each course, find all its occurrences and nearby day references
    for (const course of courses) {
      const days: string[] = []
      const codePattern = new RegExp(course.courseCode.replace(/\s+/g, '\\s*'), 'gi')
      let match
      
      while ((match = codePattern.exec(text)) !== null) {
        const contextStart = Math.max(0, match.index - 100)
        const contextEnd = Math.min(text.length, match.index + 200)
        const context = text.substring(contextStart, contextEnd)
        
        // Look for day names in context
        for (const day of DAYS_OF_WEEK) {
          if (context.toLowerCase().includes(day.toLowerCase()) && !days.includes(day)) {
            days.push(day)
          }
        }
      }
      
      courseDays.set(course.courseCode, days)
    }
    
    return courseDays
  }

  // Count how many times each course appears in the text (for unit calculation)
  const countCourseOccurrences = (text: string, courses: ExtractedCourse[]): Map<string, number> => {
    const occurrences: Map<string, number> = new Map()
    
    for (const course of courses) {
      // Count how many times this course code appears in the text
      const codePattern = new RegExp(course.courseCode.replace(/\s+/g, '\\s*'), 'gi')
      const matches = text.match(codePattern)
      const count = matches ? matches.length : 1
      
      // Also consider if we found multiple instances in the extractCourseBlocks
      const existingCount = occurrences.get(course.courseCode) || 0
      occurrences.set(course.courseCode, Math.max(existingCount + 1, count))
    }
    
    console.log('📊 Course occurrences (times per week):', Object.fromEntries(occurrences))
    return occurrences
  }

  // Calculate units based on total weekly hours
  // CORRECT FORMULA: Total hours in week = Units
  // Example: Course appears 2x per week with 1.5 hrs each = 3 total hours = 3 units
  const calculateUnits = (durationHours: number, occurrencesPerWeek: number, isLab: boolean = false): { lecUnits: number, labUnits: number, totalUnits: number, lecHours: number, labHours: number } => {
    const totalWeeklyHours = durationHours * occurrencesPerWeek
    
    // Round to nearest whole number for units
    const roundedUnits = Math.round(totalWeeklyHours)
    
    if (isLab) {
      // Lab courses: total weekly hours = lab hours, units same as hours
      return { 
        lecUnits: 0, 
        labUnits: roundedUnits, 
        totalUnits: roundedUnits, 
        lecHours: 0, 
        labHours: roundedUnits 
      }
    } else {
      // Lecture courses: total weekly hours = units
      return { 
        lecUnits: roundedUnits, 
        labUnits: 0, 
        totalUnits: roundedUnits, 
        lecHours: roundedUnits, 
        labHours: 0 
      }
    }
  }

  // Extract section/class from header or title
  const extractSectionFromHeader = (text: string): string => {
    // Look for patterns like "BSM CS 4A - G1 - 2nd Sem"
    const headerMatch = text.match(/\b(BS[A-Z]*\s+[A-Z]{2,4}\s+\d+[A-Z]?(?:\s*-\s*G\d)?)/i)
    if (headerMatch) return headerMatch[1].toUpperCase()
    
    // Look for simpler patterns
    const simpleMatch = text.match(/\b(\d+[A-Z]\s*-\s*G\d)\b/i)
    if (simpleMatch) return simpleMatch[1].toUpperCase()
    
    return ''
  }

  // Main intelligent parser V3
  // Handles TABLE format (columns) and GRID format (calendar)
  const parseExtractedText = (text: string, type: 'class' | 'teacher'): string[][] => {
    const result: string[][] = []
    
    // Extract class section from header
    const classSection = extractSectionFromHeader(text)
    console.log('📋 Detected class section:', classSection)
    
    // Extract all course blocks
    const courses = extractCourseBlocks(text)
    console.log('📚 Extracted courses:', courses)
    
    // Detect which days each course appears
    const courseDays = detectCourseDays(text, courses)
    console.log('📅 Course days mapping:', Object.fromEntries(courseDays))
    
    // Count occurrences of each course in the text
    const courseOccurrences = countCourseOccurrences(text, courses)
    
    if (type === 'class') {
      // Group courses by code
      const courseMap: Map<string, ExtractedCourse[]> = new Map()
      for (const course of courses) {
        const existing = courseMap.get(course.courseCode) || []
        existing.push(course)
        courseMap.set(course.courseCode, existing)
      }
      
      console.log('📊 Course instance count:', Object.fromEntries(
        Array.from(courseMap).map(([code, instances]) => [code, instances.length])
      ))
      
      // Process each unique course
      for (const [courseCode, instances] of courseMap) {
        const firstInstance = instances[0]
        const days = courseDays.get(courseCode) || []
        
        // If we have units from OCR (table format), use those
        // Otherwise calculate from duration and occurrences
        let lecUnits = firstInstance.lecUnit
        let labUnits = firstInstance.labUnit
        let creditUnit = firstInstance.creditUnit
        let lecHours = lecUnits // Usually LEC Hr = LEC Unit
        let labHours = labUnits
        
        // If units were not extracted from OCR, calculate them
        if (creditUnit === 0 && firstInstance.durationHours > 0) {
          const textOccurrences = courseOccurrences.get(courseCode) || 1
          const occurrencesPerWeek = Math.max(days.length, instances.length, textOccurrences)
          
          console.log(`📐 ${courseCode}: ${firstInstance.durationHours.toFixed(1)}hrs × ${occurrencesPerWeek} times/week`)
          
          const isLab = firstInstance.courseName.toLowerCase().includes('lab') ||
                        firstInstance.room.toLowerCase().includes('lab')
          
          const calculated = calculateUnits(firstInstance.durationHours, occurrencesPerWeek, isLab)
          lecUnits = calculated.lecUnits
          labUnits = calculated.labUnits
          creditUnit = calculated.totalUnits
          lecHours = calculated.lecHours
          labHours = calculated.labHours
        }
        
        console.log(`📝 ${courseCode}: LEC=${lecUnits} LAB=${labUnits} Credit=${creditUnit}`)
        
        // Use section from course if available, otherwise from header
        const section = firstInstance.section || classSection
        
        // Create entries for each instance (to show different days/times)
        if (instances.length > 1) {
          // Multiple instances = multiple schedule entries for same course
          for (const instance of instances) {
            const day = instance.day || (days.length > 0 ? days.shift() || '' : '')
            const row = [
              section,
              courseCode,
              firstInstance.courseName,
              String(lecUnits),
              String(labUnits),
              String(creditUnit),
              String(lecHours),
              String(labHours),
              '',
              day,
              instance.startTime && instance.endTime ? `${instance.startTime}-${instance.endTime}` : ''
            ]
            result.push(row)
          }
        } else if (days.length > 0) {
          // Single instance but multiple days detected
          for (const day of days) {
            const row = [
              section,
              courseCode,
              firstInstance.courseName,
              String(lecUnits),
              String(labUnits),
              String(creditUnit),
              String(lecHours),
              String(labHours),
              '',
              day,
              firstInstance.startTime && firstInstance.endTime ? `${firstInstance.startTime}-${firstInstance.endTime}` : ''
            ]
            result.push(row)
          }
        } else {
          // No day detected, create single entry
          const row = [
            section,
            courseCode,
            firstInstance.courseName,
            String(lecUnits),
            String(labUnits),
            String(creditUnit),
            String(lecHours),
            String(labHours),
            '',
            firstInstance.day || '',
            firstInstance.startTime && firstInstance.endTime ? `${firstInstance.startTime}-${firstInstance.endTime}` : ''
          ]
          result.push(row)
        }
      }
      
    } else {
      // Teacher schedule parsing
      const instructorSchedules: Map<string, ExtractedCourse[]> = new Map()
      
      for (const course of courses) {
        if (course.instructor) {
          const existing = instructorSchedules.get(course.instructor) || []
          existing.push(course)
          instructorSchedules.set(course.instructor, existing)
        }
      }
      
      // Generate rows for each instructor's schedule
      let idCounter = 1
      for (const [instructor, schedules] of instructorSchedules) {
        const days = courseDays.get(schedules[0]?.courseCode) || ['']
        
        for (const day of days.length > 0 ? days : ['']) {
          for (const schedule of schedules) {
            const row = [
              String(2020000000 + idCounter++),
              instructor,
              schedule.day || day,
              schedule.startTime && schedule.endTime ? `${schedule.startTime}-${schedule.endTime}` : ''
            ]
            result.push(row)
          }
        }
      }
    }
    
    return result
  }

  // Enhanced: Detect schedule grid structure
  const detectScheduleGrid = (text: string): { days: string[], timeSlots: string[] } => {
    const days: string[] = []
    const timeSlots: string[] = []
    
    // Find day headers
    for (const day of DAYS_OF_WEEK) {
      if (text.toLowerCase().includes(day.toLowerCase())) {
        days.push(day)
      }
    }
    
    // Find time slots
    const timeMatches = text.match(/\d{1,2}:\d{2}\s*(?:AM|PM)?/gi)
    if (timeMatches) {
      const uniqueTimes = [...new Set(timeMatches.map(t => t.toUpperCase().replace(/\s+/g, '')))]
      timeSlots.push(...uniqueTimes.sort())
    }
    
    return { days, timeSlots }
  }

  // Download extracted CSV
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
        <h1>
          Welcome to Qtime Scheduler
        </h1>
        <h2>Kindly Upload the CSV files for the Class Schedule and Teachers Schedule Data</h2>
      </div>

      <main className={styles['upload-container']}>
        <div className={styles['upload-wrapper']}>
          {/* Campus CSV Section */}
          <div className={styles['upload-card']}>
            <h2 className={styles['section-title']}>
              <Building2 size={28} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '10px' }} />
              Class Schedules (Per College)
            </h2>
            
            <div className={styles['format-info']}>
              <h3>
                <Info size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                Expected CSV Format:
              </h3>
              <p>Class Section | Course Code | Course Name | LEC Unit | LAB Unit | Credit Unit | LEC Hr | LAB Hr | Section | Schedule(Day) | Schedule(Time)</p>
              <small style={{ color: 'var(--text-light)', marginTop: '8px', display: 'block' }}>
                <FileSpreadsheet size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
              Example:
              <p>BSM CS 4A | CS101 | Introduction to Computer Science | 3 | 0 | 3 | 3 | 0 | 3 | Monday | 9:00AM - 10:30AM
              </p><p>BSM CS 4A | CS101 | Introduction to Computer Science | 3 | 0 | 3 | 3 | 0 | 3 | Friday | 2:00PM - 03:30PM
              </p>
              </small>
              <div style={{ marginTop: '8px', padding: '8px', background: 'var(--warning-bg, #fef3c7)', borderRadius: '4px', fontSize: '12px' }}>
                <AlertTriangle size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px', color: '#d97706' }} />
                <strong style={{ color: '#92400e' }}>Important:</strong> <span style={{ color: 'var(--text-dark)' }}>Use pipe (|) separators. File validated on selection.</span>
              </div>
            </div>

            <div className={styles['form-group']}>
              <label className={styles['label']}>
                <Building2 size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                Class Schedule Batch (e.g., 2025-2026 First Semester)
                <input
                  type="text"
                  value={campusSchoolName}
                  onChange={(e) => setCampusSchoolName(e.target.value)}
                  className={styles['input']}
                  placeholder="2025-2026 First Semester"
                  required
                />
              </label>
              <small style={{ color: 'var(--text-light)', fontSize: '12px', marginTop: '4px' }}>
                This name will be used to identify your Class Schedule upload
              </small>
            </div>

            <div className={styles['form-group']}>
              <label className={styles['label']}>
                <FileText size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                Select CSV File
                <input
                  id="campusFile"
                  type="file"
                  accept=".csv"
                  onChange={handleCampusFileChange}
                  className={styles['file-input']}
                  required
                />
              </label>
              {campusFile && (
                <small style={{ color: '#10b981', fontSize: '12px', marginTop: '4px', fontWeight: '600' }}>
                  <CheckCircle2 size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                  Selected: {campusFile.name}
                </small>
              )}
            </div>

            <button
              onClick={handleCampusUpload}
              disabled={campusLoading || !campusFile || !campusSchoolName}
              className={styles['upload-button']}
            >
              <Upload size={20} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
              {campusLoading ? 'Uploading...' : 'Upload Class Schedule CSV'}
            </button>

            {campusMessage && (
              <div className={`${styles['message']} ${styles['success']}`} style={{ whiteSpace: 'pre-line' }}>
                <CheckCircle2 size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
                {campusMessage}
              </div>
            )}
            {campusError && (
              <div className={`${styles['message']} ${styles['error']}`} style={{ whiteSpace: 'pre-line' }}>
                <XCircle size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
                {campusError}
              </div>
            )}
          </div>

          {/* Teacher Schedule CSV Section */}
          <div className={styles['upload-card']}>
            <h2 className={styles['section-title']}>
              <Users size={28} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '10px' }} />
              Teachers Schedule (Per College)
            </h2>
            
            <div className={styles['format-info']}>
              <h3>
                <Info size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                Expected CSV Format:
              </h3>
              <p>Teacher's ID | Name | Schedule(Day) | Schedule(Time)</p>
              <small style={{ color: 'var(--text-light)', marginTop: '8px', display: 'block' }}>
                <FileSpreadsheet size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                Example: 
                <p>2022409001 | Juan Dela Cruz | Monday | 9:00AM - 10:30AM</p>
              </small>
              <div style={{ marginTop: '8px', padding: '8px', background: 'var(--warning-bg, #fef3c7)', borderRadius: '4px', fontSize: '12px' }}>
                <AlertTriangle size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px', color: '#d97706' }} />
                <strong style={{ color: '#92400e' }}>Important:</strong> <span style={{ color: 'var(--text-dark)' }}>Use pipe (|) separators. File validated on selection.</span>
              </div>
            </div>

            <div className={styles['form-group']}>
              <label className={styles['label']}>
                <Users size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                College Name (e.g., College of Science)
                <input
                  type="text"
                  value={participantBatchName}
                  onChange={(e) => setParticipantBatchName(e.target.value)}
                  className={styles['input']}
                  placeholder="e.g., College of Science"
                  required
                />
              </label>
              <small style={{ color: 'var(--text-light)', fontSize: '12px', marginTop: '4px' }}>
                This name will help you identify this group of teachers
              </small>
            </div>

            <div className={styles['form-group']}>
              <label className={styles['label']}>
                <FileText size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                Select CSV File
                <input
                  id="participantFile"
                  type="file"
                  accept=".csv"
                  onChange={handleParticipantFileChange}
                  className={styles['file-input']}
                  required
                />
              </label>
              {participantFile && (
                <small style={{ color: '#10b981', fontSize: '12px', marginTop: '4px', fontWeight: '600' }}>
                  <CheckCircle2 size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                  Selected: {participantFile.name}
                </small>
              )}
            </div>

            <button
              onClick={handleParticipantUpload}
              disabled={participantLoading || !participantFile || !participantBatchName}
              className={styles['upload-button']}
            >
              <Upload size={20} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
              {participantLoading ? 'Uploading...' : 'Upload Teacher Schedule CSV'}
            </button>

            {participantMessage && (
              <div className={`${styles['message']} ${styles['success']}`} style={{ whiteSpace: 'pre-line' }}>
                <CheckCircle2 size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
                {participantMessage}
              </div>
            )}
            {participantError && (
              <div className={`${styles['message']} ${styles['error']}`} style={{ whiteSpace: 'pre-line' }}>
                <XCircle size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
                {participantError}
              </div>
            )}
          </div>

          {/* Image Upload with OCR Section */}
          <div className={styles['upload-card']}>
            <h2 className={styles['section-title']}>
              <ImageIcon size={28} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '10px' }} />
              Scan Images for Schedule Data (OCR)
            </h2>
            
            <div className={styles['format-info']}>
              <h3>
                <Info size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                Image Upload Feature
              </h3>
              <p style={{ fontSize: '13px' }}>
                Upload images of schedule timetables and we'll extract the text data using OCR (Optical Character Recognition).
              </p>
              <small style={{ color: 'var(--text-light)', marginTop: '8px', display: 'block' }}>
                Supported formats: PNG, JPG, JPEG, GIF, BMP, WebP
              </small>
              <div style={{ marginTop: '8px', padding: '8px', background: 'var(--info-bg, #dbeafe)', borderRadius: '4px', fontSize: '12px' }}>
                <Info size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px', color: '#2563eb' }} />
                <strong style={{ color: '#1e40af' }}>Note:</strong> <span style={{ color: 'var(--text-dark)' }}>OCR accuracy depends on image quality. Please review and edit the extracted CSV before using.</span>
              </div>
            </div>

            <div className={styles['form-group']}>
              <label className={styles['label']}>
                Schedule Type to Extract:
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
                  Extracted CSV Preview (Editable):
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
              Skip
              <ArrowRight size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: '8px' }} />
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}