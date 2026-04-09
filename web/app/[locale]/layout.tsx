import type { ReactNode } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import ClawersSectionNav from '@/components/ClawersSectionNav';

type Props = {
    children: ReactNode;
    params: Promise<{ locale: string }>;
};

const clawersDescriptions: Record<string, string> = {
    ko: '인형뽑기 명소 지도, 커뮤니티, 유튜브 영상을 한곳에서. 근처 인형뽑기 가게를 찾아보세요.',
    en: 'Your ultimate guide to the most aesthetic and rewarding claw machine spots.',
    ja: 'クレーンゲームの名所マップ、コミュニティ、YouTube動画を一か所で。近くのクレーンゲームを探してみましょう。',
    zh: '夹娃娃机名店地图、社区、YouTube视频一站式体验。寻找附近的夹娃娃机店。',
};

export default async function ClawersLayout({ children, params }: Props) {
    const { locale } = await params;
    setRequestLocale(locale);
    const t = await getTranslations({ locale, namespace: 'nav' });

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Clawers',
        description: clawersDescriptions[locale] || clawersDescriptions.en,
        url: `https://clawers.kortress.com/${locale}`,
        applicationCategory: 'EntertainmentApplication',
        operatingSystem: 'Web',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        author: { '@type': 'Person', name: 'Ko Jung-beom' },
    };

    return (
        <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <div
            className="relative min-h-screen text-[#1d1d1f] selection:bg-[#ffd1dc] selection:text-[#1d1d1f] pt-24 sm:pt-28"
            style={{
                background: [
                    'linear-gradient(180deg, #f8f0f4 0%, #f0eef5 40%, #edf2f8 70%, #f2f0f5 100%)',
                ].join(', '),
            }}
        >
            {/* Colored glow spots via box-shadows on a single div — no overflow clipping */}
            <div
                className="fixed inset-0 pointer-events-none z-0"
                style={{
                    background: [
                        'radial-gradient(ellipse 80% 60% at 10% 10%, rgba(255,160,190,0.35) 0%, transparent 70%)',
                        'radial-gradient(ellipse 70% 50% at 85% 15%, rgba(180,160,255,0.25) 0%, transparent 70%)',
                        'radial-gradient(ellipse 60% 50% at 75% 55%, rgba(252,220,160,0.3) 0%, transparent 70%)',
                        'radial-gradient(ellipse 80% 60% at 20% 80%, rgba(160,200,255,0.3) 0%, transparent 70%)',
                        'radial-gradient(ellipse 50% 40% at 50% 40%, rgba(180,230,210,0.2) 0%, transparent 70%)',
                        'radial-gradient(circle, rgba(0,0,0,0.04) 1px, transparent 1px)',
                    ].join(', '),
                    backgroundSize: 'cover, cover, cover, cover, cover, 20px 20px',
                }}
            />

            <ClawersSectionNav
                locale={locale}
                labels={{
                    home: t('home'),
                    map: t('map'),
                    community: t('community'),
                    watch: t('watch'),
                }}
            />

            <main className="relative z-10 mx-auto w-full max-w-[1240px] px-5 pb-20 sm:px-8 lg:px-12">
                {children}
            </main>
        </div>
        </>
    );
}
