import type { Metadata } from 'next';
import Link from 'next/link';
import { Star, MapPin } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSupabaseServer } from '@/lib/supabase/admin';
import { type ReviewRow, reviewImageUrl } from '@/lib/spot-types';
import { timeAgo } from '@/lib/shared';
import MotionWrapper from '@/components/MotionWrapper';

type Props = {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ page?: string }>;
};

type EnrichedReview = ReviewRow & {
    spot_name: string | null;
    spot_area: string | null;
};

const PAGE_SIZE = 20;

async function fetchReviews(page = 1): Promise<{ reviews: EnrichedReview[]; total: number; hasMore: boolean }> {
    const supabase = getSupabaseServer();
    if (!supabase) return { reviews: [], total: 0, hasMore: false };

    const offset = (page - 1) * PAGE_SIZE;

    const { data, count, error } = await supabase
        .from('clawers_spot_reviews')
        .select('id, spot_id, user_id, rating, content, images, created_at, updated_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
        console.error('[clawers/reviews] page fetch failed:', error.message);
        return { reviews: [], total: 0, hasMore: false };
    }

    const reviews = data ?? [];

    // Join profiles
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

    // Join spots
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

    const enriched: EnrichedReview[] = reviews.map(r => ({
        ...r,
        display_name: profileMap[r.user_id]?.display_name ?? '크로러',
        avatar_url: profileMap[r.user_id]?.avatar_url ?? undefined,
        spot_name: spotMap[r.spot_id]?.place_name ?? spotMap[r.spot_id]?.area ?? null,
        spot_area: spotMap[r.spot_id]?.area ?? null,
    }));

    const total = count ?? 0;
    return { reviews: enriched, total, hasMore: offset + PAGE_SIZE < total };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'reviews' });
    return { title: t('pageTitle'), description: t('pageDesc') };
}

function Stars({ rating }: { rating: number }) {
    return (
        <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }, (_, i) => (
                <Star
                    key={i}
                    size={14}
                    fill={i < rating ? '#f59e0b' : '#e5e7eb'}
                    stroke="none"
                />
            ))}
        </div>
    );
}

export default async function ReviewsPage({ params, searchParams }: Props) {
    const { locale } = await params;
    setRequestLocale(locale);
    const sp = await searchParams;
    const page = Math.max(1, Number(sp.page) || 1);
    const t = await getTranslations({ locale, namespace: 'reviews' });

    const { reviews, total, hasMore } = await fetchReviews(page);

    return (
        <section>
            <MotionWrapper delay={0}>
                <div className="mb-8">
                    <h1 className="text-[28px] sm:text-[36px] font-black tracking-tight">{t('pageTitle')}</h1>
                    <p className="text-[14px] sm:text-[15px] text-[#86868b] mt-1">{t('pageDesc')}</p>
                    <p className="text-[13px] text-[#86868b] mt-2">{t('totalCount', { count: total })}</p>
                </div>
            </MotionWrapper>

            {reviews.length === 0 ? (
                <MotionWrapper delay={0.05}>
                    <div className="text-center py-20">
                        <Star size={48} className="mx-auto text-[#e5e7eb] mb-4" />
                        <p className="text-[15px] font-bold text-[#86868b]">{t('empty')}</p>
                        <p className="text-[13px] text-[#86868b] mt-1">{t('emptyDesc')}</p>
                    </div>
                </MotionWrapper>
            ) : (
                <div className="grid gap-4">
                    {reviews.map((review, i) => (
                        <MotionWrapper key={review.id} delay={0.03 * i}>
                            <div className="rounded-[16px] border border-white/80 bg-white/75 backdrop-blur-sm p-5 transition-all hover:shadow-md">
                                {/* Header: user + spot link */}
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-100 to-pink-200 flex items-center justify-center text-[13px] font-extrabold text-pink-600 shrink-0">
                                            {(review.display_name ?? '크')[0]}
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-extrabold text-[#1d1d1f]">{review.display_name ?? '크로러'}</p>
                                            <p className="text-[11px] text-[#86868b]">{timeAgo(review.created_at)}</p>
                                        </div>
                                    </div>
                                    {review.spot_name && (
                                        <Link
                                            href={`/${locale}/spot/${review.spot_id}`}
                                            className="flex items-center gap-1 text-[12px] font-bold text-[#e64980] hover:text-[#d03870] transition shrink-0"
                                        >
                                            <MapPin size={12} />
                                            <span className="max-w-[140px] truncate">{review.spot_name}</span>
                                        </Link>
                                    )}
                                </div>

                                {/* Rating */}
                                <Stars rating={review.rating} />

                                {/* Content */}
                                <p className="mt-2 text-[13px] text-[#1d1d1f] leading-relaxed line-clamp-3">{review.content}</p>

                                {/* Images */}
                                {review.images.length > 0 && (
                                    <div className="flex gap-2 mt-3">
                                        {review.images.map((path) => (
                                            <img
                                                key={path}
                                                src={reviewImageUrl(path)}
                                                alt=""
                                                className="w-20 h-20 rounded-xl object-cover border border-white/80 shadow-sm"
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </MotionWrapper>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {total > PAGE_SIZE && (
                <div className="flex justify-center items-center gap-4 mt-8">
                    {page > 1 && (
                        <Link
                            href={`/${locale}/reviews?page=${page - 1}`}
                            className="px-4 py-2 rounded-xl bg-white/80 text-[13px] font-bold text-[#1d1d1f] hover:bg-white transition shadow-sm"
                        >
                            {t('prev')}
                        </Link>
                    )}
                    <span className="text-[13px] text-[#86868b] font-medium">{page} / {Math.ceil(total / PAGE_SIZE)}</span>
                    {hasMore && (
                        <Link
                            href={`/${locale}/reviews?page=${page + 1}`}
                            className="px-4 py-2 rounded-xl bg-white/80 text-[13px] font-bold text-[#1d1d1f] hover:bg-white transition shadow-sm"
                        >
                            {t('next')}
                        </Link>
                    )}
                </div>
            )}
        </section>
    );
}
