-- Add session tracking columns to users table for online presence and concurrent login prevention
-- Run this migration on your Supabase database

-- Add session_token column to track active sessions (prevents concurrent logins)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS session_token uuid;

-- Add is_online column to track real-time online status
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false;

-- Add last_heartbeat column for more accurate online tracking
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS last_heartbeat timestamp with time zone;

-- Create index for faster online faculty queries
CREATE INDEX IF NOT EXISTS idx_users_is_online ON public.users(is_online) WHERE is_online = true;
CREATE INDEX IF NOT EXISTS idx_users_last_heartbeat ON public.users(last_heartbeat DESC);

-- Comment on columns
COMMENT ON COLUMN public.users.session_token IS 'Unique token for current session - used to prevent concurrent logins for faculty';
COMMENT ON COLUMN public.users.is_online IS 'True if faculty is currently online (heartbeat within last 5 minutes)';
COMMENT ON COLUMN public.users.last_heartbeat IS 'Last heartbeat timestamp from faculty client';

-- Function to automatically mark users offline if no heartbeat for 5 minutes
-- This can be called by a cron job or Supabase scheduled function
CREATE OR REPLACE FUNCTION mark_inactive_users_offline()
RETURNS void AS $$
BEGIN
  UPDATE public.users
  SET is_online = false
  WHERE is_online = true
    AND (last_heartbeat IS NULL OR last_heartbeat < NOW() - INTERVAL '5 minutes');
END;
$$ LANGUAGE plpgsql;
