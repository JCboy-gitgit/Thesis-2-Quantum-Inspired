'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import styles from './styles.module.css'

export default function VerifyEmailPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Verifying your email...')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      setMessage('Missing verification token.')
      return
    }

    const verify = async () => {
      try {
        const response = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data?.error || 'Verification failed')
        }
        setStatus('success')
        setMessage('Email verified. Please wait for admin approval.')
      } catch (error: any) {
        setStatus('error')
        setMessage(error?.message || 'Verification failed')
      }
    }

    verify()
  }, [searchParams])

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.badge} data-status={status}></div>
        <h1>Verification</h1>
        <p>{message}</p>
        <button
          className={styles.button}
          onClick={() => router.push('/')}
        >
          Back to Login
        </button>
      </div>
    </div>
  )
}
