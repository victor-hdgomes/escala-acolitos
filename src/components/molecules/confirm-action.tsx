"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

/**
 * Asks before doing something that cannot be undone.
 *
 * Every delete in this app used to happen on the first click: a member, a
 * place, a Mass in the weekly pattern, an invitation, a celebration. On a
 * phone, where a thumb lands near a bin icon by accident, that is a bad bet,
 * and most of those rows are not recoverable from the interface afterwards.
 *
 * The trigger stays whatever the caller already had, so adding the question
 * never changes how a row looks.
 */
export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel,
  tone = "danger",
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  /** "danger" paints the confirm button; "neutral" leaves it as a primary. */
  tone?: "danger" | "neutral";
  onConfirm: () => void | Promise<void>;
}) {
  const common = useTranslations("common");
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="tap-target">
            {common("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            className={cn(
              "tap-target",
              tone === "danger" &&
                "bg-[color:var(--color-open)] text-white hover:bg-[color:var(--color-open)]/90",
            )}
            onClick={(event) => {
              // The dialog closes itself on click, which would unmount the
              // transition before the action resolves. It closes when the
              // work is done instead.
              event.preventDefault();
              startTransition(async () => {
                await onConfirm();
                setOpen(false);
              });
            }}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {confirmLabel ?? common("delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
