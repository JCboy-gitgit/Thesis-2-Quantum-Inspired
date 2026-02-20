
"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import { MdCalendarToday as Calendar, MdAccessTime as Clock, MdPerson as User, MdLocationOn as MapPin, MdError as AlertCircle, MdCheckCircle as CheckCircle2, MdSearch as Search, MdFilterList as Filter, MdArrowBack as ArrowLeft } from 'react-icons/md'
import styles from './styles.module.css'

interface AbsenceRecord {
    id: string
    faculty_id: string
    allocation_id: number
    date: string
    reason: string
    created_at: string
    profiles: {
        full_name: string
        email: string
    }
    room_allocations: {
        course_code: string
        section: string
        room: string
        schedule_time: string
        schedule_day: string
    }
}

export default function FacultyAbsencesPage() {
    const router = useRouter()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [absences, setAbsences] = useState<AbsenceRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        fetchAbsences()
    }, [])

    const fetchAbsences = async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/faculty-absences')
            const data = await res.json()
            if (data.success) {
                setAbsences(data.data)
            }
        } catch (error) {
            console.error('Error fetching absences:', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredAbsences = absences.filter(record =>
        record.profiles.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.room_allocations.course_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.room_allocations.room.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen)

    return (
        <div className="flex h-screen bg-gray-50">
            <MenuBar
                onToggleSidebar={toggleSidebar}
                showSidebarToggle={true}
                setSidebarOpen={setSidebarOpen}
            />
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <main
                className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}
                style={{ marginTop: '64px', padding: '2rem' }}
            >
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <button
                            onClick={() => router.back()}
                            className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
                        >
                            <ArrowLeft size={20} className="mr-2" />
                            Back
                        </button>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                            <AlertCircle className="text-red-500" size={32} />
                            Faculty Absences & Room Availability
                        </h1>
                        <p className="text-gray-600 mt-2">
                            Monitor faculty absences and identify newly available room slots.
                        </p>
                    </div>

                    {/* Controls */}
                    <div className="bg-white p-4 rounded-lg shadow-sm mb-6 flex items-center justify-between">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="Search faculty, course, or room..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Absences List */}
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                    ) : filteredAbsences.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                            <CheckCircle2 className="mx-auto text-green-500 mb-4" size={48} />
                            <h3 className="text-xl font-medium text-gray-900">No Absences Reported</h3>
                            <p className="text-gray-500">All faculty members are present as scheduled.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {filteredAbsences.map((record) => (
                                <div key={record.id} className="bg-white p-6 rounded-lg shadow-sm border border-l-4 border-l-red-500 hover:shadow-md transition-shadow">
                                    <div className="flex flex-col md:flex-row justify-between gap-6">

                                        {/* Faculty & Time Info */}
                                        <div className="flex-1">
                                            <div className="flex items-start gap-4 mb-4">
                                                <div className="bg-blue-50 p-3 rounded-full">
                                                    <User className="text-blue-600" size={24} />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-gray-900">{record.profiles.full_name}</h3>
                                                    <div className="flex items-center gap-2 text-gray-600 mt-1">
                                                        <Clock size={16} />
                                                        <span>{record.date}  â€¢  {record.room_allocations.schedule_time}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-gray-50 p-4 rounded-md">
                                                <p className="text-sm font-medium text-gray-700 mb-1">Reason for Absence:</p>
                                                <p className="text-gray-600 italic">"{record.reason}"</p>
                                            </div>
                                        </div>

                                        {/* Room Availability Indicator */}
                                        <div className="flex-1 border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
                                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                                <div className="flex items-center gap-2 text-green-700 font-bold mb-2">
                                                    <CheckCircle2 size={20} />
                                                    Room Available
                                                </div>
                                                <p className="text-green-800 text-sm mb-3">
                                                    This room is now temporarily empty and available for use during this slot.
                                                </p>

                                                <div className="flex items-center gap-2 text-gray-700 font-medium bg-white p-2 rounded border border-green-100">
                                                    <MapPin size={18} className="text-green-600" />
                                                    {record.room_allocations.room}
                                                </div>
                                                <div className="mt-2 text-xs text-gray-500">
                                                    Course: {record.room_allocations.course_code} ({record.room_allocations.section})
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}

