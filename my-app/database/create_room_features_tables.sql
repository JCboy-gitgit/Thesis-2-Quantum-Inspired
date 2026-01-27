-- =====================================================
-- Room Features & Subject Requirements Matching System
-- =====================================================
-- This enables matching subjects to rooms based on required equipment/features
-- Example: Physics subject needs DC_Power_Supply tag, so it can only go in
-- rooms that have that tag.

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS public.subject_room_requirements CASCADE;
DROP TABLE IF EXISTS public.room_features CASCADE;
DROP TABLE IF EXISTS public.feature_tags CASCADE;

-- =====================================================
-- 1. Feature Tags (Master list of all possible features)
-- =====================================================
CREATE TABLE public.feature_tags (
  id serial PRIMARY KEY,
  tag_name varchar(100) NOT NULL UNIQUE,
  tag_category varchar(50) NOT NULL DEFAULT 'general',
  description text,
  icon varchar(50), -- Optional icon name for UI
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Default feature categories
COMMENT ON COLUMN public.feature_tags.tag_category IS 'Categories: equipment, furniture, technology, safety, accessibility';

-- Insert common feature tags
INSERT INTO public.feature_tags (tag_name, tag_category, description, icon) VALUES
-- Technology Equipment
('Desktop_PC', 'technology', 'Desktop computers for student use', 'monitor'),
('Laptop_Stations', 'technology', 'Laptop docking stations', 'laptop'),
('Projector', 'technology', 'Ceiling or portable projector', 'projector'),
('Smart_Board', 'technology', 'Interactive smart board/whiteboard', 'presentation'),
('TV_Display', 'technology', 'Large TV/Monitor display', 'tv'),
('Audio_System', 'technology', 'PA system or speakers', 'speaker'),

-- Laboratory Equipment - Physics
('DC_Power_Supply', 'equipment', 'DC power supply units', 'zap'),
('AC_Power_Supply', 'equipment', 'AC power supply units', 'zap'),
('Multimeter', 'equipment', 'Digital/Analog multimeters', 'activity'),
('Oscilloscope', 'equipment', 'Signal oscilloscopes', 'activity'),
('Function_Generator', 'equipment', 'Signal/function generators', 'radio'),
('Optics_Equipment', 'equipment', 'Lenses, mirrors, light sources', 'sun'),

-- Laboratory Equipment - Chemistry
('Fume_Hood', 'equipment', 'Chemical fume extraction hood', 'wind'),
('Lab_Sink', 'equipment', 'Laboratory sink with proper drainage', 'droplet'),
('Chemical_Storage', 'equipment', 'Chemical storage cabinets', 'archive'),
('Bunsen_Burner', 'equipment', 'Gas burners for heating', 'flame'),
('Microscope', 'equipment', 'Optical/Digital microscopes', 'search'),
('Centrifuge', 'equipment', 'Laboratory centrifuge machine', 'loader'),

-- Laboratory Equipment - Biology
('Autoclave', 'equipment', 'Sterilization autoclave', 'thermometer'),
('Incubator', 'equipment', 'Temperature-controlled incubator', 'thermometer'),
('Refrigerator_Lab', 'equipment', 'Laboratory refrigerator/freezer', 'snowflake'),
('Dissection_Kit', 'equipment', 'Dissection tools and trays', 'scissors'),

-- Laboratory Equipment - Engineering
('Soldering_Station', 'equipment', 'Soldering and desoldering equipment', 'cpu'),
('3D_Printer', 'equipment', '3D printing machines', 'box'),
('CNC_Machine', 'equipment', 'CNC milling/cutting machines', 'settings'),
('Breadboard', 'equipment', 'Electronics prototyping breadboards', 'grid'),
('PLC_Trainer', 'equipment', 'Programmable Logic Controller trainers', 'cpu'),
('Robotics_Kit', 'equipment', 'Robotics and automation kits', 'bot'),

-- Furniture
('Lab_Tables', 'furniture', 'Laboratory-grade tables', 'table'),
('Adjustable_Chairs', 'furniture', 'Adjustable lab chairs/stools', 'armchair'),
('Whiteboard', 'furniture', 'Standard whiteboard', 'square'),
('Corkboard', 'furniture', 'Pin/Cork bulletin board', 'layout'),

-- Safety
('Eye_Wash_Station', 'safety', 'Emergency eye wash station', 'eye'),
('Fire_Extinguisher', 'safety', 'Fire extinguisher available', 'flame'),
('First_Aid_Kit', 'safety', 'First aid supplies', 'heart'),
('Emergency_Shower', 'safety', 'Emergency shower station', 'droplet'),
('Safety_Cabinet', 'safety', 'Safety equipment cabinet', 'shield'),

-- Accessibility
('Wheelchair_Accessible', 'accessibility', 'Wheelchair accessible room', 'accessibility'),
('Hearing_Loop', 'accessibility', 'Hearing assistance loop system', 'ear'),
('Adjustable_Desks', 'accessibility', 'Height-adjustable desks', 'move');

-- =====================================================
-- 2. Room Features (Links rooms to their features)
-- =====================================================
CREATE TABLE public.room_features (
  id serial PRIMARY KEY,
  room_id integer NOT NULL,
  feature_tag_id integer NOT NULL REFERENCES public.feature_tags(id) ON DELETE CASCADE,
  quantity integer DEFAULT 1, -- Number of units (e.g., 30 Desktop PCs)
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT room_features_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.campuses(id) ON DELETE CASCADE,
  CONSTRAINT room_features_unique UNIQUE (room_id, feature_tag_id)
);

-- Index for faster lookups
CREATE INDEX idx_room_features_room_id ON public.room_features(room_id);
CREATE INDEX idx_room_features_feature_tag_id ON public.room_features(feature_tag_id);

-- =====================================================
-- 3. Subject Room Requirements (Links subjects to required features)
-- =====================================================
CREATE TABLE public.subject_room_requirements (
  id serial PRIMARY KEY,
  course_id integer NOT NULL,
  feature_tag_id integer NOT NULL REFERENCES public.feature_tags(id) ON DELETE CASCADE,
  is_mandatory boolean DEFAULT true, -- If false, it's a "nice to have"
  min_quantity integer DEFAULT 1, -- Minimum required quantity
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT subject_requirements_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.class_schedules(id) ON DELETE CASCADE,
  CONSTRAINT subject_requirements_unique UNIQUE (course_id, feature_tag_id)
);

-- Index for faster lookups
CREATE INDEX idx_subject_requirements_course_id ON public.subject_room_requirements(course_id);
CREATE INDEX idx_subject_requirements_feature_tag_id ON public.subject_room_requirements(feature_tag_id);

-- =====================================================
-- Helper Views
-- =====================================================

-- View: Room with all its features as an array
CREATE OR REPLACE VIEW public.room_features_summary AS
SELECT 
  c.id as room_id,
  c.room,
  c.building,
  c.campus,
  c.room_type,
  c.specific_classification,
  COALESCE(
    array_agg(ft.tag_name ORDER BY ft.tag_name) FILTER (WHERE ft.tag_name IS NOT NULL),
    ARRAY[]::varchar[]
  ) as feature_tags,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'tag_id', ft.id,
        'tag_name', ft.tag_name,
        'category', ft.tag_category,
        'quantity', rf.quantity
      ) ORDER BY ft.tag_category, ft.tag_name
    ) FILTER (WHERE ft.id IS NOT NULL),
    '[]'::jsonb
  ) as features_detail
