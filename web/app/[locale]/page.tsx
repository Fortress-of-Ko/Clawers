import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { Search, PlayCircle, ChevronRight } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { creators } from '@/lib/data';
import { getClawVideos } from '@/lib/youtube';
import { type PostRow, sectionVisual } from '@/lib/shared';
import { getSupabaseServer } from '@/lib/supabase/admin';
import HomeMapWidget from '@/components/HomeMapWidget';
import MotionWrapper from '@/components/MotionWrapper';

function postToFeedItem(post: PostRow) {
    const visual = sectionVisual(post.section);
    const isMarket = post.section === '사고팔기';
    const meta = isMarket && post.price_krw != null
        ? `₩${post.price_krw.toLocaleString()} · ${post.area}`
        : `댓글 ${post.comment_count} · 좋아요 ${post.like_count}`;
    return { ...post, ...visual, isMarket, meta };
}

async function fetchHomePosts(): Promise<PostRow[]> {
    const supabase = getSupabaseServer();
    if (!supabase) return [];
    const { data } = await supabase
        .from('clawers_posts')
        .select('id, section, title, content, area, price_krw, trade_status, view_count, like_count, comment_count, created_at')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(7);
    return (data ?? []) as PostRow[];
}

type Props = {
    params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'meta' });
    return { title: t('homeTitle'), description: t('homeDesc') };
}

