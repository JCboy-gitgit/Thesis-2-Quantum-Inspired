-- ============================================================================
-- FLOOR PLANS DATABASE SCHEMA FOR 2D MAP EDITOR
-- ============================================================================
-- This SQL file creates tables for storing floor plans created in the map editor
-- 
-- HOW TO USE:
-- 1. Go to your Supabase Dashboard
-- 2. Navigate to SQL Editor
-- 3. Copy and paste this entire file
-- 4. Click "Run" to execute
-- ============================================================================

-- ============================================================================
-- SECTION 1: BUILDINGS TABLE
-- ============================================================================

-- Buildings table - stores building information
CREATE TABLE IF NOT EXISTS buildings (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE,
    campus VARCHAR(255),
    school_name VARCHAR(255),
    description TEXT,
    address TEXT,
    total_floors INTEGER DEFAULT 1,
    image_url TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    status VARCHAR(50) DEFAULT 'active',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for buildings
CREATE INDEX IF NOT EXISTS idx_buildings_name ON buildings(name);
CREATE INDEX IF NOT EXISTS idx_buildings_campus ON buildings(campus);
CREATE INDEX IF NOT EXISTS idx_buildings_code ON buildings(code);

-- ============================================================================
-- SECTION 2: FLOOR PLANS TABLE
-- ============================================================================

-- Floor plans table - stores the canvas data for each floor
CREATE TABLE IF NOT EXISTS floor_plans (
    id SERIAL PRIMARY KEY,
    building_id INTEGER REFERENCES buildings(id) ON DELETE CASCADE,
    floor_number INTEGER NOT NULL DEFAULT 1,
    floor_name VARCHAR(255),
    canvas_data JSONB NOT NULL DEFAULT '{}',
    canvas_width INTEGER DEFAULT 1200,
    canvas_height INTEGER DEFAULT 800,
    grid_size INTEGER DEFAULT 20,
    background_color VARCHAR(20) DEFAULT '#ffffff',
    background_image_url TEXT,
    is_default_view BOOLEAN DEFAULT false,
    is_published BOOLEAN DEFAULT false,
    version INTEGER DEFAULT 1,
    thumbnail_url TEXT,
    status VARCHAR(50) DEFAULT 'draft',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for floor_plans
CREATE INDEX IF NOT EXISTS idx_floor_plans_building ON floor_plans(building_id);
CREATE INDEX IF NOT EXISTS idx_floor_plans_floor_number ON floor_plans(floor_number);
CREATE INDEX IF NOT EXISTS idx_floor_plans_is_default ON floor_plans(is_default_view);
CREATE INDEX IF NOT EXISTS idx_floor_plans_is_published ON floor_plans(is_published);

-- ============================================================================
-- SECTION 3: FLOOR PLAN ELEMENTS TABLE
-- ============================================================================

-- Floor plan elements - stores individual elements on the floor plan
CREATE TABLE IF NOT EXISTS floor_plan_elements (
    id SERIAL PRIMARY KEY,
    floor_plan_id INTEGER REFERENCES floor_plans(id) ON DELETE CASCADE,
    element_type VARCHAR(50) NOT NULL, -- 'room', 'wall', 'door', 'window', 'stair', 'text', 'icon', 'shape'
    element_id VARCHAR(100), -- unique ID within the floor plan
    x DECIMAL(10, 2) NOT NULL DEFAULT 0,
    y DECIMAL(10, 2) NOT NULL DEFAULT 0,
    width DECIMAL(10, 2) DEFAULT 100,
    height DECIMAL(10, 2) DEFAULT 100,
    rotation DECIMAL(10, 2) DEFAULT 0,
    z_index INTEGER DEFAULT 0,
    properties JSONB DEFAULT '{}', -- stores element-specific properties
    linked_room_id INTEGER, -- references campuses table for room data
    linked_schedule_id INTEGER, -- optional link to schedule
    label VARCHAR(255),
    color VARCHAR(20),
    border_color VARCHAR(20),
    font_size INTEGER DEFAULT 14,
    is_locked BOOLEAN DEFAULT false,
    is_visible BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for floor_plan_elements
CREATE INDEX IF NOT EXISTS idx_floor_plan_elements_plan ON floor_plan_elements(floor_plan_id);
CREATE INDEX IF NOT EXISTS idx_floor_plan_elements_type ON floor_plan_elements(element_type);
CREATE INDEX IF NOT EXISTS idx_floor_plan_elements_linked_room ON floor_plan_elements(linked_room_id);

-- ============================================================================
-- SECTION 4: FLOOR PLAN VERSIONS (for undo/redo history)
-- ============================================================================

-- Floor plan versions - stores version history
CREATE TABLE IF NOT EXISTS floor_plan_versions (
    id SERIAL PRIMARY KEY,
    floor_plan_id INTEGER REFERENCES floor_plans(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    canvas_data JSONB NOT NULL,
    change_description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for floor_plan_versions
CREATE INDEX IF NOT EXISTS idx_floor_plan_versions_plan ON floor_plan_versions(floor_plan_id);
CREATE INDEX IF NOT EXISTS idx_floor_plan_versions_number ON floor_plan_versions(version_number);

-- ============================================================================
-- SECTION 5: SHARED/PUBLIC FLOOR PLANS
-- ============================================================================

-- Shared floor plans - for public/shared viewing
CREATE TABLE IF NOT EXISTS shared_floor_plans (
    id SERIAL PRIMARY KEY,
    floor_plan_id INTEGER REFERENCES floor_plans(id) ON DELETE CASCADE,
    share_token VARCHAR(100) UNIQUE NOT NULL,
    share_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    password_protected BOOLEAN DEFAULT false,
    password_hash VARCHAR(255),
    view_count INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ,
    allowed_emails TEXT[], -- array of emails that can access
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for shared_floor_plans
CREATE INDEX IF NOT EXISTS idx_shared_floor_plans_token ON shared_floor_plans(share_token);
CREATE INDEX IF NOT EXISTS idx_shared_floor_plans_plan ON shared_floor_plans(floor_plan_id);

-- ============================================================================
-- SECTION 6: FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_floor_plan_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_buildings_timestamp
    BEFORE UPDATE ON buildings
    FOR EACH ROW
    EXECUTE FUNCTION update_floor_plan_timestamp();

CREATE TRIGGER update_floor_plans_timestamp
    BEFORE UPDATE ON floor_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_floor_plan_timestamp();

CREATE TRIGGER update_floor_plan_elements_timestamp
    BEFORE UPDATE ON floor_plan_elements
    FOR EACH ROW
    EXECUTE FUNCTION update_floor_plan_timestamp();

-- Function to generate unique share token
CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS VARCHAR(100) AS $$
DECLARE
    token VARCHAR(100);
    token_exists BOOLEAN;
BEGIN
    LOOP
        token := encode(gen_random_bytes(32), 'hex');
        SELECT EXISTS(SELECT 1 FROM shared_floor_plans WHERE share_token = token) INTO token_exists;
        EXIT WHEN NOT token_exists;
    END LOOP;
    RETURN token;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 7: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE floor_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE floor_plan_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE floor_plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_floor_plans ENABLE ROW LEVEL SECURITY;

-- Policies for buildings (allow all authenticated users to read, admins to write)
CREATE POLICY "Allow read access to buildings" ON buildings
    FOR SELECT USING (true);

CREATE POLICY "Allow insert for authenticated users" ON buildings
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow update for authenticated users" ON buildings
    FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Policies for floor_plans
CREATE POLICY "Allow read access to floor_plans" ON floor_plans
    FOR SELECT USING (true);

CREATE POLICY "Allow insert for authenticated users" ON floor_plans
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow update for authenticated users" ON floor_plans
    FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow delete for authenticated users" ON floor_plans
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- Policies for floor_plan_elements
CREATE POLICY "Allow read access to floor_plan_elements" ON floor_plan_elements
    FOR SELECT USING (true);

CREATE POLICY "Allow insert for authenticated users" ON floor_plan_elements
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow update for authenticated users" ON floor_plan_elements
    FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow delete for authenticated users" ON floor_plan_elements
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- Policies for shared_floor_plans (public read for active shares)
CREATE POLICY "Allow read access to active shared plans" ON shared_floor_plans
    FOR SELECT USING (is_active = true);

CREATE POLICY "Allow insert for authenticated users" ON shared_floor_plans
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow update for authenticated users" ON shared_floor_plans
    FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- SAMPLE DATA (Optional - Federizo Hall based on your images)
-- ============================================================================

-- Insert sample building
-- INSERT INTO buildings (name, code, campus, total_floors, description)
-- VALUES ('Federizo Hall', 'FH', 'Main Campus', 2, 'Main academic building with classrooms and laboratories');

-- You can add more sample data as needed
