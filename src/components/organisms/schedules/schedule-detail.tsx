"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Send, Share2 } from "lucide-react";
import { toast } from "sonner";

import {
  publishScheduleAction,
  setScheduleStatusAction,
} from "@/app/(app)/escalas/actions";
import { AssemblyTab } from "@/components/organisms/schedules/assembly-tab";
import { EventsTab } from "@/components/organisms/schedules/events-tab";
import { ResponsesTab } from "@/components/organisms/schedules/responses-tab";
import { ShareTab } from "@/components/organisms/schedules/share-tab";
import { ScheduleStatusBadge } from "@/components/organisms/schedules/status-badge";
import { Button } from "@/components/ui/button";
import {
  ScrollTabsList,
  ScrollTabsTrigger,
} from "@/components/molecules/scroll-tabs";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import type { LocationLite, PersonLite, ScheduleDetail } from "@/lib/schedule/types";
import type { PersonStats } from "@/lib/schedule/suggest";

export interface ScheduleViewProps {
  detail: ScheduleDetail;
  monthTitle: string;
  people: PersonLite[];
  locations: LocationLite[];
  stats: Record<string, PersonStats>;
  locationCounts: Record<string, Record<string, number>>;
  /** dia (no fuso do grupo) → pessoas já escaladas em outras escalas. */
  busyByDay: Record<string, string[]>;
  fillUrl: string;
  viewUrl: string;
}

export function ScheduleDetailView(props: ScheduleViewProps) {
  const { detail, monthTitle } = props;
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const events = detail.days.flatMap((d) => d.events);
  const totalSlots = events.reduce((sum, e) => sum + e.slots, 0);
  const filledSlots = events.reduce(
    (sum, e) => sum + e.slotsView.filter((s) => s.person).length,
    0,
  );

  const publish = () =>
    startTransition(async () => {
      const res = await publishScheduleAction(detail.schedule.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.data?.notified
          ? `Escala publicada. ${res.data.notified} avisados por e-mail.`
          : "Escala publicada.",
      );
      router.refresh();
    });

  const setStatus = (status: Parameters<typeof setScheduleStatusAction>[1]) =>
    startTransition(async () => {
      const res = await setScheduleStatusAction(detail.schedule.id, status);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight">
              {detail.schedule.kind === "monthly"
                ? monthTitle
                : detail.schedule.title}
              <ScheduleStatusBadge status={detail.schedule.status} />
            </h1>
            <p className="text-sm text-muted-foreground">
              {detail.schedule.kind !== "monthly" ? `${monthTitle} · ` : ""}
              {filledSlots} de {totalSlots} vagas preenchidas ·{" "}
              {events.length} {events.length === 1 ? "celebração" : "celebrações"}
            </p>
          </div>

          <div className="flex gap-2">
            {detail.schedule.status === "collecting" ? (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => setStatus("building")}
              >
                Fechar respostas
              </Button>
            ) : null}
            {detail.schedule.status === "building" ? (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => setStatus("collecting")}
              >
                Reabrir respostas
              </Button>
            ) : null}
            {detail.schedule.status !== "published" ? (
              <Button size="sm" disabled={pending} onClick={publish}>
                <Send className="h-4 w-4" />
                Publicar
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => setStatus("building")}
              >
                Despublicar
              </Button>
            )}
          </div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-[color:var(--color-filled)] transition-[width]"
            style={{
              width: `${totalSlots ? (filledSlots / totalSlots) * 100 : 0}%`,
            }}
          />
        </div>
      </header>

      <Tabs defaultValue="assembly">
        <ScrollTabsList>
          <ScrollTabsTrigger value="assembly">Montagem</ScrollTabsTrigger>
          <ScrollTabsTrigger value="responses">Respostas</ScrollTabsTrigger>
          <ScrollTabsTrigger value="events">Celebrações</ScrollTabsTrigger>
          <ScrollTabsTrigger value="share">
            <Share2 className="h-3.5 w-3.5" />
            Compartilhar
          </ScrollTabsTrigger>
        </ScrollTabsList>

        <TabsContent value="assembly" className="mt-4">
          <AssemblyTab {...props} />
        </TabsContent>
        <TabsContent value="responses" className="mt-4">
          <ResponsesTab {...props} />
        </TabsContent>
        <TabsContent value="events" className="mt-4">
          <EventsTab {...props} />
        </TabsContent>
        <TabsContent value="share" className="mt-4">
          <ShareTab {...props} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
