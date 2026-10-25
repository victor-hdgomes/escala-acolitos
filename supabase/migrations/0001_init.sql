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
