'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FaUser, FaEnvelope, FaShieldAlt, FaKey, FaEye, FaEyeSlash, FaEdit, FaTimes, FaSave, FaArrowLeft } from 'react-icons/fa'
import { supabase } from '@/lib/supabaseClient'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import styles from './styles.module.css'

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: ''
  })
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    checkAuth()
    fetchUserData()
  }, [])

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
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/')
    }
  }

  const fetchUserData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const userData = {
          email: authUser.email,
          full_name: authUser.user_metadata?.full_name || 'Admin User',
          role: 'Admin',
          avatar_url: authUser.user_metadata?.avatar_url || null
        }
        setUser(userData)
        setEditForm({
          full_name: userData.full_name,
          email: userData.email || ''
        })
      }
    } catch (error) {
      console.error('Error fetching user:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEditProfile = async () => {
    setError('')
    setSuccess('')

    if (!editForm.full_name) {
      setError('Full name is required')
      return
    }

    setSaving(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { full_name: editForm.full_name }
      })

      if (updateError) throw updateError

      setSuccess('Profile updated successfully!')
      await fetchUserData()

      setTimeout(() => {
        setShowEditModal(false)
        setSuccess('')
      }, 1500)
    } catch (error: any) {
      setError(error.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async () => {
    setPasswordError('')
    setPasswordSuccess('')

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required')
      return
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }

    setChangingPassword(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error

      setPasswordSuccess('Password changed successfully!')
      setTimeout(() => {
        setShowPasswordModal(false)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setPasswordSuccess('')
      }, 2000)
    } catch (error: any) {
      setPasswordError(error.message || 'Failed to change password')
    } finally {
      setChangingPassword(false)
    }
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        color: 'var(--text-primary)'
      }}>
        Loading...
      </div>
    )
  }

  return (
    <div data-page="admin">
      <MenuBar
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        showSidebarToggle={true}
        setSidebarOpen={setSidebarOpen}
      />
      <Sidebar isOpen={sidebarOpen} />

      <div className={`${styles['profile-container']} ${sidebarOpen ? styles['with-sidebar'] : ''}`}>
        <button
          className={styles['back-button']}
          onClick={() => router.back()}
        >
          <FaArrowLeft />
          Back
        </button>

        <div className={styles['profile-header-section']}>
          <h1 className={styles['profile-title']}>Profile</h1>
          <p className={styles['profile-subtitle']}>Manage your account information</p>
        </div>

        {/* Profile Header Card */}
        <div className={styles['profile-card']}>
          <div className={styles['card-header']}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <FaUser className={styles['card-icon']} />
              <h2>Profile Information</h2>
            </div>
            <button
              className={styles['edit-profile-btn']}
              onClick={() => setShowEditModal(true)}
            >
              <FaEdit />
              Edit Profile
            </button>
          </div>

          <div className={styles['profile-content']}>
            {/* Avatar Section */}
            <div className={styles['avatar-section']}>
              <div className={styles['avatar-container']}>
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="Profile" className={styles['avatar-image']} />
                ) : (
                  <div className={styles['avatar-placeholder']}>
                    <FaUser size={48} />
                  </div>
                )}
              </div>
            </div>

            {/* User Info */}
            <div className={styles['info-grid']}>
              <div className={styles['info-item']}>
                <label className={styles['info-label']}>
                  <FaUser className={styles['info-icon']} />
                  Full Name
                </label>
                <div className={styles['info-value']}>{user?.full_name}</div>
              </div>

              <div className={styles['info-item']}>
                <label className={styles['info-label']}>
                  <FaShieldAlt className={styles['info-icon']} />
                  Role
                </label>
                <div className={styles['role-badge']}>
                  <span className={styles['badge-admin']}>Admin</span>
                </div>
              </div>

              <div className={`${styles['info-item']} ${styles['full-width']}`}>
                <label className={styles['info-label']}>
                  <FaEnvelope className={styles['info-icon']} />
                  Email Address
                </label>
                <div className={styles['info-value']}>{user?.email}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Account Security Card */}
        <div className={styles['profile-card']}>
          <div className={styles['card-header']}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <FaKey className={styles['card-icon']} />
              <h2>Account Security</h2>
            </div>
          </div>

          <div className={styles['profile-content']}>
            <p className={styles['security-description']}>
              Keep your account secure by using a strong password
            </p>
            <button
              className={styles['change-password-btn']}
              onClick={() => setShowPasswordModal(true)}
            >
              <FaKey />
              Change Password
            </button>
          </div>
        </div>

        {/* Edit Profile Modal */}
        {showEditModal && (
          <div className={styles['modal-overlay']}>
            <div className={styles['floating-modal']}>
              <div className={styles['floating-modal-header']}>
                <h2>
                  <FaEdit className={styles['modal-icon']} />
                  Edit Profile
                </h2>
                <button
                  className={styles['modal-close-btn']}
                  onClick={() => setShowEditModal(false)}
                >
                  <FaTimes />
                </button>
              </div>

              <div className={styles['floating-modal-body']}>
                {error && (
                  <div className={`${styles.alert} ${styles['alert-error']}`}>{error}</div>
                )}
                {success && (
                  <div className={`${styles.alert} ${styles['alert-success']}`}>{success}</div>
                )}

                <div className={styles['form-group']}>
                  <label>
                    <FaUser style={{ marginRight: '6px' }} />
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={editForm.full_name}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                    placeholder="Enter your full name"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '2px solid var(--input-border)',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: 'var(--input-text)',
                      background: 'var(--input-bg)'
                    }}
                  />
                </div>

                <div className={styles['form-group']}>
                  <label>
                    <FaEnvelope style={{ marginRight: '6px' }} />
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editForm.email}
                    disabled
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '2px solid var(--input-border)',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: 'var(--text-secondary)',
                      background: 'var(--bg-gray-100)',
                      cursor: 'not-allowed'
                    }}
                  />
                  <small style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    Email cannot be changed
                  </small>
                </div>
              </div>

              <div className={styles['floating-modal-footer']}>
                <button
                  className={styles['btn-cancel']}
                  onClick={() => setShowEditModal(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  className={styles['btn-save']}
                  onClick={handleEditProfile}
                  disabled={saving}
                >
                  <FaSave />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Change Password Modal */}
        {showPasswordModal && (
          <div className={styles['modal-overlay']}>
            <div className={styles['floating-modal']}>
              <div className={styles['floating-modal-header']}>
                <h2>
                  <FaKey className={styles['modal-icon']} />
                  Change Password
                </h2>
                <button
                  className={styles['modal-close-btn']}
                  onClick={() => setShowPasswordModal(false)}
                >
                  <FaTimes />
                </button>
              </div>

              <div className={styles['floating-modal-body']}>
                {passwordError && (
                  <div className={`${styles.alert} ${styles['alert-error']}`}>{passwordError}</div>
                )}
                {passwordSuccess && (
                  <div className={`${styles.alert} ${styles['alert-success']}`}>{passwordSuccess}</div>
                )}

                <div className={styles['form-group']}>
                  <label>Current Password</label>
                  <div className={styles['password-input-wrapper']}>
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      style={{
                        width: '100%',
                        padding: '12px 44px 12px 14px',
                        border: '2px solid var(--input-border)',
                        borderRadius: '10px',
                        fontSize: '14px',
                        color: 'var(--input-text)',
                        background: 'var(--input-bg)'
                      }}
                    />
                    <button
                      type="button"
                      className={styles['password-toggle']}
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                </div>

                <div className={styles['form-group']}>
                  <label>New Password</label>
                  <div className={styles['password-input-wrapper']}>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password (min 6 characters)"
                      style={{
                        width: '100%',
                        padding: '12px 44px 12px 14px',
                        border: '2px solid var(--input-border)',
                        borderRadius: '10px',
                        fontSize: '14px',
                        color: 'var(--input-text)',
                        background: 'var(--input-bg)'
                      }}
                    />
                    <button
                      type="button"
                      className={styles['password-toggle']}
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                </div>

                <div className={styles['form-group']}>
                  <label>Confirm New Password</label>
                  <div className={styles['password-input-wrapper']}>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      style={{
                        width: '100%',
                        padding: '12px 44px 12px 14px',
                        border: '2px solid var(--input-border)',
                        borderRadius: '10px',
                        fontSize: '14px',
                        color: 'var(--input-text)',
                        background: 'var(--input-bg)'
                      }}
                    />
                    <button
                      type="button"
                      className={styles['password-toggle']}
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles['floating-modal-footer']}>
                <button
                  className={styles['btn-cancel']}
                  onClick={() => setShowPasswordModal(false)}
                  disabled={changingPassword}
                >
                  Cancel
                </button>
                <button
                  className={styles['btn-save']}
                  onClick={handlePasswordChange}
                  disabled={changingPassword}
                >
                  <FaKey />
                  {changingPassword ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
