'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  Home,
  Upload,
  Users,
  Calendar,
  ChevronDown,
  ChevronRight,
  CalendarPlus,
  Eye,
  Building2,
  Map,
  List,
  PenSquare,
  Search,
  UserCircle,
  Building,
  GraduationCap,
  BookOpen,
  UserCheck,
  UserCog,
  Bell,
  Radio
} from 'lucide-react'
import './Sidebar.css'

interface SidebarProps {
  isOpen: boolean
  menuBarHidden?: boolean
}

export default function Sidebar({ isOpen, menuBarHidden }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  // Track open state for each submenu by index
  const [openSubmenus, setOpenSubmenus] = useState<{ [key: number]: boolean }>({})

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

  const menuItems = [
    { icon: Home, label: 'Home', path: '/LandingPages/Home' },
    {
      icon: Building2,
      label: 'Room Management',
      path: '/LandingPages/RoomsManagement',
      hasSubmenu: true,
      submenu: [
        {
          label: 'All Rooms',
          path: '/LandingPages/RoomsManagement',
          icon: List,
          exact: true
        },
        {
          label: '2D Map Editor',
          path: '/LandingPages/Rooms-Management/MapViewer',
          icon: Map,
          exact: true
        },
      ]
    },
    {
      icon: Users,
      label: 'Faculty Management',
      path: '/LandingPages/FacultyManagement',
      hasSubmenu: true,
      submenu: [
        {
          label: 'Faculty Approval',
          path: '/LandingPages/FacultyManagement/FacultyApproval',
          icon: UserCheck,
          exact: true
        },
        {
          label: 'Faculty Colleges',
          path: '/LandingPages/FacultyColleges',
          icon: Building,
          exact: true
        },
      ]
    },
    {
      icon: GraduationCap,
      label: 'Course Management',
      hasSubmenu: true,
      submenu: [
        {
          label: 'All Courses',
          path: '/LandingPages/CoursesManagement',
          icon: BookOpen,
          exact: true
        },
      ]
    },
    {
      icon: Calendar,
      label: 'Room Schedule',
      path: '/LandingPages/RoomSchedule',
      hasSubmenu: true,
      submenu: [
        {
          label: 'Generate Schedule',
          path: '/LandingPages/RoomSchedule/GenerateSchedule',
          icon: CalendarPlus,
          exact: true
        },
        {
          label: 'Room Schedule View',
          path: '/LandingPages/RoomSchedule/ViewSchedule',
          icon: Eye
        },
        {
          label: 'Live Timetable',
          path: '/LandingPages/LiveTimetable',
          icon: Radio,
          exact: true
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
    <aside className={`sidebar ${isOpen ? 'open' : 'closed'} ${menuBarHidden ? 'menuHidden' : ''}`}>
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