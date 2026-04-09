'use client';

import { useRef, useState } from 'react';
import { Camera, X, Loader2 } from 'lucide-react';
import { reviewImageUrl } from '@/lib/spot-types';

type Props = {
    spotId: string;
    images: string[];
    onChange: (images: string[]) => void;
    label: string;
    maxLabel: string;
};

async function resizeImage(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const MAX_W = 1200;
            const scale = img.width > MAX_W ? MAX_W / img.width : 1;
            const w = Math.round(img.width * scale);
            const h = Math.round(img.height * scale);

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, w, h);
            canvas.toBlob(
                (blob) => blob ? resolve(blob) : reject(new Error('toBlob failed')),
                'image/webp',
                0.8,
            );
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}

export default function ImageUploader({ spotId, images, onChange, label, maxLabel }: Props) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const handleFiles = async (files: FileList | null) => {
        if (!files) return;
        const remaining = 3 - images.length;
        if (remaining <= 0) return;

        setUploading(true);
        const newPaths: string[] = [];

        for (let i = 0; i < Math.min(files.length, remaining); i++) {
            try {
                const resized = await resizeImage(files[i]);
                const formData = new FormData();
                formData.append('file', resized, 'image.webp');
                formData.append('spot_id', spotId);

                const res = await fetch('/api/upload/review-image', {
                    method: 'POST',
                    body: formData,
                });

                if (res.ok) {
                    const { path } = await res.json();
                    newPaths.push(path);
                }
            } catch (err) {
                console.error('Upload failed:', err);
            }
        }

        if (newPaths.length > 0) {
            onChange([...images, ...newPaths]);
        }
        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
    };

    const removeImage = (index: number) => {
        onChange(images.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-2">
            <p className="text-[12px] font-bold text-[#86868b]">{label}</p>
            <div className="flex gap-2 flex-wrap">
                {images.map((path, idx) => (
                    <div key={path} className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/80 shadow-sm">
                        <img
                            src={reviewImageUrl(path)}
                            alt=""
                            className="w-full h-full object-cover"
                        />
                        <button
                            type="button"
                            onClick={() => removeImage(idx)}
                            className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                        >
                            <X size={12} className="text-white" />
                        </button>
                    </div>
                ))}
                {images.length < 3 && (
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        disabled={uploading}
                        className="w-20 h-20 rounded-xl border-2 border-dashed border-[#d1d1d6] flex items-center justify-center text-[#86868b] hover:border-[#86868b] transition"
                    >
                        {uploading ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
                    </button>
                )}
            </div>
            {images.length >= 3 && (
                <p className="text-[11px] text-[#86868b]">{maxLabel}</p>
            )}
            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
            />
        </div>
    );
}
