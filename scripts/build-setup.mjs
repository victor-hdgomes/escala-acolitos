/**
 * Builds `supabase/setup.sql` from the migrations.
 *
 *   node scripts/build-setup.mjs          whole schema
 *   node scripts/build-setup.mjs --seed   schema plus the demo parish
 *
 * Supabase's hosted SQL editor takes one pasted file, not a migrations
 * folder, so a single file has to exist. Generating it is the only way it
 * stays honest: the hand-maintained one had drifted three migrations behind,
 * which is the kind of thing nobody notices until a column is missing in
 * production.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const MIGRATIONS = path.join(ROOT, "supabase", "migrations");
const OUT = path.join(ROOT, "supabase", "setup.sql");

const withSeed = process.argv.includes("--seed");

const files = fs
  .readdirSync(MIGRATIONS)
  .filter((name) => name.endsWith(".sql"))
  .sort();

function banner(title) {
  const rule = "-".repeat(76);
  return `--${rule}\n-- ${title}\n--${rule}\n`;
}

const parts = [
  `--${"-".repeat(76)}
-- Altar Roster - complete setup
--
-- GENERATED FILE. Do not edit by hand: run \`npm run db:setup\` instead.
-- Source: supabase/migrations/*.sql${withSeed ? " plus supabase/seed.sql" : ""}
--
-- Paste the whole file into the Supabase SQL editor and run it once. It is
-- safe to run again: every statement is written to be idempotent.
--
-- Afterwards: create your account at /signup, then run
-- supabase/grant-admin.sql to make it the superadmin.
--${"-".repeat(76)}
`,
];

for (const name of files) {
  parts.push(banner(name));
  parts.push(fs.readFileSync(path.join(MIGRATIONS, name), "utf8").trimEnd());
  parts.push("\n\n");
}

if (withSeed) {
  parts.push(banner("seed.sql (demo data, invented)"));
  parts.push(
    fs.readFileSync(path.join(ROOT, "supabase", "seed.sql"), "utf8").trimEnd(),
  );
  parts.push("\n");
}

fs.writeFileSync(OUT, parts.join("").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n");

console.log(
  `supabase/setup.sql written from ${files.length} migration(s)${withSeed ? " and the seed" : ""}`,
);
