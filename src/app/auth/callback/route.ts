import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/**
 * Volta dos links de autenticação do Supabase.
 *
 * Dois formatos chegam aqui, e o app precisa dos dois:
 *   • `?code=…`        fluxo PKCE, usado no login pelo próprio app
 *   • `?token_hash=…&type=…`  links de e-mail (confirmação de cadastro,
 *     redefinição de senha, magic link). Sem tratar este, o link que o
 *     Supabase manda por e-mail cai em "link inválido".
 */
const EMAIL_OTP_TYPES: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

function safeNext(value: string | null): string {
  // Só caminho interno: um `next` manipulado não pode levar para fora do app.
  return value && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/inicio";
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const supabase = await createClient();

  const code = searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  if (tokenHash && type && EMAIL_OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      // Redefinição de senha cai direto na tela de trocar a senha.
      return NextResponse.redirect(
        `${origin}${type === "recovery" ? "/reset-password" : next}`,
      );
    }
  }

  return NextResponse.redirect(`${origin}/login?erro=link`);
}
