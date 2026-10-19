/** "Paróquia Cristo Rei" → "paroquia-cristo-rei" */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Acrescenta sufixo numérico até achar um slug livre. */
export function uniqueSlug(base: string, taken: Set<string>): string {
  const root = base || "grupo";
  if (!taken.has(root)) return root;
  for (let i = 2; i < 200; i++) {
    const candidate = `${root}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}
