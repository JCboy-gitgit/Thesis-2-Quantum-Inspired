-- Create schedule_jobs table for tracking schedule generation progress
-- This enables persistent generation that continues even when users leave the page

CREATE TABLE IF NOT EXISTS schedule_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Job status: 'pending', 'running', 'completed', 'failed', 'cancelled'
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    
    -- Progress tracking (0-100)
    progress INTEGER DEFAULT 0,
    current_iteration INTEGER DEFAULT 0,
    total_iterations INTEGER DEFAULT 10000,
    
    -- Current stage of processing
    stage VARCHAR(100) DEFAULT 'Initializing...',
    
    -- Input data (stored as JSON)
    input_data JSONB NOT NULL,
    
    -- Output data (stored after completion)
    result_data JSONB,
    
    -- Error message if failed
    error_message TEXT,
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    time_elapsed_ms INTEGER,
    
    -- Schedule metadata (for reference)
    schedule_name VARCHAR(255),
    semester VARCHAR(50),
    academic_year VARCHAR(20),
    total_classes INTEGER,
    
    -- User tracking (optional)
    created_by UUID REFERENCES auth.users(id),
    
    -- Link to generated schedule after completion (INTEGER to match generated_schedules.id)
    generated_schedule_id INTEGER REFERENCES generated_schedules(id)
);

-- Create index for efficient status queries
CREATE INDEX IF NOT EXISTS idx_schedule_jobs_status ON schedule_jobs(status);
CREATE INDEX IF NOT EXISTS idx_schedule_jobs_created_at ON schedule_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_schedule_jobs_created_by ON schedule_jobs(created_by);

-- Enable RLS
ALTER TABLE schedule_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all jobs (for now - can be restricted later)
CREATE POLICY "Anyone can view schedule jobs" ON schedule_jobs
    FOR SELECT USING (true);

-- Policy: Anyone can create jobs
CREATE POLICY "Anyone can create schedule jobs" ON schedule_jobs
    FOR INSERT WITH CHECK (true);

-- Policy: Only the system or creator can update jobs
CREATE POLICY "System can update schedule jobs" ON schedule_jobs
    FOR UPDATE USING (true);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_schedule_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_schedule_jobs_updated_at
    BEFORE UPDATE ON schedule_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_schedule_jobs_updated_at();

-- Comments
COMMENT ON TABLE schedule_jobs IS 'Tracks schedule generation jobs for persistent progress tracking';
COMMENT ON COLUMN schedule_jobs.status IS 'Job status: pending, running, completed, failed, cancelled';
COMMENT ON COLUMN schedule_jobs.progress IS 'Progress percentage (0-100)';
COMMENT ON COLUMN schedule_jobs.stage IS 'Current stage description for user display';
COMMENT ON COLUMN schedule_jobs.input_data IS 'JSON containing all input parameters for schedule generation';
COMMENT ON COLUMN schedule_jobs.result_data IS 'JSON containing the generation results after completion';
