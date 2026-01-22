-- ============================================================================
-- FACULTY PROFILES V2 MIGRATION
-- ============================================================================
-- This migration updates the faculty_profiles table to use the new format:
-- Name | Position | Department | Type
-- ============================================================================

-- Drop old faculty_profiles table if exists with different structure
DROP TABLE IF EXISTS faculty_profiles CASCADE;

-- Create new faculty_profiles table with updated structure
CREATE TABLE IF NOT EXISTS faculty_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    faculty_id VARCHAR(100) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    position VARCHAR(255) NOT NULL DEFAULT 'Faculty',
    role VARCHAR(50) NOT NULL DEFAULT 'faculty' CHECK (role IN ('administrator', 'department_head', 'program_chair', 'coordinator', 'faculty', 'staff')),
    department VARCHAR(255),
    college VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    office_location VARCHAR(255),
    employment_type VARCHAR(50) DEFAULT 'full-time' CHECK (employment_type IN ('full-time', 'part-time', 'adjunct', 'guest')),
    is_active BOOLEAN DEFAULT true,
    profile_image TEXT,
    bio TEXT,
    specialization TEXT,
    education TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faculty_profiles
CREATE INDEX IF NOT EXISTS idx_faculty_profiles_faculty_id ON faculty_profiles(faculty_id);
CREATE INDEX IF NOT EXISTS idx_faculty_profiles_full_name ON faculty_profiles(full_name);
CREATE INDEX IF NOT EXISTS idx_faculty_profiles_department ON faculty_profiles(department);
CREATE INDEX IF NOT EXISTS idx_faculty_profiles_college ON faculty_profiles(college);
CREATE INDEX IF NOT EXISTS idx_faculty_profiles_role ON faculty_profiles(role);
CREATE INDEX IF NOT EXISTS idx_faculty_profiles_employment_type ON faculty_profiles(employment_type);
CREATE INDEX IF NOT EXISTS idx_faculty_profiles_is_active ON faculty_profiles(is_active);

-- Enable RLS on faculty_profiles
ALTER TABLE faculty_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for faculty_profiles
CREATE POLICY "Faculty profiles are viewable by everyone" ON faculty_profiles
    FOR SELECT USING (true);

CREATE POLICY "Faculty profiles can be inserted by admins" ON faculty_profiles
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'sub_admin')
        )
    );

CREATE POLICY "Faculty profiles can be updated by admins" ON faculty_profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'sub_admin')
        )
    );

CREATE POLICY "Faculty profiles can be deleted by admins" ON faculty_profiles
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- ============================================================================
-- SAMPLE DATA: College of Science Officials, Staff & Faculty
-- ============================================================================

