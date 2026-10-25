/**
 * Keeps the message catalogs honest.
 *
 * English is the source language, so every other locale must answer it key for
 * key. A missing key means a volunteer reads a raw identifier in the middle of
 * a sentence; an extra key means dead weight nobody will ever delete on
 * purpose. Both are cheap to catch here and expensive to catch in a sacristy.
 *
 *   node scripts/check-messages.mjs
 *
 * Exits non-zero on any difference, so it can gate a build.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIR = path.join(ROOT, "src", "messages");
const SOURCE = "en";

/**
 * Names that carry the same value in different casings. The caller hands all
 * of them to every locale at once, so a translation is free to pick whichever
 * its grammar wants: English keeps "November" capitalised mid-sentence and
 * Portuguese does not. Treating them as one name here is what lets the check
 * stay strict everywhere else.
 */
const INTERCHANGEABLE = [["month", "monthLower", "monthUpper"]];

const CANONICAL = new Map(
  INTERCHANGEABLE.flatMap((group) => group.map((name) => [name, group[0]])),
);

function flatten(value, prefix = "") {
  const keys = [];
  for (const [key, entry] of Object.entries(value)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      keys.push(...flatten(entry, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

/**
 * Index of the `}` that closes the `{` at `open`, counting nesting.
 * Returns -1 when the braces do not balance.
 */
function matchingBrace(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}" && (depth -= 1) === 0) return i;
  }
  return -1;
}

/**
 * The arguments an ICU message takes, e.g. {count} from
 * "{count, plural, one {# date} other {# dates}}".
 *
 * A regex cannot do this: in that example a naive scan also reads "date" and
 * "dates" as arguments, so two correct translations look like a mismatch. The
 * sub-messages of a plural or select are messages in their own right, so they
 * are parsed as such, which both skips their prose and still catches an
 * argument genuinely nested inside one.
 */
function placeholders(value, out = new Set()) {
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== "{") continue;
    const end = matchingBrace(text, i);
    if (end === -1) break;
    readArgument(text.slice(i + 1, end), out);
    i = end;
  }
  return out;
}

function readArgument(body, out) {
  const firstComma = body.indexOf(",");
  const name = (firstComma === -1 ? body : body.slice(0, firstComma)).trim();
  if (!name) return;
  out.add(CANONICAL.get(name) ?? name);
  if (firstComma === -1) return;

  const rest = body.slice(firstComma + 1);
  const secondComma = rest.indexOf(",");
  if (secondComma === -1) return; // {n, number} and friends: no sub-messages.

  const type = rest.slice(0, secondComma).trim();
  if (type !== "plural" && type !== "select" && type !== "selectordinal") {
    return;
  }

  // Everything after the type is a run of `selector {sub-message}` pairs.
  const options = rest.slice(secondComma + 1);
  for (let i = 0; i < options.length; i += 1) {
    if (options[i] !== "{") continue;
    const end = matchingBrace(options, i);
    if (end === -1) break;
    placeholders(options.slice(i + 1, end), out);
    i = end;
  }
}

function read(locale) {
  return JSON.parse(fs.readFileSync(path.join(DIR, `${locale}.json`), "utf8"));
}

function valueAt(object, dottedKey) {
  return dottedKey.split(".").reduce((node, part) => node?.[part], object);
}

const locales = fs
  .readdirSync(DIR)
  .filter((file) => file.endsWith(".json"))
  .map((file) => file.replace(/\.json$/, ""));

const source = read(SOURCE);
const sourceKeys = flatten(source);

let problems = 0;

for (const locale of locales) {
  if (locale === SOURCE) continue;

  const target = read(locale);
  const targetKeys = new Set(flatten(target));

  const missing = sourceKeys.filter((key) => !targetKeys.has(key));
  const extra = [...targetKeys].filter((key) => !sourceKeys.includes(key));

  const mismatched = sourceKeys
    .filter((key) => targetKeys.has(key))
    .filter((key) => {
      const from = placeholders(valueAt(source, key));
      const to = placeholders(valueAt(target, key));
      return from.size !== to.size || [...from].some((p) => !to.has(p));
    });

  if (!missing.length && !extra.length && !mismatched.length) {
    console.log(`${locale.padEnd(8)} ok, ${sourceKeys.length} keys`);
    continue;
  }

  problems += missing.length + extra.length + mismatched.length;
  console.log(`\n${locale}`);
  for (const key of missing) console.log(`  missing      ${key}`);
  for (const key of extra) console.log(`  not in ${SOURCE}   ${key}`);
  for (const key of mismatched) {
    const from = [...placeholders(valueAt(source, key))].sort().join(", ");
    const to = [...placeholders(valueAt(target, key))].sort().join(", ");
    console.log(`  placeholders ${key}: ${SOURCE} has {${from}}, ${locale} has {${to}}`);
  }
}

if (problems) {
  console.log(`\n${problems} problem(s).`);
  process.exit(1);
}
