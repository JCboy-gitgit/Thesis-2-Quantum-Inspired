-- ============================================================================
-- USER PROFILES TABLE FIX FOR FACULTY APPROVAL SYSTEM
-- ============================================================================
-- This script ensures user_profiles table has correct constraints and indexes
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- First, check if user_profiles table exists and has the correct structure
-- If it doesn't have a unique constraint on user_id, add it

-- Check current state
SELECT 
    conname as constraint_name, 
    contype as constraint_type,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'public.user_profiles'::regclass;

-- Drop existing constraint if it exists (to recreate)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_profiles_user_id_key' 
        AND conrelid = 'public.user_profiles'::regclass
    ) THEN
        ALTER TABLE public.user_profiles DROP CONSTRAINT user_profiles_user_id_key CASCADE;
        RAISE NOTICE 'Dropped existing user_profiles_user_id_key constraint';
    END IF;
END $$;

-- Add unique constraint on user_id to ensure one profile per user
ALTER TABLE public.user_profiles 
ADD CONSTRAINT user_profiles_user_id_key UNIQUE (user_id);

RAISE NOTICE 'Added unique constraint on user_id';

-- Add missing foreign key if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_profiles_user_id_fkey'
    ) THEN
        ALTER TABLE public.user_profiles 
        ADD CONSTRAINT user_profiles_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_position ON public.user_profiles(position);

-- Ensure updated_at trigger exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VERIFICATION QUERIES - Run these to check the setup
-- ============================================================================

-- 1. Check if unique constraint exists
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'public.user_profiles'::regclass 
AND conname = 'user_profiles_user_id_key';

-- 2. Check current user_profiles records
SELECT 
    up.user_id,
    u.email,
    u.full_name,
    u.is_active,
    up.position,
    up.updated_at
FROM public.user_profiles up
LEFT JOIN public.users u ON u.id = up.user_id
ORDER BY up.updated_at DESC;

-- 3. Check users without profiles
SELECT 
    u.id,
    u.email,
    u.full_name,
    u.is_active,
    u.created_at
FROM public.users u
LEFT JOIN public.user_profiles up ON up.user_id = u.id
WHERE up.user_id IS NULL;

-- ============================================================================
-- HELPER QUERY: View all faculty registration statuses
-- ============================================================================
SELECT 
    u.id,
    u.email,
    u.full_name,
    u.is_active,
    up.position,
    CASE 
        WHEN u.is_active = true THEN 'approved'
        WHEN up.position = 'REJECTED' THEN 'rejected'
        ELSE 'pending'
    END as status,
    u.created_at,
    up.updated_at as status_updated_at
FROM public.users u
LEFT JOIN public.user_profiles up ON up.user_id = u.id
WHERE u.email != 'admin123@ms.bulsu.edu.ph'
ORDER BY u.created_at DESC;

-- ============================================================================
-- CLEANUP: If you have duplicate entries (optional - run with caution)
-- ============================================================================
-- Only run this if you find duplicate user_id entries in user_profiles

-- DELETE FROM public.user_profiles
-- WHERE id NOT IN (
--     SELECT MIN(id)
--     FROM public.user_profiles
--     GROUP BY user_id
-- );

-- ============================================================================
-- MANUAL STATUS UPDATE (if needed)
-- ============================================================================
-- To manually mark a user as rejected:
-- UPDATE public.users SET is_active = false WHERE email = 'user@example.com';
-- INSERT INTO public.user_profiles (user_id, position, updated_at)
-- SELECT id, 'REJECTED', NOW() FROM public.users WHERE email = 'user@example.com'
-- ON CONFLICT (user_id) DO UPDATE SET position = 'REJECTED', updated_at = NOW();

-- To manually approve a user:
-- UPDATE public.users SET is_active = true WHERE email = 'user@example.com';
-- INSERT INTO public.user_profiles (user_id, position, updated_at)
-- SELECT id, 'APPROVED', NOW() FROM public.users WHERE email = 'user@example.com'
-- ON CONFLICT (user_id) DO UPDATE SET position = 'APPROVED', updated_at = NOW();