-- Insert Officials
INSERT INTO faculty_profiles (faculty_id, full_name, position, role, department, college, employment_type) VALUES
-- Officials
('FAC-TVP-0001', 'Thelma V. Pagtalunan', 'Dean', 'administrator', 'Administration', 'College of Science', 'full-time'),
('FAC-BME-0002', 'Benedict M. Estrella', 'Associate Dean', 'administrator', 'Administration', 'College of Science', 'full-time'),
('FAC-RMP-0003', 'Rosario M. Poñado', 'Department Head, Science Department', 'department_head', 'Science', 'College of Science', 'full-time'),
('FAC-ITB-0004', 'Irish T. Baldevarona', 'Department Head, Mathematics Department', 'department_head', 'Mathematics', 'College of Science', 'full-time'),
('FAC-HRDC-0005', 'Harris R. Dela Cruz', 'Program Chair, BS Mathematics', 'program_chair', 'Mathematics', 'College of Science', 'full-time'),
('FAC-MYSL-0006', 'Mary Ylane S. Lee', 'Program Chair, BS Biology', 'program_chair', 'Science', 'College of Science', 'full-time'),
('FAC-ADTS-0007', 'Anna Dominique T. Salunga', 'Program Chair, BS Food Technology', 'program_chair', 'Science', 'College of Science', 'full-time'),
('FAC-ORA-0008', 'Oliver R. Alaijos', 'Program Chair, BS Environmental Science', 'program_chair', 'Science', 'College of Science', 'full-time'),
('FAC-MCC-0009', 'Merlyn C. Cruz', 'Program Chair, BS Medical Technology', 'program_chair', 'Science', 'College of Science', 'full-time'),
('FAC-MSA-0010', 'Michelle S. Agustin', 'College Extension and Services Unit (CESU) Head', 'coordinator', 'Administration', 'College of Science', 'full-time'),
('FAC-JAVR-0011', 'Jo Ann V. Reyes', 'College Research Development Unit (CRDU) Head', 'coordinator', 'Administration', 'College of Science', 'full-time'),
-- Staff
('FAC-JCT-0012', 'Judith Clarisse Tan', 'Student Internship Program Coordinator', 'staff', 'Administration', 'College of Science', 'full-time'),
('FAC-ARTG-0013', 'Aubrey Rose T. Gan', 'College Clerk', 'staff', 'Administration', 'College of Science', 'full-time'),
('FAC-BRSM-0014', 'Baby Rhodora S. Mendoza', 'Laboratory Technician', 'staff', 'Science', 'College of Science', 'full-time'),
('FAC-DGM-0015', 'Danica G. Manahan', 'Medical Laboratory Technician', 'staff', 'Science', 'College of Science', 'full-time'),
('FAC-ADM-0016', 'Acsani D. Macalawi', 'Laboratory Technician', 'staff', 'Science', 'College of Science', 'full-time'),
('FAC-AMCG-0017', 'Andrei Michael C. Gumatay', 'Computer Laboratory Technician', 'staff', 'Administration', 'College of Science', 'full-time'),

-- Mathematics Faculty (Full-Time)
('FAC-MRA-0018', 'Minerva R. Amores', 'Faculty', 'faculty', 'Mathematics', 'College of Science', 'full-time'),
('FAC-DSRA-0019', 'Deo Stephanie R. Angeles', 'Faculty', 'faculty', 'Mathematics', 'College of Science', 'full-time'),
('FAC-MCDCA-0020', 'Ma. Concepcion DC. Arellano', 'Faculty', 'faculty', 'Mathematics', 'College of Science', 'full-time'),
('FAC-MRB-0021', 'Michael R. Balagtas', 'Faculty', 'faculty', 'Mathematics', 'College of Science', 'full-time'),
('FAC-ITB-0022', 'Irish T. Baldevarona', 'Faculty', 'faculty', 'Mathematics', 'College of Science', 'full-time'),
('FAC-JB-0023', 'Jeffrhaim Balilla', 'Faculty', 'faculty', 'Mathematics', 'College of Science', 'full-time'),
('FAC-ERC-0024', 'Evelyn R. Camara', 'Faculty', 'faculty', 'Mathematics', 'College of Science', 'full-time'),
('FAC-ICBC-0025', 'Imelda Cristina B. Carcosia', 'Faculty', 'faculty', 'Mathematics', 'College of Science', 'full-time'),
('FAC-CMC-0026', 'Carla M. Clemente', 'Faculty', 'faculty', 'Mathematics', 'College of Science', 'full-time'),
('FAC-HRDC-0027', 'Harris R. Dela Cruz', 'Faculty', 'faculty', 'Mathematics', 'College of Science', 'full-time'),
('FAC-LFDC-0028', 'Luzviminda F. Dela Cruz', 'Faculty', 'faculty', 'Mathematics', 'College of Science', 'full-time'),
('FAC-RLD-0029', 'Rainilyn L. Duque', 'Faculty', 'faculty', 'Mathematics', 'College of Science', 'full-time'),
('FAC-BME-0030', 'Benedict M. Estrella', 'Faculty', 'faculty', 'Mathematics', 'College of Science', 'full-time'),
('FAC-RRG-0031', 'Raevinor R. Gonzales', 'Faculty', 'faculty', 'Mathematics', 'College of Science', 'full-time'),
('FAC-VBLL-0032', 'Valentine Blez L. Lampayan', 'Faculty', 'faculty', 'Mathematics', 'College of Science', 'full-time'),
('FAC-MACM-0033', 'Mary Ann C. Magtulis', 'Faculty', 'faculty', 'Mathematics', 'College of Science', 'full-time'),
('FAC-EGM-0034', 'Ellenita G. Manalaysay', 'Faculty', 'faculty', 'Mathematics', 'College of Science', 'full-time'),
('FAC-AJM-0035', 'Armele J. Mangaran', 'Faculty', 'faculty', 'Mathematics', 'College of Science', 'full-time'),
('FAC-LDM-0036', 'Lyca D. Marcelino', 'Faculty', 'faculty', 'Mathematics', 'College of Science', 'full-time'),
('FAC-MCEM-0037', 'Maria Cecilia E. Martin', 'Faculty', 'faculty', 'Mathematics', 'College of Science', 'full-time'),
('FAC-TVP-0038', 'Thelma V. Pagtalunan', 'Faculty', 'faculty', 'Mathematics', 'College of Science', 'full-time'),
('FAC-JAVR-0039', 'Jo Ann V. Reyes', 'Faculty', 'faculty', 'Mathematics', 'College of Science', 'full-time'),
('FAC-YCR-0040', 'Yolanda C. Roberto', 'Faculty', 'faculty', 'Mathematics', 'College of Science', 'full-time'),
('FAC-EMS-0041', 'Edgardo M. Santos', 'Faculty', 'faculty', 'Mathematics', 'College of Science', 'full-time'),
('FAC-AJDV-0042', 'Adolfo Jr. D. Victorino', 'Faculty', 'faculty', 'Mathematics', 'College of Science', 'full-time'),
('FAC-JVV-0043', 'Joselito V. Viola', 'Faculty', 'faculty', 'Mathematics', 'College of Science', 'full-time'),

