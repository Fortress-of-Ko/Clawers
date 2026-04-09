import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/admin';

export async function GET() {
    const supabase = getSupabaseServer();
    if (!supabase) {
        return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
    }

    const [totalRes, marketRes, soldRes] = await Promise.all([
        supabase.from('clawers_posts').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
        supabase.from('clawers_posts').select('id', { count: 'exact', head: true }).eq('is_deleted', false).eq('section', '사고팔기'),
        supabase.from('clawers_posts').select('id', { count: 'exact', head: true }).eq('is_deleted', false).eq('trade_status', 'sold'),
    ]);

    return NextResponse.json({
        totalPosts: totalRes.count ?? 0,
        marketPosts: marketRes.count ?? 0,
        soldItems: soldRes.count ?? 0,
    }, {
        headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' },
    });
}
