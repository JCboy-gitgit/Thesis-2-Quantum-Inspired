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
  Snowflake,
  MonitorPlay,
  Accessibility,
  MapPin,
  SlidersHorizontal,
  University,
  Hotel,
  Landmark,
  FileSpreadsheet,
  Calendar,
  CheckCircle,
  ArrowLeft
} from 'lucide-react'

// Campus room from CSV uploads
interface CampusRoom {
  id: number
  upload_group_id: number
  school_name: string
  campus: string
  building: string
  room: string
  capacity: number
  is_first_floor: boolean
  floor_number: number
  room_type: string
  has_ac: boolean
  has_projector: boolean
  has_whiteboard: boolean
  is_pwd_accessible: boolean
  status: string
  file_name: string
  created_at: string
}

interface CampusGroup {
  upload_group_id: number
  school_name: string
  file_name: string
  created_at: string
  room_count: number
}

const ROOM_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'Classroom', label: 'Classroom' },
  { value: 'Laboratory', label: 'Laboratory' },
  { value: 'Computer Lab', label: 'Computer Lab' },
  { value: 'Lecture Hall', label: 'Lecture Hall' },
  { value: 'Conference Room', label: 'Conference Room' },
  { value: 'Auditorium', label: 'Auditorium' },
  { value: 'Other', label: 'Other' },
]

