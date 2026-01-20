'use client'

import React, { useState, useEffect } from 'react'
import type { FormEvent, JSX } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import './styles/login.css'
import { supabase } from '@/lib/supabaseClient'

type Mode = 'login' | 'register'

interface Department {
  id: number
  department_code: string
  department_name: string
  college: string | null
}

const eyeShowSVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>`
const eyeHideSVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24m4.24 4.24L3 3m6 6l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`

// Icon SVGs
const userSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const emailSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 6l-10 7L2 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const buildingSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 21h18M9 8h1m-1 4h1m-1 4h1m4-8h1m-1 4h1m-1 4h1M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const lockSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const lockClosedSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>`

export default function Page(): JSX.Element {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])
  const [groupedDepartments, setGroupedDepartments] = useState<Record<string, Department[]>>({})
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [registerSuccess, setRegisterSuccess] = useState(false)
  const [staySignedIn, setStaySignedIn] = useState(false)

  // Only allow admin login 
  const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || ''
  const [isAdminLogin, setIsAdminLogin] = useState(searchParams.get('mode') === 'admin')

  // Fetch departments on mount
  useEffect(() => {
    fetchDepartments()
  }, [])

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments')
      const data = await response.json()
      if (data.departments) {
        setDepartments(data.departments)
        setGroupedDepartments(data.groupedByCollege || {})
      }
    } catch (error) {
      console.error('Error fetching departments:', error)
    }
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
    if (!isAdminLogin && password !== confirmPassword) {
      setError('Passwords do not match.')
      return false
    }
    if (!isAdminLogin && !fullName.trim()) {
      setError('Please enter your full name.')
      return false
    }
    if (!isAdminLogin && !selectedDepartment) {
      setError('Please select your department.')
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
      if (isAdminLogin) {
        // Only admin can login
        if (email !== ADMIN_EMAIL) {
          setError('Only admin can login here. Faculty should use the Faculty Login page.')
          setLoading(false)
          return
        }
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error

        // Handle stay signed in - store preference
        if (staySignedIn) {
          localStorage.setItem('adminStaySignedIn', 'true')
        }

        setMessage('Login successful. Redirecting...')
        setTimeout(() => {
          router.push('/LandingPages/Home')
        }, 1500)
      } else {
        // Faculty registration with metadata
        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: {
              full_name: fullName,
              department: selectedDepartment
            }
          }
        })
        if (error) throw error

        // Also save to users table immediately
        if (data.user) {
          await supabase.from('users').upsert({
            id: data.user.id,
            email: email,
            full_name: fullName,
            role: 'faculty',
            is_active: false,
            created_at: new Date().toISOString()
          } as any, { onConflict: 'id' })
        }

        setMessage('Registration successful! Please wait for admin approval. You will receive an email once approved.')
        setRegisterSuccess(true)
        setTimeout(() => {
          setEmail('')
          setPassword('')
          setConfirmPassword('')
          setFullName('')
          setSelectedDepartment('')
          setRegisterSuccess(false)
        }, 5000)
      }
    } catch (err: any) {
      setError((err?.message ?? String(err)))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* Animated Background */}
      <div className="background-container">
        {/* Multiple Quantum Rotating Cubes */}
        <div className="quantum-logo"></div>
        <div className="quantum-cube quantum-cube-1"></div>
        <div className="quantum-cube quantum-cube-2"></div>
        <div className="quantum-cube quantum-cube-3"></div>
        <div className="quantum-orb quantum-orb-1"></div>
        <div className="quantum-orb quantum-orb-2"></div>
        <div className="stars"></div>
        <div className="glow-effect"></div>
        {/* Floating particles */}
        <div className="floating-particles">
          {Array.from({ length: 20 }, (_, i) => (
            <span
              key={i}
              className="particle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${8 + Math.random() * 12}s`
              }}
            ></span>
          ))}
        </div>
      </div>

      {/* Sparkle Animation Overlay for Register Success */}
      {registerSuccess && (
        <div className="animation-overlay sparkle-overlay">
          <div className="starry-background"></div>
          {Array.from({ length: 30 }, (_, i) => (
            <span
              key={i}
              className="sparkle-particle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`
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
        <div className="card">
          <div className="card-header">
            <h1 className="title">
              {isAdminLogin ? 'Admin Login' : 'Faculty Registration'}
            </h1>
            <p className="subtitle">
              {isAdminLogin
                ? 'Admin access only'
                : 'Register as faculty. You will be approved by admin.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="form">
            {/* Full Name Field (Faculty Registration Only) */}
            {!isAdminLogin && (
              <div className="form-group">
                <label className="label">
                  <span className="label-text">
                    <span dangerouslySetInnerHTML={{ __html: userSVG }} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                    Full Name
                  </span>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="input"
                    placeholder="Juan Dela Cruz"
                    required
                  />
                </label>
              </div>
            )}

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

            {/* Department Selection (Faculty Registration Only) */}
            {!isAdminLogin && (
              <div className="form-group">
                <label className="label">
                  <span className="label-text">
                    <span dangerouslySetInnerHTML={{ __html: buildingSVG }} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                    College / Department
                  </span>
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="input select-input"
                    required
                  >
                    <option value="">Select your department...</option>
                    {Object.keys(groupedDepartments).length > 0 ? (
                      Object.entries(groupedDepartments).map(([college, depts]) => (
                        <optgroup key={college} label={college}>
                          {depts.map((dept) => (
                            <option key={dept.id} value={dept.department_name}>
                              {dept.department_name}
                            </option>
                          ))}
                        </optgroup>
                      ))
                    ) : (
                      departments.map((dept) => (
                        <option key={dept.id} value={dept.department_name}>
                          {dept.department_name}
                        </option>
                      ))
                    )}
                  </select>
                </label>
              </div>
            )}

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

            {/* Confirm Password Field (Faculty Registration Only) */}
            {!isAdminLogin && (
              <div className="form-group">
                <label className="label">
                  <span className="label-text">
                    <span dangerouslySetInnerHTML={{ __html: lockSVG }} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                    Confirm Password
                  </span>
                  <div className="password-input-wrapper">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="toggle-password"
                      title={showConfirmPassword ? 'Hide password' : 'Show password'}
                      dangerouslySetInnerHTML={{ __html: showConfirmPassword ? eyeHideSVG : eyeShowSVG }}
                    />
                  </div>
                </label>
              </div>
            )}

            {/* Stay Signed In (Admin Only) */}
            {isAdminLogin && (
              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={staySignedIn}
                    onChange={(e) => setStaySignedIn(e.target.checked)}
                    className="checkbox-input"
                  />
                  <span className="checkbox-text">
                    <span dangerouslySetInnerHTML={{ __html: lockClosedSVG }} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                    Keep me signed in
                  </span>
                </label>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`button ${loading ? 'loading' : ''}`}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  {isAdminLogin ? 'Logging in...' : 'Registering...'}
                </>
              ) : (
                isAdminLogin ? (
                  <>Login</>
                ) : (
                  <>Create Account</>
                )
              )}
            </button>

            {/* Mode Switch */}
            <div className="switch-row">
              <span className="switch-text">
                {isAdminLogin
                  ? 'Faculty? Register below.'
                  : 'Admin? Login here.'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsAdminLogin(!isAdminLogin)
                  setError(null)
                  setMessage(null)
                  setEmail('')
                  setPassword('')
                  setConfirmPassword('')
                  setFullName('')
                  setSelectedDepartment('')
                  setRegisterSuccess(false)
                }}
                className="link-button"
              >
                {isAdminLogin ? 'Faculty Registration' : 'Admin Login'}
              </button>
            </div>

            {/* Faculty Login Link */}
            {!isAdminLogin && (
              <div className="switch-row faculty-login-link">
                <span className="switch-text">Already approved?</span>
                <button
                  type="button"
                  onClick={() => router.push('/faculty/login')}
                  className="link-button"
                >
                  Faculty Login →
                </button>
              </div>
            )}

            {/* Messages */}
            {message && <div className="message success">{message}</div>}
            {error && <div className="message error">{error}</div>}
          </form>

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