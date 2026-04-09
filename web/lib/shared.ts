export type PostRow = {
    id: string;
    section: '정보공유' | '후기' | '질문' | '사고팔기';
    title: string;
    content: string;
    area: string;
    price_krw: number | null;
    trade_status: 'selling' | 'reserved' | 'sold' | null;
    spot_id: string | null;
    view_count: number;
    like_count: number;
    comment_count: number;
    created_at: string;
};

export const SECTION_VISUALS: Record<string, { emoji: string; gradient: string }> = {
    '사고팔기': { emoji: '🛍️', gradient: 'from-[#fbc2eb] to-[#fad0c4]' },
    '후기':     { emoji: '⭐', gradient: 'from-[#ffecd2] to-[#fcb69f]' },
    '질문':     { emoji: '💬', gradient: 'from-[#a1c4fd] to-[#c2e9fb]' },
    '정보공유': { emoji: '💡', gradient: 'from-[#d4fc79] to-[#96e6a1]' },
};

export function sectionVisual(section: string) {
    return SECTION_VISUALS[section] ?? SECTION_VISUALS['정보공유'];
}

export function formatPrice(krw: number | null) {
    if (krw == null) return null;
    return `₩${krw.toLocaleString()}`;
}

export function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '방금';
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
}
