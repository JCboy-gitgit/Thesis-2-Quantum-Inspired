'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Map } from 'lucide-react'
import FacultySidebar from '@/app/components/FacultySidebar'
import FacultyMenuBar from '@/app/components/FacultyMenuBar'
import RoomViewer2D from '@/app/components/RoomViewer2D'
import { useTheme } from '@/app/context/ThemeContext'
import '@/app/styles/faculty-global.css'

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
  const { theme, collegeTheme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMenuBarHidden, setIsMenuBarHidden] = useState(false)
  const [user, setUser] = useState<UserProfile | null>(null)
  
  const isLightMode = theme === 'light'

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
      <div className={`min-h-screen flex flex-col items-center justify-center gap-5 ${
        isLightMode 
          ? 'bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 text-gray-800' 
          : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white'
      }`}>
        <div className={`w-12 h-12 border-4 rounded-full animate-spin ${
          isLightMode 
            ? 'border-emerald-500/30 border-t-emerald-500' 
            : 'border-cyan-500/30 border-t-cyan-500'
        }`}></div>
        <p className={`text-sm ${isLightMode ? 'text-gray-500' : 'text-slate-400'}`}>Loading campus map...</p>
      </div>
    )
  }

  return (
    <div 
      className={`min-h-screen faculty-page-wrapper ${
        isLightMode 
          ? 'bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50' 
          : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'
      }`} 
      data-theme={theme}
      data-college-theme={collegeTheme}
    >
      {/* Sidebar */}
      <FacultySidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        menuBarHidden={isMenuBarHidden}
      />

      {/* Main Layout */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${sidebarOpen ? 'md:ml-[250px]' : 'ml-0'}`}>
        {/* Faculty Menu Bar */}
        <FacultyMenuBar
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          sidebarOpen={sidebarOpen}
          isHidden={isMenuBarHidden}
          onToggleHidden={setIsMenuBarHidden}
          userEmail={user?.email}
        />

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
    </div>
  )
}
