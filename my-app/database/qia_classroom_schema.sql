-- ============================================================================
-- SUPABASE DATABASE SCHEMA FOR QIA CLASSROOM SCHEDULING SYSTEM
-- ============================================================================
-- This SQL file creates all necessary tables for:
-- - Room Management (with capacity, type: Lab/Lecture)
-- - Class Schedules (courses, sections, weekly schedules)
-- - Faculty/Teacher Schedules (availability)
-- - Room Allocation per section per week
--
-- HOW TO USE:
-- 1. Go to your Supabase Dashboard
-- 2. Navigate to SQL Editor
-- 3. Copy and paste this entire file
-- 4. Click "Run" to execute
-- ============================================================================

-- ============================================================================
-- SECTION 0: DROP EXISTING OBJECTS (for clean re-run)
-- ============================================================================
-- WARNING: This will delete all existing data! Comment out if you want to preserve data.

-- Drop views first (they depend on tables)
DROP VIEW IF EXISTS room_utilization_view CASCADE;
DROP VIEW IF EXISTS teacher_schedule_summary CASCADE;
DROP VIEW IF EXISTS class_schedule_summary CASCADE;
DROP VIEW IF EXISTS room_schedule_view CASCADE;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS file_uploads CASCADE;
DROP TABLE IF EXISTS schedule_conflicts CASCADE;
DROP TABLE IF EXISTS time_slots CASCADE;
DROP TABLE IF EXISTS room_allocations CASCADE;
DROP TABLE IF EXISTS schedule_generations CASCADE;
DROP TABLE IF EXISTS teacher_schedules CASCADE;
DROP TABLE IF EXISTS class_schedules CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS faculty_availability CASCADE;
DROP TABLE IF EXISTS faculty CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS check_faculty_availability CASCADE;
DROP FUNCTION IF EXISTS check_room_availability CASCADE;
DROP FUNCTION IF EXISTS get_next_upload_group_id CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;

-- ============================================================================
-- SECTION 1: USER MANAGEMENT & AUTHENTICATION
-- ============================================================================

-- Drop existing enum if exists and recreate
DROP TYPE IF EXISTS user_role CASCADE;
CREATE TYPE user_role AS ENUM ('admin', 'sub_admin', 'faculty');

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    role user_role DEFAULT 'faculty',
    department_id INTEGER,
    phone VARCHAR(50),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SECTION 2: DEPARTMENT MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    department_code VARCHAR(50) UNIQUE NOT NULL,
    department_name VARCHAR(255) NOT NULL,
    college VARCHAR(255),
    head_name VARCHAR(255),
    head_email VARCHAR(255),
    contact_phone VARCHAR(50),
    office_location VARCHAR(255),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default departments
INSERT INTO departments (department_code, department_name, college) VALUES
    ('CICS', 'College of Information and Computing Sciences', 'CICS'),
    ('COE', 'College of Engineering', 'COE'),
    ('CBA', 'College of Business Administration', 'CBA'),
    ('CAS', 'College of Arts and Sciences', 'CAS'),
    ('CON', 'College of Nursing', 'CON'),
    ('CED', 'College of Education', 'CED')
ON CONFLICT (department_code) DO NOTHING;

-- ============================================================================
-- SECTION 3: ROOM MANAGEMENT
-- ============================================================================

-- Room types enum
DROP TYPE IF EXISTS room_type CASCADE;
CREATE TYPE room_type AS ENUM ('lecture', 'laboratory', 'computer_lab', 'drawing_room', 'auditorium', 'conference', 'other');

-- Rooms table - stores all available rooms
CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    upload_group_id INTEGER,
    room_code VARCHAR(50) NOT NULL,
    room_name VARCHAR(255),
    building VARCHAR(255) NOT NULL,
    floor_number INTEGER DEFAULT 1,
    capacity INTEGER NOT NULL DEFAULT 30,
    room_type room_type DEFAULT 'lecture',
    
    -- Room features
    has_ac BOOLEAN DEFAULT false,
    has_projector BOOLEAN DEFAULT false,
    has_whiteboard BOOLEAN DEFAULT true,
    has_computers INTEGER DEFAULT 0,
    has_lab_equipment BOOLEAN DEFAULT false,
    is_accessible BOOLEAN DEFAULT false,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    
    -- Metadata
    file_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(building, room_code)
);

-- Indexes for rooms
CREATE INDEX IF NOT EXISTS idx_rooms_upload_group ON rooms(upload_group_id);
CREATE INDEX IF NOT EXISTS idx_rooms_building ON rooms(building);
CREATE INDEX IF NOT EXISTS idx_rooms_room_type ON rooms(room_type);
CREATE INDEX IF NOT EXISTS idx_rooms_capacity ON rooms(capacity);

