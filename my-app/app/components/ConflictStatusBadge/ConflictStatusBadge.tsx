'use client'

import React from 'react'
import { MdCheckCircle, MdWarning } from 'react-icons/md'
import styles from './ConflictStatusBadge.module.css'

interface ConflictStatusBadgeProps {
    status: 'available' | 'conflict'
    reasons?: string[]
    compact?: boolean
    className?: string
    onClick?: (event: React.MouseEvent<HTMLDivElement>) => void
}

export default function ConflictStatusBadge({
    status,
    reasons = [],
    compact = false,
    className,
    onClick,
}: ConflictStatusBadgeProps) {
    const isConflict = status === 'conflict'
    const firstReason = reasons[0]

    return (
        <div
            className={[
                styles.badge,
                isConflict ? styles.conflict : styles.available,
                compact ? styles.compact : '',
                onClick ? styles.clickable : '',
                className || '',
            ].filter(Boolean).join(' ')}
            title={isConflict && reasons.length > 0 ? reasons.join('\n') : undefined}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onClick(e as unknown as React.MouseEvent<HTMLDivElement>)
                }
            } : undefined}
        >
            {isConflict ? <MdWarning size={compact ? 14 : 16} /> : <MdCheckCircle size={compact ? 14 : 16} />}
            <span className={styles.label}>{isConflict ? 'Conflict' : 'Available'}</span>
            {isConflict && !compact && firstReason && (
                <span className={styles.reason}>{firstReason}</span>
            )}
        </div>
    )
}
