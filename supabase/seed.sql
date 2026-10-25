-- Optional demo data.
--
-- Entirely invented: a parish that does not exist, chapels that do not exist
-- and twenty-four names that belong to nobody. It is here so the screens can
-- be seen with something in them before a real group is set up, and so a
-- change to the assembly or to the suggestions can be tried against a full
-- month rather than an empty one.
--
-- A real installation does not need this. The app is self-service: whoever
-- arrives opens their own group from /signup. Load this only to look around.
--
-- Idempotent: running it again adds nothing twice.

do $$
declare
  v_parish uuid;
  v_main uuid;
  v_clare uuid;
  v_george uuid;
  v_joseph uuid;
  v_mercy uuid;
  v_grace uuid;
  v_francis uuid;
  v_name text;
begin
  insert into public.parishes (name, slug, timezone)
  values ('Holy Cross Parish', 'holy-cross-demo', 'America/Sao_Paulo')
  on conflict (slug) do update set name = excluded.name
  returning id into v_parish;

  -- Places ------------------------------------------------------------------
  insert into public.locations (parish_id, name, short_name, color, sort_order) values
    (v_parish, 'Holy Cross Church',               'Main church', '#6366f1', 1),
    (v_parish, 'Saint Clare Convent',             'Saint Clare', '#0ea5e9', 2),
    (v_parish, 'Saint George Chapel',             'Saint George', '#f97316', 3),
    (v_parish, 'Saint Joseph the Worker Chapel',  'Saint Joseph', '#14b8a6', 4),
    (v_parish, 'Divine Mercy Chapel',             'Divine Mercy', '#a855f7', 5),
    (v_parish, 'Our Lady of Grace Chapel',        'Our Lady', '#ec4899', 6),
    (v_parish, 'Saint Francis Chapel',            'Saint Francis', '#84cc16', 7)
  on conflict (parish_id, name) do nothing;

  select id into v_main    from public.locations where parish_id = v_parish and name = 'Holy Cross Church';
  select id into v_clare   from public.locations where parish_id = v_parish and name = 'Saint Clare Convent';
  select id into v_george  from public.locations where parish_id = v_parish and name = 'Saint George Chapel';
  select id into v_joseph  from public.locations where parish_id = v_parish and name = 'Saint Joseph the Worker Chapel';
  select id into v_mercy   from public.locations where parish_id = v_parish and name = 'Divine Mercy Chapel';
  select id into v_grace   from public.locations where parish_id = v_parish and name = 'Our Lady of Grace Chapel';
  select id into v_francis from public.locations where parish_id = v_parish and name = 'Saint Francis Chapel';

  -- The week as it repeats (weekday: 0 = Sunday) -----------------------------
  insert into public.mass_templates (parish_id, location_id, weekday, start_time, slots) values
    (v_parish, v_clare,   0, '08:00', 4),
    (v_parish, v_george,  0, '08:00', 4),
    (v_parish, v_joseph,  0, '08:45', 3),
    (v_parish, v_main,    0, '10:00', 5),
    (v_parish, v_mercy,   0, '18:00', 3),
    (v_parish, v_main,    0, '19:30', 5),
    (v_parish, v_mercy,   2, '19:30', 2),
    (v_parish, v_grace,   3, '19:30', 2),
    (v_parish, v_grace,   4, '19:30', 2),
    (v_parish, v_francis, 6, '19:00', 2)
  on conflict (parish_id, location_id, weekday, start_time) do nothing;

  -- Altar servers ------------------------------------------------------------
  foreach v_name in array array[
    'Adriana Quintero', 'Bruno Vasques', 'Camila Arantes', 'Daniel Fontoura',
    'Elisa Bramante', 'Fabio Quental', 'Gabriela Nunes', 'Helena Trindade',
    'Igor Salvatti', 'Juliana Peixoto', 'Kleber Antunes', 'Laura Benedetti',
    'Marcos Vilela', 'Nadia Ferraz', 'Otavio Bentes', 'Paula Cerqueira',
    'Rafael Modesto', 'Sabrina Toledo', 'Thiago Vasconcelos', 'Ursula Pacheco',
    'Vicente Aragao', 'Yasmin Bitencourt', 'Zeca Mourao', 'Alice Rondon'
  ] loop
    insert into public.people (parish_id, full_name)
    values (v_parish, v_name)
    on conflict (parish_id, full_name) do nothing;
  end loop;
end $$;
