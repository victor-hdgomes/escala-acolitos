# Altar Roster

Scheduling for parish altar server ministries.

Most ministries run on the same three tools: a Google Form, a spreadsheet, and
a screenshot of that spreadsheet pasted into the parish WhatsApp group. It
works until somebody cannot make Saturday evening, and then it does not work
at all, because the schedule everyone is looking at is already out of date and
nobody knows who is missing.

This replaces that loop. The coordinator opens the month, posts one link in
the group, and the altar servers mark the Masses they can serve. No account,
no password, nothing to install. Then the coordinator assembles the schedule
with the app suggesting who is owed a turn, publishes it as a read-only link
that is always current, and cover requests resolve themselves: first to tap
takes the slot.

Mobile first, because that is where every single person in this story is.
English and Brazilian Portuguese, switchable from any screen.

---

## What it does

| | |
| --- | --- |
| **The month writes itself** | Set the weekly Mass pattern once. Every month after that is generated from it, and the coordinator only adjusts. |
| **Answering takes one tap** | Filter to Sundays and mornings, mark all twelve dates at once, done. |
| **You can see who is missing** | The form never told you which thirty-two of your fifty-four people had not answered. This does. |
| **Assembly that argues back** | Suggestions ranked by who is owed a turn, with same-day conflicts flagged, including against a novena running beside the Mass. |
| **Cover requests settle themselves** | A link goes in the group chat; whoever taps first takes the slot, and the coordinator is told rather than asked. |
| **Novenas work the way they already do** | Nine evenings, slots numbered one to six, claimed directly. Except a slot cannot be claimed twice. |
| **One account, several chapels** | An altar server who serves at two places joins both groups and switches between them. |
| **Install it like an app** | It is a PWA: one tap puts it on the home screen, full screen, no browser bar. |

---

## Getting started

### 1. Supabase

