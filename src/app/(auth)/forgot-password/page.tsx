import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ForgotPasswordForm } from "@/components/organisms/auth/auth-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("forgotPassword.title") };
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
