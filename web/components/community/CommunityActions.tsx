'use client';

import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { Heart, Pencil, Trash2, MoreHorizontal, X } from 'lucide-react';
import SpotSelector from '@/components/community/SpotSelector';

const SECTIONS = ['정보공유', '후기', '질문', '사고팔기'] as const;

type SelectedSpot = {
  kakao_place_id: string;
  place_name: string;
  address: string;
  lat: number;
  lng: number;
  spot_id?: string;
};

// --- Write Post Modal ---

export function WritePostButton({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<string>('정보공유');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [area, setArea] = useState('');
  const [priceKrw, setPriceKrw] = useState('');
  const [selectedSpot, setSelectedSpot] = useState<SelectedSpot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) { setError('제목과 내용을 입력해주세요.'); return; }
    setSubmitting(true);
    setError('');
    try {
      // Auto-register spot if selected and not yet in DB
      let spotId: string | null = null;
      if (selectedSpot) {
        if (selectedSpot.spot_id) {
          spotId = selectedSpot.spot_id;
        } else {
          const regRes = await fetch('/api/spots/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kakao_place_id: selectedSpot.kakao_place_id,
              place_name: selectedSpot.place_name,
              address: selectedSpot.address,
              lat: selectedSpot.lat,
              lng: selectedSpot.lng,
            }),
          });
          if (regRes.ok) {
            const regData = await regRes.json();
            spotId = regData.id;
          }
        }
      }

      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section,
          title: title.trim(),
          content: content.trim(),
          area: selectedSpot?.address || area.trim(),
          price_krw: priceKrw ? Number(priceKrw) : null,
          spot_id: spotId,
        }),
      });
      if (res.status === 401) { setError('로그인이 필요합니다.'); return; }
      if (!res.ok) { const data = await res.json(); setError(data.error || '작성 실패'); return; }
      window.location.reload();
    } catch {
      setError('네트워크 오류');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-full bg-[#e64980] px-4 py-2 text-[12px] font-extrabold text-white shadow-[0_2px_8px_rgba(230,73,128,0.25)] transition-all hover:bg-[#d03870] hover:shadow-[0_4px_12px_rgba(230,73,128,0.35)] active:scale-[0.97]"
      >
        {label}
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg mx-4 bg-white rounded-[24px] shadow-2xl p-5 sm:p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[18px] font-extrabold text-[#1d1d1f]">새 글 작성</h3>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-full hover:bg-gray-100"><X size={18} /></button>
            </div>

            {/* Section selector */}
            <div className="flex gap-2 mb-3">
              {SECTIONS.map(s => (
                <button key={s} onClick={() => setSection(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${section === s ? 'bg-[#1d1d1f] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {s}
                </button>
              ))}
            </div>

            {/* Title */}
            <input
              value={title} onChange={e => setTitle(e.target.value)}
              placeholder="제목"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#e64980] mb-2"
              maxLength={100}
            />

            {/* Content */}
            <textarea
              value={content} onChange={e => setContent(e.target.value)}
              placeholder="내용을 입력하세요..."
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#e64980] mb-2 min-h-[120px] resize-none"
              maxLength={5000}
            />

            {/* Spot selector */}
            <div className="mb-3">
              <SpotSelector value={selectedSpot} onChange={setSelectedSpot} />
            </div>

            {/* Price (사고팔기 only) */}
            {section === '사고팔기' && (
              <div className="mb-3">
                <input
                  value={priceKrw} onChange={e => setPriceKrw(e.target.value.replace(/\D/g, ''))}
                  placeholder="가격 (원)"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#e64980]"
                />
              </div>
            )}

            {error && <p className="text-xs text-red-500 font-bold mb-2">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full rounded-xl bg-[#e64980] py-3 text-sm font-extrabold text-white transition hover:bg-[#d03870] disabled:opacity-50"
            >
              {submitting ? '작성 중...' : '게시하기'}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

// --- Like Button ---

export function LikeButton({ postId, initialCount }: { postId: string; initialCount: number }) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  const toggle = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/posts/${postId}/like`, { method: 'POST' });
      if (res.status === 401) { alert('로그인이 필요합니다.'); return; }
      const data = await res.json();
      setLiked(data.liked);
      setCount(c => data.liked ? c + 1 : Math.max(0, c - 1));
    } catch {} finally { setLoading(false); }
  }, [postId, loading]);

  return (
    <button onClick={toggle} className={`inline-flex items-center gap-1 transition ${liked ? 'text-[#e64980]' : 'text-[#87878f]'}`}>
      <Heart size={12} fill={liked ? '#e64980' : 'none'} /> {count}
    </button>
  );
}

// --- Post Actions Menu (edit/delete for owner) ---

export function PostActions({ postId }: { postId: string }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  const handleDelete = async () => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
    if (res.ok) window.location.reload();
    else if (res.status === 403) alert('본인 글만 삭제할 수 있습니다.');
    else alert('삭제 실패');
  };

  const handleEdit = async () => {
    if (!editTitle.trim() || !editContent.trim()) return;
    const res = await fetch(`/api/posts/${postId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle, content: editContent }),
    });
    if (res.ok) window.location.reload();
    else if (res.status === 403) alert('본인 글만 수정할 수 있습니다.');
    else alert('수정 실패');
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="p-1 rounded-full hover:bg-gray-100">
        <MoreHorizontal size={14} className="text-[#87878f]" />
      </button>
      {open && (
        <div className="absolute right-0 top-6 bg-white shadow-xl rounded-xl border border-gray-100 py-1 z-10 min-w-[100px]">
          <button onClick={() => { setEditing(true); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50">
            <Pencil size={12} /> 수정
          </button>
          <button onClick={() => { handleDelete(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50">
            <Trash2 size={12} /> 삭제
          </button>
        </div>
      )}

      {editing && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setEditing(false)}>
          <div className="w-full max-w-lg mx-4 bg-white rounded-[24px] shadow-2xl p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-[16px] font-extrabold text-[#1d1d1f] mb-3">글 수정</h3>
            <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
              placeholder="제목" className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-900 placeholder:text-gray-400 outline-none mb-2" />
            <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
              placeholder="내용" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none min-h-[100px] resize-none mb-3" />
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="flex-1 rounded-xl border py-2.5 text-sm font-bold">취소</button>
              <button onClick={handleEdit} className="flex-1 rounded-xl bg-[#e64980] py-2.5 text-sm font-extrabold text-white">저장</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
