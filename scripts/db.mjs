/**
 * Aplica o schema no Supabase e prepara o primeiro acesso.
 *
 * Usa conexão direta ao Postgres porque DDL não passa pela API REST. A string
 * vem de SUPABASE_DB_URL no .env.local (Dashboard → Connect → Connection
 * string → URI) e nunca é impressa.
 *
 *   node scripts/db.mjs migrate            aplica supabase/migrations/*.sql
 *   node scripts/db.mjs seed               aplica supabase/seed.sql
 *   node scripts/db.mjs setup              migrate + seed
 *   node scripts/db.mjs grant <email>      vira admin do grupo + superadmin
 *   node scripts/db.mjs status             o que já existe no banco
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
        "Falta SUPABASE_DB_URL no .env.local.",
        "",
        "No painel do Supabase: Connect → Connection string → URI.",
        "Cole a linha inteira (ela já inclui a senha do banco):",
        "",
        "  SUPABASE_DB_URL=postgresql://postgres.xxxx:SENHA@aws-...pooler.supabase.com:5432/postgres",
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
 * Liga a conta ao grupo e marca superadmin. Sem isso o usuário recém-criado
 * não pertence a grupo nenhum e o app o manda criar um.
 */
async function grant(client, email) {
  const { rows: users } = await client.query(
    "select id from auth.users where lower(email) = lower($1)",
    [email],
  );
  if (!users.length) {
    console.error(`Nenhuma conta com o e-mail ${email}. Cadastre-se em /signup primeiro.`);
    process.exit(1);
  }
  const userId = users[0].id;

  const { rows: parishes } = await client.query(
    "select id, name from public.parishes order by created_at limit 1",
  );
  if (!parishes.length) {
    console.error("Nenhum grupo no banco. Rode `node scripts/db.mjs seed` ou crie um pelo app.");
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
  console.log(`✓ ${email} é admin de "${parishes[0].name}" e superadmin.`);
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
      console.log(`${t.padEnd(16)} — não existe`);
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
    if (!arg) throw new Error("Informe o e-mail: node scripts/db.mjs grant voce@exemplo.com");
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
