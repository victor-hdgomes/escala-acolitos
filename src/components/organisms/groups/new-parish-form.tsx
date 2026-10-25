"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { createParishAction } from "@/app/(app)/groups/actions";
import { SubmitButton } from "@/components/molecules/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormSelect } from "@/components/molecules/form-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useResultError } from "@/hooks/use-error-message";
import type { ActionResult } from "@/lib/action-result";
import { DEFAULT_TIMEZONE, TIMEZONE_OPTIONS } from "@/lib/timezones";

/**
 * Keeps the native `action={...}` form instead of `useFormAction`: creation
 * ends in a `redirect`, which the form post follows on its own, and the one
 * failure worth showing belongs inline on this page rather than in a toast
 * that scrolls away.
 */
export function NewParishForm() {
  const t = useTranslations("newGroup.form");
  const resultError = useResultError();
  const [state, action] = useActionState<ActionResult | null, FormData>(
    createParishAction,
    null,
  );
  const error = resultError(state);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="name">{t("nameLabel")}</Label>
            <Input
              id="name"
              name="name"
              placeholder={t("namePlaceholder")}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">{t("timeZoneLabel")}</Label>
            <FormSelect
              id="timezone"
              name="timezone"
              defaultValue={DEFAULT_TIMEZONE}
              options={TIMEZONE_OPTIONS}
            />
          </div>
          <SubmitButton className="w-full">{t("submit")}</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
