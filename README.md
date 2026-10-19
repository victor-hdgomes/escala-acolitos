# Escala de Acólitos

Substitui o fluxo de Google Forms → planilha → tabela no WhatsApp do ministério
de acólitos. Mobile-first, com link público para preenchimento (sem login),
montagem assistida e substituição que se resolve sozinha.

Stack: Next.js 16 (App Router + Server Actions), React 19, TypeScript,
Tailwind v4, shadcn/ui, Supabase (Postgres + Auth + RLS), Resend.

---

## Como subir

### 1. Supabase

Crie um projeto em [supabase.com](https://supabase.com) e cole
`supabase/setup.sql` inteiro no SQL Editor — é o schema + RLS + o seed da
Paróquia Cristo Rei (7 locais, grade semanal, 54 acólitos) num arquivo só.

Preferindo separado: `supabase/migrations/0001_init.sql` e depois
`supabase/seed.sql`. Com a connection string do Postgres em `SUPABASE_DB_URL`,
dá para aplicar tudo pelo terminal:

```bash
npm run db setup
```

Em **Authentication → Providers**, deixe e-mail/senha ligado. Para testar sem
caixa de entrada, desligue "Confirm email".

### 2. Variáveis

```bash
cp .env.example .env.local
```

Preencha `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e
`SUPABASE_SERVICE_ROLE_KEY` (Settings → API). Projetos antigos têm `anon key`
em vez de publishable — o app aceita as duas.

`RESEND_API_KEY` é opcional: sem ela o app funciona igual e só não envia
e-mail.

### 3. Rodar

```bash
npm install && npm run dev
```

### 4. Primeiro acesso

1. Crie sua conta em `/signup`
2. Rode `supabase/grant-admin.sql` no SQL Editor, trocando o e-mail no topo.
   Ele te torna admin do grupo do seed e superadmin da instalação (enxerga e
   administra todos os grupos). Pelo terminal: `npm run db grant voce@email.com`.

Sem o seed, o app leva você direto para `/grupos/novo` e você cria o grupo
pela interface — quem cria entra como administrador.

---

## Os três papéis

| Papel | O que faz |
| --- | --- |
| **Administrador** | Tudo: grupo, membros, papéis, convites, locais, grade, escalas |
| **Coordenador** | Cria e monta escalas, gerencia a lista de acólitos |
| **Acólito** | Vê as próprias missas e pede substituição |

Um administrador pode rebaixar a própria visão em **Ver como** para conferir as
telas dos outros sem trocar de conta — sem perder permissão de verdade.

Uma conta participa de **vários grupos** com papel diferente em cada um; o
seletor fica no topo da barra lateral (e no menu "Mais", no celular).

---

## O fluxo

```
Admin cadastra locais + grade semanal
        ↓
Coordenador cria a escala do mês  →  o mês nasce pronto a partir da grade
        ↓
Manda o link no WhatsApp          →  /e/<token>, sem login
        ↓
Acólitos marcam disponibilidade   →  filtros + "marcar as 12 datas"
        ↓
Coordenador monta                 →  sugestões ordenadas por quem está em falta
        ↓
Publica                           →  /v/<token> + e-mail para quem tem conta
        ↓
"Não vou conseguir"               →  /t/<token>, primeiro que clica assume
```

### Links públicos

| Rota | O que é |
| --- | --- |
| `/e/<token>` | Formulário de disponibilidade |
| `/v/<token>` | Escala publicada, somente leitura |
| `/t/<token>` | Pedido de substituição |

Nenhum deles exige conta. Quem **quiser** pode criar uma e vincular o próprio
nome — daí em diante só essa conta marca disponibilidade com aquele nome.

---

## Decisões que valem saber

**Por que a service role no acesso público.** O RLS do Supabase isola por
`auth.uid()`, o que não existe em acesso anônimo. Então todo acesso por token
passa por Server Action que resolve o token no servidor e confere que o
`event_id`/`person_id` recebido pertence àquela escala. Nenhuma policy libera
`anon`. Tudo que entra por link vai para `audit_log`, com hash de IP.

**Por que a sugestão não escala sozinha.** `lib/schedule/suggest.ts` só ordena:
peso maior para quem tem menos escalas no mês, penalidade para conflito no
mesmo dia, bônus leve para afinidade com o local. A escolha continua do
coordenador — inclusive com a opção de ver quem *não* marcou disponibilidade.

**Por que novena é diferente.** `events.signup_mode = 'direct'`: a vaga é
numerada e o próprio acólito pega, igual à mensagem que o grupo já usa. A
corrida entre dois cliques morre no índice único `(event_id, position)`.

**Fuso.** `events.starts_at` é `timestamptz`; tudo que o usuário vê é
convertido para o fuso do grupo (`lib/date.ts`, via `Intl`). Um grupo em
Manaus e outro em Goiânia não viram o dia na mesma hora — o cron de lembrete
leva isso em conta.

**E-mail é best-effort.** `email_log.dedupe_key` é único, então o cron rodar
duas vezes não manda dois e-mails. Falha de envio nunca impede a publicação.

---

## Scripts

```bash
npm run dev        # desenvolvimento
npm run build      # build de produção
npm run typecheck  # tsc --noEmit
npm run lint       # eslint

npm run db status              # o que já existe no banco
npm run db setup               # migrations + seed
npm run db grant voce@email.com
```

Para ver o app com dados sem reunir 54 pessoas:

```bash
node scripts/demo-schedule.mjs 2026-11 --reset   # cria a escala do mês pela grade
node scripts/demo-fill.mjs     2026-11 --reset   # disponibilidades + montagem
```

O sorteio tem semente fixa, então o resultado é o mesmo a cada execução, e
`--reset` limpa o que havia antes. Os dois usam a API REST com a service role.

Os comandos `db` precisam de `SUPABASE_DB_URL` no `.env.local`
(painel → Connect → Connection string → URI). DDL não passa pela API REST,
por isso a conexão direta.

## Deploy

Vercel + Supabase. `vercel.json` já agenda o lembrete de véspera
(`/api/cron/lembretes`, 8h de Brasília); proteja com `CRON_SECRET`.
Lembre de apontar `NEXT_PUBLIC_APP_URL` para o domínio real — é ele que entra
nos links mandados no grupo.
