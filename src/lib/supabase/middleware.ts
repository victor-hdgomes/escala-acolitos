import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/lib/db/types";
import { supabasePublicKey, supabaseUrl } from "@/lib/supabase/env";

/**
 * Routes that need no session. The first three are the heart of the app: an
 * altar server never needs an account.
 *   /e/<token>  availability form
 *   /v/<token>  published schedule (read-only)
 *   /t/<token>  swap request
 *   /j/<token>  join link, opened by someone who has no account yet
 *   /invite/<token>  named invitation, same
 *
 * The last two are the way in. Sending them to /login first hides the group
 * they were invited to behind a form that does not explain itself, which is
 * exactly the moment a volunteer gives up.
 */
const PUBLIC_PREFIXES = [
  "/e/",
  "/v/",
  "/t/",
  "/j/",
  "/invite/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
];

/**
 * Files the browser fetches on its own, with no cookies: the icons the
 * manifest points at and the service worker. The matcher in proxy.ts already
 * excludes them; this is the belt to that pair of braces, because getting it
 * wrong silently removes the install offer rather than breaking a page.
 */
const PUBLIC_FILES = new Set(["/sw.js", "/icon", "/apple-icon"]);

function isPublic(pathname: string) {
  return (
    pathname === "/" ||
    PUBLIC_FILES.has(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
  );
}

/**
 * With no `sb-*` cookie there is no session to validate: calling getUser()
 * would be a round-trip to the Auth API on every request. Since the expected
 * traffic is mostly anonymous (the whole group opening the link), that matters.
 */
function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
}

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  if (!hasAuthCookie(request)) {
    if (isPublic(pathname)) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient<Database>(
    supabaseUrl(),
    supabasePublicKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (
    user &&
    (pathname.startsWith("/login") || pathname.startsWith("/signup"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
