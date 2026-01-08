'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import MenuBar from '@/app/components/MenuBar';
import Sidebar from '@/app/components/Sidebar';
import { 
  Users, 
  ArrowLeft, 
  Search, 
  FolderOpen, 
  Calendar,
  UserPlus,
  Edit2,
  Trash2,
  Settings,
  Check,
  X,
  BarChart3,
  Accessibility,
  Mail,
  MapPin,
  AlertTriangle
} from 'lucide-react';
import './styles.css';

interface ParticipantFile {
  upload_group_id: number
  batch_name: string
  file_name: string
  created_at: string
  row_count: number
}

interface Participant {
  id?: number
  participant_number: string
  name: string
  is_pwd: boolean
  email: string
  province: string
  city: string
  country: string
  upload_group_id?: number
  file_name?: string
}

interface ParticipantStats {
  totalParticipants: number
  totalPWD: number
  percentagePWD: number
}

// Helper function to fetch ALL rows (bypass 1000 limit) - FIXED for tables without created_at
async function fetchAllRows(table: string, filters: any = {}, orderBy: string = 'id') {
  const PAGE_SIZE = 1000
  let allData: any[] = []
  let page = 0
  let hasMore = true

  console.log(`🔄 Starting pagination for table: ${table}, filters:`, filters)

  while (hasMore) {
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    console.log(`   📄 Fetching page ${page + 1}: rows ${from}-${to}`)

    let query = supabase
      .from(table)
      .select('*')
      .range(from, to)
      .order(orderBy, { ascending: true })

    // Apply filters
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value)
    }

    const { data, error } = await query

    if (error) {
      console.error(`❌ Error on page ${page + 1}:`, error)
      throw error
    }
    
    if (!data || data.length === 0) {
      console.log(`   ✅ No more data on page ${page + 1}`)
      hasMore = false
      break
    }

    console.log(`   ✅ Fetched ${data.length} rows on page ${page + 1}`)
    allData = [...allData, ...data]
    
    if (data.length < PAGE_SIZE) {
      console.log(`   ✅ Last page reached (${data.length} < ${PAGE_SIZE})`)
      hasMore = false
    }
    
    page++
  }

  console.log(`✅ Total rows fetched from ${table}: ${allData.length}`)
  return allData
}

// Helper function to delete in batches (bypass 1000 limit)
async function deleteInBatches(table: string, ids: number[], batchSize: number = 1000) {
  console.log(`🗑️ Deleting ${ids.length} rows from ${table} in batches of ${batchSize}`)
  
  let deletedCount = 0
  
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize)
    console.log(`   🗑️ Deleting batch ${Math.floor(i / batchSize) + 1}: ${batch.length} rows`)
    
    const { error } = await supabase
      .from(table)
      .delete()
      .in('id', batch)
    
    if (error) {
      console.error(`❌ Error deleting batch:`, error)
      throw error
    }
    
    deletedCount += batch.length
    console.log(`   ✅ Deleted ${deletedCount}/${ids.length} rows`)
  }
  
  console.log(`✅ Successfully deleted all ${deletedCount} rows from ${table}`)
  return deletedCount
}

function QtimeParticipantsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const groupIdFromUrl = searchParams.get('id')
  const campus = searchParams.get('campus') || '';

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [participantFiles, setParticipantFiles] = useState<ParticipantFile[]>([])
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null)
  const [participantData, setParticipantData] = useState<Participant[]>([])
  const [filteredData, setFilteredData] = useState<Participant[]>([])
  const [stats, setStats] = useState<ParticipantStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [dataSearchTerm, setDataSearchTerm] = useState('')
  
  // CRUD states
  const [showActionsFor, setShowActionsFor] = useState<number | null>(null)
  const [editingParticipant, setEditingParticipant] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<Participant>({
    participant_number: '',
    name: '',
    is_pwd: false,
    email: '',
    province: '',
    city: '',
    country: 'Philippines'
  })
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState<Participant>({
    participant_number: '',
    name: '',
    is_pwd: false,
    email: '',
    province: '',
    city: '',
    country: 'Philippines'
  })
  const [deletingParticipant, setDeletingParticipant] = useState<number | null>(null)
  const [successMessage, setSuccessMessage] = useState('')
  
  // Delete batch states
  const [showDeleteBatchModal, setShowDeleteBatchModal] = useState(false)
  const [batchToDelete, setBatchToDelete] = useState<ParticipantFile | null>(null)
  const [deletingBatch, setDeletingBatch] = useState(false)

  useEffect(() => {
    fetchParticipantFiles()
  }, [])

  useEffect(() => {
    // Auto-select batch if ID is provided in URL
    if (groupIdFromUrl && participantFiles.length > 0) {
      const groupId = parseInt(groupIdFromUrl)
      const fileExists = participantFiles.find(f => f.upload_group_id === groupId)
      if (fileExists && selectedBatch !== groupId) {
        handleSelectBatch(groupId)
      }
    }
  }, [groupIdFromUrl, participantFiles])

  useEffect(() => {
    if (dataSearchTerm) {
      const filtered = participantData.filter(p => 
        p.participant_number.toLowerCase().includes(dataSearchTerm.toLowerCase()) ||
        p.name.toLowerCase().includes(dataSearchTerm.toLowerCase()) ||
        p.email.toLowerCase().includes(dataSearchTerm.toLowerCase())
      )
      setFilteredData(filtered)
    } else {
      setFilteredData(participantData)
    }
  }, [dataSearchTerm, participantData])

  const fetchParticipantFiles = async () => {
    setLoading(true)
    try {
      console.log('📂 Fetching participant files...')
      
      const allData = await fetchAllRows('participants', {}, 'created_at')

      console.log('✅ Participant data fetched:', allData.length, 'rows')

      const grouped = allData.reduce((acc: any[], curr) => {
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

      grouped.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      setParticipantFiles(grouped || [])
    } catch (error) {
      console.error('❌ Error fetching participant files:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectBatch = async (groupId: number) => {
    if (selectedBatch === groupId) {
      setSelectedBatch(null)
      setParticipantData([])
      setFilteredData([])
      setStats(null)
      setDataSearchTerm('')
      return
    }

    setSelectedBatch(groupId)
    setLoadingData(true)
    setDataSearchTerm('')
    
    try {
      console.log(`📥 Fetching ALL participants for group ${groupId}...`)
      
      const allData = await fetchAllRows('participants', { upload_group_id: groupId }, 'id')
      
      allData.sort((a, b) => {
        const numA = parseInt(a.participant_number) || 0
        const numB = parseInt(b.participant_number) || 0
        return numA - numB
      })

      console.log(`✅ Loaded ${allData.length} participants for group ${groupId}`)

      setParticipantData(allData)
      setFilteredData(allData)
      calculateStats(allData)
    } catch (error) {
      console.error('❌ Error fetching participant data:', error)
    } finally {
      setLoadingData(false)
    }
  }

  const calculateStats = (data: Participant[]) => {
    const totalParticipants = data.length
    const totalPWD = data.filter(p => p.is_pwd).length
    const percentagePWD = totalParticipants > 0 ? Math.round((totalPWD / totalParticipants) * 100) : 0

    setStats({
      totalParticipants,
      totalPWD,
      percentagePWD
    })
  }

  // Delete Batch Function - WITH CASCADE DELETE IN BATCHES (FIXED)
  const handleDeleteBatchClick = (e: React.MouseEvent, batch: ParticipantFile) => {
    e.stopPropagation()
    setBatchToDelete(batch)
    setShowDeleteBatchModal(true)
  }

  const handleDeleteBatch = async () => {
    if (!batchToDelete) return

    setDeletingBatch(true)
    try {
      console.log(`🗑️ Deleting batch ${batchToDelete.upload_group_id}...`)

      // Step 1: Fetch all participants with this upload_group_id to get their IDs
      console.log(`📥 Fetching all participants for batch ${batchToDelete.upload_group_id}...`)
      const participantsToDelete = await fetchAllRows('participants', { upload_group_id: batchToDelete.upload_group_id }, 'id')

      if (!participantsToDelete || participantsToDelete.length === 0) {
        console.log('⚠️ No participants found for this batch')
        setSuccessMessage('⚠️ No participants found in this batch')
        setTimeout(() => setSuccessMessage(''), 3000)
        setShowDeleteBatchModal(false)
        setBatchToDelete(null)
        setDeletingBatch(false)
        return
      }

      console.log(`📊 Found ${participantsToDelete.length} participants to delete`)
      const participantIds = participantsToDelete.map(p => p.id)

      // Step 2: Delete related schedule_assignments in batches (CASCADE)
      console.log(`🗑️ Deleting related schedule assignments...`)
      try {
        // Fetch all schedule assignments for these participants - use 'id' for ordering
        const assignmentsToDelete = await fetchAllRows('schedule_assignments', {}, 'id')
        const relevantAssignments = assignmentsToDelete.filter(a => participantIds.includes(a.participant_id))
        
        if (relevantAssignments.length > 0) {
          const assignmentIds = relevantAssignments.map(a => a.id)
          await deleteInBatches('schedule_assignments', assignmentIds)
          console.log(`✅ Deleted ${assignmentIds.length} schedule assignments`)
        } else {
          console.log(`ℹ️ No schedule assignments found for these participants`)
        }
      } catch (error: any) {
        console.error('❌ Error deleting schedule assignments:', error)
        throw new Error(`Failed to delete schedule assignments: ${error.message}`)
      }

      // Step 3: Delete related schedules in batches (if any exist in the schedules table)
      console.log(`🗑️ Deleting related schedules...`)
      try {
        // Fetch all schedules for these participants - use 'created_at' for ordering
        const schedulesToDelete = await fetchAllRows('schedules', {}, 'created_at')
        const relevantSchedules = schedulesToDelete.filter(s => s.participant_id && participantIds.includes(s.participant_id))
        
        if (relevantSchedules.length > 0) {
          const scheduleIds = relevantSchedules.map(s => s.id)
          await deleteInBatches('schedules', scheduleIds)
          console.log(`✅ Deleted ${scheduleIds.length} schedules`)
        } else {
          console.log(`ℹ️ No schedules found for these participants`)
        }
      } catch (error: any) {
        console.error('❌ Error deleting schedules:', error)
        throw new Error(`Failed to delete schedules: ${error.message}`)
      }

      // Step 4: Now delete the participants in batches
      console.log(`🗑️ Deleting ${participantIds.length} participants...`)
      await deleteInBatches('participants', participantIds)
      console.log(`✅ Successfully deleted ${participantIds.length} participants and their related data`)

      // If the deleted batch was selected, clear selection
      if (selectedBatch === batchToDelete.upload_group_id) {
        setSelectedBatch(null)
        setParticipantData([])
        setFilteredData([])
        setStats(null)
      }

      // Refresh the batch list
      await fetchParticipantFiles()

      setSuccessMessage(`✅ Batch "${batchToDelete.batch_name}" with ${participantIds.length} participants deleted successfully!`)
      setTimeout(() => setSuccessMessage(''), 3000)
      
      setShowDeleteBatchModal(false)
      setBatchToDelete(null)
    } catch (error: any) {
      console.error('❌ Error deleting batch:', error)
      const errorMessage = error?.message || 'Unknown error occurred'
      setSuccessMessage(`❌ Failed to delete batch: ${errorMessage}`)
      setTimeout(() => setSuccessMessage(''), 5000)
    } finally {
      setDeletingBatch(false)
    }
  }

  // Single Participant Delete - WITH CASCADE
  const handleDelete = async (participantId: number) => {
    if (!confirm('Are you sure you want to delete this participant? This will also delete all their schedule assignments.')) return

    setDeletingParticipant(participantId)
    setShowActionsFor(null)
    try {
      console.log(`🗑️ Deleting participant ${participantId}...`)

      // Step 1: Delete related schedule_assignments
      const { error: assignmentError } = await supabase
        .from('schedule_assignments')
        .delete()
        .eq('participant_id', participantId)

      if (assignmentError) {
        console.error('❌ Error deleting schedule assignments:', assignmentError)
        throw new Error(`Failed to delete schedule assignments: ${assignmentError.message}`)
      }

      // Step 2: Delete related schedules
      const { error: schedulesError } = await supabase
        .from('schedules')
        .delete()
        .eq('participant_id', participantId)

      if (schedulesError) {
        console.error('❌ Error deleting schedules:', schedulesError)
        throw new Error(`Failed to delete schedules: ${schedulesError.message}`)
      }

      // Step 3: Delete the participant
      const { error } = await supabase
        .from('participants')
        .delete()
        .eq('id', participantId)

      if (error) throw error

      const updatedData = participantData.filter(p => p.id !== participantId)
      setParticipantData(updatedData)
      calculateStats(updatedData)
      setSuccessMessage('✅ Participant deleted successfully!')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      console.error('❌ Error deleting participant:', error)
      const errorMessage = error?.message || 'Unknown error occurred'
      setSuccessMessage(`❌ Failed to delete participant: ${errorMessage}`)
      setTimeout(() => setSuccessMessage(''), 5000)
    } finally {
      setDeletingParticipant(null)
    }
  }

  const getFilteredFiles = () => {
    if (!searchTerm) return participantFiles
    return participantFiles.filter(file => 
      file.batch_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.file_name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }

  const toggleActionsMenu = (participantId: number) => {
    setShowActionsFor(showActionsFor === participantId ? null : participantId)
  }

  const handleAddParticipant = async () => {
    if (!addForm.participant_number || !addForm.name || !addForm.email) {
      setSuccessMessage('❌ Please fill in all required fields')
      setTimeout(() => setSuccessMessage(''), 3000)
      return
    }

    try {
      const selectedFile = participantFiles.find(f => f.upload_group_id === selectedBatch)
      
      const { data, error } = await supabase
        .from('participants')
        .insert({
          participant_number: addForm.participant_number,
          name: addForm.name,
          is_pwd: addForm.is_pwd,
          email: addForm.email,
          province: addForm.province,
          city: addForm.city,
          country: addForm.country,
          upload_group_id: selectedBatch,
          batch_name: selectedFile?.batch_name || '',
          file_name: selectedFile?.file_name || ''
        })
        .select()
        .single()

      if (error) throw error

      const updatedData = [...participantData, data]
      setParticipantData(updatedData)
      calculateStats(updatedData)
      setShowAddModal(false)
      setAddForm({
        participant_number: '',
        name: '',
        is_pwd: false,
        email: '',
        province: '',
        city: '',
        country: 'Philippines'
      })
      setSuccessMessage('✅ Participant added successfully!')
      setTimeout(() => setSuccessMessage(''), 3000)
      
      await fetchParticipantFiles()
    } catch (error: any) {
      console.error('❌ Error adding participant:', error)
      setSuccessMessage(`❌ Failed to add participant: ${error?.message || 'Unknown error'}`)
      setTimeout(() => setSuccessMessage(''), 5000)
    }
  }

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
  const paginatedData = filteredData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="participants-layout">
      <MenuBar 
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
        showSidebarToggle={true}
        showAccountIcon={true}
      />
      <Sidebar isOpen={sidebarOpen} />
      
      <main className={`participants-main ${sidebarOpen ? 'with-sidebar' : 'full-width'}`}>
        <div className="data-section">
          {/* Success Message */}
          {successMessage && (
            <div className={`success-message ${successMessage.includes('❌') || successMessage.includes('⚠️') ? 'error' : 'success'}`}>
              {successMessage}
            </div>
          )}

          <div className="participants-header">
            <button 
              className="back-button"
              onClick={() => router.push('/LandingPages/QtimeHomePage')}
              >
              <ArrowLeft size={18} />
              Back to Home
            </button>
            <div className="header-title-section">
              <div className="header-icon-wrapper">
                <Users className="header-large-icon" size={48} />
              </div>
              <div className="header-text">
                <h1 className="participants-title">Participants Overview</h1>
                <p className="participants-subtitle">Select a batch to view and manage participant information</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading participant data...</p>
            </div>
          ) : (
            <>
              <div className="selection-section">
                <div className="search-header">
                  <h2>
                    <FolderOpen size={24} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
                    Select Batch
                  </h2>
                  <div className="search-box">
                    <Search className="search-icon" size={18} />
                    <input
                      type="text"
                      placeholder="Search batch..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="search-input"
                    />
                  </div>
                </div>

                <div className="batch-cards-grid">
                  {getFilteredFiles().map(file => (
                    <div 
                      key={file.upload_group_id}
                      className={`batch-select-card ${selectedBatch === file.upload_group_id ? 'selected' : ''}`}
                      onClick={() => handleSelectBatch(file.upload_group_id)}
                    >
                      <div className="batch-card-icon">
                        <FolderOpen size={36} />
                      </div>
                      <div className="batch-card-content">
                        <h3 className="batch-card-name">{file.batch_name}</h3>
                        <p className="batch-card-meta">
                          <Users size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                          {file.row_count} participants
                        </p>
                        <p className="batch-card-date">
                          <Calendar size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                          Uploaded: {new Date(file.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {selectedBatch === file.upload_group_id && (
                        <div className="selected-indicator">
                          <Check size={20} />
                        </div>
                      )}
                      <button
                        className="delete-batch-btn"
                        onClick={(e) => handleDeleteBatchClick(e, file)}
                        title="Delete entire batch"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>

                {getFilteredFiles().length === 0 && (
                  <div className="empty-results">
                    <p>No batches found matching "{searchTerm}"</p>
                  </div>
                )}
              </div>

              {selectedBatch && (
                <>
                  {loadingData ? (
                    <div className="loading-state">
                      <div className="spinner"></div>
                      <p>Loading participant data...</p>
                    </div>
                  ) : (
                    <>
                      {stats && (
                        <div className="stats-grid">
                          <div className="stat-card">
                            <div className="stat-icon">
                              <Users size={28} />
                            </div>
                            <div className="stat-content">
                              <p className="stat-label">Total Participants</p>
                              <h3 className="stat-value">{stats.totalParticipants}</h3>
                            </div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-icon">
                              <Accessibility size={28} />
                            </div>
                            <div className="stat-content">
                              <p className="stat-label">PWD Participants</p>
                              <h3 className="stat-value">{stats.totalPWD}</h3>
                            </div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-icon">
                              <BarChart3 size={28} />
                            </div>
                            <div className="stat-content">
                              <p className="stat-label">PWD Percentage</p>
                              <h3 className="stat-value">{stats.percentagePWD}%</h3>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="data-section">
                        <div className="section-header-actions">
                          <h2 className="section-heading">
                            <Users size={24} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
                            Participants List
                          </h2>
                          <div className="header-actions">
                            <div className="search-box">
                              <Search className="search-icon" size={18} />
                              <input
                                type="text"
                                placeholder="Search by name, number, or email..."
                                value={dataSearchTerm}
                                onChange={(e) => setDataSearchTerm(e.target.value)}
                                className="search-input"
                              />
                            </div>
                            <button 
                              className="add-participant-button"
                              onClick={() => setShowAddModal(true)}
                            >
                              <UserPlus size={20} />
                              Add Participant
                            </button>
                          </div>
                        </div>
                        
                        <div className="participants-table-wrapper">
                          <table className="participants-table">
                            <thead>
                              <tr>
                                <th>Participant #</th>
                                <th>Name</th>
                                <th>PWD</th>
                                <th>Email</th>
                                <th>Province</th>
                                <th>City</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedData.map((participant) => {
                                const isEditing = editingParticipant === participant.id
                                const showActions = showActionsFor === participant.id
                                
                                const handleEditSave = async (participantId: number) => {
                                  try {
                                    const { error } = await supabase
                                      .from('participants')
                                      .update({
                                        participant_number: editForm.participant_number,
                                        name: editForm.name,
                                        is_pwd: editForm.is_pwd,
                                        email: editForm.email,
                                        province: editForm.province,
                                        city: editForm.city,
                                        country: editForm.country
                                      })
                                      .eq('id', participantId)

                                    if (error) throw error

                                    const updatedData = participantData.map(p => 
                                      p.id === participantId ? { ...p, ...editForm } : p
                                    )
                                    setParticipantData(updatedData)
                                    calculateStats(updatedData)
                                    setEditingParticipant(null)
                                    setSuccessMessage('✅ Participant updated successfully!')
                                    setTimeout(() => setSuccessMessage(''), 3000)
                                  } catch (error: any) {
                                    console.error('❌ Error updating participant:', error)
                                    setSuccessMessage(`❌ Failed to update participant: ${error?.message || 'Unknown error'}`)
                                    setTimeout(() => setSuccessMessage(''), 5000)
                                  }
                                }

                                const handleEditCancel = () => {
                                  setEditingParticipant(null)
                                  setEditForm({
                                    participant_number: '',
                                    name: '',
                                    is_pwd: false,
                                    email: '',
                                    province: '',
                                    city: '',
                                    country: 'Philippines'
                                  })
                                }

                                const handleEditClick = (participant: Participant) => {
                                  setEditingParticipant(participant.id!)
                                  setEditForm({
                                    participant_number: participant.participant_number,
                                    name: participant.name,
                                    is_pwd: participant.is_pwd,
                                    email: participant.email,
                                    province: participant.province,
                                    city: participant.city,
                                    country: participant.country
                                  })
                                  setShowActionsFor(null)
                                }

                                const handleAddParticipant = async () => {
                                  if (!addForm.participant_number || !addForm.name || !addForm.email) {
                                    setSuccessMessage('❌ Please fill in all required fields')
                                    setTimeout(() => setSuccessMessage(''), 3000)
                                    return
                                  }

                                  try {
                                    const selectedFile = participantFiles.find(f => f.upload_group_id === selectedBatch)
                                    
                                    const { data, error } = await supabase
                                      .from('participants')
                                      .insert({
                                        participant_number: addForm.participant_number,
                                        name: addForm.name,
                                        is_pwd: addForm.is_pwd,
                                        email: addForm.email,
                                        province: addForm.province,
                                        city: addForm.city,
                                        country: addForm.country,
                                        upload_group_id: selectedBatch,
                                        batch_name: selectedFile?.batch_name || '',
                                        file_name: selectedFile?.file_name || ''
                                      })
                                      .select()
                                      .single()

                                    if (error) throw error

                                    const updatedData = [...participantData, data]
                                    setParticipantData(updatedData)
                                    calculateStats(updatedData)
                                    setShowAddModal(false)
                                    setAddForm({
                                      participant_number: '',
                                      name: '',
                                      is_pwd: false,
                                      email: '',
                                      province: '',
                                      city: '',
                                      country: 'Philippines'
                                    })
                                    setSuccessMessage('✅ Participant added successfully!')
                                    setTimeout(() => setSuccessMessage(''), 3000)
                                    
                                    await fetchParticipantFiles()
                                  } catch (error: any) {
                                    console.error('❌ Error adding participant:', error)
                                    setSuccessMessage(`❌ Failed to add participant: ${error?.message || 'Unknown error'}`)
                                    setTimeout(() => setSuccessMessage(''), 5000)
                                  }
                                }

                                return (
                                  <tr key={participant.id} className={isEditing ? 'editing-row' : ''}>
                                    {isEditing ? (
                                      <>
                                        <td>
                                          <input
                                            type="text"
                                            value={editForm.participant_number}
                                            onChange={(e) => setEditForm({...editForm, participant_number: e.target.value})}
                                            className="table-input"
                                          />
                                        </td>
                                        <td>
                                          <input
                                            type="text"
                                            value={editForm.name}
                                            onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                                            className="table-input"
                                          />
                                        </td>
                                        <td>
                                          <label className="pwd-checkbox">
                                            <input
                                              type="checkbox"
                                              checked={editForm.is_pwd}
                                              onChange={(e) => setEditForm({...editForm, is_pwd: e.target.checked})}
                                            />
                                            <span>{editForm.is_pwd ? 'Yes' : 'No'}</span>
                                          </label>
                                        </td>
                                        <td>
                                          <input
                                            type="email"
                                            value={editForm.email}
                                            onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                                            className="table-input"
                                          />
                                        </td>
                                        <td>
                                          <input
                                            type="text"
                                            value={editForm.province}
                                            onChange={(e) => setEditForm({...editForm, province: e.target.value})}
                                            className="table-input"
                                          />
                                        </td>
                                        <td>
                                          <input
                                            type="text"
                                            value={editForm.city}
                                            onChange={(e) => setEditForm({...editForm, city: e.target.value})}
                                            className="table-input"
                                          />
                                        </td>
                                        <td>
                                          <div className="table-actions">
                                            <button 
                                              className="save-btn-inline"
                                              onClick={() => handleEditSave(participant.id!)}
                                              title="Save changes"
                                            >
                                              <Check size={16} />
                                            </button>
                                            <button 
                                              className="cancel-btn-inline"
                                              onClick={handleEditCancel}
                                              title="Cancel editing"
                                            >
                                              <X size={16} />
                                            </button>
                                          </div>
                                        </td>
                                      </>
                                    ) : (
                                      <>
                                        <td>{participant.participant_number}</td>
                                        <td>{participant.name}</td>
                                        <td>
                                          <span className={`pwd-badge ${participant.is_pwd ? 'pwd-yes' : 'pwd-no'}`}>
                                            {participant.is_pwd ? (
                                              <>
                                                <Accessibility size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                                                Yes
                                              </>
                                            ) : 'No'}
                                          </span>
                                        </td>
                                        <td>{participant.email}</td>
                                        <td>{participant.province}</td>
                                        <td>{participant.city}</td>
                                        <td>
                                          <div className="table-options">
                                            <button 
                                              className="options-trigger-table"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                toggleActionsMenu(participant.id!)
                                              }}
                                              title="More options"
                                            >
                                              <Settings size={18} />
                                            </button>
                                            
                                            {showActions && (
                                              <div className="actions-popup-table">
                                                <button 
                                                  className="action-option edit-option"
                                                  onClick={() => handleEditClick(participant)}
                                                >
                                                  <Edit2 size={16} />
                                                  Edit
                                                </button>
                                                <button 
                                                  className="action-option delete-option"
                                                  onClick={() => handleDelete(participant.id!)}
                                                  disabled={deletingParticipant === participant.id}
                                                >
                                                  <Trash2 size={16} />
                                                  {deletingParticipant === participant.id ? 'Deleting...' : 'Delete'}
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        </td>
                                      </>
                                    )}
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                        {/* Pagination Controls should be here */}
                        {totalPages > 1 && (
                          <div className="pagination-wrapper">
                            <button
                              className="pagination-btn"
                              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                              disabled={currentPage === 1}
                            >
                              &lt; Prev
                            </button>
                            {totalPages <= 10
                              ? Array.from({ length: totalPages }, (_, i) => (
                                  <button
                                    key={i + 1}
                                    className={`pagination-btn${currentPage === i + 1 ? ' active-page' : ''}`}
                                    onClick={() => setCurrentPage(i + 1)}
                                  >
                                    {i + 1}
                                  </button>
                                ))
                              : (() => {
                                  const pages = [];
                                  if (currentPage > 3) {
                                    pages.push(
                                      <button key={1} className={`pagination-btn${currentPage === 1 ? ' active-page' : ''}`} onClick={() => setCurrentPage(1)}>1</button>
                                    );
                                    if (currentPage > 4) pages.push(<span key="start-ellipsis" className="pagination-ellipsis">...</span>);
                                  }
                                  for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
                                    pages.push(
                                      <button key={i} className={`pagination-btn${currentPage === i ? ' active-page' : ''}`} onClick={() => setCurrentPage(i)}>{i}</button>
                                    );
                                  }
                                  if (currentPage < totalPages - 2) {
                                    if (currentPage < totalPages - 3) pages.push(<span key="end-ellipsis" className="pagination-ellipsis">...</span>);
                                    pages.push(
                                      <button key={totalPages} className={`pagination-btn${currentPage === totalPages ? ' active-page' : ''}`} onClick={() => setCurrentPage(totalPages)}>{totalPages}</button>
                                    );
                                  }
                                  return pages;
                                })()
                            }
                            <button
                              className="pagination-btn"
                              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                              disabled={currentPage === totalPages}
                            >
                              Next &gt;
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}

              {!selectedBatch && !loading && participantFiles.length > 0 && (
                <div className="empty-selection">
                  <div className="empty-icon">
                    <Users size={80} />
                  </div>
                  <p>Please select a batch above to view participant details</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Add Participant Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <UserPlus size={24} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
                Add New Participant
              </h3>
              <button 
                className="modal-close"
                onClick={() => setShowAddModal(false)}
                title="Close modal"
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Participant Number * <span className="required-indicator">(Required)</span></label>
                <input
                  type="text"
                  value={addForm.participant_number}
                  onChange={(e) => setAddForm({...addForm, participant_number: e.target.value})}
                  placeholder="e.g., 2024001"
                  className="modal-input"
                />
              </div>
              <div className="form-group">
                <label>Full Name * <span className="required-indicator">(Required)</span></label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm({...addForm, name: e.target.value})}
                  placeholder="e.g., John Doe"
                  className="modal-input"
                />
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={addForm.is_pwd}
                    onChange={(e) => setAddForm({...addForm, is_pwd: e.target.checked})}
                  />
                  <Accessibility size={20} style={{ marginLeft: '4px', marginRight: '4px' }} />
                  <span>Person with Disability (PWD)</span>
                </label>
              </div>
              <div className="form-group">
                <label>
                  <Mail size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                  Email * <span className="required-indicator">(Required)</span>
                </label>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm({...addForm, email: e.target.value})}
                  placeholder="e.g., john@email.com"
                  className="modal-input"
                />
              </div>
              <div className="form-group">
                <label>
                  <MapPin size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                  Province
                </label>
                <input
                  type="text"
                  value={addForm.province}
                  onChange={(e) => setAddForm({...addForm, province: e.target.value})}
                  placeholder="e.g., Metro Manila"
                  className="modal-input"
                />
              </div>
              <div className="form-group">
                <label>
                  <MapPin size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                  City
                </label>
                <input
                  type="text"
                  value={addForm.city}
                  onChange={(e) => setAddForm({...addForm, city: e.target.value})}
                  placeholder="e.g., Manila"
                  className="modal-input"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="modal-btn-cancel"
                onClick={() => setShowAddModal(false)}
              >
                <X size={18} />
                Cancel
              </button>
              <button 
                className="modal-btn-save"
                onClick={handleAddParticipant}
              >
                <Check size={18} />
                Add Participant
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Batch Confirmation Modal */}
      {showDeleteBatchModal && batchToDelete && (
        <div className="modal-overlay" onClick={() => !deletingBatch && setShowDeleteBatchModal(false)}>
          <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header delete-header">
              <h3>
                <AlertTriangle size={24} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px', color: '#ef4444' }} />
                Delete Batch
              </h3>
              <button 
                className="modal-close"
                onClick={() => setShowDeleteBatchModal(false)}
                disabled={deletingBatch}
                title="Close modal"
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="delete-warning">
                <div className="warning-icon-wrapper">
                  <AlertTriangle size={64} className="warning-icon" />
                </div>
                <h4>Are you absolutely sure?</h4>
                <p>
                  You are about to permanently delete the batch:
                </p>
                <div className="delete-batch-info">
                  <strong>{batchToDelete.batch_name}</strong>
                  <span>{batchToDelete.row_count} participants</span>
                </div>
                <p className="warning-text">
                  This action <strong>CANNOT BE UNDONE</strong>. All {batchToDelete.row_count} participants in this batch will be permanently removed from the database.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="modal-btn-cancel"
                onClick={() => setShowDeleteBatchModal(false)}
                disabled={deletingBatch}
              >
                <X size={18} />
                Cancel
              </button>
              <button 
                className="modal-btn-delete"
                onClick={handleDeleteBatch}
                disabled={deletingBatch}
              >
                <Trash2 size={18} />
                {deletingBatch ? 'Deleting...' : 'Delete Batch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ✅ Wrap with Suspense and export
export default function QtimeParticipantsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <QtimeParticipantsPageContent />
    </Suspense>
  );
}