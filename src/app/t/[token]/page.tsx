import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { SwapView } from "@/components/organisms/swap/swap-view";
import { isPast } from "@/lib/now";
import { resolveSwapToken } from "@/lib/public-access";
import { getDateFormatter } from "@/lib/server-date";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("swap");
  return {
    title: t("title"),
    robots: { index: false, follow: false },
  };
}

export default async function SwapPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ctx = await resolveSwapToken(token);
  if (!ctx) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const t = await getTranslations("swap");
  const df = await getDateFormatter(ctx.parish.timezone);

  // Candidates first (they marked availability), then the rest of the group:
  // the slot has to be filled, no matter who turns up.
  const candidateIds = new Set(ctx.candidates.map((p) => p.id));
  const toPickable = (p: (typeof ctx.people)[number]) => ({
    id: p.id,
    name: p.full_name,
    claimed: !!p.claimed_by,
    isMe: !!user && p.claimed_by === user.id,
  });

  return (
    <SwapView
      token={token}
      parishName={ctx.parish.name}
      status={ctx.swap.status}
      reason={ctx.swap.reason}
      requesterName={ctx.requester?.full_name ?? t("unknownRequester")}
      filledByName={ctx.filledBy?.full_name ?? null}
      locationName={ctx.location.name}
      whenLabel={t("whenLabel", {
        weekday: df.weekday(ctx.event.starts_at),
        date: df.fullDate(ctx.event.starts_at),
        time: df.time(ctx.event.starts_at),
      })}
      isPast={isPast(ctx.event.starts_at)}
      candidates={ctx.candidates.map(toPickable)}
      others={ctx.people
        .filter(
          (p) => !candidateIds.has(p.id) && p.id !== ctx.swap.requested_by_person,
        )
        .map(toPickable)}
    />
  );
}
