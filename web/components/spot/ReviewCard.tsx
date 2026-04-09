'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Pencil } from 'lucide-react';
import StarRating from '@/components/spot/StarRating';
import { type ReviewRow, reviewImageUrl } from '@/lib/spot-types';
import { timeAgo } from '@/lib/shared';

type Props = {
    review: ReviewRow;
    isOwner: boolean;
    spotId: string;
    onDeleted: () => void;
    onEdit: () => void;
    deleteLabel: string;
    editLabel: string;
    confirmLabel: string;
};

export default function ReviewCard({ review, isOwner, spotId, onDeleted, onEdit, deleteLabel, editLabel, confirmLabel }: Props) {
    const router = useRouter();
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        if (!confirm(confirmLabel)) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/spots/${spotId}/reviews`, { method: 'DELETE' });
            if (res.ok) {
                onDeleted();
                router.refresh();
            }
        } catch {
            // silent
        }
        setDeleting(false);
    };

    return (
        <div className="rounded-[14px] border border-white/80 bg-white/75 p-4 transition-all">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-100 to-pink-200 flex items-center justify-center text-[12px] font-extrabold text-pink-600">
                        {(review.display_name ?? '크')[0]}
                    </div>
                    <div>
                        <p className="text-[13px] font-extrabold text-[#1d1d1f]">{review.display_name ?? '크로러'}</p>
                        <p className="text-[11px] text-[#86868b]">{timeAgo(review.created_at)}</p>
                    </div>
                </div>
                {isOwner && (
                    <div className="flex items-center gap-1">
                        <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-gray-100 transition text-[#86868b]">
                            <Pencil size={14} />
                        </button>
                        <button onClick={handleDelete} disabled={deleting} className="p-1.5 rounded-lg hover:bg-red-50 transition text-[#86868b] hover:text-red-500">
                            <Trash2 size={14} />
                        </button>
                    </div>
                )}
            </div>
            <StarRating value={review.rating} size={16} />
            <p className="mt-2 text-[13px] text-[#1d1d1f] leading-relaxed">{review.content}</p>
            {review.images.length > 0 && (
                <div className="flex gap-2 mt-3">
                    {review.images.map((path) => (
                        <img
                            key={path}
                            src={reviewImageUrl(path)}
                            alt=""
                            className="w-20 h-20 rounded-xl object-cover border border-white/80 shadow-sm"
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
