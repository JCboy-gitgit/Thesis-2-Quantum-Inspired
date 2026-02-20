-- ============================================================================
-- DATABASE MIGRATION: Add Number of Sections to Teaching Loads
-- ============================================================================
-- This migration adds a num_sections column to the teaching_loads table.
-- This allows tracking how many sections of a specific course a faculty 
-- member is handling in a single assignment entry.
-- ============================================================================

-- 1. Add num_sections column
ALTER TABLE public.teaching_loads 
ADD COLUMN IF NOT EXISTS num_sections INTEGER DEFAULT 1;

-- 2. Add helpful comment
COMMENT ON COLUMN public.teaching_loads.num_sections IS 'The number of sections of this course handled by the faculty member';

-- 3. Verify the change
-- SELECT id, faculty_id, course_id, num_sections FROM public.teaching_loads LIMIT 5;
