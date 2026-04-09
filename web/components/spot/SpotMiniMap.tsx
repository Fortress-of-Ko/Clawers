'use client';

import { useEffect, useRef } from 'react';
import { ExternalLink } from 'lucide-react';
import { ensureKakaoLoaded } from '@/lib/utils/kakao';

type Props = {
    lat: number;
    lng: number;
    kakaoPlaceId: string | null;
    openMapLabel: string;
};

export default function SpotMiniMap({ lat, lng, kakaoPlaceId, openMapLabel }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let cancelled = false;

        async function init() {
            await ensureKakaoLoaded('services');
            if (cancelled || !containerRef.current) return;

            const { kakao } = window;
            const position = new kakao.maps.LatLng(lat, lng);
            const map = new kakao.maps.Map(containerRef.current, {
                center: position,
                level: 3,
                draggable: false,
                scrollwheel: false,
            });

            new kakao.maps.Marker({ map, position });
        }

        init();
        return () => { cancelled = true; };
    }, [lat, lng]);

    const mapUrl = kakaoPlaceId
        ? `https://place.map.kakao.com/${kakaoPlaceId}`
        : `https://map.kakao.com/link/map/${lat},${lng}`;

    return (
        <div className="rounded-[14px] overflow-hidden border border-white/80 shadow-sm">
            <div ref={containerRef} className="w-full h-[180px]" />
            <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-bold text-[#2d6dd5] bg-white/80 hover:bg-white transition"
            >
                <ExternalLink size={12} />
                {openMapLabel}
            </a>
        </div>
    );
}
