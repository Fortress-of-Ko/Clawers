import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseServer } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';

type RouteContext = { params: Promise<{ id: string }> };

const PAGE_SIZE = 10;

export async function GET(req: NextRequest, context: RouteContext) {
    const { id } = await context.params;

    if (!id || !/^[a-f0-9-]{36}$/i.test(id)) {
        return NextResponse.json({ error: 'Invalid spot ID' }, { status: 400 });
    }

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
        .eq('spot_id', id)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
        console.error('[clawers/reviews] fetch failed:', error.message);
        return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
    }

    // Join display_name from clawers_profiles
    const userIds = [...new Set((data ?? []).map(r => r.user_id).filter(Boolean))];
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

    const reviews = (data ?? []).map(r => ({
        ...r,
        display_name: profileMap[r.user_id]?.display_name ?? '크로러',
        avatar_url: profileMap[r.user_id]?.avatar_url ?? null,
    }));

    const total = count ?? 0;
    return NextResponse.json({
        reviews,
        total,
        page,
        hasMore: offset + PAGE_SIZE < total,
    });
}

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

    if (!checkRateLimit(`spot-review:${user.id}`, 10)) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await req.json();
    const rating = Number(body.rating);
    const content = (body.content ?? '').trim();
    const IMAGE_PATH_RE = /^[a-f0-9-]{36}\/[a-f0-9-]{36}\/\d+\.webp$/;
    const images: string[] = Array.isArray(body.images)
        ? body.images.slice(0, 3).filter((p: unknown) => typeof p === 'string' && IMAGE_PATH_RE.test(p))
        : [];

    if (!rating || rating < 1 || rating > 5) {
        return NextResponse.json({ error: 'Rating must be 1-5' }, { status: 400 });
    }
    if (content.length < 10) {
        return NextResponse.json({ error: 'Content must be at least 10 characters' }, { status: 400 });
    }
    if (content.length > 2000) {
        return NextResponse.json({ error: 'Content must be at most 2000 characters' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('clawers_upsert_spot_review', {
        p_spot_id: id,
        p_rating: rating,
        p_content: content,
        p_images: images,
    });

    if (error) {
        console.error('[clawers/reviews] upsert failed:', error.message);
        return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest, context: RouteContext) {
    const { id } = await context.params;

    if (!id || !/^[a-f0-9-]{36}$/i.test(id)) {
        return NextResponse.json({ error: 'Invalid spot ID' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!checkRateLimit(`spot-review-delete:${user.id}`, 10)) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { data, error } = await supabase.rpc('clawers_delete_spot_review', {
        p_spot_id: id,
    });

    if (error) {
        console.error('[clawers/reviews] delete failed:', error.message);
        return NextResponse.json({ error: 'Failed to delete review' }, { status: 500 });
    }

    // Clean up images from Storage
    const images: string[] = data?.images ?? [];
    if (images.length > 0) {
        const { error: storageError } = await supabase.storage
            .from('clawers-reviews')
            .remove(images);

        if (storageError) {
            console.warn('[clawers/reviews] storage cleanup failed:', storageError.message);
        }
    }

    return NextResponse.json({ deleted: true });
}
