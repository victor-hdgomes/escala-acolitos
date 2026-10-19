# Escala de Acólitos — Plano e estado

Paróquia Cristo Rei · Parque Atheneu. Substitui o fluxo atual
(Google Forms → planilha → tabela no WhatsApp → pedido de substituição solto no
grupo).

> **Estado:** implementado e com build/typecheck/lint limpos. Falta aplicar as
> migrations num Supabase real e rodar com gente de verdade. Ver `README.md`
> para subir.

---

## 1. Decisões fechadas

| Tema | Decisão |
| --- | --- |
| Stack | Mesma do Monthly Budget (Next 16 + Supabase + shadcn/Tailwind v4) |
| Montagem da escala | Manual, com sugestões ranqueadas ao lado de cada vaga |
| Celebrações do mês | Templates da grade semanal geram o mês; coordenador ajusta |
| Avisos | E-mail (Resend) para quem vinculou conta |
| Substituição | Primeiro que clica assume na hora; coordenador recebe aviso |
| Login | Só para coordenador/admin. Acólito preenche por link público |
| Vínculo nome ↔ conta | Opcional. Nome vinculado só pode ser marcado pelo dono |
| Multi-grupo | Uma conta participa de vários grupos, com papel por grupo |

---

## 2. Design system herdado

`globals.css` e `design-tokens/tokens.ts` vieram do Monthly Budget com as
cores semânticas trocadas pelas do domínio:

| Monthly Budget | Escala |
| --- | --- |
| `--income` (verde) | `--filled` — vaga preenchida / confirmado |
| `--expense` (coral) | `--open` — vaga vazia / urgente |
| `--warning` (âmbar) | `--pending` — substituição aberta, prazo acabando |
| `--invest` (roxo) | `--novena` — celebração especial |

Mantidos: escala neutra do shadcn, `--radius: 0.625rem`, dark mode via `.dark`,
`@theme inline`, `tabular-nums`, arquitetura atômica e o `AppShell`
(sidebar no desktop, bottom nav + top bar no celular). Acrescentados
`.tap-target` (44px) e `.pb-safe` (área segura do iPhone).

---

## 3. Modelo de dados

```
parishes          grupo (paróquia/ministério) — raiz de tenancy
profiles          1:1 auth.users; is_superadmin = dono da instalação
memberships       parish_id + user_id + role: admin | coordinator | member
invites           entrada num grupo por link/e-mail, opcionalmente nominal
people            lista de acólitos — existe sem conta; claimed_by → auth.users
locations         Matriz, San Damiano, São Jorge, São José Operário, ...
mass_templates    grade semanal: weekday + hora + local + nº de vagas
schedules         escala de um mês (título, prazo, status, fill/view token)
events            cada celebração (datetime, local, vagas, kind, signup_mode)
availabilities    "posso servir nesta celebração"
assignments       escala final: evento + pessoa + posição
swap_requests     pedido de substituição com token público
email_log         idempotência de envio
audit_log         quem mexeu em quê (crítico: há link público)
```

Pontos que decidem o comportamento:

- **`people.claimed_by`** — quando preenchido, só aquele usuário marca
  disponibilidade ou assume vaga com esse nome.
- **`events.signup_mode`** — `availability` (coordenador escala) ou `direct`
  (novena: o acólito pega a vaga numerada).
- **`schedules.status`** — `draft → collecting → building → published → archived`.
- **Tokens** — `fill_token`, `view_token` e `swap_requests.token`.

### Segurança do acesso público

RLS isola por `auth.uid()` e não cobre acesso anônimo por token. Então todo
acesso público passa por Server Action que resolve o token no servidor, confere
que os ids recebidos pertencem àquela escala, respeita prazo e `claimed_by`, e
só então escreve com service role. Nenhuma policy libera `anon`.

---

## 4. As três visões

### Acólito — `/e/<token>`, sem login
Escolhe o nome (busca sem acento, cadeado em nome vinculado), filtra por
`Domingos · Sábados · Dias de semana · Manhã · Noite · Novena` e por local,
marca em lote ("marcar as 12 datas"), salva a cada toque e volta no mesmo
estado em outro aparelho. Novena aparece com vagas numeradas, preenchimento
direto.

### Coordenador — `/escalas`
Cria a escala do mês já projetada da grade. Abas: **Montagem** (vaga a vaga,
com sugestões), **Respostas** (quem respondeu, quem sumiu, celebrações em
risco), **Celebrações** (adicionar/editar, criar novena de 9 dias),
**Compartilhar** (link + mensagem pronta de WhatsApp + CSV).

### Admin — `/grupo`
Membros e papéis, convites por link ou e-mail (opcionalmente já vinculados a
um acólito), locais, grade semanal, dados do grupo. Mais `/pessoas`
(lista, importação em massa, vínculos) e `/estatisticas` (quem serve mais,
quem serve menos, quem sumiu). **Ver como** alterna a visão sem trocar de conta.

---

## 5. Substituição

`/v/<token>` → "não vou conseguir" → gera `/t/<token>` + mensagem de WhatsApp.
Quem marcou disponibilidade para aquele horário recebe e-mail. Primeiro que
confirma assume; a corrida morre no update condicional (`status = 'open'`).
Quem pediu é avisado.

---

## 6. O que ficou de fora

- Push/PWA instalável com notificação no aparelho (há manifesto, não há push)
- Exportação em PDF/imagem da tabela
- Histórico de versões da escala publicada
- Testes automatizados

## 7. Em aberto

- Nº padrão de vagas por local: o seed usa 5 na Matriz, 4 em San Damiano e
  São Jorge, 3 em São José e Divino, 2 nas missas de semana e no sábado —
  conferir com a coordenação
- A novena tem sempre 2 vagas? (o seed assume que sim)
- Domínio do app
