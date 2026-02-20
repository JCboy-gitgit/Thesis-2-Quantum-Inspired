-- ============================================================================
-- DATABASE MIGRATION: Add Individual Faculty Load Limits
-- ============================================================================
-- This migration adds per-faculty scheduling constraints to faculty_profiles.
-- These limits allow the scheduler to strictly enforce different rules for 
-- each individual teacher regardless of their type, or as overrides.
-- ============================================================================

-- 1. Add columns to faculty_profiles table
ALTER TABLE public.faculty_profiles 
ADD COLUMN IF NOT EXISTS max_hours_per_week INTEGER DEFAULT 24,
ADD COLUMN IF NOT EXISTS max_hours_per_day INTEGER DEFAULT 8,
ADD COLUMN IF NOT EXISTS max_sections_total INTEGER DEFAULT 6,
ADD COLUMN IF NOT EXISTS max_sections_per_course INTEGER DEFAULT 2;

-- 2. Add helpful comments for documentation
COMMENT ON COLUMN public.faculty_profiles.max_hours_per_week IS 'Maximum teaching hours allowed per week for this faculty';
COMMENT ON COLUMN public.faculty_profiles.max_hours_per_day IS 'Maximum teaching hours allowed in a single day';
COMMENT ON COLUMN public.faculty_profiles.max_sections_total IS 'Total number of class sections this faculty can handle';
COMMENT ON COLUMN public.faculty_profiles.max_sections_per_course IS 'Maximum number of sections of the same course assigned to this faculty';

-- 3. Initial population based on BulSU employment standards
-- This sets defaults while allowing manual overrides later
UPDATE public.faculty_profiles 
SET 
  max_hours_per_week = CASE 
    WHEN LOWER(employment_type) = 'full-time' THEN 24 
    WHEN LOWER(employment_type) = 'part-time' THEN 12
    WHEN LOWER(employment_type) = 'vsl' THEN 15
    WHEN LOWER(employment_type) = 'cos' THEN 18
    ELSE 24
  END,
  max_hours_per_day = CASE 
    WHEN LOWER(employment_type) = 'part-time' THEN 4
    ELSE 6
  END
WHERE max_hours_per_week = 24 AND max_hours_per_day = 8; -- Only update if still at defaults

-- 4. Verify the changes
-- SELECT id, full_name, employment_type, max_hours_per_week, max_hours_per_day 
-- FROM public.faculty_profiles 
-- LIMIT 10;
