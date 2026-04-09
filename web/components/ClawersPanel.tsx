'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, Search, ChevronRight, Home, Navigation, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { distanceKm } from '@/lib/utils/geo';
import { ensureKakaoLoaded } from '@/lib/utils/kakao';

export type Spot = {
    id?: string;
    area: string;
    point: string;
    price: string;
    machines: number;
    lat: number;
    lng: number;
    regionQuery?: string;
};

type Props = {
    mapSpots: Spot[];
    embedded?: boolean;
    locale?: string;
    mapTitle?: string;
    mapDesc?: string;
    priceLabel?: string;
    machineLabel?: string;
    detailLabel?: string;
};

type Poi = {
    id: string;
    dbId?: string;
    lat: number;
    lng: number;
    name: string;
    type: 'claw' | 'arcade';
    address: string;
    distanceKm?: number;
};

const REGION_TREE: Record<string, string[]> = {
    '서울특별시': ['강남구', '마포구', '송파구', '영등포구', '종로구', '관악구', '동작구', '서초구', '성동구', '광진구', '강서구', '구로구'],
    '인천/경기': ['인천광역시', '수원시', '성남시', '고양시', '부천시', '용인시', '안산시', '안양시', '평택시'],
    '부산/경상': ['부산광역시', '대구광역시', '울산광역시', '창원시'],
    '충청/기타': ['대전광역시', '세종시', '광주광역시', '제주시'],
};

const QUICK_KEYWORDS = ['강남역', '홍대입구역', '잠실역', '서면역', '제주시청', '역곡역'];

async function searchPlaces(keyword: string, lat: number, lng: number): Promise<Poi[]> {
    await ensureKakaoLoaded('services,clusterer');
    const { kakao } = window;
    const ps = new kakao.maps.services.Places();
    const location = new kakao.maps.LatLng(lat, lng);

    return new Promise((resolve) => {
        const terms = [
            `${keyword} 인형뽑기`,
            `${keyword} 오락실`,
            `${keyword} 게임센터`,
        ];

        const allResults: Poi[] = [];
        let completed = 0;

        terms.forEach((term) => {
            ps.keywordSearch(term, (data: any[], status: string) => {
                completed++;
                if (status === kakao.maps.services.Status.OK) {
                    data.forEach((place: any) => {
                        const pLat = Number(place.y);
                        const pLng = Number(place.x);
                        const isArcade = /오락|게임|arcade|game/i.test(place.place_name || '');
                        allResults.push({
                            id: `kakao-${place.id}`,
                            lat: pLat,
                            lng: pLng,
                            name: place.place_name,
                            type: isArcade ? 'arcade' : 'claw',
                            address: place.address_name || '',
                            distanceKm: distanceKm(lat, lng, pLat, pLng),
                        });
                    });
                }
                if (completed === terms.length) {
                    // Dedupe by place id
                    const seen = new Set<string>();
                    const unique = allResults.filter(p => {
                        if (seen.has(p.id)) return false;
                        seen.add(p.id);
                        return true;
                    });
                    unique.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
                    resolve(unique);
                }
            }, { location, radius: 10000, size: 15 });
        });
    });
}

