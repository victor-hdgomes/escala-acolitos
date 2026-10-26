import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

// Next 16: `proxy.ts` replaces the old `middleware.ts`.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // `icon`, `apple-icon` and `sw.js` are fetched by the browser itself,
    // with no cookies attached. Sending them to /login costs the install
    // offer outright: a manifest whose icons redirect is not installable,
    // and a service worker that never loads is not a service worker.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon|apple-icon|sw\\.js|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
