-- BulSU QSA: Add is_online column to room_allocations table
-- This supports the Online Day feature where classes on designated days don't require physical rooms

-- Add is_online column to room_allocations if it doesn't exist
ALTER TABLE room_allocations 
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN room_allocations.is_online IS 'BulSU QSA: True if this class is conducted online/asynchronously (no physical room required)';

-- Create an index for filtering online classes
CREATE INDEX IF NOT EXISTS idx_room_allocations_is_online 
ON room_allocations(is_online) 
WHERE is_online = TRUE;

-- Optional: Add online_days array to generated_schedules for reference
ALTER TABLE generated_schedules 
ADD COLUMN IF NOT EXISTS online_days TEXT[] DEFAULT '{}';

COMMENT ON COLUMN generated_schedules.online_days IS 'BulSU QSA: Days designated as online/asynchronous (e.g., {"Saturday", "Sunday"})';