export default function ClawersPanel({ mapSpots, locale = 'ko', detailLabel }: Props) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const clustererRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]);

    const [center, setCenter] = useState({ lat: 37.5665, lng: 126.9780 });
    const [isMapReady, setIsMapReady] = useState(false);
    const [searchInput, setSearchInput] = useState('');
    const [category, setCategory] = useState<'all' | 'claw' | 'arcade'>('all');
    const [activePois, setActivePois] = useState<Poi[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [mobileView, setMobileView] = useState<'map' | 'list'>('map');
    const [error, setError] = useState<string | null>(null);
    const [resolvedLabel, setResolvedLabel] = useState('대한민국');

    const [selectedProvince, setSelectedProvince] = useState('서울특별시');
    const [selectedCity, setSelectedCity] = useState('강남구');
    const [selectedPoi, setSelectedPoi] = useState<Poi | null>(null);

    // 1. Init Kakao Map + GPS
    useEffect(() => {
        async function load() {
            await ensureKakaoLoaded('services,clusterer');

            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (p) => { setCenter({ lat: p.coords.latitude, lng: p.coords.longitude }); setIsLoading(false); },
                    () => setIsLoading(false),
                    { timeout: 5000 },
                );
            } else {
                setIsLoading(false);
            }
        }
        load();
    }, []);

    // 2. Create Map
    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;
        let cancelled = false;

        async function createMap() {
            await ensureKakaoLoaded('services,clusterer');
            if (cancelled || !mapContainerRef.current || mapRef.current) return;

            const { kakao } = window;
            const map = new kakao.maps.Map(mapContainerRef.current, {
                center: new kakao.maps.LatLng(center.lat, center.lng),
                level: 5,
            });

            const clusterer = new kakao.maps.MarkerClusterer({
                map,
                averageCenter: true,
                minLevel: 4,
                styles: [{
                    width: '40px', height: '40px', background: '#e64980', borderRadius: '20px',
                    color: 'white', textAlign: 'center', lineHeight: '40px', fontWeight: '900',
                    fontSize: '15px', border: '2px solid white', boxShadow: '0 8px 20px rgba(230,73,128,0.3)',
                }],
            });

            mapRef.current = map;
            clustererRef.current = clusterer;
            setIsMapReady(true);

            const observer = new ResizeObserver(() => map.relayout());
            observer.observe(mapContainerRef.current!);
            return () => observer.disconnect();
        }

        createMap();
        return () => { cancelled = true; };
    }, [isLoading]);

    // 3. Fetch POIs & update markers
    useEffect(() => {
        if (!isMapReady || !window.kakao?.maps) return;
        let cancelled = false;

        async function fetchData() {
            setIsLoading(true);
            const { kakao } = window;

            // Search with Kakao Places API
            const pois = await searchPlaces(resolvedLabel, center.lat, center.lng);

            // Local spots as fallback
            const local: Poi[] = mapSpots.map((s, idx) => ({
                id: `local-${idx}`,
                dbId: s.id,
                lat: s.lat, lng: s.lng, name: s.point,
                type: 'claw' as const, address: s.area,
                distanceKm: distanceKm(center.lat, center.lng, s.lat, s.lng),
            }));
            const nearLocal = local.filter(s => (s.distanceKm ?? 0) <= 5);

            const combined = [...pois, ...nearLocal];
            const seen = new Set<string>();
            const unique = combined.filter(p => {
                const key = `${p.lat.toFixed(5)}:${p.lng.toFixed(5)}:${p.name}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            const filtered = unique
                .filter(p => category === 'all' || p.type === category)
                .map(p => ({ ...p, distanceKm: distanceKm(center.lat, center.lng, p.lat, p.lng) }))
                .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));

            if (cancelled) return;
            setActivePois(filtered);
            setIsLoading(false);

            // Update markers
            markersRef.current.forEach(m => m.setMap(null));
            markersRef.current = [];

            const newMarkers = filtered.map(p => {
                const isArcade = p.type === 'arcade';
                const content = document.createElement('div');
                content.innerHTML = `<div style="width:18px;height:18px;border-radius:50%;background:${isArcade ? '#3182f6' : '#e64980'};border:3.5px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.35);"></div>`;

                const overlay = new kakao.maps.CustomOverlay({
                    position: new kakao.maps.LatLng(p.lat, p.lng),
                    content: content,
                    yAnchor: 0.5,
                });
                return overlay;
            });

            clustererRef.current.clear();
            // Clusterer works with Marker, use custom overlays for individual ones
            newMarkers.forEach(m => m.setMap(mapRef.current));
            markersRef.current = newMarkers;

            // Fit bounds
            if (filtered.length > 0) {
                const bounds = new kakao.maps.LatLngBounds();
                filtered.slice(0, 8).forEach(p => bounds.extend(new kakao.maps.LatLng(p.lat, p.lng)));
                mapRef.current.setBounds(bounds);
            }
        }

        const timer = setTimeout(fetchData, 400);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [center, category, isMapReady, resolvedLabel, mapSpots]);

    const handleSearch = async (e?: React.FormEvent, keyword?: string) => {
        if (e) e.preventDefault();
        const q = (keyword || searchInput).trim();
        if (q.length < 2) { setError('2글자 이상 입력해주세요.'); return; }

        setError(null);
        setIsLoading(true);

        await ensureKakaoLoaded('services,clusterer');
        const { kakao } = window;
        const geocoder = new kakao.maps.services.Geocoder();

        geocoder.addressSearch(q, (result: any[], status: string) => {
            if (status === kakao.maps.services.Status.OK && result[0]) {
                const lat = Number(result[0].y);
                const lng = Number(result[0].x);
                setCenter({ lat, lng });
                setResolvedLabel(result[0].address_name || q);
                mapRef.current?.setCenter(new kakao.maps.LatLng(lat, lng));
                mapRef.current?.setLevel(4);
                setMobileView('map');
                setIsLoading(false);
            } else {
                // Fallback: keyword search
                const ps = new kakao.maps.services.Places();
                ps.keywordSearch(q, (data: any[], s: string) => {
                    if (s === kakao.maps.services.Status.OK && data[0]) {
                        const lat = Number(data[0].y);
                        const lng = Number(data[0].x);
                        setCenter({ lat, lng });
                        setResolvedLabel(data[0].address_name || q);
                        mapRef.current?.setCenter(new kakao.maps.LatLng(lat, lng));
                        mapRef.current?.setLevel(4);
                        setMobileView('map');
                    } else {
                        setError('결과를 찾지 못했습니다.');
                    }
                    setIsLoading(false);
                });
            }
        });
    };

    const applySelection = (p: string, c: string) => {
        setSelectedProvince(p);
        setSelectedCity(c);
        const q = `${p} ${c}`;
        setSearchInput(q);
        handleSearch(undefined, q);
    };

    return (
        <div className="relative w-full h-full bg-[#f8f9fa] flex flex-col font-sans overflow-hidden">
            <div className="absolute inset-0 z-0">
                <div ref={mapContainerRef} className="w-full h-full" />
                <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/5 to-transparent pointer-events-none" />
            </div>

            <div className="relative z-20 pt-4 sm:pt-6 px-3 sm:px-6 flex flex-col gap-3 max-w-2xl mx-auto w-full">
                <div className="flex items-center gap-2">
                    <Link href={`/${locale}`} className="shrink-0 flex items-center justify-center w-[48px] h-[48px] rounded-2xl bg-white/90 backdrop-blur-xl shadow-2xl border border-white/40 text-gray-800 hover:bg-white active:scale-95 transition-all">
                        <Home size={20} />
                    </Link>
                    <form onSubmit={handleSearch} className="flex-1 flex items-center gap-3 h-[48px] bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/40 px-4 transition-focus-within focus-within:bg-white">
                        <Search size={18} className="text-gray-400 shrink-0" />
                        <input
                            value={searchInput}
                            onChange={e => setSearchInput(e.target.value)}
                            placeholder="지역, 역 검색 (예: 강남역, 홍대)"
                            className="flex-1 bg-transparent text-[15px] outline-none font-bold text-gray-900 placeholder:text-gray-400 placeholder:font-medium"
                        />
                        {isLoading ? (
                            <Loader2 size={18} className="animate-spin text-pink-500" />
                        ) : (
                            <button type="submit" className="text-pink-500 font-extrabold text-[13px] px-2 py-1 hover:bg-pink-50 rounded-lg">검색</button>
                        )}
                    </form>
                </div>

                <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
                    <div className="flex gap-1 pr-2 border-r border-black/10 shrink-0">
                        {[
                            { id: 'all', label: '전체', color: 'bg-[#1d1d1f]' },
                            { id: 'claw', label: '뽑기', icon: '🎪', color: 'bg-[#e64980]' },
                            { id: 'arcade', label: '오락실', icon: '🕹', color: 'bg-[#3182f6]' },
                        ].map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setCategory(cat.id as any)}
                                className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-black transition-all shadow-md ${category === cat.id ? `${cat.color} text-white scale-105` : 'bg-white/80 text-gray-600 hover:bg-white border border-white/50'}`}
                            >
                                {cat.icon} {cat.label}
                            </button>
                        ))}
                    </div>
                    {QUICK_KEYWORDS.map(kw => (
                        <button
                            key={kw}
                            onClick={() => { setSearchInput(kw); handleSearch(undefined, kw); }}
                            className="shrink-0 px-3.5 py-2 rounded-full bg-white/80 backdrop-blur-md text-[12px] font-bold text-gray-600 border border-white/50 shadow-md hover:bg-white active:scale-95 transition-all"
                        >
                            {kw}
                        </button>
                    ))}
                </div>

                <div className="flex gap-2">
                    <select
                        value={selectedProvince}
                        onChange={e => applySelection(e.target.value, REGION_TREE[e.target.value][0])}
                        className="flex-1 h-9 rounded-xl bg-white/80 backdrop-blur-md border border-white/50 shadow-md text-[12px] font-black text-gray-700 outline-none px-3 cursor-pointer hover:bg-white"
                    >
                        {Object.keys(REGION_TREE).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select
                        value={selectedCity}
                        onChange={e => applySelection(selectedProvince, e.target.value)}
                        className="flex-1 h-9 rounded-xl bg-white/80 backdrop-blur-md border border-white/50 shadow-md text-[12px] font-black text-gray-700 outline-none px-3 cursor-pointer hover:bg-white"
                    >
                        {REGION_TREE[selectedProvince].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>

                {error && (
                    <div className="bg-rose-50/90 backdrop-blur-md border border-rose-200 px-4 py-2.5 rounded-xl">
                        <p className="text-[12px] font-black text-rose-600 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-rose-600" /> {error}
                        </p>
                    </div>
                )}
            </div>

            <div className={`absolute bottom-6 left-3 right-3 sm:left-6 sm:right-6 z-20 flex justify-center transition-all ${mobileView === 'list' ? 'translate-y-[-42vh]' : ''}`}>
                <div className="bg-white/95 backdrop-blur-2xl border border-white shadow-[0_12px_40px_rgba(0,0,0,0.15)] rounded-2xl sm:rounded-3xl px-5 h-16 flex items-center gap-4 max-w-lg w-full">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                            <Sparkles size={14} className="text-pink-500" strokeWidth={2.5} />
                            <span className="text-[15px] font-black text-gray-900 leading-tight truncate max-w-[120px] sm:max-w-none">{resolvedLabel}</span>
                        </div>
                        <span className="text-[11px] font-bold text-gray-400 mt-0.5 ml-5">{activePois.length}개의 스팟 발견</span>
                    </div>
                    <div className="flex-1" />
                    <button
                        onClick={() => setMobileView(mobileView === 'map' ? 'list' : 'map')}
                        className="bg-gray-900 hover:bg-black text-white text-[13px] font-black px-5 h-11 rounded-xl flex items-center gap-2 shadow-lg active:scale-95 transition-all"
                    >
                        {mobileView === 'map' ? <><Navigation size={14} fill="white" /> 목록 보기</> : <><Search size={14} /> 지도 보기</>}
                    </button>
                </div>
            </div>

            {mobileView === 'list' && (
                <div className="absolute bottom-0 left-0 right-0 z-10 bg-white/80 backdrop-blur-3xl shadow-[0_-12px_50px_rgba(0,0,0,0.12)] rounded-t-[32px] sm:rounded-t-[40px] h-[48vh] flex flex-col border-t border-white/50">
                    <div className="h-8 flex items-center justify-center shrink-0">
                        <div className="w-12 h-1.5 rounded-full bg-gray-200" />
                    </div>
                    <div className="flex-1 overflow-y-auto px-5 pb-12 sm:px-8">
                        <div className="flex flex-col gap-2.5">
                            <h3 className="text-[18px] font-black text-gray-900 mb-2 px-1">검색 결과</h3>
                            {activePois.length === 0 ? (
                                <div className="rounded-2xl border border-white/80 bg-white/70 p-5 text-center">
                                    <p className="text-[14px] font-bold text-gray-700">주변 결과가 없습니다.</p>
                                    <p className="mt-1 text-[12px] font-medium text-gray-500">다른 역/지역으로 다시 검색해보세요.</p>
                                </div>
                            ) : activePois.map((p, idx) => (
                                <div
                                    key={p.id}
                                    onClick={() => {
                                        setCenter({ lat: p.lat, lng: p.lng });
                                        mapRef.current?.setCenter(new window.kakao.maps.LatLng(p.lat, p.lng));
                                        mapRef.current?.setLevel(3);
                                        setMobileView('map');
                                        setSelectedPoi(p);
                                    }}
                                    className="flex items-center gap-4 p-4 rounded-2xl bg-white/60 hover:bg-white border border-white/80 hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer group shadow-sm"
                                >
                                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 border border-white shadow-sm flex items-center justify-center text-gray-900 font-black text-[14px] group-hover:scale-110 group-hover:bg-pink-500 group-hover:text-white transition-all">
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-extrabold text-[16px] text-gray-900 truncate group-hover:text-pink-600 transition-colors tracking-tight">{p.name}</p>
                                        <p className="text-[12px] font-bold text-gray-400 truncate mt-0.5">{p.distanceKm?.toFixed(1)}km · {p.address}</p>
                                    </div>
                                    <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-50 group-hover:bg-pink-50 transition-colors">
                                        <ChevronRight size={18} className="text-gray-300 group-hover:text-pink-500 group-hover:translate-x-1 transition-all" strokeWidth={3} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Spot Preview Card */}
            {selectedPoi && mobileView === 'map' && (
                <div className="absolute bottom-24 left-3 right-3 sm:left-6 sm:right-6 z-30 flex justify-center">
                    <div className="bg-white/95 backdrop-blur-2xl border border-white shadow-[0_12px_40px_rgba(0,0,0,0.15)] rounded-2xl p-4 max-w-lg w-full">
                        <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                                <p className="text-[16px] font-extrabold text-gray-900 truncate">{selectedPoi.name}</p>
                                <p className="text-[12px] font-medium text-gray-400 mt-0.5 truncate">{selectedPoi.address}</p>
                            </div>
                            <button
                                onClick={() => setSelectedPoi(null)}
                                className="shrink-0 ml-2 text-gray-300 hover:text-gray-500 text-[18px] font-bold"
                            >
                                ✕
                            </button>
                        </div>
                        {selectedPoi.dbId && (
                            <Link
                                href={`/${locale}/spot/${selectedPoi.dbId}`}
                                className="mt-3 flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-[#1d1d1f] text-white text-[13px] font-extrabold hover:bg-black transition"
                            >
                                {detailLabel || '상세보기 →'}
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
