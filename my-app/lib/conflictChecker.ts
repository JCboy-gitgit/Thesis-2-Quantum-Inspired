/**
 * Conflict Checker Utility
 * Checks for schedule conflicts when moving/adding allocations
 */

export interface TimeRange {
    startMinutes: number
    endMinutes: number
}

export interface AllocationSlot {
    id: number
    schedule_id: number
    room: string
    building: string
    section: string
    teacher_name: string
    schedule_day: string
    schedule_time: string // "HH:MM-HH:MM" or "H:MM AM - H:MM PM"
    course_code: string
}

/**
 * Parse time string to minutes from midnight.
 * Handles formats: "7:00-8:30", "07:00", "7:00 AM", "7:00 AM - 8:30 AM"
 */
export function parseTimeToMinutes(timeStr: string): number {
    if (!timeStr) return 0
    const cleanTime = timeStr.trim()

    // Try AM/PM format first: "7:00 AM" or "7:00 PM"
    const ampmMatch = cleanTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i)
    if (ampmMatch) {
        let hour = parseInt(ampmMatch[1])
        const minute = parseInt(ampmMatch[2])
        const period = ampmMatch[3].toUpperCase()
        if (period === 'PM' && hour !== 12) hour += 12
        if (period === 'AM' && hour === 12) hour = 0
        return hour * 60 + minute
    }

    // 24-hour or simple format: "07:00" or "7:00"
    const match = cleanTime.match(/^(\d{1,2}):(\d{2})/)
    if (!match) return 0
    return parseInt(match[1]) * 60 + parseInt(match[2])
}

/**
 * Parse schedule_time "HH:MM-HH:MM" or "H:MM AM - H:MM PM" into TimeRange
 */
export function parseScheduleTime(scheduleTime: string): TimeRange | null {
    if (!scheduleTime) return null
    const parts = scheduleTime.split(/\s*-\s*/)
    if (parts.length !== 2) return null

    const startMinutes = parseTimeToMinutes(parts[0])
    const endMinutes = parseTimeToMinutes(parts[1])

    if (startMinutes === 0 && endMinutes === 0) return null
    return { startMinutes, endMinutes }
}

/**
 * Format minutes from midnight to "H:MM AM/PM"
 */
