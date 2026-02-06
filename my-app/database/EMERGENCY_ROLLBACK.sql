-- ========================================
-- EMERGENCY ROLLBACK: Disable RLS Temporarily
-- ========================================
-- Use this ONLY if you're locked out after applying RLS
-- This will temporarily disable security for debugging
-- ========================================

-- Disable RLS on all tables
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
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' DISABLE ROW LEVEL SECURITY';
    END LOOP;
    RAISE NOTICE 'RLS disabled on all tables';
END $$;

-- Grant full access temporarily
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

SELECT 
    '⚠️ EMERGENCY MODE ACTIVE' as status,
    'RLS is DISABLED - all users have full access' as warning,
    'Run SECURE_RLS_POLICIES.sql to restore security' as next_step;