export default async function ClawersHomePage({ params }: Props) {
    const { locale } = await params;
    setRequestLocale(locale);
    const t = await getTranslations({ locale, namespace: 'home' });
    const [videos, rawPosts] = await Promise.all([
        getClawVideos('relevance', 3),
        fetchHomePosts(),
    ]);
    const communityFeed = rawPosts.map(postToFeedItem);

    const quickActions = [
        { emoji: '📍', label: t('quickActions.nearby.label'), desc: t('quickActions.nearby.desc'), href: `/${locale}/map`, gradient: 'from-[#e64980] via-[#f06595] to-[#faa2c1]' },
        { emoji: '⚡', label: t('quickActions.tips.label'), desc: t('quickActions.tips.desc'), href: `/${locale}/watch`, gradient: 'from-[#3b82f6] via-[#60a5fa] to-[#93c5fd]' },
        { emoji: '💬', label: t('quickActions.feed.label'), desc: t('quickActions.feed.desc'), href: `/${locale}/community`, gradient: 'from-[#f97316] via-[#fb923c] to-[#fdba74]' },
        { emoji: '🛍️', label: t('quickActions.market.label'), desc: t('quickActions.market.desc'), href: `/${locale}/community`, gradient: 'from-[#10b981] via-[#34d399] to-[#6ee7b7]' },
    ];

    return (
        <div className="mx-auto max-w-[1240px] pb-24 flex flex-col gap-5 sm:gap-8">

            {/* 1. Hero Banner */}
            <MotionWrapper delay={0}>
                <div className="px-3 sm:px-6 pt-2 sm:pt-4">
                    <div className="relative rounded-[24px] sm:rounded-[32px] overflow-hidden bg-[#1d1d1f] shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
                        <div className="relative w-full aspect-[16/9] sm:aspect-[21/9]">
                            <Image src="/clawers/icons/hero_banner.webp" alt="Claw Hub Hero" fill className="object-cover opacity-75" priority />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#1d1d1f] via-[#1d1d1f]/50 to-transparent" />
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-8 flex flex-col gap-2 sm:gap-3">
                            <h1 className="text-[22px] sm:text-[36px] font-extrabold text-white tracking-tight leading-tight drop-shadow-lg">
                                {t('heroTitle')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ffafbd] to-[#ffc3a0]">{t('heroHighlight')}</span>
                            </h1>
                            <p className="text-[13px] sm:text-[16px] font-medium text-white/60 max-w-[500px] hidden sm:block">
                                {t('heroSubtitle')}
                            </p>
                            <Link href={`/${locale}/map`} className="flex w-full max-w-[480px] items-center gap-3 rounded-[16px] sm:rounded-[20px] bg-white/15 backdrop-blur-xl px-4 py-3 sm:px-5 sm:py-3.5 border border-white/20 transition-all hover:bg-white/25 mt-1">
                                <Search size={18} className="text-white/60 shrink-0" />
                                <span className="text-[14px] sm:text-[16px] text-white/40 font-medium">
                                    {t('searchPlaceholder')}
                                </span>
                            </Link>
                        </div>
                    </div>
                </div>
            </MotionWrapper>

            {/* 2. Quick Actions */}
            <MotionWrapper delay={0.05}>
                <div className="px-3 sm:px-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                        {quickActions.map((action, idx) => (
                            <Link key={idx} href={action.href} className={`group relative flex flex-col justify-between p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] bg-gradient-to-br ${action.gradient} overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all hover:shadow-[0_8px_32px_rgba(0,0,0,0.15)] hover:-translate-y-1 active:scale-[0.97]`}>
                                <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/10" />
                                <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-white/[0.07]" />
                                <span className="text-[28px] sm:text-[32px] mb-2 drop-shadow-sm group-hover:scale-110 transition-transform">{action.emoji}</span>
                                <div>
                                    <p className="text-[13px] sm:text-[15px] font-extrabold text-white drop-shadow-sm leading-tight">{action.label}</p>
                                    <p className="text-[10px] sm:text-[11px] font-medium text-white/70 mt-0.5">{action.desc}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </MotionWrapper>

            {/* 3. Trending Posts */}
            <MotionWrapper delay={0.1}>
                <div className="px-3 sm:px-6">
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                        <div className="flex items-center gap-1.5">
                            <Image src="/clawers/icons/chat_bubble_icon.webp" width={24} height={24} alt="" className="mix-blend-multiply" />
                            <h3 className="text-[17px] sm:text-[20px] font-bold text-[#1d1d1f] tracking-tight">
                                {t('trending')}
                            </h3>
                        </div>
                        <Link href={`/${locale}/community`} className="text-[12px] sm:text-[13px] font-bold text-[#e64980] bg-[#fff0f5] hover:bg-[#ffe3ee] px-3 py-1.5 rounded-full transition-colors flex items-center gap-0.5">
                            {t('viewAll')}
                            <ChevronRight size={12} strokeWidth={2.5} />
                        </Link>
                    </div>
                    <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide snap-x snap-mandatory -mx-1 px-1">
                        {communityFeed.map((post, idx) => (
                            <Link href={`/${locale}/community`} key={idx} className="group snap-start shrink-0 w-[150px] sm:w-[180px] flex flex-col rounded-[16px] sm:rounded-[18px] bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden transition-all hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-1 active:scale-[0.98]">
                                <div className={`relative w-full aspect-[3/2] bg-gradient-to-br ${post.gradient} overflow-hidden flex items-center justify-center`}>
                                    <span className="text-[40px] sm:text-[44px] drop-shadow-sm group-hover:scale-110 transition-transform duration-300">{post.emoji}</span>
                                    <div className="absolute top-1.5 left-1.5">
                                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-extrabold backdrop-blur-md shadow-sm ${post.isMarket ? 'bg-[#e64980]/90 text-white' : 'bg-white/80 text-[#3182f6]'}`}>
                                            {post.section}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-0.5 p-2.5 sm:p-3">
                                    <span className="text-[12px] sm:text-[13px] font-bold text-[#1d1d1f] group-hover:text-[#e64980] transition-colors line-clamp-2 leading-snug">{post.title}</span>
                                    <span className="text-[10px] sm:text-[11px] font-medium text-[#86868b] truncate">{post.meta}</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </MotionWrapper>

            {/* 4. Map Widget */}
            <MotionWrapper delay={0.15}>
                <div className="px-3 sm:px-6">
                    <div className="rounded-[24px] sm:rounded-[32px] bg-white/60 backdrop-blur-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-2 sm:p-3">
                        <HomeMapWidget locale={locale} isKo={locale === 'ko'} />
                    </div>
                </div>
            </MotionWrapper>

            {/* 5. Community + Videos */}
            <MotionWrapper delay={0.2} className="px-3 sm:px-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">

                    {/* Community Feed */}
                    <div className="lg:col-span-7 flex flex-col bg-white/60 backdrop-blur-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] rounded-[24px] sm:rounded-[32px] p-4 sm:p-6">
                        <div className="flex items-center justify-between mb-4 sm:mb-5">
                            <div className="flex items-center gap-1.5">
                                <Image src="/clawers/icons/chat_bubble_icon.webp" width={26} height={26} alt="Community" className="mix-blend-multiply" />
                                <h3 className="text-[18px] sm:text-[20px] font-bold text-[#1d1d1f] tracking-tight">{t('communityFeed')}</h3>
                            </div>
                            <Link href={`/${locale}/community`} className="text-[12px] sm:text-[13px] font-bold text-[#e64980] bg-[#fff0f5] hover:bg-[#ffe3ee] px-3 py-1.5 rounded-full transition-colors flex items-center gap-0.5">
                                {t('more')}
                                <ChevronRight size={12} strokeWidth={2.5} />
                            </Link>
                        </div>

                        {/* Area Tabs */}
                        <div className="flex gap-1.5 mb-4 overflow-x-auto scrollbar-hide pb-0.5">
                            {['전체', ...Array.from(new Set(communityFeed.map(p => p.area)))].map((area) => (
                                <span key={area} className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] sm:text-[12px] font-bold cursor-pointer transition-all ${area === '전체' ? 'bg-[#1d1d1f] text-white' : 'bg-white/60 text-[#86868b] hover:bg-white hover:text-[#1d1d1f] border border-black/5'}`}>
                                    {area}
                                </span>
                            ))}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            {communityFeed.slice(0, 5).map((post, idx) => (
                                <Link href={`/${locale}/community`} key={idx} className="group flex gap-3 sm:gap-4 p-3 items-center transition-all bg-white/40 hover:bg-white border border-transparent hover:border-white/80 hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)] rounded-[16px] active:scale-[0.98]">
                                    <div className={`w-[60px] h-[60px] sm:w-[72px] sm:h-[72px] shrink-0 rounded-[12px] overflow-hidden bg-gradient-to-br ${post.gradient} flex items-center justify-center border border-black/5`}>
                                        <span className="text-[26px] sm:text-[30px] group-hover:scale-110 transition-transform">{post.emoji}</span>
                                    </div>
                                    <div className="flex flex-col flex-1 min-w-0 justify-center gap-1">
                                        <div className="flex items-center gap-1.5">
                                            <span className={`px-2 py-0.5 rounded-[6px] text-[9px] sm:text-[10px] font-extrabold shrink-0 ${post.isMarket ? 'bg-[#ffe3ee] text-[#e64980]' : 'bg-[#e8f3ff] text-[#3182f6]'}`}>
                                                {post.section}
                                            </span>
                                            <span className="text-[9px] sm:text-[10px] font-bold text-[#a1a1a6] shrink-0">📍{post.area}</span>
                                        </div>
                                        <span className="text-[14px] sm:text-[15px] font-bold text-[#1d1d1f] group-hover:text-[#e64980] transition-colors truncate">{post.title}</span>
                                        <span className="text-[11px] sm:text-[12px] font-medium text-[#86868b] truncate">{post.meta}</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Videos */}
                    <div className="lg:col-span-5 flex flex-col bg-white/60 backdrop-blur-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] rounded-[24px] sm:rounded-[32px] p-4 sm:p-6">
                        <div className="flex items-center justify-between mb-4 sm:mb-5">
                            <div className="flex items-center gap-1.5">
                                <Image src="/clawers/icons/play_video_icon.webp" width={26} height={26} alt="Tips" className="mix-blend-multiply" />
                                <h3 className="text-[18px] sm:text-[20px] font-bold text-[#1d1d1f] tracking-tight">{t('proTips')}</h3>
                            </div>
                            <Link href={`/${locale}/watch`} className="text-[12px] sm:text-[13px] font-bold text-[#3182f6] bg-[#e8f3ff] hover:bg-[#d0e5ff] px-3 py-1.5 rounded-full transition-colors flex items-center gap-0.5">
                                {t('more')}
                                <ChevronRight size={12} strokeWidth={2.5} />
                            </Link>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            {videos.length === 0 ? (
                                <div className="text-center py-8 bg-white/40 rounded-[16px] text-[#86868b] text-[14px] font-medium">{t('loadingVideos')}</div>
                            ) : videos.map((video) => (
                                <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer" key={video.id} className="group flex items-center gap-3 p-2.5 sm:p-3 transition-all bg-white/40 hover:bg-white border border-transparent hover:border-white/80 hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)] rounded-[16px] active:scale-[0.98]">
                                    <div className="w-[110px] sm:w-[130px] aspect-video rounded-[10px] sm:rounded-[12px] overflow-hidden relative flex-shrink-0 bg-[#f5f5f7] border border-black/5">
                                        <Image src={video.thumbnailUrl} alt={video.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                                            <PlayCircle size={28} className="text-white drop-shadow-md opacity-90" strokeWidth={1.5} />
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                                        <p className="text-[13px] sm:text-[14px] line-clamp-2 font-bold text-[#1d1d1f] leading-snug group-hover:text-[#3182f6] transition-colors">{video.title}</p>
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-4 h-4 rounded-full bg-gradient-to-br from-[#c2e9fb] to-[#a1c4fd] shrink-0" />
                                            <p className="text-[11px] sm:text-[12px] font-semibold text-[#86868b] truncate">{video.channelTitle}</p>
                                        </div>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                </div>
            </MotionWrapper>

            {/* 6. Creators */}
            <MotionWrapper delay={0.25}>
                <div className="px-3 sm:px-6">
                    <div className="rounded-[24px] sm:rounded-[28px] bg-white/60 backdrop-blur-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-4 sm:p-6">
                        <div className="flex items-center justify-between mb-4 sm:mb-5">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[20px]">🎮</span>
                                <h3 className="text-[17px] sm:text-[20px] font-bold text-[#1d1d1f] tracking-tight">
                                    {t('creators')}
                                </h3>
                            </div>
                            <Link href={`/${locale}/watch`} className="text-[12px] sm:text-[13px] font-bold text-[#e64980] bg-[#fff0f5] hover:bg-[#ffe3ee] px-3 py-1.5 rounded-full transition-colors flex items-center gap-0.5">
                                {t('viewAll')}
                                <ChevronRight size={12} strokeWidth={2.5} />
                            </Link>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
                            {creators.map((creator) => (
                                <div key={creator.name} className="group flex flex-col items-center gap-2 p-3 rounded-[16px] bg-white/40 hover:bg-white border border-transparent hover:border-white/80 hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition-all cursor-pointer active:scale-95">
                                    <div className={`flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-gradient-to-br ${creator.color} group-hover:scale-110 transition-transform text-[22px]`}>
                                        {creator.emoji}
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[12px] sm:text-[13px] font-bold text-[#1d1d1f] group-hover:text-[#e64980] transition-colors truncate">{creator.name}</p>
                                        <p className="text-[10px] sm:text-[11px] font-medium text-[#86868b] mt-0.5">{creator.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </MotionWrapper>
        </div>
    );
}
