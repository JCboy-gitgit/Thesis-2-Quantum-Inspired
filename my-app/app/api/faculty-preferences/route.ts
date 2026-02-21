import { NextRequest, NextResponse as NextResp } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: any) {
    try {
        const { searchParams } = new URL(req.url);
        const facultyId = searchParams.get('faculty_id');

        if (facultyId) {
            // Get single faculty
            const { data, error } = await supabaseAdmin
                .from('faculty_time_preferences')
                .select('*')
                .eq('faculty_id', facultyId)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 is not found
                throw error;
            }
            return NextResp.json({ preferences: data?.preferences || {} });
        } else {
            // Get all
            const { data, error } = await supabaseAdmin
                .from('faculty_time_preferences')
                .select('faculty_id, preferences');
            if (error) throw error;
            return NextResp.json({ allPreferences: data });
        }
    } catch (error: any) {
        return NextResp.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: any) {
    try {
        const body = await req.json();
        const { faculty_id, preferences } = body;

        if (!faculty_id) return NextResp.json({ error: 'Missing faculty_id' }, { status: 400 });

        const { data, error } = await supabaseAdmin
            .from('faculty_time_preferences')
            .upsert({
                faculty_id,
                preferences,
                updated_at: new Date().toISOString()
            }, { onConflict: 'faculty_id' });

        if (error) throw error;

        return NextResp.json({ success: true });
    } catch (error: any) {
        return NextResp.json({ error: error.message }, { status: 500 });
    }
}
