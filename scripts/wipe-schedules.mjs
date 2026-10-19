/**
 * Apaga tudo que é escala e preserva a configuração do grupo.
 *
 *   node scripts/wipe-schedules.mjs            mostra o que seria apagado
 *   node scripts/wipe-schedules.mjs --confirm  apaga de verdade
 *
 * Sai: schedules, events, availabilities, assignments, swap_requests
 *      (os três últimos caem por cascade ao remover a escala).
 * Fica: parishes, locations, mass_templates, people, memberships, profiles.
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
console.log(`  escalas          ${schedules.length}`);
console.log(`  celebrações      ${events.length}`);
console.log(`  disponibilidades ${availabilities.length}`);
console.log(`  escalações       ${assignments.length}`);

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
console.log(`  missas na grade  ${templates.length}`);
console.log(`  acólitos         ${people.length}`);
console.log(`  membros          ${memberships.length} (${memberships.map((m) => m.role).join(", ")})`);

if (!confirm) {
  console.log("\nNada foi apagado. Rode de novo com --confirm.");
  process.exit(0);
}

// swap_requests e availabilities/assignments caem por cascade; email_log e
// audit_log apontam para pessoas e grupo, então são limpos à parte.
await rest("schedules?id=not.is.null", { method: "DELETE" });
await rest("email_log?id=not.is.null", { method: "DELETE" });
await rest("audit_log?id=not.is.null", { method: "DELETE" });

const restantes = await rest("schedules?select=id");
console.log(`\n✓ Limpo. Escalas restantes: ${restantes.length}.`);
