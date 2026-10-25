import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ResetPasswordForm } from "@/components/organisms/auth/auth-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("resetPassword.title") };
}

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
