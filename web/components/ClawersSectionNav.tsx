'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, MapPin, MessageCircle, PlayCircle, Star, User, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/supabase/useAuth';
import NotificationBell from '@/components/NotificationBell';

type Props = {
    locale: string;
    labels: {
        home: string;
        map: string;
        reviews: string;
        community: string;
        watch: string;
    };
};

export default function ClawersSectionNav({ locale, labels }: Props) {
    const pathname = usePathname() || '';
    const base = `/${locale}`;
    const { user, supabase } = useAuth();
    const [showUserMenu, setShowUserMenu] = useState(false);

    const [isVisible, setIsVisible] = useState(true);
    const lastScrollYRef = useRef(0);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            if (currentScrollY > lastScrollYRef.current && currentScrollY > 80) {
                // scrolling down and past threshold
                setIsVisible(false);
            } else {
                // scrolling up
                setIsVisible(true);
            }
            lastScrollYRef.current = currentScrollY;
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const navItems = [
        { key: 'home', icon: <Home size={18} strokeWidth={2.5} />, href: base, label: labels.home, isActive: pathname === base },
        { key: 'map', icon: <MapPin size={18} strokeWidth={2.5} />, href: `${base}/map`, label: labels.map, isActive: pathname.endsWith('/map') },
        { key: 'reviews', icon: <Star size={18} strokeWidth={2.5} />, href: `${base}/reviews`, label: labels.reviews, isActive: pathname.endsWith('/reviews') },
        { key: 'community', icon: <MessageCircle size={18} strokeWidth={2.5} />, href: `${base}/community`, label: labels.community, isActive: pathname.endsWith('/community') },
        { key: 'watch', icon: <PlayCircle size={18} strokeWidth={2.5} />, href: `${base}/watch`, label: labels.watch, isActive: pathname.endsWith('/watch') },
    ];

    return (
        <div className={`clawers-nav-container fixed left-0 right-0 z-50 flex justify-center px-2 sm:px-4 pointer-events-none transition-all duration-500 ease-out ${isVisible ? 'top-4 sm:top-6 translate-y-0 opacity-100' : 'top-0 -translate-y-[150%] opacity-0'}`}>
            <nav className="flex items-center gap-0.5 sm:gap-2 rounded-[20px] sm:rounded-[24px] bg-white/60 shadow-[0_16px_40px_rgba(0,0,0,0.06)] backdrop-blur-2xl border border-white p-1.5 sm:p-2 pointer-events-auto max-w-full overflow-x-auto scrollbar-hide">
                <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 mr-0.5 sm:mr-1 border-r border-black/5 shrink-0">
                    <img src="/clawers/icons/claw_hub_logo.webp" width={24} height={24} alt="Logo" className="mix-blend-multiply drop-shadow-sm rounded-full overflow-hidden shrink-0 sm:w-[28px] sm:h-[28px]" />
                    <span className="text-[13px] sm:text-[15px] font-black text-[#1d1d1f] tracking-tight hidden sm:block">Clawers</span>
                </div>

                {navItems.map((item) => (
                    <Link
                        key={item.key}
                        href={item.href}
                        className={`relative flex items-center justify-center gap-1.5 sm:gap-2 rounded-[12px] sm:rounded-[16px] px-2.5 py-2 sm:px-4 sm:py-2.5 text-[13px] sm:text-[14px] font-bold transition-all shrink-0 ${item.isActive
                            ? 'bg-white shadow-[0_4px_12px_rgba(0,0,0,0.04)] text-[#e64980] scale-100'
                            : 'text-[#86868b] hover:bg-white/50 hover:text-[#1d1d1f] scale-[0.98] hover:scale-100'
                            }`}
                    >
                        {item.icon}
                        <span className={`${item.isActive ? 'block' : 'hidden sm:block'}`}>{item.label}</span>
                    </Link>
                ))}

                {/* Notifications — only show when logged in */}
                {user && <NotificationBell locale={locale} />}

                {/* Auth */}
                <div className="ml-0.5 sm:ml-1 pl-1.5 sm:pl-2 border-l border-black/5 relative shrink-0">
                    {user ? (
                        <>
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="flex items-center gap-1.5 sm:gap-2 rounded-[12px] sm:rounded-[16px] px-2 sm:px-3 py-2 sm:py-2.5 text-[13px] font-bold text-[#1d1d1f] hover:bg-white/50 transition-all"
                            >
                                {user.user_metadata?.avatar_url ? (
                                    <img src={user.user_metadata.avatar_url} alt="" className="w-5 h-5 sm:w-6 sm:h-6 rounded-full" referrerPolicy="no-referrer" />
                                ) : (
                                    <User size={16} strokeWidth={2.5} className="text-[#e64980] sm:w-[18px] sm:h-[18px]" />
                                )}
                                <span className="hidden sm:block max-w-[80px] truncate">
                                    {user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0]}
                                </span>
                            </button>
                            {showUserMenu && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                                    <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-xl shadow-xl border border-gray-100 py-1 min-w-[160px]">
                                        <Link href={`${base}/community?mine=1`} onClick={() => setShowUserMenu(false)}
                                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                                            <MessageCircle size={14} /> {locale === 'ko' ? '내 글' : 'My posts'}
                                        </Link>
                                        <button
                                            onClick={async () => {
                                                await supabase.auth.signOut({ scope: 'local' });
                                                setShowUserMenu(false);
                                                window.location.reload();
                                            }}
                                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 w-full text-left">
                                            <LogOut size={14} /> {locale === 'ko' ? '로그아웃' : 'Sign out'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </>
                    ) : (
                        <Link
                            href={`/auth/login?next=${encodeURIComponent(pathname)}`}
                            className="flex items-center gap-1 sm:gap-1.5 rounded-[12px] sm:rounded-[16px] px-3 py-2 sm:px-4 sm:py-2.5 text-[12px] sm:text-[13px] font-bold text-white bg-[#e64980] hover:bg-[#d03870] transition-all shadow-sm"
                        >
                            <User size={14} strokeWidth={2.5} className="sm:w-[16px] sm:h-[16px]" />
                            <span className="hidden sm:block">{locale === 'ko' ? '로그인' : 'Sign in'}</span>
                        </Link>
                    )}
                </div>
            </nav>
        </div>
    );
}
