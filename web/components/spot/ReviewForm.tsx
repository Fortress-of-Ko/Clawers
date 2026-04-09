'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import StarRating from '@/components/spot/StarRating';
import ImageUploader from '@/components/spot/ImageUploader';
import type { ReviewRow } from '@/lib/spot-types';

type Props = {
    spotId: string;
    existingReview: ReviewRow | null;
    labels: {
        rating: string;
        contentPlaceholder: string;
        photos: string;
        submit: string;
        update: string;
        minContent: string;
        maxPhotos: string;
        loginRequired: string;
    };
    isLoggedIn: boolean;
};

export default function ReviewForm({ spotId, existingReview, labels, isLoggedIn }: Props) {
    const router = useRouter();
    const [rating, setRating] = useState(existingReview?.rating ?? 0);
    const [content, setContent] = useState(existingReview?.content ?? '');
    const [images, setImages] = useState<string[]>(existingReview?.images ?? []);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const isEdit = !!existingReview;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!isLoggedIn) {
            setError(labels.loginRequired);
            return;
        }
        if (rating === 0) {
            setError(labels.rating);
            return;
        }
        if (content.trim().length < 10) {
            setError(labels.minContent);
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(`/api/spots/${spotId}/reviews`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rating, content: content.trim(), images }),
            });

            if (res.ok) {
                router.refresh();
            } else {
                const data = await res.json();
                setError(data.error ?? 'Failed');
            }
        } catch {
            setError('Failed');
        }
        setSubmitting(false);
    };

    return (
        <form onSubmit={handleSubmit} className="rounded-[14px] border border-white/80 bg-white/75 p-4 space-y-4">
            <div>
                <p className="text-[12px] font-bold text-[#86868b] mb-1.5">{labels.rating}</p>
                <StarRating value={rating} onChange={setRating} size={28} />
            </div>

            <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={labels.contentPlaceholder}
                rows={4}
                className="w-full rounded-xl border border-[#e8e8ed] bg-white/60 px-3.5 py-3 text-[13px] text-[#1d1d1f] placeholder:text-[#b0b0b8] outline-none focus:border-[#86868b] transition resize-none"
            />

            <ImageUploader
                spotId={spotId}
                images={images}
                onChange={setImages}
                label={labels.photos.replace('{count}', String(images.length))}
                maxLabel={labels.maxPhotos}
            />

            {error && (
                <p className="text-[12px] font-bold text-red-500">{error}</p>
            )}

            <button
                type="submit"
                disabled={submitting || rating === 0}
                className="w-full rounded-xl bg-[#1d1d1f] text-white text-[13px] font-extrabold py-3 hover:bg-black transition disabled:opacity-40"
            >
                {submitting ? '...' : isEdit ? labels.update : labels.submit}
            </button>
        </form>
    );
}
