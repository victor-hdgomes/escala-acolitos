import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/organisms/auth/auth-forms";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
