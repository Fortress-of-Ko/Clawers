'use client';

import { useState } from 'react';
import { Heart, MapPin, Cpu } from 'lucide-react';
import StarRating from '@/components/spot/StarRating';
import type { SpotRow } from '@/lib/spot-types';

type Props = {
    spot: SpotRow;
    initialLiked: boolean;
    labels: {
        machines: string;
        reviewCount: string;
        liked: string;
    };
};

export default function SpotHeader({ spot, initialLiked, labels }: Props) {
    const [liked, setLiked] = useState(initialLiked);
    const [likeCount, setLikeCount] = useState(spot.like_count);
    const [loading, setLoading] = useState(false);

    const toggleLike = async () => {
        if (loading) return;
        setLoading(true);

        const prev = liked;
        setLiked(!prev);
        setLikeCount(c => prev ? Math.max(0, c - 1) : c + 1);

        try {
            const res = await fetch(`/api/spots/${spot.id}/like`, { method: 'POST' });
            if (!res.ok) {
                setLiked(prev);
                setLikeCount(c => prev ? c + 1 : Math.max(0, c - 1));
            }
        } catch {
            setLiked(prev);
            setLikeCount(c => prev ? c + 1 : Math.max(0, c - 1));
        }
        setLoading(false);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-[22px] sm:text-[26px] font-extrabold text-[#1d1d1f] tracking-tight leading-tight">
                        {spot.place_name || spot.point}
                    </h1>
                    <div className="flex items-center gap-1.5 mt-1 text-[13px] text-[#86868b]">
                        <MapPin size={13} />
                        <span>{spot.area} {spot.point}</span>
                    </div>
                </div>
                <button
                    onClick={toggleLike}
                    className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-full border font-extrabold text-[12px] transition-all ${
                        liked
                            ? 'bg-pink-50 border-pink-200 text-pink-600'
                            : 'bg-white/70 border-[#e8e8ed] text-[#6f6f76] hover:bg-white'
                    }`}
                >
                    <Heart size={14} className={liked ? 'fill-pink-500 text-pink-500' : ''} />
                    {likeCount}
                </button>
            </div>

            <div className="flex items-center gap-3 text-[13px] text-[#86868b] font-medium">
                {spot.review_count > 0 && (
                    <div className="flex items-center gap-1">
                        <StarRating value={Math.round(spot.avg_rating)} size={14} />
                        <span className="font-extrabold text-[#1d1d1f]">{Number(spot.avg_rating).toFixed(1)}</span>
                        <span>· {labels.reviewCount.replace('{count}', String(spot.review_count))}</span>
                    </div>
                )}
                <div className="flex items-center gap-1">
                    <Cpu size={13} />
                    <span>{labels.machines.replace('{count}', String(spot.machines))}</span>
                </div>
                {spot.price && (
                    <span>{spot.price}</span>
                )}
            </div>
        </div>
    );
}
