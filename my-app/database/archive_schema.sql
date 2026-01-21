-- Archive Table Schema
-- This table stores soft-deleted items that can be restored or permanently deleted

CREATE TABLE IF NOT EXISTS archived_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('csv_file', 'department', 'faculty', 'schedule', 'room')),
    item_name VARCHAR(255) NOT NULL,
    item_data JSONB NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    original_table VARCHAR(100) NOT NULL,
    original_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_archived_items_type ON archived_items(item_type);
CREATE INDEX IF NOT EXISTS idx_archived_items_deleted_at ON archived_items(deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_archived_items_original ON archived_items(original_table, original_id);

-- Enable Row Level Security
ALTER TABLE archived_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Admins can manage archived items" ON archived_items;

-- Policy: Only admins can manage archived items
-- Using auth.jwt() instead of auth.users to avoid permission issues
CREATE POLICY "Admins can manage archived items" ON archived_items
    FOR ALL
    USING (
        (auth.jwt() ->> 'email') = 'admin123@ms.bulsu.edu.ph'
    );

-- Grant permissions
GRANT ALL ON archived_items TO authenticated;
GRANT ALL ON archived_items TO service_role;

-- Function to archive an item (soft delete)
CREATE OR REPLACE FUNCTION archive_item(
    p_item_type VARCHAR(50),
    p_item_name VARCHAR(255),
    p_item_data JSONB,
    p_original_table VARCHAR(100),
    p_original_id TEXT
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO archived_items (item_type, item_name, item_data, original_table, original_id, deleted_by)
    VALUES (p_item_type, p_item_name, p_item_data, p_original_table, p_original_id, auth.uid())
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to restore an archived item
CREATE OR REPLACE FUNCTION restore_archived_item(p_archive_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_item archived_items%ROWTYPE;
BEGIN
    -- Get the archived item
    SELECT * INTO v_item FROM archived_items WHERE id = p_archive_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Restore based on original table
    EXECUTE format(
        'INSERT INTO %I SELECT * FROM jsonb_populate_record(null::%I, $1) ON CONFLICT DO NOTHING',
        v_item.original_table,
        v_item.original_table
    ) USING v_item.item_data;
    
    -- Remove from archive
    DELETE FROM archived_items WHERE id = p_archive_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment on table
COMMENT ON TABLE archived_items IS 'Stores soft-deleted items for recovery. Items can be restored or permanently deleted.';
COMMENT ON COLUMN archived_items.item_type IS 'Type of archived item: csv_file, department, faculty, schedule, room';
COMMENT ON COLUMN archived_items.item_data IS 'JSON representation of the original item data';
COMMENT ON COLUMN archived_items.original_table IS 'Name of the original database table';
COMMENT ON COLUMN archived_items.original_id IS 'ID of the item in the original table';
