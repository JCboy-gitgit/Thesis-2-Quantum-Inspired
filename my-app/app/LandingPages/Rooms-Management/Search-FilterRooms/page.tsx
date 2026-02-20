'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import styles from './styles.module.css'
import { MdSearch, MdDomain, MdMeetingRoom, MdPeople, MdClose, MdKeyboardArrowDown, MdKeyboardArrowUp, MdSchool, MdTableChart, MdCalendarToday, MdCheckCircle, MdArrowBack, MdLayers, MdAir, MdTv, MdCoPresent, MdLocationOn, MdFilterList, MdDescription } from 'react-icons/md'

// Helper to display null values
const displayValue = (value: any, fallback: string = 'N/A'): string => {
  if (value === null || value === undefined || value === '') return fallback
  return String(value)
}

// Campus room interface
interface CampusRoom {
  id: number
  upload_group_id: number
  school_name: string
  campus: string
  building: string
  room: string
  room_code: string | null
  capacity: number
  floor_number: number | null
  room_type: string
  specific_classification: string | null
  college: string | null
  has_ac: boolean | null
  has_whiteboard: boolean | null
  has_tv: boolean | null
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
  { value: 'all', label: 'All Room Types' },
  { value: 'Lecture Room', label: 'Lecture Room' },
  { value: 'Classroom', label: 'Classroom' },
  { value: 'Laboratory', label: 'Laboratory' },
  { value: 'Computer Lab', label: 'Computer Lab' },
  { value: 'Lecture Hall', label: 'Lecture Hall' },
  { value: 'Conference Room', label: 'Conference Room' },
  { value: 'Auditorium', label: 'Auditorium' },
]

