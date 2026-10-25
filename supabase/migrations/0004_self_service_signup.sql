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
