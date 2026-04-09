'use client';

import { useState } from 'react';
import { Flag } from 'lucide-react';

type Props = {
    spotId: string;
    label: string;
};

const REASONS = [
    { value: 'closed', label: '폐업', en: 'Closed' },
    { value: 'moved', label: '이전', en: 'Moved' },
    { value: 'wrong_info', label: '정보 오류', en: 'Wrong Info' },
] as const;

export default function ReportButton({ spotId, label }: Props) {
    const [reported, setReported] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleReport = async (reason: string) => {
        if (loading || reported) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/spots/${spotId}/report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason }),
            });
            if (res.ok) setReported(true);
        } catch {
            // silent
        }
        setLoading(false);
    };

    if (reported) {
        return (
            <span className="text-[11px] font-bold text-gray-400">신고 완료</span>
        );
    }

    return (
        <div className="relative group">
            <button className="flex items-center gap-1 text-[11px] font-medium text-[#b0b0b8] hover:text-red-400 transition">
                <Flag size={11} /> {label}
            </button>
            <div className="hidden group-hover:flex absolute right-0 top-full mt-1 bg-white rounded-xl border border-gray-100 shadow-xl py-1 z-10 min-w-[100px]">
                {REASONS.map(r => (
                    <button
                        key={r.value}
                        onClick={() => handleReport(r.value)}
                        className="w-full px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 text-left"
                    >
                        {r.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
