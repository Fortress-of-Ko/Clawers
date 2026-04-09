import type { Metadata } from 'next';
import Link from 'next/link';
import { Eye, MessageCircle, MapPin, Star } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { type PostRow, formatPrice, timeAgo } from '@/lib/shared';
import { getSupabaseServer } from '@/lib/supabase/admin';
import MotionWrapper from '@/components/MotionWrapper';
import { WritePostButton, LikeButton, PostActions } from '@/components/community/CommunityActions';
import CommunitySearch from '@/components/community/CommunitySearch';

type Props = {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ section?: string; page?: string; q?: string }>;
};

const SECTIONS = ['정보공유', '후기', '질문', '사고팔기'] as const;
const PAGE_SIZE = 20;

async function fetchPosts(
    section?: string,
    page = 1,
    q?: string,
): Promise<{ posts: PostRow[]; total: number; hasMore: boolean }> {
    const supabase = getSupabaseServer();
    if (!supabase) return { posts: [], total: 0, hasMore: false };

    const offset = (page - 1) * PAGE_SIZE;
    let query = supabase
        .from('clawers_posts')
        .select(
            'id, section, title, content, area, price_krw, trade_status, spot_id, view_count, like_count, comment_count, created_at',
            { count: 'exact' },
        )
        .eq('is_deleted', false);

    if (section === '_sold') {
        query = query.eq('trade_status', 'sold');
    } else if (section && SECTIONS.includes(section as typeof SECTIONS[number])) {
        query = query.eq('section', section);
    }
    if (q) {
        const escaped = q.replace(/[%_]/g, c => `\\${c}`);
        query = query.or(
            `title.ilike.%${escaped}%,content.ilike.%${escaped}%,area.ilike.%${escaped}%`,
        );
    }

    query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

    const { data, count } = await query;
    const total = count ?? 0;
    return {
        posts: (data ?? []) as PostRow[],
        total,
        hasMore: offset + PAGE_SIZE < total,
    };
}

async function fetchPopularSpots() {
    const supabase = getSupabaseServer();
    if (!supabase) return [];

    const { data } = await supabase
        .from('clawers_spots')
        .select('id, place_name, area, point, avg_rating, review_count, like_count')
        .gt('review_count', 0)
        .order('avg_rating', { ascending: false })
        .limit(6);

    return data ?? [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'meta' });
    return { title: t('communityTitle'), description: t('communityDesc') };
}

function sectionBadgeClass(section: PostRow['section']) {
    if (section === '사고팔기') return 'bg-[#ffe4f0] text-[#ca3378]';
    if (section === '후기') return 'bg-[#fff1df] text-[#b65f1d]';
    if (section === '질문') return 'bg-[#eaf1ff] text-[#2e69d0]';
    return 'bg-[#eaf7ef] text-[#2b8756]';
}

function tradeStatusBadge(status: string | null, labels: Record<string, string>) {
    if (!status) return null;
    if (status === 'selling')
        return { label: labels.selling, cls: 'bg-[#ecfbf2] text-[#1f8f58] border-[#c3ecd4]' };
    if (status === 'reserved')
        return { label: labels.reserved, cls: 'bg-[#eef4ff] text-[#2d6dd5] border-[#cfe0ff]' };
    return { label: labels.sold, cls: 'bg-[#f1f2f5] text-[#6d7380] border-[#d9dde5]' };
}

