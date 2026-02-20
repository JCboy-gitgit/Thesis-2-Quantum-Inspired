'use client'

import React, { useState } from 'react'
import { MdClose as X, MdDarkMode as Moon, MdLightMode as Sun, MdEco as Leaf, MdMonitor as Monitor, MdDomain as Building2, MdAdd as Plus, MdEdit as Edit2, MdDelete as Trash2, MdCheck as Check, MdDragIndicator as GripVertical, MdToggleOff as ToggleLeft, MdToggleOn as ToggleRight, MdCheckCircle as CheckCircle, MdEdit as Edit } from 'react-icons/md'
import { useTheme } from '../context/ThemeContext'
import { useColleges, BulSUCollege } from '../context/CollegesContext'
import './SettingsModal.css'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

// Inner component that uses the theme hook - only rendered when modal is open
function SettingsModalContent({ onClose }: { onClose: () => void }) {
  const { theme, setTheme } = useTheme()
  const { colleges, activeColleges, loading, isDefault, addCollege, updateCollege, deleteCollege, refreshColleges } = useColleges()

  // College management state
  const [showCollegeForm, setShowCollegeForm] = useState(false)
  const [editingCollege, setEditingCollege] = useState<BulSUCollege | null>(null)
  const [collegeForm, setCollegeForm] = useState({ code: '', name: '', short_name: '' })
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // Reset college form
  const resetCollegeForm = () => {
    setCollegeForm({ code: '', name: '', short_name: '' })
    setEditingCollege(null)
    setShowCollegeForm(false)
  }

  // Handle add/edit college
  const handleSaveCollege = async () => {
    if (!collegeForm.code || !collegeForm.name) {
      alert('College code and name are required')
      return
    }

    setSaving(true)
    try {
      if (editingCollege) {
        await updateCollege({
          id: editingCollege.id,
          code: collegeForm.code,
          name: collegeForm.name,
          short_name: collegeForm.short_name || undefined
        })
      } else {
        await addCollege({
          code: collegeForm.code,
          name: collegeForm.name,
          short_name: collegeForm.short_name || undefined,
          is_active: true,
          display_order: colleges.length + 1
        })
      }
      resetCollegeForm()
    } catch (err) {
      console.error('Error saving college:', err)
    } finally {
      setSaving(false)
    }
  }

  // Handle edit click
  const handleEditClick = (college: BulSUCollege) => {
    setEditingCollege(college)
    setCollegeForm({
      code: college.code,
      name: college.name,
      short_name: college.short_name || ''
    })
    setShowCollegeForm(true)
  }

  // Handle delete
  const handleDeleteCollege = async (id: number) => {
    await deleteCollege(id)
    setDeleteConfirm(null)
  }

  // Toggle college active status
  const handleToggleActive = async (college: BulSUCollege) => {
    await updateCollege({
      id: college.id,
      is_active: !college.is_active
    })
  }

  return (
    <div className="settings-overlay" onClick={handleOverlayClick}>
      <div className="settings-modal settings-modal-large">
        <div className="settings-header">
          <h2 className="settings-title">
            <Monitor size={24} />
            Settings
          </h2>
          <button className="settings-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="settings-content">
          {/* Appearance Section */}
          <div className="settings-section">
            <h3 className="settings-section-title">Appearance</h3>
            <p className="settings-section-description">
              Choose your preferred theme for the application
            </p>

            <div className="theme-options">
              <button
                className={`theme-option ${theme === 'green' ? 'active' : ''}`}
                onClick={() => setTheme('green')}
              >
                <div className="theme-preview green-preview">
                  <div className="leaf-container">
                    <Leaf className="leaf leaf-1" size={16} />
                    <Leaf className="leaf leaf-2" size={12} />
                    <Leaf className="leaf leaf-3" size={14} />
                    <Leaf className="leaf leaf-main" size={22} />
                  </div>
                </div>
                <span className="theme-name">Green (Default)</span>
                <span className="theme-description">College of Science theme</span>
                {theme === 'green' && <span className="theme-active-badge">Active</span>}
              </button>

              <button
                className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => setTheme('dark')}
              >
                <div className="theme-preview dark-preview">
                  <div className="moon-container">
                    <Moon className="moon-icon" size={22} />
                    <span className="star star-1">✦</span>
                    <span className="star star-2">✧</span>
                    <span className="star star-3">✦</span>
                  </div>
                </div>
                <span className="theme-name">Dark Mode</span>
                <span className="theme-description">Easy on the eyes</span>
                {theme === 'dark' && <span className="theme-active-badge">Active</span>}
              </button>

              <button
                className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                onClick={() => setTheme('light')}
              >
                <div className="theme-preview light-preview">
                  <div className="sun-container">
                    <Sun className="sun-icon" size={22} />
                    <div className="cloud cloud-1">☁</div>
                    <div className="cloud cloud-2">☁</div>
                  </div>
                </div>
                <span className="theme-name">Light Mode</span>
                <span className="theme-description">Classic bright look</span>
                {theme === 'light' && <span className="theme-active-badge">Active</span>}
              </button>
            </div>
          </div>

          {/* BulSU Colleges Section */}
          <div className="settings-section colleges-section">
            <div className="colleges-header">
              <div>
                <h3 className="settings-section-title">
                  <Building2 size={18} />
                  BulSU Colleges
                </h3>
                <p className="settings-section-description">
                  Manage the list of colleges used across the application
                  {isDefault && <span className="default-badge">Using Defaults</span>}
                </p>
              </div>
              <button
                className="add-college-btn"
                onClick={() => {
                  resetCollegeForm()
                  setShowCollegeForm(true)
                }}
              >
                <Plus size={16} />
                Add College
              </button>
            </div>

            {/* Add/Edit Form */}
            {showCollegeForm && (
              <div className="college-form">
                <h4>{editingCollege ? 'Edit College' : 'Add New College'}</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Code *</label>
                    <input
                      type="text"
                      value={collegeForm.code}
                      onChange={e => setCollegeForm({ ...collegeForm, code: e.target.value.toUpperCase() })}
                      placeholder="e.g., CS"
                      maxLength={10}
                    />
                  </div>
                  <div className="form-group">
                    <label>Short Name</label>
                    <input
                      type="text"
                      value={collegeForm.short_name}
                      onChange={e => setCollegeForm({ ...collegeForm, short_name: e.target.value })}
                      placeholder="e.g., Science"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    value={collegeForm.name}
                    onChange={e => setCollegeForm({ ...collegeForm, name: e.target.value })}
                    placeholder="e.g., College of Science"
                  />
                </div>
                <div className="form-actions">
                  <button className="btn-cancel" onClick={resetCollegeForm}>Cancel</button>
                  <button className="btn-save" onClick={handleSaveCollege} disabled={saving}>
                    {saving ? 'Saving...' : (editingCollege ? 'Update' : 'Add College')}
                  </button>
                </div>
              </div>
            )}

            {/* Colleges List */}
            <div className="colleges-list">
              {loading ? (
                <div className="loading-colleges">Loading colleges...</div>
              ) : (
                colleges.map((college, index) => (
                  <div
                    key={college.id}
                    className={`college-item ${!college.is_active ? 'inactive' : ''}`}
                  >
                    <div className="college-drag">
                      <GripVertical size={16} />
                    </div>
                    <div className="college-info">
                      <span className="college-code">{college.code}</span>
                      <span className="college-name">{college.name}</span>
                      {college.short_name && (
                        <span className="college-short">({college.short_name})</span>
                      )}
                    </div>
                    <div className="college-actions">
                      <button
                        className="action-btn toggle-btn"
                        onClick={() => handleToggleActive(college)}
                        title={college.is_active ? 'Disable' : 'Enable'}
                      >
                        {college.is_active ? (
                          <ToggleRight size={20} className="toggle-on" />
                        ) : (
                          <ToggleLeft size={20} className="toggle-off" />
                        )}
                      </button>
                      <button
                        className="action-btn edit-btn"
                        onClick={() => handleEditClick(college)}
                        title="Edit"
                      >
                        <Edit size={16} />
                      </button>
                      {deleteConfirm === college.id ? (
                        <>
                          <button
                            className="action-btn confirm-btn"
                            onClick={() => handleDeleteCollege(college.id)}
                            title="Confirm Delete"
                          >
                            <CheckCircle size={16} />
                          </button>
                          <button
                            className="action-btn cancel-btn"
                            onClick={() => setDeleteConfirm(null)}
                            title="Cancel"
                          >
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <button
                          className="action-btn delete-btn"
                          onClick={() => setDeleteConfirm(college.id)}
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="colleges-footer">
              <span className="colleges-count">
                {activeColleges.length} active / {colleges.length} total colleges
              </span>
              <button className="refresh-btn" onClick={refreshColleges}>
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="settings-footer">
          <button className="settings-done-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  if (!isOpen) return null

  return <SettingsModalContent onClose={onClose} />
}
