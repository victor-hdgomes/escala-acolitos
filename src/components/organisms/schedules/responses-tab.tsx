"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Copy, Users } from "lucide-react";
import { toast } from "sonner";

import type { ScheduleViewProps } from "@/components/organisms/schedules/schedule-detail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { copyToClipboard, shareOrCopy } from "@/lib/client-utils";
import { formatShortDate, formatTime } from "@/lib/date";
import { buildReminderMessage } from "@/lib/schedule/format";

/**
 * O que o Google Forms não dá hoje: quem respondeu, quem sumiu e onde a
 * escala vai faltar gente.
 */
export function ResponsesTab({ detail, people, fillUrl }: ScheduleViewProps) {
  const events = React.useMemo(
    () => detail.days.flatMap((d) => d.events),
    [detail.days],
  );

  const countByPerson = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const ev of events) {
      for (const p of ev.availablePeople) {
        map.set(p.id, (map.get(p.id) ?? 0) + 1);
      }
    }
    return map;
  }, [events]);

  const active = people.filter((p) => p.active);
  const answered = active
    .filter((p) => (countByPerson.get(p.id) ?? 0) > 0)
    .sort(
      (a, b) =>
        (countByPerson.get(b.id) ?? 0) - (countByPerson.get(a.id) ?? 0) ||
        a.full_name.localeCompare(b.full_name, "pt-BR"),
    );
  const pending = active.filter((p) => !countByPerson.get(p.id));

  const atRisk = events.filter(
    (e) =>
      e.signup_mode === "availability" &&
      e.availablePeople.length < e.slots &&
      e.slotsView.some((s) => !s.person),
  );

  const reminder = buildReminderMessage({
    url: fillUrl,
    pendingNames: pending.map((p) => p.full_name),
    deadlineLabel: detail.schedule.availability_deadline
      ? formatShortDate(detail.schedule.availability_deadline, detail.timezone)
      : null,
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Responderam"
          value={answered.length}
          tone="filled"
          icon={CheckCircle2}
        />
        <StatTile
          label="Faltam responder"
          value={pending.length}
          tone="pending"
          icon={Users}
        />
        <StatTile
          label="Celebrações em risco"
          value={atRisk.length}
          tone="open"
          icon={AlertTriangle}
        />
      </div>

      {atRisk.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vai faltar gente</CardTitle>
            <CardDescription>
              Menos candidatos disponíveis do que vagas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {atRisk.map((ev, i) => (
              <React.Fragment key={ev.id}>
                {i > 0 ? <Separator /> : null}
                <div className="flex items-center gap-3 py-2 text-sm">
                  <span className="shrink-0 tabular-nums">
                    {formatShortDate(ev.starts_at, detail.timezone)}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatTime(ev.starts_at, detail.timezone)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {ev.location.name}
                  </span>
                  <Badge variant="secondary">
                    {ev.availablePeople.length}/{ev.slots}
                  </Badge>
                </div>
              </React.Fragment>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">
              Faltam responder ({pending.length})
            </CardTitle>
            <CardDescription>
              Cobre no grupo com a mensagem pronta.
            </CardDescription>
          </div>
          {pending.length ? (
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const result = await shareOrCopy("Lembrete da escala", reminder);
                if (result === "copied") toast.success("Mensagem copiada");
              }}
            >
              <Copy className="h-4 w-4" />
              Cobrar
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Todo mundo respondeu. 🎉
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {pending.map((p) => (
                <Badge key={p.id} variant="secondary">
                  {p.full_name}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Responderam ({answered.length})
          </CardTitle>
          <CardDescription>
            Quem deu poucas datas é quem mais limita a montagem.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {answered.map((p, i) => {
            const count = countByPerson.get(p.id) ?? 0;
            return (
              <React.Fragment key={p.id}>
                {i > 0 ? <Separator /> : null}
                <div className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {p.full_name}
                  </span>
                  <Badge
                    variant="secondary"
                    className={
                      count <= 2
                        ? "bg-[color:var(--color-pending)]/15 text-[color:var(--color-pending)]"
                        : ""
                    }
                  >
                    {count} {count === 1 ? "data" : "datas"}
                  </Badge>
                </div>
              </React.Fragment>
            );
          })}
          {answered.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Ninguém respondeu ainda.{" "}
              <button
                className="underline underline-offset-4"
                onClick={() => {
                  void copyToClipboard(fillUrl);
                  toast.success("Link copiado");
                }}
              >
                Copiar o link
              </button>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: "filled" | "pending" | "open";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const color = `text-[color:var(--color-${tone})]`;
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <Icon className={`h-5 w-5 shrink-0 ${color}`} />
        <div className="min-w-0">
          <p className={`text-xl font-semibold tabular-nums ${color}`}>{value}</p>
          {/* Sem truncate: "Celebrações em risco" não cabe numa linha em
              coluna estreita, e cortar o rótulo esconde a informação. */}
          <p className="text-xs leading-tight text-balance text-muted-foreground">
            {label}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
