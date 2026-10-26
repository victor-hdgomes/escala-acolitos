import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { safeInternalPath } from "@/lib/safe-path";
import { SignInForm } from "@/components/organisms/auth/auth-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("signIn.title") };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  return <SignInForm redirectTo={safeInternalPath(redirect)} />;
}
