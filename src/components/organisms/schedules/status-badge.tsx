import { Badge } from "@/components/ui/badge";
import type { ScheduleStatus } from "@/lib/db/types";

const LABEL: Record<ScheduleStatus, string> = {
  draft: "rascunho",
  collecting: "coletando",
  building: "montando",
  published: "publicada",
  archived: "arquivada",
};

const CLASS: Record<ScheduleStatus, string> = {
  draft: "",
  collecting:
    "bg-[color:var(--color-pending)]/15 text-[color:var(--color-pending)]",
  building: "bg-[color:var(--color-novena)]/15 text-[color:var(--color-novena)]",
  published:
    "bg-[color:var(--color-filled)]/15 text-[color:var(--color-filled)]",
  archived: "",
};

export function ScheduleStatusBadge({ status }: { status: ScheduleStatus }) {
  return (
    <Badge variant="secondary" className={CLASS[status]}>
      {LABEL[status]}
    </Badge>
  );
}
