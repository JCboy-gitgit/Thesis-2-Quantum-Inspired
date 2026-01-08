'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  Home,
  Upload,
  Building2,
  Users,
  Calendar,
  ChevronDown,
  ChevronRight,
  CalendarPlus,
  Eye,
  ClipboardList,
  University,
  School,
  CalendarCheck2
} from 'lucide-react'
import './Sidebar.css'

interface SidebarProps {
  isOpen: boolean
}

export default function Sidebar({ isOpen }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  // Track open state for each submenu by index
  const [openSubmenus, setOpenSubmenus] = useState<{ [key: number]: boolean }>({})

  // Auto-expand schedule menu if on a schedule-related page
  useEffect(() => {
    // Only expand the relevant submenu, not all at once
    const newOpen: { [key: number]: boolean } = {}
    menuItems.forEach((item, idx) => {
      if (item.hasSubmenu && item.label === 'Schedule' && pathname.includes('/GenerateSchedule')) {
        newOpen[idx] = true
      }
      if (item.hasSubmenu && item.label === 'School Management' && (pathname.includes('/SchoolCapacity') || pathname.includes('/SchoolSchedules'))) {
        newOpen[idx] = true
      }
      if (item.hasSubmenu && item.label === 'Participants Management' && (pathname.includes('/QtimeParticipantsPage') || pathname.includes('/ParticipantSchedules'))) {
        newOpen[idx] = true
      }
    })
    setOpenSubmenus(newOpen)
    // eslint-disable-next-line
  }, [pathname])

  const menuItems = [
    { icon: Home, label: 'Home', path: '/LandingPages/QtimeHomePage' },
    {
      icon: University,
      label: 'Rooms Management',
      path: '/LandingPages/Rooms Management',
      hasSubmenu: true,
      submenu: [
        {
          label: '2D / 3D Map Viewer', 
          path: '/LandingPages/RoomsManagement/MapViewer',
          icon: School,
          exact: true
        },
        {
          label: 'Room List & Details',
          path: '/LandingPages/RoomsManagement/RoomLists&Details',
          icon: School,
          exact: true
        },
        {
          label: 'Add / Edit Rooms',
          path: '/LandingPages/RoomsManagement/Add-EditRooms',
          icon: School,
          exact: true
        },
        {
          label: 'Search / Filter Rooms',
          path: '/LandingPages/RoomsManagement/Search-FilterRooms',
          icon: CalendarCheck2,
        },
      ]
    },
    {
      icon: Users,
      label: 'Faculty Management',
      hasSubmenu: true,
      submenu: [
        {
          label: 'Faculty Lists',
          path: '/LandingPages/QtimeParticipantsPage',
          icon: Users,
          exact: true
        },
        {
          label: 'Faculty Profiles',
          path: '/LandingPages/QtimeParticipantsPage',
          icon: Users,
          exact: true
        },
        {
          label: 'Faculty Departments',
          path: '/LandingPages/ParticipantSchedules',
          icon: CalendarCheck2,
        },
      ]
    },
    {
      icon: Users,
      label: 'Courses Management',
      hasSubmenu: true,
      submenu: [
        {
          label: 'Courses Schedules',
          path: '/LandingPages/CoursesManagement',
          icon: CalendarCheck2,
          exact: true
        },
      ]
    },
    {
      icon: Calendar,
      label: 'Room Schedule',
      hasSubmenu: true,
      submenu: [
        {
          label: 'Generate Schedule',
          path: '/LandingPages/GenerateSchedule',
          icon: CalendarPlus,
          exact: true
        },
        {
          label: 'Room Schedules View',
          path: '/LandingPages/GenerateSchedule/ViewSchedule',
          icon: Eye
        },
      ]
    },
    { icon: Upload, label: 'Upload CSV', path: '/LandingPages/UploadCSV' },
  ]

  const handleNavigation = (path: string) => {
    router.push(path)
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
    <aside className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
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
                  {openSubmenus[index] ? (
                    <ChevronDown className="submenu-icon" size={16} />
                  ) : (
                    <ChevronRight className="submenu-icon" size={16} />
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
  )
}