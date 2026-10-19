import Link from "next/link";
import { Church } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-4 text-center">
      <Church className="mb-4 h-6 w-6 text-primary" />
      <h1 className="text-lg font-semibold tracking-tight">
        Não encontramos essa página
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        O link pode ter expirado, a escala pode ter sido removida ou o endereço
        veio incompleto do WhatsApp.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Voltar ao início</Link>
      </Button>
    </div>
  );
}