-- Mathematics Faculty (Part-Time)
('FAC-AFG-0044', 'Arcel F. Galvez', 'Faculty (Part-Time)', 'faculty', 'Mathematics', 'College of Science', 'part-time'),
('FAC-CCR-0045', 'Cherielyn C. Regalado', 'Faculty (Part-Time)', 'faculty', 'Mathematics', 'College of Science', 'part-time'),
('FAC-GCR-0046', 'Gertrudes C. Reyes', 'Faculty (Part-Time)', 'faculty', 'Mathematics', 'College of Science', 'part-time'),
('FAC-MNR-0047', 'Mara N. Roxas', 'Faculty (Part-Time)', 'faculty', 'Mathematics', 'College of Science', 'part-time'),
('FAC-JATS-0048', 'Judy Ann T. Sumala', 'Faculty (Part-Time)', 'faculty', 'Mathematics', 'College of Science', 'part-time'),
('FAC-JPV-0049', 'Joshua P. Valeroso', 'Faculty (Part-Time)', 'faculty', 'Mathematics', 'College of Science', 'part-time'),

-- Mathematics Faculty (Adjunct)
('FAC-ARTG-0050', 'Aubrey Rose T. Gan', 'Faculty (Adjunct)', 'faculty', 'Mathematics', 'College of Science', 'adjunct'),

