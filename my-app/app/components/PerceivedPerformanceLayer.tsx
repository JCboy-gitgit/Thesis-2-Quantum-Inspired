'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  patchWindowFetchForProgress,
  subscribeNetworkActivity,
} from '@/lib/networkActivity'
import styles from './PerceivedPerformanceLayer.module.css'

export default function PerceivedPerformanceLayer() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [activeRequests, setActiveRequests] = useState(0)
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(0)

  const routeKey = useMemo(() => `${pathname}?${searchParams?.toString() || ''}`, [pathname, searchParams])

  const routeBusyRef = useRef(false)
  const routeCompleteTimerRef = useRef<number | null>(null)
  const hideTimerRef = useRef<number | null>(null)
  const trickleTimerRef = useRef<number | null>(null)
  const mountedRef = useRef(false)

  useEffect(() => {
    patchWindowFetchForProgress()
    return subscribeNetworkActivity(setActiveRequests)
  }, [])

  const startProgress = (base: number) => {
    setVisible(true)
    setProgress((current) => Math.max(current, base))

    if (trickleTimerRef.current) window.clearInterval(trickleTimerRef.current)

    trickleTimerRef.current = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 92) return current
        const step = current < 40 ? 8 : current < 70 ? 4 : 1.2
        return Math.min(92, current + step)
      })
    }, 180)
  }

  const completeProgress = () => {
    if (trickleTimerRef.current) {
      window.clearInterval(trickleTimerRef.current)
      trickleTimerRef.current = null
    }

    setProgress(100)

    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
    hideTimerRef.current = window.setTimeout(() => {
      setVisible(false)
      setProgress(0)
    }, 220)
  }

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }

    routeBusyRef.current = true
    startProgress(16)

    if (routeCompleteTimerRef.current) window.clearTimeout(routeCompleteTimerRef.current)
    routeCompleteTimerRef.current = window.setTimeout(() => {
      routeBusyRef.current = false
      if (activeRequests === 0) {
        completeProgress()
      }
    }, 380)
  }, [routeKey])

  useEffect(() => {
    if (activeRequests > 0) {
      startProgress(22)
      return
    }

    if (!routeBusyRef.current && visible) {
      completeProgress()
    }
  }, [activeRequests, visible])

  useEffect(() => {
    return () => {
      if (routeCompleteTimerRef.current) window.clearTimeout(routeCompleteTimerRef.current)
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
      if (trickleTimerRef.current) window.clearInterval(trickleTimerRef.current)
    }
  }, [])

  return (
    <div className={`${styles.progressWrap} ${visible ? styles.active : ''}`} aria-hidden="true">
      <div className={styles.progressTrack} />
      <div className={styles.progressBar} style={{ width: `${progress}%`, opacity: visible ? 1 : 0 }} />
    </div>
  )
}
