# Supabase Database Setup Guide

This guide will help you set up the Supabase database for the Quantum-Inspired Scheduling System.

## 📋 Prerequisites

1. A Supabase account (free at [supabase.com](https://supabase.com))
2. A Supabase project created

## 🚀 Quick Setup

### Step 1: Get Your Supabase Credentials

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** (e.g., `https://xxxxxxxxxxxx.supabase.co`)
   - **anon public key** (starts with `eyJ...`)

### Step 2: Configure Environment Variables

Create or update your `.env.local` file in the `my-app` folder:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Backend API (if using FastAPI backend)
NEXT_PUBLIC_API_URL=http://localhost:8000

# Email Configuration (for notifications)
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASSWORD=your-app-password
```

### Step 3: Run the Database Schema

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the entire contents of `database/supabase_schema.sql`
5. Paste into the SQL Editor
6. Click **Run** (or press Ctrl/Cmd + Enter)

You should see: `✅ Database schema created successfully!`

### Step 4: Verify Tables Were Created

Go to **Table Editor** in your Supabase Dashboard. You should see these tables:

| Table | Description |
|-------|-------------|
| `users` | User accounts (admin, sub_admin, professor) |
| `user_profiles` | Extended user information |
| `campuses` | Room/campus data from CSV uploads |
| `participants` | Student/participant data from CSV uploads |
| `class_schedules` | Class schedule data from CSV |
| `teacher_schedules` | Teacher schedule data from CSV |
| `schedule_summary` | Generated schedule metadata |
| `schedule_batches` | Batch assignments for schedules |
| `schedule_assignments` | Individual participant assignments |
| `departments` | Academic departments |
| `faculty_members` | Faculty information |
| `faculty_schedules` | Faculty teaching schedules |
| `courses` | Course catalog |
| `course_offerings` | Course sections per semester |
| `email_logs` | Email notification tracking |
| `file_uploads` | Upload history tracking |
| `room_availability` | Room booking system |
| `audit_logs` | Activity tracking |
| `system_settings` | Application settings |

## 📊 Database Schema Overview

### Core Tables Structure

```
┌─────────────────┐     ┌─────────────────┐
│     users       │     │   campuses      │
│  (auth users)   │     │ (from CSV)      │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│ schedule_summary│────▶│ schedule_batches│
│ (event config)  │     │ (room+time)     │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  participants   │────▶│schedule_assign- │
│  (from CSV)     │     │    ments        │
└─────────────────┘     └─────────────────┘
```

### Upload Group ID System

The system uses `upload_group_id` to group data from the same CSV upload:

- Each CSV upload gets a unique `upload_group_id`
- This allows you to:
  - Track which rows came from which file
  - Delete an entire upload in one operation
  - Select specific datasets for scheduling

## 🔧 TypeScript Types

The database types are defined in `lib/database.types.ts`. Import them like this:

```typescript
import { 
  Campus, 
  Participant, 
  ScheduleSummary, 
  ScheduleBatch,
  ScheduleAssignment 
} from '@/lib/database.types'

// Or use the helper types
import type { Tables, InsertTables, UpdateTables } from '@/lib/database.types'

// Get row type
type CampusRow = Tables<'campuses'>

// Get insert type (without auto-generated fields)
type CampusInsert = InsertTables<'campuses'>
```

## 🔒 Row Level Security (RLS)

RLS is enabled on all tables. The current policies allow:

- **Authenticated users**: Full access to most tables
- **Anonymous users**: No access (must be logged in)

To modify policies:
1. Go to **Authentication** → **Policies** in Supabase
2. Edit or add new policies as needed

## 📝 Common Operations

### Upload Campus/Room Data

```typescript
import { supabase, getNextUploadGroupId } from '@/lib/supabase'

const groupId = await getNextUploadGroupId('campuses')

const campusData = csvRows.map(row => ({
  upload_group_id: groupId,
  school_name: 'My School',
  campus: row.campus,
  building: row.building,
  room: row.room,
  capacity: parseInt(row.capacity),
  file_name: file.name
}))

const { error } = await supabase.from('campuses').insert(campusData)
```

### Fetch Schedules with Batches

```typescript
import { supabase } from '@/lib/supabase'

const { data: schedules } = await supabase
  .from('schedule_summary')
  .select(`
    *,
    schedule_batches (*)
  `)
  .order('created_at', { ascending: false })
```

### Delete Schedule with Cascading

```typescript
// Due to foreign key constraints, delete in order:
// 1. Delete assignments first
await supabase.from('schedule_assignments').delete().eq('schedule_summary_id', id)

// 2. Delete batches
await supabase.from('schedule_batches').delete().eq('schedule_summary_id', id)

// 3. Delete summary
await supabase.from('schedule_summary').delete().eq('id', id)
```

## 🔄 Views (Pre-built Queries)

The schema includes these views for common queries:

### `campus_summary`
```sql
SELECT * FROM campus_summary;
-- Returns: upload_group_id, school_name, file_name, total_rooms, total_capacity, etc.
```

### `participant_batch_summary`
```sql
SELECT * FROM participant_batch_summary;
-- Returns: upload_group_id, batch_name, total_participants, pwd_count, pwd_percentage
```

### `schedule_overview`
```sql
SELECT * FROM schedule_overview;
-- Returns: schedule info with batch_count, room_count, building_count
```

## 🛠️ Troubleshooting

### "Missing Supabase environment variables"
- Check `.env.local` file exists
- Verify variable names are correct
- Restart Next.js dev server after changes

### "Row Level Security violation"
- Make sure user is authenticated
- Check RLS policies in Supabase Dashboard

### "Foreign key constraint violation"
- Delete child records before parent records
- Check the deletion order in your code

### "Duplicate key value violates unique constraint"
- Check for existing records with same unique values
- Use `upsert` instead of `insert` if needed

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)

## 📧 Support

If you encounter issues, check:
1. Supabase Dashboard logs
2. Browser console for errors
3. Network tab for API responses