-- Science Faculty (Full-Time)
('FAC-MSA-0051', 'Michelle S. Agustin', 'Faculty', 'faculty', 'Science', 'College of Science', 'full-time'),
('FAC-ORA-0052', 'Oliver R. Alaijos', 'Faculty', 'faculty', 'Science', 'College of Science', 'full-time'),
('FAC-TDCA-0053', 'Thelma D.C. Arrieta', 'Faculty', 'faculty', 'Science', 'College of Science', 'full-time'),
('FAC-ERB-0054', 'Eleonor R. Basilio', 'Faculty', 'faculty', 'Science', 'College of Science', 'full-time'),
('FAC-KDBC-0055', 'Kristan Diane B. Canta', 'Faculty', 'faculty', 'Science', 'College of Science', 'full-time'),
('FAC-RDCC-0056', 'Rachel D.C. Clavio', 'Faculty', 'faculty', 'Science', 'College of Science', 'full-time'),
('FAC-RFC-0057', 'Richard F. Clemente', 'Faculty', 'faculty', 'Science', 'College of Science', 'full-time'),
('FAC-MLDC-0058', 'Maria Lin D. Cristobal', 'Faculty', 'faculty', 'Science', 'College of Science', 'full-time'),
('FAC-MCC-0059', 'Merlyn C. Cruz', 'Faculty', 'faculty', 'Science', 'College of Science', 'full-time'),
('FAC-MDADC-0060', 'Marissa DA. Dela Cruz', 'Faculty', 'faculty', 'Science', 'College of Science', 'full-time'),
('FAC-RFJ-0061', 'Raymundo F. Javier', 'Faculty', 'faculty', 'Science', 'College of Science', 'full-time'),
('FAC-FGAJ-0062', 'Freya Gay A. Jingco', 'Faculty', 'faculty', 'Science', 'College of Science', 'full-time'),
('FAC-MYSL-0063', 'Mary Ylane S. Lee', 'Faculty', 'faculty', 'Science', 'College of Science', 'full-time'),
('FAC-MDPN-0064', 'Mery day P. Neo', 'Faculty', 'faculty', 'Science', 'College of Science', 'full-time'),
('FAC-JMCN-0065', 'Joana May C. Nepomuceno', 'Faculty', 'faculty', 'Science', 'College of Science', 'full-time'),
('FAC-VPP-0066', 'Virginia P. Paitan', 'Faculty', 'faculty', 'Science', 'College of Science', 'full-time'),
('FAC-RMP-0067', 'Rosario M. Poñado', 'Faculty', 'faculty', 'Science', 'College of Science', 'full-time'),
('FAC-JRSO-0068', 'Jose Ravenal S. Ocampo', 'Faculty', 'faculty', 'Science', 'College of Science', 'full-time'),
('FAC-MTFR-0069', 'Ma. Theresa F. Reyes', 'Faculty', 'faculty', 'Science', 'College of Science', 'full-time'),
('FAC-ECR-0070', 'Eden C. Ronquillo', 'Faculty', 'faculty', 'Science', 'College of Science', 'full-time'),
('FAC-MRMS-0071', 'Marlyn Rose M. Sacdalan', 'Faculty', 'faculty', 'Science', 'College of Science', 'full-time'),
('FAC-ADMS-0072', 'Anna Dominique M. Salunga', 'Faculty', 'faculty', 'Science', 'College of Science', 'full-time'),
('FAC-EQS-0073', 'Eloisa Q. Singian', 'Faculty', 'faculty', 'Science', 'College of Science', 'full-time'),
('FAC-ERT-0074', 'Edwin R. Tadiosa', 'Faculty', 'faculty', 'Science', 'College of Science', 'full-time'),
('FAC-JCJT-0075', 'Judith Clarisse J. Tan', 'Faculty', 'faculty', 'Science', 'College of Science', 'full-time'),
('FAC-MVST-0076', 'Ma. Victoria S. Tiongson', 'Faculty', 'faculty', 'Science', 'College of Science', 'full-time'),
('FAC-DAST-0077', 'Debbie Ann S. Tuazon', 'Faculty', 'faculty', 'Science', 'College of Science', 'full-time'),
('FAC-CEMV-0078', 'Cielo Emar M. Villareal', 'Faculty', 'faculty', 'Science', 'College of Science', 'full-time'),

