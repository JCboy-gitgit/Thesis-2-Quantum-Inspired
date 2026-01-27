-- Create teaching_loads table for faculty course assignments
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.teaching_loads (
    id BIGSERIAL PRIMARY KEY,
    faculty_id UUID NOT NULL,
    course_id BIGINT NOT NULL,
    academic_year TEXT NOT NULL,
    semester TEXT NOT NULL,
    section TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Foreign key constraints
    CONSTRAINT fk_faculty
        FOREIGN KEY (faculty_id)
        REFERENCES public.faculty_profiles(id)
        ON DELETE CASCADE,
    
    CONSTRAINT fk_course
        FOREIGN KEY (course_id)
        REFERENCES public.class_schedules(id)
        ON DELETE CASCADE,
    
    -- Ensure unique assignment per faculty-course-semester combination
    CONSTRAINT unique_teaching_assignment
        UNIQUE (faculty_id, course_id, academic_year, semester, section)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_teaching_loads_faculty_id 
    ON public.teaching_loads(faculty_id);

CREATE INDEX IF NOT EXISTS idx_teaching_loads_course_id 
    ON public.teaching_loads(course_id);

CREATE INDEX IF NOT EXISTS idx_teaching_loads_academic_year 
    ON public.teaching_loads(academic_year);

CREATE INDEX IF NOT EXISTS idx_teaching_loads_semester 
    ON public.teaching_loads(semester);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_teaching_loads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER teaching_loads_updated_at
    BEFORE UPDATE ON public.teaching_loads
    FOR EACH ROW
    EXECUTE FUNCTION update_teaching_loads_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE public.teaching_loads ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Policy: Allow authenticated users to read all teaching loads
CREATE POLICY "Allow authenticated users to read teaching loads"
    ON public.teaching_loads
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Allow admin users to insert teaching loads
CREATE POLICY "Allow admin users to insert teaching loads"
    ON public.teaching_loads
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy: Allow admin users to update teaching loads
CREATE POLICY "Allow admin users to update teaching loads"
    ON public.teaching_loads
    FOR UPDATE
    TO authenticated
    USING (true);

-- Policy: Allow admin users to delete teaching loads
CREATE POLICY "Allow admin users to delete teaching loads"
    ON public.teaching_loads
    FOR DELETE
    TO authenticated
    USING (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teaching_loads TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.teaching_loads_id_seq TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.teaching_loads IS 'Stores course assignments for faculty members';
COMMENT ON COLUMN public.teaching_loads.faculty_id IS 'References faculty_profiles.id';
COMMENT ON COLUMN public.teaching_loads.course_id IS 'References class_schedules.id';
COMMENT ON COLUMN public.teaching_loads.academic_year IS 'Format: YYYY-YYYY (e.g., 2025-2026)';
COMMENT ON COLUMN public.teaching_loads.semester IS 'First Semester, Second Semester, or Summer';
COMMENT ON COLUMN public.teaching_loads.section IS 'Optional section identifier (e.g., BSCS 1A)';
COMMENT ON COLUMN public.teaching_loads.notes IS 'Optional notes about the assignment';
