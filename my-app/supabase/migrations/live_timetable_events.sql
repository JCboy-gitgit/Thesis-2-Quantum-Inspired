-- Supabase SQL Editor
-- Create a table specifically for Special Events / Room Unavailability
CREATE TABLE IF NOT EXISTS live_special_events (
    id SERIAL PRIMARY KEY,
    room TEXT NOT NULL,
    building TEXT NOT NULL,
    event_date DATE NOT NULL,
    time_start TEXT,
    time_end TEXT,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Turn on Row Level Security
ALTER TABLE live_special_events ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read events
CREATE POLICY "events_read_all" ON live_special_events FOR SELECT USING (true);

-- Allow service role to write
CREATE POLICY "events_service_write" ON live_special_events FOR ALL USING (auth.role() = 'service_role');

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE live_special_events;
