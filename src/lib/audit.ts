import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A record of who did what.
 *
 * It exists because the form is open: with no sign-in, the only way to know who
 * deleted someone else's availability is to have written it down. The IP is
 * never stored in the clear - only the hash, which answers "same device?"
 * without becoming a stored personal detail.
 */
export async function logAudit({
  parishId,
  actorUserId,
  actorLabel,
  action,
  entity,
  entityId,
  payload,
}: {
  parishId: string | null;
  actorUserId?: string | null;
  actorLabel?: string | null;
  action: string;
  entity?: string;
  entityId?: string | null;
  payload?: Record<string, unknown>;
}) {
  try {
    const admin = createAdminClient();
    await admin.from("audit_log").insert({
      parish_id: parishId,
      actor_user_id: actorUserId ?? null,
      actor_label: actorLabel ?? null,
      action,
      entity: entity ?? null,
      entity_id: entityId ?? null,
      payload: payload ?? null,
      ip_hash: await hashedIp(),
    });
  } catch {
    // Auditing never brings down the user's action.
  }
}

async function hashedIp(): Promise<string | null> {
  try {
    const h = await headers();
    const raw =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      null;
    if (!raw) return null;
    const salt = process.env.AUDIT_IP_SALT ?? "audit";
    return createHash("sha256").update(`${salt}:${raw}`).digest("hex").slice(0, 32);
  } catch {
    return null;
  }
}
