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
