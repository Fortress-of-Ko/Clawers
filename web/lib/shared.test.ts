import { describe, it, expect } from 'vitest';
import { sectionVisual, formatPrice, timeAgo, SECTION_VISUALS } from './shared';

describe('sectionVisual', () => {
  it('returns correct visual for known sections', () => {
    expect(sectionVisual('사고팔기').emoji).toBe('🛍️');
    expect(sectionVisual('후기').emoji).toBe('⭐');
    expect(sectionVisual('질문').emoji).toBe('💬');
    expect(sectionVisual('정보공유').emoji).toBe('💡');
  });

  it('returns 정보공유 as fallback for unknown section', () => {
    expect(sectionVisual('unknown')).toEqual(SECTION_VISUALS['정보공유']);
  });
});

describe('formatPrice', () => {
  it('returns null for null input', () => {
    expect(formatPrice(null)).toBeNull();
  });

  it('formats Korean Won correctly', () => {
    expect(formatPrice(5000)).toBe('₩5,000');
    expect(formatPrice(15000)).toBe('₩15,000');
    expect(formatPrice(0)).toBe('₩0');
  });
});

describe('timeAgo', () => {
  it('returns "방금" for just now', () => {
    expect(timeAgo(new Date().toISOString())).toBe('방금');
  });

  it('returns minutes for recent times', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
    expect(timeAgo(fiveMinAgo)).toBe('5분 전');
  });

  it('returns hours for hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
    expect(timeAgo(twoHoursAgo)).toBe('2시간 전');
  });

  it('returns days for days ago', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    expect(timeAgo(threeDaysAgo)).toBe('3일 전');
  });
});
