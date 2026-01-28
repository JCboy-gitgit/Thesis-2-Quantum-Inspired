-- ============================================================================
-- PROFILE CHANGE REQUESTS TABLE
-- ============================================================================
-- This table stores faculty profile change requests that need admin approval
-- ============================================================================

CREATE TABLE IF NOT EXISTS profile_change_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    field_name VARCHAR(100) NOT NULL,  -- 'full_name', 'department', etc.
    current_value TEXT,
    requested_value TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes TEXT,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profile_change_requests_status ON profile_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_profile_change_requests_user_id ON profile_change_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_change_requests_email ON profile_change_requests(email);

-- Enable Row Level Security
ALTER TABLE profile_change_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own requests
CREATE POLICY "Users can view own requests" ON profile_change_requests
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own requests
CREATE POLICY "Users can create own requests" ON profile_change_requests
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Admin can view all requests (you may need to adjust based on your admin check)
-- For service role access, RLS is bypassed automatically

-- Grant permissions
GRANT ALL ON profile_change_requests TO authenticated;
GRANT ALL ON profile_change_requests TO service_role;
