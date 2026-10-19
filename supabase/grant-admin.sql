-- ============================================================================
-- Primeiro acesso — rode DEPOIS de criar sua conta em /signup
--
-- Troque o e-mail abaixo pelo da conta que você acabou de criar.
-- Isto faz duas coisas:
--   • admin da paróquia do seed, para você entrar direto no grupo
--   • superadmin da instalação, para enxergar e administrar todos os grupos
-- ============================================================================

do $$
declare
  v_email text := 'SEU@EMAIL.COM';   -- <<< troque aqui
  v_user uuid;
  v_parish uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(v_email);
  if v_user is null then
    raise exception 'Nenhuma conta com o e-mail %. Cadastre-se em /signup primeiro.', v_email;
  end if;

  select id into v_parish from public.parishes order by created_at limit 1;
  if v_parish is null then
    raise exception 'Nenhum grupo no banco. Rode supabase/setup.sql antes.';
  end if;

  insert into public.memberships (parish_id, user_id, role)
  values (v_parish, v_user, 'admin')
  on conflict (parish_id, user_id) do update set role = 'admin';

  update public.profiles set is_superadmin = true where id = v_user;

  raise notice 'Pronto: % agora é admin do grupo e superadmin.', v_email;
end $$;
