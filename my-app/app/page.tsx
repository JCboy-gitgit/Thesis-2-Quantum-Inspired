'use client'

import React, { useState, useEffect, Suspense, useRef } from 'react'
import type { FormEvent, JSX } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  MdAdminPanelSettings,
  MdAutoGraph,
  MdBolt,
  MdCheckCircle,
  MdFactCheck,
  MdGroups,
  MdPerson,
  MdPublish,
  MdSchedule,
  MdTimeline,
  MdTune,
  MdUploadFile,
} from 'react-icons/md'
import './styles/login.css'
import { supabase } from '@/lib/supabaseClient'
import { clearBrowserCaches } from '@/lib/clearCache'
import { fetchNoCache } from '@/lib/fetchUtils'

type ActiveTab = 'login' | 'signup'

interface College {
  id: number
  code: string
  name: string
  short_name?: string
  is_active: boolean
}

interface PreviewImageItem {
  key: string
  title: string
  caption: string
  alt: string
  lightSrc: string
  darkSrc: string
  large?: boolean
}

const PREVIEW_IMAGES: PreviewImageItem[] = [
  {
    key: 'admin-home',
    title: 'Admin Home',
    caption: 'Operational dashboard with key controls and status visibility',
    alt: 'Admin dashboard homepage preview',
    lightSrc: '/landing/admin-home.png',
    darkSrc: '/landing/dark/admin-home.png',
    large: true
  },
  {
    key: 'admin-view-schedule',
    title: 'Schedule View',
    caption: 'Generated timetable review and manual refinement workflow',
    alt: 'Admin schedule view preview',
    lightSrc: '/landing/admin-view-schedule.png',
    darkSrc: '/landing/dark/admin-view-schedule.png'
  },
  {
    key: 'admin-live-timetable',
    title: 'Live Timetable',
    caption: 'Real-time published schedule visibility for stakeholders',
    alt: 'Admin live timetable preview',
    lightSrc: '/landing/admin-live-timetable.png',
    darkSrc: '/landing/dark/admin-live-timetable.png'
  },
  {
    key: 'faculty-home',
    title: 'Faculty Home',
    caption: 'Focused view of assignments, schedule and notifications',
    alt: 'Faculty homepage preview',
    lightSrc: '/landing/faculty-home.png',
    darkSrc: '/landing/dark/faculty-home.png'
  },
  {
    key: 'faculty-view',
    title: 'Faculty Schedule View',
    caption: 'Personalized timetable access with streamlined navigation',
    alt: 'Faculty schedule view preview',
    lightSrc: '/landing/faculty-view.png',
    darkSrc: '/landing/dark/faculty-view.png'
  }
]

const FEATURE_ITEMS = [
  {
    key: 'admin-center',
    title: 'Admin Command Center',
    description: 'Manage colleges, departments, rooms, and faculty in one scheduling workspace.',
    Icon: MdAdminPanelSettings,
  },
  {
    key: 'faculty-portal',
    title: 'Faculty-Focused Portal',
    description: 'Faculty view assignments and updates without navigating admin complexity.',
    Icon: MdPerson,
  },
  {
    key: 'optimization-manual',
    title: 'Optimization + Manual Control',
    description: 'Start with generated schedules, then refine edge cases manually.',
    Icon: MdTune,
  },
  {
    key: 'transparency',
    title: 'Operational Transparency',
    description: 'Track pending, approved, and finalized changes with traceable edits.',
    Icon: MdFactCheck,
  },
  {
    key: 'live-schedule',
    title: 'Live Schedule',
    description: 'Watch timetable updates in real time as publishing and refinements happen.',
    Icon: MdSchedule,
  },
  {
    key: 'live-2d-map',
    title: 'Live 2D Map',
    description: 'View room usage and class placement from a live floor-map perspective.',
    Icon: MdTimeline,
  },  
]

const JOURNEY_ITEMS = [
  {
    key: 'data-foundation',
    badge: '01',
    title: 'Data Foundation',
    description: 'Load faculty details, room inventory, course offerings, and policy constraints into the system.',
    Icon: MdUploadFile,
  },
  {
    key: 'quantum-run',
    badge: '02',
    title: 'Quantum-Inspired Run',
    description: 'Generate candidate timetables that reduce collisions and improve overall schedule quality.',
    Icon: MdAutoGraph,
  },
  {
    key: 'human-validation',
    badge: '03',
    title: 'Human Validation',
    description: 'Review anomalies, refine schedule segments, and align final loads with institutional decisions.',
    Icon: MdSchedule,
  },
  {
    key: 'publish-monitor',
    badge: '04',
    title: 'Publish And Monitor',
    description: 'Release final timetables, monitor updates, and keep stakeholders aligned throughout the term.',
    Icon: MdPublish,
  },
]

const LANDING_SECTION_IDS = ['about', 'features', 'visuals', 'journey', 'workflow'] as const

const SYSTEM_COVER_ITEMS = [
  { key: 'onboarding', text: 'Faculty onboarding and approval workflow', Icon: MdGroups },
  { key: 'generation', text: 'Automated generation with manual refinement', Icon: MdTune },
  { key: 'publishing', text: 'Department timetable publishing with updates', Icon: MdPublish },
]

const eyeShowSVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>`
const eyeHideSVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24m4.24 4.24L3 3m6 6l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`

// Icon SVGs
const userSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const emailSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 6l-10 7L2 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const buildingSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 21h18M9 8h1m-1 4h1m-1 4h1m4-8h1m-1 4h1m-1 4h1M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const lockSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="login-page login-light-theme">
      <div className="background-container">
        <div className="stars"></div>
        <div className="quantum-orb quantum-orb-1"></div>
        <div className="quantum-orb quantum-orb-2"></div>
        <div className="glow-effect"></div>
      </div>
      <main className="container">
        <div className="card">
          <div className="card-header">
            <span className="spinner"></span>
            <h1 className="title">Loading...</h1>
          </div>
        </div>
      </main>
    </div>
  )
}

// Main page content component that uses useSearchParams
function PageContent(): JSX.Element {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [checkingSession, setCheckingSession] = useState(true)

  // Tab state
  const initialTab = searchParams.get('tab') === 'signup' ? 'signup' : 'login'
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab)
  const [tabAnimation, setTabAnimation] = useState<string>('')
  const prevTabRef = useRef<ActiveTab>(initialTab)

  // Login states
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [staySignedIn, setStaySignedIn] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginMessage, setLoginMessage] = useState<string | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)

  // Signup states
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('')
  const [signupFullName, setSignupFullName] = useState('')
  const [selectedCollege, setSelectedCollege] = useState('')
  const [showSignupPassword, setShowSignupPassword] = useState(false)
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false)
  const [colleges, setColleges] = useState<College[]>([])
  const [signupLoading, setSignupLoading] = useState(false)
  const [signupMessage, setSignupMessage] = useState<string | null>(null)
  const [signupError, setSignupError] = useState<string | null>(null)
  const [registerSuccess, setRegisterSuccess] = useState(false)

  // Forgot password states
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotMessage, setForgotMessage] = useState<string | null>(null)
  const [forgotError, setForgotError] = useState<string | null>(null)

  const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || ''

  // Login page theme (independent of app theme)
  const [loginTheme, setLoginTheme] = useState<'dark' | 'light'>('light')
  const [landingRevealReady, setLandingRevealReady] = useState(false)
  const [darkPreviewImagesReady, setDarkPreviewImagesReady] = useState(false)
  const [activePreviewIndex, setActivePreviewIndex] = useState(0)
  const [activeLandingSection, setActiveLandingSection] = useState<(typeof LANDING_SECTION_IDS)[number]>('about')
  const [hideStickyNav, setHideStickyNav] = useState(false)

  const previewCount = PREVIEW_IMAGES.length

  // Initialize theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('login-theme-preference')
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setLoginTheme(savedTheme)
    }
  }, [])

  // Particle data
  const [particles, setParticles] = useState<Array<{ left: string; top: string; delay: string; duration: string }>>([])
  const [sparkleParticles, setSparkleParticles] = useState<Array<{ left: string; top: string; delay: string; duration: string }>>([])

  useEffect(() => {
    let cancelled = false

    if (loginTheme !== 'dark') {
      setDarkPreviewImagesReady(false)
      return
    }

    const checkDarkImages = async () => {
      try {
        const checks = await Promise.all(
          PREVIEW_IMAGES.map(async (item) => {
            const res = await fetch(item.darkSrc, { method: 'HEAD', cache: 'no-store' })
            return res.ok
          })
        )

        if (!cancelled) {
          setDarkPreviewImagesReady(checks.every(Boolean))
        }
      } catch {
        if (!cancelled) {
          setDarkPreviewImagesReady(false)
        }
      }
    }

    checkDarkImages()

    return () => {
      cancelled = true
    }
  }, [loginTheme])

  useEffect(() => {
    if (previewCount <= 1) {
      return
    }

    const timer = window.setInterval(() => {
      setActivePreviewIndex((prev) => (prev + 1) % previewCount)
    }, 5000)

    return () => window.clearInterval(timer)
  }, [previewCount])

  const goToPreview = (direction: -1 | 1) => {
    if (previewCount <= 1) {
      return
    }

    setActivePreviewIndex((prev) => (prev + direction + previewCount) % previewCount)
  }

  // Check existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          if (session.user.email === ADMIN_EMAIL) {
            router.replace('/LandingPages/Home')
            return
          }
          const { data: userData } = await supabase
            .from('users')
            .select('is_active')
            .eq('id', session.user.id)
            .single() as { data: { is_active: boolean } | null; error: any }
          if (userData?.is_active) {
            router.replace('/faculty/home')
            return
          }
        }
      } catch (error) {
        console.error('Session check error:', error)
      } finally {
        setCheckingSession(false)
      }
    }
    checkSession()
  }, [router, ADMIN_EMAIL])

  // Generate particles on mount
  useEffect(() => {
    setParticles(
      Array.from({ length: 20 }, () => ({
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        delay: `${Math.random() * 5}s`,
        duration: `${8 + Math.random() * 12}s`
      }))
    )
    setSparkleParticles(
      Array.from({ length: 30 }, () => ({
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        delay: `${Math.random() * 2}s`,
        duration: `${2 + Math.random() * 2}s`
      }))
    )
  }, [])

  useEffect(() => {
    if (checkingSession) {
      return
    }

    const revealElements = Array.from(document.querySelectorAll<HTMLElement>('.landing-reveal'))
    if (!revealElements.length) {
      setLandingRevealReady(false)
      return
    }

    setLandingRevealReady(true)

    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      revealElements.forEach((el) => el.classList.add('is-visible'))
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
          } else {
            entry.target.classList.remove('is-visible')
          }
        })
      },
      { threshold: 0.2, rootMargin: '0px 0px -4% 0px' }
    )

    revealElements.forEach((el) => observer.observe(el))

    return () => {
      observer.disconnect()
    }
  }, [checkingSession])

  useEffect(() => {
    if (checkingSession || typeof window === 'undefined') {
      return
    }

    const sectionElements = LANDING_SECTION_IDS
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el))

    if (!sectionElements.length) {
      return
    }

    const updateActiveSectionFromScroll = () => {
      const nav = document.querySelector('.landing-nav') as HTMLElement | null
      const navHeight = nav?.offsetHeight ?? 72
      const targetLine = navHeight + 18
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight
      const scrollTop = window.scrollY || window.pageYOffset
      const docHeight = document.documentElement.scrollHeight

      // Keep section chip stable near page extremes.
      if (scrollTop <= 6) {
        setActiveLandingSection('about')
        return
      }
      if (scrollTop + viewportHeight >= docHeight - 6) {
        setActiveLandingSection('workflow')
        return
      }

      const candidates = sectionElements
        .map((section) => {
          const rect = section.getBoundingClientRect()
          const inViewBand = rect.bottom > targetLine && rect.top < viewportHeight * 0.8

          return {
            id: section.id as (typeof LANDING_SECTION_IDS)[number],
            distance: Math.abs(rect.top - targetLine),
            inViewBand
          }
        })
        .filter((item) => item.inViewBand)
        .sort((a, b) => a.distance - b.distance)

      if (!candidates.length) {
        return
      }

      setActiveLandingSection(candidates[0].id)
    }

    updateActiveSectionFromScroll()
    window.addEventListener('scroll', updateActiveSectionFromScroll, { passive: true })
    window.addEventListener('resize', updateActiveSectionFromScroll)

    return () => {
      window.removeEventListener('scroll', updateActiveSectionFromScroll)
      window.removeEventListener('resize', updateActiveSectionFromScroll)
    }
  }, [checkingSession, loginTheme])

  useEffect(() => {
    if (checkingSession || typeof window === 'undefined') {
      return
    }

    const authSection = document.getElementById('auth')
    if (!authSection) {
      return
    }

    const updateStickyNavVisibility = () => {
      const nav = document.querySelector('.landing-nav') as HTMLElement | null
      const navHeight = nav?.offsetHeight ?? 72
      const rect = authSection.getBoundingClientRect()
      const authCard = authSection.querySelector('.tabbed-card') as HTMLElement | null
      const forgotPasswordRow = authSection.querySelector('.forgot-password-link') as HTMLElement | null

      // Primary trigger: when auth card reaches nav zone (matches desired "hide here" behavior).
      // Fallback: forgot row or mid-auth for states where card target is unavailable.
      const cardTop = authCard?.getBoundingClientRect().top
      const fallbackTop = forgotPasswordRow
        ? forgotPasswordRow.getBoundingClientRect().top
        : rect.top + rect.height * 0.45
      const triggerTop = cardTop ?? fallbackTop

      const cardBottom = authCard?.getBoundingClientRect().bottom
      const authStillVisible = (cardBottom ?? rect.bottom) > navHeight * 0.35

      setHideStickyNav(triggerTop <= navHeight + 12 && authStillVisible)
    }

    updateStickyNavVisibility()
    window.addEventListener('scroll', updateStickyNavVisibility, { passive: true })
    window.addEventListener('resize', updateStickyNavVisibility)

    return () => {
      window.removeEventListener('scroll', updateStickyNavVisibility)
      window.removeEventListener('resize', updateStickyNavVisibility)
    }
  }, [checkingSession, loginTheme])

  // Fetch colleges on mount
  useEffect(() => {
    fetchColleges()
  }, [])

  const fetchColleges = async () => {
    try {
      const response = await fetchNoCache('/api/colleges')
      const data = await response.json()
      if (data.colleges) {
        setColleges(data.colleges)
      }
    } catch (error) {
      console.error('Error fetching colleges:', error)
    }
  }

  // Handle tab change with animation
  const handleTabChange = (newTab: ActiveTab) => {
    if (newTab === activeTab) return

    const direction = newTab === 'signup' ? 'right' : 'left'
    setTabAnimation(`exiting-${direction}`)

    setTimeout(() => {
      prevTabRef.current = activeTab
      setActiveTab(newTab)
      setTabAnimation(`entering-${direction === 'right' ? 'right' : 'left'}`)

      setTimeout(() => {
        setTabAnimation('')
      }, 350)
    }, 150)
  }

  const openAuthPanel = (targetTab: ActiveTab) => {
    if (targetTab !== activeTab) {
      handleTabChange(targetTab)
    }
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '#auth')
      document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Forgot Password Handler
  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault()
    setForgotError(null)
    setForgotMessage(null)

    if (!forgotEmail || !/^\S+@\S+\.\S+$/.test(forgotEmail)) {
      setForgotError('Please enter a valid email address.')
      return
    }

    setForgotLoading(true)

    try {
      const response = await fetch('/api/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset email')
      }

      setForgotMessage('Password reset link sent! Please check your email inbox.')
      setTimeout(() => {
        setShowForgotPassword(false)
        setForgotEmail('')
        setForgotMessage(null)
      }, 3000)
    } catch (err: any) {
      setForgotError(err?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setForgotLoading(false)
    }
  }

  const closeForgotPasswordModal = () => {
    setShowForgotPassword(false)
    setForgotEmail('')
    setForgotError(null)
    setForgotMessage(null)
  }

  // Login handler
  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setLoginMessage(null)
    setLoginError(null)

    if (!loginEmail || !/^\S+@\S+\.\S+$/.test(loginEmail)) {
      setLoginError('Please enter a valid email.')
      return
    }
    if (loginPassword.length < 6) {
      setLoginError('Password must be at least 6 characters.')
      return
    }

    setLoginLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword
      })
      if (error) throw error

      // Check if admin
      if (loginEmail === ADMIN_EMAIL) {
        if (staySignedIn) {
          localStorage.setItem('adminStaySignedIn', 'true')
        }

        // Map login theme to admin theme: dark → dark, light → green (default admin)
        const adminTheme = loginTheme === 'dark' ? 'dark' : 'green'
        localStorage.setItem('admin-base-theme', adminTheme)
        document.documentElement.setAttribute('data-theme', adminTheme)
        document.body.setAttribute('data-theme', adminTheme)

        setLoginMessage('Admin login successful. Redirecting...')
        sessionStorage.setItem('sidebar_fresh_login', 'true')
        setTimeout(() => {
          router.push('/LandingPages/Home')
        }, 1000)
        return
      }

      // Faculty login flow
      const { data: userData } = await supabase
        .from('users')
        .select('id, is_active, full_name')
        .eq('id', data.user.id)
        .single() as { data: { id: string; is_active: boolean; full_name: string } | null; error: any }

      if (!userData) {
        await clearBrowserCaches()
        await supabase.auth.signOut()
        setLoginError('Account not found. Please register first.')
        setLoginLoading(false)
        return
      }

      // Check if rejected
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('position')
        .eq('user_id', userData.id)
        .single() as { data: { position: string } | null; error: any }

      if (profileData?.position === 'REJECTED') {
        await clearBrowserCaches()
        await supabase.auth.signOut()
        setLoginError('Your registration was not approved. Please contact the administrator.')
        setLoginLoading(false)
        return
      }

      if (!userData.is_active) {
        await clearBrowserCaches()
        await supabase.auth.signOut()
        setLoginError('Your account is pending admin approval. Please wait for confirmation.')
        setLoginLoading(false)
        return
      }

      // Generate session token
      try {
        const presenceResponse = await fetch('/api/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'login',
            user_id: userData.id
          })
        })

        const contentType = presenceResponse.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          const presenceData = await presenceResponse.json()
          if (presenceData.session_token) {
            localStorage.setItem('faculty_session_token', presenceData.session_token)
          }
        }
      } catch (presenceError) {
        console.error('Presence API error:', presenceError)
      }

      if (staySignedIn) {
        localStorage.setItem('faculty_keep_signed_in', 'true')
      }

      // Set theme before navigation
      // Sync theme to faculty preference
      localStorage.setItem('faculty-base-theme', loginTheme)
      const savedCollegeTheme = localStorage.getItem('faculty-college-theme') || 'default'

      const effectiveTheme = loginTheme
      document.documentElement.setAttribute('data-theme', effectiveTheme)
      document.body.setAttribute('data-theme', effectiveTheme)

      const bgColor = effectiveTheme === 'light' ? '#f5f7fa' : '#0a0e27'
      document.body.style.backgroundColor = bgColor
      document.documentElement.style.backgroundColor = bgColor

      if (savedCollegeTheme) {
        document.documentElement.setAttribute('data-college-theme', savedCollegeTheme)
      }

      setLoginMessage(`Welcome back, ${userData.full_name || 'Faculty'}! Redirecting...`)
      setTimeout(() => {
        router.replace('/faculty/home')
      }, 1000)

    } catch (err: any) {
      setLoginError(err?.message ?? String(err))
    } finally {
      setLoginLoading(false)
    }
  }

  // Signup handler
  async function handleSignup(e: FormEvent) {
    e.preventDefault()
    setSignupMessage(null)
    setSignupError(null)

    if (!signupFullName.trim()) {
      setSignupError('Please enter your full name.')
      return
    }
    if (!signupEmail || !/^\S+@\S+\.\S+$/.test(signupEmail)) {
      setSignupError('Please enter a valid email.')
      return
    }
    if (!selectedCollege) {
      setSignupError('Please select your college.')
      return
    }
    if (signupPassword.length < 6) {
      setSignupError('Password must be at least 6 characters.')
      return
    }
    if (signupPassword !== signupConfirmPassword) {
      setSignupError('Passwords do not match.')
      return
    }

    setSignupLoading(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: signupEmail,
          password: signupPassword,
          fullName: signupFullName,
          college: selectedCollege
        })
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Registration failed')
      }

      setSignupMessage('Registration successful! Please verify your email, then wait for admin approval.')
      setRegisterSuccess(true)
      setTimeout(() => {
        setSignupEmail('')
        setSignupPassword('')
        setSignupConfirmPassword('')
        setSignupFullName('')
        setSelectedCollege('')
        setRegisterSuccess(false)
      }, 5000)
    } catch (err: any) {
      setSignupError(err?.message ?? String(err))
    } finally {
      setSignupLoading(false)
    }
  }

  if (checkingSession) {
    return <LoadingFallback />
  }

  // Toggle login page theme
  const toggleLoginTheme = () => {
    const newTheme = loginTheme === 'dark' ? 'light' : 'dark'
    setLoginTheme(newTheme)
    localStorage.setItem('login-theme-preference', newTheme)
  }

  // Theme toggle button SVGs
  const sunSVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
  const moonSVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`

  return (
    <div className={`login-page login-hub-page ${loginTheme === 'light' ? 'login-light-theme' : ''}`}>
      {/* Theme Toggle Button */}
      <button
        type="button"
        className="login-theme-toggle"
        onClick={toggleLoginTheme}
        title={loginTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        aria-label={loginTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        <span
          className="theme-toggle-icon"
          dangerouslySetInnerHTML={{ __html: loginTheme === 'dark' ? sunSVG : moonSVG }}
        />
      </button>

      {/* Animated Background */}
      <div className="background-container">
        <div className="stars"></div>
        <div className="quantum-orb quantum-orb-1"></div>
        <div className="quantum-orb quantum-orb-2"></div>
        <div className="ambient-orb"></div>
        <div className="glow-effect"></div>
        <div className="floating-particles">
          {particles.map((particle, i) => (
            <span
              key={i}
              className="particle"
              style={{
                left: particle.left,
                top: particle.top,
                animationDelay: particle.delay,
                animationDuration: particle.duration
              }}
            ></span>
          ))}
        </div>
        {/* Light mode floating elements */}
        {loginTheme === 'light' && (
          <div className="light-particles">
            {particles.slice(0, 12).map((particle, i) => (
              <span
                key={i}
                className="light-particle"
                style={{
                  left: particle.left,
                  top: particle.top,
                  animationDelay: particle.delay,
                  animationDuration: particle.duration
                }}
              ></span>
            ))}
          </div>
        )}
      </div>

      {/* Sparkle Animation Overlay for Register Success */}
      {registerSuccess && (
        <div className="animation-overlay sparkle-overlay">
          <div className="starry-background"></div>
          {sparkleParticles.map((particle, i) => (
            <span
              key={i}
              className="sparkle-particle"
              style={{
                left: particle.left,
                top: particle.top,
                animationDelay: particle.delay,
                animationDuration: particle.duration
              }}
            ></span>
          ))}
          <div className="quantum-portal">
            <div className="portal-ring"></div>
            <div className="portal-core"></div>
          </div>
        </div>
      )}

      <section className={`landing-shell ${landingRevealReady ? 'landing-animations-ready' : ''}`} id="home">
        <header className={`landing-nav landing-reveal ${hideStickyNav ? 'is-hidden' : ''}`} data-reveal-order="1">
          <a href="#home" className="landing-brand">
            <img src="/app-icon.png" alt="Qtime logo" className="landing-brand-logo" />
            <span className="landing-brand-text">Qtime</span>
          </a>
          <nav className="landing-links" aria-label="Landing page sections">
            <a href="#about" className={`landing-link-chip ${activeLandingSection === 'about' ? 'is-active' : ''}`} aria-current={activeLandingSection === 'about' ? 'page' : undefined}>About</a>
            <a href="#features" className={`landing-link-chip ${activeLandingSection === 'features' ? 'is-active' : ''}`} aria-current={activeLandingSection === 'features' ? 'page' : undefined}>Features</a>
            <a href="#visuals" className={`landing-link-chip ${activeLandingSection === 'visuals' ? 'is-active' : ''}`} aria-current={activeLandingSection === 'visuals' ? 'page' : undefined}>Visuals</a>
            <a href="#journey" className={`landing-link-chip ${activeLandingSection === 'journey' ? 'is-active' : ''}`} aria-current={activeLandingSection === 'journey' ? 'page' : undefined}>Journey</a>
            <a href="#workflow" className={`landing-link-chip ${activeLandingSection === 'workflow' ? 'is-active' : ''}`} aria-current={activeLandingSection === 'workflow' ? 'page' : undefined}>Flow</a>
          </nav>
          <div className="landing-nav-actions">
            <button type="button" className="landing-ghost-btn" onClick={() => openAuthPanel('login')}>
              Login
            </button>
            <button type="button" className="landing-primary-btn" onClick={() => openAuthPanel('signup')}>
              Register
            </button>
          </div>
        </header>

        <section className="landing-hero landing-reveal" data-reveal-order="2">
          <div className="landing-hero-copy">
            <p className="landing-kicker">Clarence Thesis Group | Quantum-Inspired Scheduling</p>
            <h1>Plan Conflict-Free Faculty Schedules With Confidence</h1>
            <p>
              Qtime helps colleges generate optimized timetables, balance teaching loads, and keep schedule decisions
              transparent for both admin and faculty.
            </p>
            <aside className="landing-hero-media" aria-hidden="true">
              <div className="landing-hero-media-item">
                <img
                  src={loginTheme === 'dark' && darkPreviewImagesReady ? '/landing/dark/qia-scheduler.png' : '/landing/qia-scheduler.png'}
                  alt=""
                  loading="lazy"
                  width={1405}
                  height={725}
                />
              </div>
            </aside>
            <div className="landing-hero-actions">
              <button
                type="button"
                className="landing-primary-btn landing-primary-btn-pulse"
                onClick={() => openAuthPanel('login')}
              >
                Enter Dashboard
              </button>
              <button type="button" className="landing-ghost-btn" onClick={() => openAuthPanel('signup')}>
                Create Faculty Account
              </button>
            </div>
            <div className="landing-stat-row" aria-label="System value highlights">
              <article className="landing-stat-combined">
                <div className="landing-stat-item">
                  <div className="landing-stat-head">
                    <span className="landing-stat-icon" aria-hidden="true"><MdCheckCircle size={14} /></span>
                    <strong>Conflict checks</strong>
                  </div>
                  <span>Room, slot, and faculty availability validation</span>
                </div>

                <div className="landing-stat-item">
                  <div className="landing-stat-head">
                    <span className="landing-stat-icon" aria-hidden="true"><MdGroups size={14} /></span>
                    <strong>Role clarity</strong>
                  </div>
                  <span>Admin control with simplified faculty visibility</span>
                </div>

                <div className="landing-stat-item">
                  <div className="landing-stat-head">
                    <span className="landing-stat-icon" aria-hidden="true"><MdTimeline size={14} /></span>
                    <strong>Status tracking</strong>
                  </div>
                  <span>Follow progress from draft to published timetable</span>
                </div>
              </article>
            </div>
          </div>
          <div className="landing-hero-side" aria-label="Platform and system overview cards">
            <div className="landing-section-divider"><span>About</span></div>
            <section id="about" className="landing-section landing-side-card">
              <p className="landing-card-kicker">Platform Brief</p>
              <h2>About The Platform</h2>
              <p>
                Developed by the Clarence Thesis Group, this platform combines quantum-inspired optimization with practical
                controls to reduce manual work and improve fairness in load distribution.
              </p>
            </section>

            <aside className="landing-hero-panel landing-side-card" aria-label="System overview card">
              <p className="landing-card-kicker">Capabilities</p>
              <h2>What The System Covers</h2>
              <ul>
                {SYSTEM_COVER_ITEMS.map(({ key, text, Icon }) => (
                  <li key={key} className="landing-cover-item">
                    <span className="landing-cover-icon" aria-hidden="true"><Icon size={14} /></span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </aside>

          </div>
        </section>

        <div className="landing-section-divider"><span>Features</span></div>
        <section id="features" className="landing-feature-grid landing-reveal" data-reveal-order="3">
          {FEATURE_ITEMS.map(({ key, title, description, Icon }) => (
            <article key={key}>
              <div className="landing-card-icon" aria-hidden="true">
                <Icon size={16} />
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </section>

        <div className="landing-section-divider"><span>Visuals</span></div>
        <section id="visuals" className="landing-system-visuals landing-reveal" data-reveal-order="4">
          <div className="landing-section-head">
            <h2>System Preview</h2>
            <p>Actual captured interfaces from admin and faculty accounts inside your running system.</p>
          </div>
          <div className="preview-carousel" aria-label="System preview gallery" aria-roledescription="carousel">
            <div className="preview-carousel-stage">
              <button
                type="button"
                className="preview-arrow preview-arrow-left"
                aria-label="Show previous preview"
                onClick={() => goToPreview(-1)}
              >
                <span aria-hidden="true">&lt;</span>
              </button>

              <div className="preview-carousel-viewport">
                {[
                  (activePreviewIndex - 1 + previewCount) % previewCount,
                  activePreviewIndex,
                  (activePreviewIndex + 1) % previewCount
                ].map((previewIndex, slotIndex) => {
                  const item = PREVIEW_IMAGES[previewIndex]
                  const themedSrc = loginTheme === 'dark' && darkPreviewImagesReady ? item.darkSrc : item.lightSrc
                  const isCenter = slotIndex === 1

                  return (
                    <article
                      key={`${item.key}-${slotIndex}`}
                      className={`preview-slide ${isCenter ? 'is-center' : 'is-side'}`}
                      aria-label={`${isCenter ? 'Current' : 'Adjacent'} preview: ${item.title}`}
                    >
                      <div className="preview-slide-card">
                        <img src={themedSrc} alt={item.alt} loading="lazy" width={1405} height={725} />
                        <div className="visual-caption">
                          <p className="preview-caption-role">{isCenter ? 'Current View' : 'Side Preview'}</p>
                          <strong>{item.title}</strong>
                          <span>{item.caption}</span>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>

              <button
                type="button"
                className="preview-arrow preview-arrow-right"
                aria-label="Show next preview"
                onClick={() => goToPreview(1)}
              >
                <span aria-hidden="true">&gt;</span>
              </button>
            </div>

            <div className="preview-direction-hints" aria-hidden="true">
              <span className="preview-direction-pill preview-direction-pill-left">
              {PREVIEW_IMAGES[(activePreviewIndex - 1 + previewCount) % previewCount].title}
              </span>
              <span className="preview-direction-pill preview-direction-pill-current">
              {PREVIEW_IMAGES[activePreviewIndex].title}
              </span>
              <span className="preview-direction-pill preview-direction-pill-right">
              {PREVIEW_IMAGES[(activePreviewIndex + 1) % previewCount].title}
              </span>
            </div>

            <div className="preview-carousel-dots" aria-label="System preview slide controls">
              {PREVIEW_IMAGES.map((item, index) => (
                <button
                  key={item.key}
                  type="button"
                  className={`preview-dot ${index === activePreviewIndex ? 'is-active' : ''}`}
                  aria-label={`Go to ${item.title}`}
                  onClick={() => setActivePreviewIndex(index)}
                />
              ))}
            </div>
          </div>
        </section>

        <div className="landing-section-divider"><span>Journey</span></div>
        <section id="journey" className="landing-story-strip landing-reveal" data-reveal-order="5">
          {JOURNEY_ITEMS.map(({ key, badge, title, description, Icon }) => (
            <article key={key} className="story-card">
              <div className="story-top-row">
                <p className="story-badge">{badge}</p>
                <span className="story-icon" aria-hidden="true">
                  <Icon size={16} />
                </span>
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </section>

        <div className="landing-section-divider"><span>Flow</span></div>
        <section id="workflow" className="landing-section landing-workflow landing-reveal" data-reveal-order="6">
          <h2>How It Works</h2>
          <ol>
            <li>Sign in as admin or register as faculty.</li>
            <li>Prepare faculty, room, subject, and constraint data.</li>
            <li>Generate schedules, review conflicts, then publish.</li>
          </ol>
        </section>
      </section>

      {/* Content */}
      <main id="auth" className="container auth-shell auth-shell-open">
        <div className="card tabbed-card">
          {/* Tab Header */}
          <div className="card-header">
            <div className="tab-container">
              <button
                type="button"
                className={`tab-button ${activeTab === 'login' ? 'active' : ''}`}
                onClick={() => handleTabChange('login')}
              >
                Login
              </button>
              <button
                type="button"
                className={`tab-button ${activeTab === 'signup' ? 'active' : ''}`}
                onClick={() => handleTabChange('signup')}
              >
                Sign Up
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="tab-content-wrapper">
            {activeTab === 'login' ? (
              <div className={`tab-content ${tabAnimation}`}>
                {/* Login Content */}
                <div className="tab-content-header">
                  {/* Qtime Logo */}
                  <div className="qtime-logo-container">
                    <img
                      src="/app-icon.png"
                      alt="Qtime Logo"
                      className="qtime-logo"
                    />
                    <span className="qtime-brand-text">Qtime</span>
                  </div>
                  <h2 className="tab-content-title">Log in to Your Account</h2>
                  <p className="tab-content-subtitle">Admin and Faculty access</p>
                </div>

                <form onSubmit={handleLogin} className="form">
                  {/* Email Field */}
                  <div className="form-group">
                    <label className="label">
                      <span className="label-text">
                        <span dangerouslySetInnerHTML={{ __html: emailSVG }} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                        E-mail address
                      </span>
                      <input
                        type="email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="input"
                        placeholder="your@email.com"
                        required
                      />
                    </label>
                  </div>

                  {/* Password Field */}
                  <div className="form-group">
                    <label className="label">
                      <span className="label-text">
                        <span dangerouslySetInnerHTML={{ __html: lockSVG }} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                        Password
                      </span>
                      <div className="password-input-wrapper">
                        <input
                          type={showLoginPassword ? 'text' : 'password'}
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="input"
                          placeholder="••••••••"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                          className="toggle-password"
                          title={showLoginPassword ? 'Hide password' : 'Show password'}
                          dangerouslySetInnerHTML={{ __html: showLoginPassword ? eyeHideSVG : eyeShowSVG }}
                        />
                      </div>
                    </label>
                  </div>

                  {/* Stay Signed In & Forgot Password */}
                  <div className="form-group checkbox-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={staySignedIn}
                        onChange={(e) => setStaySignedIn(e.target.checked)}
                        className="checkbox-input"
                      />
                      <span className="checkbox-text">Remember me</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="forgot-password-link"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loginLoading}
                    className={`button ${loginLoading ? 'loading' : ''}`}
                  >
                    {loginLoading ? (
                      <>
                        <span className="spinner"></span>
                        Logging in...
                      </>
                    ) : (
                      <>LOGIN</>
                    )}
                  </button>

                  {/* Messages */}
                  {loginMessage && <div className="message success">{loginMessage}</div>}
                  {loginError && <div className="message error">{loginError}</div>}

                  {/* Switch to Sign Up */}
                  <div className="switch-row">
                    <span className="switch-text">Don't have an account yet?</span>
                    <button
                      type="button"
                      onClick={() => handleTabChange('signup')}
                      className="link-button"
                    >
                      SIGN UP
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className={`tab-content ${tabAnimation}`}>
                {/* Signup Content */}
                <div className="tab-content-header">
                  <h2 className="tab-content-title">Faculty Registration</h2>
                  <p className="tab-content-subtitle">Register as faculty. You will be approved by admin.</p>
                </div>

                <form onSubmit={handleSignup} className="form">
                  {/* Full Name Field */}
                  <div className="form-group">
                    <label className="label">
                      <span className="label-text">
                        <span dangerouslySetInnerHTML={{ __html: userSVG }} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                        Full Name
                      </span>
                      <input
                        type="text"
                        value={signupFullName}
                        onChange={(e) => setSignupFullName(e.target.value)}
                        className="input"
                        placeholder="Juan Dela Cruz"
                        required
                      />
                    </label>
                  </div>

                  {/* Email Field */}
                  <div className="form-group">
                    <label className="label">
                      <span className="label-text">
                        <span dangerouslySetInnerHTML={{ __html: emailSVG }} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                        Email Address
                      </span>
                      <input
                        type="email"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        className="input"
                        placeholder="your@email.com"
                        required
                      />
                    </label>
                  </div>

                  {/* College Selection */}
                  <div className="form-group">
                    <label className="label">
                      <span className="label-text">
                        <span dangerouslySetInnerHTML={{ __html: buildingSVG }} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                        Select your College
                      </span>
                      <select
                        value={selectedCollege}
                        onChange={(e) => setSelectedCollege(e.target.value)}
                        className="input select-input"
                        required
                      >
                        <option value="">Select your college...</option>
                        {colleges.map((college) => (
                          <option key={college.id} value={college.name}>
                            {college.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {/* Password Field */}
                  <div className="form-group">
                    <label className="label">
                      <span className="label-text">
                        <span dangerouslySetInnerHTML={{ __html: lockSVG }} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                        Create Password
                      </span>
                      <div className="password-input-wrapper">
                        <input
                          type={showSignupPassword ? 'text' : 'password'}
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          className="input"
                          placeholder="••••••••"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignupPassword(!showSignupPassword)}
                          className="toggle-password"
                          title={showSignupPassword ? 'Hide password' : 'Show password'}
                          dangerouslySetInnerHTML={{ __html: showSignupPassword ? eyeHideSVG : eyeShowSVG }}
                        />
                      </div>
                    </label>
                  </div>

                  {/* Confirm Password Field */}
                  <div className="form-group">
                    <label className="label">
                      <span className="label-text">
                        <span dangerouslySetInnerHTML={{ __html: lockSVG }} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                        Confirm Password
                      </span>
                      <div className="password-input-wrapper">
                        <input
                          type={showSignupConfirmPassword ? 'text' : 'password'}
                          value={signupConfirmPassword}
                          onChange={(e) => setSignupConfirmPassword(e.target.value)}
                          className="input"
                          placeholder="••••••••"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignupConfirmPassword(!showSignupConfirmPassword)}
                          className="toggle-password"
                          title={showSignupConfirmPassword ? 'Hide password' : 'Show password'}
                          dangerouslySetInnerHTML={{ __html: showSignupConfirmPassword ? eyeHideSVG : eyeShowSVG }}
                        />
                      </div>
                    </label>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={signupLoading}
                    className={`button ${signupLoading ? 'loading' : ''}`}
                  >
                    {signupLoading ? (
                      <>
                        <span className="spinner"></span>
                        Registering...
                      </>
                    ) : (
                      <>REGISTER</>
                    )}
                  </button>

                  {/* Messages */}
                  {signupMessage && <div className="message success">{signupMessage}</div>}
                  {signupError && <div className="message error">{signupError}</div>}

                  {/* Switch to Login */}
                  <div className="switch-row">
                    <span className="switch-text">Already have an account?</span>
                    <button
                      type="button"
                      onClick={() => handleTabChange('login')}
                      className="link-button"
                    >
                      LOGIN
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="card-footer">
            <p className="footer-text">
              Clarence Thesis Group System
            </p>
          </div>
        </div>
      </main>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="modal-overlay" onClick={closeForgotPasswordModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="modal-close"
              onClick={closeForgotPasswordModal}
              aria-label="Close"
            >
              ×
            </button>
            <div className="modal-header">
              <div className="modal-icon">
                <span dangerouslySetInnerHTML={{ __html: lockSVG }} />
              </div>
              <h2 className="modal-title">Forgot Password</h2>
              <p className="modal-subtitle">
                Enter your registered email address and we'll send you a link to reset your password.
              </p>
            </div>
            <form onSubmit={handleForgotPassword} className="modal-form">
              <div className="form-group">
                <label className="label">
                  <span className="label-text">
                    <span dangerouslySetInnerHTML={{ __html: emailSVG }} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                    Email Address
                  </span>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="input"
                    placeholder="your@email.com"
                    required
                    autoFocus
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={forgotLoading}
                className={`button ${forgotLoading ? 'loading' : ''}`}
              >
                {forgotLoading ? (
                  <>
                    <span className="spinner"></span>
                    Sending...
                  </>
                ) : (
                  <>Send Reset Link</>
                )}
              </button>

              {forgotMessage && <div className="message success">{forgotMessage}</div>}
              {forgotError && <div className="message error">{forgotError}</div>}

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={closeForgotPasswordModal}
                  className="link-button"
                >
                  ← Back to Login
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// Default export wrapped with Suspense for useSearchParams
export default function Page(): JSX.Element {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PageContent />
    </Suspense>
  )
}
