'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export default function CommunitySearch({ placeholder }: { placeholder: string }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();
    const [value, setValue] = useState(searchParams.get('q') ?? '');
    const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

    // Sync input when URL changes externally (e.g. back/forward)
    useEffect(() => {
        setValue(searchParams.get('q') ?? '');
    }, [searchParams]);

    // Cleanup timer on unmount
    useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

    function pushSearch(q: string) {
        const params = new URLSearchParams(searchParams.toString());
        if (q) {
            params.set('q', q);
        } else {
            params.delete('q');
        }
        params.delete('page'); // Reset to page 1 on new search
        startTransition(() => {
            router.push(`${pathname}?${params.toString()}`);
        });
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const q = e.target.value;
        setValue(q);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => pushSearch(q), 300);
    }

    function handleClear() {
        setValue('');
        if (timerRef.current) clearTimeout(timerRef.current);
        pushSearch('');
    }

    return (
        <div className="flex items-center gap-2 rounded-[14px] border border-white/80 bg-white/75 px-3 py-2.5 focus-within:border-[#e64980] transition-colors">
            {isPending ? (
                <Loader2 size={15} className="text-[#e64980] animate-spin shrink-0" />
            ) : (
                <Search size={15} className="text-[#9e9ea5] shrink-0" />
            )}
            <input
                type="text"
                value={value}
                onChange={handleChange}
                placeholder={placeholder}
                className="w-full bg-transparent text-sm text-[#1d1d1f] outline-none placeholder:text-[#9e9ea5]"
            />
            {value && (
                <button onClick={handleClear} className="shrink-0 text-[#9e9ea5] hover:text-[#1d1d1f] transition-colors">
                    <X size={14} />
                </button>
            )}
        </div>
    );
}
