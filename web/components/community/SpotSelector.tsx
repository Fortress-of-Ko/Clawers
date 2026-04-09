'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, MapPin, X, Loader2, Check } from 'lucide-react';
import { ensureKakaoLoaded } from '@/lib/utils/kakao';

type KakaoPlace = {
    id: string;
    place_name: string;
    address_name: string;
    y: string; // lat
    x: string; // lng
};

type SelectedSpot = {
    kakao_place_id: string;
    place_name: string;
    address: string;
    lat: number;
    lng: number;
    spot_id?: string; // DB id if already registered
};

type Props = {
    value: SelectedSpot | null;
    onChange: (spot: SelectedSpot | null) => void;
    placeholder?: string;
};

export default function SpotSelector({ value, onChange, placeholder = '장소 검색 (예: 홍대 인형뽑기)' }: Props) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<KakaoPlace[]>([]);
    const [searching, setSearching] = useState(false);
    const [open, setOpen] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const searchPlaces = async (q: string) => {
        if (q.length < 2) { setResults([]); return; }
        setSearching(true);

        try {
            await ensureKakaoLoaded('services');
            const { kakao } = window;
            const ps = new kakao.maps.services.Places();

            const terms = [`${q} 인형뽑기`, `${q} 오락실`, `${q} 게임센터`];
            const allResults: KakaoPlace[] = [];
            let completed = 0;

            await new Promise<void>((resolve) => {
                terms.forEach((term) => {
                    ps.keywordSearch(term, (data: any[], status: string) => {
                        completed++;
                        if (status === kakao.maps.services.Status.OK) {
                            data.forEach((place: any) => {
                                allResults.push({
                                    id: place.id,
                                    place_name: place.place_name,
                                    address_name: place.address_name || '',
                                    y: place.y,
                                    x: place.x,
                                });
                            });
                        }
                        if (completed === terms.length) resolve();
                    }, { size: 10 });
                });
            });

            // Dedupe by kakao id
            const seen = new Set<string>();
            const unique = allResults.filter(p => {
                if (seen.has(p.id)) return false;
                seen.add(p.id);
                return true;
            });

            setResults(unique.slice(0, 15));
            setOpen(true);
        } catch {
            setResults([]);
        }
        setSearching(false);
    };

    const handleInput = (q: string) => {
        setQuery(q);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => searchPlaces(q), 400);
    };

    const handleSelect = (place: KakaoPlace) => {
        onChange({
            kakao_place_id: place.id,
            place_name: place.place_name,
            address: place.address_name,
            lat: Number(place.y),
            lng: Number(place.x),
        });
        setQuery('');
        setOpen(false);
        setResults([]);
    };

    const handleClear = () => {
        onChange(null);
        setQuery('');
    };

    useEffect(() => {
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, []);

    if (value) {
        return (
            <div className="flex items-center gap-2 rounded-xl border border-pink-200 bg-pink-50 px-3 py-2.5">
                <MapPin size={14} className="text-pink-500 shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{value.place_name}</p>
                    <p className="text-xs text-gray-500 truncate">{value.address}</p>
                </div>
                <button type="button" onClick={handleClear} className="shrink-0 p-1 rounded-full hover:bg-pink-100">
                    <X size={14} className="text-pink-400" />
                </button>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="relative">
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 focus-within:border-[#e64980] transition">
                {searching ? (
                    <Loader2 size={14} className="text-gray-400 animate-spin shrink-0" />
                ) : (
                    <Search size={14} className="text-gray-400 shrink-0" />
                )}
                <input
                    value={query}
                    onChange={e => handleInput(e.target.value)}
                    onFocus={() => results.length > 0 && setOpen(true)}
                    placeholder={placeholder}
                    className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
                />
            </div>

            {open && results.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-gray-100 shadow-xl max-h-[240px] overflow-y-auto z-50">
                    {results.map(place => (
                        <button
                            key={place.id}
                            type="button"
                            onClick={() => handleSelect(place)}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition text-left"
                        >
                            <MapPin size={13} className="text-pink-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900 truncate">{place.place_name}</p>
                                <p className="text-xs text-gray-400 truncate">{place.address_name}</p>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