FROM public.campuses c
LEFT JOIN public.room_features rf ON c.id = rf.room_id
LEFT JOIN public.feature_tags ft ON rf.feature_tag_id = ft.id
GROUP BY c.id, c.room, c.building, c.campus, c.room_type, c.specific_classification;

-- View: Subject with all its required features as an array
CREATE OR REPLACE VIEW public.subject_requirements_summary AS
SELECT 
  cs.id as course_id,
  cs.course_code,
  cs.course_name,
  cs.lab_hours,
  COALESCE(
    array_agg(ft.tag_name ORDER BY ft.tag_name) FILTER (WHERE ft.tag_name IS NOT NULL AND srr.is_mandatory = true),
    ARRAY[]::varchar[]
  ) as required_tags,
  COALESCE(
    array_agg(ft.tag_name ORDER BY ft.tag_name) FILTER (WHERE ft.tag_name IS NOT NULL AND srr.is_mandatory = false),
    ARRAY[]::varchar[]
  ) as optional_tags,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'tag_id', ft.id,
        'tag_name', ft.tag_name,
        'is_mandatory', srr.is_mandatory,
        'min_quantity', srr.min_quantity
      ) ORDER BY srr.is_mandatory DESC, ft.tag_name
    ) FILTER (WHERE ft.id IS NOT NULL),
    '[]'::jsonb
  ) as requirements_detail
