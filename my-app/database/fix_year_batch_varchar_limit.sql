-- ============================================================================
-- FIX: Increase year_batch column limit from varchar(20) to varchar(50)
-- ============================================================================
-- Issue: The year_batch column is limited to 20 characters but the frontend
-- allows up to 40 characters, causing insert failures.
-- 
-- Solution: Alter the column to allow varchar(50) (with some buffer)
-- ============================================================================

-- Check current column definition (run this to verify before applying)
-- SELECT column_name, data_type, character_maximum_length 
-- FROM information_schema.columns 
-- WHERE table_name = 'year_batches' AND column_name = 'year_batch';

-- Alter the year_batch column to allow longer names
ALTER TABLE public.year_batches 
ALTER COLUMN year_batch TYPE varchar(50);

-- Also update academic_year column if needed (should accommodate formats like "2024-2025 1st Semester")
ALTER TABLE public.year_batches 
ALTER COLUMN academic_year TYPE varchar(50);

-- Verify the change
-- SELECT column_name, data_type, character_maximum_length 
-- FROM information_schema.columns 
-- WHERE table_name = 'year_batches';
