'use client'

import React, { useState, useEffect } from 'react'
import type { FormEvent, JSX } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import '../../styles/login.css'

const eyeShowSVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>`
const eyeHideSVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24m4.24 4.24L3 3m6 6l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`

// Icon SVGs
const emailSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 6l-10 7L2 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const lockSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const checkCircleSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 4L12 14.01l-3-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const xCircleSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const clockSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`

export default function FacultyLoginPage(): JSX.Element {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [existingSession, setExistingSession] = useState<{ user: any; isActive: boolean } | null>(null)

  const ADMIN_EMAIL = 'admin123@ms.bulsu.edu.ph'

  // Check if already logged in - auto-redirect
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          console.error('Session check error:', error)
          return
        }

        if (session?.user && session.user.email !== ADMIN_EMAIL) {
          console.log('Found existing session for:', session.user.email)

          // Check if user is approved (is_active = true)
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('is_active, full_name')
            .eq('id', session.user.id)
            .single() as { data: { is_active: boolean; full_name: string } | null; error: any }

          if (userError) {
            console.error('User data check error:', userError)
            // If there's an error checking user data, sign out
            await supabase.auth.signOut()
            return
          }

          if (userData?.is_active) {
            // Auto-redirect for approved faculty
            router.replace('/faculty/home')
            return
          } else {
            console.log('User is not active, staying on login page')
          }
        } else if (session?.user?.email === ADMIN_EMAIL) {
          // Admin should go to admin home
          router.replace('/LandingPages/Home')
          return
        } else {
          console.log('No valid session found')
        }
      } catch (error) {
        console.error('Session check failed:', error)
      }
    }
    checkSession()
  }, [router, ADMIN_EMAIL])

  const handleContinueToDashboard = () => {
    router.push('/faculty/home')
  }

  const handleLoginDifferentAccount = async () => {
    await supabase.auth.signOut()
    setExistingSession(null)
    setEmail('')
    setPassword('')
    setMessage(null)
    setError(null)
  }

  const validate = (): boolean => {
    setError(null)
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setError('Please enter a valid email.')
      return false
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return false
    }
    return true
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    if (!validate()) return
    setLoading(true)
    setError(null)

    try {
      // Admin cannot login here
      if (email === ADMIN_EMAIL) {
        setError('Admin should use the Admin Login page.')
        setLoading(false)
        return
      }

      // Sign in
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      // Check if faculty is approved (is_active = true means approved)
      // Also check user_profiles for rejection status
      let userData: { is_active: boolean; full_name: string; id: string } | null = null

      // First try by user ID
      const { data: userById, error: userByIdError } = await supabase
        .from('users')
        .select('id, is_active, full_name')
        .eq('id', data.user.id)
        .single() as { data: { id: string; is_active: boolean; full_name: string } | null; error: any }

      if (!userByIdError && userById) {
        userData = userById
      } else {
        // Fallback: try by email
        const { data: userByEmail } = await supabase
          .from('users')
          .select('id, is_active, full_name')
          .eq('email', email)
          .single() as { data: { id: string; is_active: boolean; full_name: string } | null; error: any }

        userData = userByEmail
      }

      if (!userData) {
        await supabase.auth.signOut()
        setError('Your account is not found. Please register first.')
        setLoading(false)
        return
      }

      // Check if rejected in user_profiles
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('position')
        .eq('user_id', userData.id)
        .single() as { data: { position: string } | null; error: any }

      if (profileData?.position === 'REJECTED') {
        await supabase.auth.signOut()
        setError('Your registration was not approved. Please contact the administrator.')
        setLoading(false)
        return
      }

      if (!userData.is_active) {
        await supabase.auth.signOut()
        setError('Your account is pending admin approval. Please wait for confirmation.')
        setLoading(false)
        return
      }

      // Success
      setMessage(`Welcome back, ${userData.full_name || 'Faculty'}! Redirecting...`)
      setTimeout(() => {
        router.push('/faculty/home')
      }, 1500)

    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* Animated Background */}
      <div className="background-container">
        <div className="stars"></div>
        <div className="quantum-orb quantum-orb-1"></div>
        <div className="quantum-orb quantum-orb-2"></div>
        <div className="glow-effect"></div>
      </div>

      {/* Content */}
      <main className="container">
        <div className="card">
          <div className="card-header">
            <h1 className="title">
              {existingSession ? 'Welcome Back!' : 'Faculty Login'}
            </h1>
            <p className="subtitle">
              {existingSession
                ? `You are already logged in as ${existingSession.user.email}`
                : 'Access your faculty dashboard'
              }
            </p>
          </div>

          {existingSession ? (
            /* Existing Session UI */
            <div className="form">
              <div className="existing-session-message">
                <div className="session-info">
                  <div className="session-icon" dangerouslySetInnerHTML={{ __html: checkCircleSVG }} />
                  <div className="session-details">
                    <p><strong>Logged in as:</strong> {existingSession.user.email}</p>
                    <p><strong>Status:</strong> Active Faculty Member</p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleContinueToDashboard}
                className="button"
              >
                Continue to Dashboard
              </button>

              <div className="switch-row">
                <span className="switch-text">Want to login with different account?</span>
                <button
                  type="button"
                  onClick={handleLoginDifferentAccount}
                  className="link-button"
                >
                  Login Different Account
                </button>
              </div>
            </div>
          ) : (
            /* Login Form */
            <form onSubmit={handleSubmit} className="form">
              {/* Email Field */}
              <div className="form-group">
                <label className="label">
                  <span className="label-text">
                    <span dangerouslySetInnerHTML={{ __html: emailSVG }} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                    Email Address
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="toggle-password"
                      title={showPassword ? 'Hide password' : 'Show password'}
                      dangerouslySetInnerHTML={{ __html: showPassword ? eyeHideSVG : eyeShowSVG }}
                    />
                  </div>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className={`button ${loading ? 'loading' : ''}`}
              >
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    Logging in...
                  </>
                ) : (
                  <>Login to Dashboard</>
                )}
              </button>

              {/* Register Link */}
              <div className="switch-row">
                <span className="switch-text">Don't have an account?</span>
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="link-button"
                >
                  Register as Faculty
                </button>
              </div>

              {/* Admin Login Link */}
              <div className="switch-row faculty-login-link">
                <span className="switch-text">Administrator?</span>
                <button
                  type="button"
                  onClick={() => router.push('/?mode=admin')}
                  className="link-button"
                >
                  Admin Login →
                </button>
              </div>

              {/* Messages */}
              {message && <div className="message success">{message}</div>}
              {error && <div className="message error">{error}</div>}
            </form>
          )}

          {/* Footer */}
          <div className="card-footer">
            <p className="footer-text">
              Part of the Clarence Thesis Group System
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
