-- Password Reset Tokens Table
-- This table stores tokens for custom password reset functionality via Gmail

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure token is unique and indexed for fast lookups
  CONSTRAINT unique_token UNIQUE (token)
);

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON password_reset_tokens(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);

-- Add RLS policies
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role can manage tokens (no user access)
CREATE POLICY "Service role can manage password reset tokens" ON password_reset_tokens
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to clean up expired tokens (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_password_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM password_reset_tokens 
  WHERE expires_at < NOW() OR used_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Comment
COMMENT ON TABLE password_reset_tokens IS 'Stores password reset tokens for custom Gmail-based password reset flow';
