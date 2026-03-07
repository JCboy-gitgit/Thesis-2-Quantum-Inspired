'use client'

import React, { useEffect, useMemo } from 'react'
import { useScheduling } from '@/app/context/SchedulingContext'
import { FaAtom, FaCheckCircle, FaExclamationTriangle, FaTimes } from 'react-icons/fa'
import Link from 'next/link'
import styles from './PersistentSchedulingStatus.module.css'

const ESTIMATION_STORAGE_KEY = 'schedule_duration_estimation_v1'

interface EstimationModel {
    baseMs: number
    msPerClass: number
    msPerIteration: number
}

interface BackendHeartbeat {
    checking: boolean
    reachable: boolean | null
    latencyMs?: number
    checkedAtMs?: number
    message: string
}

const DEFAULT_MODEL: EstimationModel = {
    baseMs: 10000,
    msPerClass: 350,
    msPerIteration: 3,
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const formatTime = (ms: number) => {
    if (ms <= 0) return '0.0s'
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.round((ms % 60000) / 1000)
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
}

const readModel = (): EstimationModel => {
    if (typeof window === 'undefined') return DEFAULT_MODEL
    try {
        const raw = localStorage.getItem(ESTIMATION_STORAGE_KEY)
        if (!raw) return DEFAULT_MODEL
        const parsed = JSON.parse(raw)
        if (
            typeof parsed?.baseMs === 'number' &&
            typeof parsed?.msPerClass === 'number' &&
            typeof parsed?.msPerIteration === 'number'
        ) {
            return {
                baseMs: clamp(parsed.baseMs, 1000, 120000),
                msPerClass: clamp(parsed.msPerClass, 50, 5000),
                msPerIteration: clamp(parsed.msPerIteration, 0.2, 30),
            }
        }
        return DEFAULT_MODEL
    } catch {
        return DEFAULT_MODEL
    }
}

const saveModel = (model: EstimationModel) => {
    if (typeof window === 'undefined') return
    localStorage.setItem(ESTIMATION_STORAGE_KEY, JSON.stringify(model))
}

export default function PersistentSchedulingStatus() {
    const { isScheduling, timer, result, config, resetScheduling } = useScheduling()
    const hasActiveOrResult = isScheduling || !!result
    const [heartbeat, setHeartbeat] = React.useState<BackendHeartbeat>({
        checking: false,
        reachable: null,
        message: 'Backend heartbeat not started.',
    })

    // Fix: Python backend uses snake_case, but our setScheduleResult maps them to camelCase
    // We should safely check both or use the camelCase ones we set
    const scheduled = result?.scheduledClasses ?? result?.scheduled_classes ?? 0
    const total = result?.totalClasses ?? result?.total_classes ?? 1 // Prevent div by zero
    const percentage = ((scheduled / total) * 100).toFixed(0)

    const classCount = useMemo(() => {
        const fromConfig = Number(config?.classes?.length || 0)
        if (fromConfig > 0) return fromConfig
        const fromResult = Number(result?.totalClasses ?? result?.total_classes ?? 0)
        return fromResult > 0 ? fromResult : 0
    }, [config, result])

    const maxIterations = Number(config?.config?.max_iterations || 0)

    const estimationModel = useMemo(() => readModel(), [])

    const estimatedTotalMs = useMemo(() => {
        const raw =
            estimationModel.baseMs +
            classCount * estimationModel.msPerClass +
            maxIterations * estimationModel.msPerIteration

        return clamp(raw, 10000, 8 * 60 * 1000)
    }, [estimationModel, classCount, maxIterations])

    // If elapsed runtime exceeds the initial estimate, expand ETA dynamically.
    // This avoids showing ETA=0 while the backend is still actively running.
    const adaptiveEstimatedTotalMs = useMemo(() => {
        if (timer <= estimatedTotalMs) return estimatedTotalMs

        const overrunMs = timer - estimatedTotalMs
        const expansionTail = Math.max(20000, overrunMs * 1.35)
        return clamp(timer + expansionTail, 15000, 60 * 60 * 1000)
    }, [timer, estimatedTotalMs])

    const etaMs = Math.max(0, adaptiveEstimatedTotalMs - timer)
    const activeProgress = clamp((timer / adaptiveEstimatedTotalMs) * 100, 6, 96)

    useEffect(() => {
        if (!result) return

        const elapsed = Number(result?.optimizationStats?.timeElapsedMs || 0)
        const learnedClasses = Number(result?.totalClasses ?? result?.total_classes ?? classCount)
        const learnedIterations = Number(result?.optimizationStats?.iterations || maxIterations)

        if (!elapsed || learnedClasses <= 0) return

        const perClassObserved = elapsed / learnedClasses
        const perIterObserved = learnedIterations > 0 ? elapsed / learnedIterations : DEFAULT_MODEL.msPerIteration

        const current = readModel()
        const nextModel: EstimationModel = {
            baseMs: clamp(current.baseMs * 0.8 + DEFAULT_MODEL.baseMs * 0.2, 1000, 120000),
            msPerClass: clamp(current.msPerClass * 0.7 + perClassObserved * 0.3, 50, 5000),
            msPerIteration: clamp(current.msPerIteration * 0.75 + perIterObserved * 0.25, 0.2, 30),
        }

        saveModel(nextModel)
    }, [result, classCount, maxIterations])

    useEffect(() => {
        if (!isScheduling) {
            setHeartbeat({
                checking: false,
                reachable: null,
                message: 'Backend heartbeat not started.',
            })
            return
        }

        let cancelled = false
        const backendPreference = String(config?.backend_preference || 'auto')

        const probe = async () => {
            try {
                if (!cancelled) {
                    setHeartbeat(prev => ({ ...prev, checking: true }))
                }

                const startedAt = Date.now()
                const response = await fetch(`/api/schedule/qia-backend?backendPreference=${encodeURIComponent(backendPreference)}`, {
                    method: 'GET',
                    cache: 'no-store',
                })
                const data = await response.json().catch(() => null)
                const elapsedMs = Date.now() - startedAt

                if (cancelled) return

                if (response.ok && data?.backend_reachable) {
                    setHeartbeat({
                        checking: false,
                        reachable: true,
                        latencyMs: Number(data?.probe_latency_ms || elapsedMs),
                        checkedAtMs: Date.now(),
                        message: 'Backend responding.',
                    })
                    return
                }

                setHeartbeat({
                    checking: false,
                    reachable: false,
                    latencyMs: Number(data?.probe_latency_ms || elapsedMs),
                    checkedAtMs: Date.now(),
                    message: data?.error || 'Backend heartbeat failed.',
                })
            } catch (error: any) {
                if (cancelled) return
                setHeartbeat({
                    checking: false,
                    reachable: false,
                    checkedAtMs: Date.now(),
                    message: error?.message || 'Backend heartbeat failed.',
                })
            }
        }

        void probe()
        const intervalId = setInterval(() => {
            void probe()
        }, 8000)

        return () => {
            cancelled = true
            clearInterval(intervalId)
        }
    }, [isScheduling, config?.backend_preference])

    const heartbeatText = useMemo(() => {
        if (!isScheduling) return ''
        if (heartbeat.reachable === null) return 'Backend heartbeat: checking...'

        const ageMs = heartbeat.checkedAtMs ? Math.max(0, Date.now() - heartbeat.checkedAtMs) : 0
        const ageSec = Math.round(ageMs / 1000)

        if (heartbeat.reachable) {
            const latency = Number(heartbeat.latencyMs || 0)
            return `Backend heartbeat: online${latency > 0 ? ` (${latency} ms)` : ''}${ageSec >= 0 ? `, ${ageSec}s ago` : ''}`
        }

        return `Backend heartbeat: unavailable${ageSec >= 0 ? `, ${ageSec}s ago` : ''}`
    }, [isScheduling, heartbeat])

    const handleDismiss = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        resetScheduling()
    }

    if (!hasActiveOrResult) return null

    return (
        <div className={styles.container}>
            {isScheduling ? (
                <div className={styles.activeStatus}>
                    <div className={styles.spinnerWrapper}>
                        <FaAtom className={styles.spinningAtom} />
                    </div>
                    <div className={styles.content}>
                        <span className={styles.statusLabel}>Generating Schedule...</span>
                        <span className={styles.timer}>Elapsed: {formatTime(timer)}</span>
                        <span className={styles.etaText}>ETA: {formatTime(etaMs)}</span>
                        <span className={styles.heartbeatText}>{heartbeatText}</span>
                        <div className={styles.progressWrap}>
                            <div className={styles.progressBar} style={{ width: `${activeProgress}%` }} />
                        </div>
                    </div>
                </div>
            ) : result ? (
                <div style={{ position: 'relative' }}>
                    <button
                        className={styles.dismissStatus}
                        onClick={handleDismiss}
                        title="Dismiss Status"
                    >
                        <FaTimes size={12} />
                    </button>
                    <Link href="/LandingPages/RoomSchedule/GenerateSchedule" className={styles.resultStatus}>
                        <div className={styles.iconWrapper}>
                            {result.success ? (
                                <FaCheckCircle className={styles.successIcon} />
                            ) : (
                                <FaExclamationTriangle className={styles.warningIcon} />
                            )}
                        </div>
                        <div className={styles.content}>
                            <span className={styles.statusLabel}>
                                {result.success ? 'Generation Complete' : 'Generation Finished with Issues'}
                            </span>
                            <span className={styles.details}>
                                {scheduled} scheduled ({percentage}%)
                            </span>
                            <div className={styles.progressWrap}>
                                <div className={styles.progressBarDone} style={{ width: `${Number(percentage)}%` }} />
                            </div>
                        </div>
                    </Link>
                </div>
            ) : null}
        </div>
    )
}
