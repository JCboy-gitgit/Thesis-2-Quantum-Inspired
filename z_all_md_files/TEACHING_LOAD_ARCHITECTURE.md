# Teaching Load Assignment - System Architecture

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Faculty Colleges Page                        │
│  (my-app/app/LandingPages/FacultyColleges/page.tsx)            │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  📋 View Faculty by College                            │   │
│  │  👤 View Faculty Profiles                              │   │
│  │  📂 Manage CSV Files                                   │   │
│  │                                                         │   │
│  │  [New Button] → Teaching Load Assignment               │   │
│  └────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│           Teaching Load Assignment Page                          │
│  (my-app/.../FacultyColleges/TeachingLoadAssignment/page.tsx)  │
│                                                                  │
│  Features:                                                       │
│  ├─ 🔍 Search & Filter Faculty                                  │
│  ├─ ➕ Assign Courses Manually                                  │
│  ├─ 📤 Upload CSV (Bulk Assignment)                             │
│  ├─ 📥 Export All Assignments                                   │
│  ├─ 📊 View Teaching Loads                                      │
│  └─ 🗑️ Remove Assignments                                       │
└─────────────────────────────────────────────────────────────────┘
            ↓                    ↓                    ↓
    ┌───────────┐        ┌──────────────┐      ┌─────────────┐
    │  Faculty  │        │   Courses    │      │  Teaching   │
    │ Profiles  │        │  (Classes)   │      │   Loads     │
    │   Table   │        │    Table     │      │   Table     │
    └───────────┘        └──────────────┘      └─────────────┘
```

## Database Schema

```sql
┌──────────────────────────────────────────────────────────────┐
│                    faculty_profiles                          │
├──────────────────────────────────────────────────────────────┤
│ id (UUID) - Primary Key                                      │
│ faculty_id (TEXT) - Employee ID                              │
│ full_name (TEXT)                                             │
│ email (TEXT)                                                 │
│ department (TEXT)                                            │
│ college (TEXT)                                               │
│ position (TEXT)                                              │
│ employment_type (TEXT)                                       │
│ ...                                                          │
└──────────────────────────────────────────────────────────────┘
                          ↑
                          │ (faculty_id FK)
                          │
┌──────────────────────────────────────────────────────────────┐
│                    teaching_loads                            │
├──────────────────────────────────────────────────────────────┤
│ id (BIGINT) - Primary Key                                    │
│ faculty_id (UUID) - Foreign Key → faculty_profiles.id       │
│ course_id (BIGINT) - Foreign Key → class_schedules.id       │
│ academic_year (TEXT)                                         │
│ semester (TEXT)                                              │
│ section (TEXT) - Optional                                    │
│ notes (TEXT) - Optional                                      │
│ created_at (TIMESTAMPTZ)                                     │
│ updated_at (TIMESTAMPTZ)                                     │
│                                                              │
│ UNIQUE: (faculty_id, course_id, academic_year, semester)    │
└──────────────────────────────────────────────────────────────┘
                          │
                          │ (course_id FK)
                          ↓
┌──────────────────────────────────────────────────────────────┐
│                    class_schedules                           │
├──────────────────────────────────────────────────────────────┤
│ id (BIGINT) - Primary Key                                    │
│ course_code (TEXT)                                           │
│ course_name (TEXT)                                           │
│ lec_units (INT)                                              │
│ lab_units (INT)                                              │
│ credit_units (INT)                                           │
│ semester (TEXT)                                              │
│ year_level (INT)                                             │
│ department (TEXT)                                            │
│ college (TEXT)                                               │
│ ...                                                          │
└──────────────────────────────────────────────────────────────┘
```

## Feature Integration Map

```
Application Structure:

my-app/
├── app/
│   ├── LandingPages/
│   │   ├── FacultyColleges/
│   │   │   ├── page.tsx                          ← Modified
│   │   │   ├── styles.module.css
│   │   │   └── TeachingLoadAssignment/           ← NEW FOLDER
│   │   │       ├── page.tsx                      ← NEW PAGE
│   │   │       └── styles.module.css             ← NEW STYLES
│   │   │
│   │   └── CoursesManagement/
│   │       ├── page.tsx                          ← Reference for courses
│   │       └── ClassSectionAssigning/
│   │           └── page.tsx                      ← Similar pattern
│   │
│   └── components/
│       ├── Sidebar.tsx
│       └── MenuBar.tsx
│
├── database/
│   └── create_teaching_loads_table.sql           ← NEW SQL MIGRATION
│
└── lib/
    └── supabaseClient.ts                         ← Used for DB access