export default function SearchFilterRoomsPage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [campusGroups, setCampusGroups] = useState<CampusGroup[]>([])
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null)
  const [rooms, setRooms] = useState<CampusRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [selectedBuilding, setSelectedBuilding] = useState<string>('all')
  const [selectedCampus, setSelectedCampus] = useState<string>('all')
  const [minCapacity, setMinCapacity] = useState<number>(0)
  const [maxCapacity, setMaxCapacity] = useState<number>(500)
  const [filterFeatures, setFilterFeatures] = useState({
    has_ac: false,
    has_projector: false,
    has_whiteboard: false,
    is_pwd_accessible: false
  })

  const toggleSidebar = () => setSidebarOpen(prev => !prev)

  useEffect(() => {
    checkAuth()
    fetchCampusGroups()
  }, [])

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

  // Fetch all upload groups from campuses table
  const fetchCampusGroups = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('campuses')
        .select('upload_group_id, school_name, file_name, created_at')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Group by upload_group_id
      const grouped = (data || []).reduce((acc: CampusGroup[], curr: any) => {
        const existing = acc.find(item => item.upload_group_id === curr.upload_group_id)
        if (existing) {
          existing.room_count++
        } else {
          acc.push({
            upload_group_id: curr.upload_group_id,
            school_name: curr.school_name,
            file_name: curr.file_name,
            created_at: curr.created_at,
            room_count: 1
          })
        }
        return acc
      }, [])

      setCampusGroups(grouped)
    } catch (error: any) {
      console.error('Error fetching campus groups:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch rooms for a specific upload group
  const fetchRooms = async (groupId: number) => {
    setLoadingRooms(true)
    try {
      const { data, error } = await supabase
        .from('campuses')
        .select('*')
        .eq('upload_group_id', groupId)
        .order('campus', { ascending: true })
        .order('building', { ascending: true })
        .order('room', { ascending: true })

      if (error) throw error
      setRooms(data || [])
    } catch (error: any) {
      console.error('Error fetching rooms:', error)
    } finally {
      setLoadingRooms(false)
    }
  }

  const handleSelectGroup = (groupId: number) => {
    if (selectedGroup === groupId) {
      setSelectedGroup(null)
      setRooms([])
      clearFilters()
    } else {
      setSelectedGroup(groupId)
      fetchRooms(groupId)
      clearFilters()
    }
  }

  // Get unique buildings for filter dropdown
  const buildings = useMemo(() => {
    const uniqueBuildings = [...new Set(rooms.map(r => r.building))]
    return uniqueBuildings.sort()
  }, [rooms])

  // Get unique campuses for filter dropdown
  const campuses = useMemo(() => {
    const uniqueCampuses = [...new Set(rooms.map(r => r.campus))]
    return uniqueCampuses.sort()
  }, [rooms])

  // Filtered results
  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesSearch = 
          room.room.toLowerCase().includes(query) ||
          room.building.toLowerCase().includes(query) ||
          room.campus.toLowerCase().includes(query)
        if (!matchesSearch) return false
      }

      // Room type filter
      if (selectedType !== 'all' && room.room_type !== selectedType) return false

      // Building filter
      if (selectedBuilding !== 'all' && room.building !== selectedBuilding) return false

      // Campus filter
      if (selectedCampus !== 'all' && room.campus !== selectedCampus) return false

      // Capacity filter
      if (room.capacity < minCapacity || room.capacity > maxCapacity) return false

      // Feature filters
      if (filterFeatures.has_ac && !room.has_ac) return false
      if (filterFeatures.has_projector && !room.has_projector) return false
      if (filterFeatures.has_whiteboard && !room.has_whiteboard) return false
      if (filterFeatures.is_pwd_accessible && !room.is_pwd_accessible) return false

      return true
    })
  }, [rooms, searchQuery, selectedType, selectedBuilding, selectedCampus, minCapacity, maxCapacity, filterFeatures])

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedType('all')
    setSelectedBuilding('all')
    setSelectedCampus('all')
    setMinCapacity(0)
    setMaxCapacity(500)
    setFilterFeatures({
      has_ac: false,
      has_projector: false,
      has_whiteboard: false,
      is_pwd_accessible: false
    })
  }

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (selectedType !== 'all') count++
    if (selectedBuilding !== 'all') count++
    if (selectedCampus !== 'all') count++
    if (minCapacity > 0) count++
    if (maxCapacity < 500) count++
    if (Object.values(filterFeatures).some(v => v)) count++
    return count
  }, [selectedType, selectedBuilding, selectedCampus, minCapacity, maxCapacity, filterFeatures])

  const selectedGroupData = campusGroups.find(g => g.upload_group_id === selectedGroup)

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
          {/* Back Button */}
          <button 
            className={styles.backButton}
            onClick={() => router.push('/LandingPages/Home')}
          >
            <ArrowLeft size={18} />
            Back to Home
          </button>

          {/* Header */}
          <div className={styles.headerCard}>
            <div className={styles.headerTitleRow}>
              <div className={styles.headerIcon}>
                <Search size={24} />
              </div>
              <h1 className={styles.headerTitle}>Search & Filter Rooms</h1>
            </div>
            <p className={styles.headerSubtitle}>Find rooms from uploaded Campus/Building CSV files based on your requirements</p>
          </div>

          {/* Campus Group Selection */}
          {loading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner}></div>
              <p>Loading campus data...</p>
            </div>
          ) : campusGroups.length === 0 ? (
            <div className={styles.emptyState}>
              <FileSpreadsheet size={64} />
              <h3 className={styles.emptyTitle}>No Campus Data Found</h3>
              <p className={styles.emptyText}>Upload a Campus/Building CSV file first to search rooms</p>
            </div>
          ) : (
            <>
              {/* Campus Group Cards */}
              <div className={styles.sectionHeader}>
                <h2>
                  <University size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                  Select School/Campus File
                </h2>
              </div>
              
              <div className={styles.campusGrid}>
                {campusGroups.map(group => (
                  <div 
                    key={group.upload_group_id}
                    className={`${styles.campusCard} ${selectedGroup === group.upload_group_id ? styles.selected : ''}`}
                    onClick={() => handleSelectGroup(group.upload_group_id)}
                  >
                    <div className={styles.campusCardIcon}>
                      <University size={32} />
                    </div>
                    <div className={styles.campusCardContent}>
                      <h3>{group.school_name}</h3>
                      <p className={styles.campusCardMeta}>
                        <DoorOpen size={14} /> {group.room_count} rooms
                      </p>
                      <p className={styles.campusCardFile}>
                        <FileSpreadsheet size={14} /> {group.file_name}
                      </p>
                      <p className={styles.campusCardDate}>
                        <Calendar size={14} /> {new Date(group.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {selectedGroup === group.upload_group_id && (
                      <div className={styles.selectedBadge}>
                        <CheckCircle size={20} />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Search & Filter Section */}
              {selectedGroup && (
                <>
                  {/* Search Bar */}
                  <div className={styles.searchCard}>
                    <div className={styles.searchCardHeader}>
                      <h3>
                        <Search size={20} />
                        Search in {selectedGroupData?.school_name}
                      </h3>
                      <span className={styles.roomCountBadge}>{rooms.length} total rooms</span>
                    </div>
                    
                    <div className={styles.searchRow}>
                      {/* Search Input */}
                      <div className={styles.searchInputWrapper}>
                        <Search className={styles.searchIcon} size={18} />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          placeholder="Search by room, building, or campus..."
                          className={styles.searchInput}
                        />
                        {searchQuery && (
                          <button onClick={() => setSearchQuery('')} className={styles.clearButton}>
                            <X size={16} />
                          </button>
                        )}
                      </div>

                      {/* Quick Filters */}
                      <div className={styles.quickFilters}>
                        <select
                          value={selectedCampus}
                          onChange={e => setSelectedCampus(e.target.value)}
                          className={styles.filterSelect}
                        >
                          <option value="all">All Campuses</option>
                          {campuses.map(campus => (
                            <option key={campus} value={campus}>{campus}</option>
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

                        <select
                          value={selectedType}
                          onChange={e => setSelectedType(e.target.value)}
                          className={styles.filterSelect}
                        >
                          {ROOM_TYPES.map(type => (
                            <option key={type.value} value={type.value}>{type.label}</option>
                          ))}
                        </select>

                        <button
                          onClick={() => setShowFilters(!showFilters)}
                          className={`${styles.filtersButton} ${showFilters || activeFilterCount > 0 ? styles.filtersButtonActive : ''}`}
                        >
                          <SlidersHorizontal size={18} />
                          More Filters
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
                            <label className={styles.filterLabel}>
                              <Users size={16} /> Capacity Range
                            </label>
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
                              <button
                                onClick={() => setFilterFeatures(prev => ({ ...prev, has_ac: !prev.has_ac }))}
                                className={`${styles.featureButton} ${filterFeatures.has_ac ? styles.featureButtonActive : ''}`}
                              >
                                <Snowflake size={16} />
                                Air Conditioned
                              </button>
                              <button
                                onClick={() => setFilterFeatures(prev => ({ ...prev, has_projector: !prev.has_projector }))}
                                className={`${styles.featureButton} ${filterFeatures.has_projector ? styles.featureButtonActive : ''}`}
                              >
                                <MonitorPlay size={16} />
                                Projector
                              </button>
                              <button
                                onClick={() => setFilterFeatures(prev => ({ ...prev, is_pwd_accessible: !prev.is_pwd_accessible }))}
                                className={`${styles.featureButton} ${filterFeatures.is_pwd_accessible ? styles.featureButtonActive : ''}`}
                              >
                                <Accessibility size={16} />
                                PWD Accessible
                              </button>
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
                  {loadingRooms ? (
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
                      <Search size={48} />
                      <h3 className={styles.emptyTitle}>No Rooms Found</h3>
                      <p className={styles.emptyText}>Try adjusting your search or filter criteria</p>
                      <button onClick={clearFilters} className={styles.emptyButton}>
                        Clear Filters
                      </button>
                    </div>
                  ) : (
                    <div className={styles.resultsGrid}>
                      {filteredRooms.map(room => (
                        <div key={room.id} className={styles.roomCard}>
                          <div className={styles.roomCardHeader}>
                            <div>
                              <h3 className={styles.roomCode}>
                                <DoorOpen size={18} />
                                {room.room}
                              </h3>
                              <p className={styles.roomType}>{room.room_type || 'Classroom'}</p>
                            </div>
                            <span className={styles.capacityBadge}>
                              <Users size={14} />
                              {room.capacity}
                            </span>
                          </div>

                          <div className={styles.roomDetails}>
                            <div className={styles.roomDetailRow}>
                              <Landmark size={14} />
                              <span>{room.campus}</span>
                            </div>
                            <div className={styles.roomDetailRow}>
                              <Hotel size={14} />
                              <span>{room.building}</span>
                            </div>
                            <div className={styles.roomDetailRow}>
                              <MapPin size={14} />
                              <span>Floor {room.floor_number}</span>
                            </div>
                          </div>

                          <div className={styles.roomFeatures}>
                            {room.has_ac && (
                              <span className={`${styles.featureIcon} ${styles.featureAc}`} title="Air Conditioned">
                                <Snowflake size={14} />
                              </span>
                            )}
                            {room.has_projector && (
                              <span className={`${styles.featureIcon} ${styles.featureProjector}`} title="Projector">
                                <MonitorPlay size={14} />
                              </span>
                            )}
                            {room.has_whiteboard && (
                              <span className={`${styles.featureIcon} ${styles.featureWhiteboard}`} title="Whiteboard">
                                ✏️
                              </span>
                            )}
                            {room.is_pwd_accessible && (
                              <span className={`${styles.featureIcon} ${styles.featureAccessible}`} title="PWD Accessible">
                                <Accessibility size={14} />
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* No selection prompt */}
              {!selectedGroup && (
                <div className={styles.noSelectionPrompt}>
                  <University size={64} />
                  <h3>Select a School/Campus File</h3>
                  <p>Choose a campus file above to search and filter rooms</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
