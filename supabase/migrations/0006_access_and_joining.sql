-- How people get into a group, and who is allowed to answer a schedule.
--
-- Until now the only door was an invitation sent by an administrator, and any
-- schedule link answered by whoever held it. Both are right for a ministry
-- that already knows everyone, and both break down the moment the app is
-- passed around: a volunteer who signs up on their own lands nowhere, and a
-- coordinator who wants names tied to real accounts has no way to ask for it.
--
-- Three additions, each solving one half of that:
--   1. `parishes.fill_access`  the group decides whether answering needs an
--      account, or stays open to anyone holding the link.
--   2. `profiles.join_code`    a short code the volunteer reads out to the
--      coordinator, who looks it up and adds them. No directory to browse,
--      no e-mail guessing: the person has to hand their own code over.
--   3. `join_links`            a reusable link the coordinator posts once in
--      the group chat. Whoever signs up through it is already in the group.

-- ============================================================
-- 1. Answering a schedule: open, or members only
-- ============================================================
alter table public.parishes
  add column if not exists fill_access text not null default 'open';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'parishes_fill_access_check'
  ) then
    alter table public.parishes
      add constraint parishes_fill_access_check
      check (fill_access in ('open', 'members'));
  end if;
end
$$;

comment on column public.parishes.fill_access is
  'open: anyone with the link answers. members: only accounts in this group.';

-- ============================================================
-- 2. The code a volunteer hands to a coordinator
-- ============================================================

-- No 0, O, 1 or I: this gets read out loud and typed by hand, often by
-- someone reading it off a phone to someone else.
create or replace function public.gen_join_code()
returns text language plpgsql volatile
security definer set search_path = public as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  candidate text;
  i int;
begin
  loop
    candidate := '';
    for i in 1..8 loop
      candidate := candidate
        || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      if i = 4 then candidate := candidate || '-'; end if;
    end loop;
    exit when not exists (
      select 1 from public.profiles p where p.join_code = candidate
    );
  end loop;
  return candidate;
end;
$$;

alter table public.profiles
  add column if not exists join_code text;

update public.profiles set join_code = public.gen_join_code()
  where join_code is null;

alter table public.profiles
  alter column join_code set default public.gen_join_code(),
  alter column join_code set not null;

create unique index if not exists profiles_join_code_key
  on public.profiles(join_code);

-- The code identifies an account to someone who was given it, so it must not
-- be readable from anywhere else. `profiles_select_own` (0001) already limits
-- reads to the account's own row; the coordinator's lookup runs server-side
-- with the service role, in an action that first checks they manage the group.

-- ============================================================
-- 3. Reusable join links
-- ============================================================
-- Different from `invites`: an invite is one named seat, burnt on acceptance.
-- A join link is posted once and used by everyone who shows up, which is what
-- makes "here is our link, sign up and you are in" possible in a group chat.
create table if not exists public.join_links (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id) on delete cascade,
  token text not null unique default public.gen_url_token(),
  role text not null default 'member'
    check (role in ('admin', 'coordinator', 'member')),
  -- What the coordinator calls it, so several links can coexist: one for the
  -- altar servers, one for the chapel down the road.
  label text,
  active boolean not null default true,
  expires_at timestamptz,
  -- Null means no ceiling. A number turns the link into a run of seats.
  max_uses int check (max_uses is null or max_uses > 0),
  uses int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists join_links_parish_idx
  on public.join_links(parish_id);

alter table public.join_links enable row level security;

drop policy if exists join_links_select on public.join_links;
create policy join_links_select on public.join_links for select
  using (public.can_manage(parish_id));

drop policy if exists join_links_insert on public.join_links;
create policy join_links_insert on public.join_links for insert
  with check (public.can_manage(parish_id));

drop policy if exists join_links_update on public.join_links;
create policy join_links_update on public.join_links for update
  using (public.can_manage(parish_id));

drop policy if exists join_links_delete on public.join_links;
create policy join_links_delete on public.join_links for delete
  using (public.can_manage(parish_id));

-- Redeeming a link reads it from an account that is not in the group yet, so
-- no policy above would let it through: that path runs with the service role,
-- in `redeemJoinLinkAction`, which is also where expiry and the use count are
-- checked. The policies here are for the screens that manage the links.
