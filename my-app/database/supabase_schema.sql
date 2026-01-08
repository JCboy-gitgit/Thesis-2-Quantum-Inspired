-- ============================================================================
-- SUPABASE DATABASE SCHEMA FOR THESIS QUANTUM-INSPIRED SCHEDULING SYSTEM
-- ============================================================================
-- This SQL file creates all necessary tables, indexes, and RLS policies
-- for your scheduling application.
-- 
-- HOW TO USE:
-- 1. Go to your Supabase Dashboard
-- 2. Navigate to SQL Editor
-- 3. Copy and paste this entire file
-- 4. Click "Run" to execute
-- ============================================================================

-- ============================================================================
-- SECTION 1: USER MANAGEMENT & AUTHENTICATION
-- ============================================================================

-- Enum for user roles
CREATE TYPE user_role AS ENUM ('admin', 'sub_admin', 'professor');

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    role user_role DEFAULT 'professor',
    department VARCHAR(255),
    phone VARCHAR(50),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles for additional information
CREATE TABLE IF NOT EXISTS user_profiles (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    employee_id VARCHAR(50) UNIQUE,
    position VARCHAR(255),
    office_location VARCHAR(255),
    bio TEXT,
    specialization VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SECTION 2: CAMPUS & ROOM MANAGEMENT (from CSV uploads)
-- ============================================================================

-- Campuses table - stores room data from uploaded CSV files
CREATE TABLE IF NOT EXISTS campuses (
    id SERIAL PRIMARY KEY,
    upload_group_id INTEGER NOT NULL,
    school_name VARCHAR(255) NOT NULL,
    campus VARCHAR(255) NOT NULL,
    building VARCHAR(255) NOT NULL,
    room VARCHAR(100) NOT NULL,
    capacity INTEGER DEFAULT 30,
    file_name VARCHAR(255),
    is_first_floor BOOLEAN DEFAULT false,
    floor_number INTEGER,
    room_type VARCHAR(100) DEFAULT 'classroom',
    has_ac BOOLEAN DEFAULT false,
    has_projector BOOLEAN DEFAULT false,
    has_whiteboard BOOLEAN DEFAULT true,
    is_pwd_accessible BOOLEAN DEFAULT false,
    status VARCHAR(50) DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_campuses_upload_group ON campuses(upload_group_id);
CREATE INDEX IF NOT EXISTS idx_campuses_school_name ON campuses(school_name);
CREATE INDEX IF NOT EXISTS idx_campuses_campus ON campuses(campus);
CREATE INDEX IF NOT EXISTS idx_campuses_building ON campuses(building);
CREATE INDEX IF NOT EXISTS idx_campuses_room ON campuses(room);
CREATE INDEX IF NOT EXISTS idx_campuses_capacity ON campuses(capacity);

-- ============================================================================
-- SECTION 3: PARTICIPANT MANAGEMENT (Students/Faculty from CSV)
-- ============================================================================

-- Participants table - stores participant data from uploaded CSV files
CREATE TABLE IF NOT EXISTS participants (
    id SERIAL PRIMARY KEY,
    upload_group_id INTEGER NOT NULL,
    participant_number VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    is_pwd BOOLEAN DEFAULT false,
    pwd_type VARCHAR(100),
    province VARCHAR(255),
    city VARCHAR(255),
    country VARCHAR(100) DEFAULT 'Philippines',
    contact_number VARCHAR(50),
    batch_name VARCHAR(255),
    file_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for participants
CREATE INDEX IF NOT EXISTS idx_participants_upload_group ON participants(upload_group_id);
CREATE INDEX IF NOT EXISTS idx_participants_batch_name ON participants(batch_name);
CREATE INDEX IF NOT EXISTS idx_participants_participant_number ON participants(participant_number);
CREATE INDEX IF NOT EXISTS idx_participants_email ON participants(email);
CREATE INDEX IF NOT EXISTS idx_participants_is_pwd ON participants(is_pwd);

-- ============================================================================
-- SECTION 4: CLASS SCHEDULES (from CSV - Teacher/Class data)
-- ============================================================================

-- Class schedules table - stores class schedule data from uploaded CSV
CREATE TABLE IF NOT EXISTS class_schedules (
    id SERIAL PRIMARY KEY,
    upload_group_id INTEGER NOT NULL,
    class_section VARCHAR(100),
    course_code VARCHAR(50),
    course_name VARCHAR(255),
    lec_unit INTEGER DEFAULT 0,
    lab_unit INTEGER DEFAULT 0,
    credit_unit INTEGER DEFAULT 0,
    lec_hr INTEGER DEFAULT 0,
    lab_hr INTEGER DEFAULT 0,
    section VARCHAR(100),
    schedule_day VARCHAR(100),
    schedule_time VARCHAR(100),
    school_name VARCHAR(255),
    file_name VARCHAR(255),
    semester VARCHAR(50),
    academic_year VARCHAR(20),
    instructor_id INTEGER,
    room_assigned VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for class schedules
CREATE INDEX IF NOT EXISTS idx_class_schedules_upload_group ON class_schedules(upload_group_id);
CREATE INDEX IF NOT EXISTS idx_class_schedules_course_code ON class_schedules(course_code);
CREATE INDEX IF NOT EXISTS idx_class_schedules_schedule_day ON class_schedules(schedule_day);
CREATE INDEX IF NOT EXISTS idx_class_schedules_section ON class_schedules(section);

-- Teacher schedules table - stores teacher schedule data from uploaded CSV
CREATE TABLE IF NOT EXISTS teacher_schedules (
    id SERIAL PRIMARY KEY,
    upload_group_id INTEGER NOT NULL,
    teacher_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    schedule_day VARCHAR(100),
    schedule_time VARCHAR(100),
    batch_name VARCHAR(255),
    file_name VARCHAR(255),
    department VARCHAR(255),
    email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for teacher schedules
CREATE INDEX IF NOT EXISTS idx_teacher_schedules_upload_group ON teacher_schedules(upload_group_id);
CREATE INDEX IF NOT EXISTS idx_teacher_schedules_teacher_id ON teacher_schedules(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_schedules_schedule_day ON teacher_schedules(schedule_day);

-- ============================================================================
-- SECTION 5: SCHEDULE GENERATION & MANAGEMENT
-- ============================================================================

-- Enum for event types
CREATE TYPE event_type AS ENUM ('Admission_Test', 'Enrollment', 'Orientation', 'Custom');

-- Schedule summary table - stores generated schedule metadata
CREATE TABLE IF NOT EXISTS schedule_summary (
    id SERIAL PRIMARY KEY,
    event_name VARCHAR(255) NOT NULL,
    event_type event_type DEFAULT 'Custom',
    schedule_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    end_date DATE,
    campus_group_id INTEGER NOT NULL,
    participant_group_id INTEGER NOT NULL,
    scheduled_count INTEGER DEFAULT 0,
    unscheduled_count INTEGER DEFAULT 0,
    execution_time DECIMAL(10, 4),
    prioritize_pwd BOOLEAN DEFAULT false,
    email_notification BOOLEAN DEFAULT false,
    duration_per_batch INTEGER DEFAULT 180,
    exclude_lunch_break BOOLEAN DEFAULT true,
    lunch_break_start TIME DEFAULT '12:00:00',
    lunch_break_end TIME DEFAULT '13:00:00',
    school_name VARCHAR(255),
    batch_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for schedule_summary
CREATE INDEX IF NOT EXISTS idx_schedule_summary_event_name ON schedule_summary(event_name);
CREATE INDEX IF NOT EXISTS idx_schedule_summary_schedule_date ON schedule_summary(schedule_date);
CREATE INDEX IF NOT EXISTS idx_schedule_summary_campus_group ON schedule_summary(campus_group_id);
CREATE INDEX IF NOT EXISTS idx_schedule_summary_participant_group ON schedule_summary(participant_group_id);
CREATE INDEX IF NOT EXISTS idx_schedule_summary_created_at ON schedule_summary(created_at);

-- Schedule batches table - stores batch assignments for each schedule
CREATE TABLE IF NOT EXISTS schedule_batches (
    id SERIAL PRIMARY KEY,
    schedule_summary_id INTEGER NOT NULL REFERENCES schedule_summary(id) ON DELETE CASCADE,
    batch_name VARCHAR(255) NOT NULL,
    batch_number INTEGER,
    room VARCHAR(100) NOT NULL,
    time_slot VARCHAR(100),
    start_time TIME,
    end_time TIME,
    batch_date DATE,
    participant_count INTEGER DEFAULT 0,
    has_pwd BOOLEAN DEFAULT false,
    campus VARCHAR(255),
    building VARCHAR(255),
    is_first_floor BOOLEAN DEFAULT false,
    participant_ids TEXT,
    capacity INTEGER,
    utilization_rate DECIMAL(5, 2),
    status VARCHAR(50) DEFAULT 'scheduled',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for schedule_batches
CREATE INDEX IF NOT EXISTS idx_schedule_batches_summary ON schedule_batches(schedule_summary_id);
CREATE INDEX IF NOT EXISTS idx_schedule_batches_batch_name ON schedule_batches(batch_name);
CREATE INDEX IF NOT EXISTS idx_schedule_batches_room ON schedule_batches(room);
CREATE INDEX IF NOT EXISTS idx_schedule_batches_batch_date ON schedule_batches(batch_date);
CREATE INDEX IF NOT EXISTS idx_schedule_batches_batch_number ON schedule_batches(batch_number);

-- Schedule assignments table - stores individual participant assignments
CREATE TABLE IF NOT EXISTS schedule_assignments (
    id SERIAL PRIMARY KEY,
    schedule_summary_id INTEGER NOT NULL REFERENCES schedule_summary(id) ON DELETE CASCADE,
    schedule_batch_id INTEGER REFERENCES schedule_batches(id) ON DELETE CASCADE,
    participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    participant_number VARCHAR(100),
    participant_name VARCHAR(255),
    email VARCHAR(255),
    batch_name VARCHAR(255),
    room VARCHAR(100),
    time_slot VARCHAR(100),
    start_time TIME,
    end_time TIME,
    batch_date DATE,
    campus VARCHAR(255),
    building VARCHAR(255),
    seat_no INTEGER,
    is_pwd BOOLEAN DEFAULT false,
    is_first_floor BOOLEAN DEFAULT false,
    email_sent BOOLEAN DEFAULT false,
    email_sent_at TIMESTAMPTZ,
    check_in_status VARCHAR(50) DEFAULT 'pending',
    check_in_time TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'scheduled',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for schedule_assignments
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_summary ON schedule_assignments(schedule_summary_id);
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_batch ON schedule_assignments(schedule_batch_id);
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_participant ON schedule_assignments(participant_id);
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_email ON schedule_assignments(email);
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_is_pwd ON schedule_assignments(is_pwd);
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_batch_date ON schedule_assignments(batch_date);

-- ============================================================================
-- SECTION 6: FACULTY/DEPARTMENT MANAGEMENT
-- ============================================================================

-- Departments table
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    department_code VARCHAR(50) UNIQUE NOT NULL,
    department_name VARCHAR(255) NOT NULL,
    college VARCHAR(255),
    head_of_department VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    location VARCHAR(255),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Faculty members table
CREATE TABLE IF NOT EXISTS faculty_members (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    position VARCHAR(100),
    rank VARCHAR(100),
    specialization TEXT,
    hire_date DATE,
    status VARCHAR(50) DEFAULT 'active',
    office_room VARCHAR(100),
    office_hours TEXT,
    bio TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faculty_members
CREATE INDEX IF NOT EXISTS idx_faculty_employee_id ON faculty_members(employee_id);
CREATE INDEX IF NOT EXISTS idx_faculty_department ON faculty_members(department_id);
CREATE INDEX IF NOT EXISTS idx_faculty_email ON faculty_members(email);
CREATE INDEX IF NOT EXISTS idx_faculty_status ON faculty_members(status);

-- Faculty schedules (teaching schedules)
CREATE TABLE IF NOT EXISTS faculty_schedules (
    id SERIAL PRIMARY KEY,
    faculty_id INTEGER NOT NULL REFERENCES faculty_members(id) ON DELETE CASCADE,
    class_schedule_id INTEGER REFERENCES class_schedules(id) ON DELETE SET NULL,
    day_of_week VARCHAR(20) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room VARCHAR(100),
    building VARCHAR(255),
    campus VARCHAR(255),
    course_code VARCHAR(50),
    course_name VARCHAR(255),
    section VARCHAR(100),
    semester VARCHAR(50),
    academic_year VARCHAR(20),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faculty_schedules
CREATE INDEX IF NOT EXISTS idx_faculty_schedules_faculty ON faculty_schedules(faculty_id);
CREATE INDEX IF NOT EXISTS idx_faculty_schedules_day ON faculty_schedules(day_of_week);
CREATE INDEX IF NOT EXISTS idx_faculty_schedules_room ON faculty_schedules(room);

-- ============================================================================
-- SECTION 7: COURSE MANAGEMENT
-- ============================================================================

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    course_code VARCHAR(50) UNIQUE NOT NULL,
    course_name VARCHAR(255) NOT NULL,
    description TEXT,
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    credit_units INTEGER DEFAULT 3,
    lecture_hours INTEGER DEFAULT 3,
    lab_hours INTEGER DEFAULT 0,
    prerequisites TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Course offerings (per semester)
CREATE TABLE IF NOT EXISTS course_offerings (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    section VARCHAR(50) NOT NULL,
    faculty_id INTEGER REFERENCES faculty_members(id) ON DELETE SET NULL,
    semester VARCHAR(50) NOT NULL,
    academic_year VARCHAR(20) NOT NULL,
    max_students INTEGER DEFAULT 40,
    enrolled_students INTEGER DEFAULT 0,
    schedule_day VARCHAR(100),
    schedule_time VARCHAR(100),
    room VARCHAR(100),
    building VARCHAR(255),
    campus VARCHAR(255),
    status VARCHAR(50) DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for course_offerings
CREATE INDEX IF NOT EXISTS idx_course_offerings_course ON course_offerings(course_id);
CREATE INDEX IF NOT EXISTS idx_course_offerings_faculty ON course_offerings(faculty_id);
CREATE INDEX IF NOT EXISTS idx_course_offerings_semester ON course_offerings(semester, academic_year);

-- ============================================================================
-- SECTION 8: EMAIL NOTIFICATION LOGS
-- ============================================================================

-- Email logs table
CREATE TABLE IF NOT EXISTS email_logs (
    id SERIAL PRIMARY KEY,
    schedule_summary_id INTEGER REFERENCES schedule_summary(id) ON DELETE SET NULL,
    schedule_assignment_id INTEGER REFERENCES schedule_assignments(id) ON DELETE SET NULL,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    subject VARCHAR(500),
    status VARCHAR(50) DEFAULT 'pending',
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for email_logs
CREATE INDEX IF NOT EXISTS idx_email_logs_schedule ON email_logs(schedule_summary_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);

-- ============================================================================
-- SECTION 9: UPLOAD TRACKING & FILE MANAGEMENT
-- ============================================================================

-- File uploads tracking table
CREATE TABLE IF NOT EXISTS file_uploads (
    id SERIAL PRIMARY KEY,
    upload_group_id INTEGER NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255),
    file_size INTEGER,
    mime_type VARCHAR(100),
    row_count INTEGER DEFAULT 0,
    school_name VARCHAR(255),
    batch_name VARCHAR(255),
    uploaded_by UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'processed',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for file_uploads
CREATE INDEX IF NOT EXISTS idx_file_uploads_group ON file_uploads(upload_group_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_type ON file_uploads(file_type);
CREATE INDEX IF NOT EXISTS idx_file_uploads_uploaded_by ON file_uploads(uploaded_by);

-- ============================================================================
-- SECTION 10: ROOM AVAILABILITY & BOOKING
-- ============================================================================

-- Room availability table (for tracking room schedules)
CREATE TABLE IF NOT EXISTS room_availability (
    id SERIAL PRIMARY KEY,
    campus_id INTEGER REFERENCES campuses(id) ON DELETE CASCADE,
    campus VARCHAR(255) NOT NULL,
    building VARCHAR(255) NOT NULL,
    room VARCHAR(100) NOT NULL,
    day_of_week VARCHAR(20),
    specific_date DATE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT true,
    booked_by VARCHAR(255),
    booking_purpose VARCHAR(255),
    schedule_summary_id INTEGER REFERENCES schedule_summary(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for room_availability
CREATE INDEX IF NOT EXISTS idx_room_availability_campus ON room_availability(campus, building, room);
CREATE INDEX IF NOT EXISTS idx_room_availability_date ON room_availability(specific_date);
CREATE INDEX IF NOT EXISTS idx_room_availability_day ON room_availability(day_of_week);

-- ============================================================================
-- SECTION 11: AUDIT LOGS & ACTIVITY TRACKING
-- ============================================================================

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100),
    record_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- ============================================================================
-- SECTION 12: SETTINGS & CONFIGURATIONS
-- ============================================================================

-- System settings table
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

-- Insert default settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
    ('default_room_capacity', '30', 'integer', 'Default room capacity if not specified'),
    ('default_batch_duration', '180', 'integer', 'Default batch duration in minutes'),
    ('lunch_break_start', '12:00', 'time', 'Default lunch break start time'),
    ('lunch_break_end', '13:00', 'time', 'Default lunch break end time'),
    ('email_enabled', 'true', 'boolean', 'Enable/disable email notifications'),
    ('max_file_upload_size', '10485760', 'integer', 'Maximum file upload size in bytes (10MB)')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================================
-- SECTION 13: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE campuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own data
CREATE POLICY "Users can view own data" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Policy: Allow all authenticated users to read campuses (public data)
CREATE POLICY "Authenticated users can view campuses" ON campuses
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert campuses" ON campuses
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update campuses" ON campuses
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete campuses" ON campuses
    FOR DELETE TO authenticated USING (true);

-- Policy: Allow all authenticated users to manage participants
CREATE POLICY "Authenticated users can view participants" ON participants
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert participants" ON participants
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update participants" ON participants
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete participants" ON participants
    FOR DELETE TO authenticated USING (true);

-- Policy: Allow all authenticated users to manage schedules
CREATE POLICY "Authenticated users can view schedule_summary" ON schedule_summary
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert schedule_summary" ON schedule_summary
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update schedule_summary" ON schedule_summary
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete schedule_summary" ON schedule_summary
    FOR DELETE TO authenticated USING (true);

-- Policy: Allow all authenticated users to manage schedule_batches
CREATE POLICY "Authenticated users can view schedule_batches" ON schedule_batches
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert schedule_batches" ON schedule_batches
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update schedule_batches" ON schedule_batches
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete schedule_batches" ON schedule_batches
    FOR DELETE TO authenticated USING (true);

-- Policy: Allow all authenticated users to manage schedule_assignments
CREATE POLICY "Authenticated users can view schedule_assignments" ON schedule_assignments
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert schedule_assignments" ON schedule_assignments
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update schedule_assignments" ON schedule_assignments
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete schedule_assignments" ON schedule_assignments
    FOR DELETE TO authenticated USING (true);

-- Policy: Allow all authenticated users to manage class_schedules
CREATE POLICY "Authenticated users can view class_schedules" ON class_schedules
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert class_schedules" ON class_schedules
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update class_schedules" ON class_schedules
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete class_schedules" ON class_schedules
    FOR DELETE TO authenticated USING (true);

-- Policy: Allow all authenticated users to manage teacher_schedules
CREATE POLICY "Authenticated users can view teacher_schedules" ON teacher_schedules
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert teacher_schedules" ON teacher_schedules
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update teacher_schedules" ON teacher_schedules
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete teacher_schedules" ON teacher_schedules
    FOR DELETE TO authenticated USING (true);

-- Policy: Allow all authenticated users to view departments
CREATE POLICY "Authenticated users can view departments" ON departments
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage departments" ON departments
    FOR ALL TO authenticated USING (true);

-- Policy: Allow all authenticated users to manage faculty
CREATE POLICY "Authenticated users can view faculty_members" ON faculty_members
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage faculty_members" ON faculty_members
    FOR ALL TO authenticated USING (true);

-- Policy: Allow all authenticated users to manage courses
CREATE POLICY "Authenticated users can view courses" ON courses
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage courses" ON courses
    FOR ALL TO authenticated USING (true);

-- Policy: Allow all authenticated users to view email logs
CREATE POLICY "Authenticated users can view email_logs" ON email_logs
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert email_logs" ON email_logs
    FOR INSERT TO authenticated WITH CHECK (true);

-- Policy: Allow all authenticated users to view file uploads
CREATE POLICY "Authenticated users can view file_uploads" ON file_uploads
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert file_uploads" ON file_uploads
    FOR INSERT TO authenticated WITH CHECK (true);

-- Policy: Public settings readable by all, others by authenticated
CREATE POLICY "Public settings are viewable by all" ON system_settings
    FOR SELECT USING (is_public = true OR auth.role() = 'authenticated');

-- ============================================================================
-- SECTION 14: HELPER FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campuses_updated_at
    BEFORE UPDATE ON campuses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_participants_updated_at
    BEFORE UPDATE ON participants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_class_schedules_updated_at
    BEFORE UPDATE ON class_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teacher_schedules_updated_at
    BEFORE UPDATE ON teacher_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedule_summary_updated_at
    BEFORE UPDATE ON schedule_summary
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedule_batches_updated_at
    BEFORE UPDATE ON schedule_batches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedule_assignments_updated_at
    BEFORE UPDATE ON schedule_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_departments_updated_at
    BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_faculty_members_updated_at
    BEFORE UPDATE ON faculty_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_faculty_schedules_updated_at
    BEFORE UPDATE ON faculty_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_courses_updated_at
    BEFORE UPDATE ON courses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_course_offerings_updated_at
    BEFORE UPDATE ON course_offerings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_room_availability_updated_at
    BEFORE UPDATE ON room_availability
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at
    BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically determine first floor from room number
CREATE OR REPLACE FUNCTION set_is_first_floor()
RETURNS TRIGGER AS $$
BEGIN
    -- Extract first digit from room number
    IF NEW.room IS NOT NULL AND NEW.room ~ '^[0-9]' THEN
        NEW.is_first_floor := (substring(NEW.room from 1 for 1)::integer = 1);
        NEW.floor_number := substring(NEW.room from 1 for 1)::integer;
    ELSE
        NEW.is_first_floor := false;
        NEW.floor_number := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply first floor trigger to campuses
CREATE TRIGGER set_campuses_first_floor
    BEFORE INSERT OR UPDATE ON campuses
    FOR EACH ROW EXECUTE FUNCTION set_is_first_floor();

-- Function to get next upload group ID
CREATE OR REPLACE FUNCTION get_next_upload_group_id(table_name TEXT)
RETURNS INTEGER AS $$
DECLARE
    max_id INTEGER;
BEGIN
    IF table_name = 'campuses' THEN
        SELECT COALESCE(MAX(upload_group_id), 0) + 1 INTO max_id FROM campuses;
    ELSIF table_name = 'participants' THEN
        SELECT COALESCE(MAX(upload_group_id), 0) + 1 INTO max_id FROM participants;
    ELSIF table_name = 'class_schedules' THEN
        SELECT COALESCE(MAX(upload_group_id), 0) + 1 INTO max_id FROM class_schedules;
    ELSIF table_name = 'teacher_schedules' THEN
        SELECT COALESCE(MAX(upload_group_id), 0) + 1 INTO max_id FROM teacher_schedules;
    ELSE
        max_id := 1;
    END IF;
    RETURN max_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate schedule statistics
CREATE OR REPLACE FUNCTION calculate_schedule_stats(schedule_id INTEGER)
RETURNS TABLE (
    total_batches INTEGER,
    total_participants INTEGER,
    pwd_participants INTEGER,
    unique_rooms INTEGER,
    unique_buildings INTEGER,
    avg_room_utilization DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT sb.id)::INTEGER as total_batches,
        COALESCE(SUM(sb.participant_count), 0)::INTEGER as total_participants,
        COUNT(DISTINCT CASE WHEN sa.is_pwd THEN sa.id END)::INTEGER as pwd_participants,
        COUNT(DISTINCT sb.room)::INTEGER as unique_rooms,
        COUNT(DISTINCT sb.building)::INTEGER as unique_buildings,
        COALESCE(AVG(sb.utilization_rate), 0)::DECIMAL as avg_room_utilization
    FROM schedule_batches sb
    LEFT JOIN schedule_assignments sa ON sb.schedule_summary_id = sa.schedule_summary_id
    WHERE sb.schedule_summary_id = schedule_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 15: VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: Campus summary with room counts
CREATE OR REPLACE VIEW campus_summary AS
SELECT 
    upload_group_id,
    school_name,
    file_name,
    MIN(created_at) as created_at,
    COUNT(*) as total_rooms,
    SUM(capacity) as total_capacity,
    COUNT(DISTINCT campus) as campus_count,
    COUNT(DISTINCT building) as building_count
FROM campuses
GROUP BY upload_group_id, school_name, file_name;

-- View: Participant batch summary
CREATE OR REPLACE VIEW participant_batch_summary AS
SELECT 
    upload_group_id,
    batch_name,
    file_name,
    MIN(created_at) as created_at,
    COUNT(*) as total_participants,
    COUNT(CASE WHEN is_pwd THEN 1 END) as pwd_count,
    ROUND(COUNT(CASE WHEN is_pwd THEN 1 END)::DECIMAL / COUNT(*) * 100, 2) as pwd_percentage
FROM participants
GROUP BY upload_group_id, batch_name, file_name;

-- View: Schedule overview with all details
CREATE OR REPLACE VIEW schedule_overview AS
SELECT 
    ss.id,
    ss.event_name,
    ss.event_type::TEXT,
    ss.schedule_date,
    ss.start_time,
    ss.end_time,
    ss.end_date,
    ss.scheduled_count,
    ss.unscheduled_count,
    ss.execution_time,
    ss.school_name,
    ss.batch_name,
    ss.status,
    ss.created_at,
    COUNT(DISTINCT sb.id) as batch_count,
    COUNT(DISTINCT sb.room) as room_count,
    COUNT(DISTINCT sb.building) as building_count
FROM schedule_summary ss
LEFT JOIN schedule_batches sb ON ss.id = sb.schedule_summary_id
GROUP BY ss.id;

-- ============================================================================
-- SECTION 16: GRANTS FOR ANONYMOUS ACCESS (if needed)
-- ============================================================================

-- If you want to allow anonymous access to certain tables (for public data)
-- Uncomment the following lines:

-- GRANT SELECT ON campuses TO anon;
-- GRANT SELECT ON participants TO anon;
-- GRANT SELECT ON schedule_summary TO anon;
-- GRANT SELECT ON schedule_batches TO anon;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================

-- Print success message
DO $$
BEGIN
    RAISE NOTICE '✅ Database schema created successfully!';
    RAISE NOTICE '📊 Tables created: users, user_profiles, campuses, participants, class_schedules, teacher_schedules, schedule_summary, schedule_batches, schedule_assignments, departments, faculty_members, faculty_schedules, courses, course_offerings, email_logs, file_uploads, room_availability, audit_logs, system_settings';
    RAISE NOTICE '🔐 Row Level Security (RLS) enabled on all tables';
    RAISE NOTICE '⚡ Indexes created for optimal query performance';
    RAISE NOTICE '🔧 Helper functions and triggers configured';
END $$;
