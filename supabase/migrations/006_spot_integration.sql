-- ============================================================
-- Clawers Spot Integration
-- Link posts to spots + closure reporting + auto-register
-- ============================================================

-- 1. Add spot_id to posts (nullable — not all posts are about a specific spot)
ALTER TABLE clawers_posts ADD COLUMN IF NOT EXISTS spot_id uuid REFERENCES clawers_spots(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_posts_spot_id ON clawers_posts(spot_id) WHERE spot_id IS NOT NULL;

-- 1b. Update column-level GRANT to include spot_id for INSERT
-- The security hardening migration restricted INSERT to specific columns;
-- spot_id was not included. We need to re-grant with spot_id added.
REVOKE INSERT ON TABLE clawers_posts FROM authenticated;
GRANT INSERT (user_id, section, title, content, area, images, price_krw, trade_status, spot_id)
  ON TABLE clawers_posts TO authenticated;

-- 2. Spot closure reports
CREATE TABLE IF NOT EXISTS clawers_spot_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    spot_id uuid NOT NULL REFERENCES clawers_spots(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason text NOT NULL DEFAULT 'closed' CHECK (reason IN ('closed', 'moved', 'wrong_info')),
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(spot_id, user_id)
);

ALTER TABLE clawers_spot_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view spot reports"
    ON clawers_spot_reports FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users can report"
    ON clawers_spot_reports FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- No DELETE policy: reports are permanent to prevent report_count drift

CREATE INDEX IF NOT EXISTS idx_spot_reports_spot ON clawers_spot_reports(spot_id);

-- 3. Add report_count cache column to spots
ALTER TABLE clawers_spots ADD COLUMN IF NOT EXISTS report_count int NOT NULL DEFAULT 0;

-- 4. RPC: Report spot (closure/moved/wrong_info)
CREATE OR REPLACE FUNCTION clawers_report_spot(p_spot_id uuid, p_reason text, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_reason NOT IN ('closed', 'moved', 'wrong_info') THEN
        RAISE EXCEPTION 'Invalid reason';
    END IF;

    IF p_note IS NOT NULL AND char_length(p_note) > 500 THEN
        RAISE EXCEPTION 'Note too long';
    END IF;

    INSERT INTO public.clawers_spot_reports (spot_id, user_id, reason, note)
    VALUES (p_spot_id, v_user_id, p_reason, p_note)
    ON CONFLICT (spot_id, user_id) DO NOTHING;

    IF FOUND THEN
        UPDATE public.clawers_spots
        SET report_count = report_count + 1
        WHERE id = p_spot_id;
    END IF;

    RETURN jsonb_build_object('reported', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION clawers_report_spot(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION clawers_report_spot(uuid, text, text) TO authenticated;

-- 5. RPC: Auto-register spot from Kakao search result
CREATE OR REPLACE FUNCTION clawers_register_spot_from_kakao(
    p_kakao_place_id text,
    p_place_name text,
    p_address text,
    p_lat double precision,
    p_lng double precision
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_spot_id uuid;
    v_recent_count int;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Input validation (RPC is the trust boundary, not the API route)
    IF char_length(p_kakao_place_id) > 50 OR char_length(p_place_name) > 200 OR char_length(p_address) > 300 THEN
        RAISE EXCEPTION 'Input too long';
    END IF;

    -- Per-user rate limit: max 30 spots per hour
    SELECT count(*) INTO v_recent_count
    FROM public.clawers_spots
    WHERE added_by = v_user_id AND created_at > now() - interval '1 hour';

    IF v_recent_count >= 30 THEN
        RAISE EXCEPTION 'Too many spots registered recently';
    END IF;

    -- Atomic upsert: INSERT ON CONFLICT avoids TOCTOU race
    INSERT INTO public.clawers_spots (area, point, place_name, kakao_place_id, lat, lng, added_by)
    VALUES (
        split_part(p_address, ' ', 1) || ' ' || split_part(p_address, ' ', 2),
        p_place_name,
        p_place_name,
        p_kakao_place_id,
        p_lat,
        p_lng,
        v_user_id
    )
    ON CONFLICT (kakao_place_id) DO NOTHING
    RETURNING id INTO v_spot_id;

    -- If no insert (already existed), fetch the existing id
    IF v_spot_id IS NULL THEN
        SELECT id INTO v_spot_id
        FROM public.clawers_spots
        WHERE kakao_place_id = p_kakao_place_id;

        RETURN jsonb_build_object('id', v_spot_id, 'created', false);
    END IF;

    RETURN jsonb_build_object('id', v_spot_id, 'created', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION clawers_register_spot_from_kakao(text, text, text, double precision, double precision) FROM public, anon;
GRANT EXECUTE ON FUNCTION clawers_register_spot_from_kakao(text, text, text, double precision, double precision) TO authenticated;
