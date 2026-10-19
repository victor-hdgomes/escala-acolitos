import type { Metadata } from "next";

import { ResetPasswordForm } from "@/components/organisms/auth/auth-forms";

export const metadata: Metadata = { title: "Nova senha" };

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
