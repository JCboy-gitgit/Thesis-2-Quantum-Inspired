-- Create tables for Faculty Attendance and Room Availability
-- Run this in Supabase SQL Editor

-- 1. Faculty Attendance Table
CREATE TABLE IF NOT EXISTS faculty_attendance (
  id SERIAL PRIMARY KEY,
  faculty_user_id UUID NOT NULL, -- References auth.users(id) conceptually
  schedule_id INTEGER REFERENCES generated_schedules(id) ON DELETE SET NULL,
  room_allocation_id INTEGER, -- Optional reference to specific allocation
  scope TEXT NOT NULL CHECK (scope IN ('class', 'day', 'week', 'range')),
  day_of_week TEXT, -- For recurring absences (e.g. 'Monday')
  start_date DATE, -- For range absences
  end_date DATE, -- For range absences
  start_time TIME, -- For partial day absences
  end_time TIME, -- For partial day absences
  status TEXT DEFAULT 'absent',
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_faculty_attendance_user ON faculty_attendance(faculty_user_id);
CREATE INDEX IF NOT EXISTS idx_faculty_attendance_schedule ON faculty_attendance(schedule_id);

-- 2. Room Availability Table (for tracking busy slots)
CREATE TABLE IF NOT EXISTS room_availability (
  id SERIAL PRIMARY KEY,
  campus TEXT,
  building TEXT,
  room TEXT,
  day_of_week TEXT,
  start_time TIME,
  end_time TIME,
  is_available BOOLEAN DEFAULT TRUE,
  booked_by TEXT,
  booking_purpose TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for searching availability
CREATE INDEX IF NOT EXISTS idx_room_availability_location ON room_availability(building, room);
CREATE INDEX IF NOT EXISTS idx_room_availability_time ON room_availability(day_of_week, start_time, end_time);

-- 3. Enable RLS (and add policies if strict security is needed)
ALTER TABLE faculty_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_availability ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert/read (adjust policies as needed for security)
CREATE POLICY "Enable read/write for authenticated users on faculty_attendance" 
ON faculty_attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable read/write for authenticated users on room_availability" 
ON room_availability FOR ALL TO authenticated USING (true) WITH CHECK (true);
