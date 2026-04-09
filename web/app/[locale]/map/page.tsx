import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import ClawersPanel from '@/components/ClawersPanel';
import { getSupabaseServer } from '@/lib/supabase/admin';
import type { Spot } from '@/components/ClawersPanel';

type Props = {
    params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale } = await params;
    return {
        title: locale === 'ko' ? '인형뽑기 지도 | Clawers' : 'Claw Map | Clawers',
        description:
            locale === 'ko'
                ? '지역/역 검색으로 인형뽑기/오락실을 자동 클러스터링하고 주변 리스트를 확인합니다.'
                : 'Search by region/station and view clustered claw/arcade spots.',
    };
}

async function fetchSpots(): Promise<Spot[]> {
    const supabase = getSupabaseServer();
    if (!supabase) return [];

    const { data } = await supabase
        .from('clawers_spots')
        .select('id, area, point, price, machines, lat, lng')
        .order('created_at', { ascending: false })
        .limit(1000);

    return (data ?? []).map((s) => ({
        id: s.id,
        area: s.area,
        point: s.point,
        price: s.price ?? '',
        machines: s.machines ?? 0,
        lat: s.lat,
        lng: s.lng,
    }));
}

export default async function ClawersMapPage({ params }: Props) {
    const { locale } = await params;
    setRequestLocale(locale);
    const isKo = locale === 'ko';
    const spots = await fetchSpots();
    const t = await getTranslations({ locale, namespace: 'spot' });

    return (
        /* Immersive Map Container: Uses fixed to ignore parent layout padding */
        <div className="fixed inset-0 z-10 bg-[#f8f9fa] overflow-hidden">
            {/* Global Hide Nav CSS */}
            <style dangerouslySetInnerHTML={{ __html: '.clawers-nav-container { display: none !important; }' }} />

            <ClawersPanel
                mapTitle={isKo ? '스팟 찾기' : 'Find Spots'}
                mapDesc={isKo ? '지역/역 검색으로 주변 매장을 찾아보세요' : 'Search nearby claw & arcade spots'}
                priceLabel={isKo ? '평균 가격대' : 'Avg. Price'}
                machineLabel={isKo ? '기계 수' : 'Machines'}
                mapSpots={spots}
                embedded
                locale={locale}
                detailLabel={t('previewTitle')}
            />
        </div>
    );
}
