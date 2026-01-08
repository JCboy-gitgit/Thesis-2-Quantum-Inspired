'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import styles from './styles.module.css'
import { 
  Search, 
  Filter, 
  Building2, 
  DoorOpen,
  Users,
  X,
  ChevronDown,
  Computer,
  Beaker,
  Projector,
  Wind,
  Accessibility,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  SlidersHorizontal
} from 'lucide-react'
import type { Room, RoomType } from '@/lib/database.types'

const ROOM_TYPES: { value: RoomType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'lecture', label: 'Lecture Room' },
  { value: 'laboratory', label: 'Laboratory' },
  { value: 'computer_lab', label: 'Computer Lab' },
  { value: 'drawing_room', label: 'Drawing Room' },
  { value: 'auditorium', label: 'Auditorium' },
  { value: 'conference', label: 'Conference Room' },
  { value: 'other', label: 'Other' },
]

export default function SearchFilterRoomsPage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<RoomType | 'all'>('all')
  const [selectedBuilding, setSelectedBuilding] = useState<string>('all')
  const [minCapacity, setMinCapacity] = useState<number>(0)
  const [maxCapacity, setMaxCapacity] = useState<number>(500)
  const [filterFeatures, setFilterFeatures] = useState({
    has_ac: false,
    has_projector: false,
    has_computers: false,
    is_accessible: false,
    has_lab_equipment: false
  })

  const toggleSidebar = () => setSidebarOpen(prev => !prev)

  useEffect(() => {
    fetchRooms()
  }, [])

  const fetchRooms = async () => {
    setLoading(true)
    try {
      const { data, error } = await (supabase
        .from('rooms') as any)
        .select('*')
        .eq('is_active', true)
        .order('building', { ascending: true })
        .order('room_code', { ascending: true })

      if (error) {
        // Check if table doesn't exist
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          console.warn('Rooms table does not exist yet. Please run the database schema.')
        } else {
          console.error('Error fetching rooms:', error)
        }
      } else {
        setRooms(data || [])
      }
    } catch (error: any) {
      console.error('Error fetching rooms:', error?.message || error)
    } finally {
      setLoading(false)
    }
  }

  // Get unique buildings for filter dropdown
  const buildings = useMemo(() => {
    const uniqueBuildings = [...new Set(rooms.map(r => r.building))]
    return uniqueBuildings.sort()
  }, [rooms])

  // Filtered results
  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesSearch = 
          room.room_code.toLowerCase().includes(query) ||
          (room.room_name?.toLowerCase().includes(query)) ||
          room.building.toLowerCase().includes(query)
        if (!matchesSearch) return false
      }

      // Room type filter
      if (selectedType !== 'all' && room.room_type !== selectedType) return false

      // Building filter
      if (selectedBuilding !== 'all' && room.building !== selectedBuilding) return false

      // Capacity filter
      if (room.capacity < minCapacity || room.capacity > maxCapacity) return false

      // Feature filters
      if (filterFeatures.has_ac && !room.has_ac) return false
      if (filterFeatures.has_projector && !room.has_projector) return false
      if (filterFeatures.has_computers && room.has_computers === 0) return false
      if (filterFeatures.is_accessible && !room.is_accessible) return false
      if (filterFeatures.has_lab_equipment && !room.has_lab_equipment) return false

      return true
    })
  }, [rooms, searchQuery, selectedType, selectedBuilding, minCapacity, maxCapacity, filterFeatures])

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedType('all')
    setSelectedBuilding('all')
    setMinCapacity(0)
    setMaxCapacity(500)
    setFilterFeatures({
      has_ac: false,
      has_projector: false,
      has_computers: false,
      is_accessible: false,
      has_lab_equipment: false
    })
  }

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (selectedType !== 'all') count++
    if (selectedBuilding !== 'all') count++
    if (minCapacity > 0) count++
    if (maxCapacity < 500) count++
    if (Object.values(filterFeatures).some(v => v)) count++
    return count
  }, [selectedType, selectedBuilding, minCapacity, maxCapacity, filterFeatures])

  const getRoomTypeColor = (type: RoomType) => {
    switch (type) {
      case 'laboratory': return styles.typeLaboratory
      case 'computer_lab': return styles.typeComputerLab
      case 'auditorium': return styles.typeAuditorium
      default: return styles.typeLecture
    }
  }

  const getRoomTypeIcon = (type: RoomType) => {
    switch (type) {
      case 'laboratory': return <Beaker className="w-4 h-4" />
      case 'computer_lab': return <Computer className="w-4 h-4" />
      default: return <DoorOpen className="w-4 h-4" />
    }
  }

  return (
    <div className={styles.pageContainer}>
      <MenuBar 
        onToggleSidebar={toggleSidebar}
        showSidebarToggle={true}
        showAccountIcon={true}
      />
      <Sidebar isOpen={sidebarOpen} />
      
      <main className={`${styles.mainContent} ${sidebarOpen ? styles.withSidebar : ''}`}>
        <div className={styles.contentWrapper}>
          {/* Header */}
          <div className={styles.headerCard}>
            <div className={styles.headerTitleRow}>
              <div className={styles.headerIcon}>
                <Search className="w-6 h-6" />
              </div>
              <h1 className={styles.headerTitle}>Search & Filter Rooms</h1>
            </div>
            <p className={styles.headerSubtitle}>Find rooms based on your requirements</p>
          </div>

          {/* Search Bar */}
          <div className={styles.searchCard}>
            <div className={styles.searchRow}>
              {/* Search Input */}
              <div className={styles.searchInputWrapper}>
                <Search className={styles.searchIcon} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by room code, name, or building..."
                  className={styles.searchInput}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className={styles.clearButton}>
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Quick Filters */}
              <div className={styles.quickFilters}>
                <select
                  value={selectedType}
                  onChange={e => setSelectedType(e.target.value as RoomType | 'all')}
                  className={styles.filterSelect}
                >
                  {ROOM_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>

                <select
                  value={selectedBuilding}
                  onChange={e => setSelectedBuilding(e.target.value)}
                  className={styles.filterSelect}
                >
                  <option value="all">All Buildings</option>
                  {buildings.map(building => (
                    <option key={building} value={building}>{building}</option>
                  ))}
                </select>

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`${styles.filtersButton} ${showFilters || activeFilterCount > 0 ? styles.filtersButtonActive : ''}`}
                >
                  <SlidersHorizontal className="w-5 h-5" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className={styles.filterBadge}>{activeFilterCount}</span>
                  )}
                </button>
              </div>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className={styles.advancedFilters}>
                <div className={styles.filtersGrid}>
                  {/* Capacity Range */}
                  <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>Capacity Range</label>
                    <div className={styles.capacityRange}>
                      <input
                        type="number"
                        value={minCapacity}
                        onChange={e => setMinCapacity(parseInt(e.target.value) || 0)}
                        min="0"
                        className={styles.capacityInput}
                        placeholder="Min"
                      />
                      <span className={styles.capacitySeparator}>to</span>
                      <input
                        type="number"
                        value={maxCapacity}
                        onChange={e => setMaxCapacity(parseInt(e.target.value) || 500)}
                        min="0"
                        className={styles.capacityInput}
                        placeholder="Max"
                      />
                    </div>
                  </div>

                  {/* Features */}
                  <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>Required Features</label>
                    <div className={styles.featuresRow}>
                      {[
                        { key: 'has_ac', label: 'Air Conditioned', icon: Wind },
                        { key: 'has_projector', label: 'Projector', icon: Projector },
                        { key: 'has_computers', label: 'Computers', icon: Computer },
                        { key: 'is_accessible', label: 'Accessible', icon: Accessibility },
                        { key: 'has_lab_equipment', label: 'Lab Equipment', icon: Beaker },
                      ].map(({ key, label, icon: Icon }) => (
                        <button
                          key={key}
                          onClick={() => setFilterFeatures(prev => ({ ...prev, [key]: !prev[key as keyof typeof filterFeatures] }))}
                          className={`${styles.featureButton} ${filterFeatures[key as keyof typeof filterFeatures] ? styles.featureButtonActive : ''}`}
                        >
                          <Icon className="w-4 h-4" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={styles.clearFiltersRow}>
                  <button onClick={clearFilters} className={styles.clearFiltersButton}>
                    Clear all filters
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Results Count */}
          <div className={styles.resultsCount}>
            Showing <span className={styles.resultsNumber}>{filteredRooms.length}</span> of {rooms.length} rooms
          </div>

          {/* Results Grid */}
          {loading ? (
            <div className={styles.resultsGrid}>
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className={styles.skeletonCard}>
                  <div className={styles.skeletonLine}></div>
                  <div className={styles.skeletonLine}></div>
                  <div className={styles.skeletonLine}></div>
                </div>
              ))}
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className={styles.emptyState}>
              <Search className={styles.emptyIcon} />
              <h3 className={styles.emptyTitle}>No Rooms Found</h3>
              <p className={styles.emptyText}>Try adjusting your search or filter criteria</p>
              <button onClick={clearFilters} className={styles.emptyButton}>
                Clear Filters
              </button>
            </div>
          ) : (
            <div className={styles.resultsGrid}>
              {filteredRooms.map(room => (
                <div
                  key={room.id}
                  className={styles.roomCard}
                  onClick={() => router.push(`/LandingPages/Rooms-Management/RoomLists&Details?room=${room.id}`)}
                >
                  <div className={styles.roomCardHeader}>
                    <div>
                      <h3 className={styles.roomCode}>{room.room_code}</h3>
                      {room.room_name && <p className={styles.roomName}>{room.room_name}</p>}
                    </div>
                    <span className={`${styles.roomTypeBadge} ${getRoomTypeColor(room.room_type)}`}>
                      {getRoomTypeIcon(room.room_type)}
                      {room.room_type.replace('_', ' ')}
                    </span>
                  </div>

                  <div className={styles.roomDetails}>
                    <div className={styles.roomDetailRow}>
                      <Building2 className={styles.roomDetailIcon} />
                      {room.building} • Floor {room.floor_number}
                    </div>
                    <div className={styles.roomDetailRow}>
                      <Users className={styles.roomDetailIcon} />
                      Capacity: {room.capacity}
                    </div>
                  </div>

                  <div className={styles.roomFeatures}>
                    {room.has_ac && (
                      <span className={`${styles.featureIcon} ${styles.featureAc}`} title="Air Conditioned">
                        <Wind className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {room.has_projector && (
                      <span className={`${styles.featureIcon} ${styles.featureProjector}`} title="Projector">
                        <Projector className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {room.has_computers > 0 && (
                      <span className={`${styles.featureIcon} ${styles.featureComputer}`} title={`${room.has_computers} Computers`}>
                        <Computer className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {room.is_accessible && (
                      <span className={`${styles.featureIcon} ${styles.featureAccessible}`} title="Accessible">
                        <Accessibility className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {room.has_lab_equipment && (
                      <span className={`${styles.featureIcon} ${styles.featureLab}`} title="Lab Equipment">
                        <Beaker className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
