import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseServer } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
    const { id } = await context.params;

    if (!id || !/^[a-f0-9-]{36}$/i.test(id)) {
        return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    if (!supabase) {
        return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
    }

    // Increment view count
    try { await supabase.rpc('clawers_increment_view', { p_post_id: id }); } catch { /* ignore */ }

    // Fetch post
    const { data: post, error: postError } = await supabase
        .from('clawers_posts')
        .select('id, section, title, content, area, images, price_krw, trade_status, view_count, like_count, comment_count, created_at')
        .eq('id', id)
        .eq('is_deleted', false)
        .single();

    if (postError || !post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Fetch comments
    const { data: comments } = await supabase
        .from('clawers_comments')
        .select('id, content, created_at')
        .eq('post_id', id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

    return NextResponse.json({
        post,
        comments: comments ?? [],
    });
}

export async function PATCH(req: NextRequest, context: RouteContext) {
    const { id } = await context.params;
    if (!id || !/^[a-f0-9-]{36}$/i.test(id)) {
        return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!checkRateLimit(`post-edit:${user.id}`, 20)) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Verify ownership
    const { data: post } = await supabase
        .from('clawers_posts')
        .select('user_id')
        .eq('id', id)
        .eq('is_deleted', false)
        .single();

    if (!post || post.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (typeof body.title === 'string') updates.title = body.title.trim().slice(0, 100);
    if (typeof body.content === 'string') updates.content = body.content.trim().slice(0, 5000);
    if (typeof body.area === 'string') updates.area = body.area.trim().slice(0, 50);
    if (body.trade_status && ['selling', 'reserved', 'sold'].includes(body.trade_status)) {
        updates.trade_status = body.trade_status;
    }

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('clawers_posts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

    return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
    const { id } = await context.params;
    if (!id || !/^[a-f0-9-]{36}$/i.test(id)) {
        return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!checkRateLimit(`post-delete:${user.id}`, 10)) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Verify ownership
    const { data: post } = await supabase
        .from('clawers_posts')
        .select('user_id')
        .eq('id', id)
        .eq('is_deleted', false)
        .single();

    if (!post || post.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Soft delete
    const { error } = await supabase
        .from('clawers_posts')
        .update({ is_deleted: true })
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
}
