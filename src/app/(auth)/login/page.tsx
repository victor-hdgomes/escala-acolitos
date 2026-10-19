import type { Metadata } from "next";

import { SignInForm } from "@/components/organisms/auth/auth-forms";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  const target = redirect?.startsWith("/") ? redirect : "/inicio";
  return <SignInForm redirectTo={target} />;
}
