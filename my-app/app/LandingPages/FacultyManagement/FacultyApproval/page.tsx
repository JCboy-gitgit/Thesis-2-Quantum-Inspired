'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import { 
  UserCheck, 
  UserX, 
  Clock, 
  Mail, 
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  User,
  Building2,
  Loader2
} from 'lucide-react'
import styles from './styles.module.css'

interface FacultyRegistration {
  id: string
  email: string
  full_name: string
  created_at: string
  email_confirmed_at: string | null
  status: 'pending' | 'approved' | 'rejected' | 'unconfirmed'
  role: string
  department: string | null
  is_active: boolean
}

export default function FacultyApprovalPage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [registrations, setRegistrations] = useState<FacultyRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [searchQuery, setSearchQuery] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ full_name: '', department: '' })

  useEffect(() => {
    checkAuth()
    fetchRegistrations()
  }, [filter])

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

  const fetchRegistrations = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/faculty-registration?status=${filter}`)
      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }
      
      setRegistrations(data.registrations || [])
    } catch (error: any) {
      console.error('Error fetching registrations:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to fetch registrations' })
    } finally {
      setLoading(false)
    }
  }

  const handleApproval = async (userId: string, action: 'approve' | 'reject') => {
    const user = registrations.find(r => r.id === userId)
    if (!user) return

    setActionLoading(userId)
    try {
      const response = await fetch('/api/faculty-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          action,
          full_name: editForm.full_name || user.full_name,
          department: editForm.department || user.department
        })
      })

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }

      setMessage({ 
        type: 'success', 
        text: action === 'approve' 
          ? `✅ ${user.email} has been approved! Email notification sent.`
          : `❌ ${user.email} has been rejected. Email notification sent.`
      })

      // Auto-clear message after 4 seconds
      setTimeout(() => setMessage(null), 4000)

      // Immediately refresh from server to show updated status
      await fetchRegistrations()
      
      setEditingUser(null)
      setEditForm({ full_name: '', department: '' })

    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Action failed' })
      setTimeout(() => setMessage(null), 5000)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to permanently delete this registration?')) return

    setActionLoading(userId)
    try {
      const response = await fetch(`/api/faculty-registration?userId=${userId}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }

      // Immediately remove from local state
      setRegistrations(prev => prev.filter(reg => reg.id !== userId))

      setMessage({ type: 'success', text: '🗑️ Registration deleted successfully' })
      setTimeout(() => setMessage(null), 3000)

    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Delete failed' })
      setTimeout(() => setMessage(null), 5000)
    } finally {
      setActionLoading(null)
    }
  }

  const filteredRegistrations = registrations.filter(reg => 
    reg.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    reg.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const pendingCount = registrations.filter(r => r.status === 'pending' || r.status === 'unconfirmed').length

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className={`${styles.badge} ${styles.badgeApproved}`}><CheckCircle2 size={14} /> Approved</span>
      case 'rejected':
        return <span className={`${styles.badge} ${styles.badgeRejected}`}><XCircle size={14} /> Rejected</span>
      case 'unconfirmed':
        return <span className={`${styles.badge} ${styles.badgeUnconfirmed}`}><AlertCircle size={14} /> Unconfirmed</span>
      default:
        return <span className={`${styles.badge} ${styles.badgePending}`}><Clock size={14} /> Pending</span>
    }
  }

  return (
    <div className={styles.pageContainer}>
      <MenuBar 
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
        showSidebarToggle={true}
        setSidebarOpen={setSidebarOpen}
      />
      <Sidebar isOpen={sidebarOpen} />

      <main className={`${styles.mainContent} ${sidebarOpen ? styles.withSidebar : ''}`}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <UserCheck size={32} />
            <div>
              <h1>Faculty Registration Approval</h1>
              <p>Review and approve faculty account registrations</p>
            </div>
          </div>
          
          {pendingCount > 0 && (
            <div className={styles.pendingAlert}>
              <AlertCircle size={20} />
              <span>{pendingCount} pending request{pendingCount > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {/* Message Toast */}
        {message && (
          <div className={`${styles.toast} ${styles[message.type]}`}>
            {message.type === 'success' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
            {message.text}
            <button onClick={() => setMessage(null)} className={styles.toastClose}>×</button>
          </div>
        )}

        {/* Controls */}
        <div className={styles.controls}>
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
              <Clock size={16} /> Pending
            </button>
            <button 
              className={`${styles.filterTab} ${filter === 'approved' ? styles.active : ''}`}
              onClick={() => setFilter('approved')}
            >
              <CheckCircle2 size={16} /> Approved
            </button>
            <button 
              className={`${styles.filterTab} ${filter === 'rejected' ? styles.active : ''}`}
              onClick={() => setFilter('rejected')}
            >
              <XCircle size={16} /> Rejected
            </button>
            <button 
              className={`${styles.filterTab} ${filter === 'all' ? styles.active : ''}`}
              onClick={() => setFilter('all')}
            >
              <Filter size={16} /> All
            </button>
          </div>

          <button className={styles.refreshBtn} onClick={fetchRegistrations} disabled={loading}>
            <RefreshCw size={18} className={loading ? styles.spinning : ''} />
          </button>
        </div>

        {/* Registration Cards */}
        <div className={styles.cardGrid}>
          {loading ? (
            <div className={styles.loadingState}>
              <Loader2 size={40} className={styles.spinning} />
              <p>Loading registrations...</p>
            </div>
          ) : filteredRegistrations.length === 0 ? (
            <div className={styles.emptyState}>
              <UserCheck size={60} />
              <h3>No {filter !== 'all' ? filter : ''} registrations</h3>
              <p>{filter === 'pending' ? 'All caught up! No pending approvals.' : 'No registrations found.'}</p>
            </div>
          ) : (
            filteredRegistrations.map((reg) => (
              <div key={reg.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.userAvatar}>
                    <User size={24} />
                  </div>
                  {getStatusBadge(reg.status)}
                </div>

                <div className={styles.cardBody}>
                  {editingUser === reg.id ? (
                    <div className={styles.editForm}>
                      <div className={styles.formGroup}>
                        <label><User size={14} /> Full Name</label>
                        <input
                          type="text"
                          value={editForm.full_name}
                          onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                          placeholder={reg.full_name || 'Enter full name'}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label><Building2 size={14} /> Department</label>
                        <input
                          type="text"
                          value={editForm.department}
                          onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                          placeholder={reg.department || 'Enter department'}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className={styles.infoRow}>
                        <Mail size={16} />
                        <span className={styles.email}>{reg.email}</span>
                      </div>
                      <div className={styles.infoRow}>
                        <User size={16} />
                        <span>{reg.full_name || 'Not provided'}</span>
                      </div>
                      {reg.department && (
                        <div className={styles.infoRow}>
                          <Building2 size={16} />
                          <span>{reg.department}</span>
                        </div>
                      )}
                      <div className={styles.infoRow}>
                        <Calendar size={16} />
                        <span>Registered: {formatDate(reg.created_at)}</span>
                      </div>
                      {reg.email_confirmed_at && (
                        <div className={styles.infoRow}>
                          <CheckCircle2 size={16} />
                          <span>Email confirmed: {formatDate(reg.email_confirmed_at)}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className={styles.cardActions}>
                  {reg.status === 'pending' || reg.status === 'unconfirmed' ? (
                    <>
                      {editingUser === reg.id ? (
                        <>
                          <button 
                            className={styles.approveBtn}
                            onClick={() => handleApproval(reg.id, 'approve')}
                            disabled={actionLoading === reg.id}
                          >
                            {actionLoading === reg.id ? <Loader2 size={16} className={styles.spinning} /> : <UserCheck size={16} />}
                            Approve
                          </button>
                          <button 
                            className={styles.cancelBtn}
                            onClick={() => {
                              setEditingUser(null)
                              setEditForm({ full_name: '', department: '' })
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            className={styles.approveBtn}
                            onClick={() => {
                              setEditingUser(reg.id)
                              setEditForm({ 
                                full_name: reg.full_name || '', 
                                department: reg.department || '' 
                              })
                            }}
                          >
                            <UserCheck size={16} /> Approve
                          </button>
                          <button 
                            className={styles.rejectBtn}
                            onClick={() => handleApproval(reg.id, 'reject')}
                            disabled={actionLoading === reg.id}
                          >
                            {actionLoading === reg.id ? <Loader2 size={16} className={styles.spinning} /> : <UserX size={16} />}
                            Reject
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <button 
                      className={styles.deleteBtn}
                      onClick={() => handleDelete(reg.id)}
                      disabled={actionLoading === reg.id}
                    >
                      {actionLoading === reg.id ? <Loader2 size={16} className={styles.spinning} /> : <Trash2 size={16} />}
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  )
}
