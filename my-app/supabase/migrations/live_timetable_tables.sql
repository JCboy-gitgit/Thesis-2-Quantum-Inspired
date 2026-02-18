-- ═══════════════════════════════════════════════════════════════
-- Live Timetable Tables Migration
-- Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Weekly admin overrides (resets every Sunday)
--    Allows admin to move/reschedule a class for the current week only
CREATE TABLE IF NOT EXISTS live_timetable_overrides (
    id              BIGSERIAL PRIMARY KEY,
    schedule_id     BIGINT NOT NULL REFERENCES generated_schedules(id) ON DELETE CASCADE,
    allocation_id   BIGINT NOT NULL REFERENCES room_allocations(id) ON DELETE CASCADE,
    week_start      DATE NOT NULL,          -- Monday of the week (YYYY-MM-DD)
    override_day    TEXT,                   -- New day (e.g. 'Wednesday')
    override_time   TEXT,                   -- New time (e.g. '7:30 AM - 9:00 AM')
    override_room   TEXT,                   -- New room name
    override_building TEXT,                 -- New building name
    note            TEXT,                   -- Admin note / reason
    created_by      UUID REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (schedule_id, allocation_id, week_start)
);

-- 2. Faculty absences (faculty marks a class as absent)
CREATE TABLE IF NOT EXISTS live_timetable_absences (
    id              BIGSERIAL PRIMARY KEY,
    schedule_id     BIGINT REFERENCES generated_schedules(id) ON DELETE SET NULL,
    allocation_id   BIGINT NOT NULL REFERENCES room_allocations(id) ON DELETE CASCADE,
    faculty_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    absence_date    DATE NOT NULL,          -- The specific date of the absence
    reason          TEXT,
    status          TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'disputed')),
    admin_note      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Makeup class requests (faculty requests a makeup session)
CREATE TABLE IF NOT EXISTS live_makeup_requests (
    id                    BIGSERIAL PRIMARY KEY,
    schedule_id           BIGINT REFERENCES generated_schedules(id) ON DELETE SET NULL,
    allocation_id         BIGINT NOT NULL REFERENCES room_allocations(id) ON DELETE CASCADE,
    faculty_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    original_absence_date DATE,            -- Links to the absence this makeup is for
    requested_date        DATE NOT NULL,   -- Proposed makeup date
    requested_time        TEXT NOT NULL,   -- Proposed time (e.g. '7:30 AM - 9:00 AM')
    requested_room        TEXT,            -- Preferred room (optional)
    reason                TEXT,
    status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_note            TEXT,
    reviewed_at           TIMESTAMPTZ,
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_lto_schedule_week ON live_timetable_overrides(schedule_id, week_start);
CREATE INDEX IF NOT EXISTS idx_lta_faculty_date ON live_timetable_absences(faculty_id, absence_date);
CREATE INDEX IF NOT EXISTS idx_lta_allocation ON live_timetable_absences(allocation_id);
CREATE INDEX IF NOT EXISTS idx_lmr_faculty ON live_makeup_requests(faculty_id);
CREATE INDEX IF NOT EXISTS idx_lmr_status ON live_makeup_requests(status);

-- ── Row Level Security ────────────────────────────────────────────
ALTER TABLE live_timetable_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_timetable_absences  ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_makeup_requests     ENABLE ROW LEVEL SECURITY;

-- Overrides: only service role can write (admin API uses service role)
CREATE POLICY "overrides_read_all" ON live_timetable_overrides
    FOR SELECT USING (true);

CREATE POLICY "overrides_service_write" ON live_timetable_overrides
    FOR ALL USING (auth.role() = 'service_role');

-- Absences: faculty can read their own; service role can read all
CREATE POLICY "absences_read_own" ON live_timetable_absences
    FOR SELECT USING (faculty_id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "absences_service_write" ON live_timetable_absences
    FOR ALL USING (auth.role() = 'service_role');

-- Makeup requests: faculty can read their own; service role can read all
CREATE POLICY "makeup_read_own" ON live_makeup_requests
    FOR SELECT USING (faculty_id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "makeup_service_write" ON live_makeup_requests
    FOR ALL USING (auth.role() = 'service_role');

-- ── Realtime ─────────────────────────────────────────────────────
-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE live_timetable_overrides;
ALTER PUBLICATION supabase_realtime ADD TABLE live_timetable_absences;
ALTER PUBLICATION supabase_realtime ADD TABLE live_makeup_requests;

-- ── Weekly Reset Function (optional cron job) ─────────────────────
-- You can set up a pg_cron job to auto-clear overrides every Sunday at midnight
-- Example (run in Supabase SQL Editor after enabling pg_cron extension):
--
-- SELECT cron.schedule(
--   'reset-live-timetable-weekly',
--   '0 0 * * 0',   -- Every Sunday at midnight
--   $$
--     DELETE FROM live_timetable_overrides
--     WHERE week_start < date_trunc('week', NOW())::date;
--   $$
-- );
