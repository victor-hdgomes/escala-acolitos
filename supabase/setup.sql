------------------------------------------------------------------------------
-- Altar Roster - complete setup
--
-- GENERATED FILE. Do not edit by hand: run `npm run db:setup` instead.
-- Source: supabase/migrations/*.sql
--
-- Paste the whole file into the Supabase SQL editor and run it once. It is
-- safe to run again: every statement is written to be idempotent.
--
-- Afterwards: create your account at /signup, then run
-- supabase/grant-admin.sql to make it the superadmin.
------------------------------------------------------------------------------
------------------------------------------------------------------------------
-- 0001_init.sql
------------------------------------------------------------------------------
-- Altar Roster - initial schema
--
-- Two worlds live here:
--   1. The signed-in area (coordination and administration), isolated by RLS
--      through auth.uid().
--   2. The public links (availability form, published schedule, cover
--      request). RLS does NOT cover anonymous access by token, so every
--      public path goes through a Server Action with the service role, which
--      checks the token before writing anything. No policy below opens
--      anything to `anon`, and that is deliberate.
--
-- Multi-group: `parishes` is the root of tenancy. One account can belong to
-- several groups (parishes, ministries, another town) with a different role
-- in each, which is why `memberships` is many-to-many and the app remembers
-- which group is active.

create extension if not exists "pgcrypto";

-- A short, URL-safe token for the public links. 8 bytes is 64 bits: enough
-- not to be guessed, short enough to fit in a WhatsApp message without
-- wrapping onto a second line.
create or replace function public.gen_url_token()
returns text language sql volatile as $$
  select encode(gen_random_bytes(8), 'hex');
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- parishes
-- ============================================================
create table if not exists public.parishes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists parishes_touch on public.parishes;
create trigger parishes_touch before update on public.parishes
  for each row execute function public.touch_updated_at();

-- ============================================================
-- profiles (one per auth.users row)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  theme text not null default 'dark',
  -- Owner of the installation. Sees and administers every group. Set by hand
  -- in the database: no screen grants this, on purpose.
  is_superadmin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- memberships - what an account is allowed to do in a group
-- ============================================================
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'coordinator', 'member')),
  created_at timestamptz not null default now(),
  unique (parish_id, user_id)
);

create index if not exists memberships_user_idx on public.memberships(user_id);

create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.is_superadmin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- Security definer: the other tables' policies read memberships, and without
-- this the memberships policy would read itself, recursing forever.
create or replace function public.current_role_in(p_parish uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when public.is_superadmin() then 'admin'
    else (select m.role from public.memberships m
           where m.parish_id = p_parish and m.user_id = auth.uid()
           limit 1)
  end;
$$;

create or replace function public.is_member(p_parish uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role_in(p_parish) is not null;
$$;

-- Coordinators and admins write; an admin decides everything.
create or replace function public.can_manage(p_parish uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role_in(p_parish) in ('admin', 'coordinator');
$$;

create or replace function public.is_admin(p_parish uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role_in(p_parish) = 'admin';
$$;

-- ============================================================
-- locations - where a celebration happens
-- ============================================================
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id) on delete cascade,
  name text not null,
  short_name text,
  color text not null default '#6366f1',
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (parish_id, name)
);

create index if not exists locations_parish_idx on public.locations(parish_id);

-- ============================================================
-- people - the altar servers list. A name exists without an account.
-- ============================================================
create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id) on delete cascade,
  full_name text not null,
  -- How the name reads on the schedule. Null falls back to full_name.
  short_name text,
  email text,
  phone text,
  active boolean not null default true,
  -- Once set, only this account marks availability or takes a slot under
  -- this name. It is what stops someone answering in your place.
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (parish_id, full_name)
);

-- One account, one name per group.
create unique index if not exists people_claimed_by_uniq
  on public.people(claimed_by) where claimed_by is not null;
create index if not exists people_parish_idx on public.people(parish_id);

drop trigger if exists people_touch on public.people;
create trigger people_touch before update on public.people
  for each row execute function public.touch_updated_at();

-- ============================================================
-- invites - one named seat in a group, burnt on acceptance
-- ============================================================
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id) on delete cascade,
  email text,
  role text not null check (role in ('admin', 'coordinator', 'member')),
  -- Once set, accepting the invitation also links the account to this altar
  -- server, settling the sign-up and the name link in one click.
  person_id uuid references public.people(id) on delete set null,
  token text not null unique default public.gen_url_token(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists invites_parish_idx on public.invites(parish_id);

-- ============================================================
-- mass_templates - the week as it repeats
-- ============================================================
create table if not exists public.mass_templates (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6), -- 0 = Sunday
  start_time time not null,
  slots int not null default 4 check (slots between 1 and 12),
  label text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (parish_id, location_id, weekday, start_time)
);

create index if not exists mass_templates_parish_idx on public.mass_templates(parish_id);

-- ============================================================
-- schedules - one month, or one devotion of its own
-- ============================================================
create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id) on delete cascade,
  title text not null,
  month date not null, -- always the first day of the month it refers to
  status text not null default 'draft'
    check (status in ('draft', 'collecting', 'building', 'published', 'archived')),
  availability_deadline timestamptz,
  intro_note text,
  fill_token text not null unique default public.gen_url_token(),
  view_token text not null unique default public.gen_url_token(),
  created_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists schedules_parish_idx on public.schedules(parish_id, month desc);

drop trigger if exists schedules_touch on public.schedules;
create trigger schedules_touch before update on public.schedules
  for each row execute function public.touch_updated_at();

-- ============================================================
-- events - each celebration inside a schedule
-- ============================================================
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete restrict,
  starts_at timestamptz not null,
  label text, -- "Day 3 - Novena in honour of Our Lady of Sorrows"
  kind text not null default 'mass' check (kind in ('mass', 'novena', 'special')),
  -- 'availability' = the altar server marks what they can do and the
  --                   coordinator assigns.
  -- 'direct'       = the altar server takes the slot themselves, the way a
  --                   novena is claimed in the group chat.
  signup_mode text not null default 'availability'
    check (signup_mode in ('availability', 'direct')),
  slots int not null default 4 check (slots between 1 and 12),
  created_at timestamptz not null default now()
);

create index if not exists events_schedule_idx on public.events(schedule_id, starts_at);
create unique index if not exists events_slot_uniq
  on public.events(schedule_id, location_id, starts_at);

-- ============================================================
-- availabilities - "I can serve at this one"
-- ============================================================
create table if not exists public.availabilities (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  source text not null default 'public' check (source in ('public', 'account')),
  created_at timestamptz not null default now(),
  unique (event_id, person_id)
);

create index if not exists availabilities_person_idx on public.availabilities(person_id);
create index if not exists availabilities_event_idx on public.availabilities(event_id);

-- ============================================================
-- assignments - the finished schedule
-- ============================================================
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  position int not null check (position between 1 and 12),
  status text not null default 'confirmed'
    check (status in ('confirmed', 'swap_requested')),
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, position),
  unique (event_id, person_id)
);

create index if not exists assignments_event_idx on public.assignments(event_id);
create index if not exists assignments_person_idx on public.assignments(person_id);

drop trigger if exists assignments_touch on public.assignments;
create trigger assignments_touch before update on public.assignments
  for each row execute function public.touch_updated_at();

-- ============================================================
-- swap_requests - asking for someone to cover
-- ============================================================
create table if not exists public.swap_requests (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  requested_by_person uuid not null references public.people(id) on delete cascade,
  reason text,
  status text not null default 'open' check (status in ('open', 'filled', 'cancelled')),
  token text not null unique default public.gen_url_token(),
  filled_by_person uuid references public.people(id) on delete set null,
  filled_at timestamptz,
  created_at timestamptz not null default now()
);

-- One open request per slot, so two links never circulate for one Mass.
create unique index if not exists swap_one_open_per_assignment
  on public.swap_requests(assignment_id) where status = 'open';

-- ============================================================
-- email_log - sending exactly once (the cron may run twice)
-- ============================================================
create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid references public.parishes(id) on delete cascade,
  kind text not null,
  recipient text not null,
  person_id uuid references public.people(id) on delete set null,
  dedupe_key text not null unique,
  error text,
  sent_at timestamptz not null default now()
);

-- ============================================================
-- audit_log - who changed what. It matters: public links carry no sign-in.
-- ============================================================
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid references public.parishes(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_label text, -- the person's name when the action came from a link
  action text not null,
  entity text,
  entity_id uuid,
  payload jsonb,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists audit_parish_idx on public.audit_log(parish_id, created_at desc);

-- ============================================================
-- RLS
-- ============================================================
alter table public.parishes       enable row level security;
alter table public.profiles       enable row level security;
alter table public.memberships    enable row level security;
alter table public.invites        enable row level security;
alter table public.locations      enable row level security;
alter table public.people         enable row level security;
alter table public.mass_templates enable row level security;
alter table public.schedules      enable row level security;
alter table public.events         enable row level security;
alter table public.availabilities enable row level security;
alter table public.assignments    enable row level security;
alter table public.swap_requests  enable row level security;
alter table public.email_log      enable row level security;
alter table public.audit_log      enable row level security;

-- profiles: each account reads and writes its own row. `is_superadmin` is
-- never editable from the app; migration 0005 is what enforces that.
create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
create policy profiles_insert_own on public.profiles for insert with check (auth.uid() = id);
create policy profiles_update_own on public.profiles for update using (auth.uid() = id);

-- parishes: a member reads; the group's admin edits; any account opens a new
-- group (and the server action makes it the admin straight after).
create policy parishes_select on public.parishes for select using (public.is_member(id));
create policy parishes_insert on public.parishes for insert
  with check (auth.uid() is not null);
create policy parishes_update on public.parishes for update using (public.is_admin(id));
create policy parishes_delete on public.parishes for delete using (public.is_admin(id));

-- memberships: a member reads their own group's, the group's admin writes.
create policy memberships_select on public.memberships for select using (public.is_member(parish_id));
create policy memberships_insert on public.memberships for insert with check (public.is_admin(parish_id));
create policy memberships_update on public.memberships for update using (public.is_admin(parish_id));
create policy memberships_delete on public.memberships for delete using (public.is_admin(parish_id));

-- invites: the group's admin only. Whoever accepts arrives with no
-- membership yet, so reading by token runs in the server action with the
-- service role.
create policy invites_select on public.invites for select using (public.is_admin(parish_id));
create policy invites_write on public.invites for all
  using (public.is_admin(parish_id))
  with check (public.is_admin(parish_id));

-- Tables carrying parish_id directly: a member reads, a manager writes.
do $$
declare t text;
begin
  foreach t in array array['locations', 'people', 'mass_templates', 'schedules'] loop
    execute format(
      'create policy %1$s_select on public.%1$s for select using (public.is_member(parish_id))', t);
    execute format(
      'create policy %1$s_insert on public.%1$s for insert with check (public.can_manage(parish_id))', t);
    execute format(
      'create policy %1$s_update on public.%1$s for update using (public.can_manage(parish_id))', t);
    execute format(
      'create policy %1$s_delete on public.%1$s for delete using (public.can_manage(parish_id))', t);
  end loop;
end $$;

-- One exception: a signed-in altar server links and unlinks their own name
-- without being a coordinator. Which name they are claiming is checked in the
-- server action.
create policy people_claim_self on public.people for update
  using (public.is_member(parish_id) and (claimed_by is null or claimed_by = auth.uid()))
  with check (public.is_member(parish_id) and (claimed_by is null or claimed_by = auth.uid()));

-- events, availabilities and assignments reach parish_id through a join.
create or replace function public.event_parish(p_event uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select s.parish_id from public.events e
    join public.schedules s on s.id = e.schedule_id
   where e.id = p_event;
$$;

create policy events_select on public.events for select
  using (exists (select 1 from public.schedules s
                  where s.id = schedule_id and public.is_member(s.parish_id)));
create policy events_write on public.events for all
  using (exists (select 1 from public.schedules s
                  where s.id = schedule_id and public.can_manage(s.parish_id)))
  with check (exists (select 1 from public.schedules s
                       where s.id = schedule_id and public.can_manage(s.parish_id)));

create policy avail_select on public.availabilities for select
  using (public.is_member(public.event_parish(event_id)));
create policy avail_write on public.availabilities for all
  using (public.can_manage(public.event_parish(event_id)))
  with check (public.can_manage(public.event_parish(event_id)));

create policy assign_select on public.assignments for select
  using (public.is_member(public.event_parish(event_id)));
create policy assign_write on public.assignments for all
  using (public.can_manage(public.event_parish(event_id)))
  with check (public.can_manage(public.event_parish(event_id)));

create policy swap_select on public.swap_requests for select
  using (exists (select 1 from public.assignments a
                  where a.id = assignment_id
                    and public.is_member(public.event_parish(a.event_id))));
create policy swap_write on public.swap_requests for all
  using (exists (select 1 from public.assignments a
                  where a.id = assignment_id
                    and public.can_manage(public.event_parish(a.event_id))))
  with check (exists (select 1 from public.assignments a
                       where a.id = assignment_id
                         and public.can_manage(public.event_parish(a.event_id))));

-- Logs: only a manager reads; writing is always the service role.
create policy email_log_select on public.email_log for select using (public.can_manage(parish_id));
create policy audit_log_select on public.audit_log for select using (public.can_manage(parish_id));

------------------------------------------------------------------------------
-- 0002_restrict_parish_creation.sql
------------------------------------------------------------------------------
-- Only the owner of the installation opens groups.
--
-- Until now any authenticated account could create a parish and become its
-- admin. That is right for self-service and wrong here: someone who arrived
-- through an invitation should not be able to open new groups. A parish admin
-- still runs their own group; opening another is the superadmin's.
--
-- This policy is defence in depth. Creation runs in a Server Action with the
-- service role, because the admin membership has to exist the instant the
-- parish does, and that action is where the real check lives.
--
-- Superseded by 0004, which reopens creation to an account with no group at
-- all. The rule here is kept for the history of why it was ever closed.

drop policy if exists parishes_insert on public.parishes;

create policy parishes_insert on public.parishes for insert
  with check (public.is_superadmin());

------------------------------------------------------------------------------
-- 0003_schedule_kind.sql
------------------------------------------------------------------------------
-- A novena can have a schedule of its own, apart from the month's.
--
-- The ministry already treats them as two different things: the monthly
-- schedule comes out of the weekly Mass pattern, while a novena is a devotion
-- with its own dates, its own numbered slots and its own link in the group
-- chat. Forcing the novena inside the month's schedule meant opening both at
-- once and mixing up the messages.
--
-- `kind` only describes the schedule. What changes how a celebration is
-- filled is still `events.signup_mode`.

alter table public.schedules
  add column if not exists kind text not null default 'monthly'
  check (kind in ('monthly', 'novena', 'special'));

-- Schedules that already exist are monthly ones.
update public.schedules set kind = 'monthly' where kind is null;

create index if not exists schedules_parish_kind_idx
  on public.schedules(parish_id, kind, month desc);

------------------------------------------------------------------------------
-- 0004_self_service_signup.sql
------------------------------------------------------------------------------
-- Self-service: whoever arrives alone opens their own group.
--
-- 0002 restricted group creation to the superadmin, to stop an invited altar
-- server from opening groups. That also shut the front door: a coordinator
-- who gets the app's link in a WhatsApp group has to be able to register
-- their own chapel without asking anyone for anything.
--
-- The rule that serves both cases looks at what the account already has:
--   no group at all -> may open the first one (this is the way in)
--   already in a group -> may not open another (the invited server stays out)
--   superadmin -> always
--
-- Anyone who needs a second group asks the superadmin. That is rare enough
-- not to deserve a screen, and it keeps the path to abuse narrow: a brand-new
-- account can create one parish, not a factory of them.

create or replace function public.has_any_membership()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m where m.user_id = auth.uid()
  );
$$;

drop policy if exists parishes_insert on public.parishes;

create policy parishes_insert on public.parishes for insert
  with check (
    auth.uid() is not null
    and (public.is_superadmin() or not public.has_any_membership())
  );

-- Defence in depth, as in 0002: creation runs in a Server Action with the
-- service role (the parish and its admin membership have to be born in the
-- same instant), so this policy is not the real lock. That is in
-- createParishAction.

------------------------------------------------------------------------------
-- 0005_lock_superadmin.sql
------------------------------------------------------------------------------
-- There is one superadmin, and nobody promotes themselves.
--
-- THE HOLE THIS CLOSES
-- The `profiles_update_own` policy (0001) lets an account update its own
-- `profiles` row with no restriction on columns, and `is_superadmin` lives in
-- that row. The app never sends that field, but the API does not know that: a
-- PATCH to /rest/v1/profiles?id=eq.<my-id> with {"is_superadmin": true},
-- using the publishable key and the account's own token, was enough to start
-- seeing EVERY parish (is_superadmin() unlocks current_role_in, and with it
-- is_member, can_manage and is_admin across the whole schema).
--
-- That was a small risk in a one-parish installation. With self-service
-- sign-up, where any stranger creates an account, it becomes the widest door
-- in the system.
--
-- TWO LOCKS
-- 1. A unique index: at most one row with is_superadmin true, ever. A second
--    promotion fails in the database, whatever it comes from.
-- 2. A trigger: an authenticated session that is not the superadmin cannot
--    change the field, not even on its own row.
--
-- What can still change it: the service role and the SQL editor (where
-- auth.uid() is null). Those are the server's and the database owner's paths,
-- and they are how the superadmin is marked, on purpose. No screen grants it.

-- 1. At most one superadmin in the whole installation.
create unique index if not exists profiles_single_superadmin
  on public.profiles ((true))
  where is_superadmin;

-- 2. Nobody promotes themselves, or demotes the superadmin.
create or replace function public.guard_superadmin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_superadmin is distinct from old.is_superadmin then
    -- A null auth.uid() means the service role or the SQL editor: the
    -- server's path, which is exactly how the superadmin is marked.
    if auth.uid() is not null
       and not coalesce(
         (select p.is_superadmin from public.profiles p where p.id = auth.uid()),
         false
       )
    then
      raise exception
        'is_superadmin can only be changed by the owner of the installation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_superadmin on public.profiles;
create trigger profiles_guard_superadmin
  before update on public.profiles
  for each row execute function public.guard_superadmin();

------------------------------------------------------------------------------
-- 0006_access_and_joining.sql
------------------------------------------------------------------------------
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

------------------------------------------------------------------------------
-- 0007_feedback.sql
------------------------------------------------------------------------------
-- A way for a coordinator to say something back.
--
-- The app is handed to parishes the author will never meet, so the only
-- signal that something is wrong is somebody bothering to find a phone
-- number. A box inside the app costs one table and removes that step.
--
-- Deliberately not public: only an account inside a group can write, which
-- keeps it from becoming a contact form for the open internet. Only the owner
-- of the installation reads it.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  -- Both nullable on purpose: a group can be deleted and the message it left
  -- is still worth reading.
  parish_id uuid references public.parishes(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null default 'idea'
    check (kind in ('idea', 'problem', 'question', 'other')),
  message text not null check (char_length(btrim(message)) between 5 and 2000),
  -- Which screen they were on. The difference between a vague "it is
  -- confusing" and knowing exactly which screen confused them.
  page text,
  -- Only if they want an answer. Never filled in from the session.
  contact_email text,
  status text not null default 'new'
    check (status in ('new', 'read', 'done')),
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_idx
  on public.feedback(created_at desc);

alter table public.feedback enable row level security;

-- Anyone signed in writes, but only as themselves: the row carries the id of
-- the account that sent it and that cannot be forged.
drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback for insert
  with check (auth.uid() is not null and user_id = auth.uid());

-- Reading is the owner of the installation alone. A parish admin has no
-- business seeing what another parish wrote.
drop policy if exists feedback_select on public.feedback;
create policy feedback_select on public.feedback for select
  using (public.is_superadmin());

drop policy if exists feedback_update on public.feedback;
create policy feedback_update on public.feedback for update
  using (public.is_superadmin());

drop policy if exists feedback_delete on public.feedback;
create policy feedback_delete on public.feedback for delete
  using (public.is_superadmin());

------------------------------------------------------------------------------
-- 0008_tighten_access.sql
------------------------------------------------------------------------------
-- Closing what an audit of cross-account access turned up.
--
-- Everything here is the same mistake in four costumes: a policy written for
-- the screen that uses it rather than for the API that is actually exposed.
-- The publishable key sits in every browser, so /rest/v1 is reachable by
-- anyone signed in, with whatever body they like. A policy is not a hint
-- about which button exists; it is the only thing standing there.

-- ============================================================
-- 1. Claiming a name must not be a licence to rewrite the row
-- ============================================================
-- `people_claim_self` (0001) let any member UPDATE any unclaimed row of their
-- parish. RLS cannot restrict columns, so that was not "may set claimed_by",
-- it was "may rewrite full_name, email, phone and notes" on every altar
-- server who has not linked an account yet.
--
-- Nothing in the app needs it: claimPersonAction and unlinkPersonAction both
-- run with the service role, which no policy applies to.
drop policy if exists people_claim_self on public.people;

-- The identity link itself is an admin decision, which is how the app already
-- treats it. A trigger rather than a policy, because this is about one pair
-- of columns and policies cannot see columns.
create or replace function public.guard_people_identity_link()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.claimed_by is distinct from old.claimed_by
     or new.claimed_at is distinct from old.claimed_at then
    -- A null auth.uid() is the service role or the SQL editor: the server's
    -- own path, which is where claiming and unlinking actually happen.
    if auth.uid() is not null and not public.is_admin(old.parish_id) then
      raise exception
        'the link between an account and a name is set by a group admin';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists people_guard_identity_link on public.people;
create trigger people_guard_identity_link
  before update on public.people
  for each row execute function public.guard_people_identity_link();

-- ============================================================
-- 2. A coordinator does not delete the group's furniture
-- ============================================================
-- The actions behind these screens all call requireAdmin, but the policies
-- said can_manage, so a coordinator could delete straight over the API what
-- the interface never offered them.
drop policy if exists people_delete on public.people;
create policy people_delete on public.people for delete
  using (public.is_admin(parish_id));

drop policy if exists locations_delete on public.locations;
create policy locations_delete on public.locations for delete
  using (public.is_admin(parish_id));

drop policy if exists mass_templates_delete on public.mass_templates;
create policy mass_templates_delete on public.mass_templates for delete
  using (public.is_admin(parish_id));

-- ============================================================
-- 3. A join link is an admin tool, and it carries a role
-- ============================================================
-- 0006 gave these to can_manage. A join link names the role whoever uses it
-- arrives with, so a coordinator could mint an admin link, open it, and come
-- back an admin of the parish. Every join link action already calls
-- requireAdmin; the policies now say the same thing.
drop policy if exists join_links_select on public.join_links;
create policy join_links_select on public.join_links for select
  using (public.is_admin(parish_id));

drop policy if exists join_links_insert on public.join_links;
create policy join_links_insert on public.join_links for insert
  with check (public.is_admin(parish_id));

drop policy if exists join_links_update on public.join_links;
create policy join_links_update on public.join_links for update
  using (public.is_admin(parish_id))
  with check (public.is_admin(parish_id));

drop policy if exists join_links_delete on public.join_links;
create policy join_links_delete on public.join_links for delete
  using (public.is_admin(parish_id));

-- ============================================================
-- 4. Contact details are not part of "the list of names"
-- ============================================================
-- `people_select` let every member read every column of their parish's roster,
-- e-mail, telephone and the coordinator's private notes included. The names
-- are not the secret: the public fill link shows them to anyone. These three
-- columns are, and the app never reads them with a member's own session.
revoke select (email, phone, notes) on public.people from authenticated;
revoke select (email, phone, notes) on public.people from anon;

-- ============================================================
-- 5. A capped join link has to actually cap
-- ============================================================
-- redeemJoinLinkAction read `uses`, created the membership, then wrote
-- `uses + 1`. Two people opening the link at once both read the same number,
-- so a link for five let in six. One statement decides it instead, and the
-- seat is taken before the membership is created.
create or replace function public.claim_join_link_seat(p_token text)
returns uuid language plpgsql volatile
security definer set search_path = public as $$
declare
  v_id uuid;
begin
  update public.join_links
     set uses = uses + 1
   where token = p_token
     and active
     and (expires_at is null or expires_at > now())
     and (max_uses is null or uses < max_uses)
  returning id into v_id;
  return v_id;
end;
$$;

-- Only the server calls it. Reaching it from a browser session would let
-- somebody burn a link's seats without ever joining.
revoke all on function public.claim_join_link_seat(text) from public;
revoke all on function public.claim_join_link_seat(text) from anon;
revoke all on function public.claim_join_link_seat(text) from authenticated;

------------------------------------------------------------------------------
-- 0009_people_column_privileges.sql
------------------------------------------------------------------------------
-- Item 4 of 0008 did not do anything, and the probe afterwards proved it.
--
-- Postgres does not break a table level grant down into column grants. The
-- role still held SELECT on the whole of `people`, so revoking SELECT on
-- three of its columns changed nothing: the broader privilege kept
-- answering, and `?select=email` with the publishable key still returned 200
-- instead of a permission error.
--
-- The order has to be the other way round. Take the table level privilege
-- away first, then hand back exactly the columns that are not private.
--
-- What stays private: `email` and `phone` are contact details a coordinator
-- collected, and `notes` is what the coordinator wrote about an altar server.
-- The names themselves are not secret; the public fill link shows them to
-- anyone who holds it.

revoke select on public.people from authenticated;
revoke select on public.people from anon;

grant select (
  id,
  parish_id,
  full_name,
  short_name,
  active,
  claimed_by,
  claimed_at,
  created_at,
  updated_at
) on public.people to authenticated;

-- `anon` is granted nothing back. No policy lets an anonymous session read
-- `people` in the first place, and every public screen reaches it through the
-- service role, after the token in the URL has been resolved on the server.

-- INSERT, UPDATE and DELETE are untouched: they are governed by the policies
-- in 0001 and 0008. The app never asks for the three private columns back on
-- a write (every insert and update runs with return=minimal, and the two
-- places that do read rows back ask only for ids), so nothing in the product
-- changes.
