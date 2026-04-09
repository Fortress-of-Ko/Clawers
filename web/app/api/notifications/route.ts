import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20));
    const offset = (page - 1) * limit;

    // Fetch notifications + unread count in parallel
    const [notifRes, countRes] = await Promise.all([
        supabase
            .from('clawers_notifications')
            .select('id, type, post_id, actor_id, is_read, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1),
        supabase
            .from('clawers_notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_read', false),
    ]);

    if (notifRes.error) {
        console.error('[clawers/notifications] query failed:', notifRes.error.message);
        return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
    }

    const notifications = notifRes.data ?? [];

    // Hydrate with actor profiles and post titles
    const actorIds = [...new Set(notifications.map(n => n.actor_id))];
    const postIds = [...new Set(notifications.map(n => n.post_id))];

    const [profilesRes, postsRes] = await Promise.all([
        actorIds.length > 0
            ? supabase.from('clawers_profiles').select('user_id, display_name, avatar_url').in('user_id', actorIds)
            : { data: [] },
        postIds.length > 0
            ? supabase.from('clawers_posts').select('id, title').in('id', postIds)
            : { data: [] },
    ]);

    const profileMap = new Map((profilesRes.data ?? []).map(p => [p.user_id, p]));
    const postMap = new Map((postsRes.data ?? []).map(p => [p.id, p]));

    const enriched = notifications.map(n => ({
        ...n,
        actor: profileMap.get(n.actor_id) ?? { display_name: '크로러', avatar_url: null },
        post: postMap.get(n.post_id) ?? { title: '삭제된 글' },
    }));

    return NextResponse.json({
        notifications: enriched,
        unread_count: countRes.count ?? 0,
        page,
    });
}

export async function PATCH(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    if (body.all === true) {
        const { error } = await supabase
            .from('clawers_notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('is_read', false);

        if (error) {
            console.error('[clawers/notifications] mark all read failed:', error.message);
            return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
        }
        return NextResponse.json({ ok: true });
    }

    if (typeof body.id === 'string' && /^[a-f0-9-]{36}$/i.test(body.id)) {
        const { error } = await supabase
            .from('clawers_notifications')
            .update({ is_read: true })
            .eq('id', body.id)
            .eq('user_id', user.id);

        if (error) {
            console.error('[clawers/notifications] mark read failed:', error.message);
            return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
        }
        return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
}
