CREATE TABLE IF NOT EXISTS public.faculty_time_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  faculty_id VARCHAR NOT NULL REFERENCES public.faculty_profiles(faculty_id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(faculty_id)
);