export default function SearchFilterRoomsPage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [campusGroups, setCampusGroups] = useState<CampusGroup[]>([])
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null)
  const [rooms, setRooms] = useState<CampusRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingRooms, setLoadingRooms] = useState(false)

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBuilding, setSelectedBuilding] = useState<string>('all')
  const [selectedFloor, setSelectedFloor] = useState<string>('all')
  const [selectedRoomType, setSelectedRoomType] = useState<string>('all')
  const [filterAC, setFilterAC] = useState<boolean>(false)
  const [filterTV, setFilterTV] = useState<boolean>(false)
  const [filterWhiteboard, setFilterWhiteboard] = useState<boolean>(false)
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set())

  const toggleSidebar = () => setSidebarOpen(prev => !prev)

  useEffect(() => {
    checkAuth()
    fetchCampusGroups()
  }, [])

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/')
        return
      }
      if (session.user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        router.push('/faculty/home')
        return
      }
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/')
    }
  }

  const fetchCampusGroups = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('campuses')
        .select('upload_group_id, school_name, file_name, created_at')
        .order('created_at', { ascending: false })

      if (error) throw error

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

  const fetchRooms = async (groupId: number) => {
    setLoadingRooms(true)
    try {
      const { data, error } = await supabase
        .from('campuses')
        .select('*')
        .eq('upload_group_id', groupId)
        .order('building', { ascending: true })
        .order('floor_number', { ascending: true })
        .order('room', { ascending: true })

      if (error) throw error
      setRooms(data || [])

      const buildingsList = [...new Set((data || []).map((r: CampusRoom) => r.building))]
      setExpandedBlocks(new Set(buildingsList))
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

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedBuilding('all')
    setSelectedFloor('all')
    setSelectedRoomType('all')
    setFilterAC(false)
    setFilterTV(false)
    setFilterWhiteboard(false)
  }

  // Get unique buildings
  const buildings = useMemo(() => {
    return [...new Set(rooms.map(r => r.building))].sort()
  }, [rooms])

  // Get unique floors
  const floors = useMemo(() => {
    const floorSet = new Set(rooms.map(r => r.floor_number).filter(f => f !== null))
    return Array.from(floorSet).sort((a, b) => (a as number) - (b as number)) as number[]
  }, [rooms])

  // Get unique room types from data
  const roomTypes = useMemo(() => {
    const typeSet = new Set(rooms.map(r => r.room_type).filter(t => t))
    return Array.from(typeSet).sort()
  }, [rooms])

  const toggleBlock = (building: string) => {
    setExpandedBlocks(prev => {
      const newSet = new Set(prev)
      if (newSet.has(building)) {
        newSet.delete(building)
      } else {
        newSet.add(building)
      }
      return newSet
    })
  }

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesSearch =
          room.room.toLowerCase().includes(query) ||
          room.building.toLowerCase().includes(query) ||
          room.campus.toLowerCase().includes(query) ||
          (room.room_code && room.room_code.toLowerCase().includes(query)) ||
          (room.room_type && room.room_type.toLowerCase().includes(query))
        if (!matchesSearch) return false
      }

      // Building filter
      if (selectedBuilding !== 'all' && room.building !== selectedBuilding) return false

      // Floor filter
      if (selectedFloor !== 'all' && room.floor_number !== parseInt(selectedFloor)) return false

      // Room type filter
      if (selectedRoomType !== 'all' && room.room_type !== selectedRoomType) return false

      // Amenity filters
      if (filterAC && !room.has_ac) return false
      if (filterTV && !room.has_tv) return false
      if (filterWhiteboard && !room.has_whiteboard) return false

      return true
    })
  }, [rooms, searchQuery, selectedBuilding, selectedFloor, selectedRoomType, filterAC, filterTV, filterWhiteboard])

  // Group filtered rooms by building and floor
  const groupedRooms = useMemo(() => {
    const groups: { [building: string]: { [floor: string]: CampusRoom[] } } = {}

    filteredRooms.forEach(room => {
      const building = room.building
      const floor = room.floor_number !== null ? `Floor ${room.floor_number}` : 'Ground Floor'

      if (!groups[building]) {
        groups[building] = {}
      }
      if (!groups[building][floor]) {
        groups[building][floor] = []
      }
      groups[building][floor].push(room)
    })

    return groups
  }, [filteredRooms])

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (selectedBuilding !== 'all') count++
    if (selectedFloor !== 'all') count++
    if (selectedRoomType !== 'all') count++
    if (filterAC) count++
    if (filterTV) count++
    if (filterWhiteboard) count++
    return count
  }, [selectedBuilding, selectedFloor, selectedRoomType, filterAC, filterTV, filterWhiteboard])

  const selectedGroupData = campusGroups.find(g => g.upload_group_id === selectedGroup)

  return (
    <div className={styles.pageContainer} data-page="admin">
      <MenuBar
        onToggleSidebar={toggleSidebar}
        showSidebarToggle={true}
        showAccountIcon={true}
      />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className={`${styles.mainContent} ${sidebarOpen ? styles.withSidebar : ''}`}>
        <div className={styles.contentWrapper}>
          {/* Back Button */}
          <button
            className={styles.backButton}
            onClick={() => router.push('/LandingPages/Home')}
          >
            <MdArrowBack size={18} />
            Back to Home
          </button>

          {/* Header */}
          <div className={styles.headerCard}>
            <div className={styles.headerTitleRow}>
              <div className={styles.headerIcon}>
                <MdSearch size={24} />
              </div>
              <h1 className={styles.headerTitle}>Search & Filter Classrooms</h1>
            </div>
            <p className={styles.headerSubtitle}>Find classrooms by building, floor, type, and amenities</p>
          </div>

          {/* Campus Group Selection */}
          {loading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner}></div>
              <p>Loading campus data...</p>
            </div>
          ) : campusGroups.length === 0 ? (
            <div className={styles.emptyState}>
              <MdDescription size={64} />
              <h3 className={styles.emptyTitle}>No Campus Data Found</h3>
              <p className={styles.emptyText}>Upload a Campus/Building CSV file first to search rooms</p>
            </div>
          ) : (
            <>
              {/* Campus Group Cards */}
              <div className={styles.sectionHeader}>
                <h2>
                  <MdSchool size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
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
                      <MdSchool size={32} />
                    </div>
                    <div className={styles.campusCardContent}>
                      <h3>{group.school_name}</h3>
                      <p className={styles.campusCardMeta}>
                        <MdMeetingRoom size={14} /> {group.room_count} rooms
                      </p>
                      <p className={styles.campusCardFile}>
                        <MdDescription size={14} /> {group.file_name}
                      </p>
                      <p className={styles.campusCardDate}>
                        <MdCalendarToday size={14} /> {new Date(group.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {selectedGroup === group.upload_group_id && (
                      <div className={styles.selectedBadge}>
                        <MdCheckCircle size={20} />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Search & Filter Section */}
              {selectedGroup && (
                <>
                  <div className={styles.searchFilterCard}>
                    {/* Search Bar */}
                    <div className={styles.searchSection}>
                      <div className={styles.searchInputWrapper}>
                        <MdSearch className={styles.searchIcon} size={20} />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          placeholder="Search by room name, code, building, or type..."
                          className={styles.searchInput}
                        />
                        {searchQuery && (
                          <button onClick={() => setSearchQuery('')} className={styles.clearSearchBtn}>
                            <MdClose size={16} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Filters Row */}
                    <div className={styles.filtersRow}>
                      <div className={styles.filterDropdowns}>
                        {/* Building Filter */}
                        <select
                          value={selectedBuilding}
                          onChange={(e) => setSelectedBuilding(e.target.value)}
                          className={styles.filterSelect}
                        >
                          <option value="all">All Buildings</option>
                          {buildings.map(building => (
                            <option key={building} value={building}>{building}</option>
                          ))}
                        </select>

                        {/* Floor Filter */}
                        <select
                          value={selectedFloor}
                          onChange={(e) => setSelectedFloor(e.target.value)}
                          className={styles.filterSelect}
                        >
                          <option value="all">All Floors</option>
                          {floors.map(floor => (
                            <option key={floor} value={floor}>Floor {floor}</option>
                          ))}
                        </select>

                        {/* Room Type Filter */}
                        <select
                          value={selectedRoomType}
                          onChange={(e) => setSelectedRoomType(e.target.value)}
                          className={styles.filterSelect}
                        >
                          <option value="all">All Room Types</option>
                          {roomTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>

                      {/* Amenity Filters */}
                      <div className={styles.amenityFilters}>
                        <button
                          onClick={() => setFilterAC(!filterAC)}
                          className={`${styles.amenityBtn} ${filterAC ? styles.amenityActive : ''}`}
                          title="Has Air Conditioning"
                        >
                          <MdAir size={16} />
                          <span>AC</span>
                        </button>
                        <button
                          onClick={() => setFilterTV(!filterTV)}
                          className={`${styles.amenityBtn} ${filterTV ? styles.amenityActive : ''}`}
                          title="Has TV"
                        >
                          <MdTv size={16} />
                          <span>TV</span>
                        </button>
                        <button
                          onClick={() => setFilterWhiteboard(!filterWhiteboard)}
                          className={`${styles.amenityBtn} ${filterWhiteboard ? styles.amenityActive : ''}`}
                          title="Has Whiteboard"
                        >
                          <MdCoPresent size={16} />
                          <span>Board</span>
                        </button>
                      </div>

                      {/* Clear Filters */}
                      {activeFilterCount > 0 && (
                        <button onClick={clearFilters} className={styles.clearFiltersBtn}>
                          <MdClose size={14} />
                          Clear ({activeFilterCount})
                        </button>
                      )}
                    </div>

                    {/* Results Summary */}
                    <div className={styles.resultsSummary}>
                      <span>
                        Showing <strong>{filteredRooms.length}</strong> of <strong>{rooms.length}</strong> classrooms
                        {selectedGroupData && ` in ${selectedGroupData.school_name}`}
                      </span>
                    </div>
                  </div>

                  {/* Results - Building Blocks View */}
                  {loadingRooms ? (
                    <div className={styles.loadingState}>
                      <div className={styles.spinner}></div>
                      <p>Loading classrooms...</p>
                    </div>
                  ) : filteredRooms.length === 0 ? (
                    <div className={styles.emptyState}>
                      <MdSearch size={48} />
                      <h3 className={styles.emptyTitle}>No Classrooms Found</h3>
                      <p className={styles.emptyText}>Try adjusting your search or filter criteria</p>
                      <button onClick={clearFilters} className={styles.clearFiltersBtn}>
                        Clear All Filters
                      </button>
                    </div>
                  ) : (
                    <div className={styles.blocksContainer}>
                      {Object.entries(groupedRooms).map(([building, floorData]) => (
                        <div key={building} className={styles.blockSection}>
                          {/* Block Header */}
                          <div
                            className={styles.blockHeader}
                            onClick={() => toggleBlock(building)}
                          >
                            <div className={styles.blockTitle}>
                              <MdDomain size={20} />
                              <span>{building}</span>
                              <span className={styles.blockCount}>
                                {Object.values(floorData).flat().length} rooms
                              </span>
                            </div>
                            {expandedBlocks.has(building) ? (
                              <MdKeyboardArrowUp size={20} />
                            ) : (
                              <MdKeyboardArrowDown size={20} />
                            )}
                          </div>

                          {/* Block Content - Floors */}
                          {expandedBlocks.has(building) && (
                            <div className={styles.blockContent}>
                              {Object.entries(floorData).sort((a, b) => {
                                const floorA = parseInt(a[0].replace('Floor ', '')) || 0
                                const floorB = parseInt(b[0].replace('Floor ', '')) || 0
                                return floorA - floorB
                              }).map(([floor, floorRooms]) => (
                                <div key={floor} className={styles.floorSection}>
                                  {/* Floor Header */}
                                  <div className={styles.floorHeader}>
                                    <div className={styles.floorTitle}>
                                      <MdLayers size={16} />
                                      <span>{floor}</span>
                                      <span className={styles.floorRoomCount}>{floorRooms.length} Rooms</span>
                                    </div>
                                  </div>

                                  {/* Rooms Grid */}
                                  <div className={styles.roomsGrid}>
                                    {floorRooms.map(room => (
                                      <div key={room.id} className={styles.roomCard}>
                                        {/* Room Header */}
                                        <div className={styles.roomCardHeader}>
                                          <div className={styles.roomIcon}>
                                            <MdSchool size={20} />
                                          </div>
                                          <div className={styles.roomTitleArea}>
                                            <h4 className={styles.roomName}>{room.room}</h4>
                                            {room.room_code && (
                                              <span className={styles.roomCode}>{room.room_code}</span>
                                            )}
                                          </div>
                                          <span className={styles.roomTypeBadge}>
                                            {room.room_type || 'Classroom'}
                                          </span>
                                        </div>

                                        {/* Room Details */}
                                        <div className={styles.roomDetails}>
                                          <div className={styles.roomDetailItem}>
                                            <MdPeople size={14} />
                                            <span>Capacity: <strong>{room.capacity}</strong></span>
                                          </div>
                                          <div className={styles.roomDetailItem}>
                                            <MdLocationOn size={14} />
                                            <span>Floor {displayValue(room.floor_number, 'G')}</span>
                                          </div>
                                          {room.specific_classification && (
                                            <div className={styles.roomDetailItem}>
                                              <MdMeetingRoom size={14} />
                                              <span>{room.specific_classification}</span>
                                            </div>
                                          )}
                                        </div>

                                        {/* Amenities */}
                                        <div className={styles.roomAmenities}>
                                          <span
                                            className={`${styles.amenityTag} ${room.has_ac ? styles.amenityAvailable : styles.amenityUnavailable}`}
                                            title={room.has_ac ? 'Has Air Conditioning' : 'No Air Conditioning'}
                                          >
                                            <MdAir size={14} />
                                            AC
                                          </span>
                                          <span
                                            className={`${styles.amenityTag} ${room.has_tv ? styles.amenityAvailable : styles.amenityUnavailable}`}
                                            title={room.has_tv ? 'Has TV' : 'No TV'}
                                          >
                                            <MdTv size={14} />
                                            TV
                                          </span>
                                          <span
                                            className={`${styles.amenityTag} ${room.has_whiteboard ? styles.amenityAvailable : styles.amenityUnavailable}`}
                                            title={room.has_whiteboard ? 'Has Whiteboard' : 'No Whiteboard'}
                                          >
                                            <MdCoPresent size={14} />
                                            Board
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* No selection prompt */}
              {!selectedGroup && (
                <div className={styles.noSelectionPrompt}>
                  <MdSchool size={64} />
                  <h3>Select a School/Campus File</h3>
                  <p>Choose a campus file above to browse classrooms</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

