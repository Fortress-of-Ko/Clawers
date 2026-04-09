import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseServer } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';

const VALID_SECTIONS = ['정보공유', '후기', '질문', '사고팔기'] as const;
const VALID_SORTS = ['latest', 'popular'] as const;

export async function GET(req: NextRequest) {
    const supabase = getSupabaseServer();
    if (!supabase) {
        return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
    }

    const { searchParams } = new URL(req.url);
    const section = searchParams.get('section');
    const area = searchParams.get('area');
    const tradeStatus = searchParams.get('trade_status');
    const sort = searchParams.get('sort') || 'latest';
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20));
    const offset = (page - 1) * limit;

    let query = supabase
        .from('clawers_posts')
        .select('id, user_id, section, title, content, area, images, price_krw, trade_status, view_count, like_count, comment_count, created_at, clawers_profiles(display_name, avatar_url)', { count: 'exact' })
        .eq('is_deleted', false);

    if (section && VALID_SECTIONS.includes(section as typeof VALID_SECTIONS[number])) {
        query = query.eq('section', section);
    }
    if (area) {
        query = query.eq('area', area);
    }
    if (tradeStatus) {
        query = query.eq('trade_status', tradeStatus);
    }

    if (sort === 'popular') {
        query = query.order('like_count', { ascending: false }).order('created_at', { ascending: false });
    } else {
        query = query.order('created_at', { ascending: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
        console.error('[clawers/posts] query failed:', error.message);
        return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
    }

    const total = count ?? 0;

    return NextResponse.json({
        posts: data ?? [],
        total,
        page,
        hasMore: offset + limit < total,
    });
}

export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!checkRateLimit(`post-create:${user.id}`, 10)) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await req.json();
    const section = body.section;
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 100) : '';
    const content = typeof body.content === 'string' ? body.content.trim().slice(0, 5000) : '';
    const area = typeof body.area === 'string' ? body.area.trim().slice(0, 50) : '';
    const priceKrw = typeof body.price_krw === 'number' ? body.price_krw : null;
    const tradeStatus = body.trade_status === 'selling' ? 'selling' : null;
    const spotId = typeof body.spot_id === 'string' && /^[a-f0-9-]{36}$/i.test(body.spot_id) ? body.spot_id : null;

    if (!VALID_SECTIONS.includes(section as typeof VALID_SECTIONS[number])) {
        return NextResponse.json({ error: 'Invalid section' }, { status: 400 });
    }
    if (!title || !content) {
        return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('clawers_posts')
        .insert({
            section,
            title,
            content,
            area,
            price_krw: priceKrw,
            trade_status: section === '사고팔기' ? (tradeStatus ?? 'selling') : null,
            spot_id: spotId,
            user_id: user.id,
        })
        .select()
        .single();

    if (error) {
        console.error('[clawers/posts] insert failed:', error.message, error.details, error.hint);
        return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
    }

    // Ensure profile exists & increment post_count
    await supabase
        .from('clawers_profiles')
        .upsert({
            user_id: user.id,
            display_name: user.user_metadata?.full_name?.split(' ')[0] ?? user.email?.split('@')[0] ?? '크로러',
        }, { onConflict: 'user_id', ignoreDuplicates: true });
    try {
        await supabase.rpc('clawers_increment_post_count', { p_user_id: user.id });
    } catch (err) { console.warn('[clawers] increment post_count failed:', err); }

    return NextResponse.json(data, { status: 201 });
}
