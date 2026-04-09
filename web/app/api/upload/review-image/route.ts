import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!checkRateLimit(`review-image:${user.id}`, 20)) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const spotId = formData.get('spot_id') as string | null;

    if (!file || !spotId) {
        return NextResponse.json({ error: 'File and spot_id are required' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });
    }

    if (!/^[a-f0-9-]{36}$/i.test(spotId)) {
        return NextResponse.json({ error: 'Invalid spot ID' }, { status: 400 });
    }

    const timestamp = Date.now();
    const relativePath = `${spotId}/${user.id}/${timestamp}.webp`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await supabase.storage
        .from('clawers-reviews')
        .upload(relativePath, buffer, {
            contentType: 'image/webp',
            upsert: false,
        });

    if (error) {
        console.error('[clawers/upload] failed:', error.message);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    return NextResponse.json({ path: relativePath }, { status: 201 });
}
