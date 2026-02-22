'use client'

import React, { useState, useEffect } from 'react'
import { MdLabel as Tag, MdAdd as Plus, MdEdit as Edit, MdDelete as Trash2, MdCheck as Check, MdClose as X, MdSearch as Search, MdCategory as Category, MdInfo as Info, MdMonitor as MonitorSpeaker, MdScience as Beaker, MdChair as Armchair, MdShield as Shield, MdAccessibility as Accessibility, MdInventory as Package, MdFitnessCenter as Dumbbell, MdLoop as Loader2 } from 'react-icons/md'
import styles from './FeatureTagsManager.module.css' // Reusing some styles if possible, or I'll use SettingsModal styles

interface FeatureTag {
    id: number
    tag_name: string
    tag_category: string
    description?: string
    icon?: string
}

const CATEGORIES = [
    { id: 'technology', label: 'Technology', icon: <MonitorSpeaker size={16} />, color: '#3b82f6' },
    { id: 'equipment_physics', label: 'Physics Equipment', icon: <Beaker size={16} />, color: '#8b5cf6' },
    { id: 'equipment_chemistry', label: 'Chemistry Equipment', icon: <Beaker size={16} />, color: '#10b981' },
    { id: 'equipment_biology', label: 'Biology Equipment', icon: <Beaker size={16} />, color: '#22c55e' },
    { id: 'equipment_engineering', label: 'Engineering Equipment', icon: <Beaker size={16} />, color: '#f97316' },
    { id: 'equipment', label: 'General Equipment', icon: <Beaker size={16} />, color: '#6366f1' },
    { id: 'furniture', label: 'Furniture', icon: <Armchair size={16} />, color: '#a855f7' },
    { id: 'safety', label: 'Safety', icon: <Shield size={16} />, color: '#ef4444' },
    { id: 'accessibility', label: 'Accessibility', icon: <Accessibility size={16} />, color: '#06b6d4' },
    { id: 'extracurricular', label: 'Extracurricular / PE', icon: <Dumbbell size={16} />, color: '#f59e0b' },
    { id: 'general', label: 'General', icon: <Package size={16} />, color: '#64748b' }
]

