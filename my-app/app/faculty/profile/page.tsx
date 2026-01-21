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
  LogOut
} from 'lucide-react'
import styles from './styles.module.css'

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

export default function FacultyProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [editForm, setEditForm] = useState<UserProfile | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL

  useEffect(() => {
    checkAuthAndLoad()
    fetchDepartments()
  }, [])

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

      // Get additional profile data if exists
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single() as { data: { contact_phone?: string; office_location?: string; bio?: string; specialization?: string } | null; error: any }

      const fullProfile: UserProfile = {
        ...userData,
        phone: profileData?.contact_phone || userData.phone || '',
        office_location: profileData?.office_location || '',
        bio: profileData?.bio || '',
        specialization: profileData?.specialization || ''
      }

      setUser(fullProfile)
      setEditForm(fullProfile)

    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/faculty/login')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!editForm || !user) return

    setSaving(true)
    setMessage(null)

    try {
      // Update users table (only columns that exist: full_name, phone)
      const updateData = {
        full_name: editForm.full_name,
        phone: editForm.phone,
        updated_at: new Date().toISOString()
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: userError } = await (supabase as any)
        .from('users')
        .update(updateData)
        .eq('id', user.id)

      if (userError) throw userError

      // Upsert user_profiles table for extended profile data
      const profileData = {
        user_id: user.id,
        office_location: editForm.office_location,
        bio: editForm.bio,
        specialization: editForm.specialization,
        updated_at: new Date().toISOString()
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: profileError } = await (supabase as any)
        .from('user_profiles')
        .upsert(profileData, { onConflict: 'user_id' })

      if (profileError) {
        console.error('Profile update error:', profileError)
        // Don't fail if user_profiles doesn't exist
      }

      setUser(editForm)
      setEditing(false)
      setMessage({ type: 'success', text: '✅ Profile updated successfully!' })

    } catch (error: any) {
      console.error('Save error:', error)
      setMessage({ type: 'error', text: '❌ Failed to update profile: ' + error.message })
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditForm(user)
    setEditing(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/faculty/login')
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
        <button className={styles.logoutBtn} onClick={handleLogout}>
          <LogOut size={18} />
          <span>Logout</span>
        </button>
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
              </label>
              {editing ? (
                <input
                  type="text"
                  value={editForm?.full_name || ''}
                  onChange={(e) => setEditForm({ ...editForm!, full_name: e.target.value })}
                  placeholder="Your full name"
                />
              ) : (
                <p>{user?.full_name || 'Not set'}</p>
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
        </div>
      </main>
    </div>
  )
}
