-- ========================================
-- DISABLE RLS (Development Mode)
-- Run this in Supabase SQL Editor to fix CRUD issues
-- ========================================
-- ⚠️ WARNING: This disables all security. 
-- Only use for development. Re-enable before production!
-- ========================================

-- Core Admin Tables
ALTER TABLE public.class_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.campuses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty_attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_allocations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.teaching_loads DISABLE ROW LEVEL SECURITY;

-- Alert & Notification Tables
ALTER TABLE public.system_alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_receipts DISABLE ROW LEVEL SECURITY;

-- User Management
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_change_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verification_tokens DISABLE ROW LEVEL SECURITY;

-- Room & Building Management
ALTER TABLE public.buildings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_features DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_images DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_availability DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_tags DISABLE ROW LEVEL SECURITY;

-- Schedule Management
ALTER TABLE public.schedule_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_generations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_conflicts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_summary DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_batches DISABLE ROW LEVEL SECURITY;

-- Faculty & Course Management
ALTER TABLE public.faculty_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty_availability DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty_default_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_offerings DISABLE ROW LEVEL SECURITY;

-- Section & Batch Management
ALTER TABLE public.sections DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_course_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.year_batches DISABLE ROW LEVEL SECURITY;

-- Teacher & Participant Data
ALTER TABLE public.teacher_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants DISABLE ROW LEVEL SECURITY;

-- College Management
ALTER TABLE public.bulsu_colleges DISABLE ROW LEVEL SECURITY;

-- Floor Plans
ALTER TABLE public.floor_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.floor_plan_elements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.floor_plan_versions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_floor_plans DISABLE ROW LEVEL SECURITY;

-- Subject Requirements
ALTER TABLE public.subject_room_requirements DISABLE ROW LEVEL SECURITY;

-- File Uploads & Archives
ALTER TABLE public.file_uploads DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.archived_items DISABLE ROW LEVEL SECURITY;

-- Audit & Logs
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs DISABLE ROW LEVEL SECURITY;

-- Time Management
ALTER TABLE public.time_slots DISABLE ROW LEVEL SECURITY;

-- System Settings
ALTER TABLE public.system_settings DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND rowsecurity = true
ORDER BY tablename;

-- If the query above returns rows, RLS is still enabled on those tables
-- Run the appropriate ALTER TABLE statement for each
