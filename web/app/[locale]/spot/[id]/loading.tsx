export default function SpotDetailLoading() {
    return (
        <div className="mx-auto w-full max-w-[720px] pb-16 flex flex-col gap-4 px-4">
            {/* Spot Header skeleton */}
            <div className="rounded-[24px] sm:rounded-[28px] bg-white/60 backdrop-blur-2xl border border-white/70 shadow-[0_8px_26px_rgba(0,0,0,0.05)] p-4 sm:p-6 space-y-4 animate-pulse">
                <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                        <div className="h-7 w-48 bg-gray-200 rounded-lg" />
                        <div className="h-4 w-64 bg-gray-100 rounded-lg" />
                    </div>
                    <div className="h-10 w-20 bg-gray-100 rounded-full" />
                </div>
                <div className="flex gap-3">
                    <div className="h-4 w-32 bg-gray-100 rounded-lg" />
                    <div className="h-4 w-24 bg-gray-100 rounded-lg" />
                </div>
                <div className="h-[180px] bg-gray-100 rounded-[14px]" />
            </div>

            {/* Review form skeleton */}
            <div className="rounded-[24px] sm:rounded-[28px] bg-white/60 backdrop-blur-2xl border border-white/70 shadow-[0_8px_26px_rgba(0,0,0,0.05)] p-4 sm:p-5 space-y-3 animate-pulse">
                <div className="h-5 w-24 bg-gray-200 rounded-lg" />
                <div className="h-7 w-40 bg-gray-100 rounded-lg" />
                <div className="h-24 bg-gray-100 rounded-xl" />
                <div className="h-10 bg-gray-200 rounded-xl" />
            </div>

            {/* Reviews skeleton */}
            <div className="rounded-[24px] sm:rounded-[28px] bg-white/60 backdrop-blur-2xl border border-white/70 shadow-[0_8px_26px_rgba(0,0,0,0.05)] p-3 sm:p-4 space-y-2 animate-pulse">
                <div className="h-5 w-28 bg-gray-200 rounded-lg mx-1" />
                {[1, 2, 3].map(i => (
                    <div key={i} className="rounded-[14px] border border-white/80 bg-white/75 p-4 space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gray-200 rounded-full" />
                            <div className="space-y-1">
                                <div className="h-3.5 w-20 bg-gray-200 rounded" />
                                <div className="h-3 w-14 bg-gray-100 rounded" />
                            </div>
                        </div>
                        <div className="h-4 w-24 bg-gray-100 rounded" />
                        <div className="h-4 w-full bg-gray-100 rounded" />
                        <div className="h-3.5 w-3/4 bg-gray-50 rounded" />
                    </div>
                ))}
            </div>
        </div>
    );
}
