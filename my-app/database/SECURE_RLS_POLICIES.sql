-- ========================================
-- SECURE RLS POLICIES FOR QIA SCHEDULER
-- ========================================
-- This script provides secure Row Level Security while allowing:
-- 1. Admin (admin123@ms.bulsu.edu.ph) - FULL ACCESS to everything
-- 2. Faculty accounts - LIMITED ACCESS to their own data and UI features
-- 3. Service role key - FULL ACCESS (for backend operations)
-- ========================================
-- Run this in Supabase SQL Editor
-- ========================================

-- ==================== STEP 1: CLEAN UP ALL EXISTING POLICIES ====================
-- Drop ALL existing policies to start fresh

DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    ) 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
    RAISE NOTICE 'All existing policies dropped';
END $$;

-- ==================== STEP 2: ENABLE RLS ON ALL TABLES ====================
-- This enables security - tables without policies will deny all access

DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    ) 
    LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY';
    END LOOP;
    RAISE NOTICE 'RLS enabled on all tables';
END $$;

-- ==================== STEP 3: CREATE HELPER FUNCTIONS ====================
-- All functions use email-based lookup to avoid UUID/integer type mismatches

-- Get current user's email from auth
CREATE OR REPLACE FUNCTION public.auth_email()
RETURNS TEXT AS $$
BEGIN
    RETURN (SELECT email FROM auth.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user is admin (by email)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_email TEXT;
BEGIN
    user_email := public.auth_email();
    
    -- Check hardcoded admin email
    IF user_email = 'admin123@ms.bulsu.edu.ph' THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user has admin role in public.users (by email)
    RETURN EXISTS (
        SELECT 1 FROM public.users 
        WHERE email = user_email AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user is faculty (by email)
CREATE OR REPLACE FUNCTION public.is_faculty()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users 
        WHERE email = public.auth_email() AND role = 'faculty'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user is authenticated
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN auth.uid() IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ==================== STEP 4: UNIVERSAL ADMIN POLICIES ====================
-- Create admin policies for ALL tables (admin gets full access everywhere)

DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    ) 
    LOOP
        EXECUTE format(
            'CREATE POLICY "admin_full_%s" ON public.%I FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())',
            r.tablename, r.tablename
        );
    END LOOP;
    RAISE NOTICE 'Admin policies created for all tables';
END $$;

-- ==================== STEP 5: SERVICE ROLE BYPASS ====================
-- Ensure service role can always access everything (for backend API)

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

GRANT ALL ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ==================== STEP 6: FACULTY READ POLICIES ====================
-- Faculty can READ these tables (no ID comparisons needed)

-- Users table - faculty reads their own row by email
CREATE POLICY "faculty_read_users" ON public.users
FOR SELECT USING (email = public.auth_email());

CREATE POLICY "faculty_update_users" ON public.users
FOR UPDATE USING (email = public.auth_email())
WITH CHECK (email = public.auth_email());

-- Class schedules - all faculty can read
CREATE POLICY "faculty_read_class_schedules" ON public.class_schedules
FOR SELECT USING (public.is_faculty());

-- Faculty table - all faculty can read
CREATE POLICY "faculty_read_faculty" ON public.faculty
FOR SELECT USING (public.is_faculty());

-- Faculty can update their own faculty record by email
CREATE POLICY "faculty_update_faculty" ON public.faculty
FOR UPDATE USING (public.is_faculty() AND email = public.auth_email())
WITH CHECK (public.is_faculty() AND email = public.auth_email());

-- Faculty profiles
CREATE POLICY "faculty_read_faculty_profiles" ON public.faculty_profiles
FOR SELECT USING (public.is_faculty());

CREATE POLICY "faculty_update_faculty_profiles" ON public.faculty_profiles
FOR UPDATE USING (public.is_faculty() AND email = public.auth_email())
WITH CHECK (public.is_faculty() AND email = public.auth_email());

-- Rooms - faculty can read
CREATE POLICY "faculty_read_rooms" ON public.rooms
FOR SELECT USING (public.is_faculty());

-- Buildings - faculty can read  
CREATE POLICY "faculty_read_buildings" ON public.buildings
FOR SELECT USING (public.is_faculty());

-- Courses - faculty can read
CREATE POLICY "faculty_read_courses" ON public.courses
FOR SELECT USING (public.is_faculty());

-- Room allocations - faculty can read
CREATE POLICY "faculty_read_room_allocations" ON public.room_allocations
FOR SELECT USING (public.is_faculty());

-- Schedule generations - faculty can read
CREATE POLICY "faculty_read_schedule_generations" ON public.schedule_generations
FOR SELECT USING (public.is_faculty());

-- Floor plans - faculty can read
CREATE POLICY "faculty_read_floor_plans" ON public.floor_plans
FOR SELECT USING (public.is_faculty());

-- Sections - faculty can read
CREATE POLICY "faculty_read_sections" ON public.sections
FOR SELECT USING (public.is_faculty());

-- Faculty availability - faculty can read
CREATE POLICY "faculty_read_faculty_availability" ON public.faculty_availability
FOR SELECT USING (public.is_faculty());

-- Teaching loads - faculty can read
CREATE POLICY "faculty_read_teaching_loads" ON public.teaching_loads
FOR SELECT USING (public.is_faculty());

-- System alerts - faculty can read alerts for them
CREATE POLICY "faculty_read_system_alerts" ON public.system_alerts
FOR SELECT USING (public.is_faculty());

-- Profile change requests - faculty can read their own (by email lookup)
CREATE POLICY "faculty_read_profile_change_requests" ON public.profile_change_requests
FOR SELECT USING (
    public.is_faculty() 
    AND EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.email = public.auth_email() 
        AND u.id::TEXT = profile_change_requests.user_id::TEXT
    )
);

CREATE POLICY "faculty_insert_profile_change_requests" ON public.profile_change_requests
FOR INSERT WITH CHECK (public.is_faculty());

-- ==================== STEP 7: PUBLIC READ POLICIES ====================
-- Everyone can read these tables (including anonymous users)

CREATE POLICY "public_read_departments" ON public.departments
FOR SELECT USING (true);

CREATE POLICY "public_read_time_slots" ON public.time_slots
FOR SELECT USING (true);

CREATE POLICY "public_read_campuses" ON public.campuses
FOR SELECT USING (true);

CREATE POLICY "public_read_bulsu_colleges" ON public.bulsu_colleges
FOR SELECT USING (true);

-- ==================== STEP 8: GRANT PERMISSIONS ====================

-- Authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Specific write permissions for authenticated
GRANT UPDATE ON public.users TO authenticated;
GRANT UPDATE ON public.faculty TO authenticated;
GRANT UPDATE ON public.faculty_profiles TO authenticated;
GRANT UPDATE ON public.faculty_availability TO authenticated;
GRANT UPDATE ON public.class_schedules TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.profile_change_requests TO authenticated;

-- Anonymous users (minimal access)
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON public.departments TO anon;
GRANT SELECT ON public.campuses TO anon;
GRANT SELECT ON public.bulsu_colleges TO anon;
GRANT SELECT ON public.time_slots TO anon;

-- ==================== VERIFICATION ====================

SELECT 
    tablename,
    CASE WHEN rowsecurity THEN '✅ Secure' ELSE '❌ EXPOSED' END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY policy_count DESC;

SELECT '🔒 RLS SETUP COMPLETE!' as status;
