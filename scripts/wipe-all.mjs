/**
 * Empties the installation while keeping the accounts.
 *
 *   node scripts/wipe-all.mjs            shows what would be deleted
 *   node scripts/wipe-all.mjs --confirm  actually deletes it
 *
 * Goes: parishes and everything that hangs off them by cascade (memberships,
 *       invites, people, locations, mass_templates, schedules, events,
 *       availabilities, assignments, swap_requests), plus email_log and
 *       audit_log.
 * Stays: auth.users and public.profiles, the superadmin mark included.
 *
 * For starting from nothing without losing the sign-in of whoever runs it.
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
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${pathname} → ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const confirm = process.argv.includes("--confirm");

const CONTEUDO = [
  "parishes",
  "memberships",
  "invites",
  "people",
  "locations",
  "mass_templates",
  "schedules",
  "events",
  "availabilities",
  "assignments",
  "swap_requests",
  "email_log",
  "audit_log",
];

console.log("A apagar:");
for (const table of CONTEUDO) {
  try {
    const rows = await rest(`${table}?select=id`);
    console.log(`  ${table.padEnd(16)} ${rows.length}`);
  } catch {
    console.log(`  ${table.padEnd(16)} - does not exist`);
  }
}

const profiles = await rest("profiles?select=id,email,is_superadmin");
console.log("\nA preservar:");
console.log(`  contas           ${profiles.length}`);
for (const p of profiles) {
  console.log(`    ${p.email}${p.is_superadmin ? "  ← superadmin" : ""}`);
}

if (!confirm) {
  console.log("\nNothing was deleted. Run it again with --confirm.");
  process.exit(0);
}

// Order matters: events.location_id is `on delete restrict`, so deleting the
// parish outright fails while any celebration still points at a place.
// Schedules first (they take events, and with them availabilities,
// assignments and swap requests),
// then the parishes (which take memberships, invites, people, locations and
// the weekly pattern with them).
await rest("email_log?id=not.is.null", { method: "DELETE" });
await rest("audit_log?id=not.is.null", { method: "DELETE" });
await rest("schedules?id=not.is.null", { method: "DELETE" });
await rest("parishes?id=not.is.null", { method: "DELETE" });

console.log("\nDepois:");
for (const table of CONTEUDO) {
  try {
    const rows = await rest(`${table}?select=id`);
    console.log(`  ${table.padEnd(16)} ${rows.length}`);
  } catch {
    console.log(`  ${table.padEnd(16)} - does not exist`);
  }
}
const depois = await rest("profiles?select=id,is_superadmin");
console.log(`  contas           ${depois.length} (${depois.filter((p) => p.is_superadmin).length} superadmin)`);
