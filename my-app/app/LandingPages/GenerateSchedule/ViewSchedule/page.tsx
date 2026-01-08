'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import ScheduleDetailsModal from './ScheduleDetailsModal'
import styles from './ViewSchedule.module.css'
import { 
  FaArrowLeft, 
  FaCalendar, 
  FaClock, 
  FaUsers, 
  FaExclamationTriangle,
  FaTrash,
  FaEye,
  FaInfoCircle
} from 'react-icons/fa'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Schedule {
  id: number
  event_name: string
  event_type: string
  schedule_date: string
  start_time: string
  end_date: string | null
  end_time: string
  scheduled_count: number
  unscheduled_count: number
  created_at: string
}

export default function ViewSchedulePage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    fetchSchedules()
  }, [])

  const fetchSchedules = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('schedule_summary')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setSchedules(data || [])
    } catch (error) {
      console.error('Error fetching schedules:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this schedule? This action cannot be undone.')) {
      return
    }

    try {
      // Delete assignments first (foreign key constraint)
      const { error: assignmentsError } = await supabase
        .from('schedule_assignments')
        .delete()
        .eq('schedule_summary_id', id)

      if (assignmentsError) throw assignmentsError

      // Delete batches
      const { error: batchesError } = await supabase
        .from('schedule_batches')
        .delete()
        .eq('schedule_summary_id', id)

      if (batchesError) throw batchesError

      // Delete summary
      const { error: summaryError } = await supabase
        .from('schedule_summary')
        .delete()
        .eq('id', id)

      if (summaryError) throw summaryError

      // Refresh list
      await fetchSchedules()
      alert('Schedule deleted successfully')
    } catch (error: any) {
      console.error('Error deleting schedule:', error)
      alert(`Failed to delete schedule: ${error.message}`)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatDateRange = (startDate: string, endDate: string | null) => {
    const start = formatDate(startDate)
    if (!endDate || endDate === startDate) return start
    const end = formatDate(endDate)
    return `${start} - ${end}`
  }

  const calculateDuration = (startDate: string, endDate: string | null) => {
    if (!endDate || endDate === startDate) return 1
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    return diffDays
  }

  const handleViewDetails = (scheduleId: number) => {
    setSelectedScheduleId(scheduleId)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedScheduleId(null)
  }

  // ✅ Toggle function for sidebar
  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev)
  }

  return (
    <>
      {/* ✅ Fixed: Pass onToggleSidebar instead of setSidebarOpen */}
      <MenuBar 
        onToggleSidebar={toggleSidebar}
        showSidebarToggle={true}
        showAccountIcon={true}
      />
      
      {/* ✅ Fixed: Pass isOpen instead of sidebarOpen */}
      <Sidebar isOpen={sidebarOpen} />
      
      <main className={`${styles.qtimeMain} ${!sidebarOpen ? styles.fullWidth : ''}`}>
        <div className={styles.qtimeContainer}>
          {/* Header */}
          <div className={styles.pageHeader}>
            <button className={styles.backButton} onClick={() => router.back()}>
              <FaArrowLeft /> Back
            </button>
          </div>

          {/* Welcome Section */}
          <div className={styles.welcomeSection}>
            <h1 className={styles.pageTitle}>View Schedules</h1>
            <p className={styles.pageSubtitle}>
              Browse and manage your generated schedules
            </p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className={styles.loadingState}>
              <div className={styles.spinner}></div>
              <p>Loading schedules...</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && schedules.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <FaCalendar />
              </div>
              <h2>No Schedules Found</h2>
              <p>You haven't created any schedules yet.</p>
              <button 
                className={styles.primaryButton}
                onClick={() => router.push('/LandingPages/GenerateSchedule')}
              >
                Create Schedule
              </button>
            </div>
          )}

          {/* Schedules Grid */}
          {!loading && schedules.length > 0 && (
            <div className={styles.schedulesGrid}>
              {schedules.map((schedule) => (
                <div key={schedule.id} className={styles.scheduleCard}>
                  {/* Delete Button */}
                  <button
                    className={styles.deleteIconButton}
                    onClick={() => handleDelete(schedule.id)}
                    title="Delete Schedule"
                  >
                    <FaTrash />
                  </button>

                  {/* Card Header */}
                  <div className={styles.scheduleCardHeader}>
                    <h3 className={styles.scheduleTitle}>{schedule.event_name}</h3>
                    <span className={styles.statusBadge}>
                      {schedule.event_type.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Info Grid */}
                  <div className={styles.scheduleInfoGrid}>
                    <div className={styles.infoItem}>
                      <FaCalendar className={styles.infoIcon} />
                      <div>
                        <p className={styles.infoLabel}>Date</p>
                        <p className={styles.infoValue}>
                          {formatDateRange(schedule.schedule_date, schedule.end_date)}
                        </p>
                        {schedule.end_date && schedule.end_date !== schedule.schedule_date && (
                          <p className={styles.infoDuration}>
                            {calculateDuration(schedule.schedule_date, schedule.end_date)} days
                          </p>
                        )}
                      </div>
                    </div>

                    <div className={styles.infoItem}>
                      <FaClock className={styles.infoIcon} />
                      <div>
                        <p className={styles.infoLabel}>Time</p>
                        <p className={styles.infoValue}>
                          {schedule.start_time} - {schedule.end_time}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className={styles.statsContainer}>
                    <div className={`${styles.statBadge} ${styles.success}`}>
                      <div className={`${styles.statIcon} ${styles.success}`}>
                        <FaUsers />
                      </div>
                      <div>
                        <p className={styles.statLabel}>Scheduled</p>
                        <p className={styles.statValue}>{schedule.scheduled_count}</p>
                      </div>
                    </div>

                    {schedule.unscheduled_count > 0 && (
                      <div className={`${styles.statBadge} ${styles.warning}`}>
                        <div className={`${styles.statIcon} ${styles.warning}`}>
                          <FaExclamationTriangle />
                        </div>
                        <div>
                          <p className={styles.statLabel}>Unscheduled</p>
                          <p className={styles.statValue}>{schedule.unscheduled_count}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className={styles.scheduleActions}>
                    <button
                      className={styles.detailsButton}
                      onClick={() => handleViewDetails(schedule.id)}
                    >
                      <FaInfoCircle /> View Details
                    </button>

                    <button
                      className={styles.viewButton}
                      onClick={() => router.push(`/LandingPages/SchoolSchedules?scheduleId=${schedule.id}`)}
                    >
                      <FaEye /> View Schedule
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {selectedScheduleId && (
        <ScheduleDetailsModal
          scheduleId={selectedScheduleId}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </>
  )
}