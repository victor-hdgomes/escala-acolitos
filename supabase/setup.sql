-- ============================================================================
-- Escala de Acólitos — setup completo
--
-- Cole este arquivo inteiro no SQL Editor do Supabase e rode uma vez.
-- Contém:
--   1. o schema, as funções e as policies de RLS (migrations/0001_init.sql)
--   2. o seed da Paróquia Cristo Rei: 7 locais, a grade semanal e os
--      54 acólitos da escala de outubro (seed.sql)
--
-- Depois disto: crie sua conta em /signup e rode `supabase/grant-admin.sql`.
-- ============================================================================


-- Escala de Acólitos — schema inicial
--
-- Dois mundos convivem aqui:
--   1. Área logada (coordenação/admin) — isolada por RLS via auth.uid().
--   2. Link público (formulário, escala publicada, substituição) — RLS NÃO
--      cobre acesso anônimo por token, então todo acesso público passa por
--      Server Action com a service role, que valida o token antes de escrever.
--      Nenhuma policy abaixo libera `anon`; isso é intencional.
--
-- Multi-grupo: `parishes` é a raiz de tenancy. Uma conta pode participar de
-- vários grupos (paróquias, ministérios, outra cidade) com papel diferente em
-- cada um — por isso `memberships` é N:N e o app guarda qual grupo está ativo.

create extension if not exists "pgcrypto";

-- Token curto e URL-safe para os links públicos. 8 bytes = 64 bits: o
-- suficiente para não ser adivinhado, curto o bastante para caber numa
-- mensagem de WhatsApp sem quebrar linha.
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
-- profiles (1:1 com auth.users)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  theme text not null default 'dark',
  -- Dono da instalação. Enxerga e administra todos os grupos. Marcado à mão
  -- no banco — não existe tela que conceda isto, de propósito.
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
-- memberships — papel do usuário na paróquia
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

-- Security definer: as policies das outras tabelas consultam memberships, e
-- sem isso a policy de memberships consultaria a si mesma (recursão infinita).
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

-- Coordenador e admin escrevem; admin manda em tudo.
create or replace function public.can_manage(p_parish uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role_in(p_parish) in ('admin', 'coordinator');
$$;

create or replace function public.is_admin(p_parish uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role_in(p_parish) = 'admin';
$$;

-- ============================================================
-- locations — locais de celebração
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
-- people — a lista de acólitos. Existe sem conta.
-- ============================================================
create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id) on delete cascade,
  full_name text not null,
  -- Como o nome aparece na escala ("MARIA EDUARDA LUCENA"). Quando null, usa full_name.
  short_name text,
  email text,
  phone text,
  active boolean not null default true,
  -- Quando preenchido, só este usuário pode marcar disponibilidade ou assumir
  -- vaga com este nome. É o que impede um colega de responder no seu lugar.
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (parish_id, full_name)
);

-- Um usuário é uma pessoa só.
create unique index if not exists people_claimed_by_uniq
  on public.people(claimed_by) where claimed_by is not null;
create index if not exists people_parish_idx on public.people(parish_id);

drop trigger if exists people_touch on public.people;
create trigger people_touch before update on public.people
  for each row execute function public.touch_updated_at();

-- ============================================================
-- invites — entrada de novos membros/coordenadores num grupo
-- ============================================================
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id) on delete cascade,
  email text,
  role text not null check (role in ('admin', 'coordinator', 'member')),
  -- Quando preenchido, aceitar o convite já vincula a conta a este acólito —
  -- resolve cadastro e vínculo de nome num clique só.
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
-- mass_templates — a grade semanal fixa
-- ============================================================
create table if not exists public.mass_templates (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6), -- 0 = domingo
  start_time time not null,
  slots int not null default 4 check (slots between 1 and 12),
  label text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (parish_id, location_id, weekday, start_time)
);

create index if not exists mass_templates_parish_idx on public.mass_templates(parish_id);

-- ============================================================
-- schedules — a escala de um mês
-- ============================================================
create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id) on delete cascade,
  title text not null,
  month date not null, -- sempre o dia 1 do mês de referência
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
-- events — cada celebração dentro da escala
-- ============================================================
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete restrict,
  starts_at timestamptz not null,
  label text, -- "3º dia da Novena em honra a Jesus Cristo Rei do Universo"
  kind text not null default 'mass' check (kind in ('mass', 'novena', 'special')),
  -- 'availability' = acólito marca que pode, coordenador escala.
  -- 'direct'       = acólito pega a vaga direto (modelo da novena no WhatsApp).
  signup_mode text not null default 'availability'
    check (signup_mode in ('availability', 'direct')),
  slots int not null default 4 check (slots between 1 and 12),
  created_at timestamptz not null default now()
);

