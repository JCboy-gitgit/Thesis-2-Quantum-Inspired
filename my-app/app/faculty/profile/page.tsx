'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  User,
  Mail,
  Building2,
  Phone,
  MapPin,
  Edit3,
  Save,
  X,
  ArrowLeft,
  Camera,
  Briefcase,
  BookOpen,
  LogOut,
  ChevronDown,
  Sun,
  Moon,
  Palette,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import styles from './styles.module.css'
import { useTheme, COLLEGE_THEME_MAP } from '@/app/context/ThemeContext'

interface UserProfile {
  id: string
  email: string
  full_name: string
  department_id?: number
  is_active: boolean
  phone?: string
  office_location?: string
  bio?: string
  specialization?: string
  avatar_url?: string
}

interface Department {
  id: number
  department_code: string
  department_name: string
  college: string | null
}

interface AssignedScheduleInfo {
  schedule_id: number
  schedule_name: string
  semester: string
  academic_year: string
  assigned_at: string
  total_classes: number
}

export default function FacultyProfilePage() {
  const router = useRouter()
  const { theme, collegeTheme, setTheme, setCollegeTheme, toggleTheme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [editForm, setEditForm] = useState<UserProfile | null>(null)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showThemeSettings, setShowThemeSettings] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  const [assignedSchedule, setAssignedSchedule] = useState<AssignedScheduleInfo | null>(null)
  const [loadingSchedule, setLoadingSchedule] = useState(false)
  const [pendingNameRequest, setPendingNameRequest] = useState<{ requested_value: string } | null>(null)

  const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL

  useEffect(() => {
    checkAuthAndLoad()
    fetchDepartments()
  }, [])

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      // Don't close if clicking on the profile button, menu, or menu items
      if (!target.closest('.profileSection') && !target.closest('.profileMenu')) {
        setShowProfileMenu(false)
      }
    }

    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showProfileMenu])

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments')
      const data = await response.json()
      if (data.departments) {
        setDepartments(data.departments)
      }
    } catch (error) {
      console.error('Error fetching departments:', error)
    }
  }

  const fetchAssignedSchedule = async (email: string) => {
    setLoadingSchedule(true)
    try {
      const response = await fetch(`/api/faculty-default-schedule?action=faculty-schedule&email=${encodeURIComponent(email)}`)

      if (response.ok) {
        const data = await response.json()

        if (data.schedule) {
          setAssignedSchedule({
            schedule_id: data.schedule.id,
            schedule_name: data.schedule.schedule_name || 'Unnamed Schedule',
            semester: data.schedule.semester || '',
            academic_year: data.schedule.academic_year || '',
            assigned_at: data.assignment?.assigned_at || '',
            total_classes: data.allocations?.length || 0
          })
        }
      }
    } catch (error) {
      console.error('Error fetching assigned schedule:', error)
    } finally {
      setLoadingSchedule(false)
    }
  }

  const checkAuthAndLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        router.push('/faculty/login')
        return
      }

      if (session.user.email === ADMIN_EMAIL) {
        router.push('/LandingPages/Home')
        return
      }

      // Get user profile
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single() as { data: UserProfile | null; error: any }

      if (userError || !userData || !userData.is_active) {
        await supabase.auth.signOut()
        router.push('/faculty/login')
        return
      }

      // Get additional profile data from user_profiles if exists
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single() as { data: { contact_phone?: string; office_location?: string; bio?: string; specialization?: string } | null; error: any }

      // Also check faculty_profiles for admin-assigned data
      const { data: facultyProfileData } = await supabase
        .from('faculty_profiles')
        .select('*')
        .eq('email', session.user.email || '')
        .single() as {
          data: {
            full_name?: string;
            department?: string;
            college?: string;
            phone?: string;
            office_location?: string;
            position?: string;
            specialization?: string;
          } | null; error: any
        }

      // Merge data - faculty_profiles (admin-assigned) takes priority for certain fields
      const fullProfile: UserProfile = {
        ...userData,
        full_name: facultyProfileData?.full_name || userData.full_name || '',
        phone: facultyProfileData?.phone || profileData?.contact_phone || userData.phone || '',
        office_location: facultyProfileData?.office_location || profileData?.office_location || '',
        bio: profileData?.bio || '',
        specialization: facultyProfileData?.specialization || profileData?.specialization || ''
      }

      setUser(fullProfile)
      setEditForm(fullProfile)

      // Fetch assigned schedule
      if (session.user.email) {
        fetchAssignedSchedule(session.user.email)
      }

      // Check for pending name change requests
      await fetchPendingNameRequest(session.user.id)

    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/faculty/login')
    } finally {
      setLoading(false)
    }
  }

  const fetchPendingNameRequest = async (userId: string) => {
    try {
      const response = await fetch(`/api/profile-change-requests?userId=${userId}&status=pending`)
      const data = await response.json()

      if (data.requests && data.requests.length > 0) {
        const nameRequest = data.requests.find((r: any) => r.field_name === 'full_name')
        if (nameRequest) {
          setPendingNameRequest({ requested_value: nameRequest.requested_value })
        }
      }
    } catch (error) {
      console.error('Error fetching pending requests:', error)
    }
  }

  const handleSave = async () => {
    if (!editForm || !user) return

    setSaving(true)
    setMessage(null)

    try {
      // Name can now be changed directly by faculty (no approval needed)
      const nameChanged = editForm.full_name !== user.full_name

      // Update other fields directly (phone, office_location, bio, specialization)
      const profileData = {
        user_id: user.id,
        office_location: editForm.office_location,
        bio: editForm.bio,
        specialization: editForm.specialization,
        updated_at: new Date().toISOString()
      }

      // Try to upsert user_profiles
      const profileResult = await (supabase
        .from('user_profiles') as any)
        .upsert(profileData, { onConflict: 'user_id' })

      const profileError = profileResult?.error
      if (profileError) {
        console.error('Profile update error:', profileError)
      }

      // Update name directly in users table (faculty can now edit their own name)
      if (nameChanged) {
        const nameUpdateResult = await (supabase
          .from('users') as any)
          .update({
            full_name: editForm.full_name,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)

        const nameError = nameUpdateResult?.error
        if (nameError) {
          console.error('Name update error:', nameError)
          throw new Error('Failed to update name')
        }

        // Also update faculty_profiles if exists
        if (user.email) {
          await (supabase
            .from('faculty_profiles') as any)
            .update({
              full_name: editForm.full_name,
              updated_at: new Date().toISOString()
            })
            .eq('email', user.email)
        }
      }

      // Update phone in users table
      if (editForm.phone !== user.phone) {
        const phoneUpdateResult = await (supabase
          .from('users') as any)
          .update({
            phone: editForm.phone,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)

        const phoneError = phoneUpdateResult?.error
        if (phoneError) {
          console.error('Phone update error:', phoneError)
        }
      }

      // Update local state with all changes
      setUser({
        ...user,
        full_name: editForm.full_name,
        phone: editForm.phone,
        office_location: editForm.office_location,
        bio: editForm.bio,
        specialization: editForm.specialization
      })

      setEditing(false)
      setMessage({ type: 'success', text: '✅ Profile updated successfully!' })

    } catch (error: any) {
      console.error('Save error:', error)
      setMessage({ type: 'error', text: '❌ ' + (error.message || 'Failed to update profile') })
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditForm(user)
    setEditing(false)
  }

  const handleLogout = async () => {
    try {
      console.log('Logging out from profile page...')
      // Close the menu immediately for better UX
      setShowProfileMenu(false)

      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Logout error:', error)
      } else {
        console.log('Logout successful')
      }
      // Force redirect to login page
      router.push('/faculty/login')
    } catch (error) {
      console.error('Logout failed:', error)
      // Even if logout fails, redirect to login
      router.push('/faculty/login')
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.spinner}></div>
        <p>Loading profile...</p>
      </div>
    )
  }

  return (
    <div className={styles.pageContainer}>
      {/* Header */}
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.push('/faculty/home')}>
          <ArrowLeft size={20} />
          <span>Back to Dashboard</span>
        </button>

        {/* Profile Icon with Dropdown */}
        <div className={styles.profileSection}>
          <button
            className={styles.profileBtn}
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            title="Profile Menu"
          >
            <div className={styles.profileAvatar}>
              <User size={20} />
            </div>
            <ChevronDown size={14} className={`${styles.profileChevron} ${showProfileMenu ? styles.rotated : ''}`} />
          </button>

          {showProfileMenu && (
            <div className={styles.profileMenu}>
              <button
                className={styles.profileMenuItem}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleLogout()
                }}
                type="button"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.mainContent}>
        {/* Message Toast */}
        {message && (
          <div className={`${styles.toast} ${styles[message.type]}`}>
            {message.text}
            <button onClick={() => setMessage(null)} className={styles.toastClose}>×</button>
          </div>
        )}

        {/* Profile Card */}
        <div className={styles.profileCard}>
          {/* Avatar Section */}
          <div className={styles.avatarSection}>
            <div className={styles.avatar}>
              <User size={60} />
              <button className={styles.avatarEditBtn}>
                <Camera size={16} />
              </button>
            </div>
            <div className={styles.avatarInfo}>
              <h1>{user?.full_name || 'Faculty Member'}</h1>
              <p className={styles.email}>{user?.email}</p>
              <span className={styles.roleBadge}>Faculty</span>
            </div>
          </div>

          {/* Edit/Save Buttons */}
          <div className={styles.actionBtns}>
            {editing ? (
              <>
                <button className={styles.cancelBtn} onClick={handleCancel} disabled={saving}>
                  <X size={18} />
                  Cancel
                </button>
                <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                  {saving ? <span className={styles.btnSpinner}></span> : <Save size={18} />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            ) : (
              <button className={styles.editBtn} onClick={() => setEditing(true)}>
                <Edit3 size={18} />
                Edit Profile
              </button>
            )}
          </div>

          {/* Profile Form */}
          <div className={styles.profileForm}>
            {/* Full Name */}
            <div className={styles.formGroup}>
              <label>
                <User size={16} />
                Full Name
                {editing && <span className={styles.adminApprovalHint}>(Requires admin approval)</span>}
              </label>
              {editing ? (
                <input
                  type="text"
                  value={editForm?.full_name || ''}
                  onChange={(e) => setEditForm({ ...editForm!, full_name: e.target.value })}
                  placeholder="Your full name"
                />
              ) : (
                <div className={styles.nameWithPending}>
                  <p>{user?.full_name || 'Not set'}</p>
                  {pendingNameRequest && (
                    <span className={styles.pendingBadge}>
                      <Clock size={12} />
                      Pending: &quot;{pendingNameRequest.requested_value}&quot;
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Email (read-only) */}
            <div className={styles.formGroup}>
              <label>
                <Mail size={16} />
                Email Address
              </label>
              <p className={styles.readonly}>{user?.email}</p>
            </div>

            {/* Department - Read only, managed by admin */}
            <div className={styles.formGroup}>
              <label>
                <Building2 size={16} />
                Department
              </label>
              <p className={styles.readOnly}>Contact admin to update department</p>
            </div>

            {/* Phone */}
            <div className={styles.formGroup}>
              <label>
                <Phone size={16} />
                Contact Number
              </label>
              {editing ? (
                <input
                  type="tel"
                  value={editForm?.phone || ''}
                  onChange={(e) => setEditForm({ ...editForm!, phone: e.target.value })}
                  placeholder="+63 XXX XXX XXXX"
                />
              ) : (
                <p>{user?.phone || 'Not set'}</p>
              )}
            </div>

            {/* Office Location */}
            <div className={styles.formGroup}>
              <label>
                <MapPin size={16} />
                Office Location
              </label>
              {editing ? (
                <input
                  type="text"
                  value={editForm?.office_location || ''}
                  onChange={(e) => setEditForm({ ...editForm!, office_location: e.target.value })}
                  placeholder="e.g., Room 301, Science Building"
                />
              ) : (
                <p>{user?.office_location || 'Not set'}</p>
              )}
            </div>

            {/* Specialization */}
            <div className={styles.formGroup}>
              <label>
                <Briefcase size={16} />
                Specialization
              </label>
              {editing ? (
                <input
                  type="text"
                  value={editForm?.specialization || ''}
                  onChange={(e) => setEditForm({ ...editForm!, specialization: e.target.value })}
                  placeholder="e.g., Computer Science, Mathematics"
                />
              ) : (
                <p>{user?.specialization || 'Not set'}</p>
              )}
            </div>

            {/* Bio */}
            <div className={`${styles.formGroup} ${styles.fullWidth}`}>
              <label>
                <BookOpen size={16} />
                Bio / About
              </label>
              {editing ? (
                <textarea
                  value={editForm?.bio || ''}
                  onChange={(e) => setEditForm({ ...editForm!, bio: e.target.value })}
                  placeholder="Write a short bio about yourself..."
                  rows={4}
                />
              ) : (
                <p className={styles.bioText}>{user?.bio || 'No bio added yet.'}</p>
              )}
            </div>
          </div>

          {/* Assigned Schedule Section */}
          <div className={styles.scheduleSection}>
            <h2 className={styles.sectionTitle}>
              <Calendar size={20} />
              Assigned Schedule
            </h2>

            {loadingSchedule ? (
              <div className={styles.scheduleLoading}>
                <div className={styles.miniSpinner}></div>
                <span>Loading schedule...</span>
              </div>
            ) : assignedSchedule ? (
              <div className={styles.scheduleCard}>
                <div className={styles.scheduleStatus}>
                  <CheckCircle size={20} className={styles.statusActive} />
                  <span>Schedule Assigned</span>
                </div>
                <div className={styles.scheduleDetails}>
                  <div className={styles.scheduleItem}>
                    <strong>Schedule Name:</strong>
                    <span>{assignedSchedule.schedule_name}</span>
                  </div>
                  <div className={styles.scheduleItem}>
                    <strong>Semester:</strong>
                    <span>{assignedSchedule.semester} {assignedSchedule.academic_year}</span>
                  </div>
                  <div className={styles.scheduleItem}>
                    <strong>Total Classes:</strong>
                    <span>{assignedSchedule.total_classes} classes assigned</span>
                  </div>
                  {assignedSchedule.assigned_at && (
                    <div className={styles.scheduleItem}>
                      <strong>Assigned On:</strong>
                      <span>{new Date(assignedSchedule.assigned_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
                <button
                  className={styles.viewScheduleBtn}
                  onClick={() => router.push('/faculty/schedules')}
                >
                  <Clock size={16} />
                  View Full Schedule
                </button>
              </div>
            ) : (
              <div className={styles.noSchedule}>
                <AlertCircle size={40} />
                <h3>No Schedule Assigned</h3>
                <p>The administrator has not assigned a schedule to your account yet.</p>
                <p>Please contact your department administrator for assistance.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
