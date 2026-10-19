import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SwapView } from "@/components/organisms/swap/swap-view";
import { formatFullDate, formatTime, weekdayLong } from "@/lib/date";
import { resolveSwapToken } from "@/lib/public-access";
import { isPast } from "@/lib/now";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Substituição",
  robots: { index: false, follow: false },
};

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

  const tz = ctx.parish.timezone;

  // Candidatos primeiro (marcaram disponibilidade), depois o resto do grupo:
  // a vaga precisa ser preenchida, não importa quem apareça.
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
      requesterName={ctx.requester?.full_name ?? "Um acólito"}
      filledByName={ctx.filledBy?.full_name ?? null}
      locationName={ctx.location.name}
      whenLabel={`${weekdayLong(ctx.event.starts_at, tz)}, ${formatFullDate(ctx.event.starts_at, tz)} às ${formatTime(ctx.event.starts_at, tz)}`}
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
