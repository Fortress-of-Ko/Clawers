export type SpotRow = {
    id: string;
    area: string;
    point: string;
    price: string;
    machines: number;
    lat: number;
    lng: number;
    place_name: string | null;
    kakao_place_id: string | null;
    like_count: number;
    review_count: number;
    avg_rating: number;
    verified: boolean;
    created_at: string;
};

export type ReviewRow = {
    id: string;
    spot_id: string;
    user_id: string;
    rating: number;
    content: string;
    images: string[];
    created_at: string;
    updated_at: string;
    display_name?: string;
    avatar_url?: string;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

/** Build full image URL from relative Storage path */
export function reviewImageUrl(relativePath: string): string {
    return `${SUPABASE_URL}/storage/v1/object/public/clawers-reviews/${relativePath}`;
}
