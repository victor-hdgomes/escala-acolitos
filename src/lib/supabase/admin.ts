import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/types";
import { supabaseUrl } from "@/lib/supabase/env";

/**
 * Service-role client - bypasses RLS.
 *
 * It exists for one reason: access through a public link (availability form,
 * published schedule, swap request) is anonymous, and RLS has no way to
 * validate a URL token. Every call made with this client MUST have validated
 * the token first, on the server. Never import this into a client component.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");

  return createSupabaseClient<Database>(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
