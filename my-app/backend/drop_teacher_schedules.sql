-- Remove legacy teacher_schedules table and related artifacts
-- Run in Supabase/Postgres console

-- Drop RLS policies and trigger (DROP TABLE ... CASCADE cleans these up, but left explicit for clarity)
DROP TRIGGER IF EXISTS update_teacher_schedules_updated_at ON teacher_schedules;
DROP POLICY IF EXISTS "Authenticated users full access" ON teacher_schedules;
DROP POLICY IF EXISTS "Authenticated users can view teacher_schedules" ON teacher_schedules;
DROP POLICY IF EXISTS "Authenticated users can insert teacher_schedules" ON teacher_schedules;
DROP POLICY IF EXISTS "Authenticated users can update teacher_schedules" ON teacher_schedules;
DROP POLICY IF EXISTS "Authenticated users can delete teacher_schedules" ON teacher_schedules;

-- Drop the table
DROP TABLE IF EXISTS teacher_schedules CASCADE;

-- Optional: remove any archived items that referenced teacher_schedules
-- DELETE FROM archived_items WHERE original_table = 'teacher_schedules';
