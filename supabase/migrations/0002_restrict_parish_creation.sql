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
