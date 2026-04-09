import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
    const { id } = await context.params;

    if (!id || !/^[a-f0-9-]{36}$/i.test(id)) {
        return NextResponse.json({ error: 'Invalid spot ID' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!checkRateLimit(`spot-report:${user.id}`, 10)) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await req.json();
    const reason = body.reason ?? 'closed';
    const note = body.note ? String(body.note).slice(0, 500) : null;

    const { data, error } = await supabase.rpc('clawers_report_spot', {
        p_spot_id: id,
        p_reason: reason,
        p_note: note,
    });

    if (error) {
        console.error('[clawers/spots/report] failed:', error.message);
        return NextResponse.json({ error: 'Failed to report' }, { status: 500 });
    }

    return NextResponse.json(data);
}
