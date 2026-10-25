import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PeoplePanel } from "@/components/organisms/people/people-panel";
import { requireManager } from "@/lib/auth";
import type { Person } from "@/lib/db/types";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("people");
  return { title: t("metaTitle") };
}

export default async function PeoplePage() {
  const ctx = await requireManager();
  const admin = createAdminClient();

  const { data: people } = await admin
    .from("people")
    .select("*")
    .eq("parish_id", ctx.parish.id)
    .order("full_name", { ascending: true });

  const rows = (people ?? []) as Person[];
  const userIds = rows.filter((p) => p.claimed_by).map((p) => p.claimed_by!);
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("id, email").in("id", userIds)
    : { data: [] };
  const emailByUser = new Map((profiles ?? []).map((p) => [p.id, p.email]));

  return (
    <PeoplePanel
      isAdmin={ctx.role === "admin"}
      currentPersonId={ctx.person?.id ?? null}
      people={rows.map((p) => ({
        id: p.id,
        full_name: p.full_name,
        short_name: p.short_name,
        email: p.email,
        phone: p.phone,
        active: p.active,
        claimed: !!p.claimed_by,
        claimedEmail: p.claimed_by ? (emailByUser.get(p.claimed_by) ?? null) : null,
      }))}
    />
  );
}
