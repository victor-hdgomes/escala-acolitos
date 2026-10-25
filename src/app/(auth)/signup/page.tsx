import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SignUpForm } from "@/components/organisms/auth/auth-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("signUp.title") };
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; join?: string }>;
}) {
  const { invite, join } = await searchParams;
  return <SignUpForm invite={invite} join={join} />;
}
