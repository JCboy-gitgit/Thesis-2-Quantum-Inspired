-- =====================================================
-- SECTIONS & CLASS ASSIGNMENT SCHEMA
-- For Class & Section Assigning Feature
-- =====================================================

-- Table: year_batches
-- Stores academic year batches (e.g., 2024-2025, 2025-2026)
CREATE TABLE IF NOT EXISTS public.year_batches (
  id SERIAL PRIMARY KEY,
  year_batch VARCHAR(20) NOT NULL UNIQUE, -- e.g., "2024-2025"
  academic_year VARCHAR(20) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: sections
-- Stores class sections (e.g., BSCS 1A, BSIT 2B)
CREATE TABLE IF NOT EXISTS public.sections (
  id SERIAL PRIMARY KEY,
  section_name VARCHAR(50) NOT NULL, -- e.g., "BSCS 1A"
  year_batch_id INTEGER NOT NULL REFERENCES year_batches(id) ON DELETE CASCADE,
  year_level INTEGER NOT NULL DEFAULT 1 CHECK (year_level >= 1 AND year_level <= 4),
  degree_program VARCHAR(255) NOT NULL, -- e.g., "BS Computer Science"
  department VARCHAR(255), -- e.g., "Computer Science Department"
  college VARCHAR(255), -- e.g., "College of Science"
  student_count INTEGER DEFAULT 0 CHECK (student_count >= 0),
  max_capacity INTEGER DEFAULT 40 CHECK (max_capacity >= 1),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(section_name, year_batch_id)
);

-- Table: section_course_assignments
-- Links sections to courses (from class_schedules) - assigns all courses of a year level to a section
CREATE TABLE IF NOT EXISTS public.section_course_assignments (
  id SERIAL PRIMARY KEY,
  section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES class_schedules(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id),
  UNIQUE(section_id, course_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_year_batches_year ON public.year_batches(year_batch);
CREATE INDEX IF NOT EXISTS idx_sections_year_batch ON public.sections(year_batch_id);
CREATE INDEX IF NOT EXISTS idx_sections_year_level ON public.sections(year_level);
CREATE INDEX IF NOT EXISTS idx_sections_degree_program ON public.sections(degree_program);
CREATE INDEX IF NOT EXISTS idx_section_assignments_section ON public.section_course_assignments(section_id);
CREATE INDEX IF NOT EXISTS idx_section_assignments_course ON public.section_course_assignments(course_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_year_batches_updated_at
  BEFORE UPDATE ON year_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sections_updated_at
  BEFORE UPDATE ON sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================
-- INSERT INTO year_batches (year_batch, academic_year) VALUES
--   ('2024-2025', '2024-2025'),
--   ('2025-2026', '2025-2026');

-- INSERT INTO sections (section_name, year_batch_id, year_level, degree_program, department, college, max_capacity) VALUES
--   ('BSCS 1A', 1, 1, 'BS Computer Science', 'Computer Science', 'College of Science', 40),
--   ('BSCS 1B', 1, 1, 'BS Computer Science', 'Computer Science', 'College of Science', 40),
--   ('BSCS 2A', 1, 2, 'BS Computer Science', 'Computer Science', 'College of Science', 40);

-- =====================================================
-- RLS POLICIES (Row Level Security)
-- =====================================================
ALTER TABLE public.year_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_course_assignments ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Allow read for authenticated" ON public.year_batches
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow read for authenticated" ON public.sections
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow read for authenticated" ON public.section_course_assignments
  FOR SELECT TO authenticated USING (true);

-- Allow admins to insert/update/delete (you'll need to adjust based on your admin logic)
CREATE POLICY "Allow all for service role" ON public.year_batches
  FOR ALL TO service_role USING (true);

CREATE POLICY "Allow all for service role" ON public.sections
  FOR ALL TO service_role USING (true);

CREATE POLICY "Allow all for service role" ON public.section_course_assignments
  FOR ALL TO service_role USING (true);

-- Alternative: Allow all authenticated users to manage (simpler for development)
CREATE POLICY "Allow insert for authenticated" ON public.year_batches
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow update for authenticated" ON public.year_batches
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow delete for authenticated" ON public.year_batches
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow insert for authenticated" ON public.sections
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow update for authenticated" ON public.sections
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow delete for authenticated" ON public.sections
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow insert for authenticated" ON public.section_course_assignments
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow update for authenticated" ON public.section_course_assignments
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow delete for authenticated" ON public.section_course_assignments
  FOR DELETE TO authenticated USING (true);
