"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, FileText, Link2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { updateScheduleAction } from "@/app/(app)/escalas/actions";
import { SubmitButton } from "@/components/molecules/submit-button";
import type { ScheduleViewProps } from "@/components/organisms/schedules/schedule-detail";
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
import type { ActionResult } from "@/lib/action-result";
import { copyToClipboard, shareOrCopy, whatsAppUrl } from "@/lib/client-utils";
import { formatFullDate } from "@/lib/date";
import {
  buildInviteMessage,
  buildNovenaText,
  buildPublishedMessage,
  buildScheduleCsv,
  buildScheduleText,
} from "@/lib/schedule/format";

export function ShareTab({ detail, fillUrl, viewUrl }: ScheduleViewProps) {
  const events = detail.days.flatMap((d) => d.events);
  const novenaEvents = events.filter((e) => e.kind === "novena");
  const published = detail.schedule.status === "published";

  const deadlineLabel = detail.schedule.availability_deadline
    ? formatFullDate(detail.schedule.availability_deadline, detail.timezone)
    : null;

  const inviteMessage = buildInviteMessage({
    schedule: detail.schedule,
    url: fillUrl,
    deadlineLabel,
    hasNovena: novenaEvents.length > 0,
  });
  const publishedMessage = buildPublishedMessage({
    schedule: detail.schedule,
    url: viewUrl,
  });
  const scheduleText = buildScheduleText(detail);
  const novenaText = novenaEvents.length
    ? buildNovenaText({
        title: novenaEvents[0].label?.replace(/^\d+º dia da /, "") ?? "Novena",
        events: novenaEvents,
        timezone: detail.timezone,
      })
    : null;

  function downloadCsv() {
    const csv = buildScheduleCsv(detail);
    // BOM para o Excel abrir os acentos certo.
    const blob = new Blob([`﻿${csv}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `escala-${detail.schedule.month.slice(0, 7)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <LinkCard
        title="Link de preenchimento"
        description="É o que vai no grupo para o pessoal marcar disponibilidade."
        url={fillUrl}
        message={inviteMessage}
      />

      {published ? (
        <LinkCard
          title="Link da escala publicada"
          description="Somente leitura. Quem abrir vê onde cada um serve."
          url={viewUrl}
          message={publishedMessage}
        />
      ) : null}

      <SettingsCard detail={detail} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Exportar
          </CardTitle>
          <CardDescription>
            Para colar no grupo ou abrir na planilha de sempre.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const r = await shareOrCopy("Escala", scheduleText);
              if (r === "copied") toast.success("Escala copiada");
            }}
          >
            <Copy className="h-4 w-4" />
            Escala em texto
          </Button>
          {novenaText ? (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const r = await shareOrCopy("Novena", novenaText);
                if (r === "copied") toast.success("Novena copiada");
              }}
            >
              <Copy className="h-4 w-4" />
              Novena em texto
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={downloadCsv}>
            <Download className="h-4 w-4" />
            CSV
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prévia da escala</CardTitle>
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
            aria-label="Copiar link"
            onClick={() => {
              void copyToClipboard(url);
              toast.success("Link copiado");
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
              Mandar no WhatsApp
            </a>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const r = await shareOrCopy(title, message);
              if (r === "copied") toast.success("Mensagem copiada");
            }}
          >
            <Copy className="h-4 w-4" />
            Copiar mensagem
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
  const [state, action] = useActionState<ActionResult | null, FormData>(
    updateScheduleAction,
    null,
  );

  React.useEffect(() => {
    if (state?.ok) {
      toast.success("Escala atualizada");
      router.refresh();
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state, router]);

  const deadlineValue = detail.schedule.availability_deadline
    ? isoToDateInput(detail.schedule.availability_deadline, detail.timezone)
    : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ajustes</CardTitle>
        <CardDescription>
          O recado aparece no topo do formulário, antes das datas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={detail.schedule.id} />
          <div className="space-y-2">
            <Label htmlFor="sch-title">Título</Label>
            <Input
              id="sch-title"
              name="title"
              defaultValue={detail.schedule.title}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sch-deadline-edit">Prazo</Label>
            <Input
              id="sch-deadline-edit"
              name="deadline"
              type="date"
              defaultValue={deadlineValue}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sch-note">Recado no formulário</Label>
            <textarea
              id="sch-note"
              name="introNote"
              rows={3}
              defaultValue={detail.schedule.intro_note ?? ""}
              className="w-full rounded-md border border-input bg-transparent p-3 text-sm"
              placeholder="Coloquem todas as disponibilidades para facilitar a organização."
            />
          </div>
          <SubmitButton>Salvar</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}

/** timestamptz → "2026-10-23" no fuso do grupo, para o input type=date. */
function isoToDateInput(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
  return parts;
}