export default async function ClawersCommunityPage({ params, searchParams }: Props) {
    const { locale } = await params;
    setRequestLocale(locale);
    const sp = await searchParams;
    const activeSection = sp.section || '';
    const page = Math.max(1, Number(sp.page) || 1);
    const q = sp.q?.trim() || '';

    const t = await getTranslations({ locale, namespace: 'community' });
    const tradeLabels = {
        selling: t('tradeStatus.selling'),
        reserved: t('tradeStatus.reserved'),
        sold: t('tradeStatus.sold'),
    };

    const [{ posts, total, hasMore }, popularSpots] = await Promise.all([
        fetchPosts(activeSection, page, q),
        fetchPopularSpots(),
    ]);

    const basePath =
        locale === 'ko' ? '/community' : `/${locale}/community`;
    const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

    function buildHref(overrides: { section?: string; page?: number }) {
        const params = new URLSearchParams();
        const sec = overrides.section ?? activeSection;
        const pg = overrides.page ?? 1;
        if (sec) params.set('section', sec);
        if (pg > 1) params.set('page', String(pg));
        if (q) params.set('q', q);
        const qs = params.toString();
        return qs ? `${basePath}?${qs}` : basePath;
    }

    const sectionTags = [
        { key: '', label: t('tags.all') },
        { key: '정보공유', label: t('tags.info') },
        { key: '후기', label: t('tags.review') },
        { key: '질문', label: t('tags.question') },
        { key: '사고팔기', label: t('tags.trade') },
        { key: '_sold', label: t('tags.sold') },
    ];

    return (
        <div className="mx-auto w-full max-w-[980px] pb-16 flex flex-col gap-4">
            {/* Compact Header */}
            <MotionWrapper delay={0}>
                <section className="rounded-[24px] sm:rounded-[28px] bg-white/60 backdrop-blur-2xl border border-white/70 shadow-[0_8px_26px_rgba(0,0,0,0.05)] p-4 sm:p-5 flex flex-col gap-3">
                    {/* Row 1: Title + Count + Write */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <h2 className="text-[20px] sm:text-[22px] font-extrabold text-[#1d1d1f] tracking-tight">
                                {t('title')}
                            </h2>
                            {total > 0 && (
                                <span className="text-[12px] font-bold text-[#86868b]">
                                    {t('postCount', { count: total })}
                                </span>
                            )}
                        </div>
                        <WritePostButton label={t('writeBtn')} />
                    </div>

                    {/* Row 2: Search */}
                    <CommunitySearch placeholder={t('searchPlaceholder')} />

                    {/* Row 3: Section tags */}
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                        {sectionTags.map((tag) => (
                            <Link
                                key={tag.key}
                                href={buildHref({ section: tag.key, page: 1 })}
                                className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition whitespace-nowrap ${
                                    activeSection === tag.key
                                        ? 'bg-[#1d1d1f] border-[#1d1d1f] text-white'
                                        : 'bg-white/70 border-[#e8e8ed] text-[#6f6f76] hover:bg-white'
                                }`}
                            >
                                {tag.label}
                            </Link>
                        ))}
                    </div>

                    {/* Search result count */}
                    {q && (
                        <p className="text-[12px] font-bold text-[#86868b]">
                            {t('searchResults', { count: total })}
                        </p>
                    )}
                </section>
            </MotionWrapper>

            {/* Popular Spots */}
            {popularSpots.length > 0 && (
                <MotionWrapper delay={0.03}>
                    <section className="rounded-[24px] sm:rounded-[28px] bg-white/60 backdrop-blur-2xl border border-white/70 shadow-[0_8px_26px_rgba(0,0,0,0.05)] p-4 sm:p-5">
                        <h2 className="text-[16px] font-extrabold text-[#1d1d1f] mb-3">🎪 인기 스팟</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {popularSpots.map((spot: { id: string; place_name: string | null; area: string; point: string; avg_rating: number; review_count: number; like_count: number }) => (
                                <Link
                                    key={spot.id}
                                    href={basePath.replace('/community', `/spot/${spot.id}`)}
                                    className="rounded-[14px] border border-white/80 bg-white/75 p-3 hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:border-white transition-all"
                                >
                                    <p className="text-[13px] font-extrabold text-[#1d1d1f] truncate">{spot.place_name || spot.point}</p>
                                    <p className="text-[11px] text-[#86868b] truncate mt-0.5">{spot.area}</p>
                                    <div className="flex items-center gap-1.5 mt-2 text-[11px] text-[#86868b]">
                                        <Star size={11} className="text-amber-400 fill-amber-400" />
                                        <span className="font-extrabold text-[#1d1d1f]">{Number(spot.avg_rating).toFixed(1)}</span>
                                        <span>· 리뷰 {spot.review_count}</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                </MotionWrapper>
            )}

            {/* Post Feed */}
            <MotionWrapper delay={0.06}>
                <section className="rounded-[24px] sm:rounded-[28px] bg-white/60 backdrop-blur-2xl border border-white/70 shadow-[0_8px_26px_rgba(0,0,0,0.05)] p-3 sm:p-4 space-y-2">
                    {posts.length === 0 ? (
                        /* Empty State */
                        <div className="py-14 flex flex-col items-center justify-center text-center">
                            <span className="text-[52px] mb-4">🎪</span>
                            <h3 className="text-[20px] font-extrabold text-[#1d1d1f]">
                                {q ? t('noResults') : t('empty.title')}
                            </h3>
                            {!q && (
                                <>
                                    <p className="mt-1.5 text-[14px] font-medium text-[#86868b]">
                                        {t('empty.desc')}
                                    </p>
                                    <div className="mt-5">
                                        <WritePostButton label={t('empty.btn')} />
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        posts.map((post) => {
                            const trade = tradeStatusBadge(post.trade_status, tradeLabels);
                            const price = formatPrice(post.price_krw);
                            const isSold = post.trade_status === 'sold';

                            return (
                                <article
                                    key={post.id}
                                    className="rounded-[14px] border border-white/80 bg-white/75 p-3.5 sm:p-4 transition-all hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:border-white"
                                >
                                    {/* Meta row */}
                                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                                        <span
                                            className={`rounded-[6px] px-2 py-0.5 text-[10px] font-extrabold ${sectionBadgeClass(post.section)}`}
                                        >
                                            {post.section}
                                        </span>
                                        {trade && (
                                            <span
                                                className={`rounded-full border px-2 py-0.5 text-[9px] font-extrabold ${trade.cls}`}
                                            >
                                                {trade.label}
                                            </span>
                                        )}
                                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#87878f]">
                                            {post.area && (
                                                <>
                                                    <MapPin size={10} />
                                                    {post.area}
                                                    <span className="text-[#d1d1d6]">·</span>
                                                </>
                                            )}
                                            {timeAgo(post.created_at)}
                                        </span>
                                        {price && (
                                            <span
                                                className={`ml-auto text-[13px] font-extrabold ${
                                                    isSold
                                                        ? 'text-[#999] line-through'
                                                        : 'text-[#1d1d1f]'
                                                }`}
                                            >
                                                {price}
                                            </span>
                                        )}
                                    </div>

                                    {/* Title */}
                                    <h3
                                        className={`text-[15px] sm:text-[16px] font-extrabold leading-snug ${
                                            isSold ? 'text-[#999]' : 'text-[#1d1d1f]'
                                        }`}
                                    >
                                        {post.title}
                                    </h3>

                                    {/* Content preview */}
                                    <p className="mt-1 text-[12px] sm:text-[13px] text-[#86868b] line-clamp-1">
                                        {post.content}
                                    </p>

                                    {/* Reactions */}
                                    <div
                                        className={`mt-2.5 flex items-center gap-3.5 text-[11px] font-medium ${
                                            isSold ? 'text-[#bbb]' : 'text-[#87878f]'
                                        }`}
                                    >
                                        <LikeButton
                                            postId={post.id}
                                            initialCount={post.like_count}
                                        />
                                        <span className="inline-flex items-center gap-1">
                                            <MessageCircle size={12} /> {post.comment_count}
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <Eye size={12} /> {post.view_count.toLocaleString()}
                                        </span>
                                        <div className="ml-auto">
                                            <PostActions postId={post.id} />
                                        </div>
                                    </div>
                                </article>
                            );
                        })
                    )}

                    {/* Pagination */}
                    {total > PAGE_SIZE && (
                        <div className="flex items-center justify-center gap-3 pt-4">
                            {page > 1 && (
                                <Link
                                    href={buildHref({ page: page - 1 })}
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
                                    href={buildHref({ page: page + 1 })}
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
