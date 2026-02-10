-- ============================================================================
-- SCHEDULE MANAGEMENT TABLES
-- Run this migration in Supabase SQL Editor
-- ============================================================================

-- 1. Add is_locked column to generated_schedules
ALTER TABLE generated_schedules 
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN generated_schedules.is_locked IS 'When true, faculty cannot submit reschedule requests. Schedule changes are permanent.';

-- 2. Schedule Change Requests (faculty drag-and-drop reschedule requests)
CREATE TABLE IF NOT EXISTS schedule_change_requests (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER NOT NULL REFERENCES generated_schedules(id) ON DELETE CASCADE,
  allocation_id INTEGER NOT NULL,
  requested_by UUID NOT NULL,
  requester_name TEXT,
  requester_email TEXT,
  
  -- Original slot
  original_day TEXT NOT NULL,
  original_time TEXT NOT NULL,
  original_room TEXT,
  original_building TEXT,
  
  -- Requested new slot
  new_day TEXT NOT NULL,
  new_time TEXT NOT NULL,
  new_room TEXT,
  new_building TEXT,
  new_room_id INTEGER,
  
  -- Course info (for display)
  course_code TEXT,
  course_name TEXT,
  section TEXT,
  teacher_name TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason TEXT,
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scr_schedule_id ON schedule_change_requests(schedule_id);
CREATE INDEX IF NOT EXISTS idx_scr_status ON schedule_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_scr_requested_by ON schedule_change_requests(requested_by);

COMMENT ON TABLE schedule_change_requests IS 'Faculty requests to move a scheduled class to a different time/room (before schedule is locked)';

-- 3. Makeup Class Requests (F2F only)
CREATE TABLE IF NOT EXISTS makeup_class_requests (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER NOT NULL REFERENCES generated_schedules(id) ON DELETE CASCADE,
  faculty_id UUID NOT NULL,
  faculty_name TEXT,
  faculty_email TEXT,
  
  -- Class info
  course_code TEXT NOT NULL,
  course_name TEXT,
  section TEXT NOT NULL,
  
  -- Requested slot
  requested_day TEXT NOT NULL,
  requested_time TEXT NOT NULL,
  requested_room TEXT,
  requested_building TEXT,
  requested_room_id INTEGER,
  
  -- Metadata
  reason TEXT,
  class_type TEXT NOT NULL DEFAULT 'f2f' CHECK (class_type = 'f2f'),
  week_of DATE NOT NULL, -- Monday of the target week
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcr_schedule_id ON makeup_class_requests(schedule_id);
CREATE INDEX IF NOT EXISTS idx_mcr_status ON makeup_class_requests(status);
CREATE INDEX IF NOT EXISTS idx_mcr_faculty_id ON makeup_class_requests(faculty_id);
CREATE INDEX IF NOT EXISTS idx_mcr_week_of ON makeup_class_requests(week_of);

COMMENT ON TABLE makeup_class_requests IS 'Faculty requests for make-up classes (F2F only), resets weekly';

-- 4. Faculty Leaves / Absences
CREATE TABLE IF NOT EXISTS faculty_leaves (
  id SERIAL PRIMARY KEY,
  faculty_id UUID NOT NULL,
  faculty_name TEXT,
  faculty_email TEXT,
  schedule_id INTEGER REFERENCES generated_schedules(id) ON DELETE SET NULL,
  
  leave_date DATE NOT NULL,
  leave_day TEXT NOT NULL, -- e.g. 'Monday'
  leave_type TEXT NOT NULL DEFAULT 'personal' CHECK (leave_type IN ('sick', 'personal', 'official', 'other')),
  reason TEXT,
  week_of DATE NOT NULL, -- Monday of the target week
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fl_faculty_id ON faculty_leaves(faculty_id);
CREATE INDEX IF NOT EXISTS idx_fl_week_of ON faculty_leaves(week_of);
CREATE INDEX IF NOT EXISTS idx_fl_leave_date ON faculty_leaves(leave_date);

COMMENT ON TABLE faculty_leaves IS 'Faculty leave/absence records, resets weekly. Affects room availability for makeup class scheduling.';

-- 5. Disable RLS for development (remove for production)
ALTER TABLE schedule_change_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE makeup_class_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE faculty_leaves DISABLE ROW LEVEL SECURITY;
