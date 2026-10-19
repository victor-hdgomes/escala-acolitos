import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

// Next 16: `proxy.ts` no lugar do antigo `middleware.ts`.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
