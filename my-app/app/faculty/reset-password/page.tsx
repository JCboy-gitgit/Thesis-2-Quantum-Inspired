'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react'
import styles from './styles.module.css'

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(true)
  const [validToken, setValidToken] = useState(false)
  const [email, setEmail] = useState('')
  const [tokenError, setTokenError] = useState('')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [resetComplete, setResetComplete] = useState(false)

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setTokenError('No reset token provided. Please request a new password reset link.')
        setLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/password-reset?token=${token}`)
        const data = await response.json()

        if (data.valid) {
          setValidToken(true)
          setEmail(data.email)
        } else {
          setTokenError(data.error || 'Invalid or expired token.')
        }
      } catch (error) {
        console.error('Token verification error:', error)
        setTokenError('Failed to verify token. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    verifyToken()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    // Validation
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters long.' })
      return
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' })
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/password-reset', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      })

      const data = await response.json()

      if (data.success) {
        setResetComplete(true)
        setMessage({ type: 'success', text: data.message })
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to reset password.' })
      }
    } catch (error) {
      console.error('Password reset error:', error)
      setMessage({ type: 'error', text: 'An error occurred. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.loadingState}>
            <Loader2 className={styles.spinner} size={48} />
            <p>Verifying reset link...</p>
          </div>
        </div>
      </div>
    )
  }

  // Invalid token state
  if (!validToken) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.errorState}>
            <AlertCircle size={64} className={styles.errorIcon} />
            <h2>Invalid Reset Link</h2>
            <p>{tokenError}</p>
            <button 
              className={styles.primaryButton}
              onClick={() => router.push('/faculty/login')}
            >
              <ArrowLeft size={18} />
              Back to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Reset complete state
  if (resetComplete) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.successState}>
            <CheckCircle size={64} className={styles.successIcon} />
            <h2>Password Reset Successful!</h2>
            <p>Your password has been changed. You can now login with your new password.</p>
            <button 
              className={styles.primaryButton}
              onClick={() => router.push('/faculty/login')}
            >
              <ArrowLeft size={18} />
              Go to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Reset form
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.iconWrapper}>
            <Lock size={32} />
          </div>
          <h1>Reset Your Password</h1>
          <p className={styles.subtitle}>Enter a new password for <strong>{email}</strong></p>
        </div>

        {message && (
          <div className={`${styles.message} ${message.type === 'success' ? styles.success : styles.error}`}>
            {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="newPassword">New Password</label>
            <div className={styles.passwordInput}>
              <input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                required
                minLength={6}
                disabled={submitting}
              />
              <button
                type="button"
                className={styles.eyeButton}
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div className={styles.passwordInput}>
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                minLength={6}
                disabled={submitting}
              />
              <button
                type="button"
                className={styles.eyeButton}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className={styles.submitButton}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className={styles.buttonSpinner} size={18} />
                Resetting Password...
              </>
            ) : (
              <>
                <Lock size={18} />
                Reset Password
              </>
            )}
          </button>
        </form>

        <div className={styles.footer}>
          <button 
            className={styles.linkButton}
            onClick={() => router.push('/faculty/login')}
          >
            <ArrowLeft size={14} />
            Back to Login
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.loadingState}>
            <Loader2 className={styles.spinner} size={48} />
            <p>Loading...</p>
          </div>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}
