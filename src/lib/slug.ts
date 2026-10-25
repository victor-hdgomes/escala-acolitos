/** "Saint Mary Parish" → "saint-mary-parish" */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    // Combining diacritical marks, left behind by the NFD decomposition above.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Appends a numeric suffix until it finds a free slug. */
export function uniqueSlug(base: string, taken: Set<string>): string {
  const root = base || "group";
  if (!taken.has(root)) return root;
  for (let i = 2; i < 200; i++) {
    const candidate = `${root}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}
