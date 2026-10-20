"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarCheck2,
  Copy,
  Loader2,
  MessageCircle,
  Repeat2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  cancelSwapAction,
  requestSwapAction,
} from "@/app/(app)/escalas/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { appUrlClient, copyToClipboard, whatsAppUrl } from "@/lib/client-utils";
import { cn } from "@/lib/utils";

export interface MyMassRow {
  assignmentId: string;
  eventId: string;
  viewToken: string;
  whenLabel: string;
  timeLabel: string;
  relativeLabel: string;
  locationName: string;
  locationColor: string;
  label: string | null;
  position: number;
  swapOpen: boolean;
  swapId: string | null;
  swapToken: string | null;
}

export function MyMassesList({ masses }: { masses: MyMassRow[] }) {
  const [target, setTarget] = React.useState<MyMassRow | null>(null);

  if (masses.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <CalendarCheck2 className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhuma missa publicada pela frente. Quando a escala do próximo mês
            sair, ela aparece aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {masses.map((m) => (
        <MassRow key={m.assignmentId} mass={m} onSwap={() => setTarget(m)} />
      ))}
      <SwapDialog target={target} onClose={() => setTarget(null)} />
    </div>
  );
}

function MassRow({ mass, onSwap }: { mass: MyMassRow; onSwap: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        mass.swapOpen
          ? "border-[color:var(--color-pending)]/50 bg-[color:var(--color-pending)]/5"
          : "border-border",
      )}
    >
      <div className="mb-1 flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: mass.locationColor }}
          aria-hidden
        />
        <span className="text-sm font-medium tabular-nums">
          {mass.timeLabel}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">
          {mass.locationName}
        </span>
        <Badge variant="secondary">{mass.relativeLabel}</Badge>
      </div>

      <p className="truncate text-xs text-muted-foreground">
        {mass.whenLabel}
        {mass.label ? ` · ${mass.label}` : ""}
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        {mass.swapOpen && mass.swapToken ? (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void copyToClipboard(appUrlClient(`/t/${mass.swapToken}`));
                toast.success("Link copiado");
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar link do pedido
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await cancelSwapAction(mass.swapId!);
                  if (!res.ok) toast.error(res.error);
                  else {
                    toast.success("Pedido cancelado");
                    router.refresh();
                  }
                })
              }
            >
              <X className="h-3.5 w-3.5" />
              Cancelar pedido
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={onSwap}>
            <Repeat2 className="h-3.5 w-3.5" />
            Não vou conseguir
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * O diálogo fica montado e só alterna `open`. Remontá-lo ao abrir fazia ele
 * fechar sozinho: o `pointerup` do clique que o abriu chega depois da
 * montagem e o Radix o lê como clique fora. A key vai no corpo, que é quem
 * precisa nascer limpo a cada pedido.
 */
function SwapDialog({
  target,
  onClose,
}: {
  target: MyMassRow | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {target ? (
          <SwapDialogBody key={target.assignmentId} target={target} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SwapDialogBody({ target }: { target: MyMassRow }) {
  const router = useRouter();
  const [reason, setReason] = React.useState("");
  const [url, setUrl] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const message = [
    "🔄 *Preciso de substituição*",
    "",
    `${target.whenLabel} às ${target.timeLabel}`,
    target.locationName,
    reason ? `Motivo: ${reason}` : "",
    "",
    "Quem puder assumir, é só abrir e confirmar:",
    url ?? "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <>
      <DialogHeader>
        <DialogTitle>Pedir substituição</DialogTitle>
        <DialogDescription>
          {`${target.whenLabel} às ${target.timeLabel}`}
        </DialogDescription>
      </DialogHeader>

      {url ? (
        <div className="space-y-3">
          <p className="text-sm">
            Pedido aberto. Quem clicar primeiro assume a vaga.
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
          <Button
            className="w-full"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await requestSwapAction({
                  assignmentId: target.assignmentId,
                  reason: reason.trim() || undefined,
                });
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                setUrl(res.data!.url);
                router.refresh();
              })
            }
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Abrir pedido
          </Button>
          <p className="text-xs text-muted-foreground">
            Quem marcou disponibilidade para esse horário recebe um aviso.
          </p>
        </div>
      )}
    </>
  );
}
