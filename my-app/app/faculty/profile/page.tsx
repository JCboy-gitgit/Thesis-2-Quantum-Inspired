'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { fetchNoCache } from '@/lib/fetchUtils'
import {
  User,
  Mail,
  Building2,
  Phone,
  MapPin,
  Edit3,
  Save,
  X,
  Camera,
  Briefcase,
  BookOpen,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Lock,
  Key,
  Eye,
  EyeOff,
  Settings,
  LogOut
} from 'lucide-react'
import styles from './styles.module.css'
import { useTheme, COLLEGE_THEME_MAP } from '@/app/context/ThemeContext'
import FacultySettingsModal from '@/app/components/FacultySettingsModal'
import FacultySidebar from '@/app/components/FacultySidebar'
import FacultyMenuBar from '@/app/components/FacultyMenuBar'
import '@/app/styles/faculty-global.css'

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
  college?: string
  department?: string
  position?: string
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
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMenuBarHidden, setIsMenuBarHidden] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  const [assignedSchedule, setAssignedSchedule] = useState<AssignedScheduleInfo | null>(null)
  const [loadingSchedule, setLoadingSchedule] = useState(false)
  const [pendingNameRequest, setPendingNameRequest] = useState<{ requested_value: string } | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' })
  const [changingPassword, setChangingPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL

  const parseJsonSafely = async (response: Response) => {
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      return null
    }
    return response.json()
  }

  useEffect(() => {
    checkAuthAndLoad()
    fetchDepartments()
  }, [])

  const fetchDepartments = async () => {
    try {
      const response = await fetchNoCache('/api/departments')
      const data = await parseJsonSafely(response)
      if (data?.departments) {
        setDepartments(data.departments)
      }
    } catch (error) {
      console.error('Error fetching departments:', error)
    }
  }

  const fetchAssignedSchedule = async (email: string) => {
    setLoadingSchedule(true)
    try {
      const response = await fetchNoCache(`/api/faculty-default-schedule?action=faculty-schedule&email=${encodeURIComponent(email)}`)

      if (response.ok) {
        const data = await parseJsonSafely(response)

        if (data?.schedule) {
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
        router.push('/')
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
        router.push('/')
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
        specialization: facultyProfileData?.specialization || profileData?.specialization || '',
        college: facultyProfileData?.college || '',
        department: facultyProfileData?.department || '',
        position: facultyProfileData?.position || ''
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
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const fetchPendingNameRequest = async (userId: string) => {
    try {
      const response = await fetch(`/api/profile-change-requests?userId=${userId}&status=pending`)
      const data = await parseJsonSafely(response)

      if (data?.requests && data.requests.length > 0) {
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

      // Update name directly in users table (faculty can now edit their own name)
      if (nameChanged) {
        const { error: nameError } = await supabase
          .from('users')
          .update({
            full_name: editForm.full_name,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)

        if (nameError) {
          console.error('Name update error:', nameError)
          throw new Error('Failed to update name: ' + nameError.message)
        }

        // Also update faculty_profiles by user_id (primary key relationship)
        const { error: facultyError } = await supabase
          .from('faculty_profiles')
          .update({
            full_name: editForm.full_name,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id)

        if (facultyError) {
          // Log the actual error details (code, message, hint)
          console.warn('Faculty profile update skipped:', facultyError?.message || facultyError?.code || 'Unknown error', facultyError?.hint || '')
          // Don't throw - faculty_profiles might not exist for this user
        }
      }

      // Update phone in both tables
      if (editForm.phone !== user.phone) {
        const { error: phoneError } = await supabase
          .from('users')
          .update({
            phone: editForm.phone,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)

        if (phoneError) {
          console.warn('Phone update error:', phoneError?.message || phoneError?.code || 'Unknown error')
        }

        // Also update in faculty_profiles
        const { error: facultyPhoneError } = await supabase
          .from('faculty_profiles')
          .update({
            phone: editForm.phone,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id)

        if (facultyPhoneError) {
          console.warn('Faculty phone update skipped:', facultyPhoneError?.message || facultyPhoneError?.code || 'Unknown error')
        }
      }

      // Update other fields in user_profiles
      const profileData = {
        user_id: user.id,
        office_location: editForm.office_location,
        bio: editForm.bio,
        specialization: editForm.specialization,
        updated_at: new Date().toISOString()
      }

      // Try to update first
      const { data: existingProfile, error: checkError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (existingProfile) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update(profileData)
          .eq('user_id', user.id)

        if (updateError) {
          console.error('Profile update error:', updateError)
        }
      } else {
        // Insert new record if it doesn't exist
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert([profileData])

        if (insertError) {
          console.error('Profile insert error:', insertError)
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

      // Force refresh to ensure all cached data is updated
      router.refresh()

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

  // Handle profile image upload
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user) return

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setMessage({ type: 'error', text: 'Please upload a valid image file (JPEG, PNG, GIF, or WebP)' })
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image size must be less than 5MB' })
      return
    }

    setUploadingImage(true)
    try {
      // Create a unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      // Upload to Supabase Storage
      const { error: uploadError, data } = await supabase.storage
        .from('profile-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        // If bucket doesn't exist, try creating it or use a fallback
        if (uploadError.message.includes('Bucket not found')) {
          setMessage({ type: 'error', text: 'Storage not configured. Please contact administrator.' })
          return
        }
        throw uploadError
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-images')
        .getPublicUrl(filePath)

      // Update user profile with new avatar URL
      const db = supabase as any
      const { error: updateError } = await db
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id)

      if (updateError) throw updateError

      // Also update faculty_profiles profile_image if record exists (matches by email)
      if (user.email) {
        const facultyUpdateResult = await db
          .from('faculty_profiles')
          .update({ profile_image: publicUrl })
          .eq('email', user.email)

        if (facultyUpdateResult?.error) {
          console.log('Note: faculty_profiles profile_image update not critical:', facultyUpdateResult.error)
        }
      }

      // Update local state with cache bust for immediate refresh
      const avatarUrlWithCacheBust = `${publicUrl}?t=${Date.now()}`
      setUser({ ...user, avatar_url: avatarUrlWithCacheBust })
      if (editForm) setEditForm({ ...editForm, avatar_url: avatarUrlWithCacheBust })

      setMessage({ type: 'success', text: 'Profile image updated successfully!' })

      // Force refresh to ensure all cached data is updated
      router.refresh()
    } catch (error: any) {
      console.error('Error uploading image:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to upload image' })
    } finally {
      setUploadingImage(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Handle password change
  const handlePasswordChange = async () => {
    if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
      setMessage({ type: 'error', text: 'Please fill in both password fields' })
      return
    }

    if (passwordForm.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters long' })
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' })
      return
    }

    setChangingPassword(true)
    setMessage(null)

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      })

      if (error) {
        console.error('Password change error:', error)
        throw error
      }

      setMessage({ type: 'success', text: '✅ Password changed successfully!' })
      setPasswordForm({ newPassword: '', confirmPassword: '' })
      setShowPasswordChange(false)
    } catch (error: any) {
      console.error('Password change failed:', error)
      setMessage({ type: 'error', text: '❌ ' + (error.message || 'Failed to change password') })
    } finally {
      setChangingPassword(false)
    }
  }

  // Handle forgot password (send reset email via Gmail)
  const [sendingResetEmail, setSendingResetEmail] = useState(false)

  const handleForgotPassword = async () => {
    if (!user?.email) {
      setMessage({ type: 'error', text: 'No email found for this account' })
      return
    }

    setSendingResetEmail(true)
    setMessage(null)

    try {
      const response = await fetch('/api/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email })
      })

      const data = await parseJsonSafely(response)

      if (!data) {
        throw new Error('Unexpected response from password reset service')
      }

      if (data.success) {
        setMessage({ type: 'success', text: '✅ Password reset email sent! Check your inbox.' })
      } else {
        throw new Error(data.error || 'Failed to send reset email')
      }
    } catch (error: any) {
      console.error('Reset password error:', error)
      setMessage({ type: 'error', text: '❌ ' + (error.message || 'Failed to send reset email') })
    } finally {
      setSendingResetEmail(false)
    }
  }

  // Handle logout
  const handleLogout = async () => {
    try {
      localStorage.removeItem('faculty_session_token')
      localStorage.removeItem('faculty_keep_signed_in')
      await supabase.auth.signOut()
      router.push('/')
    } catch (error) {
      console.error('Logout error:', error)
      router.push('/')
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
    <div className={`${styles.pageContainer} faculty-page-wrapper`} data-theme={theme} data-college-theme={collegeTheme}>
      {/* Sidebar */}
      <FacultySidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        menuBarHidden={isMenuBarHidden}
      />

      {/* Main Layout */}
      <div className={`flex-1 flex flex-col min-h-screen w-full box-border transition-all duration-300 ${sidebarOpen ? 'md:pl-[250px]' : ''}`}>
        {/* Faculty Menu Bar */}
        <FacultyMenuBar
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          sidebarOpen={sidebarOpen}
          isHidden={isMenuBarHidden}
          onToggleHidden={setIsMenuBarHidden}
          userEmail={user?.email}
        />

        {showProfileMenu && (
          <div className={styles.profileMenuWrapper}>
            <div
              className={styles.profileMenuBackdrop}
              onClick={() => setShowProfileMenu(false)}
            />
            <div className={styles.profileMenu}>
              <button
                className={styles.profileMenuItem}
                onClick={(e) => {
                  e.stopPropagation()
                  setShowProfileMenu(false)
                  setShowSettingsModal(true)
                }}
                type="button"
              >
                <Settings size={16} />
                <span>Settings</span>
              </button>
              <button
                className={styles.profileMenuItem}
                onClick={(e) => {
                  e.stopPropagation()
                  setShowProfileMenu(false)
                  handleLogout()
                }}
                type="button"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className={`${styles.mainContent} ${isMenuBarHidden ? 'pt-10 sm:pt-12' : 'pt-16 sm:pt-20 md:pt-24'}`}>
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
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt="Profile"
                    className={styles.avatarImage}
                  />
                ) : (
                  <User size={60} />
                )}
                {/* Hidden file input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  style={{ display: 'none' }}
                />
                <button
                  className={styles.avatarEditBtn}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  title="Upload profile image"
                >
                  {uploadingImage ? (
                    <span className={styles.btnSpinner}></span>
                  ) : (
                    <Camera size={16} />
                  )}
                </button>
              </div>
              <div className={styles.avatarInfo}>
                <h1>{user?.full_name || 'Faculty Member'}</h1>
                <p className={styles.email}>{user?.email}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <span className={styles.roleBadge}>{user?.position || 'Faculty'}</span>
                  {user?.college && (
                    <span style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      padding: '4px 10px',
                      background: 'rgba(16, 185, 129, 0.1)',
                      borderRadius: '12px',
                      border: '1px solid rgba(16, 185, 129, 0.2)'
                    }}>
                      {user.college}
                    </span>
                  )}
                </div>
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

            {/* Password & Security Section */}
            <div className={styles.scheduleSection}>
              <h2 className={styles.sectionTitle}>
                <Lock size={20} />
                Password & Security
              </h2>

              {!showPasswordChange ? (
                <div className={styles.securityActions}>
                  <button
                    className={styles.changePasswordBtn}
                    onClick={() => setShowPasswordChange(true)}
                  >
                    <Key size={18} />
                    Change Password
                  </button>
                  <button
                    className={styles.forgotPasswordBtn}
                    onClick={handleForgotPassword}
                    disabled={sendingResetEmail}
                  >
                    <Mail size={18} />
                    {sendingResetEmail ? 'Sending...' : 'Send Password Reset Email'}
                  </button>
                </div>
              ) : (
                <div className={styles.passwordChangeForm}>
                  <div className={styles.formGroup}>
                    <label>
                      <Lock size={16} />
                      New Password
                    </label>
                    <div className={styles.passwordInputWrapper}>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        placeholder="Enter new password (min 6 characters)"
                      />
                      <button
                        type="button"
                        className={styles.passwordToggle}
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label>
                      <Lock size={16} />
                      Confirm Password
                    </label>
                    <div className={styles.passwordInputWrapper}>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        placeholder="Confirm new password"
                      />
                      <button
                        type="button"
                        className={styles.passwordToggle}
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div className={styles.passwordActions}>
                    <button
                      className={styles.cancelBtn}
                      onClick={() => {
                        setShowPasswordChange(false)
                        setPasswordForm({ newPassword: '', confirmPassword: '' })
                      }}
                      disabled={changingPassword}
                    >
                      <X size={18} />
                      Cancel
                    </button>
                    <button
                      className={styles.saveBtn}
                      onClick={handlePasswordChange}
                      disabled={changingPassword}
                    >
                      {changingPassword ? <span className={styles.btnSpinner}></span> : <Key size={18} />}
                      {changingPassword ? 'Changing...' : 'Change Password'}
                    </button>
                  </div>
                </div>
              )}
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

      {/* Settings Modal */}
      <FacultySettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </div>
  )
}
