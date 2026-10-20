"use client";

import * as React from "react";

import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/**
 * Barra de abas que rola na horizontal no celular.
 *
 * O `TabsList` do shadcn é `inline-flex` com fundo arredondado e os gatilhos
 * são `flex-1`. Dando `w-full overflow-x-auto` nele, as abas se espremem e a
 * primeira e a última ficam cortadas pela própria borda do fundo. Aqui quem
 * rola é um contêiner externo; a lista cresce o quanto precisar
 * (`w-max min-w-full`) e as abas mantêm a largura natural.
 *
 * A margem negativa faz a rolagem chegar à borda da tela, alinhada ao `px-4`
 * da página — sem ela, a última aba parece cortada mesmo rolando até o fim.
 */
export function ScrollTabsList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <TabsList className={cn("w-max min-w-full", className)}>
        {children}
      </TabsList>
    </div>
  );
}

export function ScrollTabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsTrigger>) {
  return <TabsTrigger className={cn("flex-none", className)} {...props} />;
}
