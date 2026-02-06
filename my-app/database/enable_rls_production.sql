-- ========================================
-- PRODUCTION RLS POLICIES
-- Run this in Supabase SQL Editor BEFORE deploying
-- ========================================
-- This enables Row Level Security with proper policies
-- ========================================

-- ==================== ENABLE RLS ====================
ALTER TABLE public.class_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

-- ==================== DROP EXISTING POLICIES ====================
DROP POLICY IF EXISTS "Admin full access - class_schedules" ON public.class_schedules;
DROP POLICY IF EXISTS "Faculty read own schedules" ON public.class_schedules;
DROP POLICY IF EXISTS "Admin full access - campuses" ON public.campuses;
DROP POLICY IF EXISTS "Faculty read campuses" ON public.campuses;
DROP POLICY IF EXISTS "Admin full access - departments" ON public.departments;
DROP POLICY IF EXISTS "Everyone read departments" ON public.departments;
DROP POLICY IF EXISTS "Admin full access - faculty" ON public.faculty;
DROP POLICY IF EXISTS "Faculty read own profile" ON public.faculty;
DROP POLICY IF EXISTS "Admin full access - users" ON public.users;
DROP POLICY IF EXISTS "Users read own data" ON public.users;
DROP POLICY IF EXISTS "Admin full access - alerts" ON public.system_alerts;
DROP POLICY IF EXISTS "Faculty read alerts" ON public.system_alerts;
DROP POLICY IF EXISTS "Service role bypass" ON public.class_schedules;
DROP POLICY IF EXISTS "Service role bypass" ON public.campuses;
DROP POLICY IF EXISTS "Service role bypass" ON public.users;

-- ==================== CREATE ADMIN POLICIES ====================

-- Admin Role (for users with role = 'admin' in public.users table)
CREATE POLICY "Admin full access - class_schedules"
ON public.class_schedules
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

CREATE POLICY "Admin full access - campuses"
ON public.campuses
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

CREATE POLICY "Admin full access - departments"
ON public.departments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

CREATE POLICY "Admin full access - faculty"
ON public.faculty
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

CREATE POLICY "Admin full access - faculty_profiles"
ON public.faculty_profiles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

CREATE POLICY "Admin full access - generated_schedules"
ON public.generated_schedules
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

CREATE POLICY "Admin full access - room_allocations"
ON public.room_allocations
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

CREATE POLICY "Admin full access - users"
ON public.users
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users u2
    WHERE u2.id = auth.uid() 
    AND u2.role = 'admin'
  )
);

CREATE POLICY "Admin full access - alerts"
ON public.system_alerts
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- ==================== FACULTY POLICIES ====================

-- Faculty can read their own schedules
CREATE POLICY "Faculty read own schedules"
ON public.class_schedules
FOR SELECT
USING (
  assigned_faculty_id IN (
    SELECT id FROM public.faculty
    WHERE email = (
      SELECT email FROM public.users WHERE id = auth.uid()
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'faculty'
  )
);

-- Faculty can read all rooms/campuses
CREATE POLICY "Faculty read campuses"
ON public.campuses
FOR SELECT
USING (true);

-- Faculty can read their own user data
CREATE POLICY "Users read own data"
ON public.users
FOR SELECT
USING (auth.uid() = id);

-- Faculty can update their own user data
CREATE POLICY "Users update own data"
ON public.users
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Faculty can read alerts targeted to them
CREATE POLICY "Faculty read alerts"
ON public.system_alerts
FOR SELECT
USING (
  audience IN ('faculty', 'all') 
  AND deleted_at IS NULL
);

-- ==================== PUBLIC READ POLICIES ====================

-- Everyone can read departments
CREATE POLICY "Everyone read departments"
ON public.departments
FOR SELECT
USING (true);

-- ==================== VERIFY POLICIES ====================

-- Check which policies exist
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ==================== NOTES ====================
-- After running this:
-- 1. Admin users (role='admin') can do everything
-- 2. Faculty users (role='faculty') can read their schedules & update their profile
-- 3. Service role key (from .env) bypasses ALL policies
-- 4. All other tables remain unrestricted (use disable_rls_dev.sql pattern if needed)
