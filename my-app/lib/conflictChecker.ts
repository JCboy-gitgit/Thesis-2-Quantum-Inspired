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
    capacity?: number
    student_count?: number
    college?: string
    room_college?: string
    is_online?: boolean // Online classes don't need physical rooms
}

export interface ConflictCheckResult {
    hasConflict: boolean
    roomConflicts: AllocationSlot[]
    teacherConflicts: AllocationSlot[]
    sectionConflicts: AllocationSlot[]
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
 * NOTE: Online classes (is_online=true) are skipped as they don't need physical rooms
 */
export function checkRoomConflict(
    allAllocations: AllocationSlot[],
    targetRoom: string,
    targetDay: string,
    targetTime: TimeRange,
    excludeAllocationId?: number
): AllocationSlot[] {
    return allAllocations.filter(alloc => {
        if (excludeAllocationId && alloc.id === excludeAllocationId) return false
        // Skip online classes - they don't need physical rooms
        if (alloc.is_online) return false
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
): AllocationSlot[] {
    if (!isMeaningfulTeacherName(teacherName)) return []
    const normalizedTeacher = normalizeTeacherName(teacherName)

    return allAllocations.filter(alloc => {
        if (excludeAllocationId && alloc.id === excludeAllocationId) return false
        if (!isMeaningfulTeacherName(alloc.teacher_name)) return false
        if (normalizeTeacherName(alloc.teacher_name) !== normalizedTeacher) return false
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
    college?: string,
    excludeAllocationId?: number
): AllocationSlot[] {
    if (!section) return []

    const normalizeCollege = (col?: string) => {
        const val = (col || '').trim().toUpperCase();
        if (!val || val === 'UNASSIGNED COLLEGE' || val === 'N/A' || val === 'NONE' || val === 'NULL') return null;
        return val;
    };
    
    const targetCollege = normalizeCollege(college);

    const targetBase = normalizeSectionBase(section)
    const targetGroup = extractSectionGroup(section)

    return allAllocations.filter(alloc => {
        if (excludeAllocationId && alloc.id === excludeAllocationId) return false

        const allocBase = normalizeSectionBase(alloc.section || '')
        if (allocBase !== targetBase) return false

        const allocGroup = extractSectionGroup(alloc.section || '')

        const allocCollege = normalizeCollege(alloc.college);
        if (targetCollege && allocCollege && targetCollege !== allocCollege) {
            return false;
        }

        // G1 and G2 can run simultaneously, but each split conflicts with the full/shared section.
        if (targetGroup && allocGroup && targetGroup !== allocGroup) {
                return false
        }

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
    college?: string,
    excludeAllocationId?: number
): ConflictCheckResult {
    const roomConflicts = checkRoomConflict(allAllocations, targetRoom, targetDay, targetTime, excludeAllocationId)
    const teacherConflicts = checkTeacherConflict(allAllocations, teacherName, targetDay, targetTime, excludeAllocationId)
    const sectionConflicts = checkSectionConflict(allAllocations, section, targetDay, targetTime, college, excludeAllocationId)

    return {
        hasConflict: roomConflicts.length > 0 || teacherConflicts.length > 0 || sectionConflicts.length > 0,
        roomConflicts,
        teacherConflicts,
        sectionConflicts
    }
}

/**
 * Build user-facing reason strings from conflict buckets.
 */
export function buildConflictReasonMessages(
    conflicts: ConflictCheckResult,
    target?: { section?: string }
): string[] {
    const reasons: string[] = []

    if (conflicts.roomConflicts.length > 0) {
        conflicts.roomConflicts.forEach(c => {
            reasons.push(`Room conflict: ${c.course_code} (${c.section}) at ${c.schedule_day} ${c.schedule_time}`)
        })
    }

    if (conflicts.teacherConflicts.length > 0) {
        conflicts.teacherConflicts.forEach(c => {
            reasons.push(`Prof conflict: ${c.teacher_name} is in Room ${c.room || 'another room'} at ${c.schedule_day} ${c.schedule_time}`)
        })
    }

    if (conflicts.sectionConflicts.length > 0) {
        conflicts.sectionConflicts.forEach(c => {
            const timeDesc = `${c.schedule_day} ${c.schedule_time}`
            const currentSection = target?.section || 'Section'
            if ((c.section || '') === currentSection) {
                reasons.push(`Section conflict: ${currentSection} is busy at ${timeDesc}`)
            } else {
                reasons.push(`Section conflict: ${currentSection} vs ${c.section} at ${timeDesc}`)
            }
        })
    }

    return Array.from(new Set(reasons))
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
    college?: string,
    excludeAllocationId?: number
): Map<number, { available: boolean; roomConflicts: AllocationSlot[]; teacherConflicts: AllocationSlot[]; sectionConflicts: AllocationSlot[] }> {
    const result = new Map<number, { available: boolean; roomConflicts: AllocationSlot[]; teacherConflicts: AllocationSlot[]; sectionConflicts: AllocationSlot[] }>()

    // Check every 30 minute slot from 7:00 to 20:00
    for (let minutes = 7 * 60; minutes <= 20 * 60; minutes += 30) {
        const targetTime: TimeRange = {
            startMinutes: minutes,
            endMinutes: minutes + targetDuration
        }
        const conflicts = checkAllConflicts(
            allAllocations, targetRoom, targetDay, targetTime,
            teacherName, section, college, excludeAllocationId
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

function normalizeSectionBase(section: string): string {
    if (!section) return ''
    return section
        .replace(/_LAB$/i, '')
        .replace(/_LEC$/i, '')
        .replace(/_LECTURE$/i, '')
        .replace(/_LABORATORY$/i, '')
        .replace(/_G[12](_LAB|_LEC|_LECTURE|_LABORATORY)?$/i, '')
        .replace(/\s+G[12](\s+)?(LAB|LEC|LECTURE|LABORATORY)?$/i, '')
        .replace(/-G[12](?:-(?:LAB|LEC|LECTURE|LABORATORY))?$/i, '')
        .replace(/,\s*LAB$/i, '')
        .replace(/,\s*LEC$/i, '')
        .replace(/\s+LAB$/i, '')
        .replace(/\s+LEC$/i, '')
        .trim()
}

function extractSectionGroup(section: string): 'G1' | 'G2' | null {
    if (!section) return null
    const normalized = section.replace(/[-_]/g, ' ')
    const match = normalized.match(/\b(G1|G2)\b/i)
    if (!match) return null
    const group = match[1].toUpperCase()
    return group === 'G1' || group === 'G2' ? group : null
}

function normalizeTeacherName(name: string): string {
    return (name || '').trim().replace(/\s+/g, ' ').toUpperCase()
}

function isMeaningfulTeacherName(name: string): boolean {
    const normalized = normalizeTeacherName(name)
    if (!normalized) return false

    const placeholders = new Set([
        'TBD',
        'TBA',
        'N/A',
        'NA',
        'NONE',
        'UNASSIGNED',
        'TO BE ASSIGNED',
        'NOT ASSIGNED',
        'NO FACULTY',
        'NO TEACHER',
    ])

    return !placeholders.has(normalized)
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
