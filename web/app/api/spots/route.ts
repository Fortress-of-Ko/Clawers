import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const area = searchParams.get('area');

  let query = supabase
    .from('clawers_spots')
    .select('id, area, point, price, machines, lat, lng, place_name, verified, created_at')
    .order('created_at', { ascending: false });

  if (area) {
    query = query.eq('area', area);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[clawers/spots] query failed:', error.message);
    return NextResponse.json({ error: 'Failed to fetch spots' }, { status: 500 });
  }

  return NextResponse.json({ spots: data ?? [] }, {
    headers: { 'Cache-Control': 'public, max-age=120, s-maxage=600' },
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { area, point, price, machines, lat, lng, place_name, kakao_place_id } = body;

  // Validate required fields
  if (!area || typeof area !== 'string' || !point || typeof point !== 'string') {
    return NextResponse.json({ error: 'area and point are required' }, { status: 400 });
  }
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'lat and lng must be numbers' }, { status: 400 });
  }

  // Check for duplicate by kakao_place_id or coordinates
  if (kakao_place_id) {
    const { data: existing } = await supabase
      .from('clawers_spots')
      .select('id')
      .eq('kakao_place_id', kakao_place_id)
      .limit(1);
    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'Spot already exists' }, { status: 409 });
    }
  }

  const { data, error } = await supabase
    .from('clawers_spots')
    .insert({
      area: String(area).slice(0, 50),
      point: String(point).slice(0, 100),
      price: price ? String(price).slice(0, 50) : null,
      machines: typeof machines === 'number' ? Math.max(0, Math.min(999, machines)) : 0,
      lat,
      lng,
      place_name: place_name ? String(place_name).slice(0, 100) : null,
      kakao_place_id: kakao_place_id ? String(kakao_place_id).slice(0, 50) : null,
      added_by: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('[clawers/spots] insert failed:', error.message);
    return NextResponse.json({ error: 'Failed to add spot' }, { status: 500 });
  }

  // Increment spot_count on profile
  try {
    await supabase.rpc('clawers_increment_spot_count');
  } catch (err) { console.warn('[clawers] increment spot_count failed:', err); }

  return NextResponse.json(data, { status: 201 });
}
