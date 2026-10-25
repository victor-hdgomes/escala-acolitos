import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ClaimNameCard } from "@/components/organisms/people/claim-name-card";
import { MyMassesList } from "@/components/organisms/people/my-masses-list";
import { requireSession } from "@/lib/auth";
import { loadMyMasses } from "@/lib/schedule/my-masses";
import { getDateFormatter } from "@/lib/server-date";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("myMasses");
  return { title: t("title") };
}

export default async function MyMassesPage() {
  const ctx = await requireSession();
  const t = await getTranslations("myMasses");

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
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("claimPrompt")}</p>
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

  // Dates are formatted here, on the server, so the list stays a presentation
  // component: it receives sentences, not instants, and needs no time zone of
  // its own.
  const df = await getDateFormatter(ctx.parish.timezone);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("subtitle", {
            name: ctx.person.full_name,
            count: masses.length,
          })}
        </p>
      </header>

      <MyMassesList
        masses={masses.map((m) => ({
          ...m,
          whenLabel: t("whenLabel", {
            weekday: df.weekday(m.startsAt),
            date: df.fullDate(m.startsAt),
          }),
          timeLabel: df.time(m.startsAt),
          relativeLabel: df.relativeDays(m.startsAt),
        }))}
      />
    </div>
  );
}
