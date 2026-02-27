'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import LoadingFallback from '@/app/components/LoadingFallback'
import styles from './styles.module.css'
import { MdOutlineArrowBack, MdSave } from 'react-icons/md'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const generateTimeSlots = () => {
    const slots = []
    for (let h = 7; h <= 20; h++) {
        const timeStart = `${h.toString().padStart(2, '0')}:00`
        const timeEnd = `${(h + 1).toString().padStart(2, '0')}:00`
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

export default function AdminPreferredSchedules() {
    const router = useRouter()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [faculties, setFaculties] = useState<any[]>([])
    const [selectedFacultyId, setSelectedFacultyId] = useState<string>('')

    // preferences[day][timeslot] = 'preferred' | 'not_preferred' | ''
    const [preferences, setPreferences] = useState<Record<string, Record<string, string>>>({})
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(true)
    const [authorized, setAuthorized] = useState(false)

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                if (!session?.user) {
                    router.push('/')
                    return
                }
                if (session.user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
                    router.push('/faculty/home')
                    return
                }
                setAuthorized(true)
                fetchFaculties()
            } catch (error) {
                console.error('Auth check error:', error)
                router.push('/')
            }
        }
        checkAuth()
    }, [])

    useEffect(() => {
        if (selectedFacultyId) {
            fetchPreferences(selectedFacultyId)
        } else {
            setPreferences({})
        }
    }, [selectedFacultyId])

    const fetchFaculties = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('faculty_profiles')
                .select('id, full_name, department, faculty_id')
                .order('full_name', { ascending: true })

            if (error) throw error
            setFaculties(data || [])
            if (data && data.length > 0) {
                setSelectedFacultyId((data as any[])[0].id)
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const fetchPreferences = async (facultyId: string) => {
        try {
            const res = await fetch(`/api/faculty-preferences?faculty_id=${facultyId}`)
            const data = await res.json()
            if (data.preferences) {
                setPreferences(data.preferences)
            } else {
                setPreferences({})
            }
        } catch (err) {
            console.error(err)
        }
    }

    const handleCellClick = (day: string, slot: string) => {
        if (!selectedFacultyId) return

        setPreferences(prev => {
            const dayPrefs = prev[day] || {}
            const currentVal = dayPrefs[slot]

            let nextVal = ''
            if (!currentVal) nextVal = 'preferred'
            else if (currentVal === 'preferred') nextVal = 'not_preferred'
            else nextVal = '' // back to blank

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
        if (!selectedFacultyId) return
        setSaving(true)
        try {
            const res = await fetch('/api/faculty-preferences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    faculty_id: selectedFacultyId,
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
            alert('Error saving')
        } finally {
            setSaving(false)
        }
    }

    if (!authorized) {
        return <LoadingFallback message="Verifying admin access..." />
    }

    return (
        <div className={styles.layout}>
            <MenuBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} showSidebarToggle={true} setSidebarOpen={setSidebarOpen} />
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <main className={`${styles.main} ${!sidebarOpen ? styles.fullWidth : ''}`}>
                <div className={styles.container}>
                    <div className={styles.header}>
                        <div className={styles.headerInfo}>
                            <h1 className={styles.title} id="preferred-header">Faculty Preferred Schedules</h1>
                            <p className={styles.subtitle}>View and manage availability preferences for all faculties</p>
                        </div>
                    </div>

                    <div className={styles.infoBanner}>
                        <div className={styles.infoText}>
                            <strong>Instructions:</strong> Click on the time slots to toggle between preferences.
                        </div>
                        <div className={styles.legend}>
                            <div className={styles.legendItem}>
                                <div className={`${styles.legendBox} ${styles.preferred}`}></div>
                                <span>Preferred</span>
                            </div>
                            <div className={styles.legendItem}>
                                <div className={`${styles.legendBox} ${styles.notPreferred}`}></div>
                                <span>Not Preferred</span>
                            </div>
                            <div className={styles.legendItem}>
                                <div className={`${styles.legendBox} ${styles.neutral}`}></div>
                                <span>Neutral</span>
                            </div>
                        </div>
                    </div>

                    <div className={styles.content}>
                        <div className={styles.controlPanel}>
                            <div className={styles.formGroup}>
                                <label>Select Faculty:</label>
                                <select
                                    className={styles.select}
                                    value={selectedFacultyId}
                                    onChange={(e) => setSelectedFacultyId(e.target.value)}
                                >
                                    <option value="">-- Choose Faculty --</option>
                                    {faculties.map(f => (
                                        <option key={f.id} value={f.id}>{f.full_name} ({f.department || 'No Dept'})</option>
                                    ))}
                                </select>
                            </div>

                            <button className={styles.saveBtn} onClick={handleSave} disabled={saving || !selectedFacultyId}>
                                <MdSave size={20} />
                                {saving ? 'Saving...' : 'Save Preferences'}
                            </button>
                        </div>

                        <div className={styles.gridContainer}>
                            <table className={styles.grid}>
                                <thead>
                                    <tr>
                                        <th className={styles.timeHeader}>Time</th>
                                        {DAYS.map(d => <th key={d} className={styles.dayHeader}>{d}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {TIME_SLOTS.map((slot) => (
                                        <tr key={slot}>
                                            <td className={styles.timeCell}>
                                                {formatTimeLabel(slot)}
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
                </div>
            </main>
        </div>
    )
}
