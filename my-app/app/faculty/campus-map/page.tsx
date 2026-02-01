'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Map, Menu, User, Bell, ChevronUp, ChevronDown, Settings, LogOut, X } from 'lucide-react'
import FacultySidebar from '@/app/components/FacultySidebar'
import RoomViewer2D from '@/app/components/RoomViewer2D'
import FacultySettingsModal from '@/app/components/FacultySettingsModal'
import { useTheme } from '@/app/context/ThemeContext'

interface UserProfile {
  id: string
  email: string
  full_name: string
  department_id?: number
  department?: string
  college?: string
  role: string
  is_active: boolean
  avatar_url?: string
}

export default function FacultyCampusMapPage() {
  const router = useRouter()
  const { collegeTheme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMenuBarHidden, setIsMenuBarHidden] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [user, setUser] = useState<UserProfile | null>(null)

  const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        router.push('/faculty/login')
        return
      }

      // Admin should not access faculty pages
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

      setUser(userData)
    } catch (error) {
      console.error('Auth check error:', error)
      router.push('/faculty/login')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white gap-5">
        <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
        <p className="text-sm text-slate-400">Loading campus map...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" data-college-theme={collegeTheme}>
      {/* Sidebar */}
      <FacultySidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        menuBarHidden={isMenuBarHidden}
      />

      {/* Main Layout */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${sidebarOpen ? 'md:ml-[250px]' : 'ml-0'}`}>
        {/* Top Header */}
        <header className={`fixed top-0 left-0 right-0 h-14 sm:h-16 md:h-[70px] flex items-center justify-between px-3 sm:px-4 md:px-8 bg-slate-900/95 backdrop-blur-md border-b-2 border-cyan-500/20 z-[90] transition-transform duration-300 shadow-lg ${isMenuBarHidden ? '-translate-y-full' : ''}`}>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Sidebar Toggle Button */}
            <button
              className="flex w-10 h-10 sm:w-11 sm:h-11 bg-transparent border-2 border-cyan-500/30 rounded-lg text-cyan-500 cursor-pointer items-center justify-center transition-all hover:bg-cyan-500/10 hover:border-cyan-500 hover:shadow-[0_0_15px_rgba(0,212,255,0.3)]"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
            >
              <Menu size={20} className="sm:w-6 sm:h-6" />
            </button>

            {/* Logo/Branding */}
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 bg-gradient-to-br from-cyan-400 via-cyan-500 to-cyan-700 rounded-lg sm:rounded-xl flex items-center justify-center font-extrabold text-lg sm:text-xl text-white shadow-lg">Q</span>
              <span className="hidden sm:block text-base sm:text-lg md:text-xl font-bold bg-gradient-to-r from-cyan-400 to-cyan-600 bg-clip-text text-transparent">Qtime Faculty</span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notifications */}
            <button className="w-9 h-9 sm:w-10 sm:h-10 bg-cyan-500/10 border-none rounded-lg text-cyan-500 cursor-pointer flex items-center justify-center transition-all hover:bg-cyan-500 hover:text-white" title="Notifications">
              <Bell size={18} className="sm:w-5 sm:h-5" />
            </button>

            {/* User Dropdown */}
            <div className="relative">
              <button
                className="w-10 h-10 sm:w-11 sm:h-11 bg-transparent border-2 border-cyan-500/30 rounded-full text-cyan-500 cursor-pointer flex items-center justify-center transition-all hover:bg-cyan-500/10 hover:border-cyan-500 hover:shadow-[0_0_15px_rgba(0,212,255,0.3)]"
                onClick={() => setShowUserMenu(!showUserMenu)}
                title="Account Menu"
              >
                <User size={18} className="sm:w-5 sm:h-5" />
              </button>

              {showUserMenu && (
                <>
                  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] md:hidden" onClick={() => setShowUserMenu(false)} />
                  <div className="fixed md:absolute inset-x-4 bottom-4 md:inset-auto md:top-[calc(100%+10px)] md:right-0 bg-slate-900/98 backdrop-blur-xl border-2 border-cyan-500/30 rounded-2xl shadow-2xl min-w-[280px] z-[1000] p-2 animate-in slide-in-from-bottom-5 md:slide-in-from-top-2 duration-200">
                    <button 
                      className="md:hidden absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <X size={18} />
                    </button>
                    {user?.email && (
                      <>
                        <div className="flex items-center gap-2.5 px-4 py-3 text-cyan-500 text-sm font-semibold break-all pr-10 md:pr-4">
                          <User size={16} />
                          {user.email}
                        </div>
                        <div className="h-px bg-cyan-500/20 my-1" />
                      </>
                    )}
                    <button
                      className="w-full p-3 bg-transparent border-none rounded-xl text-white/90 cursor-pointer flex items-center gap-3 text-sm font-medium transition-all hover:bg-cyan-500/15 hover:text-cyan-500 hover:translate-x-1 text-left"
                      onClick={() => {
                        setShowUserMenu(false)
                        router.push('/faculty/profile')
                      }}
                    >
                      <User size={16} />
                      Profile
                    </button>
                    <button
                      className="w-full p-3 bg-transparent border-none rounded-xl text-white/90 cursor-pointer flex items-center gap-3 text-sm font-medium transition-all hover:bg-cyan-500/15 hover:text-cyan-500 hover:translate-x-1 text-left"
                      onClick={() => {
                        setShowUserMenu(false)
                        setShowSettingsModal(true)
                      }}
                    >
                      <Settings size={16} />
                      Settings
                    </button>
                    <div className="h-px bg-cyan-500/20 my-1" />
                    <button
                      className="w-full p-3 bg-transparent border-none rounded-xl text-red-500 cursor-pointer flex items-center gap-3 text-sm font-medium transition-all hover:bg-red-500/15 text-left"
                      onClick={async () => {
                        setShowUserMenu(false)
                        await supabase.auth.signOut()
                        router.push('/faculty/login')
                      }}
                    >
                      <LogOut size={16} />
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Toggle Arrow Button */}
          <button
            className="absolute -bottom-5 left-1/2 -translate-x-1/2 w-12 h-6 bg-slate-900/95 border-2 border-t-0 border-cyan-500/20 rounded-b-xl cursor-pointer flex items-center justify-center text-cyan-500 transition-all z-[91] shadow-lg hover:bg-cyan-500/10 hover:border-cyan-500 hover:shadow-[0_0_20px_rgba(0,212,255,0.3)]"
            onClick={() => setIsMenuBarHidden(!isMenuBarHidden)}
            title={isMenuBarHidden ? 'Show Header' : 'Hide Header'}
          >
            <ChevronUp size={18} />
          </button>
        </header>

        {/* Floating Show Button when header is hidden */}
        {isMenuBarHidden && (
          <button
            className="fixed top-0 left-1/2 -translate-x-1/2 w-14 h-8 bg-slate-900/95 border-2 border-t-0 border-cyan-500/20 rounded-b-2xl cursor-pointer flex items-center justify-center text-cyan-500 transition-all z-[1001] shadow-lg hover:bg-cyan-500/10 hover:border-cyan-500 hover:shadow-[0_0_20px_rgba(0,212,255,0.3)] hover:translate-y-1 animate-in slide-in-from-top duration-300"
            onClick={() => setIsMenuBarHidden(false)}
            title="Show Header"
          >
            <ChevronDown size={18} />
          </button>
        )}

        {/* Main Content */}
        <main className="flex-1 px-3 sm:px-4 md:px-6 lg:px-8 pt-20 sm:pt-24 md:pt-28 pb-6 max-w-[1600px] mx-auto w-full box-border">
          {/* Page Header */}
          <div className="mb-4 sm:mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-cyan-400 via-cyan-500 to-cyan-700 rounded-xl flex items-center justify-center">
                <Map size={20} className="sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white m-0">Campus Floor Plan</h1>
                <p className="text-xs sm:text-sm text-slate-400 m-0 mt-1">Interactive view of campus buildings and room locations</p>
              </div>
            </div>
          </div>

          {/* Campus Map Viewer - Full Height */}
          <section className="bg-slate-800/80 border border-cyan-500/20 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 overflow-hidden">
            <div className="w-full" style={{ height: 'calc(100vh - 220px)', minHeight: '500px' }}>
              <RoomViewer2D collegeTheme={collegeTheme} />
            </div>
          </section>
        </main>
      </div>

      {/* Settings Modal */}
      <FacultySettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </div>
  )
}
