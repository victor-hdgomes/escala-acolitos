import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import type { ScheduleStatus } from "@/lib/db/types";

const CLASS: Record<ScheduleStatus, string> = {
  draft: "",
  collecting:
    "bg-[color:var(--color-pending)]/15 text-[color:var(--color-pending)]",
  building: "bg-[color:var(--color-novena)]/15 text-[color:var(--color-novena)]",
  published:
    "bg-[color:var(--color-filled)]/15 text-[color:var(--color-filled)]",
  archived: "",
};

/**
 * No "use client" on purpose: the schedule list renders on the server and the
 * detail header renders on the client, and both want the same badge.
 */
export function ScheduleStatusBadge({ status }: { status: ScheduleStatus }) {
  const t = useTranslations("schedules.status");

  return (
    <Badge variant="secondary" className={CLASS[status]}>
      {t(status)}
    </Badge>
  );
}
