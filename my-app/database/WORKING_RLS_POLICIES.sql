-- ========================================
-- WORKING RLS POLICIES FOR QIA SCHEDULER
-- ========================================
-- This provides SECURE Row Level Security that works with your CRUD operations
-- 
-- KEY INSIGHT: Your app uses the anon key from the browser, but users are
-- authenticated via Supabase Auth. RLS policies need to check auth.uid()
-- to allow authenticated users to perform CRUD.
--
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard
-- ========================================

-- ==================== STEP 1: CLEAN UP ====================
-- Drop all existing policies first

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
    RAISE NOTICE '✅ All existing policies dropped';
END $$;

-- ==================== STEP 2: ENABLE RLS ====================

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
    RAISE NOTICE '✅ RLS enabled on all tables';
END $$;

-- ==================== STEP 3: HELPER FUNCTIONS ====================

-- Get current user's email
CREATE OR REPLACE FUNCTION public.auth_email()
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(
        (SELECT email FROM auth.users WHERE id = auth.uid()),
        ''
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_email TEXT;
BEGIN
    -- If no user is logged in, not admin
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;
    
    user_email := public.auth_email();
    
    -- Hardcoded admin email
    IF user_email = 'admin123@ms.bulsu.edu.ph' THEN
        RETURN TRUE;
    END IF;
    
    -- Check users table for admin role
    RETURN EXISTS (
        SELECT 1 FROM public.users 
        WHERE email = user_email AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user is authenticated
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN auth.uid() IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ==================== STEP 4: GRANT SERVICE ROLE BYPASS ====================
-- The service_role key ALWAYS bypasses RLS, but let's ensure proper grants

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ==================== STEP 5: CREATE POLICIES ====================
-- Strategy: Authenticated users get FULL access (this is an admin app)
-- Anonymous users get NO access (they can't even read)

-- Create a policy for EACH table that allows authenticated users full access
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
        -- Policy for authenticated users: FULL ACCESS
        EXECUTE format(
            'CREATE POLICY "auth_full_access_%s" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
            r.tablename, r.tablename
        );
        
        RAISE NOTICE 'Created policy for table: %', r.tablename;
    END LOOP;
    RAISE NOTICE '✅ Authenticated user policies created for all tables';
END $$;

-- ==================== STEP 6: VERIFY ====================

-- Show all policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname
LIMIT 20;

-- Show RLS status
SELECT 
    schemaname, 
    tablename, 
    CASE WHEN rowsecurity THEN '✅ RLS ENABLED' ELSE '❌ RLS DISABLED' END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename
LIMIT 20;

-- ==================== SUCCESS MESSAGE ====================
SELECT 
    '✅ RLS SETUP COMPLETE!' as status,
    'Authenticated users now have full CRUD access' as message,
    'Anonymous users are blocked' as security,
    'Service role key bypasses all RLS' as backend;
