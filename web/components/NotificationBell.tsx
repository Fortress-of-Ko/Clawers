'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, MessageCircle, Heart, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Notification = {
    id: string;
    type: 'comment' | 'like';
    post_id: string;
    actor_id: string;
    is_read: boolean;
    created_at: string;
    actor: { display_name: string; avatar_url: string | null };
    post: { title: string };
};

function relativeTime(dateStr: string, isKo: boolean): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return isKo ? '방금' : 'just now';
    if (minutes < 60) return isKo ? `${minutes}분 전` : `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return isKo ? `${hours}시간 전` : `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return isKo ? `${days}일 전` : `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
}

export default function NotificationBell({ locale }: { locale: string }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const isKo = locale === 'ko';

    const fetchNotifications = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/notifications?limit=20');
            if (!res.ok) return;
            const data = await res.json();
            setNotifications(data.notifications ?? []);
            setUnreadCount(data.unread_count ?? 0);
        } catch { /* ignore */ }
        setIsLoading(false);
    }, []);

    // Fetch on mount
    useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

    // Re-fetch when dropdown opens
    useEffect(() => { if (isOpen) fetchNotifications(); }, [isOpen, fetchNotifications]);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    const markRead = async (id: string) => {
        await fetch('/api/notifications', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        });
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
    };

    const markAllRead = async () => {
        await fetch('/api/notifications', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ all: true }),
        });
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
    };

    const handleClick = (n: Notification) => {
        if (!n.is_read) markRead(n.id);
        setIsOpen(false);
        router.push(`/${locale}/community`);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-[12px] text-[#86868b] hover:bg-white/50 hover:text-[#1d1d1f] transition-all relative"
                aria-label="Notifications"
            >
                <Bell size={18} strokeWidth={2.5} />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 sm:w-[18px] sm:h-[18px] bg-[#e64980] rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-black text-white shadow-sm">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-[320px] sm:w-[360px] bg-white rounded-[16px] shadow-[0_12px_40px_rgba(0,0,0,0.15)] border border-gray-100 overflow-hidden z-50">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <span className="text-[14px] font-black text-[#1d1d1f]">
                            {isKo ? '알림' : 'Notifications'}
                        </span>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllRead}
                                className="flex items-center gap-1 text-[12px] font-bold text-[#e64980] hover:bg-[#fff0f5] px-2 py-1 rounded-lg transition-colors"
                            >
                                <Check size={12} />
                                {isKo ? '모두 읽음' : 'Mark all read'}
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {isLoading && notifications.length === 0 ? (
                            <div className="py-12 text-center text-[13px] font-medium text-[#86868b]">
                                {isKo ? '로딩 중...' : 'Loading...'}
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="py-12 text-center">
                                <Bell size={24} className="mx-auto text-[#d1d1d6] mb-2" />
                                <p className="text-[13px] font-medium text-[#86868b]">
                                    {isKo ? '알림이 없습니다' : 'No notifications'}
                                </p>
                            </div>
                        ) : (
                            notifications.map(n => (
                                <button
                                    key={n.id}
                                    onClick={() => handleClick(n)}
                                    className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${!n.is_read ? 'bg-[#fff8fa]' : ''}`}
                                >
                                    {/* Actor avatar */}
                                    <div className="shrink-0 mt-0.5">
                                        {n.actor.avatar_url ? (
                                            <img src={n.actor.avatar_url} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ffd1dc] to-[#ffa0b4] flex items-center justify-center text-white text-[12px] font-black">
                                                {n.actor.display_name.charAt(0)}
                                            </div>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[13px] text-[#1d1d1f] leading-snug">
                                            <span className="font-bold">{n.actor.display_name}</span>
                                            {isKo
                                                ? n.type === 'comment'
                                                    ? '님이 댓글을 달았습니다'
                                                    : '님이 좋아합니다'
                                                : n.type === 'comment'
                                                    ? ' commented on your post'
                                                    : ' liked your post'
                                            }
                                        </p>
                                        <p className="text-[12px] text-[#86868b] truncate mt-0.5">
                                            {n.type === 'comment' ? <MessageCircle size={10} className="inline mr-1" /> : <Heart size={10} className="inline mr-1" />}
                                            {n.post.title}
                                        </p>
                                        <p className="text-[11px] text-[#a1a1a6] mt-0.5">
                                            {relativeTime(n.created_at, isKo)}
                                        </p>
                                    </div>

                                    {/* Unread dot */}
                                    {!n.is_read && (
                                        <div className="shrink-0 mt-2 w-2 h-2 rounded-full bg-[#e64980]" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
