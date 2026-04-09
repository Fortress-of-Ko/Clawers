import type { Metadata } from 'next';
import { PlayCircle, ChevronRight } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { creators } from '@/lib/data';
import { getClawVideos } from '@/lib/youtube';
import Image from 'next/image';

type Props = {
    params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'meta' });
    return { title: t('watchTitle'), description: t('watchDesc') };
}

export default async function ClawersWatchPage({ params }: Props) {
    const { locale } = await params;
    setRequestLocale(locale);
    const t = await getTranslations({ locale, namespace: 'watch' });

    const videos = await getClawVideos();

    return (
        <div className="flex flex-col gap-8">
            {/* Hero Header */}
            <div className="flex flex-col gap-3 px-2 sm:px-4 pt-8 pb-2">
                <div className="flex items-center gap-2">
                    <Image src="/clawers/icons/play_video_icon.webp" width={40} height={40} alt="Watch" className="mix-blend-multiply" />
                    <h2 className="text-[32px] sm:text-[38px] font-extrabold text-[#1d1d1f] tracking-tight leading-tight">
                        {t('pageTitle')}
                    </h2>
                </div>
                <p className="text-[16px] font-medium text-[#86868b]">
                    {t('pageDesc')}
                </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-12 px-2 sm:px-4">
                {/* Creators List - Glassmorphic Panel */}
                <section className="lg:col-span-4 rounded-[32px] bg-white/50 backdrop-blur-2xl border border-white/60 shadow-[0_8px_40px_rgba(0,0,0,0.03)] p-6 lg:p-8">
                    <div className="flex items-center gap-2 mb-6">
                        <span className="text-[24px]">✨</span>
                        <h3 className="text-[20px] font-bold text-[#1d1d1f] tracking-tight">
                            {t('featuredCreators')}
                        </h3>
                    </div>

                    <div className="flex flex-col gap-3">
                        {creators.map((creator) => (
                            <div key={creator.name} className="flex items-center gap-4 rounded-[20px] bg-white/40 hover:bg-white border border-transparent hover:border-white/80 hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 p-4 transition-all group">
                                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${creator.color} text-[22px]`}>
                                    {creator.emoji}
                                </div>
                                <div className="flex flex-col flex-1 min-w-0">
                                    <p className="text-[15px] font-bold text-[#1d1d1f] group-hover:text-[#e64980] transition-colors">{creator.name}</p>
                                    <p className="text-[13px] font-medium text-[#86868b] truncate">{creator.handle}</p>
                                </div>
                                <ChevronRight size={16} className="text-[#c1c1c7] group-hover:text-[#e64980] transition-colors group-hover:translate-x-1 shrink-0" strokeWidth={2.5} />
                            </div>
                        ))}
                    </div>
                </section>

                {/* Latest Videos - Premium Dark Glassmorphic Panel */}
                <section className="lg:col-span-8 rounded-[32px] bg-[#1d1d1f] text-white p-6 lg:p-8 shadow-[0_16px_60px_rgba(0,0,0,0.15)] relative overflow-hidden">
                    {/* Ambient glow inside dark panel */}
                    <div className="absolute right-[-20%] top-[-20%] w-[60%] h-[60%] bg-[#e64980] rounded-full opacity-[0.06] blur-[80px] pointer-events-none" />
                    <div className="absolute left-[-10%] bottom-[-10%] w-[40%] h-[40%] bg-[#3182f6] rounded-full opacity-[0.05] blur-[60px] pointer-events-none" />

                    <div className="flex items-center gap-3 mb-8 relative z-10">
                        <Image src="/clawers/icons/play_video_icon.webp" width={36} height={36} alt="Videos" className="brightness-200 drop-shadow-lg" />
                        <div>
                            <h3 className="text-[22px] font-bold tracking-tight">
                                {t('latestVideos')}
                            </h3>
                            <p className="text-[14px] text-white/50 font-medium">{t('ytLive')}</p>
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 relative z-10">
                        {videos.length === 0 ? (
                            <div className="col-span-2 text-center py-16 text-white/30 text-[15px] font-medium">
                                {t('loading')}
                            </div>
                        ) : (
                            videos.map((video) => (
                                <a
                                    href={`https://www.youtube.com/watch?v=${video.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    key={video.id}
                                    className="group flex flex-col gap-3 rounded-[24px] bg-white/[0.06] border border-white/[0.06] p-4 transition-all hover:bg-white/[0.12] hover:border-white/10 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
                                >
                                    <div className="aspect-video w-full rounded-[16px] bg-black/50 overflow-hidden relative">
                                        <Image src={video.thumbnailUrl} alt={video.title} fill className="object-cover group-hover:scale-110 transition-transform duration-500 ease-out" />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/5 transition-colors">
                                            <PlayCircle size={40} className="text-white drop-shadow-lg opacity-90 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <p className="text-[15px] font-bold text-white line-clamp-2 leading-snug group-hover:text-[#ffafbd] transition-colors">{video.title}</p>
                                        <div className="flex items-center gap-2">
                                            <span className="w-5 h-5 rounded-full bg-gradient-to-br from-[#e64980] to-[#f783ac] shrink-0" />
                                            <span className="text-[13px] font-semibold text-white/60 truncate">{video.channelTitle}</span>
                                            <span className="text-[11px] text-white/30">•</span>
                                            <span className="text-[12px] font-medium text-white/30 shrink-0">
                                                {new Date(video.publishedAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                </a>
                            ))
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