```

## User Flow

```
1. Admin Login
   ↓
2. Navigate to Faculty Colleges
   ↓
3. Click "Teaching Load Assignment" Button
   ↓
4. View Faculty List
   ├─→ Filter by College/Department
   ├─→ Search by Name/Email
   └─→ Filter by Academic Year/Semester
   ↓
5. Assign Courses (Choose one):
   │
   ├─→ Manual Assignment:
   │   ├─ Click "+" on faculty card
   │   ├─ Select academic year & semester
   │   ├─ Check courses to assign
   │   └─ Save assignments
   │
   └─→ CSV Upload:
       ├─ Download template
       ├─ Fill in faculty_id, course_code, etc.
       ├─ Upload CSV file
       └─ System validates & imports
   ↓
6. View & Manage Assignments
   ├─→ Expand faculty card
   ├─→ See all assigned courses
   ├─→ View total units
   └─→ Remove individual assignments
   ↓
7. Export for Analysis
   └─→ Download all assignments as CSV
```

## Component Hierarchy

```
TeachingLoadAssignmentPage
├── MenuBar
├── Sidebar
└── Main Content
    ├── Header
    │   └── Navigation (Back to Faculty Colleges)
    │
    ├── Notification Banner
    │   └── Success/Error Messages
    │
    ├── Action Buttons
    │   ├── Upload CSV Button
    │   ├── Download Template Button
    │   └── Export Assignments Button
    │
    ├── Filters Section
    │   ├── Search Input
    │   ├── College Dropdown
    │   ├── Department Dropdown
    │   ├── Academic Year Dropdown
    │   └── Semester Dropdown
    │
    ├── Faculty Grid
    │   └── Faculty Cards (each card):
    │       ├── Faculty Header
    │       │   ├── Avatar
    │       │   ├── Name, Position, Email
    │       │   └── Actions (Assign, Expand)
    │       │
    │       ├── Load Summary
    │       │   ├── Course Count
    │       │   ├── Total Units
    │       │   └── Employment Type Badge
    │       │
    │       └── Course List (when expanded)
    │           └── Course Items (each):
    │               ├── Course Code & Name
    │               ├── Units, Semester, Section
    │               └── Delete Button
    │
    └── Modals
        ├── Assign Courses Modal
        │   ├── Assignment Details Form
        │   └── Course Selection Checkboxes
        │
        ├── CSV Upload Modal
        │   ├── File Upload Input
        │   └── CSV Preview
        │
        └── Delete Confirmation Modal
```

## Data Relationships

```
Teaching Load Calculation:

For each Faculty Member:
  ↓
  Query teaching_loads WHERE faculty_id = X
  ↓
  For each teaching_load:
    ↓
    Get course from class_schedules
    ↓
    Sum: lec_units + lab_units
  ↓
  Display:
    - Total Courses: COUNT(teaching_loads)
    - Total Units: SUM(lec_units + lab_units)
    - Course List with details
```

## API Interactions

```
Supabase Operations:

1. Fetch Faculty:
   supabase.from('faculty_profiles')
     .select('*')
     .eq('is_active', true)

2. Fetch Courses:
   supabase.from('class_schedules')
     .select('*')

3. Fetch Teaching Loads:
   supabase.from('teaching_loads')
     .select('*')

4. Create Assignment:
   supabase.from('teaching_loads')
     .insert([{
       faculty_id,
       course_id,
       academic_year,
       semester,
       section,
       notes
     }])

5. Delete Assignment:
   supabase.from('teaching_loads')
     .delete()
     .eq('id', loadId)
```

## Security & Permissions

```
Authentication Flow:

User Login
  ↓
Check Session
  ↓
Verify Admin Email
  ├─→ Yes: Grant Access
  └─→ No: Redirect to /faculty/home
  ↓
Row Level Security (RLS)
  ├─→ SELECT: All authenticated users
  ├─→ INSERT: Authenticated users
  ├─→ UPDATE: Authenticated users
  └─→ DELETE: Authenticated users
```

## Future Enhancements Architecture

```
Potential Additions:

1. Conflict Detection:
   teaching_loads → room_allocations
   Check time slot overlaps

2. Notifications:
   teaching_loads INSERT → Trigger
   Send email to faculty

3. Analytics Dashboard:
   teaching_loads → Aggregation Views
   Workload reports, trends

4. Integration:
   teaching_loads ← → HR System
   Automatic load calculations
```

---

This architecture enables:
- ✅ Modular design
- ✅ Easy maintenance
- ✅ Scalability
- ✅ Data integrity
- ✅ User-friendly interface
