'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Tag, X, Plus, Check, Search, Loader2, Beaker, MonitorSpeaker, Armchair, Shield, Accessibility, Package, Sun, Dumbbell } from 'lucide-react'
import styles from './FeatureTagsManager.module.css'

// ==================== INTERFACES ====================

export interface FeatureTag {
  id: number
  tag_name: string
  tag_category: string
  description?: string
  icon?: string
}

export interface RoomFeature {
  id: number
  room_id: number
  feature_tag_id: number
  quantity: number
  notes?: string
  feature_tags?: FeatureTag
}

export interface SubjectRequirement {
  id: number
  course_id: number
  feature_tag_id: number
  is_mandatory: boolean
  min_quantity: number
  notes?: string
  feature_tags?: FeatureTag
}

interface FeatureTagsManagerProps {
  mode: 'room' | 'course'
  entityId: number
  entityName: string
  subType?: 'lec' | 'lab'
  onUpdate?: () => void
}

// ==================== HELPER FUNCTIONS ====================

const getCategoryIcon = (category: string) => {
  switch (category.toLowerCase()) {
    case 'technology':
      return <MonitorSpeaker size={14} />
    case 'equipment_physics':
    case 'equipment_chemistry':
    case 'equipment_biology':
    case 'equipment_engineering':
    case 'equipment':
      return <Beaker size={14} />
    case 'furniture':
      return <Armchair size={14} />
    case 'safety':
      return <Shield size={14} />
    case 'accessibility':
      return <Accessibility size={14} />
    case 'extracurricular':
    case 'outdoor':
    case 'pe':
      return <Dumbbell size={14} />
    default:
      return <Package size={14} />
  }
}

const getCategoryLabel = (category: string): string => {
  const labels: Record<string, string> = {
    'technology': 'Technology',
    'equipment_physics': 'Physics Equipment',
    'equipment_chemistry': 'Chemistry Equipment',
    'equipment_biology': 'Biology Equipment',
    'equipment_engineering': 'Engineering Equipment',
    'equipment': 'General Equipment',
    'furniture': 'Furniture',
    'safety': 'Safety',
    'accessibility': 'Accessibility',
    'extracurricular': 'Extracurricular / PE',
    'outdoor': 'Outdoor Activities',
    'pe': 'Physical Education',
    'general': 'General'
  }
  return labels[category.toLowerCase()] || category
}

const getCategoryColor = (category: string): string => {
  const colors: Record<string, string> = {
    'technology': '#3b82f6',
    'equipment_physics': '#8b5cf6',
    'equipment_chemistry': '#10b981',
    'equipment_biology': '#22c55e',
    'equipment_engineering': '#f97316',
    'equipment': '#6366f1',
    'furniture': '#a855f7',
    'safety': '#ef4444',
    'accessibility': '#06b6d4',
    'extracurricular': '#f59e0b',
    'outdoor': '#84cc16',
    'pe': '#f59e0b',
    'general': '#64748b'
  }
  return colors[category.toLowerCase()] || '#64748b'
}

// ==================== COMPONENT ====================

