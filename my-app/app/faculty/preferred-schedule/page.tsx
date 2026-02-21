'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import FacultySidebar from '@/app/components/FacultySidebar'
import styles from './styles.module.css'
import { MdSave } from 'react-icons/md'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const generateTimeSlots = () => {
    const slots = []
    for (let i = 7 * 2; i <= 20 * 2; i++) {
        const h = Math.floor(i / 2)
        const m = (i % 2) * 30
        const nextH = Math.floor((i + 1) / 2)
        const nextM = ((i + 1) % 2) * 30

        const timeStart = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
        const timeEnd = `${nextH.toString().padStart(2, '0')}:${nextM.toString().padStart(2, '0')}`
        slots.push(`${timeStart}-${timeEnd}`)
    }
    return slots
}
const TIME_SLOTS = generateTimeSlots()

function formatTimeLabel(slot: string) {
    const [start] = slot.split('-')
    let [h, m] = start.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    h = h % 12 || 12
    return `${h}:${m.toString().padStart(2, '0')} ${ampm}`
}

export default function FacultyPreferredSchedule() {
    const router = useRouter()
    const [facultyId, setFacultyId] = useState<string | null>(null)
    const [preferences, setPreferences] = useState<Record<string, Record<string, string>>>({})
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchMyProfile()
    }, [])

    const fetchMyProfile = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user) {
                router.push('/')
                return
            }

            // Check if user is linked to a faculty_profile
            const { data: profile } = await supabase
                .from('faculty_profiles')
                .select('id')
                .eq('email', session.user.email)
                .single()

            if (profile) {
                setFacultyId(profile.id)
                fetchPreferences(profile.id)
            } else {
                setLoading(false)
                console.warn('No mapped faculty profile found.')
            }
        } catch (err) {
            console.error(err)
            setLoading(false)
        }
    }

    const fetchPreferences = async (fId: string) => {
        try {
            const res = await fetch(`/api/faculty-preferences?faculty_id=${fId}`)
            const data = await res.json()
            if (data.preferences) {
                setPreferences(data.preferences)
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const handleCellClick = (day: string, slot: string) => {
        setPreferences(prev => {
            const dayPrefs = prev[day] || {}
            const currentVal = dayPrefs[slot]

            let nextVal = ''
            if (!currentVal) nextVal = 'preferred'
            else if (currentVal === 'preferred') nextVal = 'not_preferred'
            else nextVal = ''

            return {
                ...prev,
                [day]: {
                    ...dayPrefs,
                    [slot]: nextVal
                }
            }
        })
    }

    const handleSave = async () => {
        if (!facultyId) return
        setSaving(true)
        try {
            const res = await fetch('/api/faculty-preferences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    faculty_id: facultyId,
                    preferences: preferences
                })
            })
            const data = await res.json()
            if (data.success) {
                alert('Preferences saved successfully!')
            } else {
                alert('Failed to save preferences: ' + data.error)
            }
        } catch (err) {
            console.error(err)
            alert('Error saving preferences')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className={styles.layout}>
                <FacultySidebar isOpen={true} />
                <main className={styles.main}>
                    <div className="flex items-center justify-center h-full text-slate-500">
                        Loading...
                    </div>
                </main>
            </div>
        )
    }

    return (
        <div className={styles.layout}>
            <FacultySidebar isOpen={true} />
            <main className={styles.main}>
                <div className={styles.header}>
                    <div>
                        <h1 className={styles.title}>My Preferred Schedule</h1>
                        <p className={styles.subtitle}>Click cells to toggle: Green = Preferred, Red = Not Preferred, Blank = Neutral</p>
                    </div>
                    <button className={styles.saveBtn} onClick={handleSave} disabled={saving || !facultyId}>
                        <MdSave size={20} />
                        {saving ? 'Saving...' : 'Save Preferences'}
                    </button>
                </div>

                <div className={styles.content}>
                    <div className={styles.gridContainer}>
                        <table className={styles.grid}>
                            <thead>
                                <tr>
                                    <th className={styles.timeHeader}>Time</th>
                                    {DAYS.map(d => <th key={d} className={styles.dayHeader}>{d}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {TIME_SLOTS.map((slot, idx) => (
                                    <tr key={slot}>
                                        <td className={styles.timeCell}>
                                            {idx % 2 === 0 ? formatTimeLabel(slot) : ''}
                                        </td>
                                        {DAYS.map(day => {
                                            const state = (preferences[day] || {})[slot] || ''
                                            let cellClass = styles.cellBase
                                            if (state === 'preferred') cellClass += ` ${styles.cellPreferred}`
                                            if (state === 'not_preferred') cellClass += ` ${styles.cellNotPreferred}`

                                            return (
                                                <td
                                                    key={`${day}-${slot}`}
                                                    className={cellClass}
                                                    onClick={() => handleCellClick(day, slot)}
                                                    title={`${day} @ ${formatTimeLabel(slot)} - Click to toggle preference`}
                                                >
                                                </td>
                                            )
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    )
}
