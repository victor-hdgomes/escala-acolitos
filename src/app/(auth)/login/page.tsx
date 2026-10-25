import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

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
  const target = redirect?.startsWith("/") ? redirect : "/home";
  return <SignInForm redirectTo={target} />;
}
