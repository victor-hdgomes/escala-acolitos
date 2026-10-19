"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";

import {
  forgotPasswordAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
} from "@/app/(auth)/actions";
import { SubmitButton } from "@/components/molecules/submit-button";
import { PasswordInput } from "@/components/molecules/password-input";
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
import type { ActionResult } from "@/lib/action-result";

function ErrorAlert({ state }: { state: ActionResult | null }) {
  if (!state || state.ok) return null;
  return (
    <Alert variant="destructive">
      <AlertDescription>{state.error}</AlertDescription>
    </Alert>
  );
}

export function SignInForm({ redirectTo }: { redirectTo: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    signInAction,
    null,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>
          Conta só é necessária para coordenar ou vincular seu nome. Para
          preencher a escala, use o link do grupo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <input type="hidden" name="redirect" value={redirectTo} />
          <ErrorAlert state={state} />
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="voce@exemplo.com"
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Senha</Label>
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                Esqueci a senha
              </Link>
            </div>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </div>
          <SubmitButton className="w-full">Entrar</SubmitButton>
          <p className="text-center text-sm text-muted-foreground">
            Não tem conta?{" "}
            <Link href="/signup" className="underline underline-offset-4">
              Criar conta
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export function SignUpForm({ invite }: { invite?: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    signUpAction,
    null,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Criar conta</CardTitle>
        <CardDescription>
          Com conta você vincula o seu nome — e aí ninguém marca disponibilidade
          no seu lugar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {invite ? <input type="hidden" name="invite" value={invite} /> : null}
          <ErrorAlert state={state} />
          <div className="space-y-2">
            <Label htmlFor="displayName">Seu nome</Label>
            <Input
              id="displayName"
              name="displayName"
              autoComplete="name"
              placeholder="Victor Hugo"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              required
            />
          </div>
          <SubmitButton className="w-full">Criar conta</SubmitButton>
          <p className="text-center text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link href="/login" className="underline underline-offset-4">
              Entrar
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    forgotPasswordAction,
    null,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recuperar senha</CardTitle>
        <CardDescription>
          Mandamos um link para você definir uma nova senha.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state?.ok ? (
          <Alert>
            <AlertDescription>
              Se existir conta com esse e-mail, o link já está a caminho.
            </AlertDescription>
          </Alert>
        ) : (
          <form action={action} className="space-y-4">
            <ErrorAlert state={state} />
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <SubmitButton className="w-full">Enviar link</SubmitButton>
          </form>
        )}
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/login" className="underline underline-offset-4">
            Voltar
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    resetPasswordAction,
    null,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova senha</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <ErrorAlert state={state} />
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Repita a senha</Label>
            <PasswordInput
              id="confirm"
              name="confirm"
              autoComplete="new-password"
              required
            />
          </div>
          <SubmitButton className="w-full">Salvar</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
