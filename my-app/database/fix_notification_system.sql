-- ============================================================================
-- FIX NOTIFICATION SYSTEM & ARCHIVE
-- ============================================================================

-- 1. Ensure system_alerts table exists and has correct columns
CREATE TABLE IF NOT EXISTS public.system_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    audience TEXT NOT NULL CHECK (audience IN ('admin', 'faculty', 'all')),
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'success', 'warning', 'error')),
    category TEXT DEFAULT 'system',
    schedule_id INTEGER,
    created_by UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Ensure alert_receipts table exists with correct unique constraint
CREATE TABLE IF NOT EXISTS public.alert_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES public.system_alerts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'confirmed', 'dismissed')),
    read_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(alert_id, user_id)
);

-- 3. Ensure archived_items table exists and supports 'notification' type
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'archived_items') THEN
        CREATE TABLE public.archived_items (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            item_type TEXT NOT NULL, -- We'll use TEXT instead of ENUM for flexibility, or add check later
            item_name TEXT NOT NULL,
            item_data JSONB NOT NULL,
            deleted_at TIMESTAMPTZ DEFAULT NOW(),
            deleted_by UUID,
            original_table TEXT,
            original_id TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    ELSE
        -- Add 'notification' to check constraint if it exists
        -- First, find if there's a check constraint on item_type
        -- For simplicity in this fix, we'll just ensure the column is TEXT and remove any restrictive constraint
        ALTER TABLE public.archived_items ALTER COLUMN item_type TYPE TEXT;
    END IF;
END $$;

-- 4. Enable RLS and add policies for archived_items (so faculty can archive)
ALTER TABLE public.archived_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can insert their own archived items" ON public.archived_items;
DROP POLICY IF EXISTS "Users can view their own archived items" ON public.archived_items;
DROP POLICY IF EXISTS "Users can delete their own archived items" ON public.archived_items;

CREATE POLICY "Users can insert their own archived items" 
ON public.archived_items FOR INSERT 
WITH CHECK (auth.uid() = deleted_by OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Users can view their own archived items" 
ON public.archived_items FOR SELECT 
USING (auth.uid() = deleted_by OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Users can delete their own archived items" 
ON public.archived_items FOR DELETE 
USING (auth.uid() = deleted_by OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

-- 5. Ensure system_alerts and alert_receipts have RLS policies for faculty
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Faculty can view relevant alerts" ON public.system_alerts;
CREATE POLICY "Faculty can view relevant alerts" 
ON public.system_alerts FOR SELECT 
USING (audience IN ('faculty', 'all') OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Users can manage their own receipts" ON public.alert_receipts;
CREATE POLICY "Users can manage their own receipts" 
ON public.alert_receipts FOR ALL 
USING (auth.uid() = user_id OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

-- 6. Grant basic permissions
GRANT ALL ON public.system_alerts TO authenticated;
GRANT ALL ON public.alert_receipts TO authenticated;
GRANT ALL ON public.archived_items TO authenticated;
GRANT ALL ON public.system_alerts TO service_role;
GRANT ALL ON public.alert_receipts TO service_role;
GRANT ALL ON public.archived_items TO service_role;
