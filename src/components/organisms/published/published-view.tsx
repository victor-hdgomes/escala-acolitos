"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Church,
  Copy,
  Loader2,
  MessageCircle,
  Repeat2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { requestSwapPublicAction } from "@/app/v/[token]/actions";
import {
  PersonPicker,
  type PickablePerson,
} from "@/components/organisms/fill/person-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { copyToClipboard, whatsAppUrl } from "@/lib/client-utils";
import { cn } from "@/lib/utils";

export interface PublishedSlot {
  position: number;
  assignmentId: string | null;
  personId: string | null;
  name: string | null;
  claimed: boolean;
  swapOpen: boolean;
  swapToken: string | null;
}

export interface PublishedEvent {
  id: string;
  timeLabel: string;
  locationName: string;
  locationColor: string;
  label: string | null;
  isPast: boolean;
  slots: PublishedSlot[];
}

interface PublishedDay {
  key: string;
  title: string;
  weekdayLabel: string;
  events: PublishedEvent[];
}

const STORAGE_PREFIX = "escala:pessoa-vista:";

export function PublishedView({
  token,
  parishName,
  title,
  monthTitle,
  days,
  people,
  todayKey,
}: {
  token: string;
  parishName: string;
  title: string;
  monthTitle: string;
  days: PublishedDay[];
  people: PickablePerson[];
  todayKey: string;
}) {
  const [person, setPerson] = React.useState<PickablePerson | null>(
    () => people.find((p) => p.isMe) ?? null,
  );
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [onlyMine, setOnlyMine] = React.useState(false);
  const [swapTarget, setSwapTarget] = React.useState<{
    event: PublishedEvent;
    slot: PublishedSlot;
  } | null>(null);

  // Lê o localStorage só depois de montar: no servidor ele não existe, e um
  // valor lido direto na renderização quebraria a hidratação.
  React.useEffect(() => {
    if (person) return;
    try {
      const stored = localStorage.getItem(STORAGE_PREFIX + token);
      const found = stored ? people.find((p) => p.id === stored) : null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- storage é sistema externo
      if (found) setPerson(found);
    } catch {
      // storage bloqueado — segue sem lembrar
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!person) return;
    try {
      localStorage.setItem(STORAGE_PREFIX + token, person.id);
    } catch {
      // ignora
    }
  }, [person, token]);

  const visibleDays = React.useMemo(() => {
    if (!onlyMine || !person) return days;
    return days
      .map((d) => ({
        ...d,
        events: d.events.filter((e) =>
          e.slots.some((s) => s.personId === person.id),
        ),
      }))
      .filter((d) => d.events.length);
  }, [days, onlyMine, person]);

  const myCount = person
    ? days
        .flatMap((d) => d.events)
        .filter((e) => e.slots.some((s) => s.personId === person.id)).length
    : 0;

  return (
    <div className="min-h-screen pb-10">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <div className="flex items-center gap-2">
            <Church className="h-4 w-4 shrink-0 text-primary" />
            <p className="min-w-0 truncate text-xs text-muted-foreground">
              {parishName}
            </p>
          </div>
          <h1 className="truncate text-lg font-semibold tracking-tight">
            {title}
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setPickerOpen(true)}
          >
            <UserRound className="h-4 w-4" />
            {person ? person.name : "Marcar meu nome"}
          </Button>
          {person ? (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={onlyMine} onCheckedChange={setOnlyMine} />
              Só as minhas ({myCount})
            </label>
          ) : null}
        </div>

        {visibleDays.map((day) => (
          <section key={day.key}>
            <div className="mb-2 flex items-baseline gap-2">
              <h2 className="text-sm font-semibold">{day.title}</h2>
              <span className="text-xs text-muted-foreground">
                {day.weekdayLabel}
              </span>
              {day.key === todayKey ? (
                <Badge variant="secondary">hoje</Badge>
              ) : null}
            </div>

            <div className="space-y-2">
              {day.events.map((event) => {
                const names = event.slots.filter((s) => s.name);
                const isMine =
                  !!person && event.slots.some((s) => s.personId === person.id);

                return (
                  <div
                    key={event.id}
                    className={cn(
                      "rounded-lg border p-3",
                      isMine
                        ? "border-[color:var(--color-filled)] bg-[color:var(--color-filled)]/5"
                        : "border-border",
                      event.isPast && "opacity-60",
                    )}
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: event.locationColor }}
                        aria-hidden
                      />
                      <span className="text-sm font-medium tabular-nums">
                        {event.timeLabel}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {event.locationName}
                      </span>
                      {isMine ? <Badge variant="secondary">você</Badge> : null}
                    </div>

                    {event.label ? (
                      <p className="mb-1.5 truncate text-xs text-muted-foreground">
                        {event.label}
                      </p>
                    ) : null}

                    {names.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Sem acólitos escalados
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {names.map((slot) => {
                          const mine = person && slot.personId === person.id;
                          return (
                            <li
                              key={slot.position}
                              className="flex items-center gap-2 text-sm"
                            >
                              <span className="w-4 shrink-0 text-xs text-muted-foreground tabular-nums">
                                {slot.position}
                              </span>
                              <span
                                className={cn(
                                  "min-w-0 flex-1 truncate",
                                  slot.swapOpen && "line-through opacity-60",
                                )}
                              >
                                {slot.name}
                              </span>
                              {slot.swapOpen && slot.swapToken ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 gap-1 text-[color:var(--color-pending)]"
                                  asChild
                                >
                                  <a href={`/t/${slot.swapToken}`}>
                                    <Repeat2 className="h-3.5 w-3.5" />
                                    precisa de troca
                                  </a>
                                </Button>
                              ) : mine && !event.isPast ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 gap-1"
                                  onClick={() => setSwapTarget({ event, slot })}
                                >
                                  <Repeat2 className="h-3.5 w-3.5" />
                                  não vou conseguir
                                </Button>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {visibleDays.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {onlyMine
              ? "Você não está escalado neste mês."
              : "Escala sem celebrações."}
          </p>
        ) : null}
      </div>

      <PersonPicker
        people={people}
        value={person}
        onChange={setPerson}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
      />

      {/* Remonta por pedido: motivo e link nascem limpos. */}
      <SwapDialog
        key={swapTarget?.slot.assignmentId ?? "none"}
        token={token}
        target={swapTarget}
        monthTitle={monthTitle}
        onClose={() => setSwapTarget(null)}
      />
    </div>
  );
}

/**
 * O diálogo fica montado e só alterna `open`. Remontá-lo ao abrir fazia ele
 * fechar sozinho: o `pointerup` do clique que o abriu chega depois da
 * montagem e o Radix o lê como clique fora. A key vai no corpo.
 */
function SwapDialog({
  token,
  target,
  monthTitle,
  onClose,
}: {
  token: string;
  target: { event: PublishedEvent; slot: PublishedSlot } | null;
  monthTitle: string;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {target ? (
          <SwapDialogBody
            key={target.slot.assignmentId ?? "none"}
            token={token}
            target={target}
            monthTitle={monthTitle}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SwapDialogBody({
  token,
  target,
  monthTitle,
}: {
  token: string;
  target: { event: PublishedEvent; slot: PublishedSlot };
  monthTitle: string;
}) {
  const router = useRouter();
  const [reason, setReason] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [url, setUrl] = React.useState<string | null>(null);

  const message = [
    "🔄 *Preciso de substituição*",
    "",
    `${target.event.timeLabel} · ${target.event.locationName} (${monthTitle})`,
    reason ? `Motivo: ${reason}` : "",
    "",
    "Quem puder assumir, é só abrir e confirmar:",
    url ?? "",
  ]
    .filter(Boolean)
    .join("\n");

  const submit = () => {
    if (!target.slot.assignmentId) return;
    startTransition(async () => {
      const res = await requestSwapPublicAction({
        token,
        assignmentId: target.slot.assignmentId!,
        reason: reason.trim() || undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setUrl(res.data!.url);
      router.refresh();
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Pedir substituição</DialogTitle>
        <DialogDescription>
          {`${target.event.timeLabel} · ${target.event.locationName}`}
        </DialogDescription>
      </DialogHeader>

      {url ? (
        <div className="space-y-3">
          <p className="text-sm">
            Pedido aberto. Mande o link no grupo — quem clicar primeiro assume a
            vaga.
          </p>
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
          <Button asChild className="w-full">
            <a
              href={whatsAppUrl(message)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="h-4 w-4" />
              Mandar no WhatsApp
            </a>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={280}
            placeholder="Motivo (opcional)"
            className="w-full rounded-md border border-input bg-transparent p-3 text-sm"
          />
          <Button className="w-full" disabled={pending} onClick={submit}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Abrir pedido
          </Button>
          <p className="text-xs text-muted-foreground">
            Quem marcou disponibilidade para esse horário recebe um aviso por
            e-mail.
          </p>
        </div>
      )}
    </>
  );
}
