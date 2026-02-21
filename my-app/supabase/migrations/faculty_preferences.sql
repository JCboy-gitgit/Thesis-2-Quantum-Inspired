-- 1. Drop the old table that had the wrong column type (Varchar)
DROP TABLE IF EXISTS public.faculty_time_preferences CASCADE;

-- 2. Create the table correctly using UUID to match faculty_profiles(id)
CREATE TABLE public.faculty_time_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    faculty_id UUID NOT NULL REFERENCES public.faculty_profiles(id) ON DELETE CASCADE,
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(faculty_id)
);

-- 3. Turn on Row Level Security
ALTER TABLE public.faculty_time_preferences ENABLE ROW LEVEL SECURITY;

-- 4. Allow everyone to read preferences
CREATE POLICY "preferences_read_all" ON public.faculty_time_preferences 
    FOR SELECT 
    USING (true);

-- 5. Allow users to update their own preferences
CREATE POLICY "preferences_update_own" ON public.faculty_time_preferences 
    FOR ALL 
    USING (auth.uid() IN (
        SELECT user_id FROM public.faculty_members WHERE user_id = auth.uid()
    ));

-- 6. Allow service role full access
CREATE POLICY "preferences_service_all" ON public.faculty_time_preferences 
    FOR ALL 
    USING (auth.uid() IS NULL); -- Simple way to allow the backend service role
