export const ADMIN_PAGES = [
  { path: "/LandingPages/Home", name: "Admin Home" },
  { path: "/LandingPages/Alerts", name: "Admin Alerts" },
  { path: "/LandingPages/Profile", name: "Admin Profile" },
  { path: "/LandingPages/UploadCSV", name: "Upload CSV" },
  { path: "/LandingPages/LiveTimetable", name: "Live Timetable" },
  { path: "/LandingPages/CoursesManagement", name: "Courses Management" },
  {
    path: "/LandingPages/CoursesManagement/ClassSectionAssigning",
    name: "Class Section Assigning",
  },
  { path: "/LandingPages/RoomsManagement", name: "Rooms Management" },
  { path: "/LandingPages/Rooms-Management/MapViewer", name: "Map Viewer" },
  {
    path: "/LandingPages/RoomSchedule/GenerateSchedule",
    name: "Generate Schedule",
  },
  {
    path: "/LandingPages/RoomSchedule/ViewSchedule",
    name: "View Schedule",
  },
  {
    path: "/LandingPages/FacultyManagement/FacultyLists",
    name: "Faculty Lists",
  },
  {
    path: "/LandingPages/FacultyManagement/FacultyProfiles",
    name: "Faculty Profiles",
  },
  {
    path: "/LandingPages/FacultyManagement/FacultyApproval",
    name: "Faculty Approval",
  },
  {
    path: "/LandingPages/FacultyManagement/FacultyDepartments",
    name: "Faculty Departments",
  },
  {
    path: "/LandingPages/FacultyManagement/ProfileChangeRequests",
    name: "Profile Change Requests",
  },
  { path: "/LandingPages/FacultyAbsences", name: "Faculty Absences" },
  { path: "/LandingPages/FacultyColleges", name: "Faculty Colleges" },
  {
    path: "/LandingPages/FacultyColleges/TeachingLoadAssignment",
    name: "Teaching Load Assignment",
  },
] as const;

export const FACULTY_PAGES = [
  { path: "/faculty/home", name: "Faculty Home" },
  { path: "/faculty/profile", name: "Faculty Profile" },
  { path: "/faculty/schedules", name: "Faculty Schedules" },
  { path: "/faculty/my-schedule", name: "My Schedule" },
  { path: "/faculty/live-timetable", name: "Faculty Live Timetable" },
  { path: "/faculty/departments", name: "Faculty Departments" },
  { path: "/faculty/directory", name: "Faculty Directory" },
  { path: "/faculty/alerts", name: "Faculty Alerts" },
  { path: "/faculty/campus-map", name: "Campus Map" },
  { path: "/faculty/reset-password", name: "Reset Password" },
] as const;

// Next.js API GET endpoints (safe to hit repeatedly)
export const NEXTJS_GET_ENDPOINTS = [
  "/api/colleges",
  "/api/departments",
  "/api/rooms-list",
  "/api/faculty-list",
  "/api/alerts",
  "/api/presence",
  "/api/room-features?action=tags",
  "/api/floor-plans",
  "/api/live-timetable?action=current-week",
  "/api/schedule-requests",
  "/api/profile-change-requests?status=all",
  "/api/faculty-absences",
  "/api/faculty-default-schedule?action=approved-faculty",
  "/api/faculty-registration?status=all",
  "/api/room-allocation",
  "/api/room-allocation/rooms",
  "/api/room-allocation/sections",
  "/api/room-allocation/analytics",
  "/api/schedule/jobs",
] as const;

// Python backend GET endpoints
export const BACKEND_GET_ENDPOINTS = [
  "/",
  "/health",
  "/api/rooms",
  "/api/sections",
  "/api/teachers",
  "/api/time-slots",
  "/api/schedules",
  "/api/generated-schedules",
  "/api/analytics/room-utilization",
  "/api/analytics/summary",
] as const;
