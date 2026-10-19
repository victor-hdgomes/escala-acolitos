import type { Metadata } from "next";

import { SignUpForm } from "@/components/organisms/auth/auth-forms";

export const metadata: Metadata = { title: "Criar conta" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ convite?: string }>;
}) {
  const { convite } = await searchParams;
  return <SignUpForm invite={convite} />;
}
