export default function CommunityLoading() {
    return (
        <div className="mx-auto w-full max-w-[980px] pb-16 flex flex-col gap-4">
            {/* Header skeleton */}
            <div className="rounded-[24px] sm:rounded-[28px] bg-white/60 backdrop-blur-2xl border border-white/70 shadow-[0_8px_26px_rgba(0,0,0,0.05)] p-4 sm:p-5 flex flex-col gap-3 animate-pulse">
                <div className="flex items-center justify-between">
                    <div className="h-6 w-24 rounded bg-gray-200" />
                    <div className="h-8 w-20 rounded-full bg-gray-200" />
                </div>
                <div className="h-10 rounded-[14px] bg-gray-100" />
                <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="h-7 w-16 rounded-full bg-gray-100" />
                    ))}
                </div>
            </div>

            {/* Post skeletons */}
            <div className="rounded-[24px] sm:rounded-[28px] bg-white/60 backdrop-blur-2xl border border-white/70 shadow-[0_8px_26px_rgba(0,0,0,0.05)] p-3 sm:p-4 space-y-2">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-[14px] border border-white/80 bg-white/75 p-4 animate-pulse">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="h-5 w-14 rounded-[6px] bg-gray-200" />
                            <div className="h-3 w-20 rounded bg-gray-100" />
                        </div>
                        <div className="h-5 w-3/4 rounded bg-gray-200 mb-2" />
                        <div className="h-3 w-full rounded bg-gray-100 mb-3" />
                        <div className="flex gap-4">
                            <div className="h-3 w-8 rounded bg-gray-100" />
                            <div className="h-3 w-8 rounded bg-gray-100" />
                            <div className="h-3 w-8 rounded bg-gray-100" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
