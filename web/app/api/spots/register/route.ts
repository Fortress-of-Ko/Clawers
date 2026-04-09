import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!checkRateLimit(`spot-register:${user.id}`, 20)) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await req.json();
    const { kakao_place_id, place_name, address, lat, lng } = body;

    if (!kakao_place_id || !place_name || !address || typeof lat !== 'number' || typeof lng !== 'number') {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('clawers_register_spot_from_kakao', {
        p_kakao_place_id: String(kakao_place_id),
        p_place_name: String(place_name).slice(0, 200),
        p_address: String(address).slice(0, 300),
        p_lat: lat,
        p_lng: lng,
    });

    if (error) {
        console.error('[clawers/spots/register] failed:', error.message);
        return NextResponse.json({ error: 'Failed to register spot' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
}
