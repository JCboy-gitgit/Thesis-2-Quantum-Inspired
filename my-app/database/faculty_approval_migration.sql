-- ============================================================================
-- MIGRATION: Add status column to users table for faculty approval workflow
-- ============================================================================
-- Run this in your Supabase SQL Editor to add the faculty approval feature
-- ============================================================================

-- Add status column to users table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'status'
    ) THEN
        ALTER TABLE users ADD COLUMN status VARCHAR(50) DEFAULT 'pending';
    END IF;
END $$;

-- Create enum for status if you prefer strict typing
-- CREATE TYPE user_status AS ENUM ('pending', 'approved', 'rejected', 'unconfirmed');

-- Update existing users to 'approved' status (they were already in the system)
UPDATE users SET status = 'approved' WHERE status IS NULL;

-- Set admin user to always be approved
UPDATE users 
SET status = 'approved', is_active = true, role = 'admin'
WHERE email = 'admin123@ms.bulsu.edu.ph';

-- Create index for faster status queries
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ============================================================================
-- RLS Policies for faculty registration approval
-- ============================================================================

-- Allow admins to read all users
CREATE POLICY IF NOT EXISTS "Admins can view all users"
ON users FOR SELECT
USING (
    auth.uid() IN (
        SELECT id FROM users WHERE role = 'admin'
    )
);

-- Allow admins to update user status
CREATE POLICY IF NOT EXISTS "Admins can update user status"
ON users FOR UPDATE
USING (
    auth.uid() IN (
        SELECT id FROM users WHERE role = 'admin'
    )
);

-- Allow users to read their own data
CREATE POLICY IF NOT EXISTS "Users can view own data"
ON users FOR SELECT
USING (auth.uid() = id);

-- ============================================================================
-- Trigger to auto-create user record on signup
-- ============================================================================

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user_signup()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, status, is_active, created_at)
    VALUES (
        NEW.id,
        NEW.email,
        CASE 
            WHEN NEW.email = 'admin123@ms.bulsu.edu.ph' THEN 'approved'
            ELSE 'pending'
        END,
        CASE 
            WHEN NEW.email = 'admin123@ms.bulsu.edu.ph' THEN true
            ELSE false
        END,
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user signups
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user_signup();

-- ============================================================================
-- Done! Faculty approval system is ready.
-- ============================================================================
