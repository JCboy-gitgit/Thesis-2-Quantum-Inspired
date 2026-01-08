'use client'
import { useRouter } from 'next/navigation'
import { 
  Calendar, 
  FileText, 
  Users, 
  BarChart3, 
  Upload, 
  Building2, 
  CheckCircle2, 
  XCircle, 
  ArrowRight,
  FileSpreadsheet,
  Info,
  AlertTriangle
} from 'lucide-react'
import styles from './styles/bQtime.module.css'
import React, { useState } from 'react'
import type { JSX } from 'react'
import { supabase } from '@/lib/supabaseClient'
import MenuBar from '@/app/components/MenuBar'


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

  const features = [
    {
      icon: <FileText size={48} />,
      title: 'Participant Data',
      description: 'Upload and manage participant information easily',
      action: () => router.push('/LandingPages/QtimeParticipantsPage')
    },
    {
      icon: <Building2 size={48} />,
      title: 'Campus Capacity',
      description: 'Configure campus capacity and resources',
      action: () => router.push('/LandingPages/QtimeCampusCapacityPage')
    },
    {
      icon: <Calendar size={48} />,
      title: 'Generate Schedule',
      description: 'Create optimized schedules for your participants',
      action: () => router.push('/LandingPages/GenerateSchedule')
    }
  ]

  const parseCSV = (text: string): string[][] => {
    const lines = text.trim().split('\n')
    return lines.map(line => line.split(',').map(cell => cell.trim()))
  }

  // Validate CSV headers
  const validateCampusHeaders = (headers: string[]): boolean => {
    const expectedHeaders = ['Campus', 'Building', 'Room', 'Capacity']
    
    if (headers.length !== expectedHeaders.length) {
      return false
    }
    
    return headers.every((header, index) => 
      header.toLowerCase() === expectedHeaders[index].toLowerCase()
    )
  }

  const validateParticipantHeaders = (headers: string[]): boolean => {
    const expectedHeaders = [
      'Participant Number',
      'Name',
      'PWD',
      'Email',
      'Province',
      'City',
      'Country'
    ]
    
    if (headers.length !== expectedHeaders.length) {
      return false
    }
    
    return headers.every((header, index) => {
      const cleanHeader = header.toLowerCase().trim()
      const expectedHeader = expectedHeaders[index].toLowerCase()
      
      // For PWD column, accept both "PWD" and "PWD (Yes/No)"
      if (index === 2) {
        return cleanHeader === 'pwd' || cleanHeader === 'pwd (yes/no)'
      }
      
      return cleanHeader === expectedHeader
    })
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
          '📋 Expected headers (exact format):\n' +
          'Campus, Building, Room, Capacity\n\n' +
          `❗ Found headers:\n${headers.join(', ')}\n\n` +
          '⚠️ This file cannot be uploaded. Please fix the headers and try again.'
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
          '📋 Expected headers (exact format):\n' +
          'Participant Number, Name, PWD, Email, Province, City, Country\n' +
          'OR\n' +
          'Participant Number, Name, PWD (Yes/No), Email, Province, City, Country\n\n' +
          `❗ Found headers:\n${headers.join(', ')}\n\n` +
          '⚠️ This file cannot be uploaded. Please fix the headers and try again.'
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

      const campusData = dataRows.map(row => ({
        upload_group_id: groupId,
        campus: row[0] || '',
        building: row[1] || '',
        room: row[2] || '',
        capacity: parseInt(row[3]) || 0,
        school_name: campusSchoolName,
        file_name: campusFile.name
      }))

      console.log('Inserting campus data with Group ID:', groupId)
      console.log('Data:', campusData)

      const { data, error: insertError } = await supabase
        .from('campuses')
        .insert(campusData)

      if (insertError) {
        console.error('Campus insert error:', insertError)
        throw insertError
      }

      setCampusMessage(
        `✅ Campus data uploaded successfully!\n` +
        `Group ID: ${groupId}\n` +
        `School Name: ${campusSchoolName}\n` +
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

      const participantData = dataRows.map(row => ({
        upload_group_id: groupId,
        participant_number: row[0] || '',
        name: row[1] || '',
        is_pwd: row[2].toLowerCase() === 'yes' || row[2].toLowerCase() === 'true',
        email: row[3] || '',
        province: row[4] || '',
        city: row[5] || '',
        country: row[6] || 'Philippines',
        batch_name: participantBatchName,
        file_name: participantFile.name
      }))

      console.log('Inserting participant data with Group ID:', groupId)
      console.log('Data:', participantData)

      const { data, error: insertError } = await supabase
        .from('participants')
        .insert(participantData)

      if (insertError) {
        console.error('Participant insert error:', insertError)
        throw insertError
      }

      setParticipantMessage(
        `✅ Participant data uploaded successfully!\n` +
        `Group ID: ${groupId}\n` +
        `Batch Name: ${participantBatchName}\n` +
        `File: ${participantFile.name}\n` +
        `Rows: ${participantData.length}`
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

  const handleSkip = () => {
    router.push('/LandingPages/QtimeHomePage')
  }

  return (
    <div className={styles['page-layout']}>
      <MenuBar onToggleSidebar={() => {}} showSidebarToggle={false} showAccountIcon={false} />
      
      <div className={styles['page-header-content']}>
        <h1>
          Welcome to Qtime Scheduler
        </h1>
        <h2>Kindly Upload the CSV files for the Campus and Participant Data</h2>
      </div>

      <main className={styles['upload-container']}>
        <div className={styles['upload-wrapper']}>
          {/* Campus CSV Section */}
          <div className={styles['upload-card']}>
            <h2 className={styles['section-title']}>
              <Building2 size={28} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '10px' }} />
              Campus/Building Capacity
            </h2>
            
            <div className={styles['format-info']}>
              <h3>
                <Info size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                Expected CSV Format:
              </h3>
              <p>Campus, Building, Room, Capacity</p>
              <small style={{ color: '#64748b', marginTop: '8px', display: 'block' }}>
                <FileSpreadsheet size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                Example: Main Campus, Building A, Room 101, 30
              </small>
              <div style={{ marginTop: '8px', padding: '8px', background: '#fef3c7', borderRadius: '4px', fontSize: '12px' }}>
                <AlertTriangle size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px', color: '#d97706' }} />
                <strong style={{ color: '#92400e' }}>Important:</strong> <span style={{ color: '#2e2a28ff' }}>The file will be validated immediately upon selection. Only files with correct headers will be accepted.</span>
              </div>
            </div>

            <div className={styles['form-group']}>
              <label className={styles['label']}>
                <Building2 size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                School Name (e.g., State University)
                <input
                  type="text"
                  value={campusSchoolName}
                  onChange={(e) => setCampusSchoolName(e.target.value)}
                  className={styles['input']}
                  placeholder="e.g., State University"
                  required
                />
              </label>
              <small style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
                This name will be used to identify your institution
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
              {campusLoading ? 'Uploading...' : 'Upload Campus CSV'}
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

          {/* Participant CSV Section */}
          <div className={styles['upload-card']}>
            <h2 className={styles['section-title']}>
              <Users size={28} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '10px' }} />
              Participants
            </h2>
            
            <div className={styles['format-info']}>
              <h3>
                <Info size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                Expected CSV Format:
              </h3>
              <p>Participant Number, Name, PWD, Email, Province, City, Country</p>
              <small style={{ color: '#64748b', marginTop: '8px', display: 'block' }}>
                <FileSpreadsheet size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                Example: 2024001, John Doe, No, john@email.com, Metro Manila, Manila, Philippines
              </small>
              <div style={{ marginTop: '8px', padding: '8px', background: '#dbeafe', borderRadius: '4px', fontSize: '12px' }}>
                <Info size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px', color: '#2563eb' }} />
                <strong style={{ color: '#1e40af' }}>Note:</strong> <span style={{ color: '#1e3a8a' }}>PWD column accepts both "PWD" and "PWD (Yes/No)" formats.</span>
              </div>
              <div style={{ marginTop: '8px', padding: '8px', background: '#fef3c7', borderRadius: '4px', fontSize: '12px' }}>
                <AlertTriangle size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px', color: '#d97706' }} />
                <strong style={{ color: '#92400e' }}>Important:</strong> <span style={{ color: '#2e2a28ff' }}>The file will be validated immediately upon selection. Only files with correct headers will be accepted.</span>
              </div>
            </div>

            <div className={styles['form-group']}>
              <label className={styles['label']}>
                <Users size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                Batch Name (e.g., Batch 2024-A, First Year Students)
                <input
                  type="text"
                  value={participantBatchName}
                  onChange={(e) => setParticipantBatchName(e.target.value)}
                  className={styles['input']}
                  placeholder="e.g., Batch 2024-A"
                  required
                />
              </label>
              <small style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
                This name will help you identify this group of participants
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
              {participantLoading ? 'Uploading...' : 'Upload Participant CSV'}
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

          {/* Skip Button */}
          <div className={styles['skip-container']}>
            <button onClick={handleSkip} className={styles['skip-button']}>
              Skip
              <ArrowRight size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: '8px' }} />
            </button>
          </div>
        </div>
      </main>

      <div className={styles.featuresGrid}>
        {features.map((feature, index) => (
          <div 
            key={index} 
            className={styles.featureCard}
            onClick={feature.action}
          >
            <div className={styles.featureIcon}>
              {feature.icon}
            </div>
            <h3 className={styles.featureTitle}>{feature.title}</h3>
            <p className={styles.featureDescription}>{feature.description}</p>
          </div>
        ))}
      </div>

      <div className={styles.statsSection}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <Users size={32} />
          </div>
          <div className={styles.statContent}>
            <h4 className={styles.statLabel}>Total Participants</h4>
            <p className={styles.statValue}>0</p>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <Calendar size={32} />
          </div>
          <div className={styles.statContent}>
            <h4 className={styles.statLabel}>Schedules Generated</h4>
            <p className={styles.statValue}>0</p>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <BarChart3 size={32} />
          </div>
          <div className={styles.statContent}>
            <h4 className={styles.statLabel}>Campus Locations</h4>
            <p className={styles.statValue}>0</p>
          </div>
        </div>
      </div>
    </div>
    
  )
  
}