"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";

import { sendFeedbackAction } from "@/app/(app)/feedback/actions";
import { FormSelect } from "@/components/molecules/form-select";
import { SubmitButton } from "@/components/molecules/submit-button";
import { Button } from "@/components/ui/button";
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
import { useFormAction } from "@/hooks/use-form-action";
import { cn } from "@/lib/utils";

const KINDS = ["idea", "problem", "question", "other"] as const;

/**
 * A way to say something back to whoever built this.
 *
 * The app reaches parishes its author will never visit, so without a box
 * inside it the only signal that a screen confuses people is somebody
 * bothering to find an e-mail address, which nobody does. The screen the
 * person was on travels with the message: "it is confusing" and "the
 * assembly screen is confusing" are different reports.
 */
export function FeedbackDialog({ className }: { className?: string }) {
  const t = useTranslations("feedback");
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  const { onSubmit, pending } = useFormAction(sendFeedbackAction, {
    onSuccess: () => {
      toast.success(t("sent"));
      setOpen(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className={cn("gap-2", className)}>
          <MessageSquarePlus className="h-4 w-4" />
          {t("action")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="page" value={pathname} />

          <div className="space-y-2">
            <Label htmlFor="fb-kind">{t("kindLabel")}</Label>
            <FormSelect
              id="fb-kind"
              name="kind"
              defaultValue="idea"
              options={KINDS.map((k) => ({ value: k, label: t(`kinds.${k}`) }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fb-message">{t("messageLabel")}</Label>
            <textarea
              id="fb-message"
              name="message"
              rows={5}
              required
              minLength={5}
              maxLength={2000}
              placeholder={t("messagePlaceholder")}
              className="w-full rounded-md border border-input bg-transparent p-3 text-base md:text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fb-email">{t("emailLabel")}</Label>
            <Input
              id="fb-email"
              name="contactEmail"
              type="email"
              placeholder={t("emailPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">{t("emailHint")}</p>
          </div>

          <SubmitButton pending={pending} className="w-full">
            {t("submit")}
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
