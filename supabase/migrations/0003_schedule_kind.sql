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
