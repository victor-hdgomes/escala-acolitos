-- Seed — Paróquia Cristo Rei, Parque Atheneu.
-- Locais, grade semanal e a lista de acólitos tirada da escala de outubro.
-- Idempotente: pode rodar de novo sem duplicar.

do $$
declare
  v_parish uuid;
  v_san_damiano uuid;
  v_sao_jorge uuid;
  v_sao_jose uuid;
  v_matriz uuid;
  v_divino uuid;
  v_aparecida uuid;
  v_sao_francisco uuid;
  v_name text;
begin
  insert into public.parishes (name, slug, timezone)
  values ('Paróquia Cristo Rei — Parque Atheneu', 'cristo-rei', 'America/Sao_Paulo')
  on conflict (slug) do update set name = excluded.name
  returning id into v_parish;

  -- ── Locais ────────────────────────────────────────────────────────────
  insert into public.locations (parish_id, name, short_name, color, sort_order) values
    (v_parish, 'Matriz de Cristo Rei',              'Matriz',        '#6366f1', 1),
    (v_parish, 'Convento San Damiano',              'San Damiano',   '#0ea5e9', 2),
    (v_parish, 'Capela São Jorge',                  'São Jorge',     '#f97316', 3),
    (v_parish, 'Capela São José Operário',          'São José',      '#14b8a6', 4),
    (v_parish, 'Capela Divino Pai Eterno',          'Divino',        '#a855f7', 5),
    (v_parish, 'Capela Nossa Senhora Aparecida',    'Aparecida',     '#ec4899', 6),
    (v_parish, 'Capela São Francisco de Assis',     'São Francisco', '#84cc16', 7)
  on conflict (parish_id, name) do nothing;

  select id into v_matriz        from public.locations where parish_id = v_parish and name = 'Matriz de Cristo Rei';
  select id into v_san_damiano   from public.locations where parish_id = v_parish and name = 'Convento San Damiano';
  select id into v_sao_jorge     from public.locations where parish_id = v_parish and name = 'Capela São Jorge';
  select id into v_sao_jose      from public.locations where parish_id = v_parish and name = 'Capela São José Operário';
  select id into v_divino        from public.locations where parish_id = v_parish and name = 'Capela Divino Pai Eterno';
  select id into v_aparecida     from public.locations where parish_id = v_parish and name = 'Capela Nossa Senhora Aparecida';
  select id into v_sao_francisco from public.locations where parish_id = v_parish and name = 'Capela São Francisco de Assis';

  -- ── Grade semanal (weekday: 0 = domingo) ──────────────────────────────
  insert into public.mass_templates (parish_id, location_id, weekday, start_time, slots) values
    (v_parish, v_san_damiano,   0, '08:00', 4),
    (v_parish, v_sao_jorge,     0, '08:00', 4),
    (v_parish, v_sao_jose,      0, '08:45', 3),
    (v_parish, v_matriz,        0, '10:00', 5),
    (v_parish, v_divino,        0, '18:00', 3),
    (v_parish, v_matriz,        0, '19:30', 5),
    (v_parish, v_divino,        2, '19:30', 2),
    (v_parish, v_aparecida,     3, '19:30', 2),
    (v_parish, v_aparecida,     4, '19:30', 2),
    (v_parish, v_sao_francisco, 6, '19:00', 2)
  on conflict (parish_id, location_id, weekday, start_time) do nothing;

  -- ── Acólitos e ancilas ────────────────────────────────────────────────
  foreach v_name in array array[
    'Alexia Oliveira', 'Alice Almeida', 'Alice Teixeira', 'Alice Valentina',
    'Amanda Sousa', 'Anna Gabriele', 'Anna Luísa', 'Bianca Cristina',
    'Caio Eduardo', 'Carlos Eduardo', 'Clara Ribeiro', 'Davi Borges',
    'Eduarda Fernandes', 'Emanuella Calixto', 'Emanuella Farias',
    'Gabriel Vicente', 'Geovanna Costa', 'Gislayne Santos', 'Gustavo Casulo',
    'Heloísa Gonçalves', 'Heloísa Oliveira', 'Isabella de Souza',
    'Isadora Sales', 'Israel Macedo', 'João Batista', 'João Paulo Marques',
    'João Victor', 'Karla Almeida', 'Lara Sophya', 'Livia Gonçalves',
    'Livia Sophia Caldas', 'Luan Pereira', 'Lucas Rabelo', 'Luiz Gustavo',
    'Marcela Muniz', 'Maria Eduarda Lucena', 'Maria Vitória', 'Mariana Rosa',
    'Marielle Pereira', 'Miguel Alexandre', 'Milena Duarte', 'Mirella Pereira',
    'Natalia Sampaio', 'Pedro Amâncio', 'Pedro Marques', 'Pietro Monteiro',
    'Roger Barreto', 'Ronaldo Lucas', 'Sofia Moreira', 'Sthela Tavares',
    'Victor Hugo', 'Vinicius Florindo', 'Vitória Rodrigues', 'Wilson Neto'
  ] loop
    insert into public.people (parish_id, full_name)
    values (v_parish, v_name)
    on conflict (parish_id, full_name) do nothing;
  end loop;
end $$;
