-- Escalas avulsas: uma novena pode ter escala própria, separada da do mês.
--
-- Na prática o ministério trata as duas como coisas diferentes: a escala
-- mensal sai da grade de missas, a novena é uma devoção com data própria,
-- vagas numeradas e link próprio no grupo. Forçar a novena para dentro da
-- escala do mês obrigava a abrir as duas ao mesmo tempo e misturava as
-- mensagens.
--
-- `kind` só descreve a escala; o que muda o comportamento de preenchimento
-- continua sendo `events.signup_mode`.

alter table public.schedules
  add column if not exists kind text not null default 'monthly'
  check (kind in ('monthly', 'novena', 'special'));

-- Escalas que já existem são mensais.
update public.schedules set kind = 'monthly' where kind is null;

create index if not exists schedules_parish_kind_idx
  on public.schedules(parish_id, kind, month desc);
