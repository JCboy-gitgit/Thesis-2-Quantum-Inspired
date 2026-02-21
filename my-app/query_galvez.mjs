import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kvumxksxecdpfbryjnsi.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2dW14a3N4ZWNkcGZicnlqbnNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzY4MTMyOCwiZXhwIjoyMDgzMjU3MzI4fQ.KfsRvujjywnFuHNTO2ghpJ16TpnZA51X6q5EhfXIrcU'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function run() {
    const { data } = await supabase.from('faculty_profiles').select('id, user_id, full_name').eq('full_name', 'Galvez, Arcel F.')
    console.log(data)
}
run()
