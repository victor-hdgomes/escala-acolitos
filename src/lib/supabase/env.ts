/**
 * Supabase keys.
 *
 * The dashboard now hands out a "publishable key" (`sb_publishable_…`) in place
 * of the old `anon key` (a JWT). The two play the same part - a public browser
 * credential, with RLS doing the isolation - and projects created at different
 * times have one or the other. Reading both keeps the app from breaking
 * depending on when its project was created.
 */

export function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing");
  return url;
}

export function supabasePublicKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or the older NEXT_PUBLIC_SUPABASE_ANON_KEY)",
    );
  }
  return key;
}
