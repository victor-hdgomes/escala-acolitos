-- Só o dono da instalação cria grupos.
--
-- Antes, qualquer conta autenticada podia criar uma paróquia e virar admin
-- dela — bom para auto-atendimento, ruim aqui: quem entra por convite não
-- deve conseguir abrir grupos novos. Admin de paróquia continua mandando no
-- grupo dele; criar outro é só do superadmin.
--
-- Esta policy é defesa em profundidade: a criação roda por Server Action com
-- service role (o membership de admin precisa existir no mesmo instante em
-- que a paróquia nasce), e é lá que a checagem de verdade acontece.

drop policy if exists parishes_insert on public.parishes;

create policy parishes_insert on public.parishes for insert
  with check (public.is_superadmin());
