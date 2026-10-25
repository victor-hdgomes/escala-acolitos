"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { updateParishAction } from "@/app/(app)/groups/actions";
import { FormSelect } from "@/components/molecules/form-select";
import { SubmitButton } from "@/components/molecules/submit-button";
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
import type { FillAccess, Parish } from "@/lib/db/types";
import { TIMEZONE_OPTIONS } from "@/lib/timezones";

export function GeneralPanel({ parish }: { parish: Parish }) {
  const router = useRouter();
  const t = useTranslations("group.general");
  const common = useTranslations("common");

  const accessOptions: { value: FillAccess; label: string }[] = [
    { value: "open", label: t("accessOpen") },
    { value: "members", label: t("accessMembers") },
  ];

  const { onSubmit, pending } = useFormAction(updateParishAction, {
    onSuccess: () => {
      toast.success(t("saved"));
      router.refresh();
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="parish-name">{t("nameLabel")}</Label>
            <Input id="parish-name" name="name" defaultValue={parish.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="parish-tz">{t("timeZoneLabel")}</Label>
            <FormSelect
              id="parish-tz"
              name="timezone"
              defaultValue={parish.timezone}
              options={TIMEZONE_OPTIONS}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="parish-access">{t("accessLabel")}</Label>
            <FormSelect
              id="parish-access"
              name="fillAccess"
              defaultValue={parish.fill_access}
              options={accessOptions}
            />
            <p className="text-xs text-muted-foreground">
              {parish.fill_access === "members"
                ? t("accessMembersHelp")
                : t("accessOpenHelp")}
            </p>
          </div>
          <div className="space-y-2">
            <Label>{t("slugLabel")}</Label>
            <Input value={parish.slug} readOnly disabled />
          </div>
          <SubmitButton pending={pending}>{common("save")}</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
