import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kvumxksxecdpfbryjnsi.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2dW14a3N4ZWNkcGZicnlqbnNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzY4MTMyOCwiZXhwIjoyMDgzMjU3MzI4fQ.KfsRvujjywnFuHNTO2ghpJ16TpnZA51X6q5EhfXIrcU'

const supabase = createClient(supabaseUrl, supabaseKey)

const DEFAULT_COLLEGES = [
    { id: 1, code: 'CAFA', name: 'College of Architecture and Fine Arts', short_name: 'Architecture & Fine Arts', display_order: 1, is_active: true },
    { id: 2, code: 'CAL', name: 'College of Arts and Letters', short_name: 'Arts & Letters', display_order: 2, is_active: true },
    { id: 3, code: 'CBEA', name: 'College of Business Education and Accountancy', short_name: 'Business Education', display_order: 3, is_active: true },
    { id: 4, code: 'CCJE', name: 'College of Criminal Justice Education', short_name: 'Criminal Justice', display_order: 4, is_active: true },
    { id: 5, code: 'CHTM', name: 'College of Hospitality and Tourism Management', short_name: 'Hospitality & Tourism', display_order: 5, is_active: true },
    { id: 6, code: 'CICT', name: 'College of Information and Communications Technology', short_name: 'Info & Comm Tech', display_order: 6, is_active: true },
    { id: 7, code: 'CIT', name: 'College of Industrial Technology', short_name: 'Industrial Technology', display_order: 7, is_active: true },
    { id: 8, code: 'CLaw', name: 'College of Law', short_name: 'Law', display_order: 8, is_active: true },
    { id: 9, code: 'CN', name: 'College of Nursing', short_name: 'Nursing', display_order: 9, is_active: true },
    { id: 10, code: 'COE', name: 'College of Engineering', short_name: 'Engineering', display_order: 10, is_active: true },
    { id: 11, code: 'COED', name: 'College of Education', short_name: 'Education', display_order: 11, is_active: true },
    { id: 12, code: 'CS', name: 'College of Science', short_name: 'Science', display_order: 12, is_active: true },
    { id: 13, code: 'CSER', name: 'College of Sports, Exercise and Recreation', short_name: 'Sports & Recreation', display_order: 13, is_active: true },
    { id: 14, code: 'CSSP', name: 'College of Social Sciences and Philosophy', short_name: 'Social Sciences', display_order: 14, is_active: true },
    { id: 15, code: 'GS', name: 'Graduate School', short_name: 'Graduate School', display_order: 15, is_active: true }
];

async function main() {
    const { data: currentData } = await supabase.from('bulsu_colleges').select('*');
    console.log("Current row count:", currentData ? currentData.length : 0);

    if (!currentData || currentData.length === 0) {
        console.log("Seeding colleges...");
        const { data, error } = await supabase.from('bulsu_colleges').insert(DEFAULT_COLLEGES).select();
        if (error) {
            console.error("Seed error:", error);
        } else {
            console.log("Seeded", data.length, "rows.");
        }
    }
}

main()
