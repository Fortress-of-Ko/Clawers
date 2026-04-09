-- ============================================================
-- Clawers Spot Reviews & Likes
-- Tables, RPC functions, RLS, indexes, triggers
-- ============================================================

-- 1. Cache columns on clawers_spots
ALTER TABLE clawers_spots ADD COLUMN IF NOT EXISTS like_count int NOT NULL DEFAULT 0;
ALTER TABLE clawers_spots ADD COLUMN IF NOT EXISTS review_count int NOT NULL DEFAULT 0;
ALTER TABLE clawers_spots ADD COLUMN IF NOT EXISTS avg_rating numeric(3,2) NOT NULL DEFAULT 0;

-- 2. Spot Likes table
CREATE TABLE IF NOT EXISTS clawers_spot_likes (
    spot_id uuid NOT NULL REFERENCES clawers_spots(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (spot_id, user_id)
);

ALTER TABLE clawers_spot_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view spot likes"
    ON clawers_spot_likes FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users can like spots"
    ON clawers_spot_likes FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike their own likes"
    ON clawers_spot_likes FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_spot_likes_user ON clawers_spot_likes(user_id);

-- 3. Spot Reviews table
CREATE TABLE IF NOT EXISTS clawers_spot_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    spot_id uuid NOT NULL REFERENCES clawers_spots(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
    content text NOT NULL CHECK (char_length(content) >= 10 AND char_length(content) <= 2000),
    images text[] NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(spot_id, user_id)
);

ALTER TABLE clawers_spot_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reviews"
    ON clawers_spot_reviews FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users can create reviews"
    ON clawers_spot_reviews FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reviews"
    ON clawers_spot_reviews FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reviews"
    ON clawers_spot_reviews FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Restrict direct DML — all mutations go through SECURITY DEFINER RPCs
REVOKE INSERT, UPDATE, DELETE ON clawers_spot_reviews FROM authenticated;
-- Grant UPDATE on content fields for the updated_at trigger context
GRANT UPDATE (rating, content, images, updated_at) ON clawers_spot_reviews TO authenticated;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_spot_reviews_spot ON clawers_spot_reviews(spot_id);
CREATE INDEX IF NOT EXISTS idx_spot_reviews_user ON clawers_spot_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_spots_avg_rating ON clawers_spots(avg_rating DESC) WHERE review_count > 0;
CREATE INDEX IF NOT EXISTS idx_spot_reviews_spot_created ON clawers_spot_reviews(spot_id, created_at DESC);

-- 4. updated_at trigger for reviews
CREATE OR REPLACE FUNCTION clawers_spot_reviews_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_spot_reviews_updated_at
    BEFORE UPDATE ON clawers_spot_reviews
    FOR EACH ROW
    EXECUTE FUNCTION clawers_spot_reviews_updated_at();

-- 5. RPC: Toggle spot like (DELETE-first pattern, race-safe)
CREATE OR REPLACE FUNCTION clawers_toggle_spot_like(p_spot_id uuid)
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

    -- Try to delete first (atomic check + delete)
    DELETE FROM public.clawers_spot_likes
    WHERE spot_id = p_spot_id AND user_id = v_user_id;

    IF FOUND THEN
        UPDATE public.clawers_spots
        SET like_count = GREATEST(like_count - 1, 0)
        WHERE id = p_spot_id;

        RETURN jsonb_build_object('liked', false);
    ELSE
        INSERT INTO public.clawers_spot_likes (spot_id, user_id)
        VALUES (p_spot_id, v_user_id)
        ON CONFLICT (spot_id, user_id) DO NOTHING;

        IF FOUND THEN
            UPDATE public.clawers_spots
            SET like_count = like_count + 1
            WHERE id = p_spot_id;
        END IF;

        RETURN jsonb_build_object('liked', true);
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION clawers_toggle_spot_like(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION clawers_toggle_spot_like(uuid) TO authenticated;

-- 6. RPC: Upsert spot review (incremental avg_rating)
CREATE OR REPLACE FUNCTION clawers_upsert_spot_review(
    p_spot_id uuid,
    p_rating smallint,
    p_content text,
    p_images text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_old_rating smallint;
    v_spot record;
    v_review_id uuid;
    v_is_update boolean := false;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_rating < 1 OR p_rating > 5 THEN
        RAISE EXCEPTION 'Rating must be between 1 and 5';
    END IF;

    IF char_length(p_content) < 10 THEN
        RAISE EXCEPTION 'Content must be at least 10 characters';
    END IF;

    IF char_length(p_content) > 2000 THEN
        RAISE EXCEPTION 'Content must be at most 2000 characters';
    END IF;

    IF array_length(p_images, 1) IS NOT NULL AND array_length(p_images, 1) > 3 THEN
        RAISE EXCEPTION 'Maximum 3 images allowed';
    END IF;

    -- Lock spot row FIRST to prevent concurrent avg_rating drift
    SELECT review_count, avg_rating INTO v_spot
    FROM public.clawers_spots WHERE id = p_spot_id
    FOR UPDATE;

    -- Check for existing review
    SELECT rating INTO v_old_rating
    FROM public.clawers_spot_reviews
    WHERE spot_id = p_spot_id AND user_id = v_user_id;

    IF FOUND THEN
        v_is_update := true;

        -- Update existing review
        UPDATE public.clawers_spot_reviews
        SET rating = p_rating, content = p_content, images = p_images, updated_at = now()
        WHERE spot_id = p_spot_id AND user_id = v_user_id
        RETURNING id INTO v_review_id;

        -- Incremental avg_rating update (O(1), spot already locked)
        IF v_spot.review_count > 0 THEN
            UPDATE public.clawers_spots
            SET avg_rating = ((v_spot.avg_rating * v_spot.review_count) - v_old_rating + p_rating) / v_spot.review_count
            WHERE id = p_spot_id;
        END IF;
    ELSE
        -- Insert new review
        INSERT INTO public.clawers_spot_reviews (spot_id, user_id, rating, content, images)
        VALUES (p_spot_id, v_user_id, p_rating, p_content, p_images)
        RETURNING id INTO v_review_id;

        -- Incremental avg_rating update (O(1), spot already locked)
        UPDATE public.clawers_spots
        SET review_count = v_spot.review_count + 1,
            avg_rating = ((v_spot.avg_rating * v_spot.review_count) + p_rating) / (v_spot.review_count + 1)
        WHERE id = p_spot_id;
    END IF;

    RETURN jsonb_build_object('id', v_review_id, 'is_update', v_is_update);
END;
$$;

REVOKE EXECUTE ON FUNCTION clawers_upsert_spot_review(uuid, smallint, text, text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION clawers_upsert_spot_review(uuid, smallint, text, text[]) TO authenticated;

-- 7. RPC: Delete spot review (returns image paths for Storage cleanup)
CREATE OR REPLACE FUNCTION clawers_delete_spot_review(p_spot_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_review record;
    v_spot record;
    v_new_avg numeric(3,2);
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Lock spot row FIRST to prevent concurrent avg_rating drift
    SELECT review_count, avg_rating INTO v_spot
    FROM public.clawers_spots WHERE id = p_spot_id
    FOR UPDATE;

    -- Get review to delete
    SELECT id, rating, images INTO v_review
    FROM public.clawers_spot_reviews
    WHERE spot_id = p_spot_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Review not found';
    END IF;

    -- Delete the review
    DELETE FROM public.clawers_spot_reviews WHERE id = v_review.id;

    IF v_spot.review_count - 1 <= 0 THEN
        v_new_avg := 0;
    ELSE
        v_new_avg := ((v_spot.avg_rating * v_spot.review_count) - v_review.rating) / (v_spot.review_count - 1);
    END IF;

    UPDATE public.clawers_spots
    SET review_count = GREATEST(v_spot.review_count - 1, 0),
        avg_rating = v_new_avg
    WHERE id = p_spot_id;

    RETURN jsonb_build_object('deleted', true, 'images', v_review.images);
END;
$$;

REVOKE EXECUTE ON FUNCTION clawers_delete_spot_review(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION clawers_delete_spot_review(uuid) TO authenticated;
