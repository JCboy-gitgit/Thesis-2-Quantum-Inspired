'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import { 
  Calendar, 
  FileText, 
  Users, 
  Eye, 
  Sparkles,
  FolderOpen,
  Clock,
  Hash,
  Plus,
  Building2
} from 'lucide-react'
import './styles.css'

interface CampusFile {
  upload_group_id: number
  school_name: string
  file_name: string
  created_at: string
  row_count: number
}

interface ParticipantFile {
  upload_group_id: number
  batch_name: string
  file_name: string
  created_at: string
  row_count: number
}

// Helper function to fetch ALL rows (bypass 1000 limit)
async function fetchAllRows(table: string, selectFields: string = '*') {
  const PAGE_SIZE = 1000
  let allData: any[] = []
  let page = 0
  let hasMore = true

  while (hasMore) {
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    const { data, error } = await supabase
      .from(table)
      .select(selectFields)
      .range(from, to)
      .order('created_at', { ascending: false })

    if (error) throw error
    if (!data || data.length === 0) {
      hasMore = false
      break
    }

    allData = [...allData, ...data]
    
    if (data.length < PAGE_SIZE) {
      hasMore = false
    }
    
    page++
  }

  return allData
}

export default function QtimeHomePage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [campusFiles, setCampusFiles] = useState<CampusFile[]>([])
  const [participantFiles, setParticipantFiles] = useState<ParticipantFile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUploadedFiles()
  }, [])

  const fetchUploadedFiles = async () => {
    setLoading(true)
    try {
      console.log('📂 Fetching ALL campus files...')
      const campusData = await fetchAllRows('campuses', 'upload_group_id, school_name, file_name, created_at')
      console.log('✅ Campus data fetched:', campusData.length, 'rows')

      console.log('📂 Fetching ALL participant files...')
      const participantData = await fetchAllRows('participants', 'upload_group_id, batch_name, file_name, created_at')
      console.log('✅ Participant data fetched:', participantData.length, 'rows')

      // Group campus files by upload_group_id
      const campusGrouped = campusData.reduce((acc: any[], curr) => {
        const existing = acc.find(item => item.upload_group_id === curr.upload_group_id)
        if (existing) {
          existing.row_count++
        } else {
          acc.push({
            upload_group_id: curr.upload_group_id,
            school_name: curr.school_name,
            file_name: curr.file_name,
            created_at: curr.created_at,
            row_count: 1
          })
        }
        return acc
      }, [])

      // Group participant files by upload_group_id
      const participantGrouped = participantData.reduce((acc: any[], curr) => {
        const existing = acc.find(item => item.upload_group_id === curr.upload_group_id)
        if (existing) {
          existing.row_count++
        } else {
          acc.push({
            upload_group_id: curr.upload_group_id,
            batch_name: curr.batch_name,
            file_name: curr.file_name,
            created_at: curr.created_at,
            row_count: 1
          })
        }
        return acc
      }, [])

      setCampusFiles(campusGrouped || [])
      setParticipantFiles(participantGrouped || [])
      
      console.log('✅ Files grouped successfully')
      console.log('Campus groups:', campusGrouped)
      console.log('Participant groups:', participantGrouped)
    } catch (err: any) {
      console.error('❌ Error fetching files:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateSchedule = () => {
    router.push('/LandingPages/GenerateSchedule')
  }

  const handleGenerateCampusUI = (groupId: number) => {
    router.push(`/LandingPages/SchoolCapacity?id=${groupId}`)
  }

  const handleGenerateParticipantUI = (groupId: number) => {
    router.push(`/LandingPages/QtimeParticipantsPage?id=${groupId}`)
  }

  return (
    <div className="qtime-layout">
      <MenuBar 
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
        showSidebarToggle={true}
        showAccountIcon={true}
      />
      <Sidebar isOpen={sidebarOpen} />
      
      <main className={`qtime-main ${sidebarOpen ? 'with-sidebar' : 'full-width'}`}>
        <div className="qtime-container">
          <div className="welcome-section">
            <h1 className="page-title">
              <Calendar size={36} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '12px' }} />
              Welcome to Qtime Scheduler
            </h1>
            <p className="page-subtitle">Manage your schedules, campuses, and participants efficiently</p>
          </div>

          {loading ? (
            <div
              className="simple-loading"
              style={{ padding: 40, textAlign: 'center', fontSize: 18, color: '#444' }}
              aria-busy="true"
              aria-live="polite"
            >
              Loading...
            </div>
          ) : (
            <>
              {/* Check if files exist */}
              {campusFiles.length === 0 && participantFiles.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">
                    <FolderOpen size={80} />
                  </div>
                  <h2>No CSV Files Uploaded Yet</h2>
                  <p>Start by uploading your campus and participant CSV files</p>
                  <button 
                    className="primary-button"
                    onClick={() => router.push('/LandingPages/BeforeQtimeHomePage')}
                  >
                    <Plus size={24} />
                    Upload CSV Files
                  </button>
                </div>
              ) : (
                <div className="files-grid">
                  {/* Campus Files Section */}
                  {campusFiles.length > 0 && (
                    <div className="file-section">
                      <h2 className="section-title">
                        <Building2 size={24} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
                        Campus Capacity Files
                      </h2>
                      <div className="file-cards">
                        {campusFiles.map((file) => (
                          <div key={file.upload_group_id} className="file-card">
                            <div className="file-card-header">
                              <div className="file-icon">
                                <Building2 size={32} />
                              </div>
                              <span className="file-id">
                                <Hash size={12} style={{ display: 'inline-block', verticalAlign: 'middle' }} />
                                {file.upload_group_id}
                              </span>
                            </div>
                            <h3 className="file-name">{file.school_name}</h3>
                            <p className="file-details">{file.file_name}</p>
                            <p className="file-meta">
                              <Building2 size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                              {file.row_count} rooms
                            </p>
                            <p className="file-date">
                              <Clock size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                              {new Date(file.created_at).toLocaleDateString()}
                            </p>
                            <button 
                              className="view-button"
                              onClick={() => handleGenerateCampusUI(file.upload_group_id)}
                            >
                              <Eye size={20} />
                              View Details
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Participant Files Section */}
                  {participantFiles.length > 0 && (
                    <div className="file-section">
                      <h2 className="section-title">
                        <Users size={24} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
                        Participant Files
                      </h2>
                      <div className="file-cards">
                        {participantFiles.map((file) => (
                          <div key={file.upload_group_id} className="file-card">
                            <div className="file-card-header">
                              <div className="file-icon">
                                <Users size={32} />
                              </div>
                              <span className="file-id">
                                <Hash size={12} style={{ display: 'inline-block', verticalAlign: 'middle' }} />
                                {file.upload_group_id}
                              </span>
                            </div>
                            <h3 className="file-name">{file.batch_name}</h3>
                            <p className="file-details">{file.file_name}</p>
                            <p className="file-meta">
                              <Users size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                              {file.row_count} participants
                            </p>
                            <p className="file-date">
                              <Clock size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                              {new Date(file.created_at).toLocaleDateString()}
                            </p>
                            <button 
                              className="view-button"
                              onClick={() => handleGenerateParticipantUI(file.upload_group_id)}
                            >
                              <Eye size={20} />
                              View Details
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Generate Schedule Button */}
              {campusFiles.length > 0 && participantFiles.length > 0 && (
                <div className="action-section">
                  <button 
                    className="generate-schedule-button"
                    onClick={handleGenerateSchedule}
                  >
                    <Sparkles size={24} />
                    Generate Schedule
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}