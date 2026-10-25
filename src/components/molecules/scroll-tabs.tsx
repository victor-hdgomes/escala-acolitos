"use client";

import * as React from "react";

import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/**
 * Tab bar that scrolls horizontally on a phone.
 *
 * shadcn's `TabsList` is `inline-flex` with a rounded background, and the
 * triggers are `flex-1`. Giving it `w-full overflow-x-auto` squeezes the tabs
 * and clips the first and the last against the background's own edge. Here it
 * is an outer container that scrolls; the list grows as much as it needs
 * (`w-max min-w-full`) and the tabs keep their natural width.
 *
 * The negative margin makes the scroll reach the edge of the screen, aligned
 * with the page's `px-4` - without it, the last tab looks cut off even when
 * scrolled all the way.
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
