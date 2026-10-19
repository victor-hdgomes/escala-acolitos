import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/types";
import { supabaseUrl } from "@/lib/supabase/env";

/**
 * Cliente com service role — ignora RLS.
 *
 * Existe por um motivo só: o acesso por link público (formulário, escala
 * publicada, substituição) é anônimo, e RLS não sabe validar um token de URL.
 * Toda chamada feita com este cliente DEVE ter validado o token antes, no
 * servidor. Nunca importar isso em componente de client.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");

  return createSupabaseClient<Database>(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
