"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Copy, Download, FileText, Link2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { updateScheduleAction } from "@/app/(app)/schedules/actions";
import { SubmitButton } from "@/components/molecules/submit-button";
import type { ScheduleViewProps } from "@/components/organisms/schedules/schedule-detail";
import { useDateFormatter } from "@/components/providers/timezone-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormAction } from "@/hooks/use-form-action";
import { copyToClipboard, shareOrCopy, whatsAppUrl } from "@/lib/client-utils";
import { dayKey } from "@/lib/date";
import { novenaTitleOf } from "@/lib/schedule/generate";
import {
  buildInviteMessage,
  buildNovenaText,
  buildPublishedMessage,
  buildScheduleCsv,
  buildScheduleText,
} from "@/lib/schedule/format";

export function ShareTab({ detail, fillUrl, viewUrl }: ScheduleViewProps) {
  const t = useTranslations("schedules");
  // Everything pasted into the group chat is written from its own namespace.
  const tw = useTranslations("whatsapp");
  const df = useDateFormatter();

  const events = detail.days.flatMap((d) => d.events);
  const novenaEvents = events.filter((e) => e.kind === "novena");
  const published = detail.schedule.status === "published";

  const deadlineLabel = detail.schedule.availability_deadline
    ? df.fullDate(detail.schedule.availability_deadline)
    : null;

  const inviteMessage = buildInviteMessage({
    t: tw,
    df,
    schedule: detail.schedule,
    url: fillUrl,
    deadlineLabel,
    hasNovena: novenaEvents.length > 0,
  });
  const publishedMessage = buildPublishedMessage({
    t: tw,
    df,
    schedule: detail.schedule,
    url: viewUrl,
  });
  const scheduleText = buildScheduleText({ t: tw, df, detail });
  // The novena's name is recovered from the first day's stored label, which
  // the generator wrote as "<day> - <name>". Only that module knows the
  // label's grammar, so the split lives there.
  const novenaText = novenaEvents.length
    ? buildNovenaText({
        t: tw,
        df,
        title:
          (novenaEvents[0].label ? novenaTitleOf(novenaEvents[0].label) : null) ??
          t("novena.fallbackTitle"),
        events: novenaEvents,
      })
    : null;

  function downloadCsv() {
    const csv = buildScheduleCsv({ t: tw, df, detail });
    // BOM so Excel opens the accented characters correctly.
    const blob = new Blob([`﻿${csv}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = t("share.csvFileName", {
      month: detail.schedule.month.slice(0, 7),
    });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <LinkCard
        title={t("share.fillLinkTitle")}
        description={
          // In a direct-signup novena nobody marks availability: the altar
          // server takes the slot themselves.
          events.every((e) => e.signup_mode === "direct")
            ? t("share.fillLinkDescriptionDirect")
            : t("share.fillLinkDescription")
        }
        url={fillUrl}
        message={inviteMessage}
      />

      {published ? (
        <LinkCard
          title={t("share.viewLinkTitle")}
          description={t("share.viewLinkDescription")}
          url={viewUrl}
          message={publishedMessage}
        />
      ) : null}

      <SettingsCard detail={detail} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            {t("share.exportTitle")}
          </CardTitle>
          <CardDescription>{t("share.exportDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const r = await shareOrCopy(
                t("share.scheduleShareTitle"),
                scheduleText,
              );
              if (r === "copied") toast.success(t("share.scheduleCopied"));
            }}
          >
            <Copy className="h-4 w-4" />
            {t("share.scheduleAsText")}
          </Button>
          {novenaText ? (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const r = await shareOrCopy(
                  t("share.novenaShareTitle"),
                  novenaText,
                );
                if (r === "copied") toast.success(t("share.novenaCopied"));
              }}
            >
              <Copy className="h-4 w-4" />
              {t("share.novenaAsText")}
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={downloadCsv}>
            <Download className="h-4 w-4" />
            {t("share.csv")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("share.previewTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-80 overflow-auto rounded-md bg-muted/40 p-3 text-xs whitespace-pre-wrap">
            {scheduleText}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

function LinkCard({
  title,
  description,
  url,
  message,
}: {
  title: string;
  description: string;
  url: string;
  message: string;
}) {
  const t = useTranslations("schedules");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2">
          <code className="min-w-0 flex-1 truncate text-xs">{url}</code>
          <Button
            size="icon"
            variant="ghost"
            aria-label={t("share.copyLink")}
            onClick={() => {
              void copyToClipboard(url);
              toast.success(t("linkCopied"));
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" asChild>
            <a
              href={whatsAppUrl(message)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="h-4 w-4" />
              {t("share.sendOnWhatsApp")}
            </a>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const r = await shareOrCopy(title, message);
              if (r === "copied") toast.success(t("messageCopied"));
            }}
          >
            <Copy className="h-4 w-4" />
            {t("share.copyMessage")}
          </Button>
        </div>

        <pre className="rounded-md bg-muted/40 p-3 text-xs whitespace-pre-wrap">
          {message}
        </pre>
      </CardContent>
    </Card>
  );
}

function SettingsCard({ detail }: { detail: ScheduleViewProps["detail"] }) {
  const router = useRouter();
  const t = useTranslations("schedules");
  const { onSubmit, pending } = useFormAction(updateScheduleAction, {
    onSuccess: () => {
      toast.success(t("share.scheduleUpdated"));
      router.refresh();
    },
  });

  // `<input type="date">` wants the civil day in the parish's zone, never the
  // reader's - which is exactly what `dayKey` returns.
  const deadlineValue = detail.schedule.availability_deadline
    ? dayKey(detail.schedule.availability_deadline, detail.timezone)
    : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("share.settingsTitle")}</CardTitle>
        <CardDescription>{t("share.settingsDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="id" value={detail.schedule.id} />
          <div className="space-y-2">
            <Label htmlFor="sch-title">{t("fields.title")}</Label>
            <Input
              id="sch-title"
              name="title"
              defaultValue={detail.schedule.title}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sch-deadline-edit">{t("fields.deadline")}</Label>
            <Input
              id="sch-deadline-edit"
              name="deadline"
              type="date"
              defaultValue={deadlineValue}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sch-note">{t("share.noteLabel")}</Label>
            <textarea
              id="sch-note"
              name="introNote"
              rows={3}
              defaultValue={detail.schedule.intro_note ?? ""}
              className="w-full rounded-md border border-input bg-transparent p-3 text-sm"
              placeholder={t("share.notePlaceholder")}
            />
          </div>
          <SubmitButton pending={pending}>{t("save")}</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
