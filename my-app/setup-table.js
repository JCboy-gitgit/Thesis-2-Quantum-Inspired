import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kvumxksxecdpfbryjnsi.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2dW14a3N4ZWNkcGZicnlqbnNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzY4MTMyOCwiZXhwIjoyMDgzMjU3MzI4fQ.KfsRvujjywnFuHNTO2ghpJ16TpnZA51X6q5EhfXIrcU'

const supabase = createClient(supabaseUrl, supabaseKey)

const sql = `
create table IF NOT EXISTS public.bulsu_colleges (
  id serial not null,
  code character varying(20) not null,
  name character varying(255) not null,
  short_name character varying(100) null,
  color character varying(100) null default 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'::character varying,
  is_active boolean null default true,
  display_order integer null default 0,
  created_at timestamp with time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone null default CURRENT_TIMESTAMP,
  constraint bulsu_colleges_pkey primary key (id),
  constraint bulsu_colleges_code_key unique (code)
) TABLESPACE pg_default;

create index IF not exists idx_bulsu_colleges_code on public.bulsu_colleges using btree (code) TABLESPACE pg_default;
create index IF not exists idx_bulsu_colleges_active on public.bulsu_colleges using btree (is_active) TABLESPACE pg_default;
create index IF not exists idx_bulsu_colleges_order on public.bulsu_colleges using btree (display_order) TABLESPACE pg_default;
`

async function main() {
    // Instead of querying via RPC query directly if we can't...
    // Wait, supabase client doesn't expose a raw query.
    // We can use a REST approach or pg? Let's just create it.

    // Since we don't have direct SQL exec, we'll try to insert a dummy. If it errors "relation does not exist", we know we need to create it manually in the dashboard.
    const { data, error } = await supabase.from('bulsu_colleges').select('id').limit(1);
    console.log("Check existence:", error ? error.message : "Exists!")
}

main()
