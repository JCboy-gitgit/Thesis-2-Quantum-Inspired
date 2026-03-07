-- Add title fields for professional profile formatting.
-- Supports display formula: [Prefix] [Full Name], [Suffix]

alter table public.faculty_profiles
  add column if not exists name_prefix text,
  add column if not exists name_suffix text;

comment on column public.faculty_profiles.name_prefix is
  'Pre-nominal title, e.g., Mr., Ms., Mx., Dr., Prof., Rev., Fr., Atty., Engr.';

comment on column public.faculty_profiles.name_suffix is
  'Post-nominal credentials, e.g., Ph.D., MD, MBA, RN, CPA.';

-- Optional normalization checks to keep input clean and bounded.
alter table public.faculty_profiles
  drop constraint if exists faculty_profiles_name_prefix_len_check;

alter table public.faculty_profiles
  add constraint faculty_profiles_name_prefix_len_check
  check (name_prefix is null or char_length(trim(name_prefix)) <= 24);

alter table public.faculty_profiles
  drop constraint if exists faculty_profiles_name_suffix_len_check;

alter table public.faculty_profiles
  add constraint faculty_profiles_name_suffix_len_check
  check (name_suffix is null or char_length(trim(name_suffix)) <= 120);

-- Search helper indexes (immutable-safe).
create index if not exists idx_faculty_profiles_full_name_search
  on public.faculty_profiles (full_name);

create index if not exists idx_faculty_profiles_name_prefix_search
  on public.faculty_profiles (name_prefix);

create index if not exists idx_faculty_profiles_name_suffix_search
  on public.faculty_profiles (name_suffix);
