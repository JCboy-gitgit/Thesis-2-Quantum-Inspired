'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { fetchNoCache } from '@/lib/fetchUtils'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import {
  UserCog,
  Clock,
  Mail,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  User,
  ArrowRight,
  Loader2,
  Edit3,
  MessageSquare
} from 'lucide-react'
import styles from './styles.module.css'

interface ChangeRequest {
  id: string
  user_id: string
  email: string
  field_name: string
  current_value: string | null
  requested_value: string
  status: 'pending' | 'approved' | 'rejected'
  admin_notes: string | null
  reviewed_at: string | null
  created_at: string
}

export default function ProfileChangeRequestsPage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [requests, setRequests] = useState<ChangeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [searchQuery, setSearchQuery] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [adminNotes, setAdminNotes] = useState<{ [key: string]: string }>({})
  const [adminId, setAdminId] = useState<string | null>(null)

  useEffect(() => {
    checkAuth()
    fetchRequests()
  }, [filter])

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

      setAdminId(session.user.id)
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/')
    }
  }

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const response = await fetchNoCache(`/api/profile-change-requests?status=${filter}`)
      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      setRequests(data.requests || [])
    } catch (error: any) {
      console.error('Error fetching requests:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to fetch requests' })
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (requestId: string, action: 'approve' | 'reject') => {
    setActionLoading(requestId)
    try {
      const response = await fetch('/api/profile-change-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          action,
          adminNotes: adminNotes[requestId] || null,
          adminId
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Action failed')
      }

      setMessage({ 
        type: 'success', 
        text: action === 'approve' 
          ? '✅ Request approved and profile updated!' 
          : '❌ Request rejected' 
      })

      // Refresh list
      fetchRequests()

    } catch (error: any) {
      console.error('Action error:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to process request' })
    } finally {
      setActionLoading(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatFieldName = (fieldName: string) => {
    return fieldName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length

  const filteredRequests = requests.filter(request => {
    if (!searchQuery) return true
    const search = searchQuery.toLowerCase()
    return (
      request.email.toLowerCase().includes(search) ||
      request.requested_value.toLowerCase().includes(search) ||
      (request.current_value && request.current_value.toLowerCase().includes(search))
    )
  })

  return (
    <div className={styles.pageContainer}>
      <MenuBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} />

      <main className={`${styles.mainContent} ${sidebarOpen ? styles.withSidebar : ''}`}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <UserCog size={32} />
            <div>
              <h1>Profile Change Requests</h1>
              <p>Review and approve faculty profile change requests</p>
            </div>
          </div>

          {filter === 'pending' && pendingCount > 0 && (
            <div className={styles.pendingAlert}>
              <AlertCircle size={18} />
              {pendingCount} pending request{pendingCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Toast Message */}
        {message && (
          <div className={`${styles.toast} ${styles[message.type]}`}>
            {message.type === 'success' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
            {message.text}
            <button className={styles.toastClose} onClick={() => setMessage(null)}>×</button>
          </div>
        )}

        {/* Filters */}
        <div className={styles.filters}>
          <div className={styles.searchBox}>
            <Search size={18} />
            <input
              type="text"
              placeholder="Search by email or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className={styles.filterTabs}>
            <button
              className={`${styles.filterTab} ${filter === 'pending' ? styles.active : ''}`}
              onClick={() => setFilter('pending')}
            >
              <Clock size={16} />
              Pending
            </button>
            <button
              className={`${styles.filterTab} ${filter === 'approved' ? styles.active : ''}`}
              onClick={() => setFilter('approved')}
            >
              <CheckCircle2 size={16} />
              Approved
            </button>
            <button
              className={`${styles.filterTab} ${filter === 'rejected' ? styles.active : ''}`}
              onClick={() => setFilter('rejected')}
            >
              <XCircle size={16} />
              Rejected
            </button>
            <button
              className={`${styles.filterTab} ${filter === 'all' ? styles.active : ''}`}
              onClick={() => setFilter('all')}
            >
              <Filter size={16} />
              All
            </button>
          </div>

          <button className={styles.refreshBtn} onClick={fetchRequests} disabled={loading}>
            <RotateCcw size={18} className={loading ? styles.spinning : ''} />
          </button>
        </div>

        {/* Requests List */}
        <div className={styles.requestsList}>
          {loading ? (
            <div className={styles.loading}>
              <RotateCcw size={40} className={styles.spinning} />
              <p>Loading requests...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className={styles.empty}>
              <UserCog size={60} />
              <h3>No {filter !== 'all' ? filter : ''} requests found</h3>
              <p>
                {filter === 'pending' 
                  ? 'All caught up! No pending profile change requests.' 
                  : 'No requests match your current filter.'}
              </p>
            </div>
          ) : (
            filteredRequests.map(request => (
              <div key={request.id} className={`${styles.card} ${styles[request.status]}`}>
                <div className={styles.cardHeader}>
                  <div className={styles.userInfo}>
                    <div className={styles.userAvatar}>
                      <User size={24} />
                    </div>
                    <div>
                      <h3>{request.email}</h3>
                      <span className={styles.changeType}>
                        <Edit size={14} />
                        {formatFieldName(request.field_name)} Change
                      </span>
                    </div>
                  </div>
                  <div className={`${styles.statusBadge} ${styles[request.status]}`}>
                    {request.status === 'pending' && <Clock size={14} />}
                    {request.status === 'approved' && <CheckCircle2 size={14} />}
                    {request.status === 'rejected' && <XCircle size={14} />}
                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                  </div>
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.changePreview}>
                    <div className={styles.valueBox}>
                      <span className={styles.valueLabel}>Current Value</span>
                      <p className={styles.currentValue}>{request.current_value || '(Not set)'}</p>
                    </div>
                    <ArrowRight size={24} className={styles.changeArrow} />
                    <div className={styles.valueBox}>
                      <span className={styles.valueLabel}>Requested Value</span>
                      <p className={styles.requestedValue}>{request.requested_value}</p>
                    </div>
                  </div>

                  <div className={styles.infoRow}>
                    <Calendar size={14} />
                    <span>Submitted: {formatDate(request.created_at)}</span>
                  </div>

                  {request.reviewed_at && (
                    <div className={styles.infoRow}>
                      <CheckCircle2 size={14} />
                      <span>Reviewed: {formatDate(request.reviewed_at)}</span>
                    </div>
                  )}

                  {request.admin_notes && (
                    <div className={styles.adminNotesDisplay}>
                      <MessageSquare size={14} />
                      <span>{request.admin_notes}</span>
                    </div>
                  )}
                </div>

                {request.status === 'pending' && (
                  <div className={styles.cardActions}>
                    <div className={styles.notesInput}>
                      <input
                        type="text"
                        placeholder="Add notes (optional)..."
                        value={adminNotes[request.id] || ''}
                        onChange={(e) => setAdminNotes({ ...adminNotes, [request.id]: e.target.value })}
                      />
                    </div>
                    <div className={styles.actionButtons}>
                      <button
                        className={styles.rejectBtn}
                        onClick={() => handleAction(request.id, 'reject')}
                        disabled={actionLoading === request.id}
                      >
                        {actionLoading === request.id ? (
                          <RotateCcw size={16} className={styles.spinning} />
                        ) : (
                          <XCircle size={16} />
                        )}
                        Reject
                      </button>
                      <button
                        className={styles.approveBtn}
                        onClick={() => handleAction(request.id, 'approve')}
                        disabled={actionLoading === request.id}
                      >
                        {actionLoading === request.id ? (
                          <RotateCcw size={16} className={styles.spinning} />
                        ) : (
                          <CheckCircle2 size={16} />
                        )}
                        Approve
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  )
}
