-- Create room_images table for storing room pictures
-- This table links to the campuses table (rooms) via room_id

CREATE TABLE IF NOT EXISTS public.room_images (
    id BIGSERIAL PRIMARY KEY,
    room_id BIGINT NOT NULL,
    image_url TEXT NOT NULL,
    caption TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    uploaded_by UUID REFERENCES auth.users(id),
    
    -- Foreign key constraint to campuses table (room records)
    CONSTRAINT fk_room_images_room 
        FOREIGN KEY (room_id) 
        REFERENCES public.campuses(id) 
        ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_room_images_room_id 
    ON public.room_images(room_id);

CREATE INDEX IF NOT EXISTS idx_room_images_uploaded_at 
    ON public.room_images(uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_room_images_uploaded_by 
    ON public.room_images(uploaded_by);

-- Add comments for documentation
COMMENT ON TABLE public.room_images IS 'Stores images/photos for rooms in the campuses table';
COMMENT ON COLUMN public.room_images.id IS 'Primary key';
COMMENT ON COLUMN public.room_images.room_id IS 'Foreign key to campuses.id (room record)';
COMMENT ON COLUMN public.room_images.image_url IS 'URL or path to the room image (can be Supabase Storage URL)';
COMMENT ON COLUMN public.room_images.caption IS 'Optional description or caption for the image';
COMMENT ON COLUMN public.room_images.uploaded_at IS 'Timestamp when the image was uploaded';
COMMENT ON COLUMN public.room_images.uploaded_by IS 'Reference to the user who uploaded the image';

-- Enable Row Level Security (RLS)
ALTER TABLE public.room_images ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow authenticated users to read all room images
CREATE POLICY "Allow authenticated users to read room images"
    ON public.room_images
    FOR SELECT
    TO authenticated
    USING (true);

-- RLS Policy: Allow authenticated users to insert room images
CREATE POLICY "Allow authenticated users to insert room images"
    ON public.room_images
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- RLS Policy: Allow users to update their own uploaded images or admin to update any
CREATE POLICY "Allow users to update their own room images"
    ON public.room_images
    FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = uploaded_by OR
        auth.email() = current_setting('app.settings.admin_email', true)
    )
    WITH CHECK (
        auth.uid() = uploaded_by OR
        auth.email() = current_setting('app.settings.admin_email', true)
    );

-- RLS Policy: Allow users to delete their own uploaded images or admin to delete any
CREATE POLICY "Allow users to delete their own room images"
    ON public.room_images
    FOR DELETE
    TO authenticated
    USING (
        auth.uid() = uploaded_by OR
        auth.email() = current_setting('app.settings.admin_email', true)
    );

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_images TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.room_images_id_seq TO authenticated;

-- Example queries for testing:

-- Insert a room image
-- INSERT INTO public.room_images (room_id, image_url, caption, uploaded_by)
-- VALUES (123, 'https://your-storage-url.com/room-image.jpg', 'Front view of the classroom', auth.uid());

-- Get all images for a specific room
-- SELECT * FROM public.room_images WHERE room_id = 123 ORDER BY uploaded_at DESC;

-- Get all images uploaded by current user
-- SELECT * FROM public.room_images WHERE uploaded_by = auth.uid() ORDER BY uploaded_at DESC;

-- Delete all images for a room (cascades automatically when room is deleted)
-- DELETE FROM public.room_images WHERE room_id = 123;
