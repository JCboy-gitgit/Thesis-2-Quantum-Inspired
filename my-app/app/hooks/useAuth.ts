'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { clearBrowserCaches } from '@/lib/clearCache'
import type { User, Session } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin123@ms.bulsu.edu.ph'

interface AuthState {
  user: User | null
  session: Session | null
  isAdmin: boolean
  isFaculty: boolean
  isLoading: boolean
  isAuthenticated: boolean
  userEmail: string | null
}

interface UseAuthOptions {
  requireAuth?: boolean
  requireAdmin?: boolean
  requireFaculty?: boolean
  redirectTo?: string
}

export function useAuth(options: UseAuthOptions = {}) {
  const router = useRouter()
  const {
    requireAuth = false,
    requireAdmin = false,
    requireFaculty = false,
    redirectTo = '/'
  } = options

  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    isAdmin: false,
    isFaculty: false,
    isLoading: true,
    isAuthenticated: false,
    userEmail: null
  })

  const checkAuth = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user) {
        setAuthState({
          user: null,
          session: null,
          isAdmin: false,
          isFaculty: false,
          isLoading: false,
          isAuthenticated: false,
          userEmail: null
        })

        if (requireAuth || requireAdmin || requireFaculty) {
          router.push(redirectTo)
        }
        return
      }

      const isAdmin = session.user.email === ADMIN_EMAIL
      const isFaculty = !isAdmin

      setAuthState({
        user: session.user,
        session,
        isAdmin,
        isFaculty,
        isLoading: false,
        isAuthenticated: true,
        userEmail: session.user.email || null
      })

      // Handle access restrictions
      if (requireAdmin && !isAdmin) {
        router.push('/faculty/home')
        return
      }

      if (requireFaculty && isAdmin) {
        router.push('/LandingPages/Home')
        return
      }

    } catch (error) {
      console.error('Auth check error:', error)
      setAuthState(prev => ({ ...prev, isLoading: false }))
      
      if (requireAuth || requireAdmin || requireFaculty) {
        router.push(redirectTo)
      }
    }
  }, [requireAuth, requireAdmin, requireFaculty, redirectTo, router])

  useEffect(() => {
    checkAuth()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const isAdmin = session.user.email === ADMIN_EMAIL
        setAuthState({
          user: session.user,
          session,
          isAdmin,
          isFaculty: !isAdmin,
          isLoading: false,
          isAuthenticated: true,
          userEmail: session.user.email || null
        })
      } else {
        // User is signed out — clear all browser caches to avoid stale data
        clearBrowserCaches()

        setAuthState({
          user: null,
          session: null,
          isAdmin: false,
          isFaculty: false,
          isLoading: false,
          isAuthenticated: false,
          userEmail: null
        })

        if (requireAuth || requireAdmin || requireFaculty) {
          router.push(redirectTo)
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [checkAuth, requireAuth, requireAdmin, requireFaculty, redirectTo, router])

  const signOut = async () => {
    await clearBrowserCaches()
    await supabase.auth.signOut()
    router.push('/')
  }

  const refreshAuth = () => {
    checkAuth()
  }

  return {
    ...authState,
    signOut,
    refreshAuth,
    ADMIN_EMAIL
  }
}

// Helper function for pages that only need to check auth once
export async function checkAuthOnce(): Promise<{
  isAuthenticated: boolean
  isAdmin: boolean
  user: User | null
  session: Session | null
}> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user) {
      return {
        isAuthenticated: false,
        isAdmin: false,
        user: null,
        session: null
      }
    }

    return {
      isAuthenticated: true,
      isAdmin: session.user.email === ADMIN_EMAIL,
      user: session.user,
      session
    }
  } catch (error) {
    console.error('Auth check error:', error)
    return {
      isAuthenticated: false,
      isAdmin: false,
      user: null,
      session: null
    }
  }
}

export default useAuth
