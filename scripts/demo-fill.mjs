/**
 * Fills a schedule with plausible data, so the app can be seen working
 * without fifty-four people answering a form first.
 *
 *   node scripts/demo-fill.mjs 2026-11            disponibilidades + montagem
 *   node scripts/demo-fill.mjs 2026-11 --reset    clears what was there
 *   node scripts/demo-fill.mjs 2026-11 --only-availability
 *
 * The draw is deterministic (fixed seed), so running it again produces the
 * same result, which is what makes two runs of a screen comparable.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  if (!line || line.trimStart().startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i > 0 && !(line.slice(0, i).trim() in process.env)) {
    process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
}

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function rest(pathname, { method = "GET", body, prefer } = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${pathname}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${pathname} → ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

/** Seeded PRNG: the same command always produces the same schedule. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const month = process.argv[2] ?? "2026-11";
const reset = process.argv.includes("--reset");
const onlyAvailability = process.argv.includes("--only-availability");
const monthIso = `${month}-01`;

const [schedule] = await rest(
  `schedules?month=eq.${monthIso}&select=id,title,status,parish_id&order=created_at&limit=1`,
);
if (!schedule) {
  console.error(`No schedule for ${month}.`);
  process.exit(1);
}

const events = await rest(
  `events?schedule_id=eq.${schedule.id}&select=id,starts_at,slots,signup_mode,location_id&order=starts_at`,
);
const people = await rest(
  `people?parish_id=eq.${schedule.parish_id}&active=eq.true&select=id,full_name&order=full_name`,
);

if (reset) {
  const ids = events.map((e) => e.id).join(",");
  await rest(`assignments?event_id=in.(${ids})`, { method: "DELETE" });
  await rest(`availabilities?event_id=in.(${ids})`, { method: "DELETE" });
  console.log("cleared: earlier availabilities and assignments");
}

const random = rng(20261101);
const openEvents = events.filter((e) => e.signup_mode === "availability");
const directEvents = events.filter((e) => e.signup_mode === "direct");

// ── Disponibilidades ────────────────────────────────────────────────────
// The shapes real people come in: the one who marks nearly everything, the
// one who marks three dates and the one who vanishes. It is what gives the
// responses panel something to show.
const availabilities = [];
let silent = 0;
for (const person of people) {
  const roll = random();
  if (roll < 0.1) {
    silent += 1;
    continue;
  }
  const share = roll < 0.35 ? 0.08 : roll < 0.75 ? 0.25 : 0.5;
  for (const event of openEvents) {
    if (random() < share) {
      availabilities.push({ event_id: event.id, person_id: person.id, source: "public" });
    }
  }
}
for (let i = 0; i < availabilities.length; i += 500) {
  await rest("availabilities", {
    method: "POST",
    prefer: "resolution=ignore-duplicates",
    body: availabilities.slice(i, i + 500),
  });
}
console.log(
  `${availabilities.length} availabilities, ${people.length - silent} answered, ${silent} did not`,
);

// Novena: the slots the altar servers claim themselves.
const directAssignments = [];
for (const event of directEvents) {
  const taken = new Set();
  for (let position = 1; position <= event.slots; position++) {
    if (random() < 0.35) continue; // not every novena slot gets claimed
    let person;
    do {
      person = people[Math.floor(random() * people.length)];
    } while (taken.has(person.id));
    taken.add(person.id);
    directAssignments.push({
      event_id: event.id,
      person_id: person.id,
      position,
      status: "confirmed",
    });
  }
}

if (onlyAvailability) {
  console.log("parando aqui (--only-availability)");
  process.exit(0);
}

// ── Montagem ────────────────────────────────────────────────────────────
// Same idea as rankCandidates: balance the month and avoid scheduling the same
// pessoa duas vezes no mesmo dia.
const availableByEvent = new Map();
for (const a of availabilities) {
  const list = availableByEvent.get(a.event_id) ?? [];
  list.push(a.person_id);
  availableByEvent.set(a.event_id, list);
}

const count = new Map(people.map((p) => [p.id, 0]));
const byDay = new Map();
const dayOf = (iso) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));

const assignments = [...directAssignments];
for (const a of directAssignments) {
  count.set(a.person_id, (count.get(a.person_id) ?? 0) + 1);
}

for (const event of openEvents) {
  const day = dayOf(event.starts_at);
  const usedToday = byDay.get(day) ?? new Set();
  const pool = (availableByEvent.get(event.id) ?? []).filter((id) => !usedToday.has(id));
  pool.sort((a, b) => (count.get(a) ?? 0) - (count.get(b) ?? 0));

  const inEvent = new Set();
  for (let position = 1; position <= event.slots; position++) {
    const pick = pool.find((id) => !inEvent.has(id));
    if (!pick) break;
    inEvent.add(pick);
    usedToday.add(pick);
    count.set(pick, (count.get(pick) ?? 0) + 1);
    assignments.push({
      event_id: event.id,
      person_id: pick,
      position,
      status: "confirmed",
    });
    pool.splice(pool.indexOf(pick), 1);
  }
  byDay.set(day, usedToday);
}

for (let i = 0; i < assignments.length; i += 500) {
  await rest("assignments", {
    method: "POST",
    prefer: "resolution=ignore-duplicates",
    body: assignments.slice(i, i + 500),
  });
}

const totalSlots = events.reduce((sum, e) => sum + e.slots, 0);
const served = [...count.values()].filter((n) => n > 0).length;
const max = Math.max(...count.values());
const min = Math.min(...[...count.values()].filter((n) => n > 0));

console.log(`${assignments.length} de ${totalSlots} vagas preenchidas`);
console.log(`${served} altar servers scheduled, between ${min} and ${max} Masses each`);
