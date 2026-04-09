-- ============================================================
-- Clawers Notifications
-- In-app notifications for comments and likes on posts.
-- Triggered automatically via DB triggers — no client INSERT.
-- ============================================================

-- ┌─────────────────────────────────────────────────────────────┐
-- │  1. Table                                                    │
-- └─────────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS clawers_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('comment', 'like')),
  post_id     UUID NOT NULL REFERENCES clawers_posts(id) ON DELETE CASCADE,
  actor_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE clawers_notifications ENABLE ROW LEVEL SECURITY;

-- ┌─────────────────────────────────────────────────────────────┐
-- │  2. Index                                                    │
-- └─────────────────────────────────────────────────────────────┘

CREATE INDEX idx_clawers_notifications_user
  ON clawers_notifications (user_id, is_read, created_at DESC);

-- ┌─────────────────────────────────────────────────────────────┐
-- │  3. RLS Policies                                             │
-- └─────────────────────────────────────────────────────────────┘

CREATE POLICY "Users can read own notifications"
  ON clawers_notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON clawers_notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON clawers_notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- No INSERT policy for authenticated — only triggers insert via SECURITY DEFINER

-- ┌─────────────────────────────────────────────────────────────┐
-- │  4. Column-Level GRANT                                       │
-- └─────────────────────────────────────────────────────────────┘

REVOKE UPDATE ON clawers_notifications FROM authenticated;
GRANT UPDATE (is_read) ON clawers_notifications TO authenticated;

-- ┌─────────────────────────────────────────────────────────────┐
-- │  5. Comment Notification Trigger                             │
-- └─────────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION public.clawers_notify_on_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_post_owner uuid;
BEGIN
  SELECT user_id INTO v_post_owner
    FROM public.clawers_posts
    WHERE id = NEW.post_id AND is_deleted = false;

  -- Skip if post not found, deleted, or commenter is the post owner
  IF v_post_owner IS NOT NULL AND v_post_owner != NEW.user_id THEN
    INSERT INTO public.clawers_notifications (user_id, type, post_id, actor_id)
    VALUES (v_post_owner, 'comment', NEW.post_id, NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.clawers_notify_on_comment() FROM public, anon, authenticated;

CREATE TRIGGER trg_clawers_notify_on_comment
  AFTER INSERT ON clawers_comments
  FOR EACH ROW EXECUTE FUNCTION clawers_notify_on_comment();

-- ┌─────────────────────────────────────────────────────────────┐
-- │  6. Like Notification Trigger                                │
-- └─────────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION public.clawers_notify_on_like()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_post_owner uuid;
BEGIN
  SELECT user_id INTO v_post_owner
    FROM public.clawers_posts
    WHERE id = NEW.post_id AND is_deleted = false;

  -- Skip if post not found, deleted, or liker is the post owner
  IF v_post_owner IS NOT NULL AND v_post_owner != NEW.user_id THEN
    INSERT INTO public.clawers_notifications (user_id, type, post_id, actor_id)
    VALUES (v_post_owner, 'like', NEW.post_id, NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.clawers_notify_on_like() FROM public, anon, authenticated;

CREATE TRIGGER trg_clawers_notify_on_like
  AFTER INSERT ON clawers_post_likes
  FOR EACH ROW EXECUTE FUNCTION clawers_notify_on_like();
