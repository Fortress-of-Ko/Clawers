import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  if (!id || !/^[a-f0-9-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Atomic toggle via RPC (handles insert/delete + like_count in one call)
  // auth.uid() is used internally by the function — no p_user_id parameter
  const { data, error } = await supabase.rpc('clawers_toggle_like', {
    p_post_id: id,
  });

  if (error) {
    console.error('[clawers/like] toggle failed:', error.message);
    return NextResponse.json({ error: 'Failed to toggle like' }, { status: 500 });
  }

  return NextResponse.json(data);
}
