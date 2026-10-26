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
