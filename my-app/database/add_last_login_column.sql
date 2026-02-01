-- Add last_login column to users table if it doesn't exist
-- This allows tracking when faculty members log in

-- Add the column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

-- Create an index for faster queries on recently logged in users
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login DESC);

-- Comment explaining the column
COMMENT ON COLUMN users.last_login IS 'Timestamp of the user last login, used to track online faculty';
