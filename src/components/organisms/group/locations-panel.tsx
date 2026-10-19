"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteLocationAction,
  saveLocationAction,
  toggleLocationAction,
} from "@/app/(app)/grupo/actions";
import { SubmitButton } from "@/components/molecules/submit-button";
import { useFormAction } from "@/hooks/use-form-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import type { Location } from "@/lib/db/types";

export function LocationsPanel({ locations }: { locations: Location[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-4 w-4" />
          Locais ({locations.length})
        </CardTitle>
        <LocationDialog nextOrder={locations.length + 1} />
      </CardHeader>
      <CardContent className="space-y-1">
        {locations.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum local ainda. Comece pela matriz.
          </p>
        ) : null}
        {locations.map((loc, i) => (
          <React.Fragment key={loc.id}>
            {i > 0 ? <Separator /> : null}
            <div className="flex items-center gap-3 py-3">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: loc.color }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{loc.name}</p>
                {loc.short_name ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {loc.short_name}
                  </p>
                ) : null}
              </div>
              {!loc.active ? <Badge variant="secondary">inativo</Badge> : null}
              <Switch
                checked={loc.active}
                disabled={pending}
                aria-label="Ativo"
                onCheckedChange={(checked) =>
                  startTransition(async () => {
                    const res = await toggleLocationAction(loc.id, checked);
                    if (!res.ok) toast.error(res.error);
                    else router.refresh();
                  })
                }
              />
              <LocationDialog location={loc} nextOrder={loc.sort_order} />
              <Button
                size="icon"
                variant="ghost"
                disabled={pending}
                aria-label={`Excluir ${loc.name}`}
                onClick={() =>
                  startTransition(async () => {
                    const res = await deleteLocationAction(loc.id);
                    if (!res.ok) toast.error(res.error);
                    else router.refresh();
                  })
                }
              >
                <Trash2 className="h-4 w-4 text-[color:var(--color-open)]" />
              </Button>
            </div>
          </React.Fragment>
        ))}
      </CardContent>
    </Card>
  );
}

function LocationDialog({
  location,
  nextOrder,
}: {
  location?: Location;
  nextOrder: number;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const { onSubmit, pending } = useFormAction(saveLocationAction, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
    onError: (message) => toast.error(message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {location ? (
          <Button size="icon" variant="ghost" aria-label={`Editar ${location.name}`}>
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="h-4 w-4" />
            Novo
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{location ? "Editar local" : "Novo local"}</DialogTitle>
          <DialogDescription>
            O nome aparece na escala; o apelido é usado onde falta espaço.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {location ? (
            <input type="hidden" name="id" value={location.id} />
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="loc-name">Nome</Label>
            <Input
              id="loc-name"
              name="name"
              defaultValue={location?.name}
              placeholder="Matriz de Cristo Rei"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="loc-short">Apelido</Label>
              <Input
                id="loc-short"
                name="shortName"
                defaultValue={location?.short_name ?? ""}
                placeholder="Matriz"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc-order">Ordem</Label>
              <Input
                id="loc-order"
                name="sortOrder"
                type="number"
                min={0}
                defaultValue={location?.sort_order ?? nextOrder}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="loc-color">Cor</Label>
            <Input
              id="loc-color"
              name="color"
              type="color"
              defaultValue={location?.color ?? "#6366f1"}
              className="h-10 w-20 p-1"
            />
          </div>
          <SubmitButton pending={pending} className="w-full">Salvar</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
