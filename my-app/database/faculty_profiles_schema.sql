-- Faculty Profiles Table Schema
-- This table stores faculty member profiles imported from CSV or added manually

CREATE TABLE IF NOT EXISTS faculty_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    faculty_id VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    position VARCHAR(100) NOT NULL DEFAULT 'Faculty',
    role VARCHAR(50) NOT NULL DEFAULT 'faculty' CHECK (role IN ('administrator', 'department_head', 'program_chair', 'coordinator', 'faculty', 'staff')),
    department VARCHAR(255),
    college VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    office_location VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    profile_image TEXT,
    bio TEXT,
    specialization TEXT,
    education TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_faculty_profiles_college ON faculty_profiles(college);
CREATE INDEX IF NOT EXISTS idx_faculty_profiles_department ON faculty_profiles(department);
CREATE INDEX IF NOT EXISTS idx_faculty_profiles_role ON faculty_profiles(role);
CREATE INDEX IF NOT EXISTS idx_faculty_profiles_active ON faculty_profiles(is_active);

-- Enable Row Level Security
ALTER TABLE faculty_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Public read access for active faculty
CREATE POLICY "Anyone can view active faculty profiles" ON faculty_profiles
    FOR SELECT
    USING (is_active = true);

-- Policy: Admin can manage all faculty profiles
CREATE POLICY "Admins can manage faculty profiles" ON faculty_profiles
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.email = 'admin123@ms.bulsu.edu.ph'
        )
    );

-- Grant permissions
GRANT SELECT ON faculty_profiles TO anon;
GRANT ALL ON faculty_profiles TO authenticated;
GRANT ALL ON faculty_profiles TO service_role;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_faculty_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS faculty_profiles_updated_at ON faculty_profiles;
CREATE TRIGGER faculty_profiles_updated_at
    BEFORE UPDATE ON faculty_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_faculty_profiles_updated_at();

-- Sample data for College of Science
INSERT INTO faculty_profiles (faculty_id, full_name, position, role, department, college, email, phone, office_location, is_active) VALUES
('CS-001', 'Thelma V. Pagtalunan', 'Dean', 'administrator', 'College of Science', 'College of Science', 'thelma.pagtalunan@bulsu.edu.ph', '(044) 123-4001', 'CS Building Room 101', true),
('CS-002', 'Benedict M. Estrella', 'Associate Dean', 'administrator', 'College of Science', 'College of Science', 'benedict.estrella@bulsu.edu.ph', '(044) 123-4002', 'CS Building Room 102', true),
('CS-003', 'Rosario M. Poñado', 'Department Head', 'department_head', 'Science Department', 'College of Science', 'rosario.ponado@bulsu.edu.ph', '(044) 123-4003', 'CS Building Room 103', true),
('CS-004', 'Irish T. Baldevarona', 'Department Head', 'department_head', 'Mathematics Department', 'College of Science', 'irish.baldevarona@bulsu.edu.ph', '(044) 123-4004', 'CS Building Room 104', true),
('CS-005', 'Harris R. Dela Cruz', 'Program Chair', 'program_chair', 'BS Mathematics', 'College of Science', 'harris.delacruz@bulsu.edu.ph', '(044) 123-4005', 'CS Building Room 105', true),
('CS-006', 'Mary Ylane S. Lee', 'Program Chair', 'program_chair', 'BS Biology', 'College of Science', 'mary.lee@bulsu.edu.ph', '(044) 123-4006', 'CS Building Room 106', true),
('CS-007', 'Anna Dominique T. Salunga', 'Program Chair', 'program_chair', 'BS Food Technology', 'College of Science', 'anna.salunga@bulsu.edu.ph', '(044) 123-4007', 'CS Building Room 107', true),
('CS-008', 'Oliver R. Alaijos', 'Program Chair', 'program_chair', 'BS Environmental Science', 'College of Science', 'oliver.alaijos@bulsu.edu.ph', '(044) 123-4008', 'CS Building Room 108', true),
('CS-009', 'Merlyn C. Cruz', 'Program Chair', 'program_chair', 'BS Medical Technology', 'College of Science', 'merlyn.cruz@bulsu.edu.ph', '(044) 123-4009', 'CS Building Room 109', true),
('CS-010', 'Michelle S. Agustin', 'CESU Head', 'coordinator', 'College Extension and Services Unit', 'College of Science', 'michelle.agustin@bulsu.edu.ph', '(044) 123-4010', 'CS Building Room 110', true),
('CS-011', 'Jo Ann V. Reyes', 'CRDU Head', 'coordinator', 'College Research Development Unit', 'College of Science', 'joann.reyes@bulsu.edu.ph', '(044) 123-4011', 'CS Building Room 111', true),
('CS-012', 'Judith Clarisse Tan', 'SIP Coordinator', 'coordinator', 'Student Internship Program', 'College of Science', 'judith.tan@bulsu.edu.ph', '(044) 123-4012', 'CS Building Room 112', true),
('CS-013', 'Aubrey Rose T. Gan', 'College Clerk', 'staff', 'Administration', 'College of Science', 'aubrey.gan@bulsu.edu.ph', '(044) 123-4013', 'CS Building Room 113', true),
('CS-014', 'Baby Rhodora S. Mendoza', 'Laboratory Technician', 'staff', 'Science Laboratory', 'College of Science', 'babyrhodora.mendoza@bulsu.edu.ph', '(044) 123-4014', 'CS Laboratory 1', true),
('CS-015', 'Danica G. Manahan', 'Medical Laboratory Technician', 'staff', 'Medical Technology Laboratory', 'College of Science', 'danica.manahan@bulsu.edu.ph', '(044) 123-4015', 'Medical Lab', true),
('CS-016', 'Acsani D. Macalawi', 'Laboratory Technician', 'staff', 'Science Laboratory', 'College of Science', 'acsani.macalawi@bulsu.edu.ph', '(044) 123-4016', 'CS Laboratory 2', true),
('CS-017', 'Andrei Michael C. Gumatay', 'Computer Laboratory Technician', 'staff', 'Computer Laboratory', 'College of Science', 'andrei.gumatay@bulsu.edu.ph', '(044) 123-4017', 'CS Computer Lab', true)
ON CONFLICT (faculty_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    position = EXCLUDED.position,
    role = EXCLUDED.role,
    department = EXCLUDED.department,
    college = EXCLUDED.college,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    office_location = EXCLUDED.office_location,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Comments
COMMENT ON TABLE faculty_profiles IS 'Stores faculty member profiles for all colleges and departments';
COMMENT ON COLUMN faculty_profiles.faculty_id IS 'Unique identifier for faculty member (e.g., CS-001)';
COMMENT ON COLUMN faculty_profiles.role IS 'Role type: administrator, department_head, program_chair, coordinator, faculty, staff';
