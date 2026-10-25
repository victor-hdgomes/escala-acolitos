/**
 * Applies the schema to Supabase and prepares the first sign-in.
 *
 * Connects straight to Postgres, because DDL does not go through the REST
 * API. The connection string comes from SUPABASE_DB_URL in .env.local
 * (Dashboard, Connect, Connection string, URI) and is never printed.
 *
 *   node scripts/db.mjs migrate            applies supabase/migrations/*.sql
 *   node scripts/db.mjs seed               applies supabase/seed.sql
 *   node scripts/db.mjs setup              migrate + seed
 *   node scripts/db.mjs grant <email>      group admin plus superadmin
 *   node scripts/db.mjs status             what the database already has
 */

import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

const ROOT = path.resolve(import.meta.dirname, "..");

function loadEnv() {
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 1) continue;
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function connect() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error(
      [
        "SUPABASE_DB_URL is missing from .env.local.",
        "",
        "In the Supabase dashboard: Connect, Connection string, URI.",
        "Paste the whole line (it already carries the database password):",
        "",
        "  SUPABASE_DB_URL=postgresql://postgres.xxxx:PASSWORD@aws-...pooler.supabase.com:5432/postgres",
      ].join("\n"),
    );
    process.exit(1);
  }
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

async function runFile(client, file) {
  const sql = fs.readFileSync(file, "utf8");
  process.stdout.write(`→ ${path.relative(ROOT, file)} ... `);
  await client.query(sql);
  console.log("ok");
}

async function migrate(client) {
  const dir = path.join(ROOT, "supabase", "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) await runFile(client, path.join(dir, f));
}

async function seed(client) {
  await runFile(client, path.join(ROOT, "supabase", "seed.sql"));
}

/**
 * Puts the account in the group and marks it superadmin. Without this a
 * brand-new account belongs to no group and the app sends it to the waiting
 * screen.
 */
async function grant(client, email) {
  const { rows: users } = await client.query(
    "select id from auth.users where lower(email) = lower($1)",
    [email],
  );
  if (!users.length) {
    console.error(`No account with the address ${email}. Sign up at /signup first.`);
    process.exit(1);
  }
  const userId = users[0].id;

  const { rows: parishes } = await client.query(
    "select id, name from public.parishes order by created_at limit 1",
  );
  if (!parishes.length) {
    console.error("No group in the database. Run `node scripts/db.mjs seed`, or open one in the app.");
    process.exit(1);
  }

  await client.query(
    `insert into public.memberships (parish_id, user_id, role)
     values ($1, $2, 'admin')
     on conflict (parish_id, user_id) do update set role = 'admin'`,
    [parishes[0].id, userId],
  );
  await client.query(
    "update public.profiles set is_superadmin = true where id = $1",
    [userId],
  );
  console.log(`✓ ${email} now administers "${parishes[0].name}" and is the superadmin.`);
}

async function status(client) {
  const tables = [
    "parishes",
    "profiles",
    "memberships",
    "people",
    "locations",
    "mass_templates",
    "schedules",
    "events",
    "availabilities",
    "assignments",
  ];
  for (const t of tables) {
    try {
      const { rows } = await client.query(`select count(*)::int as n from public.${t}`);
      console.log(`${t.padEnd(16)} ${rows[0].n}`);
    } catch {
      console.log(`${t.padEnd(16)} - does not exist`);
    }
  }
}

loadEnv();

const [command, arg] = process.argv.slice(2);
const client = await connect();
try {
  if (command === "migrate") await migrate(client);
  else if (command === "seed") await seed(client);
  else if (command === "setup") {
    await migrate(client);
    await seed(client);
  } else if (command === "grant") {
    if (!arg) throw new Error("Give the address: node scripts/db.mjs grant you@example.com");
    await grant(client, arg);
  } else if (command === "status") await status(client);
  else {
    console.log("Comandos: migrate | seed | setup | grant <email> | status");
    process.exitCode = 1;
  }
} catch (error) {
  console.error("\nFalhou:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
