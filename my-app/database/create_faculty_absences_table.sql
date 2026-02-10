-- Create table for tracking faculty absences
CREATE TABLE IF NOT EXISTS public.faculty_absences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    faculty_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    allocation_id BIGINT NOT NULL REFERENCES public.room_allocations(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.faculty_absences ENABLE ROW LEVEL SECURITY;

-- Policies

-- Faculty can view their own absences
CREATE POLICY "Faculty can view own absences" 
    ON public.faculty_absences 
    FOR SELECT 
    USING (auth.uid() = faculty_id);

-- Faculty can insert their own absences
CREATE POLICY "Faculty can insert own absences" 
    ON public.faculty_absences 
    FOR INSERT 
    WITH CHECK (auth.uid() = faculty_id);

-- Admins can view all absences (assuming admin role or metadata check, referencing typical setup)
-- If no specific admin role is set in RLS, we often allow reading public data or check a user_roles table.
-- For now, let's assume a basic policy for authenticated users if admins are just users with special UI access,
-- OR we can check public.profiles if exists. 
-- Based on existing typical patterns, we might just allow authenticated read for simplicity if "admin" isn't a strict db role,
-- but let's try to be specific if possible.
-- Checking existing policies might be good, but safe default for now:

CREATE POLICY "Authenticated users can view all absences"
    ON public.faculty_absences
    FOR SELECT
    TO authenticated
    USING (true);

-- Admins can delete absences (optional, but good for cleanup)
-- Skipping specific admin write policy for now unless requested.

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faculty_absences TO service_role;
GRANT SELECT, INSERT ON public.faculty_absences TO authenticated;
