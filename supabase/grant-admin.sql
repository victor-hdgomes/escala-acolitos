-- ============================================================================
-- Claiming the installation. Run this AFTER creating your account at /signup.
--
-- Put your own address below and run it once. It makes that account the
-- superadmin: the one person who sees and administers every group.
--
-- There is no screen that grants this, deliberately. The superadmin is marked
-- from here or from the Supabase SQL editor, where `auth.uid()` is null and
-- the guard in migration 0005 lets the change through. Everybody else, from
-- the app and through the API, is refused.
--
-- It does not put you in any group. Groups are self-service: open yours at
-- /groups/new, or join one with the link its coordinator sends you.
-- ============================================================================

do $$
declare
  v_email text := 'YOU@EXAMPLE.COM';   -- <<< change this
  v_user uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(v_email);
  if v_user is null then
    raise exception 'No account with the address %. Sign up at /signup first.', v_email;
  end if;

  update public.profiles set is_superadmin = true where id = v_user;

  raise notice '% is now the superadmin of this installation.', v_email;
end $$;
