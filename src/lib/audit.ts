import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Registro de quem fez o quê.
 *
 * Existe porque o formulário é aberto: sem login, a única forma de saber quem
 * apagou a disponibilidade de alguém é ter gravado. O IP nunca é guardado em
 * claro — só o hash, que serve para "foi o mesmo aparelho" sem virar um dado
 * pessoal armazenado.
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
    // Auditoria nunca derruba a ação do usuário.
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
    const salt = process.env.AUDIT_IP_SALT ?? "escala";
    return createHash("sha256").update(`${salt}:${raw}`).digest("hex").slice(0, 32);
  } catch {
    return null;
  }
}
