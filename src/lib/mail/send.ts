import "server-only";

import { Resend } from "resend";

import { createAdminClient } from "@/lib/supabase/admin";

const FROM = process.env.RESEND_FROM ?? "Escala <onboarding@resend.dev>";

/**
 * Envio com idempotência.
 *
 * `dedupeKey` é único em `email_log`: se o cron do lembrete rodar duas vezes,
 * ou o coordenador clicar duas vezes em "avisar", o segundo envio é descartado
 * antes de chamar o provedor. Grava primeiro, envia depois — ao contrário,
 * uma falha de gravação viraria e-mail duplicado.
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
  // 23505 = unique_violation: já foi enviado antes.
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
      .update({ error: err instanceof Error ? err.message : "erro" })
      .eq("dedupe_key", dedupeKey);
    return "error";
  }
}