export function minutesToTimeString(minutes: number): string {
    const hour = Math.floor(minutes / 60)
    const min = minutes % 60
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${min.toString().padStart(2, '0')} ${period}`
}

/**
 * Build a time string from start/end minutes: "7:00-8:30"
 */
export function buildTimeRange(startMinutes: number, endMinutes: number): string {
    const startH = Math.floor(startMinutes / 60)
    const startM = startMinutes % 60
    const endH = Math.floor(endMinutes / 60)
    const endM = endMinutes % 60
    return `${startH}:${startM.toString().padStart(2, '0')}-${endH}:${endM.toString().padStart(2, '0')}`
}

/**
 * Check if two time ranges overlap
 */
export function timeRangesOverlap(a: TimeRange, b: TimeRange): boolean {
    return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes
}

/**
 * Check for room conflict: another allocation occupies the same room at the same day/time
 */
export function checkRoomConflict(
    allAllocations: AllocationSlot[],
    targetRoom: string,
    targetDay: string,
    targetTime: TimeRange,
    excludeAllocationId?: number
): boolean {
    return allAllocations.some(alloc => {
        if (excludeAllocationId && alloc.id === excludeAllocationId) return false
        if (alloc.room !== targetRoom) return false
        if (!isDayMatch(alloc.schedule_day, targetDay)) return false

        const allocTime = parseScheduleTime(alloc.schedule_time)
        if (!allocTime) return false

        return timeRangesOverlap(allocTime, targetTime)
    })
}

/**
 * Check for teacher conflict: the same teacher has another class at the same day/time
 */
export function checkTeacherConflict(
    allAllocations: AllocationSlot[],
    teacherName: string,
    targetDay: string,
    targetTime: TimeRange,
    excludeAllocationId?: number
): boolean {
    if (!teacherName) return false
    return allAllocations.some(alloc => {
        if (excludeAllocationId && alloc.id === excludeAllocationId) return false
        if (alloc.teacher_name !== teacherName) return false
        if (!isDayMatch(alloc.schedule_day, targetDay)) return false

        const allocTime = parseScheduleTime(alloc.schedule_time)
        if (!allocTime) return false

        return timeRangesOverlap(allocTime, targetTime)
    })
}

/**
 * Check for section conflict: the same section has another class at the same day/time
 */
export function checkSectionConflict(
    allAllocations: AllocationSlot[],
    section: string,
    targetDay: string,
    targetTime: TimeRange,
    excludeAllocationId?: number
): boolean {
    if (!section) return false
    // Strip LAB/LEC suffixes for matching
    const baseSection = stripSectionSuffix(section)
    return allAllocations.some(alloc => {
        if (excludeAllocationId && alloc.id === excludeAllocationId) return false
        const allocBase = stripSectionSuffix(alloc.section)
        if (allocBase !== baseSection) return false
        if (!isDayMatch(alloc.schedule_day, targetDay)) return false

        const allocTime = parseScheduleTime(alloc.schedule_time)
        if (!allocTime) return false

        return timeRangesOverlap(allocTime, targetTime)
    })
}

/**
 * Check all conflicts at once
 */
export function checkAllConflicts(
    allAllocations: AllocationSlot[],
    targetRoom: string,
    targetDay: string,
    targetTime: TimeRange,
    teacherName: string,
    section: string,
    excludeAllocationId?: number
): { hasConflict: boolean; roomConflict: boolean; teacherConflict: boolean; sectionConflict: boolean } {
    const roomConflict = checkRoomConflict(allAllocations, targetRoom, targetDay, targetTime, excludeAllocationId)
    const teacherConflict = checkTeacherConflict(allAllocations, teacherName, targetDay, targetTime, excludeAllocationId)
    const sectionConflict = checkSectionConflict(allAllocations, section, targetDay, targetTime, excludeAllocationId)
    return {
        hasConflict: roomConflict || teacherConflict || sectionConflict,
        roomConflict,
        teacherConflict,
        sectionConflict
    }
}

/**
 * Get slot availability map for a specific day
 * Returns map of slotTime -> { available, conflicts }
 */
export function getSlotAvailability(
    allAllocations: AllocationSlot[],
    targetDay: string,
    targetRoom: string,
    targetDuration: number, // in minutes
    teacherName: string,
    section: string,
    excludeAllocationId?: number
): Map<number, { available: boolean; roomConflict: boolean; teacherConflict: boolean; sectionConflict: boolean }> {
    const result = new Map<number, { available: boolean; roomConflict: boolean; teacherConflict: boolean; sectionConflict: boolean }>()

    // Check every 30 minute slot from 7:00 to 20:00
    for (let minutes = 7 * 60; minutes <= 20 * 60; minutes += 30) {
        const targetTime: TimeRange = {
            startMinutes: minutes,
            endMinutes: minutes + targetDuration
        }
        const conflicts = checkAllConflicts(
            allAllocations, targetRoom, targetDay, targetTime,
            teacherName, section, excludeAllocationId
        )
        result.set(minutes, {
            available: !conflicts.hasConflict,
            ...conflicts
        })
    }

    return result
}

// Helper: Check if a schedule_day matches a target day
function isDayMatch(scheduleDay: string, targetDay: string): boolean {
    if (!scheduleDay || !targetDay) return false
    const normalizedTarget = targetDay.toLowerCase()
    const normalizedSchedule = scheduleDay.toLowerCase()

    // Direct match
    if (normalizedSchedule === normalizedTarget) return true

    // Expand composite days (e.g., "TTH", "MWF")
    const expandedDays = expandDays(normalizedSchedule)
    return expandedDays.some(d => d.toLowerCase() === normalizedTarget)
}

// Helper: Expand day abbreviations
function expandDays(dayStr: string): string[] {
    const day = dayStr.trim().toUpperCase()

    if (day.includes('/')) {
        return day.split('/').map(d => normalizeDay(d.trim()))
    }
    if (day === 'TTH' || day === 'TH') return ['Tuesday', 'Thursday']
    if (day === 'MWF') return ['Monday', 'Wednesday', 'Friday']
    if (day === 'MW') return ['Monday', 'Wednesday']

    return [normalizeDay(day)]
}

// Helper: Normalize day abbreviation to full name
function normalizeDay(day: string): string {
    const dayMap: { [key: string]: string } = {
        'M': 'Monday', 'MON': 'Monday', 'MONDAY': 'Monday',
        'T': 'Tuesday', 'TUE': 'Tuesday', 'TUESDAY': 'Tuesday',
        'W': 'Wednesday', 'WED': 'Wednesday', 'WEDNESDAY': 'Wednesday',
        'TH': 'Thursday', 'THU': 'Thursday', 'THURSDAY': 'Thursday',
        'F': 'Friday', 'FRI': 'Friday', 'FRIDAY': 'Friday',
        'S': 'Saturday', 'SAT': 'Saturday', 'SATURDAY': 'Saturday',
        'SU': 'Sunday', 'SUN': 'Sunday', 'SUNDAY': 'Sunday'
    }
    return dayMap[day.toUpperCase()] || day
}

// Helper: Strip LAB/LEC suffix from section
function stripSectionSuffix(section: string): string {
    if (!section) return ''
    return section
        .replace(/_LAB$/i, '')
        .replace(/_LEC$/i, '')
        .replace(/_LECTURE$/i, '')
        .replace(/_LABORATORY$/i, '')
        .replace(/ LAB$/i, '')
        .replace(/ LEC$/i, '')
}
