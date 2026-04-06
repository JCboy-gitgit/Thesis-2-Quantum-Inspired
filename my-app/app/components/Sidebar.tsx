'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  MdHome,
  MdUpload,
  MdGroup,
  MdCalendarToday,
  MdKeyboardArrowDown,
  MdKeyboardArrowRight,
  MdEditCalendar,
  MdVisibility,
  MdBusiness,
  MdMap,
  MdList,
  MdEditSquare,
  MdSearch,
  MdAccountCircle,
  MdDomain,
  MdSchool,
  MdMenuBook,
  MdHowToReg,
  MdManageAccounts,
  MdNotifications,
  MdLiveTv,
  MdArchive
} from 'react-icons/md'
import ArchiveModal from './ArchiveModal'
import './Sidebar.css'

interface SidebarProps {
  isOpen: boolean
  onClose?: () => void
  menuBarHidden?: boolean
}

interface SidebarQueueState {
  available: boolean
  active: boolean
  waitingCount: number
}

export default function Sidebar({ isOpen, onClose, menuBarHidden }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isMenuBarHiddenGlobal, setIsMenuBarHiddenGlobal] = useState(false)
  // Track open state for each submenu by index
  const [openSubmenus, setOpenSubmenus] = useState<{ [key: number]: boolean }>({})
  const [isArchiveOpen, setIsArchiveOpen] = useState(false)
  const [queueState, setQueueState] = useState<SidebarQueueState>({
    available: false,
    active: false,
    waitingCount: 0,
  })

  // Auto-expand schedule menu if on a schedule-related page
  useEffect(() => {
    // Only expand the relevant submenu, keeping others that are already open
    setOpenSubmenus(prev => {
      const newOpen: { [key: number]: boolean } = { ...prev }

      menuItems.forEach((item, idx) => {
        if (item.hasSubmenu) {
          if (item.label === 'Room Schedule' && pathname.includes('/RoomSchedule')) {
            newOpen[idx] = true
          } else if (item.label === 'Room Management' && (pathname.includes('/Rooms-Management') || pathname.includes('/RoomsManagement'))) {
            newOpen[idx] = true
          } else if (item.label === 'Faculty Management' && (pathname.includes('/FacultyManagement') || pathname.includes('/FacultyColleges'))) {
            newOpen[idx] = true
          } else if (item.label === 'Course Management' && (pathname.includes('/CoursesManagement') || pathname.includes('/CourseManagement'))) {
            newOpen[idx] = true
          }
        }
      })

      return newOpen
    })
    // eslint-disable-next-line
  }, [pathname])

  useEffect(() => {
    const syncMenuBarState = () => {
      if (typeof document === 'undefined') return
      setIsMenuBarHiddenGlobal(document.documentElement.getAttribute('data-menubar-hidden') === 'true')
    }

    const handleMenuBarVisibilityChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ hidden?: boolean }>
      if (typeof customEvent.detail?.hidden === 'boolean') {
        setIsMenuBarHiddenGlobal(customEvent.detail.hidden)
        return
      }
      syncMenuBarState()
    }

    syncMenuBarState()
    window.addEventListener('menubar-visibility-change', handleMenuBarVisibilityChange)
    return () => {
      window.removeEventListener('menubar-visibility-change', handleMenuBarVisibilityChange)
    }
  }, [])

  useEffect(() => {
    let disposed = false
    let timeoutId: number | null = null

    const pollQueueStatus = async () => {
      try {
        const response = await fetch('/api/schedule/qia-backend?action=queue-status&backendPreference=auto', {
          method: 'GET',
          cache: 'no-store',
        })
        const payload = await response.json()

        if (disposed) return

        if (response.ok && payload?.queue_status) {
          setQueueState({
            available: true,
            active: Boolean(payload.queue_status.active),
            waitingCount: Number(payload.queue_status.waiting_count || 0) || 0,
          })
        } else {
          setQueueState({
            available: false,
            active: false,
            waitingCount: 0,
          })
        }
      } catch {
        if (!disposed) {
          setQueueState({
            available: false,
            active: false,
            waitingCount: 0,
          })
        }
      }

      if (!disposed) {
        timeoutId = window.setTimeout(pollQueueStatus, 12000)
      }
    }

    pollQueueStatus()

    return () => {
      disposed = true
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [])

  const isMenuBarHidden = menuBarHidden || isMenuBarHiddenGlobal
  const effectiveSidebarOpen = isMenuBarHidden ? false : isOpen

  const menuItems = [
    { icon: MdHome, label: 'Home', path: '/LandingPages/Home' },
    {
      icon: MdBusiness,
      label: 'Room Management',
      path: '/LandingPages/RoomsManagement',
      hasSubmenu: true,
      submenu: [
        {
          label: 'All Rooms',
          path: '/LandingPages/RoomsManagement',
          icon: MdList,
          exact: true
        },
        {
          label: '2D Map Editor',
          path: '/LandingPages/Rooms-Management/MapViewer',
          icon: MdMap,
          exact: true
        },
      ]
    },
    {
      icon: MdGroup,
      label: 'Faculty Management',
      path: '/LandingPages/FacultyManagement',
      hasSubmenu: true,
      submenu: [
        {
          label: 'Faculty Approval',
          path: '/LandingPages/FacultyManagement/FacultyApproval',
          icon: MdHowToReg,
          exact: true
        },
        {
          label: 'Faculty Colleges',
          path: '/LandingPages/FacultyColleges',
          icon: MdDomain,
          exact: true
        },
      ]
    },
    {
      icon: MdSchool,
      label: 'Course Management',
      hasSubmenu: true,
      submenu: [
        {
          label: 'All Courses',
          path: '/LandingPages/CoursesManagement',
          icon: MdMenuBook,
          exact: true
        },
      ]
    },
    {
      icon: MdCalendarToday,
      label: 'Room Schedule',
      path: '/LandingPages/RoomSchedule',
      hasSubmenu: true,
      submenu: [
        {
          label: 'Generate Schedule',
          path: '/LandingPages/RoomSchedule/GenerateSchedule',
          icon: MdEditCalendar,
          exact: true
        },
        {
          label: 'Schedule History',
          path: '/LandingPages/RoomSchedule/ViewSchedule',
          icon: MdVisibility
        },
        {
          label: 'Live Schedule',
          path: '/LandingPages/LiveTimetable',
          icon: MdLiveTv,
          exact: true
        },
      ]
    },
    { icon: MdUpload, label: 'Upload CSV', path: '/LandingPages/UploadCSV' },

  ]

  const handleNavigation = (path: string) => {
    if (path === '#archive') {
      setIsArchiveOpen(true)
      return
    }
    router.push(path)
  }

  const handleQueueBadgeNavigation = (event: React.MouseEvent | React.KeyboardEvent) => {
    event.preventDefault()
    event.stopPropagation()
    handleNavigation('/LandingPages/RoomSchedule/GenerateSchedule?focusQueue=1')
  }

  // Toggle submenu by index
  const toggleSubmenu = (idx: number) => {
    setOpenSubmenus(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }))
  }

  const isActiveSubmenu = (subItem: any) => {
    if (subItem.exact) {
      return pathname === subItem.path
    }
    return pathname.startsWith(subItem.path) && pathname !== '/LandingPages/GenerateSchedule'
  }

  return (
    <>
      <div
        className={`sidebar-overlay ${effectiveSidebarOpen ? 'active' : ''}`}
        onClick={onClose}
      />
      <aside className={`sidebar ${effectiveSidebarOpen ? 'open' : 'closed'} ${isMenuBarHidden ? 'menuHidden' : ''}`}>
        <nav className="sidebar-nav">
          {menuItems.map((item, index) => (
            <div key={index}>
              {item.hasSubmenu ? (
                <>
                  <button
                    onClick={() => toggleSubmenu(index)}
                    className={`sidebar-item ${openSubmenus[index] ? 'active' : ''}`}
                    aria-expanded={openSubmenus[index] ? 'true' : 'false'}
                    aria-controls={`submenu-${index}`}
                  >
                    <item.icon className="sidebar-icon" size={20} />
                    <span className="sidebar-label">{item.label}</span>
                    {item.label === 'Room Schedule' && queueState.available && (
                      <span
                        className={`queue-pressure-badge clickable ${queueState.active ? 'busy' : 'idle'}`}
                        title={queueState.active ? `Queue busy: ${queueState.waitingCount} waiting` : 'Queue idle'}
                        role="button"
                        tabIndex={0}
                        aria-label="Open schedule queue panel"
                        onClick={handleQueueBadgeNavigation}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            handleQueueBadgeNavigation(event)
                          }
                        }}
                      >
                        {queueState.active ? `${queueState.waitingCount}` : 'OK'}
                      </span>
                    )}
                    {openSubmenus[index] ? (
                      <MdKeyboardArrowDown className="submenu-icon" size={16} />
                    ) : (
                      <MdKeyboardArrowRight className="submenu-icon" size={16} />
                    )}
                  </button>
                  {openSubmenus[index] && (
                    <div className="submenu" id={`submenu-${index}`}>
                      {item.submenu?.map((subItem, subIndex) => (
                        <button
                          key={subIndex}
                          onClick={() => handleNavigation(subItem.path)}
                          className={`submenu-item ${isActiveSubmenu(subItem) ? 'active' : ''}`}
                          aria-current={isActiveSubmenu(subItem) ? 'page' : undefined}
                        >
                          {subItem.icon && <subItem.icon className="submenu-item-icon" size={16} />}
                          <span>{subItem.label}</span>
                          {subItem.label === 'Generate Schedule' && queueState.available && queueState.active && (
                            <span
                              className="queue-submenu-chip clickable"
                              title={`Queue busy: ${queueState.waitingCount} waiting`}
                              role="button"
                              tabIndex={0}
                              aria-label="Open generate schedule queue panel"
                              onClick={handleQueueBadgeNavigation}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  handleQueueBadgeNavigation(event)
                                }
                              }}
                            >
                              {queueState.waitingCount} in queue
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <button
                  onClick={() => handleNavigation(item.path ?? '/')}
                  className={`sidebar-item ${pathname === item.path ? 'active' : ''}`}
                  aria-current={pathname === item.path ? 'page' : undefined}
                >
                  <item.icon className="sidebar-icon" size={20} />
                  <span className="sidebar-label">{item.label}</span>
                </button>
              )}
            </div>
          ))}
        </nav>
      </aside>

      <ArchiveModal
        isOpen={isArchiveOpen}
        onClose={() => setIsArchiveOpen(false)}
        excludeType="notification"
      />
    </>
  )
}