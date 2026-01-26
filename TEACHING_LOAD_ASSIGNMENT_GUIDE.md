# Teaching Load Assignment Feature

## Overview
The Teaching Load Assignment feature allows administrators to assign courses to faculty members and manage teaching loads efficiently. This feature is integrated into the Faculty Colleges section of the application.

## Features

### 1. **Manual Course Assignment**
- Assign multiple courses to a faculty member at once
- Select courses based on college and department
- Specify academic year, semester, and section
- Add optional notes for each assignment

### 2. **CSV Bulk Upload**
- Import multiple teaching assignments via CSV file
- Download a template CSV file for reference
- Automatically validates faculty IDs and course codes
- Batch import for efficient data entry

### 3. **Teaching Load Management**
- View all courses assigned to each faculty member
- Track total units (lecture + lab) per faculty
- Filter by college, department, semester, and academic year
- Expand/collapse faculty cards to view detailed assignments
- Remove individual course assignments

### 4. **Export Functionality**
- Export all teaching loads to CSV
- Download template for CSV uploads
- Generate reports for analysis

## How to Use

### Accessing the Feature
1. Navigate to **Faculty Colleges** from the main menu
2. Click on **"Teaching Load Assignment"** button in the header
3. You'll be directed to the Teaching Load Assignment page

### Assigning Courses Manually

1. **Find the Faculty Member**
   - Use the search bar to find faculty by name, email, or department
   - Apply filters for college, department, academic year, or semester

2. **Open Assignment Modal**
   - Click the **"+"** button on the faculty card
   - The "Assign Courses" modal will open

3. **Configure Assignment**
   - Select **Academic Year** (e.g., 2025-2026)
   - Select **Semester** (First Semester, Second Semester, or Summer)
   - Optionally enter **Section** (e.g., BSCS 1A)
   - Optionally add **Notes** (e.g., "Main instructor")

4. **Select Courses**
   - Browse the list of available courses
   - Courses are filtered by the faculty's college and department
   - Check the boxes for courses you want to assign
   - The selected count is displayed in the header

5. **Save Assignment**
   - Click **"Assign X Course(s)"** button
   - A success notification will appear
   - The faculty card will update to show the new assignments

### Uploading CSV Files

1. **Download Template**
   - Click **"Download Template"** button
   - A sample CSV file will download with the correct format

2. **Prepare CSV File**
   - Use the template format:
     ```
     faculty_id,course_code,academic_year,semester,section,notes
     FAC001,CS101,2025-2026,First Semester,BSCS 1A,Main instructor
     FAC002,MATH101,2025-2026,First Semester,BSCS 1A,
     ```
   - **Required fields**: faculty_id, course_code, academic_year, semester
   - **Optional fields**: section, notes

3. **Upload CSV**
   - Click **"Upload CSV"** button
   - Select your CSV file
   - Preview the first 10 lines
   - Click **"Upload & Import"**
   - System validates and imports the data

### Managing Existing Assignments

1. **View Faculty Assignments**
   - Click the **expand arrow** on any faculty card
   - All assigned courses are displayed

2. **Check Teaching Load**
   - Each faculty card shows:
     - Total number of courses
     - Total units (lecture + lab)
     - Employment type badge

3. **Remove Assignment**
   - Click the **trash icon** next to any course
   - Confirm the deletion
   - Assignment is removed immediately

### Filtering and Searching

- **Search Bar**: Type faculty name, email, or department
- **College Filter**: Show faculty from specific college
- **Department Filter**: Show faculty from specific department
- **Academic Year Filter**: View assignments for specific year
- **Semester Filter**: View assignments for specific semester

### Exporting Data

- Click **"Export All Assignments"** to download a CSV file with:
  - Faculty information (name, ID, email)
  - Course details (code, name, units)
  - Assignment details (academic year, semester, section, notes)

## Database Setup

Before using this feature, you need to create the `teaching_loads` table in Supabase:

