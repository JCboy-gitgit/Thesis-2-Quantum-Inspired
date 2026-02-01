-- Create BulSU Colleges Configuration Table
-- This table stores the centralized list of colleges that can be managed from admin settings

CREATE TABLE IF NOT EXISTS bulsu_colleges (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    short_name VARCHAR(100),
    color VARCHAR(100) DEFAULT 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    is_active BOOLEAN DEFAULT true,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default BulSU colleges
INSERT INTO bulsu_colleges (code, name, short_name, display_order, is_active) VALUES
    ('CAFA', 'College of Architecture and Fine Arts', 'Architecture & Fine Arts', 1, true),
    ('CAL', 'College of Arts and Letters', 'Arts & Letters', 2, true),
    ('CBEA', 'College of Business Education and Accountancy', 'Business Education', 3, true),
    ('CCJE', 'College of Criminal Justice Education', 'Criminal Justice', 4, true),
    ('CHTM', 'College of Hospitality and Tourism Management', 'Hospitality & Tourism', 5, true),
    ('CICT', 'College of Information and Communications Technology', 'Info & Comm Tech', 6, true),
    ('CIT', 'College of Industrial Technology', 'Industrial Technology', 7, true),
    ('CLaw', 'College of Law', 'Law', 8, true),
    ('CN', 'College of Nursing', 'Nursing', 9, true),
    ('COE', 'College of Engineering', 'Engineering', 10, true),
    ('COED', 'College of Education', 'Education', 11, true),
    ('CS', 'College of Science', 'Science', 12, true),
    ('CSER', 'College of Sports, Exercise and Recreation', 'Sports & Recreation', 13, true),
    ('CSSP', 'College of Social Sciences and Philosophy', 'Social Sciences', 14, true),
    ('GS', 'Graduate School', 'Graduate School', 15, true)
ON CONFLICT (code) DO NOTHING;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_bulsu_colleges_code ON bulsu_colleges(code);
CREATE INDEX IF NOT EXISTS idx_bulsu_colleges_active ON bulsu_colleges(is_active);
CREATE INDEX IF NOT EXISTS idx_bulsu_colleges_order ON bulsu_colleges(display_order);

-- Add RLS policies
ALTER TABLE bulsu_colleges ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read colleges
CREATE POLICY "Allow read access to all authenticated users" ON bulsu_colleges
    FOR SELECT USING (true);

-- Allow admins to manage colleges (you may need to adjust this based on your auth setup)
CREATE POLICY "Allow admins to manage colleges" ON bulsu_colleges
    FOR ALL USING (true);
