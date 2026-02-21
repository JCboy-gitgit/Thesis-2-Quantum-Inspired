import { supabase } from './supabaseClient'

export interface SystemAlertInput {
    title: string
    message: string
    audience: 'admin' | 'faculty' | 'all'
    severity?: 'info' | 'success' | 'warning' | 'error'
    category?: string
    scheduleId?: number
    metadata?: any
}

/**
 * Creates a persistent system alert in the database.
 * This will be visible to the specified audience in their notification bell.
 */
export async function createSystemAlert(input: SystemAlertInput) {
    try {
        const { data: { session } } = await supabase.auth.getSession()
        const response = await fetch('/api/alerts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...input,
                createdBy: session?.user?.id,
            }),
        })

        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Failed to create alert')
        }

        return await response.json()
    } catch (error) {
        console.error('Error creating system alert:', error)
        return { error }
    }
}

/**
 * Convenience function to notify admins about schedule-related events
 */
export async function notifyAdminScheduleEvent(title: string, message: string, severity: 'info' | 'success' | 'warning' | 'error' = 'info', scheduleId?: number) {
    return createSystemAlert({
        title,
        message,
        audience: 'admin',
        severity,
        category: 'schedule',
        scheduleId,
    })
}

/**
 * Convenience function to notify faculty about a newly published schedule
 */
export async function notifyFacultySchedulePublished(scheduleName: string, scheduleId: number) {
    return createSystemAlert({
        title: 'New Schedule Published',
        message: `A new room allocation schedule "${scheduleName}" has been published and is now active.`,
        audience: 'faculty',
        severity: 'success',
        category: 'schedule_published',
        scheduleId,
    })
}
