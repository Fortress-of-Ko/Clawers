'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, ChevronRight, Navigation } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { distanceKm } from '@/lib/utils/geo';
import { ensureKakaoLoaded } from '@/lib/utils/kakao';

type Poi = {
    id: string;
    lat: number;
    lng: number;
    name: string;
    distanceKm: number;
};

export default function HomeMapWidget({ locale, isKo }: { locale: string; isKo: boolean }) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const [status, setStatus] = useState<'loading' | 'granted' | 'denied'>('loading');
    const [pois, setPois] = useState<Poi[]>([]);
    const [center, setCenter] = useState({ lat: 37.4979, lng: 127.0276 });
    const [spots, setSpots] = useState<{ area: string; point: string; price: string; machines: number; lat: number; lng: number }[]>([]);

    // Fetch spots from DB
    useEffect(() => {
        fetch('/api/spots')
            .then(r => r.json())
            .then(data => {
                if (data.spots?.length > 0) {
                    setSpots(data.spots.map((s: any) => ({
                        area: s.area, point: s.point, price: s.price ?? '',
                        machines: s.machines ?? 0, lat: s.lat, lng: s.lng,
                    })));
                }
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => { setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setStatus('granted'); },
                () => setStatus('denied'),
                { timeout: 5000 },
            );
        } else {
            setStatus('denied');
        }
    }, []);

    useEffect(() => {
        if (status === 'loading') return;
        let cancelled = false;

        async function init() {
            await ensureKakaoLoaded('services');
            if (cancelled || !mapContainerRef.current) return;

            const { kakao } = window;
            const latlng = new kakao.maps.LatLng(center.lat, center.lng);

            if (!mapRef.current) {
                const map = new kakao.maps.Map(mapContainerRef.current, { center: latlng, level: 5 });
                map.setZoomable(false);
                map.setDraggable(false);
                mapRef.current = map;
            } else {
                mapRef.current.setCenter(latlng);
            }

            // User marker
            if (status === 'granted') {
                new kakao.maps.CustomOverlay({
                    position: latlng,
                    content: '<div style="width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>',
                    map: mapRef.current,
                });
            }

            // Search nearby claw/arcade spots via Kakao Places API
            const ps = new kakao.maps.services.Places();
            const searchTerms = ['인형뽑기', '오락실', '게임센터'];
            const allResults: Poi[] = [];
            let completed = 0;

            searchTerms.forEach((term) => {
                ps.keywordSearch(term, (data: any[], searchStatus: string) => {
                    completed++;
                    if (searchStatus === kakao.maps.services.Status.OK) {
                        data.forEach((place: any) => {
                            const pLat = Number(place.y);
                            const pLng = Number(place.x);
                            allResults.push({
                                id: `kakao-${place.id}`,
                                name: place.place_name,
                                lat: pLat,
                                lng: pLng,
                                distanceKm: distanceKm(center.lat, center.lng, pLat, pLng),
                            });
                        });
                    }
                    if (completed === searchTerms.length) {
                        if (cancelled) return;
                        // Dedupe + merge with DB spots
                        const localPois: Poi[] = spots.map((spot, idx) => ({
                            id: `spot-${idx}`,
                            name: spot.point,
                            lat: spot.lat,
                            lng: spot.lng,
                            distanceKm: distanceKm(center.lat, center.lng, spot.lat, spot.lng),
                        }));
                        const combined = [...allResults, ...localPois];
                        const seen = new Set<string>();
                        const unique = combined.filter(p => {
                            const key = `${p.lat.toFixed(4)}:${p.lng.toFixed(4)}`;
                            if (seen.has(key)) return false;
                            seen.add(key);
                            return true;
                        });
                        unique.sort((a, b) => a.distanceKm - b.distanceKm);
                        const topPois = unique.slice(0, 4);
                        setPois(topPois);

                        topPois.forEach((poi, idx) => {
                            new kakao.maps.CustomOverlay({
                                position: new kakao.maps.LatLng(poi.lat, poi.lng),
                                content: `<div style="background:#e64980;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 4px 6px rgba(0,0,0,0.1);"><div style="transform:rotate(45deg);color:white;font-weight:bold;font-size:14px;">${idx + 1}</div></div>`,
                                map: mapRef.current,
                                yAnchor: 1,
                            });
                        });
                    }
                }, { location: latlng, radius: 5000, size: 10 });
            });
        }

        init();
        return () => { cancelled = true; };
    }, [center.lat, center.lng, status, spots]);

    return (
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 p-2 sm:p-4">
            <div className="flex-1 min-h-[300px] lg:min-h-[460px] relative rounded-[24px] overflow-hidden bg-white/60 border border-white shadow-inner">
                {status === 'loading' && (
                    <div className="absolute inset-0 z-20 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center">
                        <div className="w-12 h-12 border-4 border-white border-t-[#e64980] rounded-full animate-spin mb-4 shadow-sm" />
                        <span className="text-[#1d1d1f] text-[15px] font-bold animate-pulse drop-shadow-sm">
                            {isKo ? '주변 탐색 중...' : 'Scanning area...'}
                        </span>
                    </div>
                )}
                {status === 'denied' && (
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-xl px-5 py-2.5 rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-[400] text-[14px] font-extrabold text-[#1d1d1f] flex items-center gap-2 border border-white">
                        <Navigation size={16} className="text-[#e64980]" />
                        {isKo ? '기본 지역 (강남) 기준' : 'Default Area (Gangnam)'}
                    </div>
                )}
                <div ref={mapContainerRef} className="absolute inset-0 z-10" />
            </div>

            <div className="w-full lg:w-[420px] flex flex-col pt-2 lg:pt-0">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-1.5">
                        <Image src="/clawers/icons/map_pin_icon.webp" width={32} height={32} alt="Nearby Spots" className="mix-blend-multiply" />
                        <h3 className="text-[22px] font-bold text-[#1d1d1f] tracking-tight">
                            {isKo ? '핫플레이스 발견' : 'Nearby Spots'}
                        </h3>
                    </div>
                    <Link href={`/${locale}/map`} className="text-[14px] font-bold text-[#e64980] bg-[#fff0f5] hover:bg-[#ffe3ee] px-4 py-2 rounded-full transition-colors flex items-center gap-1">
                        {isKo ? '지도 보기' : 'Map View'}
                        <ChevronRight size={14} strokeWidth={2.5} />
                    </Link>
                </div>

                <div className="flex flex-col gap-2 relative">
                    <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white/20 to-transparent pointer-events-none z-10 rounded-b-[20px]" />
                    <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-hide snap-x snap-mandatory px-1 lg:grid lg:grid-cols-1 lg:gap-3 lg:overflow-visible lg:pb-0 lg:px-0 lg:snap-none">
                        {status === 'loading' ? (
                            [1, 2, 3].map(i => <div key={i} className="flex-shrink-0 w-[240px] h-[100px] bg-white/40 rounded-[24px] animate-pulse lg:w-full" />)
                        ) : pois.length === 0 ? (
                            <div className="w-full py-10 text-center flex flex-col items-center justify-center gap-3 bg-white/40 rounded-[28px]">
                                <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center text-[#c1c1c7]">
                                    <MapPin size={24} strokeWidth={2} />
                                </div>
                                <p className="text-[15px] font-bold text-[#1d1d1f]">주변 스팟이 없어요</p>
                            </div>
                        ) : pois.map((poi, idx) => (
                            <Link
                                href={`/${locale}/map?lat=${poi.lat}&lng=${poi.lng}`}
                                key={poi.id}
                                className="group flex-shrink-0 w-[260px] snap-start flex items-center gap-4 p-4 transition-all bg-white/50 backdrop-blur-md hover:bg-white border border-white/60 shadow-[0_4px_16px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] hover:-translate-y-1 rounded-[24px] active:scale-[0.97] lg:w-full lg:min-w-0"
                            >
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-gradient-to-br from-white to-[#f5f5f7] border border-white text-[#1d1d1f] shadow-sm group-hover:bg-[#e64980] group-hover:text-white transition-all text-[16px] font-black">
                                    {idx + 1}
                                </div>
                                <div className="flex flex-col justify-center gap-0.5 min-w-0">
                                    <span className="text-[17px] font-bold text-[#1d1d1f] group-hover:text-[#e64980] transition-colors truncate">{poi.name}</span>
                                    <span className="text-[13px] font-bold text-[#86868b]">{poi.distanceKm.toFixed(1)} km 떨어짐</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
