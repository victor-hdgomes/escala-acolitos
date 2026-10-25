"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import {
  forgotPasswordAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
} from "@/app/(auth)/actions";
import { PasswordInput } from "@/components/molecules/password-input";
import { SubmitButton } from "@/components/molecules/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import type { ActionResult } from "@/lib/action-result";

type AuthAction = (
  prev: ActionResult | null,
  formData: FormData,
) => Promise<ActionResult>;

/**
 * Runs an auth form and keeps the failure inside the card.
 *
 * Everywhere else a failed save is a toast, but here the reader is staring at
 * the very field that was rejected, and a message that slides away takes the
 * reason with it. `useFormAction` still does the translating - only the
 * rendering is ours.
 */
function useAuthForm(action: AuthAction, onSuccess?: () => void) {
  const [error, setError] = React.useState<string | null>(null);
  const { onSubmit, pending } = useFormAction(action, {
    onSuccess,
    onError: setError,
  });

  return { onSubmit, pending, error };
}

/** The shell every auth screen shares: heading, the form, and a way out below it. */
function AuthCard({
  title,
  description,
  footer,
  children,
}: {
  title: string;
  description?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        {children}
        {footer ? (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {footer}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Alert variant="destructive">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

/** Labelled control, optionally with a shortcut aligned to the label's right. */
function Field({
  id,
  label,
  action,
  children,
}: {
  id: string;
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      {action ? (
        <div className="flex items-center justify-between">
          <Label htmlFor={id}>{label}</Label>
          {action}
        </div>
      ) : (
        <Label htmlFor={id}>{label}</Label>
      )}
      {children}
    </div>
  );
}

function EmailField({ placeholder }: { placeholder?: string }) {
  const t = useTranslations("auth");
  return (
    <Field id="email" label={t("fields.email")}>
      <Input
        id="email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder={placeholder}
        required
      />
    </Field>
  );
}

/** `id` doubles as the submitted field name, so "password" and "confirm" differ by it alone. */
function PasswordField({
  id = "password",
  label,
  autoComplete,
  action,
}: {
  id?: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  action?: React.ReactNode;
}) {
  return (
    <Field id={id} label={label} action={action}>
      <PasswordInput id={id} name={id} autoComplete={autoComplete} required />
    </Field>
  );
}

function FooterLink({
  prompt,
  label,
  href,
}: {
  prompt?: string;
  label: string;
  href: string;
}) {
  return (
    <>
      {prompt ? `${prompt} ` : null}
      <Link href={href} className="underline underline-offset-4">
        {label}
      </Link>
    </>
  );
}

export function SignInForm({ redirectTo }: { redirectTo: string }) {
  const t = useTranslations("auth");
  const { onSubmit, pending, error } = useAuthForm(signInAction);

  return (
    <AuthCard
      title={t("signIn.title")}
      description={t("signIn.description")}
      footer={
        <FooterLink
          prompt={t("signIn.footer.prompt")}
          label={t("signIn.footer.link")}
          href="/signup"
        />
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <input type="hidden" name="redirect" value={redirectTo} />
        <FormError message={error} />
        <EmailField placeholder={t("fields.emailPlaceholder")} />
        <PasswordField
          label={t("fields.password")}
          autoComplete="current-password"
          action={
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              {t("signIn.forgotPassword")}
            </Link>
          }
        />
        <SubmitButton className="w-full" pending={pending}>
          {t("signIn.submit")}
        </SubmitButton>
      </form>
    </AuthCard>
  );
}

export function SignUpForm({
  invite,
  join,
}: {
  invite?: string;
  join?: string;
}) {
  const t = useTranslations("auth");
  const { onSubmit, pending, error } = useAuthForm(signUpAction);

  return (
    <AuthCard
      title={t("signUp.title")}
      description={t("signUp.description")}
      footer={
        <FooterLink
          prompt={t("signUp.footer.prompt")}
          label={t("signUp.footer.link")}
          href="/login"
        />
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {invite ? <input type="hidden" name="invite" value={invite} /> : null}
        {join ? <input type="hidden" name="join" value={join} /> : null}
        <FormError message={error} />
        <Field id="displayName" label={t("fields.name")}>
          <Input
            id="displayName"
            name="displayName"
            autoComplete="name"
            placeholder={t("fields.namePlaceholder")}
            required
          />
        </Field>
        <EmailField />
        <PasswordField
          label={t("fields.password")}
          autoComplete="new-password"
        />
        <SubmitButton className="w-full" pending={pending}>
          {t("signUp.submit")}
        </SubmitButton>
      </form>
    </AuthCard>
  );
}

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const [sent, setSent] = React.useState(false);
  const onSuccess = React.useCallback(() => setSent(true), []);
  const { onSubmit, pending, error } = useAuthForm(
    forgotPasswordAction,
    onSuccess,
  );

  return (
    <AuthCard
      title={t("forgotPassword.title")}
      description={t("forgotPassword.description")}
      footer={<FooterLink label={tCommon("back")} href="/login" />}
    >
      {sent ? (
        <Alert>
          <AlertDescription>{t("forgotPassword.sent")}</AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <FormError message={error} />
          <EmailField />
          <SubmitButton className="w-full" pending={pending}>
            {t("forgotPassword.submit")}
          </SubmitButton>
        </form>
      )}
    </AuthCard>
  );
}

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const { onSubmit, pending, error } = useAuthForm(resetPasswordAction);

  return (
    <AuthCard title={t("resetPassword.title")}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={error} />
        <PasswordField
          label={t("fields.password")}
          autoComplete="new-password"
        />
        <PasswordField
          id="confirm"
          label={t("fields.passwordConfirm")}
          autoComplete="new-password"
        />
        <SubmitButton className="w-full" pending={pending}>
          {tCommon("save")}
        </SubmitButton>
      </form>
    </AuthCard>
  );
}