create index if not exists events_schedule_idx on public.events(schedule_id, starts_at);
create unique index if not exists events_slot_uniq
  on public.events(schedule_id, location_id, starts_at);

-- ============================================================
-- availabilities — "posso servir nesta celebração"
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
-- assignments — a escala final
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
-- swap_requests — pedido de substituição
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

-- Um pedido aberto por vaga: evita dois links circulando para a mesma missa.
create unique index if not exists swap_one_open_per_assignment
  on public.swap_requests(assignment_id) where status = 'open';

-- ============================================================
-- email_log — idempotência de envio (o cron pode rodar duas vezes)
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
-- audit_log — quem mexeu em quê. Crítico: há link público sem login.
-- ============================================================
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid references public.parishes(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_label text, -- nome da pessoa quando a ação veio do link público
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

-- profiles: cada um o seu. `is_superadmin` nunca é editável pelo app — a
-- policy de update permite a linha, e a server action nunca manda esse campo.
create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
create policy profiles_insert_own on public.profiles for insert with check (auth.uid() = id);
create policy profiles_update_own on public.profiles for update using (auth.uid() = id);

-- parishes: membro lê; admin do grupo edita; qualquer conta cria um grupo novo
-- (e a server action a torna admin dele em seguida).
create policy parishes_select on public.parishes for select using (public.is_member(id));
create policy parishes_insert on public.parishes for insert
  with check (auth.uid() is not null);
create policy parishes_update on public.parishes for update using (public.is_admin(id));
create policy parishes_delete on public.parishes for delete using (public.is_admin(id));

-- memberships: membro lê as do seu grupo, admin do grupo escreve.
create policy memberships_select on public.memberships for select using (public.is_member(parish_id));
create policy memberships_insert on public.memberships for insert with check (public.is_admin(parish_id));
create policy memberships_update on public.memberships for update using (public.is_admin(parish_id));
create policy memberships_delete on public.memberships for delete using (public.is_admin(parish_id));

-- invites: só admin do grupo. Quem aceita chega sem membership ainda, então a
-- leitura por token roda na server action com service role.
create policy invites_select on public.invites for select using (public.is_admin(parish_id));
create policy invites_write on public.invites for all
  using (public.is_admin(parish_id))
  with check (public.is_admin(parish_id));

-- Tabelas com parish_id direto: membro lê, quem gerencia escreve.
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

-- Exceção: o próprio acólito logado vincula/desvincula o seu nome, sem ser
-- coordenador. A checagem de quem ele está vinculando fica na server action.
create policy people_claim_self on public.people for update
  using (public.is_member(parish_id) and (claimed_by is null or claimed_by = auth.uid()))
  with check (public.is_member(parish_id) and (claimed_by is null or claimed_by = auth.uid()));

-- events / availabilities / assignments: parish_id vem por join.
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

-- Logs: só quem gerencia lê; escrita é sempre service role.
create policy email_log_select on public.email_log for select using (public.can_manage(parish_id));
create policy audit_log_select on public.audit_log for select using (public.can_manage(parish_id));


-- ============================================================================
-- SEED
-- ============================================================================

-- Seed — Paróquia Cristo Rei, Parque Atheneu.
-- Locais, grade semanal e a lista de acólitos tirada da escala de outubro.
-- Idempotente: pode rodar de novo sem duplicar.

do $$
declare
  v_parish uuid;
  v_san_damiano uuid;
  v_sao_jorge uuid;
  v_sao_jose uuid;
  v_matriz uuid;
  v_divino uuid;
  v_aparecida uuid;
  v_sao_francisco uuid;
  v_name text;
begin
  insert into public.parishes (name, slug, timezone)
  values ('Paróquia Cristo Rei — Parque Atheneu', 'cristo-rei', 'America/Sao_Paulo')
  on conflict (slug) do update set name = excluded.name
  returning id into v_parish;

  -- ── Locais ────────────────────────────────────────────────────────────
  insert into public.locations (parish_id, name, short_name, color, sort_order) values
    (v_parish, 'Matriz de Cristo Rei',              'Matriz',        '#6366f1', 1),
    (v_parish, 'Convento San Damiano',              'San Damiano',   '#0ea5e9', 2),
    (v_parish, 'Capela São Jorge',                  'São Jorge',     '#f97316', 3),
    (v_parish, 'Capela São José Operário',          'São José',      '#14b8a6', 4),
    (v_parish, 'Capela Divino Pai Eterno',          'Divino',        '#a855f7', 5),
    (v_parish, 'Capela Nossa Senhora Aparecida',    'Aparecida',     '#ec4899', 6),
    (v_parish, 'Capela São Francisco de Assis',     'São Francisco', '#84cc16', 7)
  on conflict (parish_id, name) do nothing;

  select id into v_matriz        from public.locations where parish_id = v_parish and name = 'Matriz de Cristo Rei';
  select id into v_san_damiano   from public.locations where parish_id = v_parish and name = 'Convento San Damiano';
  select id into v_sao_jorge     from public.locations where parish_id = v_parish and name = 'Capela São Jorge';
  select id into v_sao_jose      from public.locations where parish_id = v_parish and name = 'Capela São José Operário';
  select id into v_divino        from public.locations where parish_id = v_parish and name = 'Capela Divino Pai Eterno';
  select id into v_aparecida     from public.locations where parish_id = v_parish and name = 'Capela Nossa Senhora Aparecida';
  select id into v_sao_francisco from public.locations where parish_id = v_parish and name = 'Capela São Francisco de Assis';

  -- ── Grade semanal (weekday: 0 = domingo) ──────────────────────────────
  insert into public.mass_templates (parish_id, location_id, weekday, start_time, slots) values
    (v_parish, v_san_damiano,   0, '08:00', 4),
    (v_parish, v_sao_jorge,     0, '08:00', 4),
    (v_parish, v_sao_jose,      0, '08:45', 3),
    (v_parish, v_matriz,        0, '10:00', 5),
    (v_parish, v_divino,        0, '18:00', 3),
    (v_parish, v_matriz,        0, '19:30', 5),
    (v_parish, v_divino,        2, '19:30', 2),
    (v_parish, v_aparecida,     3, '19:30', 2),
    (v_parish, v_aparecida,     4, '19:30', 2),
    (v_parish, v_sao_francisco, 6, '19:00', 2)
  on conflict (parish_id, location_id, weekday, start_time) do nothing;

  -- ── Acólitos e ancilas ────────────────────────────────────────────────
  foreach v_name in array array[
    'Alexia Oliveira', 'Alice Almeida', 'Alice Teixeira', 'Alice Valentina',
    'Amanda Sousa', 'Anna Gabriele', 'Anna Luísa', 'Bianca Cristina',
    'Caio Eduardo', 'Carlos Eduardo', 'Clara Ribeiro', 'Davi Borges',
    'Eduarda Fernandes', 'Emanuella Calixto', 'Emanuella Farias',
    'Gabriel Vicente', 'Geovanna Costa', 'Gislayne Santos', 'Gustavo Casulo',
    'Heloísa Gonçalves', 'Heloísa Oliveira', 'Isabella de Souza',
    'Isadora Sales', 'Israel Macedo', 'João Batista', 'João Paulo Marques',
    'João Victor', 'Karla Almeida', 'Lara Sophya', 'Livia Gonçalves',
    'Livia Sophia Caldas', 'Luan Pereira', 'Lucas Rabelo', 'Luiz Gustavo',
    'Marcela Muniz', 'Maria Eduarda Lucena', 'Maria Vitória', 'Mariana Rosa',
    'Marielle Pereira', 'Miguel Alexandre', 'Milena Duarte', 'Mirella Pereira',
    'Natalia Sampaio', 'Pedro Amâncio', 'Pedro Marques', 'Pietro Monteiro',
    'Roger Barreto', 'Ronaldo Lucas', 'Sofia Moreira', 'Sthela Tavares',
    'Victor Hugo', 'Vinicius Florindo', 'Vitória Rodrigues', 'Wilson Neto'
  ] loop
    insert into public.people (parish_id, full_name)
    values (v_parish, v_name)
    on conflict (parish_id, full_name) do nothing;
  end loop;
end $$;
