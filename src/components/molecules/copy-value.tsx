"use client";

import { useTranslations } from "next-intl";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/client-utils";

/**
 * A value the reader is meant to pass on: a join code, a link, a token.
 *
 * Every one of these screens had the same bordered row with a copy button
 * next to it, which is three chances to get the toast or the aria-label
 * wrong. The `code` variant spaces the characters out, because a join code is
 * read off one phone and typed into another.
 */
export function CopyValue({
  value,
  variant = "text",
}: {
  value: string;
  variant?: "text" | "code";
}) {
  const common = useTranslations("common");

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2">
      <code
        className={
          variant === "code"
            ? "min-w-0 flex-1 text-center font-mono text-xl tracking-[0.25em]"
            : "min-w-0 flex-1 truncate text-xs"
        }
      >
        {value}
      </code>
      <Button
        size="icon"
        variant="ghost"
        aria-label={common("copy")}
        onClick={() => {
          void copyToClipboard(value);
          toast.success(common("copied"));
        }}
      >
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}
