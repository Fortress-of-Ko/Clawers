-- ══════════════════════════════════════════════════════════════
-- 2026-03-26: Clawers (community + spots) & TalkTrio (conversations + STT)
--
-- 전제: supabase_schema.sql (kortress_profiles, talktrio_profiles,
--       dollmap_*, talktrio_consume_turn 등)은 이미 적용됨.
-- ══════════════════════════════════════════════════════════════


-- ┌─────────────────────────────────────────────────────────────┐
-- │  PART A: Clawers Community (dollmap → clawers rename)       │
-- └─────────────────────────────────────────────────────────────┘

-- ── A0. User Profiles ────────────────────────────────────────

create table if not exists clawers_profiles (
  user_id      uuid        primary key references auth.users(id) on delete cascade,
  display_name text        not null default '크로러',
  avatar_url   text,
  spot_count   int         not null default 0,  -- 제보한 스팟 수
  post_count   int         not null default 0,  -- 작성한 글 수
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table clawers_profiles enable row level security;
create policy "clawers_profiles_select_public" on clawers_profiles for select using (true);
create policy "clawers_profiles_insert_own"    on clawers_profiles for insert with check (auth.uid() = user_id);
create policy "clawers_profiles_update_own"    on clawers_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- updated_at 자동 갱신
create or replace function clawers_profiles_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists clawers_profiles_set_updated_at on clawers_profiles;
create trigger clawers_profiles_set_updated_at
  before update on clawers_profiles
  for each row execute function clawers_profiles_set_updated_at();

-- 신규 가입 시 clawers_profiles 자동 생성
create or replace function clawers_on_user_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into clawers_profiles (user_id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), '크로러')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists clawers_on_auth_user_created on auth.users;
create trigger clawers_on_auth_user_created
  after insert on auth.users
  for each row execute function clawers_on_user_created();

-- ── A1. Posts ────────────────────────────────────────────────

