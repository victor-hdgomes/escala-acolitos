/**
 * Chaves do Supabase.
 *
 * O painel passou a entregar uma "publishable key" (`sb_publishable_…`) no
 * lugar da antiga `anon key` (um JWT). As duas servem para o mesmo papel —
 * credencial pública do browser, com RLS fazendo o isolamento — e projetos
 * criados em épocas diferentes têm uma ou outra. Ler as duas evita que o app
 * quebre dependendo de quando o projeto foi criado.
 */

export function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL ausente");
  return url;
}

export function supabasePublicKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "Defina NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (ou a antiga NEXT_PUBLIC_SUPABASE_ANON_KEY)",
    );
  }
  return key;
}