-- ============================================================================
-- SECTION 4: FACULTY/TEACHER MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS faculty (
    id SERIAL PRIMARY KEY,
    upload_group_id INTEGER,
    faculty_id VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    position VARCHAR(100),
    employment_type VARCHAR(50) DEFAULT 'full-time', -- full-time, part-time, contractual
    max_units INTEGER DEFAULT 24,
    current_units INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    file_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Faculty availability/schedule preferences
CREATE TABLE IF NOT EXISTS faculty_availability (
    id SERIAL PRIMARY KEY,
    faculty_id INTEGER NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
    day_of_week VARCHAR(20) NOT NULL, -- Monday, Tuesday, etc.
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT true,
    preference_level INTEGER DEFAULT 1, -- 1=preferred, 2=acceptable, 3=avoid
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faculty
CREATE INDEX IF NOT EXISTS idx_faculty_upload_group ON faculty(upload_group_id);
CREATE INDEX IF NOT EXISTS idx_faculty_department ON faculty(department_id);
CREATE INDEX IF NOT EXISTS idx_faculty_availability_day ON faculty_availability(day_of_week);

-- ============================================================================
-- SECTION 5: COURSE MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    course_code VARCHAR(50) UNIQUE NOT NULL,
    course_name VARCHAR(255) NOT NULL,
    description TEXT,
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    
    -- Units breakdown
    lecture_units INTEGER DEFAULT 3,
    lab_units INTEGER DEFAULT 0,
    total_units INTEGER GENERATED ALWAYS AS (lecture_units + lab_units) STORED,
    
    -- Hours breakdown
    lecture_hours INTEGER DEFAULT 3,
    lab_hours INTEGER DEFAULT 0,
    total_hours INTEGER GENERATED ALWAYS AS (lecture_hours + lab_hours) STORED,
    
    -- Requirements
    requires_lab BOOLEAN DEFAULT false,
    requires_computer_lab BOOLEAN DEFAULT false,
    prerequisites TEXT,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for courses
CREATE INDEX IF NOT EXISTS idx_courses_department ON courses(department_id);
CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(course_code);

-- ============================================================================
-- SECTION 6: CLASS SCHEDULES (from CSV uploads)
-- ============================================================================

CREATE TABLE IF NOT EXISTS class_schedules (
    id SERIAL PRIMARY KEY,
    upload_group_id INTEGER NOT NULL,
    
    -- Course info
    course_code VARCHAR(50) NOT NULL,
    course_name VARCHAR(255),
    section VARCHAR(50) NOT NULL,
    
    -- Units
    lec_units INTEGER DEFAULT 0,
    lab_units INTEGER DEFAULT 0,
    credit_units INTEGER DEFAULT 0,
    
    -- Hours
    lec_hours INTEGER DEFAULT 0,
    lab_hours INTEGER DEFAULT 0,
    
    -- Schedule
    schedule_day VARCHAR(100), -- "Mon/Wed/Fri" or "Monday, Wednesday"
    schedule_time VARCHAR(100), -- "8:00 AM - 9:30 AM"
    start_time TIME,
    end_time TIME,
    
    -- Assignment (filled after room allocation)
    assigned_room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
    assigned_faculty_id INTEGER REFERENCES faculty(id) ON DELETE SET NULL,
    
    -- Metadata
    academic_year VARCHAR(20),
    semester VARCHAR(50),
    department VARCHAR(255),
    college VARCHAR(255),
    file_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending', -- pending, scheduled, conflict
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for class_schedules
CREATE INDEX IF NOT EXISTS idx_class_schedules_upload_group ON class_schedules(upload_group_id);
CREATE INDEX IF NOT EXISTS idx_class_schedules_course ON class_schedules(course_code);
CREATE INDEX IF NOT EXISTS idx_class_schedules_section ON class_schedules(section);
CREATE INDEX IF NOT EXISTS idx_class_schedules_day ON class_schedules(schedule_day);
CREATE INDEX IF NOT EXISTS idx_class_schedules_room ON class_schedules(assigned_room_id);
CREATE INDEX IF NOT EXISTS idx_class_schedules_faculty ON class_schedules(assigned_faculty_id);

-- ============================================================================
-- SECTION 7: TEACHER SCHEDULES (from CSV uploads)
-- ============================================================================

CREATE TABLE IF NOT EXISTS teacher_schedules (
    id SERIAL PRIMARY KEY,
    upload_group_id INTEGER NOT NULL,
    
    -- Teacher info
    teacher_id VARCHAR(100) NOT NULL,
    teacher_name VARCHAR(255) NOT NULL,
    department VARCHAR(255),
    email VARCHAR(255),
    
    -- Schedule (existing commitments/availability)
    schedule_day VARCHAR(100),
    schedule_time VARCHAR(100),
    start_time TIME,
    end_time TIME,
    
    -- Status
    is_available BOOLEAN DEFAULT true, -- false if time slot is blocked
    schedule_type VARCHAR(50) DEFAULT 'teaching', -- teaching, meeting, consultation, blocked
    
    -- Metadata
    college VARCHAR(255),
    file_name VARCHAR(255),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for teacher_schedules
CREATE INDEX IF NOT EXISTS idx_teacher_schedules_upload_group ON teacher_schedules(upload_group_id);
CREATE INDEX IF NOT EXISTS idx_teacher_schedules_teacher_id ON teacher_schedules(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_schedules_day ON teacher_schedules(schedule_day);

-- ============================================================================
-- SECTION 8: ROOM ALLOCATION / GENERATED SCHEDULES
-- ============================================================================

-- Schedule generation summary
CREATE TABLE IF NOT EXISTS schedule_generations (
    id SERIAL PRIMARY KEY,
    generation_name VARCHAR(255) NOT NULL,
    academic_year VARCHAR(20),
    semester VARCHAR(50),
    
    -- Source data
    class_schedule_group_id INTEGER NOT NULL,
    teacher_schedule_group_id INTEGER,
    
    -- Statistics
    total_classes INTEGER DEFAULT 0,
    scheduled_count INTEGER DEFAULT 0,
    unscheduled_count INTEGER DEFAULT 0,
    conflict_count INTEGER DEFAULT 0,
    
    -- Performance
    execution_time_seconds DECIMAL(10, 4),
    algorithm_used VARCHAR(100) DEFAULT 'quantum_inspired',
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    error_message TEXT,
    
    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Room allocations (the actual schedule assignments)
CREATE TABLE IF NOT EXISTS room_allocations (
    id SERIAL PRIMARY KEY,
    generation_id INTEGER NOT NULL REFERENCES schedule_generations(id) ON DELETE CASCADE,
    
    -- Class reference
    class_schedule_id INTEGER NOT NULL REFERENCES class_schedules(id) ON DELETE CASCADE,
    
    -- Allocation details
    room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
    faculty_id INTEGER REFERENCES faculty(id) ON DELETE SET NULL,
    
    -- Schedule details (denormalized for easy querying)
    course_code VARCHAR(50),
    course_name VARCHAR(255),
    section VARCHAR(50),
    day_of_week VARCHAR(20) NOT NULL, -- Single day: Monday, Tuesday, etc.
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    
    -- Room details (denormalized)
    room_code VARCHAR(50),
    building VARCHAR(255),
    room_capacity INTEGER,
    
    -- Faculty details (denormalized)
    faculty_name VARCHAR(255),
    
    -- Status
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, conflict, manual_override
    conflict_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for room_allocations
CREATE INDEX IF NOT EXISTS idx_room_allocations_generation ON room_allocations(generation_id);
CREATE INDEX IF NOT EXISTS idx_room_allocations_room ON room_allocations(room_id);
CREATE INDEX IF NOT EXISTS idx_room_allocations_day ON room_allocations(day_of_week);
CREATE INDEX IF NOT EXISTS idx_room_allocations_time ON room_allocations(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_room_allocations_faculty ON room_allocations(faculty_id);

-- ============================================================================
-- SECTION 9: TIME SLOTS CONFIGURATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS time_slots (
    id SERIAL PRIMARY KEY,
    slot_name VARCHAR(100),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (end_time - start_time)) / 60
    ) STORED,
    slot_type VARCHAR(50) DEFAULT 'regular', -- regular, lab, break
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default time slots
INSERT INTO time_slots (slot_name, start_time, end_time, slot_type) VALUES
    ('7:00 AM - 8:00 AM', '07:00', '08:00', 'regular'),
    ('8:00 AM - 9:00 AM', '08:00', '09:00', 'regular'),
    ('9:00 AM - 10:00 AM', '09:00', '10:00', 'regular'),
    ('10:00 AM - 11:00 AM', '10:00', '11:00', 'regular'),
    ('11:00 AM - 12:00 PM', '11:00', '12:00', 'regular'),
    ('12:00 PM - 1:00 PM', '12:00', '13:00', 'break'),
    ('1:00 PM - 2:00 PM', '13:00', '14:00', 'regular'),
    ('2:00 PM - 3:00 PM', '14:00', '15:00', 'regular'),
    ('3:00 PM - 4:00 PM', '15:00', '16:00', 'regular'),
    ('4:00 PM - 5:00 PM', '16:00', '17:00', 'regular'),
    ('5:00 PM - 6:00 PM', '17:00', '18:00', 'regular'),
    ('6:00 PM - 7:00 PM', '18:00', '19:00', 'regular'),
    ('7:00 PM - 8:00 PM', '19:00', '20:00', 'regular'),
    ('8:00 PM - 9:00 PM', '20:00', '21:00', 'regular')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 10: CONFLICT TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS schedule_conflicts (
    id SERIAL PRIMARY KEY,
    generation_id INTEGER NOT NULL REFERENCES schedule_generations(id) ON DELETE CASCADE,
    
    -- Conflict details
    conflict_type VARCHAR(50) NOT NULL, -- room_overlap, faculty_overlap, capacity_exceeded
    day_of_week VARCHAR(20),
    time_slot VARCHAR(100),
    
    -- Affected items
    class_schedule_id_1 INTEGER REFERENCES class_schedules(id) ON DELETE CASCADE,
    class_schedule_id_2 INTEGER REFERENCES class_schedules(id) ON DELETE CASCADE,
    room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
    faculty_id INTEGER REFERENCES faculty(id) ON DELETE SET NULL,
    
    -- Resolution
    is_resolved BOOLEAN DEFAULT false,
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SECTION 11: FILE UPLOAD TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS file_uploads (
    id SERIAL PRIMARY KEY,
    upload_group_id INTEGER NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- 'rooms', 'class_schedule', 'teacher_schedule', 'faculty'
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255),
    file_size INTEGER,
    row_count INTEGER DEFAULT 0,
    
    -- Context
    college VARCHAR(255),
    department VARCHAR(255),
    academic_year VARCHAR(20),
    semester VARCHAR(50),
    
    -- Status
    status VARCHAR(50) DEFAULT 'processed',
    error_message TEXT,
    
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for file_uploads
CREATE INDEX IF NOT EXISTS idx_file_uploads_group ON file_uploads(upload_group_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_type ON file_uploads(file_type);

-- ============================================================================
-- SECTION 12: SYSTEM SETTINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(50) DEFAULT 'string',
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
    ('default_room_capacity', '40', 'integer', 'Default room capacity if not specified'),
    ('max_hours_per_day', '8', 'integer', 'Maximum teaching hours per day'),
    ('break_start_time', '12:00', 'time', 'Default break start time'),
    ('break_end_time', '13:00', 'time', 'Default break end time'),
    ('academic_year', '2025-2026', 'string', 'Current academic year'),
    ('current_semester', '2nd Semester', 'string', 'Current semester')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================================
-- SECTION 13: AUDIT LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100),
    record_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SECTION 14: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users (full access for now)
CREATE POLICY "Authenticated users full access" ON users FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON departments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON rooms FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON faculty FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON faculty_availability FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON courses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON class_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON teacher_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON schedule_generations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON room_allocations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON time_slots FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON schedule_conflicts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON file_uploads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON system_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- SECTION 15: HELPER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_faculty_updated_at BEFORE UPDATE ON faculty FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_class_schedules_updated_at BEFORE UPDATE ON class_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teacher_schedules_updated_at BEFORE UPDATE ON teacher_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_schedule_generations_updated_at BEFORE UPDATE ON schedule_generations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_room_allocations_updated_at BEFORE UPDATE ON room_allocations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get next upload group ID
CREATE OR REPLACE FUNCTION get_next_upload_group_id(p_table_name TEXT)
RETURNS INTEGER AS $$
DECLARE
    max_id INTEGER;
BEGIN
    IF p_table_name = 'rooms' THEN
        SELECT COALESCE(MAX(upload_group_id), 0) + 1 INTO max_id FROM rooms;
    ELSIF p_table_name = 'class_schedules' THEN
        SELECT COALESCE(MAX(upload_group_id), 0) + 1 INTO max_id FROM class_schedules;
    ELSIF p_table_name = 'teacher_schedules' THEN
        SELECT COALESCE(MAX(upload_group_id), 0) + 1 INTO max_id FROM teacher_schedules;
    ELSIF p_table_name = 'faculty' THEN
        SELECT COALESCE(MAX(upload_group_id), 0) + 1 INTO max_id FROM faculty;
    ELSE
        max_id := 1;
    END IF;
    RETURN max_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check room availability
CREATE OR REPLACE FUNCTION check_room_availability(
    p_room_id INTEGER,
    p_day_of_week VARCHAR,
    p_start_time TIME,
    p_end_time TIME,
    p_generation_id INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    conflict_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO conflict_count
    FROM room_allocations ra
    WHERE ra.room_id = p_room_id
      AND ra.day_of_week = p_day_of_week
      AND ra.status != 'cancelled'
      AND (p_generation_id IS NULL OR ra.generation_id = p_generation_id)
      AND (
          (p_start_time >= ra.start_time AND p_start_time < ra.end_time)
          OR (p_end_time > ra.start_time AND p_end_time <= ra.end_time)
          OR (p_start_time <= ra.start_time AND p_end_time >= ra.end_time)
      );
    
    RETURN conflict_count = 0;
END;
$$ LANGUAGE plpgsql;

-- Function to check faculty availability
CREATE OR REPLACE FUNCTION check_faculty_availability(
    p_faculty_id INTEGER,
    p_day_of_week VARCHAR,
    p_start_time TIME,
    p_end_time TIME,
    p_generation_id INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    conflict_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO conflict_count
    FROM room_allocations ra
    WHERE ra.faculty_id = p_faculty_id
      AND ra.day_of_week = p_day_of_week
      AND ra.status != 'cancelled'
      AND (p_generation_id IS NULL OR ra.generation_id = p_generation_id)
      AND (
          (p_start_time >= ra.start_time AND p_start_time < ra.end_time)
          OR (p_end_time > ra.start_time AND p_end_time <= ra.end_time)
          OR (p_start_time <= ra.start_time AND p_end_time >= ra.end_time)
      );
    
    RETURN conflict_count = 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 16: VIEWS
-- ============================================================================

-- View: Room schedule overview
CREATE OR REPLACE VIEW room_schedule_view AS
SELECT 
    ra.id,
    ra.day_of_week,
    ra.start_time,
    ra.end_time,
    ra.course_code,
    ra.course_name,
    ra.section,
    r.room_code,
    r.building,
    r.room_type,
    r.capacity,
    f.first_name || ' ' || f.last_name AS faculty_name,
    ra.status,
    sg.generation_name,
    sg.academic_year,
    sg.semester
FROM room_allocations ra
LEFT JOIN rooms r ON ra.room_id = r.id
LEFT JOIN faculty f ON ra.faculty_id = f.id
LEFT JOIN schedule_generations sg ON ra.generation_id = sg.id;

-- View: Class schedule summary
CREATE OR REPLACE VIEW class_schedule_summary AS
SELECT 
    upload_group_id,
    file_name,
    college,
    department,
    MIN(created_at) as uploaded_at,
    COUNT(*) as total_classes,
    COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled_count,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
    COUNT(CASE WHEN status = 'conflict' THEN 1 END) as conflict_count,
    SUM(credit_units) as total_units
FROM class_schedules
GROUP BY upload_group_id, file_name, college, department;

-- View: Teacher schedule summary  
CREATE OR REPLACE VIEW teacher_schedule_summary AS
SELECT 
    upload_group_id,
    file_name,
    college,
    MIN(created_at) as uploaded_at,
    COUNT(*) as total_entries,
    COUNT(DISTINCT teacher_id) as unique_teachers
FROM teacher_schedules
GROUP BY upload_group_id, file_name, college;

-- View: Room utilization
CREATE OR REPLACE VIEW room_utilization_view AS
SELECT 
    r.id as room_id,
    r.room_code,
    r.building,
    r.capacity,
    r.room_type,
    COUNT(ra.id) as allocated_slots,
    SUM(EXTRACT(EPOCH FROM (ra.end_time - ra.start_time)) / 3600) as total_hours_used
FROM rooms r
LEFT JOIN room_allocations ra ON r.id = ra.room_id AND ra.status = 'scheduled'
GROUP BY r.id, r.room_code, r.building, r.capacity, r.room_type;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ QIA Classroom Scheduling Database Schema Created Successfully!';
    RAISE NOTICE '📊 Tables: users, departments, rooms, faculty, faculty_availability, courses, class_schedules, teacher_schedules, schedule_generations, room_allocations, time_slots, schedule_conflicts, file_uploads, system_settings, audit_logs';
    RAISE NOTICE '🔐 Row Level Security enabled';
    RAISE NOTICE '⚡ Indexes and triggers configured';
END $$;