create table if not exists clawers_posts (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        references auth.users(id) on delete set null,
  section       text        not null
                check (section in ('정보공유', '후기', '질문', '사고팔기')),
  title         text        not null,
  content       text        not null,
  area          text        not null,
  images        text[]      default '{}',
  price_krw     int,
  trade_status  text
                check (trade_status in ('selling', 'reserved', 'sold')),
  view_count    int         not null default 0,
  like_count    int         not null default 0,
  comment_count int         not null default 0,
  is_deleted    boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table clawers_posts enable row level security;
create policy "clawers_posts_select_public" on clawers_posts for select using (is_deleted = false);
create policy "clawers_posts_insert_auth"   on clawers_posts for insert with check (auth.uid() is not null and auth.uid() = user_id);
create policy "clawers_posts_update_own"    on clawers_posts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "clawers_posts_delete_own"    on clawers_posts for delete using (auth.uid() = user_id);

-- ── A2. Comments ─────────────────────────────────────────────

create table if not exists clawers_comments (
  id         uuid        primary key default gen_random_uuid(),
  post_id    uuid        not null references clawers_posts(id) on delete cascade,
  user_id    uuid        references auth.users(id) on delete set null,
  content    text        not null,
  is_deleted boolean     not null default false,
  created_at timestamptz not null default now()
);

alter table clawers_comments enable row level security;
create policy "clawers_comments_select_public" on clawers_comments for select using (is_deleted = false);
create policy "clawers_comments_insert_auth"   on clawers_comments for insert with check (auth.uid() is not null and auth.uid() = user_id);
create policy "clawers_comments_delete_own"    on clawers_comments for delete using (auth.uid() = user_id);

-- ── A3. Post Likes ───────────────────────────────────────────

create table if not exists clawers_post_likes (
  post_id    uuid        not null references clawers_posts(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table clawers_post_likes enable row level security;
create policy "clawers_likes_select_public" on clawers_post_likes for select using (true);
create policy "clawers_likes_insert_auth"   on clawers_post_likes for insert with check (auth.uid() = user_id);
create policy "clawers_likes_delete_own"    on clawers_post_likes for delete using (auth.uid() = user_id);

-- ── A4. Spots ────────────────────────────────────────────────

create table if not exists clawers_spots (
  id             uuid        primary key default gen_random_uuid(),
  area           text        not null,
  point          text        not null,
  price          text,
  machines       int         not null default 0,
  lat            double precision not null,
  lng            double precision not null,
  place_name     text,
  kakao_place_id text        unique,
  added_by       uuid        references auth.users(id) on delete set null,
  verified       boolean     not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table clawers_spots enable row level security;
create policy "clawers_spots_select_public" on clawers_spots for select using (true);
create policy "clawers_spots_insert_auth"   on clawers_spots for insert with check (auth.uid() is not null and auth.uid() = added_by);
create policy "clawers_spots_update_own"    on clawers_spots for update using (auth.uid() = added_by) with check (auth.uid() = added_by);

-- ── A5. Clawers Triggers ─────────────────────────────────────

create or replace function clawers_posts_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists clawers_posts_set_updated_at on clawers_posts;
create trigger clawers_posts_set_updated_at
  before update on clawers_posts
  for each row execute function clawers_posts_set_updated_at();

create or replace function clawers_spots_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists clawers_spots_set_updated_at on clawers_spots;
create trigger clawers_spots_set_updated_at
  before update on clawers_spots
  for each row execute function clawers_spots_set_updated_at();

create or replace function clawers_on_comment_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update clawers_posts set comment_count = comment_count + 1 where id = new.post_id;
  return new;
end;
$$;
drop trigger if exists clawers_comment_count_up on clawers_comments;
create trigger clawers_comment_count_up
  after insert on clawers_comments
  for each row execute function clawers_on_comment_insert();

create or replace function clawers_on_comment_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update clawers_posts set comment_count = greatest(0, comment_count - 1) where id = old.post_id;
  return old;
end;
$$;
drop trigger if exists clawers_comment_count_down on clawers_comments;
create trigger clawers_comment_count_down
  after delete on clawers_comments
  for each row execute function clawers_on_comment_delete();

-- ── A6. Clawers RPCs ─────────────────────────────────────────

create or replace function clawers_toggle_like(p_post_id uuid, p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_deleted boolean;
begin
  -- Attempt delete first (atomic, no race)
  delete from clawers_post_likes where post_id = p_post_id and user_id = p_user_id;
  if found then
    update clawers_posts set like_count = greatest(0, like_count - 1) where id = p_post_id;
    return jsonb_build_object('liked', false);
  else
    -- Insert with ON CONFLICT to handle concurrent inserts
    insert into clawers_post_likes (post_id, user_id) values (p_post_id, p_user_id)
      on conflict (post_id, user_id) do nothing;
    if found then
      update clawers_posts set like_count = like_count + 1 where id = p_post_id;
    end if;
    return jsonb_build_object('liked', true);
  end if;
end;
$$;

create or replace function clawers_increment_view(p_post_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update clawers_posts set view_count = view_count + 1 where id = p_post_id;
end;
$$;

create or replace function clawers_increment_post_count(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update clawers_profiles set post_count = post_count + 1 where user_id = p_user_id;
end;
$$;

create or replace function clawers_increment_spot_count(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update clawers_profiles set spot_count = spot_count + 1 where user_id = p_user_id;
end;
$$;

-- ── A7. Clawers Indexes ──────────────────────────────────────

create index if not exists idx_clawers_posts_section     on clawers_posts(section) where is_deleted = false;
create index if not exists idx_clawers_posts_area        on clawers_posts(area) where is_deleted = false;
create index if not exists idx_clawers_posts_trade       on clawers_posts(trade_status) where is_deleted = false and section = '사고팔기';
create index if not exists idx_clawers_posts_created     on clawers_posts(created_at desc) where is_deleted = false;
create index if not exists idx_clawers_comments_post     on clawers_comments(post_id) where is_deleted = false;
create index if not exists idx_clawers_likes_post        on clawers_post_likes(post_id);
create index if not exists idx_clawers_spots_area        on clawers_spots(area);
create index if not exists idx_clawers_spots_latlng      on clawers_spots(lat, lng);
create index if not exists idx_clawers_spots_kakao       on clawers_spots(kakao_place_id) where kakao_place_id is not null;
create index if not exists idx_clawers_spots_created     on clawers_spots(created_at desc);


-- ┌─────────────────────────────────────────────────────────────┐
-- │  PART B: TalkTrio Conversations + STT                       │
-- └─────────────────────────────────────────────────────────────┘

-- ── B1. Conversations ────────────────────────────────────────

create table if not exists talktrio_conversations (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  topic        text,
  avatar_count int         not null default 2,
  lang         text        not null default 'ko'
                           check (lang in ('ko', 'en')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table talktrio_conversations enable row level security;
create policy "talktrio_conv_select_own" on talktrio_conversations for select using (auth.uid() = user_id);
create policy "talktrio_conv_insert_own" on talktrio_conversations for insert with check (auth.uid() = user_id);
create policy "talktrio_conv_update_own" on talktrio_conversations for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "talktrio_conv_delete_own" on talktrio_conversations for delete using (auth.uid() = user_id);

-- ── B2. Messages ─────────────────────────────────────────────

create table if not exists talktrio_messages (
  id              uuid        primary key default gen_random_uuid(),
  conversation_id uuid        not null references talktrio_conversations(id) on delete cascade,
  role            text        not null check (role in ('user', 'avatar')),
  speaker         text        not null,
  content         text        not null,
  correction      jsonb,
  created_at      timestamptz not null default now()
);

alter table talktrio_messages enable row level security;
create policy "talktrio_msg_select_own" on talktrio_messages for select
  using (conversation_id in (select id from talktrio_conversations where user_id = auth.uid()));
create policy "talktrio_msg_insert_own" on talktrio_messages for insert
  with check (conversation_id in (select id from talktrio_conversations where user_id = auth.uid()));

-- ── B3. TalkTrio Triggers ────────────────────────────────────

create or replace function talktrio_conv_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists talktrio_conv_set_updated_at on talktrio_conversations;
create trigger talktrio_conv_set_updated_at
  before update on talktrio_conversations
  for each row execute function talktrio_conv_set_updated_at();

-- ── B4. STT Usage (column on existing talktrio_profiles) ─────

-- stt_minutes_used는 supabase_schema.sql에서 numeric(8,2)로 이미 정의됨.
-- 혹시 빠져있을 경우를 대비한 safety fallback.
alter table talktrio_profiles add column if not exists stt_minutes_used numeric(8,2) not null default 0;

create or replace function talktrio_increment_stt_minutes(p_user_id uuid, p_minutes numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  update talktrio_profiles
     set stt_minutes_used = stt_minutes_used + p_minutes
   where user_id = p_user_id;
end;
$$;

-- ── B5. TalkTrio Indexes ─────────────────────────────────────

create index if not exists idx_talktrio_conv_user    on talktrio_conversations(user_id);
create index if not exists idx_talktrio_conv_updated on talktrio_conversations(updated_at desc);
create index if not exists idx_talktrio_msg_conv     on talktrio_messages(conversation_id);
create index if not exists idx_talktrio_msg_created  on talktrio_messages(conversation_id, created_at);
