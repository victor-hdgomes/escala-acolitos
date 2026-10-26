"use server";

import { getTranslations } from "next-intl/server";
import { z } from "zod";

import {
  ERROR_CODES,
  fail,
  ok,
  zodErrorCode,
  type ActionResult,
} from "@/lib/action-result";
import { requireSession } from "@/lib/auth";
import type { FeedbackStatus } from "@/lib/db/types";
import { sendMail } from "@/lib/mail/send";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const feedbackSchema = z.object({
  kind: z.enum(["idea", "problem", "question", "other"]),
  message: z
    .string()
    .trim()
    .min(5, ERROR_CODES.FEEDBACK_TOO_SHORT)
    .max(2000, ERROR_CODES.FEEDBACK_TOO_LONG),
  page: z.string().trim().max(200).optional(),
  contactEmail: z.string().trim().max(200).optional(),
});

/**
 * What a coordinator wants to say back.
 *
 * Written with the caller's own session rather than the service role, so the
 * row can only ever carry their own id: the policy in 0007 checks
 * `user_id = auth.uid()`, which is what stops this from becoming a way to
 * post as somebody else.
 */
export async function sendFeedbackAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireSession();

  const parsed = feedbackSchema.safeParse({
    kind: formData.get("kind") || "idea",
    message: formData.get("message"),
    page: formData.get("page") || undefined,
    contactEmail: formData.get("contactEmail") || undefined,
  });
  if (!parsed.success) return fail(zodErrorCode(parsed.error.issues[0].message));

  const supabase = await createClient();
  const { error } = await supabase.from("feedback").insert({
    parish_id: ctx.parish.id,
    user_id: ctx.userId,
    kind: parsed.data.kind,
    message: parsed.data.message,
    page: parsed.data.page ?? null,
    contact_email: parsed.data.contactEmail || null,
  });
  if (error) return fail(ERROR_CODES.FEEDBACK_SEND_FAILED);

  // Best effort. The message is already saved and visible in the owner's
  // screen, so a mail server having a bad day must not turn into an error
  // for somebody who just took the trouble to write.
  await notifyOwner({
    parishName: ctx.parish.name,
    from: ctx.displayName,
    kind: parsed.data.kind,
    message: parsed.data.message,
    page: parsed.data.page ?? null,
    contactEmail: parsed.data.contactEmail || ctx.email,
  });

  return ok();
}

async function notifyOwner(input: {
  parishName: string;
  from: string;
  kind: string;
  message: string;
  page: string | null;
  contactEmail: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  const { data: owner } = await admin
    .from("profiles")
    .select("email")
    .eq("is_superadmin", true)
    .maybeSingle();
  if (!owner?.email) return;

  const t = await getTranslations("feedback.email");
  const lines = [
    `<p><strong>${escapeHtml(input.from)}</strong> (${escapeHtml(input.parishName)})</p>`,
    `<p style="white-space:pre-wrap">${escapeHtml(input.message)}</p>`,
    input.page ? `<p style="color:#737373;font-size:13px">${escapeHtml(input.page)}</p>` : "",
    input.contactEmail
      ? `<p style="font-size:13px">${escapeHtml(input.contactEmail)}</p>`
      : "",
  ].join("");

  await sendMail({
    to: owner.email,
    subject: t("subject", { kind: input.kind, parish: input.parishName }),
    html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">${lines}</div>`,
    // One mail per message: the key is the text itself, so a double submit
    // from a slow connection does not arrive twice.
    dedupeKey: `feedback:${hash(input.message)}`,
    kind: "feedback",
    parishId: null,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Enough to tell two messages apart in a dedupe key, and nothing more. */
function hash(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (Math.imul(31, h) + value.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/** Marks a message read or done. The owner of the installation only. */
export async function setFeedbackStatusAction(
  id: string,
  status: FeedbackStatus,
): Promise<ActionResult> {
  const ctx = await requireSession();
  if (!ctx.isSuperadmin) return fail(ERROR_CODES.NOT_SUPERADMIN);

  const supabase = await createClient();
  const { error } = await supabase
    .from("feedback")
    .update({ status })
    .eq("id", id);
  if (error) return fail(ERROR_CODES.FEEDBACK_SEND_FAILED);
  return ok();
}
