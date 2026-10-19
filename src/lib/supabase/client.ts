import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/db/types";
import { supabasePublicKey, supabaseUrl } from "@/lib/supabase/env";

export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabasePublicKey());
}
