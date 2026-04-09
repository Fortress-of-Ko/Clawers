-- ============================================================
-- Clawers GRANT Fixes
-- Fix column-level GRANT gaps found in harness audit
-- ============================================================

-- 1. clawers_posts: add is_deleted + images + spot_id to UPDATE grant
REVOKE UPDATE ON TABLE clawers_posts FROM authenticated;
GRANT UPDATE (title, content, area, price_krw, trade_status, images, spot_id, is_deleted)
  ON TABLE clawers_posts TO authenticated;

-- 2. clawers_spot_reviews: REVOKE all direct DML (force RPC-only mutations)
-- The previous migration granted UPDATE on (rating, content, images, updated_at)
-- which allows bypassing the RPC and causing avg_rating drift.
REVOKE INSERT, UPDATE, DELETE ON clawers_spot_reviews FROM authenticated;

-- 3. clawers_spot_likes: REVOKE direct INSERT/DELETE (force RPC-only)
-- Direct INSERT bypasses like_count increment on clawers_spots.
REVOKE INSERT, UPDATE, DELETE ON clawers_spot_likes FROM authenticated;

-- 4. clawers_spot_reports: REVOKE direct INSERT (force RPC-only)
-- Direct INSERT bypasses report_count increment on clawers_spots.
REVOKE INSERT, UPDATE, DELETE ON clawers_spot_reports FROM authenticated;

-- 5. Missing indexes for scale
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON clawers_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_spots_added_by_created ON clawers_spots(added_by, created_at DESC);