export default function FeatureTagsManager({
  mode,
  entityId,
  entityName,
  subType,
  onUpdate
}: FeatureTagsManagerProps) {
  // State
  const [allTags, setAllTags] = useState<FeatureTag[]>([])

  const [assignedFeatures, setAssignedFeatures] = useState<(RoomFeature | SubjectRequirement)[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ==================== DATA FETCHING ====================

  useEffect(() => {
    fetchData()
  }, [entityId, mode])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      // Fetch all available tags
      const tagsResponse = await fetch('/api/room-features?action=tags')
      const tagsData = await tagsResponse.json()

      if (!tagsData.success) throw new Error(tagsData.error)
      setAllTags(tagsData.data || [])

      // Fetch assigned features/requirements
      const action = mode === 'room' ? 'room_features' : 'subject_requirements'
      const paramName = mode === 'room' ? 'room_id' : 'course_id'
      const featuresResponse = await fetch(`/api/room-features?action=${action}&${paramName}=${entityId}`)
      const featuresData = await featuresResponse.json()

      if (!featuresData.success) throw new Error(featuresData.error)
      setAssignedFeatures(featuresData.data || [])
    } catch (err: any) {
      console.error('Error fetching feature data:', err)
      setError(err.message || 'Failed to load features')
    } finally {
      setLoading(false)
    }
  }

  // ==================== ACTIONS ====================

  const handleAddFeature = async (tagId: number) => {
    setSaving(true)
    try {
      const action = mode === 'room' ? 'add_room_feature' : 'add_subject_requirement'
      const payload = mode === 'room'
        ? { action, room_id: entityId, feature_tag_id: tagId, quantity: 1 }
        : {
          action,
          course_id: entityId,
          feature_tag_id: tagId,
          is_mandatory: true,
          min_quantity: 1,
          notes: subType ? subType.toUpperCase() : undefined
        }

      const response = await fetch('/api/room-features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()
      if (!data.success) throw new Error(data.error)

      // Refresh data
      await fetchData()
      onUpdate?.()
    } catch (err: any) {
      console.error('Error adding feature:', err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveFeature = async (featureId: number) => {
    setSaving(true)
    try {
      // Check if this is a shared requirement (BOTH) that needs downgrade instead of delete
      const feature = assignedFeatures.find(f => f.id === featureId)
      const notes = (feature?.notes || '').toUpperCase()

      if (mode === 'course' && notes === 'BOTH' && subType) {
        // Downgrade logic: If removing from Lec tab, keep for Lab (and vice versa)
        const newNotes = subType === 'lec' ? 'LAB' : 'LEC'
        const req = feature as SubjectRequirement

        await fetch('/api/room-features', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add_subject_requirement',
            course_id: entityId,
            feature_tag_id: req.feature_tag_id,
            is_mandatory: req.is_mandatory,
            min_quantity: req.min_quantity,
            notes: newNotes
          })
        })
      } else {
        // Normal delete
        const action = mode === 'room' ? 'remove_room_feature' : 'remove_subject_requirement'
        const response = await fetch(`/api/room-features?action=${action}&id=${featureId}`, {
          method: 'DELETE'
        })
        const data = await response.json()
        if (!data.success) throw new Error(data.error)
      }

      // Refresh data
      await fetchData()
      onUpdate?.()
    } catch (err: any) {
      console.error('Error removing feature:', err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleMandatory = async (feature: SubjectRequirement) => {
    if (mode !== 'course') return

    setSaving(true)
    try {
      const response = await fetch('/api/room-features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_subject_requirement',
          course_id: entityId,
          feature_tag_id: feature.feature_tag_id,
          is_mandatory: !feature.is_mandatory,
          min_quantity: feature.min_quantity
        })
      })

      const data = await response.json()
      if (!data.success) throw new Error(data.error)

      await fetchData()
      onUpdate?.()
    } catch (err: any) {
      console.error('Error toggling mandatory:', err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ==================== FILTERING ====================

  const getCategories = (): string[] => {
    const categories = new Set(allTags.map(t => t.tag_category))
    return ['all', ...Array.from(categories).sort()]
  }

  // Computed filtered list based on subType (LEC/LAB tabs)
  const filteredFeatures = useMemo(() => {
    if (loading) return []
    if (mode === 'room') return assignedFeatures
    if (!subType) return assignedFeatures

    return assignedFeatures.filter(f => {
      const notes = (f.notes || '').toUpperCase()
      if (notes === 'BOTH') return true // Show in both tabs

      if (subType === 'lec') return notes === 'LEC'
      // Treat 'LAB' or empty/null as Lab features (backward compatibility)
      if (subType === 'lab') return notes === 'LAB' || !f.notes || notes === ''
      return true
    })
  }, [assignedFeatures, mode, subType, loading])

  const getAssignedTagIds = (): Set<number> => {
    return new Set(filteredFeatures.map(f => f.feature_tag_id))
  }

  const getAvailableTags = (): FeatureTag[] => {
    const assignedIds = getAssignedTagIds()
    let filtered = allTags.filter(t => !assignedIds.has(t.id))

    // In course mode, don't filter by what exists in rooms - allow courses to require any equipment
    // This allows courses to specify requirements even before rooms have been set up with equipment
    // The scheduler will then find matching rooms or report if no rooms meet the requirements

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(t => t.tag_category === selectedCategory)
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(t =>
        t.tag_name.toLowerCase().includes(term) ||
        t.description?.toLowerCase().includes(term)
      )
    }

    return filtered
  }

  // Group available tags by category
  const getGroupedAvailableTags = (): Map<string, FeatureTag[]> => {
    const grouped = new Map<string, FeatureTag[]>()
    const available = getAvailableTags()

    available.forEach(tag => {
      const category = tag.tag_category
      if (!grouped.has(category)) {
        grouped.set(category, [])
      }
      grouped.get(category)!.push(tag)
    })

    return grouped
  }

  // ==================== RENDER ====================

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <Loader2 size={24} className={styles.spinner} />
          <span>Loading features...</span>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <Tag size={18} />
          <span>{mode === 'room' ? 'Room Equipment & Features' : 'Required Room Features'}</span>
        </div>
        <button
          type="button"
          className={styles.addButton}
          onClick={() => setShowAddPanel(!showAddPanel)}
          disabled={saving}
        >
          {showAddPanel ? <X size={16} /> : <Plus size={16} />}
          {showAddPanel ? 'Close' : 'Add Feature'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className={styles.errorMessage}>
          {error}
          <button type="button" onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {/* Assigned Features */}
      <div className={styles.assignedSection}>
        {filteredFeatures.length === 0 ? (
          <div className={styles.emptyState}>
            <Tag size={32} style={{ opacity: 0.3 }} />
            <p>No {mode === 'room' ? 'features assigned' : 'requirements set'}</p>
            <span>Click "Add Feature" to get started</span>
          </div>
        ) : (
          <div className={styles.tagsList}>
            {filteredFeatures.map((feature) => {
              const tag = feature.feature_tags as FeatureTag | undefined
              if (!tag) return null

              const categoryColor = getCategoryColor(tag.tag_category)
              const isRequirement = mode === 'course'
              const requirement = feature as SubjectRequirement

              return (
                <div
                  key={feature.id}
                  className={styles.assignedTag}
                  style={{ borderColor: categoryColor }}
                >
                  <div className={styles.tagIcon} style={{ background: categoryColor }}>
                    {getCategoryIcon(tag.tag_category)}
                  </div>
                  <div className={styles.tagContent}>
                    <span className={styles.tagName}>{tag.tag_name}</span>
                    {isRequirement && (
                      <button
                        type="button"
                        className={`${styles.mandatoryToggle} ${requirement.is_mandatory ? styles.mandatory : styles.optional}`}
                        onClick={() => handleToggleMandatory(requirement)}
                        title={requirement.is_mandatory ? 'Click to make optional' : 'Click to make mandatory'}
                      >
                        {requirement.is_mandatory ? 'Required' : 'Optional'}
                      </button>
                    )}
                    {'quantity' in feature && feature.quantity > 1 && (
                      <span className={styles.quantity}>×{feature.quantity}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() => handleRemoveFeature(feature.id)}
                    disabled={saving}
                    title="Remove"
                  >
                    <X size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Panel */}
      {showAddPanel && (
        <div className={styles.addPanel}>
          <div className={styles.addPanelHeader}>
            <h4>Add {mode === 'room' ? 'Equipment/Feature' : 'Requirement'}</h4>
          </div>

          {/* Search & Filter */}
          <div className={styles.searchRow}>
            <div className={styles.searchInput}>
              <Search size={16} />
              <input
                type="text"
                placeholder="Search features..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={styles.categorySelect}
            >
              {getCategories().map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : getCategoryLabel(cat)}
                </option>
              ))}
            </select>
          </div>

          {/* Available Tags */}
          <div className={styles.availableTags}>
            {Array.from(getGroupedAvailableTags().entries()).map(([category, tags]) => (
              <div key={category} className={styles.categoryGroup}>
                <div className={styles.categoryHeader}>
                  {getCategoryIcon(category)}
                  <span>{getCategoryLabel(category)}</span>
                  <span className={styles.categoryCount}>{tags.length}</span>
                </div>
                <div className={styles.categoryTags}>
                  {tags.map(tag => (
                    <button
                      type="button"
                      key={tag.id}
                      className={styles.availableTag}
                      onClick={() => handleAddFeature(tag.id)}
                      disabled={saving}
                      title={tag.description || tag.tag_name}
                      style={{ borderColor: getCategoryColor(tag.tag_category) }}
                    >
                      <Plus size={12} />
                      <span>{tag.tag_name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {getAvailableTags().length === 0 && (
              <div className={styles.noResults}>
                <p>No matching features found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary Footer */}
      {filteredFeatures.length > 0 && (
        <div className={styles.footer}>
          <span className={styles.footerCount}>
            {filteredFeatures.length} {mode === 'room' ? 'feature(s)' : 'requirement(s)'}
          </span>
          {mode === 'course' && (
            <span className={styles.footerMandatory}>
              {(filteredFeatures as SubjectRequirement[]).filter(f => f.is_mandatory).length} mandatory
            </span>
          )}
        </div>
      )}
    </div>
  )
}
