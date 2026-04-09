'use client';

import { Star } from 'lucide-react';

type Props = {
    value: number;
    onChange?: (value: number) => void;
    size?: number;
};

export default function StarRating({ value, onChange, size = 20 }: Props) {
    const interactive = !!onChange;

    return (
        <div className="inline-flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    disabled={!interactive}
                    onClick={() => onChange?.(star)}
                    className={interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}
                >
                    <Star
                        size={size}
                        className={star <= value ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}
                        strokeWidth={1.5}
                    />
                </button>
            ))}
        </div>
    );
}
