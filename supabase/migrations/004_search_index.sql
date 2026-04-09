-- ============================================================
-- Clawers: Trigram search index for community posts
-- Enables fast ILIKE queries on title/content/area at scale.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_clawers_posts_title_trgm
  ON clawers_posts USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_clawers_posts_content_trgm
  ON clawers_posts USING gin (content gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_clawers_posts_area_trgm
  ON clawers_posts USING gin (area gin_trgm_ops);
