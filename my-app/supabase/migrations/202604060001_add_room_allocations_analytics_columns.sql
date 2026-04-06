-- Adds optional analytics columns used by the schedule generator.
-- This prevents inserts from silently dropping useful identifiers.

alter table if exists public.room_allocations
  add column if not exists day_of_week text,
  add column if not exists room_code text,
  add column if not exists section_code text,
  add column if not exists section_id bigint,
  add column if not exists teacher_id bigint;
