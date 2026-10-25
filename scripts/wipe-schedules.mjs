/**
 * Deletes every schedule and keeps the group's setup.
 *
 *   node scripts/wipe-schedules.mjs            shows what would be deleted
 *   node scripts/wipe-schedules.mjs --confirm  actually deletes it
 *
 * Goes: schedules, events, availabilities, assignments, swap_requests (the
 *       last three by cascade when the schedule goes).
 * Stays: parishes, locations, mass_templates, people, memberships, profiles.
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

async function rest(pathname, { method = "GET" } = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${pathname}`, {
    method,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${pathname} → ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const confirm = process.argv.includes("--confirm");

const schedules = await rest("schedules?select=id,title,month");
const events = schedules.length
  ? await rest(`events?select=id&schedule_id=in.(${schedules.map((s) => s.id).join(",")})`)
  : [];
const eventIds = events.map((e) => e.id);
const availabilities = eventIds.length
  ? await rest(`availabilities?select=id&event_id=in.(${eventIds.join(",")})`)
  : [];
const assignments = eventIds.length
  ? await rest(`assignments?select=id&event_id=in.(${eventIds.join(",")})`)
  : [];

console.log("A apagar:");
console.log(`  schedules          ${schedules.length}`);
console.log(`  celebrations     ${events.length}`);
console.log(`  disponibilidades ${availabilities.length}`);
console.log(`  assignments      ${assignments.length}`);

const [parishes, locations, templates, people, memberships] = await Promise.all([
  rest("parishes?select=id"),
  rest("locations?select=id"),
  rest("mass_templates?select=id"),
  rest("people?select=id"),
  rest("memberships?select=role"),
]);

console.log("\nA preservar:");
console.log(`  grupos           ${parishes.length}`);
console.log(`  locais           ${locations.length}`);
console.log(`  weekly Masses    ${templates.length}`);
console.log(`  altar servers    ${people.length}`);
console.log(`  membros          ${memberships.length} (${memberships.map((m) => m.role).join(", ")})`);

if (!confirm) {
  console.log("\nNothing was deleted. Run it again with --confirm.");
  process.exit(0);
}

// swap_requests, availabilities and assignments go by cascade; email_log and
// audit_log point at people and at the group, so they are cleared apart.
await rest("schedules?id=not.is.null", { method: "DELETE" });
await rest("email_log?id=not.is.null", { method: "DELETE" });
await rest("audit_log?id=not.is.null", { method: "DELETE" });

const remaining = await rest("schedules?select=id");
console.log(`\n✓ Done. Schedules left: ${remaining.length}.`);
