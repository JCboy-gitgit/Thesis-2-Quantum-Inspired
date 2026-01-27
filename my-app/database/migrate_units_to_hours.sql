-- ============================================================================
-- DATABASE MIGRATION: Remove Units, Keep Hours Only
-- ============================================================================
-- This migration removes the deprecated unit columns (lec_units, lab_units, credit_units)
-- and adds total_hours column if it doesn't exist.
-- 
-- The system now uses only hours:
--   - lec_hours: Number of lecture hours per week
--   - lab_hours: Number of lab hours per week  
--   - total_hours: Computed as lec_hours + lab_hours
-- ============================================================================

-- Step 1: Add total_hours column if it doesn't exist
ALTER TABLE class_schedules 
ADD COLUMN IF NOT EXISTS total_hours INTEGER DEFAULT 0;

-- Step 2: Populate total_hours from existing lec_hours and lab_hours
UPDATE class_schedules 
SET total_hours = COALESCE(lec_hours, 0) + COALESCE(lab_hours, 0)
WHERE total_hours IS NULL OR total_hours = 0;

-- Step 3: Drop the deprecated unit columns (OPTIONAL - only run after verifying data)
-- IMPORTANT: Backup your data before running these commands!
-- Uncomment the lines below when you're ready to permanently remove unit columns

-- ALTER TABLE class_schedules DROP COLUMN IF EXISTS lec_units;
-- ALTER TABLE class_schedules DROP COLUMN IF EXISTS lab_units;
-- ALTER TABLE class_schedules DROP COLUMN IF EXISTS credit_units;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check current column structure
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'class_schedules' 
-- ORDER BY ordinal_position;

-- Verify total_hours is populated correctly
-- SELECT id, course_code, lec_hours, lab_hours, total_hours 
-- FROM class_schedules 
-- LIMIT 20;

-- Count records with total_hours
-- SELECT COUNT(*) as total_records,
--        COUNT(CASE WHEN total_hours > 0 THEN 1 END) as with_hours
-- FROM class_schedules;

-- ============================================================================
-- SUPABASE SQL EDITOR - Run this in your Supabase Dashboard
-- ============================================================================
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Paste Step 1 and Step 2 first
-- 3. Verify the data is correct with verification queries
-- 4. Then uncomment and run Step 3 to drop old columns
-- ============================================================================
