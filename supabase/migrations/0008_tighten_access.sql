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
