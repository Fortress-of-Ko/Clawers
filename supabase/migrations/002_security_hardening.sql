-- ============================================================
-- Clawers Security Hardening
-- ============================================================
-- CRITICAL: clawers_toggle_like accepts p_user_id
-- CRITICAL: clawers_increment_post_count/spot_count accept p_user_id
-- CRITICAL: clawers_increment_view callable by anon
-- HIGH: No REVOKE on any SECURITY DEFINER function
-- MEDIUM: No column-level GRANT on profiles/posts/spots
-- MEDIUM: search_path = public → ''
-- ============================================================


-- ┌─────────────────────────────────────────────────────────────┐
-- │  1. CRITICAL: Rewrite clawers_toggle_like — remove p_user_id│
-- └─────────────────────────────────────────────────────────────┘

-- Drop old 2-arg signature
DROP FUNCTION IF EXISTS public.clawers_toggle_like(uuid, uuid);

CREATE OR REPLACE FUNCTION public.clawers_toggle_like(p_post_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  DELETE FROM public.clawers_post_likes
    WHERE post_id = p_post_id AND user_id = v_uid;

  IF FOUND THEN
    UPDATE public.clawers_posts
      SET like_count = greatest(0, like_count - 1)
      WHERE id = p_post_id;
    RETURN jsonb_build_object('liked', false);
  ELSE
    INSERT INTO public.clawers_post_likes (post_id, user_id)
      VALUES (p_post_id, v_uid)
      ON CONFLICT (post_id, user_id) DO NOTHING;
    IF FOUND THEN
      UPDATE public.clawers_posts
        SET like_count = like_count + 1
        WHERE id = p_post_id;
    END IF;
    RETURN jsonb_build_object('liked', true);
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.clawers_toggle_like(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.clawers_toggle_like(uuid) TO authenticated;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  2. CRITICAL: Rewrite increment_post_count — remove p_user_id│
-- └─────────────────────────────────────────────────────────────┘

DROP FUNCTION IF EXISTS public.clawers_increment_post_count(uuid);

CREATE OR REPLACE FUNCTION public.clawers_increment_post_count()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  UPDATE public.clawers_profiles
    SET post_count = post_count + 1
    WHERE user_id = v_uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.clawers_increment_post_count() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.clawers_increment_post_count() TO authenticated;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  3. CRITICAL: Rewrite increment_spot_count — remove p_user_id│
-- └─────────────────────────────────────────────────────────────┘

DROP FUNCTION IF EXISTS public.clawers_increment_spot_count(uuid);

CREATE OR REPLACE FUNCTION public.clawers_increment_spot_count()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  UPDATE public.clawers_profiles
    SET spot_count = spot_count + 1
    WHERE user_id = v_uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.clawers_increment_spot_count() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.clawers_increment_spot_count() TO authenticated;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  4. CRITICAL: clawers_increment_view — REVOKE, service_role │
-- │     only (called from API route via getSupabaseServer)       │
-- └─────────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION public.clawers_increment_view(p_post_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.clawers_posts
    SET view_count = view_count + 1
    WHERE id = p_post_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.clawers_increment_view(uuid) FROM public, anon, authenticated;
-- Only service_role (from API route) can call this


-- ┌─────────────────────────────────────────────────────────────┐
-- │  5. MEDIUM: Column-level GRANT — clawers_profiles           │
-- └─────────────────────────────────────────────────────────────┘

-- Users should only update display_name, avatar_url.
-- post_count, spot_count are managed by RPCs.
REVOKE UPDATE ON TABLE public.clawers_profiles FROM authenticated;
GRANT UPDATE (display_name, avatar_url) ON TABLE public.clawers_profiles TO authenticated;

REVOKE INSERT ON TABLE public.clawers_profiles FROM authenticated;
GRANT INSERT (user_id, display_name, avatar_url) ON TABLE public.clawers_profiles TO authenticated;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  6. MEDIUM: Column-level GRANT — clawers_posts              │
-- └─────────────────────────────────────────────────────────────┘

-- Users should only update content fields.
-- view_count, like_count, comment_count, is_deleted are managed by RPCs/triggers.
REVOKE UPDATE ON TABLE public.clawers_posts FROM authenticated;
GRANT UPDATE (title, content, area, price_krw, trade_status) ON TABLE public.clawers_posts TO authenticated;

REVOKE INSERT ON TABLE public.clawers_posts FROM authenticated;
GRANT INSERT (user_id, section, title, content, area, images, price_krw, trade_status)
  ON TABLE public.clawers_posts TO authenticated;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  7. MEDIUM: Column-level GRANT — clawers_spots              │
-- └─────────────────────────────────────────────────────────────┘

-- Users should NOT be able to self-verify spots.
REVOKE UPDATE ON TABLE public.clawers_spots FROM authenticated;
GRANT UPDATE (area, point, price, machines, lat, lng, place_name) ON TABLE public.clawers_spots TO authenticated;

REVOKE INSERT ON TABLE public.clawers_spots FROM authenticated;
GRANT INSERT (area, point, price, machines, lat, lng, place_name, kakao_place_id, added_by)
  ON TABLE public.clawers_spots TO authenticated;


-- ┌─────────────────────────────────────────────────────────────┐
-- │  8. MEDIUM: Fix search_path on triggers                     │
-- └─────────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION public.clawers_on_user_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.clawers_profiles (user_id, display_name)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), '크로러')
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.clawers_on_comment_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.clawers_posts
    SET comment_count = comment_count + 1
    WHERE id = new.post_id;
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.clawers_on_comment_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.clawers_posts
    SET comment_count = greatest(0, comment_count - 1)
    WHERE id = old.post_id;
  RETURN old;
END;
$$;
