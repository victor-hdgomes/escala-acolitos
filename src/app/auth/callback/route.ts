import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { safeInternalPath } from "@/lib/safe-path";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for Supabase authentication links.
 *
 * Two shapes arrive here, and the app needs both:
 *   • `?code=…`               PKCE flow, used when signing in from the app
 *   • `?token_hash=…&type=…`  email links (signup confirmation, password
 *     reset, magic link). Without handling this one, the link Supabase mails
 *     out lands on "invalid link".
 */
const EMAIL_OTP_TYPES: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];



export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeInternalPath(searchParams.get("next"));
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
      // A password reset goes straight to the screen that changes it.
      return NextResponse.redirect(
        `${origin}${type === "recovery" ? "/reset-password" : next}`,
      );
    }
  }

  return NextResponse.redirect(`${origin}/login?error=link`);
}
