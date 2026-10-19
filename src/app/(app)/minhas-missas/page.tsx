import type { Metadata } from "next";

import { ClaimNameCard } from "@/components/organisms/people/claim-name-card";
import { MyMassesList } from "@/components/organisms/people/my-masses-list";
import { requireSession } from "@/lib/auth";
import {
  formatFullDate,
  formatTime,
  relativeDays,
  weekdayLong,
} from "@/lib/date";
import { loadMyMasses } from "@/lib/schedule/my-masses";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Minhas missas" };

export default async function MyMassesPage() {
  const ctx = await requireSession();

  if (!ctx.person) {
    const admin = createAdminClient();
    const { data: people } = await admin
      .from("people")
      .select("id, full_name, claimed_by")
      .eq("parish_id", ctx.parish.id)
      .eq("active", true)
      .order("full_name", { ascending: true });

    return (
      <div className="space-y-5">
        <header>
          <h1 className="text-xl font-semibold tracking-tight">Minhas missas</h1>
          <p className="text-sm text-muted-foreground">
            Vincule seu nome para ver onde você está escalado.
          </p>
        </header>
        <ClaimNameCard
          people={(people ?? []).map((p) => ({
            id: p.id,
            name: p.full_name,
            claimed: !!p.claimed_by,
          }))}
        />
      </div>
    );
  }

  const masses = await loadMyMasses(ctx.person.id, ctx.parish.id);
  const tz = ctx.parish.timezone;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Minhas missas</h1>
        <p className="text-sm text-muted-foreground">
          {ctx.person.full_name} · {masses.length}{" "}
          {masses.length === 1 ? "missa pela frente" : "missas pela frente"}
        </p>
      </header>

      <MyMassesList
        masses={masses.map((m) => ({
          ...m,
          whenLabel: `${weekdayLong(m.startsAt, tz)}, ${formatFullDate(m.startsAt, tz)}`,
          timeLabel: formatTime(m.startsAt, tz),
          relativeLabel: relativeDays(m.startsAt, tz),
        }))}
      />
    </div>
  );
}
