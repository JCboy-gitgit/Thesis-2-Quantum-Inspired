'use client'

import React from 'react'
import { useScheduling } from '@/app/context/SchedulingContext'
import { FaAtom, FaCheckCircle, FaExclamationTriangle, FaTimes } from 'react-icons/fa'
import Link from 'next/link'
import styles from './PersistentSchedulingStatus.module.css'

export default function PersistentSchedulingStatus() {
    const { isScheduling, timer, result, resetScheduling } = useScheduling()

    if (!isScheduling && !result) return null

    // Format time: MM:SS.S
    const formatTime = (ms: number) => {
        const seconds = (ms / 1000).toFixed(1)
        return `${seconds}s`
    }

    // Fix: Python backend uses snake_case, but our setScheduleResult maps them to camelCase
    // We should safely check both or use the camelCase ones we set
    const scheduled = result?.scheduledClasses ?? result?.scheduled_classes ?? 0
    const total = result?.totalClasses ?? result?.total_classes ?? 1 // Prevent div by zero
    const percentage = ((scheduled / total) * 100).toFixed(0)

    const handleDismiss = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        resetScheduling()
    }

    return (
        <div className={styles.container}>
            {isScheduling ? (
                <div className={styles.activeStatus}>
                    <div className={styles.spinnerWrapper}>
                        <FaAtom className={styles.spinningAtom} />
                    </div>
                    <div className={styles.content}>
                        <span className={styles.statusLabel}>Generating Schedule...</span>
                        <span className={styles.timer}>{formatTime(timer)}</span>
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
                        </div>
                    </Link>
                </div>
            ) : null}
        </div>
    )
}