1. Open your **Supabase SQL Editor**
2. Navigate to the file: `my-app/database/create_teaching_loads_table.sql`
3. Copy and paste the SQL content into the SQL Editor
4. Click **"Run"** to execute the SQL
5. Verify the table was created successfully

The SQL script creates:
- The `teaching_loads` table
- Necessary indexes for performance
- Row Level Security (RLS) policies
- Triggers for automatic timestamp updates
- Foreign key constraints to ensure data integrity

## CSV Format Reference

### Template Structure
```csv
faculty_id,course_code,academic_year,semester,section,notes
```

### Example Data
```csv
faculty_id,course_code,academic_year,semester,section,notes
FAC001,CS101,2025-2026,First Semester,BSCS 1A,Main instructor
FAC001,CS102,2025-2026,First Semester,BSCS 1B,Lab coordinator
FAC002,MATH101,2025-2026,First Semester,BSCS 1A,
FAC003,ENGL101,2025-2026,Second Semester,BSCS 2A,Guest lecturer
```

### Field Descriptions

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| faculty_id | Yes | Unique faculty identifier (from faculty_profiles table) | FAC001 |
| course_code | Yes | Course code (from class_schedules table) | CS101 |
| academic_year | Yes | Format: YYYY-YYYY | 2025-2026 |
| semester | Yes | First Semester, Second Semester, or Summer | First Semester |
| section | No | Section identifier | BSCS 1A |
| notes | No | Additional information | Main instructor |

## Tips and Best Practices

1. **Start Small**: When first using CSV upload, test with a few entries to ensure format is correct

2. **Verify Data**: Always check that faculty IDs and course codes match your database

3. **Use Filters**: Apply filters before making assignments to work with specific groups

4. **Regular Exports**: Periodically export your data for backup and analysis

5. **Academic Year Planning**: Use the academic year filter to plan ahead for future semesters

6. **Load Balancing**: Monitor total units per faculty to ensure fair distribution

7. **Employment Type**: Consider employment type when assigning loads:
   - Full-time: 15-18 units typically
   - Part-time: 6-12 units typically
   - Adjunct: 3-9 units typically

## Troubleshooting

### CSV Upload Fails
- Check that all required fields are present
- Verify faculty_id exists in faculty_profiles table
- Verify course_code exists in class_schedules table
- Ensure no duplicate assignments (same faculty, course, semester)

### Course Not Appearing in Selection
- Verify course is in class_schedules table
- Check that course college/department matches faculty's college/department
- Ensure course is active

### Cannot Delete Assignment
- Verify you have admin permissions
- Check that the assignment still exists in the database
- Try refreshing the page

## Technical Notes

### Database Table: teaching_loads

```sql
Columns:
- id: Primary key (auto-increment)
- faculty_id: UUID (foreign key to faculty_profiles)
- course_id: Integer (foreign key to class_schedules)
- academic_year: Text (format: YYYY-YYYY)
- semester: Text
- section: Text (nullable)
- notes: Text (nullable)
- created_at: Timestamp
- updated_at: Timestamp

Constraints:
- Unique combination: faculty_id + course_id + academic_year + semester + section
- ON DELETE CASCADE for both foreign keys
```

### API Endpoints Used

The feature interacts with the following Supabase tables:
- `faculty_profiles`: Faculty member information
- `class_schedules`: Course information
- `teaching_loads`: Assignment records

### Permissions

- Feature requires **admin authentication**
- Non-admin users are redirected to faculty home page
- All database operations respect Row Level Security (RLS) policies

## Future Enhancements

Potential improvements for future versions:
- Conflict detection (time slot overlaps)
- Automatic load balancing suggestions
- Integration with room scheduling
- Email notifications to faculty
- Workload reports and analytics
- Semester comparison views
- Historical assignment tracking
- Export to PDF format
- Integration with HR systems

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Verify database setup is complete
3. Check browser console for error messages
4. Review Supabase logs for database errors
5. Contact system administrator

---

Last updated: January 26, 2026