export default function GlobalTagsSettings() {
    const [tags, setTags] = useState<FeatureTag[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [editingTag, setEditingTag] = useState<FeatureTag | null>(null)
    const [saving, setSaving] = useState(false)
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

    const [formData, setFormData] = useState({
        tag_name: '',
        tag_category: 'general',
        description: ''
    })

    useEffect(() => {
        fetchTags()
    }, [])

    const fetchTags = async () => {
        setLoading(true)
        try {
            const response = await fetch('/api/room-features?action=tags')
            const data = await response.json()
            if (data.success) {
                setTags(data.data)
            }
        } catch (err) {
            console.error('Error fetching tags:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleResetForm = () => {
        setFormData({ tag_name: '', tag_category: 'general', description: '' })
        setEditingTag(null)
        setShowForm(false)
    }

    const handleEditClick = (tag: FeatureTag) => {
        setEditingTag(tag)
        setFormData({
            tag_name: tag.tag_name,
            tag_category: tag.tag_category,
            description: tag.description || ''
        })
        setShowForm(true)
    }

    const handleSave = async () => {
        if (!formData.tag_name) {
            alert('Tag name is required')
            return
        }

        setSaving(true)
        try {
            const action = editingTag ? 'update_tag' : 'create_tag'
            const payload = {
                action,
                id: editingTag?.id,
                ...formData
            }

            const response = await fetch('/api/room-features', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            const data = await response.json()
            if (data.success) {
                await fetchTags()
                handleResetForm()
            } else {
                alert('Error: ' + data.error)
            }
        } catch (err) {
            console.error('Error saving tag:', err)
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: number) => {
        try {
            const response = await fetch(`/api/room-features?action=delete_tag&id=${id}`, {
                method: 'DELETE'
            })
            const data = await response.json()
            if (data.success) {
                await fetchTags()
                setDeleteConfirm(null)
            } else {
                alert('Error: ' + data.error)
            }
        } catch (err) {
            console.error('Error deleting tag:', err)
        }
    }

    const filteredTags = tags.filter(tag =>
        tag.tag_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tag.tag_category.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const groupedTags = filteredTags.reduce((acc, tag) => {
        const cat = tag.tag_category
        if (!acc[cat]) acc[cat] = []
        acc[cat].push(tag)
        return acc
    }, {} as Record<string, FeatureTag[]>)

    return (
        <div className="settings-section tags-management-section">
            <div className="colleges-header">
                <div>
                    <h3 className="settings-section-title">
                        <Tag size={18} />
                        Equipment & Feature Tags
                    </h3>
                    <p className="settings-section-description">
                        Manage the list of equipment, features, and accessibility tags used across the campus
                    </p>
                </div>
                <button
                    className="add-college-btn"
                    onClick={() => {
                        handleResetForm()
                        setShowForm(true)
                    }}
                >
                    <Plus size={16} />
                    Add New Tag
                </button>
            </div>

            {showForm && (
                <div className="college-form">
                    <h4>{editingTag ? 'Edit Tag' : 'Create New Tag'}</h4>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Tag Name *</label>
                            <input
                                type="text"
                                value={formData.tag_name}
                                onChange={e => setFormData({ ...formData, tag_name: e.target.value })}
                                placeholder="e.g., Projector, Wi-Fi 6"
                            />
                        </div>
                        <div className="form-group">
                            <label>Category</label>
                            <select
                                value={formData.tag_category}
                                onChange={e => setFormData({ ...formData, tag_category: e.target.value })}
                            >
                                {CATEGORIES.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Description (Optional)</label>
                        <textarea
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Describe what this equipment or feature is..."
                            rows={2}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', marginTop: '0.5rem' }}
                        />
                    </div>
                    <div className="form-actions">
                        <button className="btn-cancel" onClick={handleResetForm}>Cancel</button>
                        <button className="btn-save" onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving...' : (editingTag ? 'Update Tag' : 'Create Tag')}
                        </button>
                    </div>
                </div>
            )}

            <div className="search-filter-row" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                <div className="search-input-wrapper" style={{ position: 'relative', flex: 1 }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                    <input
                        type="text"
                        placeholder="Search tags by name or category..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    />
                </div>
            </div>

            <div className="tags-list-container" style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' }}>
                {loading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: '10px' }}>
                        <Loader2 className="spinner" size={24} />
                        <span>Loading tags...</span>
                    </div>
                ) : (
                    Object.entries(groupedTags).sort().map(([category, catTags]) => (
                        <div key={category} className="tag-group" style={{ marginBottom: '1.5rem' }}>
                            <div className="tag-group-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', opacity: 0.8 }}>
                                {CATEGORIES.find(c => c.id === category)?.icon || <Package size={16} />}
                                <span style={{ fontWeight: 600, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {CATEGORIES.find(c => c.id === category)?.label || category}
                                </span>
                                <span style={{ fontSize: '0.8rem', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '10px' }}>{catTags.length}</span>
                            </div>
                            <div className="tag-items-grid">
                                {catTags.map(tag => (
                                    <div
                                        key={tag.id}
                                        className="tag-item-admin"
                                    >
                                        <div className="tag-item-info">
                                            <span className="tag-item-info-name">{tag.tag_name}</span>
                                            {tag.description && <span className="tag-item-info-desc">{tag.description}</span>}
                                        </div>
                                        <div className="tag-item-actions" style={{ display: 'flex', gap: '4px' }}>
                                            <button
                                                className="action-btn edit-btn"
                                                onClick={() => handleEditClick(tag)}
                                            >
                                                <Edit size={14} />
                                            </button>
                                            {deleteConfirm === tag.id ? (
                                                <div style={{ display: 'flex', gap: '2px' }}>
                                                    <button className="confirm-delete-btn" onClick={() => handleDelete(tag.id)}><Check size={14} /></button>
                                                    <button className="cancel-delete-btn" onClick={() => setDeleteConfirm(null)}><X size={14} /></button>
                                                </div>
                                            ) : (
                                                <button
                                                    className="action-btn delete-btn"
                                                    onClick={() => setDeleteConfirm(tag.id)}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
