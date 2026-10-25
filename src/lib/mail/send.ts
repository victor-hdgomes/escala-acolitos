import "server-only";

import { Resend } from "resend";

import { createAdminClient } from "@/lib/supabase/admin";

// The From header is one per deployment, not per reader, so it is configured
// rather than translated.
const FROM = process.env.RESEND_FROM ?? "Altar Roster <onboarding@resend.dev>";

/**
 * Sending, with idempotence.
 *
 * `dedupeKey` is unique in `email_log`: if the reminder cron runs twice, or the
 * coordinator clicks "notify" twice, the second send is dropped before the
 * provider is called. It writes first and sends after - the other way round, a
 * failed write would mean a duplicate e-mail.
 */
export async function sendMail({
  to,
  subject,
  html,
  dedupeKey,
  kind,
  parishId,
  personId,
}: {
  to: string;
  subject: string;
  html: string;
  dedupeKey: string;
  kind: string;
  parishId: string | null;
  personId?: string | null;
}): Promise<"sent" | "duplicate" | "skipped" | "error"> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return "skipped";

  const admin = createAdminClient();
  const { error: logError } = await admin.from("email_log").insert({
    parish_id: parishId,
    kind,
    recipient: to,
    person_id: personId ?? null,
    dedupe_key: dedupeKey,
  });
  // 23505 = unique_violation: it was already sent before.
  if (logError) return logError.code === "23505" ? "duplicate" : "error";

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) {
      await admin
        .from("email_log")
        .update({ error: error.message })
        .eq("dedupe_key", dedupeKey);
      return "error";
    }
    return "sent";
  } catch (err) {
    await admin
      .from("email_log")
      .update({ error: err instanceof Error ? err.message : "unknown error" })
      .eq("dedupe_key", dedupeKey);
    return "error";
  }
}
