"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Send, Share2 } from "lucide-react";
import { toast } from "sonner";

import {
  publishScheduleAction,
  setScheduleStatusAction,
} from "@/app/(app)/schedules/actions";
import { AssemblyTab } from "@/components/organisms/schedules/assembly-tab";
import { EventsTab } from "@/components/organisms/schedules/events-tab";
import { ResponsesTab } from "@/components/organisms/schedules/responses-tab";
import { ShareTab } from "@/components/organisms/schedules/share-tab";
import { ScheduleStatusBadge } from "@/components/organisms/schedules/status-badge";
import { TimeZoneProvider } from "@/components/providers/timezone-provider";
import { Button } from "@/components/ui/button";
import {
  ScrollTabsList,
  ScrollTabsTrigger,
} from "@/components/molecules/scroll-tabs";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useResultError } from "@/hooks/use-error-message";
import { EVENTS, track } from "@/lib/analytics";
import type { LocationLite, PersonLite, ScheduleDetail } from "@/lib/schedule/types";
import type { PersonStats } from "@/lib/schedule/suggest";

export interface ScheduleViewProps {
  detail: ScheduleDetail;
  monthTitle: string;
  people: PersonLite[];
  locations: LocationLite[];
  stats: Record<string, PersonStats>;
  locationCounts: Record<string, Record<string, number>>;
  /** Day (in the parish's zone) → people already assigned in other schedules. */
  busyByDay: Record<string, string[]>;
  fillUrl: string;
  viewUrl: string;
  /** The group has a weekly pattern, so an empty schedule has a way back. */
  hasTemplates: boolean;
}

export function ScheduleDetailView(props: ScheduleViewProps) {
  const { detail, monthTitle } = props;
  const router = useRouter();
  const t = useTranslations("schedules");
  const resultError = useResultError();
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
      const message = resultError(res);
      if (message) {
        toast.error(message);
        return;
      }
      const notified = res.ok ? (res.data?.notified ?? 0) : 0;
      track(EVENTS.schedulePublished, { notified });
      toast.success(t("detail.published", { count: notified }));
      router.refresh();
    });

  const setStatus = (status: Parameters<typeof setScheduleStatusAction>[1]) =>
    startTransition(async () => {
      const res = await setScheduleStatusAction(detail.schedule.id, status);
      const message = resultError(res);
      if (message) toast.error(message);
      else router.refresh();
    });

  return (
    // Every tab below renders dates in the parish's clock; the provider binds
    // that zone once instead of threading it through four tab components.
    <TimeZoneProvider timeZone={detail.timezone}>
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
                {t("detail.slotsFilled", {
                  filled: filledSlots,
                  total: totalSlots,
                })}{" "}
                · {t("celebrationCount", { count: events.length })}
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
                  {t("detail.closeResponses")}
                </Button>
              ) : null}
              {detail.schedule.status === "building" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setStatus("collecting")}
                >
                  {t("detail.reopenResponses")}
                </Button>
              ) : null}
              {detail.schedule.status !== "published" ? (
                <Button size="sm" disabled={pending} onClick={publish}>
                  <Send className="h-4 w-4" />
                  {t("detail.publish")}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setStatus("building")}
                >
                  {t("detail.unpublish")}
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
            <ScrollTabsTrigger value="assembly">
              {t("detail.tabAssembly")}
            </ScrollTabsTrigger>
            <ScrollTabsTrigger value="responses">
              {t("detail.tabResponses")}
            </ScrollTabsTrigger>
            <ScrollTabsTrigger value="events">
              {t("detail.tabEvents")}
            </ScrollTabsTrigger>
            <ScrollTabsTrigger value="share">
              <Share2 className="h-3.5 w-3.5" />
              {t("detail.tabShare")}
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
    </TimeZoneProvider>
  );
}
