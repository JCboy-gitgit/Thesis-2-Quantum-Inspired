'use client'

import React, { useState, useEffect, Suspense, useRef } from 'react'
import type { FormEvent, JSX } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
    <div className="login-page">
      <div className="background-container">
        <div className="stars"></div>
        <div className="quantum-orb quantum-orb-1"></div>
        <div className="quantum-orb quantum-orb-2"></div>
        <div className="glow-effect"></div>
      </div>
      <main className="container">
        <div className="card">
          <div className="card-header">
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
    <div className={`login-page ${loginTheme === 'light' ? 'login-light-theme' : ''}`}>
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

      {/* Content */}
      <main className="container">
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
