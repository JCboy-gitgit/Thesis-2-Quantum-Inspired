# Teaching Load Assignment - Quick Setup Guide

## What Was Created

✅ **New Feature: Teaching Load Assignment**
- A complete page for assigning courses to faculty members
- Located at: `/LandingPages/FacultyColleges/TeachingLoadAssignment`

## Files Created

1. **Page Component**
   - `my-app/app/LandingPages/FacultyColleges/TeachingLoadAssignment/page.tsx`
   - Main React component with all functionality

2. **CSS Styles**
   - `my-app/app/LandingPages/FacultyColleges/TeachingLoadAssignment/styles.module.css`
   - Custom styles for the teaching load feature

3. **Database Migration**
   - `my-app/database/create_teaching_loads_table.sql`
   - SQL script to create the teaching_loads table

4. **Documentation**
   - `TEACHING_LOAD_ASSIGNMENT_GUIDE.md`
   - Comprehensive user guide

## Files Modified

1. **Faculty Colleges Page**
   - `my-app/app/LandingPages/FacultyColleges/page.tsx`
   - Added navigation button to Teaching Load Assignment

## Setup Steps (IMPORTANT!)

### 1. Create Database Table
You MUST run this SQL in Supabase before using the feature:

```sql
-- Open Supabase SQL Editor and run:
-- File: my-app/database/create_teaching_loads_table.sql
```

Or run this command:
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy contents of `my-app/database/create_teaching_loads_table.sql`
4. Execute the SQL

### 2. Access the Feature
1. Go to Faculty Colleges page
2. Click "Teaching Load Assignment" button
3. Start assigning courses!

## Key Features

### ✨ Manual Assignment
- Click "+" on any faculty card
- Select courses, semester, academic year
- Add section and notes
- Assign multiple courses at once

### 📁 CSV Upload
- Download template
- Fill in: faculty_id, course_code, academic_year, semester
- Upload for bulk import

### 📊 View & Manage
- Expand faculty cards to see all assignments
- View total units per faculty
- Remove individual assignments
- Filter by college, department, semester

### 📥 Export
- Export all assignments to CSV
- Download for analysis or backup

## CSV Template Format

```csv
faculty_id,course_code,academic_year,semester,section,notes
FAC001,CS101,2025-2026,First Semester,BSCS 1A,Main instructor
FAC002,MATH101,2025-2026,First Semester,BSCS 1A,
```

## Navigation

**From Faculty Colleges:**
- New "Teaching Load Assignment" button in header
- Purple button next to "Add College"

**Direct URL:**
- `/LandingPages/FacultyColleges/TeachingLoadAssignment`

## Database Structure

```
teaching_loads table:
├── id (primary key)
├── faculty_id (→ faculty_profiles.id)
├── course_id (→ class_schedules.id)
├── academic_year (text)
├── semester (text)
├── section (text, optional)
├── notes (text, optional)
└── timestamps
```

## Testing Checklist

- [ ] Run database migration SQL
- [ ] Navigate to Faculty Colleges
- [ ] Click "Teaching Load Assignment"
- [ ] Try filtering faculty
- [ ] Assign a course manually
- [ ] Download CSV template
- [ ] Try CSV upload
- [ ] Export assignments
- [ ] Remove an assignment

## Troubleshooting

**"Failed to fetch data"**
→ Run the database migration SQL

**"No faculty members found"**
→ Make sure faculty_profiles table has data

**"CSV upload failed"**
→ Check faculty_id and course_code match database

**Button not appearing**
→ Refresh page, check admin authentication

## Next Steps

1. **Run Database Migration** (Required!)
2. **Test Manual Assignment**
3. **Try CSV Upload**
4. **Review Documentation** (TEACHING_LOAD_ASSIGNMENT_GUIDE.md)

---

Need help? Check the full guide: `TEACHING_LOAD_ASSIGNMENT_GUIDE.md`
