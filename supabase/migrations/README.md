# Clawers Database Migration History

모든 마이그레이션은 **순서대로** 실행해야 합니다. 각 파일은 이전 파일의 결과에 의존합니다.

## 실행 순서

| # | 파일 | 날짜 | 설명 |
|---|------|------|------|
| 1 | `001_initial_tables.sql` | 2026-03-26 | 기본 테이블 생성 |
| 2 | `002_security_hardening.sql` | 2026-04-03 | 보안 강화 |
| 3 | `003_notifications.sql` | 2026-04-07 | 알림 시스템 |
| 4 | `004_search_index.sql` | 2026-04-07 | 검색 인덱스 |
| 5 | `005_spot_reviews.sql` | 2026-04-08 | 스팟 리뷰 & 좋아요 |
| 6 | `006_spot_integration.sql` | 2026-04-08 | 스팟 연동 (게시글 연결, 폐업신고, 자동등록) |
| 7 | `007_grant_fixes.sql` | 2026-04-08 | GRANT 수정 (하네스 감사 결과) |

---

## 001_initial_tables.sql (2026-03-26)

초기 Clawers + TalkTrio 테이블 생성.

**Clawers 테이블:**
- `clawers_profiles` — 유저 프로필 (display_name, avatar_url, spot_count, post_count)
- `clawers_posts` — 커뮤니티 게시글 (section, title, content, area, images, price_krw, trade_status)
- `clawers_comments` — 게시글 댓글
- `clawers_post_likes` — 게시글 좋아요 (composite PK: post_id + user_id)
- `clawers_spots` — 뽑기방 스팟 (area, point, price, machines, lat, lng, kakao_place_id)

**RPC 함수:**
- `clawers_toggle_like(p_post_id)` — 게시글 좋아요 토글
- `clawers_increment_view(p_post_id)` — 조회수 증가 (service_role only)
- `clawers_increment_post_count()` — 게시글 수 증가
- `clawers_increment_spot_count()` — 스팟 수 증가

**RLS:** 모든 테이블에 적용. SELECT 공개, INSERT/UPDATE/DELETE는 authenticated + auth.uid() 검증.

**트리거:**
- `trg_clawers_profiles_updated_at` — updated_at 자동 갱신
- `clawers_on_user_created` — 신규 유저 시 프로필 자동 생성

**참고:** TalkTrio 테이블도 포함 (talktrio_conversations, talktrio_messages, talktrio_increment_stt_minutes)

---

## 002_security_hardening.sql (2026-04-03)

보안 강화. RPC 함수 재작성 + column-level GRANT 적용.

**RPC 변경:**
- 모든 함수에 `SET search_path = ''` 추가
- `p_user_id` 파라미터 제거 → `auth.uid()` 내부 사용
- `REVOKE EXECUTE FROM public, anon` 적용
- `clawers_increment_view` — service_role 전용으로 변경

**Column-level GRANT:**
- `clawers_profiles` — UPDATE: display_name, avatar_url만 허용
- `clawers_posts` — INSERT: user_id, section, title, content, area, images, price_krw, trade_status
- `clawers_posts` — UPDATE: title, content, area, price_krw, trade_status
- `clawers_spots` — UPDATE: area, point, price, machines, lat, lng, place_name
- `clawers_spots` — INSERT: area, point, price, machines, lat, lng, place_name, kakao_place_id, added_by

---

## 003_notifications.sql (2026-04-07)

알림 시스템.

**테이블:**
- `clawers_notifications` — type (comment, like), post_id, actor_id, is_read

**RLS:** authenticated 유저 본인 알림만 조회/수정/삭제. UPDATE는 `is_read` 컬럼만 허용.

**트리거:**
- `clawers_notify_on_comment` — 댓글 작성 시 게시글 작성자에게 알림
- `clawers_notify_on_like` — 좋아요 시 게시글 작성자에게 알림
- 본인 게시글에 본인이 댓글/좋아요 시 알림 생략

---

## 004_search_index.sql (2026-04-07)

pg_trgm 기반 검색 인덱스. ILIKE 검색 성능 최적화 (100k+ rows).

**변경:**
- `CREATE EXTENSION IF NOT EXISTS pg_trgm`
- GIN 인덱스 3개: title, content, area (각각 `gin_trgm_ops`)

---

## 005_spot_reviews.sql (2026-04-08)

스팟 리뷰 & 좋아요 시스템.

**테이블:**
- `clawers_spot_likes` — 스팟 좋아요 (composite PK: spot_id + user_id)
- `clawers_spot_reviews` — 스팟 리뷰 (rating 1-5, content 10-2000자, images 최대 3장, UNIQUE(spot_id, user_id))

**캐시 컬럼 (clawers_spots에 추가):**
- `like_count`, `review_count`, `avg_rating` (numeric(3,2))

**RPC 함수 (모두 SECURITY DEFINER + SET search_path + auth.uid()):**
- `clawers_toggle_spot_like(p_spot_id)` — DELETE-first 패턴, race-safe
- `clawers_upsert_spot_review(p_spot_id, p_rating, p_content, p_images)` — INSERT ON CONFLICT, O(1) 증분 avg_rating, FOR UPDATE row lock
- `clawers_delete_spot_review(p_spot_id)` — 삭제 + Storage 이미지 경로 반환

**트리거:**
- `trg_spot_reviews_updated_at` — updated_at 자동 갱신

**인덱스:** spot_id, user_id, avg_rating(partial), compound(spot_id + created_at DESC)

---

## 006_spot_integration.sql (2026-04-08)

게시글-스팟 연결, 폐업 신고, 카카오 자동 등록.

**변경:**
- `clawers_posts.spot_id` FK 추가 (nullable, ON DELETE SET NULL)
- `clawers_posts` INSERT GRANT에 `spot_id` 추가

**테이블:**
- `clawers_spot_reports` — 폐업/이전/정보오류 신고 (UNIQUE(spot_id, user_id), 삭제 불가)

**캐시 컬럼:** `clawers_spots.report_count`

**RPC 함수:**
- `clawers_report_spot(p_spot_id, p_reason, p_note)` — ON CONFLICT DO NOTHING, 유저당 스팟 1회 제한
- `clawers_register_spot_from_kakao(p_kakao_place_id, p_place_name, p_address, p_lat, p_lng)` — INSERT ON CONFLICT (race-safe), input 길이 검증, 30/hour 유저 rate limit

---

## 007_grant_fixes.sql (2026-04-08)

하네스 팀 감사 결과 수정.

**clawers_posts UPDATE GRANT 확장:**
- 기존: title, content, area, price_krw, trade_status
- 변경: + images, spot_id, is_deleted (게시글 삭제/이미지수정/스팟변경 허용)

**직접 DML 차단 (RPC 전용):**
- `clawers_spot_reviews` — REVOKE INSERT, UPDATE, DELETE
- `clawers_spot_likes` — REVOKE INSERT, UPDATE, DELETE
- `clawers_spot_reports` — REVOKE INSERT, UPDATE, DELETE

**누락 인덱스 추가:**
- `idx_posts_user_id` — "내 글" 조회 최적화
- `idx_spots_added_by_created` — 자동등록 rate limit 쿼리 최적화

---

## 참고: 원본 파일 위치

원본 마이그레이션 파일은 `supabase/migrations/` 루트에 날짜 prefix로 존재합니다. 이 폴더의 파일은 정리용 복사본입니다. Supabase에 실행할 때는 어느 쪽이든 동일합니다.
