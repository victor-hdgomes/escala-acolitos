"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MapPin } from "lucide-react";
import { toast } from "sonner";

import { saveLocationAction } from "@/app/(app)/group/actions";
import { SubmitButton } from "@/components/molecules/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormAction } from "@/hooks/use-form-action";

/**
 * One field, one button: the name of a church, and it exists.
 *
 * The full place editor asks for a short name, a colour and a sort order, all
 * of which matter on the twelfth chapel and none of which matter on the
 * first. A coordinator who has just opened a group and is being told that a
 * schedule needs somewhere to celebrate should not have to leave the screen,
 * find a tab, fill in five fields and come back to where they were.
 *
 * The rest stays editable in Group, Places, where it belongs.
 */
export function QuickPlaceForm({
  onCreated,
  sortOrder = 0,
}: {
  /** Called after the place exists, for a screen that wants to move on. */
  onCreated?: () => void;
  sortOrder?: number;
}) {
  const router = useRouter();
  const t = useTranslations("onboarding.quickPlace");

  const { onSubmit, pending } = useFormAction(saveLocationAction, {
    onSuccess: () => {
      toast.success(t("created"));
      router.refresh();
      onCreated?.();
    },
  });

  return (
    <form onSubmit={onSubmit} className="w-full space-y-2 text-left">
      <input type="hidden" name="sortOrder" value={sortOrder} />
      <Label htmlFor="quick-place" className="flex items-center gap-2 text-sm">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        {t("label")}
      </Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="quick-place"
          name="name"
          required
          minLength={2}
          autoComplete="off"
          placeholder={t("placeholder")}
        />
        <SubmitButton pending={pending} className="sm:w-auto">
          {t("submit")}
        </SubmitButton>
      </div>
      <p className="text-xs text-muted-foreground">{t("hint")}</p>
    </form>
  );
}
