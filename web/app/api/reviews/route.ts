import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/admin';

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
    const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1);
    const offset = (page - 1) * PAGE_SIZE;

    const supabase = getSupabaseServer();
    if (!supabase) {
        return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
    }

    const { data, count, error } = await supabase
        .from('clawers_spot_reviews')
        .select(
            'id, spot_id, user_id, rating, content, images, created_at, updated_at',
            { count: 'exact' },
        )
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
        console.error('[clawers/reviews] fetch all failed:', error.message);
        return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
    }

    const reviews = data ?? [];

    // Join display_name from profiles
    const userIds = [...new Set(reviews.map(r => r.user_id).filter(Boolean))];
    let profileMap: Record<string, { display_name: string; avatar_url: string | null }> = {};

    if (userIds.length > 0) {
        const { data: profiles } = await supabase
            .from('clawers_profiles')
            .select('user_id, display_name, avatar_url')
            .in('user_id', userIds);

        if (profiles) {
            profileMap = Object.fromEntries(
                profiles.map(p => [p.user_id, { display_name: p.display_name, avatar_url: p.avatar_url }]),
            );
        }
    }

    // Join spot place_name
    const spotIds = [...new Set(reviews.map(r => r.spot_id).filter(Boolean))];
    let spotMap: Record<string, { place_name: string | null; area: string }> = {};

    if (spotIds.length > 0) {
        const { data: spots } = await supabase
            .from('clawers_spots')
            .select('id, place_name, area')
            .in('id', spotIds);

        if (spots) {
            spotMap = Object.fromEntries(
                spots.map(s => [s.id, { place_name: s.place_name, area: s.area }]),
            );
        }
    }

    const enriched = reviews.map(r => ({
        ...r,
        display_name: profileMap[r.user_id]?.display_name ?? '크로러',
        avatar_url: profileMap[r.user_id]?.avatar_url ?? null,
        spot_name: spotMap[r.spot_id]?.place_name ?? spotMap[r.spot_id]?.area ?? null,
        spot_area: spotMap[r.spot_id]?.area ?? null,
    }));

    const total = count ?? 0;
    return NextResponse.json({
        reviews: enriched,
        total,
        page,
        hasMore: offset + PAGE_SIZE < total,
    });
}
