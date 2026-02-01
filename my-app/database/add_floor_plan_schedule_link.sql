-- Add linked_schedule_id column to floor_plans table for schedule integration
-- This allows floor plans to be connected to a specific generated schedule for live room availability

ALTER TABLE floor_plans
ADD COLUMN IF NOT EXISTS linked_schedule_id INTEGER REFERENCES generated_schedules(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_floor_plans_linked_schedule ON floor_plans(linked_schedule_id);

-- Comment for documentation
COMMENT ON COLUMN floor_plans.linked_schedule_id IS 'Links the floor plan to a generated schedule for showing live room availability';

-- Optionally link existing floor plans to the most recent schedule (if any exist)
-- UPDATE floor_plans fp
-- SET linked_schedule_id = (
--   SELECT id FROM generated_schedules 
--   ORDER BY created_at DESC 
--   LIMIT 1
-- )
-- WHERE fp.linked_schedule_id IS NULL;