-- Science Faculty (Part-Time)
('FAC-RLBA-0079', 'Ria Laura B. Abuzo', 'Faculty (Part-Time)', 'faculty', 'Science', 'College of Science', 'part-time'),
('FAC-MARA-0080', 'Mark Andrew R. Anacleto', 'Faculty (Part-Time)', 'faculty', 'Science', 'College of Science', 'part-time'),
('FAC-ACTB-0081', 'Atheena Cammara T. Barre', 'Faculty (Part-Time)', 'faculty', 'Science', 'College of Science', 'part-time'),
('FAC-EKB-0082', 'Emily K. Bernardo', 'Faculty (Part-Time)', 'faculty', 'Science', 'College of Science', 'part-time'),
('FAC-APC-0083', 'Alfredo P. Carpio', 'Faculty (Part-Time)', 'faculty', 'Science', 'College of Science', 'part-time'),
('FAC-JVC-0084', 'Jayson V. Cayetano', 'Faculty (Part-Time)', 'faculty', 'Science', 'College of Science', 'part-time'),
('FAC-RSJ-0085', 'Reynaldo S. Jacinto', 'Faculty (Part-Time)', 'faculty', 'Science', 'College of Science', 'part-time'),
('FAC-MVM-0086', 'Maribeth V. Martinez', 'Faculty (Part-Time)', 'faculty', 'Science', 'College of Science', 'part-time'),
('FAC-JEN-0087', 'Jovie E. Nicolas', 'Faculty (Part-Time)', 'faculty', 'Science', 'College of Science', 'part-time'),
('FAC-ADP-0088', 'Alma D. Politano', 'Faculty (Part-Time)', 'faculty', 'Science', 'College of Science', 'part-time'),
('FAC-RZR-0089', 'Racquel Z. Rubico', 'Faculty (Part-Time)', 'faculty', 'Science', 'College of Science', 'part-time'),
('FAC-MSCS-0090', 'Maria Salome C. Santos', 'Faculty (Part-Time)', 'faculty', 'Science', 'College of Science', 'part-time'),
('FAC-MPS-0091', 'Marianne P. Santos', 'Faculty (Part-Time)', 'faculty', 'Science', 'College of Science', 'part-time'),

-- Science Guest Lecturers
('FAC-JVCD-0092', 'Atty. Julius Victor C. Degala', 'Guest Lecturer', 'faculty', 'Science', 'College of Science', 'guest'),
('FAC-ARTG-0093', 'Agatha Ruth T. Gan', 'Guest Lecturer', 'faculty', 'Science', 'College of Science', 'guest'),
('FAC-KKRS-0094', 'Karl Kenneth R. Santos', 'Guest Lecturer', 'faculty', 'Science', 'College of Science', 'guest'),

-- Science Faculty (Adjunct)
('FAC-MALN-0095', 'Mary Ann L. Nicolas', 'Faculty (Adjunct)', 'faculty', 'Science', 'College of Science', 'adjunct')

ON CONFLICT (faculty_id) DO NOTHING;

-- ============================================================================
-- UTILITY VIEWS
-- ============================================================================

-- View for faculty by department
CREATE OR REPLACE VIEW faculty_by_department AS
SELECT 
    department,
    college,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE employment_type = 'full-time') as full_time_count,
    COUNT(*) FILTER (WHERE employment_type = 'part-time') as part_time_count,
    COUNT(*) FILTER (WHERE employment_type = 'adjunct') as adjunct_count,
    COUNT(*) FILTER (WHERE employment_type = 'guest') as guest_count,
    COUNT(*) FILTER (WHERE role = 'administrator') as admin_count,
    COUNT(*) FILTER (WHERE role = 'department_head') as dept_head_count,
    COUNT(*) FILTER (WHERE role = 'program_chair') as program_chair_count,
    COUNT(*) FILTER (WHERE role = 'coordinator') as coordinator_count,
    COUNT(*) FILTER (WHERE role = 'staff') as staff_count,
    COUNT(*) FILTER (WHERE role = 'faculty') as faculty_count
FROM faculty_profiles
WHERE is_active = true
GROUP BY department, college
ORDER BY college, department;

-- View for officials and staff
CREATE OR REPLACE VIEW officials_and_staff AS
SELECT *
FROM faculty_profiles
WHERE role IN ('administrator', 'department_head', 'program_chair', 'coordinator', 'staff')
AND is_active = true
ORDER BY 
    CASE role 
        WHEN 'administrator' THEN 1
        WHEN 'department_head' THEN 2
        WHEN 'program_chair' THEN 3
        WHEN 'coordinator' THEN 4
        WHEN 'staff' THEN 5
    END,
    full_name;

-- View for teaching faculty only
CREATE OR REPLACE VIEW teaching_faculty AS
SELECT *
FROM faculty_profiles
WHERE role = 'faculty'
AND is_active = true
ORDER BY department, employment_type, full_name;
