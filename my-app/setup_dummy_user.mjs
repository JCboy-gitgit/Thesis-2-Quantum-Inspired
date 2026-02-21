import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kvumxksxecdpfbryjnsi.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2dW14a3N4ZWNkcGZicnlqbnNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzY4MTMyOCwiZXhwIjoyMDgzMjU3MzI4fQ.KfsRvujjywnFuHNTO2ghpJ16TpnZA51X6q5EhfXIrcU'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function run() {
    let { data: users, error: listError } = await supabase.auth.admin.listUsers()

    let dummyUser = users?.users.find(u => u.email === 'system_event_placeholder@qtime.local')

    if (!dummyUser) {
        console.log("Creating dummy user...")
        const { data, error } = await supabase.auth.admin.createUser({
            email: 'system_event_placeholder@qtime.local',
            password: 'supersecretpassword123',
            email_confirm: true
        })
        if (error) { console.error("Create user error", error); return; }
        dummyUser = data.user

        // Add to faculty_profiles
        await supabase.from('faculty_profiles').insert({
            user_id: dummyUser.id,
            email: dummyUser.email,
            full_name: 'System Event Placeholder',
            role: 'system',
            department_id: 1,
            is_active: false
        })
    }

    console.log("DUMMY_ID=", dummyUser.id)
}
run()
