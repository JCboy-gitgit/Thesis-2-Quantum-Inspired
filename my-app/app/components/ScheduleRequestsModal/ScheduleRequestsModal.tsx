'use client'

import { useState, useEffect } from 'react'
import { X, Check, XCircle, Clock, Calendar, ArrowRight, User, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import styles from './ScheduleRequestsModal.module.css'

interface ScheduleRequest {
    id: number
    schedule_id: number
    allocation_id: number
    requester_id: string
    new_day: string
    new_time: string
    reason: string
    status: 'pending' | 'approved' | 'rejected'
    created_at: string
    requester_name?: string
    course_code?: string
    section?: string
    current_day?: string
    current_time?: string
}

interface ScheduleRequestsModalProps {
    isOpen: boolean
    onClose: () => void
    scheduleId: number
    onUpdate: () => void // Callback to refresh parent schedule
}

export default function ScheduleRequestsModal({ isOpen, onClose, scheduleId, onUpdate }: ScheduleRequestsModalProps) {
    const [requests, setRequests] = useState<ScheduleRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [processingId, setProcessingId] = useState<number | null>(null)

    useEffect(() => {
        if (isOpen && scheduleId) {
            fetchRequests()

            // Real-time subscription for this schedule
            const channel = supabase
                .channel(`realtime_requests_${scheduleId}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'schedule_change_requests',
                        filter: `schedule_id=eq.${scheduleId}`
                    },
                    (payload) => {
                        fetchRequests()
                        // If approved, we might want to trigger onUpdate() too? 
                        // But strictly this modal lists PENDING requests.
                        // If a request is approved/rejected (UPDATE), it should disappear from list.
                        // If a new request comes (INSERT), it should appear.
                    }
                )
                .subscribe()

            return () => {
                supabase.removeChannel(channel)
            }
        }
    }, [isOpen, scheduleId])

    const fetchRequests = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/schedule-requests?schedule_id=${scheduleId}&status=pending`)
            const data = await res.json()
            if (data.success) {
                setRequests(data.data)
            } else {
                console.error('Failed to fetch requests:', data.error)
            }
        } catch (error) {
            console.error('Error fetching requests:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleAction = async (requestId: number, action: 'approve' | 'reject') => {
        setProcessingId(requestId)
        try {
            const res = await fetch('/api/schedule-requests', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId, status: action === 'approve' ? 'approved' : 'rejected' })
            })
            const data = await res.json()

            if (data.success) {
                // Remove from list
                setRequests(prev => prev.filter(r => r.id !== requestId))

                if (action === 'approve') {
                    // If approved, the schedule changed, so notify parent to refresh
                    onUpdate()
                    alert('Request approved and schedule updated.')
                }
            } else {
                alert(data.error || 'Failed to process request')
            }
        } catch (error) {
            console.error('Error processing request:', error)
            alert('An error occurred')
        } finally {
            setProcessingId(null)
        }
    }

    if (!isOpen) return null

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2>Pending Schedule Requests</h2>
                    <button onClick={onClose} className={styles.closeBtn}>
                        <X size={24} />
                    </button>
                </div>

                <div className={styles.content}>
                    {loading ? (
                        <div className={styles.loading}>Loading requests...</div>
                    ) : requests.length === 0 ? (
                        <div className={styles.empty}>
                            <Check size={48} className={styles.emptyIcon} />
                            <p>No pending requests for this schedule.</p>
                        </div>
                    ) : (
                        <div className={styles.list}>
                            {requests.map(request => (
                                <div key={request.id} className={styles.card}>
                                    <div className={styles.cardHeader}>
                                        <div className={styles.requester}>
                                            <User size={16} />
                                            <span>{request.requester_name || 'Unknown Faculty'}</span>
                                        </div>
                                        <span className={styles.date}>
                                            {new Date(request.created_at).toLocaleDateString()}
                                        </span>
                                    </div>

                                    <div className={styles.details}>
                                        <div className={styles.courseInfo}>
                                            <strong>{request.course_code}</strong> - {request.section}
                                        </div>

                                        <div className={styles.moveInfo}>
                                            <div className={styles.timeBlock}>
                                                <div className={styles.label}>Current</div>
                                                <div className={styles.value}>
                                                    {request.current_day} <br /> {request.current_time}
                                                </div>
                                            </div>
                                            <ArrowRight size={20} className={styles.arrow} />
                                            <div className={styles.timeBlock}>
                                                <div className={styles.label}>Proposed</div>
                                                <div className={styles.value}>
                                                    {request.new_day} <br /> {request.new_time}
                                                </div>
                                            </div>
                                        </div>

                                        <div className={styles.reason}>
                                            <span className={styles.label}>Reason:</span>
                                            <p>{request.reason}</p>
                                        </div>
                                    </div>

                                    <div className={styles.actions}>
                                        <button
                                            onClick={() => handleAction(request.id, 'reject')}
                                            disabled={processingId === request.id}
                                            className={styles.rejectBtn}
                                        >
                                            {processingId === request.id ? '...' : 'Reject'}
                                        </button>
                                        <button
                                            onClick={() => handleAction(request.id, 'approve')}
                                            disabled={processingId === request.id}
                                            className={styles.approveBtn}
                                        >
                                            {processingId === request.id ? 'Processing...' : 'Approve'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
