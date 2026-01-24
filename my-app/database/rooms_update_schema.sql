-- =====================================================
-- Room Allocation System - Updated Rooms Schema
-- Date: January 24, 2026
-- Description: Updates to the campuses table to support new CSV format
-- CSV Format: Room_ID, Room_Name, Building, Floor, College, Primary_Type, Specific_Classification, Capacity, Is_Airconditioned, Has_Whiteboard, Has_TV
-- =====================================================

-- Add new columns to campuses table if they don't exist
DO $$ 
BEGIN
    -- Add room_code column (for Room_ID from CSV - can be null)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campuses' AND column_name = 'room_code') THEN
        ALTER TABLE public.campuses ADD COLUMN room_code character varying;
    END IF;

    -- Add specific_classification column (Specific_Classification from CSV)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campuses' AND column_name = 'specific_classification') THEN
        ALTER TABLE public.campuses ADD COLUMN specific_classification character varying;
    END IF;

    -- Add has_tv column (Has_TV from CSV - can be null)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campuses' AND column_name = 'has_tv') THEN
        ALTER TABLE public.campuses ADD COLUMN has_tv boolean DEFAULT false;
    END IF;

    -- Add college column if it doesn't exist (separate from campus)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campuses' AND column_name = 'college') THEN
        ALTER TABLE public.campuses ADD COLUMN college character varying;
    END IF;

    -- Modify has_ac to allow NULL values (for empty CSV values)
    ALTER TABLE public.campuses ALTER COLUMN has_ac DROP NOT NULL;
    ALTER TABLE public.campuses ALTER COLUMN has_ac DROP DEFAULT;
    
    -- Modify has_whiteboard to allow NULL values
    ALTER TABLE public.campuses ALTER COLUMN has_whiteboard DROP NOT NULL;
    ALTER TABLE public.campuses ALTER COLUMN has_whiteboard DROP DEFAULT;
    
    -- Modify floor_number to allow NULL values
    ALTER TABLE public.campuses ALTER COLUMN floor_number DROP NOT NULL;
    ALTER TABLE public.campuses ALTER COLUMN floor_number DROP DEFAULT;

END $$;

-- Update the room_type column to support new Primary_Type values
-- Common room types: Lecture Room, Laboratory, Computer Lab, Conference Room, Auditorium, etc.

-- Add comment to explain the schema
COMMENT ON TABLE public.campuses IS 'Stores room/building information uploaded via CSV. 
CSV Format: Room_ID, Room_Name, Building, Floor, College, Primary_Type, Specific_Classification, Capacity, Is_Airconditioned, Has_Whiteboard, Has_TV
Note: Room_ID, Floor, and Is_Airconditioned can be empty/null';

COMMENT ON COLUMN public.campuses.room_code IS 'Room ID from CSV - can be null. Maps to Room_ID column in CSV';
COMMENT ON COLUMN public.campuses.room IS 'Room name/identifier. Maps to Room_Name column in CSV';
COMMENT ON COLUMN public.campuses.building IS 'Building name. Maps to Building column in CSV';
COMMENT ON COLUMN public.campuses.floor_number IS 'Floor number - can be null when not specified. Maps to Floor column in CSV';
COMMENT ON COLUMN public.campuses.campus IS 'College/Campus name. Maps to College column in CSV';
COMMENT ON COLUMN public.campuses.room_type IS 'Primary room type (Lecture Room, Laboratory, etc.). Maps to Primary_Type column in CSV';
COMMENT ON COLUMN public.campuses.specific_classification IS 'Specific room classification. Maps to Specific_Classification column in CSV';
COMMENT ON COLUMN public.campuses.capacity IS 'Room capacity (number of seats). Maps to Capacity column in CSV';
COMMENT ON COLUMN public.campuses.has_ac IS 'Whether room is air-conditioned - can be null when not specified. Maps to Is_Airconditioned column in CSV';
COMMENT ON COLUMN public.campuses.has_whiteboard IS 'Whether room has whiteboard. Maps to Has_Whiteboard column in CSV';
COMMENT ON COLUMN public.campuses.has_tv IS 'Whether room has TV. Maps to Has_TV column in CSV';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_campuses_room_code ON public.campuses(room_code);
CREATE INDEX IF NOT EXISTS idx_campuses_building ON public.campuses(building);
CREATE INDEX IF NOT EXISTS idx_campuses_room_type ON public.campuses(room_type);
CREATE INDEX IF NOT EXISTS idx_campuses_college ON public.campuses(college);

-- =====================================================
-- Alternative: If you want to create a completely new rooms table
-- Uncomment the section below
-- =====================================================

/*
-- Create a new rooms table with the updated schema
CREATE TABLE IF NOT EXISTS public.rooms_v2 (
  id integer NOT NULL DEFAULT nextval('rooms_v2_id_seq'::regclass),
  upload_group_id integer,
  room_code character varying,  -- Room_ID from CSV (can be null)
  room_name character varying NOT NULL,  -- Room_Name from CSV
  building character varying NOT NULL,  -- Building from CSV
  floor_number integer,  -- Floor from CSV (can be null)
  college character varying,  -- College from CSV
  primary_type character varying DEFAULT 'Lecture Room',  -- Primary_Type from CSV
  specific_classification character varying,  -- Specific_Classification from CSV
  capacity integer NOT NULL DEFAULT 30,  -- Capacity from CSV
  is_airconditioned boolean,  -- Is_Airconditioned from CSV (can be null)
  has_whiteboard boolean DEFAULT true,  -- Has_Whiteboard from CSV
  has_tv boolean DEFAULT false,  -- Has_TV from CSV
  school_name character varying,
  file_name character varying,
  status character varying DEFAULT 'active',
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT rooms_v2_pkey PRIMARY KEY (id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_rooms_v2_room_code ON public.rooms_v2(room_code);
CREATE INDEX IF NOT EXISTS idx_rooms_v2_building ON public.rooms_v2(building);
CREATE INDEX IF NOT EXISTS idx_rooms_v2_college ON public.rooms_v2(college);
CREATE INDEX IF NOT EXISTS idx_rooms_v2_primary_type ON public.rooms_v2(primary_type);
CREATE INDEX IF NOT EXISTS idx_rooms_v2_upload_group_id ON public.rooms_v2(upload_group_id);
*/

-- =====================================================
-- View for displaying room data with "None" for empty values
-- =====================================================

CREATE OR REPLACE VIEW public.rooms_display AS
SELECT 
    id,
    upload_group_id,
    COALESCE(room_code, 'None') as room_id,
    COALESCE(room, 'Unknown Room') as room_name,
    COALESCE(building, 'Unknown Building') as building,
    COALESCE(floor_number::text, 'None') as floor,
    COALESCE(campus, 'Main Campus') as college,
    COALESCE(room_type, 'Classroom') as primary_type,
    COALESCE(specific_classification, 'None') as specific_classification,
    COALESCE(capacity, 30) as capacity,
    CASE 
        WHEN has_ac IS NULL THEN 'None'
        WHEN has_ac = true THEN 'Yes'
        ELSE 'No'
    END as is_airconditioned,
    CASE 
        WHEN has_whiteboard IS NULL THEN 'None'
        WHEN has_whiteboard = true THEN 'Yes'
        ELSE 'No'
    END as has_whiteboard,
    CASE 
        WHEN has_tv IS NULL THEN 'None'
        WHEN has_tv = true THEN 'Yes'
        ELSE 'No'
    END as has_tv,
    school_name,
    file_name,
    status,
    created_at,
    updated_at
FROM public.campuses;

COMMENT ON VIEW public.rooms_display IS 'View that displays room data with "None" for empty/null values';
