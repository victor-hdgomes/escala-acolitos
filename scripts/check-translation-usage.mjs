/**
 * Checks that every message key the code asks for actually exists.
 *
 *   node scripts/check-translation-usage.mjs
 *
 * `check-messages.mjs` keeps the two catalogs in step with each other, which
 * is a different question: a key missing from BOTH locales passes it happily
 * and then throws in the reader's face, because next-intl treats an unknown
 * key as an error rather than falling back to the key name.
 *
 * That is the failure this catches, and it is the one a type checker cannot:
 * the namespace and the key are strings, resolved at run time, on a screen
 * that may only be reached by a coordinator in a parish nobody is watching.
 *
 * Keys built from a template literal cannot be resolved by reading the file,
 * so they are counted and listed rather than silently treated as fine.
 *
 * One deliberate imprecision: a file often holds several components, each
 * binding its own `t` to a different namespace. Matching a call back to the
 * component it sits in would mean parsing the file properly, so instead a key
 * counts as found when it resolves under ANY namespace that name is bound to
 * in that file. The only error that slips through is a key that exists in the
 * wrong one of two namespaces bound to the same variable, which is both rare
 * and harmless next to the error this exists to catch.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE = path.join(ROOT, "src");
const CATALOG = JSON.parse(
  fs.readFileSync(path.join(SOURCE, "messages", "en.json"), "utf8"),
);

/** `const t = useTranslations("group.members")` and the server equivalent. */
const BINDING =
  /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*["'`]([^"'`]+)["'`]\s*\)/g;

/** `getTranslations({ locale, namespace: "emails" })`, used by the cron. */
const BINDING_OBJECT =
  /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?getTranslations\(\s*\{[^}]*namespace:\s*["'`]([^"'`]+)["'`]/g;

function exists(dotted) {
  return (
    dotted
      .split(".")
      .reduce((node, part) => (node == null ? undefined : node[part]), CATALOG) !==
    undefined
  );
}

function* sourceFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "messages") continue;
      yield* sourceFiles(full);
      continue;
    }
    if (/\.tsx?$/.test(entry.name)) yield full;
  }
}

const missing = [];
const dynamic = [];
let checked = 0;

for (const file of sourceFiles(SOURCE)) {
  const text = fs.readFileSync(file, "utf8");
  const relative = path.relative(ROOT, file);

  const namespaces = new Map();
  for (const pattern of [BINDING, BINDING_OBJECT]) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const bound = namespaces.get(match[1]) ?? new Set();
      bound.add(match[2]);
      namespaces.set(match[1], bound);
    }
  }
  if (!namespaces.size) continue;

  for (const [variable, bound] of namespaces) {
    // `t("a.b")` and `t.rich("a.b")`, with or without values after it.
    const calls = new RegExp(
      `\\b${variable}(?:\\.rich|\\.markup)?\\(\\s*(["'\`])([^"'\`$]*?)\\1`,
      "g",
    );
    for (const call of text.matchAll(calls)) {
      const key = call[2];
      checked += 1;
      const candidates = [...bound].map((ns) => `${ns}.${key}`);
      if (!candidates.some(exists)) {
        const line = text.slice(0, call.index).split("\n").length;
        missing.push(`${relative}:${line}  ${candidates.join(" or ")}`);
      }
    }

    // Anything interpolated is beyond a reader of the file.
    const templated = new RegExp(`\\b${variable}(?:\\.rich)?\\(\\s*\`[^\`]*\\$\\{`, "g");
    for (const call of text.matchAll(templated)) {
      const line = text.slice(0, call.index).split("\n").length;
      dynamic.push(
        `${relative}:${line}  ${[...bound].join("|")}.<built at run time>`,
      );
    }
  }
}

console.log(`checked ${checked} literal key(s) against en.json`);

if (dynamic.length) {
  console.log(`\n${dynamic.length} key(s) built from a template, not checked:`);
  for (const entry of dynamic) console.log(`  ${entry}`);
}

if (missing.length) {
  console.log(`\n${missing.length} key(s) the code asks for and the catalog does not have:`);
  for (const entry of missing) console.log(`  ${entry}`);
  process.exit(1);
}

console.log("every literal key resolves");