Create a project at [supabase.com](https://supabase.com) and paste
`supabase/setup.sql` into the SQL editor. It is the whole schema, the row
level security policies and nothing else: no parish, no names, no data. It is
generated from `supabase/migrations/`, so it can never fall behind them.

```bash
npm run db:setup          # regenerates supabase/setup.sql from the migrations
```

In **Authentication, Providers**, leave email and password enabled. To try it
without an inbox, turn "Confirm email" off.

### 2. Environment

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` (Settings, API). Older projects have an `anon key`
instead of a publishable one; both work.

`RESEND_API_KEY` is optional. Without it everything works the same and no
email goes out.

### 3. Run

```bash
npm install && npm run dev
```

### 4. First sign-in

Create your account at `/signup` and the app takes you straight to opening
your group. You join it as its administrator.

If this installation is yours, also run `supabase/grant-admin.sql` with your
address at the top. That makes you the **superadmin**: the one account that
sees and administers every group.

Want something on the screens before you have a real group?
`supabase/seed.sql` loads an invented parish with seven places, a weekly
pattern and twenty-four fictional names. It is demo data and nothing depends
on it.

---

## How people get in

Three doors, because three different people arrive.

**The join link.** The coordinator creates one in **Group, Members** and posts
it once in the WhatsApp group. Anyone who signs up through it lands inside the
group already, with the role the link carries. It can be capped at a number of
people, given an expiry, paused, or deleted.

**The join code.** Someone who signs up on their own has no group, so they
land on a waiting screen showing a short code: `K7P4-R2MQ`. They read it out
to whoever coordinates, who types it into **Add someone by code** and adds
them, optionally tying the account to a name already on the altar servers
list. Nothing here is searchable: the code or the full address has to be
handed over first, so this is never a way to browse accounts.

**The named invitation.** One seat, for one person, optionally tied to one
name on the list, burnt on acceptance. Right for handing someone the keys.

### Who may answer a schedule

Each group decides, in **Group, General**:

- **Anyone with the link.** No account needed. Whoever opens the link picks
  their name and marks their dates. This is the easiest way to start, and it
  is what makes the app usable by a ministry of thirteen-year-olds.
- **Only people in this group.** Answering needs an account that belongs to
  the group. Someone who opens the link without one is shown how to join
  rather than refused.

Either way, a name that has been linked to an account can only be marked by
that account. That is what stops someone answering in your place.

---

## The roles

| Role | What it does |
| --- | --- |
| **Administrator** | Everything inside the group: members, roles, invitations, join links, places, the weekly pattern, schedules |
| **Coordinator** | Creates and assembles schedules, manages the altar servers list |
| **Altar server** | Sees their own Masses and asks for cover |

An administrator can demote their own *view* with **View as**, to check the
other screens without switching account and without actually losing
permission.

One account belongs to **several groups** with a different role in each. The
picker is at the top of the sidebar, and in the "More" menu on a phone.

Above the three sits the **superadmin**, the owner of the installation
(`profiles.is_superadmin`): the only account that sees every group. No screen
grants that role. It is set in the database on purpose, and since migration
0005 it is **unique and immutable**: a unique index blocks a second promotion
and a trigger stops any authenticated session from changing the field, its own
row included. Without that, the `profiles_update_own` policy would let any
account promote itself with a single PATCH against the API and start seeing
every parish. A small risk in a one-parish installation, unacceptable with
open sign-up.

**Who may open a group** (migration 0004): an account in no group opens the
first one, which is the way in. An account that already belongs to a group
does not open others, which keeps an invited altar server away from creation.

---

## Kinds of schedule

| Kind | When |
| --- | --- |
| **Monthly** | The month's Masses, generated from the weekly pattern |
| **Novena** | A run of days for one devotion, with its own link and deadline |

A novena can live inside the month's schedule (**Celebrations, Novena**) or
have one of its own (**New schedule, Novena**). With its own, the month goes
out without it and the two circulate in the group as separate messages, which
is how the ministry already treats them.

When two schedules share a month, assembly warns you if someone is already
scheduled that day **on the other one**. Without it the app would cheerfully
suggest the same person for the 7:30 pm Mass and the 7:30 pm novena.

---

## The flow

```
Admin adds the places and the weekly pattern
        |
Coordinator opens the month        ->  generated from the pattern, ready to adjust
        |
Posts the link in WhatsApp         ->  /e/<token>, no sign-in
        |
Altar servers mark availability    ->  filters, and "mark all twelve dates"
        |
Coordinator assembles              ->  suggestions ordered by who is owed a turn
        |
Publishes                          ->  /v/<token>, plus email to linked accounts
        |
"I cannot make it"                 ->  /t/<token>, first to tap takes it
```

### Public links

| Route | What it is |
| --- | --- |
| `/e/<token>` | Availability form |
| `/v/<token>` | Published schedule, read only |
| `/t/<token>` | Cover request |
| `/j/<token>` | Join link for a group |

One letter each, deliberately: these get pasted into WhatsApp, where a long
URL wraps and starts to look like spam.

---

## Decisions worth knowing

**Why the service role on public access.** Supabase RLS isolates by
`auth.uid()`, which does not exist for an anonymous visitor. So every path
reached by token goes through a Server Action that resolves the token on the
server and checks that the `event_id` or `person_id` it was handed belongs to
that schedule. No policy opens anything to `anon`. Everything arriving by link
is written to `audit_log`, with the IP hashed.

**Why suggestions never assign on their own.** `lib/schedule/suggest.ts` only
sorts: more weight to whoever has fewer turns this month, a penalty for a
same-day conflict, a light bonus for familiarity with the place. The choice
stays the coordinator's, including the option to see who did *not* mark
availability.

**Why a novena is different.** `events.signup_mode = 'direct'`: the slot is
numbered and the altar server takes it, exactly like the message the group
already uses. The race between two taps dies in the unique index on
`(event_id, position)`.

**Time zones.** `events.starts_at` is `timestamptz`, and everything a reader
sees is converted to the group's zone through `Intl` (`lib/date.ts`). Two
groups in different zones do not turn the day at the same moment, and the
reminder cron accounts for that.

**Translation is a contract, not a string.** Server Actions never return prose.
They return a code from `lib/action-result.ts`, and the interface looks it up
in the reader's language. `npm run check:messages` fails the build on a
missing key, an extra one, or an ICU placeholder that does not match the
English source.

**Email is best effort.** `email_log.dedupe_key` is unique, so the cron
running twice does not send twice. A failed send never blocks a publication.

---

## Scripts

```bash
npm run dev             # development
npm run build           # production build
npm run typecheck       # tsc --noEmit
npm run lint            # eslint
npm run check:messages  # catalog parity between locales
npm run db:setup        # regenerate supabase/setup.sql from the migrations
```

To look around with something on the screens, paste `supabase/seed.sql` into
the SQL editor: an invented parish with seven places, a weekly pattern and
twenty-four fictional names. To start over, delete the group from
**Group, General** or drop the rows from the dashboard.

---

## Deploy

Vercel plus Supabase. `vercel.json` already schedules the evening-before
reminder (`/api/cron/reminders`); protect it with `CRON_SECRET`. Point
`NEXT_PUBLIC_APP_URL` at the real domain: that is what goes into every link
posted in the group.

---

## Stack

Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind v4,
shadcn/ui, next-intl, Supabase (Postgres, Auth, RLS), Resend.

---

Named for **Saint Tarcisius**, a boy who carried the Eucharist through Rome
and was killed rather than give it up. Nothing of the sort is asked of the
children in your sacristy. Only that they serve, and that somebody keeps track
of who, carefully, and without anyone being forgotten.
