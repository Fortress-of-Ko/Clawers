import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseServer } from '@/lib/supabase/admin';
import MotionWrapper from '@/components/MotionWrapper';
import SpotHeader from '@/components/spot/SpotHeader';
import SpotMiniMap from '@/components/spot/SpotMiniMap';
import ReviewCard from '@/components/spot/ReviewCard';
import ReviewForm from '@/components/spot/ReviewForm';
import ReportButton from '@/components/spot/ReportButton';
import type { SpotRow, ReviewRow } from '@/lib/spot-types';

type Props = {
    params: Promise<{ locale: string; id: string }>;
    searchParams: Promise<{ page?: string }>;
};

const REVIEW_PAGE_SIZE = 10;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale, id } = await params;
    const t = await getTranslations({ locale, namespace: 'spot' });

    const supabase = getSupabaseServer();
    if (!supabase) return { title: t('title') };

    const { data: spot } = await supabase
        .from('clawers_spots')
        .select('place_name, area, point')
        .eq('id', id)
        .single();

    const name = spot?.place_name || spot?.point || t('title');
    return {
        title: `${name} | ${t('title')}`,
        description: `${spot?.area ?? ''} ${name}`,
    };
}

export default async function SpotDetailPage({ params, searchParams }: Props) {
    const { locale, id } = await params;
    setRequestLocale(locale);

    if (!id || !/^[a-f0-9-]{36}$/i.test(id)) notFound();

    const t = await getTranslations({ locale, namespace: 'spot' });
    const supabase = getSupabaseServer();
    if (!supabase) notFound();

    // Fetch spot
    const { data: spot } = await supabase
        .from('clawers_spots')
        .select('id, area, point, price, machines, lat, lng, place_name, kakao_place_id, like_count, review_count, avg_rating, verified, created_at')
        .eq('id', id)
        .single();

    if (!spot) notFound();

    // Fetch reviews (paginated)
    const sp = await searchParams;
    const page = Math.max(1, Number(sp.page) || 1);
    const offset = (page - 1) * REVIEW_PAGE_SIZE;

    const { data: reviewsRaw, count: reviewCount } = await supabase
        .from('clawers_spot_reviews')
        .select('id, spot_id, user_id, rating, content, images, created_at, updated_at', { count: 'exact' })
        .eq('spot_id', id)
        .order('created_at', { ascending: false })
        .range(offset, offset + REVIEW_PAGE_SIZE - 1);

    // Join profile data
    const userIds = [...new Set((reviewsRaw ?? []).map(r => r.user_id).filter(Boolean))];
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

    const reviews: ReviewRow[] = (reviewsRaw ?? []).map(r => ({
        ...r,
        display_name: profileMap[r.user_id]?.display_name ?? '크로러',
        avatar_url: profileMap[r.user_id]?.avatar_url ?? undefined,
    } as ReviewRow));

    const totalReviews = reviewCount ?? 0;
    const totalPages = Math.ceil(totalReviews / REVIEW_PAGE_SIZE) || 1;
    const hasMore = offset + REVIEW_PAGE_SIZE < totalReviews;

    // Check if current user liked this spot and has an existing review
    const authSupabase = await createClient();
    const { data: { user } } = await authSupabase.auth.getUser();

    let initialLiked = false;
    let existingReview: ReviewRow | null = null;

    if (user) {
        const [likeResult, reviewResult] = await Promise.all([
            supabase
                .from('clawers_spot_likes')
                .select('spot_id')
                .eq('spot_id', id)
                .eq('user_id', user.id)
                .maybeSingle(),
            supabase
                .from('clawers_spot_reviews')
                .select('id, spot_id, user_id, rating, content, images, created_at, updated_at')
                .eq('spot_id', id)
                .eq('user_id', user.id)
                .maybeSingle(),
        ]);

        initialLiked = !!likeResult.data;

        if (reviewResult.data) {
            existingReview = {
                ...reviewResult.data,
                display_name: profileMap[user.id]?.display_name ?? '크로러',
                avatar_url: profileMap[user.id]?.avatar_url ?? undefined,
            } as ReviewRow;
        }
    }

    const basePath = locale === 'ko' ? `/spot/${id}` : `/${locale}/spot/${id}`;

    function buildPageHref(pg: number) {
        return pg > 1 ? `${basePath}?page=${pg}` : basePath;
    }

    return (
        <div className="mx-auto w-full max-w-[720px] pb-16 flex flex-col gap-4 px-4">
            <MotionWrapper delay={0}>
                <section className="rounded-[24px] sm:rounded-[28px] bg-white/60 backdrop-blur-2xl border border-white/70 shadow-[0_8px_26px_rgba(0,0,0,0.05)] p-4 sm:p-6 space-y-5">
                    <SpotHeader
                        spot={spot as SpotRow}
                        initialLiked={initialLiked}
                        labels={{
                            machines: t('machines'),
                            reviewCount: t('reviewCount'),
                            liked: t('liked'),
                        }}
                    />

                    <SpotMiniMap
                        lat={spot.lat}
                        lng={spot.lng}
                        kakaoPlaceId={spot.kakao_place_id}
                        openMapLabel={t('openMap')}
                    />

                    <div className="flex justify-end pt-2">
                        <ReportButton spotId={id} label="신고" />
                    </div>
                </section>
            </MotionWrapper>

            {/* Review Form */}
            <MotionWrapper delay={0.06}>
                <section className="rounded-[24px] sm:rounded-[28px] bg-white/60 backdrop-blur-2xl border border-white/70 shadow-[0_8px_26px_rgba(0,0,0,0.05)] p-4 sm:p-5">
                    <h2 className="text-[16px] font-extrabold text-[#1d1d1f] mb-3">
                        {existingReview ? t('editReview') : t('writeReview')}
                    </h2>
                    <ReviewForm
                        spotId={id}
                        existingReview={existingReview}
                        isLoggedIn={!!user}
                        labels={{
                            rating: t('rating'),
                            contentPlaceholder: t('contentPlaceholder'),
                            photos: t('photos'),
                            submit: t('submit'),
                            update: t('update'),
                            minContent: t('minContent'),
                            maxPhotos: t('maxPhotos'),
                            loginRequired: t('loginRequired'),
                        }}
                    />
                </section>
            </MotionWrapper>

            {/* Review List */}
            <MotionWrapper delay={0.12}>
                <section className="rounded-[24px] sm:rounded-[28px] bg-white/60 backdrop-blur-2xl border border-white/70 shadow-[0_8px_26px_rgba(0,0,0,0.05)] p-3 sm:p-4 space-y-2">
                    <h2 className="text-[16px] font-extrabold text-[#1d1d1f] px-1">
                        {t('reviewCount', { count: totalReviews })}
                    </h2>

                    {reviews.length === 0 ? (
                        <div className="py-10 flex flex-col items-center justify-center text-center">
                            <span className="text-[42px] mb-3">🎪</span>
                            <h3 className="text-[18px] font-extrabold text-[#1d1d1f]">{t('noReviews')}</h3>
                            <p className="mt-1 text-[13px] font-medium text-[#86868b]">{t('firstReview')}</p>
                        </div>
                    ) : (
                        reviews.map((review) => (
                            <ReviewCard
                                key={review.id}
                                review={review}
                                isOwner={user?.id === review.user_id}
                                spotId={id}
                                onDeleted={() => {}}
                                onEdit={() => {}}
                                deleteLabel={t('deleteReview')}
                                editLabel={t('editReview')}
                                confirmLabel={t('deleteConfirm')}
                            />
                        ))
                    )}

                    {/* Pagination */}
                    {totalReviews > REVIEW_PAGE_SIZE && (
                        <div className="flex items-center justify-center gap-3 pt-4">
                            {page > 1 && (
                                <Link
                                    href={buildPageHref(page - 1)}
                                    className="rounded-full border border-[#e8e8ed] bg-white/75 px-4 py-2 text-[12px] font-bold text-[#6f6f76] hover:bg-white transition"
                                >
                                    {t('prev')}
                                </Link>
                            )}
                            <span className="text-[12px] text-[#87878f]">
                                {page} / {totalPages}
                            </span>
                            {hasMore && (
                                <Link
                                    href={buildPageHref(page + 1)}
                                    className="rounded-full border border-[#e8e8ed] bg-white/75 px-4 py-2 text-[12px] font-bold text-[#6f6f76] hover:bg-white transition"
                                >
                                    {t('next')}
                                </Link>
                            )}
                        </div>
                    )}
                </section>
            </MotionWrapper>
        </div>
    );
}
