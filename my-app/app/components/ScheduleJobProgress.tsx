import React, { useState, useEffect, useCallback } from 'react'
import { FaAtom, FaCheck, FaTimes, FaClock, FaSpinner, FaExternalLinkAlt } from 'react-icons/fa'
import { Loader2, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import styles from './ScheduleJobProgress.module.css'

interface ScheduleJob {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  current_iteration: number
  total_iterations: number
  stage: string
  schedule_name: string
  semester: string
  academic_year: string
  total_classes: number
  error_message?: string
  started_at?: string
  completed_at?: string
  time_elapsed_ms?: number
  generated_schedule_id?: string
  result_data?: {
    scheduled_count: number
    unscheduled_count: number
    optimization_stats?: {
      iterations: number
      final_cost: number
      improvements: number
    }
  }
}

interface ScheduleJobProgressProps {
  jobId: string
  onComplete?: (job: ScheduleJob) => void
  onError?: (error: string) => void
  onCancel?: () => void
  pollInterval?: number  // ms between polls, default 2000
}

export default function ScheduleJobProgress({
  jobId,
  onComplete,
  onError,
  onCancel,
  pollInterval = 2000
}: ScheduleJobProgressProps) {
  const [job, setJob] = useState<ScheduleJob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)

  // Format time as mm:ss or hh:mm:ss
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
    }
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`
  }

  // Poll for job status
  const fetchJobStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/schedule/jobs?id=${jobId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch job status')
      }
      const jobData = await response.json()
      setJob(jobData)

      // Handle completion
      if (jobData.status === 'completed' && onComplete) {
        onComplete(jobData)
      }
      
      // Handle failure
      if (jobData.status === 'failed') {
        setError(jobData.error_message || 'Generation failed')
        if (onError) {
          onError(jobData.error_message || 'Generation failed')
        }
      }

      return jobData
    } catch (err: any) {
      setError(err.message)
      return null
    }
  }, [jobId, onComplete, onError])

  // Start polling
  useEffect(() => {
    // Initial fetch
    fetchJobStatus()

    // Set up polling
    const pollIntervalId = setInterval(async () => {
      const jobData = await fetchJobStatus()
      if (jobData && (jobData.status === 'completed' || jobData.status === 'failed' || jobData.status === 'cancelled')) {
        clearInterval(pollIntervalId)
      }
    }, pollInterval)

    // Elapsed time counter
    const timerIntervalId = setInterval(() => {
      setElapsedTime(prev => prev + 1000)
    }, 1000)

    return () => {
      clearInterval(pollIntervalId)
      clearInterval(timerIntervalId)
    }
  }, [fetchJobStatus, pollInterval])

  // Cancel job
  const handleCancel = async () => {
    try {
      await fetch('/api/schedule/jobs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          status: 'cancelled',
          stage: 'Cancelled by user'
        })
      })
      if (onCancel) {
        onCancel()
      }
    } catch (err) {
      console.error('Failed to cancel job:', err)
    }
  }

  if (!job) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <Loader2 className={styles.spinnerIcon} />
          <p>Connecting to scheduler...</p>
        </div>
      </div>
    )
  }

  const statusIcons = {
    pending: <Clock className={styles.statusIcon} />,
    running: <FaAtom className={`${styles.statusIcon} ${styles.spinningAtom}`} />,
    completed: <CheckCircle className={`${styles.statusIcon} ${styles.successIcon}`} />,
    failed: <XCircle className={`${styles.statusIcon} ${styles.errorIcon}`} />,
    cancelled: <AlertTriangle className={`${styles.statusIcon} ${styles.warningIcon}`} />
  }

  const statusLabels = {
    pending: 'Queued',
    running: 'Generating Schedule',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled'
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        {statusIcons[job.status]}
        <div className={styles.headerText}>
          <h2 className={styles.title}>{statusLabels[job.status]}</h2>
          <p className={styles.scheduleName}>{job.schedule_name}</p>
        </div>
      </div>

      {/* Progress Bar */}
      {(job.status === 'running' || job.status === 'pending') && (
        <div className={styles.progressSection}>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${job.progress}%` }}
            />
          </div>
          <div className={styles.progressText}>
            <span>{job.progress}%</span>
            <span className={styles.stageText}>{job.stage}</span>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <Clock size={18} />
          <div className={styles.statContent}>
            <span className={styles.statValue}>
              {job.time_elapsed_ms ? formatTime(job.time_elapsed_ms) : formatTime(elapsedTime)}
            </span>
            <span className={styles.statLabel}>Elapsed Time</span>
          </div>
        </div>

        {job.status === 'running' && (
          <div className={styles.statCard}>
            <FaAtom size={18} />
            <div className={styles.statContent}>
              <span className={styles.statValue}>
                {job.current_iteration.toLocaleString()} / {job.total_iterations.toLocaleString()}
              </span>
              <span className={styles.statLabel}>Iterations</span>
            </div>
          </div>
        )}

        <div className={styles.statCard}>
          <Loader2 size={18} />
          <div className={styles.statContent}>
            <span className={styles.statValue}>{job.total_classes}</span>
            <span className={styles.statLabel}>Total Classes</span>
          </div>
        </div>

        {job.result_data && (
          <>
            <div className={styles.statCard}>
              <CheckCircle size={18} className={styles.successIcon} />
              <div className={styles.statContent}>
                <span className={styles.statValue}>{job.result_data.scheduled_count}</span>
                <span className={styles.statLabel}>Scheduled</span>
              </div>
            </div>
            {job.result_data.unscheduled_count > 0 && (
              <div className={styles.statCard}>
                <AlertTriangle size={18} className={styles.warningIcon} />
                <div className={styles.statContent}>
                  <span className={styles.statValue}>{job.result_data.unscheduled_count}</span>
                  <span className={styles.statLabel}>Unscheduled</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className={styles.errorMessage}>
          <XCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        {(job.status === 'pending' || job.status === 'running') && (
          <button className={styles.cancelButton} onClick={handleCancel}>
            <FaTimes /> Cancel
          </button>
        )}
        
        {job.status === 'completed' && job.generated_schedule_id && (
          <a 
            href={`/LandingPages/RoomSchedule/ViewSchedule?id=${job.generated_schedule_id}`}
            className={styles.viewButton}
          >
            <FaExternalLinkAlt /> View Schedule
          </a>
        )}
      </div>

      {/* Persistence Notice */}
      {(job.status === 'pending' || job.status === 'running') && (
        <div className={styles.persistenceNotice}>
          <FaClock />
          <p>
            <strong>You can safely leave this page.</strong> The schedule will continue generating 
            in the background. Check the &quot;Schedule History&quot; page to see the result when it&apos;s ready.
          </p>
        </div>
      )}
    </div>
  )
}
