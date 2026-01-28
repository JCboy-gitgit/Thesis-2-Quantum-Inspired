'use client'

import React, { useState, useEffect } from 'react'
import { FaUser, FaEnvelope, FaShieldAlt, FaKey, FaEye, FaEyeSlash, FaEdit, FaTimes, FaSave } from 'react-icons/fa'
import { supabase } from '@/lib/supabaseClient'
import './ProfileModal.css'

interface ProfileModalProps {
    isOpen: boolean
    onClose: () => void
}

function ProfileModalContent({ onClose }: { onClose: () => void }) {
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)
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
        fetchUserData()
    }, [])

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

    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget && !showEditModal && !showPasswordModal) {
            onClose()
        }
    }

    if (loading) {
        return (
            <div className="profile-modal-overlay">
                <div className="profile-modal">
                    <div className="profile-modal-loading">
                        <div className="profile-spinner"></div>
                        <p>Loading profile...</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="profile-modal-overlay" onClick={handleOverlayClick}>
            <div className="profile-modal">
                <div className="profile-modal-header">
                    <h2 className="profile-modal-title">
                        <FaUser />
                        Profile
                    </h2>
                    <button className="profile-modal-close" onClick={onClose}>
                        <FaTimes />
                    </button>
                </div>

                <div className="profile-modal-content">
                    {/* Avatar Section */}
                    <div className="profile-avatar-section">
                        <div className="profile-avatar">
                            {user?.avatar_url ? (
                                <img src={user.avatar_url} alt="Profile" />
                            ) : (
                                <FaUser size={40} />
                            )}
                        </div>
                        <div className="profile-user-info">
                            <h3>{user?.full_name}</h3>
                            <span className="profile-role-badge">Admin</span>
                        </div>
                    </div>

                    {/* Profile Info Card */}
                    <div className="profile-info-card">
                        <div className="profile-info-header">
                            <FaUser />
                            <span>Profile Information</span>
                            <button className="profile-edit-btn" onClick={() => setShowEditModal(true)}>
                                <FaEdit /> Edit
                            </button>
                        </div>
                        <div className="profile-info-grid">
                            <div className="profile-info-item">
                                <label><FaUser /> Full Name</label>
                                <div className="profile-info-value">{user?.full_name}</div>
                            </div>
                            <div className="profile-info-item">
                                <label><FaEnvelope /> Email</label>
                                <div className="profile-info-value">{user?.email}</div>
                            </div>
                            <div className="profile-info-item">
                                <label><FaShieldAlt /> Role</label>
                                <div className="profile-info-value">Administrator</div>
                            </div>
                        </div>
                    </div>

                    {/* Security Card */}
                    <div className="profile-info-card">
                        <div className="profile-info-header">
                            <FaKey />
                            <span>Account Security</span>
                        </div>
                        <p className="profile-security-text">
                            Keep your account secure by using a strong password
                        </p>
                        <button className="profile-change-password-btn" onClick={() => setShowPasswordModal(true)}>
                            <FaKey /> Change Password
                        </button>
                    </div>
                </div>

                <div className="profile-modal-footer">
                    <button className="profile-done-btn" onClick={onClose}>
                        Done
                    </button>
                </div>

                {/* Edit Profile Sub-Modal */}
                {showEditModal && (
                    <div className="profile-sub-modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowEditModal(false)}>
                        <div className="profile-sub-modal">
                            <div className="profile-sub-modal-header">
                                <h3><FaEdit /> Edit Profile</h3>
                                <button onClick={() => setShowEditModal(false)}><FaTimes /></button>
                            </div>
                            <div className="profile-sub-modal-body">
                                {error && <div className="profile-alert error">{error}</div>}
                                {success && <div className="profile-alert success">{success}</div>}

                                <div className="profile-form-group">
                                    <label><FaUser /> Full Name *</label>
                                    <input
                                        type="text"
                                        value={editForm.full_name}
                                        onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                                        placeholder="Enter your full name"
                                    />
                                </div>

                                <div className="profile-form-group">
                                    <label><FaEnvelope /> Email Address</label>
                                    <input
                                        type="email"
                                        value={editForm.email}
                                        disabled
                                        className="disabled"
                                    />
                                    <small>Email cannot be changed</small>
                                </div>
                            </div>
                            <div className="profile-sub-modal-footer">
                                <button className="cancel-btn" onClick={() => setShowEditModal(false)} disabled={saving}>
                                    Cancel
                                </button>
                                <button className="save-btn" onClick={handleEditProfile} disabled={saving}>
                                    <FaSave /> {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Change Password Sub-Modal */}
                {showPasswordModal && (
                    <div className="profile-sub-modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowPasswordModal(false)}>
                        <div className="profile-sub-modal">
                            <div className="profile-sub-modal-header">
                                <h3><FaKey /> Change Password</h3>
                                <button onClick={() => setShowPasswordModal(false)}><FaTimes /></button>
                            </div>
                            <div className="profile-sub-modal-body">
                                {passwordError && <div className="profile-alert error">{passwordError}</div>}
                                {passwordSuccess && <div className="profile-alert success">{passwordSuccess}</div>}

                                <div className="profile-form-group">
                                    <label>Current Password</label>
                                    <div className="password-input-wrapper">
                                        <input
                                            type={showCurrentPassword ? 'text' : 'password'}
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            placeholder="Enter current password"
                                        />
                                        <button type="button" className="password-toggle" onClick={() => setShowCurrentPassword(!showCurrentPassword)}>
                                            {showCurrentPassword ? <FaEyeSlash /> : <FaEye />}
                                        </button>
                                    </div>
                                </div>

                                <div className="profile-form-group">
                                    <label>New Password</label>
                                    <div className="password-input-wrapper">
                                        <input
                                            type={showNewPassword ? 'text' : 'password'}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="Enter new password (min 6 characters)"
                                        />
                                        <button type="button" className="password-toggle" onClick={() => setShowNewPassword(!showNewPassword)}>
                                            {showNewPassword ? <FaEyeSlash /> : <FaEye />}
                                        </button>
                                    </div>
                                </div>

                                <div className="profile-form-group">
                                    <label>Confirm New Password</label>
                                    <div className="password-input-wrapper">
                                        <input
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="Confirm new password"
                                        />
                                        <button type="button" className="password-toggle" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                                            {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="profile-sub-modal-footer">
                                <button className="cancel-btn" onClick={() => setShowPasswordModal(false)} disabled={changingPassword}>
                                    Cancel
                                </button>
                                <button className="save-btn" onClick={handlePasswordChange} disabled={changingPassword}>
                                    <FaKey /> {changingPassword ? 'Changing...' : 'Change Password'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
    if (!isOpen) return null

    return <ProfileModalContent onClose={onClose} />
}