FROM public.class_schedules cs
LEFT JOIN public.subject_room_requirements srr ON cs.id = srr.course_id
LEFT JOIN public.feature_tags ft ON srr.feature_tag_id = ft.id
GROUP BY cs.id, cs.course_code, cs.course_name, cs.lab_hours;

-- =====================================================
-- Function: Check if a room satisfies subject requirements
-- =====================================================
CREATE OR REPLACE FUNCTION public.room_satisfies_requirements(
  p_room_id integer,
  p_course_id integer
) RETURNS boolean AS $$
DECLARE
  v_missing_count integer;
BEGIN
  -- Count mandatory requirements that the room doesn't have
  SELECT COUNT(*)
  INTO v_missing_count
  FROM public.subject_room_requirements srr
  WHERE srr.course_id = p_course_id
    AND srr.is_mandatory = true
    AND NOT EXISTS (
      SELECT 1 
      FROM public.room_features rf 
      WHERE rf.room_id = p_room_id 
        AND rf.feature_tag_id = srr.feature_tag_id
        AND rf.quantity >= srr.min_quantity
    );
  
  RETURN v_missing_count = 0;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Function: Get compatible rooms for a subject
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_compatible_rooms_for_subject(
  p_course_id integer,
  p_min_capacity integer DEFAULT 1
) RETURNS TABLE (
  room_id integer,
  room_name varchar,
  building varchar,
  campus varchar,
  capacity integer,
  room_type varchar,
  matching_features integer,
  missing_features text[]
) AS $$
BEGIN
  RETURN QUERY
  WITH required_features AS (
    SELECT feature_tag_id, min_quantity
    FROM public.subject_room_requirements
    WHERE course_id = p_course_id AND is_mandatory = true
  ),
  room_matching AS (
    SELECT 
      c.id,
      c.room,
      c.building,
      c.campus,
      c.capacity,
      c.room_type,
      COUNT(rf.feature_tag_id) FILTER (
        WHERE rf.feature_tag_id IN (SELECT feature_tag_id FROM required_features)
          AND rf.quantity >= (SELECT min_quantity FROM required_features WHERE feature_tag_id = rf.feature_tag_id)
      ) as matched,
      (SELECT COUNT(*) FROM required_features) as total_required
    FROM public.campuses c
    LEFT JOIN public.room_features rf ON c.id = rf.room_id
    WHERE c.capacity >= p_min_capacity
      AND c.status IN ('active', 'usable', 'available')
    GROUP BY c.id, c.room, c.building, c.campus, c.capacity, c.room_type
  )
  SELECT 
    rm.id,
    rm.room,
    rm.building,
    rm.campus,
    rm.capacity,
    rm.room_type,
    rm.matched::integer,
    ARRAY(
      SELECT ft.tag_name
      FROM required_features req
      JOIN public.feature_tags ft ON req.feature_tag_id = ft.id
      WHERE NOT EXISTS (
        SELECT 1 FROM public.room_features rf 
        WHERE rf.room_id = rm.id AND rf.feature_tag_id = req.feature_tag_id
      )
    ) as missing
  FROM room_matching rm
  WHERE rm.matched = rm.total_required
  ORDER BY rm.capacity ASC;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_features TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_room_requirements TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT SELECT ON public.room_features_summary TO authenticated;
GRANT SELECT ON public.subject_requirements_summary TO authenticated;
