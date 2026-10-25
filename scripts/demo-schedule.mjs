/**
 * Creates a demo schedule from the group's weekly Mass pattern.
 *
 * For seeing the app run on real-looking data without clicking through the
 * coordination screens. Uses the REST API with the service role, so it runs
 * direta ao Postgres.
 *
 *   node scripts/demo-schedule.mjs 2026-11
 *   node scripts/demo-schedule.mjs 2026-11 --reset   drops that month first
 *
 * Prints the public fill and view links at the end.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

function loadEnv() {
  const file = path.join(ROOT, ".env.local");
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 1) continue;
    const key = line.slice(0, i).trim();
    if (!(key in process.env)) process.env[key] = line.slice(i + 1).trim();
  }
}
loadEnv();

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

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

// Time zone: the same logic as src/lib/date.ts, without the TypeScript.
function partsIn(date, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    year: +p.year, month: +p.month, day: +p.day,
    hour: +p.hour % 24, minute: +p.minute, second: +p.second,
  };
}

function zonedTimeToUtc(year, month, day, hour, minute, timeZone) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const offset = (d) => {
    const p = partsIn(d, timeZone);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - d.getTime();
  };
  const first = offset(new Date(guess));
  let result = new Date(guess - first);
  const second = offset(result);
  if (second !== first) result = new Date(guess - second);
  return result;
}

const MONTHS = ["January","February","March","April","May","June","July",
  "agosto","setembro","outubro","novembro","dezembro"];

const monthArg = process.argv[2] ?? "2026-11";
const reset = process.argv.includes("--reset");
if (!/^\d{4}-\d{2}$/.test(monthArg)) {
  console.error("Give the month as YYYY-MM, e.g. node scripts/demo-schedule.mjs 2026-11");
  process.exit(1);
}
const monthIso = `${monthArg}-01`;

const [parish] = await rest("parishes?select=id,name,timezone&order=created_at&limit=1");
if (!parish) {
  console.error("No group in the database. Run supabase/setup.sql first.");
  process.exit(1);
}

if (reset) {
  await rest(`schedules?parish_id=eq.${parish.id}&month=eq.${monthIso}`, { method: "DELETE" });
}

const templates = await rest(
  `mass_templates?parish_id=eq.${parish.id}&active=eq.true&select=location_id,weekday,start_time,slots,label`,
);
if (!templates.length) {
  console.error("The weekly pattern is empty. Add the recurring Masses in /group.");
  process.exit(1);
}

const [year, month] = monthArg.split("-").map(Number);
const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

// Deadline: the Friday before the month starts, which is what the ministry
// already does.
const deadline = (() => {
  const d = new Date(Date.UTC(year, month - 1, 1));
  do { d.setUTCDate(d.getUTCDate() - 1); } while (d.getUTCDay() !== 5);
  return zonedTimeToUtc(
    d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), 23, 59, parish.timezone,
  ).toISOString();
})();

const [schedule] = await rest("schedules", {
  method: "POST",
  prefer: "return=representation",
  body: [{
    parish_id: parish.id,
    title: `Monthly schedule | ${MONTHS[month - 1]} ${year}`,
    month: monthIso,
    status: "collecting",
    availability_deadline: deadline,
    intro_note:
      "Mark every date you can serve, so we can put the schedule together without a rush.",
  }],
});

const events = [];
for (let day = 1; day <= lastDay; day++) {
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  for (const t of templates) {
    if (t.weekday !== weekday) continue;
    const [h, m] = t.start_time.split(":").map(Number);
    events.push({
      schedule_id: schedule.id,
      location_id: t.location_id,
      starts_at: zonedTimeToUtc(year, month, day, h, m, parish.timezone).toISOString(),
      slots: t.slots,
      kind: "mass",
      signup_mode: "availability",
      label: t.label ?? null,
    });
  }
}
await rest("events", { method: "POST", body: events });

console.log(`✓ ${schedule.title}`);
console.log(`  ${events.length} celebrations, deadline ${new Date(deadline).toLocaleDateString("en-GB", { timeZone: parish.timezone })}`);
console.log();
console.log(`  preencher:  ${APP}/e/${schedule.fill_token}`);
console.log(`  publicada:  ${APP}/v/${schedule.view_token}`);
