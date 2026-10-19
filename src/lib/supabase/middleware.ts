import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/lib/db/types";
import { supabasePublicKey, supabaseUrl } from "@/lib/supabase/env";

/**
 * Rotas que não exigem sessão. As três primeiras são o coração do app: o
 * acólito nunca precisa de conta.
 *   /e/<token>  formulário de disponibilidade
 *   /v/<token>  escala publicada (read-only)
 *   /t/<token>  pedido de substituição
 */
const PUBLIC_PREFIXES = [
  "/e/",
  "/v/",
  "/t/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
];

function isPublic(pathname: string) {
  return (
    pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
  );
}

/**
 * Sem nenhum cookie `sb-*` não existe sessão para validar: chamar getUser()
 * seria um round-trip à Auth API por request. Como o tráfego esperado é
 * majoritariamente anônimo (o grupo todo abrindo o link), isso importa.
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
    url.pathname = "/inicio";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
