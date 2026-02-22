'use client'

import React, { useEffect, useState } from 'react'
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride'
import { usePathname } from 'next/navigation'

interface AdminTutorialProps {
    run: boolean
    setRun: (val: boolean) => void
    onStepChange?: (step: Step, index: number) => void
}

export default function AdminTutorial({ run, setRun, onStepChange }: AdminTutorialProps) {
    const pathname = usePathname()
    const [steps, setSteps] = useState<Step[]>([])
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        setIsMounted(true)
    }, [])

    useEffect(() => {
        if (!run && steps.length > 0) return // Don't wipe steps while closing

        const updateSteps = () => {
            let pageSteps: Step[] = []

            if (!pathname) return

            if (pathname.includes('/Home')) {
                pageSteps = [
                    {
                        target: '.admin-dashboard',
                        placement: 'center',
                        content: 'Welcome to QTime Scheduler! Let\'s tour your powerful new admin dashboard. Fast, fluid, and intuitive!',
                        disableBeacon: true,
                    }
                ];

                if (typeof window !== 'undefined') {
                    // Wait for the actual header to be present
                    const header = document.querySelector('#dash-header');

                    if (header) {
                        pageSteps.push({
                            target: '#dash-header',
                            content: 'The Dashboard Header: Your command center for university scheduling. Notice the "Welcome" message that updates based on the time of day.',
                            placement: 'bottom',
                        });
                    }

                    const stats = document.querySelector('#dash-stats-grid');
                    if (stats) {
                        pageSteps.push({
                            target: '#dash-stats-grid',
                            content: 'Live Totals: Track your Rooms, Faculty, and Courses in real-time. These numbers pulse as your database grows.',
                            placement: 'bottom',
                        });
                    }

                    const online = document.querySelector('#dash-online-faculty');
                    if (online) {
                        pageSteps.push({
                            target: '#dash-online-faculty',
                            content: 'Faculty Presence: This live feed shows exactly which educators are currently using the platform.',
                            placement: 'right',
                        });
                    }

                    const sched = document.querySelector('#dash-current-schedule');
                    if (sched) {
                        pageSteps.push({
                            target: '#dash-current-schedule',
                            content: 'Active Schedule: A snapshot of the current academic term\'s timetable performance.',
                            placement: 'right',
                        });
                    }

                    const holidays = document.querySelector('#dash-holidays');
                    if (holidays) {
                        pageSteps.push({
                            target: '#dash-holidays',
                            content: 'Upcoming Holidays: Stay informed about university breaks and public holidays that may affect your scheduling.',
                            placement: 'right',
                        });
                    }

                    const calendar = document.querySelector('#dash-calendar');
                    if (calendar) {
                        pageSteps.push({
                            target: '#dash-calendar',
                            content: 'Interactive Calendar: View holidays and today\'s academic focus. Stay ahead of university events.',
                            placement: 'left',
                        });
                    }

                    const navigation = document.querySelector('#dash-quick-nav');
                    if (navigation) {
                        pageSteps.push({
                            target: '#dash-quick-nav',
                            content: 'Quick Actions: Jump straight into Room Mapping or Faculty Approval without digging through the menu.',
                            placement: 'left',
                        });
                    }

                    const sidebar = document.querySelector('.sidebar');
                    if (sidebar) {
                        pageSteps.push({
                            target: '.sidebar',
                            content: 'Navigation Sidebar: Access the deeper tools of the scheduler, organized into logical sections.',
                            placement: 'right',
                        });
                    }

                    const account = document.querySelector('.account-section');
                    if (account) {
                        pageSteps.push({
                            target: '.account-section',
                            content: 'Account & Settings: Manage your profile or switch between the premium Dark and Light aesthetic themes.',
                            placement: 'bottom',
                        });
                    }
                }
            } else if (pathname.includes('/UploadCSV')) {
                pageSteps = [
                    {
                        target: 'body',
                        placement: 'center',
                        content: 'Welcome to the Upload CSV Center! Let\'s go over what each section here is meant for.',
                        disableBeacon: true,
                    },
                    {
                        target: '#upload-card-rooms',
                        placement: 'auto',
                        content: 'Rooms & Buildings: Provide a list of all distinct rooms and their precise capacities. They will populate the Maps and Rooms Management pages.',
                        disableBeacon: false,
                    },
                    {
                        target: '#upload-card-courses',
                        placement: 'auto',
                        content: 'Degree Program Section: Upload a structured breakdown of year levels, sections, and subjects meant for a specific degree program. This rapidly fleshes out your curriculum requirements.',
                        disableBeacon: false,
                    },
                    {
                        target: '#upload-card-faculty',
                        placement: 'auto',
                        content: 'Faculty Profiles: Need to onboard bulk faculty accounts? List them here by assigned College or Department. The system will build their initial setup for Faculty Approval.',
                        disableBeacon: false,
                    }
                ]
            } else if (pathname.includes('Rooms-Management/MapViewer')) {
                pageSteps = [
                    {
                        target: 'body',
                        placement: 'center',
                        content: 'Welcome to the 2D Map Editor! Here you can visually orchestrate your campus layout. Let\'s walk through the workspace.',
                        disableBeacon: true,
                    },
                    {
                        target: '#map-header',
                        placement: 'auto',
                        content: 'Map Editor Toolbar: Switch buildings, change floors, and toggle between Editor, Floor Plan, and Live views.',
                        disableBeacon: false,
                    },
                    {
                        target: '#map-toolbox-header',
                        placement: 'auto',
                        content: 'The Toolbox: Drag and drop structural elements like rooms, walls, doors, and icons directly onto the canvas.',
                        disableBeacon: false,
                    },
                    {
                        target: '#map-panel-tabs',
                        placement: 'auto',
                        content: 'Properties & Layers: Fine-tune the coordinates, colors, and dimensions of objects, or manage their stacking order in the layers list.',
                        disableBeacon: false,
                    },
                    {
                        target: '#map-floorplans-header',
                        placement: 'auto',
                        content: 'Drafts & Floor Plans: Access your previously saved layouts or create a entirely new floor plan draft for this building.',
                        disableBeacon: false,
                    },
                    {
                        target: '#map-save-btn',
                        placement: 'auto',
                        content: 'Save: Once you\'re happy with your design, don\'t forget to save your progress to the database.',
                        disableBeacon: false,
                    },
                    {
                        target: '#map-share-btn',
                        placement: 'auto',
                        content: 'Share: Generate a quick link to show off this floor plan or collaborate with other administrators.',
                        disableBeacon: false,
                    }
                ]
            } else if (pathname.includes('/RoomsManagement') || pathname.includes('/Rooms-Management')) {
                pageSteps = [
                    {
                        target: '#rooms-header',
                        placement: 'bottom',
                        content: 'Room Management! This is the central hub where you manage your campus facilities, buildings, and rooms.',
                        disableBeacon: true,
                    }
                ];

                if (typeof window !== 'undefined') {
                    if (document.querySelector('#rooms-empty-upload-btn')) {
                        pageSteps.push({
                            target: '#rooms-empty-upload-btn',
                            placement: 'top',
                            content: 'No files yet? Click here to jump to the CSV Upload page and bulk-populate your database magically.',
                            disableBeacon: false,
                        });
                    }

                    if (document.querySelector('#rooms-file-grid')) {
                        pageSteps.push({
                            target: '#rooms-file-grid',
                            placement: 'top',
                            content: 'These are your uploaded campus files. Click any of these color-coded folders to view the specific buildings and rooms encapsulated inside.',
                            disableBeacon: false,
                        });
                    }

                    if (document.querySelector('#rooms-stats')) {
                        pageSteps.push({
                            target: '#rooms-stats',
                            placement: 'bottom',
                            content: 'The Stats Ribbon gives you a bird\'s eye view of the currently selected file. Track capacities and total usable rooms across the dataset instantly.',
                            disableBeacon: false,
                        });
                    }

                    if (document.querySelector('#rooms-search')) {
                        pageSteps.push({
                            target: '#rooms-search',
                            placement: 'bottom',
                            content: 'Use these powerful filters when looking for specific rooms. Filter by floor, type, college assignment, or even amenities like AC or TV!',
                            disableBeacon: false,
                        });
                    }

                    if (document.querySelector('#rooms-add-btn')) {
                        pageSteps.push({
                            target: '#rooms-add-btn',
                            placement: 'auto',
                            content: 'Need to manually inject a single room without a CSV override? You can click the Add Room button here.',
                            disableBeacon: false,
                        });
                    }

                    if (document.querySelector('#first-room-card')) {
                        pageSteps.push({
                            target: '#first-room-card',
                            placement: 'auto',
                            content: 'The Room Card: View capacity, floor, and college assignment here. Notice the icons at the bottom - they show what equipment is currently assigned!',
                            disableBeacon: false,
                        });
                    }

                    if (document.querySelector('#rooms-amenities-label')) {
                        pageSteps.push({
                            target: '#rooms-amenities-label',
                            placement: 'top',
                            content: 'Quick Amenities: Standard features like AC, TVs, and Whiteboards can be toggled here for fast setup.',
                            disableBeacon: false,
                        });
                    }

                    if (document.querySelector('#rooms-equipment-label')) {
                        pageSteps.push({
                            target: '#rooms-equipment-label',
                            placement: 'top',
                            content: 'CRITICAL: Detailed Equipment. This is the "Brain" of the room for the scheduler. Every tag you add here allows specifically requiring courses to filter for this room!',
                            disableBeacon: false,
                        });
                    }

                    if (document.querySelector('#rooms-equipment-manager')) {
                        pageSteps.push({
                            target: '#rooms-equipment-manager',
                            placement: 'bottom',
                            content: 'Feature Manager: Add specific tags like "PC", "Lab Equipment", or "Projector". When a course also requires these, the scheduler knows to pair them together!',
                            disableBeacon: false,
                        });
                    }
                }
            } else if (pathname.includes('/FacultyManagement/FacultyApproval')) {
                if (typeof window !== 'undefined') {
                    const header = document.querySelector('#approval-header-section');
                    if (header) {
                        pageSteps.push({
                            target: '#approval-header-section',
                            placement: 'bottom',
                            content: 'Faculty Approval Center! Use this page to curate your faculty members and manage their account access.',
                            disableBeacon: true,
                        });
                    }

                    const search = document.querySelector('#approval-search');
                    if (search) {
                        pageSteps.push({
                            target: '#approval-search',
                            placement: 'bottom',
                            content: 'Quick Search: Type a name or email here to instantly find a specific application in the current filter list.',
                            disableBeacon: false,
                        });
                    }

                    const pending = document.querySelector('#tab-pending');
                    if (pending) {
                        pageSteps.push({
                            target: '#tab-pending',
                            placement: 'top',
                            content: 'Pending: This is your inbox! Review new registration requests here. You can approve their roles or reject invalid applications.',
                            disableBeacon: false,
                        });
                    }

                    const approved = document.querySelector('#tab-approved');
                    if (approved) {
                        pageSteps.push({
                            target: '#tab-approved',
                            placement: 'top',
                            content: 'Approved: View all currently active faculty members. You can still revoke access or change their details if needed.',
                            disableBeacon: false,
                        });
                    }

                    const rejected = document.querySelector('#tab-rejected');
                    if (rejected) {
                        pageSteps.push({
                            target: '#tab-rejected',
                            placement: 'top',
                            content: 'Rejected: Applications that didn\'t meet the criteria are archived here. You can re-approve them or permanently delete their records.',
                            disableBeacon: false,
                        });
                    }

                    const grid = document.querySelector('#approval-card-grid');
                    if (grid) {
                        pageSteps.push({
                            target: '#approval-card-grid',
                            placement: 'top',
                            content: 'Management Cards: Each card represents a faculty member. Click on their status or actions to update their permissions immediately.',
                            disableBeacon: false,
                        });
                    }

                    const sidebar = document.querySelector('.sidebar');
                    if (sidebar) {
                        pageSteps.push({
                            target: '.sidebar',
                            content: 'Navigation Sidebar: Access the deeper tools of the scheduler, organized into logical sections.',
                            placement: 'right',
                        });
                    }

                    const account = document.querySelector('.account-section');
                    if (account) {
                        pageSteps.push({
                            target: '.account-section',
                            content: 'Account & Settings: Manage your profile or switch between the premium Dark and Light aesthetic themes.',
                            placement: 'bottom',
                        });
                    }
                }
            } else if (pathname.includes('/FacultyColleges')) {
                if (pathname.includes('TeachingLoadAssignment')) {
                    pageSteps = [
                        {
                            target: 'body',
                            placement: 'center',
                            content: 'Teaching Loads! Assign exact subjects, monitor max units, and define specific tasks per faculty member.',
                            disableBeacon: true,
                        }
                    ]
                } else if (pathname.includes('PreferredSchedules')) {
                    pageSteps = [
                        {
                            target: 'body',
                            placement: 'center',
                            content: 'Preferred Schedules! View and manage when your faculty members are available to teach, aligning with their personal constraints.',
                            disableBeacon: true,
                        }
                    ]
                } else {
                    pageSteps = [
                        {
                            target: '#colleges-header',
                            placement: 'bottom',
                            content: 'Welcome to Faculty Colleges! Here you can manage your faculty members organized by their specific college departments.',
                            disableBeacon: true,
                        }
                    ];

                    if (typeof window !== 'undefined') {
                        if (document.querySelector('#colleges-grid')) {
                            pageSteps.push({
                                target: '#colleges-grid',
                                placement: 'top',
                                content: 'These folders represent each college. Click on one to drill down into the faculty rosters and CSV files saved inside.',
                                disableBeacon: false,
                            });
                        }

                        if (document.querySelector('#add-college-btn')) {
                            pageSteps.push({
                                target: '#add-college-btn',
                                placement: 'bottom',
                                content: 'Need to add a new department manually? Use this button to create a new college record.',
                                disableBeacon: false,
                            });
                        }

                        if (document.querySelector('#add-faculty-btn')) {
                            pageSteps.push({
                                target: '#add-faculty-btn',
                                placement: 'bottom',
                                content: 'To onboard a new staff member manually, click "Add Faculty". This is where you\'ll specify their role and official email.',
                                disableBeacon: false,
                            });
                        }

                        if (document.querySelector('#faculty-email-input')) {
                            pageSteps.push({
                                target: '#faculty-email-input',
                                placement: 'top',
                                content: 'CRITICAL: Add the faculty member\'s email here. If they have an approved account, the system will automatically sync their profile data!',
                                disableBeacon: false,
                            });
                        }
                    }
                }
            } else if (pathname.includes('/CoursesManagement')) {
                if (pathname.includes('ClassSectionAssigning')) {
                    pageSteps = [
                        {
                            target: '#assigning-header',
                            placement: 'bottom',
                            content: 'Welcome to Class & Section Assigning! This is where you organize students into sections and link them to the subjects they need to take.',
                            disableBeacon: true,
                        }
                    ];

                    if (typeof window !== 'undefined') {
                        if (document.querySelector('#add-batch-btn')) {
                            pageSteps.push({
                                target: '#add-batch-btn',
                                placement: 'bottom',
                                content: 'Step 1: Add a Batch. Create a naming container for your period (e.g., "2024-25 1st Sem"). This keeps your sections organized by time.',
                                disableBeacon: false,
                            });
                        }

                        if (document.querySelector('#batch-modal-form')) {
                            pageSteps.push({
                                target: '#batch-modal-form',
                                placement: 'auto',
                                content: 'Naming Batch: Ensure the name is clear and unique. This acts as the "Master Folder" for your classes.',
                                disableBeacon: false,
                            });
                        }

                        if (document.querySelector('#add-section-btn')) {
                            pageSteps.push({
                                target: '#add-section-btn',
                                placement: 'bottom',
                                content: 'Step 2: Add a Section. Define your actual student groups (e.g., "BSCS 1A"). You must link them to a Degree Program and Year Level.',
                                disableBeacon: false,
                            });
                        }

                        if (document.querySelector('#section-modal-form')) {
                            pageSteps.push({
                                target: '#section-modal-form',
                                placement: 'auto',
                                content: 'Section Configuration: Important! Choosing the correct Degree Program and Year Level enables the automatic course assignment logic.',
                                disableBeacon: false,
                            });
                        }

                        if (document.querySelector('#section-card-courses')) {
                            pageSteps.push({
                                target: '#section-card-courses',
                                placement: 'top',
                                content: 'Automatic Assignment: When you create a section, the system automatically pulls courses from the curriculum that match the section\'s Year and Program!',
                                disableBeacon: false,
                            });
                        }

                        if (document.querySelector('#assign-courses-btn')) {
                            pageSteps.push({
                                target: '#assign-courses-btn',
                                placement: 'bottom',
                                content: 'Manual Override: If the automation missed something or you need to re-sync, use this button to manually batch-assign courses by year level.',
                                disableBeacon: false,
                            });
                        }

                        if (document.querySelector('#assign-modal-form')) {
                            pageSteps.push({
                                target: '#assign-modal-form',
                                placement: 'top',
                                content: 'Batch Assignment: Select a program and year to see all available subjects. Confirm the list to link them all to your selected section instantly.',
                                disableBeacon: false,
                            });
                        }
                    }
                } else {
                    pageSteps = [
                        {
                            target: '#courses-selection-header',
                            placement: 'bottom',
                            content: 'Welcome to Courses Management! This is your academic syllabus hub where you curate every subject offered at the university.',
                            disableBeacon: true,
                        }
                    ];

                    if (typeof window !== 'undefined') {
                        if (document.querySelector('#courses-selection-tabs')) {
                            pageSteps.push({
                                target: '#courses-selection-tabs',
                                placement: 'bottom',
                                content: 'Quick Navigation: Switch between managing raw subject data and assigning those subjects to specific class sections.',
                                disableBeacon: false,
                            });
                        }

                        if (document.querySelector('#courses-college-grid')) {
                            pageSteps.push({
                                target: '#courses-college-grid',
                                placement: 'top',
                                content: 'Curriculum Folders: Subjects are organized by College. Click a folder to see the specific degree programs and years inside.',
                                disableBeacon: false,
                            });
                        }

                        if (document.querySelector('#courses-list-header')) {
                            pageSteps.push({
                                target: '#courses-list-header',
                                placement: 'bottom',
                                content: 'Detailed Roster: You are now viewing the subjects for this specific department. Every entry here is a potential block for the scheduler.',
                                disableBeacon: false,
                            });
                        }

                        if (document.querySelector('#courses-stats-ribbon')) {
                            pageSteps.push({
                                target: '#courses-stats-ribbon',
                                placement: 'bottom',
                                content: 'Stats Snapshot: High-level overview of the curriculum load, including breakdown by year level (1st-4th Year).',
                                disableBeacon: false,
                            });
                        }

                        if (document.querySelector('#courses-list-filters')) {
                            pageSteps.push({
                                target: '#courses-list-filters',
                                placement: 'bottom',
                                content: 'Advanced Filtering: Narrow down by Semester, Year Level, or even "Course Type" (Lecture vs Laboratory).',
                                disableBeacon: false,
                            });
                        }

                        if (document.querySelector('#course-modal-details')) {
                            pageSteps.push({
                                target: '#course-modal-details',
                                placement: 'auto',
                                content: 'Course Specification: Set the units, contact hours, and prerequisites. This data determines the duration of scheduled slots.',
                                disableBeacon: false,
                            });
                        }

                        if (document.querySelector('#course-equipment-section')) {
                            pageSteps.push({
                                target: '#course-equipment-section',
                                placement: 'top',
                                content: 'CRITICAL: Equipment Requirements. This is where you tell the system what a room MUST have to host this subject.',
                                disableBeacon: false,
                            });
                        }

                        if (document.querySelector('#course-equipment-tabs')) {
                            pageSteps.push({
                                target: '#course-equipment-tabs',
                                placement: 'bottom',
                                content: 'Lec vs Lab: You can define DIFFERENT requirements for Lecture and Lab hours. For example, a "Programming" course might need a Projector for lecture, but PCs for the laboratory.',
                                disableBeacon: false,
                            });
                        }
                    }
                }
            } else if (pathname.includes('/GenerateSchedule')) {
                pageSteps = [
                    {
                        target: '#gen-steps-indicator',
                        placement: 'bottom',
                        content: 'Welcome to the Schedule Generator! This is where the magic happens. We follow a 3-step process to ensure a perfect schedule.',
                        disableBeacon: true,
                    },
                ];

                if (typeof window !== 'undefined') {
                    if (document.querySelector('#gen-step1-container')) {
                        pageSteps.push({
                            target: '#gen-step1-container',
                            placement: 'bottom',
                            content: 'Step 1: Select Data. Choose the rooms (CSV) and the class/section data (from our database) you want to include in this run.',
                            disableBeacon: false,
                        });
                    }

                    if (document.querySelector('#gen-campus-selection')) {
                        pageSteps.push({
                            target: '#gen-campus-selection',
                            placement: 'top',
                            content: 'Campus Selection: Select one or more uploaded Campus/Room files. The scheduler will only use rooms available in these files.',
                            disableBeacon: false,
                        });
                    }

                    if (document.querySelector('#gen-course-selection')) {
                        pageSteps.push({
                            target: '#gen-course-selection',
                            placement: 'top',
                            content: 'Section Selection: Pick the Year Batches (e.g., 2024-2025 Semester 1) that you want to generate schedules for.',
                            disableBeacon: false,
                        });
                    }

                    if (document.querySelector('#gen-step2-container')) {
                        pageSteps.push({
                            target: '#gen-step2-container',
                            placement: 'top',
                            content: 'Step 2: Review & Filter. Verify your data and use advanced filters to exclude specific sections or courses from this automatic run.',
                            disableBeacon: false,
                        });
                    }

                    if (document.querySelector('#gen-section-filter')) {
                        pageSteps.push({
                            target: '#gen-section-filter',
                            placement: 'top',
                            content: 'Granular Control: You don\'t have to schedule everything at once. You can select specific sections or even single course assignments here.',
                            disableBeacon: false,
                        });
                    }

                    if (document.querySelector('#gen-room-filter')) {
                        pageSteps.push({
                            target: '#gen-room-filter',
                            placement: 'top',
                            content: 'Building Focus: Using a specific building for this college? Filter rooms here to restrict the search space.',
                            disableBeacon: false,
                        });
                    }

                    if (document.querySelector('#gen-step3-container')) {
                        pageSteps.push({
                            target: '#gen-step3-container',
                            placement: 'top',
                            content: 'Step 3: Final Config. Set specific rules like Online Days, Operating Hours, and launch the Quantum-Inspired Algorithm!',
                            disableBeacon: false,
                        });
                    }

                    if (document.querySelector('#gen-time-config')) {
                        pageSteps.push({
                            target: '#gen-time-config',
                            placement: 'top',
                            content: 'Operating Hours: Define when classes can be scheduled. The algorithm will never place a class outside these bounds.',
                            disableBeacon: false,
                        });
                    }

                    if (document.querySelector('#gen-online-config')) {
                        pageSteps.push({
                            target: '#gen-online-config',
                            placement: 'top',
                            content: 'The "Online Day" Rule: Force specific days to be strictly Online. This is a "Hard Constraint" that the algorithm will always respect.',
                            disableBeacon: false,
                        });
                    }

                    if (document.querySelector('#gen-generate-action')) {
                        pageSteps.push({
                            target: '#gen-generate-action',
                            placement: 'top',
                            content: 'Ready to Go? Click Generate! You can also use "Manual Edit First" to pre-place some difficult classes before the AI runs.',
                            disableBeacon: false,
                        });
                    }

                    if (document.querySelector('#gen-results-container')) {
                        pageSteps.push({
                            target: '#gen-results-container',
                            placement: 'top',
                            content: 'Success! View your results here. You can see the Timetable preview or click on any card to make manual adjustments.',
                            disableBeacon: false,
                        });
                    }
                }
            } else if (pathname.includes('/ViewSchedule')) {
                pageSteps = [
                    {
                        target: 'body',
                        placement: 'center',
                        content: 'Schedule Viewer! Everything comes together here. Explore all finalized mappings and easily export to PDF or Print.',
                        disableBeacon: true,
                    }
                ]
            } else if (pathname.includes('/LiveTimetable')) {
                if (typeof window !== 'undefined') {
                    const header = document.querySelector('#live-title-section');
                    if (header) {
                        pageSteps.push({
                            target: '#live-title-section',
                            placement: 'bottom',
                            content: 'Live Timetable Center! Monitor the current schedule in real-time and make precision adjustments for the current week.',
                            disableBeacon: true,
                        });
                    }

                    const indicator = document.querySelector('#live-indicator');
                    if (indicator) {
                        pageSteps.push({
                            target: '#live-indicator',
                            placement: 'bottom',
                            content: 'Real-Time Tracking: The "LIVE" badge indicates that the system is tracking the actual current time. Elements in the grid will glow if a class is currently ongoing.',
                            disableBeacon: false,
                        });
                    }

                    const controls = document.querySelector('#live-controls');
                    if (controls) {
                        pageSteps.push({
                            target: '#live-controls',
                            placement: 'bottom',
                            content: 'Quick Actions: Refresh to sync the latest faculty reports, or use "Reset Week" to clear all manual overrides and return to the master schedule.',
                            disableBeacon: false,
                        });
                    }

                    const special = document.querySelector('#live-special-event-btn');
                    if (special) {
                        pageSteps.push({
                            target: '#live-special-event-btn',
                            placement: 'bottom',
                            content: 'Special Events: Mark a room as unavailable due to meetings or events. The system will automatically flag all coinciding classes as "Excused" for that duration.',
                            disableBeacon: false,
                        });
                    }

                    const stats = document.querySelector('#live-stats-row');
                    if (stats) {
                        pageSteps.push({
                            target: '#live-stats-row',
                            placement: 'bottom',
                            content: 'Weekly Summary: Get a bird\'s-eye view of total classes, reported absences, pending makeup requests, and the number of overrides you\'ve applied so far.',
                            disableBeacon: false,
                        });
                    }

                    const weekNav = document.querySelector('#live-week-nav');
                    if (weekNav) {
                        pageSteps.push({
                            target: '#live-week-nav',
                            placement: 'bottom',
                            content: 'Week Navigator: Jump forward to plan next week or look back at historical data. Overrides and absences are strictly per-week.',
                            disableBeacon: false,
                        });
                    }

                    const tabs = document.querySelector('#live-tabs');
                    if (tabs) {
                        pageSteps.push({
                            target: '#live-tabs',
                            placement: 'bottom',
                            content: 'Management Tabs: Switch between the Grid view, the master Absence list, approved Makeup classes, and a summary of all active Overrides.',
                            disableBeacon: false,
                        });
                    }

                    const group = document.querySelector('#live-group-selector');
                    if (group) {
                        pageSteps.push({
                            target: '#live-group-selector',
                            placement: 'bottom',
                            content: 'Grid Grouping: Organize the timetable by Room, Faculty, Section, or College. Use the arrows to cycle through different pages in your selected group.',
                            disableBeacon: false,
                        });
                    }

                    const legend = document.querySelector('#live-legend');
                    if (legend) {
                        pageSteps.push({
                            target: '#live-legend',
                            placement: 'top',
                            content: 'Color Legend: Blue indicates upcoming, Green is ongoing, Gray is finished, Red is an absence, and Purple indicates a manual override was applied.',
                            disableBeacon: false,
                        });
                    }

                    const grid = document.querySelector('#live-grid-container');
                    if (grid) {
                        pageSteps.push({
                            target: '#live-grid-container',
                            placement: 'top',
                            content: 'Interactive Grid: Drag and drop classes to move them for the week, or click any slot to manually override the time, room, or building details.',
                            disableBeacon: false,
                        });
                    }

                    const sidebar = document.querySelector('.sidebar');
                    if (sidebar) {
                        pageSteps.push({
                            target: '.sidebar',
                            content: 'Navigation Sidebar: Access the deeper tools of the scheduler, organized into logical sections.',
                            placement: 'right',
                        });
                    }

                    const account = document.querySelector('.account-section');
                    if (account) {
                        pageSteps.push({
                            target: '.account-section',
                            content: 'Account & Settings: Manage your profile or switch between the premium Dark and Light aesthetic themes.',
                            placement: 'bottom',
                        });
                    }
                }
            } else {
                pageSteps = [
                    {
                        target: 'body',
                        placement: 'center',
                        content: 'Welcome to this section! Feel free to explore and manage the components here.',
                        disableBeacon: true,
                    }
                ]
            }

            setSteps(pageSteps)
        }

        // Longer delay for pages with data loading or entrance animations
        const delay = (pathname.includes('/Home') || pathname.includes('/FacultyApproval')) ? 1500 : 400
        const timer = setTimeout(updateSteps, delay)

        return () => clearTimeout(timer)
    }, [pathname, run])

    const handleJoyrideCallback = (data: CallBackProps) => {
        const { status, step, index, action } = data

        if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
            setRun(false)
            document.body.style.overflow = 'auto'
        }

        if (action === 'next' || action === 'prev' || action === 'start') {
            onStepChange?.(step, index)
        }
    }

    useEffect(() => {
        if (run) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'auto'
        }
        return () => {
            document.body.style.overflow = 'auto'
        }
    }, [run])

    if (!isMounted) return null;

    return (
        <Joyride
            callback={handleJoyrideCallback}
            continuous
            hideCloseButton={false}
            run={run}
            scrollToFirstStep
            scrollOffset={60}
            disableScrolling={true}
            disableScrollParentFix={true}
            disableOverlayClose={true}
            spotlightPadding={10}
            showProgress
            showSkipButton
            disableOverlay={false}
            floaterProps={{
                disableAnimation: true
            }}
            steps={steps}
            styles={{
                options: {
                    zIndex: 10000,
                    arrowColor: 'var(--card-bg)',
                    backgroundColor: 'var(--card-bg)',
                    overlayColor: 'rgba(0, 0, 0, 0.65)',
                    primaryColor: 'var(--primary)',
                    textColor: 'var(--text-primary)',
                },
                tooltipContainer: {
                    textAlign: 'left',
                    fontSize: '15.5px',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                },
                buttonNext: {
                    backgroundColor: 'var(--primary)',
                    color: '#ffffff',
                    borderRadius: '8px',
                    fontWeight: 600,
                    padding: '10px 18px',
                    boxShadow: '0 4px 12px var(--glow-color)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    border: 'none',
                    transition: 'all 0.2s ease',
                },
                buttonBack: {
                    color: 'var(--text-secondary)',
                    marginRight: '12px',
                    fontWeight: 500,
                },
                buttonSkip: {
                    color: 'var(--text-muted)',
                    fontWeight: 500,
                },
                tooltip: {
                    borderRadius: '16px',
                    border: '1px solid var(--card-border)',
                    boxShadow: 'var(--shadow-lg)'
                },
                tooltipContent: {
                    padding: '20px 15px',
                    lineHeight: '1.5'
                }
            }}
            locale={{
                last: 'Finished',
                skip: 'Skip Tutorial',
                next: 'Next',
                back: 'Prev'
            }}
        />
    )
}
